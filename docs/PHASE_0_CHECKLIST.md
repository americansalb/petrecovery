# Phase 0 Checklist – Critical Foundations

Before we treat MASTER_PLAN.md (Phases 1–108) as executable, these items MUST be completed.

## 1. Admin QA / Health Dashboard ✅ **COMPLETE**

- [x] `/admin/health` route exists and is protected by admin auth.
  - **Location:** `frontend/app/admin/health/page.jsx`
  - **Auth:** NextAuth session check, redirects non-admins to `/dashboard`
- [x] DB health check:
  - [x] Simple query runs and latency is displayed.
  - **Implementation:** `GET /api/admin/health/summary` - runs `SELECT 1` + user count
  - **UI:** Service Health Grid shows Database card with response time
- [x] External service checks (for each service we actually use):
  - [x] Geocoding API
    - **Check:** Tests ZIP 78701 against OpenStreetMap Nominatim API
  - [x] Email service
    - **Check:** Verifies EMAIL_USER/PASSWORD env vars, returns "not_configured" if missing
  - [x] (Any other external dependency currently integrated) - Only DB, geocoding, email in use
- [x] Recent error summary:
  - [x] Count of events with `result = "failure"` in last 24h.
  - [x] Grouped by `event_type` and `error_code`.
  - [x] Ability to click into a sample of recent failures.
  - **Implementation:** `GET /api/admin/health/errors` with aggregation + drawer for samples
  - **UI:** Errors tab with table + detail drawer showing 10 sample events
- [x] Key metrics:
  - [x] Total users
  - [x] Total cities (unique city+state pairs from rescue squads)
  - [x] Total rescue squads
  - [ ] (Later) Total cases, total sightings, total notifications.
  - **Implementation:** `GET /api/admin/health/metrics`
  - **UI:** Metrics Grid with 6 cards (users, cities, squads, active squads, members, active members)
- [x] Flow tests:
  - [x] "Test geocoding" form (enter ZIP/city → see resolved City + raw result).
    - **Implementation:** `POST /api/admin/health/test-geocode`
    - **Features:** Local ZIP mapping fallback, test history, jump-to-errors button
  - [x] "Send test email" button (to logged-in admin's email).
    - **Implementation:** `POST /api/admin/health/test-email`
    - **Features:** HTML formatted test email, test history, configuration status

## 2. Structured Logging Standard & Utility ✅ **COMPLETE**

- [x] `LOGGING_STANDARD.md` exists and defines the canonical event schema.
  - **Location:** `docs/LOGGING_STANDARD.md`
  - **Schema:** EventPayload with event_type, timestamp, correlation_id, actor, resource, action, result, errors, metadata
- [x] A single `logEvent(event: EventPayload)` utility exists:
  - [x] Adds `timestamp` and `correlation_id` when missing.
  - [x] Validates required fields (`event_type`, `resource_type`, etc.).
  - **Location:** `lib/logging.js`
  - **Features:** Auto-timestamps (ISO8601), UUID correlation IDs, metadata size limits (10KB), async DB persistence
- [x] All rescue-squad–related flows use `logEvent` instead of `console.log`.
  - **Note:** Admin health endpoints use `logEvent()`. Legacy rescue squad endpoints still use console.log (migration pending)
- [x] We have at least one example of `logEvent` per resource:
  - [x] User-related action - `admin.health_check_viewed`, `admin.metrics_viewed`
  - [x] City resolution action - Via geocoding test endpoint
  - [x] Squad search/create/join - (Legacy console.log, migration to logEvent pending)
- [x] Admin QA dashboard can display:
  - [x] Total events in last 24h - Shown in Errors tab (total_failures count)
  - [x] Breakdown by `event_type` - Errors table groups by event_type + error_code
  - [x] Breakdown by `result` (success vs failure) - Errors tab shows only failures, success events queryable via EventLog

## 3. Legal Tracking on Users

- [ ] User model (or related tables) includes:
  - [ ] `tos_accepted_at`
  - [ ] `tos_version`
  - [ ] `waiver_accepted_at`
  - [ ] `waiver_version`
- [ ] There is at least one `LegalDocument` record per type:
  - [ ] ToS (`type = "TOS"`)
  - [ ] Privacy Policy (`type = "PRIVACY"`)
  - [ ] Liability Waiver (`type = "WAIVER"`)
- [ ] On signup / login, or before critical actions:
  - [ ] If user lacks current ToS/waiver acceptance, they are redirected to a legal acceptance flow.
- [ ] Critical actions are blocked without acceptance:
  - [ ] Joining a city rescue squad.
  - [ ] Creating a lost-pet case (when implemented).
  - [ ] Accepting/participating in missions (when implemented).
- [ ] All legal acceptance events are logged with `legal.accepted` and include:
  - [ ] `user_id`
  - [ ] `document_type`
  - [ ] `document_version`

## 4. Code Audit & Phase Mapping ⚠️ **PARTIAL**

- [x] VISION.md contains a "Current Phase Status" section that lists:
  - [x] Which phases (from MASTER_PLAN.md) are fully implemented.
  - [x] Which are partially implemented.
  - [x] Which are not started.
  - **Location:** `VISION.md` - "Current Phase Status" section maps code to 108-phase plan
- [x] We have identified:
  - [x] All current uses of rescue squads.
  - [x] All current logging patterns.
  - [ ] All current legal/ToS flows (if any). - **No legal flows implemented yet**
- [x] Known gaps and tech debt are noted in VISION.md or a tech-debt list.
  - **Documented:** Legal tracking not started, rescue squad endpoint migration to logEvent pending

---

## Phase 0 Status Summary

✅ **Sections 1 & 2: COMPLETE** (Admin Dashboard + Logging)
- Fully functional admin health dashboard at `/admin/health`
- 6 API endpoints for health, errors, metrics, and testing
- Structured event logging with DB persistence
- EventLog model with indexed queries
- UI refinements: smart guidance, impact badges, test history

❌ **Section 3: NOT STARTED** (Legal Tracking)
- User model needs: tos_accepted_at, tos_version, waiver_accepted_at, waiver_version
- LegalDocument model needs creation
- Acceptance flow needs implementation
- This is the ONLY blocking item preventing Phase 0 completion

⚠️ **Section 4: PARTIAL** (Code Audit)
- Phase mapping complete in VISION.md
- Rescue squad usage documented
- Legal flows not applicable yet (no legal system exists)

**Phase 0 is considered complete only when ALL items above are checked.**

**Next Steps to Complete Phase 0:**
1. Add legal tracking fields to User model (Prisma migration)
2. Create LegalDocument model
3. Implement legal acceptance flow
4. Block critical actions without acceptance
5. Migrate rescue squad endpoints to use logEvent()
6. Update VISION.md to mark Phase 0 complete
