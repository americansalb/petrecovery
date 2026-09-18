# Probably Earth: what launch needs

## Verification update (2026-09-18)

### No additional spending; multiplayer browser and reconnect verification

No additional spending is authorized. A paid hosted preview was an optional
proposal, not a prerequisite for continuing. Verification uses the existing
setup and the isolated local PostgreSQL database; no paid resource was created.

A browser player signed up from Find match with a synthetic local account. The
original tab detected verification and resumed the Script queue without another
click. A second independent HTTP client joined through the public matchmaking
API. Room `WMEVMG` completed all five rounds: browser score 2,612, peer 1,727;
final health 5,637 / 4,759. Mobile results showed +105 rating, placement 1/5 and
89 cosmetic points. A mid-match reload recovered the same seat and health.
These are local account-flow checks; the earlier temporary-inbox delivery test
is the separate evidence for actual email delivery.

This run exposed a poor mobile Script layout: the map was hidden until tapped,
then covered the language clue. Script multiplayer now keeps clue and map on
one screen, with an always-visible geographic choice, and keeps the locked map
visible while waiting. Street still uses its imagery/map drawer. Checked at
390x844, 320x568 and desktop 1280x800; the 320px document measured 312px wide
with the guess action inside the viewport. Component tests cover interactive
and locked states. Script match results now link to the Script ranking board.

Created private room `6UX5YK` through the browser with three rounds and a
three-minute timer; the independent peer joined with its invite code. In round
three, placed a pin and stopped the local Next server. The browser announced
connection loss without discarding the seat, health or pin. Restarting that
server against the same local database cleared the notice automatically;
submitting the preserved pin scored 143 points and reached the final reveal.

Added a game-specific error boundary after a failed development map chunk
showed pet-site error copy. Missing chunks get a full-page reload, not a retry
of an already-rejected import. No claim is made that an operator was notified.
The full suite caught a forbidden pet-telemetry import during implementation;
it was removed without weakening the game-isolation check.

Queue requests now time out, preserve uncertain tickets and recover by polling
rather than blindly joining again. Regressions cover a hung request, a lost
join response and an already-paired result. Final local full suite:
**167 suites / 1,597 passed**, ten existing todos, including the real PostgreSQL
checks. Changed application files lint cleanly. Current build/CI evidence is
recorded on PR291. Production still runs the older commit; this is not hosted
release verification and does not authorize a merge.

### Live sender corrected; real inbox delivery and Street browser checks

This update supersedes earlier notes that hosting access and actual email delivery
were blocked. The owner signed into the correct Render service. A read-only
provider check confirmed the existing `reunitepets.org` sending domain is verified.
Added `GEO_MAIL_FROM=Probably Earth <noreply@reunitepets.org>` to that service and
completed a configuration-only deploy, `dep-dammicp42hec739mua8g`. The live code is
still `9715c45`; no draft branch was merged or deployed.

At the owner's request, used a temporary test inbox, not their personal email.
The real Probably Earth sign-in email arrived and its link created a signed-in
session. This is delivery evidence, **not a successful end-to-end launch gate**:
the old production callback redirected to `https://localhost:10000/geo/me`, and
the signed-in profile showed zero points after the guest profile showed twenty.
The draft already carries public-origin and profile-binding fixes. A new route
regression exercises the exact Render internal-origin callback, including secure
cookies and a spent-link redirect. Hosted verification of the draft remains due.

Production now requires an explicit game sender and rejects the Resend test
domain instead of promising an email it cannot send. Missing sender configuration
returns 503; provider rejection is not reported as success. The pet site's sender
is not silently reused. Tests cover these cases without logging secrets or links.

Real Apple Street imagery worked on production (one Madrid round, 3,555 points)
and on the local PostgreSQL QA app using a short-lived public localhost token.
The draft browser completed three actual Street rounds (Linz 506, Bordeaux 778,
Brisbane 0; total 1,284), including a refresh and continuation. This exposed and
fixed two issues: hover expansion moved Guess before a click landed; a late Apple
imagery callback reopened a restored scored round. Round points metadata now
travels with the saved result rather than disappearing from the game subtotal.

At 390x844, opening the mobile map exposed an Apple renderer error and blank
tiles. Closing the drawer used `display:none`, collapsing its dimensions to zero.
It now stays offscreen at a real size and hidden from interaction until opened.
Browser verification showed geographic tiles, a tapped pin, a 2,603-point Linz
reveal and a fully visible next-round button, without horizontal overflow.
Refreshing preserved that 2,603-point reveal. Final local verification passed
**165 suites / 1,589 tests**, including all ten PostgreSQL release checks;
ten existing todos remain. Changed application files lint cleanly.
Continuing the mobile game exposed the same zero-size problem during round
loading: the parked map's parent also needed a flex layout. Corrected all parked
states and applied stable drawer sizing and explicit resizing to multiplayer.
The mobile game then completed to results: 2,603 + 785 + 0 = **3,388 / 15,000**.
The multiplayer layout correction has automated coverage; its full mobile
hosted match remains a release gate, not an inferred pass from solo testing.
Production-mode local build passed. At 390px it rendered real imagery and map
tiles, scored Madrid at 1,077 points and preserved both the result and the
14-point cosmetic award after refresh. The guest Save game action opened the
account dialog over the game, with a 90-day session explanation.
GitHub CI run 35372738121 exposed an intermittent pre-existing validation gap:
the rare Not Earth branch could bypass an unknown country. Candidate-source
validation now runs before that branch; a deterministic surprise seed proves
unknown countries are rejected. The two focused suites passed 37 tests.
The built-browser Save game dialog also exposed inherited `pointer-events:none`
from the game HUD: its inputs and close button ignored clicks. The dialog now
explicitly restores pointer events, with a component regression. Final tests run
with CI's two-worker configuration passed the counts above.
Desktop and 390px browser checks then confirmed the dialog accepts typed input,
and closing it returns to the intact 19-point Indianapolis reveal and 12-point
cosmetic award. CI run 35373498326 separately caught a flaky answer-leakage test:
random encrypted bytes happened to contain `jpl`. The test now checks readable
public fields while retaining the encrypted-token format and decoding checks.
These are local browser checks (development and the specified production build),
not hosted release verification. The full release is **not ready to merge**.

### Current direction: polygon gameplay restored; percentile leagues

Commit `a693caf2` passed CI run 35351192369. The final production build passed,
and its 390px browser run verified Japanese polygon focus, expandable learning
clues, a fully visible Next button, zero horizontal overflow, keyboard pinning,
and Japanese/Pular scoring. A subsequent refresh exposed a separate save UX
defect: plain game URLs did not restore their saved checkpoint without an
explicit `resume=1`. The follow-up restores exact matching playthroughs on refresh
for Street and Script, and gives deliberate replays their own saved-game identity.
The browser reproduced a reset from 4,057 points/round two to zero before the fix;
the PostgreSQL development app then recovered that same 4,057-point Pular reveal
from the ordinary URL without a resume flag. A real-hook component regression
tests refresh twice and then a deliberate fresh replay of the same seed.
Follow-up suite: **163 suites, 1,574 passed, 10 existing todos**, including
the 10 PostgreSQL checks. This does not establish real message delivery.

The owner rejected the language-identification prototype. It has been removed
from the client, API and tests, not promoted into the main game. Its code remains
in Git history. Old `experience=detective` preview links now open the original
pin-on-map game. Regional learning remains the core: read the sentence, place
a pin, reveal the language's usage polygons. The existing map stays mounted
between guesses and reveals. The reveal now includes an accessible region
selector that frames a specific region or all regions, with smaller secondary
language clues behind a disclosure. The score, round progress and next action
stay in the game screen; no language-choice question or optional map bonus.

The agreed ladder is Wood, Copper, Silver, Gold, Sapphire, Meteorite. Copper is
top 70%, Silver top 45%, Gold top 25%, Sapphire top 10%. These are cumulative
cutoffs in the full placed-player pool, rounded up to whole players. Five
placement matches are required. Meteorite overrides those bands for the top
five only when they have at least 20 rated matches and average at least 80% of
available round points. The 20-match/80% gate is an implementation default,
not a threshold explicitly selected by the owner. Thresholds are centralized
in `rating.js` for tuning. Ties use rating, games played, then stable profile ID;
they cannot produce a sixth Meteorite. Unknown historical accuracy never passes.
No 100-player minimum blocks the small launch.

Street and Script multiplayer now have independent rating rows. Script uses
the existing Glicko machinery and displays its post-match rating change, rather
than being silently unrated. Accuracy comes from authoritative scored guesses,
not duel health; missed revealed rounds score zero. Additive `scoredPoints` and
`scoredRounds` columns on GeoRating/GeoSeasonRating are required before deployment.
Rating claims, both player updates and result records commit together under a
database lock. A failure rolls back, and finished-room polling retries. The
profile, board, room badges and title eligibility share percentile rankings.

Automatic matchmaking prefers the closest rating within a 200-point window,
widening by 200 every ten seconds and allowing any gap after a minute. Both
players' windows must allow the match. Street/Script pools remain separate.
Room polling has a ten-second timeout and suppresses a late heartbeat that
predates a player action, protecting the result from being rolled back onscreen.

Verification for this working change: **162 suites, 1,572 passing tests, 10
pre-existing todos**, including all **10 real PostgreSQL release checks**.
Coverage includes a complete five-round Script match and its accuracy totals,
rating-write rollback and concurrent retry, the full-population/off-page rank,
exact percentile boundaries, ties, low/missing-accuracy Meteorite rejection,
skill-window widening, expired searches, old prototype links, region selection,
round progression, late-poll ordering and timeout recovery. Changed files lint
cleanly. Final built-browser checks and GitHub CI are recorded in the follow-up.

Browser checks already completed on the PostgreSQL development app: geographic
Armenian guess and polygon reveal, selecting Armenia to focus the outline, and
390x844 reveal/next-round interaction. These are local verification, not proof
of production configuration or real authentication delivery.

Production blocker rechecked through the Render monitoring workflow: Kevin's
authorized workspace still contains 21 services, none for americansalb/petrecovery
or Probably Earth. The actual service dashboard URL/workspace access is required
to diagnose missing sign-in email, apply the release schema, verify deployed
sessions and configure authorized Street imagery. Real email/SMS delivery and
the complete production desktop/mobile release sweep remain unverified. PR291
must stay draft and unmerged.

### Historical experiment: language-first prototype (rejected and removed)

Follow-up: the prototype commit `5677530` passed CI run 35316541076. A 320px
ten-round layout wraps its progress indicators without horizontal overflow.
Contrast checks found low-contrast small text on the clay button and cream card;
the follow-up darkens those colors and adds five checks requiring at least 4.5:1.

The actual guest-to-signup browser test found a false save-conflict warning in
the original tab: PostgreSQL JSONB reorders object keys, but duplicate checkpoint
acknowledgement compared JSON.stringify output. The server now compares values
structurally, preserving array order and rejecting genuinely different saves.
The reordered-key API regression failed with 409 before the fix, then passed;
a ninth real PostgreSQL check verifies the JSONB roundtrip itself. A fresh
synthetic signup kept the Armenian 4,000-point reveal in both original and
verification-return tabs without a conflict. The original tab then continued
to Russian and saved 8,000 points. Development links still do not prove delivery.
Follow-up full suite: **164 suites / 1,583 passed**, 10 existing todos. Final
follow-up build and CI must include the structural comparison fix.

The player's feedback that Script is boring is an open acceptance requirement,
not resolved by the previous visual polish. A language-first prototype is available
at `/geo/script/play?experience=detective&rounds=3&seed=detective-qa`.
It is deliberately not the default and does not change existing solo saves or
multiplayer rules. It asks for one of four server-selected language choices,
awards 4,000 points for identification, and offers an optional regional map bonus
worth up to 1,000. The reveal focuses on one marker actually present in the
sentence, with its explanation and the language's region. Old map-first rounds
remain available while the revised direction is evaluated. There is no new
Classic/Duel or gameplay-variant selector in the public menu.

Browser evidence on the local PostgreSQL-backed app: a Nepali answer scored
4,000 without a map pin; the saved reveal reopened in the 390x844 mobile tab;
choosing Papiamento for Galician revealed the mistake and the `traballo` clue;
Malayalam plus a deliberately distant keyboard-placed map pin scored 4,004.
The three-round result was 2/3 languages and 8,004 points. Replay reset to zero
with the same Nepali sentence and four choices. Desktop 1280x720 and mobile
screenshots of play/reveal/results were inspected. This proves the mechanics,
not that the new game is sufficiently fun or that multiplayer is redesigned.
The production build also completed a three-round, 30-second Alphabets game:
Telugu 4,000, unanswered Punjabi timeout 0, Tibetan 4,000, total 8,000. These
were browser interactions against the built app, not mocked API scoring.

New tests cover every pool's four unique deterministic choices, opaque answer
tokens, exact/incorrect/no answer scoring, map bonus, invalid/expired tokens,
API errors and no-store responses, keyboard focus boundaries, retries,
double-submit prevention and timer completion without duplicate results.
New endpoints have explicit middleware rate-limit buckets. Current local suite:
**163 suites / 1,576 passed**, plus 10 pre-existing todos, including the isolated
PostgreSQL concurrency checks. Changed production files lint cleanly. The
production build exits successfully; unrelated pet-site prerender fetches have
local sandbox network/database warnings and are not production verification.

The prior release-fix commit `7f540dd` passed CI run 35314600261. Nothing is merged.
Real email/SMS delivery, an authorized Street preview origin and production
deployment remain unverified; access to the actual hosting service is still
missing from the authorized Render workspace.

Profile follow-up: buy/equip controls now have item-specific accessible names and
44px minimum height; record headings explicitly refer to rated Street games.
The existing synthetic Persistent QA account bought Mint for 150 earned test
points (204 to 54), switched to Classic and back, then retained Mint and the
54-point balance after reload. This involved no real payment.

### Screen sweep and timed Script fixes

Commit `9cd8c02` passed every applicable CI job in run 35312790315. It is
still draft and unmerged. Local files matched that remote tree exactly, except
the generated Next development declaration. Its final production build passed.

That production build was exercised at desktop 1280x720 and mobile 390x844:
main menu and expanded region selection (Japan/Canada flags and matching links),
mobile multiplayer lobby/browser, account-name prefill and same-seat rejoin,
Script pool/round/timer settings, both ranking tabs and the rating explanation,
non-admin denial and invalid share-link recovery. Screenshots were inspected,
not just DOM responses. Remaining full-screen/device coverage is not complete.

A real three-round, 30-second Script game completed Korean/Greek/Urdu. A missing
Greek pin timed out to zero and advanced normally. The result initially showed
3,809 points, but the browser sweep exposed two defects: the same-URL replay
link did not restart; and the last timer could restart after the summary and
append a duplicate Urdu score. The fixes give replay a fresh playthrough key
without changing the seed/rules, clear the previous round on advance, and prevent
timers/submission for already-scored or finished rounds. Existing overlong private
checkpoints are bounded to the configured round count. A full component test
plays all three rounds, waits 31 seconds at the summary with exactly three score
requests, then replays the same seed from round one. The browser restored the
earlier checkpoint to its correct three-round total and replayed the same Korean,
Greek and Urdu sentences to 4,437 points. That result remained unchanged beyond
the 30-second timer duration instead of returning to a duplicate final reveal.

The game footer's `/privacy` link actually redirected to the live pet site,
whose older policy did not contain the new account/queue details. The new
`/geo/privacy` page stays on the game host and covers existing game data handling,
cookies, provider usage, saves, queue/retention and the account-settings path.
Coverage checks now require the standalone page too. The leaderboard names its
Street multiplayer ladder explicitly and distinguishes appearing after three
games from settling placement after five.

Queue credential-envelope recovery now derives the same account-backed seat
token instead of rotating it and invalidating a room tab. A regression test
recovers an unreadable envelope, rejoins and confirms the original seat works.

Follow-up local suite: **160 suites / 1,559 tests passed**, 10 existing todos;
changed production files lint without warnings. The follow-up production build
passed. GitHub CI and production-build browser checks remain required for this
batch; production deployment/message delivery remain separate external gates.

### Latest multiplayer and account-boundary checks

Commit `92e3b8b` passed all applicable CI jobs (run 35310477620), including
production build, security scan and the seven PostgreSQL release checks. Draft
PR291 remains unmerged and is **not launch-approved**.

The desktop and mobile browser accounts automatically matched into 3KDS69 and
completed all five rounds. During round four the mobile player moved from the
development server on 3032 to the independently production-built server on 3033,
with separate origin storage but the same account cookie/database. Rejoin
recovered the same player and health; that round timed out while switching, and
round five accepted a new real guess. Both final screens agreed: Room Return QA
5,686 HP / +87 points, Persistent QA 4,907 HP / +33 points. The next-opponent link
retained Script on the production build. This is not live-site/device testing.

New account-boundary tests reproduced retained room tokens accepting actions
after logout (200 rather than 401) and from a different account (200 rather than
403). The follow-up binds profile-backed seats to a live account on reads and
actions; invalid ownership yields a spectator view and rejects writes. Legacy
pre-account seats still require a live account and their original bearer token.
The three regression tests pass, as do the existing room route tests.

Room polling now reports connection loss without discarding the match screen.
An actual local server shutdown displayed the reconnect banner while preserving
final scores; restarting it cleared the banner and retained the same seat and
results. Two hook tests also cover failed heartbeat and offline/online events.
Fresh-browser rejoin now loads the account name; signup continues a pending join,
and a rematch URL cannot rename the account. Three component tests cover these.
Browser signup additionally reproduced two tabs rotating each other's room
credential. Profile-backed seats now use a stable, secret-derived per-seat
credential, and join runs atomically under the existing database lock. Eight
concurrent joins through two PostgreSQL pools return one player and token;
recovering room creation keeps the host's existing credential too. API account
ownership checks still apply, including after logout or an account switch.

The clean browser rerun signed up Atomic Join QA through a local development
link. Both the original tab and verification-return tab automatically reached
the lobby of 2K6N92 with the same one seat. A previous account's locally stored
token no longer blocks autojoin: server-confirmed membership is authoritative.
This does not prove email delivery. Read-only auth status no longer emits a
cookie deletion, so a delayed guest check cannot erase a newer sign-in cookie.

The first combined run passed 158 suites / 1,552 tests, with 10 existing todos.
After the stale-token follow-up, a concurrent build/test run hit a 15-second
timeout in the unrelated pet-report account-binding test; the test is unchanged
and the complete suite rerun passed: 158 suites / 1,553 tests, 10 existing todos.
The production build passed. Its browser check caught the join input retaining
the previous browser name after the verified account name loaded. The input now
accepts a late default only until the player edits it; two component regressions
cover both cases. The final suite passes **159 suites / 1,555 tests**, including
eight real PostgreSQL checks, with 10 existing todos. The final rebuild and
follow-up CI must include this last input fix.

### Room continuation and two-browser verification

Follow-up full suite: **155 suites / 1,543 tests passed**, with 10 existing todos.
Seven real PostgreSQL release checks now include eight concurrent room-create
retries through two connection pools: one room, one host seat and one stable
token. The retry key is account-scoped; another account gets a different room.
This adds nullable unique `GeoRoom.creationKey`; deploy must apply it additively.
The isolated QA database received only ADD COLUMN / CREATE UNIQUE INDEX, without
accepting data loss. Local production build passed; final small keyboard-state
follow-up is being rebuilt and browser-tested.

Browser signup test used a development log link (not delivered email). The
guest chose Script, three rounds and a private room before signup. Both the
original sheet and the first verification-return tab automatically reached the
same room TRTNCX, with one host and the original rules. A completed-intent receipt
also avoids recreating rooms when the return tab arrives late. Room query params
now use the Next 15 awaited API so a Script link actually preselects Script.

Two real browser clients, on separate localhost/127.0.0.1 origins and accounts,
completed all three rounds of that manual Duel. Measured viewports: desktop
1280x720 and mobile content 382x844 (390px viewport including scrollbar). Both
submitted real guesses; a host reload recovered its locked guess and same seat.
The final screens agreed: Persistent QA 5,947 HP and +84 cosmetic points; Room
Return QA 4,770 HP and +32 points. Rematch VDTQY8 retained rules and both players
rejoined; leaving returned both to multiplayer. This is browser coverage, not
physical-device or production-deployment coverage.

Commit `2ae7753` is pushed and unmerged. Its CI exposed a pre-existing random
test fixture: the candidate-list test occasionally drew the intentional 1-in-200
NASA photo round. The follow-up fixes the test to a deterministic Earth seed;
it does not remove the surprise game mode or disable the assertion. Final CI
must pass before treating the follow-up as release-verified.

**Not launch-approved. PR291 stays draft and unmerged.** Commit `c205840`
passed every applicable GitHub CI job (run 35308189125), including the stricter
production dependency audit, real PostgreSQL checks and production build.
Main-only E2E was skipped; green CI is not a substitute for the journeys below.

Follow-up changes have passed 154 suites / 1,538 tests, with 10 existing todos,
including six real-PostgreSQL release tests. Full lint passes its existing
warning ceiling; changed UI files pass without warnings. Follow-up CI and a
fresh production build still remain required before release.

- Account settings now show an honest loading/error/retry state, rather than
  briefly showing signup to a logged-in player. Account buttons are at least
  44px high. Regression tests cover delayed login checks and retry after failure.
- Profile/shop tabs have keyboard arrows, Home/End, roving focus and associated
  panels. Browser left-arrow changed Shop to Record and moved focus correctly.
- Keyboard map controls support pan, zoom and placing a centre pin without
  accidentally submitting it. Global game shortcuts leave controls, links and
  account dialogs alone. A real browser at mobile width restored the saved game,
  advanced to Uzbek, placed a pin with keyboard controls and submitted with Enter
  on the Guess button: 262 points, 5,471 total. The target and instructions were
  visually inspected. Apple's adapter has unit coverage only; its tiles remain
  origin-blocked locally, so this is not real Apple-map verification.
- Signup concurrency test reproduced seven failures out of eight simultaneous
  first sign-ins for one email. Email token consumption, account creation and
  profile binding now run together under a database transaction/advisory lock.
  Phone profile binding uses the same lock, after provider verification. Across
  two actual PostgreSQL pools, all eight sign-ins now recover one account and
  one profile. Two different accounts cannot claim one guest profile. Injected
  database failure rolls back the account and token burn; retry succeeds once.
  These tests send no messages and do not prove real email/SMS delivery.
- The mobile Next round button stays visible while a long explanation scrolls;
  rechecked in the Next 15 development preview. Exact final production-build
  browser verification remains outstanding.

Unblocked work still includes manual room signup continuation, the remaining
screen/error/accessibility sweep, and final desktop/mobile multiplayer checks.
External gates remain: access to the actual Probably Earth production service
(none of the 21 services in the authorized Render workspace matches it), real
mail delivery/recovery, authorized phone-provider setup, and a working Apple
imagery token for the verification deployment. Do not merge around these gates.

## Current launch gate (2026-09-17)

### Latest verification and security follow-up

Still **not launch-approved**; no merge is authorized before every release gate
passes. Commit `622792b` passed all applicable CI jobs, but its old package-name
security allowlist hid newly published advisories. Green CI on that commit is
therefore not evidence of security readiness.

The follow-up upgrades Next.js to 15.5.24, Nodemailer to 10.0.10 and PostCSS to
8.5.28. The unused Prisma Auth.js adapter is removed. Explicit overrides select
patched Auth.js core 0.41.3, qs 6.16.0 and fflate 0.7.5; NextAuth 4 uses core only
for adapter types, not runtime authentication. Nodemailer/PostCSS overrides
prevent older transitive copies. React remains on its supported 18.x peer line.
Production dependency audit of the isolated install: **zero known advisories**.
The full audit still reports development-only Capacitor CLI/node-tar advisories;
native-app packaging is not security-verified by this web release check.
There are no longer blanket package exceptions. The audit gate fails on every
high/critical production advisory, malformed report or failed registry check,
and the build now depends on that gate. Regression tests cover those failures.

Compatibility verification in an isolated copy: production build passed,
151 suites / 1,528 tests passed including real PostgreSQL (10 existing todos),
and lint passed its existing ceiling. Cleanup timers no longer hold test workers
open; that full run exited normally without forceExit or the teardown warning.
Actual Nodemailer MIME composition passed without sending any email. These are
local checks, not proof of production email delivery or OAuth provider setup.
Final rerun/CI and browser verification of follow-up map changes remain required.

Persistent PostgreSQL browser checks: signup return restored the Hebrew clue and
4,234 points, then retained both the login and result after restarting the entire
web server. An automatically matched Script Duel kept its locked guess across
reload, recovered round/health state after another server restart, and reached
final standings with the API-driven peer. This was one real browser player and
one API peer, not two physical devices. The database integration test additionally
completed all five concurrent-guess rounds through separate connection pools.

Public menu metadata and the game manifest no longer inherit pet-site noindex
or app branding. Pet push-worker registration is skipped on game routes. Privacy
is linked in the footer. Production-build browser checks found a restored Script
answer-map framing issue; the reveal now has its own space instead of covering
the map, and initial framing no longer depends on an interruptible fly animation.
Desktop development preview shows the complete answer and guess. The rebuilt
production version also restored 4,234 points at a measured 390x844 viewport,
showed the full Hebrew answer region, advanced to Telugu and scored another
975 points (5,209 total). The final follow-up keeps Next round outside the
scrolling explanation; that small layout change still needs final CI/browser
recheck. Apple imagery remains origin-blocked locally.

### Ongoing-goal acceptance ledger

Owner requested an ongoing launch-readiness goal. The PR remains draft and
must not merge until the release is verified. Code, local verification and
production verification are distinct; the historical section is not proof.

| Required journey | Current evidence | Remaining launch gate |
| --- | --- | --- |
| Free guest solo, Street and Script | Script full solo game and replay tested; production Street pin scored | Repeat every mode on final branch, desktop and mobile |
| Fast signup with username and email OR phone | Inline email return and guest-profile binding tested locally; phone provider/unit code exists | Real email and SMS delivery, recovery, failure states, provider setup |
| Stay signed in for at least a week | 90-day cookie, signed-session expiry tests | Persistent production database and restart verification |
| Seamless save/resume, including another device | Account checkpoint and guest local save; new revision conflict guard and account isolation | Final browser save QA plus persistent database, second-device and restart tests |
| Automatic matchmaking | PostgreSQL: duplicate concurrent joins across two pools yield five distinct two-player matches; rollback, recovery and save CAS passed | Final desktop/mobile match and reconnect verification on deployed build |
| Complete Duel multiplayer, Street/Script only | Script three-round match/rematch previously tested; new queue auto-start reached a mobile Script match | Final full match, intentional disconnect/rejoin, Street imagery and rematch QA |
| Intuitive, polished UI | Plain copy, real country flags, clay/ocean/green palette; queue mobile layout inspected | Full-screen visual/accessibility sweep including errors and empty states |
| Security and privacy | Account gates, sealed tokens, rate limits, safe redirect origins, no account mixing | Review final changed endpoints and privacy/schema changes |
| Safe release | Pushed commit 4926a2b passed CI run 35303951731; PR remains draft, unmerged | Push follow-up QA fixes; green build/lint/tests/Postgres checks; verify deployment before readiness claim |

New work in progress: automatic matchmaking with transactional PostgreSQL
advisory locking, private two-player rosters, server-controlled round advancement,
cancel/expiry/retry behavior, and refreshed account identity. Eleven queue/service
route tests pass. Mobile browser reached an automatically started Script Duel
after contextual signup, and cancel/retry worked. Its timeout flow exposed a
Leaflet NaN animation error caused by padding larger than the small reveal map;
responsive padding is fixed and needs browser re-verification.
The fix was subsequently rechecked in a second mobile matched game: a real
host pin and API-driven peer guess scored, health changed, the reveal map fit
the small viewport, and no Leaflet NaN errors appeared. The chosen signup name
also persisted into the match. The local MapKit origin rejection remains an
expected environment limitation, not a verified Street experience.

Saves now require the account identity and an expected revision. Concurrent
stale writes return a conflict rather than overwriting newer progress. Local
checkpoints have an owner; signed-out visitors and other accounts cannot resume
them. `GeoAccount.savedGameRevision` and `GeoMatchmakingTicket` are additional
additive schema requirements. New changes require final full-suite verification.
Latest full run: 143 suites, 1,510 tests passed, 10 existing todos; the known
worker teardown warning remains. One earlier run hit a SIGSEGV in the unrelated
analyze-pet worker; the subsequent complete run passed including that suite.
Prisma validation passed, and changed-file lint has no warnings or errors.
Browser save QA scored a Script guess at 5,000 points, opened signup without
leaving the result, synced the account checkpoint, and restored the same result
after reload. A signup-return read/write race found during that test now has a
retry and regression test; repeat the complete first-return flow in final QA.

Follow-up verification: a fresh mobile guest scored 4,424 on Portuguese and
signed up in-place using a development log link. Both the original tab and the
first verification-return tab retained the exact clue, result and score, with
no reload required. This verifies continuation, not real message delivery.
The finished automatic-match screen now leads to Find another opponent, retaining
Street/Script selection. Mobile queue cancellation restores room controls;
while searching, conflicting room creation/join controls are disabled. Four
component tests cover signup continuation, cancellation recovery and pairing races.
Profile loading now uses the account's authoritative name and clears old shop
balances on session changes; two rendered-component regression tests pass.

An isolated local PostgreSQL 18 database passed real transactional queue tests:
20 duplicate joins from 10 accounts through two independent pools produce five
rooms, exactly two distinct players and one started round each. A new database
client recovers the same private seat. Failed transactions roll back and release
locks; concurrent cloud saves admit only one revision winner. The guarded test
accepts only localhost/probablyearth_launch_qa and is added as a blocking CI job.
The full suite including Postgres passed 145 suites / 1,517 tests before the two
profile UI tests were added; those additional two pass separately. Final combined
rerun and CI remain required after follow-up edits. The known teardown warning
is still present. The subsequent combined run passed all 146 suites / 1,519
tests (10 existing todos), including the real PostgreSQL and profile UI checks.

Current external blockers: the authorized Render workspace has 21 services,
none connected to americansalb/petrecovery (rechecked during this goal). The
production service/dashboard link or correct hosting account remains required
for mail diagnosis and deployment. Real SMS provider setup/billing has not been
authorized or activated. These blockers do not stop local implementation/QA.

**Not approved for launch.** The historical assessment below is not a
current end-to-end verification. In particular, a successful email API
response did not produce an email in the owner's inbox.

Work in PR #291 includes contextual email and phone-code signup, 90-day sessions,
guest-profile binding, internal return links, Duel-only setup with Street
and Script choices, Script multiplayer scoring, and account-backed game
checkpoints. These changes are not live until the PR is merged and the
deployment succeeds. The checkpoint adds the nullable `GeoAccount.savedGame`
JSON column; deployment must apply that additive schema change. Phone accounts
also add nullable unique `GeoAccount.phone` and make `GeoAccount.email` nullable.

Evidence from the current local working tree:

- Full-suite baseline after phone signup: 138 Jest suites passed, 1,476 tests
  passed, 10 existing todos. Jest reported an open-handle teardown warning;
  the CI-style two-worker run exited successfully. Later reconnect changes
  have additional targeted tests and require a final full run.
- Full lint passed the repository's 360-warning ceiling.
- Script solo: placed guesses, received scores, returned home, reopened
  the same saved result, continued, finished all five rounds, and reloaded
  the final score unchanged. Mobile replay testing found and fixed stale
  game state when the query string changed.
- Script Duel: server tests cover shared clues, hidden answers, scoring,
  finishing, and rematching. Local browser testing found and fixed blank
  maps after resizing and crashes when timeout guesses have no coordinates.
  A three-round browser match then completed with real host/peer guesses,
  damage, a mobile map drawer, timeout handling, and final standings.
- Production Street: Apple imagery rendered, a pin submitted, the correct
  location was revealed, and score/points were returned.
- A private temporary test inbox also received no sign-in email after
  production reported success. Delivery remains a launch blocker.
- Local existing-account magic-link verification returned to Script room
  setup, retained the player name and rules, and automatically closed the
  signup gate in the original tab. A callback-identity polling race found
  during this test is fixed. Sign-out now refreshes profile labels too.
- Classic is removed from the active rankings and profile choices without
  deleting historical ratings.
- Authentication origins are now allowlisted, so forged forwarded-host
  headers cannot place sign-in tokens in links to an attacker's domain.
  Additional deployments can set `GEO_AUTH_ORIGIN` explicitly.

Do not merge until the entire launch checklist is complete (owner instruction).
In particular, the multiplayer account gate would block new players while
production mail is broken. The owner confirmed Kevin's Render workspace;
its service listing contains neither Probably Earth nor PetRecovery. Access
to the actual production service is still needed. The private test inbox
remained empty on a later check; no additional email was sent to the owner.
- Mail provider error responses are now failures, rather than false success.
- Phone signup uses Twilio Verify, stays in the current game, binds the guest
  profile, and issues the same 90-day session. Eighteen unit/route tests cover
  verification, wrong/expired/reused codes, account isolation, rate limits,
  cookie issuance and provider failure. No real SMS has been sent or billing
  enabled. Phone-only accounts are supported in admin and privacy copy.
- Browser refresh during a Script duel retained the player, clue, health and
  round. A subsequent real guess was scored. Account-based seat recovery also
  preserves health/guesses instead of refusing returning players mid-duel.
- Browser QA found and fixed overlapping Script reaction buttons and a generic
  cup imagery timeout covering the actual MapKit authorization error. The
  single correct authorization error was rechecked in the browser.

Still required before calling the game launch-ready:

- Inspect production mail configuration and provider delivery evidence;
  receive a real sign-in email and complete recovery/return-to-game.
- Confirm the production schema and deploy the changes; test persistent
  saves from a second session/device and session survival across restart.
- Finish desktop/mobile real-browser coverage of Street imagery, Script
  duels, disconnect/rejoin, errors, all challenge/result/profile screens.
- Configure and verify phone signup with a real code. Required variables:
  `GEO_PHONE_SIGNIN_ENABLED=true`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `GEO_TWILIO_VERIFY_SERVICE_SID`, `GEO_TOKEN_SECRET` and production `REDIS_URL`.
  Use a dedicated Verify service with fraud protection. Production sends fail
  closed without the shared limiter (3 per number and 30 site-wide per ten
  minutes). Do not enable billable SMS without confirming the provider setup.
- Automatic matchmaking is now implemented on the working branch. Finish
  its browser, persistent-database and deployment verification before launch.
- CI and production checks for the final commit must pass.

## Historical assessment (superseded)

Written 2026-09-11 against `pet_main`. `docs/GEO.md` is what the game
does, `docs/PROBABLY_EARTH_SPLIT.md` is how it becomes its own product.
This is only the question "can it go live", answered honestly.

## Try it first, decide later

```
cd frontend && npm run geo:demo
```

Nothing configured: no Google project, no database, no mail account, no
domain. **Script mode is fully playable**: the MapKit token does not
authorize here, so the round falls back to a map drawn from the country
polygons in the game's own bundle. Rooms, ratings, points, the shop and
sign-in all work on an in-memory store; sign-in links are printed to the
log. Street View needs a browser key no mock can replace, because
Google's own SDK draws the panorama. Details in `docs/GEO.md`, "Playing
it with nothing configured".

## The short answer

The original assessment attributed the launch blocker to database schema
drift. Production profile creation subsequently succeeded, so that claim
is not a current diagnosis. Use the current launch gate above.

## What is actually finished

| | State |
|---|---|
| The game itself: seven modes, rooms, ratings, seasons, the weekly cup, points, cosmetics, the daily challenge, ranked solo | code, live on `pet_main` |
| Not Earth: one casual round in two hundred is a NASA panorama from Mars or the Moon, with a button to call it | code |
| Script mode: 159 languages, 34 writing systems, region scoring | code, live on `pet_main` |
| Its own accounts, its own session, its own mailer | code, live on `pet_main` |
| No import in either direction between the game and the pet site | code, enforced by `__tests__/geo/isolation.test.js` |
| Abuse control: the play meter's per-day and per-address ceilings, a speed limit, and a site budget under Apple's account quota | code |
| 1,341 tests, a sixteen-scenario browser harness driven against a real browser and a real database | code |

Driven on a production build, desktop and phone, every route: no page
errors, no horizontal overflow, chrome present, no missing link
previews.

## How it is actually run in production

Two things the audit found by running it rather than reading it, both of
which would have cost an afternoon on deployment day:

- **`npm start` works, and prints a warning saying it does not.**
  `next.config.js` sets `output: 'standalone'`, so `next start` warns
  that it "does not work" with that setting. Checked 2026-09-12 on a
  production build: the lobby, `/api/health`, `/api/geo/config` and a
  `POST /api/geo/round` all answer 200 under `next start`, so Render's
  native start (`npm start`, which is `scripts/boot.js`) is fine as it
  is. The standalone server, `node .next/standalone/server.js` with
  `.next/static` and `public` copied in beside it, is the alternative
  the warning points at, not a requirement. An earlier note here said
  the API routes 404 under `next start`; that did not reproduce.
- **The standalone server does not read `.env` files.** Everything has
  to be in the process environment. A deployment that puts secrets in a
  `.env` and starts the standalone server gets a game that renders and
  then answers 503 to every round. Render's environment variables are
  process environment, so this only bites a hand-rolled deployment.

The whole browser harness passes against the standalone server, and the
route check above was run against `next start`.

## What launch needs from you

### 1. An Apple MapKit token per host. Was blocking. Closed.

Look Around is the imagery (docs/GEO.md, "Apple only"), and Apple
matches a token's origin exactly, so every host that serves a page needs
its own token. A refused token does not throw: MapKit loads, the pane is
built, and nothing is ever drawn in it, which is why this was invisible
until somebody checked.

It was genuinely broken on 2026-09-14: the shipped token was minted for
the apex, the apex 301s to `www` at Cloudflare, and Apple answered `401`
to `www`, so every Apple surface on the live site was blank.

The server now mints a token per host at request time
(`/api/geo/mapkit-token`). Asked of Apple directly on 2026-09-16, with
the token each host actually serves:

```
www.reunitepets.org       200 authorized
probablyearth.com         200 authorized
reunitepets.org           301 to www, serves no page
www.probablyearth.com     301 to the apex, serves no page
```

Both hosts that serve the game are authorized, and the two that are pure
redirects never need a token. Nothing to do here.

Re-run `npm run geo:check-mapkit` after any change to a domain, a
redirect or the token. It is the only check that can answer this
question, because the failure is silent.

### 1b. Google keys. No longer needed.

Founder direction, 2026-09-16: the game is **Apple only**. Google Street
View is gone, and with it the play meter's allowance, the bought rounds,
the site's Google budget and the three modes only its imagery could do
(City streets, Everywhere, Kidnapped).

The reason is cost, and it is not close. Apple Look Around is not billed
per view: it runs under Apple's daily account quota, so a round costs
nothing to serve. Google's Dynamic Street View is 5,000 free panorama
loads a month and then $14.00 per thousand, which at three hundred daily
players is about $560 a month, forever, growing with success. Apple at
the same size is $0.

What Apple's cars never reached is covered by Script mode, which needs no
imagery, no key and no quota at all.


### 2. Where it lives. Answered.

**probablyearth.com** (founder, 2026-09-16: "this is not a nonprofit, I
already transferred it to probablyearth.com"). Checked live on the same
day: `probablyearth.com/` redirects to `/geo`, the short paths redirect
into the game, and the host has a MapKit token Apple authorizes.

`/geo` still works on `www.reunitepets.org` and serves the same game off
the same rows, which is the only part of D3 that was ever a real choice.
Nobody has said whether that should eventually redirect to the game's own
domain; nothing depends on the answer, and it is one line whenever it is
wanted.

### 3. A mail sender. Blocking for accounts, not for play.

`RESEND_API_KEY` and `GEO_MAIL_FROM`. Without them sign-in links are
written to the server log instead of sent, which is right for
development and wrong for a launch: nobody can sign in. Anonymous play
is unaffected.

The sender address needs a domain you control and its DNS records, or
the mail lands in spam.

### 4. Two decisions that cost nothing to make and block work later

- **D2, do existing players carry over.** There are rows in the pet
  database now. Clean start or copy? Copying is a day's work and has to
  happen before the game's database is split, not after.
- **Whether ranked integrity is wanted at all.** Bet 1 in the strategy
  document. If yes, the cheap reversible step is recording behavioural
  signals on rounds now, changing nothing, so there is data to design
  against later. If no, say so and I will stop proposing it.

## What I would do before launch, given the keys

In order, and each is useful even if the next never happens.

1. **Measure photo-sphere density with a live key.** Half an hour. It
   decides whether Everywhere is a mode or a footnote, and I have never
   been able to run it: this environment has no key and the proxy blocks
   the endpoint.
2. **A phone pass on the play screen.** The audit above says the lobby
   and the other pages are clean at 390px. The round itself is the one
   screen I would want a real device on, because a map and a panorama
   fighting for a small viewport is where this genre's competitors are
   worst and where the largest audience is.
3. **Watch the meter for a week** with real traffic before widening any
   limit.

## What is deliberately not done

- **Phases 3 to 6 of the split**: separate database, separate
  repository, cutover, decommission. None of it blocks a launch at
  `/geo` or on a domain pointed at this deployment. All of it blocks
  calling the game a separate product.
- **Ranked script rounds.** Unranked while the corpus is a starting pool
  rather than a curated one; rating people on content still being
  written puts noise in the ladder.
- **The audio language game.** Needs recordings, which needs AALB
  capacity nobody has confirmed.
- **The strategy bets**: verified ladder, satellite mode, the India
  pack. All are after a launch, not before one.

## The honest summary

The domain is bought and live, the MapKit tokens are authorized on every
host that serves a page, and Google is gone along with the project, the
caps and the bill. What is left is a mail sender, without which nobody
can sign in, and two decisions that block later work rather than launch.

One thing in the code's way, and it is not the code: **the production
database is behind this schema**, so creating a play profile 500s for
every visitor. Reads work, which is why it looks like one broken
feature. The deploy that carries this branch will name the column in the
error and print the missing SQL in the `[db-sync]` banner; until then
ranked, the daily and the cup cannot be played live, because all three
are scored as somebody.
