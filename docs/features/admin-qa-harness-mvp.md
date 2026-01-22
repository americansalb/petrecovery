# Feature Spec: Admin QA Harness MVP (Phase 20–21)

**Status:** Implementation Ready
**Owner:** Engineering
**Last Updated:** November 25, 2025
**Phase:** 20–21 (QA Infrastructure + Self-Diagnostic Tools)

---

## 0. Summary

We're building a **browser-based Admin QA Harness** at `/admin/qa` that allows admins to:

- **Run smoke tests** against key platform features (legal, squads, missions) from the browser
- **Generate test data** via existing APIs (no shell scripts needed)
- **View test results** with pass/fail status and detailed logging
- **Diagnose issues** in deployed environments (especially Render) without SSH access

This is **not** automated CI/CD testing - it's a **manual QA tool** for:
- Post-deployment verification
- Debugging production issues
- Creating demo data for testing other features
- Smoke testing critical user flows

### Why Now?

**Current Pain:**
- User deploys on Render where seed scripts are difficult
- Need to manually test squad creation, mission creation, legal flows
- Hard to create test data for feature development
- No easy way to verify deployment health beyond `/admin/health` service checks

**Solution:**
- Browser-based QA page with "Run Test" buttons
- All tests use existing API endpoints (no special test-only code)
- Results logged via `logEvent()` for observability
- Test data generators create realistic data through normal flows

---

## 1. Problem / Why

### Current State

We have excellent observability via `/admin/health`:
- Service health checks
- Error aggregation
- Metrics dashboard

But we lack **proactive functional testing**:
- Can the platform actually create squads?
- Can missions be created with proper waiver enforcement?
- Do legal flows work end-to-end?
- How do I create 10 demo missions for testing the mission list page?

### Problems

1. **Deployment verification is manual and tedious**
   - After deploying to Render, must manually click through flows
   - No checklist of "did deployment break anything?"
   - Errors only discovered when users report them

2. **Test data creation requires shell access**
   - Seed scripts don't work well on Render
   - Creating demo squads/missions requires manual form filling
   - Time-consuming to set up scenarios

3. **Debugging production issues is slow**
   - Can see errors in `/admin/health` Errors tab
   - But can't easily reproduce the issue
   - No "retry failed operation" button

### User Stories

**As an admin**, I want to:
- Click "Test Squad Creation" and see if it passes/fails
- Generate 5 demo missions in different cities for testing
- Verify legal waiver gating works before announcing feature
- Debug why a specific operation failed in production

**As a developer**, I want to:
- Smoke test all critical flows after deployment
- Create realistic test data without seed scripts
- Verify event logging is working correctly
- Test error handling paths (e.g., simulate waiver not accepted)

---

## 2. Goals & Non-Goals

### Goals (MVP Scope)

✅ **Browser-based QA page** at `/admin/qa`
✅ **Test suites** for:
  - Legal flows (waiver acceptance, blocked actions)
  - Squad operations (create, search, join, leave)
  - Mission operations (create, status updates, notes)
✅ **Test data generators**:
  - Generate N demo squads
  - Generate N demo missions
  - Clear test data (mark as test/delete)
✅ **Structured logging**: All QA actions emit `qa.*` events
✅ **Results display**: Show pass/fail with error details
✅ **Admin-only access**: Protected behind ADMIN role check

### Non-Goals (Future Phases)

❌ **Automated CI/CD testing** - This is manual QA, not automation
❌ **Performance testing** - Focus on functional correctness only
❌ **Load testing** - Single operations, not stress tests
❌ **Public QA portal** - Admin-only, not for end users
❌ **Test scheduling** - Manual execution only
❌ **Assertions/expectations** - Simple pass/fail based on API responses

---

## 3. User Stories (Expanded)

### Story 1: Post-Deployment Smoke Test
**As an admin**, after deploying to Render:
1. I navigate to `/admin/qa`
2. I see test suites: Legal, Squads, Missions
3. I click "Run All Tests" button
4. Tests execute sequentially, showing progress
5. I see results: ✅ 12 passed, ❌ 1 failed
6. I click on failed test to see error details
7. I check `/admin/health` Errors tab to see logged events

### Story 2: Generate Demo Data
**As an admin**, before demoing the platform:
1. I go to `/admin/qa` → Data Generators tab
2. I enter: "Generate 5 demo missions in Austin, TX"
3. I click "Generate"
4. System creates 5 missions with realistic data:
   - Different pet species
   - Mix of statuses (OPEN, ACTIVE_SEARCH, RESOLVED)
   - Random timestamps
   - Test notes added
5. I see "Generated 5 missions" with links to each
6. I can now demo `/admin/missions` with realistic data

### Story 3: Debug Waiver Flow
**As an admin**, investigating why waiver gating isn't working:
1. I go to `/admin/qa` → Legal Tests
2. I click "Test: Create Squad Without Waiver"
3. Test creates a test user without waiver
4. Test attempts to create squad
5. Result shows: ✅ Correctly blocked with 403 + WAIVER_NOT_ACCEPTED
6. I see event log: `legal.blocked_action` + `squad.create_failed`
7. I verify legal banner would show with correct redirectTo URL

---

## 4. Data Model Changes

### No New Models Required

All QA operations use existing models:
- `User` (for creating test users)
- `RescueSquad`, `RescueSquadMember`
- `LostPetMission`, `LostPetMissionNote`
- `EventLog` (for logging QA events)

### Optional: Mark Test Data

**Option A (MVP)**: Add `tags` field to relevant models
```prisma
model RescueSquad {
  // ... existing fields
  tags String[] @default([]) // ["test", "demo", "qa"]
}

model LostPetMission {
  // ... existing fields
  tags String[] @default([]) // ["test", "demo", "qa"]
}
```

**Option B (Deferred)**: Just use naming convention
- Test squads: Name starts with "[TEST]"
- Test missions: Mission number starts with "TEST-"
- Clean up manually when needed

**Decision**: Use Option B for MVP (no migration needed)

---

## 5. API Design

### No New API Endpoints Required

QA harness uses existing endpoints:
- `POST /api/rescue-forces` (create squad)
- `GET /api/rescue-forces` (search)
- `POST /api/rescue-forces/[id]/join` (join)
- `POST /api/missions` (create mission)
- `POST /api/missions/[id]/status` (update)
- `POST /api/missions/[id]/notes` (add note)
- `GET /api/legal/documents` (fetch legal docs)
- `POST /api/legal/accept` (accept waiver)

### QA Event Logging Pattern

All QA operations emit structured events:

```javascript
await logEvent({
  event_type: 'qa.squad_create_test',
  resource_type: 'qa_test',
  action: 'test',
  result: 'success', // or 'failure'
  actor_user_id: session.user.id,
  actor_role: 'ADMIN',
  metadata: {
    test_name: 'Create Squad - Happy Path',
    test_category: 'squads',
    squad_id: createdSquad?.id,
    duration_ms: 234,
    // ... test-specific details
  }
});
```

Event types follow pattern: `qa.<category>_<action>_test`
- `qa.squad_create_test`
- `qa.squad_search_test`
- `qa.mission_create_test`
- `qa.legal_accept_test`
- `qa.test_data_generated`

---

## 6. UI/UX Design

### Page Structure: `/admin/qa`

```
┌─────────────────────────────────────────────────┐
│ Admin QA & Testing Harness                     │
│ Browser-based smoke tests and data generators  │
└─────────────────────────────────────────────────┘

Tabs: [Tests] [Data Generators] [Test Results]

═══════════════════════════════════════════════════
TAB: Tests
═══════════════════════════════════════════════════

┌─ Legal Tests ────────────────────────────────────┐
│ ✅ Accept Waiver Flow                            │
│ ✅ Blocked Action - Squad Create                 │
│ ✅ Blocked Action - Mission Create                  │
│                                                   │
│ [Run Legal Tests]                                │
└───────────────────────────────────────────────────┘

┌─ Squad Tests ────────────────────────────────────┐
│ ⏳ Create Squad - Happy Path                     │
│ ⏹️ Search Squads by ZIP                          │
│ ⏹️ Join Squad                                    │
│ ⏹️ Leave Squad                                   │
│                                                   │
│ [Run Squad Tests]                                │
└───────────────────────────────────────────────────┘

┌─ Mission Tests ─────────────────────────────────────┐
│ ⏹️ Create Mission                                   │
│ ⏹️ Update Status                                 │
│ ⏹️ Add Note                                      │
│                                                   │
│ [Run Mission Tests]                                 │
└───────────────────────────────────────────────────┘

[Run All Tests]

═══════════════════════════════════════════════════
TAB: Data Generators
═══════════════════════════════════════════════════

┌─ Generate Demo Squads ───────────────────────────┐
│ Number of squads: [5]                            │
│ Cities: [Austin, Seattle, Portland, Denver]      │
│                                                   │
│ [Generate Squads]                                │
└───────────────────────────────────────────────────┘

┌─ Generate Demo Missions ────────────────────────────┐
│ Number of missions: [10]                            │
│ City: [Austin]  State: [TX]                      │
│ Status mix: [☑ Open ☑ Active ☑ Resolved]        │
│ Pet types: [☑ Dog ☑ Cat ☑ Bird]                 │
│                                                   │
│ [Generate Missions]                                 │
└───────────────────────────────────────────────────┘

┌─ Cleanup Test Data ──────────────────────────────┐
│ ⚠️ Delete all squads/missions with [TEST] prefix   │
│                                                   │
│ [Delete Test Data]                               │
└───────────────────────────────────────────────────┘

═══════════════════════════════════════════════════
TAB: Test Results
═══════════════════════════════════════════════════

Recent Test Runs:
┌─────────────────────────────────────────────────┐
│ Nov 25, 2025 10:45 AM - All Tests              │
│ ✅ 15 passed  ❌ 2 failed  ⏱️ 3.4s             │
│                                                 │
│ Failed Tests:                                   │
│ ❌ Mission Create - Missing Waiver                │
│    Expected 403, got 500                        │
│    [View Details] [Retry]                       │
│                                                 │
│ ❌ Squad Search - Invalid ZIP                   │
│    Expected INVALID_ZIP error, got timeout      │
│    [View Details] [Retry]                       │
└─────────────────────────────────────────────────┘
```

### Visual Style

Match existing `/admin/health` design:
- White cards with rounded borders
- Status indicators: ✅ (green), ❌ (red), ⏳ (yellow), ⏹️ (gray)
- Consistent typography and spacing
- Buttons use primary blue (`#3b82f6`)
- Destructive actions (delete) use red (`#dc2626`)

---

## 7. Test Suites Definition

### Legal Test Suite

1. **Test: Accept Waiver Flow**
   - Create test user (if needed)
   - Fetch legal documents via `GET /api/legal/documents`
   - Accept ToS + Waiver via `POST /api/legal/accept`
   - Verify user has `waiverAcceptedAt` timestamp
   - **Pass criteria**: 200 response, waiver timestamp set

2. **Test: Blocked Action - Squad Create**
   - Create test user WITHOUT waiver
   - Attempt `POST /api/rescue-forces`
   - **Pass criteria**: 403 status, `code: WAIVER_NOT_ACCEPTED`, `redirectTo` present

3. **Test: Blocked Action - Mission Create**
   - Use test user without waiver
   - Attempt `POST /api/missions`
   - **Pass criteria**: 403 status, `code: WAIVER_NOT_ACCEPTED`

### Squad Test Suite

1. **Test: Create Squad - Happy Path**
   - Ensure test user has waiver
   - Create squad: `POST /api/rescue-forces` with `{ city: "[TEST] Austin", state: "TX", zipCode: "78701" }`
   - **Pass criteria**: 201 status, squad returned with id

2. **Test: Search Squads by ZIP**
   - Search: `GET /api/rescue-forces?search=78701`
   - **Pass criteria**: 200 status, cities array returned

3. **Test: Join Squad**
   - Create test squad if needed
   - Join: `POST /api/rescue-forces/[id]/join`
   - **Pass criteria**: 200 status, membership created

4. **Test: Leave Squad**
   - Ensure test user is member
   - Leave: `POST /api/rescue-forces/[id]/leave`
   - **Pass criteria**: 200 status, success: true

### Mission Test Suite

1. **Test: Create Mission**
   - Create: `POST /api/missions` with required fields + `petName: "[TEST] Fluffy"`
   - **Pass criteria**: 201 status, mission returned with missionNumber

2. **Test: Update Mission Status**
   - Create test mission if needed
   - Update: `POST /api/missions/[id]/status` with `{ status: "ACTIVE_SEARCH" }`
   - **Pass criteria**: 200 status, mission status updated

3. **Test: Add Note to Mission**
   - Add: `POST /api/missions/[id]/notes` with `{ content: "[TEST] Note added by QA harness" }`
   - **Pass criteria**: 201 status, note created

---

## 8. Data Generator Specifications

### Generate Demo Squads

**Inputs:**
- `count`: number (1-20)
- `cities`: array of city names (default: ["Austin", "Seattle", "Portland"])

**Process:**
1. For each city:
   - Use cities.js to get ZIP code
   - Create squad with name: `"[TEST] {city} Rescue Force"`
   - Add founder (session user or create test user)

**Output:**
- Array of created squad IDs
- Success message: "Created N demo squads"

### Generate Demo Missions

**Inputs:**
- `count`: number (1-50)
- `city`: string
- `state`: string
- `statusMix`: array of statuses to include
- `petTypes`: array of species to include

**Process:**
1. For each mission:
   - Random pet species from selected types
   - Random status from selected statuses
   - Random pet name from list: ["[TEST] Max", "[TEST] Bella", "[TEST] Charlie", "[TEST] Luna"]
   - Random breed, color
   - Timestamp: randomize createdAt within last 30 days
   - Add 0-3 random notes

**Output:**
- Array of created mission IDs
- Success message: "Created N demo missions in {city}, {state}"

### Cleanup Test Data

**Process:**
1. Find all squads with name starting with "[TEST]"
2. Find all missions with petName starting with "[TEST]"
3. Soft-delete or mark as inactive
4. Show count of deleted items

**Safety:**
- Require confirmation dialog
- Only delete items created by current user OR marked with [TEST] prefix
- Log deletion events

---

## 9. Logging & Observability

### Event Types

All QA operations emit `qa.*` events:

| Event Type | When | Metadata |
|------------|------|----------|
| `qa.test_run_started` | Test suite started | `suite_name`, `test_count` |
| `qa.test_run_completed` | Test suite finished | `passed`, `failed`, `duration_ms` |
| `qa.squad_create_test` | Squad creation tested | `result`, `squad_id`, `error` |
| `qa.mission_create_test` | Mission creation tested | `result`, `mission_id`, `error` |
| `qa.legal_accept_test` | Waiver acceptance tested | `result`, `user_id` |
| `qa.test_data_generated` | Demo data created | `type`, `count`, `ids` |
| `qa.test_data_cleanup` | Test data deleted | `squads_deleted`, `missions_deleted` |

### Admin Health Integration

Add to `ERROR_IMPACT` mapping:
```javascript
'qa.test_run_completed': { label: 'QA Tests', severity: 'low' },
'qa.test_data_generated': { label: 'QA Data Gen', severity: 'low' },
```

QA events appear in Errors tab (even successes) for debugging.

---

## 10. Permissions & Security

### Access Control

- **Page access**: Admin-only (`session.user.role === 'ADMIN'`)
- **Test execution**: Admin-only
- **Data generation**: Admin-only
- **Test data cleanup**: Admin-only

### Safety Measures

1. **Test data isolation**
   - All test entities prefixed with `[TEST]`
   - Easy to identify and clean up
   - Won't interfere with real data

2. **Rate limiting**
   - Data generators limited to 50 items max per request
   - Prevent accidental spam

3. **Cleanup safeguards**
   - Confirmation required for deletions
   - Only delete items created by current user
   - Log all deletions

---

## 11. Implementation Phases

### Phase 1: QA Page Structure (TASK-Q01)
- Create `/admin/qa/page.js`
- Tab navigation (Tests, Generators, Results)
- Auth checks
- Basic layout matching `/admin/health`

### Phase 2: Legal Tests (TASK-Q02)
- Implement 3 legal test missions
- Test execution engine
- Results display
- Event logging

### Phase 3: Squad Tests (TASK-Q03)
- Implement 4 squad test missions
- Reuse test execution engine
- Add to results display

### Phase 4: Mission Tests (TASK-Q04)
- Implement 3 mission test missions
- Complete test suite coverage

### Phase 5: Data Generators (TASK-Q05)
- Squad generator
- Mission generator
- Test data cleanup
- Form validation

### Phase 6: Integration & Docs (TASK-Q06)
- Add QA events to ERROR_IMPACT
- Update VISION.md
- Browser smoke test
- Mark phase complete

---

## 12. Testing & Acceptance Criteria

### Manual Testing Checklist

**Access Control:**
- [ ] Non-admin users redirected from `/admin/qa`
- [ ] Unauthenticated users redirected to `/login`

**Legal Tests:**
- [ ] "Accept Waiver Flow" passes when user accepts
- [ ] "Blocked Action - Squad Create" passes when returns 403
- [ ] "Blocked Action - Mission Create" passes when returns 403
- [ ] Test results display correctly
- [ ] Events logged to EventLog

**Squad Tests:**
- [ ] "Create Squad" creates squad with [TEST] prefix
- [ ] "Search Squads" returns results
- [ ] "Join Squad" creates membership
- [ ] "Leave Squad" marks member inactive

**Mission Tests:**
- [ ] "Create Mission" creates mission with [TEST] petName
- [ ] "Update Status" changes mission status
- [ ] "Add Note" creates note

**Data Generators:**
- [ ] Generate 5 demo squads creates 5 squads
- [ ] Generate 10 demo missions creates 10 missions
- [ ] Missions have varied statuses and species
- [ ] Cleanup deletes only [TEST] prefixed items

**Results Display:**
- [ ] Passed tests show ✅
- [ ] Failed tests show ❌ with error details
- [ ] Test duration displayed
- [ ] Can view individual test results

**Observability:**
- [ ] All QA events appear in `/admin/health` Errors tab
- [ ] Event metadata includes test details
- [ ] ERROR_IMPACT labels QA events correctly

### Acceptance Criteria (Definition of Done)

- [x] `/admin/qa` page created and accessible to admins only
- [ ] 3 legal tests implemented and passing
- [ ] 4 squad tests implemented and passing
- [ ] 3 mission tests implemented and passing
- [ ] Squad data generator creates realistic demo data
- [ ] Mission data generator creates realistic demo data
- [ ] Test data cleanup removes [TEST] prefixed items
- [ ] All QA operations emit `qa.*` events
- [ ] Events visible in `/admin/health` Errors tab
- [ ] Test results displayed with pass/fail status
- [ ] VISION.md updated to mark Phase 20-21 complete
- [ ] No regressions to existing features

---

## 13. Future Extensions (Not in MVP)

- **Automated test scheduling**: Run tests on cron
- **Performance benchmarks**: Track test execution time trends
- **Email reports**: Send test results to admin email
- **API endpoint testing**: Direct API calls with custom payloads
- **User flow simulation**: Multi-step user journey tests
- **Snapshot testing**: Compare current output to expected baseline
- **Integration with CI/CD**: Trigger tests on deploy
- **Public health status page**: Share test results publicly

---

**End of Spec**
