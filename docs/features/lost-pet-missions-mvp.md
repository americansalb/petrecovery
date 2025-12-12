# Feature Spec: Lost Pet Missions MVP (Phase 13–14)

**Status:** ✅ Fully Implemented
**Owner:** Product + Engineering
**Last Updated:** November 25, 2025
**Phase:** 13–14 (Pet Profiles + Lost-Pet Mission MVP)

---

## 0. Summary

We're introducing a **Lost Pet Mission MVP** that lets admins and rescue squads:

- Capture structured information about a **lost pet** and its situation.
- Associate missions with **cities** and **rescue squads** (where appropriate).
- Track **basic status workflow** (Open → Active Search → Resolved / Closed).
- Make missions **discoverable** to internal volunteers (Phase 13–14 focuses on internal tools, not full public launch).
- Emit **structured logging events** so missions show up in the Admin Health Dashboard.

This MVP is deliberately small but **fully integrated** with:

- **Existing legal baseline**: Liability waiver + ToS already wired.
- **Existing observability**: `logEvent()`, `EventLog`, `/admin/health`.
- **Existing geography model**: Cities + zip-based squads.

Future phases will add richer features (maps, matching, SMS/email, public search, etc.). This spec focuses on the **smallest coherent slice** that's actually useful and production-worthy.

---

## 0.1 Implementation Status

**Implementation Completed:** November 25, 2025

All components of the Lost Pet Missions MVP have been fully implemented:

### Backend (TASK-C01, C02)
- ✅ Prisma models: `LostPetMission`, `LostPetMissionNote`, `LostPetMissionStatus` enum
- ✅ Migration applied with indexes for performance
- ✅ All 5 API endpoints with full legal gating and structured logging:
  - `GET /api/missions` - List with filters (status, city, state, squadId)
  - `POST /api/missions` - Create with waiver check and mission number generation
  - `GET /api/missions/[id]` - Detail with notes timeline
  - `POST /api/missions/[id]/status` - Status updates with transition validation
  - `POST /api/missions/[id]/notes` - Add notes

### Frontend (TASK-C03)
- ✅ `/admin/missions` - List page with filters, status pills, clickable rows
- ✅ `/admin/missions/[id]` - Detail page with notes timeline and status controls
- ✅ `/admin/missions/new` - Creation form with all required sections
- ✅ Legal error banners for WAIVER_NOT_ACCEPTED responses
- ✅ Visual consistency with admin health dashboard

### Observability (TASK-C04)
- ✅ All mission events logged via `logEvent()`:
  - `mission.create_attempted`, `mission.created`, `mission.create_failed`
  - `mission.status_changed`, `mission.status_change_failed`
  - `mission.note_added`, `mission.note_add_failed`
  - `legal.blocked_action` for waiver-gated actions
- ✅ Mission metrics added to `/api/admin/health/metrics`:
  - `missions_total`, `missions_open`, `missions_active_search`
- ✅ Mission metrics displayed in Admin Health Dashboard overview
- ✅ All mission events visible in Admin Health Errors tab

### Scope
- ✅ Admin-only access (MVP permissions model)
- ✅ Full legal integration (ToS + Waiver required for all actions)
- ✅ Mission number generation: `{CITY}-{YEAR}-{SEQUENCE}` format
- ✅ Status transition validation (OPEN → ACTIVE_SEARCH → RESOLVED/CLOSED_OTHER)
- ✅ Automatic note creation for status changes

---

## 1. Problem / Why

Right now, the platform has:

- **Rescue squads** (who's available to help, by city).
- **No concept of an actual lost pet mission** (who/what/where/when/urgency).

### Problems

1. Rescue squads can't coordinate around specific pets/missions.
2. There is no structured record of:
   - When a pet went missing
   - Where it was last seen
   - Who the primary contact is
   - What actions have been taken
3. Admins can't **answer basic operational questions**:
   - "How many active missions are there in Austin?"
   - "Which squads are actively working missions?"
   - "Are we closing missions or letting them rot in Open?"

### Why MVP now

- Phase 0 (observability + legal) is complete, so it's safe to carry "real" missions.
- Rescue squads already exist, so we can attach missions to **cities/squads** from day one.
- A basic mission pipeline unlocks **real volunteer work**, even without fancy bells & whistles.

---

## 2. Goals & Non-Goals

### 2.1 Goals (MVP)

- **G1. Create structured lost-pet missions**
  - Admins and authorized users can create missions with minimal required fields.
- **G2. Basic status workflow**
  - Mission has a status: `OPEN`, `ACTIVE_SEARCH`, `RESOLVED`, `CLOSED_OTHER`.
- **G3. Attach to city & (optionally) squad**
  - Mission stores city, state, zip, and optionally a rescue squad reference.
- **G4. Pet + contact info**
  - Capture pet's name, species, key description, and primary contact info.
- **G5. Internal-only UI**
  - Missions UI is accessible to admins + authenticated users with waiver accepted (no public browse page yet).
- **G6. Observability**
  - All major actions emit structured events:
    - `mission.create_attempted`, `mission.created`, `mission.status_changed`, `mission.closed`
- **G7. Legal integration**
  - Only users with **waiver + ToS accepted** can create or manage missions.

### 2.2 Non-Goals (for this MVP)

We explicitly **do NOT** implement (yet):

- Full **public** lost-pet search portal.
- Advanced **geospatial search** (simple city/zip + distance only).
- Automated **mission–sighting matching**.
- SMS / push notifications / robocalls.
- Owner self-serve mission creation (owner-facing flows).
- Complex workflows (multi-stage triage, assignments, SLAs).
- Attachments / image uploads (we can leave hooks but no UI yet).

---

## 3. Key User Stories

### 3.1 Admin / Coordinator

1. **Create a new mission**
   > As an admin, I can create a new lost-pet mission for a given city and optionally associate it with a rescue squad, so volunteers have a clear, shared record of the search.

2. **View list of missions**
   > As an admin, I can see a list of recent missions, filter by status and city, and click into a mission for details.

3. **Update mission status**
   > As an admin, I can change a mission from OPEN to ACTIVE_SEARCH, and eventually to RESOLVED or CLOSED_OTHER, so we don't think old missions are still active.

4. **Add notes**
   > As an admin, I can leave operational notes on a mission (e.g., "Flyers distributed", "Potential sighting at X"), so future volunteers can see what's already been done.

### 3.2 Squad Member / Trusted Volunteer

5. **View missions for my city/squad**
   > As a squad member, I can see active missions in my city/squad, so I know where help is needed.

6. **Read mission details**
   > As a squad member, I can view the pet details, last-seen info, and contact info for the mission.

_(Permissions model for squad members vs admins can be minimal for MVP, see Section 9.)_

---

## 4. Data Model (Prisma)

> NOTE: Exact naming may be adjusted to fit existing schema conventions. This is the conceptual design.

### 4.1 Enums

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

### 4.2 LostPetMission Model

```prisma
model LostPetMission {
  id            String            @id @default(cuid())
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  // Core identity
  missionNumber    String            @unique  // human-friendly, e.g. "AUS-2025-0001"

  // Pet info
  petName       String?
  petSpecies    PetSpecies
  petBreed      String?
  petColor      String?
  petDescription String?          // free-text description

  // Location info (MVP, city-level)
  city          String
  state         String
  zipCode       String?
  lastSeenLandmark String?        // e.g. "Near 5th & Congress"
  lastSeenAt    DateTime?

  // Status
  status        LostPetMissionStatus @default(OPEN)
  statusReason  String?           // free-text reason when closing/resolving
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

  // Notes / history (Phase 13–14: minimal)
  notes         LostPetMissionNote[] // separate model for notes/events

  @@index([city, state])
  @@index([status])
  @@index([squadId])
}
```

### 4.3 LostPetMissionNote (simple event/notes stream)

```prisma
model LostPetMissionNote {
  id         String      @id @default(cuid())
  createdAt  DateTime    @default(now())

  missionId     String
  mission       LostPetMission @relation(fields: [missionId], references: [id])

  authorId   String
  author     User        @relation(fields: [authorId], references: [id])

  // Simple typed note (could be "STATUS_CHANGE", "NOTE", "SIGHTING" later)
  type       String      // e.g. "NOTE" | "STATUS_CHANGE"
  content    String      // markdown/text

  // Optional metadata (JSON string for now)
  metadata   String      @default("{}")

  @@index([missionId])
}
```

**Phase 13–14 scope**: We implement LostPetMission + LostPetMissionNote with minimal fields. We avoid premature modeling of full PetProfile; that can come in a later phase as a separate PetProfile model that missions can reference.

---

## 5. API Design

**Base path**: `/api/missions`

### 5.1 List Missions

**Route**: `GET /api/missions`

**Auth**: Authenticated user; must have ToS + Waiver accepted.

**Query Params (MVP)**:
- `status` (optional): `OPEN|ACTIVE_SEARCH|RESOLVED|CLOSED_OTHER`
- `city` (optional)
- `state` (optional)
- `squadId` (optional)
- `limit` (optional, default 20, max 100)
- `cursor` (optional, for pagination – or `page` for simpler MVP)

**Response**:
```json
{
  "missions": [
    {
      "id": "mission_123",
      "missionNumber": "AUS-2025-0001",
      "petName": "Luna",
      "petSpecies": "DOG",
      "city": "Austin",
      "state": "TX",
      "status": "OPEN",
      "isUrgent": true,
      "lastSeenAt": "2025-11-24T12:34:56.000Z",
      "createdAt": "2025-11-24T12:00:00.000Z",
      "squadId": "squad_123",
      "squadName": "Austin City Rescue Squad"
    }
  ],
  "meta": {
    "total": 42,
    "hasMore": true,
    "cursor": "opaqueCursor"
  }
}
```

### 5.2 Get Single Mission

**Route**: `GET /api/missions/[id]`

**Auth**: Authenticated, ToS + Waiver accepted.

**Response**:
```json
{
  "mission": {
    "id": "mission_123",
    "missionNumber": "AUS-2025-0001",
    "petName": "Luna",
    "petSpecies": "DOG",
    "petBreed": "Labrador",
    "petColor": "Black",
    "petDescription": "Black lab with white spot on chest",
    "city": "Austin",
    "state": "TX",
    "zipCode": "78701",
    "lastSeenLandmark": "Near 5th & Congress",
    "lastSeenAt": "2025-11-24T12:34:56.000Z",
    "status": "ACTIVE_SEARCH",
    "statusReason": null,
    "isUrgent": true,
    "contactName": "Maria",
    "contactPhone": "555-123-4567",
    "contactEmail": "maria@example.com",
    "createdById": "user_123",
    "squadId": "squad_123",
    "createdAt": "2025-11-24T12:00:00.000Z",
    "updatedAt": "2025-11-24T13:00:00.000Z"
  },
  "notes": [
    {
      "id": "note_1",
      "createdAt": "2025-11-24T12:10:00.000Z",
      "authorName": "Admin User",
      "type": "NOTE",
      "content": "Mission created and shared with Austin squad."
    },
    {
      "id": "note_2",
      "createdAt": "2025-11-24T12:20:00.000Z",
      "authorName": "Admin User",
      "type": "STATUS_CHANGE",
      "content": "Status changed from OPEN to ACTIVE_SEARCH."
    }
  ]
}
```

### 5.3 Create Mission

**Route**: `POST /api/missions`

**Auth**: Authenticated; must have waiver & ToS accepted.
- If waiver not accepted → 403 with `code: "WAIVER_NOT_ACCEPTED"` and `redirectTo` (reuse existing legal pattern).

**Request Body (MVP)**:
```json
{
  "city": "Austin",
  "state": "TX",
  "zipCode": "78701",
  "squadId": "squad_123",    // optional

  "petName": "Luna",
  "petSpecies": "DOG",
  "petBreed": "Labrador",
  "petColor": "Black",
  "petDescription": "Black lab with white spot on chest",

  "lastSeenLandmark": "Near 5th & Congress",
  "lastSeenAt": "2025-11-24T12:34:56.000Z",
  "isUrgent": true,

  "contactName": "Maria",
  "contactPhone": "555-123-4567",
  "contactEmail": "maria@example.com"
}
```

**Response (success, 201)**:
```json
{
  "mission": {
    "id": "mission_123",
    "missionNumber": "AUS-2025-0001",
    "status": "OPEN",
    "city": "Austin",
    "state": "TX",
    "squadId": "squad_123",
    "createdAt": "2025-11-24T12:00:00.000Z"
  }
}
```

**Response (legal not accepted, 403)**:
```json
{
  "error": "Liability waiver required",
  "code": "WAIVER_NOT_ACCEPTED",
  "message": "You must accept the liability waiver before creating a lost pet mission.",
  "redirectTo": "/legal/consent?returnUrl=/missions/new"
}
```

### 5.4 Update Mission Status

**Route**: `POST /api/missions/[id]/status` (MVP: POST instead of full PATCH)

**Auth**: Admin or authorized squad member (see Permissions).

**Request Body**:
```json
{
  "status": "RESOLVED",
  "statusReason": "Pet found safe at home."
}
```

**Behavior**:
- **Valid transitions**:
  - `OPEN` → `ACTIVE_SEARCH`
  - `OPEN` → `RESOLVED`
  - `ACTIVE_SEARCH` → `RESOLVED`
  - `ACTIVE_SEARCH` → `CLOSED_OTHER`
  - `OPEN` → `CLOSED_OTHER`
- On change:
  - Updates `LostPetMission.status` & `statusReason`.
  - Creates `LostPetMissionNote` with `type` "STATUS_CHANGE".
  - Emits `mission.status_changed` event.

### 5.5 Add Mission Note

**Route**: `POST /api/missions/[id]/notes`

**Auth**: Same as status update.

**Request Body**:
```json
{
  "content": "Flyers distributed in 5-block radius.",
  "type": "NOTE"   // optional, default "NOTE"
}
```

**Response**:
```json
{
  "note": {
    "id": "note_123",
    "createdAt": "2025-11-24T13:15:00.000Z",
    "authorId": "user_123",
    "authorName": "Admin User",
    "type": "NOTE",
    "content": "Flyers distributed in 5-block radius."
  }
}
```

---

## 6. UI / UX

### 6.1 Admin Missions List

**Route**: `/admin/missions`

- Table with columns:
  - Mission #
  - Pet (name + species)
  - City, State
  - Status (pill with color)
  - Squad (if any)
  - Created At
- Filters:
  - Status (multi-select or dropdown)
  - City/state text filter
- Clicking a row → `/admin/missions/[id]`.

### 6.2 Mission Detail

**Route**: `/admin/missions/[id]`

**Sections**:
1. **Header**
   - Mission number, status pill, "Urgent" badge
   - City, state, squad info
2. **Pet Info**
   - Name, species, breed, color, description
3. **Last Seen**
   - Landmark, time, zip
4. **Contact Info**
   - Name, phone, email
5. **Status Actions**
   - Dropdown/select to change status (if authorized)
   - Textarea for optional status reason
6. **Notes Timeline**
   - Reverse chronological list of notes
   - Each note:
     - Timestamp
     - Author
     - Type badge
     - Content

### 6.3 Create Mission

**Route**: `/admin/missions/new` (or `/missions/new` gated to admins for MVP)

- Step-like form or single page with sections:
  - City & location
  - Pet details
  - Contact details
  - Squad association (optional drop-down if user belongs to a squad; admins see all squads)
- On submit:
  - Calls `POST /api/missions`
  - On `WAIVER_NOT_ACCEPTED` → show same **Legal Agreement Required** banner pattern and redirect button as squads.

### 6.4 Volunteer View (MVP)

For MVP, we can either:
- Reuse `/admin/missions` but show limited fields if `session.user.role !== 'ADMIN'`, or
- Create `/missions` for authenticated users to see only missions in their city or their squads.

**The simplest initial version**: Admins only. Squad member view can be toggled on later.

---

## 7. Logging & Observability

All events use `logEvent()` and the `EventLog` model. These should surface in:
- `/api/admin/health/errors`
- `/api/admin/health/errors/[eventType]/[errorCode]/samples`
- Potential future **Missions tab** in `/admin/health`.

### 7.1 Event Types

- `mission.create_attempted`
- `mission.created`
- `mission.create_failed`
- `mission.status_changed`
- `mission.note_added`
- And reusing existing:
  - `legal.blocked_action` when waiver/ToS gating triggers.

### 7.2 Example Event Payloads

**mission.create_attempted**
```javascript
logEvent({
  event_type: 'mission.create_attempted',
  resource_type: 'lost_pet_mission',
  action: 'create',
  result: 'success',
  actor_user_id: session.user.id,
  actor_role: session.user.role || 'USER',
  metadata: {
    city,
    state,
    zipCode,
    petSpecies,
    isUrgent,
    squadId: body.squadId || null
  }
});
```

**mission.created**
```javascript
logEvent({
  event_type: 'mission.created',
  resource_type: 'lost_pet_mission',
  resource_id: mission.id,
  action: 'create',
  result: 'success',
  actor_user_id: session.user.id,
  actor_role: session.user.role || 'USER',
  metadata: {
    missionNumber: mission.missionNumber,
    city: mission.city,
    state: mission.state,
    status: mission.status,
    squadId: mission.squadId
  }
});
```

**mission.create_failed**
```javascript
logEvent({
  event_type: 'mission.create_failed',
  resource_type: 'lost_pet_mission',
  action: 'create',
  result: 'failure',
  actor_user_id: session.user.id,
  actor_role: session.user.role || 'USER',
  error_code: 'VALIDATION_ERROR' | 'DB_WRITE_FAILED' | 'WAIVER_NOT_ACCEPTED',
  error_message: error.message || 'Unknown error during mission creation',
  metadata: {
    city,
    state,
    zipCode,
    petSpecies,
    errorName: error.name
  }
});
```

**mission.status_changed**
```javascript
logEvent({
  event_type: 'mission.status_changed',
  resource_type: 'lost_pet_mission',
  resource_id: mission.id,
  action: 'update_status',
  result: 'success',
  actor_user_id: session.user.id,
  actor_role: session.user.role || 'USER',
  metadata: {
    missionNumber: mission.missionNumber,
    previousStatus,
    newStatus,
    statusReason
  }
});
```

**mission.note_added**
```javascript
logEvent({
  event_type: 'mission.note_added',
  resource_type: 'lost_pet_mission',
  resource_id: mission.id,
  action: 'add_note',
  result: 'success',
  actor_user_id: session.user.id,
  actor_role: session.user.role || 'USER',
  metadata: {
    noteId: note.id,
    type: note.type
  }
});
```

---

## 8. Legal & Safety

- Creation and management of missions is a "field activity" and should require:
  - `tosAcceptedAt` + `tosVersionAccepted` set.
  - `waiverAcceptedAt` + `waiverVersionAccepted` set.
- Any call to `POST /api/missions` or `/api/missions/[id]/status` or `/api/missions/[id]/notes` should:
  - Fetch user.
  - If waiver not accepted → respond with 403 + `WAIVER_NOT_ACCEPTED` + `redirectTo` as done for rescue squads.
  - Emit `legal.blocked_action` with metadata:
    - `blocked_action`: `'mission_create'` | `'mission_update_status'` | `'mission_add_note'`
    - `missionId` if applicable.

---

## 9. Permissions & Roles (MVP)

For Phase 13–14, keep it simple:

**Admins**
- Can list all missions (`GET /api/missions`).
- Can view all missions.
- Can create missions.
- Can update status and add notes.

**Authenticated non-admin users (with waiver accepted)**
- **MVP option A** (simplest): Admin-only mission management. Non-admins see nothing yet.
- **MVP option B** (slightly richer):
  - Can see missions in their city or squads.
  - Can add notes but not change status.

You can start with **Admin-only** and then relax to B later.

---

## 10. Notifications (Deferred)

**MVP**: No notifications triggered automatically.
- No outbound email/SMS.
- If we want a minimal step:
  - Add a TODO comment where `mission.status_changed` would be an ideal trigger for future notifications.

---

## 11. Testing & QA

### 11.1 Unit / Integration Tests

- **Mission creation validation**:
  - Missing city/state → 400
  - Missing petSpecies → 400
- **Legal gating**:
  - User without waiver → 403, `WAIVER_NOT_ACCEPTED`, `redirectTo` set.
- **Happy path**:
  - Admin with waiver creates mission → 201, mission persisted.
  - Status change: `OPEN` → `RESOLVED` works; invalid transitions are rejected.
- **Notes**:
  - Adding a note persists and appears in notes list.

### 11.2 Admin Health Dashboard

- Verify new events appear under `/admin/health/errors`:
  - `mission.create_failed`, `mission.status_change_failed` (if you add these)
  - `legal.blocked_action` with `blocked_action = 'mission_create'`

---

## 12. Acceptance Criteria (Definition of Done)

- [x] **Prisma schema updated** with:
  - [x] `LostPetMission` model
  - [x] `LostPetMissionNote` model
  - [x] `PetSpecies`, `LostPetMissionStatus` enums
- [x] **Migration** added + applied in deploy environment.
- [ ] **Seed data**: optional – may seed a few demo missions for staging.
- [x] **API**:
  - [x] `GET /api/missions` implemented with filters.
  - [x] `GET /api/missions/[id]` returns mission + notes.
  - [x] `POST /api/missions` creates mission with validation + legal gating.
  - [x] `POST /api/missions/[id]/status` updates status and logs change.
  - [x] `POST /api/missions/[id]/notes` adds notes.
- [x] **Logging**:
  - [x] `mission.create_attempted`, `mission.created`, `mission.create_failed` implemented.
  - [x] `mission.status_changed` implemented.
  - [x] `mission.note_added` implemented.
  - [x] `legal.blocked_action` used for mission flows when waiver not accepted.
- [x] **UI**:
  - [x] `/admin/missions` list page.
  - [x] `/admin/missions/[id]` detail page with notes + status change.
  - [x] `/admin/missions/new` mission creation form.
  - [x] Legal gating UI reuses existing consent banner + `/legal/consent` flow.
- [x] **Docs**:
  - [x] This spec file (`docs/features/lost-pet-missions-mvp.md`) committed.
  - [x] `VISION.md` updated to show Phase 13–14 complete.

---

## 13. Future Extensions (Not in MVP, but planned)

- **Pet Profile model**: Separate `PetProfile` with long-term history, multiple missions per pet.
- **Owner self-service portal**: Owner-facing flows to create/update their own missions.
- **Map view**: Show missions on a map by last-seen coordinates.
- **Mission assignments**: Assign volunteers or squads to missions explicitly.
- **Automated matching**: Lost missions ↔ sightings matching system.
- **Notification engine**: Email/SMS/app notifications for status changes and new tasks.

---

**End of Spec**
