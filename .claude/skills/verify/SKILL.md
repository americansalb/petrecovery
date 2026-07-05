---
name: verify
description: Build, launch, and drive the ReunitePets frontend to verify a change end-to-end (dev server + seeded Postgres + Playwright/Chromium).
---

# Verify a change in the running app

All commands from `frontend/` unless noted.

## One-time environment setup (fresh container)

```bash
service postgresql start            # PG 16 is preinstalled but stopped
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo -u postgres createdb petrecovery
cat > .env <<'EOF'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/petrecovery
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=local-dev-verify-secret-0123456789abcdef
EOF
npm install                         # node_modules is not checked in
npx prisma db push --skip-generate  # schema sync (client is prebuilt by postinstall)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/petrecovery \
  node prisma/seed-sample-data.js   # plain `node` does NOT read .env — export it
DATABASE_URL=... node prisma/seed.js  # legal docs (ToS gate needs them)
```

Seeded login: `admin@localdev.test` / `LocalDevScreenshots1!` (see
`prisma/seed-sample-data.js`; also sarah@/mike@/david@localdev.test as
regular members).

## Launch

```bash
npm run dev   # background it; ready when GET / returns 200 (~10s first compile)
```

Dev-server quirks: each route compiles on FIRST hit (skews timing —
warm routes before measuring); `curl --noproxy localhost` (the sandbox
proxies HTTPS).

## Drive (Playwright)

Chromium is preinstalled: `executablePath: '/opt/pw-browsers/chromium'`.
`playwright-core` is NOT in frontend deps — `npm i playwright-core` in a
scratch dir. Log in by filling `/login` and waiting for
`[data-dropdown="user"]` to appear (retry once or twice — don't hammer:
auth endpoints are rate-limited per IP).

Gotchas that produced false readings before:

- The universal navbar renders 65px tall (h-16 + 1px border), not 64.
- `useSession` starts as loading → the nav shows an `animate-pulse`
  placeholder for ~0.5–2s; wait for it to disappear before reading chrome.
- The notification-bell badge is a live counter; exclude numeric badge
  text when diffing nav content across pages.
- CDN assets (`petrescue.b-cdn.net`) are unreachable in the sandbox:
  logos render as alt text. That inflates `scrollWidth`, so measure
  overflow by the last element's `getBoundingClientRect().right`, not
  `scrollWidth`.

## What to check for chrome/navbar changes

`__tests__/global-chrome.test.js` is the static gate. At runtime: profile
`nav.sticky.top-0` (geometry + visible link text) across routes logged out
AND logged in; scroll a long page and assert `navTop === 0` (sticky
regression); check `/mission-control` has NO global nav; check the mobile
tab bar (`nav.fixed.bottom-0`) at 390px.
