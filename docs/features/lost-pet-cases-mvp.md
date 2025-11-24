# Feature Spec: Lost Pet Cases MVP (Phase 13–14)

**Status:** Implementation Ready
**Owner:** Product + Engineering
**Last Updated:** November 24, 2025
**Phase:** 13–14 (Pet Profiles + Lost-Pet Case MVP)

---

## 0. Summary

We're introducing a **Lost Pet Case MVP** that lets admins and rescue squads:

- Capture structured information about a **lost pet** and its situation.
- Associate cases with **cities** and **rescue squads** (where appropriate).
- Track **basic status workflow** (Open → Active Search → Resolved / Closed).
- Make cases **discoverable** to internal volunteers (Phase 13–14 focuses on internal tools, not full public launch).
- Emit **structured logging events** so cases show up in the Admin Health Dashboard.

This MVP is deliberately small but **fully integrated** with:

- **Existing legal baseline**: Liability waiver + ToS already wired.
- **Existing observability**: `logEvent()`, `EventLog`, `/admin/health`.
- **Existing geography model**: Cities + zip-based squads.

Future phases will add richer features (maps, matching, SMS/email, public search, etc.). This spec focuses on the **smallest coherent slice** that's actually useful and production-worthy.

---

## 1. Problem / Why

Right now, the platform has:

- **Rescue squads** (who's available to help, by city).
- **No concept of an actual lost pet case** (who/what/where/when/urgency).

### Problems

1. Rescue squads can't coordinate around specific pets/cases.
2. There is no structured record of:
   - When a pet went missing
   - Where it was last seen
   - Who the primary contact is
   - What actions have been taken
3. Admins can't **answer basic operational questions**:
   - "How many active cases are there in Austin?"
   - "Which squads are actively working cases?"
   - "Are we closing cases or letting them rot in Open?"

### Why MVP now

- Phase 0 (observability + legal) is complete, so it's safe to carry "real" cases.
- Rescue squads already exist, so we can attach cases to **cities/squads** from day one.
- A basic case pipeline unlocks **real volunteer work**, even without fancy bells & whistles.

---

## 2. Goals & Non-Goals

### 2.1 Goals (MVP)

- **G1. Create structured lost-pet cases**
  - Admins and authorized users can create cases with minimal required fields.
- **G2. Basic status workflow**
  - Case has a status: `OPEN`, `ACTIVE_SEARCH`, `RESOLVED`, `CLOSED_OTHER`.
- **G3. Attach to city & (optionally) squad**
  - Case stores city, state, zip, and optionally a rescue squad reference.
- **G4. Pet + contact info**
  - Capture pet's name, species, key description, and primary contact info.
- **G5. Internal-only UI**
  - Cases UI is accessible to admins + authenticated users with waiver accepted (no public browse page yet).
- **G6. Observability**
  - All major actions emit structured events:
    - `case.create_attempted`, `case.created`, `case.status_changed`, `case.closed`
- **G7. Legal integration**
  - Only users with **waiver + ToS accepted** can create or manage cases.

### 2.2 Non-Goals (for this MVP)

We explicitly **do NOT** implement (yet):

- Full **public** lost-pet search portal.
- Advanced **geospatial search** (simple city/zip + distance only).
- Automated **case–sighting matching**.
- SMS / push notifications / robocalls.
- Owner self-serve case creation (owner-facing flows).
- Complex workflows (multi-stage triage, assignments, SLAs).
- Attachments / image uploads (we can leave hooks but no UI yet).

---

## 3. Key User Stories

### 3.1 Admin / Coordinator

1. **Create a new case**
   > As an admin, I can create a new lost-pet case for a given city and optionally associate it with a rescue squad, so volunteers have a clear, shared record of the search.

2. **View list of cases**
   > As an admin, I can see a list of recent cases, filter by status and city, and click into a case for details.

3. **Update case status**
   > As an admin, I can change a case from OPEN to ACTIVE_SEARCH, and eventually to RESOLVED or CLOSED_OTHER, so we don't think old cases are still active.

4. **Add notes**
   > As an admin, I can leave operational notes on a case (e.g., "Flyers distributed", "Potential sighting at X"), so future volunteers can see what's already been done.

### 3.2 Squad Member / Trusted Volunteer

5. **View cases for my city/squad**
   > As a squad member, I can see active cases in my city/squad, so I know where help is needed.

6. **Read case details**
   > As a squad member, I can view the pet details, last-seen info, and contact info for the case.

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

enum LostPetCaseStatus {
  OPEN
  ACTIVE_SEARCH
  RESOLVED
  CLOSED_OTHER
}
```

### 4.2 LostPetCase Model

```prisma
model LostPetCase {
  id            String            @id @default(cuid())
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  // Core identity
  caseNumber    String            @unique  // human-friendly, e.g. "AUS-2025-0001"

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
  status        LostPetCaseStatus @default(OPEN)
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
  notes         LostPetCaseNote[] // separate model for notes/events

  @@index([city, state])
  @@index([status])
  @@index([squadId])
}
```

### 4.3 LostPetCaseNote (simple event/notes stream)

```prisma
model LostPetCaseNote {
  id         String      @id @default(cuid())
  createdAt  DateTime    @default(now())

  caseId     String
  case       LostPetCase @relation(fields: [caseId], references: [id])

  authorId   String
  author     User        @relation(fields: [authorId], references: [id])

  // Simple typed note (could be "STATUS_CHANGE", "NOTE", "SIGHTING" later)
  type       String      // e.g. "NOTE" | "STATUS_CHANGE"
  content    String      // markdown/text

  // Optional metadata (JSON string for now)
  metadata   String      @default("{}")

  @@index([caseId])
}
```

**Phase 13–14 scope**: We implement LostPetCase + LostPetCaseNote with minimal fields. We avoid premature modeling of full PetProfile; that can come in a later phase as a separate PetProfile model that cases can reference.

---

## 5. API Design

**Base path**: `/api/cases`

### 5.1 List Cases

**Route**: `GET /api/cases`

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
  "cases": [
    {
      "id": "case_123",
      "caseNumber": "AUS-2025-0001",
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

### 5.2 Get Single Case

**Route**: `GET /api/cases/[id]`

**Auth**: Authenticated, ToS + Waiver accepted.

**Response**:
```json
{
  "case": {
    "id": "case_123",
    "caseNumber": "AUS-2025-0001",
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
      "content": "Case created and shared with Austin squad."
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

### 5.3 Create Case

**Route**: `POST /api/cases`

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
  "case": {
    "id": "case_123",
    "caseNumber": "AUS-2025-0001",
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
  "message": "You must accept the liability waiver before creating a lost pet case.",
  "redirectTo": "/legal/consent?returnUrl=/cases/new"
}
```

### 5.4 Update Case Status

**Route**: `POST /api/cases/[id]/status` (MVP: POST instead of full PATCH)

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
  - Updates `LostPetCase.status` & `statusReason`.
  - Creates `LostPetCaseNote` with `type` "STATUS_CHANGE".
  - Emits `case.status_changed` event.

### 5.5 Add Case Note

**Route**: `POST /api/cases/[id]/notes`

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

### 6.1 Admin Cases List

**Route**: `/admin/cases`

- Table with columns:
  - Case #
  - Pet (name + species)
  - City, State
  - Status (pill with color)
  - Squad (if any)
  - Created At
- Filters:
  - Status (multi-select or dropdown)
  - City/state text filter
- Clicking a row → `/admin/cases/[id]`.

### 6.2 Case Detail

**Route**: `/admin/cases/[id]`

**Sections**:
1. **Header**
   - Case number, status pill, "Urgent" badge
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

### 6.3 Create Case

**Route**: `/admin/cases/new` (or `/cases/new` gated to admins for MVP)

- Step-like form or single page with sections:
  - City & location
  - Pet details
  - Contact details
  - Squad association (optional drop-down if user belongs to a squad; admins see all squads)
- On submit:
  - Calls `POST /api/cases`
  - On `WAIVER_NOT_ACCEPTED` → show same **Legal Agreement Required** banner pattern and redirect button as squads.

### 6.4 Volunteer View (MVP)

For MVP, we can either:
- Reuse `/admin/cases` but show limited fields if `session.user.role !== 'ADMIN'`, or
- Create `/cases` for authenticated users to see only cases in their city or their squads.

**The simplest initial version**: Admins only. Squad member view can be toggled on later.

---

## 7. Logging & Observability

All events use `logEvent()` and the `EventLog` model. These should surface in:
- `/api/admin/health/errors`
- `/api/admin/health/errors/[eventType]/[errorCode]/samples`
- Potential future **Cases tab** in `/admin/health`.

### 7.1 Event Types

- `case.create_attempted`
- `case.created`
- `case.create_failed`
- `case.status_changed`
- `case.note_added`
- And reusing existing:
  - `legal.blocked_action` when waiver/ToS gating triggers.

### 7.2 Example Event Payloads

**case.create_attempted**
```javascript
logEvent({
  event_type: 'case.create_attempted',
  resource_type: 'lost_pet_case',
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

**case.created**
```javascript
logEvent({
  event_type: 'case.created',
  resource_type: 'lost_pet_case',
  resource_id: case.id,
  action: 'create',
  result: 'success',
  actor_user_id: session.user.id,
  actor_role: session.user.role || 'USER',
  metadata: {
    caseNumber: case.caseNumber,
    city: case.city,
    state: case.state,
    status: case.status,
    squadId: case.squadId
  }
});
```

**case.create_failed**
```javascript
logEvent({
  event_type: 'case.create_failed',
  resource_type: 'lost_pet_case',
  action: 'create',
  result: 'failure',
  actor_user_id: session.user.id,
  actor_role: session.user.role || 'USER',
  error_code: 'VALIDATION_ERROR' | 'DB_WRITE_FAILED' | 'WAIVER_NOT_ACCEPTED',
  error_message: error.message || 'Unknown error during case creation',
  metadata: {
    city,
    state,
    zipCode,
    petSpecies,
    errorName: error.name
  }
});
```

**case.status_changed**
```javascript
logEvent({
  event_type: 'case.status_changed',
  resource_type: 'lost_pet_case',
  resource_id: case.id,
  action: 'update_status',
  result: 'success',
  actor_user_id: session.user.id,
  actor_role: session.user.role || 'USER',
  metadata: {
    caseNumber: case.caseNumber,
    previousStatus,
    newStatus,
    statusReason
  }
});
```

**case.note_added**
```javascript
logEvent({
  event_type: 'case.note_added',
  resource_type: 'lost_pet_case',
  resource_id: case.id,
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

- Creation and management of cases is a "field activity" and should require:
  - `tosAcceptedAt` + `tosVersionAccepted` set.
  - `waiverAcceptedAt` + `waiverVersionAccepted` set.
- Any call to `POST /api/cases` or `/api/cases/[id]/status` or `/api/cases/[id]/notes` should:
  - Fetch user.
  - If waiver not accepted → respond with 403 + `WAIVER_NOT_ACCEPTED` + `redirectTo` as done for rescue squads.
  - Emit `legal.blocked_action` with metadata:
    - `blocked_action`: `'case_create'` | `'case_update_status'` | `'case_add_note'`
    - `caseId` if applicable.

---

## 9. Permissions & Roles (MVP)

For Phase 13–14, keep it simple:

**Admins**
- Can list all cases (`GET /api/cases`).
- Can view all cases.
- Can create cases.
- Can update status and add notes.

**Authenticated non-admin users (with waiver accepted)**
- **MVP option A** (simplest): Admin-only case management. Non-admins see nothing yet.
- **MVP option B** (slightly richer):
  - Can see cases in their city or squads.
  - Can add notes but not change status.

You can start with **Admin-only** and then relax to B later.

---

## 10. Notifications (Deferred)

**MVP**: No notifications triggered automatically.
- No outbound email/SMS.
- If we want a minimal step:
  - Add a TODO comment where `case.status_changed` would be an ideal trigger for future notifications.

---

## 11. Testing & QA

### 11.1 Unit / Integration Tests

- **Case creation validation**:
  - Missing city/state → 400
  - Missing petSpecies → 400
- **Legal gating**:
  - User without waiver → 403, `WAIVER_NOT_ACCEPTED`, `redirectTo` set.
- **Happy path**:
  - Admin with waiver creates case → 201, case persisted.
  - Status change: `OPEN` → `RESOLVED` works; invalid transitions are rejected.
- **Notes**:
  - Adding a note persists and appears in notes list.

### 11.2 Admin Health Dashboard

- Verify new events appear under `/admin/health/errors`:
  - `case.create_failed`, `case.status_change_failed` (if you add these)
  - `legal.blocked_action` with `blocked_action = 'case_create'`

---

## 12. Acceptance Criteria (Definition of Done)

- [ ] **Prisma schema updated** with:
  - [ ] `LostPetCase` model
  - [ ] `LostPetCaseNote` model
  - [ ] `PetSpecies`, `LostPetCaseStatus` enums
- [ ] **Migration** added + applied in deploy environment.
- [ ] **Seed data**: optional – may seed a few demo cases for staging.
- [ ] **API**:
  - [ ] `GET /api/cases` implemented with filters.
  - [ ] `GET /api/cases/[id]` returns case + notes.
  - [ ] `POST /api/cases` creates case with validation + legal gating.
  - [ ] `POST /api/cases/[id]/status` updates status and logs change.
  - [ ] `POST /api/cases/[id]/notes` adds notes.
- [ ] **Logging**:
  - [ ] `case.create_attempted`, `case.created`, `case.create_failed` implemented.
  - [ ] `case.status_changed` implemented.
  - [ ] `case.note_added` implemented.
  - [ ] `legal.blocked_action` used for case flows when waiver not accepted.
- [ ] **UI**:
  - [ ] `/admin/cases` list page.
  - [ ] `/admin/cases/[id]` detail page with notes + status change.
  - [ ] `/admin/cases/new` case creation form.
  - [ ] Legal gating UI reuses existing consent banner + `/legal/consent` flow.
- [ ] **Docs**:
  - [ ] This spec file (`docs/features/lost-pet-cases-mvp.md`) committed.
  - [ ] `PHASE_0_CHECKLIST.md` and `VISION.md` updated to show Phase 13–14 "In Progress" or "Partially Implemented".

---

## 13. Future Extensions (Not in MVP, but planned)

- **Pet Profile model**: Separate `PetProfile` with long-term history, multiple cases per pet.
- **Owner self-service portal**: Owner-facing flows to create/update their own cases.
- **Map view**: Show cases on a map by last-seen coordinates.
- **Case assignments**: Assign volunteers or squads to cases explicitly.
- **Automated matching**: Lost cases ↔ sightings matching system.
- **Notification engine**: Email/SMS/app notifications for status changes and new tasks.

---

**End of Spec**
