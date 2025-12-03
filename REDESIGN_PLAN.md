# Squad & Mission Control Redesign Plan

## The Core Problem

Users are confused about where they should be and what they should be doing. Two separate pages (Squad Hub and Mission Control) compete for attention, have overlapping features, and don't guide the user through a clear workflow.

---

## Proposed Solution: Two Views, One Design Language

**Keep Squad Hub and Mission Control as separate views**, but with:
- Consistent visual language between them
- Clear navigation between them
- Shared component library (panels, map, case cards)
- Smooth transitions when moving between views

### The Two Views:

**Squad Hub** (`/rescue-squads/[id]`)
- City-level overview
- See ALL cases in the squad
- Squad-wide chat
- Map zoomed to show entire squad coverage
- Click a case → goes to Mission Control for that case

**Mission Control** (`/mission-control?mission=X`)
- Case-level focus
- See only YOUR joined cases in the rail
- Case-specific chat
- Map zoomed to missing location
- Case rail for quick switching between your missions

---

## 1. Clear Relationship Between Squad and Case

### Current Problem
- Squad Hub and Mission Control are separate pages with jarring transitions
- Users lose context when moving between them
- No persistent sense of "where am I in the system"

### Proposed Solution: Nested Context Model

```
┌─────────────────────────────────────────────────────────────┐
│  SQUAD BAR (Always visible, minimal)                        │
│  [Austin Rescue Squad ▼]  [3 Active Cases]  [12 Members]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CASE RAIL (Left sidebar, collapsible)     MAIN WORK AREA  │
│  ┌─────────────────────┐                   ┌─────────────┐ │
│  │ 🔴 Buddy - 2hrs     │◄── Selected       │             │ │
│  │ 🟡 Luna - 18hrs     │                   │   Case      │ │
│  │ 🟢 Max - 3 days     │                   │   Content   │ │
│  │                     │                   │             │ │
│  │ + Browse All Cases  │                   │             │ │
│  └─────────────────────┘                   └─────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key principles:**
- Squad context is ALWAYS visible (top bar) but minimal
- Cases you're working on are in a persistent left rail
- Clicking a case loads it in the main area WITHOUT a page change
- One URL structure: `/command-center?squad=X&case=Y`

### Why This Works
- User always knows what squad they're in
- Can quickly switch between cases without losing context
- Main work area has full space for case details
- Mobile: Rail becomes a slide-out drawer

---

## 2. Reduce Tabs/Modes While Expanding Functionality

### Current Problem
- Squad Hub: 3 tabs (Cases, Map, Community)
- Case View: 5 tabs (Overview, Map, Activity, Team, Manage)
- Total: 8 different modes to understand
- Features are scattered across tabs

### Proposed Solution: Smart Contextual Panels

Instead of tabs, use a **primary view + expandable panels** model:

```
┌─────────────────────────────────────────────────────────────┐
│ CASE: Buddy the Golden Retriever              [Actions ▼]  │
│ Missing 2 hours • Last seen: 123 Oak St • $500 Reward      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │                    LIVE MAP                         │   │
│  │         (Always visible, full width)                │   │
│  │                                                     │   │
│  │   [Sightings] [Search Areas] [Team Locations]      │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ 📋 Tasks     │ │ 👁 Sightings │ │ 💬 Chat      │        │
│  │ 5/25 done    │ │ 3 reported   │ │ 12 messages  │        │
│  │ [Expand ▼]   │ │ [Expand ▼]   │ │ [Expand ▼]   │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│  [▼ Expanded Panel - Full task list, sighting details...]  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Map is ALWAYS visible** because:
- It's the most useful tool for coordination
- Sightings, search areas, team locations all display on it
- Provides immediate context for any action

**Expandable panels** replace tabs:
- Collapsed: Show summary stats (5/25 tasks, 3 sightings)
- Expanded: Full functionality slides up over the map
- Only ONE panel expanded at a time
- Panels are contextual to the case

### Feature Mapping (Old → New)

| Old Location | Feature | New Location |
|-------------|---------|--------------|
| Case Overview | Pet info, urgency | Case Header (always visible) |
| Case Overview | Stats | Panel summaries (collapsed) |
| Case Map | Search areas | Main map (always visible) |
| Case Map | Sightings | Main map + Sightings panel |
| Case Activity | Timeline | Activity panel (expandable) |
| Case Team | Task checklist | Tasks panel (expandable) |
| Case Team | GPS tracking | Floating action button on map |
| Case Team | Team members | Team panel (expandable) |
| Case Manage | Status, edit | Actions dropdown in header |
| Squad Cases | Case list | Left rail (persistent) |
| Squad Map | City overview | Main map (zoom out) |
| Squad Community | Chat | Chat panel (expandable) |

### New Functionality to Add
- **Quick Actions Bar**: Report sighting, Start GPS tracking, Share case
- **Notification badges**: Real-time updates on panels
- **Case comparison**: View sightings from multiple cases on map
- **Smart suggestions**: "Luna was sighted near Buddy's last location"

---

## 3. Clearer Visual Hierarchy

### Current Problem
- Everything has the same visual weight
- Important actions buried in tabs
- Status indicators inconsistent
- Too many borders, gradients, shadows competing

### Proposed Solution: Three-Level Hierarchy

**Level 1: CRITICAL (Immediate attention)**
- Case urgency banner (pulsing red for <4 hours)
- New sighting notification
- Team member needs help alert

```
┌─────────────────────────────────────────────────────────────┐
│ 🔴 URGENT: Buddy has been missing for only 2 HOURS         │
│    The first 4 hours are critical. Every minute matters!   │
│                                              [Dismiss]      │
└─────────────────────────────────────────────────────────────┘
```

**Level 2: PRIMARY (Main workspace)**
- Map with clear controls
- Currently expanded panel
- Primary action buttons (Report Sighting, Join Mission)

**Level 3: SECONDARY (Available but not demanding)**
- Collapsed panels showing summaries
- Case rail with other cases
- Settings and less-common actions

### Visual Design Principles

1. **Reduce visual noise**
   - Remove double borders
   - Simpler gradients (single color, subtle)
   - Consistent border radius (12px everywhere)
   - Less shadow, more subtle depth

2. **Color coding**
   - Red = Urgent/Critical (< 4 hours missing)
   - Amber = Active/Attention needed (4-24 hours)
   - Blue = Information/Standard
   - Green = Success/Reunited
   - Purple = GPS/Tracking active

3. **Typography hierarchy**
   - Pet name: 24px bold
   - Section headers: 16px bold
   - Body text: 14px regular
   - Meta/timestamps: 12px muted

4. **Spacing system**
   - Tight: 8px (within components)
   - Standard: 16px (between elements)
   - Loose: 24px (between sections)

---

## 4. Intuitive Case Cycling

### Current Problem
- MissionSelector dropdown is hidden and requires clicks
- No keyboard shortcuts
- Switching cases reloads entire page
- No visual indicator of "next urgent case"

### Proposed Solution: Smart Case Navigation

**Case Rail with Smart Ordering:**
```
┌─────────────────────┐
│ YOUR ACTIVE CASES   │
├─────────────────────┤
│ 🔴 Buddy    ← NOW   │  Keyboard: ↑
│    2hrs • Oak St    │
├─────────────────────┤
│ 🟡 Luna             │  Keyboard: ↓
│    18hrs • Main St  │
├─────────────────────┤
│ 🟢 Max              │
│    3 days • Elm Ave │
├─────────────────────┤
│ ── NEARBY CASES ──  │
│ 🔴 Charlie (0.5mi)  │
│    Not joined yet   │
│    [Quick Join]     │
├─────────────────────┤
│ 🔍 Browse All       │
└─────────────────────┘
```

**Keyboard Navigation:**
- `↑` / `↓` : Move between cases in rail
- `Enter` : Select highlighted case
- `J` : Quick join nearest unjoined case
- `S` : Report sighting for current case
- `G` : Toggle GPS tracking
- `?` : Show keyboard shortcuts

**Visual feedback for switching:**
- Smooth crossfade transition (200ms)
- Map animates to new location
- Panel states preserved per case (if you had Tasks expanded, it stays expanded)

**Smart suggestions:**
- "Buddy was sighted near Luna's search area" → Show both on map
- "3 cases within 1 mile of you" → Offer to show all
- "You searched this area yesterday" → Highlight on map

---

## Implementation Phases

### Phase 1: Shared Components
- [ ] Create `ExpandablePanel` component (collapsed summary → expanded full view)
- [ ] Create `CaseRail` component (for Mission Control case switching)
- [ ] Create `MapContainer` component (with proper zoom levels)
- [ ] Create `CaseHeader` component (pet info, urgency, stats)
- [ ] Create `BottomSheet` component (for mobile case switching)

### Phase 2: Mission Control Redesign
- [ ] Replace current tab-based layout with map + panels
- [ ] Add CaseRail for quick case switching
- [ ] Implement panel expansion behavior
- [ ] Map auto-focuses on case location
- [ ] Mobile: Bottom sheet for case switching
- [ ] Preserve all existing functionality (tasks, sightings, GPS, etc.)

### Phase 3: Squad Hub Redesign
- [ ] Consistent visual language with Mission Control
- [ ] Map zoomed out to squad coverage
- [ ] Squad-wide chat in panel
- [ ] Case cards that link to Mission Control
- [ ] Clear "Join Mission" flow

### Phase 4: Visual Polish
- [ ] Implement consistent color system
- [ ] Reduce visual noise (simpler borders, gradients)
- [ ] Add urgency banners for critical cases
- [ ] Smooth transitions between views
- [ ] Mobile responsive testing

### Phase 5: Navigation & UX
- [ ] Clear breadcrumbs (Squad → Case)
- [ ] Back button always returns to squad
- [ ] Keyboard shortcuts (optional)
- [ ] Smart case ordering by urgency
- [ ] "You are here" indicator in case rail

---

## Decisions Made

1. **Case Rail behavior**:
   - In Mission Control: Only cases user has joined
   - In Squad view: All squad cases visible

2. **Map behavior**:
   - Fixed height (~50% viewport)
   - Default zoom is FARTHER out than current
   - When viewing a case: Zoom focuses on missing location
   - When viewing squad: Zoom shows entire squad coverage area (or division)

3. **Panel behavior**:
   - Slide up OVER the map (map stays visible but dimmed)
   - Like a music app's "Now Playing" expansion
   - Very mobile-friendly pattern

4. **Mobile case switching**:
   - Bottom sheet (swipe up from bottom to see case list)
   - Natural gesture, keeps case name visible at top

5. **Backwards compatibility**:
   - This is frontend/UI only - no API changes
   - All existing functionality preserved
   - Same data flow, just better visual organization
   - No regression in features

6. **Chat scope**:
   - In Squad view: Squad-wide chat
   - In Case view: Case-specific chat only

---

## Visual Mockups (ASCII)

### SQUAD HUB - Desktop (`/rescue-squads/[id]`)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ 🐾 PetRecovery       ← Back to Squads    [+ Report Lost Pet]      👤 You │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  AUSTIN RESCUE SQUAD                           12 members • 4 on duty   │
│  Covering: Downtown, East Austin, Hyde Park                              │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                              MAP                                         │
│                    (zoomed out to show all cases)                        │
│                                                                          │
│      🔴 Buddy        🟡 Luna           🟢 Max                            │
│                                                                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│ ┌────────────────┐  ┌────────────────┐  ┌────────────────┐              │
│ │ 📋 Cases (3)   │  │ 👥 Members     │  │ 💬 Squad Chat  │              │
│ │ 1 urgent       │  │ 4 active now   │  │ 5 new messages │              │
│ └────────────────┘  └────────────────┘  └────────────────┘              │
│                                                                          │
│ ▼ CASES EXPANDED ────────────────────────────────────────────────────── │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 🔴 BUDDY - Golden Retriever                    2 hours missing      │ │
│  │    123 Oak Street • $500 reward • 3 helpers                         │ │
│  │                                            [Join Mission →]         │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 🟡 LUNA - Tabby Cat                            18 hours missing     │ │
│  │    456 Main Street • 2 helpers                                      │ │
│  │                                            [Join Mission →]         │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### MISSION CONTROL - Desktop (`/mission-control?mission=X`)
```
┌──────────────────────────────────────────────────────────────────────────┐
│ 🐾 PetRecovery       ← Back to Squad     [+ Report Sighting]      👤 You │
├────────────────────┬─────────────────────────────────────────────────────┤
│                    │                                                     │
│  YOUR MISSIONS     │  🐕 BUDDY - Golden Retriever              [Actions]│
│ ─────────────────  │  Missing 2 hours • 123 Oak Street, Austin          │
│                    │  $500 Reward • 3 helpers active                    │
│ 🔴 Buddy      2h   │                                                     │
│    ← viewing       ├─────────────────────────────────────────────────────┤
│                    │                                                     │
│ 🟡 Luna      18h   │                        MAP                          │
│                    │              (zoomed to last seen location)         │
│ 🟢 Max       3d    │                                                     │
│                    │      ● Last seen    ◆ Sightings    ▲ Helpers       │
│                    │                                                     │
│                    │            [🎯 Report Sighting] [📍 Track GPS]      │
│                    │                                                     │
│                    ├─────────────────────────────────────────────────────┤
│                    │                                                     │
│                    │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│                    │ │📋 Tasks  │ │👁 Sights │ │👥 Team   │ │💬 Chat   │ │
│                    │ │ 5/25 ✓   │ │ 3 new    │ │ 4 active │ │ 2 unread │ │
│                    │ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                    │                                                     │
│                    │ ▼ TASKS EXPANDED ─────────────────────────────────  │
│                    │                                                     │
│                    │   Suggested Next Steps:                             │
│                    │   ○ Search property & immediate area                │
│                    │   ○ Alert neighbors                                 │
│                    │   ○ Post flyers in the area                        │
│                    │                                                     │
└────────────────────┴─────────────────────────────────────────────────────┘
```

### MISSION CONTROL - Mobile
```
┌─────────────────────────┐
│ ← Squad   MISSION  👤   │
├─────────────────────────┤
│ 🐕 BUDDY                │
│ Missing 2h • Oak St     │
│ $500 Reward             │
├─────────────────────────┤
│                         │
│          MAP            │
│   (zoomed to location)  │
│                         │
│ [Report Sighting]       │
│ [Track GPS]             │
│                         │
├─────────────────────────┤
│ 📋 Tasks    👁 Sights   │
│ 5/25       3 new        │
├─────────────────────────┤
│ 👥 Team    💬 Chat      │
│ 4 active   2 unread     │
├─────────────────────────┤
│        ───────          │
│  ▲ Swipe for your cases │
│                         │
│ ┌─────────────────────┐ │  ← Bottom sheet (swiped up)
│ │ YOUR MISSIONS       │ │
│ │                     │ │
│ │ 🔴 Buddy  ← viewing │ │
│ │ 🟡 Luna             │ │
│ │ 🟢 Max              │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

### SQUAD HUB - Mobile
```
┌─────────────────────────┐
│ ← Back   AUSTIN    👤   │
├─────────────────────────┤
│ Austin Rescue Squad     │
│ 12 members • 4 on duty  │
├─────────────────────────┤
│                         │
│          MAP            │
│  (zoomed out, all cases)│
│                         │
│  🔴     🟡        🟢    │
│                         │
├─────────────────────────┤
│ 📋 Cases    👥 Members  │
│ 3 active   4 on duty    │
├─────────────────────────┤
│ 💬 Squad Chat           │
│ 5 new messages          │
├─────────────────────────┤
│                         │
│ ▼ CASES EXPANDED        │
│ ┌─────────────────────┐ │
│ │🔴 BUDDY    2h       │ │
│ │   [Join Mission →]  │ │
│ ├─────────────────────┤ │
│ │🟡 LUNA     18h      │ │
│ │   [Join Mission →]  │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

---

## Summary: What Changes

| Current | New |
|---------|-----|
| Squad Hub has 3 tabs | Squad Hub has map + expandable panels |
| Mission Control has 5 tabs | Mission Control has map + expandable panels |
| Tabs hide content | Panels show summaries, expand for details |
| Map only visible in Map tab | Map ALWAYS visible |
| Case switching via dropdown | Case rail (desktop) / bottom sheet (mobile) |
| Jarring page transitions | Smooth, context-preserving transitions |
| 8 different "modes" to learn | 2 views with consistent pattern |

## What Stays the Same

- All existing functionality (tasks, sightings, GPS, chat, team, etc.)
- Same API endpoints
- Same data flow
- Same URLs (just better UI at those URLs)
- All current features preserved

---

## Awaiting Your Approval

Ready to proceed when you confirm:
1. Does this plan make sense?
2. Any features I missed?
3. Should I start with Phase 1 (shared components)?
