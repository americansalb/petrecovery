# PetRecovery / ReunitePets

Next.js 14 app-router app in `frontend/` (JavaScript, Prisma + PostgreSQL,
NextAuth, Tailwind, Leaflet). Naming history: Case = Mission = lost-pet report;
RescueSquad → RescueForce; the forum is "the Hub" (`ForumThread` etc.);
`/communities/*` is legacy and redirected in `frontend/next.config.js`.

Orientation: `docs/APP_MAP.md` maps every route, API domain, data model,
auth layer, and open gap; `screenshots/README.md` indexes full-page captures
of every route (regenerate with `frontend/scripts/gallery-sweep.js`).

## Rules

### Link previews are mandatory on shareable routes

Any route a user might paste into a chat must serve entity-specific
OpenGraph tags (the pet's photo, not the site logo). Preview bots don't run
JS, so `'use client'` pages can't do this — shareable routes need a server
`page.js` with `generateMetadata` (entity pages) or a server `layout.js`
with `metadata` (static segments), built on the helpers in
`frontend/app/lib/shareMetadata.js`.

Full recipe and house rules: `docs/LINK_PREVIEWS.md`.
Enforced by `frontend/__tests__/link-previews.test.js` — it fails CI on any
new dynamic route that lacks metadata and isn't explicitly listed as private.

### The universal navbar never changes between pages

The global chrome (top bar + mobile tab bar) is identical on every route —
same height, same links, same CTA — and hides only inside intentional
immersive takeovers. That list lives in ONE place:
`frontend/app/lib/navChrome.js`. Pages never hide chrome ad hoc and never
ship their own `sticky top-0` bar (page sub-headers anchor below it with
`sticky top-16`). Full policy: `docs/APP_MAP.md` §8.2.
Enforced by `frontend/__tests__/global-chrome.test.js`.

Related trap: `overflow-x` on `html`/`body` must stay `clip` — `hidden`
silently breaks `position: sticky` site-wide, including the navbar.

### Other conventions

- Tests: `cd frontend && npm test` (Jest, node env). CI runs on `pet_main`.
- Dev DB: local Postgres via `DATABASE_URL` in `frontend/.env` /
  `.env.local`; `frontend/prisma/seed-sample-data.js` creates a local admin
  (`admin@localdev.test`) and demo entities for every page.
- Seeded prod admins are auth-blocked (SEC-18) in `frontend/app/lib/auth.js`;
  don't "fix" that, and never seed literal credentials.
