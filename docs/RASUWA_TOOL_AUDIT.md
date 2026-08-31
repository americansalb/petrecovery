# Audit: the rescueourfamily.org write-to-Congress tool

Date: 2026-08-31. Scope: the letter tool at `/rasuwa` (served as
rescueourfamily.org), the sign page at `/rasuwa/form` (the domain's front
page), the district lookup at `/api/rasuwa/district`, the bundled data
files, and the routing and rate limiting around them.

The question this audit answers: can 100+ people, most of them not
comfortable with technology, each use this tool once, on their phones,
without hitting errors or losing their work? And what should change in the
UI and UX, borrowing from what already works on reunitepets.org?

How it was audited: full read of every file in the flow; the rasuwa,
link-preview, and global-chrome test suites run (182 tests, all green); a
full production build (passes; `/rasuwa` is a static page, 141 kB first
load); and a hands-on reproduction of the PDF font problem (finding H5).
The live sites could not be fetched from this session (network policy
blocks outside hosts), so anything marked "verify live" needs a check
against the deployed site.

## The short version

The architecture is right for a surge. Both pages are static, the letters
and the PDF are built in the browser, and there is no database behind any
of it, so 100 or 1,000 simultaneous visitors mostly just download static
files. Only two shared choke points exist: the district lookup proxy and
the embedded Google roster form. The privacy design (nothing stored,
address sent by POST, no logging) is correct for this audience and should
not be weakened.

The real risks are not server load. They are:

1. **Phones lose everything typed when the user switches apps** and the
   flow requires switching apps (calling, opening contact forms,
   viewing the PDF). Nothing is saved, so a discarded tab restarts the
   ten-minute task from zero. (H1)
2. **Hand-edits to the letter are silently thrown away** when any other
   field is changed afterward. (H2)
3. **A room full of people on one WiFi shares one 15-lookups-per-minute
   budget**, and the overflow error says "Too many requests". (H3)
4. **The roster form is an Apps Script web app**, which Google caps at
   30 simultaneous executions; a burst of signers can see a Google error
   inside the frame on the domain's front page. (H4)
5. **The PDF silently corrupts non-Latin names** (Ś prints as Z,
   Devanagari prints as garbage) with no error shown. Verified by
   reproduction. For families of Nepali and Indian missing people this
   will happen. (H5)

All five have contained fixes, listed with each finding and prioritized at
the end.

## What is already good (keep all of this)

- **Static-first scale.** `/rasuwa` and `/rasuwa/form` build as static
  pages. Letters are assembled client-side; the PDF is rendered
  client-side behind a dynamic import so the heavy library never loads
  unless asked for. Per-visitor cost to the server is close to zero.
  The 100-users-at-once story fundamentally works.
- **Privacy by construction.** No database, no logging of addresses, the
  district lookup POSTs the address in the body so it stays out of edge
  logs, and the coordinator's email is assembled at runtime. The page
  says so in plain words. This is the right posture for families of
  missing people and it is honest today.
- **Graceful fallbacks already exist.** Lookup failure falls back to a
  manual state and district picker (which stays visible until a lookup
  succeeds); senators appear from the state alone, with no lookup needed;
  a blank roster iframe has an open-in-new-tab link; clipboard copy has an
  execCommand fallback for old browsers; PDF failure shows a copy-instead
  message.
- **Placeholders, not crashes.** Empty fields become visible
  `[your name]` gap markers, never `undefined`. Tested.
- **The data pipeline protects itself.** The directory build script
  refuses to write a short or malformed directory, and the test suite
  re-checks the committed file (100 senators, 2 per state, phone
  formats). A bad refresh cannot ship quietly.
- **Sensible copy.** Plain sentences, a time estimate ("about ten
  minutes"), call-first guidance with a 30-second phone script, the
  privacy release form explained. Territory and delegate cases are
  handled and explained.
- **Routing.** rescueourfamily.org root and /form redirect (not rewrite)
  to `/rasuwa/form`, so the pet-site chrome correctly stays hidden;
  `/nepal` and `/action` aliases work on every host.

## High findings

### H1. Nothing is saved, and the flow forces app switches

The tool takes about ten minutes and ends with: tap a phone number (jump
to the dialer), open a contact form (new tab), download and view a PDF,
send an email. On phones, especially cheap Android phones, a backgrounded
browser tab is routinely discarded; coming back reloads the page empty.
The person who dutifully follows step 5's "Call first" loses steps 1
through 4 while on the call. At a letter-writing event this will happen
to many people, and a non-technical person will not know why or retype it
all a second time.

reunitepets.org already solved exactly this for exactly this kind of user:
the report wizard persists a draft to sessionStorage on every change
(`app/components/report/wizardDraft.js`) and, on return, offers an
explicit "Pick up where you left off?" choice (`DraftPrompt.js`), never a
silent prefill.

**Fix:** adapt `wizardDraft` for the rasuwa tool (person, writer, lookup
result, letter overrides, one key). Session-scoped storage keeps the
privacy story intact; update the privacy note to stay honest: "What you
type stays on your device and is cleared when you close this tab." Add a
"Clear my details" button next to that note. The explicit-restore prompt
matters here too: a volunteer's shared phone must not silently show the
previous family's entry (see M7).

### H2. Hand-edits to the letter are silently destroyed

Any change to any person or writer field clears all letter overrides
(`clearOverrides` inside `setP`/`setW` in `RasuwaLetterTool.js`). The
invalidation exists for a good reason (a stale override would freeze the
previous person's details into the PDF), but the destruction is silent.
The likely sequence for a careful user: fill the letter's `[brackets]`
directly in the textarea, notice their phone number has a typo, fix the
typo, and every hand-edit in every letter vanishes without a word.

**Fix, smallest first:** show a notice when overrides are discarded
("Your details changed, so the letters were rebuilt. Hand edits were
replaced."). Better: confirm before discarding, or rebuild only
non-edited letters and badge edited ones as "built from older details.
Rebuild?". Either way the user must see that it happened.

### H3. One venue, one IP, 15 lookups a minute

`/api/rasuwa/district` is limited in `middleware.js` to 15 requests per
minute per IP. A hundred families in one hall, one temple, or one
community center are one public IP. The first fifteen lookups in a minute
succeed; the rest get a 429 whose body the UI shows as "Too many
requests", which reads as "the site is broken". People then mash the
button, which keeps them limited.

Notes that sharpen or soften this: the limiter is in-memory per server
instance (the durable Redis-backed limiter in `app/lib/rateLimit.js` is
used by other routes but not this one); the IP key comes from the leftmost
X-Forwarded-For entry, so if the fronting proxy does not set it, every
visitor shares one "unknown" bucket and the cap becomes global at 15/min.

**Fix:** raise this route's limit to 60/min (each request is one cheap,
un-keyed Census call; the abuse surface is small and the address is never
stored). Handle 429 in the client with a human message: "A lot of people
are using this right now. Wait a minute and try again, or pick your state
and district by hand below." Verify on the deployed host that
X-Forwarded-For is actually populated per client. Optionally move the
route onto the durable limiter like its API peers.

### H4. The roster form on the front page is an Apps Script web app

`ROSTER_FORM_URL` points at a `script.google.com/macros/.../exec` web
app, embedded in an iframe as the front page of rescueourfamily.org.
Google caps Apps Script web apps at 30 simultaneous executions per
script; every page load and every submission is an execution. A burst of
signers (a news mention, a WhatsApp blast, an event where everyone signs
at once) can put a raw Google error page inside the frame, on the first
screen a family ever sees. Apps Script web apps also require the
ALLOWALL deployment setting or the frame is simply blank (the
open-in-new-tab fallback above the frame covers that case, but only for
users who read it).

**Fix:** if the roster collects into a spreadsheet, replace the web app
with a native Google Form (a forms.gle link) writing to the same sheet
and embed that instead: Google Forms embeds have no such execution cap,
render a familiar UI, and never show script warnings. If the web app must
stay, keep the fallback link prominent, and have the script use
LockService around sheet writes so concurrent submissions do not collide.
Verify live: load rescueourfamily.org, confirm the frame renders, and
submit a test entry. This is the single most likely thing to break first
under a surge, and it is the front door.

### H5. The PDF silently corrupts non-Latin names (verified)

`LetterPdf.js` uses the built-in Times-Roman font, which only encodes
Latin-1 era characters. Reproduced in this audit with the app's exact
dependency: "Śrestha" renders as "Zrestha", "ṇ" renders as a wrong
letter plus a control code, and Devanagari (पूनम) renders as garbage
glyph codes. No exception is thrown, so the existing "PDF could not be
built" message never appears; the family prints and faxes a letter with
their loved one's name mangled and may not notice.

The audience makes this likely, not theoretical: the missing are mostly
Nepali and Indian nationals, and names typed with proper diacritics or in
Devanagari are natural inputs here.

**Fix, either of:**
- Register a Unicode font for the letter document. Inter is already
  vendored (`app/lib/cascade/render/fonts/`) and covers Latin diacritics;
  add a Noto Serif Devanagari subset to cover Nepali script. Register via
  `Font.register` in `LetterPdf.js` the way
  `cascade/render/flyers/registerFonts.js` does.
- Or, cheaper: before building the PDF, scan the letter bodies for
  characters outside the encodable range and warn: "The PDF cannot print
  these characters: ... They will look wrong on paper. The on-screen
  letter and Copy letter are not affected."

The first option is the real fix; the second is an honest stopgap that
can ship in an hour.

## Medium findings (mostly UX for non-technical users)

### M1. 435 of 437 House members have no direct contact-form link

The bundled directory carries `contactForm` for 86 of 100 senators but
for only 2 of 437 representatives (the upstream dataset is sparse for the
House). So for the recipient who matters most for casework, step 5 sends
almost everyone to the member's homepage with "use its Contact page".
Finding the Contact link on an unfamiliar site is precisely the skill
this audience lacks.

**Fix:** in `scripts/build-congress-directory.js`, probe
`{member.url}/contact` at build time (House sites are near-uniform on
this path) and record it as the contact form when it responds; keep the
current fallback otherwise. Add one plain sentence to step 5 for the
fallback case: "On the site, look for a button that says Contact or
Email."

### M2. The state dropdown shows bare codes

The picker renders "AL, AK, AZ..." even though `US_STATES` carries full
names. Show "Alabama (AL)". People know their state; not everyone maps
it to a code instantly, and a wrong state silently selects the wrong
senators.

### M3. Letter state can disagree with the found district

If the person picked a state by hand and then runs a lookup that resolves
a different state (typo fixed, moved recently, picked the wrong state),
the recipients switch to the looked-up state but the letter and subject
keep the hand-picked one: "Constituent in Newark, NJ" addressed to New
York senators. Offices filter for constituents, so this can get the
letter discarded. **Fix:** always sync `writer.state` to the lookup
result (today it syncs only when state was empty), or show a visible
mismatch warning.

### M4. mailto-only actions fail silently in in-app browsers

Step 6's "Email my entry" and the footer's corrections link both work by
`mailto:`. Inside WhatsApp, Facebook, and Instagram in-app browsers, and
on phones with no configured mail app, `mailto:` frequently does nothing,
with no error. And because the coordinator's address is only ever an
mailto target, a person whose mail button does not work has no way to
even see the address. **Fix:** add a "Copy my entry" button beside the
mail button, and render the coordinator address as selectable text
(client-rendered, so the anti-scraper posture is unchanged). Make the
coordinator phone a tel: link; it is plain text today.

### M5. The PDF download can no-op in in-app browsers

Blob downloads via a programmatic click are unreliable inside in-app
browsers (common on iOS). No exception fires, so the existing error
message does not either. **Fix:** under the download button, always show
one line: "Nothing downloaded? Open this page in Safari or Chrome, or
use Copy letter." Consider offering the letter through the native share
sheet (`navigator.share`) on phones that support it; for this audience,
"share to WhatsApp/Notes/Mail" is the most familiar way to move text.

### M6. Nothing tells the user which blanks remain

A letter can be copied with `[your name]` still in it. The bracket
convention is good (incomplete letters look incomplete), but a
non-technical user pasting into a webform may not scan for brackets.
**Fix:** above Copy and Download, one live line built from the same
placeholder logic: "Still blank: your name, your phone number." Not
blocking, just visible.

### M7. No start-over for shared devices

The realistic model for 100 non-technical users is often one volunteer
device helping several families in a row. There is no reset; clearing
means backspacing every field. **Fix:** a "Start over for the next
family" button (with confirm) that clears all state and the draft from H1.

### M8. The Copied indicator crosses letter tabs

Copy letter A, switch to senator B's tab: the button still says "Copied"
for the moment, on a different letter. Key the copied state by recipient.

### M9. Two-word surnames truncate

`recipientLastName` takes the final token, so Sen. Van Hollen renders as
"Senator Hollen" in chips, salutations, and the phone script. A small
override map for the handful of multi-word surnames in the current
Congress fixes every case.

### M10. The phone script names whichever letter tab is active

Step 5's script uses the active letter's recipient, so a person calling
their second senator while the first's tab is active reads the wrong
name. Cheap fix: use "your office" in the script, or render one script
per recipient next to that recipient's numbers.

### M11. Shared links unfurl with the pet-site logo

`/rasuwa`'s share metadata has no image, so the card falls back to the
ReunitePets logo. A rescueourfamily.org link pasted in a family group
chat previews with a pet-rescue logo, which reads as a wrong link or a
scam at the worst possible moment for trust. `/rasuwa/form`, the actual
front page of the domain, additionally inherits the letter-tool title in
its card while its page title differs. **Fix:** one neutral share image
for both pages (text-on-plain-background: "Rasuwa flood: missing family
response"), and give `/rasuwa/form` its own `buildShareMetadata` call.

### M12. The domain's front page opens on a form with little context

rescueourfamily.org lands on the embedded sign form with two lines of
header. A first-time visitor from a flyer or a news story is asked to
sign before being told what the letter is, who coordinates it, or what
has happened so far. **Fix:** three or four plain sentences above the
frame (what the letter asks, how many families have signed, who
coordinates it, what happens after signing), or make the root a minimal
landing with two large buttons: "Sign the families' letter" and "Write
to your members of Congress".

## Low findings and hygiene

- **Census upstream is a single point.** One geocoder, 10s timeout, no
  retry; the Census service has maintenance windows. The manual picker
  covers an outage. Optionally retry once on a 5xx. If organizers want to
  know the tool is healthy during a push, add a count-only success/failure
  metric (status codes only, never the address); that stays inside the
  privacy promise.
- **Error responses from the lookup lack a no-store header** (success
  sets one). No address is echoed, so this is hygiene only.
- **Bundle is fine.** 141 kB first load for `/rasuwa` including the
  165 kB (pre-gzip) member directory; the PDF library loads only on
  demand. No action needed.
- **Facts staleness is a process risk.** `FACTS_DATE` and the situation
  numbers live in `letterData.js` and require a code deploy to change,
  during a crisis that moves daily. The file-based design is fine; make
  sure a letterData-only edit can be deployed in minutes, and note who
  owns updating it.
- **Directory staleness** is handled well (build script with loud
  validation, updated date printed on the page). Five members have no
  district office listed and 226 of 537 have a fax number; the fax step
  already renders conditionally.
- **No gallery screenshots** exist for `/rasuwa` and `/rasuwa/form`
  (house convention: `screenshots/README.md`, regenerated by
  `frontend/scripts/gallery-sweep.js`). Worth adding so copy and layout
  reviews can happen from the gallery.

## The 100-person surge, traced end to end

Worst realistic case: an organized event plus a group-chat blast, many
attendees on one WiFi, most on phones, many inside WhatsApp's in-app
browser.

| Stage | Holds up? | Weak point |
|---|---|---|
| Page load | Yes. Static page, 141 kB. | None |
| Sign form (front page) | Risk. | Apps Script 30-execution cap (H4) |
| Steps 1-2 typing | Yes, until an app switch. | No draft; work lost on tab discard (H1) |
| Find my district | Risk on shared IP. | 15/min per IP, raw 429 message (H3) |
| Letters build | Yes. All client-side. | Silent override wipe (H2) |
| Copy into contact forms | Mostly. | House members lack direct links (M1) |
| Calls | Yes. tel: links. | Returning from dialer re-triggers H1 |
| PDF | Mixed. | Non-Latin names corrupt (H5); in-app browsers no-op (M5) |
| Email coordinator | Mixed. | mailto dead in in-app browsers (M4) |

Fix H1 through H5 and the trace is clean at every stage that the site
controls.

## What to borrow from reunitepets.org

The pet site's report wizard was built for panicked, non-technical people
and has the patterns this tool is missing:

1. **Session drafts with explicit restore** (`wizardDraft.js` +
   `DraftPrompt.js`): the direct fix for H1 and the shared-device model
   in M7.
2. **Restore is a choice, never a silent prefill**: the DraftPrompt
   principle transfers exactly (a new family on a volunteer's phone must
   not inherit the previous family's entry).
3. **Autocomplete and input modes on contact fields**
   (`ContactFields.js` conventions): the rasuwa tool already does this
   well; keep it when touching the form.
4. **Do not import the full wizard.** One question per screen suits the
   pet report; the letter tool's six numbered cards on one scrolling page
   are right for a compose-and-deliver task and avoid navigation state a
   stressed user can lose. Keep the single page; add drafts, the blank
   checklist (M6), and bigger primary buttons.

## Priority order

Ship first (each is small, all five close the surge trace):
1. H5 stopgap: warn on characters the PDF cannot print (then the font
   registration as the real fix).
2. H1: session draft + restore prompt + honest privacy wording + clear
   button.
3. H3: raise the route's limit to 60/min and humanize the 429 message.
4. H2: visible notice (or confirm) when hand-edits are discarded.
5. H4: swap the roster embed to a native Google Form, or verify the web
   app deployment and keep the fallback link prominent.

Then, in one UX pass: M2 (state names), M3 (state sync), M4 (copy
fallback + visible address + tel: coordinator), M5 (download hint /
share sheet), M6 (blank checklist), M7 (start over), M12 (front-page
context), M11 (share image).

Then the data pass: M1 (probe House contact pages at build time), M8,
M9, M10, and the low-findings hygiene.

Nothing here requires changing the architecture, the privacy posture, or
the copy voice. The tool's bones are right; the work is making the last
mile (deliver, call, print, sign) as forgiving as the first mile already
is.

## Fix log

All fixed 2026-08-31, one commit per finding, each verified in the
running app with Playwright plus unit tests before pushing.

- **H1: tab-scoped draft with explicit restore.**
  `app/rasuwa/letterDraft.js` on the report wizards' `wizardDraft`
  storage; "Pick up where you left off?" on return, never a silent
  prefill; honest privacy wording; confirm-guarded clear.
- **H5: the PDF prints every name.** Vendored Noto Serif and Noto Serif
  Devanagari (OFL, `public/rasuwa/fonts`), per-script runs in
  `pdfText.js`, hyphenation off. For scripts the fonts lack, a warning
  above the download button names the characters, generated from the
  font files themselves (`scripts/build-rasuwa-pdf-coverage.js`).
  Proven by downloading a PDF in a real browser with a Devanagari plus
  diacritic name and rendering it: conjuncts shaped correctly.
- **H3 and lookup hygiene:** 60 lookups per minute per IP, a human 429
  message, one Census retry, no-store on every response, a sequence
  guard so a slow response cannot resurrect a corrected address, and
  the writer's state syncs to the lookup result (M3).
- **H2: the rebuild notice.** When a detail change replaces hand-edited
  letters, a notice above the letter says so; OK or editing again
  dismisses it.
- **H4 (code side) and M12:** the sign page explains the letter before
  asking for a name, and the open-in-its-own-tab fallback is prominent
  and covers errors. The organizer action stands: prefer a plain
  Google Form over the Apps Script web app (30 simultaneous executions
  cap), and test a live submission.
- **M11:** both pages share a dedicated card image
  (`scripts/build-rasuwa-share-image.js`); the sign page carries its
  own title and description. No more pet-logo unfurls.
- **UX pass (M2, M4-M10):** full state names in the picker, copy-entry
  fallback beside the mailto button with the coordinator address
  visible and the phone tappable, a standing download hint plus the
  native share sheet where available, a live "Still blank:" line, a
  start-over button for shared devices, per-letter copied indicators,
  particle and compound surnames (Van Hollen, De La Cruz, Blunt
  Rochester), and a phone script that is right on every call.
- **M1 (tooling):** `build-congress-directory.js` now probes
  `{url}/contact` for members without a dataset contact form (soft-404
  guarded, `--skip-probe` to disable). The audit sandbox cannot reach
  house.gov, so an organizer runs the refresh and reviews the diff;
  meanwhile step 5 tells people what button to look for on a member's
  site.
- **Found along the way:** the state picker listed DC twice
  (`US_STATES` already carries it); deduped. `/rasuwa` and
  `/rasuwa/form` are in the screenshot gallery and sweep script now.
- **The wizard rebuild (founder request, same day):** the single-page
  tool became a step wizard in the report wizards' shape (their
  StepScreen, OptionCardGrid, and DraftPrompt with a civic-blue theme;
  a rasuwa-branded shell with checklist, progress, and a live summary).
  Required fields gate each step, so a letter can no longer go out
  missing the writer's name or phone. Canada is a first-class path:
  postal code to MP (Represent API proxy at `api/rasuwa/mp`, hand
  entry as the fallback), a constituent letter routed through Global
  Affairs Canada, and delivery by MP email, constituency call,
  postage-free House of Commons mail, and the 24/7 consular line.
  Landing copy now leads with the living signer count. Verified with
  747 tests, a green production build, and a 20-check Playwright run
  across all three paths; the live Represent call needs one real
  postal-code check after deploy.
- **Founder follow-ups (same day):** rescueourfamily.org tabs carried
  the ReunitePets dog favicon; the family domain and the /rasuwa pages
  now have their own mark, manifest, and host-aware /favicon.ico
  (`scripts/build-rasuwa-icons.js`). And the landing pages' signer
  count was frozen at the August 29 figure; both pages now show the
  live roster size via `/api/rasuwa/roster-count` (ten-minute cache,
  validated, "More than 1,189" floor when the source is unreachable).
  The count goes fully live once an organizer pastes the three-line
  handler documented in `letterData.js` into the roster's Apps Script.
  The generated letters still cite 1,189 on purpose: they quote the
  letter as sent, a dated document an office can verify.
- **The live letter, the finish step, and the record (PR #220):**
  `rescueourfamily.org/letter` mirrors the coordinating family's
  Google Doc (ISR, five-minute cache, clean fallback link); every
  generated letter cites that stable address. The confusing last step
  became three finish boxes feeding an anonymous shared tally
  (`RasuwaTally`), with a retry queue in the tab draft so an outage
  never loses a family's +1. Every finished pass saves one capped copy
  of its letters to the families' record (`RasuwaLetterRecord`,
  write-only API, admin read with per-person coverage). The letter
  writes itself in the sidebar from the first field typed. "Roster"
  left all user-facing copy.
- **The family task force board (founder request, same day):**
  `rescueourfamily.org/team` (alias `/team`) is the coordination space
  the group chats cannot be: pinned updates, a needs board where
  anyone taps "I'll do it" (atomic claims; a second tap on a taken
  need answers with who has it), the coverage wall joining the letter
  record to the list of the missing with standing "I'll write for
  them" claims and one-tap handoff into the wizard
  (`/rasuwa?for=<num>`), and a running conversation. Access is one
  shared code (`RASUWA_TEAM_CODE`, HMAC cookie, durable rate limit on
  guesses, rotating the code logs everyone out) plus a typed name; no
  accounts. The board polls one endpoint every eight seconds, shows
  "new since your last visit," and is noindexed. Site admins get
  remove buttons through the existing admin session. Studied
  mission control and the Lurie committee site first; borrowed their
  mechanics (single-payload board, claim state machines, optimistic
  sends, per-visit unread) and deliberately not their UI. After
  deploy: set `RASUWA_TEAM_CODE` in the environment and drop the code
  in the family group chat.
- **The wizard slimmed to six screens (founder feedback, same day:
  "way too many steps", "going backward is not easy enough", and the
  coordinator's personal email and phone had to come off the site):**
  nine screens became six. The missing person's details ride the first
  screen and arrive filled when a name is picked; choosing where you
  live opens the about-you fields on the same screen; the address or
  postal lookup now shares a screen with the representatives it finds,
  so a failed lookup and its hand-entry fallback are one view, not a
  dead end between steps. Every screen after the first has a big Back
  button in the footer next to Continue, and finished steps in the
  sidebar checklist are clickable doors back. bhumika877@gmail.com and
  630-306-1983 are gone from the site: the finish step's entry card
  opens the family form instead, corrections route through the form,
  and a test now fails the build if a personal address returns.
  Drafts saved mid-pass on the old nine-step layout land on the merged
  screen that holds their fields.
- **Country fields type anything now (founder screenshot, same day:
  the country step's pick-list could not hold most countries, so
  people "cannot fill it in"):** both the step-1 nationality field and
  the international country step are free-text inputs with
  suggestions. Typed countries match their link guides
  case-insensitively ("france" finds France); anything uncovered gets
  the generic parliament-and-consulate guidance instead of a dead
  pick-list. This also closes a letter bug: a hand-entered person from
  an unlisted country used to force the literal word "Other" into the
  letter as their nationality; letters now carry the country as typed.
- **The letters counter the consent excuse (founder direction, same
  day: offices tell families "Nepal's military is not letting foreign
  teams in"; the campaign presses each writer's own government to
  obtain Nepal's consent):** every letter now carries a consent
  paragraph asking that each offer be made formally, in writing, at a
  senior level, that families be told what was offered, to whom, and
  on what date, and that any refusal by Nepal go on the record, citing
  Nepal's acceptance of American military helicopters and
  international rescue teams after the 2015 earthquake. The delivery
  step adds a prepared comeback box with a copyable question for the
  moment a staffer repeats the excuse on a call.
- **The letters page became the send page (founder feedback, same
  day: the copy button and the send link were on different screens,
  calling was suggested before emailing, the flow felt unorganized,
  and the PDF bundled all letters):** the deliver step is gone; five
  screens now. The send screen lists one card per office: the
  recipient's name, Copy the letter, Open the contact form (or an
  email button for Canadian MPs, ministry links internationally), a
  copyable subject line, an edit expander, and a Sent checkmark with
  an N-of-M tracker that rides the draft. Calling moved below the
  cards as "Sent? A call makes it count," with the script, the
  per-member numbers, the privacy-release ask, and the consent
  comeback in one place; paper, fax, and PDFs sit behind a toggle,
  one PDF per office. Fix-a-detail links jump to any earlier answer
  from the send screen. The letters also cite the live signature
  count on top of the dated August 29 delivery whenever the counter
  reports a larger number; the casualty figures still await the
  founder's current numbers (letterData.js is the one file to edit).
- **The letter facts moved to August 31 (founder: "still outdated
  info in the letters"):** sourced from the families' live letter
  (read through the founder's Drive connection; now dated August 31,
  addressed to Secretary Rubio) and current reporting: the State
  Department's August 30 briefing (about 85 Americans unaccounted
  for, nine evacuated), a combined death toll above 900 with
  thousands still listed as missing, more than 3,700 rescued by
  Nepali crews, the barrier lakes interrupting rescue work, the
  United Kingdom's pledge, and the fact that reshapes the consent
  argument: Nepal's Foreign Ministry says it is open to targeted
  technical support. That line now leads the consent paragraph and
  the call comeback. A test pins the new facts so the frozen August
  29 figures cannot slip back.
- **Everyone listed equally, alphabetically (founder rule, same day:
  no nationality hierarchy, nobody first, Poonam included):** the
  wizard's person picker dropped its United States and Other
  nationalities groups for one flat A-to-Z list with uniform
  "name, country" labels, and the team board's coverage wall sorts
  the same way. Pick values and the board's write-for-them links keep
  their original indexes, so saved drafts and shared links hold.
