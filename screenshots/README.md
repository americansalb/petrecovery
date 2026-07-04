# Page Screenshot Gallery

Full-page screenshots of every route in the app, captured 2026-07-04 against a local
dev server (PostgreSQL seeded via `frontend/prisma/seed-sample-data.js`; login `admin@localdev.test`).
Viewport 1440px, full-page. Regenerate with `frontend/scripts/gallery-sweep.js` (usage in its header).

This capture includes the 2026-07 care-product redesign: one dashboard (`/pets`,
warm register; signed-in `/care` redirects there), one wizard (`/care/start`;
`/pets/new` 301s to it), Today as the only dose-action surface (incl. as-needed),
the Health Book as the pure record (alert ribbon + status band, identity only in
the shell), and the public view rebuilt on the same components.

- `pub-*` — anonymous visitor session (34 captures)
- `auth-*` — logged in as a local ADMIN user (73 captures)

Improvements over the 2026-06-12 capture:
- External assets now render: brand logo + Sarama mascot (petrescue.b-cdn.net), Leaflet CSS (unpkg),
  and live map tiles (OSM/CARTO/Esri). The capture browser re-issues external requests through
  Playwright's request API because headless Chromium's TLS is reset by the sandbox egress proxy.
- New pages since June: `/care` (pub+auth), `/pets/[id]/health`, `/pets/[id]/today`,
  `/admin/pets/[id]`, `/admin/users/[id]`, authed `/alerts/[id]` + `/missions/[missionNumber]`,
  and the `/missions` + `/database` legacy 301s.
- `/mission-control` is captured with `?mission=` (bare shows an empty shell),
  `/sightings/report` with `?alertId=`, `/hub/search` with `?q=`.

Notes:
- 5 admin pages bounce on hard URL loads: their guard
  (`session?.user?.role !== 'ADMIN'` / `!session`) fires while NextAuth is still `loading`,
  so direct loads redirect to /dashboard even for admins. Captured by clicking in-app links
  with a warm session instead: auth-74-admin, auth-75-admin-analytics, auth-92-admin-shelters, auth-93-admin-shelters-requests, auth-94-admin-users.
- `/pets/[id]/care` is a server-redirect stub → `/pets/[id]/today`; `/pets/[id]/medications` → `/pets/[id]/health`.
- Rows whose Final URL differs from Route document real redirect behavior (next.config.js
  permanent redirects and in-page bounces).
- `/reset-password` + `/verify-email` are captured without `?token=` and show their
  (intended) error states.
- The /admin hub links to `/admin/notifications`, `/admin/report-log`, `/admin/settings`,
  `/admin/audit` — none of these routes exist (404). Not captured.

## Anonymous session

| Screenshot | Route | Final URL | Notes |
|---|---|---|---|
| pub-01-home.png | `/` | `/` |  |
| pub-02-lost-and-found.png | `/lost-and-found` | `/lost-and-found` |  |
| pub-03-about.png | `/about` | `/about` |  |
| pub-04-about-sarama.png | `/about-sarama` | `/about-sarama` |  |
| pub-05-advice.png | `/advice` | `/advice` |  |
| pub-06-contact.png | `/contact` | `/contact` |  |
| pub-07-found.png | `/found` | `/report/found` | server redirect |
| pub-08-shelters.png | `/shelters` | `/shelters` |  |
| pub-09-login.png | `/login` | `/login` |  |
| pub-10-register.png | `/register` | `/register` |  |
| pub-11-forgot-password.png | `/forgot-password` | `/forgot-password` |  |
| pub-12-reset-password.png | `/reset-password` | `/reset-password` |  |
| pub-13-verify-email.png | `/verify-email` | `/verify-email` |  |
| pub-14-legal-terms.png | `/legal/terms` | `/legal/terms` |  |
| pub-15-legal-consent.png | `/legal/consent` | `/login?returnUrl=%2Flegal%2Fconsent` | redirects |
| pub-16-privacy.png | `/privacy` | `/privacy` |  |
| pub-17-offline.png | `/offline` | `/offline` |  |
| pub-18-case-portal.png | `/cases/AUS-2026-0001` | `/cases/AUS-2026-0001` |  |
| pub-19-lost-pet-location.png | `/lost-pet/austin-tx` | `/lost-pet/austin-tx` | 4 console errors |
| pub-20-pet-public-view.png | `/pets/view/eF6Q3wsZy1k-RJ3-TCaegQ0IM_OOCZ-VTlDTvSwQLxg` | `/pets/view/eF6Q3wsZy1k-RJ3-TCaegQ0IM_OOCZ-VTlDTvSwQLxg` |  |
| pub-21-hub.png | `/hub` | `/hub` | 3 console errors |
| pub-22-hub-search.png | `/hub/search?q=lost` | `/hub/search?q=lost` | 2 console errors |
| pub-23-hub-category.png | `/hub/c/lost-pet-help` | `/hub/c/lost-pet-help` | 2 console errors |
| pub-24-hub-thread.png | `/hub/thread/tips-for-shy-cats-hiding-nearby` | `/hub/thread/tips-for-shy-cats-hiding-nearby` |  |
| pub-25-hub-user.png | `/hub/u/cmr4cizxe0000rdvl50vvspav` | `/hub/u/cmr4cizxe0000rdvl50vvspav` |  |
| pub-26-report-public-mission.png | `/reports/cmr4cj05x000drdvlz56tfxsw` | `/reports/cmr4cj05x000drdvlz56tfxsw` |  |
| pub-27-alert-detail.png | `/alerts/cmr4cj05x000drdvlz56tfxsw` | `/login` | redirects; 2 console errors |
| pub-28-join-mission.png | `/join/cmr4cj05x000drdvlz56tfxsw` | `/join/cmr4cj05x000drdvlz56tfxsw` | 2 console errors |
| pub-29-mission-detail.png | `/missions/AUS-2026-0001` | `/mission-control?mission=AUS-2026-0001` | redirects |
| pub-30-rescue-forces.png | `/rescue-forces` | `/rescue-forces/search` | client redirect |
| pub-31-rescue-forces-search.png | `/rescue-forces/search` | `/rescue-forces/search` |  |
| pub-32-rescue-force-detail.png | `/rescue-forces/cmr4cj06y000urdvlagzaski8` | `/rescue-forces/cmr4cj06y000urdvlagzaski8` | 2 console errors |
| pub-33-communities-legacy.png | `/communities/cmr4cj06y000urdvlagzaski8` | `/rescue-forces/search` | redirects |
| pub-34-care.png | `/care` | `/care` |  |
| pub-35-care-start.png | `/care/start` | `/care/start` | the one add-a-pet wizard (guest-first) |

## Admin session

| Screenshot | Route | Final URL | Notes |
|---|---|---|---|
| auth-33-dashboard.png | `/dashboard` | `/dashboard` |  |
| auth-34-pets.png | `/pets` | `/pets` |  |
| auth-35-care-start.png | `/care/start` | `/care/start` | replaces `/pets/new` (301 → `/care/start`) |
| auth-36-pet-detail.png | `/pets/cmr4cj05d0005rdvl0xwkz2mw` | `/pets/cmr4cj05d0005rdvl0xwkz2mw` |  |
| auth-37-pet-care.png | `/pets/cmr4cj05d0005rdvl0xwkz2mw/care` | `/pets/cmr4cj05d0005rdvl0xwkz2mw/today` | redirects |
| auth-38-pet-edit.png | `/pets/cmr4cj05d0005rdvl0xwkz2mw/edit` | `/pets/cmr4cj05d0005rdvl0xwkz2mw/edit` |  |
| auth-39-pet-medications.png | `/pets/cmr4cj05d0005rdvl0xwkz2mw/medications` | `/pets/cmr4cj05d0005rdvl0xwkz2mw/health` | redirects (management lives in the Book) |
| auth-40-pet-medications-new.png | `/pets/cmr4cj05d0005rdvl0xwkz2mw/medications/new` | `/pets/cmr4cj05d0005rdvl0xwkz2mw/medications/new` |  |
| auth-41-pet-share.png | `/pets/cmr4cj05d0005rdvl0xwkz2mw/share` | `/pets/cmr4cj05d0005rdvl0xwkz2mw/share` |  |
| auth-42-profile.png | `/profile` | `/profile` |  |
| auth-43-settings.png | `/settings` | `/settings` |  |
| auth-44-settings-accounts.png | `/settings/accounts` | `/settings/accounts` | 4 console errors |
| auth-45-settings-integrations.png | `/settings/integrations` | `/settings/integrations` | 1 console error |
| auth-46-settings-notifications.png | `/settings/notifications` | `/settings/notifications` |  |
| auth-47-notifications.png | `/notifications` | `/notifications` |  |
| auth-48-messages.png | `/messages` | `/messages` |  |
| auth-49-message-conversation.png | `/messages/cmr4cj09j0024rdvl7q7hypdp` | `/messages/cmr4cj09j0024rdvl7q7hypdp` |  |
| auth-50-alerts.png | `/alerts` | `/alerts` | 2 console errors |
| auth-51-my-alerts.png | `/my-alerts` | `/my-alerts` |  |
| auth-52-report-new.png | `/report/new` | `/report/new` |  |
| auth-53-report-found.png | `/report/found` | `/report/found` |  |
| auth-54-sightings-report.png | `/sightings/report?alertId=cmr4cj05x000drdvlz56tfxsw` | `/sightings/report?alertId=cmr4cj05x000drdvlz56tfxsw` |  |
| auth-55-missions-report.png | `/missions/report` | `/report/new` | server redirect |
| auth-56-mission-coordinate.png | `/missions/AUS-2026-0001/coordinate` | `/mission-control?mission=AUS-2026-0001` | redirects |
| auth-57-mission-control.png | `/mission-control?mission=AUS-2026-0001` | `/mission-control?mission=AUS-2026-0001` | 2 console errors |
| auth-58-hub-new.png | `/hub/new` | `/hub/new` |  |
| auth-59-rescue-forces-create.png | `/rescue-forces/create` | `/rescue-forces/create` | 3 console errors |
| auth-60-rf-command-center.png | `/rescue-forces/cmr4cj06y000urdvlagzaski8/command-center` | `/rescue-forces/cmr4cj06y000urdvlagzaski8` | redirects |
| auth-61-rf-divisions.png | `/rescue-forces/cmr4cj06y000urdvlagzaski8/divisions` | `/rescue-forces/cmr4cj06y000urdvlagzaski8/divisions` | 4 console errors |
| auth-62-rf-division-detail.png | `/rescue-forces/cmr4cj06y000urdvlagzaski8/divisions/cmr4cj071000wrdvl9tbmsp8h` | `/rescue-forces/cmr4cj06y000urdvlagzaski8/divisions/cmr4cj071000wrdvl9tbmsp8h` |  |
| auth-63-rf-mission-control.png | `/rescue-forces/cmr4cj06y000urdvlagzaski8/mission-control` | `/rescue-forces/cmr4cj06y000urdvlagzaski8` | redirects |
| auth-64-rf-settings.png | `/rescue-forces/cmr4cj06y000urdvlagzaski8/settings` | `/rescue-forces/cmr4cj06y000urdvlagzaski8/settings` | 2 console errors |
| auth-65-communities-my-requests.png | `/communities/my-requests` | `/rescue-forces/search` | legacy 301 (next.config.js) |
| auth-66-communities-request.png | `/communities/request` | `/rescue-forces/search` | legacy 301 (next.config.js) |
| auth-67-divisions-request.png | `/divisions/request` | `/login?callbackUrl=/divisions/request` | orphaned page: session-loading race always bounces; no inbound links; 2 console errors |
| auth-68-patrol-database.png | `/patrol/database` | `/lost-and-found` | client redirect (via /database 301) |
| auth-69-patrol-join.png | `/patrol/join` | `/patrol/join` |  |
| auth-70-shelter-dashboard.png | `/shelter/dashboard` | `/shelter/dashboard` |  |
| auth-71-shelter-request.png | `/shelter/request` | `/shelter/request` |  |
| auth-72-simulate.png | `/simulate` | `/simulate` |  |
| auth-73-simulator.png | `/simulator` | `/simulator` |  |
| auth-74-admin.png | `/admin` | `/admin` | client-side nav (hard loads bounce — see above) |
| auth-75-admin-analytics.png | `/admin/analytics` | `/admin/analytics` | client-side nav (hard loads bounce — see above) |
| auth-76-admin-auto-migrate.png | `/admin/auto-migrate` | `/admin/auto-migrate` |  |
| auth-77-admin-check-config.png | `/admin/check-config` | `/admin/check-config` |  |
| auth-78-admin-communities.png | `/admin/communities` | `/admin/communities` |  |
| auth-79-admin-communities-create.png | `/admin/communities/create` | `/admin/communities/create` | 8 console errors |
| auth-80-admin-divisions.png | `/admin/divisions` | `/admin/divisions` |  |
| auth-81-admin-divisions-create.png | `/admin/divisions/create` | `/admin/divisions/create` |  |
| auth-82-admin-divisions-requests.png | `/admin/divisions/requests` | `/admin/divisions/requests` | 2 console errors |
| auth-83-admin-health.png | `/admin/health` | `/admin/health` |  |
| auth-84-admin-missions.png | `/admin/missions` | `/admin/missions` |  |
| auth-85-admin-missions-new.png | `/admin/missions/new` | `/admin/missions/new` | 2 console errors |
| auth-86-admin-mission-detail.png | `/admin/missions/cmr4cj05x000drdvlz56tfxsw` | `/admin/missions/cmr4cj05x000drdvlz56tfxsw` | 6 console errors |
| auth-87-admin-pets.png | `/admin/pets` | `/admin/pets` |  |
| auth-88-admin-prisma.png | `/admin/prisma` | `/admin/prisma` |  |
| auth-89-admin-qa.png | `/admin/qa` | `/admin/qa` |  |
| auth-90-admin-rescue-forces.png | `/admin/rescue-forces` | `/admin/rescue-forces` |  |
| auth-91-admin-rescue-forces-create.png | `/admin/rescue-forces/create` | `/admin/rescue-forces/create` |  |
| auth-92-admin-shelters.png | `/admin/shelters` | `/admin/shelters` | client-side nav (hard loads bounce — see above) |
| auth-93-admin-shelters-requests.png | `/admin/shelters/requests` | `/admin/shelters/requests` | client-side nav (hard loads bounce — see above) |
| auth-94-admin-users.png | `/admin/users` | `/admin/users` | client-side nav (hard loads bounce — see above) |
| auth-95-admin-wipe-squads.png | `/admin/wipe-squads` | `/admin/wipe-squads` |  |
| auth-96-legal-consent.png | `/legal/consent` | `/legal/consent` |  |
| auth-97-care.png | `/care` | `/pets` | signed-in redirect: one dashboard |
| auth-98-pet-health.png | `/pets/cmr4cj05d0005rdvl0xwkz2mw/health` | `/pets/cmr4cj05d0005rdvl0xwkz2mw/health` |  |
| auth-99-pet-today.png | `/pets/cmr4cj05d0005rdvl0xwkz2mw/today` | `/pets/cmr4cj05d0005rdvl0xwkz2mw/today` |  |
| auth-100-admin-pet-detail.png | `/admin/pets/cmr4cj05d0005rdvl0xwkz2mw` | `/admin/pets/cmr4cj05d0005rdvl0xwkz2mw` |  |
| auth-101-admin-user-detail.png | `/admin/users/cmr4cj0010001rdvl6h8bg1do` | `/admin/users/cmr4cj0010001rdvl6h8bg1do` |  |
| auth-102-alert-detail-authed.png | `/alerts/cmr4cj05x000drdvlz56tfxsw` | `/alerts` | redirects; 6 console errors |
| auth-103-mission-detail-authed.png | `/missions/AUS-2026-0001` | `/mission-control?mission=AUS-2026-0001` | redirects |
| auth-104-missions-legacy.png | `/missions` | `/lost-and-found` | legacy 301 (next.config.js) |
| auth-105-database-legacy.png | `/database` | `/lost-and-found` | legacy 301 (next.config.js) |

## Broken states captured (real bugs, not capture artifacts)

These screenshots faithfully show pages that are broken in the current build:

- **auth-50 / auth-51 (`/alerts`, `/my-alerts`)** — the page requests
  `/api/public/missions?status=OPEN`, but `OPEN` is not a valid `CaseStatus`,
  so the API 500s ("Failed to list public cases" banner in the shot).
- **auth-102 (`/alerts/[id]` while logged in)** — `AlertPageClient.js` reads
  `data.case` from `/api/public/missions/[id]`, but that API returns the
  mission at the top level; the resulting TypeError bounces the page to
  `/alerts`, so the capture shows the (also broken) alerts list.
- **auth-75 (`/admin/analytics`)** — the dashboard's full fetch
  (`/api/admin/analytics?days=30`) 500s: the route calls
  `prisma.case.groupBy({ by: ['lastSeenState'] })` and `lastSeenState` is not
  a `Case` field. The capture shows the "Failed to fetch analytics" error card.
- The `/admin` hub also links to `/admin/notifications`, `/admin/report-log`,
  `/admin/settings`, `/admin/audit` — routes that don't exist (404s; not captured).

## Console errors

Per-page console errors are recorded in [report.json](./report.json).
