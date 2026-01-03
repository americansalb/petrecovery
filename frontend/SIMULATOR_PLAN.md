# Lost Pet Simulator - Implementation Plan

## Status: Phase 3 Complete (Standalone)

Last updated: Phase 3.1 (Heatmap) and 3.3 (Recovery Guidance) complete.
Phase 3.2 (Connect to Reports) deferred until main app stabilizes.

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

## Phase 3: Standalone Features

### 3.1 Heatmap Overlay ✓
- [x] Aggregate "where pets were found" across batch simulations
- [x] Render as heatmap layer on map (density-based coloring)
- [x] Toggle button and legend for heatmap display
- [x] Individual find markers with outcome-based colors

### 3.2 Connect to Lost Pet Reports (DEFERRED)
Deferred until main web app stabilizes to avoid fragile connections.
- [ ] Load config from actual LostPetReport data
- [ ] Pre-fill location, pet species/size, time lost
- [ ] Save simulation results linked to case
- [ ] Show predictions on case detail page

### 3.3 Recovery Guidance ✓
- [x] Species-specific tips (dogs, cats, birds)
- [x] Personality-aware strategies (friendly, neutral, shy)
- [x] Time-based phase guidance (immediate, 24h, 72h, extended)
- [x] Terrain-specific focus areas
- [x] Attraction methods and warnings
- [x] Night search tips for cats/shy pets
- [x] Integration with batch results insights

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
│       ├── SimulatorMap.js        # Leaflet map + heatmap ✓
│       ├── PlaybackControls.js    # Animation controls ✓
│       ├── SimulationList.js      # Results list ✓
│       ├── BatchResults.js        # Analytics ✓
│       └── RecoveryGuidance.js    # Recovery tips ✓
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

## Data Models

### SimulationConfig
Stores reusable simulation configurations:
- Pet attributes (species, size, behavior profile)
- Environment (center location, terrain type, search radius)
- Searcher setup (count, strategy, speed)
- Time parameters (max hours, time step)

### SimulationBatch
Groups multiple simulation runs:
- Links to config
- Tracks progress (completed/total)
- Stores aggregate results (success rate, avg time to find)
- Analytics JSON for detailed breakdown

### Simulation
Individual simulation run:
- Random seed (for reproducibility)
- Outcome (found/timeout, when, where, by whom)
- **Path data as JSON** (not rendered - reconstructed on playback)
- Statistics (distances traveled, zones visited)

---

## Simulation Engine

### Pet Behavior State Machine

**Critical insight:** Pets don't have fixed behavior profiles—they transition between states based on triggers. A scared dog might be a RUNNER for the first hour, then become a HIDER.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PET STATE MACHINE                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────┐    energy depletes    ┌──────────┐                  │
│   │ FLEEING  │ ────────────────────▶ │  HIDING  │                  │
│   │ (panic)  │                       │ (scared) │                  │
│   └──────────┘                       └────┬─────┘                  │
│        │                                  │                         │
│        │ calms down                       │ hunger threshold        │
│        ▼                                  ▼                         │
│   ┌──────────┐    finds resources    ┌──────────┐                  │
│   │ WANDERING│ ◀──────────────────── │ FORAGING │                  │
│   │ (explore)│                       │ (hungry) │                  │
│   └────┬─────┘                       └──────────┘                  │
│        │                                  ▲                         │
│        │ establishes territory           │                         │
│        ▼                                  │                         │
│   ┌──────────┐    hunger rises      ─────┘                         │
│   │TERRITORIAL                                                      │
│   │(routine) │ ◀─────── probabilistic pull toward home ────────────│
│   └──────────┘                                                      │
│                                                                     │
│   ANY STATE ──── HOMING (weighted attraction toward origin) ──────▶│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**State Transition Triggers:**

| From | To | Trigger |
|------|-----|---------|
| FLEEING | HIDING | Energy < 20%, or finds shelter |
| FLEEING | WANDERING | Time > 2hrs AND no perceived threats |
| HIDING | FORAGING | Hunger > 70% AND time_of_day is dawn/dusk |
| FORAGING | WANDERING | Hunger < 30% |
| FORAGING | HIDING | Perceived threat OR daylight |
| WANDERING | TERRITORIAL | Time > 24hrs AND stable food source found |
| ANY | HOMING | Random probability weighted by distance to home |

**Initial State Selection (based on pet profile):**

| Pet Type | Starting State | Typical Progression |
|----------|---------------|---------------------|
| Scared indoor cat | FLEEING → HIDING | May never leave HIDING |
| Confident outdoor cat | TERRITORIAL | Stays TERRITORIAL, occasional FORAGING |
| Panicked dog | FLEEING → WANDERING | Wide range, then stabilizes |
| Friendly dog | WANDERING | May approach people (detection boost) |
| Senior pet | HIDING | Limited mobility reduces transitions |

### Human Transport Event (Friendly Dogs)

**Critical insight:** Friendly dogs often approach strangers, get "rescued" by good samaritans, and end up at shelters or homes miles from where they were lost. This is a major source of "false negatives" in search predictions.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TRANSPORT EVENT MODEL                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Friendly dog in WANDERING state                                   │
│              │                                                      │
│              ▼                                                      │
│   Encounters human (probability based on population density)        │
│              │                                                      │
│              ▼                                                      │
│   P(pickup) = friendliness × human_type × dog_condition            │
│              │                                                      │
│              ├──── Not picked up (80-95%) ──── Continue WANDERING  │
│              │                                                      │
│              └──── Picked up (5-20%) ───┐                          │
│                                         │                           │
│                    ┌────────────────────┼────────────────────┐      │
│                    ▼                    ▼                    ▼      │
│              Taken home           Taken to shelter     Posted online│
│              (kept/fostered)      (0-10 miles away)    (may reunite)│
│                                                                     │
│   Result: Pet is now at NEW LOCATION, not findable by local search │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Probability Modifiers:**

| Factor | Condition | Effect on P(pickup) |
|--------|-----------|---------------------|
| Friendliness | Very friendly, approaches | 2.0x |
| | Normal | 1.0x |
| | Shy/avoidant | 0.2x |
| Dog condition | Clean, collar, appears owned | 1.5x (people want to "help") |
| | Dirty, no collar | 0.8x (may seem stray) |
| | Injured | 2.5x (urgency to rescue) |
| Human type | Dog walker/pet owner | 1.5x |
| | General pedestrian | 1.0x |
| | In vehicle | 0.3x |
| Time of day | Daylight | 1.0x |
| | Night | 0.4x |

**Transport Destinations:**
- 40% taken to local shelter (within 5 miles)
- 30% taken home by finder (kept temporarily)
- 20% posted on social media/Nextdoor (may lead to reunion)
- 10% taken to distant shelter/rescue (5-20 miles)

**Simulation Impact:**
When transport event occurs:
1. Log `TRANSPORTED` event with pickup location
2. Move pet to destination (shelter coordinates or random home)
3. Pet enters `SHELTERED` state (no longer moving)
4. Search in original area will fail
5. Reunion now depends on: shelter check, microchip scan, online post match

### SHELTERED State Reunion Pathways

When a pet enters `SHELTERED` state (picked up by good samaritan), they can still be reunited—just not by walking search. Model these alternative reunion channels:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SHELTERED REUNION MODEL                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Pet in SHELTERED state                                            │
│              │                                                      │
│              ├──── At shelter ────────────────────────────────────┐ │
│              │                                                    │ │
│              │     P(microchip_reunion) = 0.7                     │ │
│              │       × microchip_registered (0 or 1)              │ │
│              │       × shelter_scan_rate (0.9)                    │ │
│              │     → ~60% of chipped pets reunite within 72h      │ │
│              │                                                    │ │
│              ├──── At finder's home ──────────────────────────────┤ │
│              │                                                    │ │
│              │     P(social_media_reunion) = 0.3                  │ │
│              │       × finder_posts_online (0.6)                  │ │
│              │       × owner_searching_online (0.8)               │ │
│              │     → ~15% reunite via Nextdoor/Facebook           │ │
│              │                                                    │ │
│              │     P(listing_match_reunion) = 0.4                 │ │
│              │       × platform_has_case (1.0 for our users)      │ │
│              │       × finder_checks_listings (0.3)               │ │
│              │     → ~12% reunite via lost pet platforms          │ │
│              │       (THIS IS WHERE WE ADD VALUE)                 │ │
│              │                                                    │ │
│              └────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Outcome Categories (mutually exclusive):**

| Outcome | Description | Counted As |
|---------|-------------|------------|
| `FOUND_BY_SEARCHER` | Searcher detection event triggered | Search success |
| `RETURNED_HOME` | Pet reached home via homing behavior | Self-reunion |
| `FOUND_VIA_SHELTER` | Microchip scanned at shelter | Shelter reunion |
| `FOUND_VIA_SOCIAL` | Posted online, owner responded | Social reunion |
| `FOUND_VIA_PLATFORM` | Finder checked our listings | Platform value |
| `TIMEOUT_SEARCHING` | Max time, pet still in search area | Search failure |
| `TIMEOUT_SHELTERED` | Max time, pet sheltered but not matched | System gap |

**Why this matters:**
- Simulation shouldn't show "search failed" when pet was reunited via shelter
- Allows measuring platform value (how many reunions came through our listings?)
- More accurate success metrics across all reunion channels

### Environmental Variables

**Time of Day Effects:**
```
┌────────────────────────────────────────────────────────────┐
│  Hour:  0  2  4  6  8  10 12 14 16 18 20 22 24           │
│         ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓             │
│         NIGHT  │DAWN│   DAY        │DUSK│NIGHT           │
├────────────────────────────────────────────────────────────┤
│  Pet Activity:     LOW during day, HIGH at dawn/dusk      │
│  Cat Movement:     +50% at night, -30% midday             │
│  Dog Movement:     +20% morning, normal otherwise         │
│  Visibility:       LOW at night (detection penalty)       │
│  Hiding Behavior:  +40% during daylight (cats)            │
└────────────────────────────────────────────────────────────┘
```

**Attraction Factors (pull toward):**
- **Home direction** — Dogs especially try to return; weighted by familiarity
- **Food sources** — Dumpsters, restaurants, bird feeders, pet food left outside
- **Water sources** — Creeks, ponds, fountains, puddles after rain
- **Shelter** — Porches, sheds, under decks, drainage culverts, dense bushes
- **Other animals** — Dogs may approach other dogs; cats avoid
- **Familiar routes** — Regular walk paths, known territory boundaries

**Repulsion Factors (push away from):**
- **Busy roads** — Traffic noise/danger creates avoidance zone
- **Construction** — Loud equipment drives pets away
- **Predator cues** — Coyote scent, hawk territory (affects small pets)
- **Unfamiliar humans** — Shy pets avoid populated areas
- **Other aggressive animals** — Dogs barking, territorial cats

**Barrier Modeling:**
```
Barriers affect movement probability, not absolute blocks:

Fence (6ft):    Cat: 10% blocked, Dog: 90% blocked
Fence (4ft):    Cat: 5% blocked,  Dog: 60% blocked
Busy road:      Cat: 70% avoids,  Dog: 40% avoids
Creek/river:    Cat: 95% blocked, Dog: 30% blocked (may swim)
Highway:        Both: 85% blocked (danger zone)
Building:       100% blocked (must go around)
```

### Goal-Seeking / Homing Behavior

**Critical insight:** Pets aren't random walkers. Dogs especially try to return home. Cats return to familiar territory.

**Homing Force Model:**
```
At each movement tick, apply weighted attraction toward known locations:

homing_vector = Σ (attraction_weight × direction_to_location × distance_decay)

Known locations (in priority order):
1. Home (origin)           - weight: 0.3 for dogs, 0.1 for cats
2. Regular walk routes     - weight: 0.15 (dogs only)
3. Familiar parks/areas    - weight: 0.1
4. Previous sighting spots - weight: 0.05 (if re-running with data)
```

**Species-Specific Homing:**

| Species | Homing Strength | Notes |
|---------|-----------------|-------|
| Dogs | HIGH (0.3) | Strong desire to return; may travel miles toward home |
| Outdoor Cats | LOW (0.1) | Stay in expanded territory; rarely travel home directly |
| Indoor Cats | VERY LOW (0.05) | Too scared to navigate; hide close to escape point |
| Birds | VARIABLE | Some species have strong homing; others follow food |

**Homing Success Probability:**
```
P(successful_homing_attempt) = base_rate
                              × distance_modifier
                              × barrier_modifier
                              × time_elapsed_modifier

Where:
- base_rate = 0.6 for dogs, 0.2 for cats
- distance_modifier = 1.0 - (distance_miles × 0.1)  // decreases with distance
- barrier_modifier = 0.3 if major road between pet and home, else 1.0
- time_elapsed_modifier = 1.0 - (days × 0.05)  // decreases over time
```

**Implementation:**
```javascript
// Each tick, roll for homing attempt
if (random() < homing_attempt_probability) {
  // Apply vector toward home
  pet.direction = lerp(pet.direction, direction_to_home, homing_strength);
}
```

### Search Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| **GRID** | Systematic cell coverage | Large volunteer groups |
| **SPIRAL** | Expanding from center | Single searcher, hiders |
| **RANDOM** | Uncoordinated movement | Simulating untrained volunteers |
| **PROBABILITY** | Weighted toward likely zones | Optimal results |

### Probabilistic Detection Model

**Critical insight:** A hiding cat 5 feet away might never be found. A dog in an open field might be spotted from 200 yards. Detection isn't binary—it's probabilistic.

```
P(detection) = base_rate
             × visibility_modifier(terrain)
             × activity_modifier(pet_state)
             × fatigue_modifier(searcher_hours)
             × time_of_day_modifier(hour)
             × distance_falloff(distance)
```

**Base Detection Rates by Distance:**
```
Distance    Base P(detection) per 5-min tick
─────────────────────────────────────────────
< 10 ft     0.95  (almost certain if pet visible)
10-30 ft    0.70  (likely to notice)
30-100 ft   0.40  (may spot movement)
100-300 ft  0.15  (need open terrain)
300+ ft     0.02  (unlikely without binoculars)
```

**Modifiers:**

| Factor | Condition | Multiplier |
|--------|-----------|------------|
| **Pet State** | WANDERING/FORAGING | 1.0x |
| | FLEEING (moving fast) | 1.2x (motion catches eye) |
| | HIDING | 0.1x (very hard to find) |
| | HOMING (approaching) | 1.5x (may approach searcher) |
| **Terrain** | Open field | 1.5x |
| | Suburban yard | 1.0x |
| | Dense vegetation | 0.4x |
| | Under structures | 0.2x |
| **Time of Day** | Daylight | 1.0x |
| | Dawn/Dusk | 0.7x |
| | Night | 0.3x (without flashlight) |
| | Night + flashlight | 0.5x |
| **Searcher Fatigue** | Hour 0-2 | 1.0x (fresh) |
| | Hour 2-4 | 0.9x |
| | Hour 4-6 | 0.75x |
| | Hour 6+ | 0.5x (diminishing returns) |
| **Pet Personality** | Friendly | 1.3x (may approach humans) |
| | Neutral | 1.0x |
| | Shy/Scared | 0.6x (actively avoids) |

**Example Calculation:**
```
Scenario: Shy cat hiding under a porch, night, searcher at 20ft after 3 hours

P = 0.70 (base at 20ft)
  × 0.1  (HIDING state)
  × 0.2  (under structure)
  × 0.3  (night)
  × 0.9  (3 hours fatigue)
  × 0.6  (shy personality)

P = 0.70 × 0.1 × 0.2 × 0.3 × 0.9 × 0.6 = 0.00227 (0.2% chance per tick)

→ Even passing within 20 feet, only ~0.2% chance of detection per check
→ This matches reality: hiding cats are found by luck, traps, or cameras
```

### Core Algorithm

```
1. Initialize pet at last-seen location with starting state
2. Initialize N searchers based on strategy
3. For each time step (every 5 simulated minutes):
   a. Update pet internal state (energy, hunger, fear)
   b. Check for state transitions based on triggers
   c. Move pet according to current state + environmental factors
   d. Apply attraction/repulsion forces (food, home, barriers)
   e. Move each searcher according to strategy
   f. Apply searcher fatigue modifier
   g. For each searcher within detection range:
      - Calculate P(detection) using full model
      - Roll random check against probability
      - If success → record find, end simulation
   h. Record all positions and states for playback
4. If max time reached → record timeout
5. Store path data as compressed JSON
```

---

## Playback System

### Data Storage (Backend)
Simulations store paths as coordinate arrays:
```javascript
petPath: [
  { minute: 0, lat: 41.878, lng: -87.629, state: 'ACTIVE' },
  { minute: 5, lat: 41.879, lng: -87.628, state: 'ACTIVE' },
  { minute: 10, lat: 41.879, lng: -87.627, state: 'HIDING' },
  // ... hundreds of points
]
```

### Rendering (Frontend)
When user clicks a simulation:
1. Fetch path data from API
2. `useSimulationPlayback` hook manages playback state
3. Interpolate between recorded points for smooth animation
4. Render on Leaflet map with animated markers
5. Update probability zones based on elapsed time

### Playback Controls
- **Play/Pause** - Start/stop animation
- **Speed** - 1x, 2x, 5x, 10x, 50x
- **Timeline scrubber** - Jump to any point
- **Jump to Find** - Skip to discovery moment
- **Step** - Advance one time unit at a time

---

## Analytics Dashboard

After running a batch of simulations, display:

### Success Metrics
- Overall success rate (% found within time limit)
- Average/median time to find
- Success rate by zone (HIGH/MEDIUM/LOW/EXTENDED)

### Search Pattern Analysis
- Which strategy performed best
- Optimal number of searchers
- Coverage efficiency

### Heatmap
- Aggregate "where pets were found" across all simulations
- Visual probability cloud on the map
- Compare to predicted zones

### Calibration Insights
- Predicted vs. actual zone distribution
- Recommendations for adjusting model parameters

### Confidence Intervals in User-Facing Output

**Don't show:** "73% probability she's in this zone"

**Do show:** "60-80% probability (based on 47 similar cases)"

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PREDICTION DISPLAY FORMAT                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   HIGH PROBABILITY ZONE                                             │
│   ████████████████████░░░░░  65-75%                                │
│   Based on 47 similar cases (medium-sized dog, suburban, 24-48h)   │
│                                                                     │
│   MEDIUM PROBABILITY ZONE                                           │
│   ██████████░░░░░░░░░░░░░░░  15-25%                                │
│                                                                     │
│   EXTENDED ZONE                                                     │
│   ███░░░░░░░░░░░░░░░░░░░░░░  5-12%                                 │
│                                                                     │
│   ⓘ Model confidence: MEDIUM                                       │
│     We have good data for this pet type but limited cases          │
│     in rural environments.                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Confidence Level Indicators:**

| Sample Size | Confidence Label | Interval Width |
|-------------|------------------|----------------|
| 0-10 cases | LOW ("limited data") | ±20% |
| 11-50 cases | MEDIUM | ±10% |
| 51-200 cases | HIGH | ±5% |
| 200+ cases | VERY HIGH | ±3% |

**Implementation:**
```javascript
function formatPrediction(probability, sampleSize) {
  const intervalWidth = getIntervalWidth(sampleSize);
  const lower = Math.max(0, probability - intervalWidth);
  const upper = Math.min(100, probability + intervalWidth);

  return {
    range: `${lower}-${upper}%`,
    confidence: getConfidenceLabel(sampleSize),
    sampleSize,
    disclaimer: sampleSize < 20
      ? "Limited historical data for this scenario"
      : null
  };
}
```

**Why this matters:**
- Builds user trust through transparency
- Sets appropriate expectations
- Highlights where the model needs more data
- Avoids false precision that undermines credibility

---

## Implementation Phases

### Phase 0: Parameter Research Document (REQUIRED BEFORE CODING)

**Deliverable:** A spreadsheet/document with every tunable parameter, including sources and confidence levels.

Before writing any simulation code, complete this research phase to avoid "making up numbers that feel right."

| Parameter | Default Value | Source | Confidence | Notes |
|-----------|---------------|--------|------------|-------|
| Cat hiding radius (indoor, 0-24h) | 3-5 houses | Albrecht 2010 | HIGH | MARN research |
| Cat hiding radius (indoor, 24-72h) | 5-10 houses | Albrecht 2010 | HIGH | Expands with hunger |
| Dog displacement (small, 24h) | 0.3-0.5 mi | Estimated | MEDIUM | Needs validation |
| Dog homing attempt probability | 0.6/day | Reunion data | MEDIUM | Observed return rate |
| Friendly dog pickup probability | 0.15/day | Estimated | LOW | Good samaritan transport |
| Searcher fatigue onset | 2 hours | General research | MEDIUM | Attention degradation |
| ... | ... | ... | ... | ... |

**Required columns:**
- Parameter name (exact variable name in code)
- Default value (with units)
- Source (research paper, expert interview, platform data, or "ESTIMATED")
- Confidence level (HIGH/MEDIUM/LOW)
- Validation method (how we'll verify this is correct)

**Exit criteria:** Document reviewed by team, all HIGH-confidence parameters have citations.

**⚠️ IMPORTANT: Don't over-engineer this phase.**
- Target: 1-2 week research sprint, not a month
- Use reasonable estimates for LOW-confidence parameters
- Perfect parameters on day one is impossible
- Phase 5 calibration will fix inevitable mistakes
- A working system that improves > a perfect spec that never ships

### Phase 1: Foundation
- [ ] Add Prisma models (SimulationConfig, SimulationBatch, Simulation)
- [ ] Run database migration
- [ ] Create basic simulation engine (simple pet + searcher movement)
- [ ] Create `/api/simulator` routes (CRUD operations)
- [ ] Create `/app/simulator/page.js` with basic layout

### Phase 2: Simulation Engine + Basic Terrain
- [ ] Implement pet behavior state machine (FLEEING, HIDING, FORAGING, WANDERING, TERRITORIAL)
- [ ] Implement state transition triggers
- [ ] Implement all 4 search strategies (GRID, SPIRAL, RANDOM, PROBABILITY)
- [ ] **Basic OSM integration (REQUIRED, not future):**
  - [ ] Query Overpass API for major roads within search radius
  - [ ] Query water bodies (rivers, lakes, ponds)
  - [ ] Create barrier layer that affects movement probability
  - [ ] Cache terrain data per location (avoid repeated API calls)
- [ ] Implement attraction/repulsion force model
- [ ] Implement homing behavior with species-specific weights
- [ ] **Add human transport event for friendly dogs:**
  - [ ] P(pickup) when WANDERING near humans
  - [ ] Transport to random shelter/home within N miles
  - [ ] Log as "TRANSPORTED" event for playback
- [ ] Add batch processing capability

### Phase 3: Visual Playback
- [ ] Create `SimulatorMap.js` with Leaflet integration
- [ ] Implement `useSimulationPlayback.js` hook
- [ ] Create animated pet/searcher markers with trails
- [ ] Build `PlaybackControls.js` component
- [ ] Add smooth interpolation between recorded positions
- [ ] Implement "find moment" celebration animation

### Phase 4: Analytics Dashboard
- [ ] Create `BatchResults.js` component
- [ ] Implement aggregate statistics calculator
- [ ] Add heatmap overlay for find locations
- [ ] Create zone breakdown visualizations
- [ ] Add CSV/JSON export functionality

### Phase 5: Calibration System (CRITICAL FOR VALIDITY)

This phase is the scientific foundation. Without proper calibration, we're simulating plausible-sounding fiction rather than reality.

**5.1 Data Requirements Assessment**
- [ ] Audit existing `CaseOutcome` records for usable data
- [ ] Determine how many have accurate "found at" coordinates (not just "reunited")
- [ ] Identify what metadata is available (species, size, time elapsed, terrain)
- [ ] Estimate minimum sample size needed for statistical significance (~200+ per pet type)

**5.2 Calibration Data Collection**
- [ ] Add "found location" pin to case resolution flow (if not already precise)
- [ ] Add "how was pet found" dropdown (walking search, trap, sighting report, returned home)
- [ ] Track time elapsed from report to reunion
- [ ] Record environmental conditions (urban/suburban/rural, weather if available)

**5.3 Prediction vs. Reality Comparison**
- [ ] For each resolved case, generate post-hoc simulation prediction
- [ ] Compare: Was actual find location within predicted HIGH/MEDIUM/LOW/EXTENDED zone?
- [ ] Calculate zone accuracy rates by pet type
- [ ] Identify systematic biases (e.g., "cats found 30% closer than predicted")

**5.4 Parameter Adjustment Methodology**
```
For each pet category (e.g., "small dog, suburban, 24-48 hours"):
  1. Collect all resolved cases matching criteria
  2. Calculate mean/median actual displacement
  3. Compare to current model prediction
  4. If actual < predicted: reduce base_radius by ratio
  5. If actual > predicted: increase base_radius by ratio
  6. Apply Bayesian smoothing to avoid overfitting to small samples
```

**5.5 Addressing Survivorship Bias**
- [ ] Document limitation: We only know where FOUND pets were; not where unfound pets went
- [ ] Hypothesis: Unfound pets may have traveled further (beyond search radius)
- [ ] Mitigation: Weight recent finds more heavily (better data), track "not found" cases separately
- [ ] Future: Partner with shelters to get "found as stray" location data

**5.6 Ongoing Calibration Pipeline**
- [ ] Weekly job: recalculate accuracy metrics as new cases resolve
- [ ] Monthly review: adjust parameters if accuracy drops below threshold
- [ ] Version model parameters (v1.0, v1.1) to track improvements
- [ ] A/B test: show different users old vs. new model, measure reunion rates

**5.7 Accuracy Dashboard**
- [ ] Display current model accuracy by category
- [ ] Show trend over time (is the model improving?)
- [ ] Alert when accuracy drops significantly for any category
- [ ] Provide transparency to users: "This prediction is based on N similar cases with X% accuracy"

---

## Key Integration Points

### Existing Code to Leverage

1. **`app/lib/searchProbability.js`**
   - Base radius values by species/size
   - Time multipliers
   - Zone probability distribution (67.5% HIGH, 18% MEDIUM, etc.)

2. **`app/lib/volunteer/searchGrid.js`**
   - Haversine distance calculations
   - Grid cell generation
   - Priority scoring by distance

3. **`app/components/mission/SARMapView.js`**
   - Leaflet map initialization
   - Probability circle rendering
   - Marker management patterns

4. **`app/api/mission/[missionId]/stream/route.js`**
   - SSE implementation for real-time updates

---

## Pre-Implementation Research (RECOMMENDED)

**Before finalizing behavior parameters, spend time researching actual lost pet recovery studies:**

### Recommended Sources

1. **Missing Animal Response Network (MARN)**
   - Kat Albrecht's research on lost pet behavior
   - Statistics on displacement distances by species
   - Behavior profiles based on thousands of cases

2. **Academic Studies**
   - "Lost Cat Behaviour" studies (various university research)
   - Animal behavior journals on displacement and homing
   - GPS tracking studies on stray/feral animals

3. **Shelter Data**
   - ASPCA statistics on found pet locations
   - Humane society reunion data
   - Intake location vs. owner address analysis

4. **Industry Data**
   - Pet detective case files (if accessible)
   - Microchip company reunion statistics
   - Pet recovery service success rates

### Key Questions to Answer

- [ ] What is the actual median displacement for dogs by size at 24/48/72 hours?
- [ ] What percentage of cats are found within 3 houses of escape point?
- [ ] How does urban vs. rural environment affect displacement statistically?
- [ ] What percentage of found pets returned home on their own vs. were found by searchers?
- [ ] What time of day are most pets found? (validates our dawn/dusk hypothesis)

### Validation Checkpoints

Before deploying the simulator to real users:
- [ ] Compare our base parameters to published research
- [ ] Run simulations against known historical cases (if we have location data)
- [ ] Get feedback from experienced pet recovery professionals
- [ ] Document sources for each parameter value

---

## Interdisciplinary Recovery Strategies

Beyond simulation, we incorporate knowledge from multiple fields to guide actual recovery efforts. These strategies inform both the simulator's modeling AND the practical guidance we give to pet owners.

---

### Bayesian Search Theory (From Coast Guard SAR)

**Principle:** Every search result—including *not finding* the pet—is data that updates where the pet likely is.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BAYESIAN PROBABILITY UPDATE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Prior probability map (from simulation)                           │
│              │                                                      │
│              ▼                                                      │
│   Volunteer searches Grid A-3 for 2 hours                           │
│   Detection probability in that cell: 0.4                           │
│   Result: NOT FOUND                                                 │
│              │                                                      │
│              ▼                                                      │
│   P(pet in A-3 | not found) = P(A-3) × (1 - detection_prob)        │
│                             = 0.15 × 0.6 = 0.09                     │
│              │                                                      │
│              ▼                                                      │
│   Redistribute probability to unsearched cells                      │
│   Updated map shows new HIGH priority areas                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Implementation:**
- Track which grid cells have been searched and for how long
- Calculate detection probability based on searcher time, terrain, and pet state likelihood
- Update probability map after each search session
- Show users: "Based on 4 hours of searching in the east quadrant, probability has shifted west"

**Why this matters:**
- Prevents volunteers from re-searching the same areas
- Quantifies the value of "negative" search results
- Guides resource allocation as the search evolves

---

### Scent Gradient Networks (From Wildlife Biology)

**Principle:** Dogs can detect scent from 12+ miles downwind. Cats can smell their litter from 1-2 miles. Create a scent gradient that leads the pet home.

```
                    🏠 Home (primary scent source)
                   ╱ │ ╲
                  ◯  ◯  ◯   ← Scent stations (worn clothing, used litter)
                 ╱│╲ │ ╱│╲
                ◯ ◯ ◯ ◯ ◯   ← Neighbors place items creating gradient
               ╱   │   ╲
          [Pet follows scent toward increasing concentration]
```

**⚠️ Critical: Avoid Scent Noise**
- Don't place scent items randomly—this creates confusion
- Use a deliberate **gradient pattern**: strongest near home, weaker outward
- All items should be from the SAME household (pet's own scent + owner's scent)
- Remove items from one direction if sighting reported in another

**Guidance to Users:**
1. Place used litter box or bedding on porch/back door (primary beacon)
2. Ask 3-5 neighbors in the HIGH probability zone to place a worn shirt on their porch
3. Orient the gradient toward home, not scattered randomly
4. Replace items every 24-48 hours (scent degrades)

**Scent Survival (Mycology/Chemistry):**

| Condition | Scent Duration | Action |
|-----------|---------------|--------|
| Dry, still air | 24-48 hours | Refresh daily |
| Humid/damp | 4-7 days | Can leave longer |
| After rain | Washed away | Refresh immediately |
| Wind > 15 mph | Dispersed rapidly | Place in sheltered spots |

---

### Acoustic Lures (From Bioacoustics)

**Principle:** Pets respond to familiar sounds. Strategically placed audio can draw them out of hiding, especially at optimal activity times.

**Effective Sounds:**
- Owner's voice calling pet's name (recorded, looped)
- Treat bag/can opener sounds (Pavlovian response)
- Other household pet sounds (for bonded animals)
- Species-specific frequencies: cats respond to 55-79 Hz range

**Timing (Circadian Biology):**
```
┌────────────────────────────────────────────────────────────────┐
│  Hour:  0  2  4  6  8  10 12 14 16 18 20 22 24                │
│         ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓▓                  │
│         NIGHT  │DAWN│   DAY        │DUSK│NIGHT                │
├────────────────────────────────────────────────────────────────┤
│  🔊 OPTIMAL AUDIO LURE TIMES:                                  │
│     • 4:00-6:00 AM (pre-dawn, cats most active)               │
│     • 5:30-7:30 PM (dusk, both species active)                │
│     • Avoid: Midday (pets resting, low response)              │
└────────────────────────────────────────────────────────────────┘
```

**Guidance to Users:**
1. Record yourself calling pet's name in calm voice (30 seconds, looped)
2. Place phone/speaker at edge of HIGH probability zone
3. Point sound INWARD toward home
4. Set up during dawn/dusk windows when pet is most likely moving
5. Sit quietly nearby to observe response

---

### Indigenous Tracking Wisdom (Traditional Knowledge)

**Principle:** Traditional trackers don't just look for the animal—they read the landscape to know where animals *must* go.

**Natural Travel Corridors:**
Lost pets often follow paths of least resistance:

| Corridor Type | Why Pets Use It | Search Priority |
|---------------|-----------------|-----------------|
| Fence lines | Easy to follow, provides cover | HIGH - check entire perimeter |
| Creek/stream beds | Water source, natural path | HIGH - especially for dogs |
| Railroad tracks | Open path, minimal obstacles | MEDIUM - check access points |
| Power line cuts | Clear path through vegetation | MEDIUM - dogs especially |
| Drainage ditches | Cover + leads to water | HIGH - cats hide here |
| Hedge rows | Shelter while moving | HIGH for cats |

**Shelter Wisdom:**
Where hiding pets are actually found (not where people expect):

```
✓ ACTUALLY CHECK:                    ✗ OFTEN OVERLOOKED:
- Under porches and decks            - Inside open garages
- Inside dense bushes at base        - Under parked cars/boats
- Drainage culverts                  - Inside sheds (door blown open)
- Window wells                       - Under mobile homes
- Behind AC units                    - Inside dumpster enclosures
- Under stairs                       - Construction debris piles
```

**The 3-House Rule (Cats):**
Research shows indoor cats are found within 3-5 houses of escape point 75% of the time. They don't travel—they hide.

**Guidance to Users:**
1. "Your cat is likely within 500 feet. Search EVERY hiding spot, not more ground."
2. "Dogs follow fence lines. Walk every fence perimeter in the green zone."
3. "Check the obvious spots people skip: under the neighbor's deck, inside their open garage."
4. "At night, go silent. Listen for collar jingle, meow, whimper."

---

### Circadian Search Optimization

**Principle:** Match search effort to pet activity patterns for maximum detection probability.

**Optimal Search Windows:**

| Pet Type | Best Search Time | Why | Detection Multiplier |
|----------|------------------|-----|---------------------|
| Indoor cat | 3-5 AM | Desperate hunger overrides fear | 2.0x |
| Outdoor cat | Dusk (5-8 PM) | Natural hunting time | 1.5x |
| Dog (any) | Dawn (5-7 AM) | Cooler, active, less traffic | 1.4x |
| Dog (any) | Dusk (5-8 PM) | Second activity peak | 1.3x |
| All pets | After rain stops | Emerge to dry off, hungry | 1.5x |

**Anti-Patterns (Low Yield Times):**
- Midday (10 AM - 4 PM): Pets resting, hidden deep
- Late night (11 PM - 3 AM): Dark, pet sleeping, unsafe for humans
- During rain: Everyone hiding

**Guidance to Users:**
1. "The best time to search is 5 AM. Set an alarm."
2. "Don't search at noon—you'll exhaust yourself with minimal chance of success."
3. "If it rained, go out immediately when it stops. They'll be moving."

---

### Integration with Simulator

These strategies inform both the simulation AND the practical guidance:

**In Simulator:**
- Bayesian updates modify probability zones after searches
- Scent lures can be modeled as attraction points
- Time-of-day affects detection probability (already implemented)
- Corridor data from OSM affects movement patterns

**In User Guidance:**
After running simulation, generate personalized recovery plan:

```
┌─────────────────────────────────────────────────────────────────────┐
│           YOUR PERSONALIZED RECOVERY PLAN                           │
│           Medium dog • Missing 18 hours • Suburban                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🗺️ SEARCH PRIORITY (from simulation)                              │
│     HIGH zone: Within 0.8 miles (67% probability)                  │
│     Focus: East quadrant near creek bed                            │
│                                                                     │
│  👃 SCENT STRATEGY                                                  │
│     • Place worn shirt on back porch (primary beacon)              │
│     • Ask neighbors at [addresses] to place items                  │
│     • Refresh every 24 hours                                        │
│                                                                     │
│  🔊 SOUND STRATEGY                                                  │
│     • Best time: 5:30 AM or 6:00 PM                                │
│     • Play recording near [location] facing home                   │
│                                                                     │
│  🚶 SEARCH STRATEGY                                                 │
│     • Walk fence lines first (dogs follow them)                    │
│     • Check under every deck/porch in green zone                   │
│     • Creek access points are high priority                        │
│                                                                     │
│  ⏰ TIMING                                                          │
│     • Search at dawn (5-7 AM) for 1.4x detection boost            │
│     • Avoid midday searching (low yield)                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Future Enhancements (Technology-Dependent)

These require partnerships, hardware, or significant infrastructure:

### Doorbell Camera Network (Future)
Partner with Ring/Nest to alert camera owners when a pet goes missing nearby. They opt-in to share 24-48 hours of footage for AI scanning.
- **Dependency:** Corporate partnership
- **Timeline:** When platform reaches critical mass

### Humane Trap Network (Future)
Trap lending libraries with optimal placement guidance based on simulation.
- **Dependency:** Shelter partnerships for trap inventory
- **Timeline:** After shelter CRM product launches

### Thermal Drone Services (Future)
Coordinate with drone operators for night searches of hiding cats.
- **Dependency:** FAA regulations, operator network
- **Timeline:** Long-term, case-by-case

---

## Future Enhancements

1. **Machine Learning Integration**
   - Train model on validated outcomes
   - Neural network for complex pattern recognition
   - Automatic parameter optimization

2. **Advanced Terrain Data (beyond Phase 2 basics)**
   - Building footprints for urban hiding spots
   - Elevation data for rural areas
   - Park boundaries and green spaces
   - Fence detection from satellite imagery
   - Population density heat layers
   - Note: Basic roads/water are in Phase 2; this is for advanced features

3. **Weather API Integration**
   - Temperature affects pet movement (hot = less active)
   - Rain/snow changes behavior (seek shelter)
   - Historical weather for past case analysis

4. **Trap Simulation**
   - Model humane trap placement strategies
   - Simulate bait effectiveness over time
   - Optimal trap checking schedules

5. **Multi-Pet Households**
   - Simulate pets that escaped together
   - Model pack behavior for multiple dogs
   - Separation scenarios

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Zone accuracy | >60% finds in predicted HIGH zone | Phase 4 validation |
| User engagement | Users run simulations for active cases | Analytics |
| Reunion rate improvement | Higher than baseline | A/B test with/without predictions |

---

## Next Steps

1. **Phase 3.2** - Connect to actual lost pet reports (when main app stabilizes)
2. **Phase 4** - Begin calibration once we have 50+ resolved cases with location data

The simulator is now a **complete standalone feature** with:
- Full Monte Carlo simulation engine
- Real OSM terrain integration
- Heatmap visualization of find locations
- Contextual recovery guidance
- Batch statistics and analytics
