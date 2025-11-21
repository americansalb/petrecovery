# Community System Implementation Plan

## Phased Approach for Building the Complete Community Feature

This document breaks down the community system into **8 manageable phases**, each building on the previous one. Each phase includes specific tasks, dependencies, and success criteria.

---

## 🎯 Implementation Strategy

### Principles
1. **Incremental Delivery:** Each phase delivers working, testable features
2. **User Value First:** Prioritize features that provide immediate value
3. **Foundation First:** Build core infrastructure before advanced features
4. **Test as You Go:** Write tests for each phase before moving on
5. **Database First:** Schema changes happen early, UI builds on top

### Timeline Estimate
- **Total:** 6-8 weeks for full implementation
- **MVP (Phases 1-4):** 3-4 weeks
- **Full Feature Set:** 6-8 weeks

---

## 📊 PHASE OVERVIEW

| Phase | Focus Area | Duration | Deliverable |
|-------|-----------|----------|-------------|
| 1 | Database & Core Infrastructure | 3-5 days | Schema + migrations working |
| 2 | Community Request System | 4-6 days | Users can request communities |
| 3 | Admin Approval Workflow | 3-4 days | Admins can approve/reject |
| 4 | Community Membership | 5-7 days | Users can join/browse communities |
| 5 | Recovery Squads (Core) | 7-10 days | Squads create, join, chat |
| 6 | Search Area Marking & Spottings | 5-7 days | Map features working |
| 7 | Gamification & Levels | 4-6 days | Level system functional |
| 8 | Moderation & Polish | 5-7 days | Admin tools + refinements |

---

## 🔨 PHASE 1: Database & Core Infrastructure
**Duration:** 3-5 days
**Goal:** Foundation ready for all features

### Tasks

#### 1.1 Database Schema
- [x] ✅ Prisma schema updated (COMPLETED)
- [ ] Run `npm install` in frontend directory
- [ ] Generate Prisma migration: `npx prisma migrate dev --name add_community_system`
- [ ] Verify migration applied successfully
- [ ] Generate Prisma Client: `npx prisma generate`
- [ ] Test database connection

#### 1.2 Seed Data (Development)
- [ ] Create seed script: `frontend/prisma/seed.js`
- [ ] Seed data includes:
  - 2-3 sample metro communities (Chicago, Dallas, Seattle)
  - 5-10 subcommunities under each
  - 20-30 test users with various rescue levels
  - 5-10 community memberships
  - 3-5 active recovery squads
- [ ] Run seed: `npx prisma db seed`
- [ ] Verify data in database

#### 1.3 Utility Functions
- [ ] Create `/frontend/app/lib/communities.js`:
  - `calculateDistance(lat1, lng1, lat2, lng2)` - Haversine formula
  - `geocodeZipCode(zipCode)` - Convert zip to lat/lng (use API or static data)
  - `checkCommunityOverlap(scope, existingCommunities)` - Overlap detection
  - `calculateAcreage(polygonCoordinates)` - GeoJSON area calculation
- [ ] Create `/frontend/app/lib/levels.js`:
  - `checkLevelUp(user)` - Determine if user leveled up
  - `getLevelInfo(level)` - Get level name, description, badge
  - `getNextLevelProgress(user)` - Progress to next level
- [ ] Write unit tests for utility functions

#### 1.4 Email Infrastructure
- [ ] Update `/frontend/app/lib/email.js` for community emails:
  - `sendCommunityRequestReceived(user, request)`
  - `sendCommunityApproved(user, community)`
  - `sendCommunityRejected(user, request, reason)`
  - `sendJoinRequestReceived(moderators, user, community)`
  - `sendJoinRequestApproved(user, community)`
  - `sendPetSpottedAlert(squadMembers, spotting)`
  - `sendLevelUpNotification(user, newLevel)`
  - `sendHonorNotification(user, owner, squad)`
- [ ] Test email sending (use Mailtrap or similar for dev)

#### 1.5 Authentication Enhancements
- [ ] Update `/frontend/app/lib/auth.js`:
  - Add `rescueLevel` to session
  - Add role-based helpers: `isAdmin()`, `isModerator(communityId)`
- [ ] Create middleware: `/frontend/app/lib/middleware/requireAuth.js`
  - `requireAdmin()` - 403 if not admin
  - `requireModerator(communityId)` - 403 if not moderator
  - `requireCommunityMember(communityId)` - 403 if not member

### Success Criteria
✅ Database migrations run without errors
✅ Seed data populates correctly
✅ Utility functions tested and working
✅ Email templates send correctly
✅ Auth middleware protects routes

### Dependencies
- None (foundation phase)

---

## 📝 PHASE 2: Community Request System
**Duration:** 4-6 days
**Goal:** Users can submit community creation requests

### Tasks

#### 2.1 API Endpoints
- [ ] `POST /api/communities/request` - Submit request
  - Validation: email/phone verified, rate limit check
  - Overlap detection for zip codes
  - Create CommunityRequest record
  - Send confirmation email
- [ ] `GET /api/communities/requests` - User's own requests
  - Filter by status
  - Pagination
- [ ] `GET /api/communities/requests/:id` - Request details
  - Authorization: owner or admin only

#### 2.2 UI Components
- [ ] Create `/frontend/app/communities/request/page.js`:
  - Community type selector (Metro/County vs Subcommunity)
  - Geographic scope input (city or zip)
  - Parent community selector (if subcommunity)
  - Notes textarea
  - Verification status check
  - Rate limit indicator
  - Form validation
- [ ] Create component: `CommunityRequestForm.jsx`
- [ ] Create component: `GeographicScopeInput.jsx`
  - Autocomplete for city names
  - Zip code validation
- [ ] Create component: `RateLimitIndicator.jsx`
  - Shows X/10 requests this month
  - Countdown to reset

#### 2.3 User Requests Page
- [ ] Create `/frontend/app/communities/my-requests/page.js`:
  - List of user's requests
  - Status badges (pending/approved/rejected)
  - Rejection reasons displayed
  - Link to approved communities
  - Button to create new request
- [ ] Create component: `RequestCard.jsx`
  - Status badge
  - Request details
  - Action buttons

### 2.4 Validation & Error Handling
- [ ] Client-side validation:
  - Required fields
  - Geographic scope format
  - Parent community selection (if subcommunity)
- [ ] Server-side validation:
  - Email/phone verification check
  - Rate limit enforcement
  - Overlap detection
  - Data sanitization
- [ ] Error messages:
  - User-friendly feedback
  - Actionable guidance (e.g., "Verify email first")

### Success Criteria
✅ User can submit community request
✅ Request appears in "My Requests"
✅ Validation catches errors
✅ Rate limiting works
✅ Confirmation email received

### Dependencies
- Phase 1 complete

---

## 👑 PHASE 3: Admin Approval Workflow
**Duration:** 3-4 days
**Goal:** Admins can review and approve/reject community requests

### Tasks

#### 3.1 API Endpoints
- [ ] `GET /api/admin/communities/requests` - Approval queue
  - Filter by status, type
  - Pagination
  - Include requester details
  - Include overlap check results
- [ ] `POST /api/admin/communities/requests/:id/approve` - Approve
  - Create Community record
  - Link to request
  - Create founder CommunityMember
  - Send approval email
- [ ] `POST /api/admin/communities/requests/:id/reject` - Reject
  - Update request status
  - Store rejection reason
  - Send rejection email

#### 3.2 Admin Dashboard
- [ ] Create `/frontend/app/admin/communities/page.js`:
  - Approval queue list
  - Tab navigation (Pending/Approved/Rejected)
  - Request cards with details
  - Approve/Reject actions
- [ ] Create component: `AdminRequestCard.jsx`
  - Requester profile summary
  - Geographic scope display
  - Overlap check results
  - Approve/Reject buttons
- [ ] Create component: `ApprovalForm.jsx`
  - Community name input
  - Description textarea
  - Zip codes input (comma-separated)
  - Center coordinates (auto-calculated or manual)
  - Submit button
- [ ] Create component: `RejectionForm.jsx`
  - Reason textarea (required)
  - Submit button

#### 3.3 Authorization
- [ ] Add admin-only route protection
- [ ] Middleware checks for ADMIN role
- [ ] Redirect non-admins with 403 error

### Success Criteria
✅ Admin sees pending requests
✅ Admin can approve request → community created
✅ Admin can reject request → user notified
✅ Non-admins cannot access admin pages
✅ Founder auto-joins approved community

### Dependencies
- Phase 1, 2 complete

---

## 👥 PHASE 4: Community Membership
**Duration:** 5-7 days
**Goal:** Users can browse, join, and participate in communities

### Tasks

#### 4.1 API Endpoints
- [ ] `GET /api/communities` - Browse all communities
  - Search by name/location
  - Filter by type
  - Pagination
  - Include user membership status
- [ ] `GET /api/communities/:id` - Community details
  - Full community info
  - Member count, active squads
  - Subcommunities list
  - User's membership status
- [ ] `GET /api/communities/suggested` - Suggested communities
  - Based on user's patrol zip code
  - Within 10-mile radius
- [ ] `POST /api/communities/:id/join` - Request to join
  - Validation: email/phone verified
  - Check parent membership (for subcommunities)
  - Create CommunityMember (status: PENDING)
  - Notify moderators
- [ ] `POST /api/communities/:id/leave` - Leave community
  - Remove from active squads
  - Delete CommunityMember record
- [ ] `GET /api/communities/:id/members` - Member list
  - Pagination
  - Filter by role
  - Search by name

#### 4.2 Community Directory
- [ ] Create `/frontend/app/communities/page.js`:
  - Search bar with autocomplete
  - Filters (type, location)
  - Suggested communities section
  - Grid/list view of all communities
  - "Request Community" button
- [ ] Create component: `CommunityCard.jsx`
  - Community name, type icon
  - Stats (members, squads)
  - Join button (status-aware)
  - View button → community page
- [ ] Create component: `CommunitySearchBar.jsx`
- [ ] Create component: `CommunityFilters.jsx`

#### 4.3 Community Page
- [ ] Create `/frontend/app/communities/[id]/page.js`:
  - Community header (name, stats, join button)
  - Tab navigation (Active Squads, Feed, Members, About)
  - Active squads list
  - Community feed (posts)
  - Members list
  - About section (description, map, stats)
- [ ] Create component: `CommunityHeader.jsx`
- [ ] Create component: `SquadList.jsx`
  - List of active recovery squads
  - Filter by subcommunity
  - Join squad button
- [ ] Create component: `CommunityFeed.jsx`
  - Pinned posts at top
  - Post cards with labels (subcommunity origin)
  - Create post button
- [ ] Create component: `MemberList.jsx`
  - Members with rescue levels
  - Moderators highlighted
  - Search functionality

#### 4.4 Community Posts (Feed)
- [ ] `POST /api/communities/:id/posts` - Create post
  - Rate limit check (3/day)
  - Increment daily post count
  - Create post record
- [ ] `DELETE /api/communities/:id/posts/:postId` - Delete post
  - Soft delete (isDeleted = true)
  - Moderator/admin only (or post author)
- [ ] `POST /api/communities/:id/posts/:postId/pin` - Pin post
  - Moderator/admin only
  - Update isPinned flag
- [ ] Create component: `PostCard.jsx`
  - Author info with rescue level badge
  - Post content
  - Timestamp
  - Comment/share buttons
  - Delete/pin buttons (if authorized)
- [ ] Create component: `CreatePostForm.jsx`
  - Text input
  - Rate limit indicator (X/3 posts today)
  - Submit button

#### 4.5 Moderator Tools (Basic)
- [ ] `GET /api/communities/:id/join-requests` - Pending members
  - Moderator/admin only
  - User details for review
- [ ] `POST /api/communities/:id/join-requests/:membershipId/approve`
  - Moderator/admin only
  - Update status to APPROVED
  - Notify user
- [ ] `POST /api/communities/:id/join-requests/:membershipId/reject`
  - Moderator/admin only
  - Set rejection reason
  - Notify user
- [ ] Create `/frontend/app/communities/[id]/moderate/page.js`:
  - Join requests tab
  - Pending members list
  - Approve/reject buttons
- [ ] Create component: `JoinRequestCard.jsx`
  - User profile summary
  - Stats, verification status
  - History (other communities, squads)
  - Approve/reject buttons

### Success Criteria
✅ User can browse communities
✅ User can request to join
✅ Moderator can approve/reject members
✅ User can create posts (with rate limit)
✅ Community feed displays correctly
✅ Subcommunity posts labeled in parent feed

### Dependencies
- Phase 1, 2, 3 complete

---

## 🚨 PHASE 5: Recovery Squads (Core)
**Duration:** 7-10 days
**Goal:** Squads can be created, joined, and used for coordination

### Tasks

#### 5.1 Squad Creation
- [ ] Modify `/api/reports/create` endpoint:
  - After pet report created, detect nearby communities
  - Prompt owner: "Create recovery squad?"
  - Show communities within 10-mile radius
  - Allow selection of metro + up to 4 subcommunities
- [ ] `POST /api/reports/:reportId/squads` - Create squad(s)
  - Create RecoverySquad for selected communities
  - Create Subsquads if multiple selected
  - Auto-add owner as SquadMember (role: OWNER)
  - Auto-add community moderators as members
  - Create join request if owner not member
  - Notify community members
- [ ] Update Lost Report form UI:
  - "Create Recovery Squad" section
  - Community selector (checkboxes)
  - Preview: "Squad will be created in: Chicago Metro, Evanston"
  - Submit creates report + squads

#### 5.2 Squad API Endpoints
- [ ] `GET /api/squads/:squadId` - Squad details
  - Squad info, stats
  - Pet info, report details
  - Member list with roles
  - Subsquads list
  - User's membership status
- [ ] `POST /api/squads/:squadId/join` - Join squad
  - Validation: must be community member
  - Optional subsquad selection
  - Create SquadMember record
  - Check for SENTRY level-up
  - Notify other squad members
- [ ] `POST /api/squads/:squadId/leave` - Leave squad
  - Update SquadMember.leftAt
  - Decrement member count
- [ ] `POST /api/squads/:squadId/close` - Close squad
  - Owner or admin only
  - Set status to CLOSED, reason (FOUND/CEASED)
  - Prompt for honored members
  - Update all member stats
  - Check for level-ups (PATHFINDER, PACK_GUARDIAN, PACK_LEGEND)
  - Archive (chat read-only)
- [ ] `POST /api/squads/:squadId/designate-leader` - Make leader
  - Owner only
  - Update SquadMember role to LEADER
  - Notify user

#### 5.3 Squad Chat/Messaging
- [ ] `GET /api/squads/:squadId/messages` - Get messages
  - Filter by subsquadId (channel)
  - Filter by type (CHAT, ANNOUNCEMENT)
  - Pagination (or "after" timestamp for polling)
- [ ] `POST /api/squads/:squadId/messages` - Send message
  - Validation: ANNOUNCEMENT requires OWNER/LEADER role
  - Create SquadMessage record
  - Increment SquadMember.messagesSent, actionsCount
  - Send notifications to all members (opt-out)
  - Check for Shepherd level-up (if leader + 10+ messages)
- [ ] Create component: `SubsquadChat.jsx`
  - Message list (scrollable)
  - Auto-scroll to bottom on new message
  - Message input box
  - Photo upload button
  - Location share button
  - Typing indicators (optional)
- [ ] Create component: `MessageBubble.jsx`
  - Author name + rescue level badge
  - Message content
  - Timestamp
  - Photo attachments
  - Location display

#### 5.4 Squad Page
- [ ] Create `/frontend/app/squads/[id]/page.js`:
  - Squad header (pet info, stats)
  - Tab navigation (Central Hub, subsquad channels, Map)
  - Central Hub (announcements feed)
  - Subsquad chat tabs
  - Quick action buttons (Report Spotted, Mark Searched)
  - Member list
- [ ] Create component: `SquadHeader.jsx`
  - Pet photo, name, species
  - Squad name
  - Stats (members, areas, acreage)
  - Join/Leave button
  - Close squad button (owner only)
- [ ] Create component: `CentralHubFeed.jsx`
  - Announcements only
  - Read-only for regular members
  - Post announcement button (owner/leaders)

#### 5.5 Squad Management
- [ ] Create component: `SquadMemberList.jsx`
  - Owner, leaders, members sections
  - Each member shows:
    - Name, rescue level
    - Subsquad assignment
    - Activity stats (messages, areas marked)
  - Owner can designate leaders
- [ ] Create component: `CloseSquadModal.jsx`
  - Reason selector (FOUND/CEASED)
  - Honor members selection
  - Optional note for honored members
  - Confirm button
- [ ] Create component: `HonorMembersModal.jsx`
  - Checkbox list of members
  - Shows each member's contributions
  - Search/filter members
  - Optional note per honored member
  - Submit button

### Success Criteria
✅ Owner can create squad when reporting lost pet
✅ Users can join squads
✅ Chat works (messages send/receive)
✅ Central Hub announcements work
✅ Subsquads work (separate channels)
✅ Owner can close squad and honor members
✅ Level-ups trigger for SENTRY

### Dependencies
- Phase 1-4 complete

---

## 🗺️ PHASE 6: Search Area Marking & Pet Spottings
**Duration:** 5-7 days
**Goal:** Map features for coordinating searches

### Tasks

#### 6.1 Search Area Marking
- [ ] `POST /api/squads/:squadId/search-areas` - Mark area
  - Validate GeoJSON polygon
  - Warning if acreage > 5
  - Create SearchArea record
  - Update user stats (areasMarked, totalAcreageSearched)
  - Update squad stats
  - If potentialSpotting, alert all members
  - Check for Shepherd level-up (5 areas + 15 acres)
- [ ] `GET /api/squads/:squadId/search-areas` - Get all areas
  - Return GeoJSON polygons
  - Include searcher info, timestamps
- [ ] Create component: `MarkSearchedModal.jsx`
  - Starting address input (with map pin)
  - Map zooms to street-level
  - Leaflet drawing tools (freeform polygon)
  - Acreage calculation (real-time)
  - Warning if > 5 acres: "Are you sure?"
  - Notes textarea
  - "Potential pet spotted" checkbox
  - Submit button
- [ ] Create component: `SearchAreaMap.jsx`
  - Leaflet map
  - Red polygons for searched areas
  - Click polygon → show details popover:
    - Searcher name + level
    - Date/time
    - Acreage
    - Notes
  - Legend (subsquad colors)
  - Toggle layers (areas, spottings, last seen)

#### 6.2 Pet Spottings
- [ ] `POST /api/squads/:squadId/pet-spottings` - Report sighting
  - Create PetSpotting record
  - **ALERT ALL SQUAD MEMBERS + OWNER** (high priority)
  - Create system message in Central Hub
  - Add pin to map
- [ ] `GET /api/squads/:squadId/pet-spottings` - Get sightings
  - Return all spottings with details
- [ ] Create component: `ReportSpottingModal.jsx`
  - Map with draggable pin (precise location)
  - Address autocomplete
  - Date/time picker (defaults to now)
  - Confidence slider (1-10)
  - Photo upload
  - Notes textarea
  - Warning: "This will alert all squad members"
  - Submit button
- [ ] Add pet spotting pins to `SearchAreaMap.jsx`:
  - Color-coded by confidence level
  - Click pin → show details:
    - Reporter name
    - Confidence level
    - Photos
    - Notes
    - Timestamp

#### 6.3 Map Integration
- [ ] Install Leaflet: `npm install leaflet react-leaflet`
- [ ] Install drawing plugin: `npm install leaflet-draw`
- [ ] Configure Leaflet in Next.js (client-side only)
- [ ] Create utility: `calculatePolygonArea(coordinates)` - Returns acres
- [ ] Create utility: `validateGeoJSON(geometry)` - Validates polygon
- [ ] Add map tiles (OpenStreetMap or Mapbox)

### Success Criteria
✅ User can mark search area on map
✅ Polygons display correctly
✅ Acreage calculated accurately
✅ Warning shows for large areas
✅ User can report pet spotted
✅ Spottings alert all squad members
✅ Map shows all search areas + spottings
✅ Shepherd level-up triggers (5 areas, 15 acres)

### Dependencies
- Phase 5 complete

---

## 🏆 PHASE 7: Gamification & Levels
**Duration:** 4-6 days
**Goal:** Rescue level system fully functional

### Tasks

#### 7.1 Level Progression Logic
- [ ] Enhance `/frontend/app/lib/levels.js`:
  - `checkLevelUp(user, action)` - Called after actions
    - PET_OWNER: Submitted lost pet (auto)
    - SCOUT: Joined community
    - SENTRY: Joined squad
    - SHEPHERD: 5+ areas + 15+ acres
    - PATHFINDER: 1+ successful reunion
    - PACK_GUARDIAN: 5+ successful reunions
    - PACK_LEGEND: 50+ successful reunions
  - Returns: `{ leveledUp: true, newLevel: "PATHFINDER" }` or `{ leveledUp: false }`
  - Updates User.rescueLevel, User.lastLevelUpAt
- [ ] Update API endpoints to check for level-ups:
  - After community join → check SCOUT
  - After squad join → check SENTRY
  - After area marked → check SHEPHERD
  - After squad closes (FOUND) → check PATHFINDER/PACK_GUARDIAN/PACK_LEGEND
- [ ] Return level-up info in API responses

#### 7.2 Level-Up Notifications
- [ ] Create component: `LevelUpModal.jsx`
  - Animated modal (fade-in + confetti)
  - Level badge display (large icon + name)
  - Congratulatory message with level description
  - Random cat/puppy image (use API like Dog CEO or Cat API)
  - Share button (social media or community post)
  - Close button
- [ ] Install confetti library: `npm install canvas-confetti`
- [ ] Trigger modal on level-up:
  - Check API response for `levelUp` field
  - Show modal with animation
  - Play sound effect (optional)
- [ ] Send email notification:
  - Subject: "🎉 You leveled up to Pathfinder!"
  - Includes level info, next steps
  - Link to profile

#### 7.3 Rescue Level Badges
- [ ] Create component: `RescueLevelBadge.jsx`
  - Props: level (enum)
  - Returns emoji + text
  - Variants:
    - PET_OWNER: 🐾 "Pet Owner"
    - SCOUT: 🔍 "Scout"
    - SENTRY: 👁️ "Sentry"
    - SHEPHERD: 🦮 "Shepherd"
    - PATHFINDER: 🧭 "Pathfinder"
    - PACK_GUARDIAN: 🛡️ "Pack Guardian"
    - PACK_LEGEND: ⭐ "Pack Legend"
  - Tooltip on hover (shows level description)
- [ ] Add badges to:
  - User profiles
  - Community member lists
  - Squad member lists
  - Post/comment authors
  - Join request reviews

#### 7.4 User Profile Enhancements
- [ ] Enhance `/frontend/app/profile/[userId]/page.js`:
  - Prominent rescue level display
  - Stats grid (communities, squads, areas, acres, reunions, honors)
  - Progress bar to next level
  - Recent activity timeline
  - Community memberships list
  - Honors received section
- [ ] Create component: `StatsGrid.jsx`
  - 6 stat cards (communities, squads, honors, areas, acres, reunions)
  - Icons for each stat
- [ ] Create component: `LevelProgressBar.jsx`
  - Current level badge
  - Next level badge
  - Progress percentage
  - Detailed breakdown (X/Y requirements)
- [ ] Create component: `ActivityTimeline.jsx`
  - Recent actions (squad joins, areas marked, level-ups)
  - Timestamps
  - Icons for action types

#### 7.5 Level Progress API
- [ ] `GET /api/users/me/level-progress` - Progress to next level
  - Returns current level, next level
  - Requirements for next level
  - User's current stats
  - Percentage complete
- [ ] `GET /api/users/:userId/profile` - Enhanced profile
  - User info + rescue stats
  - Communities list
  - Recent activity
  - Honors received

### Success Criteria
✅ Users level up automatically when meeting requirements
✅ Level-up modal shows with confetti
✅ Badges display everywhere users appear
✅ Profile shows detailed stats
✅ Progress bar shows path to next level
✅ Email notifications send on level-up

### Dependencies
- Phase 5, 6 complete (squad actions trigger level-ups)

---

## 🛡️ PHASE 8: Moderation & Polish
**Duration:** 5-7 days
**Goal:** Complete moderation tools, final refinements

### Tasks

#### 8.1 Advanced Moderation
- [ ] `POST /api/communities/:id/members/:userId/ban` - Ban user
  - Update CommunityMember status to BANNED
  - Remove from active squads
  - Hide all posts (isDeleted = true)
  - Send email with ban reason + appeal
  - If requestPlatformBan, notify admins
- [ ] `POST /api/admin/users/:userId/ban-platform` - Platform-wide ban
  - Admin only
  - Ban from ALL communities
  - Disable account access
  - Send email notification
- [ ] Create component: `BanUserModal.jsx`
  - Reason textarea (required)
  - "Request platform ban" checkbox
  - Warning about consequences
  - Confirm button
- [ ] Create component: `ModeratorDashboard.jsx`
  - Join requests tab
  - Reported posts tab
  - Banned users tab
  - Recent mod actions log
- [ ] Create component: `ReportedPostsList.jsx`
  - Posts flagged by users
  - Review + delete actions
  - Ban user option

#### 8.2 Notification System
- [ ] `GET /api/communities/:id/notification-settings`
  - Get user's notification preferences
- [ ] `PUT /api/communities/:id/notification-settings`
  - Update preferences (JSON)
- [ ] Create `/frontend/app/communities/[id]/settings/page.js`:
  - Notification toggles (granular)
  - Membership info
  - Request moderator button
  - Leave community button
- [ ] Create component: `NotificationToggles.jsx`
  - Checkboxes for each notification type
  - Save button

#### 8.3 Admin Tools
- [ ] Create `/frontend/app/admin/page.js` - Admin dashboard
  - Community requests (pending count)
  - Platform stats (communities, users, squads, reunions)
  - Recent activity
  - Quick links
- [ ] Create `/frontend/app/admin/moderators/page.js`:
  - Grant moderator status
  - List all moderators by community
  - Revoke moderator status
- [ ] `POST /api/admin/communities/:id/grant-moderator/:userId`
  - Admin only
  - Update CommunityMember role to MODERATOR
  - Notify user
- [ ] `POST /api/admin/communities/:id/revoke-moderator/:userId`
  - Admin only
  - Update role back to MEMBER

#### 8.4 Polish & Refinements
- [ ] Add loading states (skeleton screens)
  - Community list loading
  - Squad page loading
  - Feed loading
- [ ] Add empty states
  - No communities found
  - No active squads
  - No members yet
- [ ] Add error boundaries
  - Catch component errors
  - Display user-friendly messages
- [ ] Optimize images
  - Lazy load pet photos
  - Compress uploads
  - Responsive sizes
- [ ] Add keyboard shortcuts (optional)
  - `/` to focus search
  - `c` to create post
  - `esc` to close modals
- [ ] Add animations
  - Page transitions
  - Modal entrances
  - Button hover effects
- [ ] Mobile responsive
  - Test all pages on mobile
  - Adjust layouts for small screens
  - Touch-friendly buttons

#### 8.5 Testing
- [ ] Unit tests for utility functions
- [ ] API endpoint tests
  - Happy paths
  - Error cases
  - Authorization checks
- [ ] Integration tests
  - Full user flows (request → approve → join)
  - Squad creation → join → close
- [ ] Manual testing checklist
  - All user roles (user, moderator, admin)
  - All features (request, join, post, squad, search)
  - Edge cases (rate limits, overlaps, bans)

#### 8.6 Documentation
- [ ] Update README with community features
- [ ] Create user guide (how to use communities)
- [ ] Create moderator guide (how to moderate)
- [ ] Create admin guide (how to approve communities)
- [ ] API documentation (endpoints, parameters, responses)

### Success Criteria
✅ Moderators can ban users
✅ Admins can manage moderators
✅ Notifications work with granular settings
✅ All pages have loading/empty states
✅ Mobile responsive
✅ Tests pass
✅ Documentation complete

### Dependencies
- All previous phases complete

---

## 📋 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] All tests passing
- [ ] Database migrations ready
- [ ] Environment variables configured
- [ ] Email service configured (SMTP, SendGrid, etc.)
- [ ] Map tiles API key (if using Mapbox)
- [ ] Error tracking setup (Sentry, etc.)

### Deployment Steps
1. [ ] Backup production database
2. [ ] Run migrations: `npx prisma migrate deploy`
3. [ ] Deploy code to production
4. [ ] Verify deployment successful
5. [ ] Smoke test critical flows:
   - Request community
   - Join community
   - Create squad
   - Mark search area
6. [ ] Monitor error logs for 24 hours

### Post-Deployment
- [ ] Create initial communities (admins)
  - Seed major metro areas
  - Create subcommunities for active areas
- [ ] Invite beta users
- [ ] Gather feedback
- [ ] Iterate on issues

---

## 🎯 MVP vs Full Feature Set

### MVP (Minimum Viable Product) - Phases 1-4
**Goal:** Basic community creation and membership
**Features:**
- Users can request communities
- Admins can approve
- Users can join/browse communities
- Community feed with posts
- Moderator can approve members

**Timeline:** 3-4 weeks

### Full Feature Set - Phases 1-8
**Goal:** Complete community system with recovery squads
**Features:**
- Everything in MVP +
- Recovery squads with chat
- Search area marking
- Pet sightings
- Gamification/levels
- Advanced moderation

**Timeline:** 6-8 weeks

---

## 🔄 ITERATION STRATEGY

After initial launch:
1. **Gather metrics:**
   - Community creation requests (approval rate)
   - User engagement (posts/day, squads joined)
   - Successful reunions via squads
   - Level progression rates
2. **User feedback:**
   - Surveys
   - In-app feedback
   - Community moderator input
3. **Iterate:**
   - Fix bugs
   - Improve UX based on feedback
   - Add requested features
   - Optimize performance

---

## ✅ DEFINITION OF DONE

Each phase is considered "done" when:
- [ ] All tasks completed
- [ ] Code reviewed
- [ ] Tests written and passing
- [ ] UI matches design specs
- [ ] Mobile responsive
- [ ] Accessibility checked (WCAG AA)
- [ ] Documentation updated
- [ ] Demo/screenshots provided
- [ ] Deployed to staging and tested

---

## 🚀 READY TO BUILD!

**Next Steps:**
1. Run Phase 1 tasks (database setup)
2. Commit and push schema changes
3. Generate migration and test
4. Move to Phase 2 (community requests)

The complete feature specification, database schema, API endpoints, and UI structure are all documented and ready for implementation. Let's build this! 🐾
