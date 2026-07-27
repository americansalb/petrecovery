# Health Book UI/UX audit

Full-surface audit of the Health Book (the "Health" tab and every surface
that presents its data), performed 2026-07-27 against a locally seeded
build. 89 full-page screenshots live in
[`screenshots/healthbook-audit/`](../screenshots/healthbook-audit/) and are
referenced inline as `[shot]`. Line references are to the code as of this
audit's commit.

## 1. Scope and method

Surfaces exercised:

- **Health tab** (`/pets/[id]/health`) — Overview, Vaccines, Weight, Vet
  subtabs, plus the Add-vaccine modal, manage/remove flow, weight logging,
  vet editing, and `?tab=` deep links.
- **Today page** health glance (`PetGlance`), **public share view**
  (`/pets/view/[token]`, the "clinical face"), **profile ribbon target**,
  **landing-page Health Book lane**, **admin pet detail**.
- **Viewports**: 1440×900 desktop, 390×844 mobile, 320×690 tiny.
- **Roles**: owner, CAREGIVER share, VIEWER share, no-access account,
  logged out.
- **Failure modes**: API 500s, slow APIs, bad pet id, bad share token.

Eight fixture pets were seeded to reach every status the math in
`lib/healthBook.js` can produce: empty book (Pip, Luna), on-file-only
records with no expiries (Willow), due-soon (Mochi, Max), multiple
expired including one 14 months stale (Biscuit), long names and a
233-char medical note (Sir Reginald), an 8-vaccine/59-weight data-heavy
record with a same-name duplicate and an outlier typo entry (Atlas), and
a vet-phone-only record (Mochi).

**Verdict in one line**: the information architecture and the calm visual
language are genuinely good — the failure modes are where the Book breaks:
error handling, multi-problem records, long time ranges, and the mobile
bottom sheet.

## 2. Findings — high severity

### H1. A failed vaccinations fetch renders as "record is empty" and invites re-entry

`app/pets/[id]/health/page.js:53-57` maps any non-OK response to
`{ vaccinations: [] }` with no error state. With `/vaccinations` returning
500, Max's page confidently shows **"Max's record is empty. Start Max's
Health Book with their first vaccine."** plus an **Add first vaccine**
button — while his weights load fine next to it
[g01-desktop-max-vaccinations-api-500-silently-empty]. All-API failure
looks the same [g02]. The stakes: an owner may re-enter records (the
renewal logic at `api/pets/[id]/vaccinations/route.js:69-87` would then
tombstone the hidden originals on name match), or simply stop trusting the
Book. The Today page already solves this correctly — its comment reads "A
load failure must not masquerade as 'you have no medications'"
(`today/page.js:314-317`). The Health tab needs the same rule.

### H2. Mobile: the Add-vaccine bottom sheet's primary button is buried under the global tab bar

On 390px, the sheet (`components/ui/Modal.jsx`, `z-50`, `items-end`) sits
behind `GlobalBottomNav` (`GlobalBottomNav.js:50`, also `z-50`, later in
the DOM): the **Add vaccine** CTA is a sliver of teal behind the tab bar
and Report FAB, and the bar stays bright and tappable while the backdrop
dims everything else [d08-mobile-max-addvaccine-bottomsheet]. Every
mobile add flow hits this. Fix: raise modal z above the bar, or hide the
bar while a sheet is open, or give the sheet bottom padding equal to the
bar height.

### H3. The status sentence misleads on multi-problem and stale records

The Overview's one-sentence verdict — the feature's centerpiece — is
wrong in three ways the fixtures reach:

- **Undercount.** `TONE_HEAD.warn` is hardcoded "has one thing due"
  (`HealthRecord.js:38-43`). Atlas has **six** vaccines due within 11
  days; the page says "Atlas has one thing due. Bordetella due by Aug 7."
  [a08-desktop-atlas-health-overview]. Nothing on the Overview says six.
- **Arbitrary pick.** `healthBookStatus` reports `expired[0]` in API
  order (most recently administered first, `lib/healthBook.js:64-67`).
  Biscuit's headline names **Leptospirosis (expired 10 days ago)** while
  **Rabies has been expired 14 months** — the legally consequential,
  longest-lapsed protection is never mentioned
  [a05-desktop-biscuit-health-overview]. "Worst state first" should apply
  within the bucket: sort by expiry ascending.
- **Year-less dates.** `shortDate` in `lib/healthBook.js:41-43` prints
  month + day only. Had the sentence picked Rabies it would read "expired
  May 16" — implying this year for a 2025 expiry. The Vaccines list gets
  this right ("Expired May 2025", `HealthRecord.js:18`); the sentence
  should too once an expiry is >6 months old.

### H4. Weight chart x-axis labels read as days, not years

The only two labels on the chart are formatted `MMM yy`
(`HealthRecord.js:240`): Atlas's three-year growth curve is labeled
**"Jul 23 → Jul 26"**, which any reader parses as July 23rd–26th — a
four-day window for three years of data
[a08-desktop-atlas-health-weight, f03]. Use "Jul 2023" / "Jul 2026", or
"'23"-style ticks.

## 3. Findings — medium severity

### M1. Today hides the health glance for pets with no medications

`today/page.js:318-324`: when a pet has no meds/routines, the whole grid
— including `PetGlance` — is replaced by a meds-only empty card
("Nothing to track yet. Add a medication"). Biscuit, with **two expired
vaccines**, shows no health signal on Today at all; probed at 9s to
confirm it's permanent, not slow loading
[c01-desktop-biscuit-today-glance-expired,
c08-desktop-biscuit-today-after-9s-no-glance]. The glance —
"the strongest piece of the Health Book" per its own docstring — should
render alongside the meds empty state, and the empty card shouldn't imply
the whole page is only about medication.

### M2. Weight entries cannot be edited or removed in the UI

The DELETE endpoint exists (`api/pets/[id]/weights/route.js:73-103`), but
neither the Weight card nor the history offers it. Atlas's fat-fingered
**14.2 lb** entry (meant 142) is permanent in the UI: it crushes the
chart's y-scale into a cliff, and the chart has **no y-axis labels** to
even reveal the scale [a08-desktop-atlas-health-weight]. A quiet
per-entry remove (mirroring the vaccine manage mode) fixes data hygiene;
y-min/max labels would make the chart honest about outliers.

### M3. Backfilled same-name vaccines produce contradictory duplicate rows

Renewal auto-retire only tombstones records administered **on or before**
the new one (`vaccinations/route.js:69-78`). Backfilling history — adding
last year's Rabies after this year's is on file — yields both **"Rabies ·
Current"** and **"Rabies · Due soon"** in the passport
[a08-desktop-atlas-health-vaccines], and both count in the "2 of 3
current"-style summaries. Either retire older same-name records at
insert regardless of direction, or group rows by vaccine name showing
newest-per-name.

### M4. The passport doesn't sort by urgency

The Vaccines list keeps API order (given-date desc). Atlas's two current
shots sit on top; six due-soons below; an expired row can land below the
fold on mobile. `PetGlance` already ranks EXPIRED → DUE_SOON → current
(`PetGlance.js:53-58`) — the passport should use the same rank (or a
grouped layout) [a08-desktop-atlas-health-vaccines,
f02-desktop-sarah-viewer-atlas-vaccines].

### M5. Weight trends are quoted without a timeframe — and one is hardcoded wrong

- Overview `VitalsTrio` compares latest vs **first-ever** entry
  (`HealthRecord.js:70-75`): Atlas reads **"141.5 lb, up 117.5 lb"** —
  his whole life since puppyhood, presented like a recent change
  [a08-desktop-atlas-health-overview].
- `PetGlance` prints the same first-vs-latest delta labeled **"· 6 mo"
  hardcoded** (`PetGlance.js:141-146`) — false for any pet whose history
  isn't six months long [c02-desktop-max-today-glance-duesoon].
- One entry renders "9.1 lb, steady" — a trend claim from n=1
  [a04-desktop-mochi-health-overview].
  Window the delta (e.g. last 90 days) and label it with the real span.

### M6. A vet phone number without a name/clinic is invisible

`VetCard` and `PetGlance` gate on `vetName || vetClinic`; Mochi has only
`vetPhone` and the Vet tab says **"No vet on file."** while the public
view happily lists the phone [b16-desktop-mochi-vet-phone-only-shows-none
vs e03-desktop-publicview-mochi-phoneonly]. In an emergency-oriented
product, a reachable number is the single most valuable vet field.

### M7. Future "given on" dates are accepted

The date input's `max` stops the picker but not typing; the server only
checks expiry > given (`vaccinations/route.js:20-27`). A "Titer test"
given 2026-08-20 (three weeks from now) saved fine and shows **Current**
[b06, b07-desktop-max-vaccines-after-future-dated-add]. The weights API
explicitly rejects future dates (`weights/route.js:47-49`); vaccinations
should mirror it.

### M8. Weight input: silent mangling and unhelpful limits

- `parseFloat` truncation: typing **"12abc"** logs **12 lb** with no
  confirmation [b12, b13-desktop-willow-weight-12abc-logged-as-12].
- Typing **501** returns "**Weight should be a number of pounds**" — 501
  is a number of pounds; the real rule (≤ 500) is never stated
  [b11-desktop-willow-weight-501-error].
- Typing 0 silently does nothing (button no-ops, no message) [b14].
  Validate the string client-side, echo the parsed value, and say the
  actual bounds in the error.

### M9. The medical-conditions ribbon is an unbounded red paragraph

`AlertRibbon` (`HealthRecord.js:30-35`) renders raw red text with no
label, icon, container, or clamp. "Seasonal allergies" reads like an
error string [a06-desktop-max-health-overview]; Sir Reginald's 233-char
note becomes a **seven-line red wall that owns the first mobile screen**,
above the status verdict [a07-desktop-reggie-health-overview,
d04-mobile-reggie-health-overview-longnames]. It's also a link with no
affordance. Give it a "Medical note" label/icon, clamp to ~2 lines with
expansion, and reserve full-red for genuinely critical flags.

### M10. On-file-only records claim "up to date"

Willow's two vaccines have **no expiry dates at all**, yet the verdict is
**"Willow is up to date." / "Protections on file."** in confident teal
[a03-desktop-willow-health-overview] — records given 1.5–2 years ago.
The design doc calls no-expiry "unknown" (slate). Neutral copy ("2
records on file — expiries unknown") would avoid overclaiming coverage
the data can't support.

## 4. Findings — low severity

- **L1. Subtab state vanishes on click.** `?tab=weight` deep links work,
  but clicking tabs never updates the URL; after clicking Vaccines the URL
  still says `tab=weight`, and reload snaps back to Weight
  [b19, b20-desktop-atlas-after-tabclick-reload-back-to-weight].
- **L2. Modal accessibility.** No focus trap and no initial focus move:
  after opening Add-vaccine, `document.activeElement` remains the
  background "Add" button and Tab walks the page behind the dialog
  (probed programmatically). Escape works. `SubTabs` renders
  `role="tablist"` without arrow-key navigation (`SubTabs.js:12-36`).
- **L3. Vaccine-name validation is server-only, ASCII-only, vague.**
  One-char and accented names ("Fièvre aphteuse") round-trip to the
  server to fail with "2 to 40 plain characters"
  (`vaccinations/route.js:15`) [b03, b03b]. Brand names with ®/™ or any
  non-Latin script are unenterable.
- **L4. Bird/rabbit/other presets suggest "Rabies" only.**
  `VACCINE_PRESETS.DEFAULT` [b01-desktop-pip-addvaccine-modal-bird-presets]
  offers a cockatiel a rabies shot — species-inappropriate; avian/rabbit
  presets (Polyomavirus, RHDV2…) or a neutral "Other"-first modal would
  fit better. The modal also opens as two chips + a disabled button with
  no hint of what comes next.
- **L5. Expiry granularity is 1yr/3yr/none.** Real certificates carry
  exact dates; there's no custom-date option, and the schema's
  `lotNumber`/`certificateUrl` fields (plus the design doc's "snap the
  certificate" primary path) have no UI at all.
- **L6. "Recent" includes 2022.** The history caps at six month-groups
  regardless of age, so a sparse record shows a four-year-old stamp under
  "Recent" [a05-desktop-biscuit-health-overview].
- **L7. Red "(0%)" adherence on the reference surface.** The month
  header's "0 of 2 doses given (0%)" in alarm red duplicates the Today
  page's job on the Health tab, with only a `title` tooltip explaining
  the 35-day window [a06, a08].
- **L8. Year-less dates recur.** Public-view weight ("65 lbs · Jul 27")
  and the status sentence never show a year; a 2024 weigh-in would read
  as current [e01, e02].
- **L9. 320px: the mobile section tab strip clips "People" with no
  scroll affordance [d10-tiny320-atlas-health-weight].**
- **L10. Remove-confirm copy**: "It cannot be undone here" — records are
  tombstones (never hard-deleted) but no surface offers restore, so
  "here" promises a place that doesn't exist [b09].

## 5. What holds up well

- **Permissions are airtight in the UI**: VIEWER sees no Add/Manage/log
  affordances anywhere [f01–f04]; CAREGIVER gets vaccine/weight write but
  no vet editing [f06, f07]; no-access and bad-id land on the clean
  "This pet isn't available" state [f05, g05]; logged-out redirects with
  a correct `callbackUrl` [g04].
- **The public clinical face** is exactly what the design doc promised:
  dense, neutral, statuses spelled out per vaccine with years and
  red/amber coding, conditions and meds up top, bad tokens get a clear
  revocation message [e01, e02, e04].
- **Empty states invite** rather than stage voids, and the CTA wiring is
  right: empty→opens the modal on the Vaccines tab, warn/bad→lands on
  Vaccines [a01, b18].
- **Forward renewals** auto-retire the replaced stamp; medical data is
  tombstoned, never hard-deleted.
- **The 320px weight-row wrap fix works** — zero horizontal overflow at
  320 (programmatic probe found no offenders).
- **Duration follows the picked preset** (the past Rabies→DHPP expiry bug
  stays fixed) [b05].
- **Today's failure handling** is the correct pattern H1 should copy.

## 6. Suggested priority order

1. H1 error state (trust), H2 mobile sheet (conversion), H3 status
   sentence correctness — these three touch the feature's core promise.
2. H4 + M2 + M5 make the weight story honest (labels, windowed delta,
   entry removal).
3. M1 (glance on med-less Today) and M6 (phone-only vet) are small
   patches with outsized care-moment value.
4. M3/M4 vaccine list integrity; M7–M10 input & copy hardening; then L*.

## 7. Screenshot index

All captures: [`screenshots/healthbook-audit/`](../screenshots/healthbook-audit/).
Naming: `<phase>-<viewport>-<pet>-<surface>-<state>.png` — phase a =
owner desktop pristine states, b = interactions/validation, c = Today,
profile, landing, admin, d = mobile/tiny, e = public share view, f =
roles, g = failure modes. `_run-log.json` holds the driver's notes
(URL-state probe, modal focus probe, 320px overflow probe) and the one
harness failure (b03's first attempt, superseded by the b03 rerun).
