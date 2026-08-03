# MVP Launch Plan

**Written:** 2026-08-03 (revised same day after a second, deeper pass)
**Method:** every claim was verified against the code on `claude/mvp-launch-plan-qfj453`
(tip of `pet_main` at `6d00056`) with a production build booted against a real
seeded Postgres and the APIs driven by hand. Nothing is inherited from an older
doc without re-checking it. Where the first pass got something wrong, the
correction is called out rather than quietly edited.

---

## 1. The headline

The app is not under-built. It is over-built around a core loop that does not
close, on top of a schema the code has drifted away from in at least a dozen
places that no test can see.

Verified green:

| Check | Result |
|---|---|
| `npm ci` + `prisma generate` | clean |
| `npx jest --ci` | 51 suites, 591 tests, all pass |
| `npm run build` | exit 0, 231 static pages |
| Every static page, as admin | 200 (only intentional legacy redirects differ) |
| Dynamic routes with real IDs (`/cases/…`, `/pets/…`, `/hub/thread/…`, `/rescue-forces/…`, `/shelters/…`) | 200 |
| Credentials login → session with role | works |
| Report a lost pet | works: case created, force assigned, patrol alerted, 11 of 12 cascade steps SUCCESS |
| Report a found pet | works: case created, matches scored, owner notified |
| Authorization (pet IDOR, notification IDOR, conversation IDOR, admin gates) | **solid** — 404 for strangers, 403 on writes, 401/307 anon, 403 for non-admin |
| Rate limiting | **works** — 75-request burst: 60 served, 15 × 429 |

Scale of the surface: **117 pages, 304 API routes, 158 Prisma models.**

So the MVP question is not "what else do we build." It is "what is quietly
broken, and what do we hide until it works."

---

## 2. Correction to the first pass

The first version of this document claimed lost reports are never matched
against found reports. **That was wrong.** Reverse matching exists as a tier-0
cascade action (`app/lib/cascade/actions/reverseMatch.js`, `enabled: true` in
`registry.js`), it runs fire-and-forget after the report is created, and it
works. Verified: posting a lost golden retriever near a seeded found golden
retriever produced a `reverse_match` step with status SUCCESS, a stored match at
`pTrueMatch: 0.95`, and two `MATCH_ALERT` notifications delivered to the finders.

The first pass missed it because the match happens asynchronously and does not
appear in the POST response. The real defect in that area is narrower and
sharper — see P0-3 below.

---

## 3. The core loop: what actually happens

Both directions of matching run. Both parties get notified. Then it stops.

### P0-1. All three matchers ignore cases that are not exactly `ACTIVE`

`CaseStatus` has five values; three mean "still open":

```
ACTIVE             // just reported
IN_PROGRESS        // a rescue force is actively searching   <-- excluded
SIGHTING_REPORTED  // the pet has been sighted                <-- excluded
REUNITED
CLOSED_OTHER
```

Three separate matchers filter on `status: 'ACTIVE'` alone:

- `app/api/reports/found-pet/route.js:191` (LOST candidates)
- `app/api/reports/[id]/route.js:92` (LOST candidates)
- `app/lib/cascade/reverseMatch.js:22` (FOUND candidates)

The two excluded statuses are the most engaged cases in the system.

**Proof.** Identical found-pet report, submitted twice, changing only the seeded
lost case's status:

| Max's status | Result |
|---|---|
| `IN_PROGRESS` | `matchesNotified: 0`, `potentialMatches: []` |
| `ACTIVE` | `pTrueMatch: 0.95`, `band: "actionable"`, owner notified |

A 0.95 match on a dog found 100 metres from where it was lost is dropped the
moment a rescue force starts searching. `app/api/dashboard/route.js:26,279`
already uses the right idiom (`status: { notIn: ['REUNITED', 'CLOSED_OTHER'] }`).

**Fix:** three lines.

### P0-2. The notification lands on the one surface that hides the match

Matches *are* rendered in two places:

- the finder's success screen (`app/components/report/SuccessScreen.js:110`)
- the owner's recovery kit (`app/components/report/recoveryKit/RecoveryKit.js:385`)

Both notifications (`FOUND_MATCH` to the owner, `MATCH_ALERT` to the finder)
deep-link to `/cases/[caseNumber]`. That page renders the recovery kit in
`mode="share"` (`CasePageClient.js:347`), and the match block is gated on
`!shareMode` — share mode is documented as "a pure asset toolkit" (QR, flyers,
social). So the match is deliberately suppressed on exactly the page the
notification points at.

**Verified:** `/api/cases/CASE-2026-616645/recovery-kit` returns the match with
`band: "actionable"`, `pTrueMatch: 0.95`, `canConnect: true`. The rendered page
at `/cases/CASE-2026-616645` contains zero occurrences of "possible match".

The owner's only view of their matches is the one-time success screen shown
immediately after reporting. Come back tomorrow and it is gone.

### P0-3. Connect is refused by the frontend

The API says go. The UI says no.

- `/recovery-kit` returns `canConnect: true` for actionable matches.
- Both render sites hardcode `connectAvailable={false}`
  (`SuccessScreen.js:122`, `recoveryKit/RecoveryKit.js:395`).
- `createMatchConnection()` (`app/lib/relay.js:69`) has **zero callers**.
- `/api/relay/[token]` and `/api/relay/[token]/messages` read and update
  `MatchConnection` rows that nothing can create.

`__tests__/api/finder-funnel.contract.test.js` says so in its own header ("The
routes under test DO NOT EXIST YET") and is still entirely `test.todo`.

Both parties can see the match. Neither can act on it. **This is the launch
blocker.**

---

## 4. The matcher is dramatically over-confident

The scoring model sums *positive* evidence and never subtracts for
*contradictory* evidence. A mismatched attribute scores zero — the same as a
missing one. Species (25) + location (25) gives a floor of **50** to any
same-species animal at the same spot, and the push threshold is **79**.

Measured against `PUSH_FLOOR = 0.70`:

| Scenario | score | p | band |
|---|---|---|---|
| Identical, same block | 100 | 0.950 | actionable |
| Two different black labs, 1 mi apart | 98 | 0.930 | **actionable** |
| Two different black labs, 5 mi apart | 92 | 0.870 | **actionable** |
| Same spot, same breed, **colors opposite** (black vs white) | 85 | 0.785 | **actionable** |
| Same spot, same colour, **breeds opposite** (chihuahua vs great dane) | 80 | 0.720 | **actionable** |
| Lost 90 days ago (beyond the 60-day window) | 85 | 0.785 | **actionable** |
| **Found before it was lost** (physically impossible) | 85 | 0.785 | **actionable** |
| Cross-species (cat vs dog) | 0 | 0.000 | suppress ✅ |

And a data-quality inversion, where **worse data produces more confidence**:

| Scenario | score | p | band |
|---|---|---|---|
| Precise coords, 200 miles apart (Austin → Dallas) | 75 | 0.660 | feed ✅ |
| Same two pets, coords stripped, both just "TX" | 85 | 0.785 | **actionable** |

Losing the coordinates upgrades a 200-mile-apart pair from held-back to
auto-push, because "same state" is worth 10 points and Texas is 800 miles wide.

Separately, `scoreToProbability()` returns `1.0` unconditionally for
`matchSource: 'microchip'`, bypassing even the species gate: a cat scored
against a dog on the microchip path returns `p = 1.000, actionable`.

The code is honest about the cause. `scoreToProbability()` is labelled
`⚠️ PROVISIONAL`, and its own comment warns the curve must be fitted on data
spanning the 0.40–0.70 decision band "or the curve is miscalibrated exactly
where the floor lives." It was never fitted.

This matters because CORR-3 — the cruelty gate — exists specifically to avoid
giving a distraught owner false hope. The gate is built correctly and its
threshold is set so loosely that it fires on nearly everything. Fixing P0-1
through P0-3 without fixing this ships a product whose headline feature is
confidently wrong.

**Minimum fix before launch:** penalise contradiction instead of ignoring it
(a strong colour or breed mismatch should subtract, not score zero), add hard
gates for impossible cases (found-before-lost, beyond the day window), drop the
"same state" fallback to near zero, and require attribute matches to clear the
floor on their own evidence. Then re-fit the anchors against real labelled
pairs.

---

## 5. Schema drift: a dozen live 500s that CI cannot see

**34 of 51 test files mock Prisma. No test touches a database.** Mocked Prisma
accepts any argument shape, so a call that violates the schema looks identical to
a correct one.

Sweeping every static GET endpoint as an admin found **13 endpoints returning
500**, every one of them schema drift:

```
/api/sightings (POST)          Sighting.create passes missionId; model requires caseId
/api/patrol/join (POST)        prisma.lostReport — model does not exist
/api/admin/analytics           Case.groupBy on lastSeenState — field does not exist
/api/admin/analytics/export    same
/api/admin/divisions/requests  Division.activeMissions — field does not exist
/api/follow                    CaseFollow.missionId — field does not exist
/api/hub/categories            ForumThread.isDeleted — field does not exist
/api/hub/mod                   forumProfile invalid invocation
/api/activity/feed             caseParticipant invalid invocation
/api/mapping/track             prisma.gpsBreadcrumb — model does not exist
/api/volunteers/schedule       prisma.shiftSignup — model does not exist
/api/volunteer/impact          volunteerShift invalid invocation
/api/integrations              integration invalid invocation
/api/communities               community invalid invocation
/api/emergency/evacuation      petEvacuation invalid invocation
/api/rescue-forces/[id]/broadcast (POST)   prisma.squadMembership — model does not exist
```

A static check of every `prisma.<model>` reference against `schema.prisma` finds
**four models that do not exist, referenced across twelve files**:
`squadMembership` (8 files), `lostReport` (2), `gpsBreadcrumb` (1),
`shiftSignup` (1).

Two of these are user-facing features that are simply dead:

**Sightings are 100% broken.** `app/api/sightings/route.js:76` passes
`missionId` to `prisma.sighting.create()`, but the `Sighting` model requires
`caseId`. Every submission 500s. The UI does use this endpoint
(`app/sightings/report/page.js:49`). This is the same `missionId`→`caseId` drift
that CRIT-B already fixed once in the found-pet route.

And the test suite **asserts the broken shape**. From
`__tests__/api/sightings.test.js:197`:

```js
expect(mockPrisma.sighting.create).toHaveBeenCalledWith(
  expect.objectContaining({ data: expect.objectContaining({ missionId: 'case-456' }) })
);
```

A green test locking in a dead endpoint. That single test is the best argument in
this document for Phase 0.5.

**Patrol signup is 100% broken.** `app/api/patrol/join/route.js:102` calls
`prisma.lostReport.findMany` on the happy path. Verified live: `500 — Cannot read
properties of undefined (reading 'findMany')`.

---

## 6. Scale: three unbounded matcher queries

- `app/api/reports/found-pet/route.js:188` — no `take`, no geographic bound,
  and `include: { pet: true, reporter: true }` hydrates full `User` rows
  (including `passwordHash`) for every candidate, on every found report.
- `app/api/reports/[id]/route.js:90` — no `take` and **no species filter**:
  loads every active LOST case on every case-detail view. This is a public,
  unauthenticated read path.
- `app/lib/cascade/reverseMatch.js` — bounded at `take: 300` but ordered by
  `createdAt desc`, so past 300 active found reports the older ones silently
  drop out, and ordering is by recency rather than proximity. A match two miles
  away can be crowded out by 300 newer reports anywhere in the country.

`Case` indexes are `[status]`, `[caseNumber]`, `[lastSeenLatitude,
lastSeenLongitude]`, `[createdAt]`. There is no index on `reportType` and no
composite `(reportType, status, petSpecies)`; `[status]` has five distinct values
and is nearly useless here. The lat/lng index is never used, because distance is
computed in JavaScript after the rows are loaded.

None of this hurts at seed scale. All of it hurts at one busy city.

---

## 7. Security and privacy

Verified **good** (probed live, not assumed):

- Pet access: stranger GET → 404 (not 403, deliberately, to prevent id probing);
  stranger PATCH/DELETE → 403; anonymous → 401.
- Notification and conversation IDOR: 403.
- Admin gates: anonymous 307, USER 403, ADMIN 200.
- Rate limiting is real: a 75-request burst returned 60 × 200 and 15 × 429.

Verified **concerning**:

**7a. Owner contact details are public and harvestable.**
`GET /api/public/missions/[caseNumber]`, unauthenticated, returns
`{ name, phone, email }` for LOST cases and `{ name, phone }` for FOUND ones.
Case numbers are enumerable from the public list endpoint (which is itself
correctly PII-free) and case URLs are in the sitemap. 60 req/min per IP is the
only brake — about 86,000 records a day from one address, and rotating addresses
is trivial. This is the intake for the lost-pet ransom scam, and it contradicts
the careful PII-free design used everywhere else in the match path.

**7b. CAPTCHA is dead code and a live landmine.** `app/components/ReCaptcha.js`
is orphaned — nothing imports it — and nothing sends the `x-recaptcha-token`
header. Meanwhile `middleware.js:289` 403s POSTs to `/api/missions`,
`/api/contact` and `/api/reports` when `REQUIRE_CAPTCHA=true`. So there is no bot
protection today, and switching it on for launch kills all reporting. The env
templates compound it: they document `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` while the
code reads `NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY` / `_V3_SITE_KEY`.

**7c. Nothing reports errors.** `app/lib/errorTracking.js` is a stub with every
`Sentry.*` call commented out and **no importers**. Every 500 in section 5 would
have gone unnoticed in production. (There is a partial substitute: an admin error
aggregation view backed by `logEvent`. It is not alerting.)

**7d. No backups.** No `pg_dump`, no backup script, no restore runbook anywhere,
while `package.json` `start` runs `prisma db push --skip-generate` on every boot
against a history with no `migration_lock.toml` and documented prior drift.

**7e. Email fails silently.** `app/lib/email.js` returns
`{ success: false, skipped: true }` with a `console.warn` when neither
`RESEND_API_KEY` nor SMTP credentials are set. Miss that variable in production
and every verification, reset and match alert vanishes quietly.

**7f. Still owner-gated** (from `HANDOFF.md`): rotate the two seeded admin
passwords (`contact@aalb.org`, `sarama@petrecovery.app`) on the live DB and set
`SEC18_ROTATED=true`; confirm a real `NEXTAUTH_SECRET`; legal review of
`/privacy` and `/legal/terms`.

**7g. Smaller.** `authOptions.pages.newUser` points at `/onboarding`, which does
not exist — new OAuth users land on the 404 page. `.env.production` is committed
and is loaded by `next build`. `public/manifest.json` shortcuts point at legacy
`/cases/new` and `/cases`.

---

## 8. The plan

### Phase 0 — Close the loop (4 to 6 days) — BLOCKING

1. **Fix the status filter** in all three matchers. Three lines.
2. **Show the owner their matches on a durable surface.** Either render the match
   block on the case page for the owner, or build a dedicated match-review
   screen, and repoint both notifications at it. Today the notification points at
   the one view that hides them.
3. **Ship Confirm & Connect.** Call `createMatchConnection()` on confirm, flip
   `connectAvailable` to the API's `canConnect`, build the relay thread UI on the
   `/api/relay/[token]` endpoints that already exist. Hold the tier model from
   the contract test: no raw phone, email or exact coordinates before mutual
   opt-in.
4. **Turn `finder-funnel.contract.test.js` on** as each piece lands.

**Acceptance:** a found report matching an `IN_PROGRESS` lost case notifies the
owner; the owner opens the notification a day later, sees the match, confirms it,
and exchanges a message with the finder without either phone number being
disclosed.

### Phase 0.5 — Recalibrate the matcher (2 to 3 days) — BLOCKING

Contradiction must cost points; impossible matches must be gated; "same state"
must stop being worth 10; the microchip path must not bypass the species gate
silently. Then re-fit `scoreToProbability()` against labelled pairs spanning the
0.40–0.70 band, as its own comment demands.

Shipping P0 without this means shipping confidently wrong matches to people on
the worst day of their year.

### Phase 0.6 — A test that can see the database (1 to 2 days) — BLOCKING

Add an integration suite running against an ephemeral Postgres in CI
(`services: postgres`, `prisma db push`, seed, run). Cover the reunion loop end
to end in both directions across all three open statuses, plus one smoke request
per API route asserting "not 500".

That last part alone would have caught all sixteen failures in section 5. Make
the Playwright job blocking once it has a seeded DB.

### Phase 1 — Repair the drift (2 to 3 days) — BLOCKING for what ships

Fix `sightings` and `patrol/join` — both are user-facing features that are
currently dead. Fix or delete the other fourteen. Deleting is a legitimate
answer for `communities` (already redirected away), `emergency/evacuation`,
`volunteers/schedule` and `integrations`; do not ship a navbar link to a 500.

### Phase 2 — Don't hurt the users (2 to 3 days) — BLOCKING

1. Decide the PII posture (section 9) and implement it; rate-limit the public
   case detail endpoint either way.
2. Defuse the CAPTCHA landmine: wire it properly and fix the env names, or remove
   `CAPTCHA_ROUTES` from middleware. Do not leave it half-present.
3. Verify email actually sends in production before launch — one real
   verification and one real match alert, checked for spam placement.

### Phase 3 — Know when it breaks (1 to 2 days) — BLOCKING

Real Sentry wired into `app/error.js` and the API error handlers. Automated
daily `pg_dump` with a **tested** restore and a written runbook. Uptime
monitoring on `/api/health` alerting somewhere the founder actually reads.

### Phase 4 — Launch mechanics (2 days)

Rotate the seeded admin passwords and set `SEC18_ROTATED=true`; confirm
`NEXTAUTH_SECRET`; create `/onboarding` or repoint `pages.newUser`; audit every
env var against what the code actually reads (the reCAPTCHA mismatch will not be
the only one); fix `manifest.json`; legal review; cut the surface (section 9).

### Phase 5 — Scale hygiene (1 day, can follow launch)

Bound and geo-filter the three matcher queries, stop hydrating `reporter` into
the candidate set, add a composite index on `(reportType, status, petSpecies)`,
and order `reverseMatch` candidates by proximity rather than recency.

---

## 9. Two decisions only the founder can make

**A. Public contact details.** Any anonymous visitor can pull every lost-pet
owner's name, phone and email from a documented API. Options: keep it (a digital
flyer, maximum reach, accepts harvesting); route everything through the relay
Phase 0 builds; or make it opt-in per case, defaulting to relay.

Recommendation: **relay**, since Phase 0 builds the replacement anyway and the
harm lands on someone on their worst day.

**B. How much of the product is visible at launch.** 117 pages is a large first
impression to defend, and section 5 shows how much of the periphery is broken.

Recommended MVP surface: report lost, report found, browse, case page, match and
connect, sightings (once fixed), pets, dashboard, auth, legal, plus the shelter
portal if a shelter is ready. Everything else stays reachable by URL but comes
off the navbar until it has been driven against a real database.

---

## 10. What is not on the critical path

Push notifications beyond what exists, the division system UI, the simulator,
gamification and points, the ad-fund widget (still hardcoded), the mobile
Capacitor build, load testing at 1000 users, the `RescueSquad` → `RescueForce`
rename debt.

`docs/LAUNCH_PHASES.md` (Nov 2025) is stale — it calls push notifications 20%
complete when `/api/push/*` is fully built, and treats a large TODO backlog as
the problem when there are 15 TODOs in all of `app/`. `docs/MVP_REALITY_CHECK.md`
is stale too; its "APIs cannot be tested locally" premise is no longer true.
Treat both as history.

---

## 11. Timeline

| Phase | Effort | Blocking? |
|---|---|---|
| 0 — Close the loop | 4–6 days | yes |
| 0.5 — Recalibrate the matcher | 2–3 days | yes |
| 0.6 — Integration test against a real DB | 1–2 days | yes |
| 1 — Repair schema drift | 2–3 days | yes |
| 2 — User safety (PII, CAPTCHA, email) | 2–3 days | yes |
| 3 — Observability and backups | 1–2 days | yes |
| 4 — Launch mechanics | 2 days | mostly |
| 5 — Scale hygiene | 1 day | no |

**14 to 21 working days to a soft launch** worth putting real users on, assuming
the founder-gated items (password rotation, legal review, the PII decision) run
in parallel rather than at the end.

## 12. Definition of done

A stranger finds a dog. They report it with a photo and a location, without
making an account. The owner — whose case a rescue force is already searching —
gets a notification within a minute, opens it the next morning, sees the dog,
confirms the match, and talks to the finder in the app. Neither publishes a phone
number. Someone else who spots the dog on the way to work can report a sighting
and it saves. The match the owner sees is one a reasonable person would agree
with. If anything throws, Sentry tells us before the user does, and we can
restore the database if we have to.

Phases 0 through 3 exist to make that paragraph true.
