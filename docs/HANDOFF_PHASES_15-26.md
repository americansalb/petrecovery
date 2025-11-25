# Handoff Doc: Phases 15–26 (Public Portal, Roles/Assignment, Notifications)

**Repo:** americansalb/petrecovery
**Branch:** claude/cleanup-navbar-vision-01YCsTCcdvUhKCneDuk5ybgz
**Date:** November 25, 2025

This document is a handoff for a new chat / new assistant continuing work on the PetRecovery.org 108-phase roadmap, with focus on Phases 15–16, 22–24, and 25–26.

Use this as your mental "context restore" so you don't have to re-open every file before being productive.

---

## 1. Big Picture

### 1.1 Overall Architecture

- **Frontend:** Next.js App Router app in `frontend/app`.
- **Backend:** Same Next.js instance using `app/api/*` routes.
- **DB:** Prisma + SQLite/PG (Prisma schema in `frontend/prisma/schema.prisma`).
- **Logging:** Centralized `logEvent` in `frontend/app/lib/logging.js` (structured events).
- **Email:** `frontend/app/lib/email.js` + nodemailer with SMTP env vars.
- **Public vs Admin:**
  - **Public surfaces:** `/cases`, `/cases/[caseNumber]`, `/cases/report`.
  - **Admin surfaces:** `/admin/*` (health, qa, cases, etc.), all now ADMIN-only.

### 1.2 Core Conventions

Every significant feature has:
- **Feature spec:** `docs/features/<thing>-mvp.md`
- **Task breakdown:** `docs/<THING>_TASKS.md`

Phases are tracked in `VISION.md` with:
- Status (❌ IN PROGRESS / ✅ COMPLETE)
- Bulleted summary
- Pointer to feature spec.

**QA Harness:** `/admin/qa` is a browser-based test runner; tests are functions inside `frontend/app/admin/qa/page.js`.

**Health Dashboard:** `/admin/health` visualizes logEvent output; error types are mapped via `ERROR_IMPACT` in `frontend/app/admin/health/page.jsx`.

---

## 2. Completed Phases (Relevant Here)

### 2.1 Phase 13–14 (Background, already done)

Context only; you don't need to re-implement.
- Introduced `LostPetCase` model and admin case tools.
- **Specs:** `docs/features/lost-pet-cases-mvp.md`
- **Tasks:** `docs/CASE_MVP_TASKS.md`

You may need to reference these docs to understand the original case flow.

---

### 2.2 Phase 15–16: Public Lost Pet Case Portal MVP ✅

**Spec:** `docs/features/public-lost-pet-portal-mvp.md`
**Tasks:** `docs/PUBLIC_CASE_PORTAL_TASKS.md`

#### 2.2.1 Goals

Public can:
- Browse active public lost pet cases by city/state/species/status.
- View individual case details.
- Submit a public report (which becomes a case, pending admin approval).

Preserve safety:
- Nothing public without explicit flag.
- Contact info only shown when explicitly allowed.
- All public actions are logged.

#### 2.2.2 Data Model

**Model:** `LostPetCase` (in `schema.prisma`) gained:
```prisma
isPublic        Boolean @default(false)
publicContactOk Boolean @default(false)
source          String  @default("ADMIN") // "ADMIN" or "PUBLIC_REPORT"
```

- `isPublic`: controls whether case shows up on public endpoints/pages.
- `publicContactOk`: controls whether contact info is shown on the public detail page.
- `source`: tracks origin of case (ADMIN vs PUBLIC_REPORT).

**Migration is in:**
`frontend/prisma/migrations/20251125_add_public_flags_to_cases/migration.sql`

#### 2.2.3 Public API

All under `frontend/app/api/public/cases/*`:

**GET /api/public/cases**
- Filters: city, state, species, status, page, limit.
- Only returns `isPublic = true` cases.
- Never returns internal-only fields (e.g., createdById, squadId, source).

**GET /api/public/cases/[caseNumber]**
- Returns single case by caseNumber.
- 404 if not found or isPublic=false.
- Contact info removed unless `publicContactOk = true`.

**POST /api/public/cases**
- Public report submission.
- Creates a new `LostPetCase` with:
  - `isPublic = false` (requires admin approval to publish).
  - `source = 'PUBLIC_REPORT'`.
- No auth required.

Each endpoint logs events like:
- `public_case.list_viewed`
- `public_case.detail_viewed`
- `public_case.report_attempted`
- `public_case.report_submitted`
- `public_case.list_failed`
- `public_case.detail_failed`
- `public_case.report_failed`

#### 2.2.4 Public Pages

All under `frontend/app/cases/*`:

**/cases (list)**
- Filters by city, state, species, status.
- Case cards show pet info + high-level location.
- Pagination, loading/error/empty states.

**/cases/[caseNumber] (detail)**
- Shows pet details, location, status.
- Conditionally shows contact info if `publicContactOk=true`.
- Includes safety + legal disclaimers.

**/cases/report (public report form)**
- Multi-step form: Pet Info → Location → Contact.
- Validation and required "terms" checkbox.
- On success shows confirmation + caseNumber.

#### 2.2.5 QA & Health

- **QA harness:** 3 tests added for public case list/detail/report.
- **ERROR_IMPACT** in `/admin/health` updated for `public_case.*` events.

---

### 2.3 Phase 25–26: Notifications MVP (Case Alerts & Admin Signals) ✅

**Spec:** `docs/features/notifications-mvp.md`
**Tasks:** `docs/NOTIFICATIONS_TASKS.md`

#### 2.3.1 Goal

Build a transactional email notification layer for key case lifecycle events:
- **Public report submitted:**
  - Contact gets confirmation.
  - Admin gets an alert (if configured).
- **Case status changes:**
  - Contact gets updates for important statuses.

Everything is email-only and non-blocking (APIs succeed even if email fails).

#### 2.3.2 Email Infrastructure

**Existing util:** `frontend/app/lib/email.js`
- Uses nodemailer + env vars:
  - `EMAIL_SERVICE`
  - `EMAIL_USER`
  - `EMAIL_PASSWORD`
  - `EMAIL_FROM`

**New env var for admin alerts:**
- `ADMIN_NOTIFICATION_EMAIL`

**Setup docs:** `SETUP.md` → "Step 2b: Notification System Configuration (Phase 25-26)"

#### 2.3.3 Notification Helper Module

**File:** `frontend/app/lib/notifications.js`

Provides 3 main functions:

**sendCaseReportConfirmation(caseData, options)**
- To contact when they submit a public report.
- HTML email summarizing case details, next steps, privacy notice.

**sendAdminPublicReportAlert(caseData)**
- To `ADMIN_NOTIFICATION_EMAIL` when a public report is created.
- "URGENT" style, includes link to admin case page.

**sendCaseStatusUpdate(caseData, previousStatus, newStatus)**
- To contact when status becomes one of:
  - `ACTIVE_SEARCH`
  - `RESOLVED`
  - `CLOSED_OTHER`
- Status-specific content (colors + tone).

All 3 functions:
- Use `sendEmail()` under the hood.
- Emit `notification.send_attempted`, `notification.send_succeeded`, `notification.send_failed`.
- Catch and log errors; return `{ success, error }`.

#### 2.3.4 Where Notifications Are Wired

**Public report creation**
File: `frontend/app/api/public/cases/route.js` (POST handler)

After creating a new case and logging `public_case.report_submitted`, it:
- Sends confirmation to `contactEmail` (if present).
- Sends admin alert to `ADMIN_NOTIFICATION_EMAIL` (if set).
- All notification errors are caught & logged; response is still 201.

**Case status update**
File: `frontend/app/api/cases/[id]/status/route.js`

After successful status update and existing event logging:
- Computes `shouldNotify` based on:
  - status ∈ {ACTIVE_SEARCH, RESOLVED, CLOSED_OTHER}
  - Contact email present
  - Status actually changed.
- Calls `sendCaseStatusUpdate()`.
- Notification failures are caught + logged (no impact on API response).

#### 2.3.5 QA & Health

**`/admin/qa` gained 3 notification tests:**
- Report Confirmation Email
- Admin Alert Email
- Status Update Email

**`/admin/health/page.jsx`:**
- `notification.send_failed` → medium severity.
- `notification.send_attempted`, `notification.send_succeeded` → low severity.

---

### 2.4 Phase 22–24: Roles, Permissions & Case Assignment MVP ✅

**Spec:** `docs/features/roles-and-assignment-mvp.md`
**Tasks:** `docs/ROLES_AND_ASSIGNMENT_TASKS.md`
**Status:** Marked ✅ COMPLETE in VISION.md.

#### 2.4.1 Goals

- Centralize permission logic across admin surfaces.
- Make admin-only things explicit and consistent.
- Introduce:
  - **Global role enforcement:** `UserRole = USER | PATROL | MODERATOR | ADMIN`.
  - **Case coordinator:** `coordinatorId` points to primary responsible user.
  - **Owning squad clarity:** explicit `squadId` semantics.

#### 2.4.2 Permission Helper Module

**File:** `frontend/app/lib/permissions.js`

Key exports:
- `getUserRole(session)` – infers role with fallback to USER.
- `isAdmin(session)` – role === 'ADMIN'.
- `isStaff(session)` – role === 'ADMIN' || role === 'MODERATOR'.
- `requireAdmin(session, context)` – throws PermissionError if not ADMIN.
- `requireStaffOrAdmin(session, context)` – throws if not ADMIN/MODERATOR.
- `PermissionError` – custom error type used by API routes.

On permission failure:
- Emits `auth.permission_denied` with:
  - `actor_user_id`, `actor_role`
  - `resource_type`, `resource_id`, `action`
  - `required_role` info in metadata.

#### 2.4.3 Admin Gating

Admin pages now use `isAdmin(session)` and show an explicit badge:
- `/admin/health/page.jsx`
- `/admin/qa/page.js`
- `/admin/cases/page.js`
- `/admin/cases/[id]/page.js`
- `/admin/cases/new/page.js`

Each has:
- Client-side check: redirect non-admins to `/dashboard`.
- Header badge: "🔒 ADMIN ONLY".

#### 2.4.4 Case Mutation API Permissions

Each of these now uses `requireStaffOrAdmin(...)` and handles `PermissionError`:
- `POST /api/cases`
- `POST /api/cases/[id]/status`
- `POST /api/cases/[id]/notes`

Result:
- Non-staff get 403 with `code: 'PERMISSION_DENIED'`.
- Failures emit `auth.permission_denied` events.
- Staff = ADMIN or MODERATOR (MVP is usually ADMIN, but infra supports MODERATOR).

#### 2.4.5 Case Assignment Schema

`frontend/prisma/schema.prisma`:
```prisma
model LostPetCase {
  // ...

  squadId       String?
  squad         RescueSquad? @relation(fields: [squadId], references: [id])

  // NEW: primary coordinator (Phase 22-24)
  coordinatorId String?
  coordinator   User?        @relation("CaseCoordinator", fields: [coordinatorId], references: [id])

  // ...
  @@index([coordinatorId])
}

model User {
  // ...

  coordinatedCases LostPetCase[] @relation("CaseCoordinator")
}
```

**Migration:** `frontend/prisma/migrations/20251125_add_case_coordinator/migration.sql`
- Adds `coordinatorId` column.
- Adds index.
- Adds FK to User with `ON DELETE SET NULL`.

#### 2.4.6 Assignment APIs

**POST /api/cases/[id]/assign-coordinator**
File: `frontend/app/api/cases/[id]/assign-coordinator/route.js`

- Body: `{ coordinatorId: string | null }`.
- Uses `requireStaffOrAdmin`.
- Validates:
  - Case exists.
  - If `coordinatorId` present:
    - User exists.
    - User role is ADMIN or MODERATOR.
- Supports:
  - Unassign via null or empty string.
  - Short-circuits if unchanged.
- Emits `case.assignment_changed` with metadata:
  - `type: 'coordinator'`
  - `old_coordinator_id`, `new_coordinator_id`, `new_coordinator_role`
  - `case_number`, `response_time_ms`.

**POST /api/cases/[id]/assign-squad**
File: `frontend/app/api/cases/[id]/assign-squad/route.js`

- Body: `{ squadId: string | null }`.
- Uses `requireStaffOrAdmin`.
- Validates:
  - Case exists.
  - Squad exists, and is active.
- Supports unassign via null/empty string + short-circuit.
- Emits `case.assignment_changed` with metadata:
  - `type: 'squad'`
  - `old_squad_id`, `new_squad_id`
  - `new_squad_name`, `new_squad_city`, `new_squad_state`
  - `case_number`, `response_time_ms`.

#### 2.4.7 Admin UI for Assignment

**File:** `frontend/app/admin/cases/[id]/page.js`

New "Case Assignment" section:
- **Coordinator dropdown:**
  - Options: ADMIN/MODERATOR users (`/api/users` data filtered client-side).
  - Supports unassign.
  - Calls `/api/cases/[id]/assign-coordinator`.
- **Squad dropdown:**
  - Options: active squads.
  - Calls `/api/cases/[id]/assign-squad`.
- Shows success/error banner (`assignmentMessage` state).

**File:** `frontend/app/admin/cases/page.js`
- Added **Coordinator** column.
- Shows coordinator name (or '—').
- Squad column shows squad name (or '—').

**API:** `frontend/app/api/cases/route.js`
- GET list now includes:
```javascript
coordinator: {
  select: { id: true, firstName: true, lastName: true, role: true }
}
```

#### 2.4.8 QA & Health

**QA Harness (`/admin/qa`) now has 6 permission/assignment tests:**
1. Permission helper module test.
2. Assign coordinator.
3. Unassign coordinator.
4. Assign squad.
5. Reject invalid coordinator role (USER).
6. Reject inactive squad.

**Health Dashboard (`/admin/health/page.jsx`):**
- `auth.permission_denied` → medium severity.
- `case.assignment_changed` → low severity.

---

## 3. Documentation Pointers

For a new assistant coming in, read these in order:

**VISION.md**
- Get sense of the 108-phase roadmap.
- Confirm phases 13–14, 15–16, 20–21, 22–24, 25–26 are marked COMPLETE.

**Feature specs:**
- `docs/features/lost-pet-cases-mvp.md`
- `docs/features/public-lost-pet-portal-mvp.md`
- `docs/features/admin-qa-harness-mvp.md`
- `docs/features/notifications-mvp.md`
- `docs/features/roles-and-assignment-mvp.md`

**Task breakdowns:**
- `docs/CASE_MVP_TASKS.md`
- `docs/PUBLIC_CASE_PORTAL_TASKS.md`
- `docs/QA_HARNESS_TASKS.md`
- `docs/NOTIFICATIONS_TASKS.md`
- `docs/ROLES_AND_ASSIGNMENT_TASKS.md`

**Setup:**
- `SETUP.md` → especially email + notifications section.

---

## 4. Current State & Next Likely Phases

As of this handoff:

✅ Public case portal is live (with safety + QA).
✅ Notifications are live (emails for public reports + status changes).
✅ Roles & permissions are centralized; case assignment is implemented and visible in admin UI.
✅ QA harness covers:
- Case flows.
- Public case flows.
- Notifications.
- Permissions & assignments.

`VISION.md` marks Phase 22–24 and 25–26 as COMPLETE and lists candidate next phases (examples):
- Sighting reports.
- Case matching algorithm.
- Coordinator notifications/workload metrics.
- Role/permission refinements & squad-level perms.
- Etc.

**Whenever you pick the next phase, follow the existing pattern:**
1. Add / update feature spec in `docs/features/`.
2. Add task breakdown doc in `docs/…_TASKS.md`.
3. Update `VISION.md` (mark ❌ IN PROGRESS, then ✅ COMPLETE).
4. Implement tasks with small, focused commits.

---

**End of Handoff Doc**
