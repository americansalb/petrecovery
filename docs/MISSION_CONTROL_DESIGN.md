# Mission Control UI Redesign

## Vision
A search and rescue coordination interface that feels like a **real-time operations center**, not a static information page. The map IS the interface. Every element serves one purpose: **getting lost pets home faster**.

---

## Design Principles

1. **Map-First** - The map occupies 60-70% of the screen. Everything else supports it.
2. **Real-Time** - Updates every 10 seconds. Activity feed shows what's happening NOW.
3. **One-Tap Actions** - Join a search, report a sighting, broadcast an alert - all one tap.
4. **Urgency Visualization** - Time-based color coding. Red = critical, Yellow = active, Green = resolved.
5. **Social Proof** - Show who's searching, where they are, what they've found. Build momentum.

---

## Layout: Desktop

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ◀ MISSION CONTROL          Streamwood Rescue Force          [Kevin] ▼     │
│     3 active searches • 5 volunteers online • Last activity: 2 min ago    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                    │                       │
│                                                    │  ACTIVE CASES         │
│                                                    │  ────────────────     │
│                                                    │                       │
│                     L I V E   M A P                │  🔴 MAX (Dog)         │
│                                                    │  Missing 2 hours      │
│                     [Interactive Leaflet]          │  Oak & Main St        │
│                                                    │  0.3 mi away          │
│     🐕 = Lost Pet                                  │  👥 3 searching       │
│     👤 = Volunteer                                 │  [JOIN SEARCH]        │
│     📍 = Sighting                                  │                       │
│     🎯 = Your Position                             │  ─────────────────    │
│                                                    │                       │
│                                                    │  🟡 BELLA (Cat)       │
│                                                    │  Missing 8 hours      │
│                                                    │  Elm Street           │
│                                                    │  1.2 mi away          │
│                                                    │  👥 1 searching       │
│                                                    │  [JOIN SEARCH]        │
│                                                    │                       │
├────────────────────────────────────────────────────┴───────────────────────┤
│  LIVE ACTIVITY                                                             │
│  ──────────────────────────────────────────────────────────────────────    │
│  🟢 2 min ago   Sarah reported sighting: "Saw orange tabby near Oak Park"  │
│  🔵 5 min ago   John started searching sector 3                            │
│  🟠 12 min ago  NEW CASE: Orange tabby "Mango" last seen Main St           │
│  🟢 18 min ago  Area cleared: North side of Washington Park                │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   [📍 REPORT SIGHTING]      [📢 BROADCAST ALERT]      [🆘 REQUEST HELP]   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Layout: Mobile (Primary Use Mission)

```
┌─────────────────────────┐
│ ◀ MISSION CONTROL       │
│ Streamwood • 3 active   │
├─────────────────────────┤
│                         │
│                         │
│      L I V E   M A P    │
│                         │
│    (70% of screen)      │
│                         │
│     🐕        👤        │
│          📍            │
│      🎯                 │
│                         │
├─────────────────────────┤
│ 🔴 MAX - 0.3 mi         │
│ Dog • Missing 2 hours   │
│ [  JOIN SEARCH NOW  ]   │
├─────────────────────────┤
│ Latest: Sarah spotted   │
│ tabby near Oak Park 2m  │
├─────────────────────────┤
│ [📍 Sighting] [📢 Alert]│
└─────────────────────────┘
```

---

## Component Breakdown

### 1. Status Bar (Top)
- Squad name + location
- Active searches count
- Volunteers online
- Last activity timestamp
- User avatar/menu

### 2. Live Map (Hero - 60% of viewport)
**Markers:**
- 🔴 **Lost Pet (Critical)** - Missing < 4 hours, bright red pulse
- 🟠 **Lost Pet (Active)** - Missing 4-24 hours
- 🟡 **Lost Pet (Extended)** - Missing > 24 hours
- 🟢 **Found/Resolved** - Fades after 1 hour
- 👤 **Active Volunteer** - Blue dot, shows direction facing
- 📍 **Sighting** - Yellow pin with timestamp
- 🎯 **Your Position** - Pulsing blue circle

**Interactions:**
- Tap pet marker → Slide-up detail card with photo + "Join Search"
- Tap sighting → Show sighting details + "I see this too"
- Tap volunteer → Show name + "Message"
- Long-press → Report sighting at location

### 3. Active Missions Panel (Right sidebar / Bottom sheet on mobile)
- Sorted by: Urgency → Distance
- Each mission shows:
  - Pet photo (circular, 48px)
  - Pet name + species
  - Time missing (with urgency color)
  - Distance from user
  - Active searcher count
  - **[JOIN SEARCH]** button (primary CTA)

### 4. Activity Feed (Bottom)
- Real-time updates (WebSocket/SSE or 10s polling)
- Types:
  - 🟢 Sighting reported
  - 🔵 Volunteer joined/left search
  - 🟠 New mission added
  - ✅ Area cleared
  - 🎉 Pet found! (celebration animation)

### 5. Quick Action Bar (Fixed bottom)
- **Report Sighting** - Opens camera + location picker
- **Broadcast Alert** - Send push to all squad volunteers
- **Request Help** - Alert nearby volunteers

---

## Color System

| State | Color | Hex | Usage |
|-------|-------|-----|-------|
| Critical | Red | #DC2626 | < 4 hours missing |
| Active | Orange | #F59E0B | 4-24 hours missing |
| Extended | Yellow | #EAB308 | > 24 hours missing |
| Resolved | Green | #22C55E | Found/reunited |
| Volunteer | Blue | #3B82F6 | Active searchers |
| Sighting | Purple | #8B5CF6 | Reported sightings |

---

## Data Requirements

### Real-time Updates Needed:
1. Volunteer positions (if location sharing enabled)
2. New sightings
3. Mission status changes
4. New missions in radius
5. Volunteer join/leave events

### API Endpoints Needed:
- `GET /api/squads/[id]/live-feed` - Activity stream (SSE or polling)
- `GET /api/squads/[id]/nearby-missions` - Missions within radius ✅ (created)
- `POST /api/squads/[id]/sightings` - Report sighting
- `POST /api/squads/[id]/volunteer-status` - Update position/status
- `GET /api/squads/[id]/active-volunteers` - Who's searching

---

## Implementation Phases

### Phase 1: Core Layout (Today)
- [ ] Replace current squad page with map-first layout
- [ ] Full-screen interactive map with proper markers
- [ ] Active missions sidebar/bottom sheet
- [ ] Basic activity feed (polling)

### Phase 2: Real-Time (Next)
- [ ] Volunteer position tracking (optional)
- [ ] Live activity feed (SSE or WebSocket)
- [ ] Sighting reporting with camera
- [ ] Push notifications integration

### Phase 3: Coordination (Then)
- [ ] Search zone assignment
- [ ] Area clearing confirmation
- [ ] In-app messaging
- [ ] Voice notes for sightings

---

## Success Metrics

1. **Time to First Action** - How quickly does a volunteer join a search?
2. **Sightings per Mission** - Are volunteers actively reporting?
3. **Volunteer Retention** - Do they come back?
4. **Missions Resolved** - Pets reunited with owners

---

## Inspiration

- Uber driver app (map-first, real-time)
- Waze (community reporting)
- Emergency dispatch systems
- Pokémon GO (gamified location awareness)

The goal: When someone opens this page, they should **immediately understand** what's happening and **know exactly what to do**.
