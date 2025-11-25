# Feature Spec: Roles, Permissions & Case Assignment MVP

**Phase:** 22–24
**Status:** IN PROGRESS
**Author:** Claude
**Date:** 2025-11-25

---

## 0. Summary

This feature formalizes the role-based access control system and introduces case assignment capabilities. It enables administrators to assign specific coordinators to cases and link cases to rescue squads, improving accountability and organization.

---

## 1. Problem / Why

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

---

## 2. Goals / Non-goals

### Goals
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

---

## 5. Case Assignment Model

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

/**
 * Custom error for permission failures
 */
export class PermissionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'PermissionError';
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
}
```

---

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
```json
{
  "success": true,
  "case": {
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
```json
{
  "success": true,
  "case": {
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

---

## 12. Acceptance Criteria

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
