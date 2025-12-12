# Feature Spec: Roles, Permissions & Mission Assignment MVP (Phase 22–24)

**Status:** ❌ Not Started
**Owner:** Product + Engineering
**Last Updated:** November 25, 2025
**Phase:** 22–24 (Roles, Permissions & Mission Assignment MVP)

---

## 0. Summary

We're building a **clear roles and permissions model** plus **explicit mission assignment workflow** to establish who can do what and who is responsible for each mission. This MVP focuses on:

- **Global role enforcement**: Consistent permission checks across all admin surfaces (`/admin/health`, `/admin/qa`, `/admin/missions`, etc.).
- **Mission coordinator tracking**: Each mission has an optional "primary coordinator" responsible for its progress.
- **Owning squad clarity**: Explicit assignment of missions to rescue squads (building on existing `squadId` relationship).
- **Full observability**: All permission failures and assignment changes emit structured events visible in `/admin/health`.

This is a **minimal, pragmatic** implementation:
- No complex RBAC system with fine-grained per-field ACLs
- No arbitrary policy engine
- Built on existing `User.role` enum (ADMIN, MODERATOR, PATROL, USER)
- Leverages existing mission and squad infrastructure

**Key Principles:**

- **Explicit over implicit**: Clear permission helpers, not scattered role checks
- **Observable failures**: Permission denials logged with `auth.permission_denied` events
- **Ownership clarity**: Every mission should have a clear "who's responsible?"
- **No breaking changes**: All existing functionality preserved

---

## 1. Problem / Why

### Current State Problems

**1. Inconsistent Admin Gating**
- Some admin pages check `session.user.role === 'ADMIN'`, others don't
- No centralized permission logic
- Easy to forget checks when adding new admin endpoints
- Hard to audit "who can access what?"

**2. No Explicit Mission Ownership**
- Missions have `createdById` (who created) and optional `squadId` (which squad)
- But no clear "primary coordinator" or "who's driving this mission?"
- Hard to answer:  - "Which missions have no one assigned?"
  - "Who should I notify when status changes?"
  - "Who's accountable for follow-up?"

**3. Unclear Permission Model**
- Global roles exist (`UserRole` enum) but usage is ad-hoc
- Squad roles exist (`RescueSquadMemberRole`) but don't interact with global permissions
- No shared vocabulary: "Can a MODERATOR edit missions?" "Can PATROL users create squads?"

**Why This Matters:**

- **Security**: Admin-only tools need consistent gating
- **Accountability**: Missions need clear owners for follow-up and metrics
- **Scalability**: As team grows, need clear roles and responsibilities
- **User Experience**: Coordinators need visibility into "their" missions

---

## 2. Goals / Non-goals

### Goals

**Global Roles & Permissions (MVP):**

- Define a **clear permission model** based on existing `UserRole` enum:
  - `ADMIN` – Full access to all admin tools, can assign coordinators, manage missions
  - `MODERATOR` – Can view admin tools, limited mission management (future: may help coordinate)
  - `PATROL` – Regular patrol members, can view assigned missions (via squad)
  - `USER` – Pet owners, can view own missions

- Create a **centralized permission helper** module:
  - `requireAdmin(session)` – throws if not ADMIN
  - `requireStaffOrAdmin(session)` – MODERATOR or ADMIN
  - `canEditMission(session, missionData)` – coordinator, squad leader, or ADMIN
  - `canAssignMission(session, missionData)` – ADMIN only for MVP

- **Gate all admin surfaces**:
  - `/admin/health` – ADMIN only
  - `/admin/qa` – ADMIN only
  - `/admin/missions/*` – ADMIN only (MVP; future: coordinators can view assigned)

- **Log permission failures**:
  - Emit `auth.permission_denied` events with actor, resource, required role

**Mission Assignment (MVP):**

- Add `coordinatorId` field to `LostPetMission`:
  - Optional `User` relation
  - Represents primary person responsible for mission progress
  - Can be ADMIN or MODERATOR (staff roles)

- Keep existing `squadId` field:
  - Already links mission to RescueSquad
  - For MVP, no changes needed; just clarify it as "owning squad"

- Create **assignment APIs**:
  - `POST /api/missions/[id]/assign-coordinator` – change coordinator
  - `PATCH /api/missions/[id]` – update `squadId` if needed (or separate endpoint)

- **Assignment change logging**:
  - Emit `mission.assignment_changed` events with previous and new values
  - Track who made the change and when

**UI/UX (MVP):**

- Admin mission list/detail:
  - Show current coordinator name (or "Unassigned")
  - Show owning squad name (or "No squad")
  - ADMIN can change both via simple dropdowns/select controls

- Visual indicators:
  - "ADMIN ONLY" badges on gated pages
  - Permission denied errors rendered clearly

### Non-goals (for MVP)

**Out of scope:**

- **No general RBAC engine**: Not building an arbitrary policy system
- **No per-field ACLs**: Not restricting who can edit specific mission fields
- **No complex role hierarchies**: No "teams" or "departments" beyond squads
- **No notification changes**: Assignment doesn't trigger new notifications (Phase 25-26 already handles status changes; future phase can add coordinator notifications)
- **No public-facing changes**: Assignment is internal operations only
- **No self-assignment**: For MVP, only ADMIN assigns; future: coordinators may self-assign

---

## 3. User Stories

### Admin

- **As an ADMIN**, I can access `/admin/health`, `/admin/qa`, and `/admin/missions` without interruption.
- **As an ADMIN**, I can assign a coordinator to any mission via simple dropdown UI.
- **As an ADMIN**, I can see at a glance which missions have no coordinator assigned (filter/sort).
- **As an ADMIN**, I can change a mission's owning squad if it was initially assigned incorrectly.
- **As an ADMIN**, I see clear permission denied errors if something goes wrong.

### Moderator (Future Staff Role)

- **As a MODERATOR**, I can view missions assigned to me but cannot access all admin tools like health or QA.
- **As a MODERATOR**, I can edit mission details and status for missions I coordinate.

### Patrol / Volunteer

- **As a PATROL member**, I am redirected away from admin-only pages with a clear message.
- **As a PATROL member**, I can view missions assigned to my squad (future enhancement).

### Platform / Operations

- **As the platform operator**, I want permission failures logged so I can audit access attempts.
- **As the platform operator**, I want assignment changes logged so I can track accountability.
- **As the platform operator**, I want a clear audit trail of who changed mission coordinators and when.

---

## 4. Roles & Permission Model

### Global Roles (UserRole Enum)

Based on existing `User.role` field in schema:

| Role | Description | Typical Use Mission |
|------|-------------|------------------|
| **ADMIN** | Platform administrator | Full access to all admin tools, mission management, squad oversight |
| **MODERATOR** | Staff coordinator | Internal team member who can coordinate missions, limited admin access |
| **PATROL** | Patrol member/volunteer | Searches for pets via squads, can view squad-assigned missions |
| **USER** | Pet owner | Submits missions, views own missions |

### Squad Roles (RescueSquadMemberRole)

Existing squad-level roles (unchanged for MVP):

| Role | Description |
|------|-------------|
| **FOUNDER** | Created the squad |
| **LEADER** | Can accept missions, manage squad members |
| **COORDINATOR** | Can coordinate searches, post updates |
| **MEMBER** | Regular volunteer searcher |

**Note:** Squad roles are **orthogonal** to global roles. A user can be:
- Global ADMIN + FOUNDER of a squad
- Global PATROL + LEADER of a squad
- Global MODERATOR + not in any squad

For MVP, **global roles take precedence** for admin surface access.

### Permission Matrix (MVP)

Access rules for key operations:

| Operation | ADMIN | MODERATOR | PATROL | USER |
|-----------|-------|-----------|--------|------|
| View `/admin/health` | ✅ | ❌ | ❌ | ❌ |
| View `/admin/qa` | ✅ | ❌ | ❌ | ❌ |
| View `/admin/missions` | ✅ | ❌ † | ❌ † | ❌ |
| Create mission (admin) | ✅ | ✅ | ❌ | ❌ |
| Edit mission status | ✅ | ✅ * | ❌ † | ❌ |
| Add mission notes | ✅ | ✅ * | ❌ † | ❌ |
| Assign coordinator | ✅ | ❌ | ❌ | ❌ |
| Change owning squad | ✅ | ❌ | ❌ | ❌ |

**Legend:**
- ✅ = Allowed
- ❌ = Denied
- † = Future: may allow for assigned missions
- \* = Future: only for missions they coordinate

**MVP Simplification**: For Phase 22-24, only ADMIN can access admin tools and manage all missions. MODERATOR support is designed in but not fully wired (future phase).

---

## 5. Mission Assignment Model

### Data Model

**Add to `LostPetMission`:**

```prisma
model LostPetMission {
  // ... existing fields ...

  // NEW: Mission Assignment (Phase 22-24)
  coordinatorId   String?
  coordinator     User?         @relation("MissionCoordinator", fields: [coordinatorId], references: [id])

  // EXISTING: Owning squad (already present, just clarifying semantics)
  squadId         String?
  squad           RescueSquad?  @relation(fields: [squadId], references: [id])
}
```

**Update `User` model relations:**

```prisma
model User {
  // ... existing relations ...

  // NEW: Missions coordinated by this user
  coordinatedMissions  LostPetMission[]  @relation("MissionCoordinator")
}
```

**Semantics:**

- `coordinatorId` = primary person responsible (typically ADMIN or MODERATOR)
- `squadId` = rescue squad assigned to help (already exists)
- Both are **optional** and **independent**:
  - A mission can have a coordinator but no squad
  - A mission can be assigned to a squad but no specific coordinator
  - A mission can have both
  - A mission can have neither (unassigned)

### Assignment Rules

**Who can be a coordinator?**
- For MVP: Users with role `ADMIN` or `MODERATOR`
- Cannot assign regular `USER` or `PATROL` as coordinator (they're not staff)

**Who can assign coordinators?**
- For MVP: Only `ADMIN` role
- Future: Coordinators may reassign to others

**Assignment Lifecycle:**

1. Mission created → `coordinatorId = null` (unassigned)
2. Admin assigns coordinator → `coordinatorId = userId`
3. Coordinator changed → old coordinator removed, new one assigned
4. Coordinator removed → `coordinatorId = null` (back to unassigned)

**Migration:**

- Existing missions will have `coordinatorId = null` after migration
- No automatic assignment (admin can manually assign as needed)

---

## 6. Backend Permission Enforcement

### Permission Helper Module

Create `/frontend/app/lib/permissions.js`:

```javascript
import { logEvent } from '@/lib/logging';

/**
 * Get user's role from session (with fallback to USER)
 */
export function getUserRole(session) {
  return session?.user?.role || 'USER';
}

/**
 * Require ADMIN role or throw
 * Logs permission_denied event on failure
 */
export async function requireAdmin(session, context = {}) {
  const role = getUserRole(session);

  if (role !== 'ADMIN') {
    await logEvent({
      event_type: 'auth.permission_denied',
      resource_type: context.resource_type || 'unknown',
      resource_id: context.resource_id || null,
      action: context.action || 'access',
      result: 'failure',
      error_code: 'INSUFFICIENT_PERMISSIONS',
      error_message: `User with role ${role} attempted to access ADMIN-only resource`,
      actor_user_id: session?.user?.id || null,
      actor_role: role,
      metadata: {
        required_role: 'ADMIN',
        ...context.metadata
      }
    });

    throw new PermissionError('Admin access required', { required: 'ADMIN', actual: role });
  }
}

/**
 * Require ADMIN or MODERATOR
 */
export async function requireStaffOrAdmin(session, context = {}) {
  const role = getUserRole(session);

  if (role !== 'ADMIN' && role !== 'MODERATOR') {
    await logEvent({
      event_type: 'auth.permission_denied',
      resource_type: context.resource_type || 'unknown',
      resource_id: context.resource_id || null,
      action: context.action || 'access',
      result: 'failure',
      error_code: 'INSUFFICIENT_PERMISSIONS',
      error_message: `User with role ${role} attempted to access staff resource`,
      actor_user_id: session?.user?.id || null,
      actor_role: role,
      metadata: {
        required_role: 'ADMIN or MODERATOR',
        ...context.metadata
      }
    });

    throw new PermissionError('Staff access required', { required: 'ADMIN or MODERATOR', actual: role });
  }
}

/**
 * Check if user can edit mission
 * MVP: Only ADMIN
 * Future: Also coordinator, squad leaders
 */
export function canEditMission(session, missionData) {
  const role = getUserRole(session);

  // ADMIN can edit all missions
  if (role === 'ADMIN') {
    return true;
  }

  // Future: MODERATOR can edit if they're the coordinator
  // if (role === 'MODERATOR' && missionData.coordinatorId === session.user.id) {
  //   return true;
  // }

  // Future: Squad leaders can edit squad missions

  return false;
}

/**
 * Check if user can assign mission coordinator
 * MVP: Only ADMIN
 */
export function canAssignMission(session) {
  return getUserRole(session) === 'ADMIN';
}

/**
 * Custom error for permission failures
 */
export class PermissionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'PermissionError';
    this.details = details;
  }
}
```

### Where to Apply

Apply permission checks to:

**Admin Pages (Client-Side):**
- `/admin/health/page.jsx` – add `requireAdmin`
- `/admin/qa/page.js` – already has check, but use helper for consistency
- `/admin/missions/page.js` – add `requireAdmin`
- `/admin/missions/[id]/page.js` – add `requireAdmin`
- `/admin/missions/new/page.js` – add `requireAdmin`

**Admin APIs (Server-Side):**
- All `/api/missions/*` routes – use `requireStaffOrAdmin`
- New assignment endpoints – use `requireAdmin`
- `/api/admin/*` endpoints – use `requireAdmin`

**Example API Usage:**

```javascript
import { requireAdmin, PermissionError } from '@/app/lib/permissions';

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);

  try {
    await requireAdmin(session, {
      resource_type: 'mission',
      resource_id: params.id,
      action: 'assign_coordinator'
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({
        error: 'Permission denied',
        message: error.message,
        details: error.details
      }, { status: 403 });
    }
    throw error;
  }

  // ... proceed with coordinator assignment ...
}
```

---

## 7. Assignment APIs

### POST /api/missions/[id]/assign-coordinator

**Purpose:** Assign or change the mission coordinator.

**Request:**
```json
{
  "coordinatorId": "clx123abc..." // User ID, or null to unassign
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "mission": {
    "id": "...",
    "missionNumber": "CHI-2025-001",
    "coordinatorId": "clx123abc...",
    "coordinator": {
      "id": "clx123abc...",
      "firstName": "Jane",
      "role": "ADMIN"
    }
  },
  "message": "Coordinator assigned successfully"
}
```

**Errors:**
- `401` – Not authenticated
- `403` – Insufficient permissions (not ADMIN)
- `404` – Mission not found
- `400` – Invalid coordinator ID, or coordinator doesn't have ADMIN/MODERATOR role

**Events Logged:**
- `mission.assignment_changed` (success)
- `auth.permission_denied` (permission failure)
- `mission.assign_coordinator_failed` (validation failure)

### PATCH /api/missions/[id]/squad

**Purpose:** Assign or change the owning squad.

**Request:**
```json
{
  "squadId": "clx456def..." // RescueSquad ID, or null to unassign
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "mission": {
    "id": "...",
    "missionNumber": "CHI-2025-001",
    "squadId": "clx456def...",
    "squad": {
      "id": "clx456def...",
      "name": "Chicago Rescue Squad",
      "city": "Chicago",
      "state": "IL"
    }
  },
  "message": "Squad assigned successfully"
}
```

**Errors:** Same as coordinator endpoint.

**Events Logged:**
- `mission.squad_assigned` (success)
- `auth.permission_denied` (permission failure)

**Alternative:** Could integrate squad assignment into main mission update endpoint (`PATCH /api/missions/[id]`) but dedicated endpoint makes logging and permissions clearer.

---

## 8. UI / UX

### Admin Mission List Page (`/admin/missions`)

**Changes:**

1. **Add columns:**
   - "Coordinator" column showing:
     - Coordinator name (e.g. "Jane Doe")
     - Or "Unassigned" in gray
   - "Squad" column already exists, keep as-is

2. **Filter/Sort:**
   - Add filter: "Unassigned missions" (where `coordinatorId === null`)
   - Sort by coordinator name

3. **Role Badge:**
   - Add "ADMIN ONLY" badge at top of page to make gating explicit

### Admin Mission Detail Page (`/admin/missions/[id]`)

**Changes:**

1. **Assignment Section:**
   - Add new "Assignment" card/section below mission details:
     ```
     ┌─ Assignment ──────────────────────────┐
     │ Coordinator:   [Dropdown: Select...] │
     │ Owning Squad:  [Dropdown: Select...] │
     │                                       │
     │ [Save Changes]                        │
     └───────────────────────────────────────┘
     ```

2. **Coordinator Dropdown:**
   - Options: All users with role ADMIN or MODERATOR
   - Plus "Unassigned" option
   - Shows current coordinator as selected

3. **Squad Dropdown:**
   - Options: All active RescueSquads
   - Plus "No squad" option
   - Shows current squad as selected

4. **Save Behavior:**
   - Only shows "Save" button if values changed
   - Calls assignment APIs
   - Shows success/error toast
   - Refreshes mission data

### Permission Denied UI

**Redirect behavior:**
- If non-ADMIN accesses `/admin/*`:
  - Redirect to `/dashboard` with toast: "Admin access required"
  - Log `auth.permission_denied` event

**Example Toast:**
```
⚠️ Permission Denied
You need ADMIN role to access this page.
```

### Visual Indicators

**Admin pages should show:**
- "🔒 ADMIN ONLY" badge in header
- Clear role indicators on restricted actions

---

## 9. Logging & Observability

### Event Types

**New events:**

| Event Type | Resource Type | When | Severity |
|------------|---------------|------|----------|
| `auth.permission_denied` | varies | Permission check fails | medium |
| `mission.assignment_changed` | mission | Coordinator or squad assigned/changed | low |
| `mission.assign_coordinator_failed` | mission | Assignment API validation failure | medium |
| `mission.squad_assigned` | mission | Squad successfully assigned | low |

**Event Metadata:**

**`auth.permission_denied`:**
```json
{
  "required_role": "ADMIN",
  "actual_role": "PATROL",
  "attempted_action": "access /admin/health"
}
```

**`mission.assignment_changed`:**
```json
{
  "mission_id": "clx789...",
  "mission_number": "CHI-2025-001",
  "field_changed": "coordinator", // or "squad"
  "previous_value": "clx123...", // or null
  "new_value": "clx456...", // or null
  "assigned_by": "clx999..." // actor user ID
}
```

### ERROR_IMPACT Mapping

Add to `/admin/health` ERROR_IMPACT:

```javascript
const ERROR_IMPACT = {
  // ... existing mappings ...

  // Permission & Assignment (Phase 22-24)
  'auth.permission_denied': { label: 'Permission Denied', severity: 'medium' },
  'mission.assign_coordinator_failed': { label: 'Mission Assignment', severity: 'medium' },
  'mission.assignment_changed': { label: 'Mission Assignment', severity: 'low' },
  'mission.squad_assigned': { label: 'Squad Assignment', severity: 'low' },
};
```

### Metrics

Admin health dashboard could show:

- **Permission failures (last 24h)**: Count of `auth.permission_denied` events
- **Unassigned missions**: Count where `coordinatorId === null`
- **Assignment activity**: Count of `mission.assignment_changed` events per day

(Metrics implementation is optional for MVP; just ensure events are logged.)

---

## 10. Legal & Privacy

### Privacy Considerations

- **Assignment is internal**: Coordinator and squad assignment are operational data, not exposed via public endpoints.
- **No new PII**: Coordinator is just a `User` reference (ID); no new personal data collected.
- **Audit trail**: Assignment changes logged for accountability (good for compliance).

### Legal Compliance

- **No impact on public portal**: Public mission endpoints (Phase 15-16) unaffected.
- **Terms of Service**: No changes needed; assignment is admin functionality.
- **GDPR/CCPA**: No additional user data processing; standard internal operations.

---

## 11. Testing Strategy

### QA Harness Tests (Phase 22-24)

Add new test suite: **"Permission & Assignment Tests"**

**Permission Tests:**

1. **Test: Admin Can Access Admin Health**
   - Login as ADMIN
   - Access `/admin/health`
   - Expect: 200 OK

2. **Test: Non-Admin Cannot Access Admin Health**
   - Login as PATROL
   - Access `/admin/health`
   - Expect: Redirect to `/dashboard`
   - Verify: `auth.permission_denied` event logged

3. **Test: Admin Can Access QA Harness**
   - Login as ADMIN
   - Access `/admin/qa`
   - Expect: 200 OK

**Assignment Tests:**

4. **Test: Assign Mission Coordinator**
   - Login as ADMIN
   - Create test mission
   - Assign coordinator via API
   - Expect: Mission updated, `mission.assignment_changed` event logged

5. **Test: Non-Admin Cannot Assign Coordinator**
   - Login as PATROL
   - Attempt to assign coordinator via API
   - Expect: 403 Forbidden
   - Verify: `auth.permission_denied` event logged

6. **Test: Assign Mission to Squad**
   - Login as ADMIN
   - Assign mission to squad via API
   - Expect: Mission updated, `mission.squad_assigned` event logged

### Manual Testing

**Test Scenarios:**

1. **Role-based access:**
   - Create users with each role (USER, PATROL, MODERATOR, ADMIN)
   - Attempt to access `/admin/health`, `/admin/qa`, `/admin/missions`
   - Verify access control works

2. **Coordinator assignment:**
   - Assign coordinator via UI
   - Verify dropdown shows only ADMIN/MODERATOR users
   - Verify mission detail reflects change
   - Check EventLog for `mission.assignment_changed`

3. **Unassigned mission filtering:**
   - Create several missions with/without coordinators
   - Filter by "Unassigned"
   - Verify correct missions shown

4. **Permission failures:**
   - Trigger permission denial (non-admin accessing admin page)
   - Verify error message clear
   - Check EventLog for `auth.permission_denied` with proper metadata

---

## 12. Acceptance Criteria

Phase 22-24 is **COMPLETE** when:

**✅ Role Model & Documentation:**
- [ ] Global role model documented (ADMIN, MODERATOR, PATROL, USER)
- [ ] Permission matrix defined and documented
- [ ] Feature spec status: "✅ Fully Implemented"

**✅ Permission Helper:**
- [ ] `lib/permissions.js` module created with all helper functions
- [ ] Permission failures emit `auth.permission_denied` events
- [ ] PermissionError class defined and used

**✅ Admin Surface Gating:**
- [ ] `/admin/health` requires ADMIN (enforced client + server side)
- [ ] `/admin/qa` requires ADMIN
- [ ] `/admin/missions/*` pages require ADMIN
- [ ] Non-admin users redirected with clear message

**✅ Mission Assignment Schema:**
- [ ] `LostPetMission.coordinatorId` field added (migration created)
- [ ] `User.coordinatedMissions` relation added
- [ ] Existing missions have `coordinatorId = null` after migration

**✅ Assignment APIs:**
- [ ] `POST /api/missions/[id]/assign-coordinator` implemented
- [ ] `PATCH /api/missions/[id]/squad` implemented (or integrated into existing update)
- [ ] Both APIs enforce ADMIN-only access
- [ ] Assignment changes emit `mission.assignment_changed` events
- [ ] Invalid coordinators rejected with validation errors

**✅ Admin UI:**
- [ ] Mission list shows coordinator column
- [ ] Mission detail has Assignment section with dropdowns
- [ ] Coordinator dropdown lists ADMIN/MODERATOR users only
- [ ] Squad dropdown lists all active squads
- [ ] Changes saved via API calls
- [ ] Success/error feedback shown

**✅ QA & Testing:**
- [ ] 6 permission & assignment tests added to QA harness
- [ ] All tests passing
- [ ] Manual testing completed for all scenarios

**✅ Observability:**
- [ ] ERROR_IMPACT mappings added for new event types
- [ ] Admin health dashboard shows permission/assignment events
- [ ] Event metadata includes required fields

**✅ Documentation:**
- [ ] VISION.md updated with Phase 22-24 entry marked COMPLETE
- [ ] Task breakdown marked complete
- [ ] All code committed and pushed

**✅ No Regressions:**
- [ ] Existing mission workflows unchanged (create, status, notes)
- [ ] Public portal unaffected
- [ ] QA harness still works
- [ ] Notifications still work

---

## 13. Future Enhancements

**Post-MVP improvements (not in Phase 22-24):**

### Phase 22-24-A: Moderator Full Support

- Enable MODERATOR role to:
  - View and edit assigned missions (where they're coordinator)
  - Create and manage missions they're responsible for
  - Access limited admin tools (e.g. mission dashboard, not health/QA)

- Implement `canEditMission()` logic for coordinators

### Phase 22-24-B: Squad Leader Permissions

- Allow LEADER role within squads to:
  - Edit missions assigned to their squad
  - View squad-specific mission dashboard

- Integrate squad roles with global permissions

### Phase 22-24-C: Coordinator Notifications

- Send email to coordinator when:
  - They're assigned to a mission
  - A mission they coordinate has a new sighting
  - A mission they coordinate is escalated/urgent

- Add coordinator preferences for notification frequency

### Phase 22-24-D: Self-Assignment

- Allow coordinators to self-assign to unassigned missions
- Add "Assign to me" button for staff users

### Phase 22-24-E: Assignment History

- Create `MissionAssignmentHistory` model to track all changes
- Show assignment timeline on mission detail page

### Phase 22-24-F: Workload Balancing

- Show mission counts per coordinator in UI
- Auto-suggest least-busy coordinator for new assignments
- Dashboard showing coordinator workload metrics

---

**This spec provides the foundation for clear ownership, consistent permissions, and observable access control across PetRecovery.org's internal operations.**
