# Handoff Doc: Phases 15–26 (Public Portal, Roles/Assignment, Notifications)

**Repo:** americansalb/reunitepets
**Branch:** claude/cleanup-navbar-vision-01YCsTCcdvUhKCneDuk5ybgz
**Date:** November 25, 2025

This document is a handoff for a new chat / new assistant continuing work on the ReunitePets.org 108-phase roadmap, with focus on Phases 15–16, 22–24, and 25–26.

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
  - **Public surfaces:** `/missions`, `/missions/[missionNumber]`, `/missions/report`.
  - **Admin surfaces:** `/admin/*` (health, qa, missions, etc.), all now ADMIN-only.

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
- Introduced `LostPetMission` model and admin mission tools.
- **Specs:** `docs/features/lost-pet-missions-mvp.md`
- **Tasks:** `docs/CASE_MVP_TASKS.md`

You may need to reference these docs to understand the original mission flow.

---

### 2.2 Phase 15–16: Public Lost Pet Mission Portal MVP ✅

**Spec:** `docs/features/public-lost-pet-portal-mvp.md`
**Tasks:** `docs/PUBLIC_CASE_PORTAL_TASKS.md`

#### 2.2.1 Goals

Public can:
- Browse active public lost pet missions by city/state/species/status.
- View individual mission details.
- Submit a public report (which becomes a mission, pending admin approval).

Preserve safety:
- Nothing public without explicit flag.
- Contact info only shown when explicitly allowed.
- All public actions are logged.

#### 2.2.2 Data Model

**Model:** `LostPetMission` (in `schema.prisma`) gained:
```prisma
isPublic        Boolean @default(false)
publicContactOk Boolean @default(false)
source          String  @default("ADMIN") // "ADMIN" or "PUBLIC_REPORT"
```

- `isPublic`: controls whether mission shows up on public endpoints/pages.
- `publicContactOk`: controls whether contact info is shown on the public detail page.
- `source`: tracks origin of mission (ADMIN vs PUBLIC_REPORT).

**Migration is in:**
`frontend/prisma/migrations/20251125_add_public_flags_to_missions/migration.sql`

#### 2.2.3 Public API

All under `frontend/app/api/public/missions/*`:

**GET /api/public/missions**
- Filters: city, state, species, status, page, limit.
- Only returns `isPublic = true` missions.
- Never returns internal-only fields (e.g., createdById, squadId, source).

**GET /api/public/missions/[missionNumber]**
- Returns single mission by missionNumber.
- 404 if not found or isPublic=false.
- Contact info removed unless `publicContactOk = true`.

**POST /api/public/missions**
- Public report submission.
- Creates a new `LostPetMission` with:
  - `isPublic = false` (requires admin approval to publish).
  - `source = 'PUBLIC_REPORT'`.
- No auth required.

Each endpoint logs events like:
- `public_mission.list_viewed`
- `public_mission.detail_viewed`
- `public_mission.report_attempted`
- `public_mission.report_submitted`
- `public_mission.list_failed`
- `public_mission.detail_failed`
- `public_mission.report_failed`

#### 2.2.4 Public Pages

All under `frontend/app/missions/*`:

**/missions (list)**
- Filters by city, state, species, status.
- Mission cards show pet info + high-level location.
- Pagination, loading/error/empty states.

**/missions/[missionNumber] (detail)**
- Shows pet details, location, status.
- Conditionally shows contact info if `publicContactOk=true`.
- Includes safety + legal disclaimers.

**/missions/report (public report form)**
- Multi-step form: Pet Info → Location → Contact.
- Validation and required "terms" checkbox.
- On success shows confirmation + missionNumber.

#### 2.2.5 QA & Health

- **QA harness:** 3 tests added for public mission list/detail/report.
- **ERROR_IMPACT** in `/admin/health` updated for `public_mission.*` events.

---

### 2.3 Phase 25–26: Notifications MVP (Mission Alerts & Admin Signals) ✅

**Spec:** `docs/features/notifications-mvp.md`
**Tasks:** `docs/NOTIFICATIONS_TASKS.md`

#### 2.3.1 Goal

Build a transactional email notification layer for key mission lifecycle events:
- **Public report submitted:**
  - Contact gets confirmation.
  - Admin gets an alert (if configured).
- **Mission status changes:**
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

**sendMissionReportConfirmation(missionData, options)**
- To contact when they submit a public report.
- HTML email summarizing mission details, next steps, privacy notice.

**sendAdminPublicReportAlert(missionData)**
- To `ADMIN_NOTIFICATION_EMAIL` when a public report is created.
- "URGENT" style, includes link to admin mission page.

**sendMissionStatusUpdate(missionData, previousStatus, newStatus)**
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
File: `frontend/app/api/public/missions/route.js` (POST handler)

After creating a new mission and logging `public_mission.report_submitted`, it:
- Sends confirmation to `contactEmail` (if present).
- Sends admin alert to `ADMIN_NOTIFICATION_EMAIL` (if set).
- All notification errors are caught & logged; response is still 201.

**Mission status update**
File: `frontend/app/api/missions/[id]/status/route.js`

After successful status update and existing event logging:
- Computes `shouldNotify` based on:
  - status ∈ {ACTIVE_SEARCH, RESOLVED, CLOSED_OTHER}
  - Contact email present
  - Status actually changed.
- Calls `sendMissionStatusUpdate()`.
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

### 2.4 Phase 22–24: Roles, Permissions & Mission Assignment MVP ✅

**Spec:** `docs/features/roles-and-assignment-mvp.md`
**Tasks:** `docs/ROLES_AND_ASSIGNMENT_TASKS.md`
**Status:** Marked ✅ COMPLETE in VISION.md.

#### 2.4.1 Goals

- Centralize permission logic across admin surfaces.
- Make admin-only things explicit and consistent.
- Introduce:
  - **Global role enforcement:** `UserRole = USER | PATROL | MODERATOR | ADMIN`.
  - **Mission coordinator:** `coordinatorId` points to primary responsible user.
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
- `/admin/missions/page.js`
- `/admin/missions/[id]/page.js`
- `/admin/missions/new/page.js`

Each has:
- Client-side check: redirect non-admins to `/dashboard`.
- Header badge: "🔒 ADMIN ONLY".

#### 2.4.4 Mission Mutation API Permissions

Each of these now uses `requireStaffOrAdmin(...)` and handles `PermissionError`:
- `POST /api/missions`
- `POST /api/missions/[id]/status`
- `POST /api/missions/[id]/notes`

Result:
- Non-staff get 403 with `code: 'PERMISSION_DENIED'`.
- Failures emit `auth.permission_denied` events.
- Staff = ADMIN or MODERATOR (MVP is usually ADMIN, but infra supports MODERATOR).

#### 2.4.5 Mission Assignment Schema

`frontend/prisma/schema.prisma`:
```prisma
model LostPetMission {
  // ...

  squadId       String?
  squad         RescueSquad? @relation(fields: [squadId], references: [id])

  // NEW: primary coordinator (Phase 22-24)
  coordinatorId String?
  coordinator   User?        @relation("MissionCoordinator", fields: [coordinatorId], references: [id])

  // ...
  @@index([coordinatorId])
}

model User {
  // ...

  coordinatedMissions LostPetMission[] @relation("MissionCoordinator")
}
```

**Migration:** `frontend/prisma/migrations/20251125_add_mission_coordinator/migration.sql`
- Adds `coordinatorId` column.
- Adds index.
- Adds FK to User with `ON DELETE SET NULL`.

#### 2.4.6 Assignment APIs

**POST /api/missions/[id]/assign-coordinator**
File: `frontend/app/api/missions/[id]/assign-coordinator/route.js`

- Body: `{ coordinatorId: string | null }`.
- Uses `requireStaffOrAdmin`.
- Validates:
  - Mission exists.
  - If `coordinatorId` present:
    - User exists.
    - User role is ADMIN or MODERATOR.
- Supports:
  - Unassign via null or empty string.
  - Short-circuits if unchanged.
- Emits `mission.assignment_changed` with metadata:
  - `type: 'coordinator'`
  - `old_coordinator_id`, `new_coordinator_id`, `new_coordinator_role`
  - `mission_number`, `response_time_ms`.

**POST /api/missions/[id]/assign-squad**
File: `frontend/app/api/missions/[id]/assign-squad/route.js`

- Body: `{ squadId: string | null }`.
- Uses `requireStaffOrAdmin`.
- Validates:
  - Mission exists.
  - Squad exists, and is active.
- Supports unassign via null/empty string + short-circuit.
- Emits `mission.assignment_changed` with metadata:
  - `type: 'squad'`
  - `old_squad_id`, `new_squad_id`
  - `new_squad_name`, `new_squad_city`, `new_squad_state`
  - `mission_number`, `response_time_ms`.

#### 2.4.7 Admin UI for Assignment

**File:** `frontend/app/admin/missions/[id]/page.js`

New "Mission Assignment" section:
- **Coordinator dropdown:**
  - Options: ADMIN/MODERATOR users (`/api/users` data filtered client-side).
  - Supports unassign.
  - Calls `/api/missions/[id]/assign-coordinator`.
- **Squad dropdown:**
  - Options: active squads.
  - Calls `/api/missions/[id]/assign-squad`.
- Shows success/error banner (`assignmentMessage` state).

**File:** `frontend/app/admin/missions/page.js`
- Added **Coordinator** column.
- Shows coordinator name (or '—').
- Squad column shows squad name (or '—').

**API:** `frontend/app/api/missions/route.js`
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
- `mission.assignment_changed` → low severity.

---

## 3. Documentation Pointers

For a new assistant coming in, read these in order:

**VISION.md**
- Get sense of the 108-phase roadmap.
- Confirm phases 13–14, 15–16, 20–21, 22–24, 25–26 are marked COMPLETE.

**Feature specs:**
- `docs/features/lost-pet-missions-mvp.md`
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

✅ Public mission portal is live (with safety + QA).
✅ Notifications are live (emails for public reports + status changes).
✅ Roles & permissions are centralized; mission assignment is implemented and visible in admin UI.
✅ QA harness covers:
- Mission flows.
- Public mission flows.
- Notifications.
- Permissions & assignments.

`VISION.md` marks Phase 22–24 and 25–26 as COMPLETE and lists candidate next phases (examples):
- Sighting reports.
- Mission matching algorithm.
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
