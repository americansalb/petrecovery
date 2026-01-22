# Schema Redesign: Rescue Force → Case Model

## Core Concept Change

**OLD MODEL:**
- Communities (geographic) create Recovery Squads per lost pet
- Recovery Squads are temporary, tied to specific lost pet reports
- Members join squads on a per-case basis

**NEW MODEL:**
- **Rescue Forces** = Persistent volunteer teams (like fire departments)
- **Cases** = Lost pet reports (like fires/emergencies)
- Rescue Forces choose which Cases to accept and work on
- Members join Rescue Forces permanently, then opt-in to specific Cases

---

## Key Schema Changes

### 1. **RescueSquad** (Persistent Entity)

```prisma
model RescueSquad {
  id              String   @id @default(cuid())

  // Rescue Force Identity
  name            String   @unique // "Lincoln Park Rescue Force"
  description     String?
  logoUrl         String?

  // Coverage & Specialization
  coverageType    CoverageType @default(RADIUS)
  centerLatitude  Float?
  centerLongitude Float?
  radiusMiles     Int      @default(5)
  customBoundary  String?  // JSON: GeoJSON polygon for custom coverage

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
  isActive        Boolean  @default(true)
  isAcceptingCases Boolean @default(true)

  // Stats (Lifetime)
  totalCasesAccepted   Int      @default(0)
  totalCasesCompleted  Int      @default(0)
  successfulReunions   Int      @default(0)
  totalSearchHours     Float    @default(0)
  totalAcreageSearched Float    @default(0)
  avgResponseTimeMinutes Int?   // Avg time to accept a case

  // Gamification
  rescueSquadLevel RescueSquadLevel @default(ROOKIE)
  squadPoints      Int      @default(0)
  badges           String   @default("[]") // JSON: ["first_reunion", "speed_demon", etc]

  // Relations
  members          RescueSquadMember[]
  caseAssignments  CaseAssignment[]
  searchAreas      SearchArea[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([isActive, isAcceptingCases])
  @@index([centerLatitude, centerLongitude])
}

enum CoverageType {
  RADIUS       // Simple radius from center point
  NEIGHBORHOOD // Specific neighborhood/zip codes
  CUSTOM       // Custom polygon boundary
  CITYWIDE     // Entire city
}

enum RescueSquadLevel {
  ROOKIE       // 0-5 cases
  ACTIVE       // 6-20 cases
  VETERAN      // 21-50 cases
  ELITE        // 51-100 cases
  LEGENDARY    // 100+ cases
}
```

### 2. **Case** (Renamed from LostReport)

```prisma
model Case {
  id              String   @id @default(cuid())

  // Pet Information (denormalized for performance)
  petName         String
  petSpecies      PetSpecies
  petBreed        String?
  petColor        String
  petSize         PetSize
  petPhotoUrl     String
  petDescription  String   // Full description

  // Owner/Reporter
  reporterId      String
  reporter        User     @relation(fields: [reporterId], references: [id])
  ownerName       String
  ownerPhone      String
  ownerEmail      String

  // Case Details
  caseNumber      String   @unique // "CHI-2024-001847"
  reportType      ReportType @default(LOST)
  status          CaseStatus @default(ACTIVE)
  priority        CasePriority @default(NORMAL)

  // Location
  lastSeenAt      DateTime
  lastSeenLatitude Float
  lastSeenLongitude Float
  lastSeenAddress String
  searchRadius    Float    @default(5) // Miles

  // Incident
  escapeScenario  String
  escapeDetails   String?

  // Meta Ads
  metaAdCampaignId String?
  metaAdBudget    Float?
  metaAdStatus    String?  // "running", "paused", "completed"

  // Engagement
  viewCount       Int      @default(0)
  shareCount      Int      @default(0)
  activeSearchers Int      @default(0)

  // Resolution
  resolvedAt      DateTime?
  resolution      CaseResolution?
  resolutionNotes String?

  // Relations
  assignments     CaseAssignment[]
  sightings       CaseSighting[]
  updates         CaseUpdate[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  expiresAt       DateTime?

  @@index([status])
  @@index([caseNumber])
  @@index([lastSeenLatitude, lastSeenLongitude])
  @@index([createdAt])
}

enum CaseStatus {
  ACTIVE           // Just reported, awaiting squad acceptance
  IN_PROGRESS      // One or more squads actively searching
  SIGHTING_REPORTED // Pet has been sighted
  REUNITED         // Pet found and returned to owner
  CLOSED_OTHER     // Closed for other reasons
}

enum CasePriority {
  LOW              // Adult healthy pet, good weather
  NORMAL           // Standard case
  HIGH             // Medical needs, extreme weather, dangerous area
  URGENT           // Life-threatening situation
}

enum CaseResolution {
  REUNITED         // Found by organized search
  FOUND_BY_OWNER   // Owner found pet themselves
  FOUND_AT_SHELTER // Brought to shelter
  CAME_HOME        // Pet returned on its own
  DECEASED         // Pet found deceased
  SEARCH_CEASED    // Owner stopped searching
}
```

### 3. **CaseAssignment** (Rescue Force Accepts Case)

```prisma
model CaseAssignment {
  id              String   @id @default(cuid())
  caseId          String
  case            Case     @relation(fields: [caseId], references: [id], onDelete: Cascade)
  rescueSquadId   String
  rescueSquad     RescueSquad @relation(fields: [rescueSquadId], references: [id], onDelete: Cascade)

  // Assignment Status
  status          AssignmentStatus @default(ACCEPTED)
  acceptedAt      DateTime @default(now())
  acceptedById    String   // Rescue Force leader who accepted

  // Participation
  activeMembers   Int      @default(0)
  searchHours     Float    @default(0)
  areasSearched   Int      @default(0)

  // Completion
  completedAt     DateTime?
  contribution    String?  // "Found pet", "Covered north side", etc.

  // Relations
  participants    CaseParticipant[]
  searchAreas     SearchArea[]

  @@unique([caseId, rescueSquadId]) // Rescue Force can only accept case once
  @@index([caseId])
  @@index([rescueSquadId])
  @@index([status])
}

enum AssignmentStatus {
  ACCEPTED         // Rescue Force accepted, mobilizing
  ACTIVE           // Members actively searching
  STANDBY          // Paused, watching for updates
  COMPLETED        // Rescue Force finished their involvement
  WITHDRAWN        // Rescue Force withdrew from case
}
```

### 4. **CaseParticipant** (Rescue Force Member Opts Into Specific Case)

```prisma
model CaseParticipant {
  id              String   @id @default(cuid())
  assignmentId    String
  assignment      CaseAssignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  userId          String
  user            User     @relation(fields: [userId], references: [id])

  // Participation
  optedInAt       DateTime @default(now())
  optedOutAt      DateTime?
  isActive        Boolean  @default(true)

  // Contribution
  searchHours     Float    @default(0)
  areasMarked     Int      @default(0)
  sightingsReported Int    @default(0)

  @@unique([assignmentId, userId])
  @@index([userId])
  @@index([isActive])
}
```

### 5. **RescueSquadMember** (Permanent Rescue Force Membership)

```prisma
model RescueSquadMember {
  id              String   @id @default(cuid())
  rescueSquadId   String
  rescueSquad     RescueSquad @relation(fields: [rescueSquadId], references: [id], onDelete: Cascade)
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Role
  role            RescueSquadMemberRole @default(MEMBER)

  // Status
  isActive        Boolean  @default(true)

  // Stats (Within This Rescue Force)
  casesParticipated Int    @default(0)
  successfulReunions Int   @default(0)
  searchHours     Float    @default(0)
  areasMarked     Int      @default(0)

  // Availability
  availabilityStatus AvailabilityStatus @default(AVAILABLE)
  unavailableUntil DateTime?

  joinedAt        DateTime @default(now())
  leftAt          DateTime?

  @@unique([rescueSquadId, userId])
  @@index([userId])
  @@index([role])
  @@index([isActive])
}

enum RescueSquadMemberRole {
  FOUNDER          // Created the rescue force
  LEADER           // Can accept cases, manage members
  COORDINATOR      // Can coordinate searches, post updates
  MEMBER           // Regular searcher
}

enum AvailabilityStatus {
  AVAILABLE        // Ready to search
  BUSY             // Temporarily unavailable
  AWAY             // Extended absence
}
```

---

## User Flows

### **Flow 1: Pet Owner Reports Lost Pet**

1. Owner fills out lost pet form
2. System creates **Case** with unique case number
3. System identifies nearby Rescue Forces (within search radius)
4. System sends push notification to Rescue Force leaders:
   - "New case in your area: Golden Retriever lost in Lincoln Park"
   - "Case #CHI-2024-001847 • 0.3 miles from your coverage area"
5. Meta ads auto-launch to general public

### **Flow 2: Rescue Force Leader Reviews and Accepts Case**

1. Rescue Force leader opens app, sees new case notification
2. Views case details:
   - Pet info, photo, description
   - Last seen location (map)
   - Owner contact info
   - Current status (0 rescue forces assigned)
3. Leader taps **"Accept Case"**
4. System creates **CaseAssignment**
5. All active rescue force members get notification:
   - "Your rescue force accepted a new case!"
   - "Golden Retriever - Lincoln Park - Can you help search?"

### **Flow 3: Rescue Force Member Opts In To Search**

1. Member sees notification
2. Taps "I can help"
3. System creates **CaseParticipant** record
4. Member gets access to:
   - Live map of other searchers
   - Search area claiming
   - Sighting report tool
   - Case chat

### **Flow 4: Random Person Sees Meta Ad**

1. Sees Facebook/Instagram ad for lost dog
2. Two options:
   - **"Report a sighting"** → Quick form, no signup
   - **"Join a rescue force to help search"** → Signup, join local rescue force

---

## Benefits of This Model

### **1. National Scale From Day 1**
✅ Anyone can form a rescue force anywhere
✅ Cases work without rescue forces (Meta ads + self-service)
✅ Rescue Forces add value when they exist

### **2. Persistent Communities**
✅ Rescue Forces build identity, reputation, culture
✅ Members stay engaged long-term
✅ Competition between rescue forces

### **3. Flexible Participation**
✅ Rescue Force members can opt-in/out per case
✅ Not obligated to help with every case
✅ Natural for volunteers with varying availability

### **4. Chicago Proof Point**
✅ Build 10 strong rescue forces in Chicago
✅ Demonstrate what organized search looks like
✅ Case studies: "Chicago rescue forces have 75% reunion rate"

### **5. Gamification That Works**
✅ Rescue Force leaderboards
✅ Individual member stats
✅ Badges and achievements
✅ Friendly competition

---

## Next Steps

1. **Migrate existing schema** to new Rescue Force/Case model
2. **Build rescue force formation flow** (anyone can create a rescue force)
3. **Build case acceptance flow** (rescue force leaders review and accept)
4. **Build member opt-in flow** (participate in specific cases)
5. **Add Meta Ads integration** (cases auto-launch ads)
6. **Chicago launch plan** (recruit 10 founding rescue forces)

---

**This is the model. Rescue Forces are permanent. Cases are temporary. Rescue Forces choose which cases to help with.**
