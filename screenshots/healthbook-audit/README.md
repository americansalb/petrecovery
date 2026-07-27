# Health Book UI/UX audit captures

Companion captures for [`docs/HEALTHBOOK_UIUX_AUDIT.md`](../../docs/HEALTHBOOK_UIUX_AUDIT.md)
(2026-07-27). Unlike the route gallery one level up, these are
state-driven: eight seeded fixture pets exercise every status the Health
Book can reach, across viewports, roles, and failure modes.

Naming: `<phase>-<viewport>-<pet>-<surface>-<state>.png`

| Phase | Contents |
|-------|----------|
| `a*`  | Owner, desktop 1440px — pristine Overview/Vaccines/Weight/Vet for all eight fixture pets |
| `b*`  | Interactions — Add-vaccine modal (presets, validation, future date), manage/remove, weight validation, vet edit, deep links |
| `c*`  | Today-page glance, profile ribbon target, landing lane, care wizard, admin detail |
| `d*`  | Mobile 390px and tiny 320px, incl. the bottom-sheet modal |
| `e*`  | Public share view (clinical face) desktop + mobile + bad token |
| `f*`  | Roles — VIEWER, CAREGIVER, no-access |
| `g*`  | Failure modes — API 500s, loading, logged out, bad pet id |

Fixture pets: Pip/Luna (empty), Willow (no-expiry records), Mochi (due
soon, vet phone only, single weight), Biscuit (two expired incl. 14
months stale), Max (base seed, due soon, active case), Sir Reginald
(long everything), Atlas (8 live vaccines incl. same-name duplicate, 59
weights incl. outlier typo, 3-year span).

`_run-log.json` holds the Playwright driver's probe notes (URL state,
modal focus, 320px overflow) and harness failures.

Regenerate: fixtures via the audit seeder, then the driver scripts —
both archived in the session scratchpad; the driver logs in as
`admin@localdev.test` / `sarah@` / `mike@` (see
`frontend/prisma/seed-sample-data.js`).
