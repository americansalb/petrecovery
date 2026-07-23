# Permissions: the canonical model

One page, one truth. If a route checks authority any way other than what
this page says, the route is wrong, not this page. Audited 2026-07-21
(full findings in the session that produced this doc; fix batches below).

## The principle: one human, one account, many hats

There are no "shelter accounts," "rescuer accounts," or "owner accounts"
as separate kinds of login. There is ONE `User`. Authority comes from
relationships (hats) attached to that user. A shelter director who owns
a dog and volunteers weekends is one account wearing three hats, never
three logins. The only account-level split is `role`.

## Account-level roles (`User.role`)

| Role | Meaning | Status |
|---|---|---|
| `USER` | everyone; all power comes from hats | canonical |
| `ADMIN` | platform staff: full admin panel + override on everything | canonical |
| `MODERATOR` | limited hub/mission moderation | semi-used; fold into hats long-term |
| `GUEST`, `PATROL` | written by legacy flows, gate nothing | vestigial; do not build on |

There is deliberately NO `DEV` role. Dev/seed endpoints are environment
guarded (`NODE_ENV`), never role-guarded, so a role typo can never turn
a production user into a developer. Founder bootstrap:
`FOUNDER_ADMIN_EMAILS` in `app/lib/auth.js` force-promotes on login.
Seeded prod admins are auth-blocked (SEC-18); never "fix" that.

## The hats (contextual authority)

| Hat | Where it lives | Tiers (low to high) | Canonical check |
|---|---|---|---|
| Case authority | `Case.reporterId`, squad assignment | reporter; assigned-squad leadership; admin | `userHasCaseAuthority` (authz.js) |
| Rescue Force member | `RescueForceMember` | MEMBER < COORDINATOR < LEADER < FOUNDER | `userIsSquadLeader` (authz.js) |
| Pet access | `Pet.ownerId`, `PetShare`, shelter roster | VIEWER < CAREGIVER < OWNER (owner, or shelter staff for roster pets) | `requirePetAccess` / `requirePetOwner` (petOwnership.js) |
| Shelter team | `ShelterProfile.claimedById` (implicit OWNER), `ShelterMember` | STAFF < MANAGER < OWNER | `getShelterForUser` / `userManagesShelter` (shelterAuth.js) |
| Hub moderator | `ForumProfile.isModerator` | mod or not (admin implies mod) | needs ONE helper (Batch C) |

## The two iron rules

1. **Authority reads the database, fresh.** The JWT's `role` claim is a
   UI hint (what nav to render), never an enforcement input. A promotion
   or demotion must take effect on the next request, not in 30 days when
   the token expires. Server-side checks go through the canonical
   helpers above, which all read the DB.
2. **One helper per question.** "Is this user an admin?" is answered by
   `authz.isAdmin` and nothing else. No inline `user.role !== 'ADMIN'`
   copies, no parallel session-based twins for enforcement
   (`permissions.js` is UI-only and must never gate an API route), no
   role strings that don't exist in the schema.

## Enforcement map

- `middleware.js`: defense-in-depth for `/admin` + `/api/admin` prefixes
  (JWT-based, fast). Every privileged API route still carries its own
  DB-fresh check; middleware is never the only gate.
- API routes: canonical helpers only.
- Client pages: may use session role for rendering decisions; never as
  the only protection for data.

## Audit findings and fix batches (2026-07-21)

**Batch A: surgical, high severity**
1. `authz.js` squad-leader check matches only legacy role names
   (`MODERATOR`,`ADMIN`); real leaders (FOUNDER/LEADER/COORDINATOR) are
   silently denied in notifications/send, mission command, live search.
   Fix the list, keep legacy MODERATOR for old rows.
2. `/api/shelters/enrich`: unauthenticated write to any Shelter row.
   Gate or remove.
3. `rescue-forces/[id]/announcements`: gate checks three role strings
   that don't exist; the feature is deny-all dead. Fix to real roles.
4. `webhooks/resend`: signature check is skip-with-warning when the
   secret is unset. Fail closed.
5. Simulator batch endpoints write unauthenticated. Env-guard them.

**Batch B: kill the JWT drift**
6. 31 routes trust `session.user.role` for admin/moderator power (list
   in audit). Convert to `authz.isAdmin`/helpers.
7. The session-update path lets the CLIENT supply a new role into the
   token. Re-read from DB instead.
8. Mission-route split personality: some siblings use
   `userHasCaseAuthority`, others raw session role. Converge on
   `userHasCaseAuthority`.

**Batch C: consolidation and dead code**
9. Add `requireAdmin()` to authz.js; migrate the ~25 inline
   `findUnique -> role !== 'ADMIN'` copies onto it.
10. Demote `permissions.js` to UI-only (rename exports or add a loud
    comment); delete the third local `requireAdmin` in admin/groups.
11. One `isHubModerator(userId)` helper; use it in the three hub files
    that each compute it differently.
12. Delete dead role branches: `SUPER_ADMIN`, `EMERGENCY_COORDINATOR`,
    `COMMANDER`/`DIVISION_LEAD` in volunteer/leadership.
13. SEC-18 blocklist is duplicated in mobile login; import from one
    place.

## When adding a new feature

Ask: which hat governs this? Use that hat's canonical helper. If no hat
fits, the feature probably belongs to an existing hat you haven't
recognized yet; adding a new account-level role is almost always wrong.
