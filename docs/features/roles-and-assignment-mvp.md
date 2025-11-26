<<<<<<< HEAD
# Feature Spec: Roles, Permissions & Case Assignment MVP (Phase 22–24)

**Status:** ❌ Not Started
**Owner:** Product + Engineering
**Last Updated:** November 25, 2025
**Phase:** 22–24 (Roles, Permissions & Case Assignment MVP)
=======
# Feature Spec: Roles, Permissions & Case Assignment MVP

**Phase:** 22–24
**Status:** IN PROGRESS
**Author:** Claude
**Date:** 2025-11-25
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz

---

## 0. Summary

<<<<<<< HEAD
We're building a **clear roles and permissions model** plus **explicit case assignment workflow** to establish who can do what and who is responsible for each case. This MVP focuses on:

- **Global role enforcement**: Consistent permission checks across all admin surfaces (`/admin/health`, `/admin/qa`, `/admin/cases`, etc.).
- **Case coordinator tracking**: Each case has an optional "primary coordinator" responsible for its progress.
- **Owning squad clarity**: Explicit assignment of cases to rescue squads (building on existing `squadId` relationship).
- **Full observability**: All permission failures and assignment changes emit structured events visible in `/admin/health`.

This is a **minimal, pragmatic** implementation:
- No complex RBAC system with fine-grained per-field ACLs
- No arbitrary policy engine
- Built on existing `User.role` enum (ADMIN, MODERATOR, PATROL, USER)
- Leverages existing case and squad infrastructure

**Key Principles:**

- **Explicit over implicit**: Clear permission helpers, not scattered role checks
- **Observable failures**: Permission denials logged with `auth.permission_denied` events
- **Ownership clarity**: Every case should have a clear "who's responsible?"
- **No breaking changes**: All existing functionality preserved
=======
This feature formalizes the role-based access control system and introduces case assignment capabilities. It enables administrators to assign specific coordinators to cases and link cases to rescue squads, improving accountability and organization.
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz

---

## 1. Problem / Why

<<<<<<< HEAD
### Current State Problems

**1. Inconsistent Admin Gating**
- Some admin pages check `session.user.role === 'ADMIN'`, others don't
- No centralized permission logic
- Easy to forget checks when adding new admin endpoints
- Hard to audit "who can access what?"

**2. No Explicit Case Ownership**
- Cases have `createdById` (who created) and optional `squadId` (which squad)
- But no clear "primary coordinator" or "who's driving this case?"
- Hard to answer:  - "Which cases have no one assigned?"
  - "Who should I notify when status changes?"
  - "Who's accountable for follow-up?"

**3. Unclear Permission Model**
- Global roles exist (`UserRole` enum) but usage is ad-hoc
- Squad roles exist (`RescueSquadMemberRole`) but don't interact with global permissions
- No shared vocabulary: "Can a MODERATOR edit cases?" "Can PATROL users create squads?"

**Why This Matters:**

- **Security**: Admin-only tools need consistent gating
- **Accountability**: Cases need clear owners for follow-up and metrics
- **Scalability**: As team grows, need clear roles and responsibilities
- **User Experience**: Coordinators need visibility into "their" cases
=======
**Current State:**
- UserRole enum exists (USER, PATROL, MODERATOR, ADMIN) but isn't enforced consistently
- No permission helper module for route protection
- Cases don't have assigned coordinators
- No clear ownership/accountability for case progress
- Admin pages aren't gated by role

**Impact:**
- Security risk: unauthorized access to admin functions
- Organizational chaos: nobody owns case outcomes
- No audit trail for permission denials

**Goal:**
Enforce role-based access control and enable case assignment for accountability.
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz

---

## 2. Goals / Non-goals

### Goals
<<<<<<< HEAD

**Global Roles & Permissions (MVP):**

- Define a **clear permission model** based on existing `UserRole` enum:
  - `ADMIN` – Full access to all admin tools, can assign coordinators, manage cases
  - `MODERATOR` – Can view admin tools, limited case management (future: may help coordinate)
  - `PATROL` – Regular patrol members, can view assigned cases (via squad)
  - `USER` – Pet owners, can view own cases

- Create a **centralized permission helper** module:
  - `requireAdmin(session)` – throws if not ADMIN
  - `requireStaffOrAdmin(session)` – MODERATOR or ADMIN
  - `canEditCase(session, caseData)` – coordinator, squad leader, or ADMIN
  - `canAssignCase(session, caseData)` – ADMIN only for MVP

- **Gate all admin surfaces**:
  - `/admin/health` – ADMIN only
  - `/admin/qa` – ADMIN only
  - `/admin/cases/*` – ADMIN only (MVP; future: coordinators can view assigned)

- **Log permission failures**:
  - Emit `auth.permission_denied` events with actor, resource, required role

**Case Assignment (MVP):**

- Add `coordinatorId` field to `LostPetCase`:
  - Optional `User` relation
  - Represents primary person responsible for case progress
  - Can be ADMIN or MODERATOR (staff roles)

- Keep existing `squadId` field:
  - Already links case to RescueSquad
  - For MVP, no changes needed; just clarify it as "owning squad"

- Create **assignment APIs**:
  - `POST /api/cases/[id]/assign-coordinator` – change coordinator
  - `PATCH /api/cases/[id]` – update `squadId` if needed (or separate endpoint)

- **Assignment change logging**:
  - Emit `case.assignment_changed` events with previous and new values
  - Track who made the change and when

**UI/UX (MVP):**

- Admin case list/detail:
  - Show current coordinator name (or "Unassigned")
  - Show owning squad name (or "No squad")
  - ADMIN can change both via simple dropdowns/select controls

- Visual indicators:
  - "ADMIN ONLY" badges on gated pages
  - Permission denied errors rendered clearly

### Non-goals (for MVP)

**Out of scope:**

- **No general RBAC engine**: Not building an arbitrary policy system
- **No per-field ACLs**: Not restricting who can edit specific case fields
- **No complex role hierarchies**: No "teams" or "departments" beyond squads
- **No notification changes**: Assignment doesn't trigger new notifications (Phase 25-26 already handles status changes; future phase can add coordinator notifications)
- **No public-facing changes**: Assignment is internal operations only
- **No self-assignment**: For MVP, only ADMIN assigns; future: coordinators may self-assign

---

## 3. User Stories

### Admin

- **As an ADMIN**, I can access `/admin/health`, `/admin/qa`, and `/admin/cases` without interruption.
- **As an ADMIN**, I can assign a coordinator to any case via simple dropdown UI.
- **As an ADMIN**, I can see at a glance which cases have no coordinator assigned (filter/sort).
- **As an ADMIN**, I can change a case's owning squad if it was initially assigned incorrectly.
- **As an ADMIN**, I see clear permission denied errors if something goes wrong.

### Moderator (Future Staff Role)

- **As a MODERATOR**, I can view cases assigned to me but cannot access all admin tools like health or QA.
- **As a MODERATOR**, I can edit case details and status for cases I coordinate.

### Patrol / Volunteer

- **As a PATROL member**, I am redirected away from admin-only pages with a clear message.
- **As a PATROL member**, I can view cases assigned to my squad (future enhancement).

### Platform / Operations

- **As the platform operator**, I want permission failures logged so I can audit access attempts.
- **As the platform operator**, I want assignment changes logged so I can track accountability.
- **As the platform operator**, I want a clear audit trail of who changed case coordinators and when.

---

## 4. Roles & Permission Model

### Global Roles (UserRole Enum)

Based on existing `User.role` field in schema:

| Role | Description | Typical Use Case |
|------|-------------|------------------|
| **ADMIN** | Platform administrator | Full access to all admin tools, case management, squad oversight |
| **MODERATOR** | Staff coordinator | Internal team member who can coordinate cases, limited admin access |
| **PATROL** | Patrol member/volunteer | Searches for pets via squads, can view squad-assigned cases |
| **USER** | Pet owner | Submits cases, views own cases |

### Squad Roles (RescueSquadMemberRole)

Existing squad-level roles (unchanged for MVP):

| Role | Description |
|------|-------------|
| **FOUNDER** | Created the squad |
| **LEADER** | Can accept cases, manage squad members |
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
| View `/admin/cases` | ✅ | ❌ † | ❌ † | ❌ |
| Create case (admin) | ✅ | ✅ | ❌ | ❌ |
| Edit case status | ✅ | ✅ * | ❌ † | ❌ |
| Add case notes | ✅ | ✅ * | ❌ † | ❌ |
| Assign coordinator | ✅ | ❌ | ❌ | ❌ |
| Change owning squad | ✅ | ❌ | ❌ | ❌ |

**Legend:**
- ✅ = Allowed
- ❌ = Denied
- † = Future: may allow for assigned cases
- \* = Future: only for cases they coordinate

**MVP Simplification**: For Phase 22-24, only ADMIN can access admin tools and manage all cases. MODERATOR support is designed in but not fully wired (future phase).
=======
- Formalize permission checking with reusable helpers
- Gate all admin routes with appropriate role checks
- Add coordinator assignment to cases (individual user)
- Add squad assignment to cases (which rescue squad is primary)
- Log all permission denials for security auditing
- Create admin UI for assignment management

### Non-goals
- Complex permission inheritance (RBAC with resources)
- Self-service role changes
- Temporary role elevation
- Multi-coordinator assignment (one per case for MVP)

---

## 3. Role Model

### Existing Schema (prisma/schema.prisma)

```prisma
enum UserRole {
  USER       // Basic user - can report pets, view dashboard
  PATROL     // Patrol member - can search, join squads
  MODERATOR  // Staff - can manage cases, squads, divisions
  ADMIN      // Full access - all features + user management
}
```

### Role Hierarchy

```
ADMIN
  │ Full system access
  │ User management
  │ System configuration
  ▼
MODERATOR
  │ Case management (all cases)
  │ Squad management
  │ Division management
  │ Approve community requests
  ▼
PATROL
  │ Join rescue squads
  │ Participate in searches
  │ Report sightings
  │ Access coordination tools
  ▼
USER
  │ Report lost/found pets
  │ View own dashboard
  │ Manage own profile
```

### Role Assignment Rules

| Action | Required Role | Notes |
|--------|---------------|-------|
| Self-registration | - | Creates USER role |
| Upgrade to PATROL | USER | Auto-upgrade when joining squad |
| Upgrade to MODERATOR | ADMIN | Admin must grant |
| Upgrade to ADMIN | ADMIN | Admin must grant |

---

## 4. Permission Matrix

### Page Access

| Page | USER | PATROL | MODERATOR | ADMIN |
|------|------|--------|-----------|-------|
| / (home) | YES | YES | YES | YES |
| /dashboard | YES | YES | YES | YES |
| /profile | YES | YES | YES | YES |
| /cases (public) | YES | YES | YES | YES |
| /rescue-squads | YES | YES | YES | YES |
| /admin/* | NO | NO | YES | YES |
| /admin/users | NO | NO | NO | YES |

### API Access

| Endpoint | USER | PATROL | MODERATOR | ADMIN |
|----------|------|--------|-----------|-------|
| GET /api/public/* | YES | YES | YES | YES |
| POST /api/public/cases | YES | YES | YES | YES |
| GET /api/dashboard | YES | YES | YES | YES |
| POST /api/rescue-squads/[id]/join | YES | YES | YES | YES |
| GET /api/admin/* | NO | NO | YES | YES |
| POST /api/admin/* | NO | NO | YES | YES |
| POST /api/cases/[id]/assign-coordinator | NO | NO | YES | YES |
| POST /api/cases/[id]/assign-squad | NO | NO | YES | YES |
| DELETE /api/admin/users/* | NO | NO | NO | YES |
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz

---

## 5. Case Assignment Model

<<<<<<< HEAD
### Data Model

**Add to `LostPetCase`:**

```prisma
model LostPetCase {
  // ... existing fields ...

  // NEW: Case Assignment (Phase 22-24)
  coordinatorId   String?
  coordinator     User?         @relation("CaseCoordinator", fields: [coordinatorId], references: [id])

  // EXISTING: Owning squad (already present, just clarifying semantics)
  squadId         String?
  squad           RescueSquad?  @relation(fields: [squadId], references: [id])
}
```

**Update `User` model relations:**

```prisma
model User {
  // ... existing relations ...

  // NEW: Cases coordinated by this user
  coordinatedCases  LostPetCase[]  @relation("CaseCoordinator")
}
```

**Semantics:**

- `coordinatorId` = primary person responsible (typically ADMIN or MODERATOR)
- `squadId` = rescue squad assigned to help (already exists)
- Both are **optional** and **independent**:
  - A case can have a coordinator but no squad
  - A case can be assigned to a squad but no specific coordinator
  - A case can have both
  - A case can have neither (unassigned)

### Assignment Rules

**Who can be a coordinator?**
- For MVP: Users with role `ADMIN` or `MODERATOR`
- Cannot assign regular `USER` or `PATROL` as coordinator (they're not staff)

**Who can assign coordinators?**
- For MVP: Only `ADMIN` role
- Future: Coordinators may reassign to others

**Assignment Lifecycle:**

1. Case created → `coordinatorId = null` (unassigned)
2. Admin assigns coordinator → `coordinatorId = userId`
3. Coordinator changed → old coordinator removed, new one assigned
4. Coordinator removed → `coordinatorId = null` (back to unassigned)

**Migration:**

- Existing cases will have `coordinatorId = null` after migration
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
 * Check if user can edit case
 * MVP: Only ADMIN
 * Future: Also coordinator, squad leaders
 */
export function canEditCase(session, caseData) {
  const role = getUserRole(session);

  // ADMIN can edit all cases
  if (role === 'ADMIN') {
    return true;
  }

  // Future: MODERATOR can edit if they're the coordinator
  // if (role === 'MODERATOR' && caseData.coordinatorId === session.user.id) {
  //   return true;
  // }

  // Future: Squad leaders can edit squad cases

  return false;
}

/**
 * Check if user can assign case coordinator
 * MVP: Only ADMIN
 */
export function canAssignCase(session) {
  return getUserRole(session) === 'ADMIN';
}
=======
### Schema Changes

Add to `Case` model in `prisma/schema.prisma`:

```prisma
model Case {
  // ... existing fields ...

  // Assignment
  coordinatorId    String?
  coordinator      User?    @relation("CaseCoordinator", fields: [coordinatorId], references: [id])
  primarySquadId   String?
  primarySquad     RescueSquad? @relation("PrimarySquadCases", fields: [primarySquadId], references: [id])
}
```

Add relation to `User` model:

```prisma
model User {
  // ... existing fields ...

  // Coordinator relation
  coordinatedCases  Case[] @relation("CaseCoordinator")
}
```

Add relation to `RescueSquad` model:

```prisma
model RescueSquad {
  // ... existing fields ...

  // Primary squad relation
  primaryCases  Case[] @relation("PrimarySquadCases")
}
```

### Field Semantics

| Field | Type | Description |
|-------|------|-------------|
| `coordinatorId` | String? | User assigned to coordinate this case |
| `primarySquadId` | String? | Primary rescue squad working this case |

**Note:** `primarySquadId` is separate from `CaseAssignment` - a squad accepting a case creates an assignment, but the admin can designate one squad as "primary" for accountability.

---

## 6. Backend & Permission Helpers

### lib/permissions.js

```javascript
// Permission helper module
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz

/**
 * Custom error for permission failures
 */
export class PermissionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'PermissionError';
<<<<<<< HEAD
    this.details = details;
  }
}
```

### Where to Apply

Apply permission checks to:

**Admin Pages (Client-Side):**
- `/admin/health/page.jsx` – add `requireAdmin`
- `/admin/qa/page.js` – already has check, but use helper for consistency
- `/admin/cases/page.js` – add `requireAdmin`
- `/admin/cases/[id]/page.js` – add `requireAdmin`
- `/admin/cases/new/page.js` – add `requireAdmin`

**Admin APIs (Server-Side):**
- All `/api/cases/*` routes – use `requireStaffOrAdmin`
- New assignment endpoints – use `requireAdmin`
- `/api/admin/*` endpoints – use `requireAdmin`

**Example API Usage:**

```javascript
import { requireAdmin, PermissionError } from '@/app/lib/permissions';

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);

  try {
    await requireAdmin(session, {
      resource_type: 'case',
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
=======
    this.status = 403;
    this.details = details;
  }
}

/**
 * Get user role from session
 */
export function getUserRole(session) {
  return session?.user?.role || null;
}

/**
 * Check if user has ADMIN role
 */
export function isAdmin(session) {
  return getUserRole(session) === 'ADMIN';
}

/**
 * Check if user has MODERATOR or ADMIN role
 */
export function isStaff(session) {
  const role = getUserRole(session);
  return role === 'ADMIN' || role === 'MODERATOR';
}

/**
 * Check if user has PATROL or higher role
 */
export function isPatrol(session) {
  const role = getUserRole(session);
  return ['ADMIN', 'MODERATOR', 'PATROL'].includes(role);
}

/**
 * Require ADMIN role - throws PermissionError if not
 */
export function requireAdmin(session, action = 'perform this action') {
  if (!session?.user) {
    throw new PermissionError('Authentication required', { action });
  }
  if (!isAdmin(session)) {
    logEvent('auth.permission_denied', {
      userId: session.user.id,
      role: session.user.role,
      required: 'ADMIN',
      action,
    });
    throw new PermissionError(`Admin access required to ${action}`, {
      action,
      required: 'ADMIN',
      actual: session.user.role,
    });
  }
}

/**
 * Require MODERATOR or ADMIN role - throws PermissionError if not
 */
export function requireStaff(session, action = 'perform this action') {
  if (!session?.user) {
    throw new PermissionError('Authentication required', { action });
  }
  if (!isStaff(session)) {
    logEvent('auth.permission_denied', {
      userId: session.user.id,
      role: session.user.role,
      required: 'MODERATOR',
      action,
    });
    throw new PermissionError(`Staff access required to ${action}`, {
      action,
      required: 'MODERATOR',
      actual: session.user.role,
    });
  }
}

/**
 * Require PATROL or higher role
 */
export function requirePatrol(session, action = 'perform this action') {
  if (!session?.user) {
    throw new PermissionError('Authentication required', { action });
  }
  if (!isPatrol(session)) {
    logEvent('auth.permission_denied', {
      userId: session.user.id,
      role: session.user.role,
      required: 'PATROL',
      action,
    });
    throw new PermissionError(`Patrol access required to ${action}`, {
      action,
      required: 'PATROL',
      actual: session.user.role,
    });
  }
}
```

### Usage in API Routes

```javascript
import { getSession } from '@/app/lib/auth';
import { requireStaff, PermissionError } from '@/app/lib/permissions';

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    requireStaff(session, 'assign coordinator');

    // ... rest of handler
  } catch (error) {
    if (error instanceof PermissionError) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz
}
```

---

<<<<<<< HEAD
## 7. Assignment APIs

### POST /api/cases/[id]/assign-coordinator

**Purpose:** Assign or change the case coordinator.

**Request:**
```json
{
  "coordinatorId": "clx123abc..." // User ID, or null to unassign
}
```

**Response (200 OK):**
=======
## 7. Admin Surfaces Gating

### Route Protection Pattern

All `/admin/*` pages should check permissions in their component:

```javascript
// Example: /admin/cases/page.js
import { getSession } from '@/app/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminCasesPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect('/login');
  }

  if (!['ADMIN', 'MODERATOR'].includes(session.user.role)) {
    redirect('/dashboard?error=unauthorized');
  }

  // ... render page
}
```

### Admin Badge Pattern

Admin-only features should display a visual badge:

```jsx
{isAdmin(session) && (
  <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
    ADMIN ONLY
  </span>
)}
```

### Pages to Gate

| Page | Required Role | Badge |
|------|---------------|-------|
| /admin/rescue-squads | MODERATOR+ | Staff |
| /admin/rescue-squads/create | ADMIN | ADMIN ONLY |
| /admin/wipe-squads | ADMIN | ADMIN ONLY |
| /admin/divisions | MODERATOR+ | Staff |
| /admin/communities | MODERATOR+ | Staff |
| /admin/communities/create | ADMIN | ADMIN ONLY |
| /admin/cases | MODERATOR+ | Staff |
| /admin/cases/[id] | MODERATOR+ | Staff |
| /admin/qa | ADMIN | ADMIN ONLY |
| /admin/health | ADMIN | ADMIN ONLY |

---

## 8. Assignment APIs

### POST /api/cases/[id]/assign-coordinator

Assign a coordinator to a case.

**Authentication:** Required (MODERATOR+)

**Request Body:**
```json
{
  "coordinatorId": "cluser123..."
}
```

**Validation:**
- Coordinator must exist
- Coordinator must be PATROL+ role
- Case must exist and not be closed

**Response (200):**
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz
```json
{
  "success": true,
  "case": {
<<<<<<< HEAD
    "id": "...",
    "caseNumber": "CHI-2025-001",
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
- `404` – Case not found
- `400` – Invalid coordinator ID, or coordinator doesn't have ADMIN/MODERATOR role

**Events Logged:**
- `case.assignment_changed` (success)
- `auth.permission_denied` (permission failure)
- `case.assign_coordinator_failed` (validation failure)

### PATCH /api/cases/[id]/squad

**Purpose:** Assign or change the owning squad.

**Request:**
```json
{
  "squadId": "clx456def..." // RescueSquad ID, or null to unassign
}
```

**Response (200 OK):**
=======
    "id": "clcase123...",
    "caseNumber": "CHI-2024-001847",
    "coordinatorId": "cluser123...",
    "coordinator": {
      "id": "cluser123...",
      "firstName": "Jane",
      "lastName": "Doe",
      "email": "jane@example.com"
    }
  }
}
```

**Response (400):**
```json
{
  "error": "Invalid coordinator",
  "details": "User not found or not eligible"
}
```

**Events:**
- `case.assignment_changed` with `{ caseId, field: 'coordinator', oldValue, newValue }`

---

### POST /api/cases/[id]/assign-squad

Assign a primary squad to a case.

**Authentication:** Required (MODERATOR+)

**Request Body:**
```json
{
  "squadId": "clsquad123..."
}
```

**Validation:**
- Squad must exist
- Squad must be active (`isActive: true`)
- Case must exist and not be closed

**Response (200):**
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz
```json
{
  "success": true,
  "case": {
<<<<<<< HEAD
    "id": "...",
    "caseNumber": "CHI-2025-001",
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
- `case.squad_assigned` (success)
- `auth.permission_denied` (permission failure)

**Alternative:** Could integrate squad assignment into main case update endpoint (`PATCH /api/cases/[id]`) but dedicated endpoint makes logging and permissions clearer.

---

## 8. UI / UX

### Admin Case List Page (`/admin/cases`)

**Changes:**

1. **Add columns:**
   - "Coordinator" column showing:
     - Coordinator name (e.g. "Jane Doe")
     - Or "Unassigned" in gray
   - "Squad" column already exists, keep as-is

2. **Filter/Sort:**
   - Add filter: "Unassigned cases" (where `coordinatorId === null`)
   - Sort by coordinator name

3. **Role Badge:**
   - Add "ADMIN ONLY" badge at top of page to make gating explicit

### Admin Case Detail Page (`/admin/cases/[id]`)

**Changes:**

1. **Assignment Section:**
   - Add new "Assignment" card/section below case details:
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
   - Refreshes case data

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
| `case.assignment_changed` | case | Coordinator or squad assigned/changed | low |
| `case.assign_coordinator_failed` | case | Assignment API validation failure | medium |
| `case.squad_assigned` | case | Squad successfully assigned | low |

**Event Metadata:**

**`auth.permission_denied`:**
```json
{
  "required_role": "ADMIN",
  "actual_role": "PATROL",
  "attempted_action": "access /admin/health"
}
```

**`case.assignment_changed`:**
```json
{
  "case_id": "clx789...",
  "case_number": "CHI-2025-001",
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
  'case.assign_coordinator_failed': { label: 'Case Assignment', severity: 'medium' },
  'case.assignment_changed': { label: 'Case Assignment', severity: 'low' },
  'case.squad_assigned': { label: 'Squad Assignment', severity: 'low' },
};
```

### Metrics

Admin health dashboard could show:

- **Permission failures (last 24h)**: Count of `auth.permission_denied` events
- **Unassigned cases**: Count where `coordinatorId === null`
- **Assignment activity**: Count of `case.assignment_changed` events per day

(Metrics implementation is optional for MVP; just ensure events are logged.)

---

## 10. Legal & Privacy

### Privacy Considerations

- **Assignment is internal**: Coordinator and squad assignment are operational data, not exposed via public endpoints.
- **No new PII**: Coordinator is just a `User` reference (ID); no new personal data collected.
- **Audit trail**: Assignment changes logged for accountability (good for compliance).

### Legal Compliance

- **No impact on public portal**: Public case endpoints (Phase 15-16) unaffected.
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

4. **Test: Assign Case Coordinator**
   - Login as ADMIN
   - Create test case
   - Assign coordinator via API
   - Expect: Case updated, `case.assignment_changed` event logged

5. **Test: Non-Admin Cannot Assign Coordinator**
   - Login as PATROL
   - Attempt to assign coordinator via API
   - Expect: 403 Forbidden
   - Verify: `auth.permission_denied` event logged

6. **Test: Assign Case to Squad**
   - Login as ADMIN
   - Assign case to squad via API
   - Expect: Case updated, `case.squad_assigned` event logged

### Manual Testing

**Test Scenarios:**

1. **Role-based access:**
   - Create users with each role (USER, PATROL, MODERATOR, ADMIN)
   - Attempt to access `/admin/health`, `/admin/qa`, `/admin/cases`
   - Verify access control works

2. **Coordinator assignment:**
   - Assign coordinator via UI
   - Verify dropdown shows only ADMIN/MODERATOR users
   - Verify case detail reflects change
   - Check EventLog for `case.assignment_changed`

3. **Unassigned case filtering:**
   - Create several cases with/without coordinators
   - Filter by "Unassigned"
   - Verify correct cases shown

4. **Permission failures:**
   - Trigger permission denial (non-admin accessing admin page)
   - Verify error message clear
   - Check EventLog for `auth.permission_denied` with proper metadata
=======
    "id": "clcase123...",
    "caseNumber": "CHI-2024-001847",
    "primarySquadId": "clsquad123...",
    "primarySquad": {
      "id": "clsquad123...",
      "name": "Chicago North Rescue Squad"
    }
  }
}
```

**Events:**
- `case.assignment_changed` with `{ caseId, field: 'primarySquad', oldValue, newValue }`

---

### POST /api/cases/[id]/unassign-coordinator

Remove coordinator assignment.

**Authentication:** Required (MODERATOR+)

**Response (200):**
```json
{
  "success": true,
  "case": {
    "id": "clcase123...",
    "coordinatorId": null
  }
}
```

---

## 9. UI/UX

### Admin Case Detail - Assignment Section

Add to `/admin/cases/[id]` page:

```
┌─────────────────────────────────────────────────────┐
│  Case Assignment                                    │
├─────────────────────────────────────────────────────┤
│  Coordinator:                                       │
│  [Jane Doe (jane@example.com) ▼] [Remove]          │
│                                                     │
│  Primary Squad:                                     │
│  [Chicago North Rescue Squad ▼]  [Remove]          │
│                                                     │
│  Assignment History:                                │
│  • Nov 20, 14:30 - Coordinator set to Jane Doe    │
│  • Nov 20, 14:35 - Primary squad set to Chicago   │
└─────────────────────────────────────────────────────┘
```

### Admin Cases List - Coordinator Column

Add column to case listing:

```
| Case # | Pet | Status | Coordinator | Primary Squad | Actions |
|--------|-----|--------|-------------|---------------|---------|
| CHI-... | Max | ACTIVE | Jane D.     | Chicago North | [View]  |
| CHI-... | Whiskers | IN_PROGRESS | (none) | (none) | [View] |
```

### Coordinator Dropdown

- Shows users with PATROL+ role
- Searchable by name/email
- Shows role badge next to name

### Squad Dropdown

- Shows active squads only
- Searchable by name
- Shows city/state

---

## 10. Logging & Observability

### Event Types

| Event | Trigger | Data |
|-------|---------|------|
| `auth.permission_denied` | Permission check failed | userId, role, required, action |
| `case.assignment_changed` | Coordinator/squad changed | caseId, field, oldValue, newValue, changedBy |

### Logging Implementation

```javascript
// In lib/logging.js
export function logEvent(event, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

// Usage
logEvent('case.assignment_changed', {
  caseId: 'clcase123',
  field: 'coordinator',
  oldValue: null,
  newValue: 'cluser123',
  changedBy: session.user.id,
});
```

---

## 11. Testing / QA

### Unit Tests

| Test | Description |
|------|-------------|
| `permissions.isAdmin.test` | Returns true only for ADMIN role |
| `permissions.isStaff.test` | Returns true for ADMIN and MODERATOR |
| `permissions.requireAdmin.test` | Throws PermissionError for non-admin |
| `assign-coordinator.test` | Successfully assigns coordinator |
| `assign-coordinator.validation.test` | Rejects invalid coordinator |

### QA Harness Tests (/admin/qa)

```javascript
// Permission Tests
{
  name: 'Admin route requires auth',
  endpoint: '/api/admin/rescue-squads',
  method: 'GET',
  headers: {}, // No auth
  expectedStatus: 401
},
{
  name: 'Assign coordinator requires staff',
  endpoint: '/api/cases/test-case-id/assign-coordinator',
  method: 'POST',
  body: { coordinatorId: 'test-user-id' },
  asRole: 'USER',
  expectedStatus: 403
},
{
  name: 'Assign coordinator succeeds for staff',
  endpoint: '/api/cases/test-case-id/assign-coordinator',
  method: 'POST',
  body: { coordinatorId: 'test-user-id' },
  asRole: 'MODERATOR',
  expectedStatus: 200
}
```

### ERROR_IMPACT Entries

| Event | Impact Level | Description |
|-------|--------------|-------------|
| `auth.permission_denied` | MEDIUM | User attempted unauthorized action |
| `case.assignment_changed` | INFO | Assignment tracking (not an error) |
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz

---

## 12. Acceptance Criteria

<<<<<<< HEAD
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
- [ ] `/admin/cases/*` pages require ADMIN
- [ ] Non-admin users redirected with clear message

**✅ Case Assignment Schema:**
- [ ] `LostPetCase.coordinatorId` field added (migration created)
- [ ] `User.coordinatedCases` relation added
- [ ] Existing cases have `coordinatorId = null` after migration

**✅ Assignment APIs:**
- [ ] `POST /api/cases/[id]/assign-coordinator` implemented
- [ ] `PATCH /api/cases/[id]/squad` implemented (or integrated into existing update)
- [ ] Both APIs enforce ADMIN-only access
- [ ] Assignment changes emit `case.assignment_changed` events
- [ ] Invalid coordinators rejected with validation errors

**✅ Admin UI:**
- [ ] Case list shows coordinator column
- [ ] Case detail has Assignment section with dropdowns
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
- [ ] Existing case workflows unchanged (create, status, notes)
- [ ] Public portal unaffected
- [ ] QA harness still works
- [ ] Notifications still work

---

## 13. Future Enhancements

**Post-MVP improvements (not in Phase 22-24):**

### Phase 22-24-A: Moderator Full Support

- Enable MODERATOR role to:
  - View and edit assigned cases (where they're coordinator)
  - Create and manage cases they're responsible for
  - Access limited admin tools (e.g. case dashboard, not health/QA)

- Implement `canEditCase()` logic for coordinators

### Phase 22-24-B: Squad Leader Permissions

- Allow LEADER role within squads to:
  - Edit cases assigned to their squad
  - View squad-specific case dashboard

- Integrate squad roles with global permissions

### Phase 22-24-C: Coordinator Notifications

- Send email to coordinator when:
  - They're assigned to a case
  - A case they coordinate has a new sighting
  - A case they coordinate is escalated/urgent

- Add coordinator preferences for notification frequency

### Phase 22-24-D: Self-Assignment

- Allow coordinators to self-assign to unassigned cases
- Add "Assign to me" button for staff users

### Phase 22-24-E: Assignment History

- Create `CaseAssignmentHistory` model to track all changes
- Show assignment timeline on case detail page

### Phase 22-24-F: Workload Balancing

- Show case counts per coordinator in UI
- Auto-suggest least-busy coordinator for new assignments
- Dashboard showing coordinator workload metrics

---

**This spec provides the foundation for clear ownership, consistent permissions, and observable access control across PetRecovery.org's internal operations.**
=======
### Must Have
- [ ] lib/permissions.js module with isAdmin, isStaff, requireAdmin, requireStaff
- [ ] PermissionError class with proper status code
- [ ] All /admin/* pages check role before rendering
- [ ] POST /api/cases/[id]/assign-coordinator endpoint
- [ ] POST /api/cases/[id]/assign-squad endpoint
- [ ] Prisma schema updated with coordinatorId, primarySquadId
- [ ] Assignment section on admin case detail page
- [ ] Coordinator column on admin cases list
- [ ] auth.permission_denied events logged
- [ ] case.assignment_changed events logged

### Should Have
- [ ] "ADMIN ONLY" badges on admin-only features
- [ ] Unassign endpoints
- [ ] Assignment history display

### Nice to Have
- [ ] Bulk assignment (assign coordinator to multiple cases)
- [ ] Assignment notifications (email coordinator when assigned)

---

*Spec version: 1.0*
*Last updated: 2025-11-25*
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz
