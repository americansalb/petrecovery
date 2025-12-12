# PetRecovery.org - Project Vision & Implementation Path

**Last Updated:** 2025-11-27
**Status:** Pre-MVP Development (~45% complete)

> **IMPORTANT**: See [ROADMAP.md](/ROADMAP.md) for the comprehensive and accurate project status. Previous documentation overstated project readiness. Critical features like password reset, image upload, and mission coordination UI are NOT implemented.

---

## 🎯 Core Vision

PetRecovery.org is a community-powered platform to help reunite lost pets with their families through:
- **Rescue Squads**: City-based volunteer groups that help search for lost pets
- **Mission Management**: Track lost pet missions with assignments and search coordination
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
  - All core endpoints migrated: squads, missions, legal, admin
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

- **🎉 Phase 13-14: Lost Pet Missions MVP** ✅ **COMPLETE** (Nov 25, 2025)
  - **Database Models:** `LostPetMission`, `LostPetMissionNote`, status/species enums
  - **API Endpoints:** 5 endpoints with legal gating and structured logging
    - GET/POST /api/missions (list + create)
    - GET /api/missions/[id] (detail with notes)
    - POST /api/missions/[id]/status (status updates)
    - POST /api/missions/[id]/notes (add notes)
  - **Admin UI:** List, detail, and create pages at `/admin/missions`
  - **Observability:** All mission events logged, metrics in admin dashboard
  - **Legal Integration:** Full waiver enforcement for all mission actions
  - **See:** `docs/features/lost-pet-missions-mvp.md`

- **🎉 Phase 15-16: Public Lost Pet Mission Portal MVP** ✅ **COMPLETE** (Nov 25, 2025)
  - **Database Changes:** Added `isPublic`, `publicContactOk`, `source` fields to `LostPetMission`
  - **Public API Endpoints:** 3 public endpoints (NO authentication required)
    - GET /api/public/missions (list with city/state/species/status filters)
    - GET /api/public/missions/[missionNumber] (detail with privacy controls)
    - POST /api/public/missions (submit report, creates isPublic=false mission)
  - **Public Pages:** 3 public-facing pages at `/missions`
    - List page with filters and pagination
    - Detail page with conditional contact info display
    - Report form for public lost pet submissions
  - **Privacy Controls:** Contact info only shown if `publicContactOk=true`
  - **Safe Defaults:** All missions default to `isPublic=false` (admin approval required)
  - **Observability:** All public actions emit `public_mission.*` events
  - **QA Integration:** 3 new tests in QA harness (list, detail, submit)
  - **See:** `docs/features/public-lost-pet-portal-mvp.md`

- **🎉 Phase 20-21: Admin QA Harness MVP** ✅ **COMPLETE** (Nov 25, 2025)
  - **QA Page:** Browser-based testing and data generation at `/admin/qa`
  - **Test Suites:** 10 smoke tests (3 Legal + 4 Squad + 3 Mission)
    - Legal: Waiver acceptance, blocked actions
    - Squad: Create, search, join, leave
    - Mission: Create, update status, add notes
  - **Data Generators:** Create demo squads and missions without shell scripts
    - Squad generator with customizable cities
    - Mission generator with random species, breeds, colors
    - Test data cleanup (mark [TEST] missions as CLOSED_OTHER)
  - **Test Execution Engine:** Real-time status, duration tracking, error display
  - **Observability:** All QA actions emit `qa.*` events visible in admin health
  - **Perfect for Render:** No SSH access required, all browser-based
  - **See:** `docs/features/admin-qa-harness-mvp.md`

- **🎉 Phase 25-26: Notifications MVP (Mission Alerts & Admin Signals)** ✅ **COMPLETE** (Nov 25, 2025)
  - **Notification Helper Module:** 3 notification functions in `lib/notifications.js`
    - `sendMissionReportConfirmation()` - Email to contact when public report submitted
    - `sendAdminPublicReportAlert()` - Email to admin when public report needs review
    - `sendMissionStatusUpdate()` - Email to contact when status changes (ACTIVE_SEARCH, RESOLVED, CLOSED_OTHER)
  - **Email Integration:** 2 API endpoints wired with notifications
    - POST /api/public/missions - sends confirmation + admin alert
    - POST /api/missions/[id]/status - sends status update
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

- **🎯 Phase 22-24: Roles, Permissions & Mission Assignment MVP** ✅ **COMPLETE** (Nov 25, 2025)
  - **Scope:** Explicit global role enforcement and mission coordinator tracking
  - **Permission Model:** ADMIN, MODERATOR, PATROL, USER with clear access rules
  - **Admin Gating:** All `/admin/*` surfaces require ADMIN role
  - **Mission Assignment:** Optional `coordinatorId` and explicit `squadId` semantics on `LostPetMission`
  - **Assignment APIs:** Endpoints to assign coordinator and owning squad
  - **Permission Helper:** Centralized `lib/permissions.js` module with `requireAdmin()`, `requireStaffOrAdmin()`, etc.
  - **Observability:** All permission failures emit `auth.permission_denied` events
  - **QA Integration:** 6 new tests for permissions and assignment
  - **See:** `docs/features/roles-and-assignment-mvp.md`

### 🎯 Next Tactical Priorities

1. **Identify and implement next phase cluster from roadmap**
   - Build on Phase 0 (observability), Phase 13-14 (missions), Phase 15-16 (public portal), Phase 20-21 (QA), Phase 25-26 (notifications), Phase 22-24 (roles & assignment) foundations
   - Continue 108-phase roadmap with same discipline
   - All features must emit structured events and respect legal gating
   - Candidate phases: sighting reports, mission matching algorithm, coordinator notifications, workload metrics

**⚠️ IMPORTANT CLARIFICATION:**

While the items marked as "complete" above have their *backend APIs* implemented, the project is NOT at MVP status. See [ROADMAP.md](/ROADMAP.md) for critical missing features:

- ❌ **No password reset** - Users cannot recover accounts
- ❌ **No image upload** - Only URL fields exist, no actual upload
- ❌ **No mission coordination UI** - APIs exist but zero frontend
- ❌ **No squad chat interface** - API exists, no React component
- ❌ **No search area mapping** - API exists, no interactive map
- ❌ **No sighting submission UI** - API exists, no form

Platform IS ready for:
- ✅ Legal compliance with enforced liability waiver
- ✅ Observability via admin dashboard
- ✅ Structured event logging
- ✅ Health monitoring
- ✅ Basic admin mission management

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
  totalMissionsAccepted: Int
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
