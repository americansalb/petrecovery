# UI screenshot harness

Headless-Chrome screenshot tools for **screenshot-driven UX review** — observe the
real rendered app (desktop + mobile, public + authenticated), not just the code.
Built by the UI Architect; useful for anyone doing visual QA or browser smoke checks.

## Setup (one-time)
```bash
npm i -D puppeteer-core      # ~3MB, no bundled browser
```
Uses your **installed** Chrome (or Edge) — auto-detected, or set `CHROME_PATH`.
Requires the dev server running (`npm run dev` on :3000).

## Tools

### `shoot.mjs` — capture routes at desktop + mobile
```bash
node scripts/shoot.mjs                          # default route list
MSYS_NO_PATHCONV=1 node scripts/shoot.mjs /report/new /report/found   # specific routes (Git Bash needs the prefix so leading-/ args aren't mangled)
LOGIN_EMAIL=contact@aalb.org LOGIN_PASSWORD=winner node scripts/shoot.mjs /dashboard   # authenticated
SETTLE_MS=2500 node scripts/shoot.mjs           # longer settle for async/animated pages
```
Output: `docs/analysis/screenshots/<slug>__<desktop|mobile>.png`.
Auth: logs in via the NextAuth credentials form and polls for the
`next-auth.session-token` cookie (signIn uses `redirect:false`, so it does NOT
navigate — don't wait on navigation).

### `drive-found.mjs` — click through the FOUND wizard, shot each step
```bash
node scripts/drive-found.mjs    # found-flow-1-type.png … found-flow-5-details.png
```

### `diag-home.mjs` / `diag-login.mjs` — diagnostics
Probe a page for console errors, element visibility/opacity, and (for login)
whether the session cookie actually gets set. Use these to tell a real bug from a
capture artifact (e.g. a Framer-Motion reveal that hasn't fired, or an auth gate
still resolving) before filing.

## Gotchas
- **Geolocation:** GPS-dependent flows (the report wizard) hang on "Loading…" in
  headless until permission is granted — the harness grants it + sets a default
  position. A blank/loading capture is usually an artifact, not a bug; confirm
  with the diag scripts.
- **Flaky 500s:** the shared dev server's webpack fs-cache can corrupt under
  concurrent recompiles (`reading 'call'` at `__webpack_require__`). Warm a route
  to 200 before capturing, or pin `webpack.cache=false` for CI/e2e runs.
