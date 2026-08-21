# Launch-audit capture set — 2026-08-21

155 screenshots taken for the pre-launch audit (`docs/LAUNCH_AUDIT_2026-08.md`).
This set exists because the standing gallery in `../` captures only **full-page
desktop** views, which hide three things that decide whether a launch goes well:
what a visitor actually sees *first*, what the product looks like *on a phone*,
and what happens when something goes *wrong*.

Captured against a local dev server (`npm run dev`) with the database seeded by
`frontend/prisma/seed-sample-data.js`, logged in as `admin@localdev.test` and, for
the empty-state pass, as the regular member `sarah@localdev.test`.

Regenerate with:

```bash
cd frontend
node scripts/audit-sweep-2026-08.js /tmp/seed-ids.json   # public + mobile + states
node scripts/audit-sweep-authed.js  /tmp/seed-ids.json   # signed-in passes
node scripts/audit-probe-mobile-cta.js AUS-2026-0001     # the CTA occlusion probe
```

`report.json` holds the route, final URL, viewport and console errors for every
navigation.

## Directories

| dir | count | what it is |
|---|---|---|
| `fold/` | 43 | 1440x900 **viewport only** — the first screenful, before any scroll. 01-28 anonymous, 50-64 signed in. |
| `mob/` | 86 | 390x844 iPhone-class, `-fold` (first screenful) and `-full` (whole page) for each route. |
| `state/` | 26 | Error, empty, wizard-step and open-menu states, plus the member (non-admin) pass. |

## Capture artifacts — not bugs

Three things render wrong here because of the sandbox, not because of the code:

- **The logo and the Sarama mascot appear as broken-image alt text** ("Reuni",
  "ReunitePets", "Sarama, Your Guide Home"). The sandbox blocks
  `petrescue.b-cdn.net`.
- **Map tiles** are blank or partial grey grids for the same reason, except where
  the capture script successfully re-issued them through Playwright's request API.
- **Seeded pets use flat cartoon illustrations** instead of photos. That is seed
  data.

One more, specific to this run: several signed-in screens were captured while the
dev server was serving a Playwright sweep and about ten audit subagents at once,
so some show a loading state (`fold/56-mission-control.png`,
`mob/63-admin-fold.png`). On a quiet server the same routes render in well under a
second. Do not read those as hangs.

## Shots that carry a finding

| screenshot | what it shows |
|---|---|
| `state/30-mobile-case-scrolled-cta.png` | The sticky "I've Seen Max" bar sits at 743-844px behind the global tab bar at 779-844px (z-40 vs z-50). Measured hit test: the CTA's centre point is not clickable. |
| `mob/05-case-fold.png` | On a phone the same CTA starts 166px below the fold — the pet photo fills the first screenful. |
| `mob/51-pets-fold.png`, `mob/56-mission-control-fold.png` | The green "Stay Connected" push prompt covering roughly 40% of the viewport, over a still-loading page. |
| `auth-52-report-new.png` (in `../`) | The same prompt over step 1 of the lost-pet report wizard. |
| `fold/60-settings.png`, `mob/60-settings-full.png` | Emoji tab icons and a lavender active tab; the dead "Delete Account" button in the Danger Zone. |
| `fold/59-my-alerts.png`, `state/34-member-my-alerts.png` | Royal-blue header and red button, off the midnight/flash system. |
| `state/35-member-admin-403.png` | A signed-in non-admin visiting `/admin` gets raw JSON in Chrome's viewer. |
| `fold/26-404.png` | The 404 page in bootstrap blue and red, unlike the on-brand `state/13-bad-case-number.png`. |
| `pub-28-join-mission.png` (in `../`), `mob/22-join-mission-fold.png` | "Golden DOG • Golden Retriever" — the species enum printed raw. |
| `pub-18-case-portal.png` (in `../`) | The empty white Recovery Kit card below the activity timeline. |

## Shots worth keeping for the opposite reason

`auth-57-mission-control.png`, `fold/62-shelter-dashboard.png`,
`fold/01-home.png`, `mob/01-home-fold.png`, `mob/03-report-new-fold.png`,
`state/13-bad-case-number.png`, `state/01-login-wrong-password.png`.

## Known mislabel

`state/07-lost-and-found-no-results.png` was captured with `?search=`, but the
page reads `?q=`. It shows the normal board, not an empty state. The empty state
is untested here.
