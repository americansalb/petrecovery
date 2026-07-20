# Mission Control — 2026-07 redesign

Ground-up rebuild of the `/mission-control` presentation layer. Same doctrine
as before — **the map is the mission**, state not navigation, one mission /
three instruments — executed so that a first-time helper knows what to do in
five seconds without being taught anything.

The data layer (`hooks/*`, `useInstrument`, the `mission/*` + `missions/*`
APIs) is untouched. Only what the eye touches was rebuilt.

## Why the old screen felt like homework

Verified against live captures (2026-07-20, seeded `AUS-2026-0001`):

1. **A 56px dead band under the header.** `MissionShell` put the map inside a
   `flex-1` container *below* the header, and `MapCanvas` then offset itself
   `top-14` again — a double offset rendered as a black stripe on every device.
2. **Everything shouted at once.** Left panel, right rail, a floating Legend
   pill, a green "Hide Zones" pill, an "Adjust Zone" pill, and a control
   cluster — seven glass boxes of equal weight. No "start here."
3. **The washed-out satellite basemap fought every overlay.** Teal zone on
   yellow-green imagery, with `fillOpacity: 0.35` hardcoded in `SARMapView` —
   ignoring the per-zone opacities `searchProbability.js` computes.
4. **Tool words instead of human words.** "Legend", "Zones", "Log it",
   octant popups. GIS software voice, not "here's how you help."
5. **The one help-me path was buried.** Share / flyer / shelters / sighting
   lived in different tabs, cards, and rows with no ranking and no sense of
   progress.

## The three questions

Every state of the screen must answer, in order, at a glance:

1. **What's happening?** — one plain sentence, always current
   (the *situation line*, derived from `useMissionState`).
2. **What should I do right now?** — exactly ONE yellow button
   (the *ActionDock* primary), then a ranked "Ways to help" checklist
   with visible done-states. Never two yellow things on screen.
3. **Where?** — the map, edge-to-edge under everything, dark cartography
   so the mission layers are the brightest objects on screen.

If a control doesn't serve one of the three questions it lives inside the
**Map key** (map furniture) or the **Operations rail** (coordinator tools).

## Visual language: the flashlight in the dark

The brand is midnight blue + flashlight yellow ("every lost pet deserves a
search party"). Mission Control now renders that literally:

- **Basemap defaults to dark cartography** (CARTO dark). Street names stay
  readable at night-search zoom levels; satellite remains one tap away.
- **The likely area is the flashlight beam**: research zones keep their
  meaning (HIGH→EXTENDED) but render as a warm amber-to-ember gradient with
  the library's own per-zone opacities — a glow, not a paint spill.
- **One accent per meaning, everywhere**: flash-yellow = "act", amber =
  fresh sighting, emerald = reunited/positive-terminal only, red = last-seen
  beacon + urgent, slate = chrome. No teal, no purple corridors on this
  surface (coverage trails render slate-blue, quiet).

## Layout

### Command (desktop ≥1024px)
- Header 56px: Exit · pet identity · state chip. Map starts at y=56 exactly.
- **Mission panel** (left, 400px): pet hero → vitals band → situation line +
  primary action → "Ways to help" checklist → latest activity. Owner gets the
  "Mark as reunited" anchor at the bottom of the brief, always reachable.
- **Operations rail** (right, 340px): Activity / Chat / Tasks / Shelters as a
  proper segmented control with counts; "Add note" composer lives in Activity.
- **Map furniture**: one control stack top-right (layers, locate, fit, zoom);
  one **Map key** chip bottom-right that expands into: legend rows + "Likely
  area" toggle + size slider + "Shelters & vets" pin toggle. Nothing else
  floats on the map.

### Bridge (mobile web) / Field (native app)
- Same header; map full-bleed behind a three-detent bottom sheet (mechanics
  unchanged).
- **Peek** = situation line + vitals + the primary (LiveSearchHUD replaces it
  during a GPS leg). **Half** adds the checklist + pet brief. **Full** adds
  team, chat, shelters.
- Field keeps GPS legs as its primary; bridge keeps the honest app card.

### State theater
- `SIGHTING_HOT` → full-width amber banner directly under the header
  ("Sighted 12m ago near Barton Springs · Show me"); map auto-focuses (kept).
- `REUNITED` → chip goes home-safe green, dock becomes the celebration entry,
  checklist and composer hide, share becomes "share the good news".
- First visit (non-owner) → the 10-second brief overlay stays (face, place,
  the don't-chase rule, one button) — polished, and skippable by backdrop tap.

## Copy voice

Plain, warm, verb-first. Renames: Legend → **Map key** · Search Zones →
**Likely area** · "Hide/Adjust Zone" → toggle + slider inside the Map key ·
"Log it" → **Add note** · Log tab → **Activity**. The situation line owns
tone: "Nobody is out searching yet." / "3 people are searching right now." /
"The trail is fresh — sighted 12m ago."

## Component map (after)

```
app/mission-control/
  MissionShell.js            orchestrates hooks → regions (rewritten)
  components/
    MissionHeader.js         identity + state chip (rewritten)
    HotSightingBanner.js     NEW — the under-header amber banner
    MapCanvas.js             inset-0 map + furniture owner (rewritten)
    MapKey.js                NEW — legend + likely-area + POI toggles
    ActionDock.js            NEW — situation line + the one primary
    HelpChecklist.js         NEW — ranked ways-to-help w/ done-states
    PetBriefCard.js          NEW — face, chips, place, time, notes
    desktop/CommandPanel.js  mission panel (rewritten)
    desktop/OperationsRail.js segmented worktabs (rewritten)
    sheet/BottomSheet.js     mechanics kept, skin refreshed
    sheet/SheetPeek.js       situation + primary (rewritten)
    sheet/SheetBrief.js      checklist + brief + activity (rewritten)
    sheet/SheetTeam.js       presence + chat + shelters (rewritten)
    regions/                 MissionVitals (rewritten); ActivityLog,
                             ChatModule, TaskBoard, ShelterList,
                             PresenceStrip, WebGpsHint (kept, retouched)
    live/LiveSearchHUD.js    kept
    modals/SightingFormModal.js kept
    overlays/                HelperBriefOverlay (polished), MarkReunited,
                             ReunitedCelebration, ConfettiBurst (kept)
```

Deleted (dead since the MissionShell rebuild — nothing imported them from any
route): `MissionControlSimple.js`, `ActiveSearchScreen.js`, `DebugPanel.js`,
`ContextBar.js`, `MenuDrawer.js`, `components/simple/*`,
`components/modals/{MissionsModal,CustomActionModal,EmptyState,
AppDownloadPrompt,index}.js`, `regions/{PrimaryCTA,RallyRow,SightingBanner}.js`
(superseded by ActionDock / HelpChecklist / HotSightingBanner).

`SARMapView` (shared component) changes surgically: default layer is dark
streets, zone polygons honor `zone.fillOpacity`, zone colors flow through a
`zoneColorOverride` map, the last-seen marker becomes a pulsing beacon,
sighting pins drop the emoji-in-circle look, and the control stack gains
zoom in/out. `MapLegend` remains for other consumers; Mission Control renders
its own Map key.

## Rules this obeys

- `/mission-control` stays the only immersive route (`app/lib/navChrome.js`);
  the universal navbar policy and `__tests__/global-chrome.test.js` are
  untouched.
- No new routes, no schema, no API changes; deep links (`?action=sighting`,
  `?tab=flyer|boost`) keep working.
- 44px touch targets, `aria-label`s on icon buttons, one primary per screen,
  `prefers-reduced-motion` respected (CSS animations only + drag).
