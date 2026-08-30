<!--
  Generated 2026-07-03 by a multi-agent deep read of the codebase (8 subsystem
  readers + synthesis), then hand-verified on key claims. Companion artifacts:
  the full-page screenshot gallery in /screenshots (see its README.md) and the
  reproducible capture script frontend/scripts/gallery-sweep.js.
  Keep this file honest: when a route, model, or flow changes, fix the section
  that describes it — stale maps are worse than no maps.
-->

# PetRecovery App Map

Master knowledge map for `/home/user/petrecovery`. Next.js 14 app-router application in `frontend/` (JavaScript with a growing number of TypeScript routes, Prisma + PostgreSQL, NextAuth, Tailwind, Leaflet). Counts verified against the tree: **104 page files** under `frontend/app/**` (excluding `app/api`), **281 API route files** under `frontend/app/api/**`, one Prisma schema (~5,266 lines, 130+ models, 55 enums).

---

## 1. Product & Vision

ReunitePets (née PetRecovery.org) is a community-powered lost-pet recovery platform whose guiding principle is "give away everything that can be free; only monetize where there are real external costs" (`MASTER_VISION.md`, `MONETIZATION.md`). Its differentiator versus PawBoost/HomeAgain is **organized, coordinated physical search**: persistent city-level volunteer teams ("Rescue Forces", one per city, optionally split into neighborhood Divisions) accept Missions (lost-pet cases) and coordinate them through a search-and-rescue-grade Mission Control UI — live map, search-area marking, confidence-scored sightings, case chat, GPS tracking, gamified volunteer levels (`PROGRESS_SUMMARY.md`, `docs/SQUADS_DIVISIONS_AND_MISSIONS_VISION.md`, `REDESIGN_PLAN.md`).

The second strategic leg is the everyday pet profile — **"one record, two lives"**: the same profile that serves daily life (photos, medications, care team, routines — the "Health Book") becomes a pre-built rescue mission on the pet's worst day, a moat no vet app, tracker, or alert site can copy (`PET_PROFILE_DESIGN.md`, `docs/PRODUCT_IA_PLAN.md`, `docs/HEALTH_BOOK_V2_VISION.md`). Reach is amplified by automated, transparently-priced Facebook/Instagram/Google ads built from the profile (`ADFUND_*`, `AD_AUTOMATION_COMPLETE_SPEC.md`), and a Monte Carlo simulation engine predicts where the pet actually is to direct searchers (`EMERGENT_SIMULATION_PLAN.md`). Goal per `MONETIZATION.md`: "permanence, not profit."

**Monetization model** (v3, decided 2026-07-27, `MONETIZATION.md` — supersedes older specs): Free forever — everything that finds a pet (recovery, matching, alerts, community search), medication tracking incl. shared care teams (deliberately free where PetTimely charges $7.99/mo; it's the daily-habit funnel keeping recovery profiles accurate), and **the entire shelter portal** (roster, Health Book, stray-vs-lost matching, stray holds, adoption handoffs, inquiry inbox, team seats, public page — free-for-shelters is both mission and acquisition strategy). Planned paid (nothing built or gated today; payments build scheduled LAST): clearly-labeled **advertising to users** (new in v3 — v2 ruled ads out; no surface is excluded, shelter pages included, and no self-imposed guardrails belong here or in marketing copy unless the founder states them), a **paid shelter CRM tier** on top of the free portal (absorbs v2's $15/mo "Shelter Pro" subdomain/white-label), **AI-boosted lost-pet assistance** (auto-built social posts/ads from the pet's profile, flat $5 fee + ad spend at cost, auto-paused on found), and **paid notification boosts** — with relevance-triggered boosts (e.g. pet spotted near your home base) always free ("never price desperation"). This lineage replaced the earlier "December 2024"-stamped design (`MASTER_VISION.md`, `ADFUND_*`): 15% margin on crowdfunded ad spend ($5 min, $20 launch, LIFO refunds, 70/30 Meta/Google split, Stripe chargeback protection), reunion tips, and a $50–150/mo Shelter CRM projected to $20–65k/mo — fully specified but shelved.

**Built vs planned** (treat `ROADMAP.md` + `HANDOFF.md` as the latest word; note `VISION.md` (Nov 27 2025) says "~45% complete" while `ROADMAP.md` (same date) says "MVP Complete ~95%" — the docs contradict each other, and `MASTER_VISION.md` claims Stripe/push/SMS/GPS "✅ Built" which `ROADMAP.md` lists as future):

- **Built**: admin health dashboard (`/admin/health`), structured `EventLog` logging, ToS/waiver legal gating, roles/permissions, admin QA harness (`/admin/qa`), password reset, error boundaries, rate limiting + input validation + security event logging; mission CRUD + admin UI, public portal, email notifications, lost/found matching algorithm (`app/lib/matching.js` — weighted species/location/breed/color/timing), Bunny.net image upload, pet profiles, mobile responsiveness; Mission Control / coordination UI (squad chat, Leaflet search-area polygons, confidence-scored sightings, participant management); Rescue Force city search/create/join with Haversine radius; Division schema + request/approve/reject APIs + prioritized `my-feed` (UI, notifications, city seeding **not** built); 2026 sessions: cinematic landing page, rebuilt report wizard with working AI photo analysis, WCAG-AA on public pages, `/contact` `/privacy` `/terms`, SEC-18 seeded-admin auth block, medication tracker with AI label parsing, `PetShare` care-team sharing, `requirePetAccess` guard; standalone Monte Carlo simulator through Phase 3 (`frontend/SIMULATOR_PLAN.md`) plus a separate Python engine in `simulation/`.
- **Planned / not built**: all monetization machinery (AdFund crowdfunding, Meta/Google ad automation, post-reunion tips, Reddit bot, flyer PDF, Shelter CRM — `ADFUND_IMPLEMENTATION_PLAN.md` is "Draft – Awaiting Approval"; `LOST_PET_LANDING_PAGE_PLAN.md` flags the case page's $45/$100 ad-fund widget as **hardcoded/fake**); squad-hub/mission-control unification (`REDESIGN_PLAN.md` ends "Awaiting Your Approval"); single-screen Mission Control redesign; Rescue Readiness meter + sitter packet; "one home, two doors" IA; simulation Path B emergent-fields rewrite; simulator↔case calibration pipeline; multi-layer global terrain detection.

**Simulation subsystem purpose**: research-backed Monte Carlo lost-pet behavior simulator predicting *where a lost pet likely is*: thousands of runs generate probability zones/heatmaps, feed species/personality/terrain-aware recovery guidance, and (planned) self-calibrate against actual case outcomes. Two implementations: the JS engine in `frontend/` and a Python package in `simulation/` (based on Weiss 2012, Huang 2018, Kremer 2021, Albrecht protocols). Doctrinal tension to know about: `EMERGENT_SIMULATION_PLAN.md` (Path B) replaces magic probabilities with five interacting fields (population density from OSM, temporal activity, pet visibility, terrain visibility, lighting) with one calibration constant k tuned to Weiss 2012's 26% Good-Samaritan rate, while `SIMULATION_FIX_PLAN.md` *forbids calibrating to targets at all* ("whatever emerges IS the outcome"). Probability zones are already wired into Mission Control maps and radius math, which also underpins the ad-targeting spec.

---

## 2. Naming History

Net result today: **user-facing = ReunitePets / Rescue Forces / Missions / the Hub / Sarama; data layer still = `Case`, `RescueSquad` tables** (three overlapping vocabulary generations coexist).

| When (as documented) | Change | Source |
|---|---|---|
| Early design | Community system (Metro Areas → Counties → Subcommunities) designed, never fully implemented | `archived_legacy_docs/README.md` |
| ~Nov 2025 (schema redesign) | **RecoverySquad → RescueSquad**, **LostReport → Case**, **Sighting → CaseSighting**, **Comment → CaseUpdate**; `Subsquad` removed; new `CaseAssignment`/`CaseParticipant` junctions | `SCHEMA_REDESIGN.md`, `MIGRATION_PLAN.md`, `PROGRESS_SUMMARY.md` |
| 2025-11-20 | **Communities/Subcommunities → Rescue Squads + Divisions**; Community docs archived; legacy Community models kept as schema stubs | `DIVISION_IMPLEMENTATION_SUMMARY.md`, `RESCUE_SQUAD_DIVISION_SYSTEM.md` |
| Nov 25 2025 | Parallel mission vocabulary appears: `LostPetMission` model, `/missions` public portal, mission numbers `{CITY}-{YEAR}-{SEQ}` | `VISION.md`, `ROADMAP.md` |
| 2025-12-12 | **Case → Mission at the application layer only** (routes `/cases/*` → `/missions/*`, `caseId` → `missionId`); Prisma schema deliberately keeps `Case`; mascot **Surumaa → Sarama** (`/about-surumaa` → `/about-sarama`, `sarama@petrecovery.app`) | `docs/NAMING_STRATEGY.md` |
| ~Dec 2025 (docs stamped "December 2024") | Brand shifts **PetRecovery.org → ReunitePets** in specs | `ADFUND_COMPLETE_SPECIFICATION.md`, `DESIGN_PLAN.md` |
| (undated) | Forum becomes **"the Hub"** / Rescue Hub at `/hub` (`ForumThread` etc.); `/communities/*` becomes a legacy redirect | `docs/RESCUE_HUB_VERIFICATION.md`, `frontend/next.config.js`, `CLAUDE.md` |
| 2026-06-10 | **Rescue Squad → Rescue Force(s)** on all user-facing surfaces ("Rescue Squad" is PawBoost's trademark); `/rescue-squads*` 301s to `/rescue-forces*`, `/api/rescue-squads/*` rewrites to `/api/rescue-forces/*`; internal identifiers (DB tables `RescueSquad`, component names) deliberately deferred | `MONETIZATION.md` "Naming note", `frontend/next.config.js` lines 132–206 |

How the renames were physically executed (see §6 Data Model): the LostReport→Case generation was a real refactor; the RescueSquad→RescueForce generation is **Prisma-level only via `@@map`** (`RescueForce` → table `RescueSquad`, `RescueForceMember` → `RescueSquadMember`, enums mapped to `RescueSquadLevel`/`RescueSquadMemberRole`); the Case→Mission generation is a **field-level rename** (`missionId String @map("caseId")` on eight models) plus API/route naming.

---

## 3. Architecture Overview

- **Stack**: Next.js 14 app router in `frontend/`; mostly JavaScript with newer `.ts` API routes (the "Actions Guide" era: mission close/flyers/points/shelters/tips, analytics, users/me/points, webhooks/resend, places/search, simulate). Prisma + PostgreSQL; NextAuth (JWT strategy, no DB sessions); Tailwind; Leaflet 1.9.4 + react-leaflet 4.2.1 (+ leaflet-draw); framer-motion 12.23 (narrow use); recharts 3.6 (one consumer); lucide-react icons; Capacitor 6 native shell.
- **Deploy/runtime reality**: prod boots with `"start": "prisma db push --skip-generate && node prisma/sync-legal-docs.js && next start -p ${PORT:-3000}"` — schema sync is **push-based, no migrate deploy** (a separate unused `db:migrate` script exists). This single fact shapes multiple schema decisions (no new unique constraints on live tables; legacy columns kept so `db push` stays additive). Dev historically shares the **PROD** database (`HANDOFF.md` hazard: never write test users; never run `next build` while the dev server is up — shared `.next` corruption).
- **Middleware** (`frontend/middleware.js`) does: canonical-host 301 (`petrecovery.org` → `https://www.reunitepets.org`), bot-probe 404 fast path, health endpoints, per-IP in-memory API rate limiting, auth gates (`PROTECTED_ROUTES` = `/dashboard`, `/settings`, `/missions/new`, `/missions/edit`, `/rescue-forces/create`, `/admin`; `ADMIN_ROUTES` = `/admin`, `/api/admin` — verified at lines 43–58), CAPTCHA enforcement, and security headers.
- **`next.config.js` legacy 301s**: `/missions` and `/database` → `/lost-and-found`; `/communities` and `/communities/:path*` → `/rescue-forces/search`; `/report` → `/report/new`; `/terms` → `/legal/terms`; `/rescue-squads*` → `/rescue-forces*` (+ API rewrite).
- **Realtime**: SSE with in-memory connection maps in `app/lib/sse/*` (single-instance assumption) — `mission/[missionId]/stream` (public), `realtime/notifications` (session), `simulator/batch/stream`.
- **External integrations**: Anthropic Claude (Sarama chat wizard + `ai/*` vision/parsing on `claude-haiku-4-5`), Stripe (donations/rewards/subscriptions), Twilio (SMS + webhook), Resend (email + Svix-signed webhook, nodemailer/SMTP fallbacks), Bunny.net (uploads/CDN, brand assets on `petrescue.b-cdn.net`), Apple MapKit JS + Apple Maps Server API, OSM Nominatim/Overpass, CARTO/Esri tiles, Petfinder/RescueGroups, web-push VAPID, reCAPTCHA v2/v3, optional Redis for rate limiting/cache.
- **Mobile**: Capacitor remote-URL shell (`com.reunitepets.app` loads the live site); one mobile-specific endpoint `api/mobile/auth/login` mints a genuine NextAuth JWT so the whole API works unchanged.
- **Naming-driven namespace duplication to expect everywhere**: `missions/*` (Case CRUD/coordination) vs `mission/*` (Mission Control command center) vs `reports/*` (intake) vs legacy `squads/*` and `communities/*`; `push/*` vs `notifications/*`; `email/preferences` vs `user/email-preferences`; `sms/preferences` vs `user/sms-preferences`.

---

## 4. Route Inventory

104 page files under `frontend/app/**/page.{js,jsx,tsx}`. Auth legend: **none** = renders logged out; **logged-in** = redirected to `/login` (client `useSession` push, server `getServerSession` redirect, or middleware `PROTECTED_ROUTES`); **admin** = middleware requires JWT `role === 'ADMIN'` (non-admins get raw 403 JSON, not a redirect). "Server wrapper + client" = server `page.js` with `generateMetadata` rendering a `'use client'` inner component (the link-preview pattern, §10).

### Public / marketing

| route | purpose | client/server | auth | dynamic params & source |
|---|---|---|---|---|
| `/` | Homepage: report → Rescue Force → Mission story, live browse map | client | none | — |
| `/about` | "Meet Sarama" mascot/brand page | client | none | — |
| `/about-sarama` | Extended Sarama origin story (framer-motion) | client | none | — |
| `/advice` | Step-by-step lost-pet advice wizard (species/time/scenario → tips) | client | none | — |
| `/care` | Daily-care marketing door pitching the Health Book (signed-in members are redirected to `/pets`, the one dashboard) | server (static) + client gate | none | — |
| `/care/start` | THE add-a-pet wizard (guest-first + members; coat swatches, optional meds, member photo step); `/pets/new` 301s here | client | none | — |
| `/contact` | Contact/support page with quick-action cards | client | none | — |
| `/shelters` | Map-first shelter directory (DB shelters on first paint; filter + wider search via `/api/shelters/search`; near-me sort; claim lane) | server + client island | none | shelter-hat holders get an ADDITIONAL "My Shelter" → `/my-shelter` bar link (Building2) beside the directory link (MapPin); the two doors never merge. Tab bar only: portal takes the 4-slot shelter tab for staff, drawer keeps both rows |
| `/lost-and-found` | The "corkboard": browse lost/found/reunited cases, list or map | client | none | optional query: tab/species/search sync to URL |
| `/lost-pet/[location]` | SEO city landing page (cases + squads for a city) | server wrapper + client | none | `location` = `city-st` slug, e.g. `austin-tx`; parsed by `formatLocationSlug`, not DB-validated (cities from `app/lib/uscities.full.json`/`CityCache`) |
| `/offline` | PWA offline fallback screen | client | none | — |
| `/simulate` | Monte Carlo lost-pet behavior simulation with full-screen Leaflet map (`page.tsx`) | client | none | — |
| `/simulator` | Standalone Monte Carlo simulator: config, batch runs, playback, charts | client | none | — |

### Auth flows

| route | purpose | client/server | auth | dynamic params & source |
|---|---|---|---|---|
| `/login` | Credentials sign-in; static metadata in `login/layout.js` | client | none | `?callbackUrl=` honored |
| `/register` | Account signup (5-step wizard) | client | none | — |
| `/forgot-password` | Request password-reset email | client | none | — |
| `/reset-password` | Set new password from emailed link | client | none | requires `?token=`; errors without it |
| `/verify-email` | Verify email from emailed link | client | none | requires `?token=`; error state without it |
| `/legal/consent` | Accept ToS + Liability Waiver (`LegalDocument` slugs) | client | logged-in (redirect w/ `returnUrl`) | optional `?returnUrl=` |

### Pets (daily care product)

All `/pets/[id]/*` share the client shell `app/pets/[id]/layout.js` (breadcrumb + identity row + tabs: Overview / Today / Health Book / Care team; the edit and medication-wizard segments render in a "focused mode" with a context bar instead of tabs). The shell mounts `PetProvider` (`app/components/care/PetProvider.js`), which fetches `/api/pets/[id]` once and feeds identity + access to every room. `id` = `Pet.id` (cuid) owned by the session user (or shared via `PetShare` — care-team members browse the same shell since `GET /api/pets/[id]` reads via `requirePetAccess`).

| route | purpose | client/server | auth | dynamic params & source |
|---|---|---|---|---|
| `/pets` | THE pet dashboard (2026-07 care redesign): warm register, Today/Health Book quick chips per card, pending invites, shared-with-me | client | logged-in | — |
| `/pets/new` | **Unreachable**: `next.config.js` 301 → `/care/start` (the one wizard) | n/a | n/a | — |
| `/pets/[id]` | Pet overview tab | client | logged-in (redirect w/ callbackUrl) | `Pet.id` owned/shared |
| `/pets/[id]/edit` | Edit pet profile (weight read-only here; logged in the Health Book) | client | logged-in | `Pet.id` owned |
| `/pets/[id]/health` | Health Book: alert ribbon (medical notes), status band, vaccines, meds record, weight, vet card, unified history | client | logged-in | `Pet.id` owned/shared |
| `/pets/[id]/today` | Today checklist: the ONLY dose-action surface (scheduled + as-needed log/undo/backfill) + care routines | client | logged-in | `Pet.id` owned/shared |
| `/pets/[id]/share` | Care team: caretaker requests, roster, invites, view link (owner manages; caregivers get a read-only note) | client | logged-in | `Pet.id` owned |
| `/pets/[id]/medications/new` | Add/edit a medication (returns to `/health`) | client | logged-in | `Pet.id` owned; `?edit=` = `PetMedication.id` |
| `/pets/[id]/medications` | Redirect stub → `/pets/[id]/health` (management lives in the Book) | server (`redirect()`) | n/a | `Pet.id` |
| `/pets/[id]/care` | Redirect stub → `/pets/[id]/today` | server (`redirect()`) | n/a | `Pet.id` |
| `/pets/view/[token]` | Public read-only care page (share link for vets/sitters) | server wrapper + client | none | `token` = `Pet.publicViewToken` (min 16 chars, `isDeleted: false`) |

### Cases / Missions

| route | purpose | client/server | auth | dynamic params & source |
|---|---|---|---|---|
| `/cases/[caseNumber]` | Canonical public case landing page (hero, map preview, share, sighting CTA, owner mark-as-reunited) | server wrapper + client | none (owner extras when logged in) | `Case.caseNumber` (e.g. `"CHI-2024-001847"`) |
| `/mission-control` | Mission Control shell (command/bridge/field instruments over one map) | client | renders logged out, but `useMissionControl.fetchMission` bails without a session and `/api/missions/[id]` 401s → effectively logged-in to see a mission; waiver modal on 403 | `?mission=` (or `?caseId=`) = `Case.caseNumber` or `Case.id` |
| `/missions` | Legacy public case browser — **unreachable**: `next.config.js` 301 → `/lost-and-found` | client | none | query filters |
| `/missions/[missionNumber]` | OG permalink; client immediately redirects → `/mission-control?mission=…` | server wrapper + redirect client | none | `Case.caseNumber` or `Case.id` (`missionWhere` in `app/lib/shareMetadata.js`) |
| `/missions/[missionNumber]/coordinate` | Deprecated; client redirect → `/missions/[missionNumber]` | client | n/a | `Case.caseNumber` |
| `/missions/report` | Deprecated; server `redirect('/report/new')` | server | n/a | — |
| `/report/new` | Lost-pet report wizard (Apple MapKit location picker; inline account creation via `signIn`) | client | none | — |
| `/report/found` | Found-pet report wizard with MatchCard potential matches | client | none (prefills from session if present) | — |
| `/reports/[id]` | Legacy report permalink; OG tags then client resolves id → `/cases/[caseNumber]` | server wrapper + redirect client | none | `Case.id` (cuid) or `Case.caseNumber` |
| `/join/[missionId]` | Zero-friction volunteer join — no account, name + geolocation, deviceId in localStorage | server wrapper + client | none | `Case.id` or `Case.caseNumber` |
| `/sightings/report` | Report a sighting for a case | client | logged-in (redirect) | `?alertId=` = `Case.id` |
| `/database` | Legacy database browser — **unreachable**: 301 → `/lost-and-found` | client | none | — |
| `/found` | Server `redirect('/report/found')` | server | n/a | — |

### Alerts

| route | purpose | client/server | auth | dynamic params & source |
|---|---|---|---|---|
| `/alerts` | Nearby active mission alerts feed (`/api/public/missions`) | client | logged-in (redirect) | — |
| `/alerts/[id]` | Alert permalink (a Case) with details/sightings/updates tabs; OG card for SMS/email links | server wrapper + client (client redirects unauth) | logged-in | `Case.id` or `Case.caseNumber` |
| `/my-alerts` | Manage your own reports: mark found, close | client | logged-in (redirect) | — |

### Rescue Forces

| route | purpose | client/server | auth | dynamic params & source |
|---|---|---|---|---|
| `/rescue-forces` | Client redirect → `/rescue-forces/search` | client | n/a | — |
| `/rescue-forces/search` | Find your local Rescue Force by city/zip + radius | client | none | optional `?q=` (homepage deep-link) runs search on arrival |
| `/rescue-forces/create` | Create a Rescue Force | client | logged-in (middleware + client check) | — |
| `/rescue-forces/[id]` | Squad Hub — public squad profile/overview | server wrapper + client (`SquadPageClient`) | none | `RescueForce.id` (cuid, `isDeleted: false`) |
| `/rescue-forces/[id]/settings` | Squad settings & member management (FOUNDER/LEADER tools) | client | logged-in (redirect); squad-role gated in UI/API | `RescueForce.id` where session user is member |
| `/rescue-forces/[id]/divisions` | Division management for founders/leaders | client | no hard redirect; membership checked client-side, features gated | `RescueForce.id` |
| `/rescue-forces/[id]/divisions/[divisionId]` | Division page (SquadHubV2 scoped to division) | client | none (public hub API) | `RescueForce.id` + `Division.id` belonging to that force |
| `/rescue-forces/[id]/command-center` | Deprecated; client redirect → `/rescue-forces/[id]` | client | n/a | `RescueForce.id` |
| `/rescue-forces/[id]/mission-control` | Deprecated; client redirect → `/rescue-forces/[id]` | client | n/a | `RescueForce.id` |
| `/divisions/request` | Request a new division for a squad you belong to | client | logged-in (redirect) | — |

### Hub (forum)

Static segment card in `app/hub/layout.js`.

| route | purpose | client/server | auth | dynamic params & source |
|---|---|---|---|---|
| `/hub` | Forum home: categories, stats, who's online (phpBB-style) | client | none | — |
| `/hub/search` | Forum search results | client | none | needs `?q=` (empty otherwise); `?type=` filter |
| `/hub/new` | New thread form | client | logged-in (redirect `/login?redirect=/hub/new`) | optional `?category=` = `ForumCategory.slug` |
| `/hub/c/[slug]` | Category thread listing (`force-dynamic`) | server wrapper + client | none | `ForumCategory.slug` |
| `/hub/thread/[slug]` | Thread view with replies | server wrapper + client | none | `ForumThread.slug` (hidden threads get generic card) |
| `/hub/u/[id]` | Member profile (first name, reputation, posts; noindex) | server wrapper + client | none | `User.id` (= `ForumProfile.userId`) |

### Messaging & notifications

| route | purpose | client/server | auth | dynamic params & source |
|---|---|---|---|---|
| `/messages` | Conversation list (owner ↔ finder matches) | client | logged-in (redirect) | — |
| `/messages/[id]` | Conversation detail: chat, pet comparison, privacy, reunion confirm | client | logged-in (redirect w/ `?redirect=`) | `Conversation.id` where session user is a participant |
| `/notifications` | In-app notification center (`Notification` model) | client | logged-in (redirect) | — |

### Patrol

| route | purpose | client/server | auth | dynamic params & source |
|---|---|---|---|---|
| `/patrol/join` | Become a patrol volunteer: zip + radius map + waiver; inline account creation for guests | client | none | — |
| `/patrol/database` | Client redirect → `/database` (which itself 301s → `/lost-and-found`) | client | n/a | — |

### Dashboard / profile / settings

| route | purpose | client/server | auth | dynamic params & source |
|---|---|---|---|---|
| `/dashboard` | User dashboard: my missions, my forces, help nearby | client | logged-in (middleware + client) | — |
| `/profile` | User profile view/edit + sign out | client | logged-in (redirect) | — |
| `/settings` | Settings hub with tabs (`force-dynamic`) | client | logged-in (middleware + client) | optional tab query |
| `/settings/accounts` | Linked social accounts (Google/Facebook/Apple) | client | logged-in | — |
| `/settings/integrations` | Manage third-party integrations | client | logged-in | — |
| `/settings/notifications` | Notification preferences | client | logged-in | — |

### Shelter portal

| route | purpose | client/server | auth | dynamic params & source |
|---|---|---|---|---|
| `/my-shelter` (+ `/animals`, `/matches`, `/team`, `/site`) | THE shelter portal: hat-gated immersive takeover with its own sidebar chrome (`PortalShell`), overview stats, roster with intake/status, match review, team seats, public-page editor | **server** layout + pages (`requirePortal`, `force-dynamic`) | shelter hat required (claimer or ACTIVE `ShelterMember`); others redirect to `/shelter/dashboard` | — |
| `/shelter/dashboard` | Pre-portal surface: hat-holders REDIRECT to `/my-shelter`; shows seat-invite accept, application-under-review, or the get-started pitch. All legacy links land here and keep working | **server** (`force-dynamic`) | logged-in (server redirect) | — |
| `/for-shelters` | Public pitch page for free shelter accounts (features, how it works, why free) | server | public | — |
| `/shelter/start` | Shelter onboarding wizard, one decision per step (name, city autocomplete, dedupe pick, kind, role, inline account creation for guests via register `shelterRequest` ride-along); short-circuits to status screens for approved/pending users | server shell + client wizard | public (guests apply without a login wall) | — |
| `/shelter/claim` | Admin-invite accept page (`?token=`, one-time, 7-day expiry; accepting claims + activates the shelter) | server shell + client | logged-in (in-page login prompt with callback) | — |
| `/shelter/request` | REDIRECTS to `/shelter/start` (next.config); the old form is gone. The API `POST/GET /api/shelter/request` remains (wizard backend) | — | — | — |
| `/shelters/[id]` | Public shelter page: about/mission/images/socials (`ShelterProfile`), contact block, adoptable roster animals; only active + claimed shelters; indexed with `generateMetadata` | **server** | public | `id` → `Shelter.id` |
| `/pets/transfer/[token]` | Adoption-handoff accept page (emailed token; accept keyed to invited email) | server shell + client accept | logged-in (401 → in-page login prompt with callback) | `token` → `PetTransfer.token` |

### Rasuwa flood letter tool (2026-08)

| route | purpose | client/server | auth | dynamic params & source |
|---|---|---|---|---|
| `/rasuwa` (aliases `/nepal` + `/action`, next.config redirects; served at the ROOT of rescueourfamily.org via host-based rewrite once that domain is attached to the deployment) | Letter tool for families of people missing in the Aug 26, 2026 Rasuwa (Nepal) flood: pick/enter the missing person (57 prefills from the families' Aug 29 letter in `missing-people.json`), enter constituent details, find members of Congress (bundled `congress-directory.json`, refreshed via `scripts/build-congress-directory.js`; district via `/api/rasuwa/district`), generate per-recipient letters + phone script + client-side react-pdf PDF. Deliberately stateless: no DB models, entries never leave the browser (the district lookup address goes to the Census geocoder only). Immersive route (non-pet audience); footer links back to `/` | server layout/page + client tool | public | — |
| `/api/rasuwa/district` | Census geocoder proxy (no CORS upstream): address → `{state, district}`. No logging, no storage; rate-limited in middleware | route handler | public | — |

### Admin

All: middleware requires JWT + `role === 'ADMIN'` (non-admin gets raw 403 JSON); every page is `'use client'` with its own `useSession` check.

| route | purpose | dynamic params |
|---|---|---|
| `/admin` | Admin dashboard hub | — |
| `/admin/analytics` | Analytics dashboard with charts (hand-rolled `SimpleLineChart`, not recharts) | — |
| `/admin/auto-migrate` | One-click DB migration runner | — |
| `/admin/check-config` | Service config check (Bunny.net etc.) | — |
| `/admin/communities` / `/admin/communities/create` | Legacy `Community` management / creation | — |
| `/admin/divisions` / `/admin/divisions/create` / `/admin/divisions/requests` | Division management, creation (leaflet-draw polygon editor), request review | — |
| `/admin/health` | Platform health/observability dashboard (`page.jsx`) | — |
| `/admin/missions` / `/admin/missions/new` / `/admin/missions/[missionId]` | Case admin list / create / detail editor | `Case.id` (NB: client reads `params.id` though the folder is `[missionId]`) |
| `/admin/pets` / `/admin/pets/[id]` | Pet admin list / detail | `Pet.id` |
| `/admin/prisma` | Regenerate Prisma client button | — |
| `/admin/qa` | QA harness: smoke tests + test-data generation | — |
| `/admin/rescue-forces` / `/admin/rescue-forces/create` | Rescue Force admin list / create | — |
| `/admin/shelters` / `/admin/shelters/requests` | Shelter admin list / claim-request review (`ShelterClaim`) | — |
| `/admin/users` / `/admin/users/[id]` | User admin list / detail | `User.id` |
| `/admin/wipe-squads` | Destructive squad wipe (double confirm + type YES) | — |

### Legal

| route | purpose | client/server | auth |
|---|---|---|---|
| `/legal/terms` | Terms of Service (canonical; `/terms` 301s here) | server (static) | none |
| `/privacy` | Privacy policy | server (static) | none |

### Legacy communities (all **unreachable**: `next.config.js` 301s `/communities` and `/communities/:path*` → `/rescue-forces/search`)

| route | purpose | auth | params |
|---|---|---|---|
| `/communities` | Legacy community list | none | — |
| `/communities/[id]` | Legacy community detail/join | none (join needs session) | `Community.id` |
| `/communities/my-requests` | User's community requests | logged-in | — |
| `/communities/request` | Request a new community (`CommunityRequest`) | logged-in | — |

### Route gotchas (screenshots / crawling)

- **Dead-on-arrival via `next.config.js` 301s** (never reachable at their own path): `/missions`, `/database`, `/communities`, `/communities/*`, `/report` → `/report/new`, `/terms` → `/legal/terms`, `/rescue-squads*` → `/rescue-forces*`. Middleware also 301s `petrecovery.org` hosts → `www.reunitepets.org`.
- **In-page redirect stubs** (only a spinner is visible): server `redirect()` (instant): `/found`, `/missions/report`, `/pets/[id]/care`, `/pets/[id]/medications`; client `useEffect` (brief flash): `/patrol/database`, `/rescue-forces`, `/rescue-forces/[id]/command-center`, `/rescue-forces/[id]/mission-control`, `/missions/[missionNumber]` (→ `/mission-control?mission=`), `/missions/[missionNumber]/coordinate`, `/reports/[id]`.
- **Query strings required**: `/mission-control?mission=<Case.caseNumber>`, `/sightings/report?alertId=<Case.id>`, `/reset-password?token=`, `/verify-email?token=`, `/hub/search?q=`, `/rescue-forces/search?q=`, `/pets/[id]/medications/new?edit=<PetMedication.id>`.
- **Logged out**: most protected client pages render `null`/spinner then bounce to `/login` after hydration; `/shelter/dashboard` redirects server-side; `/admin/*` logged-in-but-not-admin shows **raw 403 JSON** from middleware. Some redirects omit `callbackUrl` (`/alerts`, `/profile`, `/dashboard`); two use nonstandard `?redirect=` (`/hub/new`, `/shelter/request`).
- **Auth hidden behind APIs**: `/mission-control` renders its shell logged out but can't load a mission (API 401 / waiver 403 modal); `/hub/new` bounces only after session resolves.

---

## 5. API Surface

**281 route files** under `frontend/app/api/**` (`route.js`/`route.ts`; the `.ts` files are the newer "Actions Guide" era). 224 files reference NextAuth session auth; 57 do not (public, token-capability, webhook, or dev/simulator routes).

**Auth legend**: `session` = `getServerSession(authOptions)`; `admin` = session + in-handler ADMIN role check (sensitive ones re-read role fresh from DB via `isAdmin()` in `app/lib/authz.js`); `pet-access(L)` = `requirePetAccess(petId, level)` from `app/lib/petOwnership.js` (VIEWER < CAREGIVER < OWNER; strangers get 404, not 403); `token` = capability token in URL; `public` = no auth. Paths relative to `frontend/app/api/`.

### Auth & account

| Route | Methods | Purpose | Auth | Models |
|---|---|---|---|---|
| `auth/[...nextauth]/route.js` | GET, POST | NextAuth handler (`authOptions` from `app/lib/auth.js`; SEC-18 seeded-admin block lives there) | public | user (via authorize) |
| `auth/register/route.js` | POST | Account creation + verification email | public; middleware 5/min + lib rate limit + CAPTCHA route (both dead in middleware — see §7) | user |
| `auth/forgot-password/route.js` | POST | Issue password-reset token/email | public, rate-limited | user |
| `auth/reset-password/route.js` | POST | Reset password by token | public, rate-limited | user |
| `auth/verify-email/route.js` | GET, POST | Verify email token / resend | public, rate-limited | user |
| `mobile/auth/login/route.js` | POST | **Capacitor mobile login bridge**: validates credentials like the credentials provider, then mints a real NextAuth JWT with `next-auth/jwt.encode` so the native app sends it as the session cookie. Mirrors SEC-18 block ("keep in lockstep" comment) | public; middleware 10/min | user |
| `profile/route.js` | GET, PATCH | Own profile read/update | session | user, rescueForceMember |
| `user/linked-accounts/route.js` | GET, DELETE | OAuth linked accounts | session | account, user |
| `users/[id]/profile/route.js` | GET | Public user profile + stats | **public** | user, case, caseSighting |
| `legal/accept/route.js`, `legal/accept-waiver/route.js` | POST | Record ToS/waiver acceptance | session | legalDocument, user |
| `legal/documents/route.js`, `legal/documents/[slug]/route.js` | GET | Serve legal docs | public | legalDocument |

### Pets & medications

| Route | Methods | Purpose | Auth | Models |
|---|---|---|---|---|
| `pets/route.js` | GET, POST | List my/shared pets; create pet | session | pet, petShare, user |
| `pets/[id]/route.js` | GET, PATCH, DELETE | Pet detail / edit / soft-delete | GET: pet-access(VIEWER) returning `{pet, access}`; PATCH/DELETE: owner | pet, case, user |
| `pets/[id]/medications/route.js` | GET, POST | List (+35-day dose history) / add medication | pet-access(VIEWER/CAREGIVER) | petMedication (+ medicationAudit lib) |
| `pets/[id]/medications/[medId]/route.js` | PATCH, DELETE | Edit / soft-delete medication | pet-access | petMedication |
| `pets/[id]/medications/[medId]/doses/route.js` | POST, DELETE | Log / undo a dose | pet-access(CAREGIVER) | medicationDose, petMedication |
| `pets/[id]/medications/export/route.js` | GET | Export medication history | pet-access | petMedication, medicationAuditLog |
| `pets/[id]/vaccinations/route.js` | GET, POST, DELETE | Vaccination records | pet-access | petVaccination |
| `pets/[id]/weights/route.js` | GET, POST, DELETE | Weight tracking | pet-access | petWeightEntry |
| `pets/[id]/share-link/route.js` | GET, POST, DELETE | Manage the public care-view token link (POST = enable/rotate via `crypto.randomBytes(24).toString('base64url')`) | pet-access(OWNER) | pet |
| `pets/[id]/shares/route.js` | GET, POST | List/invite caregivers/viewers | pet-access(OWNER) | petShare, user |
| `pets/[id]/shares/[shareId]/route.js` | PATCH, DELETE | Change share role / revoke | session | petShare, user |
| `pets/view/[token]/route.js` | GET | **Public read-only pet care view** (no account); no contact info, no pet id; owner first name only | token (≥16 chars), rate-limited | pet, petMedication, petVaccination, petWeightEntry |
| `pets/view/[token]/request/route.js` | POST | Token holder requests linked access (inline account creation; resulting `PetShare` is REQUESTED, zero access until owner approves) | token, rate-limited | pet, petShare, user |

### Cases / Missions

**`missions/*` (case CRUD + coordination):**

| Route | Methods | Purpose | Auth | Models |
|---|---|---|---|---|
| `missions/route.js` | GET, POST | Browse/list cases; create (CAPTCHA middleware route) | GET session-optional; POST session | case |
| `missions/[missionId]/route.js` | GET, DELETE | Case detail / delete | session | case, user |
| `missions/[missionId]/assign-coordinator/route.js` | POST | Assign coordinator | session | case |
| `missions/[missionId]/assign-squad/route.js` | GET, POST, DELETE | Squad assignment CRUD | session | case, caseAssignment, rescueForce |
| `missions/[missionId]/assignments/route.js` | GET, POST | Assignments per case | session | case, caseAssignment, rescueForce(+Member) |
| `missions/[missionId]/chat/route.js` | GET, POST | Per-mission chat | session | case, rescueForce, squadActivity, user |
| `missions/[missionId]/coordinate/route.js` | GET | Coordination overview | session | case |
| `missions/[missionId]/coverage/route.js` | GET | Search coverage from sessions | session | case, searchSession, user |
| `missions/[missionId]/matches/route.js` | GET, POST | Shelter-intake match candidates | session | case, shelterMatch |
| `missions/[missionId]/notes/route.js` | POST, GET | Case notes | session | case, caseUpdate |
| `missions/[missionId]/pois/route.js` | GET | Nearby POIs/shelters | session | case, shelter |
| `missions/[missionId]/search-areas/route.js` | POST, GET | Search-area management | session | case, caseAssignment, caseUpdate, searchArea |
| `missions/[missionId]/share/route.js` | POST | Record a share + notify owner | session | case, notification, shareEvent |
| `missions/[missionId]/share-stats/route.js` | GET | Share counts | **public** | case, shareEvent |
| `missions/[missionId]/sightings/route.js` | GET, POST | Case sightings | session | case, caseSighting, caseUpdate |
| `missions/[missionId]/status/route.js` | POST | Change case status | session | case, missionControl |
| `missions/[missionId]/tasks/route.js` | GET, POST | Case squad-tasks | session | case, caseUpdate, rescueForceMember, squadTask |
| `missions/bulk/route.js` | POST | Bulk case operations | session | case |
| `missions/my-feed/route.js` | GET | Feed from my squads' assigned cases | session | caseAssignment, rescueForceMember |
| `missions/my-missions/route.js` | GET | My reported cases | session | case |
| `missions/priority/route.js` | GET, POST | Priority scoring | session | case |

**`mission/*` (Mission Control command center — note singular vs plural namespace split):**

| Route | Methods | Purpose | Auth | Models |
|---|---|---|---|---|
| `mission/[missionId]/route.js` | GET, POST | Mission-control state / activate (exposes exact coords + live GPS, so authed) | session | missionControl via `app/lib/missionControl/*` |
| `mission/[missionId]/command/route.js` | GET, POST | Command-center operations | session + `userHasCaseAuthority` (authz.js) | missionControl |
| `mission/[missionId]/close/route.ts` | POST, GET | Close mission with outcome | session | case, user |
| `mission/[missionId]/flyers/route.ts` | GET, POST | Flyer-posting tracking (verified actions) | session | case, flyerPosting, user |
| `mission/[missionId]/flyers/generate/route.ts` | POST | Generate flyer (lib/flyerGenerator) | session | case |
| `mission/[missionId]/owner/route.js` | GET, POST | Owner presence/updates | session | missionControl |
| `mission/[missionId]/points/route.ts` | GET | Mission points summary | session | case, user, verifiedAction |
| `mission/[missionId]/points/leaderboard/route.js` | GET | Mission leaderboard | session | user, verifiedAction |
| `mission/[missionId]/search/route.js` | POST, GET | Live search sessions + GPS location pings | session | case, caseParticipant, locationPing, searchSession, user |
| `mission/[missionId]/shelters/route.ts` | GET, POST | Shelter-contact checklist | session | case, shelterContact |
| `mission/[missionId]/shelters/[shelterId]/route.ts` | GET, POST | Log shelter contact attempt | session | case, shelterContact, user |
| `mission/[missionId]/sighting/route.js` | GET, POST | Mission-control sightings | session | missionControl, missionSighting |
| `mission/[missionId]/stream/route.js` | GET | **SSE stream** of live mission updates (volunteer movements, zones, sightings) | **public — no auth** | missionControl + in-memory `app/lib/sse/missionStream` |
| `mission/[missionId]/tasks/route.js`, `.../tasks/[taskId]/route.js` | GET; GET, POST | Task list; verify/complete task | session | squadTask, flyerPosting, searchSession, taskParticipant, case, user |
| `mission/[missionId]/tips/route.ts`, `.../tips/[tipId]/route.ts` | GET, POST; POST, DELETE | Mascot (Sarama) tips per mission | session | mascotTip, case, user |
| `mission/[missionId]/volunteer/route.js` | POST, PATCH | Join/update mission volunteering | session | missionControl |

**`assignments/*`, `search/*`, `tasks/*`:**

| Route | Methods | Purpose | Auth | Models |
|---|---|---|---|---|
| `assignments/[id]/messages/route.js` | GET, POST | Assignment chat | session | caseAssignment, squadMessage |
| `assignments/[id]/participants/route.js` | GET, POST, DELETE | Assignment participants | session | caseAssignment, caseParticipant, rescueForceMember, user |
| `assignments/[id]/search-areas/route.js` | GET, POST | Search areas per assignment | session | searchArea, rescueForce(+Member), caseParticipant |
| `assignments/[id]/sessions/route.js`, `.../[sessionId]/route.js` | GET, POST; GET, PATCH | Search-session tracking | session | searchSession, caseParticipant, caseUpdate |
| `assignments/[id]/sightings/route.js` | GET, POST | Sightings within an assignment | session | petSpotting, squadMessage, case, caseAssignment |
| `search/[caseId]/field/route.js` | GET, POST | Field-ops (lib/volunteer) | session | (lib) |
| `search/[caseId]/grid/route.js` | GET, POST | Grid search assignments | session | (lib) |
| `search/[caseId]/live/route.js` | GET | Live-ops dashboard poll (positions/stats) | **no auth** | `app/lib/volunteer/liveOps` |
| `tasks/definitions/route.js` | GET | Static task catalog | public | none |
| `tasks/[id]/route.js` | GET, PATCH, DELETE | Squad-task CRUD | session | squadTask, caseUpdate, rescueForceMember |
| `tasks/[id]/claim/route.js`, `tasks/[id]/complete/route.js` | POST | Claim / complete a task | session | squadTask, squadActivity, rescueForceMember |
| `tasks/log/route.js` | POST | Log task action | session | caseUpdate |

**Report intake, follows, misc case:**

| Route | Methods | Purpose | Auth | Models |
|---|---|---|---|---|
| `reports/create/route.js` | POST | **Main lost-pet report intake** — anonymous allowed: creates a user account (bcrypt temp password + verification email); CAPTCHA middleware route; `maxDuration=30` for base64 images | session-optional | case, user, alert, rescueForce, caseAssignment, squadPost |
| `reports/found-pet/route.js` | POST | Found-pet intake + auto-matching (`lib/matching`), also creates accounts for anon finders | session-optional | case, pet, alert, patrolProfile, user, userProfile |
| `reports/found/route.js` | POST | Authenticated found report | session | case, user |
| `reports/[id]/route.js` | GET | Report detail | session | case |
| `reports/dashboard/route.js` | GET, POST | Reporting dashboards (`app/lib/reporting`) | session | (lib) |
| `follow/route.js` | GET, POST, DELETE | Follow/unfollow a case | session | case, caseFollow |
| `success-stories/route.js` | GET, POST | Reunion stories | GET public-ish, POST session | case, successStory |
| `database/route.js` | GET | Public searchable lost/found database | session-optional | case |
| `dashboard/route.js` | GET | User dashboard aggregate | session | case, caseAssignment, caseSighting, missionControl, searchSession, user |
| `activity/feed/route.js` | GET | Personalized activity feed | session | case, caseFollow, caseSighting, caseUpdate, rescueForceMember, squadActivity, userProfile |

### Sightings & anonymous match relay

| Route | Methods | Purpose | Auth | Models |
|---|---|---|---|---|
| `sightings/route.js` | POST | Report a pet sighting (notifies owner) | session, lib rate-limited | case, caseSighting, sighting |
| `relay/[token]/route.js` | POST, GET | **Anonymous finder↔owner relay thread**; hard privacy contract — no phone/email/exact coords below MUTUAL_OPTIN | capability token, rate-limited | matchConnection |
| `relay/[token]/messages/route.js` | POST | Send relay message | token, rate-limited | matchConnection, relayMessage |
| `location/nearby-cases/route.js` | GET | Nearby cases (geofence lib) | session | (lib) |
| `location/update/route.js` | POST | Update user location → geofence alert triggers | session | (lib geofence) |

### Rescue Forces (née RescueSquad)

`rescue-forces/route.js` — GET (directory list; session-optional), POST (create; session). All `[id]` sub-routes are session + membership/leader checks via `rescueForceMember` unless noted. Models predominantly rescueForce, rescueForceMember, squadActivity, squadTask, squadPost, squadMembership, caseAssignment.

| Route | Methods | Purpose |
|---|---|---|
| `rescue-forces/[id]/route.js` | GET, PATCH | Force detail / settings |
| `.../join`, `.../leave`, `.../toggle-duty`, `.../claim-leadership` | POST | Membership lifecycle, on/off duty, claim leaderless squad |
| `.../members/route.js`, `.../members/[memberId]/route.js` | GET; PATCH, DELETE | Roster; role change / remove (writes eventLog) |
| `.../active-missions`, `.../available-missions`, `.../nearby-missions` | GET | Mission feeds for the squad |
| `.../live-missions/route.js` | GET | Active Mission Control ops for squad cases — **no auth check** (public) |
| `.../missions/[missionId]/help/route.js` | POST, DELETE | Volunteer for / withdraw from a squad mission |
| `.../activities`, `.../announcements` | GET; GET, POST | Activity feed; announcements (squadActivity) |
| `.../broadcast/route.js` | POST | Broadcast to squad (missionBroadcast, squadMembership) |
| `.../chat/route.js` | GET, POST | Squad chat |
| `.../posts/route.js`, `.../posts/[postId]/comments`, `.../posts/[postId]/vote`, `.../comments/[commentId]/vote` | GET/POST | Squad feed posts, comments, voting (squadPost, squadPostComment, squadPostVote, squadCommentVote) |
| `.../requests/route.js`, `.../requests/[requestId]/help/route.js` | POST; POST, DELETE, PATCH | Help-request tasks (squadTask) |
| `.../tasks/route.js` | GET, POST | Squad tasks |
| `.../photo/route.js` | POST | Squad photo upload |
| `.../hub/route.js` | GET | Aggregated squad hub dashboard |
| `.../divisions/route.js`, `.../divisions/[divisionId]/route.js` | GET, POST; GET, PATCH, DELETE | Division CRUD within a force |
| `.../divisions/[divisionId]/members/route.js`, `.../members/[memberId]/route.js` | GET, POST; DELETE | Division rosters (squadMembership) |
| `.../divisions/[divisionId]/missions/route.js` | GET | Division mission list — **no auth check** |
| `.../my-division/route.js` | PATCH, GET | My division membership |
| `squads/[squadId]/leadership/route.js` | GET, POST | **Legacy "squads" naming** — leadership dashboard actions (approve/reject joins, roles, divisions, broadcast) via `app/lib/volunteer/leadership`; session |

### Divisions, communities (legacy), cities

| Route | Methods | Purpose | Auth | Models |
|---|---|---|---|---|
| `divisions/request/route.js` | POST, GET | Request creation of a division | session | divisionRequest, division, rescueForce(+Member) |
| `communities/route.js`, `communities/[id]/route.js`, `.../members` | GET | Legacy community directory/detail/members (pages redirect but API remains) | session | community, communityMember |
| `communities/[id]/join`, `communities/[id]/leave` | POST | Join/leave community | session | community, communityMember, user |
| `communities/request/route.js`, `communities/requests/route.js`, `communities/requests/[id]/route.js` | POST; GET; GET | Community creation requests | session, rate-limited | communityRequest, community, user |
| `cities/request/route.js` | POST, GET | Request a new city | session, rate-limited | cityRequest |
| `cities/suggest/route.js` | GET | City autocomplete from bundled JSON (`app/lib/*cities.json`) | public | none |

### Hub / forum (`Forum*` models)

| Route | Methods | Purpose | Auth |
|---|---|---|---|
| `hub/categories/route.js` | GET | Category list + counts | public |
| `hub/threads/route.js` | GET, POST | Thread list / create | GET public, POST session |
| `hub/threads/[slug]/route.js` | GET, PATCH | Thread + posts / edit-lock-pin | GET public, PATCH session/mod |
| `hub/posts/route.js` | POST | Reply (forumPost, mentions → forumNotification) | session |
| `hub/posts/[id]/route.js` | PATCH | Edit/moderate a post (forumModAction) | session/mod |
| `hub/posts/[id]/reactions/route.js` | POST, DELETE | React/unreact (forumReaction) | session |
| `hub/bookmarks/route.js` | GET, POST, DELETE | Thread bookmarks (forumBookmark) | session |
| `hub/mod/route.js` | POST, GET | Moderation actions/log (forumModAction) | session + mod |
| `hub/online/route.js` | GET, POST | Presence heartbeat (forumProfile.lastSeen) | GET public, POST session |
| `hub/profile/[id]/route.js` | GET | Forum profile + badges (badge, userBadge, shelterProfile) | public |
| `hub/search/route.js` | GET | Search threads/posts | **public** |
| `hub/stats/route.js` | GET | Forum-wide stats | public |

### Messages (DMs)

| Route | Methods | Purpose | Auth | Models |
|---|---|---|---|---|
| `conversations/route.js` | POST, GET | Start conversation / list mine | session | conversation, directMessage, case, user |
| `conversations/[id]/route.js` | GET, PATCH | Thread detail / archive-read state | session (participant) | conversation, directMessage |
| `conversations/[id]/messages/route.js` | POST, GET | Send / paginate messages | session, lib rate-limited | conversation, directMessage |

### Alerts, notifications, push, SMS, email

| Route | Methods | Purpose | Auth | Models |
|---|---|---|---|---|
| `notifications/route.js` | GET, POST | In-app notifications list/create | session | notification, user |
| `notifications/[id]/route.js` | PATCH, DELETE | Mark read / delete | session | notification |
| `notifications/read-all/route.js` | POST | Mark all read | session | notification |
| `notifications/send/route.js` | POST | Targeted web-push fan-out to mission/squad audiences | session + `authz.js` (`isAdmin`/`userHasCaseAuthority`/`userIsSquadLeader`) | pushSubscription, missionControl, squadMembership, rescueForceMember, case |
| `notifications/subscribe/route.js` | POST, DELETE | Web-push subscription mgmt | session | pushSubscription |
| `push/subscribe/route.js` | GET, POST, DELETE | Push subscription (alt namespace) | session | pushSubscription |
| `push/unsubscribe/route.js` | POST | Unsubscribe | session | — |
| `push/send/route.js` | POST | Send push (templates) | admin | pushSubscription, pushNotificationLog |
| `push/vapid-key/route.js` | GET | Public VAPID key | public | none |
| `realtime/notifications/route.js` | GET | **SSE** per-user notification stream (in-memory `app/lib/sse/notifications`) | session | — |
| `sms/send/route.js` | POST | Send SMS via Twilio (templates) | admin | smsLog |
| `sms/send-verification/route.js` | POST | Send phone-verification code | session | (lib) |
| `sms/verify/route.js` | POST, PUT | Verify code / confirm | session | phoneVerification |
| `sms/preferences/route.js` | GET, PATCH | SMS prefs | session | smsPreference |
| `user/sms-preferences/route.js` | GET, PUT, DELETE | SMS prefs + phone unlink (alt namespace) | session | smsPreference, phoneVerification |
| `email/preferences/route.js` | GET, PATCH | Email prefs | session | emailPreference |
| `user/email-preferences/route.js` | GET, PUT | Email prefs (alt namespace) | session | emailPreference |
| `unsubscribe/[token]/route.js` | GET, POST | One-click email unsubscribe | token, public | emailPreference |

### Webhooks (inbound, signature-verified)

| Route | Methods | Purpose | Auth | Models |
|---|---|---|---|---|
| `webhooks/resend/route.ts` | POST, GET | Resend email events (delivered/opened/bounced…) feeding the verified-actions pipeline (`lib/actions/verificationService`); GET = health check | Svix-style HMAC-SHA256 over `svix-id.svix-timestamp.body` with `RESEND_WEBHOOK_SECRET` — **verification skipped with a warn if secret unset** | shelterContact, shelterContactAttempt, verifiedAction |
| `webhooks/twilio/route.js` | POST | Twilio delivery status + inbound replies incl. STOP opt-out | `twilio.validateRequest` signature — **skipped if `TWILIO_AUTH_TOKEN`/`TWILIO_WEBHOOK_URL` unconfigured** | smsLog, smsPreference |

### Admin

All under middleware `ADMIN_ROUTES` gate (`/api/admin` requires ADMIN JWT via `getToken`) plus per-handler checks; the dangerous ones re-check role fresh from DB (`isAdmin()` in `authz.js`, per the SEC-18 stale-JWT rationale).

| Route | Methods | Purpose | Models |
|---|---|---|---|
| `admin/users/route.js`, `admin/users/[id]/route.js` | GET; GET, PATCH, DELETE | User management (role/level edits, delete w/ eventLog) | user, eventLog |
| `admin/pets/route.js`, `admin/pets/[id]/route.js` | GET, DELETE; GET | Pet oversight | pet, case, user |
| `admin/rescue-forces/route.js`, `admin/rescue-forces/[id]/route.js` | GET; DELETE | Force oversight / delete | rescueForce, division, caseAssignment |
| `admin/divisions/route.js`, `admin/divisions/[id]/route.js` | GET, POST; PATCH, DELETE | Division admin | division, rescueForce(+Member) |
| `admin/divisions/requests/route.js`, `.../approve/[requestId]`, `.../reject/[requestId]` | GET; POST; POST | Division request queue | divisionRequest, user |
| `admin/communities/create/route.js`, `admin/communities/requests/*` | POST; GET, POST(approve/reject) | Legacy community admin | community, communityRequest, communityMember |
| `admin/shelters/route.js`, `admin/shelters/[id]/route.js` | GET, DELETE; DELETE, GET, PATCH | Shelter records admin | shelter, cityCache |
| `admin/shelters/approve/route.js`, `.../invite/route.js`, `.../requests/route.js`, `.../sync/route.js` | POST; POST; GET; POST | Shelter claim approval / invites / sync | shelter, shelterClaim, shelterProfile, user |
| `admin/analytics/route.js`, `admin/analytics/export/route.js` | GET | Admin analytics + CSV export | (lib) |
| `admin/health/summary`, `admin/health/metrics`, `admin/health/errors`, `admin/health/errors/[eventType]/[errorCode]/samples` | GET | Ops health dashboards over eventLog | eventLog, user, case, rescueForce |
| `admin/health/test-email/route.js`, `admin/health/test-geocode/route.js` | POST | Fire test email / geocode probe | — |
| `admin/moderation/route.js` | GET, POST | Moderation queue/actions (also admits MODERATOR) | user (+ lib moderation) |
| `admin/report-log/route.js` | GET | Report intake log | case, user |
| `admin/bulk/route.js` | POST | Bulk data operations (middleware 5/min) | case, pet, user, eventLog, searchArea, rescueForceMember |
| `admin/migrate/route.js` | POST | **Runs raw DDL** (`$executeRawUnsafe ALTER TABLE …`) for emergency migrations — fresh-DB admin check | (raw SQL) |
| `admin/prisma-generate/route.js` | POST | Trigger prisma generate on the server | — |
| `admin/check-config/route.js` | GET | Env/config status incl. Bunny.net credential prefixes — fresh-DB admin check | — |
| `admin/cleanup-sessions/route.js` | GET | Force-complete stuck search sessions (manual maintenance; no cron secret — GET with admin session) | searchSession |
| `admin/seed-welcome/route.js` | POST | Seed welcome content | rescueForce, squadActivity, user |
| `admin/wipe-squads/route.js` | POST | Destructive squad data wipe | rescueForce(+Member), division, caseAssignment, caseParticipant |
| `admin/qa/log-test/route.js` | POST | Admin QA harness event logging (`qa.*` eventLog types) | (lib logging) |

### Shelters & places

| Route | Methods | Purpose | Auth | Models |
|---|---|---|---|---|
| `shelter/request/route.js` | POST, GET | Shelter claim/verification request | session | shelter, shelterClaim, shelterProfile, user |
| `shelters/search/route.js` | GET | DB shelter search | public | shelter |
| `shelters/animals/route.js` | GET | Proxy search of **Petfinder / RescueGroups** animals | **public** | (external via `app/lib/shelterApi`) |
| `shelters/fetch/route.js` | POST, GET | Import shelters from **Apple MapKit / Petfinder** into DB | ADMIN (in-handler check) | shelter |
| `shelters/enrich/route.js` | POST | Enrich shelter records | **no session check** | shelter |
| `shelters/match/route.js` | GET | Match a case against shelter intakes | session | case |
| `places/search/route.ts` | GET, POST | Place search: DB city-cache (60-day) → Apple Maps Server API → OSM Overpass fallback | session | cache via `app/lib/maps/shelterCacheService` |

### Uploads

| Route | Methods | Purpose | Auth |
|---|---|---|---|
| `upload/route.js` | POST, DELETE | Image upload to **Bunny.net Storage/CDN** (contexts: pet/sighting/chat); DELETE checks ownership via case/pet or admin | session + lib rate limit |

### AI

| Route | Methods | Purpose | Auth | Notes |
|---|---|---|---|---|
| `sarama/route.js` | POST | **"Sarama" AI guide** — Anthropic Claude Haiku (`claude-haiku-4-5`) chat wizard walking users through lost-pet report creation (quick replies, `[WIZARD_COMPLETE]` protocol) | **public**; needs `ANTHROPIC_API_KEY` | no DB |
| `ai/analyze-pet/route.js` | POST | Claude Haiku **vision** analysis of pet photo (species/color/size/breed) | **public by design** (finder funnel): SSRF guard (imageUrl must be on own Bunny CDN allowlist), Redis-backed rate limit + global spend cap, size/media-type caps, output clamped to Prisma enums | no DB |
| `ai/parse-medication/route.js` | POST | AI parse of medication label/instructions | session, rate-limited | no DB |
| `ai/match/route.js` | POST | AI lost↔shelter-intake matching | session | case, shelterIntake |
| `ai/recognize/route.js` | POST | Image recognition | session | — |
| `ai/route-plan/route.js` | POST | AI search-route planning | session | case, caseAssignment |

### Analytics, gamification & points

| Route | Methods | Purpose | Auth | Models |
|---|---|---|---|---|
| `analytics/route.ts` | GET | Platform outcome analytics (Actions Guide Phase 6) | session | case, caseOutcome, flyerPosting, searchSession, shelterContact, verifiedAction |
| `analytics/dashboard/route.js`, `analytics/cohorts/route.js`, `analytics/export/route.js`, `analytics/prediction/route.js` | GET | Dashboards / cohorts / export / recovery prediction | session (admin-ish) | case, dailyStats, eventLog, user, rescueForce |
| `analytics/track/route.js` | POST | Client event ingest | session | analyticsEvent, dailyStats |
| `gamification/achievements/route.js` | GET, POST | Achievements list/award | session | user, userAchievement |
| `users/me/points/route.ts`, `users/me/points/history/route.ts` | GET | Verified-action points balance / history | session | verifiedAction, dailyPointsLog, user |
| `volunteers/leaderboard/route.js` | GET | Volunteer leaderboard | **public** | user, rescueForce |

### Payments, insurance, partners

| Route | Methods | Purpose | Auth | Models |
|---|---|---|---|---|
| `payments/donate/route.js` | POST, GET | **Stripe** donation checkout session (`app/lib/payments/stripe`), $1–$10k | session-optional | donation, case |
| `payments/reward/route.js` | POST, PUT, GET | Reward escrow lifecycle | session | rewardEscrow, case, user |
| `payments/subscription/route.js` | GET, POST, DELETE | Premium subscription | session | subscription |
| `insurance/claims/route.js` | GET, POST | Insurance claim helpers (mock providers in `app/lib/insurance/claims`) | session | (lib only) |
| `partners/microchip/route.js`, `partners/vets/route.js` | GET, POST | Microchip registry / vet partner lookups (lib) | session | (lib) |

### Volunteers, patrol, emergency

| Route | Methods | Purpose | Auth | Models |
|---|---|---|---|---|
| `volunteer/join/route.js` | POST, GET | **One-tap quick join, "no signup wall"** (deviceId-based) | session-optional | (lib quickJoin) |
| `volunteer/engagement/route.js`, `volunteer/impact/route.js` | GET, POST | Engagement / impact stats | session | (lib) |
| `volunteers/certifications/route.js` | GET, POST, PUT | Certifications | session | volunteerCertification, user |
| `volunteers/schedule/route.js` | GET, POST, PUT | Shift scheduling | session | volunteerShift, shiftSignup, volunteerCertification, rescueForceMember |
| `volunteers/training/route.js` | GET, POST | Training progress | session | trainingProgress, volunteerCertification |
| `patrol/join/route.js` | POST, GET | Dog-walker patrol signup — **zod-validated** (`PatrolSignupSchema`) | session | patrolProfile, lostReport, user, userProfile |
| `patrol/settings/route.js` | PATCH | Patrol prefs — **zod-validated** | session | patrolProfile, user |
| `patrol/database/route.js` | GET | Patrol lost-report list | session | lostReport, user |
| `emergency/route.js` | GET, POST | Disaster-mode activation/dashboard | session | emergencyEvent, user |
| `emergency/evacuation/route.js` | GET, POST | Pet evacuation registry | session | petEvacuation |

### Geo & mapping

| Route | Methods | Purpose | Auth | Models |
|---|---|---|---|---|
| `geocode/route.js` | GET | Proxy to OSM **Nominatim** (forward + reverse) to avoid CORS | public; middleware 10/min | none |
| `geocode/zip/[zipCode]/route.js` | GET | ZIP lookup | public | none |
| `mapping/grid/route.js` | GET, POST | Search grid generation/claim | session | case, caseAssignment, searchArea, user |
| `mapping/heatmap/route.js` | GET | Sightings/coverage/probability heatmaps | **no auth** | case, caseSighting, caseAssignment, searchArea |
| `mapping/track/route.js` | POST, GET, DELETE | GPS breadcrumb tracking | session | gpsBreadcrumb, caseAssignment, user |

### Simulator (research/dev — all **unauthenticated**)

- `simulate/route.ts` — POST, GET — behavioral-profile simulation (`app/lib/behavioral-simulation`), `maxDuration = 60`.
- `simulator/route.js` — POST, GET — single sim runs (in-memory, legacy engine adapter).
- `simulator/sensitivity/route.js` — POST — sensitivity analysis, `runtime='nodejs'`.
- `simulator/batch/route.js` — POST, GET; `simulator/batch/[id]/route.js` — GET, DELETE — persisted batches (simulation, simulationBatch, simulationConfig).
- `simulator/batch/stream/route.js` — POST — streaming batch progress, `runtime='nodejs'`, `force-dynamic`.

### Public, SEO & misc

| Route | Methods | Purpose | Auth | Models |
|---|---|---|---|---|
| `public/homepage/route.js` | GET | Homepage aggregate | public, lib rate-limited | case, caseOutcome, caseSighting, rescueForce(+Member), user |
| `public/metrics/route.js` | GET | Public platform metrics | public, rate-limited | case, rescueForce(+Member), user |
| `public/missions/route.js` | GET, POST | Public case list; **POST deprecated → 410 Gone** (use `/api/reports/create`) | public, rate-limited | case |
| `public/missions/[caseNumber]/route.js` | GET | Public case by case number (share pages) | public | case |
| `public/reunions/route.js` | GET | Public reunion stories | public, rate-limited | caseOutcome |
| `public/found/route.js` | GET, POST | **Fully deprecated — both methods 410 Gone** | public | none |
| `health/route.js` | GET, POST | LB health check (GET = instant no-DB; POST = deep check with DB) | public | none |
| `robots/route.js`, `sitemap/route.js` | GET | robots.txt / sitemap.xml (active cases + forces) | public | case, rescueForce |
| `captcha/verify/route.js` | POST | Server-side reCAPTCHA v2/v3 verification | public | none |
| `feedback/route.js` | POST, GET | User feedback | session | (lib) |
| `moderation/report/route.js` | POST | Report content (`app/lib/moderation`) | session | (lib) |
| `integrations/route.js`, `integrations/[id]/route.js`, `integrations/[id]/test/route.js` | GET, POST; GET, PATCH, DELETE; POST | Third-party integration configs + test-fire | session | integration, case, rescueForceMember |
| `dev/seed-chicago/route.js` | POST | Seed Chicago demo force — **unconditionally disabled in production**, then ADMIN | case, rescueForce(+Member), division, squadTask, user |
| `dev/seed-coverage/route.js` | GET, DELETE | Seed fake search-coverage paths — **no auth at all**; file says "DELETE THIS IN PRODUCTION!" | searchSession, locationPing, case, user |

### Cross-cutting API findings

- **Two-layer rate limiting**: (1) `middleware.js` in-memory per-IP limiter on every `/api/*` request (default 60/min; overrides: register 5/min, mobile login 10/min, geocode 10/min, admin/bulk 5/min, missions 120/min); (2) `app/lib/rateLimit.js` Redis-backed limiter (in-memory fallback, bounded reconnects) with presets, used explicitly in ~20 hot/public routes (auth, public/*, sightings, upload, relay, pets/view, conversation messages, ai/*). Note: middleware skips `/api/auth/*`, so its register/login/forgot-password rate-limit and CAPTCHA entries are dead code there — those routes self-limit via `withRateLimitAsync`.
- **CAPTCHA**: middleware requires `x-recaptcha-token` on POSTs to `/api/missions`, `/api/contact`, `/api/reports` when `REQUIRE_CAPTCHA=true` (`/api/auth/register` entry is dead per above); `/api/captcha/verify` does server-side verification.
- **No cron endpoints / no CRON_SECRET pattern anywhere.** Maintenance is manual admin endpoints (`admin/cleanup-sessions`, `admin/shelters/sync`, `admin/migrate`).
- **Zod in exactly two routes** (`patrol/join`, `patrol/settings`); everything else validates by hand; TS routes use interfaces.
- **Notable unauthenticated endpoints** beyond `public/*`: `mission/[missionId]/stream` (live volunteer positions over SSE), `search/[caseId]/live`, `mapping/heatmap`, `rescue-forces/[id]/live-missions`, `rescue-forces/[id]/divisions/[divisionId]/missions`, `shelters/animals`, `shelters/enrich`, the entire `simulate`/`simulator/*` family, `users/[id]/profile`, hub reads, and **`dev/seed-coverage` (unauthenticated DB writes/deletes)**.
- **Anonymous-to-account funnels**: `reports/create` and `reports/found-pet` create accounts (bcrypt temp password + verification email) for anonymous reporters; `volunteer/join` is deviceId-based with no signup wall; `pets/view/[token]/request` creates accounts inline.
- **Authorization helpers**: `app/lib/authz.js` (fresh-DB role reads: `isAdmin`, `userHasCaseAuthority`, `userIsSquadLeader`); `app/lib/petOwnership.js` (`requirePetAccess`, 404-not-403 to prevent pet-id probing).

---

## 6. Data Model

Single Prisma schema `frontend/prisma/schema.prisma` (~5,266 lines, 130+ models, 55 enums), PostgreSQL. Header comment: "PetRecovery.org Database Schema - Rescue Squad Model". Many models are speculative "Phase N" scaffolding with no relations wired (String pseudo-enums, bare `caseId`/`userId` columns) — relation integrity is only enforced for the core domains.

### 6.1 The Case/Mission naming duality (mechanics)

- **`Case` (line 576) is the single model behind both "Case" and "Mission"** — a lost/found report (`reportType: LOST|FOUND`) with denormalized pet info (`petName/petSpecies/petBreed/petColor/petSize/petPhotoUrl`), unique `caseNumber` (`"CHI-2024-001847"`), reporter/owner contact, last-seen geo + `searchRadius`, Meta-ads fields, reward fields, engagement counters, resolution fields.
- Mission vocabulary appears two ways: (1) **field rename with `@map`**: `missionId String @map("caseId")` on `CaseSighting`, `CaseAssignment`, `SearchSession`, `VerifiedAction`, `ShelterContact`, `FlyerPosting`, `MascotTip`, `CaseOutcome` — Prisma name is `missionId`, DB **column is still `caseId`**; (2) **`MissionControl` (line 3350)** — separate 1:1 extension of `Case` (`caseId @unique`) holding real-time tactical state.
- Squad-level same trick: **`RescueForce` is `@@map("RescueSquad")`** (line 866), `RescueForceMember` `@@map("RescueSquadMember")` (line 922); enums `RescueForceLevel`/`RescueForceMemberRole` map to DB types `RescueSquadLevel`/`RescueSquadMemberRole`; FK fields still `rescueSquadId`. `MIGRATION_PLAN.md` documents the earlier executed generation (`LostReport→Case`, `RecoverySquad→RescueSquad`, etc.).

### 6.2 Core user system

| Model | Purpose / key bits | Relations |
|---|---|---|
| `User` | Central identity: email/phone (+verification tokens), nullable `passwordHash` (quick signup), `role: UserRole`, gamification (`rescueLevel`, streaks, `successfulReunions`, `honorsReceived`), ToS/waiver acceptance, reset tokens, `deviceId` for guest volunteers | Hub for ~40 relations |
| `UserProfile` | 1:1 location (lat/lng/address) + timezone/notification prefs | `userId @id` → User |
| `PatrolProfile` | Legacy "Recovery Patrol" 1:1 profile: radius, availability/transport JSON, species prefs, `AlertMethod`, quiet hours, `PatrolLevel` | → User |
| `Account` | NextAuth OAuth accounts (`@@unique([provider, providerAccountId])`) | → User |
| `PhoneVerification` | SMS code verification attempts | → User |
| `LegalDocument` | Versioned ToS/waiver/privacy content (`LegalDocumentType`, slug, version) | standalone |
| `EventLog` | Append-only audit log: `event_type`, `correlation_id`, actor/resource/action/result, error codes | standalone, no FKs |

### 6.3 Pet + Health Book

| Model | Purpose / key bits |
|---|---|
| `Pet` | Owned pet profile: species/breed/size/color, microchip, personality/photos JSON, vet contact, soft delete. **`publicViewToken`** — nullable capability token for read-only care page; null = sharing off; rotate to revoke. Deliberately **indexed, not unique**, because prod boots with `prisma db push` which refuses new unique constraints on live tables |
| `PetMedication` | Med or care task: `kind` is a **String** ("MEDICATION"/"CARE"), not an enum, to keep `db push` painless. Name/strength/`MedicationForm`/purpose; schedule via `MedicationSchedule` + `timesOfDay` (owner-local "HH:MM" JSON — client does all tz math), `daysOfWeek`, `intervalDays`; supply tracking (`quantityRemaining`, `refillAlertAt`); **tombstone `deletedAt`, never hard-deleted (medical data)** |
| `MedicationDose` | One dose log: `scheduledFor` (raw instant) + **`slotKey`** — tz-independent local "YYYY-MM-DDTHH:MM" wall-clock identity so two caregivers in different timezones collapse to one row (no double-dosing). `@@unique([medicationId, scheduledFor])`; slotKey dedup is enforced **in the API, not a DB unique** (adding one live would force `--accept-data-loss` on deploy's `db push`). `DoseStatus GIVEN|SKIPPED`; undo = tombstone |
| `PetVaccination` | Health Book stamps (`docs/HEALTH_BOOK_DESIGN.md`): name, `administeredAt`/`expiresAt` (status is pure expiry math), lot number, certificate photo; tombstoned |
| `PetWeightEntry` | Weight log (`weightLbs`, `recordedAt`); tombstoned |
| `PetShare` | **Keyed by email** so invites work pre-account; `userId` links on accept; `PetShareRole CAREGIVER|VIEWER`; `PetShareStatus PENDING|ACTIVE|REQUESTED` (REQUESTED = asked to help via public view link, awaiting owner approval); `@@unique([petId, email])` |
| `MedicationAuditLog` | Append-only journal of every medication mutation, written in the same transaction with a full JSON `snapshot`; **deliberately no foreign keys** so nothing done to primary rows can touch the journal |

### 6.4 Case ecosystem

| Model | Purpose |
|---|---|
| `Case` | See §6.1. `CaseStatus`/`CasePriority`/`CaseResolution` enums plus a string `priorityLevel` for volunteer-coordination priority modes |
| `Alert` | Per-user delivery record of a case alert: `AlertMethod`, delivered/opened timestamps, `AlertResponse` |
| `CaseSighting` | Public sighting report (was `Sighting`): geo, `certaintyLevel` 1–5, photos, verification |
| `CaseUpdate` | Comment/update thread on a case (was `Comment`); `isPinned` |
| `CaseFollow` | Follow a case with per-event notify flags (bare userId/caseId) |
| `ShareEvent` | Social-share tracking per platform, allows anonymous (ip/userAgent) |
| `CaseClue` | Physical clue found (COLLAR/TRACKS/SCAT… string) |
| `CaseOutcome` | 1:1 ML-training record on closure: `OutcomeType`, `FoundMethod`, `timeToReunionHours`, denormalized context snapshot, `verifiedActionsSummary Json`, owner feedback (`missionId @unique @map("caseId")`) |
| `ShelterMatch` | Match candidates from external shelter APIs; string status pipeline |
| `Sighting` | **Legacy** simple sighting model "used by analytics" — coexists with `CaseSighting` |
| `Conversation` / `DirectMessage` | Owner↔finder messaging on a lost/found match: `matchScore`, mutual contact-reveal flags, `ConversationStatus`; `@@unique([lostCaseId, foundCaseId])`; message types incl. REUNION_PROPOSED/CONFIRMED |
| `MatchConnection` / `RelayMessage` | **Relay/Connect broker (Phase 2)** — brokers contact between anonymous finder and owner **without exposing PII** until both opt in. `token @unique` is the only client-exposed ID; match snapshot (`matchScore`, `pTrueMatch`, `matchSource: attribute|visual|microchip`); `RelayStatus`; `finderHandle` ("Finder-7QX") + `finderTier` 0–2; `@@unique([lostCaseId, foundCaseId])` |
| `LocationDetectionLog` | GPS-detection funnel log — "adopted from the live DB (deployed from a side branch that never merged). Kept so schema sync on deploy stays additive" |

### 6.5 RescueForce, Divisions, squad social

| Model | Purpose |
|---|---|
| `RescueForce` (`@@map("RescueSquad")`) | Persistent squad: unique name, city/state/country + zip JSON, coverage (`CoverageType`, center+radius or GeoJSON `customBoundary`), specializations, lifetime stats, gamification (`RescueForceLevel`, `squadPoints`, badges JSON), soft delete |
| `RescueForceMember` (`@@map("RescueSquadMember")`) | Membership: `RescueForceMemberRole` FOUNDER/LEADER/COORDINATOR/MEMBER **plus deprecated legacy values** ADMINISTRATOR(≈LEADER), MODERATOR(≈COORDINATOR), DIVISION_LEADER(≈LEADER) — migrated by `migrations/migrate-roles.sql`; `AvailabilityStatus`; per-squad stats; optional `divisionId`; `@@unique([rescueSquadId, userId])` |
| `Division` | Neighborhood subdivision ("North Side"): center+radius (default 3 mi), zip JSON, GeoJSON boundary, `@@unique([rescueSquadId, name])`, soft delete |
| `DivisionRequest` | User proposal for a new division; `RequestStatus` flow; `approvedDivisionId @unique` |
| `SquadJoinRequest` | Join-request flow (string status), `@@unique([userId, rescueSquadId])` |
| `CaseAssignment` | **The squad↔case join**: `AssignmentStatus`, participation stats, `@@unique([missionId, rescueSquadId])` |
| `CaseParticipant` | Member opts into an assignment; `@@unique([assignmentId, userId])` |
| `SquadMessage` | Case-specific chat under an assignment (`MessageType CHAT|ANNOUNCEMENT|SYSTEM`) |
| `SearchArea` | GeoJSON polygon a member marked searched (+`acreage`, `potentialSpotting`) |
| `PetSpotting` | Squad-internal sighting (vs public `CaseSighting`), confidence 1–10 |
| `SquadHonor` / `SquadActivity` | Owner kudos to a member; squad activity feed (string `type`) |
| `SquadTask` / `TaskParticipant` | Task board: string type/priority/status pipelines, `actionId`/`taskType` linking to action definitions, priority score, owner-requested flag (+25% points bonus), optional `shelterId`, multi-user collaboration (`@@unique([taskId, userId])`) |
| `SquadPost` / `SquadPostComment` / `SquadPostVote` / `SquadCommentVote` | Reddit+Facebook-style squad feed: up/downvotes, nested comments (self-relation), one vote per user, soft delete; posts can scope to a Division |
| `Community` / `CommunityRequest` / `CommunityMember` / `CommunityPost` | **LEGACY** geographic community system (pages redirected); `CommunityType METRO_AREA|COUNTY|SUBCOMMUNITY`, self-referential hierarchy; kept for backwards compatibility |

### 6.6 Volunteer coordination, Mission Control, actions/points

- **Grid search**: `SearchGrid` (1:1 per case) → `GridCell` (row/col bounds, string status UNSEARCHED…PET_FOUND, priority 1–10, claims) → `SearchSession` (GPS-tracked search; `participantId` **optional** so non-members can search; status READY/ACTIVE/PAUSED/COMPLETED; points fields `distanceMiles`/`pointsEarned`/`isVerified`/`verifiedActionId @unique`; v2 `totalDistanceMiles` vs `validatedDistanceMiles`, `gridCellsCovered`) → `LocationPing` (per-ping validation: `isValid`, `invalidReason` OUTSIDE_ZONE/DRIVING/STATIONARY). Plus `HelpRequest` (in-field SOS: FOUND_PET/INJURED_ANIMAL/NEED_BACKUP/TRAPPED_PET), `DivisionAlert`, `UserAlertPreferences` (quiet hours, `maxAlertsPerDay`), `OwnerThankYou`, `CasePriorityMode`, `SurgeEvent`, `GPSBreadcrumb`.
- **Mission Control (1:1 with Case)**: `MissionControl` — `mode` string (INACTIVE, LIVE_SEARCH, CONTAINMENT, TRAP_OPS, STANDBY, RESOLVED, CLOSED), activation/pause/cold-case state, containment center/radius/perimeter, owner broadcast/voice-clip "call mode", volunteer stats. Children: `MissionVolunteer` (**anonymous device-keyed volunteers** via `odId`, `@@unique([missionId, odId])`), `MissionZone` (grid ref A1/B2, probability, terrain), `MissionSighting` (confidence CONFIRMED/HIGH/MEDIUM/LOW), `MissionResource`, `MissionTrap` → `TrapCheck`, `MissionLog`, `MissionBroadcast` (INFO/ALERT/FREEZE/STAND_DOWN), `MissionThankYou`, `VolunteerPath` + `VolunteerSignal`.
- **Actions v1 (points & verification, `docs/Actions_Guide.md`)**: `VerifiedAction` (13 snake_case `ActionType` actions; `VerificationMethod GPS|PLATFORM_EMAIL|PHOTO|CALL_DETECT`; base/bonus/total points, multipliers JSON, GPS, photo, Resend email open/reply tracking), `DailyPointsLog` (**source of truth**, one row per user per UTC date; `verifiedPoints` unlimited vs `selfReportedPoints` capped 100/day; `@@unique([userId, date])`), `ShelterContact` (per-case Google-Places shelter/vet record, `@@unique([missionId, placeId])`) → `ShelterContactAttempt` (`ContactMethodType`, `CallOutcome`, `StaffResponse`), `FlyerPosting` (GPS-verified flyer drop), `MascotTip` ("Scout"/Sarama tips: `TipType`, action buttons, `dismissedBy String[]`).

### 6.7 Notifications

`Notification` (in-app, string type, JSON data, actionUrl, expiry); `EmailPreference` (per-type toggles, digest, quiet hours, **`unsubscribeToken @unique`**) + `EmailLog`; `SmsPreference` (phone verify code, `dailyLimit`/`sentToday` throttle) + `SmsLog` (Twilio SID, cost); `PushSubscription` (unique `endpoint`, failure count) + `PushNotificationLog`; `DivisionAlert`, `UserAlertPreferences`, `ForumNotification`.

### 6.8 Hub (forum) + Rescue-Hub extras

`ForumCategory` (nestable via self-relation, `requiredTrustLevel`, mod-only/read-only flags, denormalized counts); `ForumThread` (unique `slug`, first post inline as `content @db.Text` + pre-rendered `contentHtml`, embedded pet/shelter links, location tagging, pinned/locked/solved/hidden, `ThreadUrgency`); `ForumPost` (nested replies via `replyToId`, `isSolution`, reaction counters); `ForumReaction` (`@@unique([postId, userId, type])`), `ForumReport`, `ForumBookmark`, `ForumProfile` (trust level 0–4, reputation, verified-shelter/rescue/moderator/banned flags), `ForumNotification` (9 types), `ForumModAction` (12 types), `ForumAnnouncement`. Adjuncts: `TransportRequest`/`TransportLeg` (multi-leg animal transport relay), `Badge`/`UserBadge`, `CityRequest`.

### 6.9 Shelters & simulation

- **Shelters**: `CityCache` (per-city fetch cache, `@@unique([city, state, country])`) → `Shelter` (dedup external IDs `appleMapKitId`/`googlePlaceId`/`petfinderId` all `@unique`; type SHELTER/RESCUE/VET/ANIMAL_CONTROL) → `ShelterIntake` (`@@unique([shelterId, externalId])`). Claim layer: `ShelterClaim` (`ClaimStatus`, verification-code flow, `@@unique([shelterId, claimantId])`), `ShelterProfile` (claimed-shelter page + Stripe Connect donations), `ShelterDonation` (fee-transparent cents), `ShelterAnimal` (`AnimalStatus`, match-to-lost-pet fields).
- **Simulator**: `SimulationConfig` (species/size/personality/initial state FLEEING/HIDING/WANDERING/TERRITORIAL; terrain URBAN/SUBURBAN/RURAL; searcher strategy GRID/SPIRAL/RANDOM/PROBABILITY) → `SimulationBatch` (aggregate success rate + outcome counts) → `Simulation` (per-run `randomSeed`, `SimulationOutcome`, path JSON, good-Samaritan flag, events log); `SimulationZoneStats`, `TerrainCache` (cached OSM GeoJSON with expiry).
- **Phase-scaffold models** (mostly standalone, string statuses): `AnalyticsEvent`, `DailyStats`; `Integration`; `PetImageAnalysis`, `PetFacialFeatures`; `SuccessStory`, `ActivityFeedItem`; `VolunteerShift`/`VolunteerSignup`, `VolunteerCertification`, `TrainingModule`/`TrainingProgress`; `Donation`, `RewardEscrow` (AUTHORIZED→CAPTURED/RELEASED), `Subscription`; `EmergencyEvent`/`PetEvacuation`; `UserAchievement`, `PointsLog`, `SquadCompetition`/`SquadCompetitionEntry`; `BlockchainIdentity`/`OwnershipHistory`; `DeviceConnection`/`Geofence`/`TrapSensor`; `AgencyIntegration`/`AgencyIntake`; `InsurancePolicy`/`InsuranceClaim`; `ReportSchedule`; multi-tenant `Tenant`/`TenantUser`/`APIKey`/`TenantIntegration`.

### 6.10 Capability tokens / share mechanisms

1. `Pet.publicViewToken` — capability URL for read-only care page; rotate-to-revoke; indexed not unique (db-push constraint).
2. `PetShare` — email-keyed caregiver/viewer invites; PENDING/ACTIVE/REQUESTED lifecycle.
3. `MatchConnection.token` — opaque unique token, only relay ID exposed; PII gated behind `finderTier`/mutual opt-in.
4. `EmailPreference.unsubscribeToken` — unique per-user unsubscribe capability.
5. `User.resetToken` (stored as sha256/bcrypt hash) / `emailVerifyToken`, both `@unique`.
6. `ShareEvent` — outbound social-share tracking per case/platform.

### 6.11 Enums (55)

**User/patrol:** `UserRole` USER, GUEST, PATROL, MODERATOR, ADMIN · `RescueLevel` PET_OWNER, SCOUT, SENTRY, SHEPHERD, PATHFINDER, PACK_GUARDIAN, PACK_LEGEND · `PatrolLevel` ROOKIE, SCOUT, TRACKER, EXPERT, LEGEND · `AlertMethod` EMAIL, SMS, PUSH, ALL · `LegalDocumentType` TERMS_OF_SERVICE, LIABILITY_WAIVER, PRIVACY_POLICY.
**Pet/health:** `PetSpecies` DOG, CAT, BIRD, RABBIT, OTHER · `PetSex` MALE, FEMALE, UNKNOWN · `PetSize` TINY, SMALL, MEDIUM, LARGE, GIANT · `MedicationForm` PILL, CAPSULE, CHEWABLE, LIQUID, INJECTION, TOPICAL, DROPS, POWDER, OTHER · `MedicationSchedule` DAILY, SPECIFIC_DAYS, EVERY_N_DAYS, AS_NEEDED · `DoseStatus` GIVEN, SKIPPED · `PetShareRole` CAREGIVER, VIEWER · `PetShareStatus` PENDING, ACTIVE, REQUESTED.
**Case:** `ReportType` LOST, FOUND · `CaseStatus` ACTIVE, IN_PROGRESS, SIGHTING_REPORTED, REUNITED, CLOSED_OTHER · `CasePriority` LOW, NORMAL, HIGH, URGENT · `CaseResolution` REUNITED, FOUND_BY_OWNER, FOUND_AT_SHELTER, CAME_HOME, DECEASED, SEARCH_CEASED · `AlertResponse` WILL_SEARCH, CANT_NOW, WATCHING, NOT_INTERESTED.
**Squad:** `CoverageType` RADIUS, NEIGHBORHOOD, CUSTOM, CITYWIDE · `RescueForceLevel` (@@map RescueSquadLevel) ROOKIE, ACTIVE, VETERAN, ELITE, LEGENDARY · `RescueForceMemberRole` (@@map RescueSquadMemberRole) FOUNDER, LEADER, COORDINATOR, MEMBER + legacy ADMINISTRATOR, MODERATOR, DIVISION_LEADER · `AvailabilityStatus` AVAILABLE, BUSY, AWAY · `AssignmentStatus` ACCEPTED, ACTIVE, STANDBY, COMPLETED, WITHDRAWN · `MessageType` CHAT, ANNOUNCEMENT, SYSTEM.
**Legacy community:** `CommunityType` METRO_AREA, COUNTY, SUBCOMMUNITY · `RequestStatus` PENDING, APPROVED, REJECTED · `MemberStatus` PENDING, APPROVED, REJECTED, BANNED · `CommunityRole` MEMBER, MODERATOR.
**Actions v1:** `VerificationMethod` GPS, PLATFORM_EMAIL, PHOTO, CALL_DETECT · `ActionType` search_area, check_hiding, contact_shelters, contact_vets, contact_animal_control, post_flyers, knock_doors, litter_outside, scent_items, food_station, camera_setup, humane_trap, garage_open · `ShelterContactStatus` NOT_CONTACTED, CONTACTED, AWAITING_RESPONSE, NO_MATCH, POSSIBLE_MATCH, MATCH_FOUND · `ContactMethodType` CALL, EMAIL, IN_PERSON · `CallOutcome` NO_ANSWER, LEFT_VOICEMAIL, SPOKE_WITH_STAFF, WRONG_NUMBER, BUSY · `StaffResponse` NO_MATCHING_ANIMALS, POSSIBLE_MATCH, CONFIRMED_MATCH, WILL_CHECK_AND_CALL_BACK, OTHER · `TipType` TIME, WEATHER, PROGRESS, LOCATION, COLD_SPOT, STRATEGY, ENCOURAGE, SIGHTING.
**Outcome/ML:** `OutcomeType` REUNITED, NOT_FOUND, DECEASED, CLOSED_OTHER · `FoundMethod` CAME_HOME, SHELTER_INTAKE, NEIGHBOR_FOUND, SIGHTING_LED_TO, TRAP_CAUGHT, FLYER_RESPONSE, SOCIAL_MEDIA, OTHER.
**Messaging:** `ConversationStatus` ACTIVE, PENDING_OWNER, PENDING_FINDER, REUNION_PENDING, REUNITED, CLOSED · `MessageSenderRole` OWNER, FINDER, SYSTEM · `DirectMessageType` TEXT, PHOTO, LOCATION, CONTACT_SHARED, VERIFICATION, REUNION_PROPOSED, REUNION_CONFIRMED, SYSTEM · `RelayStatus` OPEN, OWNER_REPLIED, MUTUAL_OPTIN, REJECTED, REUNITED.
**Hub:** `ThreadUrgency` NORMAL, URGENT, CRITICAL · `ReactionType` HELPFUL, HEART, THANKS · `ReportReason` SPAM, HARASSMENT, MISINFORMATION, OFF_TOPIC, INAPPROPRIATE, OTHER · `ReportStatus` PENDING, REVIEWED, ACTION_TAKEN, DISMISSED · `ForumNotificationType` REPLY_TO_THREAD, REPLY_TO_POST, MENTION, REACTION, SOLUTION_MARKED, THREAD_PINNED, MOD_ACTION, TRUST_LEVEL_UP, BADGE_EARNED · `ModActionType` HIDE_POST, UNHIDE_POST, LOCK_THREAD, UNLOCK_THREAD, PIN_THREAD, UNPIN_THREAD, DELETE_THREAD, WARN_USER, BAN_USER, UNBAN_USER, ADJUST_TRUST, MOVE_THREAD · `AnnouncementStyle` INFO, WARNING, URGENT, SUCCESS.
**Transport/shelter/city:** `TransportStatus` OPEN, PARTIALLY_FILLED, FULLY_FILLED, IN_PROGRESS, COMPLETED, CANCELLED · `LegStatus` OPEN, CLAIMED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED · `ClaimStatus` PENDING, VERIFICATION_SENT, UNDER_REVIEW, APPROVED, REJECTED · `AnimalStatus` AVAILABLE, PENDING, ADOPTED, FOSTER, MEDICAL_HOLD, RESCUE_ONLY, RECLAIMED, UNAVAILABLE · `CityRequestStatus` PENDING, REVIEWING, ADDED, ALREADY_EXISTS, INVALID, DUPLICATE.
**Simulation:** `SimulationBatchStatus` PENDING, RUNNING, COMPLETED, FAILED, CANCELLED · `SimulationStatus` PENDING, RUNNING, COMPLETED · `SimulationOutcome` FOUND_BY_SEARCHER, RETURNED_HOME, FOUND_VIA_SHELTER, FOUND_VIA_SOCIAL, FOUND_VIA_PLATFORM, TIMEOUT_SEARCHING, TIMEOUT_SHELTERED.

Dozens of other status/type fields (SquadTask, GridCell, MissionControl.mode, Shelter.type, Donation.status, …) are intentionally plain `String` pseudo-enums, per the schema's own comments, to keep `prisma db push` additive.

### 6.12 Migrations state & drift (verified)

- `frontend/prisma/migrations/` contains **11 dated migration dirs** (`20251124000000_add_lost_pet_cases` … `20260610_medication_data_protection`) **plus 3 loose manual SQL scripts** (`manual_add_gps_search_fields.sql`, `manual_add_relay_tables.sql`, `migrate-roles.sql`) and **no `migration_lock.toml`** — not a healthy `prisma migrate` history.
- **Prod does not run migrations**: `package.json` `"start": "prisma db push --skip-generate && node prisma/sync-legal-docs.js && next start -p ${PORT:-3000}"` (verified). Hence the constraint-avoidance patterns above and legacy columns kept (`Case.reporterToLastSeenMiles` — "live on prod, keep so db push stays additive").
- **Documented drift**: `manual_add_relay_tables.sql` records that `prisma db push` once wanted to DROP `reporterToLastSeenMiles` (12 rows) and `LocationDetectionLog` (13 rows) "because the repo schema has drifted from the shared remote DB"; the fix was a manual additive script, and both objects were later adopted into `schema.prisma`.
- **`MIGRATION_NEEDED.md` (repo root) is stale/unapplied**: it prescribes `User.accountType` + an `AccountType` enum (OWNER|PATROL) and a phone index — **grep of `schema.prisma` confirms zero matches** for `accountType`/`AccountType`; the migration was never landed even though the doc claims APIs set it.
- **`MIGRATION_PLAN.md` is historical**: the LostReport→Case-era plan, fully executed and superseded; it still references the pre-Postgres SQLite dev setup ("Delete dev.db").
- `migrate-roles.sql` is the data migration for legacy member-role values (ADMINISTRATOR/MODERATOR/DIVISION_LEADER → LEADER/COORDINATOR), matching the deprecated enum values still present.

---

## 7. Auth & Security

### 7.1 NextAuth core — `frontend/app/lib/auth.js`

Wired via `app/api/auth/[...nextauth]/route.js` (`NextAuth(authOptions)` as GET/POST).

- **Providers**: Credentials (always on) — `authorize()` looks up by lowercased email; returns `null` (one generic failure) for: no user / no `passwordHash` / SEC-18 block / bcrypt fail / **`emailVerified` null** (deliberately identical to a bad password to avoid a registration oracle on `/api/auth/callback/credentials`). Success fire-and-forgets `lastLoginAt`/`lastActive` and returns `{id, email, name, firstName, lastName, image, role, emailVerified}`. Google/Facebook/Apple OAuth each conditionally registered only when their env pair exists; `getAvailableProviders()` mirrors this for the UI.
- **SEC-18 seeded-prod-admin block** (verified lines 66–74): `SEC18_SEEDED_ADMINS = ['contact@aalb.org', 'sarama@petrecovery.app']` — originally seeded admin passwords are in git history, so these accounts are refused at the credentials layer *regardless of password* unless `SEC18_ROTATED === 'true'` (block-by-default; owner must rotate live DB hashes first). Credentials-path only — OAuth logins for those emails are not blocked. Duplicated verbatim in `app/api/mobile/auth/login/route.js` with a "keep in lockstep" comment. CLAUDE.md: don't "fix" it; never seed literal credentials.
- **Founder-admin bootstrap** (verified line 27, 322): `FOUNDER_ADMIN_EMAILS = {'kevin.thakkar3791@gmail.com'}`; the `jwt` callback forces `token.role = 'ADMIN'` for that email and persists it to the DB once per session (`token.founderAdminSynced`) — the first-admin chicken-and-egg fix.
- **Session**: `strategy: 'jwt'` (JSDoc-cast to `SessionStrategy` so TS routes importing `authOptions` type-check), `maxAge` 30 days. No DB sessions/adapter — OAuth account linking done manually in callbacks.
- **Pages**: `signIn: '/login'`, `signOut: '/'`, `error: '/login'`, `newUser: '/onboarding'` — **`frontend/app/onboarding/` does not exist** (verified), so a brand-new OAuth user lands on the 404 page.
- **Callbacks**: `signIn` finds-or-creates OAuth users (`role: 'USER'`, `emailVerified: now` since OAuth proves the address), links `Account`, backfills `emailVerified`/`profileImage`; `jwt` copies `id/role/firstName/lastName/emailVerified` onto the token, falls back to DB lookup on OAuth, honors `trigger === 'update'`, applies founder override; `session` exposes those on `session.user`; `redirect` allows relative + same-origin URLs only (no open redirect).

### 7.2 Middleware — `frontend/middleware.js`

Matcher: everything except `_next/static`, `_next/image`, `favicon.ico`, `public/`. Order:

1. **Canonical-host 301**: `petrecovery.org`/`www.petrecovery.org` → `https://www.reunitepets.org` (path+query intact).
2. **Bot-probe fast path**: `.php`, `wp-admin|wp-content|wp-includes`, `.well-known/`, `xmlrpc`, `phpmyadmin`, `mysql`, `.env`, `.git` → empty 404.
3. **Health**: `/api/health`, `/_health` → 200 `{"status":"ok"}`.
4. **Skips**: `/_next`, `/static`, **`/api/auth/*`** ("let NextAuth handle its own routes") and static-extension files. Consequence: the middleware `RATE_LIMIT_CONFIG` entries for `/api/auth/register|login|forgot-password` and the CAPTCHA rule for `/api/auth/register` are **dead code** — those routes self-limit via `app/lib/rateLimit.js` (`RateLimitPresets.AUTH`).
5. **Rate limiting** for other `/api/*`: in-memory per-IP sliding window ("use Redis in production" comment); exceeded → 429 with `Retry-After`.
6. **Auth gate** (verified lines 43–58, 256–265): `PROTECTED_ROUTES` = `/dashboard`, `/settings`, `/missions/new`, `/missions/edit`, `/rescue-forces/create`, `/admin`; `ADMIN_ROUTES` = `/admin`, `/api/admin` (prefix match). No JWT → **307 redirect to `/login?callbackUrl=<pathname>`** (this applies to `/api/admin/*` too — an unauthenticated API hit gets an HTML redirect, not a 401). JWT present but `role !== 'ADMIN'` on an admin route → **403 JSON** `{"error":"Forbidden","message":"Admin access required"}` — even for HTML pages. This trusts the (up to 30-day-old) JWT role; demotion isn't picked up here.
7. **CAPTCHA**: POSTs to `/api/missions|/api/contact|/api/reports` without `x-recaptcha-token` → 403 when `REQUIRE_CAPTCHA === 'true'`.
8. Security headers (CSP, X-Frame-Options SAMEORIGIN, etc.) on everything else.

### 7.3 Role model & authorization idioms

`User.role UserRole @default(USER)`; `UserRole` = USER, GUEST (device-keyed quick-join volunteers), PATROL (barely used), MODERATOR (honored by `requireStaffOrAdmin` and `/api/admin/moderation`), ADMIN. Two coexisting role-check idioms:

- **JWT-trusting**: `app/lib/permissions.js` — `getUserRole(session)`, `requireAdmin`/`requireStaffOrAdmin` (throw `PermissionError` 403, log `auth.permission_denied`), `canEditCase`/`canAssignCase` (ADMIN-only for now), `isAdmin`/`isStaff` for UI.
- **DB-fresh**: `app/lib/authz.js` — `getUserRole(userId)`/`isAdmin(userId)` read fresh from DB ("a long-lived token can carry a stale role"), plus `userHasCaseAuthority` (platform ADMIN, or case reporter, or active MODERATOR/ADMIN member of an assigned force) and `userIsSquadLeader`.

Scoped roles: `PetShareRole` (VIEWER/CAREGIVER) enforced by `app/lib/petOwnership.js` (`requirePetAccess` ladder VIEWER < CAREGIVER < OWNER; strangers get **404, not 403** so pet ids aren't probeable); `RescueForceMemberRole`; `CommunityRole`.

Admin pages gate access in **three layers**: middleware (307/403), client `useSession` effects on every `/admin/**` page (unauthenticated → login; non-admin → `/dashboard`), and per-handler API checks (session-JWT flavor, e.g. `api/admin/analytics`; DB-fresh flavor via `isAdmin()` on the dangerous ones, e.g. `admin/migrate`, `admin/wipe-squads`, `admin/seed-welcome`).

### 7.4 Registration, verification, password reset

- **Register** (`/register` 5-step wizard → POST `/api/auth/register`): self rate-limited; email regex, password ≥ 8, firstName ≤ 100, optional US-ish phone; **existing email returns the same generic 400** ("Unable to create account…") to block enumeration; bcrypt cost 12; 32-byte hex verify token stored as **sha256 hash** with 24h expiry; user created with `role: 'USER'`, `emailVerified: null`; deliberately **no auto-login** (verification-gated).
- **Verify** (`/verify-email?token=` → POST `/api/auth/verify-email`): hashes incoming token, matches + unexpired → sets `emailVerified`, clears token; success auto-redirects to `/login?verified=true` after 3s. GET is an unauthenticated resend (`?email=`) always returning generic success. Login is impossible until verified.
- **Forgot** (`/forgot-password` → POST `/api/auth/forgot-password`): rate-limited; **always the same success message** whether or not the user exists, and every response padded to ≥500ms (`ensureMinResponseTime`) against timing enumeration; sha256-hashed `resetToken`, **1h expiry**. Explicitly no `passwordHash` gate — this is how OAuth-only and quick-report temp-password accounts first set a usable password.
- **Reset** (`/reset-password?token=` → POST `/api/auth/reset-password`): hashed-token lookup via `resetToken @unique`; unknown → 400 INVALID_TOKEN; expired → clears token, 400 TOKEN_EXPIRED; success → bcrypt-12 new password, clear reset *and* verification tokens, and **set `emailVerified` if null** (clicking an emailed token proves address ownership).

### 7.5 Unauthenticated behavior cheat sheet

| Hit (no session) | Result |
|---|---|
| `/dashboard`, `/settings*`, `/missions/new`, `/missions/edit*`, `/rescue-forces/create` | Middleware **307 → `/login?callbackUrl=<path>`** (server-side, no JS needed) |
| `/admin*` pages | Anonymous: 307 to login; logged-in non-admin: **403 raw JSON** |
| `/api/admin/*` | Anonymous: 307 HTML redirect (not 401); non-admin token: 403 JSON; handlers additionally 401/403 |
| Most client-protected pages (`/pets*`, `/alerts`, `/profile`, `/notifications`, `/hub/new`, `/sightings/report`, …) | 200 with client shell; redirect only after JS runs. Some omit `callbackUrl` (`/alerts`, `/profile`, `/dashboard`); `/hub/new` and `/shelter/request` use `?redirect=` |
| `/shelter/dashboard` | Server `redirect('/login?callbackUrl=/shelter/dashboard')` — 307 without JS |
| `/pets/view/<token>` | 200 anonymous (invalid tokens render the page, which then shows not-found from the API's 404) |
| Auth pages | Public 200; login pushes `callbackUrl` (default `/dashboard`) |
| Host `petrecovery.org` | 301 → `https://www.reunitepets.org` |
| Bot-probe paths | Empty 404 |
| `/api/health`, `/_health` | 200 `{"status":"ok"}` |

### 7.6 Known security caveats

- Middleware admin checks trust the JWT `role` for up to 30 days; DB-fresh checks exist only in `authz.js`-using routes.
- SEC-18 lockout covers credentials + the mobile mirror only, not OAuth.
- `pages.newUser: '/onboarding'` points at a nonexistent route (404 for new OAuth users).
- Webhooks (`resend`, `twilio`) **skip signature verification with a warning when their secrets are unset**.
- Unauthenticated endpoints exposing live operational data: `mission/[missionId]/stream` (SSE volunteer positions), `search/[caseId]/live`, `mapping/heatmap`, `rescue-forces/[id]/live-missions`, division mission lists, `shelters/enrich`, and **`dev/seed-coverage` (unauthenticated DB writes/deletes, marked "DELETE THIS IN PRODUCTION!")**.
- Test suites lock in past incidents by SEC number (see §11): SEC-1 mission command authz, SEC-3 PII leak, SEC-14 wipe-squads, SEC-15 cleanup-sessions, SEC-20 reports dashboard, SEC-22 registration oracle.

---

## 8. UI System

### 8.1 Root layout & providers

`frontend/app/layout.js` is the single global shell: `globals.css`, **Inter** via `next/font/google` (`--font-inter`), **Leaflet 1.9.4 CSS from unpkg loaded globally in `<head>`** (SRI-pinned; every page pays for it; maps break stylistically if unpkg is unreachable), site-wide `metadata` (OG/Twitter cards pointing at the CDN logo on `petrescue.b-cdn.net`), viewport `maximumScale: 1, userScalable: false`. Provider nesting on `<body className="… bg-midnight-50 text-midnight-900">`:

`SessionProvider` → `ModeProvider` (`app/contexts/ModeContext.js`, 'pet-owner' vs 'patrol', localStorage) → `PushNotificationProvider` → `GPSProvider` (`app/lib/gpsService`) → `ErrorBoundary` → `ClientProviders` (= `ToastProvider` + `CapacitorBootstrap` + `StandaloneHome`) → `OfflineBanner` → `Navigation` → `<main className="pb-16 lg:pb-0">` → `GlobalBottomNav`.

**16 nested layouts**: metadata-only passthroughs built on `buildShareMetadata` for `about, advice, care, contact, hub, login, lost-and-found, register, rescue-forces, shelters`; `app/report/layout.js` (full-screen wizard overlay, `fixed inset-0 z-50`, covers the nav); `app/pets/[id]/layout.js` (client "pet shell": breadcrumb + identity row + 4 tabs). Global conventions: `app/loading.js` (Sarama mascot + spinner), `app/error.js`, `app/not-found.js` — **no per-route `loading.js`/`error.js` anywhere else**.

### 8.2 Global nav

**House rule (2026-07, hardened 2026-07-27 after the hat system was deleted)**: the top bar is IDENTICAL for every person on every route — same h-16 height, same Report CTA, same five center links (Pet Care · Lost & Found · Rescue Forces · Shelters · Hub), rendered from the frozen `CENTER_LINKS` array in `Navigation.js`. It does **not** vary with the route, with sign-in state, with shelter membership, or with anything else; the sole session-dependent slot is Sign in/Join vs bell + account menu. Anything person-specific (your shelter, your rescue forces) lives in the account menu, never in the bar. The short-lived Owner/Searcher "hat" chrome (`app/contexts/HatContext.js`, `docs/PRODUCT_IA_PLAN.md` §6) is **deleted**: a bar that rearranges itself as you move around reads as broken. `/care` redirects signed-in visitors to `/pets` (`app/care/CareGate.js`), which is how one Pet Care link serves guests and members without the bar changing. Two permitted variations only: **subtabs** below the bar (`sticky top-16`), and **whole-bar removal** inside immersive takeovers — each of which must ship a visible way back out (Mission Control's "Exit" → `/dashboard`, the portal's "Exit to ReunitePets" → `/`). Where chrome hides is decided in ONE place, `app/lib/navChrome.js` (`isImmersiveRoute` for the top bar — currently `/mission-control`, `/my-shelter` (the hat-gated shelter portal with its own sidebar chrome, `app/my-shelter/PortalShell.js`), and `/rasuwa` (the Nepal flood letter tool: crisis page for a non-pet audience, way back out = the footer's ReunitePets link); `hidesBottomNav` adds the report/join wizards and pet edit/medication wizards for the tab bar). Enforced by `__tests__/global-chrome.test.js`: no page/layout may ship its own `sticky top-0`/`fixed top-0` bar (page-local sub-headers anchor BELOW the bar with `sticky top-16 z-40` — see `/hub/search`, `/messages`), and the nav components may not grow ad-hoc route conditionals. Screens that must fill the viewport size themselves `h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-4rem)]` (chat at `/messages/[id]`, `/simulate`, auth-page centering).

- `app/components/Navigation.js` — THE universal sticky top bar (`sticky top-0 z-50 bg-midnight-900`, h-16). Renders on every route incl. auth pages; the five center links are constant for everyone; the right slot alone is auth-adaptive (members get bell + account menu, which carries admin links and the "your places" rows; guests get Sign in/Join), and while the session resolves a fixed-size placeholder holds that slot so the bar never reflows. Logo has an explicit 56px box (no CLS while the CDN image loads); labels are `whitespace-nowrap` with lg→xl compaction (icon-only logo, avatar-only chip, `px-3` pills below `xl`). Mobile: hamburger → 300px right drawer.
- `app/components/GlobalBottomNav.js` — mobile-only (`lg:hidden`) fixed bottom tab bar, same four tabs for everyone: Home(/dashboard), Pet Care, raised circular **flash-yellow Report FAB** (`-mt-6` → `/report/new`), Lost & Found, Shelters. Hidden per `hidesBottomNav` (immersive + wizard flows; shows on auth pages); includes `h-safe-area-inset-bottom` spacer.
- **No global footer** — footers are per-page inline (e.g. `FooterCta()` in `app/page.js`). Mission Control ships its own chrome (`MissionHeader`, `simple/CompactHeader`, `simple/BottomNav*`).

### 8.3 Component directories (two libraries + route-local)

**A. `frontend/app/components/`** (`@/app/components/*`): shell/providers (`SessionProvider`, `ClientProviders`, `PushNotificationProvider`, `PushNotifications`, `RealtimeProvider`, `ErrorBoundary`, `CapacitorBootstrap`, `StandaloneHome`, `Navigation`, `GlobalBottomNav`, `ModeSwitcher`, `NotificationBell`); forms (`BreedSelector`, `CitySelector`, `ColorSelector`, `ImageUpload`, `PhoneVerification`, `ReCaptcha`, `ShelterSearch`, `SocialLoginButtons`); brand/sharing (`SaramaChat`, `SaramaLogo`, `SocialShare`, `OpenGraphMeta`, `FlyerCard`, `PrintFlyer`); maps (`PetMap` — CARTO voyager tiles, `SquadCoverageMap`); matching (`MatchesPanel`, `PotentialMatches`); **`mission/`** SAR toolkit (`SARMapView` — Esri World Imagery satellite + CARTO dark, probability zones; `MissionCommandCenter`, `SearchPlannerPanel`, `ProbabilityZoneAdjuster`, `SightingModal`, `VolunteerPanel`, `MapLegend`, …); **`missionControl/`** widgets (`CommandCenter`, `MissionMap`, `FlyerTracker`/`FlyerMapView`/`FlyerProgress`/`FlyerMarkButton`, `SquadChat`, `VoiceRecorder`, `CaseOutcomeModal`, `ScoutTipsPanel`, `OwnerPulse`, `ShareMission`, `ActivationSwitch`, …); **`coordination/`** (`SearchAreaMap`, `SightingForm`, `SquadChat`, `ParticipantList`); domain bits (`care/GoodStuff`, `medications/{MedCards,MedIcon}`, `pets/RescueReadiness`, hand-rolled SVG icon sets in `icons/`); **`ui/`** state widgets (`Toast`, `Skeleton`, `OfflineIndicator`, `FeedbackWidget`, `ErrorBoundary`).

**B. `frontend/components/`** (`@/components/*`): **`ui/`** design-system primitives via `components/ui/index.js` — `Button`/`IconButton`/`ButtonGroup` (primary = flash-yellow, secondary = midnight, + outline/ghost/danger/success/warning/link), `Card*`, `Badge`/`StatusBadge`/`CountBadge`, `EmptyState`/`CardSkeleton`/`ListItemSkeleton`, `PageLayout`/`PageHeader`/`PageContent`/`PageSection`/`Breadcrumbs`, `cn()`; plus `BottomSheet`, `CaseHeader`, `CaseRail`, `ExpandablePanel`. **`squad/`** — the Rescue Force page system: `SquadHubV2` (tabbed Community/Missions shell), `SquadHeaderV2`, `MissionsModeV2`, `MapModeV2` (→ `MapComponentV2`, Leaflet CARTO `dark_all`), `CommunityModeV2`, `PostFeed`/`PostCard`/`CreatePostModal`, `FeaturedMissionsCarousel`, `MissionCard` (hub-card bioluminescent classes), `MissionDetailPanel`, `MembersModal`, mobile tab variants, `YourMissionsBar`, `DivisionPreviewCard`. **`case/`**: `MatchCard.jsx`, `TaskCompletionModal`, `matchGating.js`. **`maps/`**: `AppleMap.js` (MapKit JS wrapper; hook `app/lib/maps/useAppleMap.js`, server token minting in `app/lib/maps/appleMapServer.js`). Root: `CitySearchInput`, `LoadingSkeleton`, `OfflineBanner`, `WaiverModal`.

**C. Route-local trees**: `app/cases/[caseNumber]/components/` (HeroSection, ActionCards, ActivityTimeline, MapPreview, SocialProofBar, StickyMobileCTA); `app/mission-control/components/` (2026-07 rebuild, `docs/MISSION_CONTROL_REDESIGN.md`: MissionHeader, HotSightingBanner, MapCanvas + MapKey, ActionDock (the one primary + situation line), HelpChecklist, PetBriefCard; subdirs `desktop/` (CommandPanel, OperationsRail), `live/LiveSearchHUD`, `sheet/` (framer-motion BottomSheet + Peek/Brief/Team), `overlays/` (`ConfettiBurst` pure-CSS confetti, `ReunitedCelebration`, `HelperBriefOverlay`, `MarkReunitedModal`), `regions/` (MissionVitals, ActivityLog, ChatModule, TaskBoard, ShelterList, PresenceStrip, WebGpsHint), `modals/SightingFormModal`; the legacy `MissionControlSimple`/`simple/*` tree was deleted); `app/simulator/components/`; `app/simulate/components/`.

### 8.4 Design language

- **Palette** (`tailwind.config.js`): "Midnight Blue + Flashlight Yellow" — custom `midnight` 50–950 scale (900 = `#0f172a`, the nav color) and `flash` yellow 50–900 (400 = `#facc15`, the CTA color). `darkMode: 'class'`; custom shadows `soft`/`card`/`card-hover`/`glow-flash`/`glow-danger`; animations `fade-in`, `slide-up`, `pulse-soft`.
- **`app/globals.css`** duplicates the palette as CSS variables, adds semantic colors, light/dark sets (`.dark`), mobile base rules (44px touch targets, 16px inputs to prevent iOS zoom, `overflow-x: clip` on html/body — **must stay `clip`, not `hidden`**: `hidden` turns body into a scroll container and silently breaks every `position: sticky` descendant incl. the navbar, safe-area utilities), Leaflet mobile control sizing, `.skeleton` shimmer, `prefers-reduced-motion` kill-switch, print styles hiding nav.
- **Second design system in the same file**: "Squad Hub — Bioluminescent" — `--hub-*` variables (near-black backgrounds, cyan/violet/yellow glows), `.squad-hub` + `.hub-aurora` + `.hub-grid`, urgency-pulsing card glows (`hub-case-high/medium/low`), dark Leaflet overrides, mission-control keyframes. Consumed by `components/squad/MissionCard.js` and squad/mission-control surfaces.
- **Brand assets**: `frontend/lib/brandAssets.js` — all logos + Sarama mascot from `https://petrescue.b-cdn.net`. Icons: lucide-react.

### 8.5 Maps

Stack: `leaflet@1.9.4`, `react-leaflet@4.2.1`, `leaflet-draw@1.0.4`. All map components are client-only via `dynamic(..., { ssr: false })` with spinner placeholders. Tiles: OSM (`BrowseMap`), CARTO voyager (`PetMap`), CARTO dark_all (`MapComponentV2`, `SARMapView` street mode), Esri World Imagery (`SARMapView` satellite).

| Page | Map component |
|---|---|
| `/` | `BrowseMap` (dynamic) |
| `/lost-and-found` | `app/lost-and-found/BrowseMap.js` (list/map toggle) |
| `/cases/[caseNumber]` | `components/MapPreview.js` (leaflet + framer-motion) |
| `/mission-control` | `MapCanvas` → `SARMapView` — full-bleed, always-mounted ("the map IS the mission") |
| `/rescue-forces/[id]` (+ divisions) | `SquadHubV2` → `MapModeV2` → `MapComponentV2` |
| `/report/new`, `/report/found` | Leaflet location pickers (report/new also Apple MapKit autocomplete) |
| `/patrol/join` | Leaflet radius map |
| `/simulator` | `SimulatorMap.js` (animated Monte Carlo playback) |
| `/simulate` | `SimulationMap.tsx` (full-screen) |
| `/admin/divisions/create` | **leaflet-draw** polygon editor (injects `leaflet.draw.css` from unpkg at runtime) |
| widgets | `SquadCoverageMap`, `SearchAreaMap`, `SightingForm`, `FlyerMapView`/`FlyerTracker`, `MissionMapPanel`; `components/maps/AppleMap.js` for shelter/place search |

### 8.6 Motion & charts

framer-motion (v12.23) used narrowly: `CasePageClient` + its six components (entrance fades/slides), mission-control `sheet/BottomSheet` (draggable), `/about-sarama`. Everything else is CSS keyframes. recharts (v3.6) has exactly one consumer: `app/simulator/components/BatchCharts.js`; `/admin/analytics` deliberately uses a hand-rolled `SimpleLineChart`.

### 8.7 Loading / error / offline / toasts

Loading: `app/loading.js` (Sarama pulse); per-map dynamic-import placeholders; skeletons (`components/LoadingSkeleton.js`, `app/components/ui/Skeleton.js`, `CardSkeleton`/`ListItemSkeleton`, `.skeleton` shimmer). Errors: `app/error.js` (logs `[ERROR-PAGE]`), `app/not-found.js`, two ErrorBoundary components (root-wrapping one in `app/components/`). Offline: `components/OfflineBanner.js` (global slide-down + 3s "reconnected" flash), `app/components/ui/OfflineIndicator.js`, `/offline` page, `public/offline.html` (SW navigation fallback). Toasts: `ToastProvider` wired in `ClientProviders`.

### 8.8 PWA & Capacitor

- `public/manifest.json`: name ReunitePets, `start_url: /dashboard`, standalone, theme `#F5A623`, CDN icons, 3 shortcuts (**pointing at legacy `/cases/new`, `/cases` routes**), screenshots.
- `public/sw.js` (cache `petrecovery-v2`): **navigations are network-only** with `offline.html` as sole fallback (comment documents a stale-HTML outage that forced this); cache-first for `/_next/static/`; network-first for other GETs; skips `/api/`; full push pipeline (`notificationclick` deep-links to `/cases/:id` and `/messages/:id`, `pushsubscriptionchange` re-subscribe, VAPID via postMessage). A second push-only SW `public/sw-push.js` is registered by `app/lib/missionControl/usePushNotifications.js`; the main SW is registered in `app/components/PushNotifications.js`.
- `app/components/StandaloneHome.js`: in standalone display-mode, redirects `/` → `/dashboard`.
- `frontend/capacitor.config.ts`: appId `com.reunitepets.app`, a **remote-URL shell** loading the live site (`CAPACITOR_SERVER_URL` or `https://www.reunitepets.org`; `CAPACITOR_DEV=true` + LAN URL for live reload); `webDir: capacitor-www` (single fallback `index.html`); Capacitor v6 plugins: app, splash-screen, status-bar. `CapacitorBootstrap.js` runs only when `isNative()`: hides splash, sets status bar, routes deep links, wires Android back button.
- Responsive: desktop nav at `lg:`, drawer + bottom tab bar below; `main pb-16 lg:pb-0`; safe-area utilities; 44px targets; 16px inputs; BottomSheet UIs; Mission Control targets three device postures (command = desktop, field = native app w/ GPS, bridge = mobile web) per `app/mission-control/MissionShell.js`.

### 8.9 Screenshot advisories

1. Every Leaflet page: maps mount after hydration, then fetch tiles over the network — wait for tile paint. Worst: `/mission-control` (satellite + live SSE), `/simulator`/`/simulate` (animated playback), `/admin/divisions/create` (runtime CSS injection).
2. `/cases/[caseNumber]` and `/about-sarama`: framer-motion entrances — early screenshots catch opacity-0 elements.
3. `/simulator`: recharts renders only after a batch run completes.
4. `/rescue-forces/[id]`: continuous bioluminescent pulse keyframes — emulate `prefers-reduced-motion: reduce` for stable captures.
5. Client-fetch-after-mount everywhere: nav hits `/api/dashboard` + `/api/notifications`; badges settle ~1s after load; route transitions flash the Sarama loader.
6. External assets: brand images from `petrescue.b-cdn.net`, Leaflet CSS from unpkg, MapKit JS from Apple — a sandboxed bot without those hosts gets logo-less pages and unstyled maps.

---

## 9. Seed Data & Local Dev

### 9.1 Seed script inventory (`frontend/prisma/`)

Wiring (`frontend/package.json`): `npm run seed` → `seed.js` (also `prisma.seed`); `npm run seed:metros` → `seed-metro-areas.js`; `npm run clear:squads` → `clear-squads.js`; `npm start` runs `sync-legal-docs.js` at boot. Run manually with `node prisma/<file>`: `seed-sample-data.js`, `seed-rescue-hub.js`, `seed-forum-content.js`, `seed-rescue-squads.js`, `seed-chicago-squad.js`, `seed-welcome-announcement.js`.

- **`seed.js`** — admin user from `SEED_ADMIN_EMAIL` (default `contact@aalb.org`) with `SEED_ADMIN_PASSWORD` or a generated random password (never a repo literal — SEC-18); 3 `LegalDocument`s: `terms-of-service`, `liability-waiver`, `privacy-policy` (all v1.0.0).
- **`seed-metro-areas.js`** — 35 legacy `Community` rows (`METRO_AREA`); requires the `contact@aalb.org` admin first.
- **`seed-rescue-squads.js`** — 24 `RescueForce` rows (Chicago + 4 suburbs + 19 metros incl. "Austin Rescue Force" — **collides by unique name** with the sample-data force; whichever runs first wins).
- **`seed-rescue-hub.js`** — 10 `ForumCategory` (`welcome`, `lost-pet-support`, `found-pet-help`, `transport`, `foster`, `shelter-talk`, `training`, `success-stories`, `urgent`, `general`), 14 `Badge` (`first-post` … `founding-member`), 1 `ForumAnnouncement`.
- **`seed-forum-content.js`** — users `sarama@petrecovery.org` + 4 example.com members (no passwords), 6 Sarama threads with **non-deterministic slugs** (title-slug + `Date.now().toString(36)` suffix), replies, badge awards. Requires seed-rescue-hub categories.
- **`seed-welcome-announcement.js`** — ADMIN user `sarama@petrecovery.app` (**auth-blocked by SEC-18** unless `SEC18_ROTATED=true`) + pinned ANNOUNCEMENT `SquadActivity` per active force.
- **`seed-chicago-squad.js`** — **broken against the current schema**: writes `Case.missionNumber` (schema: `caseNumber`), `CaseParticipant.caseAssignmentId`/`role` (schema: `assignmentId`, no role), `SquadTask.creatorId`/`missionId` (schema: `createdById`/`caseId`). Throws on first query. Treat as legacy (`CHI-2024-000N` cases, 9 `@test.com` users, password `testuser123`).
- **`sync-legal-docs.js`** — boot-time version sync of terms-of-service only; never exits non-zero.
- **`clear-squads.js`** — deletes all `RescueSquadMember` + `RescueSquad` rows.

### 9.2 `seed-sample-data.js` (the local-dev/screenshot seed) — full inventory

All users share password `LocalDevScreenshots1!`; all email-verified and ToS-accepted (v1.0.0).

**Users**: `admin@localdev.test` (Avery Admin, ADMIN), `sarah@localdev.test` (Sarah Chen), `mike@localdev.test` (Mike Rodriguez), `david@localdev.test` (David Lee) — all USER except admin.

**Pets** (both owned by admin, each with a random 32-byte base64url `publicViewToken`): **Max** — DOG, Golden Retriever, age 4, MALE, neutered, Golden, LARGE, 65 lb, microchip `985112004567890`, photo `/seed/max.svg`, vet Dr. Reyes / Austin Vet Clinic / `512-555-0188`; **Luna** — CAT, Domestic Shorthair, age 2, FEMALE, Black, SMALL, 9 lb, `/seed/luna.svg`.

**Medication**: one `PetMedication` for Max — **Apoquel**, 16 mg, PILL, DAILY at `08:00`/`20:00`, 42 remaining, refill alert at 10. (No `MedicationDose` rows despite the header comment.)

**Pet share**: Luna shared with `sarah@localdev.test`, CAREGIVER, ACTIVE. **Health Book**: 3 `PetVaccination` for Max (Rabies, DHPP, Bordetella — Bordetella expiring in 30 days), 7 `PetWeightEntry` (66.5→65 lbs, monthly).

**Cases** (upserted by unique `caseNumber`):

| caseNumber | Pet | Type | Status | Reporter | Notes |
|---|---|---|---|---|---|
| `AUS-2026-0001` | Max (linked `petId`) | LOST | IN_PROGRESS, HIGH | admin | Zilker Park, DOOR_DASH, $500 reward, 312 views |
| `AUS-2026-0002` | Whiskers (orange tabby) | LOST | ACTIVE, NORMAL | sarah | Hyde Park, WINDOW_ESCAPE |
| `AUS-2026-0003` | "Unknown (found)" golden | FOUND | ACTIVE | mike | Barton Springs, FOUND_WANDERING |
| `AUS-2025-0099` | Biscuit (Beagle) | LOST | REUNITED | david | resolved REUNITED, foundBy = sarah |

Plus: 2 `CaseSighting` on `AUS-2026-0001` (sarah @ Barton Creek Greenbelt trailhead, certainty 4, verified; mike @ Barton Springs Pool, certainty 5, unverified); 2 `CaseUpdate` (one pinned); `MissionControl` for `AUS-2026-0001` in LIVE_SEARCH, activated by admin (OWNER), initialRadius 3.

**Rescue Force** (table `RescueSquad`): **Austin Rescue Force** — Austin TX 78704, zips `["78701","78704","78751"]`, CITYWIDE, center 30.2672/-97.7431, r=15mi, VETERAN, 4350 squadPoints, badges `["first_reunion","night_owls"]`, 17 reunions. Divisions `North Austin` / `South Austin`. Members: admin=FOUNDER (no division), sarah=LEADER (North), mike=MEMBER (South), david=MEMBER (North). `CaseAssignment` Max's case → force (ACTIVE) with `CaseParticipant` rows for admin/sarah/mike; 3 `SquadActivity`; 2 `SquadTask` ("Search Barton Creek Greenbelt east entrance" SEARCH_AREA/HIGH/IN_PROGRESS → sarah; "Call Austin Animal Center" SHELTER_CHECK/AVAILABLE); 1 `SquadPost` by sarah + 1 comment by mike.

**Hub**: categories `lost-pet-help`, `success-stories`, `general` (deterministic slugs); thread **`tips-for-shy-cats-hiding-nearby`** by sarah in `lost-pet-help` (URGENT, geo-tagged Austin); 2 replies; `ForumProfile` for admin/sarah/mike (trust 2, reputation 120).

**Conversation**: links `AUS-2026-0001` ↔ `AUS-2026-0003` (owner=admin, finder=mike, matchScore 92) with 3 messages. **Shelters**: Austin Animal Center (7201 Levander Loop, 78702) and Austin Pets Alive! (1156 W Cesar Chavez St, 78703, `isNoKill=true`), both verified. **Alerts/notifications**: one `Alert` for admin on `AUS-2026-0002` (EMAIL, delivered+opened); two `Notification` for admin (SIGHTING unread with `actionUrl: /missions/AUS-2026-0001`; SQUAD_MESSAGE read).

The script ends by printing a JSON blob of key IDs (forceId, division id, case ids, pet ids, `petMaxToken`, medicationId, threadSlug, conversationId, user ids).

### 9.3 Dynamic page params → SQL against the seeded DB

Prisma table naming: most models have no `@@map`, so Postgres tables are quoted PascalCase (`"User"`, `"Pet"`, `"Case"`, `"ForumThread"`, …). Exceptions: `RescueForce` → `"RescueSquad"`, `RescueForceMember` → `"RescueSquadMember"`; mapped enums; and `missionId @map("caseId")` — the **column** is always `caseId`. Mission-ish routes resolve params via `missionWhere()` (`app/lib/shareMetadata.js`): cuid/uuid → `Case.id`, else `Case.caseNumber` — either works.

| Page route | Param | SQL for a valid seeded value |
|---|---|---|
| `/cases/[caseNumber]` | `Case.caseNumber` | `SELECT "caseNumber" FROM "Case" WHERE "caseNumber" = 'AUS-2026-0001';` |
| `/missions/[missionNumber]`, `/reports/[id]`, `/alerts/[id]`, `/join/[missionId]` | caseNumber or Case.id | same, or `SELECT id FROM "Case" WHERE "caseNumber" = 'AUS-2026-0001';` |
| `/admin/missions/[missionId]` | Case.id | `SELECT id FROM "Case" WHERE "caseNumber" = 'AUS-2026-0001';` |
| `/pets/[id]` (+ subroutes) | Pet.id | `SELECT id FROM "Pet" WHERE name = 'Max' AND "isDeleted" = false;` |
| `/pets/view/[token]` | publicViewToken (≥16 chars) | `SELECT "publicViewToken" FROM "Pet" WHERE name = 'Max';` |
| `/admin/pets/[id]` | Pet.id | `SELECT id FROM "Pet" WHERE name = 'Luna';` |
| `/admin/users/[id]` | User.id | `SELECT id FROM "User" WHERE email = 'sarah@localdev.test';` |
| `/hub/c/[slug]` | ForumCategory.slug | `SELECT slug FROM "ForumCategory" ORDER BY "displayOrder";` → `lost-pet-help`, `success-stories`, `general` |
| `/hub/thread/[slug]` | ForumThread.slug | `'tips-for-shy-cats-hiding-nearby'` (only deterministic slug) |
| `/hub/u/[id]` | User.id with ForumProfile | `SELECT "userId" FROM "ForumProfile" fp JOIN "User" u ON u.id = fp."userId" WHERE u.email = 'admin@localdev.test';` |
| `/messages/[id]` | Conversation.id | `SELECT c.id FROM "Conversation" c JOIN "Case" k ON k.id = c."lostCaseId" WHERE k."caseNumber" = 'AUS-2026-0001';` |
| `/rescue-forces/[id]` | RescueForce.id (**table `RescueSquad`**) | `SELECT id FROM "RescueSquad" WHERE name = 'Austin Rescue Force';` |
| `/rescue-forces/[id]/divisions/[divisionId]` | Division.id | `SELECT d.id FROM "Division" d JOIN "RescueSquad" rs ON rs.id = d."rescueSquadId" WHERE rs.name = 'Austin Rescue Force' AND d.name = 'North Austin';` |
| `/communities/[id]` | legacy (301'd) | `SELECT id FROM "Community" WHERE name = 'Austin Metro Area';` |
| `/lost-pet/[location]` | SEO slug, no DB | use `austin-tx` |

Useful API params: `medId` → `SELECT id FROM "PetMedication" WHERE name = 'Apoquel';`; `shareId` → `SELECT id FROM "PetShare" WHERE email = 'sarah@localdev.test';`; legal slug → `terms-of-service` | `privacy-policy` | `liability-waiver`; assignment id → `SELECT id FROM "CaseAssignment" WHERE "caseId" = (SELECT id FROM "Case" WHERE "caseNumber"='AUS-2026-0001');`.

### 9.4 Environment variables

**Required for local dev**: `DATABASE_URL` (`frontend/.env` / `.env.local`); `NEXTAUTH_URL`, `NEXTAUTH_SECRET`; `NEXT_PUBLIC_BASE_URL` (with `BASE_URL` fallback in some server code) — canonical/share URLs.

**Auth-adjacent, optional** (providers register only when both halves set): `GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET`, `APPLE_ID`/`APPLE_SECRET`; `SEC18_ROTATED` (set `'true'` only after rotating seeded-admin credentials — do not "fix"); `REQUIRE_CAPTCHA`, `NEXT_PUBLIC_RECAPTCHA_V2_SITE_KEY`/`RECAPTCHA_V2_SECRET_KEY`, `NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY`/`RECAPTCHA_V3_SECRET_KEY`/`RECAPTCHA_V3_THRESHOLD`.

**Optional integrations (all degrade gracefully when unset)**: Email — `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`; nodemailer fallback `EMAIL_SERVICE/USER/PASSWORD/FROM`; `SMTP_HOST/PORT/USER/PASS/FROM` (`lib/actions/emailService.ts`); `ADMIN_NOTIFICATION_EMAIL`. SMS — `TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER/MESSAGING_SERVICE_SID/WEBHOOK_URL`. Redis — `REDIS_URL` (in-memory fallback), `RATELIMIT_TRUSTED_IP_HEADER`. Push — `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Stripe — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SUPPORTER_PRICE_ID`, `STRIPE_PRO_PRICE_ID`. AI — `ANTHROPIC_API_KEY`, `AI_IMAGE_HOST_ALLOWLIST`, `AI_ANALYZE_GLOBAL_MAX_PER_MIN`, `AI_PARSE_MED_GLOBAL_MAX_PER_MIN`. Bunny — `BUNNY_STORAGE_ZONE/API_KEY/CDN_URL/STORAGE_URL`, `NEXT_PUBLIC_CDN_URL`/`CDN_URL`/`CDN_IMAGE_URL`. Maps — `NEXT_PUBLIC_APPLE_MAPKIT_TOKEN` or `APPLE_MAPKIT_TEAM_ID/KEY_ID/PRIVATE_KEY` (legacy `APPLE_MAPS_*`), `GOOGLE_PLACES_API_KEY`, `MAPTILER_API_KEY`. Shelter/microchip — `PETFINDER_API_KEY/SECRET`, `RESCUE_GROUPS_API_KEY`/`RESCUEGROUPS_API_KEY` (both spellings exist), `PETLINK_API_KEY`, `HOMEAGAIN_API_KEY`, `FOUNDANIMALS_API_KEY`, `AAHA_API_KEY`, `RAPIDAPI_KEY`. Monitoring/misc — `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_ENV_NAME`, `APP_VERSION`, `NEXT_PUBLIC_APP_URL`, app-store URLs, `SLACK_CLIENT_ID/SECRET`.

**Seed/scripts/tests only**: `SEED_ADMIN_EMAIL/PASSWORD`; `LOGIN_EMAIL/PASSWORD`, `OUT`, `SETTLE_MS`, `CHROME_PATH` (`scripts/shoot.mjs`); e2e `TEST_USER_EMAIL/PASSWORD`, `TEST_ADMIN_EMAIL/PASSWORD`, `TEST_SQUAD_LEADER_EMAIL/PASSWORD`, `PLAYWRIGHT_BASE_URL`, `DEBUG_TESTS`.

`frontend/.env.example` documents the intended split (DATABASE_URL + NEXTAUTH_* required; email "required for production"; Bunny "required for image uploads") but is slightly stale: it lists `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`/`RECAPTCHA_SECRET_KEY`, `GEOCODING_API_KEY`, and `ENABLE_*` flags that no first-party code reads, and omits Stripe, `SMTP_*`, MapTiler, microchip keys, and `SEC18_ROTATED`.

**Local-dev hazards** (`HANDOFF.md`): the dev server has historically shared the **PROD** database (port :5757) — never write test users there; never run `next build` while the dev server is up (shared `.next` corruption caused phantom 500s); verify fixes on origin, not local.

---

## 10. Link Previews

### The rule (`docs/LINK_PREVIEWS.md`, mandated by CLAUDE.md)

Every link a user might paste into a chat must unfurl as the entity it points to (pet photo, mission, squad, thread) — never the generic site logo. Preview bots (iMessage/WhatsApp/Slack/Facebook) read OpenGraph/Twitter tags from initial HTML and don't run JS, so a `'use client'` page inherits the site-wide logo card from `app/layout.js` (the "medication share link previews as the mascot" bug class). Two recipes:

- **Entity pages** (`/things/[id]`): server `page.js` exporting `export async function generateMetadata({ params })`; if the UI is client-side, split it into `<Name>Client.js` rendered by a thin server `page.js`. `generateMetadata` does a minimal Prisma `select`, returns `buildShareMetadata(...)`, and returns `genericShareMetadata()` for not-found/invalid and inside try/catch.
- **Static public segments**: a tiny server `layout.js` exporting `export const metadata = buildShareMetadata({...})`; child entity pages override automatically.

**House rules**: (1) photos beat logos — `shareImage(entity.photoUrl)`, logo only as fallback; (2) absolute image URLs — `metadataBase` from `NEXT_PUBLIC_BASE_URL`, never localhost literals; (3) **not-found never leaks** — invalid ids/tokens get the same `genericShareMetadata()` card whether the entity exists or not (critical for `/pets/view/[token]`); (4) `index` is an explicit decision, default `false` (noindex) — `true` only for pages meant to rank (active canonical case pages, hub threads/categories, static public segments, `/lost-pet/<location>`); tokenized/auth-adjacent stay noindex; (5) legacy redirect routes (`/missions/<n>`, `/reports/<id>`, `/alerts/<id>`) client-redirect humans but bots read their HTML, so they carry the full mission card; (6) keep the Prisma `select` minimal — runs on every uncached load; (7) new private routes go in `KNOWN_PRIVATE` in the test with a reason comment. Messenger caches are per-URL on the sender's device (verify with `?v=2`); local check: `curl -s http://localhost:3000/cases/AUS-2026-0001 | grep -o '<meta property="og:[^>]*>'`. Mission-shaped routes must not hand-roll copy — use `missionWhere` + `missionShareSelect` + `missionShareMetadata` (`app/missions/[missionNumber]/page.js` is the ~20-line reference).

### Helpers (`frontend/app/lib/shareMetadata.js`)

- `SITE_NAME = 'ReunitePets'`; `FALLBACK_SHARE_IMAGE` = the logo PNG on `petrescue.b-cdn.net`.
- `shareMetadataBase()` — `new URL(NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')` with try/catch fallback.
- `shareImage(url)` — `normalizePhotoUrl(url) || FALLBACK_SHARE_IMAGE`.
- `buildShareMetadata({ title, description, image, imageAlt, canonical, index = false, keywords, ogTitle, twitterTitle, twitterDescription })` — the one card shape: `metadataBase`, `openGraph` (1200x630, `type: 'website'`, `siteName`), `twitter` (`summary_large_image`), `robots: { index, follow: index }`, optional `alternates.canonical`.
- `genericShareMetadata(title?, description?)` — the generic "Lost Pet Recovery | ReunitePets" card so existence never leaks.
- Mission helpers shared by `/cases`, `/missions`, `/reports`, `/alerts`, `/join`: `missionWhere(param)` (UUID/CUID → `{id}`, else `{caseNumber}`); `missionShareSelect` (exactly 10 fields: `caseNumber, reportType, petName, petSpecies, petBreed, petPhotoUrl, petDescription, lastSeenAddress, lastSeenAt, status`); `missionShareMetadata(mission, { canonicalPath, index, variant })` — LOST ("Help Find {pet} - Lost {breed species} in {city}" / og:title "LOST: …") vs FOUND ("Found {breed species} in {city} - Is This Your Pet?") vs `variant: 'join'` ("Join the search for {pet} in {city}…"); city extracted from `lastSeenAddress` (second-to-last comma segment, else "Unknown Location"); human "time missing" string.

### Current inventory (verified: exactly 11 `generateMetadata` pages; 19 `KNOWN_PRIVATE` entries)

- **Shareable with `generateMetadata` (11)**: `cases/[caseNumber]`, `pets/view/[token]`, `missions/[missionNumber]`, `reports/[id]`, `alerts/[id]`, `join/[missionId]`, `rescue-forces/[id]`, `hub/thread/[slug]`, `hub/c/[slug]`, `hub/u/[id]`, `lost-pet/[location]`.
- **Static segments with server `layout.js` metadata (11)**: `lost-and-found`, `care`, `rescue-forces`, `hub`, `about`, `advice`, `shelters`, `contact`, `register`, `login`, `report`. (Additionally, non-dynamic server pages `legal/terms`, `privacy`, `shelter/dashboard` export `const metadata` directly, plus root layout — outside the dynamic-route sweep.)
- **`KNOWN_PRIVATE` (19, each with a reason comment)**: `pets/[id]` + `care`, `edit`, `medications`, `medications/new`, `share`, `health`, `today`; `messages/[id]`; `admin/missions/[missionId]`, `admin/users/[id]`, `admin/pets/[id]`; `missions/[missionNumber]/coordinate`; `rescue-forces/[id]/command-center`, `/divisions`, `/divisions/[divisionId]`, `/mission-control`, `/settings`; `communities/[id]` (legacy, redirected).

### Enforcement (`frontend/__tests__/link-previews.test.js`)

Static source check (fs reads, no DB/rendering), four groups: (1) each of the 11 `ENTITY_PAGES` must exist, must NOT start with `'use client'`, must match `export async function generateMetadata`; (2) each of the 11 `STATIC_SEGMENTS` must have a server `layout.js` exporting `metadata`/`generateMetadata`; (3) **sweep** — `walkPages()` collects every dynamic `page.*` under `frontend/app` (skipping `api/`); each fails unless in `KNOWN_PRIVATE`, a server component mentioning `generateMetadata`, or has a sibling server `layout.js` mentioning `metadata` — **this is what fails CI on any new dynamic route without metadata**, and when an existing server page gets `'use client'` added; (4) stale-list guard — every `KNOWN_PRIVATE` entry must still exist on disk.

---

## 11. Testing

Run locally: `cd frontend && npm test` (Jest via `next/jest`, `testEnvironment: 'node'`, `@/` alias → frontend root; `frontend/jest.setup.js` stubs env vars incl. a dummy `DATABASE_URL`). CI (`.github/workflows/ci.yml`; push to `pet_main`/`report-wizard-v2`, PRs to `pet_main`) runs `npx jest --ci --forceExit` with a dummy DATABASE_URL forced repo-wide so CI can never touch the shared Render Postgres. `jest.config.js` excludes the stale pre-Jest `lib/__tests__/logging.test.js` and sets 20% coverage thresholds. All API tests mock Prisma (`__tests__/mocks/prisma.js` + inline `jest.mock('@/app/lib/prisma')` factories to dodge import-hoist TDZ).

- **`__tests__/link-previews.test.js`** — see §10; the primary CI gate for new routes.
- **`__tests__/no-undefined-jsx.test.js`** — process gate running ESLint `no-undef` + `react/jsx-no-undef` over every `app/**/page.js|layout.js|error.js|loading.js` and all components (own minimal config, 120s timeout). Written to catch the `Dog is not defined` / `Pill is not defined` prod crashes — any unimported identifier on a render surface fails CI.
- **`__tests__/api/` (18 suites)** — security/regression locks, each documenting its incident: `auth-register`, `auth-reset-password`, `auth-enumeration` (SEC-22 registration oracle), `analyze-pet` (SSRF allowlist, rate/spend caps), `cleanup-sessions-authz` (SEC-15), `mission-command-authz` (SEC-1), `reports-dashboard-authz` (SEC-20), `wipe-squads-authz` (SEC-14, "highest-stakes"), `reports-id-pii` (SEC-3 PII leak via potentialMatches), `found-pet-reunion-loop` (keystone CRIT-A/B + CORR-3 cruelty gate), `sightings`, `sightings-owner-notify` (CRIT-C), `assignment-sighting-notify` (CRIT-E), `status-change-notify` (CRIT-D), `search-mark-ping` (live-search breadcrumbs), `squad-comment-vote` (COM-1), `report-log`, `finder-funnel.contract` (all `test.todo` — an executable contract for routes not yet built).
- **`__tests__/lib/`** — `matching.test.js` (reunion engine: falsy-zero coords, species hard gate, confidence floor, microchip ranking), `medications.test.js` (schedule engine + free-text parser), `petAccess.test.js` (owner/caregiver/viewer/pending/stranger matrix; strangers 404 not 403), `email.test.js` (Resend → SMTP → loud no-op provider chain), `rateLimit-global.test.js` (global spend ceiling fails closed).
- **`__tests__/components/match-gating.test.js`** — fail-closed Confirm-&-Connect CTA gating (pure function, no DOM).
- **Outside Jest**: `.github/workflows/smoke-links.yml` — manually-triggered post-deploy dead-link probe running `frontend/scripts/audit-links.mjs` against a deployed URL; fails on any internal 404/500.

**Regression traps for route/docs work**: (1) converting any ENTITY_PAGES `page.js` to a client component or removing its `generateMetadata` fails the link-preview suite; (2) any new `[param]` route without metadata or a `KNOWN_PRIVATE` entry fails the sweep; (3) deleting a route still in `KNOWN_PRIVATE` fails the stale-list test; (4) any undefined identifier on a render surface fails `no-undefined-jsx`.

---

## 12. Open Threads / Known Gaps

**Owner-gated open items (`HANDOFF.md` 2026-05-30 + 2026-06-09 addendum):**
1. Deploy tip `9959340` of `report-wizard-v2` and run the "Post-Deploy Link Smoke Test" GitHub Action.
2. Security: rotate the two seeded-admin passwords (`contact@aalb.org`, `sarama@petrecovery.app`) on the live DB, set `SEC18_ROTATED=true` in Render env, confirm a real `NEXTAUTH_SECRET`.
3. Unblock authed testing: reset one `tester@test.com` account — the logged-in/admin visual + a11y + E2E pass is parked because dev shares the PROD DB.
4. CI failure — solved in the addendum (stale `package-lock.json` + Capacitor 8 needing Node 22; CI/Dockerfile on Node 22; green from `pet_main` 9f96adb).
5. Clarify deploy mechanics (pinned commit vs branch tip; frozen deploy branch?).
6. Legal review of `/privacy` + `/terms` before hard public launch.
7. Run two migrations manually on the live DB (`20260609_add_pet_medications`, `20260610_add_pet_shares_and_guest_role`) — the live DB has no `_prisma_migrations` history so `migrate deploy` from zero fails.
8. Data cleanup: human-reviewed dedupe of mixed-case emails on the live DB.
9. Standing hazards: dev shares PROD DB (:5757); never `next build` while dev server is up; verify fixes on origin.
10. Deferred rename debt: internal `RescueSquad` identifiers / `/api/rescue-squads` paths still un-renamed post-Rescue-Forces.

**Verified code/schema gaps:**
- `pages.newUser: '/onboarding'` in `authOptions` points at a route that does not exist (`frontend/app/onboarding/` absent — new OAuth users get the 404 page).
- `MIGRATION_NEEDED.md` prescribes `User.accountType` + `AccountType` enum (OWNER|PATROL) + phone index; **zero matches in `schema.prisma`** — never landed, though the doc claims APIs set it. Related (`FEATURE_NOTES.md`): multi-zip patrol areas need a `patrolZipCodes` JSON field (deferred — Render migrations painful); `AlertMethod` can't express partial combos (EMAIL+SMS without PUSH).
- `prisma/seed-chicago-squad.js` is broken against the current schema (writes `missionNumber`, `caseAssignmentId`/`role`, `creatorId`/`missionId` — none exist).
- `prisma/migrations/` has no `migration_lock.toml`; prod syncs schema via `db push` at boot.
- `api/dev/seed-coverage` — unauthenticated DB writes/deletes, self-labeled "DELETE THIS IN PRODUCTION!"; `mission/[missionId]/stream`, `search/[caseId]/live`, `mapping/heatmap`, `rescue-forces/[id]/live-missions`, division mission lists, `shelters/enrich` are unauthenticated.
- Webhook signature verification (Resend/Twilio) is skipped with a warning when secrets are unset.
- Middleware rate-limit + CAPTCHA entries for `/api/auth/*` are dead code (middleware skips that prefix); middleware admin gate trusts a JWT role up to 30 days old; unauthenticated `/api/admin/*` hits get an HTML 307 rather than a 401.
- `public/manifest.json` shortcuts point at legacy `/cases/new` / `/cases` routes.
- The case landing page's $45/$100 ad-fund widget is hardcoded/fake (`LOST_PET_LANDING_PAGE_PLAN.md`).
- Division system: schema + APIs exist; UI, notifications, and metro seeding not built (`DIVISION_IMPLEMENTATION_SUMMARY.md`; its `add_division_system` migration also listed as unrun).
- Legacy 410 endpoints intentionally kept for old clients: `public/found` (GET+POST), `public/missions` POST.
- Seed-name collision: `seed-rescue-squads.js` and `seed-sample-data.js` both create "Austin Rescue Force" (unique name — first writer wins).
- Doc-level contradictions to be aware of: `VISION.md` "~45% complete" vs `ROADMAP.md` "MVP ~95%" (same date); `MASTER_VISION.md` overstates built status; ADFUND/AD_AUTOMATION specs stamped "December 2024" but contextually Dec 2025; `EMERGENT_SIMULATION_PLAN.md` (calibrate k to research) vs `SIMULATION_FIX_PLAN.md` (never calibrate to targets); several plan docs end "Awaiting Approval" (`REDESIGN_PLAN.md`, `ADFUND_IMPLEMENTATION_PLAN.md`, `EMERGENT_SIMULATION_PLAN.md`) — treat them as unbuilt.