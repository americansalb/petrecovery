# Community System UI Structure

## Pages, Components, and User Flows

This document outlines all pages, components, and user interface elements needed for the community system.

---

## 📄 NEW PAGES

### 1. `/communities` - Community Directory
**Purpose:** Browse and discover all communities

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Navigation Bar                                  │
├─────────────────────────────────────────────────┤
│ Communities                                     │
│                                                 │
│ [Search: "Search by name or location..."]  🔍  │
│ [Filter: All Types ▾]  [Sort: Name ▾]          │
│                                                 │
│ Suggested for You (based on patrol location)   │
│ ┌──────────────────────────────────────────┐   │
│ │ Chicago Metropolitan Area      [Join]    │   │
│ │ 🌆 Metro Area • 1,247 members • 15 squads│   │
│ │ ├─ Evanston                    [Join]    │   │
│ │ ├─ Oak Park                    [Join]    │   │
│ │ └─ Wilmette                  [Joined ✓]  │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
│ All Communities                                 │
│ [Grid or List View Toggle]                     │
│                                                 │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│ │ Chicago │ │ Dallas  │ │ Seattle │           │
│ │ Metro   │ │ Metro   │ │ Metro   │           │
│ │ 1.2K 👥 │ │ 850 👥  │ │ 620 👥  │           │
│ │ 15 🚨   │ │ 8 🚨    │ │ 5 🚨    │           │
│ │ [View]  │ │ [View]  │ │ [View]  │           │
│ └─────────┘ └─────────┘ └─────────┘           │
│                                                 │
│ [Don't see your community? Request One →]      │
└─────────────────────────────────────────────────┘
```

**Components:**
- `CommunityCard` - Card display for each community
- `CommunitySearchBar` - Search input with autocomplete
- `CommunityFilters` - Type/location filters
- `SuggestedCommunities` - Personalized recommendations
- `HierarchyDisplay` - Shows parent/child community structure

**Data Fetched:**
- GET /api/communities
- GET /api/communities/suggested

---

### 2. `/communities/request` - Request Community Creation
**Purpose:** Submit community creation request

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Navigation Bar                                  │
├─────────────────────────────────────────────────┤
│ Request Community Creation                      │
│                                                 │
│ Help us expand PetRecovery to your area!       │
│                                                 │
│ Community Type                                  │
│ ○ Metropolitan Area / County                   │
│ ○ Subcommunity (within existing metro/county)  │
│                                                 │
│ [If subcommunity selected:]                    │
│ Parent Community: [Select... ▾]                │
│                                                 │
│ Geographic Scope *                              │
│ [Enter city name or zip code]                  │
│ 💡 For zip codes, we'll check a 10-mile radius │
│                                                 │
│ Additional Notes (Optional)                     │
│ ┌─────────────────────────────────────────┐   │
│ │ Tell us why this community is needed... │   │
│ │                                         │   │
│ │                                         │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ ⚠️ Requirements:                                │
│ ✓ Email verified                               │
│ ✗ Phone verified (optional but recommended)    │
│ ✓ Within rate limit (3/10 requests this month) │
│                                                 │
│ [Cancel]              [Submit Request]          │
└─────────────────────────────────────────────────┘
```

**Components:**
- `CommunityRequestForm` - Main form component
- `GeographicScopeInput` - City/zip input with validation
- `ParentCommunitySelector` - Dropdown for subcommunity requests
- `RateLimitIndicator` - Shows remaining requests
- `VerificationStatus` - Email/phone verification badges

**Data Fetched:**
- GET /api/communities (for parent selection)
- POST /api/communities/request

**Validation:**
- Email/phone verification check
- Rate limit check (10 requests/30 days)
- Geographic scope format validation
- Overlap detection

---

### 3. `/communities/my-requests` - User's Community Requests
**Purpose:** View status of submitted requests

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Navigation Bar                                  │
├─────────────────────────────────────────────────┤
│ My Community Requests                           │
│                                                 │
│ [Filter: All ▾] [Sort: Newest ▾]               │
│                                                 │
│ ┌──────────────────────────────────────────┐   │
│ │ 🟡 PENDING                               │   │
│ │ Chicago Southside Community              │   │
│ │ Subcommunity • Requested Nov 16, 2025    │   │
│ │ "Large neighborhood with many pet owners"│   │
│ │ → Awaiting admin review                  │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
│ ┌──────────────────────────────────────────┐   │
│ │ ✅ APPROVED                              │   │
│ │ Evanston                                 │   │
│ │ Subcommunity • Approved Nov 10, 2025     │   │
│ │ → View Community                         │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
│ ┌──────────────────────────────────────────┐   │
│ │ ❌ REJECTED                              │   │
│ │ North Chicago Area                       │   │
│ │ Metro Area • Rejected Nov 8, 2025        │   │
│ │ 📝 "Overlaps with existing Chicago Metro"│   │
│ │ → Resubmit as subcommunity              │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
│ [+ Request New Community]                       │
└─────────────────────────────────────────────────┘
```

**Components:**
- `RequestCard` - Display request with status
- `RequestStatusBadge` - Color-coded status indicator
- `RejectionReason` - Shows admin feedback

**Data Fetched:**
- GET /api/communities/requests

---

### 4. `/communities/:id` - Community Page
**Purpose:** Main community hub - feed, squads, members

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Navigation Bar                                  │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐    │
│ │ 🌆 Chicago Metropolitan Area           │    │
│ │ Metro Area • 1,247 members • 15 squads  │    │
│ │ [Join Community] [Share] [⚙️ Settings]  │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ [Active Squads] [Feed] [Members] [About]       │
│ ─────────────────────────────────────────       │
│                                                 │
│ 🚨 Active Recovery Squads (15)                  │
│ ┌──────────────────────────────────────────┐   │
│ │ Max Recovery Squad - Chicago Metro       │   │
│ │ 🐕 Golden Retriever • Lost 2 days ago    │   │
│ │ 23 volunteers • 47 acres searched        │   │
│ │ [Join Squad →]                           │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
│ ┌──────────────────────────────────────────┐   │
│ │ Bella Recovery Squad - Evanston          │   │
│ │ 🐈 Tabby Cat • Lost 1 day ago            │   │
│ │ 8 volunteers • 12 acres searched         │   │
│ │ [Join Squad →]                           │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
│ Community Feed                                  │
│ ┌──────────────────────────────────────────┐   │
│ │ 📌 PINNED                                │   │
│ │ Jane Moderator • 🛡️ Pack Guardian       │   │
│ │ "Welcome new members! Please read..."    │   │
│ │ 2 hours ago                              │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
│ ┌──────────────────────────────────────────┐   │
│ │ John Volunteer • 🧭 Pathfinder           │   │
│ │ "Found a lost collar near Lincoln Park"  │   │
│ │ 📷 [Photo]                               │   │
│ │ 💬 5 comments • ⏰ 3 hours ago           │   │
│ │ [Comment] [Share]                        │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
│ ┌──────────────────────────────────────────┐   │
│ │ Sarah Owner • 🐾 Pet Owner [Evanston]    │   │
│ │ "Thanks everyone for the support!"       │   │
│ │ ❤️ 12 reactions • ⏰ 5 hours ago          │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
│ [Create Post] (2/3 posts today)                 │
└─────────────────────────────────────────────────┘
```

**Tabs:**

**Active Squads Tab:**
- List of all active recovery squads
- Filterable by subcommunity
- Shows pet info, member count, search progress

**Feed Tab:**
- Community posts
- Pinned posts at top
- Subcommunity posts labeled
- Create post button (with rate limit)

**Members Tab:**
- List of community members
- Searchable
- Shows rescue level, role
- Moderators highlighted

**About Tab:**
- Community description
- Geographic coverage (map)
- Moderators list
- Statistics (total members, successful rescues, etc.)
- Subcommunities list

**Components:**
- `CommunityHeader` - Hero section with stats
- `SquadList` - Active recovery squads
- `CommunityFeed` - Feed posts
- `PostCard` - Individual post display
- `CreatePostForm` - Post creation with rate limit
- `MemberList` - Community members
- `CommunityMap` - Geographic coverage visualization
- `SubcommunityList` - Child communities

**Data Fetched:**
- GET /api/communities/:id
- GET /api/communities/:id/feed
- GET /api/squads (filtered by community)
- GET /api/communities/:id/members

**Actions:**
- Join/leave community
- Create post (rate limited)
- Comment on posts
- Join recovery squads
- Report issues

---

### 5. `/communities/:id/settings` - Community Settings
**Auth:** MEMBER
**Purpose:** User preferences for community

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Navigation Bar                                  │
├─────────────────────────────────────────────────┤
│ Chicago Metropolitan Area › Settings            │
│                                                 │
│ Notification Preferences                        │
│ ┌─────────────────────────────────────────┐   │
│ │ ☑ New pet alerts in community           │   │
│ │ ☑ Community announcements               │   │
│ │ ☐ New sightings reported                │   │
│ │ ☐ Comments on posts                     │   │
│ │ ☑ New recovery squads forming           │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ Membership                                      │
│ Status: ✅ Approved Member                      │
│ Joined: November 10, 2025                       │
│ Role: Member                                    │
│                                                 │
│ [Request Moderator Status]                      │
│ [Leave Community]                               │
│                                                 │
│ [Save Settings]                                 │
└─────────────────────────────────────────────────┘
```

**Components:**
- `NotificationToggles` - Granular notification settings
- `MembershipCard` - User's status in community
- `LeaveConfirmModal` - Confirmation dialog

**Data Fetched:**
- GET /api/communities/:id/notification-settings
- PUT /api/communities/:id/notification-settings

---

### 6. `/admin/communities` - Admin Approval Queue
**Auth:** ADMIN only
**Purpose:** Review and approve community requests

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Admin Dashboard                                 │
├─────────────────────────────────────────────────┤
│ Community Approval Queue                        │
│                                                 │
│ [Pending (12)] [Approved] [Rejected]            │
│ ─────────────                                   │
│                                                 │
│ ┌──────────────────────────────────────────┐   │
│ │ 📍 Chicago Southside Community           │   │
│ │ Type: Subcommunity                       │   │
│ │ Parent: Chicago Metropolitan Area        │   │
│ │ Scope: South Chicago neighborhoods       │   │
│ │                                          │   │
│ │ Requested by: Sarah Johnson              │   │
│ │ 🔍 Scout • Account age: 3 months         │   │
│ │ ✅ Email verified • ✗ Phone not verified│   │
│ │ Member of: 2 communities                 │   │
│ │                                          │   │
│ │ Notes: "Large neighborhood with many pet │   │
│ │ owners, would benefit from localized..." │   │
│ │                                          │   │
│ │ ⚠️ Overlap Check:                        │   │
│ │ No overlaps detected ✓                   │   │
│ │                                          │   │
│ │ [View Full Details]                      │   │
│ │ [Approve] [Reject]                       │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
│ [Next →]                                        │
└─────────────────────────────────────────────────┘
```

**Components:**
- `AdminRequestCard` - Detailed request view
- `RequesterProfile` - User information for review
- `OverlapChecker` - Shows potential conflicts
- `ApprovalForm` - Input community details
- `RejectionForm` - Input rejection reason

**Data Fetched:**
- GET /api/admin/communities/requests

**Actions:**
- POST /api/admin/communities/requests/:id/approve
- POST /api/admin/communities/requests/:id/reject

---

### 7. `/communities/:id/moderate` - Moderator Dashboard
**Auth:** MODERATOR or ADMIN
**Purpose:** Moderate community (approve members, manage posts)

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Moderator Dashboard - Chicago Metro             │
├─────────────────────────────────────────────────┤
│ [Join Requests (5)] [Reported Posts] [Members]  │
│ ──────────────────                              │
│                                                 │
│ Pending Join Requests (5)                       │
│ ┌──────────────────────────────────────────┐   │
│ │ Jane Smith                               │   │
│ │ 👁️ Sentry • Account age: 2 months        │   │
│ │ ✅ Email verified • ✅ Phone verified    │   │
│ │                                          │   │
│ │ Member of: Wilmette (Member)             │   │
│ │ Squads joined: 5                         │   │
│ │ Successful reunions: 1                   │   │
│ │ Honors received: 2                       │   │
│ │                                          │   │
│ │ ✅ No bans or warnings                   │   │
│ │                                          │   │
│ │ [View Profile] [Approve] [Reject]        │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
│ Recent Actions                                  │
│ • Approved John Doe (2 hours ago)              │
│ • Deleted spam post (5 hours ago)              │
│ • Pinned announcement (1 day ago)               │
└─────────────────────────────────────────────────┘
```

**Components:**
- `JoinRequestCard` - Detailed member review
- `MemberHistoryView` - User's rescue history
- `ModActionLog` - Recent moderator actions
- `ReportedContent` - Flagged posts/users

**Data Fetched:**
- GET /api/communities/:id/join-requests
- GET /api/communities/:id/members

**Actions:**
- POST /api/communities/:id/join-requests/:id/approve
- POST /api/communities/:id/join-requests/:id/reject
- POST /api/communities/:id/members/:userId/ban
- DELETE /api/communities/:id/posts/:postId

---

### 8. `/squads/:id` - Recovery Squad Page
**Auth:** SQUAD_MEMBER or COMMUNITY_MEMBER (view-only)
**Purpose:** Squad coordination hub

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Navigation Bar                                  │
├─────────────────────────────────────────────────┤
│ Max Recovery Squad - Chicago Metropolitan Area  │
│ 🐕 Golden Retriever • Lost 2 days ago          │
│ ─────────────────────────────────────────────   │
│                                                 │
│ ┌───────────────────┬───────────────────────┐  │
│ │   Pet Info        │   Squad Stats         │  │
│ │ ┌─────────┐       │ 👥 23 volunteers      │  │
│ │ │ [Photo] │       │ 🔍 47 areas searched  │  │
│ │ └─────────┘       │ 📏 128 acres covered  │  │
│ │ Name: Max         │ 👀 8 sightings        │  │
│ │ Breed: Golden     │ ⏱️ Active for 2 days  │  │
│ │ Last seen:        │                       │  │
│ │ Lincoln Park      │ [Join Squad]          │  │
│ │ Nov 14, 2pm       │                       │  │
│ └───────────────────┴───────────────────────┘  │
│                                                 │
│ [Central Hub] [Evanston] [Wilmette] [Map]       │
│ ─────────────                                   │
│                                                 │
│ 📢 Central Hub (Announcements)                  │
│ ┌──────────────────────────────────────────┐   │
│ │ Sarah Owner • 🐾 Pet Owner               │   │
│ │ "UPDATE: Max spotted near the fountain!" │   │
│ │ 📍 Location shared • 10 mins ago         │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
│ Subsquad Channels                               │
│ ┌──────────────────────────────────────────┐   │
│ │ 🗨️ Evanston Subsquad (8 members)         │   │
│ │ John: "I'll search north side this PM"   │   │
│ │ Jane: "Great, I'll cover south"          │   │
│ │ [View Chat →]                            │   │
│ └──────────────────────────────────────────┘   │
│                                                 │
│ Quick Actions                                   │
│ [📍 Report Pet Spotted] [✅ Mark Area Searched] │
│                                                 │
│ Squad Members (23)                              │
│ Owner: Sarah Owner 🐾                           │
│ Leaders: John Leader 🧭, Jane Leader 🛡️         │
│ Members: [Show all →]                           │
└─────────────────────────────────────────────────┘
```

**Tabs:**

**Central Hub Tab:**
- Announcements from owner/leaders
- Read-only for regular members

**Subsquad Tabs (Evanston, Wilmette, etc):**
- Real-time chat
- Photo sharing
- Location sharing
- Member list for that subsquad

**Map Tab:**
- Search areas marked (red polygons)
- Pet spottings (pins with confidence levels)
- Last seen location
- Member locations (optional, privacy-aware)

**Components:**
- `SquadHeader` - Pet info + stats
- `CentralHubFeed` - Announcement feed
- `SubsquadChat` - Chat interface for subsquad
- `SearchMap` - Leaflet map with polygons
- `MarkSearchedButton` - Opens modal
- `ReportSpottingButton` - Opens modal
- `SquadMemberList` - All volunteers with stats

**Data Fetched:**
- GET /api/squads/:id
- GET /api/squads/:id/messages
- GET /api/squads/:id/search-areas
- GET /api/squads/:id/pet-spottings

**Actions:**
- POST /api/squads/:id/join
- POST /api/squads/:id/messages
- POST /api/squads/:id/search-areas
- POST /api/squads/:id/pet-spottings
- POST /api/squads/:id/close (owner only)

---

### 9. `/profile/:userId` - Enhanced User Profile
**Auth:** AUTHENTICATED
**Purpose:** View user's rescue stats and achievements

**Layout:**
```
┌─────────────────────────────────────────────────┐
│ Navigation Bar                                  │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐    │
│ │ 🧭 John Volunteer                       │    │
│ │ Pathfinder - The Seasoned Expert        │    │
│ │ Member since: January 2025              │    │
│ └─────────────────────────────────────────┘    │
│                                                 │
│ Rescue Stats                                    │
│ ┌───────────┬───────────┬───────────────┐      │
│ │ 🏘️ 3      │ 🚨 12     │ ⭐ 7          │      │
│ │ Communities│ Squads    │ Honors        │      │
│ │           │  Joined   │  Received     │      │
│ └───────────┴───────────┴───────────────┘      │
│                                                 │
│ ┌───────────┬───────────┬───────────────┐      │
│ │ 🔍 28     │ 📏 73.5   │ 🐾 4          │      │
│ │ Areas     │  Acres    │ Successful    │      │
│ │  Marked   │ Searched  │  Reunions     │      │
│ └───────────┴───────────┴───────────────┘      │
│                                                 │
│ Level Progress                                  │
│ ┌─────────────────────────────────────────┐   │
│ │ Current: 🧭 Pathfinder (Level 4)        │   │
│ │ Next: 🛡️ Pack Guardian (Level 5)        │   │
│ │                                         │   │
│ │ Progress to Pack Guardian:              │   │
│ │ Successful reunions: 4/5                │   │
│ │ ████████████████████░░░░ 80%            │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ Communities                                     │
│ • Chicago Metropolitan Area (Member)            │
│ • Evanston (Member)                             │
│ • Wilmette (Moderator)                          │
│                                                 │
│ Recent Activity                                 │
│ • Joined "Bella Recovery Squad" (2 hours ago)  │
│ • Marked search area in Evanston (5 hours ago)  │
│ • Honored by pet owner (2 days ago)             │
│ • Leveled up to Pathfinder! (1 week ago)        │
└─────────────────────────────────────────────────┘
```

**Components:**
- `ProfileHeader` - User info with rescue level badge
- `StatsGrid` - Key metrics display
- `LevelProgressBar` - Progress to next level
- `CommunityMemberships` - List of communities
- `ActivityTimeline` - Recent rescue activity
- `HonorsList` - Honors received from owners

**Data Fetched:**
- GET /api/users/:userId/profile
- GET /api/users/me/level-progress

---

## 🧩 REUSABLE COMPONENTS

### Core Components

#### `RescueLevelBadge`
**Props:** level (RescueLevel enum)
**Displays:** Icon + level name
**Variants:**
- PET_OWNER: 🐾 "Pet Owner"
- SCOUT: 🔍 "Scout"
- SENTRY: 👁️ "Sentry"
- SHEPHERD: 🦮 "Shepherd"
- PATHFINDER: 🧭 "Pathfinder"
- PACK_GUARDIAN: 🛡️ "Pack Guardian"
- PACK_LEGEND: ⭐ "Pack Legend"

---

#### `LevelUpNotification`
**Purpose:** Animated modal when user levels up
**Features:**
- Confetti animation
- Level badge display
- Congratulatory message
- Cat/puppy image
- Share achievement button

**Design:**
```
┌─────────────────────────────────┐
│         ✨ 🎉 ✨               │
│                                 │
│    Congratulations!             │
│                                 │
│       🧭 PATHFINDER             │
│                                 │
│  You've proven yourself as a    │
│  seasoned expert in pet rescue! │
│                                 │
│  [😺 Cat Image]                 │
│                                 │
│  [Share Achievement] [Continue] │
└─────────────────────────────────┘
```

---

#### `CommunityCard`
**Props:** community (Community object), userMembership
**Displays:**
- Community name, type icon
- Member count, active squads
- Subcommunity count
- Join button (status-aware)

**States:**
- Not member: [Join]
- Pending: [Pending...]
- Member: [Joined ✓]
- Banned: [Banned]

---

#### `SquadCard`
**Props:** squad (RecoverySquad object), canJoin
**Displays:**
- Pet photo, name, species
- Squad name
- Time since lost
- Member count, search stats
- [Join Squad] button

**Hover:** Shows more details (last seen location, reward info)

---

#### `CreatePostForm`
**Props:** communityId, dailyLimit
**Features:**
- Text input (with character limit)
- Rate limit indicator: "X/3 posts today"
- Submit button (disabled if limit reached)
- Validation feedback

---

#### `MarkSearchedModal`
**Purpose:** Draw polygon on map to mark searched area

**Features:**
- Leaflet map with drawing tools
- Freeform polygon drawing
- Acreage calculation (auto)
- Warning if > 5 acres
- Starting address input
- Notes textarea
- "Potential pet spotted" checkbox
- Submit button

**Layout:**
```
┌─────────────────────────────────────┐
│ Mark Area as Searched               │
├─────────────────────────────────────┤
│ 1. Where did you start?             │
│ [Enter address or tap on map]       │
│                                     │
│ 2. Draw the area you searched       │
│ ┌─────────────────────────────┐    │
│ │  [Interactive Map]          │    │
│ │  🖊️ Draw polygon            │    │
│ │                             │    │
│ │  Calculated: 2.5 acres      │    │
│ └─────────────────────────────┘    │
│                                     │
│ 3. Search notes                     │
│ ┌─────────────────────────────┐    │
│ │ What did you look for?      │    │
│ └─────────────────────────────┘    │
│                                     │
│ ☐ Potential pet spotted (alerts!)  │
│                                     │
│ [Cancel]              [Submit]      │
└─────────────────────────────────────┘
```

---

#### `ReportSpottingModal`
**Purpose:** Report pet sighting

**Features:**
- Map with pin drop
- Date/time picker (defaults to now)
- Confidence slider (1-10)
- Photo upload
- Notes textarea
- [Submit] triggers alert to all squad members

**Layout:**
```
┌─────────────────────────────────────┐
│ Report Pet Spotted                  │
├─────────────────────────────────────┤
│ Where? *                            │
│ ┌─────────────────────────────┐    │
│ │  [Map with draggable pin]   │    │
│ │  📍 Tap to set location     │    │
│ └─────────────────────────────┘    │
│ [123 Main St, Chicago, IL]          │
│                                     │
│ When? *                             │
│ [Nov 16, 2025] [2:30 PM]           │
│                                     │
│ How confident? (1-10) *             │
│ ├────────●──┤ 8 - Very confident   │
│                                     │
│ Photos (optional)                   │
│ [Upload] [📷 Photo1.jpg]            │
│                                     │
│ Additional notes                    │
│ ┌─────────────────────────────┐    │
│ │ Saw near the fountain...    │    │
│ └─────────────────────────────┘    │
│                                     │
│ ⚠️ This will alert all squad members│
│                                     │
│ [Cancel]              [Report]      │
└─────────────────────────────────────┘
```

---

#### `SearchAreaMap`
**Purpose:** Display all marked search areas

**Features:**
- Leaflet map
- Red polygons for searched areas
- Click polygon → show details:
  - Searcher name + level
  - Date/time
  - Acreage
  - Notes
- Pins for pet spottings (color by confidence)
- Legend (subsquad colors if applicable)
- Toggle layers (areas, spottings, last seen)

---

#### `SubsquadChat`
**Purpose:** Real-time/async chat interface

**Features:**
- Message list (scrollable, auto-scroll to bottom)
- Message input box
- Photo upload button
- Location share button
- Typing indicators (optional)
- Message timestamps
- Author names + rescue level badges

**Layout:**
```
┌─────────────────────────────────────┐
│ Evanston Subsquad (8 members)      │
├─────────────────────────────────────┤
│ ┌─────────────────────────────┐    │
│ │ John 🧭 • 2:30 PM           │    │
│ │ I'll search north side this │    │
│ │ afternoon around 4pm        │    │
│ └─────────────────────────────┘    │
│                                     │
│ ┌─────────────────────────────┐    │
│ │          Jane 🛡️ • 2:32 PM  │    │
│ │        Great, I'll cover    │    │
│ │         the south areas     │    │
│ └─────────────────────────────┘    │
│                                     │
│ ┌─────────────────────────────┐    │
│ │ John 🧭 • 2:33 PM           │    │
│ │ 📍 Shared location          │    │
│ │ [Map thumbnail]             │    │
│ └─────────────────────────────┘    │
│                                     │
│ [Type a message...]  [📷] [📍]     │
└─────────────────────────────────────┘
```

---

#### `JoinRequestReview`
**Purpose:** Moderator review interface for join requests

**Features:**
- User profile summary
- Verification status badges
- Community memberships list
- Rescue stats
- Ban history check
- [Approve] [Reject with reason]

---

#### `BanUserModal`
**Purpose:** Moderator ban user from community

**Features:**
- Reason textarea (required)
- Checkbox: "Request platform-wide ban from admin"
- Warning message about consequences
- [Cancel] [Confirm Ban]

---

#### `HonorMembersModal`
**Purpose:** Owner selects members to honor when closing squad

**Features:**
- List of squad members with checkboxes
- Search/filter by name
- Shows each member's contributions:
  - Messages sent
  - Areas marked
  - Actions count
- Optional note for each honored member
- [Skip] [Honor Selected Members]

---

## 🔄 USER FLOWS

### Flow 1: Request Community Creation
1. User navigates to `/communities`
2. Clicks "Request New Community"
3. Redirected to `/communities/request`
4. Fills form (type, geographic scope, notes)
5. System checks:
   - Email/phone verification ✓
   - Rate limit (10/30 days) ✓
   - Overlap detection
6. Submits request
7. Success message + redirect to `/communities/my-requests`
8. Email notification sent to user confirming submission

### Flow 2: Admin Approves Community
1. Admin navigates to `/admin/communities`
2. Reviews pending request
3. Checks requester profile
4. Verifies no overlaps
5. Clicks [Approve]
6. Enters community details:
   - Official name
   - Description
   - Zip codes
   - Center coordinates
7. Submits approval
8. System:
   - Creates Community record
   - Auto-creates CommunityMember for requester (founder)
   - Sends email to requester
9. Requester receives notification + can access community

### Flow 3: Join Community
1. User browses `/communities` or sees suggested
2. Clicks community card → `/communities/:id`
3. Views community (read-only)
4. Clicks [Join Community]
5. System checks:
   - Email/phone verified ✓
   - Not already member/pending ✓
   - If subcommunity, parent membership checked
6. Creates join request (status: PENDING)
7. Moderators notified
8. User sees "Pending approval" status

### Flow 4: Moderator Approves Member
1. Moderator navigates to `/communities/:id/moderate`
2. Sees pending join requests
3. Clicks request to expand details
4. Reviews:
   - User profile
   - Rescue level & stats
   - Other community memberships
   - Ban history
5. Clicks [Approve]
6. User's status changes to APPROVED
7. User receives email notification
8. User can now access full community features

### Flow 5: Create Recovery Squad
1. Owner reports lost pet (existing flow)
2. After pet details submitted, prompted:
   - "Create recovery squad in communities?"
3. System detects communities within 10-mile radius
4. Owner selects:
   - Metro area only
   - Or specific subcommunities (max 4)
5. Confirms selection
6. System:
   - Creates RecoverySquad for metro
   - Creates Subsquads if selected
   - Auto-adds owner as OWNER role
   - Auto-adds community moderators
   - Creates join request if owner not member
   - Notifies community members
7. Squad appears in community "Active Squads"

### Flow 6: Join and Participate in Squad
1. User sees squad in community feed
2. Clicks [Join Squad]
3. If subsquads exist, selects which subsquad
4. Joins instantly (if member of community)
5. User levels up to SENTRY (first squad)
6. Level-up notification shown
7. User can now:
   - View squad chat
   - Mark search areas
   - Report pet spottings
   - Send messages

### Flow 7: Mark Search Area
1. Squad member navigates to `/squads/:id`
2. Clicks [Mark Area Searched]
3. Modal opens with map
4. Enters starting address or taps location
5. Map zooms to street-level
6. Draws freeform polygon around searched area
7. System calculates acreage
8. If > 5 acres, warning shown: "Are you sure?"
9. Enters notes: "Checked all yards and alleys"
10. Optionally checks "Potential pet spotted"
11. Submits
12. System:
    - Creates SearchArea record
    - Updates squad stats
    - Updates user stats
    - If potential spotting, alerts all members
    - Checks for Shepherd level-up
13. Area appears on squad map (red polygon)

### Flow 8: Report Pet Spotted
1. Squad member clicks [Report Pet Spotted]
2. Modal opens
3. Drops pin on map (precise location)
4. Sets date/time (defaults to now)
5. Sets confidence level slider (1-10)
6. Optionally uploads photos
7. Adds notes
8. Submits
9. System:
   - Creates PetSpotting record
   - **ALERTS ALL SQUAD MEMBERS + OWNER** (push/email/SMS)
   - Posts to Central Hub
   - Adds pin to squad map
10. All members receive immediate notification

### Flow 9: Squad Closes - Pet Found!
1. Owner marks pet as FOUND in report
2. Squad auto-closes (status: CLOSED, reason: FOUND)
3. Owner prompted: "Honor any members for exceptional help?"
4. Modal shows all squad members with stats
5. Owner selects members to honor + optional note
6. Submits
7. System:
   - Updates squad status
   - Creates SquadHonor records
   - Updates all member stats (successfulReunions++)
   - Checks for level-ups:
     - PATHFINDER (1 reunion)
     - PACK_GUARDIAN (5 reunions)
     - PACK_LEGEND (50 reunions)
   - Sends level-up notifications
   - Sends honor notifications to selected members
   - Archives squad (read-only chat)
8. Honored members see:
   - "You've been honored by Sarah for helping find Max!"
   - Profile updated: honorsReceived++

---

## 📱 RESPONSIVE DESIGN NOTES

### Mobile Considerations
- Stack stats vertically
- Hamburger menu for tabs
- Map: full-screen mode option
- Chat: bottom sheet style
- Simplified search area drawing (tap points vs freeform)
- Photo upload: camera integration

### Desktop Enhancements
- Sidebar navigation for communities
- Multi-column layouts (feed + squads)
- Hover tooltips for badges/stats
- Keyboard shortcuts for power users
- Drag-and-drop photo upload

---

## 🎨 DESIGN SYSTEM

### Color Palette
- **Primary:** Blue (#4A90E2) - Trust, community
- **Success:** Green (#7ED321) - Pet found, approved
- **Warning:** Orange (#F5A623) - Pending, caution
- **Danger:** Red (#D0021B) - Urgent, banned
- **Squad Colors:**
  - Metro: Blue
  - Subsquad 1: Green
  - Subsquad 2: Purple
  - Subsquad 3: Orange
  - Subsquad 4: Pink

### Typography
- **Headings:** Bold, clear hierarchy
- **Body:** Readable, accessible (min 16px)
- **Labels:** Small caps for categories
- **Badges:** Distinctive, emoji + text

### Icons
- Use emoji where possible for warmth and clarity
- Fallback to icon library (Heroicons, Lucide)

### Animations
- Level-up: Confetti + fade-in badge
- Squad join: Pulse + check mark
- Pet spotted alert: Shake + sound
- Loading states: Skeleton screens

---

## ♿ ACCESSIBILITY

- **Keyboard Navigation:** All actions accessible via keyboard
- **Screen Readers:** Proper ARIA labels, semantic HTML
- **Color Contrast:** WCAG AA compliance minimum
- **Focus Indicators:** Clear, visible focus states
- **Alt Text:** All images, especially pet photos
- **Form Labels:** Associated with inputs
- **Error Messages:** Clear, actionable

---

## 🚀 PERFORMANCE

- **Code Splitting:** Lazy load admin/moderator pages
- **Image Optimization:** Compress pet photos, lazy load
- **Pagination:** All lists paginated (20-50 items)
- **Caching:** Cache community data, invalidate on updates
- **Optimistic UI:** Instant feedback on actions
- **Skeleton Screens:** Show layout while loading

---

This UI structure provides a comprehensive, user-friendly interface for the entire community system. All components are designed to work together cohesively while maintaining clarity and ease of use.
