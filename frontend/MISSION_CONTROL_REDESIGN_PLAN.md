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
│  [< Back]     CURRY     [⏱ 2hr] [•••]  │  ← Compact header (60px)
│              Lost • Brown               │     Menu = pet details, share
├─────────────────────────────────────────┤
│                                         │
│                                         │
│              FULL MAP                   │  ← Map fills remaining space
│          (satellite view)               │     ~70% of screen
│                                         │
│     📍 Last Seen                        │
│     ═══ Your search path                │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  ╔════════════════════════════════════╗ │  ← Bottom panel (expandable)
│  ║  [👁]  [📍]  [📤]  [📝]  [•••]   ║ │     Quick Actions bar (icons)
│  ╠════════════════════════════════════╣ │     Tap ••• for more actions
│  ║  🚀 START GPS SEARCH              ║ │
│  ║  GPS-tracked • 100pts/mile        ║ │     Primary CTA always visible
│  ╚════════════════════════════════════╝ │
└─────────────────────────────────────────┘
```

## Quick Actions Bar (Extensible)

```
Default actions (4 icons + more):
[👁 Sighting] [📍 Last Seen] [📤 Share] [📝 Log] [•••]

Expandable "More" drawer:
┌─────────────────────────────────┐
│  🏠 Pet Details                 │
│  📊 View Activity               │
│  🗺️ Street View                │
│  👥 Message Team                │
│  📋 Case Notes                  │
│  ⚙️ Settings                    │
└─────────────────────────────────┘
```

This pattern allows adding new features without redesigning the layout.

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
├── CompactHeader (pet name, time, back, menu)
├── FullScreenMap (fills viewport)
│   ├── Last seen marker
│   ├── Search path polyline
│   ├── User location dot
│   └── Sighting markers
├── BottomPanel (extensible)
│   ├── QuickActions (icon bar + more menu)
│   └── Primary CTA (Start/End Search)
└── ActiveSearchOverlay (when searching)
    ├── Live stats bar
    └── End search button
```

## Files to Create/Modify

### New Files
1. `app/mission-control/MissionControlSimple.js` - New single-page layout
2. `app/mission-control/components/simple/CompactHeader.js` - Minimal header with menu
3. `app/mission-control/components/simple/QuickActions.js` - Extensible icon action bar
4. `app/mission-control/components/simple/BottomPanel.js` - Expandable panel
5. `app/mission-control/components/simple/LiveSearchOverlay.js` - Active search UI

### Files to Modify
1. `app/mission-control/page.js` - Switch to MissionControlSimple
2. `app/components/mission/SARMapView.js` - Full viewport support

### Files to Keep (working well)
- `hooks/useSearchSession.js` - GPS tracking logic (excellent!)
- `hooks/useMissionControl.js` - State management
- `api/mission/[missionId]/search/route.js` - Backend GPS logic
- `components/modals/SightingFormModal.js` - Sighting form (reuse)

### Files to Eventually Remove (cleanup)
- MissionControlV3.js
- MissionControlV4.js
- components/tabs/* (all tab components)
- components/modals/MissionsModal.js
- components/ContextBar.js

## Key Simplifications

1. **No tabs** - Everything on one screen
2. **No mission switcher** - Direct URL navigation only
3. **No expandable sections** - Pet details in slide-out menu
4. **Map is primary** - 70%+ of screen is map
5. **Icon-based actions** - Compact, extensible
6. **One primary CTA** - Start Search or End Search

## Extensibility Patterns

### Adding a New Quick Action
```javascript
// In QuickActions.js, just add to the actions array:
const actions = [
  { id: 'sighting', icon: Eye, label: 'Sighting', action: onSighting },
  { id: 'share', icon: Share, label: 'Share', action: onShare },
  // Add new action here:
  { id: 'streetview', icon: MapPin, label: 'Street View', action: onStreetView },
];
```

### Adding a New Panel Feature
```javascript
// In BottomPanel.js, add to the "more" menu:
const moreActions = [
  { id: 'details', icon: Home, label: 'Pet Details' },
  { id: 'activity', icon: Activity, label: 'View Activity' },
  // Add new feature here:
  { id: 'notes', icon: FileText, label: 'Case Notes' },
];
```

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

.bottom-panel {
  position: relative;
  background: linear-gradient(transparent, rgba(0,0,0,0.95));
  padding: 1rem;
  padding-bottom: env(safe-area-inset-bottom, 1rem);
}

.quick-actions {
  display: flex;
  justify-content: space-around;
  padding: 0.5rem 0;
}

.quick-action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem;
  border-radius: 0.5rem;
  transition: background 0.2s;
}
```

## Implementation Order

1. Create `MissionControlSimple.js` with basic layout
2. Create `CompactHeader.js` with menu trigger
3. Create `QuickActions.js` (extensible icon bar)
4. Create `BottomPanel.js` (combines actions + CTA)
5. Create `LiveSearchOverlay.js` for active search
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
- [ ] Easy to add new actions without layout changes
- [ ] Pet details accessible from header menu
