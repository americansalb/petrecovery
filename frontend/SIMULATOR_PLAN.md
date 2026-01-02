# Lost Pet Simulator - Implementation Plan

## Overview

A Monte Carlo simulation tool that predicts where lost pets are likely to be found, with visual map-based playback and analytics. When a pet is reported lost, we can run thousands of simulations to generate probability heatmaps, then validate our predictions against actual outcomes to continuously improve accuracy.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         SIMULATOR PAGE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌──────────────────────────────────────────┐│
│  │   CONFIG PANEL       │  │              INTERACTIVE MAP             ││
│  │                      │  │                                          ││
│  │  Pet: [Dog ▼]        │  │     ░░░░▒▒▒▓▓▓████⌂████▓▓▓▒▒▒░░░░       ││
│  │  Size: [Medium ▼]    │  │                                          ││
│  │  Behavior: [Wander▼] │  │         🐕 ← Pet (animated)              ││
│  │  Terrain: [Suburb▼]  │  │      👤 👤 👤 ← Searchers                ││
│  │  Searchers: [5]      │  │                                          ││
│  │  Strategy: [Grid ▼]  │  │  ┌─────────────────────────────────────┐ ││
│  │  Duration: [72 hrs]  │  │  │ ▶ ⏸ │ 1x 2x 10x │ ════●══════ 2:45 │ ││
│  │                      │  │  └─────────────────────────────────────┘ ││
│  │  [Run Single]        │  │         Playback Controls                ││
│  │  [Run Batch: 1000]   │  │                                          ││
│  ├──────────────────────┤  ├──────────────────────────────────────────┤│
│  │  SIMULATION LIST     │  │           ANALYTICS DASHBOARD            ││
│  │                      │  │                                          ││
│  │  ✓ Sim #1 - Found    │  │  Success Rate: ████████░░ 78%           ││
│  │  ✓ Sim #2 - Found    │  │  Avg Time: 4.2 hours                    ││
│  │  ✗ Sim #3 - Timeout  │  │  Best Strategy: Probability-based       ││
│  │  ► Sim #4 - Playing  │  │                                          ││
│  │  ...                 │  │  Zone Breakdown:                         ││
│  │                      │  │  HIGH: 67% | MED: 22% | LOW: 8% | EXT: 3%││
│  └──────────────────────┘  └──────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
frontend/
├── app/
│   ├── simulator/
│   │   ├── page.js                      # Main simulator page
│   │   ├── components/
│   │   │   ├── SimulatorConfig.js       # Configuration form
│   │   │   ├── SimulatorMap.js          # Map with animated playback
│   │   │   ├── PlaybackControls.js      # Play/pause/speed/timeline
│   │   │   ├── SimulationList.js        # List of simulations
│   │   │   ├── BatchResults.js          # Aggregate analytics
│   │   │   ├── HeatmapOverlay.js        # Find location heatmap
│   │   │   └── EntityMarker.js          # Animated pet/searcher markers
│   │   └── hooks/
│   │       ├── useSimulationPlayback.js # Playback state machine
│   │       └── useSimulatorSSE.js       # Real-time progress
│   │
│   ├── api/simulator/
│   │   ├── route.js                     # Create/list simulations
│   │   ├── [simulationId]/
│   │   │   ├── route.js                 # Get simulation details
│   │   │   └── stream/route.js          # SSE for live progress
│   │   └── batch/
│   │       ├── route.js                 # Start/list batches
│   │       └── [batchId]/route.js       # Batch results
│   │
│   └── lib/simulator/
│       ├── engine.js                    # Core simulation engine
│       ├── petBehavior.js               # Pet movement algorithms
│       ├── searcherBehavior.js          # Search pattern algorithms
│       ├── terrainModifiers.js          # Environmental factors
│       └── analytics.js                 # Statistics calculator
│
└── prisma/schema.prisma                 # New models added
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

The simulator will be considered successful when:

1. **Accuracy** - Predicted HIGH zone contains actual find location >60% of the time
2. **Utility** - Users report the probability zones helped focus their search
3. **Learning** - Model accuracy improves over time with more outcome data
4. **Engagement** - Searchers use the probability guidance during active searches
