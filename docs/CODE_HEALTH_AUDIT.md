# Code health & hygiene audit

2026-07-27, whole-frontend pass: lint/tooling state, dependency audit,
runtime hygiene greps, repo secrets check, and a read of the conventions
the codebase already enforces well. Companion to
`HEALTHBOOK_UIUX_AUDIT.md` (product surface) - this one is about the
code itself. Numbers below are from this commit's tree.

## 1. Verdict

The codebase is healthier than its age and speed of growth suggest: the
newer ("care-era") code has a strong comment culture, real test gates
guard the riskiest invariants, and the data layer has genuinely good
discipline (tombstones, additive schema, versioned legal docs). The debt
is concentrated in **operational hygiene**: two committed env files, a
vulnerable auth dependency chain, a lint step that has silently never
run, no exception tracking, and 439 stray `console.log`s standing in for
observability.

## 2. Findings, by priority

### P0 - committed environment files with real-looking credentials

`.env.production` and `.env.staging` are tracked in git. Most keys are
empty strings, but both carry fully-populated `DATABASE_URL`s (108 and
79 chars) and `NEXTAUTH_SECRET` values that may or may not be
placeholders. The root `.gitignore` lists `.env`, `.env.local`, and
`*.env` - and `*.env` does **not** match `.env.production` (it matches
files *ending* in `.env`), which is how these slipped through.

Do, in order: rotate the production database credential and
`NEXTAUTH_SECRET` (assume anything committed is burned - it lives in
git history regardless of a later delete), move real values to the
hosting platform's secret store, delete both files from the repo, add
`.env.*` + `!.env.example` to `.gitignore`, and keep only
`.env.example` with empty values. `run_secret_scanning` on the GitHub
side is a cheap follow-up.

### P0 - 18 production-dependency vulnerabilities, 2 critical, in the auth chain

`npm audit --omit=dev`: **critical** advisories against `next-auth` and
`@auth/core`, **high** against `next`, `axios`, `nodemailer`, `jws`
(improper HMAC signature verification - directly auth-adjacent),
`form-data`, `js-cookie`, and friends; 4 moderate (`qs` DoS, `uuid`,
...). 13 of 18 are fixable with a plain `npm audit fix`; 3 need
`--force` (potentially breaking). Do this as its own PR: `npm audit
fix`, full test suite + production build + a login/register/dose-log
smoke pass, then evaluate the `--force` stragglers individually. The
auth-chain criticals make this worth doing this week, not this quarter.

### P1 - the CI lint step has never linted anything

`npm run lint` drops into ESLint's interactive setup wizard - there is
no ESLint config in the repo at all - and CI runs
`npm run lint || echo "Linting not configured"`, so the step
green-checks a no-op. Add `.eslintrc.json` with `next/core-web-vitals`,
fix or explicitly disable what it flags (expect a large first batch;
land it as warnings-allowed, then ratchet), and remove the `|| echo`
escape hatch so lint actually gates.

### P1 - no exception tracking

There is no error-tracking SDK anywhere (the `SENTRY_*` keys in the
committed staging env file are empty; the one "Sentry" hit in code is a
patrol-role label). The structured `EventLog` system is good for domain
events, but nothing catches unhandled exceptions or client-side crashes.
Wire Sentry (or equivalent) for both server and client, and route the
existing error boundaries into it. Until then, production issues are
invisible unless a user reports them.

### P1 - 439 `console.log` calls in runtime code (263 in API routes)

The repo has `docs/LOGGING_STANDARD.md` and a real `logEvent` pipeline,
but ad-hoc `console.log`s (many with emoji banners) are the de-facto
logging in API routes, and 175 more ship in client bundles. Two-step
fix: set `compiler.removeConsole = { exclude: ['error', 'warn'] }` in
`next.config.js` (kills the client-side noise at build time for free),
then migrate API-route logs to the structured logger opportunistically
- whenever a file is touched, its `console.log`s convert.

### P2 - empty catch blocks: 27, some deliberate, none all labelled

The house already has the right pattern in places -
`catch { /* glance is best-effort */ }` - but 27 bare `catch {}`
blocks exist and only some say why swallowing is safe. Rule to adopt:
**an empty catch must carry a comment naming what failure is being
tolerated and why that's safe.** The unexplained ones are exactly where
silent data loss hides (that's how the Health tab's silent-empty-book
bug happened).

### P2 - `key={index}` in 70 list renders

Harmless for static content, wrong for anything that reorders, inserts,
or deletes (React reuses state across rows). The Health Book weight
chart dots are fine; manage-mode lists and feed-like surfaces are the
risk. Sweep the dynamic lists to stable ids (`key={item.id}`); leave
truly static markup alone.

### P2 - React strict mode is off

`reactStrictMode` is unset in `next.config.js`. Enabling it
double-invokes effects in dev and surfaces unsafe patterns before they
ship. Expect some noisy first runs (SSE hooks, Leaflet mounts); worth
absorbing.

### P2 - test breadth vs depth

51 test files against ~870 source files. What exists is genuinely good
- authz contracts, API validation, and the two invariant gates
(`global-chrome`, `link-previews`) that fail CI on whole *classes* of
regression, plus the practice of pinning every fixed bug with a test
(the Health Book work added 10). The gap is component/page coverage:
almost no UI-level tests. Cheapest lever: a smoke test that renders
every route (the `gallery-sweep.js` route list already enumerates them)
and fails on thrown errors/empty bodies, which catches the
"page crashes on null pet" family without writing per-page tests.

### P3 - oversized files and heavyweight data in `app/lib`

`app/admin/qa/page.js` (2,140 lines), `taskPriority.js` (1,772),
`TaskCompletionModal.js` (1,559), `admin/health/page.jsx` (1,380) are
past the point where a reviewer can hold them. Split on natural seams
when next touched - no big-bang rewrite. Separately, 120k+ lines of
city JSON live under `app/lib/` (`mxcities.json` 74k lines); they're
only consumed server-side today, but nothing stops a client import from
dragging megabytes into a bundle - move them out of `app/` or add a
lint fence.

### P3 - known, documented structural debt (fine, keep it documented)

Three naming strata (`Case`/Mission, `RescueSquad`/RescueForce at
different layers), push-based schema sync instead of migrations, mixed
JS with newer TS API routes, and in-memory SSE/rate-limit state that
assumes a single instance. All of these are *deliberate, documented*
trade-offs in `APP_MAP.md` - the hygiene task is not to fix them today
but to keep the map current and stop the strata from growing (e.g. no
new user-facing "Squad" strings; new API routes in TS).

## 3. What's already healthy (keep doing this)

- **WHY-comments in the care-era code**: comments state constraints the
  code can't ("Date inputs carry a wide intrinsic minimum ... so
  without wrap + min-w-0 the Log button is pushed off a narrow
  screen"), not what the next line does. This is the house style worth
  enforcing everywhere.
- **Invariant tests as gates**, not just unit tests.
- **Medical data is tombstoned**, never hard-deleted; renewal logic and
  headline-weight recompute live in transactions.
- **Access rails** (`requirePetAccess`) applied consistently across the
  pet APIs; per-IP rate limiting; structured security event logging.
- **Versioned legal docs** synced at boot, acceptance recorded per user
  per version.
- **Additive-schema discipline** with the *reason* commented in the
  schema itself.
- Only 14 TODO/FIXMEs - backlog lives in docs, not scattered in code.

## 4. The hygiene playbook

The standing rules worth adopting, including the one you suggested -
ambiguous code gets a note:

1. **Comment contract**: any non-obvious constant, workaround, ordering
   constraint, or swallowed error gets a one-line WHY comment. "Naked
   cleverness" is a review block. The care-era files are the template.
2. **Empty catch = labelled catch.** No exceptions swallowed without a
   stated reason.
3. **Secrets never in git**: `.env.*` ignored globally, `.env.example`
   is the only committed env file, anything once committed gets rotated.
4. **Dependency rhythm**: `npm audit` weekly (or Dependabot/Renovate),
   auth-chain advisories patched within days, upgrades land as isolated
   PRs with the full gauntlet (tests + build + smoke).
5. **Lint gates CI** - no `|| echo` escape hatches on quality steps.
6. **Console discipline**: structured logger in API routes,
   `removeConsole` for client bundles, exception tracker for everything
   unhandled.
7. **Stable React keys** for any list that can change shape.
8. **File-size budget**: flag any file crossing ~800 lines in review;
   split on next touch.
9. **Every bug fix ships its regression test** (already the pattern -
   keep it).
10. **Keep `APP_MAP.md` the single living map** - new routes, models,
    and naming decisions land there in the same PR.

## 5. Suggested order

1. Secrets: rotate + purge committed env files (hours, highest risk).
2. `npm audit fix` PR for the auth-chain criticals (a day with smoke
   testing).
3. ESLint config + CI gate; `removeConsole`; Sentry (a day together).
4. Labelled-catch and key sweep (opportunistic, mechanical).
5. Route-smoke test harness; strict mode; file splits (background
   rhythm).
