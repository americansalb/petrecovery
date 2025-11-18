# Schema Migration Plan: Old → New Model

## Current State Analysis

**Codebase Size:** 21,652 lines (20,896 TS/JS + 756 Prisma)
**API Routes:** 30
**Pages:** 24
**Estimated Work:** 6-8 weeks of development already completed

## Database Model Changes

### Models Being Renamed/Restructured:

| Old Model | New Model | Change Type |
|-----------|-----------|-------------|
| `RecoverySquad` | `RescueSquad` | Rename + Make Persistent |
| `LostReport` | `Case` | Rename + Restructure |
| `SquadMember` | `RescueSquadMember` | Rename |
| N/A | `CaseAssignment` | **NEW** - Squad accepts case |
| N/A | `CaseParticipant` | **NEW** - Member opts into case |

### Models Staying (Minor Updates):

- `User` - Add relation to CaseParticipant
- `Pet` - Change relation from LostReport → Case
- `Alert` - Change relation from LostReport → Case
- `Sighting` - Rename to `CaseSighting`, change relations
- `Comment` - Rename to `CaseUpdate`, change relations
- `SearchArea` - Update relations to CaseAssignment
- `PetSpotting` - Update relations to CaseAssignment
- `SquadMessage` - Update relations (case-specific chat)
- `SquadHonor` - Keep as is
- `Community` - Remove RecoverySquad relation

### Models Being Removed:

- `Subsquad` - Not needed in new model (cases are simpler)

---

## Phase 1: Schema Migration (CRITICAL)

### Step 1: Update Prisma Schema

**File:** `/home/user/petrecovery/frontend/prisma/schema.prisma`

Changes needed:

1. **RescueSquad Model (was RecoverySquad)**
```prisma
model RescueSquad {
  id                   String   @id @default(cuid())
  name                 String   @unique
  description          String?
  logoUrl              String?

  // Coverage
  coverageType         CoverageType @default(RADIUS)
  centerLatitude       Float?
  centerLongitude      Float?
  radiusMiles          Int      @default(5)
  customBoundary       String?  // GeoJSON

  // Specializations
  specializesInDogs    Boolean  @default(true)
  specializesInCats    Boolean  @default(true)
  specializesInBirds   Boolean  @default(false)
  specializesInOther   Boolean  @default(false)
  availableWeekdays    Boolean  @default(true)
  availableWeekends    Boolean  @default(true)
  availableDay         Boolean  @default(true)
  availableNight       Boolean  @default(false)
  hasTrackingDogs      Boolean  @default(false)
  hasDrones            Boolean  @default(false)

  // Status
  isActive             Boolean  @default(true)
  isAcceptingCases     Boolean  @default(true)

  // Stats
  totalCasesAccepted   Int      @default(0)
  totalCasesCompleted  Int      @default(0)
  successfulReunions   Int      @default(0)
  totalSearchHours     Float    @default(0)
  totalAcreageSearched Float    @default(0)
  avgResponseTimeMinutes Int?

  // Gamification
  rescueSquadLevel     RescueSquadLevel @default(ROOKIE)
  squadPoints          Int      @default(0)
  badges               String   @default("[]")

  // Relations
  members              RescueSquadMember[]
  caseAssignments      CaseAssignment[]

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@index([isActive, isAcceptingCases])
  @@index([centerLatitude, centerLongitude])
}
```

2. **Case Model (was LostReport)**
```prisma
model Case {
  id                   String   @id @default(cuid())
  caseNumber           String   @unique // "CHI-2024-001847"

  // Pet Info (denormalized)
  petId                String?  // Optional reference
  pet                  Pet?     @relation(fields: [petId], references: [id])
  petName              String
  petSpecies           PetSpecies
  petBreed             String?
  petColor             String
  petSize              PetSize
  petPhotoUrl          String
  petDescription       String

  // Reporter/Owner
  reporterId           String
  reporter             User     @relation(fields: [reporterId], references: [id])
  ownerName            String
  ownerPhone           String
  ownerEmail           String

  // Case Details
  reportType           ReportType @default(LOST)
  status               CaseStatus @default(ACTIVE)
  priority             CasePriority @default(NORMAL)

  // Location
  lastSeenAt           DateTime
  lastSeenLatitude     Float
  lastSeenLongitude    Float
  lastSeenAddress      String
  searchRadius         Float    @default(5)

  // Incident
  escapeScenario       String
  escapeDetails        String?

  // Meta Ads
  metaAdCampaignId     String?
  metaAdBudget         Float?
  metaAdStatus         String?

  // Engagement
  viewCount            Int      @default(0)
  shareCount           Int      @default(0)
  activeSearchers      Int      @default(0)

  // Resolution
  resolvedAt           DateTime?
  resolution           CaseResolution?
  resolutionNotes      String?

  // Relations
  assignments          CaseAssignment[]
  sightings            CaseSighting[]
  updates              CaseUpdate[]
  alerts               Alert[]

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
  expiresAt            DateTime?

  @@index([status])
  @@index([caseNumber])
  @@index([lastSeenLatitude, lastSeenLongitude])
  @@index([createdAt])
}
```

3. **CaseAssignment (NEW)**
```prisma
model CaseAssignment {
  id                String   @id @default(cuid())
  caseId            String
  case              Case     @relation(fields: [caseId], references: [id], onDelete: Cascade)
  rescueSquadId     String
  rescueSquad       RescueSquad @relation(fields: [rescueSquadId], references: [id], onDelete: Cascade)

  status            AssignmentStatus @default(ACCEPTED)
  acceptedAt        DateTime @default(now())
  acceptedById      String

  activeMembers     Int      @default(0)
  searchHours       Float    @default(0)
  areasSearched     Int      @default(0)

  completedAt       DateTime?
  contribution      String?

  participants      CaseParticipant[]
  searchAreas       SearchArea[]
  petSpottings      PetSpotting[]
  messages          SquadMessage[]

  @@unique([caseId, rescueSquadId])
  @@index([caseId])
  @@index([rescueSquadId])
  @@index([status])
}
```

4. **CaseParticipant (NEW)**
```prisma
model CaseParticipant {
  id                String   @id @default(cuid())
  assignmentId      String
  assignment        CaseAssignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  userId            String
  user              User     @relation(fields: [userId], references: [id])

  optedInAt         DateTime @default(now())
  optedOutAt        DateTime?
  isActive          Boolean  @default(true)

  searchHours       Float    @default(0)
  areasMarked       Int      @default(0)
  sightingsReported Int      @default(0)

  @@unique([assignmentId, userId])
  @@index([userId])
  @@index([isActive])
}
```

5. **RescueSquadMember (was SquadMember)**
```prisma
model RescueSquadMember {
  id                    String   @id @default(cuid())
  rescueSquadId         String
  rescueSquad           RescueSquad @relation(fields: [rescueSquadId], references: [id], onDelete: Cascade)
  userId                String
  user                  User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  role                  RescueSquadMemberRole @default(MEMBER)
  isActive              Boolean  @default(true)

  casesParticipated     Int      @default(0)
  successfulReunions    Int      @default(0)
  searchHours           Float    @default(0)
  areasMarked           Int      @default(0)

  availabilityStatus    AvailabilityStatus @default(AVAILABLE)
  unavailableUntil      DateTime?

  joinedAt              DateTime @default(now())
  leftAt                DateTime?

  @@unique([rescueSquadId, userId])
  @@index([userId])
  @@index([role])
  @@index([isActive])
}
```

### New Enums Needed:

```prisma
enum CoverageType {
  RADIUS
  NEIGHBORHOOD
  CUSTOM
  CITYWIDE
}

enum RescueSquadLevel {
  ROOKIE
  ACTIVE
  VETERAN
  ELITE
  LEGENDARY
}

enum CaseStatus {
  ACTIVE
  IN_PROGRESS
  SIGHTING_REPORTED
  REUNITED
  CLOSED_OTHER
}

enum CasePriority {
  LOW
  NORMAL
  HIGH
  URGENT
}

enum CaseResolution {
  REUNITED
  FOUND_BY_OWNER
  FOUND_AT_SHELTER
  CAME_HOME
  DECEASED
  SEARCH_CEASED
}

enum AssignmentStatus {
  ACCEPTED
  ACTIVE
  STANDBY
  COMPLETED
  WITHDRAWN
}

enum RescueSquadMemberRole {
  FOUNDER
  LEADER
  COORDINATOR
  MEMBER
}

enum AvailabilityStatus {
  AVAILABLE
  BUSY
  AWAY
}
```

---

## Phase 2: API Route Updates

All API routes using `prisma.lostReport` → `prisma.case`
All API routes using `prisma.recoverySquad` → `prisma.rescueSquad`
All API routes using `prisma.squadMember` → `prisma.rescueSquadMember`

**Files to update (from grep results):**
- `/app/api/reports/[id]/route.js`
- `/app/api/reports/[id]/squads/route.js`
- `/app/api/reports/found-pet/route.js`
- All other API routes in `/app/api/reports/`
- All API routes in `/app/api/squads/`

---

## Phase 3: Frontend Updates

All components/pages using old model names need updates.

**Expected files:**
- `/app/report/` - Lost pet reporting
- `/app/reports/` - Report viewing
- `/app/squads/` - Squad pages
- `/app/dashboard/` - Dashboard views
- Any components using Prisma types

---

## Phase 4: Database Migration

Since this is a breaking schema change:

**Option A: Fresh Database (Recommended for Development)**
1. Delete `dev.db`
2. Run `npx prisma generate`
3. Run `npx prisma db push`
4. Seed with test data

**Option B: Production Migration (If data exists)**
1. Write custom migration script to:
   - Copy LostReport → Case
   - Copy RecoverySquad → RescueSquad
   - Create CaseAssignments from existing RecoverySquads
   - Create CaseParticipants from existing SquadMembers
2. Test thoroughly on staging

---

## Rollout Strategy

1. ✅ Backup current schema
2. ✅ Create migration plan (this document)
3. **Update Prisma schema**
4. **Regenerate Prisma client**
5. **Update all API routes**
6. **Update all frontend pages/components**
7. **Test end-to-end**
8. **Commit and push**

---

## Breaking Changes to Expect

1. All existing database data will need migration
2. API endpoint responses will change shape
3. Frontend TypeScript types will break
4. Any hardcoded references to old model names will error

---

## Estimated Time

- Schema updates: 1-2 hours
- API route updates: 3-4 hours
- Frontend updates: 2-3 hours
- Testing & debugging: 2-3 hours
- **Total: 8-12 hours of focused work**

---

**Ready to proceed? This is a significant refactor but necessary to get the architecture right.**
