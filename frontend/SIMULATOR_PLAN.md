# Lost Pet Simulator - Implementation Plan

## Status: Phase 2 Complete

Last updated after consultant feedback integration.

---

## Overview

A Monte Carlo simulation tool that predicts where lost pets are likely to be found. Run thousands of simulations to generate probability zones, then validate predictions against actual outcomes to improve accuracy over time.

---

## What's Built (Phases 1-2)

### Core Simulation Engine
- [x] Pet behavior state machine (FLEEING → HIDING → FORAGING → WANDERING → TERRITORIAL → SHELTERED)
- [x] State transitions based on energy, hunger, time of day, terrain zones
- [x] Species-specific parameters (dogs, cats, birds, other)
- [x] Size modifiers for movement speed
- [x] Personality modifiers (friendly, neutral, shy)
- [x] Homing behavior with species-specific weights
- [x] Human transport event for friendly dogs (good samaritan pickup)

### OSM Terrain Integration
- [x] Fetch OpenStreetMap data via Overpass API
- [x] Parse barriers: water (impassable), highways, busy roads, fences, buildings
- [x] Parse zones: parks, woods, commercial, residential
- [x] Zone modifiers affect behavior (hiding bonus, foraging bonus)
- [x] Barrier collision detection with alternative path finding
- [x] Terrain caching per location

### Search Strategies
- [x] GRID - Systematic cell coverage
- [x] SPIRAL - Expanding circles from center
- [x] RANDOM - Uncoordinated volunteer movement
- [x] PROBABILITY - Weighted toward likely zones

### Probabilistic Detection Model
- [x] Distance-based detection probability
- [x] Terrain visibility modifiers
- [x] Pet state modifiers (hiding = 0.1x, wandering = 1.0x)
- [x] Time of day modifiers
- [x] Searcher fatigue (diminishing returns after 2+ hours)

### Visual Playback
- [x] Interactive Leaflet map with click-to-set location
- [x] Animated pet marker with species-specific emoji
- [x] State-dependent animations (pulse for moving, fade for hiding)
- [x] Searcher markers with numbered indicators
- [x] Path trails during playback
- [x] Terrain overlay toggle (barriers + zones)
- [x] Probability zone circles (HIGH/MEDIUM/LOW/EXTENDED)

### Playback Controls
- [x] Play/Pause/Speed (1x, 2x, 5x, 10x, 50x)
- [x] Timeline scrubber with time display
- [x] Step forward/backward
- [x] Jump to find moment
- [x] Energy and hunger bars
- [x] Time of day indicator (dawn/day/dusk/night)
- [x] State display with colored badges
- [x] Event alerts (transport, outcome)

### Configuration UI
- [x] Species selection with behavior hints
- [x] Species-specific size options (no 90lb cats)
- [x] Personality/temperament selection
- [x] Initial state selection (how they got lost)
- [x] Indoor-only toggle (cats)
- [x] Microchip/collar toggles
- [x] Terrain type selection
- [x] Search radius slider with recommendations
- [x] Searcher count and strategy
- [x] Advanced settings (duration, time step, start hour)

### Batch Simulation
- [x] Run N simulations with same config
- [x] Aggregate statistics (success rate, avg time, outcomes)
- [x] Individual simulation storage for playback
- [x] Expandable batch groups in Results tab

### Analytics Dashboard
- [x] Success rate display
- [x] Outcome breakdown by type
- [x] Average/median time to find
- [x] Average pet distance traveled

---

## Outcome Categories (Simplified)

| Outcome | Description |
|---------|-------------|
| `FOUND_BY_SEARCHER` | Searcher detection event triggered |
| `RETURNED_HOME` | Pet reached home via homing behavior |
| `FOUND_VIA_SHELTER` | Pet transported, reunited via shelter/microchip |
| `FOUND_VIA_SOCIAL` | Pet transported, reunited via social media |
| `FOUND_VIA_PLATFORM` | Pet transported, reunited via our platform |
| `TIMEOUT_SEARCHING` | Max time, pet still mobile in search area |
| `TIMEOUT_SHELTERED` | Max time, pet sheltered but not matched |

**Note:** For MVP, `FOUND_VIA_SHELTER`, `FOUND_VIA_SOCIAL`, and `FOUND_VIA_PLATFORM` can be combined into `FOUND_OTHER` until we have data to calibrate the split.

---

## Phase 3: Remaining Work

### 3.1 Heatmap Overlay
- [ ] Aggregate "where pets were found" across batch simulations
- [ ] Render as heatmap layer on map
- [ ] Compare predicted zones vs. actual find locations

### 3.2 Connect to Lost Pet Reports
- [ ] Load config from actual LostPetReport data
- [ ] Pre-fill location, pet species/size, time lost
- [ ] Save simulation results linked to case
- [ ] Show predictions on case detail page

### 3.3 Recovery Guidance (Content, Not Code)
Add user-facing guidance based on simulation results:
- Optimal search times (dawn/dusk)
- Focus areas based on terrain
- When to check shelters (after 24-48h)
- Scent/sound strategies for hiding pets

This is **content** displayed alongside predictions, not simulation logic.

---

## Phase 4: Calibration System

### 4.1 Data Collection
- [ ] Add "found location" field to case resolution
- [ ] Track how pet was found (search, trap, returned, shelter, social)
- [ ] Record time elapsed from report to reunion

### 4.2 Validation Pipeline
- [ ] For resolved cases, compare actual find location to predicted zones
- [ ] Calculate zone accuracy rates by pet type
- [ ] Identify systematic biases (e.g., "cats found closer than predicted")

### 4.3 Parameter Adjustment
```
For each pet category:
  1. Collect resolved cases
  2. Calculate actual displacement distribution
  3. Compare to model prediction
  4. Adjust base_radius parameters
  5. Re-run batch to verify improvement
```

### 4.4 Accuracy Dashboard
- [ ] Display current model accuracy by category
- [ ] Show sample size and confidence level
- [ ] Alert when accuracy drops below threshold

---

## Deferred (V2+)

These are good ideas but add complexity without immediate value:

| Feature | Reason to Defer |
|---------|-----------------|
| Bayesian probability updates | Requires search session tracking; core predictions work without it |
| Confidence intervals | Need significant sample sizes to be meaningful |
| Weather API integration | Nice-to-have, not blocking |
| Multi-pet simulations | Edge case, handle later |
| Trap placement optimization | Separate feature |

---

## Key Parameters (Research-Based)

| Parameter | Value | Source | Confidence |
|-----------|-------|--------|------------|
| Indoor cat displacement (24h) | 3-5 houses | MARN/Albrecht | HIGH |
| Outdoor cat displacement (24h) | 0.3-0.5 mi | MARN | MEDIUM |
| Small dog displacement (24h) | 0.3-0.5 mi | Estimated | LOW |
| Medium dog displacement (24h) | 0.5-1.5 mi | Estimated | LOW |
| Large dog displacement (24h) | 1-3 mi | Estimated | LOW |
| Friendly dog pickup rate | 5-15%/day | Estimated | LOW |
| Cat hiding probability | 75% within 5 houses | MARN | HIGH |
| Dog homing attempt rate | 60%/day | Reunion data | MEDIUM |

**LOW confidence parameters will be refined through Phase 4 calibration.**

---

## File Structure

```
frontend/app/
├── simulator/
│   ├── page.js                    # Main page ✓
│   └── components/
│       ├── SimulatorConfig.js     # Config form ✓
│       ├── SimulatorMap.js        # Leaflet map ✓
│       ├── PlaybackControls.js    # Animation controls ✓
│       ├── SimulationList.js      # Results list ✓
│       └── BatchResults.js        # Analytics ✓
│
├── api/simulator/
│   ├── route.js                   # Single simulation ✓
│   └── batch/route.js             # Batch simulation ✓
│
└── lib/simulator/
    ├── engine.js                  # Core engine ✓
    ├── petBehavior.js             # Pet state machine ✓
    ├── searcherBehavior.js        # Search strategies ✓
    ├── detection.js               # Detection model ✓
    ├── terrain.js                 # OSM integration ✓
    └── utils.js                   # Helpers ✓
```

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Zone accuracy | >60% finds in predicted HIGH zone | Phase 4 validation |
| User engagement | Users run simulations for active cases | Analytics |
| Reunion rate improvement | Higher than baseline | A/B test with/without predictions |

---

## Next Steps

1. **Phase 3.2** - Connect to actual lost pet reports (highest value)
2. **Phase 3.1** - Add heatmap visualization
3. **Phase 3.3** - Add recovery guidance content
4. **Phase 4** - Begin calibration once we have 50+ resolved cases with location data
