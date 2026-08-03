# MVP Launch Plan

**Written:** 2026-08-03
**Method:** every claim below was verified against the code on `claude/mvp-launch-plan-qfj453`
(tip of `pet_main` at `6d00056`), with a production build booted against a real
seeded Postgres and the core APIs driven by hand. Nothing here is inherited from
an older doc without re-checking it.

---

## 1. The headline

The app is not under-built. It is over-built around a core loop that does not close.

Verified working right now:

| Check | Result |
|---|---|
| `npm ci` + `prisma generate` | clean |
| `npx jest --ci` | **51 suites, 591 tests, all pass** |
| `npm run build` | **exit 0, 231 static pages** |
| Public pages (`/`, `/lost-and-found`, `/login`, `/register`, `/pets`, `/shelters`, `/hub`, `/for-shelters`, `/privacy`, `/legal/terms`, `/rescue-forces`, `/report/new`, `/report/found`) | all 200 |
| Credentials login → session with role | works |
| Authed `/api/dashboard`, `/api/notifications`, `/api/pets`, `/api/profile` | all 200 |
| Report a lost pet (`POST /api/reports/create`) | works: creates case, assigns nearest rescue force, alerts patrol |
| Report a found pet (`POST /api/reports/found-pet`) | works: creates case, scores matches, writes owner notification |

Scale of the surface: **117 pages, 304 API routes, 158 Prisma models.**

So the honest MVP question is not "what else do we build." It is "why does the one
job not finish, and what do we hide until it does."

---

## 2. The core loop is broken in four places

This is the product. Someone loses a pet, someone else finds it, they get connected.
Here is what actually happens today, traced end to end against a live database.

### P0-1. The matcher ignores lost cases that are not exactly `ACTIVE`

`app/api/reports/found-pet/route.js:191` and `app/api/reports/[id]/route.js:92`
both query candidates with `status: 'ACTIVE'`.

`CaseStatus` has five values. Three of them mean "still lost":

```
ACTIVE             // just reported
IN_PROGRESS        // a rescue force is actively searching   <-- excluded
SIGHTING_REPORTED  // the pet has been sighted               <-- excluded
REUNITED
CLOSED_OTHER
```

The two excluded statuses are the *most* engaged cases in the system.

**Proof.** Identical found-pet report, submitted twice, changing only the seeded
lost case's status:

| Max's status | Result |
|---|---|
| `IN_PROGRESS` | `matchesNotified: 0`, `potentialMatches: []` |
| `ACTIVE` | `pTrueMatch: 0.95`, `band: "actionable"`, owner notified |

A 0.95-confidence match on a golden retriever found 100 metres from where it was
lost is silently dropped the moment a rescue force starts searching.

`app/api/dashboard/route.js:26,279` already uses the correct idiom
(`status: { notIn: ['REUNITED', 'CLOSED_OTHER'] }`). The matcher just never got it.

**Fix:** two lines. This is the single highest-value change in the repo.

### P0-2. Lost reports are never matched against found reports

`app/api/reports/create/route.js` does not import `findMatches` or
`calculateMatchScore`. Grep confirms only two routes in the entire API run the
matcher, and both go FOUND → LOST.

So if the finder reports first and the owner reports second, nobody is ever told.
That is roughly half of all real reunions.

**Proof.** Posted a lost golden retriever 30 metres from a seeded *found* golden
retriever. Response contained no match field, no notification, nothing. The two
records sit in the same table, a block apart, and never meet.

### P0-3. The owner's notification is a dead end

The notification is written correctly:

```json
{ "title": "Possible match for Max",
  "message": "Someone just reported a found DOG ... Tap to review and connect.",
  "actionUrl": "/cases/AUS-2026-0001" }
```

That URL is the owner's own lost-pet page. `grep -rn "Match" app/cases/` returns
**nothing**. There is no match UI on that page at all.

The only place in the product where a match is ever rendered to a human is
`app/components/report/SuccessScreen.js` — the *finder's* success screen, shown
once, immediately after they submit.

The owner is told to "review and connect" and is sent to a page with neither.

### P0-4. There is no way to connect

- `createMatchConnection()` (`app/lib/relay.js:69`) has **zero callers**.
- `/api/relay/[token]` and `/api/relay/[token]/messages` read and update
  `MatchConnection` rows that nothing can create.
- Both render sites hardcode `connectAvailable={false}`
  (`SuccessScreen.js:122`, `recoveryKit/RecoveryKit.js:395`).

The relay is built and unreachable. `__tests__/api/finder-funnel.contract.test.js`
says so in its own header ("The routes under test DO NOT EXIST YET") and is still
entirely `test.todo`.

### Why the test suite never caught any of this

**34 of 51 test files mock Prisma. Zero tests touch a real database.**

Mocked Prisma returns whatever the test author says it returns, so a `where`
clause that excludes two thirds of live cases looks identical to a correct one.
The keystone test even flags this in its own comment: *"mocked prisma can't catch
the caseId-vs-missionId DRIFT itself (that needs the ephemeral-DB smoke test)."*

That ephemeral-DB smoke test was never built. Every bug in section 2 is invisible
to CI by construction. Playwright exists but is explicitly non-blocking
(`.github/workflows/ci.yml`: *"Playwright suite not green yet (needs seeded DB)"*).

---

## 3. Launch blockers outside the loop

### P1-1. Owner phone, email and name are public and harvestable

`GET /api/public/missions/[caseNumber]`, **unauthenticated**, returns:

```json
"contact": { "name": "Avery Admin", "phone": "512-555-0100",
             "email": "admin@localdev.test",
             "disclaimer": "...exercise caution..." }
```

FOUND cases expose the finder's name and phone the same way. Case numbers are
enumerable from the public list endpoint (which itself is correctly PII-free), and
case URLs are in the sitemap. The only protection is the middleware's 60 req/min
per-IP limiter, i.e. ~86,000 records per day per IP.

This is the exact intake for the lost-pet ransom scam: harvest owner phone
numbers, text them claiming to have the pet, demand payment. It is a documented
real-world harm to the exact people this product serves, and it directly
contradicts the careful no-PII design the team built for the match path
(`reports/[id]` ships coarse areas and no contact details on purpose).

This may still be a deliberate "digital flyer" choice. It needs to be an explicit
founder decision before launch, not an accident of one route.

### P1-2. CAPTCHA is dead code and a live landmine

- `app/components/ReCaptcha.js` is **orphaned** — nothing imports it.
- Nothing anywhere sends the `x-recaptcha-token` header.
- `middleware.js:289` blocks POSTs to `/api/missions`, `/api/contact` and
  `/api/reports` when `REQUIRE_CAPTCHA=true`.

So there is no bot protection today, **and** the moment anyone sets
`REQUIRE_CAPTCHA=true` for launch, every lost-pet and found-pet submission starts
returning 403. The core product function fails closed on a plausible config change.

Compounding it: `.env.example` and `.env.production` document
`NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, but the code reads
`NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY` / `_V3_SITE_KEY`. Following the template
configures nothing.

### P1-3. Nothing reports errors

`app/lib/errorTracking.js` is a stub. Every `Sentry.*` call is commented out, and
**no file imports it**. Production errors go to stdout and nowhere else. Right now
we would not know the loop was broken unless a user told us.

### P1-4. No backups, and schema syncs on every boot

No `pg_dump`, no backup script, no restore runbook anywhere in the repo.
Meanwhile `package.json` `start` runs `prisma db push --skip-generate` on every
boot, against a schema history with no `migration_lock.toml` and known prior drift
(`manual_add_relay_tables.sql` records `db push` once wanting to drop two live
tables). One bad push with no backup is unrecoverable.

### P1-5. Email silently no-ops when unconfigured

`app/lib/email.js` falls through to a `console.warn` and returns
`{ success: false, skipped: true }` when neither `RESEND_API_KEY` nor SMTP creds
are set. If that env var is missing in production, every verification email,
password reset and match alert vanishes quietly and the app looks fine.

### P1-6. Still owner-gated from HANDOFF.md

- Rotate the two seeded admin passwords on the live DB (`contact@aalb.org`,
  `sarama@petrecovery.app`), then set `SEC18_ROTATED=true`. Their original
  passwords are in git history; SEC-18 blocks them by default until rotated.
- Confirm a real `NEXTAUTH_SECRET` in the deploy env.
- Legal review of `/privacy` and `/legal/terms`.

### P1-7. Smaller, cheap

- `authOptions.pages.newUser` points at `/onboarding`. **That route does not
  exist** — every brand-new OAuth user lands on the 404 page.
- `.env.production` is committed and is loaded by `next build`
  (build log: `- Environments: .env.production`). It holds placeholders, not
  secrets, but `NEXT_PUBLIC_BASE_URL` gets baked into the client bundle from it.
- `public/manifest.json` shortcuts point at legacy `/cases/new` and `/cases`.

---

## 4. The plan

Four phases. Phase 0 is the MVP; everything after it is making the launch safe to
run. Estimates assume one focused engineer.

### Phase 0 — Close the loop (3 to 5 days) — BLOCKING

Nothing else matters until a real reunion can happen through the product.

1. **Fix the status filter.** `status: { notIn: ['REUNITED', 'CLOSED_OTHER'] }` in
   `found-pet/route.js:191` and `reports/[id]/route.js:92`. Two lines.
2. **Match on lost-report create.** Extract the FOUND→LOST block from
   `found-pet/route.js` into one shared `app/lib/reunion.js` helper that runs both
   directions, and call it from `reports/create/route.js`. Same cruelty gate, same
   bands, same honest `notifiedCount`.
3. **Build the owner's match review surface.** A real screen the notification can
   point at, listing candidate matches with photo, coarse area and confidence.
   Repoint `actionUrl` at it. The data is already in the notification payload
   (`data.foundCaseId`).
4. **Ship Confirm & Connect.** Call `createMatchConnection()` on owner confirm,
   flip `connectAvailable` to real, and build the relay thread UI on top of the
   `/api/relay/[token]` endpoints that already exist. Keep the tier model the
   contract test specifies: no raw phone, email or exact coordinates before mutual
   opt-in.
5. **Turn `finder-funnel.contract.test.js` on.** Convert the `test.todo` entries
   into real tests as each piece lands. It is already the ratified spec.

**Acceptance:** on a seeded database, a found report matching an `IN_PROGRESS`
lost case notifies the owner; the owner opens the notification, sees the match,
confirms it, and exchanges a message with the finder without either party's phone
number being disclosed.

### Phase 0.5 — A test that would have caught this (1 day) — BLOCKING

Add one integration suite that runs against a real ephemeral Postgres in CI
(`services: postgres` in the workflow, `prisma db push`, seed, run). It needs to
cover exactly one thing: the reunion loop end to end, both directions, across all
three open statuses.

Without this, Phase 0 regresses the first time someone touches a `where` clause.
The whole class of bug in section 2 exists because CI cannot see the database.

Make the Playwright job blocking once it has that seeded DB.

### Phase 1 — Don't hurt the users (2 to 3 days) — BLOCKING

1. **Decide the PII posture** (founder call, see section 5). Then implement it and
   add `PUBLIC_READ` rate limiting to `/api/public/missions/[caseNumber]`
   regardless of which way it goes.
2. **Defuse the CAPTCHA landmine.** Either wire `ReCaptcha.js` into the three
   report forms and fix the env var names, or delete `CAPTCHA_ROUTES` from
   middleware so nobody can 403 the product with one env var. Do not leave it
   half-present.
3. **Verify email actually sends in production** before launch, not after. Set
   `RESEND_API_KEY`, verify the domain, send one real verification and one real
   match alert, and check they do not land in spam.

### Phase 2 — Know when it breaks (1 to 2 days) — BLOCKING

1. **Real Sentry.** Install `@sentry/nextjs`, replace the `errorTracking.js` stub
   with actual calls, wire `app/error.js` and the API error handlers, set
   `SENTRY_DSN`. Alert on error-rate spikes.
2. **Backups.** Automated daily `pg_dump`, 30-day retention, and one *tested*
   restore into a scratch database. Write the runbook.
3. **Uptime monitoring** against `/api/health` with alerting to a channel the
   founder actually reads.

### Phase 3 — Launch mechanics (2 days)

1. Rotate seeded admin passwords, set `SEC18_ROTATED=true`, confirm
   `NEXTAUTH_SECRET`.
2. Create `/onboarding` (or repoint `pages.newUser` at `/dashboard`).
3. Audit every env var in the deploy against what the code actually reads. The
   reCAPTCHA mismatch will not be the only one.
4. Fix `manifest.json` shortcuts.
5. Legal review of `/privacy` and `/legal/terms`.
6. Cut the surface (below).

---

## 5. Two decisions only the founder can make

**A. Public contact details.** Today any anonymous visitor can pull every lost-pet
owner's name, phone and email from a documented API, and the sitemap advertises
the case URLs. Three options:

- *Flyer* — keep it. Maximum reach, and it is what a physical poster does. Accepts
  that scammers will harvest it.
- *Relay* — remove contact from the public payload, route everything through the
  Confirm & Connect thread Phase 0 builds. Safest, and consistent with the design
  the team already committed to for matches.
- *Middle* — owner opts in per case, defaulting to relay-only.

My recommendation is *relay*, because Phase 0 builds the replacement anyway and
because the harm here lands on someone on the worst day of their year.

**B. How much of the product is visible at launch.** 117 pages is a large first
impression to defend, and most of it is not the loop. Divisions have no UI, the
simulator family is unauthenticated research tooling, `MIGRATION_NEEDED.md`
prescribes a schema change that never landed, and `seed-chicago-squad.js` no
longer matches the schema.

Recommended MVP surface: report lost, report found, browse, case page, match and
connect, pets, dashboard, auth, legal, plus the shelter portal if a shelter is
ready to use it. Everything else stays reachable by URL but comes off the navbar
until the loop is proven.

---

## 6. What is explicitly not on the critical path

Do not spend launch time on: push notifications beyond what exists, the division
system UI, the simulator, gamification and points, the ad-fund widget (still
hardcoded per `LOST_PET_LANDING_PAGE_PLAN.md`), the mobile Capacitor build,
load testing at 1000 users, or the `RescueSquad` → `RescueForce` rename debt.

`docs/LAUNCH_PHASES.md` (Nov 2025) lists several of these as critical. It is stale:
it calls push notifications 20% complete when `/api/push/*` is now fully built,
and calls the codebase's TODO backlog large when there are 15 TODOs in all of
`app/`. Treat it as history. Same for `docs/MVP_REALITY_CHECK.md`, whose "APIs
cannot be tested locally" premise is simply no longer true.

---

## 7. Realistic timeline

| Phase | Effort | Blocking? |
|---|---|---|
| 0 — Close the loop | 3–5 days | yes |
| 0.5 — Real-DB integration test | 1 day | yes |
| 1 — User safety | 2–3 days | yes |
| 2 — Observability and backups | 1–2 days | yes |
| 3 — Launch mechanics | 2 days | mostly |

**9 to 13 working days to a soft launch** worth putting real users on, assuming
the founder-gated items (password rotation, legal review, PII decision) happen in
parallel rather than at the end.

## 8. Definition of done

A stranger finds a dog. They report it with a photo and a location, without making
an account. The owner — whose case a rescue force is already searching — gets a
notification within a minute, opens it, sees the dog, confirms the match, and
talks to the finder through the app. Neither one has to publish a phone number.
If any step of that throws, we find out from Sentry before the user tells us, and
we can restore the database if we have to.

Everything in Phase 0 through 2 exists to make that paragraph true.
