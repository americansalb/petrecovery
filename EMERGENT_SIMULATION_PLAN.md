# Path B: True Emergent Monte Carlo Simulation

## The Vision

Transform from **"probability injection"** to **"emergent physics"** where every recovery outcome arises naturally from the interaction of spatial, temporal, and behavioral fields.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   "The goal is not to simulate what SHOULD happen statistically,            │
│    but to simulate the WORLD and let statistics emerge."                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Overview

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         EMERGENT SIMULATION ENGINE                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐         ║
║  │  SPATIAL FIELDS │     │ TEMPORAL FIELDS │     │ BEHAVIORAL      │         ║
║  │                 │     │                 │     │ DYNAMICS        │         ║
║  │ • Population ρ  │     │ • Activity A(t) │     │                 │         ║
║  │ • Terrain τ     │────▶│ • Light L(t)    │────▶│ • Pet State     │         ║
║  │ • Shelter zones │     │ • Weather W(t)  │     │ • Energy/Hunger │         ║
║  │ • Road network  │     │ • Day of week   │     │ • Fear response │         ║
║  └────────┬────────┘     └────────┬────────┘     └────────┬────────┘         ║
║           │                       │                       │                  ║
║           ▼                       ▼                       ▼                  ║
║  ╔═══════════════════════════════════════════════════════════════════╗       ║
║  ║              ENCOUNTER PROBABILITY FIELD  E(x,y,t,s)              ║       ║
║  ║                                                                   ║       ║
║  ║   E = ρ(x,y) × A(t) × V(s) × τ(x,y) × L(t)                       ║       ║
║  ║                                                                   ║       ║
║  ║   Where:                                                          ║       ║
║  ║     ρ = population density field                                  ║       ║
║  ║     A = temporal activity curve                                   ║       ║
║  ║     V = pet visibility (from behavioral state)                    ║       ║
║  ║     τ = terrain visibility modifier                               ║       ║
║  ║     L = lighting conditions                                       ║       ║
║  ╚═══════════════════════════════════════════════════════════════════╝       ║
║                                    │                                         ║
║                                    ▼                                         ║
║           ┌────────────────────────┴────────────────────────┐                ║
║           │                                                  │                ║
║           ▼                                                  ▼                ║
║  ┌─────────────────┐                                ┌─────────────────┐      ║
║  │ STRANGER        │                                │ SELF-RETURN     │      ║
║  │ ENCOUNTER       │                                │ DYNAMICS        │      ║
║  │                 │                                │                 │      ║
║  │ Emerges from:   │                                │ Emerges from:   │      ║
║  │ • Pet position  │                                │ • Homing vector │      ║
║  │ • Time of day   │                                │ • Energy state  │      ║
║  │ • Visibility    │                                │ • Hunger state  │      ║
║  │ • Terrain type  │                                │ • Territory map │      ║
║  └────────┬────────┘                                └────────┬────────┘      ║
║           │                                                  │                ║
║           ▼                                                  ▼                ║
║  ┌─────────────────┐                                ┌─────────────────┐      ║
║  │ REUNION         │                                │ HOME ZONE       │      ║
║  │ PATHWAYS        │                                │ ARRIVAL         │      ║
║  │                 │                                │                 │      ║
║  │ • Collar check  │                                │ Physical arrival│      ║
║  │ • Social post   │                                │ at home coords  │      ║
║  │ • Shelter intake│                                │ (no probability)│      ║
║  └─────────────────┘                                └─────────────────┘      ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## The Five Emergent Fields

### Field 1: Population Density ρ(x,y)

```
┌───────────────────────────────────────────────────────────────────┐
│                    POPULATION DENSITY FIELD                       │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Data Source: OpenStreetMap (already integrated in terrain.js)   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                                                             │ │
│  │    Park ░░░░░░░         Residential ▓▓▓▓▓▓▓▓▓              │ │
│  │    ρ=0.3  ░░░░░░         ρ=1.0      ▓▓▓▓▓▓▓▓▓              │ │
│  │           ░░░░░░                    ▓▓▓▓▓▓▓▓▓              │ │
│  │                  Road ═════════════════════                 │ │
│  │                  ρ=0.8 (during day)                         │ │
│  │                  ρ=0.1 (at night)                           │ │
│  │                                                             │ │
│  │    Commercial ████████    Industrial ▒▒▒▒▒▒▒               │ │
│  │    ρ=2.5      ████████    ρ=0.5 (day)▒▒▒▒▒▒▒               │ │
│  │    (peak hrs) ████████    ρ=0.1 (ngt)▒▒▒▒▒▒▒               │ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Resolution: 50m × 50m grid cells                                │
│  Memory: ~1,600 cells for 2-mile radius = ~6.4 KB               │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

**Mathematical Definition:**

```
ρ(x,y) = ρ_base(land_use) × density_modifier(buildings) × road_proximity_factor

Where:
  ρ_base = { residential: 1.0, commercial: 2.5, park: 0.3, industrial: 0.5, ... }
  density_modifier = building_count_in_cell / avg_building_count
  road_proximity = 1.0 + 0.5 × exp(-distance_to_road / 50m)
```

---

### Field 2: Temporal Activity A(t)

```
┌───────────────────────────────────────────────────────────────────┐
│                    TEMPORAL ACTIVITY CURVES                       │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Human Activity by Hour (normalized 0-1):                         │
│                                                                   │
│  1.0 ┤                          ╭───╮                             │
│      │                         ╱     ╲      Weekday               │
│  0.8 ┤                   ╭────╯       ╲                           │
│      │                  ╱              ╲                          │
│  0.6 ┤           ╭─────╯                ╲                         │
│      │          ╱                        ╲                        │
│  0.4 ┤        ╱                           ╲                       │
│      │       ╱                             ╲                      │
│  0.2 ┤     ╱                                ╲____                 │
│      │____╱                                      ╲___             │
│  0.0 ┼────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬──  │
│      0    2    4    6    8   10   12   14   16   18   20   22    │
│                              Hour                                 │
│                                                                   │
│  Weekend Modifier: +30% during 10am-6pm, -20% before 9am          │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

**Data Structure:**

```javascript
const ACTIVITY_CURVES = {
  weekday: {
    residential: [0.02, 0.01, 0.01, 0.01, 0.02, 0.08, 0.25, 0.45, 0.35, 0.30,
                  0.35, 0.40, 0.45, 0.40, 0.35, 0.45, 0.60, 0.70, 0.55, 0.40,
                  0.25, 0.15, 0.08, 0.04],
    commercial: [0.00, 0.00, 0.00, 0.00, 0.00, 0.02, 0.10, 0.40, 0.70, 0.85,
                 0.90, 0.95, 1.00, 0.90, 0.85, 0.80, 0.75, 0.60, 0.30, 0.10,
                 0.05, 0.02, 0.00, 0.00],
    park:       [0.00, 0.00, 0.00, 0.00, 0.02, 0.10, 0.25, 0.40, 0.35, 0.30,
                 0.35, 0.40, 0.35, 0.30, 0.35, 0.45, 0.55, 0.50, 0.35, 0.15,
                 0.05, 0.02, 0.00, 0.00],
  },
  weekend: { /* similar with shifted peaks */ }
};
```

---

### Field 3: Pet Visibility V(state, personality)

```
┌───────────────────────────────────────────────────────────────────┐
│                    PET VISIBILITY MATRIX                          │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│              │  FRIENDLY  │  NEUTRAL  │    SHY    │              │
│  ────────────┼────────────┼───────────┼───────────┤              │
│  FLEEING     │    0.40    │   0.30    │   0.15    │  High motion │
│  WANDERING   │    0.90    │   0.70    │   0.40    │  Very visible│
│  FORAGING    │    0.70    │   0.50    │   0.25    │  Distracted  │
│  HIDING      │    0.15    │   0.08    │   0.02    │  Intentional │
│  TERRITORIAL │    0.80    │   0.60    │   0.35    │  Patrolling  │
│  RESTING     │    0.30    │   0.20    │   0.10    │  Stationary  │
│                                                                   │
│  Formula: V = V_base[state] × personality_mod × species_mod      │
│                                                                   │
│  Species Modifiers:                                               │
│    Dog: 1.4 (larger, louder, approach humans)                     │
│    Cat: 0.6 (smaller, quieter, avoid humans)                      │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

### Field 4: Terrain Visibility τ(x,y)

```
┌───────────────────────────────────────────────────────────────────┐
│                    TERRAIN VISIBILITY FIELD                       │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Derived from OpenStreetMap land use + building data:             │
│                                                                   │
│  Land Use Type          │ τ_base │ Notes                          │
│  ───────────────────────┼────────┼───────────────────────────────│
│  Open grass/field       │  1.50  │ Maximum visibility             │
│  Residential lawn       │  1.20  │ Clear sightlines               │
│  Sidewalk/path          │  1.10  │ Expected pedestrian areas      │
│  Street                 │  1.00  │ Baseline                        │
│  Parking lot            │  0.90  │ Cars obstruct                  │
│  Dense residential      │  0.70  │ Fences, hedges                 │
│  Commercial area        │  0.60  │ Buildings, crowds              │
│  Wooded/forest          │  0.30  │ Heavy obstruction              │
│  Under structure        │  0.10  │ Decks, porches, sheds          │
│  Storm drain/culvert    │  0.02  │ Nearly invisible               │
│                                                                   │
│  Building Shadow Effect:                                          │
│    τ_effective = τ_base × (1 - 0.3 × building_coverage)          │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

### Field 5: Lighting Conditions L(t, weather)

```
┌───────────────────────────────────────────────────────────────────┐
│                    LIGHTING CONDITION CURVE                       │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1.0 ┤              ┌─────────────────────────┐                   │
│      │             ╱                           ╲                  │
│  0.8 ┤           ╱                               ╲                │
│      │          ╱                                 ╲               │
│  0.6 ┤        ╱                                    ╲              │
│      │       ╱                                      ╲             │
│  0.4 ┤     ╱                                         ╲            │
│      │    ╱                                           ╲           │
│  0.2 ┤  ╱   Street                                     ╲          │
│      │ ╱    lights ───                                  ╲         │
│  0.0 ┼──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬─  │
│      0      3      6      9     12     15     18     21     24   │
│                              Hour                                 │
│                                                                   │
│  Sunrise/Sunset: Calculated from lat/lng and date                │
│  Street Lights: +0.15 bonus in residential, +0.25 in commercial  │
│  Weather: Overcast -20%, Rain -40%, Fog -60%                      │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## The Master Equation

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                    ENCOUNTER PROBABILITY PER TICK                             ║
║                                                                               ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │                                                                         │ ║
║  │   P_encounter(x, y, t, s) = k × ρ(x,y) × A(t, land_use) × V(s) × τ(x,y) × L(t)  │ ║
║  │                                                                         │ ║
║  │   Where:                                                                │ ║
║  │     k = calibration constant (derived from Weiss 2012 stranger-return) │ ║
║  │     ρ = population density at pet location [0, 5]                       │ ║
║  │     A = activity level for time and land use [0, 1]                    │ ║
║  │     V = pet visibility from state and personality [0, 1]               │ ║
║  │     τ = terrain visibility modifier [0, 1.5]                           │ ║
║  │     L = lighting conditions [0, 1]                                     │ ║
║  │                                                                         │ ║
║  │   All factors are SPATIALLY or TEMPORALLY derived                      │ ║
║  │   No magic constants - everything emerges from the world               │ ║
║  │                                                                         │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                               ║
║  CALIBRATION:                                                                 ║
║                                                                               ║
║  k is set such that: E[stranger_encounters] ≈ 26% over 72 hours              ║
║  This matches Weiss 2012 "Good Samaritan found" rate for dogs                ║
║                                                                               ║
║  But the DISTRIBUTION of those encounters is now emergent:                   ║
║    - Pet in park at 5pm → high probability                                   ║
║    - Pet under shed at 3am → near zero probability                           ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## Variable Interaction Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│                         VARIABLE INTERACTION MATRIX                                │
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│                    │ Pet    │ Pet   │ Pop.  │ Activity│ Terrain│ Light │ Encounter│
│                    │ State  │ Pos   │ ρ(x,y)│ A(t)    │ τ(x,y) │ L(t)  │ P_enc    │
│  ──────────────────┼────────┼───────┼───────┼─────────┼────────┼───────┼──────────│
│  Pet State         │   ●    │  ──▶  │       │         │   ◀──  │       │   ──▶    │
│  Pet Position      │  ◀──   │   ●   │  ──▶  │         │   ──▶  │       │   ──▶    │
│  Population ρ      │        │       │   ●   │   ◀──   │        │       │   ──▶    │
│  Activity A(t)     │        │       │  ──▶  │    ●    │        │  ◀──  │   ──▶    │
│  Terrain τ         │  ──▶   │  ◀──  │       │         │   ●    │       │   ──▶    │
│  Lighting L(t)     │        │       │       │   ──▶   │        │   ●   │   ──▶    │
│  Encounter P_enc   │  ◀──   │  ◀──  │  ◀──  │   ◀──   │  ◀──   │  ◀──  │    ●     │
│                                                                                    │
│  Legend:  ● = self    ──▶ = influences    ◀── = influenced by                     │
│                                                                                    │
│  FEEDBACK LOOPS:                                                                   │
│    1. Pet State ──▶ Pet Position ──▶ Terrain ──▶ Pet State (hiding spots)         │
│    2. Encounter ──▶ Pet State (fear response) ──▶ Visibility ──▶ Encounter        │
│    3. Time ──▶ Activity ──▶ Encounter ──▶ Reunion (temporal clustering)           │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Self-Return: Pure Behavioral Emergence

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         SELF-RETURN DYNAMICS                                  ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  OLD APPROACH (probability injection):                                        ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │  if (inHomeZone && random() < 0.3 + hunger*0.4 + fatigue*0.3)           │ ║
║  │    return SELF_RETURN;  // Magic formula!                               │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                               ║
║  NEW APPROACH (emergent):                                                     ║
║  ┌─────────────────────────────────────────────────────────────────────────┐ ║
║  │                                                                         │ ║
║  │  Pet movement is influenced by HOMING VECTOR:                           │ ║
║  │                                                                         │ ║
║  │    H(t) = H_base × familiarity(x,y) × (hunger + fatigue) / 2            │ ║
║  │                                                                         │ ║
║  │  Where:                                                                 │ ║
║  │    H_base = species homing strength (dog: 0.15, cat: 0.08)             │ ║
║  │    familiarity = decay function from home (pets know nearby area)       │ ║
║  │    hunger, fatigue = internal state driving return motivation           │ ║
║  │                                                                         │ ║
║  │  The pet's ACTUAL TRAJECTORY brings it home (or not)                   │ ║
║  │  Self-return = pet.position reaches home.position                       │ ║
║  │  No probability check - pure physics!                                   │ ║
║  │                                                                         │ ║
║  └─────────────────────────────────────────────────────────────────────────┘ ║
║                                                                               ║
║  FAMILIARITY FIELD (mental map of territory):                                ║
║                                                                               ║
║        Home                                                                   ║
║          ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━▶ Distance                  ║
║     1.0  ████████░░░░░░░░                                                    ║
║          ████████████░░░░░░░░                                                ║
║     0.5  ████████████████░░░░░░░░                                            ║
║          ████████████████████░░░░░░░░                                        ║
║     0.0  ████████████████████████░░░░░░░░                                    ║
║          └── Indoor-only cat: rapid decay (39m median)                       ║
║          └──────── Indoor-outdoor cat: slower decay (300m median)            ║
║          └────────────── Dog: moderate decay (200m median)                   ║
║                                                                               ║
║  Formula: familiarity(d) = exp(-d / characteristic_distance)                 ║
║  Where characteristic_distance = median displacement from research           ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## Reunion Pathways (Post-Encounter)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                       REUNION PATHWAY STATE MACHINE                           │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  When stranger encounter occurs, a REUNION PROCESS begins:                    │
│                                                                               │
│                    ┌──────────────┐                                          │
│                    │   ENCOUNTER  │                                          │
│                    │   OCCURRED   │                                          │
│                    └──────┬───────┘                                          │
│                           │                                                   │
│              ┌────────────┼────────────┐                                     │
│              ▼            ▼            ▼                                     │
│     ┌────────────┐ ┌────────────┐ ┌────────────┐                            │
│     │  APPROACH  │ │   IGNORE   │ │   FLEE     │                            │
│     │  ATTEMPT   │ │  (common   │ │  (shy pet) │                            │
│     │            │ │   for cats)│ │            │                            │
│     └─────┬──────┘ └────────────┘ └────────────┘                            │
│           │                                                                   │
│    ┌──────┴──────┐                                                           │
│    ▼             ▼                                                           │
│ ┌──────┐    ┌──────────┐                                                     │
│ │CAUGHT│    │ APPROACH │                                                     │
│ │      │    │ FAILED   │                                                     │
│ └──┬───┘    └──────────┘                                                     │
│    │                                                                          │
│    ├──────────────────┬──────────────────┬─────────────────┐                 │
│    ▼                  ▼                  ▼                 ▼                 │
│ ┌──────────┐   ┌────────────┐   ┌─────────────┐   ┌──────────────┐          │
│ │  CHECK   │   │   POST ON  │   │  TAKE TO    │   │    KEEP      │          │
│ │  COLLAR  │   │   SOCIAL   │   │   SHELTER   │   │   (rare)     │          │
│ │          │   │   MEDIA    │   │             │   │              │          │
│ └────┬─────┘   └─────┬──────┘   └──────┬──────┘   └──────────────┘          │
│      │               │                 │                                     │
│      ▼               ▼                 ▼                                     │
│ ┌──────────┐   ┌────────────┐   ┌─────────────┐                             │
│ │  CALL    │   │   MATCH    │   │  MICROCHIP  │                             │
│ │  OWNER   │   │   WITH     │   │    SCAN     │                             │
│ │          │   │   LISTING  │   │             │                             │
│ └────┬─────┘   └─────┬──────┘   └──────┬──────┘                             │
│      │               │                 │                                     │
│      ▼               ▼                 ▼                                     │
│    FOUND_VIA      FOUND_VIA        FOUND_VIA                                │
│    _SOCIAL        _PLATFORM        _SHELTER                                 │
│                                                                               │
│  PROBABILITIES ARE EMERGENT FROM:                                            │
│    - Pet personality (shy = more flee/ignore)                                │
│    - Pet appearance (collar visible = faster resolution)                     │
│    - Stranger type (dog walker vs jogger vs child)                          │
│    - Time of day (shelter open hours)                                        │
│    - Location (proximity to shelter)                                         │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         IMPLEMENTATION ROADMAP                                ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  PHASE 1: SPATIAL FIELD INFRASTRUCTURE                                       ║
║  ══════════════════════════════════════                                       ║
║                                                                               ║
║  Files to create/modify:                                                      ║
║    □ lib/simulator/fields/populationField.js     (NEW)                       ║
║    □ lib/simulator/fields/terrainVisibility.js   (NEW)                       ║
║    □ lib/simulator/fields/activityCurves.js      (NEW)                       ║
║    □ lib/simulator/fields/lightingField.js       (NEW)                       ║
║    □ lib/simulator/fields/index.js               (NEW - field manager)       ║
║                                                                               ║
║  Deliverables:                                                                ║
║    ✓ Population density grid from OSM data                                   ║
║    ✓ Terrain visibility lookup O(1)                                          ║
║    ✓ Activity curves by land use type                                        ║
║    ✓ Lighting calculation with sunrise/sunset                                ║
║                                                                               ║
║  Memory budget: < 50KB for 2-mile radius                                     ║
║  Performance: < 1ms for field initialization                                 ║
║                                                                               ║
║ ─────────────────────────────────────────────────────────────────────────────║
║                                                                               ║
║  PHASE 2: ENCOUNTER PROBABILITY ENGINE                                        ║
║  ═════════════════════════════════════                                        ║
║                                                                               ║
║  Files to create/modify:                                                      ║
║    □ lib/simulator/encounter.js                  (NEW - replaces magic)      ║
║    □ lib/simulator/engine.js                     (MODIFY - use new system)   ║
║    □ lib/simulator/petBehavior.js                (MODIFY - visibility calc)  ║
║                                                                               ║
║  Key changes:                                                                 ║
║    ✓ Remove: checkStrangerEncounter() with magic 0.01 rate                   ║
║    ✓ Add: getEncounterProbability(pet, fields, time)                         ║
║    ✓ Encounter emerges from: ρ × A × V × τ × L                               ║
║                                                                               ║
║  Validation:                                                                  ║
║    - Run 10,000 sims, verify ~26% stranger encounters (Weiss 2012)           ║
║    - Verify encounters cluster at high-activity times/places                 ║
║                                                                               ║
║ ─────────────────────────────────────────────────────────────────────────────║
║                                                                               ║
║  PHASE 3: BEHAVIORAL SELF-RETURN                                             ║
║  ═══════════════════════════════                                              ║
║                                                                               ║
║  Files to create/modify:                                                      ║
║    □ lib/simulator/fields/familiarityField.js    (NEW)                       ║
║    □ lib/simulator/petBehavior.js                (MODIFY - homing vector)    ║
║    □ lib/simulator/engine.js                     (MODIFY - remove magic)     ║
║                                                                               ║
║  Key changes:                                                                 ║
║    ✓ Remove: checkSelfReturn() with magic probability                        ║
║    ✓ Add: familiarity field based on displacement research                   ║
║    ✓ Add: homing vector influenced by hunger/fatigue                         ║
║    ✓ Self-return = physical arrival at home coordinates                      ║
║                                                                               ║
║  Validation:                                                                  ║
║    - Cats: ~59% self-return (Weiss 2012)                                     ║
║    - Dogs: ~15% self-return (Weiss 2012)                                     ║
║    - Indoor cats return faster than outdoor cats                             ║
║                                                                               ║
║ ─────────────────────────────────────────────────────────────────────────────║
║                                                                               ║
║  PHASE 4: REUNION PATHWAY SYSTEM                                             ║
║  ═══════════════════════════════                                              ║
║                                                                               ║
║  Files to create/modify:                                                      ║
║    □ lib/simulator/reunion/reunionEngine.js      (NEW)                       ║
║    □ lib/simulator/reunion/strangerBehavior.js   (NEW)                       ║
║    □ lib/simulator/reunion/shelterIntake.js      (NEW - replaces shelter.js) ║
║    □ lib/simulator/engine.js                     (MODIFY - integrate)        ║
║                                                                               ║
║  Key changes:                                                                 ║
║    ✓ Model stranger decision tree (approach/ignore/flee)                     ║
║    ✓ Collar/tag check timing based on visibility                             ║
║    ✓ Social media posting delay distribution                                 ║
║    ✓ Shelter intake based on proximity and hours                             ║
║                                                                               ║
║ ─────────────────────────────────────────────────────────────────────────────║
║                                                                               ║
║  PHASE 5: CALIBRATION & VALIDATION                                           ║
║  ═════════════════════════════════                                            ║
║                                                                               ║
║  Files to create/modify:                                                      ║
║    □ lib/simulator/calibration.js                (NEW)                       ║
║    □ lib/simulator/__tests__/emergent.test.js    (NEW)                       ║
║                                                                               ║
║  Validation suite:                                                            ║
║    ✓ Overall recovery rates match Weiss 2012                                 ║
║    ✓ Recovery mode distribution matches research                             ║
║    ✓ Displacement distribution matches Huang 2018 / Kremer 2021             ║
║    ✓ Temporal patterns are plausible (more finds during day)                ║
║    ✓ Spatial patterns are plausible (more finds near high-traffic)          ║
║                                                                               ║
║  Calibration constant k:                                                      ║
║    ✓ Binary search to match target stranger-return rate                      ║
║    ✓ Document final value with derivation                                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## File Structure (Final)

```
lib/simulator/
├── engine.js                    # Core simulation loop (MODIFIED)
├── petBehavior.js               # Pet state machine (MODIFIED)
├── searcherBehavior.js          # Searcher agents (unchanged)
├── detection.js                 # Koopman POD (unchanged)
├── displacement.js              # Log-normal sampling (unchanged)
├── researchConfig.js            # Research parameters (unchanged)
├── utils.js                     # Utilities (unchanged)
│
├── fields/                      # NEW: Spatial & temporal fields
│   ├── index.js                 # Field manager
│   ├── populationField.js       # ρ(x,y) from OSM
│   ├── terrainVisibility.js     # τ(x,y) visibility
│   ├── activityCurves.js        # A(t) by land use
│   ├── lightingField.js         # L(t) with sunrise/sunset
│   └── familiarityField.js      # Pet mental map
│
├── encounter/                   # NEW: Emergent encounters
│   ├── index.js                 # Encounter engine
│   ├── probabilityCalculator.js # P = k × ρ × A × V × τ × L
│   └── visibilityCalculator.js  # V(state, personality)
│
├── reunion/                     # NEW: Post-encounter pathways
│   ├── index.js                 # Reunion engine
│   ├── strangerBehavior.js      # Approach/ignore/flee
│   ├── collarCheck.js           # Tag reading logic
│   ├── socialMedia.js           # Posting behavior
│   └── shelterIntake.js         # Shelter processing
│
├── calibration/                 # NEW: Validation & tuning
│   ├── index.js                 # Calibration runner
│   ├── targetRates.js           # Weiss 2012 targets
│   └── kFinder.js               # Binary search for k
│
└── __tests__/
    ├── validation.test.js       # Existing tests
    └── emergent.test.js         # NEW: Emergence tests
```

---

## Emergence Verification Tests

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                    EMERGENCE VERIFICATION PROTOCOL                            │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  These tests verify that outcomes EMERGE from physics, not magic:             │
│                                                                               │
│  TEST 1: Temporal Clustering                                                  │
│  ─────────────────────────────                                                │
│    Run 1000 simulations, record hour of stranger encounter.                   │
│    EXPECTED: Peak at 8-9am (commute), 12-1pm (lunch), 5-6pm (commute)        │
│    FAIL IF: Uniform distribution (would indicate magic probability)          │
│                                                                               │
│  TEST 2: Spatial Clustering                                                   │
│  ─────────────────────────────                                                │
│    Run 1000 simulations, record location of stranger encounter.              │
│    EXPECTED: Clusters near roads, parks, commercial areas                     │
│    FAIL IF: Uniform distribution over search area                            │
│                                                                               │
│  TEST 3: State-Dependent Visibility                                          │
│  ──────────────────────────────────                                           │
│    Compare encounter rates: HIDING vs WANDERING pets                          │
│    EXPECTED: WANDERING has 10-20x higher encounter rate                       │
│    FAIL IF: Rates are similar (visibility not affecting encounters)          │
│                                                                               │
│  TEST 4: Self-Return Trajectory                                              │
│  ──────────────────────────────                                               │
│    For pets that self-return, plot full trajectory.                          │
│    EXPECTED: Gradual drift toward home as hunger/fatigue increase            │
│    FAIL IF: Sudden teleportation or random walk that happens to hit home     │
│                                                                               │
│  TEST 5: Indoor vs Outdoor Cat                                               │
│  ──────────────────────────────                                               │
│    Compare displacement and return rates.                                     │
│    EXPECTED: Indoor cats stay closer, return faster (Huang 2018)             │
│    FAIL IF: No difference between indoor/outdoor                             │
│                                                                               │
│  TEST 6: Shelter Proximity Effect                                            │
│  ────────────────────────────────                                             │
│    Compare shelter intake rates by distance to nearest shelter.              │
│    EXPECTED: Higher intake for pets lost near shelters                        │
│    FAIL IF: Uniform intake rate regardless of location                       │
│                                                                               │
│  TEST 7: No Magic Constants                                                  │
│  ──────────────────────────────                                               │
│    Grep codebase for: random() < [literal number]                            │
│    EXPECTED: Zero occurrences (except calibration constant k)                │
│    FAIL IF: Any magic probability injections remain                          │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Calibration Constant k

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         FINDING THE CALIBRATION CONSTANT                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  The ONLY magic number in the entire system is k, which scales the           ║
║  encounter probability to match research.                                     ║
║                                                                               ║
║  TARGET: 26% of dogs recovered via "Good Samaritan" (Weiss 2012)             ║
║                                                                               ║
║  PROCEDURE:                                                                   ║
║                                                                               ║
║    1. Set k = 0.001 (initial guess)                                          ║
║    2. Run 1000 dog simulations                                               ║
║    3. Measure stranger_return_rate                                           ║
║    4. If rate < 0.26: increase k                                             ║
║       If rate > 0.26: decrease k                                             ║
║    5. Binary search until |rate - 0.26| < 0.01                               ║
║    6. Document final k with full derivation                                  ║
║                                                                               ║
║  IMPORTANT:                                                                   ║
║    k is NOT a magic probability - it's a SCALING FACTOR that converts        ║
║    the dimensionless product ρ × A × V × τ × L into a probability.           ║
║                                                                               ║
║    The DISTRIBUTION of encounters is still fully emergent.                   ║
║    k only controls the TOTAL NUMBER to match research.                       ║
║                                                                               ║
║  EXPECTED VALUE: k ≈ 0.0001 to 0.001 (will determine empirically)            ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## Performance Guarantees

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                         PERFORMANCE ANALYSIS                                  │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  MEMORY BUDGET (per simulation):                                              │
│                                                                               │
│    Population field:     1,600 cells × 4 bytes = 6.4 KB                      │
│    Terrain visibility:   1,600 cells × 4 bytes = 6.4 KB                      │
│    Activity curves:      24 hours × 5 types × 4 bytes = 480 bytes            │
│    Familiarity field:    1,600 cells × 4 bytes = 6.4 KB                      │
│    Pet state:            ~200 bytes                                           │
│    Searcher states:      N × 200 bytes                                        │
│    ─────────────────────────────────────────────────────                     │
│    TOTAL:                ~20 KB + 200N bytes (N = searcher count)            │
│                                                                               │
│    For N=10 searchers: ~22 KB per simulation                                 │
│    1000 simulations: ~22 MB peak (but streamed, so ~22 KB actual)            │
│                                                                               │
│  ──────────────────────────────────────────────────────────────────────────  │
│                                                                               │
│  TIME BUDGET (per tick):                                                      │
│                                                                               │
│    Field lookups:        O(1) × 5 fields = ~0.5 μs                           │
│    Encounter calculation: O(1) multiplication = ~0.1 μs                       │
│    Pet movement:         O(1) = ~1 μs                                        │
│    Searcher movement:    O(N) = ~N μs                                        │
│    Detection checks:     O(N) = ~N μs                                        │
│    ─────────────────────────────────────────────────────                     │
│    TOTAL:                ~2 + 2N μs per tick                                 │
│                                                                               │
│    864 ticks × (2 + 2×10) μs = ~19 ms per simulation                         │
│    1000 simulations = ~19 seconds                                            │
│                                                                               │
│  ──────────────────────────────────────────────────────────────────────────  │
│                                                                               │
│  COMPARISON TO CURRENT:                                                       │
│                                                                               │
│    Current: ~10-30ms per simulation                                          │
│    Path B:  ~15-25ms per simulation                                          │
│    Overhead: ~20% slower (acceptable)                                         │
│                                                                               │
│  ✓ 1,000 simulations: ~20-25 seconds                                         │
│  ✓ 10,000 simulations: ~3-4 minutes                                          │
│  ✓ 100,000 simulations: ~30-40 minutes                                       │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## What Makes This Unique

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   ┌─────────────────────────────────────────────────────────────────────┐    ║
║   │                                                                     │    ║
║   │  "Every other lost pet simulator uses predetermined probabilities. │    ║
║   │   This one simulates the WORLD and lets outcomes emerge.           │    ║
║   │                                                                     │    ║
║   │   A pet in a park at 5pm will be found faster than one under a     │    ║
║   │   shed at 3am - not because we coded that rule, but because the    │    ║
║   │   population field, activity curve, visibility state, and lighting │    ║
║   │   naturally combine to make it so.                                 │    ║
║   │                                                                     │    ║
║   │   That's emergence. That's what makes this real Monte Carlo."      │    ║
║   │                                                                     │    ║
║   └─────────────────────────────────────────────────────────────────────┘    ║
║                                                                               ║
║  DIFFERENTIATORS:                                                             ║
║                                                                               ║
║    1. SPATIAL AWARENESS                                                       ║
║       - Population density from real OpenStreetMap data                       ║
║       - Terrain visibility affects encounter probability                      ║
║       - Shelter proximity affects intake probability                          ║
║                                                                               ║
║    2. TEMPORAL REALISM                                                        ║
║       - Activity curves by hour AND land use type                            ║
║       - Lighting calculations with real sunrise/sunset                       ║
║       - Weekend vs weekday behavior                                          ║
║                                                                               ║
║    3. BEHAVIORAL AUTHENTICITY                                                 ║
║       - Pet visibility emerges from state and personality                    ║
║       - Self-return emerges from homing vector, not probability              ║
║       - Stranger decisions modeled as state machine                          ║
║                                                                               ║
║    4. SCIENTIFIC INTEGRITY                                                    ║
║       - Only ONE calibration constant (k)                                    ║
║       - All other behavior emerges from field interactions                   ║
║       - Fully testable emergence verification protocol                       ║
║                                                                               ║
║    5. COMPUTATIONAL EFFICIENCY                                                ║
║       - O(1) field lookups instead of agent simulation                       ║
║       - Same performance as current system                                   ║
║       - 1000+ simulations without issues                                     ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## Next Steps

Ready to begin Phase 1: Spatial Field Infrastructure.

Awaiting your approval to proceed.
