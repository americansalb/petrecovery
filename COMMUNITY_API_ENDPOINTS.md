# Community System API Endpoints

## Complete API Specification for Community Features

This document outlines all API endpoints needed to implement the community creation, approval, and recovery squad system.

---

## 🔐 Authentication & Authorization

All endpoints require NextAuth session authentication unless marked as **(Public)**.

**Role Checks:**
- `ADMIN` - Platform administrators only
- `MODERATOR` - Community moderators or admins
- `MEMBER` - Approved community members
- `AUTHENTICATED` - Any logged-in user

---

## 📝 COMMUNITY REQUEST ENDPOINTS

### POST /api/communities/request
**Auth:** AUTHENTICATED
**Purpose:** Submit community creation request

**Request Body:**
```json
{
  "type": "METRO_AREA" | "COUNTY" | "SUBCOMMUNITY",
  "geographicScope": "Chicago" | "60201",
  "parentCommunityId": "cuid" // Required for SUBCOMMUNITY
  "notes": "Optional justification text"
}
```

**Validation:**
- Email verified OR phone verified (required)
- Check rate limit: max 10 requests per rolling 30 days
- For zip codes: check 10-mile radius for overlaps
- For subcommunities: verify parent exists

**Response:**
```json
{
  "success": true,
  "request": {
    "id": "cuid",
    "type": "METRO_AREA",
    "geographicScope": "Chicago",
    "status": "PENDING",
    "createdAt": "2025-11-16T..."
  }
}
```

**Errors:**
- 401: Not authenticated
- 403: Email/phone not verified
- 429: Rate limit exceeded (10 requests/30 days)
- 400: Invalid data or overlap detected

---

### GET /api/communities/requests
**Auth:** AUTHENTICATED
**Purpose:** Get user's own community requests

**Query Params:**
- `status` (optional): PENDING | APPROVED | REJECTED

**Response:**
```json
{
  "requests": [
    {
      "id": "cuid",
      "type": "METRO_AREA",
      "geographicScope": "Chicago",
      "status": "PENDING",
      "notes": "...",
      "createdAt": "...",
      "reviewedAt": null,
      "rejectionReason": null
    }
  ]
}
```

---

### GET /api/communities/requests/:id
**Auth:** AUTHENTICATED (owner or admin)
**Purpose:** Get details of specific request

**Response:**
```json
{
  "request": {
    "id": "cuid",
    "type": "METRO_AREA",
    "geographicScope": "Chicago",
    "status": "PENDING",
    "notes": "...",
    "requester": {
      "id": "cuid",
      "name": "John Doe",
      "email": "john@example.com",
      "rescueLevel": "SCOUT"
    },
    "createdAt": "...",
    "reviewedAt": null,
    "reviewedBy": null,
    "rejectionReason": null
  }
}
```

---

## 👑 ADMIN - COMMUNITY APPROVAL ENDPOINTS

### GET /api/admin/communities/requests
**Auth:** ADMIN
**Purpose:** Get all pending community requests for review

**Query Params:**
- `status` (optional): PENDING | APPROVED | REJECTED (default: PENDING)
- `type` (optional): METRO_AREA | COUNTY | SUBCOMMUNITY
- `page` (optional): Pagination
- `limit` (optional): Items per page (default: 20)

**Response:**
```json
{
  "requests": [
    {
      "id": "cuid",
      "type": "METRO_AREA",
      "geographicScope": "Chicago",
      "status": "PENDING",
      "notes": "Large metropolitan area with active pet community",
      "requester": {
        "id": "cuid",
        "name": "Sarah Johnson",
        "email": "sarah@example.com",
        "emailVerified": true,
        "phoneVerified": false,
        "rescueLevel": "SCOUT",
        "communityCount": 2,
        "createdAt": "2024-01-15T..."
      },
      "overlapCheck": {
        "hasOverlap": false,
        "overlappingCommunities": []
      },
      "createdAt": "2025-11-16T..."
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
}
```

---

### POST /api/admin/communities/requests/:id/approve
**Auth:** ADMIN
**Purpose:** Approve community request and create community

**Request Body:**
```json
{
  "name": "Chicago Metropolitan Area",
  "description": "Community for Chicago metro pet recovery",
  "zipCodes": ["60601", "60602", "60603", ...],
  "centerLatitude": 41.8781,
  "centerLongitude": -87.6298
}
```

**Process:**
1. Create Community record
2. Link to CommunityRequest (approvedCommunityId)
3. Update request status to APPROVED
4. Auto-create CommunityMember for requester (isFounder: true, status: APPROVED)
5. Send email notification to requester

**Response:**
```json
{
  "success": true,
  "community": {
    "id": "cuid",
    "name": "Chicago Metropolitan Area",
    "type": "METRO_AREA",
    "isActive": true,
    "approvedAt": "...",
    "createdBy": {
      "id": "cuid",
      "name": "Sarah Johnson"
    }
  }
}
```

---

### POST /api/admin/communities/requests/:id/reject
**Auth:** ADMIN
**Purpose:** Reject community request

**Request Body:**
```json
{
  "reason": "Overlaps with existing Chicago Metro community. Please request a subcommunity instead."
}
```

**Process:**
1. Update request status to REJECTED
2. Set rejectionReason
3. Send email notification to requester

**Response:**
```json
{
  "success": true,
  "request": {
    "id": "cuid",
    "status": "REJECTED",
    "rejectionReason": "...",
    "reviewedAt": "...",
    "reviewedBy": {
      "id": "cuid",
      "name": "Admin User"
    }
  }
}
```

---

## 🏘️ COMMUNITY ENDPOINTS

### GET /api/communities
**Auth:** AUTHENTICATED (Public browse)
**Purpose:** Browse/search all communities

**Query Params:**
- `search` (optional): Search by name or geographic scope
- `type` (optional): METRO_AREA | COUNTY | SUBCOMMUNITY
- `parentId` (optional): Get subcommunities of specific parent
- `lat` / `lng` (optional): Find communities near coordinates
- `page` / `limit` (optional): Pagination

**Response:**
```json
{
  "communities": [
    {
      "id": "cuid",
      "name": "Chicago Metropolitan Area",
      "description": "...",
      "type": "METRO_AREA",
      "geographicScope": "Chicago Metro",
      "memberCount": 1247,
      "activeSquads": 15,
      "subcommunityCount": 23,
      "isActive": true,
      "moderators": [
        {
          "id": "cuid",
          "name": "Admin User"
        }
      ],
      "userMembership": {
        "isMember": true,
        "status": "APPROVED",
        "role": "MEMBER"
      }
    }
  ],
  "pagination": {...}
}
```

---

### GET /api/communities/:id
**Auth:** AUTHENTICATED
**Purpose:** Get community details

**Response:**
```json
{
  "community": {
    "id": "cuid",
    "name": "Chicago Metropolitan Area",
    "description": "...",
    "type": "METRO_AREA",
    "geographicScope": "Chicago Metro",
    "zipCodes": ["60601", ...],
    "centerLatitude": 41.8781,
    "centerLongitude": -87.6298,
    "isActive": true,
    "memberCount": 1247,
    "activeSquadsCount": 15,
    "subcommunities": [
      {
        "id": "cuid",
        "name": "Evanston",
        "memberCount": 156,
        "activeSquadsCount": 3
      }
    ],
    "moderators": [
      {
        "id": "cuid",
        "name": "Jane Moderator",
        "rescueLevel": "PACK_GUARDIAN"
      }
    ],
    "founder": {
      "id": "cuid",
      "name": "Sarah Johnson",
      "rescueLevel": "PATHFINDER"
    },
    "userMembership": {
      "isMember": true,
      "status": "APPROVED",
      "role": "MEMBER",
      "joinedAt": "..."
    },
    "createdAt": "...",
    "approvedAt": "..."
  }
}
```

---

### GET /api/communities/suggested
**Auth:** AUTHENTICATED
**Purpose:** Get suggested communities based on user's patrol zip code

**Logic:**
- Get user's patrol profile zip code
- Find all communities within 10-mile radius
- Return metro/county + subcommunities
- Mark which user is already member of

**Response:**
```json
{
  "suggested": [
    {
      "id": "cuid",
      "name": "Chicago Metropolitan Area",
      "type": "METRO_AREA",
      "distance": 0,
      "isMember": false,
      "membershipStatus": null,
      "subcommunities": [
        {
          "id": "cuid",
          "name": "Evanston",
          "isMember": false
        }
      ]
    }
  ]
}
```

---

## 👥 COMMUNITY MEMBERSHIP ENDPOINTS

### POST /api/communities/:id/join
**Auth:** AUTHENTICATED
**Purpose:** Request to join community

**Validation:**
- Email OR phone verified (required)
- Not already a member or pending
- Not banned from community
- If subcommunity, must be member of parent (or pending)

**Process:**
1. Create CommunityMember with status PENDING
2. Notify moderators of new join request

**Response:**
```json
{
  "success": true,
  "membership": {
    "id": "cuid",
    "communityId": "cuid",
    "status": "PENDING",
    "requestedAt": "..."
  }
}
```

**Errors:**
- 403: Email/phone not verified
- 409: Already member or pending
- 403: Banned from community
- 403: Must join parent community first (for subcommunities)

---

### POST /api/communities/:id/leave
**Auth:** MEMBER
**Purpose:** Leave community

**Process:**
1. Remove from active recovery squads in community
2. Delete CommunityMember record
3. If has subcommunity memberships, prompt to leave those too

**Response:**
```json
{
  "success": true,
  "message": "Left Chicago Metropolitan Area"
}
```

---

### GET /api/communities/:id/members
**Auth:** MEMBER (of community)
**Purpose:** Get community members list

**Query Params:**
- `role` (optional): MEMBER | MODERATOR
- `search` (optional): Search by name
- `page` / `limit`

**Response:**
```json
{
  "members": [
    {
      "id": "cuid",
      "user": {
        "id": "cuid",
        "name": "John Doe",
        "rescueLevel": "PATHFINDER",
        "honorsReceived": 12,
        "successfulReunions": 4
      },
      "role": "MEMBER",
      "isFounder": false,
      "joinedAt": "..."
    }
  ],
  "pagination": {...}
}
```

---

## 🔨 MODERATOR - MEMBERSHIP MANAGEMENT

### GET /api/communities/:id/join-requests
**Auth:** MODERATOR or ADMIN
**Purpose:** Get pending join requests for review

**Response:**
```json
{
  "requests": [
    {
      "id": "cuid",
      "user": {
        "id": "cuid",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "emailVerified": true,
        "phoneVerified": false,
        "rescueLevel": "SENTRY",
        "accountAge": "3 months",
        "communityMemberships": [
          {
            "communityName": "Wilmette",
            "role": "MEMBER",
            "joinedAt": "..."
          }
        ],
        "squadsJoined": 5,
        "successfulReunions": 1,
        "honorsReceived": 2,
        "bans": []
      },
      "requestedAt": "..."
    }
  ]
}
```

---

### POST /api/communities/:id/join-requests/:membershipId/approve
**Auth:** MODERATOR or ADMIN
**Purpose:** Approve join request

**Process:**
1. Update CommunityMember status to APPROVED
2. Set approvedById to current user
3. Notify user via email

**Response:**
```json
{
  "success": true,
  "membership": {
    "id": "cuid",
    "status": "APPROVED",
    "approvedAt": "...",
    "approvedBy": {
      "id": "cuid",
      "name": "Moderator Jane"
    }
  }
}
```

---

### POST /api/communities/:id/join-requests/:membershipId/reject
**Auth:** MODERATOR or ADMIN
**Purpose:** Reject join request

**Request Body:**
```json
{
  "reason": "Account too new, please participate in other communities first"
}
```

**Response:**
```json
{
  "success": true,
  "membership": {
    "id": "cuid",
    "status": "REJECTED",
    "rejectionReason": "..."
  }
}
```

---

### POST /api/communities/:id/members/:userId/ban
**Auth:** MODERATOR or ADMIN
**Purpose:** Ban user from community

**Request Body:**
```json
{
  "reason": "Spam posting, violating community guidelines",
  "requestPlatformBan": false // If true, admin will review
}
```

**Process:**
1. Update CommunityMember: status = BANNED, bannedAt, bannedById, banReason
2. Remove from all active squads in community
3. Hide all posts (set isDeleted = true)
4. Send email notification with appeal process
5. If requestPlatformBan, notify admins

**Response:**
```json
{
  "success": true,
  "message": "User banned from Chicago Metropolitan Area"
}
```

---

### POST /api/communities/:id/members/:userId/remove
**Auth:** MODERATOR or ADMIN
**Purpose:** Remove member (not ban, just remove)

**Response:**
```json
{
  "success": true,
  "message": "User removed from community"
}
```

---

### POST /api/communities/:id/moderator-requests/:userId
**Auth:** MEMBER (requesting moderation status)
**Purpose:** Request to become moderator

**Process:**
1. Create notification for admins
2. Track request (can use CommunityMember notes field or separate table)

**Response:**
```json
{
  "success": true,
  "message": "Moderator request submitted to admins"
}
```

---

### POST /api/admin/communities/:id/grant-moderator/:userId
**Auth:** ADMIN
**Purpose:** Grant moderator status to user

**Process:**
1. Update CommunityMember role to MODERATOR
2. Notify user

**Response:**
```json
{
  "success": true,
  "membership": {
    "id": "cuid",
    "role": "MODERATOR"
  }
}
```

---

## 📰 COMMUNITY FEED ENDPOINTS

### GET /api/communities/:id/feed
**Auth:** MEMBER (of community) or PUBLIC (view only)
**Purpose:** Get community feed posts

**Query Params:**
- `page` / `limit`
- `includeSubcommunities` (boolean): Show subcommunity posts (default: true for metro)

**Response:**
```json
{
  "posts": [
    {
      "id": "cuid",
      "content": "Found a stray dog near Lincoln Park...",
      "author": {
        "id": "cuid",
        "name": "John Doe",
        "rescueLevel": "PATHFINDER"
      },
      "community": {
        "id": "cuid",
        "name": "Evanston" // For subcommunity posts in metro feed
      },
      "isPinned": false,
      "createdAt": "...",
      "canDelete": false // True if user is moderator/admin
    }
  ],
  "pagination": {...}
}
```

---

### POST /api/communities/:id/posts
**Auth:** MEMBER (approved)
**Purpose:** Create post in community feed

**Request Body:**
```json
{
  "content": "Looking for volunteers to help with search efforts..."
}
```

**Validation:**
- Must be approved member
- Check daily post limit (3 posts/day)
- Content length limits

**Process:**
1. Check CommunityMember.dailyPostCount and lastPostDate
2. If different day, reset counter
3. If same day and count >= 3, reject
4. Create post, increment counter

**Response:**
```json
{
  "success": true,
  "post": {
    "id": "cuid",
    "content": "...",
    "createdAt": "..."
  },
  "dailyPostsRemaining": 2
}
```

**Errors:**
- 429: Daily post limit exceeded (3/day)
- 403: Not an approved member

---

### DELETE /api/communities/:id/posts/:postId
**Auth:** MODERATOR or ADMIN or POST_AUTHOR
**Purpose:** Delete post

**Request Body (moderator/admin only):**
```json
{
  "reason": "Spam/inappropriate content"
}
```

**Process:**
1. Set isDeleted = true (soft delete)
2. Set deletedById, deletedAt, deleteReason
3. Notify author if deleted by moderator

**Response:**
```json
{
  "success": true,
  "message": "Post deleted"
}
```

---

### POST /api/communities/:id/posts/:postId/pin
**Auth:** MODERATOR or ADMIN
**Purpose:** Pin important post to top of feed

**Response:**
```json
{
  "success": true,
  "post": {
    "id": "cuid",
    "isPinned": true
  }
}
```

---

## 🚨 RECOVERY SQUAD ENDPOINTS

### POST /api/reports/:reportId/squads
**Auth:** AUTHENTICATED (report owner)
**Purpose:** Create recovery squad(s) when reporting lost pet

**Request Body:**
```json
{
  "communities": [
    {
      "communityId": "metro-cuid",
      "type": "metro"
    },
    {
      "communityId": "evanston-cuid",
      "type": "subsquad"
    },
    {
      "communityId": "wilmette-cuid",
      "type": "subsquad"
    }
  ]
}
```

**Validation:**
- Max 4 subcommunities
- All communities must be within 10-mile radius of lastSeenLatitude/Longitude

**Process:**
1. Create RecoverySquad for metro community
2. If subsquads requested, create Subsquad records
3. Auto-add owner as SquadMember (role: OWNER)
4. Auto-add all community moderators as members
5. Create join request for owner if not already member of communities
6. Notify community members of new squad

**Response:**
```json
{
  "success": true,
  "squads": [
    {
      "id": "cuid",
      "name": "Max Recovery Squad - Chicago Metropolitan Area",
      "communityId": "metro-cuid",
      "subsquads": [
        {
          "id": "cuid",
          "name": "Evanston Subsquad",
          "communityId": "evanston-cuid"
        }
      ],
      "memberCount": 1,
      "status": "ACTIVE"
    }
  ]
}
```

---

### GET /api/squads/:squadId
**Auth:** MEMBER (of community) or SQUAD_MEMBER
**Purpose:** Get squad details

**Response:**
```json
{
  "squad": {
    "id": "cuid",
    "name": "Max Recovery Squad - Chicago Metropolitan Area",
    "report": {
      "id": "cuid",
      "pet": {
        "name": "Max",
        "species": "DOG",
        "photos": ["..."]
      },
      "lastSeenAddress": "123 Main St, Chicago",
      "lastSeenAt": "..."
    },
    "community": {
      "id": "cuid",
      "name": "Chicago Metropolitan Area"
    },
    "status": "ACTIVE",
    "memberCount": 23,
    "searchAreasMarked": 15,
    "totalAcreageSearched": 47.5,
    "subsquads": [
      {
        "id": "cuid",
        "name": "Evanston Subsquad",
        "memberCount": 8
      }
    ],
    "members": [
      {
        "id": "cuid",
        "user": {
          "name": "Sarah Owner",
          "rescueLevel": "PET_OWNER"
        },
        "role": "OWNER",
        "joinedAt": "..."
      },
      {
        "id": "cuid",
        "user": {
          "name": "John Volunteer",
          "rescueLevel": "PATHFINDER"
        },
        "role": "LEADER",
        "subsquad": "Evanston Subsquad",
        "actionsCount": 45
      }
    ],
    "userMembership": {
      "isMember": true,
      "role": "MEMBER",
      "subsquadId": "cuid"
    },
    "createdAt": "..."
  }
}
```

---

### POST /api/squads/:squadId/join
**Auth:** MEMBER (of community)
**Purpose:** Join recovery squad

**Request Body:**
```json
{
  "subsquadId": "cuid" // Optional: specific subsquad to join
}
```

**Validation:**
- Must be approved member of community
- Can't already be in squad

**Process:**
1. Create SquadMember
2. Increment squad memberCount
3. Notify other squad members
4. Check if user levels up to SENTRY

**Response:**
```json
{
  "success": true,
  "membership": {
    "id": "cuid",
    "squadId": "cuid",
    "subsquadId": "cuid",
    "role": "MEMBER",
    "joinedAt": "..."
  },
  "levelUp": {
    "newLevel": "SENTRY",
    "message": "Congratulations! You've leveled up to Sentry!"
  }
}
```

---

### POST /api/squads/:squadId/leave
**Auth:** SQUAD_MEMBER
**Purpose:** Leave squad

**Response:**
```json
{
  "success": true,
  "message": "Left Max Recovery Squad"
}
```

---

### POST /api/squads/:squadId/close
**Auth:** OWNER or ADMIN
**Purpose:** Close squad (pet found or cease search)

**Request Body:**
```json
{
  "reason": "FOUND" | "CEASED",
  "honoredMembers": ["userId1", "userId2"], // Optional
  "honorNote": "Thank you for your amazing help!"
}
```

**Process:**
1. Update squad status to CLOSED
2. Set closedAt, closedReason
3. Create SquadHonor records for honoredMembers
4. Update all member stats (successfulReunions if FOUND)
5. Check for level-ups (PATHFINDER, PACK_GUARDIAN, PACK_LEGEND)
6. Mark squad chat as read-only

**Response:**
```json
{
  "success": true,
  "squad": {
    "id": "cuid",
    "status": "CLOSED",
    "closedAt": "...",
    "closedReason": "FOUND"
  },
  "levelUps": [
    {
      "userId": "user1",
      "newLevel": "PATHFINDER",
      "message": "..."
    }
  ]
}
```

---

### POST /api/squads/:squadId/designate-leader
**Auth:** OWNER
**Purpose:** Designate squad leader

**Request Body:**
```json
{
  "userId": "cuid"
}
```

**Process:**
1. Update SquadMember role to LEADER
2. Notify user

**Response:**
```json
{
  "success": true,
  "membership": {
    "id": "cuid",
    "role": "LEADER"
  }
}
```

---

## 💬 SQUAD CHAT/MESSAGING ENDPOINTS

### GET /api/squads/:squadId/messages
**Auth:** SQUAD_MEMBER
**Purpose:** Get squad chat messages

**Query Params:**
- `subsquadId` (optional): Filter to specific subsquad channel
- `type` (optional): CHAT | ANNOUNCEMENT | SYSTEM
- `after` (optional): Get messages after timestamp (for polling)
- `limit` (default: 50)

**Response:**
```json
{
  "messages": [
    {
      "id": "cuid",
      "author": {
        "id": "cuid",
        "name": "John Volunteer",
        "rescueLevel": "PATHFINDER"
      },
      "type": "CHAT",
      "content": "I'll search the north side this afternoon",
      "subsquad": "Evanston Subsquad", // Null if main squad
      "photoUrls": [],
      "location": null,
      "createdAt": "..."
    },
    {
      "id": "cuid",
      "author": {
        "name": "Sarah Owner",
        "rescueLevel": "PET_OWNER"
      },
      "type": "ANNOUNCEMENT",
      "content": "UPDATE: Max was spotted near Lincoln Park!",
      "subsquad": null, // Central Hub
      "createdAt": "..."
    }
  ]
}
```

---

### POST /api/squads/:squadId/messages
**Auth:** SQUAD_MEMBER
**Purpose:** Send message in squad chat

**Request Body:**
```json
{
  "subsquadId": "cuid", // Null for Central Hub (leaders only)
  "type": "CHAT" | "ANNOUNCEMENT",
  "content": "Message text",
  "photoUrls": ["url1", "url2"], // Optional
  "location": { // Optional
    "lat": 41.8781,
    "lng": -87.6298,
    "address": "123 Main St"
  }
}
```

**Validation:**
- ANNOUNCEMENT type requires OWNER or LEADER role
- Central Hub (subsquadId = null) requires OWNER or LEADER role

**Process:**
1. Create SquadMessage
2. Increment SquadMember.messagesSent
3. Increment SquadMember.actionsCount
4. Send opt-out notifications to all squad members
5. Check for Shepherd level-up (if squad leader)

**Response:**
```json
{
  "success": true,
  "message": {
    "id": "cuid",
    "content": "...",
    "createdAt": "..."
  }
}
```

---

## 🗺️ SEARCH AREA MARKING ENDPOINTS

### POST /api/squads/:squadId/search-areas
**Auth:** SQUAD_MEMBER
**Purpose:** Mark area as searched

**Request Body:**
```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lng, lat], [lng, lat], ...]]
  },
  "acreage": 2.5, // Calculated on frontend
  "startAddress": "123 Main St, Chicago",
  "notes": "Checked all yards and alleys, called pet's name",
  "potentialSpotting": false
}
```

**Validation:**
- If acreage > 5: return warning (frontend confirms)
- Geometry must be valid GeoJSON

**Process:**
1. Create SearchArea
2. Increment SquadMember.areasMarked
3. Increment User.areasMarkedCount and totalAcreageSearched
4. Update RecoverySquad.searchAreasMarked and totalAcreageSearched
5. If potentialSpotting = true, alert all squad members
6. Check for Shepherd level-up (5+ areas, 15+ acres)

**Response:**
```json
{
  "success": true,
  "searchArea": {
    "id": "cuid",
    "acreage": 2.5,
    "markedAt": "..."
  },
  "levelUp": {
    "newLevel": "SHEPHERD",
    "message": "You've proven yourself as a dedicated searcher!"
  }
}
```

---

### GET /api/squads/:squadId/search-areas
**Auth:** SQUAD_MEMBER
**Purpose:** Get all marked search areas for map

**Response:**
```json
{
  "searchAreas": [
    {
      "id": "cuid",
      "geometry": {...},
      "acreage": 2.5,
      "markedBy": {
        "name": "John Volunteer",
        "rescueLevel": "SHEPHERD"
      },
      "markedAt": "...",
      "notes": "Checked all yards...",
      "potentialSpotting": false,
      "subsquad": "Evanston Subsquad" // Color-coded on map
    }
  ]
}
```

---

## 👀 PET SPOTTING ENDPOINTS

### POST /api/squads/:squadId/pet-spottings
**Auth:** SQUAD_MEMBER
**Purpose:** Report pet sighting

**Request Body:**
```json
{
  "latitude": 41.8781,
  "longitude": -87.6298,
  "address": "Near Lincoln Park, Chicago",
  "spottedAt": "2025-11-16T14:30:00Z",
  "confidenceLevel": 8,
  "photoUrls": ["url1", "url2"],
  "notes": "Saw a dog matching description near the fountain"
}
```

**Process:**
1. Create PetSpotting
2. **ALERT ALL SQUAD MEMBERS + OWNER** (high priority notification)
3. Create system message in Central Hub
4. Pin location on squad map

**Response:**
```json
{
  "success": true,
  "spotting": {
    "id": "cuid",
    "latitude": 41.8781,
    "longitude": -87.6298,
    "confidenceLevel": 8,
    "reportedAt": "..."
  },
  "message": "Alert sent to all squad members and owner"
}
```

---

### GET /api/squads/:squadId/pet-spottings
**Auth:** SQUAD_MEMBER
**Purpose:** Get all reported sightings

**Response:**
```json
{
  "spottings": [
    {
      "id": "cuid",
      "latitude": 41.8781,
      "longitude": -87.6298,
      "address": "Near Lincoln Park",
      "spottedAt": "2025-11-16T14:30:00Z",
      "confidenceLevel": 8,
      "photoUrls": ["..."],
      "notes": "...",
      "reportedBy": {
        "name": "Jane Spotter",
        "rescueLevel": "SENTRY"
      },
      "reportedAt": "..."
    }
  ]
}
```

---

## 📊 USER STATS & PROFILE ENDPOINTS

### GET /api/users/:userId/profile
**Auth:** AUTHENTICATED
**Purpose:** Get user profile with rescue stats

**Response:**
```json
{
  "user": {
    "id": "cuid",
    "name": "John Volunteer",
    "rescueLevel": "PATHFINDER",
    "rescueLevelInfo": {
      "level": 4,
      "name": "Pathfinder",
      "description": "The seasoned expert. Uses proven experience to lead complex searches.",
      "badge": "🧭"
    },
    "stats": {
      "communitiesJoined": 3,
      "squadsJoined": 12,
      "areasMarked": 28,
      "totalAcreageSearched": 73.5,
      "successfulReunions": 4,
      "honorsReceived": 7
    },
    "communities": [
      {
        "id": "cuid",
        "name": "Chicago Metropolitan Area",
        "role": "MEMBER",
        "joinedAt": "..."
      }
    ],
    "recentActivity": [
      {
        "type": "SQUAD_JOINED",
        "squad": "Max Recovery Squad",
        "timestamp": "..."
      },
      {
        "type": "AREA_MARKED",
        "squad": "Bella Recovery Squad",
        "acreage": 3.2,
        "timestamp": "..."
      }
    ]
  }
}
```

---

### GET /api/users/me/level-progress
**Auth:** AUTHENTICATED
**Purpose:** Get progress toward next rescue level

**Response:**
```json
{
  "currentLevel": "SENTRY",
  "nextLevel": "SHEPHERD",
  "progress": {
    "areasMarked": {
      "current": 3,
      "required": 5
    },
    "totalAcreageSearched": {
      "current": 8.5,
      "required": 15.0
    }
  },
  "percentComplete": 60
}
```

---

## 🔔 NOTIFICATION SETTINGS ENDPOINTS

### GET /api/communities/:id/notification-settings
**Auth:** MEMBER
**Purpose:** Get user's notification preferences for community

**Response:**
```json
{
  "settings": {
    "newAlerts": true,
    "announcements": true,
    "newSightings": false,
    "comments": false,
    "newSquads": true
  }
}
```

---

### PUT /api/communities/:id/notification-settings
**Auth:** MEMBER
**Purpose:** Update notification preferences

**Request Body:**
```json
{
  "newAlerts": true,
  "announcements": false,
  "newSightings": true,
  "comments": false,
  "newSquads": true
}
```

**Process:**
1. Update CommunityMember.notificationSettings (JSON)

**Response:**
```json
{
  "success": true,
  "settings": {...}
}
```

---

## 🔍 SEARCH & DISCOVERY ENDPOINTS

### GET /api/communities/search
**Auth:** AUTHENTICATED
**Purpose:** Search communities by location or name

**Query Params:**
- `q`: Search query (name or city)
- `lat` / `lng`: Search by coordinates
- `radius`: Miles radius (default: 10)

**Response:**
```json
{
  "results": [
    {
      "id": "cuid",
      "name": "Chicago Metropolitan Area",
      "type": "METRO_AREA",
      "distance": 2.3, // Miles from search location
      "memberCount": 1247,
      "activeSquads": 15
    }
  ]
}
```

---

### GET /api/squads/nearby
**Auth:** AUTHENTICATED
**Purpose:** Find active squads near user's location

**Query Params:**
- `lat` / `lng` (optional): Use user's patrol location if not provided
- `radius` (default: 10 miles)

**Response:**
```json
{
  "squads": [
    {
      "id": "cuid",
      "name": "Max Recovery Squad - Chicago Metro",
      "report": {
        "pet": {
          "name": "Max",
          "species": "DOG",
          "photos": ["..."]
        },
        "lastSeenAddress": "...",
        "lastSeenAt": "..."
      },
      "community": {
        "name": "Chicago Metropolitan Area"
      },
      "distance": 3.2,
      "memberCount": 23,
      "canJoin": true
    }
  ]
}
```

---

## 📧 EMAIL VERIFICATION ENDPOINT

### POST /api/auth/verify-email
**Auth:** AUTHENTICATED
**Purpose:** Send email verification link

**Process:**
1. Generate verification token
2. Send email with link to /api/auth/verify-email/confirm?token=...

**Response:**
```json
{
  "success": true,
  "message": "Verification email sent to user@example.com"
}
```

---

### GET /api/auth/verify-email/confirm
**Auth:** None (uses token)
**Purpose:** Confirm email verification

**Query Params:**
- `token`: Verification token from email

**Process:**
1. Validate token
2. Update User.emailVerified to current timestamp
3. Redirect to dashboard with success message

---

## 🎯 UTILITY ENDPOINTS

### GET /api/communities/:id/overlap-check
**Auth:** ADMIN
**Purpose:** Check if proposed community overlaps with existing

**Query Params:**
- `geographicScope`: City or zip code
- `type`: METRO_AREA | COUNTY | SUBCOMMUNITY

**Response:**
```json
{
  "hasOverlap": true,
  "overlappingCommunities": [
    {
      "id": "cuid",
      "name": "Chicago Metropolitan Area",
      "type": "METRO_AREA",
      "overlapType": "exact" | "partial" | "contains"
    }
  ]
}
```

---

### GET /api/squads/:squadId/stats
**Auth:** SQUAD_MEMBER
**Purpose:** Get detailed squad statistics

**Response:**
```json
{
  "stats": {
    "memberCount": 23,
    "searchAreasMarked": 47,
    "totalAcreageSearched": 128.5,
    "messagesSent": 342,
    "petSpottings": 8,
    "averageConfidenceLevel": 6.5,
    "durationDays": 4,
    "topContributors": [
      {
        "userId": "cuid",
        "name": "John Volunteer",
        "areasMarked": 12,
        "messagesSent": 87,
        "actionsCount": 125
      }
    ]
  }
}
```

---

## Summary

**Total Endpoints:** 50+

**Breakdown by Category:**
- Community Requests: 4 endpoints
- Admin Approval: 3 endpoints
- Community Management: 6 endpoints
- Membership: 8 endpoints
- Moderation: 7 endpoints
- Feed/Posts: 4 endpoints
- Recovery Squads: 8 endpoints
- Squad Chat: 2 endpoints
- Search Areas: 2 endpoints
- Pet Spottings: 2 endpoints
- User Profile/Stats: 2 endpoints
- Notifications: 2 endpoints
- Search/Discovery: 2 endpoints
- Utilities: 3 endpoints

All endpoints follow RESTful conventions and return consistent error formats. Authentication via NextAuth session cookies. Authorization enforced based on user roles and community membership status.
