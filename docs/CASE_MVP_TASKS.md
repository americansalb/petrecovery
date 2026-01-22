# Lost Pet Missions MVP - Task Breakdown

**Feature Spec**: `docs/features/lost-pet-missions-mvp.md`
**Phase**: 13-14 (Pet Profiles + Lost-Pet Mission MVP)
**Status**: Ready for Implementation

---

## Task Overview

Breaking down the Lost Pet Missions MVP into focused, sequential tasks following the Phase 0 pattern.

---

## TASK-C01: Add Prisma Models & Database Migration

**Goal**: Add `LostPetMission` and `LostPetMissionNote` models to database schema with proper enums and indexes.

**Files to Modify**:
- `frontend/prisma/schema.prisma`

**Changes**:

1. **Add Enums** (after existing enums):
```prisma
enum PetSpecies {
  DOG
  CAT
  BIRD
  OTHER
}

enum LostPetMissionStatus {
  OPEN
  ACTIVE_SEARCH
  RESOLVED
  CLOSED_OTHER
}
```

2. **Add LostPetMission Model**:
```prisma
model LostPetMission {
  id            String            @id @default(cuid())
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  missionNumber    String            @unique

  // Pet info
  petName       String?
  petSpecies    PetSpecies
  petBreed      String?
  petColor      String?
  petDescription String?

  // Location
  city          String
  state         String
  zipCode       String?
  lastSeenLandmark String?
  lastSeenAt    DateTime?

  // Status
  status        LostPetMissionStatus @default(OPEN)
  statusReason  String?
  isUrgent      Boolean           @default(false)

  // Contact
  contactName   String?
  contactPhone  String?
  contactEmail  String?

  // Relations
  createdById   String
  createdBy     User              @relation(fields: [createdById], references: [id])

  squadId       String?
  squad         RescueSquad?      @relation(fields: [squadId], references: [id])

  notes         LostPetMissionNote[]

  @@index([city, state])
  @@index([status])
  @@index([squadId])
}

model LostPetMissionNote {
  id         String      @id @default(cuid())
  createdAt  DateTime    @default(now())

  missionId     String
  mission       LostPetMission @relation(fields: [missionId], references: [id])

  authorId   String
  author     User        @relation(fields: [authorId], references: [id])

  type       String      @default("NOTE")
  content    String
  metadata   String      @default("{}")

  @@index([missionId])
}
```

3. **Update User model** to add relations:
```prisma
model User {
  // ... existing fields ...

  // Mission relations
  createdMissions    LostPetMission[]
  missionNotes       LostPetMissionNote[]
}
```

4. **Update RescueSquad model** to add relation:
```prisma
model RescueSquad {
  // ... existing fields ...

  // Mission relation
  missions           LostPetMission[]
}
```

**Migration**:
- Run: `npx prisma migrate dev --name add_lost_pet_missions`
- OR manually create migration SQL if Prisma CLI has issues (like Phase 0 legal migration)

**Acceptance Criteria**:
- [x] Enums added: `PetSpecies`, `LostPetMissionStatus`
- [x] `LostPetMission` model added with all fields and indexes
- [x] `LostPetMissionNote` model added with indexes
- [x] User and RescueSquad relations updated
- [x] Migration applied successfully
- [x] No breaking changes to existing models

---

## TASK-C02: Implement Mission API Endpoints

**Goal**: Create all 5 API endpoints for mission management with legal gating and structured logging.

**Files to Create**:
1. `frontend/app/api/missions/route.js` (GET list, POST create)
2. `frontend/app/api/missions/[id]/route.js` (GET single mission)
3. `frontend/app/api/missions/[id]/status/route.js` (POST update status)
4. `frontend/app/api/missions/[id]/notes/route.js` (POST add note)

**Implementation Pattern**:
- Import: `{ logEvent } from '@/lib/logging'`
- Import: `{ getServerSession }` for auth
- Check waiver acceptance before all mutations
- Emit events: `mission.create_attempted`, `mission.created`, `mission.create_failed`, etc.
- Return 403 with `code: 'WAIVER_NOT_ACCEPTED'` when legal gating triggers

### TASK-C02.1: GET /api/missions (List)

**File**: `frontend/app/api/missions/route.js`

**GET Handler**:
- Requires authentication
- Requires waiver accepted
- Query params: `status`, `city`, `state`, `squadId`, `limit` (default 20, max 100)
- Returns: Array of missions with squad name joined
- MVP: Simple pagination with limit, no cursor yet

**Events**:
- `mission.list_failed` if unauthorized or waiver not accepted

### TASK-C02.2: POST /api/missions (Create)

**File**: `frontend/app/api/missions/route.js`

**POST Handler**:
- Requires authentication
- Requires waiver accepted → 403 + `WAIVER_NOT_ACCEPTED` if not
- Validate required fields: `city`, `state`, `petSpecies`
- Generate `missionNumber`: `${city.substring(0,3).toUpperMission()}-${year}-${sequence}`
- Create mission with status `OPEN`
- Create initial note: "Mission created"

**Events**:
- `mission.create_attempted` (after validation, before DB write)
- `mission.created` (on success)
- `mission.create_failed` (on errors: UNAUTHORIZED, VALIDATION_ERROR, WAIVER_NOT_ACCEPTED, DB_WRITE_FAILED)
- `legal.blocked_action` (if waiver not accepted)

### TASK-C02.3: GET /api/missions/[id] (Get Single)

**File**: `frontend/app/api/missions/[id]/route.js`

**GET Handler**:
- Requires authentication
- Requires waiver accepted
- Include: mission details + notes with author info
- Return 404 if mission not found

### TASK-C02.4: POST /api/missions/[id]/status (Update Status)

**File**: `frontend/app/api/missions/[id]/status/route.js`

**POST Handler**:
- Requires authentication + waiver
- Admin only (check `session.user.role === 'ADMIN'`)
- Validate status transition
- Update mission status
- Create note with type "STATUS_CHANGE"

**Events**:
- `mission.status_changed` (on success)
- `mission.status_change_failed` (on errors)

### TASK-C02.5: POST /api/missions/[id]/notes (Add Note)

**File**: `frontend/app/api/missions/[id]/notes/route.js`

**POST Handler**:
- Requires authentication + waiver
- Admin or squad member
- Create note with type (default "NOTE")

**Events**:
- `mission.note_added` (on success)
- `mission.note_add_failed` (on errors)

**Acceptance Criteria**:
- [x] All 5 endpoints implemented
- [x] Legal gating works (403 + WAIVER_NOT_ACCEPTED)
- [x] All success events emitted
- [x] All failure events emitted
- [x] Mission number generation works
- [x] Status transitions validated
- [x] Notes appear in mission detail response

---

## TASK-C03: Build Admin Missions UI

**Goal**: Create admin-facing UI for mission list, detail, and creation.

**Files to Create**:
1. `frontend/app/admin/missions/page.js` (List view)
2. `frontend/app/admin/missions/[id]/page.js` (Detail view)
3. `frontend/app/admin/missions/new/page.js` (Create form)

### TASK-C03.1: Admin Missions List

**File**: `frontend/app/admin/missions/page.js`

**Features**:
- Fetch from `GET /api/missions`
- Table with columns: Mission #, Pet (name + species), City/State, Status (pill), Squad, Created At
- Filters: Status dropdown, City/State text inputs
- Click row → navigate to `/admin/missions/[id]`
- "Create New Mission" button → `/admin/missions/new`
- Legal error banner if user tries to access without waiver

### TASK-C03.2: Mission Detail Page

**File**: `frontend/app/admin/missions/[id]/page.js`

**Sections**:
1. **Header**: Mission number, status pill, urgent badge
2. **Pet Info**: Name, species, breed, color, description
3. **Location**: City, state, zip, last seen landmark, last seen time
4. **Contact**: Name, phone, email
5. **Status Actions** (admins only):
   - Dropdown to change status
   - Textarea for status reason
   - "Update Status" button
6. **Notes Timeline**:
   - Reverse chronological list
   - Each note: timestamp, author, type badge, content
   - "Add Note" form at top

**State Management**:
- `useState` for mission, notes, loading, error
- `useSession` for auth check
- Legal error banner if waiver not accepted

### TASK-C03.3: Create Mission Form

**File**: `frontend/app/admin/missions/new/page.js`

**Form Sections**:
1. **Location**:
   - City (text input, required)
   - State (text input or dropdown, required)
   - ZIP Code (text input, optional)
   - Last Seen Landmark (text input, optional)
   - Last Seen At (datetime input, optional)
2. **Pet Details**:
   - Pet Name (text input, optional)
   - Species (dropdown: DOG, CAT, BIRD, OTHER, required)
   - Breed (text input, optional)
   - Color (text input, optional)
   - Description (textarea, optional)
3. **Contact**:
   - Contact Name (text input, optional)
   - Contact Phone (text input, optional)
   - Contact Email (text input, optional)
4. **Additional**:
   - Squad (dropdown of squads in selected city/state, optional)
   - Urgent checkbox

**Behavior**:
- On submit → `POST /api/missions`
- On 403 + WAIVER_NOT_ACCEPTED → show legal banner with "Review & Accept Now" button
- On success → redirect to `/admin/missions/[id]`
- Validation: City, State, Species required

**Acceptance Criteria**:
- [x] List page shows missions with filters
- [x] Detail page shows all mission info + notes
- [x] Status can be updated (admins only)
- [x] Notes can be added
- [x] Create form works with validation
- [x] Legal gating shows banner correctly
- [x] Success/error states handled gracefully

---

## TASK-C04: Wire Legal Gating & Admin Dashboard Integration

**Goal**: Ensure legal gating UI works and events appear in Admin Health Dashboard.

### TASK-C04.1: Legal Gating UI Pattern

**Reuse Pattern from Rescue Forces**:
- Add legal error banner to all 3 pages (list, detail, new)
- Banner style: Yellow/amber background, warning icon, clear message
- "Review & Accept Now" button → `/legal/consent?returnUrl=<current-page>`

**Files to Update**:
- `frontend/app/admin/missions/page.js`
- `frontend/app/admin/missions/[id]/page.js`
- `frontend/app/admin/missions/new/page.js`

### TASK-C04.2: Admin Dashboard Visibility

**Verify Events Appear**:
- Navigate to `/admin/health` → Errors tab
- Should see new event types:
  - `mission.created`, `mission.create_failed`
  - `mission.status_changed`, `mission.status_change_failed`
  - `mission.note_added`
  - `legal.blocked_action` with `blocked_action = 'mission_create'`

**Test Scenarios**:
1. Create mission without waiver → see `legal.blocked_action` + `mission.create_failed`
2. Create mission with waiver → see `mission.create_attempted` + `mission.created`
3. Update status → see `mission.status_changed`
4. Add note → see `mission.note_added`

**Acceptance Criteria**:
- [x] Legal banners display correctly on all 3 pages
- [x] Banner redirect to /legal/consent works
- [x] All mission events visible in /admin/health/errors
- [x] Event metadata includes useful debugging info
- [x] Error codes are distinct and meaningful
- [x] Mission metrics added to admin health dashboard
- [x] Missions displayed in overview metrics (missions_total, missions_open, missions_active_search)

---

## TASK-C05: Update Documentation & Seed Data

**Goal**: Update project documentation to reflect Phase 13-14 progress.

### TASK-C05.1: Update VISION.md

**File**: `VISION.md`

**Changes**:
- Mark Phase 13-14 as "In Progress" or "Partially Implemented"
- Add bullet point under completed work:
  ```markdown
  ### 🔨 In Progress

  - **Phase 13-14: Lost Pet Missions MVP** 🔨 **IN PROGRESS** (Nov 2025)
    - LostPetMission + LostPetMissionNote models
    - 5 API endpoints with legal gating
    - Admin UI: list, detail, create
    - Structured logging for all mission actions
    - **See:** `docs/features/lost-pet-missions-mvp.md`
  ```

### TASK-C05.2: Optional Seed Data

**File**: `frontend/prisma/seed.js`

**Add Sample Missions** (optional, for staging/demo):
- 2-3 sample missions with different statuses
- Attached to existing squads from seed
- Example: Austin mission (OPEN), Denver mission (ACTIVE_SEARCH), Chicago mission (RESOLVED)

### TASK-C05.3: Update Phase 0 Checklist

**File**: `docs/PHASE_0_CHECKLIST.md`

**Changes**:
- Update "Next Phase" section to reflect work started on Phase 13-14:
  ```markdown
  **Next Phase:**
  - 🔨 Phase 13-14: Pet Profiles + Lost-Pet Mission MVP (IN PROGRESS)
  - ✅ Migrate rescue force endpoints to logEvent() (COMPLETE)
  ```

**Acceptance Criteria**:
- [x] Feature spec committed: `docs/features/lost-pet-missions-mvp.md`
- [x] VISION.md updated with Phase 13-14 status
- [ ] PHASE_0_CHECKLIST.md updated (not needed - using VISION.md)
- [ ] Optional seed data added for demo missions
- [ ] Commit message: "[Phase 13-14] TASK-C05: Update documentation for Missions MVP"

---

## Implementation Order

Follow this sequence for best results:

1. **TASK-C01** (Database) - Foundation for everything else
2. **TASK-C02** (APIs) - Core business logic
3. **TASK-C03** (UI) - User-facing features
4. **TASK-C04** (Integration) - Polish & observability
5. **TASK-C05** (Docs) - Finish documentation

Each task can be committed independently with clear commit messages:
- `[Phase 13-14] TASK-C01: Add LostPetMission models and migration`
- `[Phase 13-14] TASK-C02: Implement mission API endpoints with logging`
- `[Phase 13-14] TASK-C03: Build admin missions UI (list, detail, create)`
- `[Phase 13-14] TASK-C04: Wire legal gating and dashboard integration`
- `[Phase 13-14] TASK-C05: Update documentation for Missions MVP`

---

## Testing Checklist

After completing all tasks, verify:

**Core Functionality**:
- [ ] Admin can create a new mission
- [ ] Missions appear in list with correct filters
- [ ] Mission detail shows all information
- [ ] Status can be updated (with note created)
- [ ] Notes can be added manually
- [ ] Mission numbers are unique and sequential per city

**Legal Gating**:
- [ ] User without waiver cannot create mission (403 error)
- [ ] Legal banner shows with redirect button
- [ ] After accepting legal docs, can create mission
- [ ] All mission actions respect legal requirements

**Observability**:
- [ ] All mission events appear in Admin Health Dashboard
- [ ] Event metadata is useful for debugging
- [ ] Error codes help identify specific failures
- [ ] Legal compliance events traceable

**UI/UX**:
- [ ] Forms validate required fields
- [ ] Success/error states display correctly
- [ ] Loading states prevent double-submissions
- [ ] Navigation flows make sense
- [ ] Pages are mobile-responsive

---

**End of Task Breakdown**
