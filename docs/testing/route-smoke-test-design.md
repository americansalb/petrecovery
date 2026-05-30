# Ephemeral-DB Route Smoke Test (Pattern-4 drift catch) — ready-to-apply design

**Status: DESIGN / UNVERIFIED.** Authored by Tester; approved by Architect (msg 547)
+ dev-challenger (msg 548). NOT yet wired to run because it cannot be validated in
this environment (no Docker, no local Postgres, the only reachable DB is the shared
Render prod DB which is off-limits, and `gh` is unauthenticated so CI runs can't be
observed from here). **Do not promote to a merge gate until a real run is green AND
the canary below proves it catches drift** — an all-green run can just mean the
harness never reached the Prisma layer (the "test that doesn't reach the code path is
theater" trap, Architect msg 547).

## Why this exists
The mocked unit suite (15 suites / 164 tests, the hard gate) locks the FLOW but
**cannot catch Prisma identifier drift** — a mocked client accepts any
model/field/composite-key name. That class produced CRIT-B (`missionId`→`caseId`),
COM-1 (wrong composite key), SEC-2 (`squadMembership`), and the `missionNumber`→
`caseNumber` actionUrl bug. Only a REAL PrismaClient against a real schema 500s on
those. This job catches them automatically.

## The pattern (verified by reasoning)
Mock **only** `next-auth` (per-route session for a seeded admin / squad-leader /
case-owner). Use the **real** prisma client against an **ephemeral** Postgres. Then
each route's actual queries run; drift 500s; the assertion `status !== 500` fails.
Per dev-challenger msg 511, fixture **per branch** (one per case-label in each
`switch`), or branchy routes go green on the untested branch.

## SAFETY GUARD (non-negotiable, ties to OPS-1)
The job's `DATABASE_URL` must be the ephemeral service container, **NEVER** the
shared Render DB — a `prisma db push` against the shared DB drops live rows. The
workflow's first step is a preflight that hard-fails if `DATABASE_URL` looks like the
shared host.

---

## 1) `.github/workflows/ci-integration.yml` (separate, non-blocking)

```yaml
name: CI Integration (route smoke test)
on:
  workflow_dispatch: {}          # manual until proven; add push:[report-wizard-v2] once green
jobs:
  route-smoke:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: ci
          POSTGRES_PASSWORD: ci
          POSTGRES_DB: petrecovery_ci
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U ci" --health-interval 5s
          --health-timeout 5s --health-retries 10
    env:
      DATABASE_URL: postgresql://ci:ci@localhost:5432/petrecovery_ci
      NEXTAUTH_SECRET: test-secret
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm', cache-dependency-path: frontend/package-lock.json }
      # PREFLIGHT — refuse to touch the shared/prod DB.
      - name: Assert ephemeral DB only
        run: |
          case "$DATABASE_URL" in
            *render.com*|*oregon-postgres*) echo "::error::DATABASE_URL points at the shared DB"; exit 1 ;;
            postgresql://ci:ci@localhost:*) echo "ephemeral DB OK" ;;
            *) echo "::error::DATABASE_URL is not the ephemeral CI service"; exit 1 ;;
          esac
      - run: npm ci            # postinstall is `prisma generate` only — safe
        working-directory: frontend
      - run: npx prisma db push --skip-generate   # throwaway DB — push is fine here
        working-directory: frontend
      - run: node __tests__/integration/seed.mjs  # seed admin/leader/owner + squad/case/comment
        working-directory: frontend
      - run: npx jest -c jest.integration.config.js --ci --runInBand
        working-directory: frontend
```

## 2) `frontend/jest.integration.config.js`

```js
const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });
module.exports = createJestConfig({
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  testMatch: ['**/__tests__/integration/**/*.integration.test.js'],
  // NOTE: no jest.setup.js here — the unit setup hardcodes a fake DATABASE_URL,
  // which would clobber the ephemeral service URL. Integration files do NOT mock prisma.
  setupFilesAfterEnv: [],
  testTimeout: 30000,
});
```

## 3) Keep integration tests OUT of the unit gate
Add to `frontend/jest.config.js` `testPathIgnorePatterns`:
```js
'<rootDir>/__tests__/integration/',
```
Otherwise the main `jest --ci` gate would run these against the dummy unit
DATABASE_URL and hang/fail.

## 4) Example: COM-1 vote (`__tests__/integration/vote.integration.test.js`)

```js
// Real prisma (ephemeral DB) + mocked session. If the membership composite-key
// accessor drifts (the COM-1 bug), prisma 500s and this fails — which a mock can't catch.
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
import { POST } from '@/app/api/rescue-squads/[id]/comments/[commentId]/vote/route';
import { getServerSession } from 'next-auth';
import { seedSquadWithComment } from './seed.mjs'; // returns {squadId, commentId, memberUserId}

test('a seeded member can vote (no Prisma 500 on the composite key)', async () => {
  const { squadId, commentId, memberUserId } = await seedSquadWithComment();
  getServerSession.mockResolvedValue({ user: { id: memberUserId } });
  const res = await POST(new Request('http://x', { method:'POST', body: JSON.stringify({ vote: 1 }) }),
    { params: { id: squadId, commentId } });
  expect(res.status).not.toBe(500);
  expect(res.status).toBe(200);
});
```

## 5) Branch-selector map to expand coverage (dev-challenger msg 511)
One fixture per case-label, each with a session that passes that branch's authz:
- `notifications/send` POST: `{targetUserIds}` (admin) / `{squadId}` (leader — SEC-2 drift) / `{missionId}` (case-authority)
- `reports/dashboard` GET `?type=`: executive|realtime|geographic|trends; POST `action`: custom|export (admin)
- `mission/[id]/command` POST `action`: BROADCAST, ASSIGN_ZONE, REQUEST_RESOURCE, SWITCH_TRAP_OPS, ADD_TRAP, CHECK_TRAP, RESOLVE_FOUND, RESOLVE_DECEASED, PAUSE_COLD (case-authority); GET `?view=`: shift-summary|default
- comment-vote + post-vote POST `vote`: 1 | -1 | resend-same(toggle)

## 6) CANARY before trusting green (Architect msg 547)
Before promoting to a gate, temporarily reintroduce a known drift (e.g. `caseId`→
`missionId` in found-pet, or the old vote composite key) and confirm the job goes RED.
If it stays green, the harness isn't reaching Prisma — fix it before trusting it.

## 7) Docker-free complementary half (dev-challenger msg 548)
`// @ts-check` + JSDoc (or `.ts` conversion) on the hot data routes makes
model/field/relation-name drift fail at BUILD with no DB at all. This catches the
static half of the class; the integration job catches the runtime/query half. Both,
complementary. (Developer's lane — editing route files; will surface latent type
issues across the untyped routes, so scope to hot routes first.)

## Unblock paths for validation
- `gh auth login` (or set `GH_TOKEN`) so CI runs can be observed from here, then flip
  the workflow `on:` to `push: [report-wizard-v2]` and iterate to green.
- OR a throwaway Neon/Supabase `DATABASE_URL` (separate from the shared one) for local
  iteration without Docker.
- OR enable Docker locally and run `postgres:16` for a local loop.
