# Rescue Force + Division System

## Overview

ReunitePets.org uses a two-tier geographic organization system for volunteer coordination:

1. **Rescue Forces** - City-level volunteer teams
2. **Divisions** (optional) - Neighborhood subdivisions within large city squads

This system replaces the legacy "Community" model (archived in `/archived_legacy_docs/`).

---

## System Architecture

### Rescue Forces (City-Level)

**What is a Rescue Force?**
- Persistent volunteer team covering a city or town
- Backed by zip codes on the backend
- Displayed by city name on the frontend
- Similar to a fire department - always ready, always there

**Key Features:**
- Geographic coverage (radius, neighborhood, citywide, or custom boundary)
- Specializations (dogs, cats, birds, tracking dogs, drones)
- Persistent membership
- Squad-level stats and gamification
- Anyone can create or join

**Example:**
```
Chicago Rescue Force
  - Coverage: Citywide
  - Center: 41.8781°N, 87.6298°W
  - Radius: 15 miles
  - Members: 247
  - Specializations: Dogs, Cats, Tracking Dogs, Drones
```

---

### Divisions (Neighborhood-Level)

**What is a Division?**
- Neighborhood subdivision within a large city Rescue Force
- Created by admins based on user requests
- Only applies to large cities
- Helps organize volunteer efforts in sprawling metro areas

**Key Features:**
- Belongs to a parent Rescue Force
- Smaller geographic coverage (typically 3-mile radius)
- Neighborhood-specific membership
- Users can request creation via clean UI
- Admin reviews and approves

**Example:**
```
Chicago Rescue Force
  ├─ North Side Division
  ├─ South Side Division
  ├─ West Side Division
  └─ Downtown Division
```

---

## User Flows

### 1. User Registration & Squad Discovery

**Step 1: User registers and confirms email with OTP**

**Step 2: Search for Rescue Forces**
- User is asked for their zip code
- System searches for all cities within 10-mile radius
- Each city shows either:
  - **"Join Rescue Force"** (if squad exists)
  - **"Create Rescue Force"** (if no squad exists)

**Step 3: Join or Create**
- **Create:** User becomes founding squad member
- **Join:** User gets instant access

### 2. Rescue Force Experience (No Divisions)

**For small/medium cities without Divisions:**
- User joins the Rescue Force
- Sees all active cases in their squad's coverage area
- Can opt into specific cases to participate
- Communicates in general channel + case-specific channels

### 3. Rescue Force Experience (With Divisions)

**For large cities with Divisions:**

**Joining:**
- User joins Rescue Force
- Optionally selects a Division (neighborhood)

**Case Visibility Priority:**
1. **Priority 1:** Cases in user's Division(s)
2. **Priority 2:** Cases in other Divisions within same Rescue Force
3. **Priority 3:** Cases from other Rescue Forces the user is in

**UI Experience:**
- Clean, intuitive unified case view across all squads
- Clear visual hierarchy showing which cases are closest
- Filter/sort by Division, Squad, distance, priority

### 4. Division Request Flow

**User Perspective:**
- Clean UI button: "Request New Division"
- Form collects:
  - Proposed name (e.g., "West Loop")
  - Justification (why needed)
  - Geographic details (zip codes, center point, radius)
  - Estimated population
  - Additional notes
- Submission goes to admin queue

**Admin Perspective:**
- Dashboard shows all Division requests
- Reviews submission details
- Can approve (creates Division) or reject (with reason)
- Decision rationale tracked

---

## Database Schema

### Core Models

#### RescueSquad
```prisma
model RescueSquad {
  id              String   @id
  name            String   @unique
  description     String?

  // Coverage
  coverageType    CoverageType // RADIUS, NEIGHBORHOOD, CUSTOM, CITYWIDE
  centerLatitude  Float?
  centerLongitude Float?
  radiusMiles     Int      @default(5)
  customBoundary  String?  // GeoJSON polygon

  // Specializations
  specializesInDogs    Boolean
  specializesInCats    Boolean
  hasTrackingDogs      Boolean
  hasDrones            Boolean

  // Stats
  totalCasesAccepted   Int
  successfulReunions   Int
  totalSearchHours     Float

  // Relations
  members          RescueSquadMember[]
  divisions        Division[]
  caseAssignments  CaseAssignment[]
}
```

#### Division
```prisma
model Division {
  id              String   @id
  rescueSquadId   String
  rescueSquad     RescueSquad @relation(...)

  name            String   // "North Side"
  description     String?

  // Coverage (neighborhood-level)
  centerLatitude  Float?
  centerLongitude Float?
  radiusMiles     Int      @default(3)
  zipCodes        String   // JSON array
  customBoundary  String?  // GeoJSON polygon

  // Stats
  totalMembers    Int
  activeCases     Int

  // Relations
  members         RescueSquadMember[]
}
```

#### RescueSquadMember
```prisma
model RescueSquadMember {
  id              String   @id
  rescueSquadId   String
  userId          String
  divisionId      String?  // Optional - only for large cities

  role            RescueSquadMemberRole // FOUNDER, LEADER, COORDINATOR, MEMBER
  isActive        Boolean

  // Stats
  casesParticipated Int
  successfulReunions Int
  searchHours     Float
}
```

#### DivisionRequest
```prisma
model DivisionRequest {
  id              String   @id
  requesterId     String
  rescueSquadId   String

  proposedName    String
  justification   String

  // Geographic Details
  zipCodes        String   // JSON array
  centerLatitude  Float?
  centerLongitude Float?
  estimatedRadius Int?
  estimatedPopulation Int?
  notes           String?

  // Review
  status          RequestStatus // PENDING, APPROVED, REJECTED
  reviewedById    String?
  reviewedAt      DateTime?
  rejectionReason String?

  // Approval creates Division
  approvedDivisionId String?
  approvedDivision Division?
}
```

---

## API Endpoints

### Rescue Force Discovery

**POST /api/rescue-forces/search**
```json
{
  "zipCode": "60614",
  "radiusMiles": 10
}
```

Response:
```json
{
  "nearbySquads": [
    {
      "id": "squad_chi",
      "name": "Chicago Rescue Force",
      "distance": 2.3,
      "memberCount": 247,
      "hasDivisions": true,
      "divisions": [
        {"id": "div_north", "name": "North Side"},
        {"id": "div_south", "name": "South Side"}
      ]
    }
  ],
  "citiesWithoutSquads": [
    {
      "cityName": "Evanston",
      "state": "IL",
      "distance": 8.7,
      "canCreate": true
    }
  ]
}
```

### Division Management

**POST /api/divisions/request**
```json
{
  "rescueSquadId": "squad_chi",
  "proposedName": "West Loop",
  "justification": "High population density, 50+ active users",
  "zipCodes": ["60607", "60661"],
  "centerLatitude": 41.8825,
  "centerLongitude": -87.6473,
  "estimatedRadius": 3,
  "estimatedPopulation": 75000,
  "notes": "Growing neighborhood with many pet owners"
}
```

**GET /api/admin/divisions/requests**
Returns pending Division requests for admin review.

**POST /api/admin/divisions/approve/:requestId**
Admin approves a Division request, creating the Division.

**POST /api/admin/divisions/reject/:requestId**
```json
{
  "rejectionReason": "Geographic overlap with existing division"
}
```

### Case Visibility

**GET /api/cases/my-feed**

Returns cases prioritized by:
1. User's Division(s)
2. User's Rescue Force(s)
3. Distance
4. Priority level

Response:
```json
{
  "cases": [
    {
      "id": "case_123",
      "caseNumber": "CHI-2024-001847",
      "petName": "Max",
      "petSpecies": "DOG",
      "priority": "HIGH",
      "distance": 0.8,
      "matchType": "YOUR_DIVISION", // or "YOUR_SQUAD", "OTHER_SQUAD"
      "division": {
        "id": "div_north",
        "name": "North Side"
      },
      "rescueSquad": {
        "id": "squad_chi",
        "name": "Chicago Rescue Force"
      }
    }
  ]
}
```

---

## Division Strategy

### Seeding Major Cities

**Phase 1: Manual Seeding**
- Identify top 20 metro areas by population
- Research natural neighborhood boundaries
- Pre-create Divisions for these cities

**Examples:**
- **Chicago:** North Side, South Side, West Side, Downtown
- **Los Angeles:** Westside, Valley, South LA, East LA, Downtown
- **New York:** Manhattan, Brooklyn, Queens, Bronx, Staten Island
- **Houston:** Inner Loop, Heights, Galleria, East Houston

### Organic Growth

**User-Driven Requests:**
- Users in non-seeded cities can request Divisions
- Admin reviews based on:
  - Population density
  - User activity levels
  - Geographic coherence
  - Existing squad member count

**Approval Criteria:**
- Minimum 20 active users in proposed area
- Clear geographic boundaries
- No overlap with existing Divisions
- Demonstrable need (case volume, coverage gaps)

---

## Migration from Legacy System

### What Changed?

**Old System (Never Fully Implemented):**
- Communities (hierarchical: metro → county → subcommunity)
- Complex creation/approval flow
- Metro areas as primary organizational unit

**New System:**
- Rescue Forces (city-level, persistent)
- Divisions (optional neighborhood level)
- Simplified creation flow
- City as primary unit

### Backward Compatibility

Legacy Community models remain in `schema.prisma` marked as "LEGACY - Keeping for backwards compatibility". They are not integrated with the active system.

To fully remove:
1. Verify no production data references Community models
2. Remove Community relations from User model
3. Drop Community tables via migration
4. Remove models from schema

---

## Best Practices

### For Small Cities
- Single Rescue Force, no Divisions
- Keep it simple
- Focus on building volunteer base

### For Large Cities
- Start with broad Rescue Force
- Add Divisions as membership grows
- 2-4 Divisions typically sufficient
- Avoid over-fragmentation

### For Case Assignment
- Case can be accepted by multiple Rescue Forces
- Each squad coordinates independently
- Squad members opt into specific cases
- Communication happens at case level (not squad-wide)

---

## Future Enhancements

### Division Analytics
- Heatmaps of case density by Division
- Response time comparisons
- Success rate tracking
- Resource allocation insights

### Dynamic Boundaries
- AI-suggested Division boundaries based on:
  - Historical case locations
  - Population density
  - Natural neighborhood boundaries
  - Transit accessibility

### Cross-Division Coordination
- Mutual aid between Divisions
- Resource sharing (tracking dogs, drones)
- Joint searches for high-priority cases

---

## Related Files

- **Schema:** `/frontend/prisma/schema.prisma`
- **Location Utilities:** `/frontend/lib/us-locations.js`
- **ZIP Mapping:** `/frontend/lib/zip-city-mapping.js`
- **Legacy Docs:** `/archived_legacy_docs/`

---

**Last Updated:** 2025-11-20
**Version:** 2.0 (Rescue Force + Division System)
