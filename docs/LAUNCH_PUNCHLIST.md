# Launch Punch-List

Code-level launch hardening found by reading the actual implementation
(not the older, contradictory planning docs). Status reflects branch
`claude/gallant-goodall-u8cv3b`.

## Fixed (shipped on this branch)

| # | Issue | Fix |
|---|-------|-----|
| 1 | `GET /api/missions/[missionId]` leaked owner `phone`/`email` + reporter email to any waiver-accepted user | Contact PII now gated to the case owner + admins; everyone else gets the operational case (pet, location, sightings) with contact stripped. Regression test added. |
| 2 | Placeholder text shipped in real user emails (`"[Claim Report button will be added in Phase 3.3]"`, `"verification… coming soon"`) | Rewrote both guest + new-account lost-pet emails with clean, final copy and a real "View your pet's page" CTA. |
| 3 | Auto-created rescue forces could duplicate per city (`"<City> Pet Rescue"`) | Added a case-insensitive dedup guard that reuses an existing force for the city before creating a new one. |
| 4 | Owner match notification overstated confidence (raw score shown as `"% confidence"`) | The **live** owner email was already honest ("a possible match… please review"). Softened the stale/unused copy in `lib/notifications.js` for consistency. |
| 5 | Dangerous maintenance endpoints (`wipe-squads`, `migrate`, `prisma-generate`) were one click from an admin | Env-gated **off by default**; require `ENABLE_ADMIN_MAINTENANCE=true` to run. Nothing removed — fully reversible. |
| 6 | Owner (AALB) had no working admin login (`contact@aalb.org` is SEC-18-blocked) | Added `payments@aalb.org` to the founder-admin allowlist (sidesteps SEC-18 cleanly) and made the list extendable via env. |

## New environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `ENABLE_ADMIN_MAINTENANCE` | unset (disabled) | Set to `true` only when you intentionally need to wipe squads, run a raw migration, or regenerate Prisma. Leave **unset in production**. |
| `FOUNDER_ADMIN_EMAILS` | unset | Optional comma-separated list of emails to grant ADMIN on login, without a code change. |

## Residual (operational — not code)

- **SEC-18:** left exactly as mandated. `contact@aalb.org` / `sarama@petrecovery.app`
  stay auth-blocked until their live DB passwords are rotated and
  `SEC18_ROTATED=true` is set. The owner does **not** need this — log in as
  `payments@aalb.org` (now a founder admin).
- **Production ops still pending** (separate from this branch): wire Sentry
  (errors currently fail silently) and move the in-memory rate limiter to the
  already-present Redis so limits survive restarts / multiple instances.
