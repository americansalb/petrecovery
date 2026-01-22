# GPS Search Feature - Complete Specification

> **Goal:** Make "Turn on GPS and Search" the primary, frictionless action for helpers.

---

## 1. User Journey Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GPS SEARCH USER JOURNEY                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ENTRY                    ACTIVE SEARCH                    POST-SEARCH      │
│  ─────                    ─────────────                    ───────────      │
│                                                                             │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐       │
│  │ Open    │──▶│ See Big │──▶│ Grant   │──▶│ Search  │──▶│ End &   │       │
│  │ Mission │   │ Search  │   │ Location│   │ Active  │   │ Summary │       │
│  │ Control │   │ Button  │   │ Access  │   │ Screen  │   │ Screen  │       │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘       │
│                     │                           │                           │
│                     ▼                           ▼                           │
│              "Start Searching"           Real-time map                      │
│              (Big, obvious CTA)          + distance + time                  │
│                                          + area coverage                    │
│                                          + Suramaa tips                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Entry Points

### 2.1 Primary Entry (Home Tab)
```
┌────────────────────────────────────────┐
│  🐕 Max - Missing 2 days               │
│  Last seen: Oak Street Park            │
├────────────────────────────────────────┤
│                                        │
│  ┌────────────────────────────────┐    │
│  │  🔍 START SEARCHING            │    │  ◄── BIG PRIMARY CTA
│  │                                │    │      (Full width, prominent)
│  │  Help find Max in your area    │    │
│  │  Earn 100 pts/mile searched    │    │
│  └────────────────────────────────┘    │
│                                        │
│  ┌──────────┐  ┌──────────┐            │
│  │ 👁 Report│  │ 📤 Share │            │  ◄── Secondary actions
│  │ Sighting │  │  Mission    │            │
│  └──────────┘  └──────────┘            │
│                                        │
└────────────────────────────────────────┘
```

### 2.2 Map Tab Entry
- Floating action button (FAB) in bottom-right
- Pulses when user is near search area but not searching

### 2.3 Actions Tab Entry
- GPS Search card at top of task list
- Shows "Continue Search" if session was interrupted

---

## 3. Pre-Search Flow

### 3.1 Location Permission (First Time)

```
┌────────────────────────────────────────┐
│                                        │
│           📍                           │
│                                        │
│   Enable Location Access               │
│                                        │
│   To track your search and earn        │
│   verified points, we need access      │
│   to your location.                    │
│                                        │
│   Your location is:                    │
│   • Only used while searching          │
│   • Never shared or sold               │
│   • Helps coordinate the search        │
│                                        │
│  ┌────────────────────────────────┐    │
│  │      ENABLE LOCATION           │    │
│  └────────────────────────────────┘    │
│                                        │
│         Maybe Later                    │
│                                        │
└────────────────────────────────────────┘
```

**If denied:** Show manual search logging option (self-reported, 5 pts/log)

### 3.2 Search Area Briefing (Quick, Skippable)

```
┌────────────────────────────────────────┐
│  Search Briefing                    ✕  │
├────────────────────────────────────────┤
│                                        │
│  🗺️ [MAP PREVIEW]                      │
│  ┌────────────────────────────────┐    │
│  │     🔴 Last Seen                │    │
│  │        ╲                       │    │
│  │    ┌────────────┐              │    │
│  │    │ Search     │  ← 1mi radius│    │
│  │    │ Zone       │              │    │
│  │    └────────────┘              │    │
│  │         📍 You are here        │    │
│  └────────────────────────────────┘    │
│                                        │
│  📏 You're 0.3 miles from search zone  │
│                                        │
│  💡 Suramaa's Tip:                     │
│  "Dogs often hide in backyards and     │
│   under porches. Check those spots!"   │
│                                        │
│  ┌────────────────────────────────┐    │
│  │     🔍 START SEARCHING          │    │
│  └────────────────────────────────┘    │
│                                        │
│  □ Don't show this again               │
│                                        │
└────────────────────────────────────────┘
```

---

## 4. Active Search Screen

### 4.1 Full-Screen Search Mode

```
┌────────────────────────────────────────┐
│  ← Exit Search          🔴 LIVE        │
├────────────────────────────────────────┤
│                                        │
│  ┌────────────────────────────────┐    │
│  │                                │    │
│  │    [FULL MAP VIEW]             │    │
│  │                                │    │
│  │    🔴 Last Seen                │    │
│  │                                │    │
│  │    ════ Your path (purple)     │    │
│  │     ╲                          │    │
│  │      ═══════╗                  │    │
│  │             ║                  │    │
│  │    📍 You   ═══════            │    │
│  │                                │    │
│  │    [Covered area: green tint]  │    │
│  │    [Uncovered: gray]           │    │
│  │    [Priority: red border]      │    │
│  │                                │    │
│  └────────────────────────────────┘    │
│                                        │
├────────────────────────────────────────┤
│  ┌──────────┬──────────┬──────────┐    │
│  │  ⏱️      │   📏     │   ⭐     │    │
│  │  12:34   │  0.8 mi  │  80 pts  │    │
│  │  Time    │ Distance │ Earned   │    │
│  └──────────┴──────────┴──────────┘    │
├────────────────────────────────────────┤
│                                        │
│  💡 "Check behind the blue dumpster    │
│      on Maple Ave - unchecked area!"   │
│                                        │
│  ┌────────────────────────────────┐    │
│  │  👁 REPORT SIGHTING             │    │  ◄── Always visible
│  └────────────────────────────────┘    │
│                                        │
│  ┌────────────────────────────────┐    │
│  │  ⏹️ END SEARCH                  │    │
│  └────────────────────────────────┘    │
│                                        │
└────────────────────────────────────────┘
```

### 4.2 Stats Panel (Always Visible)

| Stat | Description | Update Frequency |
|------|-------------|------------------|
| **Time** | Duration of search session | Every second |
| **Distance** | Total distance walked (validated) | Every 30 sec |
| **Points** | Real-time point estimate | Every 30 sec |
| **Area** | Grid cells covered (optional) | Every 30 sec |

### 4.3 Real-Time Map Elements

| Element | Color | Description |
|---------|-------|-------------|
| Your path | Purple line | Breadcrumb trail of your search |
| Your position | Blue dot with accuracy circle | Current location |
| Last seen | Red pin | Pet's last known location |
| Covered area | Green tint (30% opacity) | Grid cells you've searched |
| Uncovered area | Gray | Areas not yet searched |
| Priority zones | Red border | High-value search areas |
| Other searchers | Orange dots | Team members also searching (if enabled) |

### 4.4 Suramaa's In-Search Tips

Tips appear contextually during the search:

| Trigger | Example Tip |
|---------|-------------|
| Near hiding spot | "This area has bushes and porches - great hiding spots for cats!" |
| Entering new grid cell | "New area! Call [Pet]'s name and shake a treat bag." |
| Idle > 2 min | "Still searching? Pets can hide in tight spaces - check under cars!" |
| Near priority zone | "⚠️ This area hasn't been searched yet. Focus here!" |
| Weather change | "Rain starting - pets often seek shelter under porches." |
| Dawn/dusk time | "This is prime search time - pets are more active now." |

---

## 5. Validation Rules

### 5.1 Proximity Validation

```javascript
// Only count distance within the search zone
const SEARCH_RADIUS_MILES = 2; // Configurable per mission

function isWithinSearchZone(userLat, userLng, lastSeenLat, lastSeenLng) {
  const distance = haversineDistance(userLat, userLng, lastSeenLat, lastSeenLng);
  return distance <= SEARCH_RADIUS_MILES;
}

// If user is outside zone:
// - Show warning: "You're outside the search area"
// - Distance traveled does NOT count toward points
// - Offer navigation back to search zone
```

### 5.2 Speed Validation

```javascript
const MAX_WALKING_SPEED_MPH = 5; // ~8 km/h, brisk walking
const MIN_MOVEMENT_SPEED_MPH = 0.1; // Filter out GPS drift

function validateMovement(prevPing, currentPing) {
  const timeDelta = (currentPing.time - prevPing.time) / 3600000; // hours
  const distance = haversineDistance(prevPing, currentPing);
  const speed = distance / timeDelta;

  if (speed > MAX_WALKING_SPEED_MPH) {
    return { valid: false, reason: 'DRIVING' };
  }
  if (speed < MIN_MOVEMENT_SPEED_MPH) {
    return { valid: false, reason: 'STATIONARY' };
  }
  return { valid: true, distance };
}
```

**When speed > 5 mph:**
- Show toast: "Movement paused - looks like you're in a vehicle"
- Distance doesn't count until speed drops
- Don't end the session (user might park and resume)

### 5.3 Minimum Session Requirements

| Requirement | Value | Reason |
|-------------|-------|--------|
| Minimum duration | 5 minutes | Prevent accidental starts |
| Minimum distance | 0.1 miles | Prevent gaming |
| Minimum unique grid cells | 3 | Ensure actual coverage |

**If minimum not met:**
- Show: "Search too short to earn points. Keep going!"
- Option to continue or cancel (no points)

### 5.4 Grid Cell Coverage

```javascript
const GRID_CELL_SIZE_METERS = 100; // 100m x 100m cells

function getGridCellId(lat, lng, baseLat, baseLng) {
  const latOffset = Math.floor((lat - baseLat) * 111000 / GRID_CELL_SIZE_METERS);
  const lngOffset = Math.floor((lng - baseLng) * 111000 * Math.cos(baseLat * Math.PI/180) / GRID_CELL_SIZE_METERS);
  return `${latOffset}_${lngOffset}`;
}

// Track unique cells visited
const visitedCells = new Set();
visitedCells.add(getGridCellId(currentLat, currentLng, lastSeenLat, lastSeenLng));
```

---

## 6. Points System

### 6.1 Base Points

| Metric | Points | Notes |
|--------|--------|-------|
| Distance | 100 pts/mile | Only validated distance within search zone |
| Grid cells | 5 pts/new cell | Bonus for covering new ground |
| Duration | 10 pts/15 min | Engagement bonus (max 40 pts) |

### 6.2 Multipliers

| Condition | Multiplier | Example |
|-----------|------------|---------|
| First 24 hours | 1.5x | Critical time window |
| Dawn (6-8 AM) | 1.25x | Optimal search time |
| Dusk (5-7 PM) | 1.25x | Optimal search time |
| Rainy weather | 1.2x | Extra effort recognized |
| First search of day | 1.1x | Encourage daily engagement |

### 6.3 Point Calculation Formula

```javascript
function calculatePoints(session) {
  const baseDistance = session.validatedDistanceMiles * 100;
  const gridBonus = session.uniqueCellsVisited * 5;
  const timeBonus = Math.min(Math.floor(session.durationMinutes / 15) * 10, 40);

  let subtotal = baseDistance + gridBonus + timeBonus;

  // Apply multipliers
  if (session.hoursAfterLost < 24) subtotal *= 1.5;
  if (isOptimalTime(session.startedAt)) subtotal *= 1.25;
  if (isFirstSearchToday(session.userId)) subtotal *= 1.1;

  return Math.round(subtotal);
}
```

---

## 7. End Search Flow

### 7.1 End Confirmation

```
┌────────────────────────────────────────┐
│                                        │
│  End your search?                      │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  ✓ 0.8 miles searched            │  │
│  │  ✓ 12 grid cells covered         │  │
│  │  ✓ 34 minutes active             │  │
│  └──────────────────────────────────┘  │
│                                        │
│  ┌────────────────────────────────┐    │
│  │    END & EARN 95 POINTS        │    │
│  └────────────────────────────────┘    │
│                                        │
│         Keep Searching                 │
│                                        │
└────────────────────────────────────────┘
```

### 7.2 Search Summary Screen

```
┌────────────────────────────────────────┐
│          🎉 Great Search!              │
├────────────────────────────────────────┤
│                                        │
│          ⭐ +95 POINTS                 │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │ [MAP showing your search path]   │  │
│  │                                  │  │
│  │  Your coverage added to the      │  │
│  │  team's search map!              │  │
│  └──────────────────────────────────┘  │
│                                        │
├────────────────────────────────────────┤
│  📊 Your Search Stats                  │
│                                        │
│  Distance      0.8 mi    +80 pts       │
│  New Areas     12 cells  +60 pts       │
│  Time          34 min    +20 pts       │
│  First 24hr    1.5x      bonus!        │
│  ─────────────────────────────────     │
│  Total                   95 pts        │
│                                        │
├────────────────────────────────────────┤
│                                        │
│  💡 Suramaa says:                      │
│  "Amazing effort! You covered a lot    │
│   of ground. Come back at dusk for     │
│   the best chance of spotting [Pet]!"  │
│                                        │
├────────────────────────────────────────┤
│                                        │
│  ┌────────────────────────────────┐    │
│  │       📤 SHARE YOUR SEARCH      │    │
│  └────────────────────────────────┘    │
│                                        │
│  ┌────────────────────────────────┐    │
│  │       🔍 SEARCH AGAIN           │    │
│  └────────────────────────────────┘    │
│                                        │
│            Back to Mission             │
│                                        │
└────────────────────────────────────────┘
```

---

## 8. Edge Missions & Error Handling

### 8.1 GPS Signal Lost

```
┌────────────────────────────────────────┐
│  ⚠️ GPS Signal Weak                    │
├────────────────────────────────────────┤
│                                        │
│  We're having trouble tracking your    │
│  location. Your search is paused.      │
│                                        │
│  Try:                                  │
│  • Moving to an open area              │
│  • Checking location permissions       │
│  • Waiting a moment                    │
│                                        │
│  ┌────────────────────────────────┐    │
│  │      RETRY GPS                  │    │
│  └────────────────────────────────┘    │
│                                        │
│  Continue without GPS (manual log)     │
│                                        │
└────────────────────────────────────────┘
```

### 8.2 App Backgrounded

- Continue tracking in background (if permission granted)
- Show persistent notification with stats
- If killed, save session state for recovery

```
┌────────────────────────────────────────┐
│  🔍 Search Active - 0.8 mi             │
│  Tap to return to ReunitePets          │
└────────────────────────────────────────┘
```

### 8.3 Session Recovery

If app crashes or phone restarts:
```
┌────────────────────────────────────────┐
│  Resume Previous Search?               │
├────────────────────────────────────────┤
│                                        │
│  You have an unfinished search from    │
│  2 hours ago (0.5 mi covered).         │
│                                        │
│  ┌────────────────────────────────┐    │
│  │      RESUME SEARCH              │    │
│  └────────────────────────────────┘    │
│                                        │
│  ┌────────────────────────────────┐    │
│  │   END & SAVE PROGRESS           │    │
│  └────────────────────────────────┘    │
│                                        │
│         Discard (no points)            │
│                                        │
└────────────────────────────────────────┘
```

### 8.4 Outside Search Zone

```
┌────────────────────────────────────────┐
│  📍 Outside Search Zone                │
├────────────────────────────────────────┤
│                                        │
│  You're 1.2 miles from the search      │
│  area. Distance here won't count       │
│  toward points.                        │
│                                        │
│  ┌────────────────────────────────┐    │
│  │  🧭 NAVIGATE TO SEARCH ZONE     │    │
│  └────────────────────────────────┘    │
│                                        │
│         Continue anyway                │
│                                        │
└────────────────────────────────────────┘
```

### 8.5 Battery Considerations

- Show battery warning if < 20%
- Offer "Low Power Mode" (less frequent pings)
- Save session before battery dies

---

## 9. Backend API Requirements

### 9.1 Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mission/[missionId]/search` | POST | Start/ping/end session |
| `/api/mission/[missionId]/search` | GET | Get active session |
| `/api/mission/[missionId]/search/coverage` | GET | Get team coverage map |
| `/api/mission/[missionId]/search/history` | GET | User's search history |

### 9.2 Start Search Request

```json
POST /api/mission/[missionId]/search
{
  "action": "start",
  "latitude": 41.8781,
  "longitude": -87.6298,
  "deviceInfo": {
    "platform": "ios",
    "batteryLevel": 85,
    "locationAccuracy": "high"
  }
}
```

### 9.3 Location Ping Request

```json
POST /api/mission/[missionId]/search
{
  "action": "ping",
  "sessionId": "sess_123",
  "latitude": 41.8785,
  "longitude": -87.6302,
  "accuracy": 5.2,
  "heading": 270,
  "speed": 1.2,
  "timestamp": "2024-01-15T14:30:00Z"
}
```

### 9.4 End Search Request

```json
POST /api/mission/[missionId]/search
{
  "action": "end",
  "sessionId": "sess_123",
  "finalLocation": {
    "latitude": 41.8790,
    "longitude": -87.6310
  }
}
```

### 9.5 End Search Response

```json
{
  "success": true,
  "sessionId": "sess_123",
  "stats": {
    "durationMinutes": 34,
    "totalDistanceMiles": 0.95,
    "validatedDistanceMiles": 0.82,
    "gridCellsCovered": 12,
    "newGridCells": 8
  },
  "points": {
    "distance": 82,
    "gridBonus": 40,
    "timeBonus": 20,
    "multiplier": 1.5,
    "total": 213
  },
  "achievements": [
    { "id": "first_search", "name": "First Steps", "points": 25 }
  ]
}
```

---

## 10. Data Models

### 10.1 SearchSession (Updated)

```prisma
model SearchSession {
  id                String   @id @default(cuid())
  missionId            String
  userId            String
  status            String   // ACTIVE, COMPLETED, ABANDONED

  // Timing
  startedAt         DateTime
  endedAt           DateTime?

  // Location tracking
  startLocation     Json     // { lat, lng }
  currentLocation   Json?    // { lat, lng, accuracy, heading }
  lastLocationUpdate DateTime?

  // Validation
  validatedDistanceMiles Float @default(0)
  totalDistanceMiles     Float @default(0)
  gridCellsCovered       Int   @default(0)
  outsideZoneMinutes     Int   @default(0)  // Time spent outside search zone

  // Points
  pointsEarned      Int      @default(0)
  multiplierApplied Float    @default(1.0)

  // Verification
  isVerified        Boolean  @default(true)

  // Relations
  locationPings     LocationPing[]
  mission              Mission     @relation(fields: [missionId], references: [id])
  user              User     @relation(fields: [userId], references: [id])

  createdAt         DateTime @default(now())
}
```

### 10.2 LocationPing (Updated)

```prisma
model LocationPing {
  id          String   @id @default(cuid())
  sessionId   String

  latitude    Float
  longitude   Float
  accuracy    Float?
  heading     Float?
  speed       Float?   // meters per second

  // Validation flags
  isValid     Boolean  @default(true)
  invalidReason String? // DRIVING, OUTSIDE_ZONE, GPS_ERROR
  gridCellId  String?  // Which grid cell this ping is in

  session     SearchSession @relation(fields: [sessionId], references: [id])
  createdAt   DateTime @default(now())
}
```

### 10.3 SearchCoverage (New - for team map)

```prisma
model SearchCoverage {
  id          String   @id @default(cuid())
  missionId      String
  gridCellId  String   // e.g., "12_-5"

  firstSearchedAt DateTime
  lastSearchedAt  DateTime
  searchCount     Int      @default(1)

  // Aggregate data
  totalTimeMinutes Int    @default(0)
  uniqueSearchers  Int    @default(1)

  @@unique([missionId, gridCellId])
}
```

---

## 11. Component Architecture

### 11.1 Component Tree

```
MissionControl
├── HomeTab
│   └── StartSearchCTA          ← Big entry button
├── MapTab
│   ├── SearchMap
│   │   ├── UserLocationMarker
│   │   ├── SearchPath
│   │   ├── CoverageOverlay
│   │   └── PriorityZones
│   └── SearchFAB               ← Floating action button
├── ActionsTab
│   └── GPSSearchCard           ← Compact card entry
└── ActiveSearchScreen          ← Full-screen search mode
    ├── SearchHeader
    ├── SearchMap (full)
    ├── StatsPanel
    ├── SuramaaTipBanner
    ├── ReportSightingButton
    └── EndSearchButton
```

### 11.2 State Management

```javascript
// useSearchSession hook
const useSearchSession = (missionId) => {
  const [session, setSession] = useState(null);
  const [stats, setStats] = useState({ distance: 0, time: 0, points: 0 });
  const [path, setPath] = useState([]);
  const [validation, setValidation] = useState({ inZone: true, validSpeed: true });

  // Actions
  const startSearch = async () => { ... };
  const pingLocation = async (coords) => { ... };
  const endSearch = async () => { ... };
  const pauseSearch = () => { ... };
  const resumeSearch = () => { ... };

  return {
    session,
    stats,
    path,
    validation,
    isActive: session?.status === 'ACTIVE',
    startSearch,
    pingLocation,
    endSearch,
    pauseSearch,
    resumeSearch,
  };
};
```

---

## 12. Implementation Phases

### Phase 1: Core GPS Tracking (MVP)
- [ ] Start/End search flow
- [ ] Basic distance calculation
- [ ] Location pings every 30 seconds
- [ ] Simple points (distance only)
- [ ] Path visualization on map

### Phase 2: Validation & Quality
- [ ] Proximity validation (search zone)
- [ ] Speed validation (filter driving)
- [ ] Minimum session requirements
- [ ] Grid cell tracking
- [ ] Improved point calculation with bonuses

### Phase 3: UX Polish
- [ ] Full-screen search mode
- [ ] Real-time stats panel
- [ ] Suramaa contextual tips
- [ ] Search summary screen
- [ ] Achievement notifications

### Phase 4: Team Features
- [ ] Team coverage map
- [ ] See other searchers (opt-in)
- [ ] Coverage cold spots
- [ ] Coordinated search zones

### Phase 5: Advanced
- [ ] Background tracking
- [ ] Session recovery
- [ ] Offline support
- [ ] Battery optimization
- [ ] Search route suggestions

---

## 13. Testing Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| User starts search, walks 0.5 mi, ends | Earn ~50 points |
| User starts search, drives 2 mi, ends | Earn 0 points (speed filter) |
| User searches outside zone | Warning shown, distance doesn't count |
| User searches < 5 min | "Too short" message, option to continue |
| App backgrounded during search | Continue tracking, show notification |
| GPS lost during search | Pause search, show retry option |
| User walks in circles (same spot) | Limited points (grid cells don't increase) |
| Two users search same area | Both earn points, coverage map updates |

---

## 14. Success Metrics

| Metric | Target |
|--------|--------|
| Searches per mission | > 5 sessions |
| Avg search duration | > 15 minutes |
| Distance per search | > 0.3 miles |
| Return searches | > 30% search again within 24h |
| Sightings during search | Track correlation |
| Reunion rate with GPS searches | Compare to missions without |
