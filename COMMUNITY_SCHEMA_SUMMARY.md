# Community System Database Schema Summary

## Phase 1: Database Schema - COMPLETED ✅

### Schema Changes Overview

The Prisma schema has been extended with **12 new models** and **8 new enums** to support the community creation, approval, and recovery squad features.

---

## Modified Existing Models

### User Model
**New Fields Added:**
- `rescueLevel` (RescueLevel enum) - Gamification level (PET_OWNER → PACK_LEGEND)
- `squadsJoinedCount` (Int) - Total squads user has joined
- `areasMarkedCount` (Int) - Total search areas marked
- `totalAcreageSearched` (Float) - Cumulative acreage searched
- `successfulReunions` (Int) - Count of successful pet reunions participated in
- `honorsReceived` (Int) - Times honored by pet owners
- `lastLevelUpAt` (DateTime) - Last level progression timestamp

**New Relations:**
- `communityRequests` - Community creation requests submitted
- `reviewedRequests` - Requests reviewed (for admins)
- `communityMemberships` - Communities user belongs to
- `createdCommunities` - Communities user created
- `approvedCommunities` - Communities user approved (as admin)
- `communityPosts` - Posts in community feeds
- `squadMemberships` - Recovery squads joined
- `searchAreas` - Search areas marked
- `petSpottings` - Pet sightings reported within squads
- `squadMessages` - Messages sent in squad chats
- `receivedHonors` - Honors received from owners
- `givenHonors` - Honors given to volunteers

### LostReport Model
**New Relations:**
- `recoverySquads` - Recovery squads created for this lost pet report

---

## New Enums

### RescueLevel
Gamification progression system:
- `PET_OWNER` (Level 0) - Has submitted a lost pet request
- `SCOUT` (Level 1) - Joined a community
- `SENTRY` (Level 2) - Joined a recovery squad
- `SHEPHERD` (Level 3) - Marked 5+ areas, 15+ acres total
- `PATHFINDER` (Level 4) - 1+ successful reunion
- `PACK_GUARDIAN` (Level 5) - 5+ successful reunions
- `PACK_LEGEND` (Level 6) - 50+ successful reunions

### CommunityType
- `METRO_AREA` - Metropolitan area (parent community)
- `COUNTY` - County boundaries (for rural areas)
- `SUBCOMMUNITY` - City/neighborhood within metro/county

### RequestStatus
- `PENDING` - Awaiting admin review
- `APPROVED` - Request approved, community created
- `REJECTED` - Request denied

### MemberStatus
- `PENDING` - Join request awaiting moderator approval
- `APPROVED` - Active community member
- `REJECTED` - Join request denied
- `BANNED` - User banned from community

### CommunityRole
- `MEMBER` - Regular community member
- `MODERATOR` - Community moderator (admin-granted)

### SquadStatus
- `ACTIVE` - Squad actively searching
- `CLOSED` - Squad closed (pet found or search ceased)

### SquadClosureReason
- `FOUND` - Pet reunited with owner
- `CEASED` - Owner ceased search activity

### SquadRole
- `OWNER` - Pet owner (auto-assigned)
- `LEADER` - Squad leader (owner-designated)
- `MEMBER` - Regular volunteer

### MessageType
- `CHAT` - Regular chat message
- `ANNOUNCEMENT` - Central Hub announcement (leaders only)
- `SYSTEM` - System-generated message

---

## New Models

### 1. CommunityRequest
**Purpose:** Tracks user-submitted community creation requests

**Key Fields:**
- `requesterId` - User who submitted request
- `type` - METRO_AREA, COUNTY, or SUBCOMMUNITY
- `geographicScope` - City name or zip code
- `notes` - Optional justification from requester
- `parentCommunityId` - For subcommunity requests
- `status` - PENDING/APPROVED/REJECTED
- `reviewedById` - Admin who reviewed
- `rejectionReason` - If rejected

**Indexes:** requesterId, status, createdAt

---

### 2. Community
**Purpose:** Approved communities (metro/county + subcommunities)

**Key Fields:**
- `name` - Official community name (unique)
- `description` - Community description
- `type` - METRO_AREA, COUNTY, or SUBCOMMUNITY
- `geographicScope` - Official metro/county/city name
- `zipCodes` - JSON array of zip codes in coverage area
- `centerLatitude` / `centerLongitude` - Geographic center
- `parentCommunityId` - For subcommunities (links to metro/county)
- `isActive` - Community active status
- `createdById` - Original requester
- `approvedById` - Admin who approved

**Relations:**
- `subcommunities` - Child communities (for metros/counties)
- `members` - Community memberships
- `posts` - Community feed posts
- `recoverySquads` - Squads created in this community
- `subsquads` - Subsquads for subcommunities

**Indexes:** type, parentCommunityId, isActive

---

### 3. CommunityMember
**Purpose:** User membership in communities

**Key Fields:**
- `communityId` / `userId` - Membership link
- `status` - PENDING/APPROVED/REJECTED/BANNED
- `role` - MEMBER or MODERATOR
- `requestedAt` / `approvedAt` - Timestamps
- `approvedById` - Moderator who approved
- `rejectionReason` - If rejected
- `notificationSettings` - JSON: {newAlerts: true, announcements: false, ...}
- `isFounder` - Original community creator
- `bannedAt` / `bannedById` / `banReason` - Ban tracking
- `dailyPostCount` / `lastPostDate` - Rate limiting (3 posts/day)

**Unique Constraint:** (communityId, userId) - One membership per user per community

**Indexes:** userId, status, role

---

### 4. CommunityPost
**Purpose:** Posts in community feeds

**Key Fields:**
- `communityId` / `authorId` - Post ownership
- `content` - Post text
- `isPinned` - Moderator can pin important posts
- `isDeleted` - Soft delete
- `deletedById` / `deletedAt` / `deleteReason` - Moderation tracking

**Indexes:** communityId, authorId, createdAt, isPinned

---

### 5. RecoverySquad
**Purpose:** Active rescue teams for lost pets

**Key Fields:**
- `reportId` - Lost pet report
- `communityId` - Community where squad operates
- `name` - "{Pet Name} Recovery Squad - {Community Name}"
- `status` - ACTIVE or CLOSED
- `closedAt` / `closedReason` - FOUND or CEASED
- `memberCount` - Current member count
- `searchAreasMarked` - Total areas marked as searched
- `totalAcreageSearched` - Cumulative acreage

**Relations:**
- `members` - Squad volunteers
- `subsquads` - Subsquads for subcommunities
- `messages` - Chat messages
- `searchAreas` - Marked search areas
- `petSpottings` - Reported sightings
- `honors` - Honors given to members

**Unique Constraint:** (reportId, communityId) - One squad per pet per community

**Indexes:** reportId, communityId, status

---

### 6. Subsquad
**Purpose:** Subcommunity sections within a unified recovery squad

**Key Fields:**
- `squadId` - Parent squad
- `communityId` - Subcommunity (e.g., Evanston)
- `name` - e.g., "Evanston Subsquad"

**Relations:**
- `members` - Members assigned to this subsquad
- `messages` - Subsquad-specific chat

**Unique Constraint:** (squadId, communityId) - One subsquad per subcommunity per squad

**Indexes:** squadId, communityId

---

### 7. SquadMember
**Purpose:** User participation in recovery squads

**Key Fields:**
- `squadId` / `userId` - Membership link
- `subsquadId` - Null if main squad, set if in specific subsquad
- `role` - OWNER, LEADER, or MEMBER
- `messagesSent` - Chat messages sent
- `areasMarked` - Search areas marked
- `actionsCount` - Total actions (for Shepherd level tracking)
- `joinedAt` / `leftAt` - Participation period

**Unique Constraint:** (squadId, userId) - One membership per user per squad

**Indexes:** userId, subsquadId, role

---

### 8. SquadMessage
**Purpose:** Chat and announcements within squads

**Key Fields:**
- `squadId` / `authorId` - Message ownership
- `subsquadId` - Null for Central Hub, set for subsquad chat
- `type` - CHAT, ANNOUNCEMENT, or SYSTEM
- `content` - Message text
- `photoUrls` - JSON array of attached images
- `location` - JSON: {lat, lng, address} for shared locations

**Indexes:** squadId, subsquadId, createdAt

---

### 9. SearchArea
**Purpose:** Marked search areas on map

**Key Fields:**
- `squadId` / `markedById` - Area ownership
- `geometry` - GeoJSON polygon coordinates
- `acreage` - Calculated area size
- `notes` - Search notes from volunteer
- `potentialSpotting` - Checkbox: possible pet sighting
- `startAddress` - Starting point of search
- `markedAt` - Timestamp

**Indexes:** squadId, markedById, markedAt

**Note:** Areas >5 acres trigger warning prompt

---

### 10. PetSpotting
**Purpose:** Reported pet sightings within squads

**Key Fields:**
- `squadId` / `reportedById` - Sighting ownership
- `latitude` / `longitude` / `address` - Location
- `spottedAt` - When pet was seen
- `confidenceLevel` - 1-10 scale
- `photoUrls` - JSON array of photos
- `notes` - Additional details

**Indexes:** squadId, reportedById, reportedAt

**Alert:** Triggers immediate notification to all squad members + owner

---

### 11. SquadHonor
**Purpose:** Owner honors given to exceptional volunteers

**Key Fields:**
- `squadId` - Squad context
- `honoredUserId` - Volunteer who helped
- `givenById` - Pet owner giving honor
- `note` - Optional message from owner

**Indexes:** honoredUserId, squadId

**Display:** Shows on user profile: "Honored 23 times by grateful pet owners"

---

## Database Relationships

### User → Communities
- User can submit multiple `CommunityRequest`s
- User can review requests (if admin)
- User can be member of multiple `Community` via `CommunityMember`
- User can create communities
- User can approve communities (if admin)

### Community Hierarchy
- Metro/County communities have many `Subcommunity` children
- Subcommunities have one parent (Metro/County)
- Max depth: 2 levels

### Recovery Squads
- `LostReport` can have multiple `RecoverySquad`s (one per community)
- `RecoverySquad` can have multiple `Subsquad`s (one per subcommunity)
- `User` joins squad via `SquadMember`
- `SquadMember` can be assigned to specific `Subsquad`

### Squad Activity
- `SquadMessage` belongs to squad/subsquad
- `SearchArea` belongs to squad
- `PetSpotting` belongs to squad
- `SquadHonor` links volunteer to owner via squad

---

## Migration Notes

### Before Running Migration

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Generate migration:**
   ```bash
   npx prisma migrate dev --name add_community_system
   ```

3. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

### Data Considerations

- **Existing users** will default to `rescueLevel = PET_OWNER`
- **No existing data** needs migration (all new tables)
- **Email verification** requirement means existing users are grandfathered in (per requirements)

---

## Next Steps

1. ✅ **Phase 1 Complete:** Database schema designed
2. 🔄 **Phase 2:** Map out API endpoints
3. ⏳ **Phase 3:** Design UI components and pages
4. ⏳ **Phase 4:** Implement features in phases

---

## Schema Validation

**Status:** Schema designed, pending validation via `prisma migrate`

**To validate:**
```bash
cd frontend
npm install
npx prisma format
npx prisma validate
```

The schema is ready for implementation! All relationships, indexes, and constraints have been defined according to the feature requirements.
