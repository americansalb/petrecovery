# Page Screenshot Gallery

Full-page screenshots of every route in the app, captured 2026-06-12 against a local dev server
(PostgreSQL seeded via `frontend/prisma/seed.js` + `frontend/prisma/seed-sample-data.js`).

- `pub-*` — anonymous visitor session
- `auth-*` — logged in as a local ADMIN user

Notes:
- The 5 admin pages below marked *client-side nav* bounce on hard URL loads: their guard
  (`session?.user?.role !== 'ADMIN'` / `!session`) fires while NextAuth is still `loading`,
  so direct loads redirect to /dashboard even for admins. Captured by clicking in-app links
  with a warm session instead. Same race exists on /divisions/request (`!session` check),
  which has no inbound links anywhere — unreachable as shipped; its screenshot shows the bounce.
- Rows whose Final URL differs from Route document real redirect behavior (next.config.js
  permanent redirects and in-page bounces).

| Screenshot | Route | Final URL | Notes |
|---|---|---|---|
| auth-33-dashboard.png | `/dashboard` | `/dashboard` |  |
| auth-34-pets.png | `/pets` | `/pets` |  |
| auth-35-pets-new.png | `/pets/new` | `/pets/new` |  |
| auth-36-pet-detail.png | `/pets/cmqabxs530005a929sjfl7yev` | `/pets/cmqabxs530005a929sjfl7yev` |  |
| auth-37-pet-care.png | `/pets/cmqabxs530005a929sjfl7yev/care` | `/pets/cmqabxs530005a929sjfl7yev/care` |  |
| auth-38-pet-edit.png | `/pets/cmqabxs530005a929sjfl7yev/edit` | `/pets/cmqabxs530005a929sjfl7yev/edit` |  |
| auth-39-pet-medications.png | `/pets/cmqabxs530005a929sjfl7yev/medications` | `/pets/cmqabxs530005a929sjfl7yev/medications` |  |
| auth-40-pet-medications-new.png | `/pets/cmqabxs530005a929sjfl7yev/medications/new` | `/pets/cmqabxs530005a929sjfl7yev/medications/new` |  |
| auth-41-pet-share.png | `/pets/cmqabxs530005a929sjfl7yev/share` | `/pets/cmqabxs530005a929sjfl7yev/share` |  |
| auth-42-profile.png | `/profile` | `/profile` |  |
| auth-43-settings.png | `/settings` | `/settings` |  |
| auth-44-settings-accounts.png | `/settings/accounts` | `/settings/accounts` |  |
| auth-45-settings-integrations.png | `/settings/integrations` | `/settings/integrations` |  |
| auth-46-settings-notifications.png | `/settings/notifications` | `/settings/notifications` |  |
| auth-47-notifications.png | `/notifications` | `/notifications` |  |
| auth-48-messages.png | `/messages` | `/messages` |  |
| auth-49-message-conversation.png | `/messages/cmqabxs9d0024a9293h58ckve` | `/messages/cmqabxs9d0024a9293h58ckve` |  |
| auth-50-alerts.png | `/alerts` | `/alerts` |  |
| auth-51-my-alerts.png | `/my-alerts` | `/my-alerts` |  |
| auth-52-report-new.png | `/report/new` | `/report/new` |  |
| auth-53-report-found.png | `/report/found` | `/report/found` |  |
| auth-54-sightings-report.png | `/sightings/report` | `/sightings/report` |  |
| auth-55-missions-report.png | `/missions/report` | `/report/new` | redirects |
| auth-56-mission-coordinate.png | `/missions/AUS-2026-0001/coordinate` | `/mission-control` | redirects |
| auth-57-mission-control.png | `/mission-control` | `/mission-control` |  |
| auth-58-hub-new.png | `/hub/new` | `/hub/new` |  |
| auth-59-rescue-forces-create.png | `/rescue-forces/create` | `/rescue-forces/create` |  |
| auth-60-rf-command-center.png | `/rescue-forces/cmqabxs6p000ua929gqs4plru/command-center` | `/rescue-forces/cmqabxs6p000ua929gqs4plru` | redirects |
| auth-61-rf-divisions.png | `/rescue-forces/cmqabxs6p000ua929gqs4plru/divisions` | `/rescue-forces/cmqabxs6p000ua929gqs4plru/divisions` |  |
| auth-62-rf-division-detail.png | `/rescue-forces/cmqabxs6p000ua929gqs4plru/divisions/cmqabxs6t000wa929tdbho5l0` | `/rescue-forces/cmqabxs6p000ua929gqs4plru/divisions/cmqabxs6t000wa929tdbho5l0` |  |
| auth-63-rf-mission-control.png | `/rescue-forces/cmqabxs6p000ua929gqs4plru/mission-control` | `/rescue-forces/cmqabxs6p000ua929gqs4plru` | redirects |
| auth-64-rf-settings.png | `/rescue-forces/cmqabxs6p000ua929gqs4plru/settings` | `/rescue-forces/cmqabxs6p000ua929gqs4plru/settings` |  |
| auth-65-communities-my-requests.png | `/communities/my-requests` | `/rescue-forces/search` | redirects |
| auth-66-communities-request.png | `/communities/request` | `/rescue-forces/search` | redirects |
| auth-67-divisions-request.png | `/divisions/request` | `/login` | orphaned page: always bounces, no inbound links |
| auth-68-patrol-database.png | `/patrol/database` | `/lost-and-found` | redirects |
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
| auth-79-admin-communities-create.png | `/admin/communities/create` | `/admin/communities/create` |  |
| auth-80-admin-divisions.png | `/admin/divisions` | `/admin/divisions` |  |
| auth-81-admin-divisions-create.png | `/admin/divisions/create` | `/admin/divisions/create` |  |
| auth-82-admin-divisions-requests.png | `/admin/divisions/requests` | `/admin/divisions/requests` |  |
| auth-83-admin-health.png | `/admin/health` | `/admin/health` |  |
| auth-84-admin-missions.png | `/admin/missions` | `/admin/missions` |  |
| auth-85-admin-missions-new.png | `/admin/missions/new` | `/admin/missions/new` |  |
| auth-86-admin-mission-detail.png | `/admin/missions/cmqabxs5n000da9297l0twi4l` | `/admin/missions/cmqabxs5n000da9297l0twi4l` |  |
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
| pub-01-home.png | `/` | `/` |  |
| pub-02-lost-and-found.png | `/lost-and-found` | `/lost-and-found` |  |
| pub-03-about.png | `/about` | `/about` |  |
| pub-04-about-sarama.png | `/about-sarama` | `/about-sarama` |  |
| pub-05-advice.png | `/advice` | `/advice` |  |
| pub-06-contact.png | `/contact` | `/contact` |  |
| pub-07-found.png | `/found` | `/report/found` | redirects |
| pub-08-shelters.png | `/shelters` | `/shelters` |  |
| pub-09-login.png | `/login` | `/login` |  |
| pub-10-register.png | `/register` | `/register` |  |
| pub-11-forgot-password.png | `/forgot-password` | `/forgot-password` |  |
| pub-12-reset-password.png | `/reset-password` | `/reset-password` |  |
| pub-13-verify-email.png | `/verify-email` | `/verify-email` |  |
| pub-14-legal-terms.png | `/legal/terms` | `/legal/terms` |  |
| pub-15-legal-consent.png | ? | ? | |
| pub-16-privacy.png | `/privacy` | `/privacy` |  |
| pub-17-offline.png | `/offline` | `/offline` |  |
| pub-18-case-portal.png | `/cases/AUS-2026-0001` | `/cases/AUS-2026-0001` |  |
| pub-19-lost-pet-location.png | `/lost-pet/austin-tx` | `/lost-pet/austin-tx` |  |
| pub-20-pet-public-view.png | `/pets/view/9eS0w0vX4PY5Cpd3xmKoGc80C7A7tGd7flIDvZ3pyMc` | `/pets/view/9eS0w0vX4PY5Cpd3xmKoGc80C7A7tGd7flIDvZ3pyMc` |  |
| pub-21-hub.png | `/hub` | `/hub` |  |
| pub-22-hub-search.png | `/hub/search` | `/hub/search` |  |
| pub-23-hub-category.png | `/hub/c/lost-pet-help` | `/hub/c/lost-pet-help` |  |
| pub-24-hub-thread.png | `/hub/thread/tips-for-shy-cats-hiding-nearby` | `/hub/thread/tips-for-shy-cats-hiding-nearby` |  |
| pub-25-hub-user.png | `/hub/u/cmqabxrzz0001a929m2i3yf0a` | `/hub/u/cmqabxrzz0001a929m2i3yf0a` |  |
| pub-26-report-public-mission.png | `/reports/cmqabxs5n000da9297l0twi4l` | `/reports/cmqabxs5n000da9297l0twi4l` |  |
| pub-27-alert-detail.png | `/alerts/cmqabxs5n000da9297l0twi4l` | `/login` | redirects |
| pub-28-join-mission.png | `/join/cmqabxs5n000da9297l0twi4l` | `/join/cmqabxs5n000da9297l0twi4l` |  |
| pub-29-mission-detail.png | `/missions/AUS-2026-0001` | `/mission-control` | redirects |
| pub-30-rescue-forces.png | `/rescue-forces` | `/rescue-forces/search` | redirects |
| pub-31-rescue-forces-search.png | `/rescue-forces/search` | `/rescue-forces/search` |  |
| pub-32-rescue-force-detail.png | `/rescue-forces/cmqabxs6p000ua929gqs4plru` | `/rescue-forces/cmqabxs6p000ua929gqs4plru` |  |
