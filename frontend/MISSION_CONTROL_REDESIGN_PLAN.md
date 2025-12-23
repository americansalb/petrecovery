# Mission Control Redesign Plan

## Current Problems (from screenshots)

1. **Too much scrolling** - Content extends beyond viewport (1/5 pagination)
2. **Cluttered overlays** - Multiple elements compete for attention
3. **Complex navigation** - Tabs, modals, mission switcher
4. **Glitchy GPS UI** - Stats panels, controls overlap with map
5. **Action overload** - 4+ buttons visible at once

## Design Goal

**Single-screen, no-scroll experience** - Like classic game HUDs or navigation apps

## New Layout (100vh viewport)

```
┌─────────────────────────────────────────┐
│  [< Back]     CURRY     [⏱ 2hr]        │  ← Compact header (60px)
│              Lost • Brown               │
├─────────────────────────────────────────┤
│                                         │
│                                         │
│              FULL MAP                   │  ← Map fills remaining space
│          (satellite view)               │
│                                         │
│     📍 Last Seen                        │
│     ═══ Your search path                │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐    │  ← Bottom card (floating)
│  │  🚀 START SEARCH                │    │     150px max
│  │  GPS-tracked • 100pts/mile      │    │
│  │                                 │    │
│  │  [👁 Sighting]   [📤 Share]    │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

## When Search is Active

```
┌─────────────────────────────────────────┐
│  [← Exit]   🔴 LIVE SEARCH    [👁]      │  ← Red header = active
├─────────────────────────────────────────┤
│                                         │
│              FULL MAP                   │
│         (your path drawing)             │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  ⏱ 12:34    📏 0.8mi    ⭐ 80pts       │  ← Stats bar
├─────────────────────────────────────────┤
│         [END & EARN 80 PTS]             │  ← Primary action
│           Keep Searching                │
└─────────────────────────────────────────┘
```

## Component Structure

```
MissionControlSimple.js (NEW - replaces V3)
├── CompactHeader (pet name, time, back)
├── FullScreenMap (fills viewport)
│   ├── Last seen marker
│   ├── Search path polyline
│   ├── User location dot
│   └── Sighting markers
├── BottomActionCard (floating)
│   ├── Primary CTA (Start/End Search)
│   └── Secondary actions (Sighting, Share)
└── ActiveSearchOverlay (when searching)
    ├── Live stats bar
    └── End search button
```

## Files to Create/Modify

### New Files
1. `app/mission-control/MissionControlSimple.js` - New single-page layout
2. `app/mission-control/components/CompactHeader.js` - Minimal header
3. `app/mission-control/components/BottomActionCard.js` - Floating actions
4. `app/mission-control/components/LiveSearchBar.js` - Active search stats

### Files to Modify
1. `app/mission-control/page.js` - Switch to MissionControlSimple
2. `app/components/mission/SARMapView.js` - Full viewport support

### Files to Keep (working well)
- `hooks/useSearchSession.js` - GPS tracking logic
- `hooks/useMissionControl.js` - State management
- `api/mission/[missionId]/search/route.js` - Backend GPS logic

### Files to Eventually Remove (cleanup)
- MissionControlV3.js
- MissionControlV4.js
- components/tabs/* (all tab components)
- components/modals/MissionsModal.js
- components/ContextBar.js

## Key Simplifications

1. **No tabs** - Everything on one screen
2. **No mission switcher** - Direct URL navigation only
3. **No expandable sections** - Pet details in header or modal
4. **Map is primary** - 70%+ of screen is map
5. **2 main actions max** - Start Search + Report Sighting
6. **Share via native share sheet** - Not a button

## CSS Strategy

```css
.mission-control {
  height: 100dvh; /* Dynamic viewport height for mobile */
  display: grid;
  grid-template-rows: 60px 1fr auto;
  overflow: hidden; /* NO SCROLLING */
}

.map-container {
  position: relative;
  overflow: hidden;
}

.bottom-card {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(transparent, rgba(0,0,0,0.9));
  padding: 1rem;
}
```

## Implementation Order

1. Create `MissionControlSimple.js` with basic layout
2. Create `CompactHeader.js`
3. Create `BottomActionCard.js`
4. Create `LiveSearchBar.js`
5. Modify `SARMapView.js` for full-screen mode
6. Wire up GPS tracking (reuse existing hooks)
7. Test on mobile
8. Clean up old files

## Success Criteria

- [ ] No scrolling required on any screen size
- [ ] Map visible at all times
- [ ] GPS tracking works seamlessly
- [ ] Can start/end search with one tap
- [ ] Can report sighting with one tap
- [ ] Stats visible during active search
- [ ] Works offline (GPS pings queue)
