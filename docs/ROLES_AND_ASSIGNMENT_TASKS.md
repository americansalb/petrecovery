# Roles & Case Assignment Tasks (Phase 22–24)

**Feature Spec:** [docs/features/roles-and-assignment-mvp.md](features/roles-and-assignment-mvp.md)
**Status:** IN PROGRESS
**Last Updated:** 2025-11-25

---

## Task Overview

| Task ID | Description | Status | Priority |
|---------|-------------|--------|----------|
| TASK-R01 | Create permissions helper module | TODO | HIGH |
| TASK-R02 | Schema updates for case assignment | TODO | HIGH |
| TASK-R03 | Gate admin pages with role checks | TODO | HIGH |
| TASK-R04 | POST /api/cases/[id]/assign-coordinator | TODO | HIGH |
| TASK-R05 | POST /api/cases/[id]/assign-squad | TODO | HIGH |
| TASK-R06 | Admin cases list page | TODO | HIGH |
| TASK-R07 | Admin case detail page with assignment | TODO | HIGH |
| TASK-R08 | QA harness tests for permissions | TODO | MEDIUM |
| TASK-R09 | ERROR_IMPACT health dashboard entries | TODO | MEDIUM |
| TASK-R10 | Update VISION.md with completion status | TODO | LOW |

---

## TASK-R01: Create Permissions Helper Module

**Goal:** Create reusable permission checking utilities.

**Files:**
- `frontend/app/lib/permissions.js` (new)

**Implementation:**

```javascript
// lib/permissions.js
import { logEvent } from './logging';

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
 * Require MODERATOR or ADMIN role
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

/**
 * Require authentication only
 */
export function requireAuth(session, action = 'perform this action') {
  if (!session?.user) {
    throw new PermissionError('Authentication required', { action });
  }
}
```

**Acceptance Criteria:**
- [ ] PermissionError class created
- [ ] getUserRole, isAdmin, isStaff, isPatrol functions work
- [ ] requireAdmin, requireStaff, requirePatrol throw on failure
- [ ] Permission denials logged with auth.permission_denied

---

## TASK-R02: Schema Updates for Case Assignment

**Goal:** Add coordinator and primary squad fields to Case model.

**Files:**
- `frontend/prisma/schema.prisma`

**Implementation:**

Add to Case model:
```prisma
model Case {
  // ... existing fields ...

  // Case Assignment (Phase 22-24)
  coordinatorId    String?
  coordinator      User?        @relation("CaseCoordinator", fields: [coordinatorId], references: [id])
  primarySquadId   String?
  primarySquad     RescueSquad? @relation("PrimarySquadCases", fields: [primarySquadId], references: [id])
}
```

Add to User model:
```prisma
model User {
  // ... existing fields ...

  // Coordinator relation
  coordinatedCases  Case[] @relation("CaseCoordinator")
}
```

Add to RescueSquad model:
```prisma
model RescueSquad {
  // ... existing fields ...

  // Primary squad relation
  primaryCases  Case[] @relation("PrimarySquadCases")
}
```

**Steps:**
1. Edit schema.prisma with new fields and relations
2. Run `npx prisma generate`
3. Run `npx prisma migrate dev --name add-case-assignment`

**Acceptance Criteria:**
- [ ] coordinatorId and primarySquadId fields added
- [ ] Relations properly defined
- [ ] Migration runs successfully

---

## TASK-R03: Gate Admin Pages with Role Checks

**Goal:** Add role-based access control to all admin pages.

**Files:**
- `frontend/app/admin/rescue-squads/page.js`
- `frontend/app/admin/rescue-squads/create/page.js`
- `frontend/app/admin/wipe-squads/page.js`
- `frontend/app/admin/divisions/page.js`
- `frontend/app/admin/communities/page.js`
- `frontend/app/admin/communities/create/page.js`
- `frontend/app/admin/cases/page.js` (new)
- `frontend/app/admin/cases/[id]/page.js` (new)
- `frontend/app/admin/qa/page.js` (new)
- `frontend/app/admin/health/page.js` (new)

**Implementation Pattern:**

```javascript
import { getSession } from '@/app/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminPage() {
  const session = await getSession();

  // Require authentication
  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/...');
  }

  // Require appropriate role
  const allowedRoles = ['ADMIN', 'MODERATOR']; // or just ['ADMIN']
  if (!allowedRoles.includes(session.user.role)) {
    redirect('/dashboard?error=unauthorized');
  }

  // Render page...
}
```

**Page Requirements:**

| Page | Required Role | Badge |
|------|---------------|-------|
| /admin/rescue-squads | MODERATOR+ | - |
| /admin/rescue-squads/create | ADMIN | ADMIN ONLY |
| /admin/wipe-squads | ADMIN | ADMIN ONLY |
| /admin/divisions | MODERATOR+ | - |
| /admin/communities | MODERATOR+ | - |
| /admin/communities/create | ADMIN | ADMIN ONLY |
| /admin/cases | MODERATOR+ | - |
| /admin/cases/[id] | MODERATOR+ | - |
| /admin/qa | ADMIN | ADMIN ONLY |
| /admin/health | ADMIN | ADMIN ONLY |

**Acceptance Criteria:**
- [ ] All admin pages check role before rendering
- [ ] Unauthorized users redirected to dashboard
- [ ] ADMIN ONLY badge shown where applicable
- [ ] No admin content visible to unauthorized users

---

## TASK-R04: POST /api/cases/[id]/assign-coordinator

**Goal:** Create endpoint to assign coordinator to case.

**Files:**
- `frontend/app/api/cases/[id]/assign-coordinator/route.js` (new)

**Implementation:**

```javascript
import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { requireStaff, PermissionError } from '@/app/lib/permissions';
import { logEvent } from '@/app/lib/logging';
import prisma from '@/app/lib/prisma';

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    requireStaff(session, 'assign coordinator');

    const { id } = params;
    const { coordinatorId } = await request.json();

    // Validate case exists
    const existingCase = await prisma.case.findUnique({
      where: { id },
      select: { id: true, caseNumber: true, coordinatorId: true, status: true },
    });

    if (!existingCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (['REUNITED', 'CLOSED_OTHER'].includes(existingCase.status)) {
      return NextResponse.json({ error: 'Cannot assign to closed case' }, { status: 400 });
    }

    // Validate coordinator exists and has appropriate role
    if (coordinatorId) {
      const coordinator = await prisma.user.findUnique({
        where: { id: coordinatorId },
        select: { id: true, role: true, firstName: true, lastName: true, email: true },
      });

      if (!coordinator) {
        return NextResponse.json({ error: 'Coordinator not found' }, { status: 400 });
      }

      if (!['ADMIN', 'MODERATOR', 'PATROL'].includes(coordinator.role)) {
        return NextResponse.json(
          { error: 'Coordinator must have PATROL or higher role' },
          { status: 400 }
        );
      }
    }

    // Update case
    const updatedCase = await prisma.case.update({
      where: { id },
      data: { coordinatorId: coordinatorId || null },
      include: {
        coordinator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    logEvent('case.assignment_changed', {
      caseId: id,
      caseNumber: existingCase.caseNumber,
      field: 'coordinator',
      oldValue: existingCase.coordinatorId,
      newValue: coordinatorId,
      changedBy: session.user.id,
    });

    return NextResponse.json({
      success: true,
      case: {
        id: updatedCase.id,
        caseNumber: updatedCase.caseNumber,
        coordinatorId: updatedCase.coordinatorId,
        coordinator: updatedCase.coordinator,
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    logEvent('case.assign_coordinator_failed', { error: error.message });
    return NextResponse.json({ error: 'Failed to assign coordinator' }, { status: 500 });
  }
}
```

**Acceptance Criteria:**
- [ ] Requires MODERATOR+ role
- [ ] Validates coordinator exists with PATROL+ role
- [ ] Prevents assignment to closed cases
- [ ] Logs case.assignment_changed event
- [ ] Returns updated case with coordinator

---

## TASK-R05: POST /api/cases/[id]/assign-squad

**Goal:** Create endpoint to assign primary squad to case.

**Files:**
- `frontend/app/api/cases/[id]/assign-squad/route.js` (new)

**Implementation:**

```javascript
import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { requireStaff, PermissionError } from '@/app/lib/permissions';
import { logEvent } from '@/app/lib/logging';
import prisma from '@/app/lib/prisma';

export async function POST(request, { params }) {
  try {
    const session = await getSession();
    requireStaff(session, 'assign squad');

    const { id } = params;
    const { squadId } = await request.json();

    // Validate case exists
    const existingCase = await prisma.case.findUnique({
      where: { id },
      select: { id: true, caseNumber: true, primarySquadId: true, status: true },
    });

    if (!existingCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (['REUNITED', 'CLOSED_OTHER'].includes(existingCase.status)) {
      return NextResponse.json({ error: 'Cannot assign to closed case' }, { status: 400 });
    }

    // Validate squad exists and is active
    if (squadId) {
      const squad = await prisma.rescueSquad.findUnique({
        where: { id: squadId },
        select: { id: true, name: true, isActive: true },
      });

      if (!squad) {
        return NextResponse.json({ error: 'Squad not found' }, { status: 400 });
      }

      if (!squad.isActive) {
        return NextResponse.json({ error: 'Squad is not active' }, { status: 400 });
      }
    }

    // Update case
    const updatedCase = await prisma.case.update({
      where: { id },
      data: { primarySquadId: squadId || null },
      include: {
        primarySquad: {
          select: { id: true, name: true, city: true, state: true },
        },
      },
    });

    logEvent('case.assignment_changed', {
      caseId: id,
      caseNumber: existingCase.caseNumber,
      field: 'primarySquad',
      oldValue: existingCase.primarySquadId,
      newValue: squadId,
      changedBy: session.user.id,
    });

    return NextResponse.json({
      success: true,
      case: {
        id: updatedCase.id,
        caseNumber: updatedCase.caseNumber,
        primarySquadId: updatedCase.primarySquadId,
        primarySquad: updatedCase.primarySquad,
      },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    logEvent('case.assign_squad_failed', { error: error.message });
    return NextResponse.json({ error: 'Failed to assign squad' }, { status: 500 });
  }
}
```

**Acceptance Criteria:**
- [ ] Requires MODERATOR+ role
- [ ] Validates squad exists and is active
- [ ] Prevents assignment to closed cases
- [ ] Logs case.assignment_changed event
- [ ] Returns updated case with squad

---

## TASK-R06: Admin Cases List Page

**Goal:** Create admin page to list and manage cases.

**Files:**
- `frontend/app/admin/cases/page.js` (new)

**Implementation:**

```jsx
import { getSession } from '@/app/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/app/lib/prisma';
import Link from 'next/link';

export default async function AdminCasesPage() {
  const session = await getSession();

  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/cases');
  }

  if (!['ADMIN', 'MODERATOR'].includes(session.user.role)) {
    redirect('/dashboard?error=unauthorized');
  }

  const cases = await prisma.case.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      coordinator: {
        select: { firstName: true, lastName: true },
      },
      primarySquad: {
        select: { name: true },
      },
    },
  });

  return (
    <div className="max-w-7xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Case Management</h1>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Case #</th>
            <th className="border p-2 text-left">Pet</th>
            <th className="border p-2 text-left">Status</th>
            <th className="border p-2 text-left">Coordinator</th>
            <th className="border p-2 text-left">Primary Squad</th>
            <th className="border p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50">
              <td className="border p-2">{c.caseNumber}</td>
              <td className="border p-2">{c.petName}</td>
              <td className="border p-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  c.status === 'ACTIVE' ? 'bg-red-100 text-red-800' :
                  c.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                  c.status === 'REUNITED' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {c.status}
                </span>
              </td>
              <td className="border p-2">
                {c.coordinator
                  ? `${c.coordinator.firstName} ${c.coordinator.lastName?.charAt(0) || ''}.`
                  : <span className="text-gray-400">Unassigned</span>}
              </td>
              <td className="border p-2">
                {c.primarySquad?.name || <span className="text-gray-400">None</span>}
              </td>
              <td className="border p-2">
                <Link
                  href={`/admin/cases/${c.id}`}
                  className="text-blue-600 hover:underline"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Acceptance Criteria:**
- [ ] Requires MODERATOR+ role
- [ ] Shows all cases with key info
- [ ] Coordinator column shows assigned user
- [ ] Primary Squad column shows assigned squad
- [ ] Links to case detail page

---

## TASK-R07: Admin Case Detail Page with Assignment

**Goal:** Create admin case detail with assignment controls.

**Files:**
- `frontend/app/admin/cases/[id]/page.js` (new)

**Implementation:**

Page includes:
- Case summary (pet info, status, location)
- Assignment section with dropdowns
- Coordinator dropdown (PATROL+ users)
- Primary Squad dropdown (active squads)
- Save buttons for each assignment
- Assignment history (future enhancement)

**Acceptance Criteria:**
- [ ] Requires MODERATOR+ role
- [ ] Shows full case details
- [ ] Coordinator dropdown with eligible users
- [ ] Squad dropdown with active squads
- [ ] Assignment updates via API calls
- [ ] Success/error feedback

---

## TASK-R08: QA Harness Tests for Permissions

**Goal:** Add permission and assignment tests to QA page.

**Files:**
- `frontend/app/admin/qa/page.js`

**Tests to Add:**

```javascript
const permissionTests = [
  {
    name: 'Admin route rejects unauthenticated',
    endpoint: '/api/cases/test-id/assign-coordinator',
    method: 'POST',
    body: { coordinatorId: 'test' },
    expectedStatus: 401,
  },
  {
    name: 'Assign coordinator rejects USER role',
    endpoint: '/api/cases/test-id/assign-coordinator',
    method: 'POST',
    body: { coordinatorId: 'test' },
    asRole: 'USER',
    expectedStatus: 403,
  },
  {
    name: 'Assign coordinator allows MODERATOR',
    endpoint: '/api/cases/test-id/assign-coordinator',
    method: 'POST',
    body: { coordinatorId: 'valid-user-id' },
    asRole: 'MODERATOR',
    expectedStatus: 200,
  },
  {
    name: 'Assign squad validates squad exists',
    endpoint: '/api/cases/test-id/assign-squad',
    method: 'POST',
    body: { squadId: 'nonexistent' },
    asRole: 'ADMIN',
    expectedStatus: 400,
  },
];
```

**Acceptance Criteria:**
- [ ] Permission tests defined
- [ ] Tests run from QA page
- [ ] Results show pass/fail with details

---

## TASK-R09: ERROR_IMPACT Health Dashboard Entries

**Goal:** Add permission and assignment events to health dashboard.

**Files:**
- `frontend/app/admin/health/page.js`

**ERROR_IMPACT Entries:**

```javascript
const ERROR_IMPACT = {
  // ... existing entries ...

  // Roles & Assignment (Phase 22-24)
  'auth.permission_denied': {
    level: 'MEDIUM',
    description: 'User attempted unauthorized action',
    action: 'Review user role and action attempted',
  },
  'case.assign_coordinator_failed': {
    level: 'LOW',
    description: 'Failed to assign coordinator',
    action: 'Check case and user validity',
  },
  'case.assign_squad_failed': {
    level: 'LOW',
    description: 'Failed to assign squad',
    action: 'Check case and squad validity',
  },
};
```

**Acceptance Criteria:**
- [ ] ERROR_IMPACT entries added
- [ ] Health dashboard displays events
- [ ] Impact levels appropriate

---

## TASK-R10: Update VISION.md

**Goal:** Update VISION.md to mark Phase 22-24 as complete.

**Files:**
- `VISION.md`

**Changes:**
- Change Phase 22-24 status from "IN PROGRESS" to "COMPLETE"
- Add completion date

**Acceptance Criteria:**
- [ ] Status updated
- [ ] Date added

---

## Dependencies

```
TASK-R01 (permissions) → TASK-R03, TASK-R04, TASK-R05
TASK-R02 (schema) → TASK-R04, TASK-R05
TASK-R04, TASK-R05 → TASK-R06, TASK-R07
TASK-R06, TASK-R07 → TASK-R08, TASK-R09
```

---

*Last Updated: 2025-11-25*
