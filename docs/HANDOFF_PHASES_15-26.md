# Handoff Document: Phases 15-26 Implementation

> **Context Restore Document**
> PetRecovery.org — Public Portal, Roles/Assignment, Notifications
> Created: 2024-01

---

## Architecture Overview

```
frontend/
├── app/
│   ├── api/
│   │   ├── public/cases/           # Phase 15-16: Public API routes
│   │   │   ├── route.js            # GET list, POST submit report
│   │   │   └── [caseNumber]/route.js
│   │   ├── cases/[id]/             # Phase 22-24: Assignment APIs
│   │   │   ├── assign-coordinator/route.js
│   │   │   ├── assign-squad/route.js
│   │   │   └── status/route.js
│   │   └── admin/                  # Admin APIs
│   │       ├── cases/[id]/route.js
│   │       └── users/route.js
│   ├── cases/                      # Phase 15-16: Public pages
│   │   ├── page.js                 # /cases - listing
│   │   ├── [caseNumber]/page.js    # /cases/ABC123 - detail
│   │   └── report/page.js          # /cases/report - submit form
│   ├── admin/                      # Phase 22-26: Admin pages
│   │   ├── cases/
│   │   │   ├── page.js             # Case management list
│   │   │   └── [id]/page.js        # Case detail + assignment
│   │   ├── qa/page.js              # QA test harness
│   │   └── health/page.js          # Health dashboard + ERROR_IMPACT
│   └── lib/
│       ├── logging.js              # Structured event logging
│       ├── permissions.js          # Role-based access control
│       └── notifications.js        # Email notification system
└── prisma/
    └── schema.prisma               # Updated with new fields
```

---

## Phase 15-16: Public Lost Pet Case Portal MVP

### What Was Implemented

**Schema Changes** (`prisma/schema.prisma`):
```prisma
model Case {
  // Public Visibility
  isPublic           Boolean  @default(true)
  publicContactOk    Boolean  @default(true)
  publicPhoneVisible Boolean  @default(false)
  publicEmailVisible Boolean  @default(false)
}
```

**Public APIs** (`app/api/public/cases/`):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/public/cases` | GET | List public cases with filters (type, city, status) |
| `/api/public/cases` | POST | Submit anonymous lost/found report |
| `/api/public/cases/[caseNumber]` | GET | Get public case detail |

**Public Pages** (`app/cases/`):

| Route | Description |
|-------|-------------|
| `/cases` | Public case listing with search filters |
| `/cases/[caseNumber]` | Public case detail page |
| `/cases/report` | Multi-step report submission form |

**Events Logged**:
- `public_case.list` — Public case list accessed
- `public_case.detail` — Public case detail accessed
- `public_case.report_submitted` — New public report submitted
- `public_case.list_failed` — Error listing cases
- `public_case.detail_failed` — Error fetching case detail
- `public_case.report_failed` — Error submitting report

**Where to Look**:
- List/filter logic: `app/api/public/cases/route.js` lines 10-50
- Report validation: `app/api/public/cases/route.js` lines 55-140
- Public page components: `app/cases/page.js`, `app/cases/[caseNumber]/page.js`

---

## Phase 22-24: Roles, Permissions & Case Assignment MVP

### What Was Implemented

**Permission System** (`lib/permissions.js`):

```javascript
// Role hierarchy: USER < PATROL < MODERATOR < ADMIN

// Helper functions:
isAdmin(session)          // Check if ADMIN
isStaff(session)          // Check if MODERATOR or ADMIN
isPatrol(session)         // Check if PATROL or higher
isAuthenticated(session)  // Check if logged in

// Requirement functions (throw PermissionError):
requireAdmin(session, action)
requireStaff(session, action)
requirePatrol(session, action)
requireResourceAccess(session, ownerId, action)
```

**Schema Changes** (`prisma/schema.prisma`):
```prisma
model Case {
  // Case Assignment
  coordinatorId    String?
  coordinator      User?        @relation("CaseCoordinator", ...)
  primarySquadId   String?
  primarySquad     RescueSquad? @relation("PrimarySquadCases", ...)
}

model User {
  coordinatedCases Case[] @relation("CaseCoordinator")
}

model RescueSquad {
  primaryCases Case[] @relation("PrimarySquadCases")
}
```

**Assignment APIs** (`app/api/cases/[id]/`):

| Endpoint | Method | Required Role | Description |
|----------|--------|---------------|-------------|
| `/api/cases/[id]/assign-coordinator` | POST | MODERATOR+ | Assign coordinator to case |
| `/api/cases/[id]/assign-squad` | POST | MODERATOR+ | Assign primary squad to case |
| `/api/cases/[id]/status` | POST | MODERATOR+ | Update case status |

**Admin Pages** (`app/admin/`):

| Route | Description |
|-------|-------------|
| `/admin/cases` | Case management list with status badges |
| `/admin/cases/[id]` | Case detail with coordinator/squad assignment dropdowns |

**Events Logged**:
- `auth.permission_denied` — Unauthorized action attempted
- `case.assign_coordinator` — Coordinator assigned
- `case.assign_coordinator_failed` — Assignment failed
- `case.assign_squad` — Squad assigned
- `case.assign_squad_failed` — Assignment failed
- `case.status_changed` — Status updated
- `case.status_change_failed` — Status change failed

**Where to Look**:
- Permission checks: `lib/permissions.js` lines 80-195
- Assignment API: `app/api/cases/[id]/assign-coordinator/route.js`
- Admin case detail: `app/admin/cases/[id]/page.js`

---

## Phase 25-26: Notifications MVP

### What Was Implemented

**Notification Module** (`lib/notifications.js`):

```javascript
// All functions are non-blocking (fire-and-forget)

sendCaseReportConfirmation(email, caseNumber)
// → Sends confirmation to reporter after submission

sendAdminPublicReportAlert(caseNumber, caseType, city)
// → Alerts admins of new public reports

sendCaseStatusUpdate(email, caseNumber, newStatus)
// → Notifies owner when case status changes

sendCoordinatorAssignmentNotification(coordinatorEmail, caseNumber)
// → Notifies coordinator when assigned to case
```

**Environment Variables Required**:
```env
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-email
EMAIL_PASS=your-password
EMAIL_FROM=noreply@petrecovery.org
ADMIN_ALERT_EMAIL=admin@petrecovery.org
```

**Events Logged**:
- `notification.case_report_confirmation` — Confirmation email sent
- `notification.admin_alert` — Admin alert sent
- `notification.status_update` — Status update email sent
- `notification.coordinator_assigned` — Coordinator notification sent
- `notification.send_failed` — Email send failed
- `email.send_failed` — Email transport error

**Where to Look**:
- Notification functions: `lib/notifications.js`
- Email base module: `lib/email.js` (pre-existing)
- Usage in public report: `app/api/public/cases/route.js` lines 120-130
- Usage in status change: `app/api/cases/[id]/status/route.js` lines 50-60

---

## QA Test Harness

**Location**: `/admin/qa`

**Test Suites**:
1. **Public Portal Tests** — API accessibility, case listing, report submission
2. **Permissions Tests** — Role verification, access control
3. **Assignment Tests** — Coordinator/squad assignment flows

**How to Run**:
1. Navigate to `/admin/qa` (requires ADMIN role)
2. Click "Run All Tests" or individual suite buttons
3. Review results in the output panel

---

## Health Dashboard

**Location**: `/admin/health`

**ERROR_IMPACT Mappings**:

| Event | Level | Description |
|-------|-------|-------------|
| `database.connection_failed` | CRITICAL | Database connection lost |
| `auth.permission_denied` | MEDIUM | Unauthorized action attempted |
| `case.status_change_failed` | MEDIUM | Failed to update case status |
| `public_case.report_failed` | MEDIUM | Public report submission failed |
| `notification.send_failed` | LOW | Email notification failed |
| `public_case.list_failed` | LOW | Public case listing unavailable |

---

## Quick Reference

### File Locations

| Component | Path |
|-----------|------|
| Logging module | `frontend/app/lib/logging.js` |
| Permissions module | `frontend/app/lib/permissions.js` |
| Notifications module | `frontend/app/lib/notifications.js` |
| Public API routes | `frontend/app/api/public/cases/` |
| Assignment API routes | `frontend/app/api/cases/[id]/` |
| Public pages | `frontend/app/cases/` |
| Admin pages | `frontend/app/admin/` |
| Schema | `frontend/prisma/schema.prisma` |

### Database Migration

After pulling changes:
```bash
cd frontend
npx prisma generate
npx prisma db push  # or npx prisma migrate dev
```

### Testing Checklist

- [ ] Public case listing loads at `/cases`
- [ ] Public case detail loads at `/cases/[caseNumber]`
- [ ] Report form submits at `/cases/report`
- [ ] Admin can assign coordinator at `/admin/cases/[id]`
- [ ] Admin can assign squad at `/admin/cases/[id]`
- [ ] Admin can change status at `/admin/cases/[id]`
- [ ] Permission errors logged for unauthorized access
- [ ] Notifications sent (check email/logs)

---

## Related Documentation

- `VISION.md` — Full roadmap with phase overview
- `docs/features/public-lost-pet-portal-mvp.md` — Public portal feature spec
- `docs/features/roles-and-assignment-mvp.md` — Roles/assignment feature spec
- `docs/features/notifications-mvp.md` — Notifications feature spec
- `docs/PUBLIC_CASE_PORTAL_TASKS.md` — Public portal task breakdown
- `docs/ROLES_AND_ASSIGNMENT_TASKS.md` — Roles task breakdown
- `docs/NOTIFICATIONS_TASKS.md` — Notifications task breakdown
