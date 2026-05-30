# QA Functional Sweep — Findings & Bug Inventory

**Date:** 2026-05-30
**By:** Tester
**Method:** HTTP route-health + authed API sweep against the running app (http://localhost:5757), logged in as `tester@test.com` (role: USER, non-admin). Read-only GETs only — no writes to the shared production DB.

> Note: the original `/api/reports/create` etc. write-paths were NOT exercised (would mutate the shared live DB). Per-endpoint write/action coverage requires the ephemeral-DB route smoke test (see `docs/testing/route-smoke-test-design.md`), still parked on a gh-token / throwaway-DB / Docker unblock.

---

## ✅ Verified WORKING

- **All ~87 page routes load** — public pages return 200; admin/dashboard/settings correctly **307-redirect** when unauthenticated. No broken/blank pages.
- **Core user flows** render and are interactive: report lost (`/report/new` wizard), report found (`/found`), search, the match flow (MatchCard), login.
- **~40 authed GET endpoints** return 200 (profile, notifications, hub/stats, communities, missions/[caseNumber] + sub-resources, user prefs, volunteer impact, etc.).
- **Test gate green:** 21 suites / 184 tests.
- **"Dead buttons" report → RESOLVED:** it was the dev server being **down** during testing (stopped for a clean build). On a running server the homepage hydrates cleanly and CTAs are clickable (verified by UI Architect in a real browser). Not a code bug. If buttons look dead: `cd frontend && npm run dev`.

---

## 🔴 SECURITY (distinct, mock-testable, HIGH)

### SEC-20 — admin BI exposed to non-admins
- **Endpoint:** `GET /api/reports/dashboard`
- **Symptom:** Returns platform-wide business-intelligence (`totalCases`, `activeCases`, `reunions`, …) to a **non-admin** user. Confirmed 200 + data with `tester@test.com` (role USER). The POST (`action: custom|export`) is the same gate.
- **Amplifier:** the report-create flow auto-creates a User for any guest reporter, so "any authenticated user" ≈ anyone who ever filed a report.
- **Repro:** log in as a non-admin → `GET /api/reports/dashboard` → 200 with BI (should be 403).
- **Fix:** in-handler `isAdmin(session.user.id)` fresh-DB check on GET + POST (same pattern as SEC-14/15). Owner: developer.

---

## 🟠 500-ERROR CLUSTER (likely ONE root cause: schema drift — decision #2)

These DB-heavy authed endpoints 500 while simpler endpoints on the same session return 200 — a pattern that points to the **live shared Render DB being out of sync with `schema.prisma`** (queries on drifted models/columns/relations throw at runtime). Confirm via the Prisma error class in the server log (`PrismaClientKnownRequestError` / "column/table does not exist").

| Endpoint | Status | Note |
|---|---|---|
| `GET /api/hub/bookmarks` | 500 | `ForumBookmark` model EXISTS in schema (line 4203) + relations are correct → NOT a name-drift; live-DB-sync issue. |
| `GET /api/rescue-squads/{id}/available-missions` | 500 | "Failed to fetch available missions" catch. |
| `GET /api/rescue-squads/{id}/nearby-missions` | 500 | same shape. |
| `GET /api/analytics/cohorts` | 500 | analytics/BI lib — EA flagged this lib for petType-vs-petSpecies drift. |
| `GET /api/analytics/prediction` | 500 | same lib. |
| `GET /api/insurance/claims` | 500 | may instead be unimplemented scaffolding — verify separately. |

- **Highest-leverage fix:** confirm + resolve the schema drift (decision #2 — a deliberate migration reconciling live DB ↔ schema.prisma, **NOT** a `db push`). Likely fixes most of the cluster at once.
- **Repro:** log in → GET any of the above → 500.

---

## 🟡 EXTERNAL / ENV

### geocode ZIP lookup
- **Endpoint:** `GET /api/geocode/zip/{zip}`
- **Root cause (found by developer):** `geocodeZipCode()` does a **relative-URL** `fetch('/api/geocode?...')`, which works in the browser but FAILS server-side (no base to resolve) — and this route runs server-side. So it never worked when a client hit it.
- **Status:** developer hardened it to a graceful **503** (was a cryptic 500) + added a timeout. **Real fix still needed:** call Nominatim directly server-side (skip the proxy round-trip) or use an absolute base URL.

---

## Recommendations (priority order)

1. **SEC-20** — add the `isAdmin` gate (independent, security, quick).
2. **Schema drift (decision #2)** — owner decision + deliberate migration; likely clears the whole 500 cluster.
3. **geocode** — server-side direct call.
4. Re-enable the **ephemeral-DB route smoke test** (gh-token/Docker/throwaway-DB) to catch the whole "endpoint 500 on a real DB" class automatically every commit.

Tester will write regression tests + verify each fix once it lands and the DB is in sync.
