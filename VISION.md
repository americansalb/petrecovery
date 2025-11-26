<<<<<<< HEAD
# PetRecovery.org - Project Vision & Implementation Path

**Last Updated:** 2025-11-25
**Branch:** `claude/cleanup-navbar-vision-01YCsTCcdvUhKCneDuk5ybgz`

---

## 🎯 Core Vision

PetRecovery.org is a community-powered platform to help reunite lost pets with their families through:
- **Rescue Squads**: City-based volunteer groups that help search for lost pets
- **Case Management**: Track lost pet cases with assignments and search coordination
- **Simple UX**: Clean, intuitive interface that works for everyone

---

## 🚨 Current Issues (Nov 24, 2025)

### 1. Rescue Squad Search - FIXED ✅
**Status:** FIXED - Restored debugging logs
**What Happened:**
- Commit `c3e92c3` (Nov 21) "redesigned" rescue squad search to be city-based
- Removed 1,323 lines of code, added only 269 lines
- Deleted `/rescue-squads/create/page.js` and `/api/rescue-squads/join-or-create/route.js`
- User reports: "It used to be working perfectly before I asked it to optimize"

**Root Cause Analysis:**
The "optimization" removed:
1. ❌ **Extensive debugging logs** - Made troubleshooting impossible
2. ❌ **Detailed error messages** - Hard to diagnose issues
3. ✅ **Extra features not used** - Custom squad names, lat/lng params (OK to remove)

**What Was Restored (Nov 24):**
- ✅ **Comprehensive logging** - Every step logged with clear indicators
- ✅ **Better error messages** - Shows exactly what failed and why
- ✅ **Kept city-based design** - Simpler and cleaner than custom names
- ✅ **Maintained code clarity** - Comments explain the flow

**Current Implementation (Debuggable):**
- Location: `/frontend/app/api/rescue-squads/route.js` (270 lines)
- Flow:
  1. User enters ZIP code (logged)
  2. System geocodes ZIP → gets city/state/coordinates (logged)
  3. Finds all active squads with coordinates (logged with count)
  4. Calculates Haversine distance for each squad (logged per squad)
  5. Filters by radius (logged included/excluded)
  6. Returns cities within radius with squad info (logged summary)
  7. User can join existing or create new squad (all steps logged)

### 2. Duplicate Navbar Issue
**Status:** UNCLEAR
**Branch Name Mentions:** `fix-duplicate-navbar-01XhqyChbEBeKxpeboQwNujM`
**Current State:** No navbar found in `/frontend/app/layout.js`
**Action Needed:** Clarify what the duplicate navbar issue actually is

---

## 📊 Current Phase Status (vs MASTER_PLAN)

**Reference:** See `/docs/PHASE_0_CHECKLIST.md` and `MASTER_PLAN.md` for full phase details.

### ✅ Completed

- **🎉 Phase 0: Critical Foundations** ✅ **100% COMPLETE** (Nov 24, 2025)
  - **Admin QA Dashboard:** Full observability at `/admin/health`
    - Service health checks (DB, geocoding, email)
    - Error aggregation with impact badges and recency indicators
    - Operational metrics (users, cities, squads)
    - Test tools with history (geocoding, email)
    - **See:** `docs/features/admin-health-dashboard.md`
  - **Structured Logging:** EventLog model with logEvent() utility
    - Auto-timestamps, correlation IDs, async DB persistence
    - Admin + legal endpoints emit structured events
    - **See:** `docs/LOGGING_STANDARD.md`
  - **Legal Baseline:** ToS + Waiver with enforcement
    - User model: tosAcceptedAt, waiverAcceptedAt, version tracking
    - LegalDocument model: ToS, Waiver, Privacy Policy (v1.0.0)
    - 3 API endpoints: GET /documents, GET /documents/[slug], POST /accept
    - Waiver gating on squad create/join with event logging
    - **See:** `docs/features/legal-baseline-and-waiver.md`
  - **Code Audit:** Phase mapping complete, tech debt documented

- **Phase 1: Canonical City Model** ✅ **COMPLETE**
  - Rescue squads use cities as primary geographic unit
  - City/state stored in database
  - Geocoding via OpenStreetMap Nominatim

- **Phase 3: Structured Event Logging** ✅ **COMPLETE** (Nov 25, 2025)
  - logEvent() utility in `lib/logging.js`
  - EventLog model with indexed queries
  - All core endpoints migrated: squads, cases, legal, admin
  - **See:** `docs/SQUAD_LOGGING_MIGRATION.md`

- **Phase 4: Admin Health Visibility** ✅ **COMPLETE**
  - Admin dashboard operational
  - Error tracking, health checks, metrics

- **Phase 2: Legal Tracking Enforcement** ✅ **COMPLETE**
  - ✅ Waiver gating on squad create/join with event logging
  - ✅ /legal/consent UI with full document review and acceptance flow
  - ❌ ToS acceptance at signup (deferred to future enhancement)

### ❌ Not Implemented Yet

- **Phase 5+: Permissions & Roles** ❌

- **🎉 Phase 13-14: Lost Pet Cases MVP** ✅ **COMPLETE** (Nov 25, 2025)
  - **Database Models:** `LostPetCase`, `LostPetCaseNote`, status/species enums
  - **API Endpoints:** 5 endpoints with legal gating and structured logging
    - GET/POST /api/cases (list + create)
    - GET /api/cases/[id] (detail with notes)
    - POST /api/cases/[id]/status (status updates)
    - POST /api/cases/[id]/notes (add notes)
  - **Admin UI:** List, detail, and create pages at `/admin/cases`
  - **Observability:** All case events logged, metrics in admin dashboard
  - **Legal Integration:** Full waiver enforcement for all case actions
  - **See:** `docs/features/lost-pet-cases-mvp.md`

- **🎉 Phase 15-16: Public Lost Pet Case Portal MVP** ✅ **COMPLETE** (Nov 25, 2025)
  - **Database Changes:** Added `isPublic`, `publicContactOk`, `source` fields to `LostPetCase`
  - **Public API Endpoints:** 3 public endpoints (NO authentication required)
    - GET /api/public/cases (list with city/state/species/status filters)
    - GET /api/public/cases/[caseNumber] (detail with privacy controls)
    - POST /api/public/cases (submit report, creates isPublic=false case)
  - **Public Pages:** 3 public-facing pages at `/cases`
    - List page with filters and pagination
    - Detail page with conditional contact info display
    - Report form for public lost pet submissions
  - **Privacy Controls:** Contact info only shown if `publicContactOk=true`
  - **Safe Defaults:** All cases default to `isPublic=false` (admin approval required)
  - **Observability:** All public actions emit `public_case.*` events
  - **QA Integration:** 3 new tests in QA harness (list, detail, submit)
  - **See:** `docs/features/public-lost-pet-portal-mvp.md`

- **🎉 Phase 20-21: Admin QA Harness MVP** ✅ **COMPLETE** (Nov 25, 2025)
  - **QA Page:** Browser-based testing and data generation at `/admin/qa`
  - **Test Suites:** 10 smoke tests (3 Legal + 4 Squad + 3 Case)
    - Legal: Waiver acceptance, blocked actions
    - Squad: Create, search, join, leave
    - Case: Create, update status, add notes
  - **Data Generators:** Create demo squads and cases without shell scripts
    - Squad generator with customizable cities
    - Case generator with random species, breeds, colors
    - Test data cleanup (mark [TEST] cases as CLOSED_OTHER)
  - **Test Execution Engine:** Real-time status, duration tracking, error display
  - **Observability:** All QA actions emit `qa.*` events visible in admin health
  - **Perfect for Render:** No SSH access required, all browser-based
  - **See:** `docs/features/admin-qa-harness-mvp.md`

- **🎉 Phase 25-26: Notifications MVP (Case Alerts & Admin Signals)** ✅ **COMPLETE** (Nov 25, 2025)
  - **Notification Helper Module:** 3 notification functions in `lib/notifications.js`
    - `sendCaseReportConfirmation()` - Email to contact when public report submitted
    - `sendAdminPublicReportAlert()` - Email to admin when public report needs review
    - `sendCaseStatusUpdate()` - Email to contact when status changes (ACTIVE_SEARCH, RESOLVED, CLOSED_OTHER)
  - **Email Integration:** 2 API endpoints wired with notifications
    - POST /api/public/cases - sends confirmation + admin alert
    - POST /api/cases/[id]/status - sends status update
  - **Configuration:** Environment variables for email setup
    - EMAIL_SERVICE, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM
    - ADMIN_NOTIFICATION_EMAIL for admin alerts
  - **HTML Email Templates:** Responsive, status-specific content with colors
  - **Observability:** All notifications emit `notification.*` events (attempted, succeeded, failed)
  - **Non-blocking:** Email failures logged but don't break API responses
  - **QA Integration:** 3 new tests in QA harness (report confirmation, admin alert, status update)
  - **ERROR_IMPACT:** Notification events mapped to medium severity
  - **Documentation:** SETUP.md updated with email provider setup (Gmail, SendGrid)
  - **See:** `docs/features/notifications-mvp.md`

- **🎯 Phase 22-24: Roles, Permissions & Case Assignment MVP** ✅ **COMPLETE** (Nov 25, 2025)
  - **Scope:** Explicit global role enforcement and case coordinator tracking
  - **Permission Model:** ADMIN, MODERATOR, PATROL, USER with clear access rules
  - **Admin Gating:** All `/admin/*` surfaces require ADMIN role
  - **Case Assignment:** Optional `coordinatorId` and explicit `squadId` semantics on `LostPetCase`
  - **Assignment APIs:** Endpoints to assign coordinator and owning squad
  - **Permission Helper:** Centralized `lib/permissions.js` module with `requireAdmin()`, `requireStaffOrAdmin()`, etc.
  - **Observability:** All permission failures emit `auth.permission_denied` events
  - **QA Integration:** 6 new tests for permissions and assignment
  - **See:** `docs/features/roles-and-assignment-mvp.md`

### 🎯 Next Tactical Priorities

1. **Identify and implement next phase cluster from roadmap**
   - Build on Phase 0 (observability), Phase 13-14 (cases), Phase 15-16 (public portal), Phase 20-21 (QA), Phase 25-26 (notifications), Phase 22-24 (roles & assignment) foundations
   - Continue 108-phase roadmap with same discipline
   - All features must emit structured events and respect legal gating
   - Candidate phases: sighting reports, case matching algorithm, coordinator notifications, workload metrics

**🎉 MAJOR MILESTONE:** Phase 0 now 100% complete!

Platform readiness:
- ✅ Legal compliance with enforced liability waiver
- ✅ Full observability via admin dashboard
- ✅ Structured event logging for debugging
- ✅ Health monitoring of critical services
- ✅ Safe volunteer participation with tracked consent

---

## 📋 Implementation Path

### Phase 1: Stabilize Rescue Squad Search ✅ COMPLETED
**Goal:** Get rescue squad search back to working state

#### Step 1: Investigate & Document
- [x] Read current rescue squad search code
- [x] Check git history for what changed
- [x] Compare old (417 lines) vs new (193 lines) implementation
- [x] Document what's actually broken vs what's missing
- [x] Review pre-redesign code to understand lost functionality

#### Step 2: Fix Issues
- [x] Identified root cause: Missing debugging logs
- [x] Restored comprehensive logging to GET /api/rescue-squads
- [x] Restored comprehensive logging to POST /api/rescue-squads
- [x] Added step-by-step logging with clear indicators (✅, ❌, 📋, etc.)
- [x] Kept the improved city-based design (simpler is better)

#### Step 3: Results
- ✅ **Search endpoint:** Now logs every step from geocoding to final results
- ✅ **Create endpoint:** Now logs verification, geocoding, DB checks, and creation
- ✅ **Maintained simplicity:** Kept city-based naming and clean flow
- ✅ **Better debugging:** Can now easily troubleshoot any issues that arise

### Phase 2: Clean Up Navbar Issues
**Goal:** Fix whatever the duplicate navbar problem is

- [ ] Identify the navbar issue
- [ ] Implement fix
- [ ] Test across all pages

### Phase 3: Prevent Future Regressions
**Goal:** Stop code from being reverted accidentally

#### Documentation
- [x] Create this VISION.md file
- [ ] Add inline code comments explaining WHY things work the way they do
- [ ] Document rescue squad architecture in separate doc

#### Git Workflow
- [ ] Use descriptive commit messages
- [ ] Never force push
- [ ] Always test before committing
- [ ] Reference this VISION.md in PRs

---

## 🏗️ System Architecture

### Rescue Squad System

#### Database Schema
```
RescueSquad {
  id: String (UUID)
  name: String (e.g., "San Francisco Rescue Squad")
  city: String
  state: String
  zipCodes: String (JSON array)
  centerLatitude: Float
  centerLongitude: Float
  radiusMiles: Int (default 10)
  isActive: Boolean
  members: RescueSquadMember[]
  totalCasesAccepted: Int
  successfulReunions: Int
}

RescueSquadMember {
  id: String
  squadId: String
  userId: String
  role: String (FOUNDER, LEADER, MEMBER)
  isActive: Boolean
}
```

#### Key Files
- `/frontend/app/rescue-squads/search/page.js` - Search UI
- `/frontend/app/api/rescue-squads/route.js` - Search & Create API
- `/frontend/app/rescue-squads/[id]/page.js` - Squad detail page
- `/frontend/lib/zip-city-mapping.js` - ZIP code utilities

#### Design Principles
1. **City-Based:** One squad per city (e.g., "San Francisco Rescue Squad")
2. **Radius Search:** Haversine distance calculation for nearby squads
3. **Simple Creation:** ZIP code → geocode → create squad for that city
4. **Auto-Join:** Creator becomes FOUNDER member automatically

---

## 🔧 Development Guidelines

### Before Making Changes
1. **Read this document first**
2. **Understand the WHY, not just the WHAT**
3. **Test before and after changes**
4. **Update this document if architecture changes**

### When Things Break
1. **Don't panic and rewrite everything**
2. **Check git history to see what changed**
3. **Compare with last known working version**
4. **Make surgical fixes, not sweeping changes**

### Commit Messages
Use format: `[Component] Action: Description`

Examples:
- `[Rescue Squads] Fix: Restore radius search functionality`
- `[API] Add: Logging to squad creation endpoint`
- `[Docs] Update: VISION.md with current status`

---

## 📝 Notes & Learnings

### What Went Wrong (Lesson Learned)
- **Issue:** Code was "optimized" by removing 1,323 lines
- **Actual Problem:** The optimization removed critical debugging logs, not just bloat
- **Result:** When issues occurred, impossible to troubleshoot
- **Lesson:** Optimization != Deletion. Logging isn't "bloat" - it's instrumentation.
- **Prevention:** Distinguish between unnecessary complexity and necessary debugging tools

### Key Insights
- **Logging is not bloat** - Server-side console logs are essential for troubleshooting production issues
- **Simpler can be better** - The city-based design IS better than custom squad names
- **Surgical fixes beat rewrites** - Fixed the actual problem (missing logs) without reverting everything
- **Documentation prevents thrashing** - This VISION.md will prevent future confusion

### Best Practices Going Forward
1. **Never remove console.log statements from API endpoints** - They're essential for debugging
2. **Test after every "optimization"** - Ensure nothing broke
3. **Keep this VISION.md updated** - Document WHY things are the way they are
4. **Make surgical fixes** - Don't rewrite entire files to fix one issue
5. **Balance simplicity with observability** - Simple code + good logging = maintainable code

---

## ✅ Success Criteria

This branch is ready to merge when:
- [ ] Rescue squad search works end-to-end
- [ ] Can create new squads for cities
- [ ] Can join existing squads
- [ ] No duplicate navbar issues
- [ ] All functionality tested manually
- [ ] This VISION.md is up-to-date
- [ ] Code has comments explaining complex logic

---

## 🆘 Quick Reference

### Important Commits
- `c3e92c3` - Redesign to city-based (simplified, may have broken things)
- `b680924` - Last known working version before redesign
- `d9346ff` - Current HEAD (merged rescue squad features)

### Testing URLs
- Search: `/rescue-squads/search`
- Admin: `/admin/rescue-squads`
- Squad Detail: `/rescue-squads/[id]`

### API Endpoints
- `GET /api/rescue-squads?zipCode=X&radius=Y` - Search
- `POST /api/rescue-squads` - Create new squad
- `POST /api/rescue-squads/[id]/join` - Join squad
- `GET /api/admin/rescue-squads` - Admin list all

---

**Remember:** This document is the source of truth. Update it as the project evolves.
=======
# PetRecovery.org — Vision & Roadmap

## Executive Summary

PetRecovery.org aims to revolutionize lost pet recovery by combining organized volunteer rescue squads with real-time coordination technology. Unlike passive alert systems (PawBoost, HomeAgain), we provide active, coordinated search operations with gamification, progression, and community building.

**Target: 75% reunion rate vs industry average of ~50%**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         PetRecovery.org                         │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Next.js 14)                                          │
│  ├── Public Pages (/cases, /cases/report, /cases/[caseNumber]) │
│  ├── Dashboard (/dashboard)                                     │
│  ├── Admin Portal (/admin/*)                                    │
│  └── Rescue Squad UI (/rescue-squads/*)                        │
├─────────────────────────────────────────────────────────────────┤
│  API Layer (/api/*)                                             │
│  ├── Public APIs (/api/public/*)                               │
│  ├── Authenticated APIs (/api/cases/*, /api/rescue-squads/*)   │
│  └── Admin APIs (/api/admin/*)                                 │
├─────────────────────────────────────────────────────────────────┤
│  Core Services (lib/)                                           │
│  ├── auth.js - NextAuth configuration                          │
│  ├── permissions.js - Role-based access control                │
│  ├── notifications.js - Email & alert system                   │
│  ├── email.js - SMTP transport                                 │
│  └── logging.js - Structured event logging                     │
├─────────────────────────────────────────────────────────────────┤
│  Database (PostgreSQL via Prisma)                               │
│  ├── Users (roles: USER, PATROL, MODERATOR, ADMIN)             │
│  ├── Cases (lost/found pet reports)                            │
│  ├── RescueSquads (volunteer teams)                            │
│  └── Supporting models (assignments, sightings, etc.)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 108-Phase Roadmap

The full roadmap is organized into logical groupings. This document tracks the high-level phases; detailed task breakdowns live in `/docs/*.md`.

### Phases 0–14: Foundation (COMPLETE)

| Phase | Name | Status |
|-------|------|--------|
| 0 | Project Setup & Prisma Schema | COMPLETE |
| 1 | User Authentication (NextAuth) | COMPLETE |
| 2 | Pet Registration | COMPLETE |
| 3 | Lost Pet Reporting | COMPLETE |
| 4 | Found Pet Reporting | COMPLETE |
| 5 | Dashboard (Owner/Patrol Views) | COMPLETE |
| 6 | Patrol System | COMPLETE |
| 7 | Rescue Squad Model | COMPLETE |
| 8 | Squad Formation APIs | COMPLETE |
| 9 | Case Assignment System | COMPLETE |
| 10 | Squad Coordination (Chat, Search Areas) | COMPLETE |
| 11 | Sighting System | COMPLETE |
| 12 | Gamification (Levels, Stats) | COMPLETE |
| 13 | Division System | COMPLETE |
| 14 | Admin Squad Management | COMPLETE |

### Phases 15–16: Public Lost Pet Case Portal MVP (IN PROGRESS)

**Status:** IN PROGRESS
**Spec:** [docs/features/public-lost-pet-portal-mvp.md](docs/features/public-lost-pet-portal-mvp.md)
**Tasks:** [docs/PUBLIC_CASE_PORTAL_TASKS.md](docs/PUBLIC_CASE_PORTAL_TASKS.md)

**Summary:**
- Public-facing pages for viewing lost pet cases without authentication
- Public case reporting form for non-registered users
- Privacy controls (isPublic flag, publicContactOk)
- SEO-optimized case pages for social sharing

**Key Deliverables:**
- `GET /api/public/cases` — List public cases
- `GET /api/public/cases/[caseNumber]` — Public case detail
- `POST /api/public/cases` — Submit public report (creates case + user)
- `/cases` — Public case listing page
- `/cases/[caseNumber]` — Public case detail page
- `/cases/report` — Public reporting form

### Phases 17–21: Reserved

| Phase | Name | Status |
|-------|------|--------|
| 17 | Push Notifications | TODO |
| 18 | SMS Alerts | TODO |
| 19 | Meta Ads Integration | TODO |
| 20 | Social Sharing | TODO |
| 21 | Analytics Dashboard | TODO |

### Phases 22–24: Roles, Permissions & Case Assignment MVP (IN PROGRESS)

**Status:** IN PROGRESS
**Spec:** [docs/features/roles-and-assignment-mvp.md](docs/features/roles-and-assignment-mvp.md)
**Tasks:** [docs/ROLES_AND_ASSIGNMENT_TASKS.md](docs/ROLES_AND_ASSIGNMENT_TASKS.md)

**Summary:**
- Formalize the USER/PATROL/MODERATOR/ADMIN role hierarchy
- Permission helper module with requireAdmin/requireStaffOrAdmin
- Case coordinator assignment (individual user responsible for case)
- Squad assignment to cases (which squad is working the case)
- Admin UI for managing assignments

**Key Deliverables:**
- `lib/permissions.js` — Role checks, PermissionError
- `POST /api/cases/[id]/assign-coordinator` — Assign coordinator
- `POST /api/cases/[id]/assign-squad` — Assign squad
- Admin case detail with assignment dropdowns
- `auth.permission_denied` logging events
- `case.assignment_changed` logging events

### Phases 25–26: Notifications MVP (IN PROGRESS)

**Status:** IN PROGRESS
**Spec:** [docs/features/notifications-mvp.md](docs/features/notifications-mvp.md)
**Tasks:** [docs/NOTIFICATIONS_TASKS.md](docs/NOTIFICATIONS_TASKS.md)

**Summary:**
- Notification helper module for standardized email sending
- Public report confirmation emails
- Admin alerts for new public reports
- Case status change notifications
- Non-blocking notification delivery (API succeeds even if email fails)

**Key Deliverables:**
- `lib/notifications.js` — Notification helper functions
- `sendCaseReportConfirmation(case)` — Email to reporter
- `sendAdminPublicReportAlert(case)` — Email to admins
- `sendCaseStatusUpdate(case, oldStatus, newStatus)` — Status change emails
- `notification.*` logging events

### Phases 27–50: Growth Features (TODO)

| Phase | Name | Status |
|-------|------|--------|
| 27–30 | Advanced Search & Filtering | TODO |
| 31–35 | Mobile App (React Native) | TODO |
| 36–40 | Shelter Integration | TODO |
| 41–45 | Microchip Registry | TODO |
| 46–50 | AI Pet Matching | TODO |

### Phases 51–75: Scale & Performance (TODO)

| Phase | Name | Status |
|-------|------|--------|
| 51–55 | Caching & CDN | TODO |
| 56–60 | Real-time WebSockets | TODO |
| 61–65 | Geographic Sharding | TODO |
| 66–70 | Load Testing & Optimization | TODO |
| 71–75 | Multi-region Deployment | TODO |

### Phases 76–100: Enterprise Features (TODO)

| Phase | Name | Status |
|-------|------|--------|
| 76–80 | White-label for Shelters | TODO |
| 81–85 | API Partnerships | TODO |
| 86–90 | Premium Features | TODO |
| 91–95 | Corporate Sponsorships | TODO |
| 96–100 | International Expansion | TODO |

### Phases 101–108: Polish & Launch (TODO)

| Phase | Name | Status |
|-------|------|--------|
| 101–104 | Security Audit | TODO |
| 105–106 | Performance Audit | TODO |
| 107 | Documentation | TODO |
| 108 | Public Launch | TODO |

---

## Role Hierarchy

```
ADMIN (full access)
  └── MODERATOR (manage cases, squads, divisions)
        └── PATROL (search operations, squad membership)
              └── USER (report pets, view dashboard)
```

See [docs/features/roles-and-assignment-mvp.md](docs/features/roles-and-assignment-mvp.md) for full permission matrix.

---

## Event Logging Categories

All significant actions are logged with structured events for observability:

| Category | Events |
|----------|--------|
| `auth.*` | `login`, `logout`, `register`, `permission_denied` |
| `case.*` | `created`, `updated`, `status_changed`, `assignment_changed` |
| `public_case.*` | `list_viewed`, `detail_viewed`, `report_attempted`, `report_submitted` |
| `notification.*` | `send_attempted`, `send_succeeded`, `send_failed` |
| `squad.*` | `created`, `joined`, `left`, `case_accepted` |

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_SECRET=...
NEXTAUTH_URL=https://petrecovery.org

# Email (SMTP)
EMAIL_SERVICE=gmail
EMAIL_USER=alerts@petrecovery.org
EMAIL_PASSWORD=...
EMAIL_FROM=PetRecovery <alerts@petrecovery.org>

# Admin Alerts
ADMIN_ALERT_EMAIL=admin@petrecovery.org
```

---

## Related Documentation

- [PROGRESS_SUMMARY.md](PROGRESS_SUMMARY.md) — Detailed implementation history
- [FEATURE_NOTES.md](FEATURE_NOTES.md) — Feature notes and known limitations
- [SCHEMA_REDESIGN.md](SCHEMA_REDESIGN.md) — Database schema documentation
- [docs/features/](docs/features/) — Feature specifications
- [docs/*.md](docs/) — Task breakdowns

---

*Last updated: 2025-11-25*
>>>>>>> origin/claude/implement-phases-15-26-01QvdWyaGsWzDG8DFKCAafbz
