# Rescue Squad Logging Migration

**Goal:** Migrate all rescue squad endpoints from console.log to structured logEvent() calls

**Status:** Ready for Implementation
**Priority:** High (Next Tactical Priority from VISION.md)
**Phase:** Tactical Improvement (enables better observability)

---

## Context

During the "rescue squad search restoration" work (Nov 24), extensive `console.log` statements were added back to aid debugging. These logs are helpful but should now be migrated to structured `logEvent()` calls to:

1. **Enable error tracking** in Admin Health Dashboard
2. **Provide searchable event history** via EventLog model
3. **Maintain debugging capability** through metadata fields
4. **Follow Phase 0 logging standard** established for legal + missions

---

## Scope

### Endpoints to Migrate

1. **`/api/rescue-squads` (GET)** - Squad search
   - Currently: ~7 console.log statements
   - Events needed: `squad.search_attempted`, `squad.search_completed`, `squad.search_failed`

2. **`/api/rescue-squads` (POST)** - Squad creation
   - Currently: console.log + some console.error
   - Events needed: `squad.create_attempted`, `squad.created`, `squad.create_failed`

3. **`/api/rescue-squads/[id]/join` (POST)** - Join squad
   - Status: Already uses logEvent() with legal gating ✅
   - May need review for completeness

4. **`/api/rescue-squads/[id]/leave` (POST)** - Leave squad
   - Currently: Unknown (needs assessment)
   - Events needed: `squad.leave_attempted`, `squad.left`, `squad.leave_failed`

5. **`/api/rescue-squads/[id]` (GET)** - Get squad details
   - Currently: Likely console.log
   - Events needed: `squad.detail_viewed`, `squad.detail_failed`

6. **`/api/admin/rescue-squads` endpoints**
   - Status: Unknown (needs assessment)
   - Will determine event types after review

### Out of Scope (for this migration)

- **UI pages** - Frontend console.log statements are acceptable for now
- **Other API endpoints** (communities, alerts, etc.) - Separate migration
- **Changing functionality** - Only logging changes, no behavior changes

---

## Event Type Naming Convention

Following Phase 0 + Missions pattern:

```
squad.<action>_<result>
```

Examples:
- `squad.search_attempted` - User initiated search
- `squad.search_completed` - Search returned results
- `squad.search_failed` - Search encountered error
- `squad.created` - New squad successfully created
- `squad.create_failed` - Squad creation failed
- `squad.joined` - User successfully joined (already exists)
- `squad.join_failed` - Join failed (already exists)
- `squad.left` - User left squad
- `squad.detail_viewed` - Squad details fetched

---

## logEvent() Call Pattern

### Success Events

```javascript
await logEvent({
  event_type: 'squad.created',
  resource_type: 'rescue_squad',
  resource_id: squad.id,
  action: 'create',
  result: 'success',
  actor_user_id: session.user.id,
  actor_role: session.user.role,
  metadata: {
    squad_name: squad.name,
    city: squad.city,
    state: squad.state,
    // Include relevant context for debugging
  }
});
```

### Failure Events

```javascript
await logEvent({
  event_type: 'squad.create_failed',
  resource_type: 'rescue_squad',
  action: 'create',
  result: 'failure',
  error_code: 'VALIDATION_ERROR', // or DB_WRITE_FAILED, etc.
  error_message: error.message,
  actor_user_id: session?.user?.id || null,
  actor_role: session?.user?.role || null,
  metadata: {
    city: requestData.city,
    state: requestData.state,
    error_name: error.name,
    // Include request context for debugging
  }
});
```

### Search/Query Events

For search operations (GET requests):

```javascript
await logEvent({
  event_type: 'squad.search_completed',
  resource_type: 'rescue_squad',
  action: 'search',
  result: 'success',
  actor_user_id: session?.user?.id || null,
  actor_role: session?.user?.role || 'anonymous',
  metadata: {
    search_term: searchTerm,
    radius_miles: radius,
    results_count: cities.length,
    user_lat: searchLat,
    user_lng: searchLng,
    // Preserve debugging info from console.log
  }
});
```

---

## Implementation Tasks

### TASK-SL01: Migrate GET /api/rescue-squads (Search) ✅ COMPLETE

**File:** `frontend/app/api/rescue-squads/route.js` (GET handler)

**Changes:**
1. Add events:
   - `squad.search_attempted` - Right after validating search term
   - `squad.search_completed` - After successful search with result count
   - `squad.search_failed` - In catch block
2. Preserve debugging context in metadata:
   - search_term, radius, result count
   - coordinates, cities found
   - Any error details
3. Remove console.log statements (except critical errors)

**Acceptance Criteria:**
- [x] Search attempts logged with search parameters
- [x] Successful searches log result count and cities
- [x] Failed searches log error details
- [x] Events visible in /admin/health Errors tab
- [x] Search still functions identically

---

### TASK-SL02: Migrate POST /api/rescue-squads (Create) ✅ COMPLETE

**File:** `frontend/app/api/rescue-squads/route.js` (POST handler)

**Changes:**
1. Add events:
   - `squad.create_attempted` - After validation, before DB write
   - `squad.created` - After successful creation
   - `squad.create_failed` - On any failure (validation, geocoding, DB)
2. Include metadata:
   - city, state, creator role
   - geocoding results
   - waiver status (if checked)
3. Remove console.log, keep logEvent only

**Acceptance Criteria:**
- [x] Creation attempts logged
- [x] Successful creations log squad ID and details
- [x] Failures log error_code and context
- [x] Legal gating failures emit both `legal.blocked_action` AND `squad.create_failed`
- [x] Events appear in admin health

---

### TASK-SL03: Migrate remaining squad endpoints ✅ COMPLETE

**Files:**
- `frontend/app/api/rescue-squads/[id]/route.js` (GET detail)
- `frontend/app/api/rescue-squads/[id]/leave/route.js` (POST leave)

**Process:**
1. Read each endpoint
2. Identify current logging
3. Add appropriate logEvent() calls
4. Test functionality
5. Commit individually

**Acceptance Criteria:**
- [x] All squad endpoints emit structured events
- [x] All failures have error_code + error_message
- [x] All successes have useful metadata
- [x] No console.log remains (except unavoidable errors)

---

### TASK-SL04: Update Admin Health Dashboard ✅ COMPLETE

**Files:**
- `frontend/app/admin/health/page.jsx` (ERROR_IMPACT mapping)

**Changes:**
1. Add squad event types to ERROR_IMPACT:
```javascript
'squad.create_failed': { label: 'Squad Creation', severity: 'high' },
'squad.join_failed': { label: 'Squad Joining', severity: 'high' },
'squad.search_failed': { label: 'Squad Search', severity: 'medium' },
'squad.detail_failed': { label: 'Squad Details', severity: 'medium' },
'squad.leave_failed': { label: 'Squad Management', severity: 'low' },
```

2. Verify events appear in Errors tab with correct impact badges

**Acceptance Criteria:**
- [x] Squad errors show up in Errors tab
- [x] Impact labels are meaningful
- [x] Severity ratings make sense
- [x] Metadata is useful for debugging

---

### TASK-SL05: Update Documentation ✅ COMPLETE

**Files:**
- `VISION.md`
- This file (`docs/SQUAD_LOGGING_MIGRATION.md`)

**Changes:**
1. Update VISION.md:
   - Remove "⚠️ Note: Rescue squad endpoints still use console.log (migration pending)"
   - Mark logging migration as complete
2. Mark all tasks in this file as [x] complete

**Acceptance Criteria:**
- [x] VISION.md reflects completed migration
- [x] Task file shows all tasks complete
- [x] Commit message: "[Tactical] Complete rescue squad logging migration"

---

## Testing Checklist

After each task, verify:

**Functionality (No Regressions):**
- [ ] Squad search by city name works
- [ ] Squad search by ZIP code works
- [ ] Squad creation works
- [ ] Squad joining works (with legal banner if waiver missing)
- [ ] Squad detail viewing works
- [ ] Squad leaving works

**Observability:**
- [ ] New events appear in /admin/health Errors tab
- [ ] Event metadata includes useful debugging info
- [ ] Error codes are specific and meaningful
- [ ] Success events have resource IDs

**Admin Health Dashboard:**
- [ ] Overview tab shows no new errors during normal operations
- [ ] Errors tab shows squad failures with impact labels
- [ ] Search/filter by event_type works for squad.* events

---

## Commit Strategy

Small, focused commits for each task:

- `[Tactical] TASK-SL01: Migrate squad search to logEvent()`
- `[Tactical] TASK-SL02: Migrate squad creation to logEvent()`
- `[Tactical] TASK-SL03: Migrate remaining squad endpoints to logEvent()`
- `[Tactical] TASK-SL04: Add squad events to admin health ERROR_IMPACT`
- `[Tactical] TASK-SL05: Update VISION.md for logging migration complete`

---

**End of Task Breakdown**
