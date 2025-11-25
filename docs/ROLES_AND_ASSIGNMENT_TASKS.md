# Phase 22-24: Roles, Permissions & Case Assignment MVP - Task Breakdown

**Feature Spec:** `docs/features/roles-and-assignment-mvp.md`
**Status:** ❌ Not Started
**Target:** November 25, 2025

---

## Overview

This document breaks Phase 22-24 into **6 sequential tasks**:

- **TASK-R01**: Role Model Audit & VISION Update
- **TASK-R02**: Permission Helper Module
- **TASK-R03**: Gate Admin Surfaces
- **TASK-R04**: Case Assignment Schema & APIs
- **TASK-R05**: Admin Case UI for Assignment
- **TASK-R06**: QA Integration, ERROR_IMPACT & Docs

Each task includes:
- Clear goal
- Files to create/modify
- Implementation details
- Acceptance criteria
- Commit message template

---

## TASK-R01: Role Model Audit & VISION Update

**Goal:** Document current role landscape and update VISION.md with Phase 22-24 entry.

**Status:** ❌ Not Started

### Files

**Read:**
- `frontend/prisma/schema.prisma` (User model, UserRole enum)
- `VISION.md` (current status)

**Update:**
- `VISION.md` – Add Phase 22-24 entry (initially marked ❌)
- `docs/features/roles-and-assignment-mvp.md` – Already created

### Implementation

1. **Verify Role Model:**
   - Confirm `UserRole` enum has: `USER`, `PATROL`, `MODERATOR`, `ADMIN`
   - Confirm `RescueSquadMemberRole` enum has: `FOUNDER`, `LEADER`, `COORDINATOR`, `MEMBER`
   - Document any discrepancies in feature spec

2. **Update VISION.md:**
   - Add new section after Phase 25-26:
   ```markdown
   - **🎯 Phase 22-24: Roles, Permissions & Case Assignment MVP** ❌ **IN PROGRESS** (Nov 25, 2025)
     - **Scope**: Explicit global role enforcement and case coordinator tracking
     - **Permission Model**: ADMIN, MODERATOR, PATROL, USER with clear access rules
     - **Admin Gating**: All /admin/* surfaces require ADMIN role
     - **Case Assignment**: Optional coordinatorId and squadId fields on LostPetCase
     - **Assignment APIs**: Endpoints to assign coordinator and owning squad
     - **Permission Helper**: Centralized lib/permissions.js module
     - **Observability**: All permission failures emit auth.permission_denied events
     - **QA Integration**: 6 new tests for permissions and assignment
     - **See:** `docs/features/roles-and-assignment-mvp.md`
   ```

3. **No code changes yet** – this is purely documentation.

### Acceptance Criteria

- [ ] Existing role enums verified and documented
- [ ] VISION.md updated with Phase 22-24 entry
- [ ] Feature spec status remains "❌ Not Started" (will update in TASK-R06)
- [ ] No code modifications yet

### Commit Message

```
[Phase 22-24] Add Roles & Case Assignment MVP to VISION

- Added Phase 22-24 entry to VISION.md (marked in progress)
- Verified UserRole enum: USER, PATROL, MODERATOR, ADMIN
- Verified RescueSquadMemberRole: FOUNDER, LEADER, COORDINATOR, MEMBER
- Feature spec already created: docs/features/roles-and-assignment-mvp.md
- Task breakdown created: docs/ROLES_AND_ASSIGNMENT_TASKS.md
- No code changes in this task (documentation only)
```

---

## TASK-R02: Permission Helper Module

**Goal:** Create centralized permission checking module with logging.

**Status:** ❌ Not Started

### Files

**Create:**
- `frontend/app/lib/permissions.js` – New permission helper module

**Reference:**
- `lib/logging.js` – For logEvent()
- Existing admin pages for usage patterns

### Implementation

Create `/frontend/app/lib/permissions.js`:

```javascript
/**
 * Permission Helper Module (Phase 22-24)
 *
 * Centralized permission checks with structured event logging.
 * All permission failures emit auth.permission_denied events.
 */

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
 *
 * @param {object} session - NextAuth session object
 * @param {object} context - Additional context for logging
 * @throws {PermissionError} If user doesn't have ADMIN role
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
        attempted_resource: context.resource_type,
        ...context.metadata
      }
    });

    throw new PermissionError('Admin access required', {
      required: 'ADMIN',
      actual: role
    });
  }
}

/**
 * Require ADMIN or MODERATOR role
 *
 * @param {object} session - NextAuth session object
 * @param {object} context - Additional context for logging
 * @throws {PermissionError} If user doesn't have ADMIN or MODERATOR role
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
        attempted_resource: context.resource_type,
        ...context.metadata
      }
    });

    throw new PermissionError('Staff access required', {
      required: 'ADMIN or MODERATOR',
      actual: role
    });
  }
}

/**
 * Check if user can edit case
 * MVP: Only ADMIN can edit all cases
 * Future: Also coordinator and squad leaders
 *
 * @param {object} session - NextAuth session object
 * @param {object} caseData - Case data object (optional, for future use)
 * @returns {boolean} True if user can edit
 */
export function canEditCase(session, caseData = null) {
  const role = getUserRole(session);

  // ADMIN can edit all cases
  if (role === 'ADMIN') {
    return true;
  }

  // Future: MODERATOR can edit if they're the coordinator
  // if (role === 'MODERATOR' && caseData?.coordinatorId === session?.user?.id) {
  //   return true;
  // }

  // Future: Squad leaders can edit squad cases
  // if (caseData?.squadId && isSquadLeader(session.user.id, caseData.squadId)) {
  //   return true;
  // }

  return false;
}

/**
 * Check if user can assign case coordinator or squad
 * MVP: Only ADMIN
 *
 * @param {object} session - NextAuth session object
 * @returns {boolean} True if user can assign
 */
export function canAssignCase(session) {
  return getUserRole(session) === 'ADMIN';
}

/**
 * Check if user is admin (synchronous, no logging)
 * For simple UI conditionals
 *
 * @param {object} session - NextAuth session object
 * @returns {boolean} True if user is ADMIN
 */
export function isAdmin(session) {
  return getUserRole(session) === 'ADMIN';
}

/**
 * Check if user is staff (ADMIN or MODERATOR)
 * For simple UI conditionals
 *
 * @param {object} session - NextAuth session object
 * @returns {boolean} True if user is ADMIN or MODERATOR
 */
export function isStaff(session) {
  const role = getUserRole(session);
  return role === 'ADMIN' || role === 'MODERATOR';
}

/**
 * Custom error for permission failures
 * Can be caught and handled with 403 responses
 */
export class PermissionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'PermissionError';
    this.details = details;
    this.statusCode = 403;
  }
}
```

### Acceptance Criteria

- [ ] `lib/permissions.js` module created with all functions
- [ ] Helper functions include:
  - `getUserRole(session)`
  - `requireAdmin(session, context)`
  - `requireStaffOrAdmin(session, context)`
  - `canEditCase(session, caseData)`
  - `canAssignCase(session)`
  - `isAdmin(session)`
  - `isStaff(session)`
- [ ] `PermissionError` class defined
- [ ] Permission failures log `auth.permission_denied` events with proper metadata
- [ ] No breaking changes to existing code (module not used yet)

### Commit Message

```
[Phase 22-24] TASK-R02: Create permission helper module

- Created lib/permissions.js with centralized permission checks
- Functions: requireAdmin, requireStaffOrAdmin, canEditCase, canAssignCase
- All permission failures log auth.permission_denied events
- Includes PermissionError class for consistent error handling
- Designed for MVP (ADMIN-only) with hooks for future roles
- No existing code modified yet (helpers ready for TASK-R03)
```

---

## TASK-R03: Gate Admin Surfaces

**Goal:** Apply permission checks to all admin pages and APIs.

**Status:** ❌ Not Started

### Files

**Modify:**
- `frontend/app/admin/health/page.jsx` – Add permission check
- `frontend/app/admin/qa/page.js` – Replace inline check with helper
- `frontend/app/admin/cases/page.js` – Add permission check
- `frontend/app/admin/cases/[id]/page.js` – Add permission check
- `frontend/app/admin/cases/new/page.js` – Add permission check
- `frontend/app/api/cases/route.js` – Add permission check to POST
- `frontend/app/api/cases/[id]/status/route.js` – Add permission check
- `frontend/app/api/cases/[id]/notes/route.js` – Add permission check

### Implementation

#### Client-Side Gating Pattern

For all admin pages (`/admin/*`), add this pattern after session check:

```javascript
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { isAdmin } from '@/app/lib/permissions';

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/api/auth/signin');
      return;
    }

    if (!isAdmin(session)) {
      router.push('/dashboard');
      // Optionally show toast: "Admin access required"
    }
  }, [session, status, router]);

  if (status === 'loading' || !session || !isAdmin(session)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // ... rest of component
}
```

**Add "ADMIN ONLY" badge to page headers:**

```javascript
<h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
  Admin Health Dashboard
  <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded font-semibold">
    🔒 ADMIN ONLY
  </span>
</h1>
```

#### Server-Side API Gating Pattern

For all admin-only API routes:

```javascript
import { requireAdmin, requireStaffOrAdmin, PermissionError } from '@/app/lib/permissions';

export async function POST(request, { params }) {
  const startTime = Date.now();
  let session = null;

  try {
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permission (choose requireAdmin or requireStaffOrAdmin)
    try {
      await requireAdmin(session, {
        resource_type: 'case',
        resource_id: params?.id,
        action: 'update_status'
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

    // ... continue with original logic
  } catch (error) {
    // ... existing error handling
  }
}
```

### Specific File Changes

**1. `/admin/health/page.jsx`**
- Replace existing `if (session.user.role !== 'ADMIN')` check with `if (!isAdmin(session))`
- Add "🔒 ADMIN ONLY" badge to header

**2. `/admin/qa/page.js`**
- Replace existing `if (session.user.role !== 'ADMIN')` check with `if (!isAdmin(session))`
- Add "🔒 ADMIN ONLY" badge to header

**3. `/admin/cases/page.js`**
- Add permission check using `isAdmin(session)`
- Add "🔒 ADMIN ONLY" badge

**4. `/admin/cases/[id]/page.js`**
- Add permission check using `isAdmin(session)`
- Add "🔒 ADMIN ONLY" badge

**5. `/admin/cases/new/page.js`**
- Add permission check using `isAdmin(session)`
- Add "🔒 ADMIN ONLY" badge

**6. `/api/cases/route.js` (POST handler)**
- Add `requireStaffOrAdmin` check after authentication
- This allows both ADMIN and MODERATOR to create cases

**7. `/api/cases/[id]/status/route.js`**
- Add `requireStaffOrAdmin` check after waiver check
- Allows staff to update status

**8. `/api/cases/[id]/notes/route.js`**
- Add `requireStaffOrAdmin` check after authentication
- Allows staff to add notes

### Acceptance Criteria

- [ ] All `/admin/*` client pages check `isAdmin(session)` and redirect non-admins
- [ ] All admin pages show "🔒 ADMIN ONLY" badge
- [ ] Case APIs use `requireStaffOrAdmin` for write operations
- [ ] Non-admin users redirected to `/dashboard` with clear message
- [ ] Permission failures log `auth.permission_denied` events
- [ ] No regressions to existing functionality
- [ ] Manual testing: Login as different roles, verify access control

### Commit Message

```
[Phase 22-24] TASK-R03: Gate admin surfaces with permission checks

Client-Side Changes:
- Updated /admin/health, /admin/qa, /admin/cases/* to use isAdmin() helper
- Added "🔒 ADMIN ONLY" badges to all admin page headers
- Non-admins redirected to /dashboard with clear access denied behavior

Server-Side Changes:
- Added requireStaffOrAdmin() checks to case APIs (create, status, notes)
- Permission failures return 403 with clear error messages
- All failures logged as auth.permission_denied events

Testing:
- Verified ADMIN can access all admin pages
- Verified non-ADMIN users redirected from admin pages
- Verified permission failures logged in EventLog

No regressions to existing case workflows
```

---

## TASK-R04: Case Assignment Schema & APIs

**Goal:** Add coordinator field to schema and create assignment endpoints.

**Status:** ❌ Not Started

### Files

**Modify:**
- `frontend/prisma/schema.prisma` – Add coordinatorId field and relation

**Create:**
- `frontend/app/api/cases/[id]/assign-coordinator/route.js` – New API endpoint
- `frontend/app/api/cases/[id]/assign-squad/route.js` – New API endpoint (or modify existing update)

### Implementation

#### 1. Schema Changes

Update `prisma/schema.prisma`:

```prisma
model LostPetCase {
  // ... existing fields ...

  // NEW: Case Assignment (Phase 22-24)
  coordinatorId   String?
  coordinator     User?         @relation("CaseCoordinator", fields: [coordinatorId], references: [id])

  // EXISTING: Owning squad (already present, keeping as-is)
  squadId         String?
  squad           RescueSquad?  @relation(fields: [squadId], references: [id])

  // ... other relations ...

  @@index([coordinatorId])
}

model User {
  // ... existing relations ...

  // NEW: Cases coordinated by this user
  coordinatedCases  LostPetCase[]  @relation("CaseCoordinator")
}
```

**Create migration:**

```bash
cd frontend
npx prisma migrate dev --name add_case_coordinator
```

**Migration file will:**
- Add `coordinatorId` column to `LostPetCase` (nullable, indexed)
- Add foreign key constraint to `User`
- Existing cases will have `coordinatorId = null`

#### 2. Assign Coordinator API

Create `/frontend/app/api/cases/[id]/assign-coordinator/route.js`:

```javascript
/**
 * Case Coordinator Assignment API
 * Phase 22-24: Roles & Permissions MVP (TASK-R04)
 *
 * POST /api/cases/[id]/assign-coordinator - Assign or change coordinator
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { requireAdmin, PermissionError } from '@/app/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cases/[id]/assign-coordinator
 * Assign or change the case coordinator
 */
export async function POST(request, { params }) {
  const startTime = Date.now();
  let session = null;

  try {
    // Authentication check
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check (ADMIN only for MVP)
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

    // Parse request body
    const body = await request.json();
    const { coordinatorId } = body;

    // Validate coordinator ID if provided
    if (coordinatorId !== null) {
      const coordinator = await prisma.user.findUnique({
        where: { id: coordinatorId },
        select: { id: true, role: true, firstName: true }
      });

      if (!coordinator) {
        await logEvent({
          event_type: 'case.assign_coordinator_failed',
          resource_type: 'case',
          resource_id: params.id,
          action: 'update',
          result: 'failure',
          error_code: 'INVALID_COORDINATOR',
          error_message: 'Coordinator user not found: ' + coordinatorId,
          actor_user_id: session.user.id,
          actor_role: session.user.role || 'USER',
          metadata: { caseId: params.id, coordinatorId }
        });

        return NextResponse.json({
          error: 'Invalid coordinator',
          message: 'Coordinator user not found'
        }, { status: 400 });
      }

      // Validate coordinator has appropriate role (ADMIN or MODERATOR)
      if (coordinator.role !== 'ADMIN' && coordinator.role !== 'MODERATOR') {
        await logEvent({
          event_type: 'case.assign_coordinator_failed',
          resource_type: 'case',
          resource_id: params.id,
          action: 'update',
          result: 'failure',
          error_code: 'INVALID_COORDINATOR_ROLE',
          error_message: `User ${coordinatorId} has role ${coordinator.role}, must be ADMIN or MODERATOR`,
          actor_user_id: session.user.id,
          actor_role: session.user.role || 'USER',
          metadata: { caseId: params.id, coordinatorId, coordinatorRole: coordinator.role }
        });

        return NextResponse.json({
          error: 'Invalid coordinator role',
          message: 'Coordinator must have ADMIN or MODERATOR role'
        }, { status: 400 });
      }
    }

    // Fetch current case
    const currentCase = await prisma.lostPetCase.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        caseNumber: true,
        coordinatorId: true,
        coordinator: {
          select: { id: true, firstName: true, role: true }
        }
      }
    });

    if (!currentCase) {
      await logEvent({
        event_type: 'case.assign_coordinator_failed',
        resource_type: 'case',
        resource_id: params.id,
        action: 'update',
        result: 'failure',
        error_code: 'NOT_FOUND',
        error_message: 'Case not found: ' + params.id,
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { caseId: params.id }
      });

      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const previousCoordinatorId = currentCase.coordinatorId;

    // Update case
    const updatedCase = await prisma.lostPetCase.update({
      where: { id: params.id },
      data: { coordinatorId: coordinatorId || null },
      include: {
        coordinator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        squad: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true
          }
        }
      }
    });

    const responseTime = Date.now() - startTime;

    // Log assignment change
    await logEvent({
      event_type: 'case.assignment_changed',
      resource_type: 'case',
      resource_id: params.id,
      action: 'update',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: session.user.role || 'USER',
      metadata: {
        case_id: params.id,
        case_number: currentCase.caseNumber,
        field_changed: 'coordinator',
        previous_value: previousCoordinatorId,
        new_value: coordinatorId,
        assigned_by: session.user.id,
        response_time_ms: responseTime
      }
    });

    return NextResponse.json({
      success: true,
      case: updatedCase,
      message: coordinatorId ? 'Coordinator assigned successfully' : 'Coordinator unassigned successfully'
    });

  } catch (error) {
    console.error('Error assigning coordinator:', error);

    await logEvent({
      event_type: 'case.assign_coordinator_failed',
      resource_type: 'case',
      resource_id: params.id,
      action: 'update',
      result: 'failure',
      error_code: 'SERVER_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || 'USER',
      metadata: {
        caseId: params.id,
        error_stack: error.stack?.substring(0, 500)
      }
    });

    return NextResponse.json({
      error: 'Failed to assign coordinator',
      message: error.message
    }, { status: 500 });
  }
}
```

#### 3. Assign Squad API

Create `/frontend/app/api/cases/[id]/assign-squad/route.js`:

```javascript
/**
 * Case Squad Assignment API
 * Phase 22-24: Roles & Permissions MVP (TASK-R04)
 *
 * POST /api/cases/[id]/assign-squad - Assign or change owning squad
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { requireAdmin, PermissionError } from '@/app/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cases/[id]/assign-squad
 * Assign or change the owning squad
 */
export async function POST(request, { params }) {
  const startTime = Date.now();
  let session = null;

  try {
    session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Permission check (ADMIN only for MVP)
    try {
      await requireAdmin(session, {
        resource_type: 'case',
        resource_id: params.id,
        action: 'assign_squad'
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

    const body = await request.json();
    const { squadId } = body;

    // Validate squad ID if provided
    if (squadId !== null) {
      const squad = await prisma.rescueSquad.findUnique({
        where: { id: squadId },
        select: { id: true, name: true, isActive: true }
      });

      if (!squad) {
        await logEvent({
          event_type: 'case.assign_squad_failed',
          resource_type: 'case',
          resource_id: params.id,
          action: 'update',
          result: 'failure',
          error_code: 'INVALID_SQUAD',
          error_message: 'Squad not found: ' + squadId,
          actor_user_id: session.user.id,
          actor_role: session.user.role || 'USER',
          metadata: { caseId: params.id, squadId }
        });

        return NextResponse.json({
          error: 'Invalid squad',
          message: 'Squad not found'
        }, { status: 400 });
      }

      if (!squad.isActive) {
        await logEvent({
          event_type: 'case.assign_squad_failed',
          resource_type: 'case',
          resource_id: params.id,
          action: 'update',
          result: 'failure',
          error_code: 'INACTIVE_SQUAD',
          error_message: 'Cannot assign inactive squad: ' + squadId,
          actor_user_id: session.user.id,
          actor_role: session.user.role || 'USER',
          metadata: { caseId: params.id, squadId, squadName: squad.name }
        });

        return NextResponse.json({
          error: 'Inactive squad',
          message: 'Cannot assign inactive squad'
        }, { status: 400 });
      }
    }

    // Fetch current case
    const currentCase = await prisma.lostPetCase.findUnique({
      where: { id: params.id },
      select: { id: true, caseNumber: true, squadId: true }
    });

    if (!currentCase) {
      await logEvent({
        event_type: 'case.assign_squad_failed',
        resource_type: 'case',
        resource_id: params.id,
        action: 'update',
        result: 'failure',
        error_code: 'NOT_FOUND',
        error_message: 'Case not found: ' + params.id,
        actor_user_id: session.user.id,
        actor_role: session.user.role || 'USER',
        metadata: { caseId: params.id }
      });

      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const previousSquadId = currentCase.squadId;

    // Update case
    const updatedCase = await prisma.lostPetCase.update({
      where: { id: params.id },
      data: { squadId: squadId || null },
      include: {
        coordinator: {
          select: { id: true, firstName: true, lastName: true, role: true }
        },
        squad: {
          select: { id: true, name: true, city: true, state: true }
        }
      }
    });

    const responseTime = Date.now() - startTime;

    // Log assignment change
    await logEvent({
      event_type: 'case.squad_assigned',
      resource_type: 'case',
      resource_id: params.id,
      action: 'update',
      result: 'success',
      actor_user_id: session.user.id,
      actor_role: session.user.role || 'USER',
      metadata: {
        case_id: params.id,
        case_number: currentCase.caseNumber,
        field_changed: 'squad',
        previous_value: previousSquadId,
        new_value: squadId,
        assigned_by: session.user.id,
        response_time_ms: responseTime
      }
    });

    return NextResponse.json({
      success: true,
      case: updatedCase,
      message: squadId ? 'Squad assigned successfully' : 'Squad unassigned successfully'
    });

  } catch (error) {
    console.error('Error assigning squad:', error);

    await logEvent({
      event_type: 'case.assign_squad_failed',
      resource_type: 'case',
      resource_id: params.id,
      action: 'update',
      result: 'failure',
      error_code: 'SERVER_ERROR',
      error_message: error.message,
      actor_user_id: session?.user?.id || null,
      actor_role: session?.user?.role || 'USER',
      metadata: {
        caseId: params.id,
        error_stack: error.stack?.substring(0, 500)
      }
    });

    return NextResponse.json({
      error: 'Failed to assign squad',
      message: error.message
    }, { status: 500 });
  }
}
```

### Acceptance Criteria

- [ ] Schema updated with `coordinatorId` field and `CaseCoordinator` relation
- [ ] Migration created and applied successfully
- [ ] Existing cases have `coordinatorId = null`
- [ ] `POST /api/cases/[id]/assign-coordinator` endpoint created
- [ ] `POST /api/cases/[id]/assign-squad` endpoint created
- [ ] Both endpoints require ADMIN role
- [ ] Coordinator validation: must exist and have ADMIN/MODERATOR role
- [ ] Squad validation: must exist and be active
- [ ] Assignment changes emit proper events (`case.assignment_changed`, `case.squad_assigned`)
- [ ] Invalid inputs return 400 with clear error messages
- [ ] Manual testing: Assign coordinator, assign squad, verify events logged

### Commit Message

```
[Phase 22-24] TASK-R04: Add case assignment schema and APIs

Schema Changes:
- Added coordinatorId field to LostPetCase (nullable, indexed)
- Added CaseCoordinator relation between User and LostPetCase
- Migration: add_case_coordinator

New API Endpoints:
- POST /api/cases/[id]/assign-coordinator - Assign/change coordinator
- POST /api/cases/[id]/assign-squad - Assign/change owning squad

Features:
- ADMIN-only access (enforced via requireAdmin helper)
- Coordinator validation (must be ADMIN or MODERATOR role)
- Squad validation (must exist and be active)
- Assignment changes emit case.assignment_changed and case.squad_assigned events
- All failures logged with structured events

Testing:
- Verified migration applies cleanly
- Tested coordinator assignment (valid, invalid, unassign)
- Tested squad assignment (valid, invalid, unassign)
- Verified events logged correctly

No regressions to existing case functionality
```

---

## TASK-R05: Admin Case UI for Assignment

**Goal:** Add coordinator and squad assignment controls to admin UI.

**Status:** ❌ Not Started

### Files

**Modify:**
- `frontend/app/admin/cases/[id]/page.js` – Add assignment controls to case detail
- Optionally: `frontend/app/admin/cases/page.js` – Add coordinator column to list

### Implementation

#### 1. Case Detail Assignment Section

In `/admin/cases/[id]/page.js`, add assignment UI after case details:

```javascript
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { isAdmin } from '@/app/lib/permissions';

export default function AdminCaseDetailPage({ params }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);

  // NEW: Assignment state
  const [coordinators, setCoordinators] = useState([]);
  const [squads, setSquads] = useState([]);
  const [selectedCoordinatorId, setSelectedCoordinatorId] = useState(null);
  const [selectedSquadId, setSelectedSquadId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  // ... existing auth/permission checks ...

  useEffect(() => {
    if (status === 'authenticated' && isAdmin(session)) {
      // Fetch case data (existing)
      fetchCase();

      // NEW: Fetch assignment options
      fetchAssignmentOptions();
    }
  }, [status, session]);

  async function fetchCase() {
    // ... existing case fetch ...
    const res = await fetch(`/api/cases/${params.id}`);
    const data = await res.json();
    setCaseData(data);

    // Set initial selection
    setSelectedCoordinatorId(data.coordinatorId || '');
    setSelectedSquadId(data.squadId || '');

    setLoading(false);
  }

  async function fetchAssignmentOptions() {
    // Fetch potential coordinators (ADMIN + MODERATOR users)
    const usersRes = await fetch('/api/users?roles=ADMIN,MODERATOR');
    const { users } = await usersRes.json();
    setCoordinators(users || []);

    // Fetch active squads
    const squadsRes = await fetch('/api/rescue-squads?active=true');
    const { cities } = await squadsRes.json();
    // Extract squads from cities response
    const allSquads = cities
      .filter(c => c.squad)
      .map(c => c.squad);
    setSquads(allSquads || []);
  }

  async function handleSaveAssignment() {
    setSaving(true);
    setSaveMessage(null);

    try {
      // Update coordinator if changed
      if (selectedCoordinatorId !== (caseData.coordinatorId || '')) {
        const coordRes = await fetch(`/api/cases/${params.id}/assign-coordinator`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            coordinatorId: selectedCoordinatorId || null
          })
        });

        if (!coordRes.ok) {
          const error = await coordRes.json();
          throw new Error(error.message || 'Failed to update coordinator');
        }
      }

      // Update squad if changed
      if (selectedSquadId !== (caseData.squadId || '')) {
        const squadRes = await fetch(`/api/cases/${params.id}/assign-squad`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            squadId: selectedSquadId || null
          })
        });

        if (!squadRes.ok) {
          const error = await squadRes.json();
          throw new Error(error.message || 'Failed to update squad');
        }
      }

      setSaveMessage({ type: 'success', text: 'Assignment updated successfully' });

      // Refresh case data
      await fetchCase();
    } catch (error) {
      console.error('Save error:', error);
      setSaveMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  }

  const hasChanges =
    selectedCoordinatorId !== (caseData?.coordinatorId || '') ||
    selectedSquadId !== (caseData?.squadId || '');

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Existing case detail sections ... */}

      {/* NEW: Assignment Section */}
      <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Assignment
        </h2>

        <div className="space-y-4">
          {/* Coordinator Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Coordinator:
            </label>
            <select
              value={selectedCoordinatorId}
              onChange={(e) => setSelectedCoordinatorId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Unassigned</option>
              {coordinators.map(coord => (
                <option key={coord.id} value={coord.id}>
                  {coord.firstName} {coord.lastName} ({coord.role})
                </option>
              ))}
            </select>
          </div>

          {/* Squad Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Owning Squad:
            </label>
            <select
              value={selectedSquadId}
              onChange={(e) => setSelectedSquadId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No squad</option>
              {squads.map(squad => (
                <option key={squad.id} value={squad.id}>
                  {squad.name} ({squad.city}, {squad.state})
                </option>
              ))}
            </select>
          </div>

          {/* Save Button */}
          {hasChanges && (
            <button
              onClick={handleSaveAssignment}
              disabled={saving}
              className={`
                px-6 py-3 rounded-lg font-semibold transition-colors
                ${saving
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                }
              `}
            >
              {saving ? 'Saving...' : 'Save Assignment'}
            </button>
          )}

          {/* Save Message */}
          {saveMessage && (
            <div className={`
              p-4 rounded-lg
              ${saveMessage.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-800'
              }
            `}>
              {saveMessage.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Note:** You'll need to create `/api/users` endpoint to fetch ADMIN/MODERATOR users, or inline the user fetch logic.

#### 2. Case List Coordinator Column (Optional)

In `/admin/cases/page.js`, add coordinator column to table:

```javascript
<table className="min-w-full divide-y divide-gray-200">
  <thead className="bg-gray-50">
    <tr>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
        Case Number
      </th>
      {/* ... other columns ... */}
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
        Coordinator
      </th>
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
        Squad
      </th>
    </tr>
  </thead>
  <tbody>
    {cases.map(caseItem => (
      <tr key={caseItem.id}>
        <td className="px-6 py-4">{caseItem.caseNumber}</td>
        {/* ... other cells ... */}
        <td className="px-6 py-4 text-sm text-gray-600">
          {caseItem.coordinator
            ? `${caseItem.coordinator.firstName} ${caseItem.coordinator.lastName || ''}`
            : <span className="text-gray-400 italic">Unassigned</span>
          }
        </td>
        <td className="px-6 py-4 text-sm text-gray-600">
          {caseItem.squad
            ? caseItem.squad.name
            : <span className="text-gray-400 italic">No squad</span>
          }
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

**Update API response** in `/api/cases/route.js` GET handler to include coordinator and squad:

```javascript
const cases = await prisma.lostPetCase.findMany({
  where,
  include: {
    coordinator: {
      select: { id: true, firstName: true, lastName: true, role: true }
    },
    squad: {
      select: { id: true, name: true, city: true, state: true }
    },
    createdBy: {
      select: { id: true, firstName: true, lastName: true }
    }
  },
  orderBy: { createdAt: 'desc' },
  take: limit
});
```

### Acceptance Criteria

- [ ] Case detail page shows Assignment section
- [ ] Coordinator dropdown lists ADMIN/MODERATOR users
- [ ] Squad dropdown lists active squads
- [ ] "Save Assignment" button appears when changes made
- [ ] Successful save shows success message and refreshes data
- [ ] Failed save shows error message
- [ ] Case list shows coordinator and squad columns
- [ ] "Unassigned" shown in gray when no coordinator
- [ ] UI is responsive and matches existing design
- [ ] No regressions to existing case detail functionality

### Commit Message

```
[Phase 22-24] TASK-R05: Add assignment controls to admin case UI

Case Detail Page Changes:
- Added Assignment section with coordinator and squad dropdowns
- Coordinator dropdown lists ADMIN/MODERATOR users only
- Squad dropdown lists all active squads
- "Save Assignment" button enabled when changes made
- Success/error feedback via toast messages
- Auto-refresh case data after successful save

Case List Page Changes (Optional):
- Added Coordinator column showing assigned user or "Unassigned"
- Added Squad column showing squad name or "No squad"
- Updated GET /api/cases to include coordinator and squad relations

Testing:
- Verified assignment dropdowns populate correctly
- Tested coordinator assignment via UI
- Tested squad assignment via UI
- Verified success/error messages display properly
- Confirmed EventLog shows assignment_changed events

No regressions to existing admin case UI
```

---

## TASK-R06: QA Integration, ERROR_IMPACT & Docs

**Goal:** Add QA tests, update health dashboard, and finalize documentation.

**Status:** ❌ Not Started

### Files

**Modify:**
- `frontend/app/admin/qa/page.js` – Add permission & assignment tests
- `frontend/app/admin/health/page.jsx` – Add ERROR_IMPACT mappings
- `docs/features/roles-and-assignment-mvp.md` – Mark as "✅ Fully Implemented"
- `VISION.md` – Update Phase 22-24 entry to ✅ COMPLETE

### Implementation

#### 1. Add QA Tests

In `/admin/qa/page.js`, add new test suite: "Permission & Assignment Tests"

**Test Functions:**

```javascript
// ============================================================================
// PERMISSION & ASSIGNMENT TEST CASES (Phase 22-24)
// ============================================================================

async function testAdminCanAccessHealth() {
  // Verify authenticated admin can access health page
  const res = await fetch('/admin/health');

  if (!res.ok) {
    throw new Error(`Health page access failed: ${res.status}`);
  }

  return {
    status: res.status,
    can_access: true,
    note: 'ADMIN can access /admin/health'
  };
}

async function testNonAdminBlockedFromHealth() {
  // This test requires creating a non-admin session, which is tricky in browser tests
  // For MVP, we can document this as a manual test case
  // Or implement by checking if non-admin redirect logic exists in the page code

  return {
    note: 'Manual test: Login as PATROL, attempt /admin/health, verify redirect to /dashboard'
  };
}

async function testAssignCaseCoordinator() {
  // Create a test case
  const createRes = await fetch('/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      petSpecies: 'DOG',
      petName: '[ASSIGNMENT QA TEST]'
    })
  });

  if (!createRes.ok) {
    const error = await createRes.json();
    throw new Error(`Create case failed: ${error.error}`);
  }

  const { case: testCase } = await createRes.json();

  // Fetch list of coordinators
  const usersRes = await fetch('/api/users?roles=ADMIN,MODERATOR');
  const { users } = await usersRes.json();

  if (!users || users.length === 0) {
    return {
      case_id: testCase.id,
      note: 'No ADMIN/MODERATOR users available for assignment test'
    };
  }

  const coordinatorId = users[0].id;

  // Assign coordinator
  const assignRes = await fetch(`/api/cases/${testCase.id}/assign-coordinator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinatorId })
  });

  if (!assignRes.ok) {
    const error = await assignRes.json();
    throw new Error(`Assign coordinator failed: ${error.message || error.error}`);
  }

  const { case: updatedCase } = await assignRes.json();

  return {
    case_id: updatedCase.id,
    case_number: updatedCase.caseNumber,
    coordinator_id: updatedCase.coordinatorId,
    coordinator_name: updatedCase.coordinator?.firstName,
    note: 'Coordinator assigned successfully. Check EventLog for case.assignment_changed event.'
  };
}

async function testAssignCaseSquad() {
  // Find or create a test case
  const listRes = await fetch('/api/cases?limit=1');
  if (!listRes.ok) {
    throw new Error('Failed to list cases');
  }

  const { cases } = await listRes.json();
  let testCaseId;

  if (cases.length > 0) {
    testCaseId = cases[0].id;
  } else {
    // Create one
    const createRes = await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        petSpecies: 'CAT',
        petName: '[SQUAD ASSIGNMENT QA TEST]'
      })
    });

    if (!createRes.ok) {
      const error = await createRes.json();
      throw new Error(`Create case failed: ${error.error}`);
    }

    const { case: newCase } = await createRes.json();
    testCaseId = newCase.id;
  }

  // Find an active squad
  const squadsRes = await fetch('/api/rescue-squads?active=true&limit=1');
  const { cities } = await squadsRes.json();

  const testSquad = cities.find(c => c.squad);
  if (!testSquad) {
    return {
      case_id: testCaseId,
      note: 'No active squads available for assignment test'
    };
  }

  const squadId = testSquad.squad.id;

  // Assign squad
  const assignRes = await fetch(`/api/cases/${testCaseId}/assign-squad`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ squadId })
  });

  if (!assignRes.ok) {
    const error = await assignRes.json();
    throw new Error(`Assign squad failed: ${error.message || error.error}`);
  }

  const { case: updatedCase } = await assignRes.json();

  return {
    case_id: updatedCase.id,
    case_number: updatedCase.caseNumber,
    squad_id: updatedCase.squadId,
    squad_name: updatedCase.squad?.name,
    note: 'Squad assigned successfully. Check EventLog for case.squad_assigned event.'
  };
}

async function testInvalidCoordinatorAssignment() {
  // Test assigning invalid coordinator (should fail with validation error)
  const listRes = await fetch('/api/cases?limit=1');
  const { cases } = await listRes.json();

  if (cases.length === 0) {
    return { note: 'No cases available for invalid assignment test' };
  }

  const testCaseId = cases[0].id;
  const invalidCoordinatorId = 'clx-invalid-id-999';

  const assignRes = await fetch(`/api/cases/${testCaseId}/assign-coordinator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinatorId: invalidCoordinatorId })
  });

  if (assignRes.ok) {
    throw new Error('Expected validation error for invalid coordinator');
  }

  const error = await assignRes.json();

  if (!error.error || !error.message) {
    throw new Error('Expected error response with error and message fields');
  }

  return {
    validation_worked: true,
    error_message: error.message,
    note: 'Invalid coordinator correctly rejected with 400 error'
  };
}

async function testPermissionDeniedLogging() {
  // This test verifies that permission failures are logged
  // We can't easily trigger a permission failure from ADMIN session in browser
  // So this is more of a documentation/manual test

  // Check if recent permission_denied events exist
  const healthRes = await fetch('/admin/health');
  // If we had access to EventLog directly, we'd query for auth.permission_denied events

  return {
    note: 'Manual test: Login as PATROL, attempt /admin/health, verify auth.permission_denied event in EventLog'
  };
}
```

**Add State & Runner:**

```javascript
// In TestsPanel function, add:

const [permissionTests, setPermissionTests] = useState([
  { id: 'admin-access-health', name: 'Admin Can Access Health', status: 'idle', fn: testAdminCanAccessHealth },
  { id: 'assign-coordinator', name: 'Assign Case Coordinator', status: 'idle', fn: testAssignCaseCoordinator },
  { id: 'assign-squad', name: 'Assign Case Squad', status: 'idle', fn: testAssignCaseSquad },
  { id: 'invalid-coordinator', name: 'Invalid Coordinator Rejected', status: 'idle', fn: testInvalidCoordinatorAssignment },
]);
const [runningPermission, setRunningPermission] = useState(false);

const runPermissionTests = async () => {
  setRunningPermission(true);

  for (let i = 0; i < permissionTests.length; i++) {
    const test = permissionTests[i];

    setPermissionTests(prev => prev.map(t =>
      t.id === test.id ? { ...t, status: 'running' } : t
    ));

    const result = await runTest(test.name, test.fn);

    setPermissionTests(prev => prev.map(t =>
      t.id === test.id ? { ...t, ...result } : t
    ));

    onTestComplete(result);
  }

  setRunningPermission(false);
};

// Update runAllTests to include permission tests
const runAllTests = async () => {
  await runLegalTests();
  await runSquadTests();
  await runCaseTests();
  await runPublicCaseTests();
  await runNotificationTests();
  await runPermissionTests(); // NEW
};

// Update isAnyRunning
const isAnyRunning = runningLegal || runningSquad || runningCase || runningPublicCase || runningNotification || runningPermission;
```

**Add UI:**

```javascript
{/* Permission & Assignment Test Suite (Phase 22-24) */}
<TestSuite
  title="Permission & Assignment Tests"
  tests={permissionTests}
  onRun={runPermissionTests}
  running={runningPermission}
/>
```

#### 2. Update ERROR_IMPACT

In `/admin/health/page.jsx`, add new event mappings:

```javascript
const ERROR_IMPACT = {
  // ... existing mappings ...

  // Permission & Assignment (Phase 22-24)
  'auth.permission_denied': { label: 'Permission Denied', severity: 'medium' },
  'case.assignment_changed': { label: 'Case Assignment', severity: 'low' },
  'case.assign_coordinator_failed': { label: 'Case Assignment', severity: 'medium' },
  'case.squad_assigned': { label: 'Squad Assignment', severity: 'low' },
  'case.assign_squad_failed': { label: 'Squad Assignment', severity: 'medium' },
};
```

#### 3. Update Documentation

**Update `docs/features/roles-and-assignment-mvp.md`:**

Change status line:
```markdown
**Status:** ✅ Fully Implemented
```

**Update `VISION.md`:**

Change Phase 22-24 entry to ✅ COMPLETE:

```markdown
- **🎉 Phase 22-24: Roles, Permissions & Case Assignment MVP** ✅ **COMPLETE** (Nov 25, 2025)
  - **Permission Model**: Clear roles (ADMIN, MODERATOR, PATROL, USER) with explicit access rules
  - **Admin Gating**: All /admin/* surfaces require ADMIN role with consistent enforcement
  - **Permission Helper**: Centralized lib/permissions.js module with requireAdmin/requireStaffOrAdmin
  - **Case Assignment Schema**: Added coordinatorId (User relation) to LostPetCase
  - **Assignment APIs**: 2 endpoints (assign-coordinator, assign-squad) with validation
  - **Admin UI**: Assignment section on case detail with coordinator/squad dropdowns
  - **Observability**: All permission failures emit auth.permission_denied events
  - **Assignment Logging**: case.assignment_changed and case.squad_assigned events
  - **QA Integration**: 6 new permission & assignment tests in QA harness
  - **ERROR_IMPACT**: New event types mapped to medium/low severity
  - **See:** `docs/features/roles-and-assignment-mvp.md`
```

#### 4. Update Next Tactical Priorities

In VISION.md, update the "Next Tactical Priorities" section:

```markdown
### 🎯 Next Tactical Priorities

1. **Identify and implement next phase cluster from roadmap**
   - Build on Phase 0 (observability), Phase 13-14 (cases), Phase 15-16 (public portal), Phase 20-21 (QA), Phase 25-26 (notifications), Phase 22-24 (roles & assignment) foundations
   - Continue 108-phase roadmap with same discipline
   - All features must emit structured events and respect legal gating
   - Candidate phases: sighting reports, case matching algorithm, coordinator notifications, workload metrics
```

### Acceptance Criteria

- [ ] 6 permission & assignment tests added to QA harness
- [ ] All tests running and passing (or documented as manual tests)
- [ ] ERROR_IMPACT mappings added for new event types
- [ ] Feature spec status updated to "✅ Fully Implemented"
- [ ] VISION.md Phase 22-24 entry marked ✅ COMPLETE
- [ ] All documentation committed and up to date
- [ ] Manual testing completed for full permission & assignment workflow
- [ ] No regressions to existing QA tests or functionality

### Commit Message

```
[Phase 22-24] TASK-R06: QA integration, ERROR_IMPACT, and documentation

QA Harness Integration:
- Added 6 permission & assignment tests to /admin/qa page
  1. Admin Can Access Health test
  2. Assign Case Coordinator test
  3. Assign Case Squad test
  4. Invalid Coordinator Rejected test
  5. Permission denied logging verification
  6. Non-admin access blocked (manual test documented)
- All tests emit qa.test_executed events

ERROR_IMPACT Updates:
- Added auth.permission_denied (medium severity)
- Added case.assignment_changed (low severity)
- Added case.assign_coordinator_failed (medium severity)
- Added case.squad_assigned (low severity)
- Added case.assign_squad_failed (medium severity)

Documentation:
- Updated roles-and-assignment-mvp.md status to "✅ Fully Implemented"
- Updated VISION.md with Phase 22-24 complete entry
- Listed all deliverables: permission model, admin gating, assignment schema, APIs, UI, QA tests

Phase 22-24 is now complete!
```

---

## Summary

Phase 22-24 delivers:

1. **Clear Permission Model** – ADMIN, MODERATOR, PATROL, USER with explicit rules
2. **Centralized Permission Helpers** – `lib/permissions.js` with requireAdmin/requireStaffOrAdmin
3. **Admin Surface Gating** – All `/admin/*` pages and APIs properly protected
4. **Case Assignment** – `coordinatorId` and `squadId` fields with assignment APIs
5. **Admin UI** – Assignment controls on case detail page
6. **Full Observability** – Permission failures and assignment changes logged
7. **QA Integration** – 6 tests validating permissions and assignment
8. **Complete Documentation** – Feature spec, task breakdown, VISION entry

All commits follow established patterns, maintain full observability, and preserve existing functionality.
