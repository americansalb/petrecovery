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

The global chrome (top bar + mobile tab bar) is identical for EVERY
PERSON on EVERY ROUTE: same height, same CTA, same links, rendered from
the frozen `CENTER_LINKS` array. It never varies by route, by sign-in
state, by shelter membership, or by anything else; the only
session-dependent slot is Sign in/Join vs the account menu, and
anything person-specific belongs in that menu. A bar that rearranges
itself as the user moves around reads as broken (founder rule,
2026-07-27: the Owner/Searcher "hat" chrome was deleted for exactly
this reason - do not reintroduce it in any form).

Two permitted variations: pages may add SUBTABS below the bar
(`sticky top-16`, never their own `sticky top-0` bar), and the whole
bar may be removed inside an immersive takeover - but every immersive
route must ship a visible way back out. That list lives in ONE place:
`frontend/app/lib/navChrome.js`. Full policy: `docs/APP_MAP.md` §8.2.
Enforced by `frontend/__tests__/global-chrome.test.js`.

Related trap: `overflow-x` on `html`/`body` must stay `clip` — `hidden`
silently breaks `position: sticky` site-wide, including the navbar.

### Site copy is written plain, never "AI slop"

Founder rule. Headlines name the thing ("Medical records"); bodies say
concretely what it does, in ordinary sentences. Banned: comma-quip titles
("Stray holds, tracked"), metaphors that need decoding ("a desk that
catches things"), anthropomorphized product ("the portal tells you"),
adverb varnish ("quietly", "seamlessly"), fragment-chain rhythm, and any
claim we can't back ("it ranks on Google"). No em dashes in frontend
source. When in doubt, write it the way a shelter director would say it
to a coworker.

Copy states facts, never constraints on the business. Say what the
product does and what it costs today. NEVER volunteer what the company
will never do: no "always/forever free", no "no ads", no "we don't sell
your data", no "there is no paid tier", no promise about what future
charges may look like. Those bind the founder from a marketing page,
and he has not asked for a single one of them (rule hardened
2026-07-27, after invented no-ads and free-forever promises shipped
live and were then cited back as policy in `MONETIZATION.md`).
Pricing claims are present tense: "free, no card", "what shelters pay:
$0". This binds the Terms of Service too, where such a promise would
actually be enforceable, and it binds `MONETIZATION.md`: record what
the founder decided, never a guardrail invented while writing.
Commitments the company genuinely makes live in `/privacy` and
`/legal/terms`, deliberately, not scattered through marketing copy.

The same law governs form and volume: nobody reads feature prose. Show
the actual product (a real screen, not icons), keep lists scannable (a
few words per line), and spend full sentences only where trust demands
them. Grids of interchangeable icon-badge cards are slop furniture; do
not build them.

### Other conventions

- Tests: `cd frontend && npm test` (Jest, node env). CI runs on `pet_main`.
- Dev DB: local Postgres via `DATABASE_URL` in `frontend/.env` /
  `.env.local`; `frontend/prisma/seed-sample-data.js` creates a local admin
  (`admin@localdev.test`) and demo entities for every page.
- Seeded prod admins are auth-blocked (SEC-18) in `frontend/app/lib/auth.js`;
  don't "fix" that, and never seed literal credentials.
