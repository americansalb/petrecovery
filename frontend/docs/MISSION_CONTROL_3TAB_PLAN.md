# Mission Control: 5-Tab → 3-Tab Simplification Plan

## Executive Summary

This plan consolidates Mission Control from 5 tabs to 3 tabs while preserving 100% of features. The goal is to reduce cognitive load for stressed pet owners while maintaining full functionality.

**Current:** Home | Search | Team | Actions | Tips (5 tabs)
**Proposed:** Home | Map | Team (3 tabs)

---

## The 3-Tab Structure

### Tab 1: HOME
**Purpose:** Landing pad, at-a-glance info, primary actions
**Mental Model:** "What's happening and what should I do first?"

| Section | Content | Source |
|---------|---------|--------|
| Pet Card | Photo, name, breed, color, last seen | Existing |
| Urgency Banner | Time missing + phase-specific advice | Existing + Tips |
| Stats Grid | Sightings, Team members, Active searchers | Existing |
| Primary CTA | "Start GPS Search" button | Existing |
| Quick Actions | Report Sighting, Share Case | Existing |
| **Contextual Tip** | 1-2 time-phase bullets | **NEW from Tips** |

**Contextual Tip Logic:**
```javascript
// Show tip based on hours missing
if (hours < 24) → "Search your home thoroughly first"
if (hours < 72) → "Expand search radius, contact shelters"
if (hours < 168) → "Search at dawn/dusk, use humane trap"
else → "Don't give up! Refresh flyers & posts"
```

---

### Tab 2: MAP
**Purpose:** The action - visual search coordination, GPS tracking
**Mental Model:** "Where am I searching and where have others looked?"

| Section | Content | Source |
|---------|---------|--------|
| Full Map | Interactive Leaflet map | Existing |
| Last Seen Marker | Red pin at last known location | Existing |
| Sighting Markers | Color-coded by recency | Existing |
| Coverage Trails | Team's historical search paths | Existing |
| Probability Zones | Research-based likelihood heatmap | Existing |
| POI Markers | Shelters, vets, animal control | Existing |
| GPS Controls | Start/End search, live path | Existing |
| Stats Overlay | Duration, distance, points (when searching) | Existing |
| **Contextual Tip** | Search pattern tip (dismissible) | **NEW from Tips** |

**Contextual Tip Logic (species-aware):**
```javascript
// Show on first map view, dismissible
if (species === 'CAT') → "Cats hide within 3-5 houses. Search close first!"
if (species === 'DOG') → "Dogs travel 2-5 miles/day in one direction"
```

---

### Tab 3: TEAM
**Purpose:** People, coordination, outreach, getting help
**Mental Model:** "Who's helping and how do I get more help?"

| Section | Content | Source |
|---------|---------|--------|
| **Team Members** | Horizontal scroll, status indicators | From Team tab |
| Active Badge | "X people searching now" | From Team tab |
| **Live Chat** | Real-time messages | From Team tab |
| Quick Messages | Emoji shortcuts (🔍👁🆘✅) | From Team tab |
| Location Share | Send GPS link to chat | From Team tab |
| **Share Section** | Facebook, Nextdoor, X, Instagram buttons | **From Actions** |
| **Flyers** | Download & Print button | **From Actions** |
| **Shelters** | Nearby list with call/copy | **From Actions** |
| **Contextual Tip** | Outreach advice | **NEW from Tips** |

**Contextual Tip Logic:**
```javascript
// Rotate tips in section headers
shareSection → "Nextdoor reaches neighbors fastest"
shelterSection → "Call daily - new animals arrive constantly"
```

---

## Tips Distribution Strategy

Instead of a dedicated Tips tab, tips become **contextual hints** woven into each tab:

### Home Tab: Time-Phase Banner
```
┌─────────────────────────────────────┐
│ ⚠️ First 24 Hours - Critical        │
│                                     │
│ • Search your home first            │
│ • Alert neighbors immediately       │
│ • Post on Nextdoor now              │
└─────────────────────────────────────┘
```

### Map Tab: Dismissible Hint
```
┌─────────────────────────────────────┐
│ 💡 Cats hide within 3-5 houses   ✕ │
│    Search VERY close first          │
└─────────────────────────────────────┘
```

### Team Tab: Section Headers
```
┌─ Share Section ─────────────────────┐
│ 💡 Nextdoor posts reach 80% of     │
│    nearby neighbors                 │
├─────────────────────────────────────┤
│ [FB] [Nextdoor] [X] [Instagram]    │
└─────────────────────────────────────┘
```

---

## Mobile Layout (< 1024px)

```
┌─────────────────────────────────────┐
│ CompactHeader (60px)                │
│ [← Back] [Pet Name] [Time] [Menu]   │
├─────────────────────────────────────┤
│ GPS Banner (if searching, 40px)     │
├─────────────────────────────────────┤
│                                     │
│  Content Area                       │
│  ├─ Home → OverviewPanel           │
│  ├─ Map  → SARMapView (fullscreen) │
│  └─ Team → TeamPanel               │
│                                     │
├─────────────────────────────────────┤
│ BottomNav (3 tabs)                  │
│ [🏠 Home] [🗺️ Map] [👥 Team]        │
└─────────────────────────────────────┘
```

**Behavior:**
- Home: OverviewPanel covers map, scrollable
- Map: Map fullscreen with GPS controls at bottom
- Team: TeamPanel covers map, scrollable with sections

---

## Desktop Layout (≥ 1024px)

```
┌─────────────────────────────────────────────────────────┐
│ CompactHeader (60px)                                    │
├─────────────────────────────────────────────────────────┤
│ GPS Banner (if searching)                               │
├───────────────────────────────────┬─────────────────────┤
│                                   │ Tab Nav             │
│                                   │ [Overview] [Team]   │
│                                   ├─────────────────────┤
│  SARMapView                       │                     │
│  (always visible)                 │  Sidebar Panel      │
│                                   │  (420px)            │
│                                   │                     │
│                                   │  ├─ OverviewPanel   │
│  [Contextual tip overlay]         │  └─ TeamPanel       │
│                                   │                     │
│                                   │                     │
└───────────────────────────────────┴─────────────────────┘
```

**Behavior:**
- Map always visible on left (no "Map" tab in sidebar)
- Sidebar toggles between Overview and Team
- Mobile "Map" tab = Desktop focuses map (sidebar stays)

---

## Component Changes Required

### New Components

#### 1. `ContextualTip.js`
Reusable dismissible tip banner.

```javascript
// Props
{
  icon: LucideIcon,
  tip: string,
  variant: 'info' | 'warning' | 'success',
  dismissible: boolean,
  storageKey: string, // For remembering dismissal
  onDismiss: () => void
}

// Usage
<ContextualTip
  icon={Lightbulb}
  tip="Cats hide within 3-5 houses. Search close first!"
  variant="info"
  dismissible
  storageKey="tip_cat_search_pattern"
/>
```

#### 2. `TeamPanel.js`
Merged Team + Actions panel with sections.

```javascript
// Structure
<TeamPanel>
  {/* Team Section */}
  <TeamMembersList />
  <ActiveSearcherBadge />

  {/* Chat Section */}
  <ChatMessages />
  <QuickMessageButtons />
  <ChatInput />

  {/* Share Section */}
  <ContextualTip tip="Nextdoor reaches neighbors fastest" />
  <ShareButtons />
  <FlyerDownload />

  {/* Shelters Section */}
  <ContextualTip tip="Call daily - new animals arrive" />
  <SheltersList />
</TeamPanel>
```

### Modified Components

#### 1. `MissionControlSimple.js`
- Change tab state from 5 options to 3
- Update renderMobileLayout() for 3 tabs
- Update desktop sidebar for 2 panels (Overview, Team)
- Remove ActionsPanel and TipsPanel renders

#### 2. `BottomNav.js`
- Reduce NAV_ITEMS from 5 to 3
- Update icons: Home (🏠), Map (🗺️), Team (👥)
- Keep live indicator on Map when GPS active

```javascript
const NAV_ITEMS = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'map', icon: Map, label: 'Map' },   // was 'search'
  { id: 'team', icon: Users, label: 'Team' }, // was 'team'
];
```

#### 3. `OverviewPanel.js`
- Add ContextualTip component for time-phase advice
- Keep all existing content
- Update "Find Shelters" link to go to Team tab

#### 4. `TeamChatPanel.js`
- Rename to `ChatSection.js` (used inside TeamPanel)
- Remove team members list (moved to top of TeamPanel)
- Keep chat functionality intact

### Deprecated Components

| Component | Replacement |
|-----------|-------------|
| `ActionsPanel.js` | Merged into `TeamPanel.js` |
| `TipsPanel.js` | Distributed as `ContextualTip` instances |

---

## Data Flow Changes

### No Backend Changes Required
All data sources remain the same:
- useMissionControl (mission, team, sightings)
- useSearchSession (GPS tracking)
- useMissionChat (messages)
- useSearchCoverage (trails)
- usePOIs (shelters)

### New Local State

```javascript
// In MissionControlSimple.js
const [dismissedTips, setDismissedTips] = useState(() => {
  // Load from localStorage
  return JSON.parse(localStorage.getItem('dismissedTips') || '{}');
});

// Helper to check if tip should show
const shouldShowTip = (tipId) => !dismissedTips[tipId];

// Handler to dismiss
const dismissTip = (tipId) => {
  const updated = { ...dismissedTips, [tipId]: true };
  setDismissedTips(updated);
  localStorage.setItem('dismissedTips', JSON.stringify(updated));
};
```

---

## Feature Mapping (5 → 3 tabs)

| Feature | Old Location | New Location |
|---------|--------------|--------------|
| Pet card | Home | Home |
| Time missing | Home | Home |
| Stats grid | Home | Home |
| Start GPS Search | Home | Home + Map |
| Report Sighting | Home | Home (+ Map header) |
| Share Case | Home + Actions | Home + Team |
| Find Shelters | Home + Actions | Team |
| Full map | Search | Map |
| GPS tracking | Search | Map |
| Live overlay | Search | Map |
| Sighting markers | Search | Map |
| Coverage trails | Search | Map |
| Probability zones | Search | Map |
| Team members | Team | Team |
| Live chat | Team | Team |
| Quick messages | Team | Team |
| Location share | Team | Team |
| Share buttons | Actions | Team |
| Flyer download | Actions | Team |
| Shelter list | Actions | Team |
| Search pattern tips | Tips | Map (contextual) |
| Time-based advice | Tips | Home (contextual) |
| Attracting tips | Tips | Team (contextual) |
| When spotted tips | Tips | Map (contextual) |

**Result:** 100% feature preservation, 40% tab reduction

---

## Navigation Behavior

### Mobile Navigation
| From | To | Trigger |
|------|-----|---------|
| Any | Home | Tap Home tab |
| Any | Map | Tap Map tab |
| Any | Team | Tap Team tab |
| Home | Map | Tap "Start GPS Search" |
| Home | Team | Tap "Find Shelters" |
| Map | Home | End search → auto-navigate |

### Desktop Navigation
| From | To | Trigger |
|------|-----|---------|
| Overview | Team | Click Team tab |
| Team | Overview | Click Overview tab |
| Any | Map focus | Click on map area |

---

## Animation & Transitions

### Tab Switches
- Fade transition (200ms) between panels
- Map stays mounted (opacity toggle on mobile)
- No layout shift

### Contextual Tips
- Slide down on appear (300ms)
- Fade out on dismiss (200ms)
- Remember dismissal in localStorage

### TeamPanel Sections
- Collapsible sections with smooth height transition
- Section headers always visible

---

## Accessibility Considerations

1. **Tab Order:** Home → Map → Team (logical flow)
2. **ARIA Labels:** Update for new tab names
3. **Focus Management:** Focus first interactive element on tab switch
4. **Screen Reader:** Announce tab changes
5. **Reduced Motion:** Respect prefers-reduced-motion

---

## Testing Checklist

### Functional Tests
- [ ] All Home features work
- [ ] GPS tracking starts/stops correctly
- [ ] Chat messages send/receive
- [ ] Share buttons trigger native share
- [ ] Flyer download works
- [ ] Shelter phone links work
- [ ] Tips appear in correct contexts
- [ ] Tips can be dismissed
- [ ] Dismissed tips stay dismissed (localStorage)

### Responsive Tests
- [ ] Mobile 3-tab nav works
- [ ] Desktop sidebar works
- [ ] Map visible on desktop during all tabs
- [ ] Keyboard height handling (mobile chat)
- [ ] Safe area insets (notched phones)

### Edge Cases
- [ ] No sightings state
- [ ] No team members state
- [ ] GPS permission denied
- [ ] Offline mode
- [ ] Very long pet names

---

## Implementation Order

### Phase 1: Foundation (Day 1)
1. Create `ContextualTip.js` component
2. Create `TeamPanel.js` with sections
3. Extract `ChatSection.js` from TeamChatPanel

### Phase 2: Integration (Day 2)
4. Modify `BottomNav.js` (5 → 3 tabs)
5. Modify `MissionControlSimple.js` mobile layout
6. Modify `MissionControlSimple.js` desktop layout
7. Update `OverviewPanel.js` with contextual tip

### Phase 3: Tips Distribution (Day 3)
8. Add map contextual tip (species-aware)
9. Add team section tips (share, shelters)
10. Implement tip dismissal with localStorage

### Phase 4: Polish (Day 4)
11. Animation/transition refinement
12. Accessibility audit
13. Testing on devices
14. Fix edge cases

---

## Rollback Plan

Keep existing components until new structure is stable:
- `ActionsPanel.js` → Archive, don't delete
- `TipsPanel.js` → Archive, don't delete
- `BottomNav.js` → Keep 5-tab version in git history

Feature flag option:
```javascript
const USE_3_TAB_LAYOUT = process.env.NEXT_PUBLIC_USE_3_TAB_LAYOUT === 'true';
```

---

## Success Metrics

1. **Cognitive Load:** Users find features faster (qualitative)
2. **Time to Action:** Reduced time to start first GPS search
3. **Feature Discovery:** Shelter calling rate maintained
4. **User Feedback:** No "where did X go?" complaints

---

## Open Questions

1. **Desktop Map Tab:** Should clicking map in nav collapse sidebar for full-screen map?
2. **Tip Frequency:** How often should dismissed tips reappear? (Never? After 7 days?)
3. **Team Tab Name:** "Team" vs "Team" vs "Help" vs "Squad"?

---

## Appendix: Tab Icons

| Tab | Icon | Lucide Name |
|-----|------|-------------|
| Home | 🏠 | `Home` |
| Map | 🗺️ | `Map` |
| Team | 👥 | `Users` |

Or with filled variants for active state:
- Home: `Home` → `HomeFilled` (custom)
- Map: `Map` → `MapPin` when searching
- Team: `Users` → `UsersRound` (custom)

---

*Plan Version: 1.0*
*Created: 2024*
*Author: Claude (Planning Agent)*
