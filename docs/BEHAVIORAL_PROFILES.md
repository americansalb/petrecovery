# Lost Pet Behavioral Profile System

## Version 2.3

A unified behavioral simulation framework for dogs and cats. This document consolidates species-specific movement patterns, recovery probabilities, and search strategies into a single reference.

**Provenance Key**: [R] Research-backed, [P] Practitioner experience (Albrecht, MPP, etc.), [A] Author assumption (needs validation), [C] Calculated/derived

---

# PART 1: CORE FRAMEWORK (SHARED)

This section contains components that apply to both species, with species-specific notes where behavior differs.

---

## Probability Normalization Method

When multiple modifiers stack (e.g., temperament +50% to escape type, breed +30% to chase, age -20% to panic), we use multiplicative adjustment with renormalization:

```
FUNCTION applyModifiers(baseProbabilities, modifiers):

    # Step 1: Apply all modifiers multiplicatively
    adjustedProbs = {}
    FOR each outcome in baseProbabilities:
        multiplier = 1.0
        FOR each modifier that affects this outcome:
            # Convert percentage to multiplier
            # +50% becomes 1.5, -20% becomes 0.8
            multiplier *= (1 + modifier.percentage / 100)

        adjustedProbs[outcome] = baseProbabilities[outcome] * multiplier

    # Step 2: Renormalize so probabilities sum to 1.0
    total = SUM(adjustedProbs.values())
    FOR each outcome in adjustedProbs:
        adjustedProbs[outcome] /= total

    RETURN adjustedProbs
```

### Example: Xenophobic Rescue Dog with Terrier Instinct

Base escape probabilities:
```
P1: 18%, P2: 9%, D1: 12%, W1: 28%, ...
```

Modifiers applied:
- Xenophobic (X): P1: +50%, P2: +30%, W1: -30%
- Terrier (TER): D1: +50%

Calculation:
```
P1: 18% × 1.5 = 27%
P2: 9% × 1.3 = 11.7%
D1: 12% × 1.5 = 18%
W1: 28% × 0.7 = 19.6%
... (others unchanged)

Total before normalization: ~108%
After normalization: P1: 25%, P2: 10.8%, D1: 16.7%, W1: 18.1%, ...
```

### Why Multiplicative?

- **Additive** would allow probabilities to go negative or exceed 100%
- **Multiplicative** preserves relative relationships while allowing stacking
- **Renormalization** ensures valid probability distribution

---

## Terrain Detection and Classification

The simulation needs a map layer to determine terrain type from coordinates. Mortality, hiding behavior, and movement rates depend heavily on terrain classification.

### Data Sources (Choose One)

| Source | Pros | Cons |
|--------|------|------|
| OpenStreetMap (Overpass API) | Free, detailed building/road data | Requires parsing, rate limits |
| Google Maps API | Easy to use, reliable | Costs money at scale |
| Census TIGER/Line | Free, official boundaries | Less granular |
| Pre-computed grid | Fast runtime | Requires upfront processing |

### Research-Based Thresholds

Terrain classification thresholds derived from urbanization studies and open data standards:

| Metric | Urban | Suburban | Rural | Wooded | Source |
|--------|-------|----------|-------|--------|--------|
| Buildings/acre | >20 | 5-20 | <5 | <2 | [R] EPA Smart Location |
| Road density (km/km²) | >15 | 5-15 | <5 | <2 | [R] TIGER/Line |
| Population density (/mi²) | >3000 | 1000-3000 | <1000 | <100 | [R] Census Bureau |
| Impervious surface % | >50% | 20-50% | <20% | <5% | [R] NLCD 2019 |
| Tree canopy % | <15% | 15-40% | Variable | >60% | [R] NLCD Tree Canopy |

### OSM Tag Combinations for Terrain Classification

```yaml
terrain_classification:
  urban:
    primary_indicators:
      - "landuse=commercial"
      - "landuse=retail"
      - "landuse=industrial"
      - "highway=primary OR highway=secondary"
    building_density: ">20 per acre"
    osm_query: |
      [out:json];
      (
        way["building"]["landuse"~"commercial|retail|industrial"](around:400,{lat},{lng});
        way["highway"~"primary|secondary|trunk"](around:400,{lat},{lng});
      );
      out count;

  suburban:
    primary_indicators:
      - "landuse=residential"
      - "building=house OR building=apartments"
      - "highway=residential OR highway=tertiary"
    building_density: "5-20 per acre"
    osm_query: |
      [out:json];
      (
        way["building"~"house|residential|apartments"](around:400,{lat},{lng});
        way["landuse"="residential"](around:400,{lat},{lng});
      );
      out count;

  rural:
    primary_indicators:
      - "landuse=farmland OR landuse=meadow"
      - "building=farm OR building=barn"
      - "highway=unclassified OR highway=track"
    building_density: "<5 per acre"
    osm_query: |
      [out:json];
      (
        way["landuse"~"farmland|meadow|grass"](around:400,{lat},{lng});
        way["building"~"farm|barn"](around:400,{lat},{lng});
      );
      out count;

  wooded:
    primary_indicators:
      - "landuse=forest OR natural=wood"
      - "natural=scrub OR natural=heath"
      - "leaf_type=*"
    tree_canopy: ">60%"
    osm_query: |
      [out:json];
      (
        way["landuse"="forest"](around:400,{lat},{lng});
        way["natural"~"wood|scrub"](around:400,{lat},{lng});
      );
      out count;
```

### Shared Classification Logic

```
FUNCTION classifyTerrain(lat, lng, radius=0.25 miles):

    # Query map data for area around point
    buildingsPerAcre = countBuildings(lat, lng, radius) / acreage(radius)
    roadDensity = totalRoadLength(lat, lng, radius) / acreage(radius)  # km/km²
    nearHighway = isWithinDistance(lat, lng, "highway", 0.1 miles)
    treeCanopy = getCanopyCoverage(lat, lng, radius)  # 0.0-1.0
    imperviousSurface = getImperviousCoverage(lat, lng, radius)  # 0.0-1.0
```

### Dog-Specific Classification

**Primary factor: Traffic risk** [P]

Dogs in panic mode cross roads repeatedly. Traffic density is the primary mortality predictor.

```
    # Dog classification (traffic-focused)
    # Thresholds: [R] EPA Smart Location Database, TIGER road files
    IF buildingsPerAcre > 20 OR nearHighway OR roadDensity > 15:
        RETURN "Urban"      # High traffic risk [P]
    ELIF buildingsPerAcre > 5 OR roadDensity > 5:
        RETURN "Suburban"   # Medium traffic risk [P]
    ELIF treeCanopy > 0.6:
        RETURN "Wooded"     # Low traffic, some predator risk [P]
    ELSE:
        RETURN "Rural"      # Low traffic, variable predator risk [P]
```

### Cat-Specific Classification

**Primary factor: Hiding spot density** [P]

Cats freeze and hide. The availability and quality of hiding spots determines survival and recovery time.

```
    # Cat classification (hiding-spot-focused)
    hidingSpotDensity = countHidingSpots(lat, lng, radius)
    # Hiding spots: sheds, porches, vehicles, dense vegetation, dumpsters

    sheds = queryOSM('building=shed OR building=garage', lat, lng, radius)
    porches = queryOSM('building:part=porch', lat, lng, radius)
    denseVegetation = queryOSM('natural=scrub OR landuse=forest', lat, lng, radius)
    vehicles = estimateParkedVehicles(buildingsPerAcre)  # ~1.5 per residence [A]

    hidingSpotDensity = len(sheds) + len(porches) + vehicles + vegetationScore
    predatorRisk = estimatePredatorPresence(lat, lng)

    # Thresholds: [R] Building density from EPA, hiding spots [A] estimated
    IF buildingsPerAcre > 20:
        RETURN "Urban"       # Many hiding spots but also more disturbance
    ELIF buildingsPerAcre > 5 AND hidingSpotDensity > 10:
        RETURN "Suburban"    # Optimal for cat hiding [P] UQ 2017 finding
    ELIF treeCanopy > 0.6:
        RETURN "Wooded"      # Good hiding but high predator risk
    ELSE:
        RETURN "Rural"       # Variable hiding, high predator risk
```

### Predator Risk by Region

| Region Type | Coyote Risk | Raptor Risk | Dog Attack Risk | Overall Cat Risk |
|-------------|-------------|-------------|-----------------|------------------|
| Urban | Low | Low | Medium | 1.0x [C] Baseline |
| Suburban | Medium | Low | Medium | 1.2x [A] |
| Rural | High | Medium | Low | 1.5x [A] |
| Wooded | Very High | High | Low | 2.0x [A] |

**Regional Adjustments** (apply multiplier to predator risk):
- Southwest US (AZ, NM, TX): Coyote × 1.5 [P]
- Pacific Northwest (WA, OR): Raptor × 1.3 [A]
- Florida: Add alligator risk near water [P]
- Mountain West: Add mountain lion risk in wooded areas [P]

### Per-Tick Terrain Checks

The simulation should check terrain at each movement tick because:
- Animal may move from suburban into urban (higher traffic risk for dogs)
- Animal may find wooded area (better hiding for cats, lower traffic for dogs)
- Terrain affects speed, hiding spots, and human encounter rate

### Multi-Terrain Tick Handling

When a 5-minute movement tick crosses terrain boundaries, the simulation must handle the transition:

```python
def simulate_movement_tick(
    position: Tuple[float, float],
    heading: float,
    speed_mpm: float,  # meters per minute
    tick_duration_min: float,
    terrain_map: TerrainMap,
    profile: AnimalProfile
) -> Tuple[Tuple[float, float], Dict]:
    """
    Simulate movement for one tick, handling terrain transitions.

    Returns:
        (new_position, tick_metrics) where tick_metrics includes
        terrain breakdown, risks encountered, etc.
    """

    total_distance = speed_mpm * tick_duration_min
    remaining_distance = total_distance
    current_pos = position
    tick_metrics = {
        "terrain_segments": [],
        "risk_events": [],
        "total_distance_m": total_distance
    }

    # Maximum 10 terrain transitions per tick (prevents infinite loop)
    max_transitions = 10

    for _ in range(max_transitions):
        current_terrain = terrain_map.get_terrain(current_pos)

        # Find distance to next terrain boundary along heading
        boundary_dist = terrain_map.distance_to_boundary(
            current_pos,
            heading,
            max_dist=remaining_distance
        )

        if boundary_dist is None or boundary_dist >= remaining_distance:
            # No boundary crossing - complete movement in current terrain
            segment_distance = remaining_distance
            new_pos = move_along_heading(current_pos, heading, segment_distance)

            tick_metrics["terrain_segments"].append({
                "terrain": current_terrain,
                "distance_m": segment_distance,
                "duration_min": (segment_distance / total_distance) * tick_duration_min
            })

            # Apply terrain-specific risks for time spent in this terrain
            segment_duration = (segment_distance / total_distance) * tick_duration_min
            risk_events = check_terrain_risks(
                current_terrain,
                segment_duration,
                profile
            )
            tick_metrics["risk_events"].extend(risk_events)

            return new_pos, tick_metrics

        else:
            # Crossing boundary - complete partial movement, then continue
            segment_distance = boundary_dist

            tick_metrics["terrain_segments"].append({
                "terrain": current_terrain,
                "distance_m": segment_distance,
                "duration_min": (segment_distance / total_distance) * tick_duration_min
            })

            # Apply risks for this segment
            segment_duration = (segment_distance / total_distance) * tick_duration_min
            risk_events = check_terrain_risks(
                current_terrain,
                segment_duration,
                profile
            )
            tick_metrics["risk_events"].extend(risk_events)

            # Move to boundary and update state
            current_pos = move_along_heading(current_pos, heading, segment_distance)
            remaining_distance -= segment_distance

            # Optional: behavior change at boundary
            new_terrain = terrain_map.get_terrain(current_pos)
            heading = adjust_heading_for_terrain_change(
                heading,
                current_terrain,
                new_terrain,
                profile
            )

    # Fallback if too many transitions (shouldn't happen normally)
    return current_pos, tick_metrics


def check_terrain_risks(
    terrain: str,
    duration_min: float,
    profile: AnimalProfile
) -> List[Dict]:
    """
    Check for risk events (traffic, predators) during terrain segment.
    Probability scales with duration.
    """
    risk_events = []

    # Risk rates per minute (from terrain tables)
    if profile.species == "dog":
        traffic_rate = DOG_TRAFFIC_RISK_PER_MIN.get(terrain, 0)
        if random.random() < traffic_rate * duration_min:
            severity = random.choice(["near_miss", "injury", "fatal"])
            risk_events.append({"type": "traffic", "terrain": terrain, "severity": severity})

    else:  # Cat
        predator_rate = CAT_PREDATOR_RISK_PER_MIN.get(terrain, 0)
        if random.random() < predator_rate * duration_min:
            risk_events.append({"type": "predator", "terrain": terrain})

    return risk_events


# Risk rates [A] - Author estimates, need calibration
DOG_TRAFFIC_RISK_PER_MIN = {
    "urban": 0.0005,      # ~3% per hour
    "suburban": 0.0002,   # ~1.2% per hour
    "rural": 0.00005,     # ~0.3% per hour
    "wooded": 0.00001     # ~0.06% per hour
}

CAT_PREDATOR_RISK_PER_MIN = {
    "urban": 0.00002,     # Low - mostly dogs
    "suburban": 0.00005,  # Coyotes entering
    "rural": 0.0001,      # Higher coyote presence
    "wooded": 0.0002      # Multiple predator types
}
```

**Key principles for terrain boundary handling:**

1. **Time-proportional risks**: Risks are calculated proportionally to time spent in each terrain, not per-tick.

2. **Speed adjustments**: When entering slower terrain (wooded), remaining distance decreases proportionally.

3. **Behavioral adaptation**: Animals may change heading when encountering terrain boundaries (e.g., a dog avoiding dense woods, a cat seeking cover).

4. **Accumulated segments**: The tick records all terrain segments traversed for detailed analysis.

### Fallback if No Map Data

If map APIs unavailable, use user-provided terrain type for home location and assume consistent terrain within search radius (less accurate but functional).

---

## Weather Modifiers

| Weather | Speed Modifier | Shelter-Seeking | Notes | Provenance |
|---------|---------------|-----------------|-------|------------|
| Clear | 1.0x | Normal | Baseline conditions | [C] Baseline |
| Rain | 0.7x | +50% | Both species seek cover | [A] Estimated |
| Storm | 0.3x | +200% | Minimal movement | [A] Estimated |
| Extreme heat (>90°F) | 0.5x | +100% | Seek shade/water | [A] Estimated |
| Extreme cold (<40°F) | 0.6x (small animals: 0.3x) | +150% | Seek warmth | [A] Estimated |

**Provenance Key**: [R] Research-backed, [P] Practitioner experience, [A] Author assumption, [C] Calculated/derived

**Species-Specific Notes:**
- **Dogs**: Heat affects brachycephalic breeds critically (see Part 2)
- **Cats**: Weather accelerates threshold timing; rain/cold forces earlier emergence

---

## Time-of-Day Activity Patterns

### Dogs

| Time | Activity Multiplier | Human Encounter Rate | Provenance |
|------|---------------------|---------------------|------------|
| Dawn (5-7am) | 1.3x | Low | [A] Estimated |
| Morning (7am-12pm) | 1.0x | High | [C] Baseline |
| Afternoon (12-5pm) | 0.8x | High | [A] Estimated |
| Dusk (5-8pm) | 1.3x | Medium | [A] Estimated |
| Night (8pm-5am) | 0.6x (except X: 1.2x) | Low | [P] Albrecht |

### Cats

| Time | Activity Level | Human Encounter | Predator Risk | Provenance |
|------|----------------|-----------------|---------------|------------|
| Dawn (5-7am) | High | Low | HIGH | [R] Crepuscular behavior |
| Day (7am-6pm) | Very Low (hiding) | High if moving | Low | [R] Crepuscular behavior |
| Dusk (6-9pm) | High | Medium | HIGH | [R] Crepuscular behavior |
| Night (9pm-5am) | Medium-High | Low | Medium | [R] Crepuscular behavior |

**Key Difference**: Cats are crepuscular (dawn/dusk active) [R]. Dogs are more diurnal but xenophobic dogs become nocturnal [P].

---

## Owner Search Intensity (O0-O4)

Owner behavior significantly affects recovery outcomes. This is a situational modifier that affects outcome probabilities.

### Search Intensity Levels

| Code | Intensity | Description | Dog Prevalence | Cat Prevalence | Provenance |
|------|-----------|-------------|----------------|----------------|------------|
| O0 | None/Minimal | No active search, waiting for return | 5% | 15% | [A] Estimated |
| O1 | Passive | Posted on social media, called shelters | 25% | 30% | [A] Estimated |
| O2 | Active | Searching neighborhood, flyers, multiple shelter visits | 45% | 35% | [A] Estimated |
| O3 | Intensive | Feeding stations, trail cameras, professional help, daily searching | 20% | 15% | [A] Estimated |
| O4 | Professional | Hired pet detective, search dogs, extensive resources | 5% | 5% | [A] Estimated |

### Search Intensity Components

| Component | O0 | O1 | O2 | O3 | O4 |
|-----------|----|----|----|----|-----|
| Physical searching (hours/day) | 0 | 0-1 | 2-4 | 4-8 | 8+ |
| Flyers posted | 0 | 0 | 10-50 | 50-200 | 200+ |
| Social media reach | 0 | Low | Medium | High | Professional |
| Shelter checks | 0 | Once | Daily | 2x daily | Continuous |
| Feeding stations | No | No | Maybe | Yes | Multiple |
| Trail cameras | No | No | No | Yes | Yes |
| Scent articles distributed | No | No | No | Yes | Yes |

### Impact on Recovery Probabilities

```
# Self-return is independent of search intensity (animal's behavior)
selfReturnProb = baseSelfReturn  # No modification

# Found by owner scales with search effort [A]
foundByOwnerProb = baseFoundByOwner × searchIntensityMultiplier[intensity]
where multipliers = { O0: 0.1, O1: 0.5, O2: 1.0, O3: 1.8, O4: 2.5 }  # [A] Estimated

# Stranger return scales with outreach (flyers, social media) [A]
strangerReturnProb = baseStrangerReturn × outreachMultiplier[intensity]
where multipliers = { O0: 0.2, O1: 0.8, O2: 1.0, O3: 1.5, O4: 2.0 }  # [A] Estimated

# Still missing inversely scales with all effort [C]
stillMissingProb = baseStillMissing × (1 / combinedEffortMultiplier)
```

### Species-Specific Search Effectiveness

**Dogs:**
- Physical searching effective for most temperaments
- Calling/whistling helps for G/C/A/B temperaments
- X (Xenophobic) dogs require traps - active searching may flush them further

**Cats:**
- Physical searching is THE most effective recovery method (research-validated)
- X/CAU cats require humane traps - calling may spook them
- Search silently at night with flashlight (look for eye reflection)
- For X cats, O3-O4 (traps/cameras) is nearly required for recovery

```
# Dogs: Xenophobic with intensive search
IF dog.temperament == X AND searchIntensity >= O3:
    IF usingFeedingStations AND usingTraps:
        recoveryBonus = +0.35
    ELIF activelySearchingAndCalling:
        recoveryPenalty = -0.15  # May push dog further away

# Cats: Xenophobic require specialized methods
IF cat.temperament == X AND searchIntensity < O3:
    recoveryProbability *= 0.3  # Very low chance without traps
```

---

## Health Status Framework

### Base Probabilities

| Code | Status | Description | Dog Prob | Cat Prob | Provenance |
|------|--------|-------------|----------|----------|------------|
| HLT | Healthy | No health issues | 85% | 80% | [A] Estimated |
| INJ | Injured | Injured during escape event | 6% | 8% | [A] Estimated |
| CHR | Chronic | Pre-existing chronic condition | 7% | 9% | [A] Estimated |
| MED | Medication-Dependent | Needs regular medication | 2% | 3% | [A] Estimated |

### Injury Probability Adjustments by Escape Type

**Dogs:**
```
P2 (Attack):     INJ: base × 3.0  # [A] Estimated
P3 (Trauma):     INJ: base × 5.0  # [A] Estimated
S1 (Vehicle):    INJ: base × 2.5  # [A] Estimated
```

**Cats:**
```
ST2 (Window Screen):  INJ: base × 5.0  (falls often cause injury)  # [P] High-rise syndrome
DI3 (Vehicle):        INJ: base × 4.0  # [A] Estimated
ST4 (Predator):       INJ: base × 3.0  # [A] Estimated
```

### Age Modifies Health Probability

```
SEN (Senior): CHR: base × 2.5, MED: base × 3.0  # [A] Estimated
PUP/KIT:      CHR: base × 0.3, MED: base × 0.5  # [A] Estimated
```

### Health Impact on Movement

| Status | Speed Modifier | Stamina Modifier | Behavior Change | Provenance |
|--------|----------------|------------------|-----------------|------------|
| HLT | 1.0x | 1.0x | None | [C] Baseline |
| INJ | 0.3-0.7x (dogs) / 0.2x (cats) | 0.5x | Seeks shelter faster, hides | [A] Estimated |
| CHR | 0.7x | 0.6x | Tires faster, conservative movement | [A] Estimated |
| MED | 1.0x initially | Degrades over days | Behavior changes as medication wears off | [A] Estimated |

**Cat-Specific:** Injured cats have drastically reduced threshold time (2-4 days vs 10-12) [P] - they cannot hold out while hiding.

---

## Territory Familiarity Framework

### Base Probabilities

| Code | Territory | Description | Dog Prob | Cat Prob | Provenance |
|------|-----------|-------------|----------|----------|------------|
| HOME | Home Territory | Escaped from home or immediate yard | 72% | 75% | [A] Estimated |
| NEAR | Familiar Area | Regular walk area / neighbor's yard | 15% | 12% | [A] Estimated |
| FAR | Unfamiliar Area | Vet, groomer, relative's house | 9% | 9% | [A] Estimated |
| LOST | Completely Unknown | Fell from car, escaped during travel | 4% | 4% | [A] Estimated |

### Territory Impact - Dogs

| Territory | Homing Ability | Initial Confusion | Landmark Recognition | Provenance |
|-----------|----------------|-------------------|---------------------|------------|
| HOME | High (0.8) | Low | Full | [A] Estimated |
| NEAR | Medium (0.5) | Medium | Partial | [A] Estimated |
| FAR | Low (0.2) | High | None | [A] Estimated |
| LOST | None (0.0) | Extreme | None | [A] Estimated |

### Territory Impact - Cats

| Territory | Initial Behavior | Likely Distance | Recovery Time | Provenance |
|-----------|------------------|-----------------|---------------|------------|
| HOME | Hide nearby, may return | 0-50m | Hours to days | [R] UQ 2017 |
| NEAR | Hide, cautiously explore | 50-200m | Days | [P] Albrecht |
| FAR | Freeze in terror | 0-100m from drop point | Days to weeks | [P] Albrecht |
| LOST | Completely immobile | Near drop point | Weeks+ | [P] Albrecht |

**Critical Difference**: Unlike dogs, cats displaced to unfamiliar territory almost NEVER try to "find their way home" [P]. They freeze and hide. Homing behavior is rare and only documented in outdoor-access cats with established territories [R].

---

## Outcome Categories

Both species share these outcome categories, though probabilities differ significantly:

| Outcome | Description |
|---------|-------------|
| Self-return | Animal returns home on its own |
| Found by owner | Owner physically locates and recovers animal |
| Picked up by stranger | Good Samaritan picks up animal |
| At shelter | Animal ends up at shelter/rescue |
| "Adopted" by neighbor | (Cats primarily) Neighbor takes in animal believing it's stray |
| Still missing | Animal not recovered within time window |
| Deceased | Animal dies during displacement |

---

# PART 2: DOG PROFILES

Dogs are social pack animals whose primary stress response involves **movement** - either toward safety (home/owner) or away from threats. This creates larger search radii but also more sighting opportunities.

---

## Dog Profile Generation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DOG PROFILE GENERATION                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: INTRINSIC CHARACTERISTICS (The Dog's Identity)                     │
│  ════════════════════════════════════════════════════════                    │
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐               │
│  │   SIZE   │───▶│   AGE    │───▶│  BREED   │───▶│BACKGROUND│               │
│  │          │    │          │    │ INSTINCT │    │          │               │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘               │
│       │              │                │               │                      │
│       ▼              ▼                ▼               ▼                      │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │              TEMPERAMENT                                 │                │
│  │  (Influenced by Background - rescues more likely X)      │                │
│  └─────────────────────────────────────────────────────────┘                │
│                                                                              │
│                              ▼                                               │
│                                                                              │
│  STEP 2: SITUATIONAL CHARACTERISTICS (The Escape Event)                     │
│  ════════════════════════════════════════════════════════                    │
│                                                                              │
│  ┌──────────────┐         ┌──────────────┐                                  │
│  │  TERRITORY   │         │  ESCAPE TYPE │◀── Influenced by:                │
│  │  FAMILIARITY │         │              │    - Temperament (X→more panic)  │
│  └──────────────┘         └──────────────┘    - Breed (SCT→more W2)         │
│         │                        │            - Age (PUP→more curious)       │
│         ▼                        ▼                                           │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │                    HEALTH STATUS                         │                │
│  │  (Independent roll, but P2/P3 escapes increase INJ prob) │                │
│  └─────────────────────────────────────────────────────────┘                │
│                                                                              │
│                              ▼                                               │
│                                                                              │
│  STEP 3: ENVIRONMENTAL MODIFIERS (Applied at Runtime)                       │
│  ════════════════════════════════════════════════════════                    │
│                                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ TIME OF DAY│  │  WEATHER   │  │  TERRAIN   │  │  TRAFFIC   │            │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Dog Layer 1: SIZE

**Base Probabilities** (US pet dog population estimates) [R]

| Code | Size Class | Weight Range | Base Probability | Provenance |
|------|------------|--------------|------------------|------------|
| T | Toy | <10 lbs | 12% | [R] AVMA |
| S | Small | 10-25 lbs | 23% | [R] AVMA |
| M | Medium | 25-50 lbs | 32% | [R] AVMA |
| L | Large | 50-90 lbs | 27% | [R] AVMA |
| XL | Giant | 90+ lbs | 6% | [R] AVMA |

**Movement Modifiers by Size**

| Size | Base Speed | Stamina | Max Distance/Day | Visibility | Pickup Rate | Provenance |
|------|------------|---------|------------------|------------|-------------|------------|
| T | 0.4x | 0.3x | 0.5 mi | Low (hides easily) | 90% | [A] Estimated |
| S | 0.7x | 0.6x | 1.5 mi | Medium | 70% | [A] Estimated |
| M | 1.0x | 1.0x | 4 mi | Medium | 40% | [C] Baseline |
| L | 1.2x | 1.3x | 8 mi | High | 25% | [A] Estimated |
| XL | 0.9x | 1.0x | 5 mi | Very High | 15% (intimidating) | [A] Estimated |

---

## Dog Layer 2: AGE

**Base Probabilities**

| Code | Age Class | Age Range | Base Probability | Provenance |
|------|-----------|-----------|------------------|------------|
| PUP | Puppy | <1 year | 12% | [R] AVMA |
| YNG | Young Adult | 1-3 years | 28% | [R] AVMA |
| ADT | Adult | 3-8 years | 42% | [R] AVMA |
| SEN | Senior | 8+ years | 18% | [R] AVMA |

**Movement & Behavior Modifiers by Age**

| Age | Speed | Stamina | Navigation IQ | Fear Response | Human Approach | Provenance |
|-----|-------|---------|---------------|---------------|----------------|------------|
| PUP | 0.7x | 0.5x | Very Poor | High (but recovers fast) | Very willing | [A] Estimated |
| YNG | 1.2x | 1.2x | Moderate | Normal | Normal | [A] Estimated |
| ADT | 1.0x | 1.0x | Good | Normal | Normal | [C] Baseline |
| SEN | 0.5x | 0.5x | Good (but may have cognitive decline) | May be higher | Seeks comfort | [A] Estimated |

**Age-Specific Behaviors**

- **PUP**: Easily distracted, poor decision-making, likely to approach any human, tires quickly
- **YNG**: Impulsive, high energy, may run farther than necessary, quick to chase
- **ADT**: Baseline rational behavior, balances fear and need
- **SEN**: Conservative movement, seeks shelter quickly, may be confused, needs resources sooner

---

## Dog Layer 3: BREED INSTINCT

**Base Probabilities** (Accounting for mixed breeds adopting partial traits)

| Code | Instinct Type | Example Breeds | Base Probability | Provenance |
|------|---------------|----------------|------------------|------------|
| GEN | Generic/Mixed | Mixed breeds, non-specialized | 45% | [A] Estimated |
| RET | Retriever/Companion | Labs, Goldens, Cavaliers | 18% | [R] AKC registrations |
| TER | Terrier | JRTs, Westies, Pit Bulls | 12% | [R] AKC registrations |
| HRD | Herding | Border Collies, Aussies, GSDs | 9% | [R] AKC registrations |
| SCT | Scent-Driven | Beagles, Bloodhounds, Bassets | 6% | [R] AKC registrations |
| GRD | Guardian | Great Pyrenees, Mastiffs, Rotties | 4% | [R] AKC registrations |
| SIT | Sighthound | Greyhounds, Whippets, Afghans | 3% | [R] AKC registrations |
| IND | Independent | Huskies, Shibas, Basenjis, Akitas | 3% | [R] AKC registrations |

**Breed Instinct Behavioral Overrides**

| Instinct | Primary Drive | Movement Pattern | Special Behavior | Escape Type Affinity | Provenance |
|----------|---------------|------------------|------------------|---------------------|------------|
| GEN | None dominant | Random walk | None | Any | [C] Baseline |
| RET | Human connection | Returns to last handler spot | Stays close, seeks people | W1, S2, S3 | [P] Albrecht |
| TER | Prey/dig | Erratic, chase-driven | Pursues small animals, explores holes | D1, W1 | [P] Breed behavior |
| HRD | Control/manage | Circles, patrols | May "herd" traffic, animals, people | W1, D2 | [P] Breed behavior |
| SCT | Follow scent | Linear, nose-down | Can travel very far in one direction | W2, D1 | [P] Breed behavior |
| GRD | Protect territory | Stays put | Claims area, may be defensive | W1, P2 | [P] Breed behavior |
| SIT | Visual chase | Sprint-and-stop | Extreme bursts, then rest | D1, W1 | [P] Breed behavior |
| IND | Self-direction | Purposeful roaming | May not want to be found | W1, W3 | [P] Breed behavior |

**Size-Breed Correlation Adjustments**

Some breed instincts correlate with size:
- SCT: +10% probability if M/L
- GRD: +15% probability if L/XL, -10% if T/S
- SIT: +10% probability if L, -5% if T/S
- TER: +10% probability if S/M

---

## Dog Physical Modifier: BRACHYCEPHALIC

Brachycephalic breeds (flat-faced dogs) have severe physiological limitations that critically affect movement capability.

**Prevalence**: ~7% of pet dog population (French Bulldogs, English Bulldogs, Pugs, Boston Terriers, Shih Tzus, Pekingese, Cavalier King Charles Spaniels, Boxers)

**Physical Limitations**

| Condition | Effect on Movement |
|-----------|-------------------|
| Compromised airways | Cannot sustain running; overheats rapidly |
| Heat intolerance | Speed drops to 0.2x in temperatures >75°F |
| Exercise intolerance | Maximum sustained movement: 15-20 minutes |
| Respiratory distress under stress | Panic escapes are self-limiting |

**Movement Modifiers for Brachycephalic Dogs**

| Parameter | Modifier | Notes | Provenance |
|-----------|----------|-------|------------|
| Base Speed | 0.6x | Cannot maintain pace | [P] Veterinary |
| Stamina | 0.3x | Tires very quickly | [P] Veterinary |
| Max Distance/Day | 0.5-1.0 mi | Physical limitation | [A] Estimated |
| Panic Duration | 0.3x | Cannot sustain flight | [A] Estimated |
| Heat Sensitivity | Extreme | Speed → 0.2x if temp > 75°F | [P] Veterinary |
| Recovery Time | 2x | Needs longer rest periods | [A] Estimated |

**Survival Implications**

- **Positive**: Limited travel range means they stay closer to escape point
- **Negative**: Higher mortality risk from heat exposure, respiratory distress
- **Behavioral**: More likely to seek shelter quickly due to physical distress
- **Recovery**: Usually found within 0.5 miles if they survive first 24 hours

**Modifier Application Order**

Brachycephalic physical constraints **override** breed instinct modifiers:

```
1. Apply breed instinct modifiers (e.g., Working Dog stamina bonus)
2. Apply size modifiers
3. Apply age modifiers
4. THEN apply brachycephalic constraints (these take precedence)
5. Apply situational modifiers (health, terrain)
```

Example: A Boxer (Working Group, normally high stamina) that is brachycephalic:
```
baseStamina = 1.0
afterBreedMod = 1.0 × 1.2 (Working Group bonus) = 1.2
afterBrachyMod = 1.2 × 0.3 (Brachy penalty) = 0.36  # Brachy wins
```

**Application in Simulation**

```
IF dog.isBrachycephalic:
    speed *= 0.6
    stamina *= 0.3
    maxPanicDuration *= 0.3

    IF temperature > 75:
        speed *= 0.33  # Additional heat penalty
        deathRisk += 0.02 per hour exposed

    # Brachycephalic dogs seek shelter faster
    shelterSeekingMultiplier *= 2.0
```

### BRACHYCEPHALIC HEAT EMERGENCY (Dogs)

**A brachycephalic dog lost on a hot day is a MEDICAL EMERGENCY.**

| Temperature | Survivability Window | Required Action |
|-------------|---------------------|-----------------|
| 75-85°F | 24-48 hours | Urgent search |
| 85-95°F | 6-12 hours | Emergency - immediate search |
| 95°F+ | 2-4 hours | Critical - call emergency services |

**Heat Emergency Simulation Parameters**

```
IF dog.isBrachycephalic AND temperature > 85:
    # This is a medical emergency
    survivalHours = max(2, 24 - (temperature - 75) × 0.8)

    hourlyDeathRisk = 0.05 + (temperature - 85) × 0.02

    # Behavioral changes
    speed *= 0.1  # Nearly immobile
    shelterSeekingProbability = 1.0  # Will seek any shade/water
    approachability += 0.3  # May seek human help regardless of temperament

    # Alert flag for simulation output
    TRIGGER_EMERGENCY_ALERT("Brachycephalic dog in extreme heat - hours to live")
```

**Practical Implications**

- Simulation should flag brachy + heat scenarios prominently
- Recovery probability drops precipitously with temperature
- These dogs often found deceased near water sources or in shade
- Owner education: brachy dogs should not be outside unsupervised in summer

---

## Dog Layer 4: BACKGROUND

**Base Probabilities**

| Code | Background | Description | Base Probability | Provenance |
|------|------------|-------------|------------------|------------|
| F | Family Dog | Raised in home from puppy/young, well-socialized | 65% | [A] Estimated |
| R | Rescue | Adopted as adult, unknown early history | 25% | [A] Estimated |
| ST | Former Stray | Lived on streets, later adopted | 6% | [A] Estimated |
| W | Working Dog | Trained for specific job (hunting, service, etc.) | 4% | [A] Estimated |

**Background Behavioral Modifiers**

| Background | Survival Skills | Street Smarts | Human Trust | Fear Baseline | Provenance |
|------------|-----------------|---------------|-------------|---------------|------------|
| F | Low | Low | High | Low | [P] Albrecht |
| R | Variable | Variable | Medium | Medium-High | [P] Albrecht |
| ST | High | High | Low | Medium | [P] Albrecht |
| W | Medium | Medium | Task-dependent | Low | [P] Albrecht |

**Background Influences on Temperament**

Background affects temperament probability distribution:

```
Family Dog (F):     G:35%  C:30%  A:20%  X:5%   B:10%   # [P] Albrecht
Rescue (R):         G:20%  C:20%  A:25%  X:25%  B:10%   # [P] Albrecht
Former Stray (ST):  G:10%  C:30%  A:35%  X:20%  B:5%    # [P] Albrecht
Working Dog (W):    G:25%  C:40%  A:20%  X:5%   B:10%   # [P] Albrecht
```

---

## Dog Layer 5: TEMPERAMENT

**Base Probabilities** (Before background adjustment) [P] Albrecht temperament categories

| Code | Temperament | Base Probability | After Background Weighting | Provenance |
|------|-------------|------------------|---------------------------|------------|
| G | Gregarious | 25% | ~28% | [P] Albrecht |
| C | Confident | 28% | ~27% | [P] Albrecht |
| A | Aloof | 23% | ~23% | [P] Albrecht |
| X | Xenophobic | 12% | ~13% | [P] Albrecht |
| B | Bonded | 12% | ~9% | [P] Albrecht |

### G - Gregarious (Dog): Social Butterfly

- **Human response**: Approaches strangers readily, tail wagging
- **Travel pattern**: Short distances - gets "rescued" quickly
- **Catchability**: Very easy
- **Risk**: May go home with wrong person

### C - Confident (Dog): Self-Assured Explorer

- **Human response**: Neutral, will approach if beneficial
- **Travel pattern**: Purposeful, can cover significant distance
- **Catchability**: Medium - approachable but not seeking help
- **Risk**: May travel far before needing assistance

### A - Aloof (Dog): Wary but Rational

- **Human response**: Avoids initially, warms up over 24-72 hours when hungry
- **Travel pattern**: Moderate distance, cautious movement
- **Catchability**: Medium - requires patience, food luring
- **Risk**: May be mistaken for "abused" due to wariness

### X - Xenophobic (Dog): Fear-Dominant

- **Human response**: Flees from ALL humans including owner
- **Travel pattern**: Far and fast when triggered, hides otherwise
- **Catchability**: Very hard - may require traps
- **Risk**: High injury/death risk from running into traffic

### B - Bonded (Dog): Owner-Focused

- **Human response**: Seeks owner specifically, wary of strangers
- **Travel pattern**: Circles home area, returns to familiar spots
- **Catchability**: Easy for owner, hard for strangers
- **Risk**: May refuse help from non-owner

#### Bonded Dog Movement Mechanic: Gravity Spiral

Unlike other temperaments that use random walks or linear flight, Bonded dogs have a **constant directional bias toward home**. Their movement vector always includes a home-attraction component:

```
FUNCTION calculateBondedMovement(currentPos, homePos, lastScentPoint):

    # Primary attraction: Home coordinates
    homeVector = normalize(homePos - currentPos)

    # Secondary attraction: Last place owner's scent was detected
    IF lastScentPoint != null AND distance(currentPos, lastScentPoint) < 0.5 miles:
        scentVector = normalize(lastScentPoint - currentPos)
        attractionVector = 0.6 * homeVector + 0.4 * scentVector
    ELSE:
        attractionVector = homeVector

    # Random exploration component (reduced compared to other temperaments)
    randomVector = randomUnitVector()

    # Final movement: Heavy bias toward home
    gravityStrength = 0.4  # 40% of movement biased toward home
    explorationStrength = 0.6

    movementDirection = normalize(
        gravityStrength * attractionVector +
        explorationStrength * randomVector
    )

    RETURN movementDirection
```

**Behavioral Result**: Bonded dogs produce a **spiral inward** pattern rather than random diffusion, often returning to:
- The home property
- The last place they saw/smelled the owner
- Familiar walking routes

---

## Dog Time-Dependent Behavior Dynamics

Temperament expression changes over time as physiological needs accumulate.

### Hunger Accumulation

```
hunger(t) = min(1.0, t_hours / 72)  # Reaches maximum desperation at 72 hours [A]
```

| Hours Lost | Hunger Level | Behavioral Effect | Provenance |
|------------|--------------|-------------------|------------|
| 0-12 | 0.0-0.17 | Normal temperament expression | [A] |
| 12-24 | 0.17-0.33 | Beginning food motivation | [A] |
| 24-48 | 0.33-0.67 | Will take risks for food | [A] |
| 48-72 | 0.67-1.0 | Desperation; temperament barriers weaken | [A] |
| 72+ | 1.0 | Maximum food motivation | [A] |

### Thirst Accumulation (More Urgent)

```
thirst(t) = min(1.0, t_hours / 48)  # Critical by 48 hours [P] Veterinary
```

| Hours Lost | Thirst Level | Behavioral Effect | Provenance |
|------------|--------------|-------------------|------------|
| 0-8 | 0.0-0.17 | Normal | [A] |
| 8-16 | 0.17-0.33 | Seeking water sources | [A] |
| 16-24 | 0.33-0.50 | Will approach risky areas for water | [A] |
| 24-36 | 0.50-0.75 | Desperation; will approach humans near water | [A] |
| 36-48 | 0.75-1.0 | Critical; behavior dramatically altered | [P] Veterinary |
| 48+ | - | Cognitive decline, physical deterioration | [P] Veterinary |

### Dog Fear Decay

**Dogs have continuous fear decay from moment of escape** [P]. Decay rate varies by escape type - trauma escapes (P3) create PTSD-like responses that persist much longer than noise panic:

```
fear(t) = initial_fear × e^(-λt)

# Decay rates by escape type [A] - All half-life values are author estimates
λ = {
    P1: 0.030,  # Noise panic - half-life ≈ 23 hours [A]
    P2: 0.025,  # Attack panic - half-life ≈ 28 hours [A]
    P3: 0.012,  # Trauma (car accident, fire) - half-life ≈ 58 hours [A]
    D1: 0.040,  # Prey chase - half-life ≈ 17 hours (not fear-based) [A]
    D2: 0.050,  # Dog chase - half-life ≈ 14 hours [A]
    W*: 0.060,  # Walkout escapes - half-life ≈ 12 hours (minimal fear) [A]
    S1: 0.020,  # Vehicle displacement - half-life ≈ 35 hours [A]
    S2: 0.035,  # Facility escape - half-life ≈ 20 hours [A]
    S3: 0.040,  # Handed-off loss - half-life ≈ 17 hours [A]
}
```

**Fear Decay Comparison by Escape Type**

| Hours | P1 (Noise) | P2 (Attack) | P3 (Trauma) | Effect |
|-------|------------|-------------|-------------|--------|
| 0 | 1.0 | 1.0 | 1.0 | Full flight response |
| 6 | 0.84 | 0.86 | 0.93 | Still highly reactive |
| 12 | 0.70 | 0.74 | 0.87 | Beginning to calm (P1/P2 only) |
| 24 | 0.49 | 0.55 | 0.75 | P3 still very fearful |
| 48 | 0.24 | 0.30 | 0.56 | P3 majority of fear remains |
| 72 | 0.12 | 0.17 | 0.42 | P3 still significantly affected |
| 120 | 0.03 | 0.05 | 0.24 | P3 may need weeks to normalize |

**Trauma Escape (P3) Special Handling**

Dogs that escaped during car accidents, explosions, house fires, or similar traumatic events:
- May exhibit PTSD-like startle responses for weeks
- Specific triggers (loud sounds, vehicles, smoke smell) can cause fear spikes
- Fear decay is non-linear: may plateau and remain elevated
- Professional behavioral intervention often required even after recovery

### Temperament Modification Over Time

**Effective Approachability** changes as needs accumulate:

```
FUNCTION effectiveApproachability(baseTemperament, hours):

    hunger = min(1.0, hours / 72)
    thirst = min(1.0, hours / 48)
    need = max(hunger, thirst × 1.5)  # Thirst is more urgent

    # Base approachability by temperament
    baseApproach = {
        G: 0.9,   # Gregarious - always approachable
        C: 0.5,   # Confident - neutral
        A: 0.2,   # Aloof - avoidant
        X: 0.05,  # Xenophobic - almost never
        B: 0.3    # Bonded - depends on who
    }

    # Need increases approachability (desperation)
    needModifier = need × 0.4  # Max +40% approachability from need

    # But xenophobic dogs have a ceiling
    IF temperament == X:
        maxApproach = 0.25  # Even starving X dogs are very wary
    ELSE:
        maxApproach = 0.95

    RETURN min(maxApproach, baseApproach[temperament] + needModifier)
```

**Example: Aloof Dog Over Time**

| Hour | Hunger | Thirst | Effective Approachability | Behavior |
|------|--------|--------|---------------------------|----------|
| 6 | 0.08 | 0.13 | 0.23 | Avoids humans |
| 24 | 0.33 | 0.50 | 0.40 | May investigate food left out |
| 48 | 0.67 | 1.0 | 0.60 | Will approach feeding stations |
| 72 | 1.0 | - | 0.60 | Actively seeking help |

**Example: Xenophobic Dog Over Time**

| Hour | Hunger | Thirst | Effective Approachability | Behavior |
|------|--------|--------|---------------------------|----------|
| 6 | 0.08 | 0.13 | 0.06 | Flees from all humans |
| 24 | 0.33 | 0.50 | 0.12 | Still flees, slightly less reactive |
| 48 | 0.67 | 1.0 | 0.20 | May approach trap with food |
| 72 | 1.0 | - | 0.25 | Ceiling - still very wary |

---

## Dog Layer 6: ESCAPE TYPE

**Base Probabilities** (Before temperament/breed adjustments) [P] Categories from Albrecht

### PANIC ESCAPES (32% total)

| Code | Type | Description | Base Prob | Triggers | Provenance |
|------|------|-------------|-----------|----------|------------|
| P1 | Noise Panic | Fireworks, thunder, gunshots | 18% | Loud sounds | [P] Albrecht |
| P2 | Attack Panic | Chased by dog, coyote, person | 9% | Predator/threat | [P] Albrecht |
| P3 | Trauma Panic | Car accident, explosion, fire | 5% | Physical trauma | [P] Albrecht |

### PURSUIT ESCAPES (15% total)

| Code | Type | Description | Base Prob | Triggers | Provenance |
|------|------|-------------|-----------|----------|------------|
| D1 | Prey Chase | Chased squirrel, rabbit, cat | 12% | Prey sighting | [P] Albrecht |
| D2 | Dog Chase | Followed another dog | 3% | Social attraction | [P] Albrecht |

### WALKOUT ESCAPES (42% total)

| Code | Type | Description | Base Prob | Triggers | Provenance |
|------|------|-------------|-----------|----------|------------|
| W1 | Curious Explorer | Open gate, interesting smell | 28% | Opportunity | [P] Albrecht |
| W2 | Scent Follower | Nose-down tracking | 4% | Scent trail | [P] Albrecht |
| W3 | Habitual Escaper | Has escape history | 6% | Routine | [P] Albrecht |
| W4 | Mate-Seeking (Male) | Intact male seeking female | 3% | Hormones | [P] Albrecht |
| W5 | In-Heat Escape (Female) | Intact female in estrus | 2% | Hormones + male attention | [P] Albrecht |

### DISPLACEMENT ESCAPES (11% total)

| Code | Type | Description | Base Prob | Triggers | Provenance |
|------|------|-------------|-----------|----------|------------|
| S1 | Vehicle Displacement | Fell/jumped from car | 3% | Accident | [A] Estimated |
| S2 | Facility Escape | Escaped from vet/groomer | 5% | Stress | [A] Estimated |
| S3 | Handed-Off Loss | Escaped from pet-sitter | 3% | Unfamiliarity | [A] Estimated |

### W5: In-Heat Female - Detailed Behavior

Intact females in estrus have distinctive escape and movement patterns:

**Key Behavioral Differences from W4 (Male)**

| Aspect | W4 (Male) | W5 (Female) |
|--------|-----------|-------------|
| Movement | Travels far seeking females | Often stays put; males come to her |
| Distance | Can cover 5-10+ miles | Usually stays within 0.5-2 miles |
| Behavior | Single-minded pursuit | May alternate between receptive and defensive |
| Detection | Hard to find (moving target) | May be found via cluster of roaming males nearby |

**Movement Pattern**

```
FUNCTION w5InHeatMovement(currentPos, homePos):

    # In-heat females don't travel far - they attract males
    # Movement is about finding secure mating location, not distance

    IF malesPresent:
        IF receptive:
            speed = 0.2x base  # Stays with male(s)
        ELSE:
            speed = 1.5x base  # Fleeing unwanted attention
            direction = away from males
    ELSE:
        # Normal cautious exploration
        speed = 0.6x base
        direction = random walk with slight home bias

    RETURN speed, direction
```

**Special Characteristics**

1. **Attracts roaming males**: Creates cluster of intact males in area, which may be reported as "pack of dogs" sighting
2. **Defensive aggression**: May become aggressive toward approaching humans during estrus
3. **Scent marking**: Leaves strong scent trail that persists, aiding tracking
4. **Cycle phase matters**:
   - Proestrus (days 1-9): Attractive to males but not receptive, more defensive
   - Estrus (days 9-14): Receptive, may stay with males
   - Diestrus: Behavior normalizes

**Recovery Implications**

- Look for reports of "multiple dogs together" or "stray male dogs in area"
- Female may be nearby even if not directly sighted
- Approach cautiously - defensive behavior likely
- Capture may be easier if male dogs are cleared first

### Escape Type Probability Adjustments

**Temperament modifies escape type probability:**
```
Xenophobic (X):  P1: +50%, P2: +30%, P3: +20%, W1: -30%
Gregarious (G):  P1: -20%, W1: +20%, D2: +30%
Confident (C):   W1: +10%, D1: +10%
Bonded (B):      S2: +40%, S3: +40% (more stressed when away from owner)
```

**Breed instinct modifies escape type probability:**
```
SCT (Scent):     W2: +200%, D1: +30%
TER (Terrier):   D1: +50%
SIT (Sighthound): D1: +40%
HRD (Herding):   D2: +30%
IND (Independent): W3: +50%
```

**Age modifies escape type probability:**
```
PUP: W1: +40%, D1: +20%, P1: -20%
YNG: D1: +30%, W4: +50% (if intact)
SEN: W1: +20%, P1: +10%, D1: -30%
```

---

## Dog Movement Parameters

### Initial Phase (First 0-4 hours)

**By Escape Type:** [A] All values are author estimates

| Escape | Initial Speed | Duration | Direction | Stopping Trigger | Provenance |
|--------|---------------|----------|-----------|------------------|------------|
| P1 | 3.0x base | 30-120 min | Away from noise | Exhaustion, quiet area | [A] |
| P2 | 3.5x base | 15-60 min | Away from threat | Exhaustion, safe distance | [A] |
| P3 | 3.0x base | 60-240 min | Random/disoriented | Exhaustion, injury | [A] |
| D1 | 2.5x base | 5-30 min | Chase direction | Prey lost, confusion | [A] |
| D2 | 2.0x base | 10-60 min | Follows other dog | Other dog stops | [A] |
| W1 | 0.5x base | Ongoing | Interest-driven | Nothing - keeps exploring | [A] |
| W2 | 0.8x base | Ongoing | Scent direction | Scent lost or new scent | [A] |
| W3 | 0.7x base | Varies | Familiar routes | Reaches usual destination | [A] |
| W4 | 1.5x base | Hours-days | Female scent direction | Finds female or exhausted | [A] |
| W5 | 1.0x base | Varies | Erratic, may seek/avoid males | Breeding or escape from males | [A] |
| S1 | 0.3x base | 0-30 min | Stays near OR random | Confusion, fear | [A] |
| S2 | 1.5x base | 15-60 min | Away from facility | Distance from stress | [A] |
| S3 | 1.0x base | Ongoing | May try to reach real home | Exhaustion, disorientation | [A] |

### Transition Phase (4-24 hours)

After initial phase, dogs enter cycling behavior based on temperament:

**Gregarious (G):**
```
SEEKING → APPROACH_HUMAN → (picked up) OR → SEEKING
         └─ 70% pickup rate within 24h
```

**Confident (C):**
```
EXPLORING → RESTING → EXPLORING → FORAGING → EXPLORING
         └─ Covers 2-5 miles in 24h
         └─ 20% chance approaches human when hungry
```

**Aloof (A):**
```
HIDING → FORAGING (cautious) → HIDING → FORAGING
         └─ Covers 0.5-2 miles in 24h
         └─ Avoids humans initially
         └─ After 48-72h hunger: may accept food lure
```

**Xenophobic (X):**
```
HIDING → FLEEING (if approached) → HIDING → FORAGING (night only)
         └─ May cover 5+ miles if repeatedly flushed
         └─ Avoids ALL humans including owner
         └─ Recovery typically requires traps
```

**Bonded (B):**
```
SEARCHING → WAITING (at familiar spot) → SEARCHING → HIDING
         └─ Circles home area (1-2 mile radius)
         └─ Returns to last-seen location
         └─ Approaches owner readily, wary of strangers
```

---

## Dog Outcome Probability Matrix

### Base Rates by Temperament (Suburban baseline, 72 hours)

| Outcome | G | C | A | X | B |
|---------|---|---|---|---|---|
| Self-return | 15% | 10% | 8% | 2% | 25% |
| Found by owner | 25% | 20% | 15% | 5% | 35% |
| Picked up by stranger | 40% | 15% | 10% | 2% | 10% |
| At shelter | 15% | 10% | 12% | 5% | 8% |
| Still missing | 4% | 40% | 50% | 68% | 20% |
| Deceased | 1% | 5% | 5% | 18% | 2% |

### Deceased Rate Adjustments by Terrain

Xenophobic dogs have significantly higher mortality in urban areas due to more traffic encounters during panicked flight.

| Terrain | G | C | A | X | B |
|---------|---|---|---|---|---|
| Urban | 2% | 8% | 8% | **25%** | 3% |
| Suburban | 1% | 5% | 5% | 18% | 2% |
| Rural | 0.5% | 3% | 4% | 12% | 1% |
| Wooded | 0.5% | 4% | 5% | 10% | 1% |

### Cause of Death Distribution (X temperament, Urban)

| Cause | Percentage of Deaths |
|-------|---------------------|
| Vehicle strike | 65% |
| Exhaustion/exposure | 15% |
| Other injury | 10% |
| Predator (coyote, etc.) | 5% |
| Drowning (during flight) | 3% |
| Other | 2% |

### Time-Dependent Mortality Risk

```
# Highest risk during initial panic phase
hourlyMortalityRisk(hour, temperament, terrain):

    IF hour < 4:  # Initial panic phase
        basePanicRisk = { G: 0.001, C: 0.003, A: 0.004, X: 0.015, B: 0.002 }
        return basePanicRisk[temperament] × terrainMultiplier[terrain]

    ELIF hour < 24:  # Transition phase
        baseTransitionRisk = { G: 0.0002, C: 0.001, A: 0.001, X: 0.005, B: 0.0005 }
        return baseTransitionRisk[temperament] × terrainMultiplier[terrain]

    ELSE:  # Settled phase
        baseSettledRisk = { G: 0.0001, C: 0.0005, A: 0.0005, X: 0.002, B: 0.0002 }
        # Risk increases if repeatedly flushed
        IF temperament == X AND beingActivelySearched:
            return baseSettledRisk[X] × 2.5 × terrainMultiplier[terrain]
        return baseSettledRisk[temperament] × terrainMultiplier[terrain]

terrainMultiplier = { Urban: 2.0, Suburban: 1.0, Rural: 0.5, Wooded: 0.4 }
```

**Cumulative 72-hour mortality for X dog in Urban with active (incorrect) searching:**
- Hours 0-4: 0.015 × 2.0 × 4 = 12%
- Hours 4-24: 0.005 × 2.0 × 20 = 20%
- Hours 24-72: 0.002 × 2.5 × 2.0 × 48 = 48% (if being flushed)
- **Total risk: Up to 80% cumulative if handled incorrectly**

This is why xenophobic dogs require specialized recovery techniques (feeding stations, traps, no chasing).

---

## Dog Profile Generation Algorithm

```
FUNCTION generateDogProfile():

    # Step 1: Roll intrinsic characteristics
    size = rollWeighted(SIZE_PROBABILITIES)
    age = rollWeighted(AGE_PROBABILITIES)

    # Breed instinct with size correlation
    breedProbs = adjustForSize(BREED_PROBABILITIES, size)
    breedInstinct = rollWeighted(breedProbs)

    # Background
    background = rollWeighted(BACKGROUND_PROBABILITIES)

    # Temperament influenced by background
    tempProbs = adjustForBackground(TEMPERAMENT_PROBABILITIES, background)
    temperament = rollWeighted(tempProbs)

    # Step 2: Roll situational characteristics
    territory = rollWeighted(TERRITORY_PROBABILITIES)

    # Escape type influenced by temperament, breed, age
    escapeProbs = ESCAPE_PROBABILITIES
    escapeProbs = adjustForTemperament(escapeProbs, temperament)
    escapeProbs = adjustForBreed(escapeProbs, breedInstinct)
    escapeProbs = adjustForAge(escapeProbs, age)

    # Special case: Reproductive escape types
    IF NOT intactMale:
        escapeProbs[W4] = 0
    IF NOT (intactFemale AND inHeat):
        escapeProbs[W5] = 0
    normalize(escapeProbs)

    escapeType = rollWeighted(escapeProbs)

    # Health influenced by escape type and age
    healthProbs = HEALTH_PROBABILITIES
    healthProbs = adjustForEscape(healthProbs, escapeType)
    healthProbs = adjustForAge(healthProbs, age)
    health = rollWeighted(healthProbs)

    RETURN Profile(size, age, breedInstinct, background,
                   temperament, territory, escapeType, health)
```

---

## Dog Profile Frequency Table

**Uncertainty Note**: Frequencies are [C] calculated from component layer probabilities. Each component has its own uncertainty (see Uncertainty Quantification section). 95% CI calculated using Monte Carlo propagation with 10,000 samples.

### HIGH FREQUENCY PROFILES (>1% of population each)

| Rank | Profile Code | Description | Est. Frequency | 95% CI |
|------|--------------|-------------|----------------|--------|
| 1 | W1-G-F-M-ADT-HOME-GEN-HLT | Curious friendly family dog wandered out | 4.2% | (2.1%, 7.8%) |
| 2 | W1-C-F-M-ADT-HOME-GEN-HLT | Curious confident family dog wandered out | 3.8% | (1.9%, 7.1%) |
| 3 | P1-C-F-M-ADT-HOME-GEN-HLT | Noise panic, confident family dog | 2.9% | (1.4%, 5.4%) |
| 4 | W1-G-F-S-ADT-HOME-GEN-HLT | Curious friendly small family dog | 2.7% | (1.3%, 5.0%) |
| 5 | P1-A-F-M-ADT-HOME-GEN-HLT | Noise panic, aloof family dog | 2.4% | (1.2%, 4.5%) |
| 6 | W1-A-F-M-ADT-HOME-GEN-HLT | Curious aloof family dog wandered out | 2.2% | (1.1%, 4.1%) |
| 7 | P1-B-F-M-ADT-HOME-GEN-HLT | Noise panic, bonded family dog | 2.0% | (1.0%, 3.7%) |
| 8 | D1-C-F-M-YNG-HOME-GEN-HLT | Prey chase, confident young family dog | 1.9% | (0.9%, 3.5%) |
| 9 | W1-G-F-L-ADT-HOME-RET-HLT | Curious friendly large retriever | 1.8% | (0.9%, 3.4%) |
| 10 | P1-X-R-M-ADT-HOME-GEN-HLT | Noise panic, xenophobic rescue | 1.7% | (0.8%, 3.2%) |
| 11 | W1-C-F-L-ADT-HOME-GEN-HLT | Curious confident large family dog | 1.6% | (0.8%, 3.0%) |
| 12 | P1-G-F-S-ADT-HOME-GEN-HLT | Noise panic, friendly small dog | 1.5% | (0.7%, 2.8%) |
| 13 | D1-C-F-L-YNG-HOME-TER-HLT | Prey chase, confident young terrier | 1.4% | (0.7%, 2.6%) |
| 14 | W1-A-R-M-ADT-HOME-GEN-HLT | Curious aloof rescue wandered out | 1.3% | (0.6%, 2.4%) |
| 15 | P1-A-R-M-ADT-HOME-GEN-HLT | Noise panic, aloof rescue | 1.2% | (0.6%, 2.2%) |

### MODERATE FREQUENCY PROFILES (0.3-1% each)

| Rank | Profile Code | Description | Est. Frequency | 95% CI |
|------|--------------|-------------|----------------|--------|
| 16 | W3-C-F-M-ADT-HOME-GEN-HLT | Habitual escaper, confident | 0.9% | (0.4%, 1.7%) |
| 17 | S2-B-F-M-ADT-NEAR-GEN-HLT | Facility escape, bonded dog | 0.8% | (0.4%, 1.5%) |
| 18 | W1-G-F-T-PUP-HOME-GEN-HLT | Curious friendly toy puppy | 0.8% | (0.4%, 1.5%) |
| 19 | P2-A-F-M-ADT-HOME-GEN-HLT | Attack panic, aloof family dog | 0.7% | (0.3%, 1.3%) |
| 20 | W2-C-F-M-ADT-HOME-SCT-HLT | Scent follower, confident hound | 0.7% | (0.3%, 1.3%) |
| 21 | D1-C-F-M-ADT-HOME-TER-HLT | Prey chase, terrier adult | 0.6% | (0.3%, 1.1%) |
| 22 | P1-X-R-L-ADT-HOME-GEN-HLT | Noise panic, xenophobic large rescue | 0.6% | (0.3%, 1.1%) |
| 23 | W1-C-F-M-SEN-HOME-GEN-HLT | Curious confident senior wandered out | 0.6% | (0.3%, 1.1%) |
| 24 | S3-B-F-M-ADT-FAR-GEN-HLT | Escaped from pet-sitter, bonded | 0.5% | (0.2%, 0.9%) |
| 25 | W4-C-F-L-YNG-HOME-GEN-HLT | Mate-seeking young intact male | 0.5% | (0.2%, 0.9%) |
| 26 | P1-A-F-L-ADT-HOME-HRD-HLT | Noise panic, aloof herding dog | 0.5% | (0.2%, 0.9%) |
| 27 | D2-G-F-M-YNG-HOME-GEN-HLT | Dog chase, friendly young dog | 0.4% | (0.2%, 0.7%) |
| 28 | W1-X-R-M-ADT-HOME-GEN-HLT | Curious but xenophobic rescue | 0.4% | (0.2%, 0.7%) |
| 29 | P1-C-F-L-ADT-HOME-GRD-HLT | Noise panic, confident guardian | 0.4% | (0.2%, 0.7%) |
| 30 | W1-G-F-M-PUP-HOME-GEN-HLT | Curious friendly medium puppy | 0.4% | (0.2%, 0.7%) |

### LOW FREQUENCY BUT IMPORTANT PROFILES (0.1-0.3% each)

| Rank | Profile Code | Description | Est. Frequency | 95% CI |
|------|--------------|-------------|----------------|--------|
| 31 | P3-X-R-M-ADT-FAR-GEN-INJ | Trauma panic, xenophobic rescue, injured | 0.25% | (0.08%, 0.55%) |
| 32 | S1-A-F-M-ADT-LOST-GEN-HLT | Vehicle displacement, aloof, completely lost | 0.22% | (0.07%, 0.48%) |
| 33 | P2-X-R-M-ADT-HOME-GEN-INJ | Attack panic, xenophobic rescue, injured | 0.20% | (0.06%, 0.44%) |
| 34 | W2-A-W-L-ADT-HOME-SCT-HLT | Scent follower, working hound | 0.18% | (0.06%, 0.40%) |
| 35 | P1-X-ST-M-ADT-HOME-IND-HLT | Noise panic, former stray, independent breed | 0.16% | (0.05%, 0.35%) |
| 36 | S1-G-F-S-SEN-LOST-RET-CHR | Vehicle fall, friendly senior, chronic condition | 0.14% | (0.04%, 0.31%) |
| 37 | W3-X-R-M-ADT-HOME-IND-HLT | Habitual escaper, xenophobic, independent | 0.12% | (0.04%, 0.26%) |
| 38 | P1-B-F-T-SEN-HOME-GEN-CHR | Noise panic, bonded senior toy, chronic | 0.11% | (0.03%, 0.24%) |
| 39 | D1-C-F-L-YNG-HOME-SIT-HLT | Prey chase, confident sighthound | 0.10% | (0.03%, 0.22%) |
| 40 | W1-A-ST-M-ADT-HOME-GEN-HLT | Curious former stray, aloof | 0.10% | (0.03%, 0.22%) |

### EDGE CASES (<0.1% but important for completeness)

| Rank | Profile Code | Description | Est. Frequency | 95% CI | Notes |
|------|--------------|-------------|----------------|--------|-------|
| 41 | P3-X-F-L-ADT-LOST-GEN-INJ | Trauma, xenophobic, lost, injured | 0.05% | (0.01%, 0.12%) | Worst case scenario |
| 42 | P1-X-R-XL-ADT-HOME-GRD-HLT | Noise panic, xenophobic giant guardian | 0.04% | (0.01%, 0.10%) | Hard to catch, intimidating |
| 43 | W4-X-R-L-YNG-HOME-IND-HLT | Mate-seeking xenophobic independent | 0.04% | (0.01%, 0.10%) | Will travel extremely far |
| 44 | S1-X-R-M-PUP-LOST-GEN-INJ | Vehicle fall, xenophobic puppy, injured | 0.03% | (0.01%, 0.08%) | Very vulnerable |
| 45 | P2-X-ST-L-ADT-FAR-IND-INJ | Attack, former stray, independent, injured | 0.02% | (0.005%, 0.05%) | May never be recovered |
| 46 | W1-C-W-L-ADT-FAR-HRD-HLT | Curious working herding dog in unfamiliar area | 0.02% | (0.005%, 0.05%) | May try to "work" |
| 47 | P3-G-F-T-SEN-LOST-GEN-INJ | Trauma, friendly senior toy, injured, lost | 0.02% | (0.005%, 0.05%) | Highly vulnerable but approachable |
| 48 | W2-X-ST-M-ADT-HOME-SCT-HLT | Scent follower, xenophobic former stray | 0.01% | (0.002%, 0.03%) | Will travel far, uncatchable |
| 49 | S2-X-R-L-SEN-FAR-GRD-MED | Facility escape, xenophobic senior guardian, needs meds | 0.01% | (0.002%, 0.03%) | Complex recovery |
| 50 | P1-X-R-M-PUP-HOME-GEN-HLT | Noise panic, xenophobic puppy rescue | 0.01% | (0.002%, 0.03%) | Unusual but happens with traumatized pups |

---

## Dog Layer Summary

| # | Layer | Type | Options | Key Impact |
|---|-------|------|---------|------------|
| 1 | Size | Intrinsic | 5 (T/S/M/L/XL) | Speed, stamina, pickup rate |
| 2 | Age | Intrinsic | 4 (PUP/YNG/ADT/SEN) | Speed, stamina, behavior |
| 3 | Breed Instinct | Intrinsic | 8 | Movement patterns, drives |
| - | Brachycephalic | Physical Modifier | Boolean | Severe stamina/heat limits |
| 4 | Background | Intrinsic | 4 (F/R/ST/W) | Survival skills, trust |
| 5 | Temperament | Intrinsic | 5 (G/C/A/X/B) | Human response, catchability |
| - | Time Dynamics | Runtime | Continuous | Hunger/thirst/fear decay |
| 6 | Territory | Situational | 4 (HOME/NEAR/FAR/LOST) | Homing ability |
| 7 | Escape Type | Situational | 13 (P1-3, D1-2, W1-5, S1-3) | Initial phase behavior |
| 8 | Health | Situational | 4 (HLT/INJ/CHR/MED) | Movement limitations |
| 9 | Owner Search | Situational | 5 (O0-O4) | Recovery probability |

---

# PART 3: CAT PROFILES

Cats are territorial ambush predators whose primary survival response is **hiding in silence**. Unlike dogs, a lost cat is usually not "lost" - they are **displaced** and hiding, often very close to home.

---

## Critical Cat-Specific Behaviors

Before discussing profiles, these fundamental differences from dogs must be understood:

### 1. The Silence Response

When displaced into unfamiliar territory, cats:
- **Do not meow** - vocalization would reveal their position to predators
- Become nearly catatonic, immobilized by fear
- May not respond even to their owner's voice
- Can remain in a single hiding spot for days

### 2. The Threshold Phenomenon

Hiding cats eventually "break cover" due to physiological needs:
- Typical threshold: **10-12 days** (though range is 2 days to weeks)
- Primary trigger: **Thirst** (cats can survive longer without food)
- When threshold reached, cat may:
  - Return to escape point or home
  - Begin meowing
  - Enter a humane trap
  - Approach humans

### 3. Territory vs Displacement

| Situation | Cat Behavior |
|-----------|--------------|
| On home territory | Confident, may meow, knows hiding spots |
| Adjacent territory | Cautious but mobile, may return quickly |
| Unfamiliar territory | **Freezes**, hides in first available cover, immobile |

---

## Cat Profile Generation Flow

```
+-------------------------------------------------------------------------+
|                        CAT PROFILE GENERATION                            |
+-------------------------------------------------------------------------+
|                                                                          |
|  STEP 1: INTRINSIC CHARACTERISTICS (The Cat's Identity)                 |
|  ============================================================            |
|                                                                          |
|  +---------------+    +---------------+    +---------------+            |
|  | INDOOR/OUTDOOR|----->|    AGE      |----->|    SIZE     |            |
|  |    ACCESS     |    |               |    |               |            |
|  +---------------+    +---------------+    +---------------+            |
|         |                    |                    |                     |
|         v                    v                    v                     |
|  +------------------------------------------------------------------+  |
|  |                    TEMPERAMENT                                    |  |
|  |  (Heavily influenced by Indoor/Outdoor access history)           |  |
|  +------------------------------------------------------------------+  |
|         |                                                               |
|         v                                                               |
|  +---------------+                                                      |
|  |  BACKGROUND   | (Rescue, feral-origin, breeder, etc.)               |
|  +---------------+                                                      |
|                                                                          |
|                              v                                           |
|                                                                          |
|  STEP 2: SITUATIONAL CHARACTERISTICS (The Escape Event)                 |
|  ============================================================            |
|                                                                          |
|  +---------------+         +---------------+                            |
|  |   TERRITORY   |         |  ESCAPE TYPE  |<-- Influenced by:          |
|  |  FAMILIARITY  |         |               |    - Indoor/Outdoor access |
|  +---------------+         +---------------+    - Temperament           |
|         |                        |                                      |
|         v                        v                                      |
|  +------------------------------------------------------------------+  |
|  |                    HEALTH STATUS                                   |  |
|  |  (May affect mobility, survival window)                           |  |
|  +------------------------------------------------------------------+  |
|                                                                          |
|                              v                                           |
|                                                                          |
|  STEP 3: ENVIRONMENTAL MODIFIERS (Applied at Runtime)                   |
|  ============================================================            |
|                                                                          |
|  +------------+  +------------+  +------------+  +------------+         |
|  | TIME OF DAY|  |  WEATHER   |  |  TERRAIN   |  | PREDATORS  |         |
|  +------------+  +------------+  +------------+  +------------+         |
|                                                                          |
+-------------------------------------------------------------------------+
```

---

## Cat Layer 1: INDOOR/OUTDOOR ACCESS

**This is THE critical factor for cat displacement behavior** [R]. Unlike dogs where temperament dominates, indoor/outdoor history is the primary determinant of distance traveled and recovery pattern.

**Base Probabilities** (US pet cat population)

| Code | Access Type | Description | Base Probability | Provenance |
|------|-------------|-------------|------------------|------------|
| IO | Indoor-Only | Never goes outside unsupervised | 45% | [R] AVMA survey |
| IS | Indoor-Supervised | Only goes out on leash, in catio, or supervised | 10% | [A] Estimated |
| IO-A | Indoor w/ Outdoor Access | Primarily indoor, but has outdoor access | 25% | [A] Estimated |
| OA | Outdoor-Access | Regularly goes outside unsupervised | 15% | [A] Estimated |
| OO | Outdoor-Only | Lives primarily outdoors | 5% | [A] Estimated |

**Distance & Behavior by Access Type** [R] U Queensland 2017

| Access | Median Distance Found | Max 75th Percentile | Primary Behavior | Homing Ability | Provenance |
|--------|----------------------|---------------------|------------------|----------------|------------|
| IO | **50 meters** (~2.5 houses) | 137 meters | Freeze & hide | None | [R] UQ 2017 |
| IS | 75 meters | 200 meters | Freeze & hide | Very Low | [A] Interpolated |
| IO-A | 150 meters | 400 meters | Hide then explore | Low | [A] Interpolated |
| OA | **315 meters** (~17 houses) | 1609 meters | Cautious exploration | Medium | [R] UQ 2017 |
| OO | 500+ meters | 3+ km | Territorial roaming | High | [A] Extrapolated |

**Why Indoor Cats Stay Close** [P] [R]

Indoor-only cats that escape outside:
- Have **no mental map** of the outdoor environment [P]
- First instinct: run to nearest cover and freeze [P]
- 93% found within a **3-house radius** of escape point [R] MPP data
- Will not self-navigate home (don't know how) [P]
- Must be physically found or lured with traps [P]

**Why Outdoor Cats Travel Farther**

Cats with outdoor access:
- Have established territory and mental maps
- May travel to regular spots (food sources, other homes that feed them)
- Can potentially navigate home
- May be "adopted" by neighbors who think they're strays

---

## Cat Layer 2: AGE

**Base Probabilities**

| Code | Age Class | Age Range | Base Probability | Provenance |
|------|-----------|-----------|------------------|------------|
| KIT | Kitten | <6 months | 8% | [A] Estimated |
| JUV | Juvenile | 6-12 months | 10% | [A] Estimated |
| YNG | Young Adult | 1-3 years | 22% | [A] Estimated |
| ADT | Adult | 3-10 years | 45% | [A] Estimated |
| SEN | Senior | 10+ years | 15% | [A] Estimated |

**Movement & Behavior Modifiers by Age**

| Age | Speed | Stamina | Hiding Ability | Threshold Time | Survival Risk | Provenance |
|-----|-------|---------|----------------|----------------|---------------|------------|
| KIT | 0.7x | 0.4x | Poor (novice) | 2-4 days | Very High | [A] Estimated |
| JUV | 1.2x | 0.8x | Moderate | 5-8 days | High | [A] Estimated |
| YNG | 1.0x | 1.0x | Good | 10-12 days | Normal | [P] Albrecht |
| ADT | 1.0x | 1.0x | Excellent | 10-14 days | Normal | [P] Albrecht |
| SEN | 0.5x | 0.5x | Good | 5-7 days (needs resources sooner) | High | [A] Estimated |

**Age-Specific Behaviors**

- **KIT**: Poor survival skills, may meow more (hasn't learned silence), highly vulnerable to predators, hypothermia risk
- **JUV**: Impulsive, may explore more, less patient with hiding, more likely to be found in neighbor's garage/shed
- **YNG**: Peak physical condition, can sustain long hiding period, most typical behavior pattern
- **ADT**: Experienced, efficient at hiding, may have established secondary locations if outdoor access
- **SEN**: Cognitive decline possible, may be confused, needs resources sooner, more likely to seek help

---

## Cat Layer 3: SIZE

Unlike dogs, cat size variation is much smaller, but still affects behavior:

**Base Probabilities**

| Code | Size Class | Weight Range | Base Probability | Provenance |
|------|------------|--------------|------------------|------------|
| S | Small | <8 lbs | 25% | [A] Estimated |
| M | Medium | 8-12 lbs | 55% | [A] Estimated |
| L | Large | 12-18 lbs | 18% | [A] Estimated |
| XL | Very Large | 18+ lbs | 2% | [A] Estimated |

**Size Effects**

| Size | Hiding Spots | Predator Risk | Visibility | Speed | Provenance |
|------|--------------|---------------|------------|-------|------------|
| S | Excellent (fits anywhere) | Higher | Low | 1.0x | [A] Estimated |
| M | Good | Normal | Medium | 1.0x | [C] Baseline |
| L | Limited | Lower | Higher | 0.9x | [A] Estimated |
| XL | Poor (can't squeeze into small spaces) | Low | High | 0.8x | [A] Estimated |

---

## Cat Physical Modifier: BRACHYCEPHALIC

Brachycephalic cats (flat-faced breeds) have physiological limitations that critically affect survival when lost.

**Prevalence**: ~5% of pet cat population (Persian, Himalayan, Exotic Shorthair)

**Physical Limitations**

| Condition | Effect on Lost Cat |
|-----------|-------------------|
| Compromised airways | Cannot sustain running; overheats rapidly |
| Heat intolerance | Speed drops to 0.2x in temperatures >80°F |
| Exercise intolerance | Maximum sustained movement: 10-15 minutes |
| Respiratory distress under stress | Panic escapes are self-limiting |

**Movement Modifiers for Brachycephalic Cats**

| Parameter | Modifier | Notes | Provenance |
|-----------|----------|-------|------------|
| Base Speed | 0.7x | Cannot maintain pace | [P] Veterinary |
| Stamina | 0.4x | Tires very quickly | [P] Veterinary |
| Max Distance | 50-100m | Physical limitation | [A] Estimated |
| Panic Duration | 0.3x | Cannot sustain flight | [A] Estimated |
| Heat Sensitivity | Extreme | Speed → 0.2x if temp > 80°F | [P] Veterinary |
| Threshold Time | 0.6x | Breaks cover sooner due to respiratory distress | [A] Estimated |

**Survival Implications**

- **Positive**: Limited travel range means they stay very close to escape point
- **Negative**: Higher mortality risk from heat exposure, respiratory distress
- **Behavioral**: More likely to seek shelter quickly due to physical distress
- **Recovery**: Usually found within 30 meters if they survive first 24 hours

### BRACHYCEPHALIC HEAT EMERGENCY (Cats)

**A brachycephalic cat lost on a hot day is a MEDICAL EMERGENCY.**

| Temperature | Survivability Window | Required Action |
|-------------|---------------------|-----------------|
| 80-90°F | 12-24 hours | Urgent search |
| 90°F+ | 4-8 hours | Critical emergency - immediate search |

**Heat Emergency Simulation Parameters**

```
IF cat.isBrachycephalic AND temperature > 80:
    # This is a medical emergency
    survivalHours = max(4, 24 - (temperature - 70) × 1.0)

    hourlyDeathRisk = 0.04 + (temperature - 80) × 0.03

    # Behavioral changes
    speed *= 0.1  # Nearly immobile
    thresholdTime *= 0.4  # Will break cover much sooner
    shelterSeekingProbability = 1.0  # Desperately seeks shade/cool

    # Alert flag for simulation output
    TRIGGER_EMERGENCY_ALERT("Brachycephalic cat in heat - hours to live")
```

**Modifier Application Order**

Apply brachycephalic constraints AFTER breed-specific modifiers:

```
1. Apply size modifiers
2. Apply age modifiers
3. THEN apply brachycephalic constraints (these take precedence)
4. Apply situational modifiers (health, terrain)
```

---

## Cat Layer 4: TEMPERAMENT

Cat temperaments follow a different classification than dogs, based on Kat Albrecht's framework [P]:

**Base Probabilities** (Before access history adjustment)

| Code | Temperament | Base Probability | Indoor-Only Adj | Outdoor-Access Adj | Provenance |
|------|-------------|------------------|-----------------|-------------------|------------|
| CUR | Curious/Clown | 20% | -5% | +10% | [P] Albrecht |
| CL | Care-less | 25% | +5% | +5% | [P] Albrecht |
| CAU | Cautious | 35% | +10% | -5% | [P] Albrecht |
| X | Xenophobic | 15% | +5% | -10% | [P] Albrecht |
| B | Bonded | 5% | +5% | -5% | [P] Albrecht |

### CUR - Curious/Clown (Cat): Gregarious Explorer

- **Normal behavior**: Gets into everything, greets strangers, runs to door when it opens
- **When displaced**: May initially hide, but **will travel** once fear subsides
- **Recovery pattern**: Likely found inside someone else's home, garage, or shed
- **Search strategy**: Flyers in 5+ block radius, door-to-door interviews
- **Catchability**: Medium - may approach humans but may also keep exploring

### CL - Care-less (Cat): Aloof Observer

- **Normal behavior**: Doesn't care much about people, watches strangers from distance
- **When displaced**: Hides initially, then will break cover and explore or return home
- **Recovery pattern**: May return on own after threshold, or be sighted nearby
- **Search strategy**: Physical search nearby, feeding stations, patience
- **Catchability**: Medium - not seeking humans but not avoiding them

### CAU - Cautious (Cat): Shy but Stable

- **Normal behavior**: Likes familiar people, hides when strangers visit, peeks out eventually
- **When displaced**: Hides in fear, typically close to escape point
- **Recovery pattern**: Often found hiding on own property or immediate neighbor's yard
- **Search strategy**: Thorough physical search of immediate area at night, calling softly
- **Catchability**: Easy if owner finds them, may come to familiar voice

### X - Xenophobic (Cat): Fearful/Feral-like

- **Normal behavior**: Panics when strangers come, hides under bed, won't emerge until they leave
- **When displaced**: Hides in silence, may not respond even to owner
- **Recovery pattern**: Typically found within 3 houses but may take weeks
- **Search strategy**: Humane trap REQUIRED, feeding stations, wildlife cameras
- **Catchability**: Very difficult - will not approach humans, may not even approach owner

### B - Bonded (Cat): Single-Person Cat

- **Normal behavior**: Attached to one person, follows them around, wary of others
- **When displaced**: Terrified, will only respond to specific owner
- **Recovery pattern**: May return to home/escape point looking for owner
- **Search strategy**: Owner-focused search, scent articles, calling at night
- **Catchability**: Easy for bonded person, very hard for others

#### Bonded Cat Movement Mechanic: Triangular Patrol

Unlike dogs who spiral inward toward home, bonded cats **patrol a fixed circuit** between anchor points:

```
FUNCTION bondedCatMovement(currentPos, homePos, escapePoint):

    # Bonded cats circle between home and escape point
    # Unlike dogs, cats don't spiral inward—they patrol a fixed circuit

    anchorPoints = [homePos, escapePoint, lastOwnerScentLocation]
    currentAnchor = nearestAnchor(currentPos, anchorPoints)
    nextAnchor = nextInCircuit(currentAnchor)

    # Movement is anchor-to-anchor, not continuous homing
    IF distance(currentPos, currentAnchor) < 10 meters:
        direction = toward(nextAnchor)
    ELSE:
        direction = toward(currentAnchor)

    # Only moves during low-activity hours
    IF timeOfDay NOT IN [dusk, night, dawn]:
        speed = 0.1x  # Nearly stationary during day

    RETURN direction, speed
```

**Behavioral Result**: Bonded cats produce a **triangular patrol pattern** between:
- Home location
- Escape point
- Last place owner's scent was detected

This makes them more predictable than other temperaments—stake out these three locations.

### Temperament Effects on Threshold

| Temperament | Time to Threshold | Threshold Behavior |
|-------------|-------------------|-------------------|
| CUR | 3-5 days | Starts exploring, may go into neighbor's house |
| CL | 7-10 days | Returns to escape point or meows |
| CAU | 10-12 days | Emerges at night, may return home |
| X | 14-21+ days | May enter trap when starving, still won't approach |
| B | 10-14 days | Returns to escape point, calling for owner |

---

## Cat Layer 5: BACKGROUND

**Base Probabilities**

| Code | Background | Description | Base Probability |
|------|------------|-------------|------------------|
| F | Family Cat | Raised from kitten in stable home | 50% |
| R | Rescue | Adopted as adult, unknown early history | 30% |
| FO | Feral-Origin | Born feral, later socialized | 8% |
| BR | Breeder | From breeder, often single-breed home | 7% |
| MH | Multi-Home | Has lived in multiple homes | 5% |

**Background Behavioral Modifiers**

| Background | Survival Skills | Outdoor Competence | Human Trust | Fear Baseline |
|------------|-----------------|-------------------|-------------|---------------|
| F | Low | Low | High | Low |
| R | Variable | Variable | Medium | Medium |
| FO | Very High | Very High | Low-Medium | High |
| BR | Very Low | Very Low | Medium-High | Low |
| MH | Medium | Variable | Medium | Medium |

**Background → Temperament Influence**

```
Family Cat (F):       CUR:25%  CL:30%  CAU:30%  X:5%   B:10%
Rescue (R):           CUR:15%  CL:25%  CAU:30%  X:25%  B:5%
Feral-Origin (FO):    CUR:5%   CL:20%  CAU:25%  X:45%  B:5%
Breeder (BR):         CUR:30%  CL:20%  CAU:35%  X:10%  B:5%
Multi-Home (MH):      CUR:20%  CL:30%  CAU:25%  X:15%  B:10%
```

---

## Cat Layer 6: ESCAPE TYPE

**Base Probabilities** [P] Categories adapted from Albrecht

### STARTLE ESCAPES (45% total)

| Code | Type | Description | Base Prob | Typical Response | Provenance |
|------|------|-------------|-----------|------------------|------------|
| ST1 | Door Dash | Ran out when door opened | 28% | Hides near home | [P] Albrecht |
| ST2 | Window Screen | Pushed through window screen | 10% | Falls/jumps, often injured | [P] Albrecht |
| ST3 | Noise Panic | Fireworks, thunder, construction | 5% | Runs to first cover | [P] Albrecht |
| ST4 | Predator Panic | Saw/heard coyote, dog, hawk | 2% | Fast flight, may be far | [P] Albrecht |

### EXPLORATORY ESCAPES (30% total)

| Code | Type | Description | Base Prob | Typical Response | Provenance |
|------|------|-------------|-----------|------------------|------------|
| EX1 | Curious Walkout | Investigated open door/window | 20% | Explores, may return | [P] Albrecht |
| EX2 | Hunting Instinct | Chased bird, squirrel, lizard | 8% | Variable distance | [P] Albrecht |
| EX3 | Mate-Seeking | Intact cat seeking mate | 2% | Males travel far | [P] Albrecht |

### DISPLACEMENT ESCAPES (25% total)

| Code | Type | Description | Base Prob | Typical Response | Provenance |
|------|------|-------------|-----------|------------------|------------|
| DI1 | Move Escape | Escaped during move to new home | 8% | Returns to OLD home | [P] Albrecht |
| DI2 | Facility Escape | Escaped from vet/groomer/boarding | 10% | Freezes near facility | [P] Albrecht |
| DI3 | Vehicle Escape | Jumped/fell from car | 4% | Freezes at roadside | [A] Estimated |
| DI4 | Visitor Escape | Left while pet-sitting | 3% | May not recognize home yet | [A] Estimated |

**Indoor/Outdoor Influence on Escape Type**

```
Indoor-Only (IO):     ST1:40%, ST2:20%, ST3:10%, EX1:20%, DI2:10%
Indoor-Supervised:    ST1:30%, ST3:15%, EX1:25%, DI2:20%, DI4:10%
Indoor w/ Outdoor:    ST1:20%, EX1:35%, EX2:15%, ST4:10%, DI1:20%
Outdoor-Access:       EX1:25%, EX2:20%, EX3:15%, ST4:10%, DI1:30%
Outdoor-Only:         EX2:30%, EX3:25%, ST4:15%, DI1:20%, Other:10%
```

---

## Cat Time-Dependent Behavior Dynamics

### The Threshold Model

**Critical distinction from dogs** [P]: Cats have a **threshold model** - they remain hidden until a breaking point. Fear decay does NOT begin until threshold is reached.

```
FUNCTION catThresholdStatus(hours, temperament, health):

    # Base threshold times by temperament (hours) [P] Albrecht - specific values [A]
    baseThreshold = {
        CUR: 84,    # 3.5 days [A] Estimated from behavioral observation
        CL: 192,    # 8 days [A] Estimated
        CAU: 264,   # 11 days [P] Albrecht typical value
        X: 360,     # 15 days [P] Albrecht documented cases
        B: 288      # 12 days [A] Estimated
    }

    # Modify by health [A] - all health modifiers are author estimates
    IF health == INJ:
        threshold = baseThreshold[temperament] × 0.3  # Much faster [A]
    ELIF health == SEN:
        threshold = baseThreshold[temperament] × 0.6  # [A]
    ELSE:
        threshold = baseThreshold[temperament]

    # Modify by weather [A]
    IF temperature < 40 OR > 90:
        threshold *= 0.5  # Exposure forces earlier emergence [A]

    IF hours < threshold × 0.8:
        RETURN "HIDING_DEEP"      # Will not emerge even if owner nearby
    ELIF hours < threshold:
        RETURN "HIDING_RESPONSIVE" # May respond to owner calling at night
    ELSE:
        RETURN "THRESHOLD_REACHED" # Will emerge, enter trap, or meow
```

### Hunger & Thirst Accumulation (Cats)

```
hunger(t) = min(1.0, t_hours / 120)   # Cats can go ~5 days without food
thirst(t) = min(1.0, t_hours / 72)    # But only ~3 days without water

# Thirst is the primary threshold trigger
thresholdModifier = max(hunger, thirst × 1.5)
```

### Cat Fear Persistence (Different from Dogs)

**Critical distinction**: Fear decay does NOT begin until threshold is reached. Pre-threshold, fear remains at maximum (1.0).

```
FUNCTION catFearLevel(hours, temperament, escapeType):

    # Fear decay does NOT begin until threshold is reached
    # Pre-threshold: fear = 1.0 (constant maximum)
    # Post-threshold: fear decays per the specified rates

    thresholdHours = getThreshold(temperament, health)

    IF hours < thresholdHours:
        RETURN 1.0  # No decay while hiding - cat is frozen in fear

    # Decay only begins after threshold
    hoursPostThreshold = hours - thresholdHours

    decayRates = {
        CUR: 0.05,   # Curious cats calm quickly
        CL: 0.03,
        CAU: 0.02,
        X: 0.008,    # Xenophobic cats stay fearful even after threshold
        B: 0.025
    }

    # Trauma escapes slow decay further
    IF escapeType IN [ST4, DI3]:
        decayRate = decayRates[temperament] * 0.5

    postThresholdFear = e^(-decayRates[temperament] × hoursPostThreshold)

    RETURN 0.3 + 0.7 × postThresholdFear  # Never drops below 0.3
```

**Visual Timeline**:
```
Fear Level
1.0 |████████████████████████████████████░░░░░░░░░░░░░
0.5 |                                    ░░░░░░░░░░░░░
0.3 |                                              ───
    +--------------------------------------------------
    0hr          Threshold                   +72hr
                 (varies by temperament)
```

---

## Cat Movement Parameters

### Phase 1: Initial Flight (First 0-30 minutes)

**By Escape Type:** [A] All values are author estimates

| Escape | Initial Speed | Duration | Distance | Hiding Trigger | Provenance |
|--------|---------------|----------|----------|----------------|------------|
| ST1 | 2.0x | 1-5 min | 5-30m | First cover found | [A] |
| ST2 | 0.3x (injured) | 0-1 min | 0-10m | Impact | [A] |
| ST3 | 3.0x | 5-15 min | 20-100m | Quiet area | [A] |
| ST4 | 4.0x | 10-30 min | 50-200m | Safe distance | [A] |
| EX1 | 0.5x | Ongoing | Variable | Doesn't hide initially | [A] |
| EX2 | 2.0x | 2-10 min | 10-50m | Prey lost | [A] |
| EX3 | 1.0x | Hours | 500m+ (males) | Finds mate | [A] |
| DI1 | 1.5x | 10-60 min | Toward old home | Recognition | [A] |
| DI2 | 2.5x | 5-20 min | 20-100m | First cover | [A] |
| DI3 | 0.2x | 0-5 min | Near road | Shock | [A] |
| DI4 | 0.5x | Ongoing | Variable | Confusion | [A] |

### Phase 2: Hiding (Hours to Days/Weeks)

After initial flight, most cats enter extended hiding:

```
FUNCTION hidingBehavior(cat, hours):

    IF cat.temperament == X:
        # Xenophobic cats are nearly immobile
        movementRadius = 5 meters
        movementFrequency = once every 24-48 hours (at night)

    ELIF cat.temperament == CAU:
        # Cautious cats make short forays
        movementRadius = 20 meters
        movementFrequency = once every 12-24 hours (at night)

    ELIF cat.temperament == CL:
        # Care-less cats explore a bit
        movementRadius = 50 meters
        movementFrequency = once every 8-12 hours

    ELIF cat.temperament == CUR:
        # Curious cats don't stay put
        movementRadius = 100+ meters
        movementFrequency = every 4-8 hours

    ELIF cat.temperament == B:
        # Bonded cats circle home area
        movementPattern = "triangular patrol"
        movementRadius = 30 meters
        movementFrequency = once every 12 hours
```

### Phase 3: Post-Threshold

After threshold is reached:

| Temperament | Behavior | Distance from Hiding Spot |
|-------------|----------|---------------------------|
| CUR | Active exploration, may enter neighbor's house | 200+ meters |
| CL | Returns to escape point or calls | 0-50 meters |
| CAU | Emerges at night, cautiously approaches home | 0-30 meters |
| X | Enters trap OR relocates to new hiding spot | 0-20 meters |
| B | Returns to escape point, calls for owner | 0-20 meters |

---

## Cat Outcome Probability Matrix

### Base Rates by Temperament and Access (Suburban, 30-day period)

**Indoor-Only Cats**

| Outcome | CUR | CL | CAU | X | B |
|---------|-----|-----|-----|---|---|
| Self-return | 20% | 25% | 15% | 5% | 30% |
| Found by owner | 30% | 30% | 40% | 20% | 35% |
| Picked up by stranger | 25% | 10% | 5% | 2% | 3% |
| At shelter | 10% | 8% | 5% | 3% | 4% |
| Still missing | 10% | 22% | 30% | 60% | 23% |
| Deceased | 5% | 5% | 5% | 10% | 5% |

**Outdoor-Access Cats**

| Outcome | CUR | CL | CAU | X | B |
|---------|-----|-----|-----|---|---|
| Self-return | 35% | 40% | 30% | 15% | 45% |
| Found by owner | 15% | 15% | 20% | 10% | 20% |
| Picked up by stranger | 20% | 10% | 8% | 3% | 5% |
| "Adopted" by neighbor | 15% | 15% | 12% | 2% | 3% |
| At shelter | 5% | 5% | 5% | 3% | 3% |
| Still missing | 5% | 10% | 20% | 57% | 19% |
| Deceased | 5% | 5% | 5% | 10% | 5% |

### Cause of Death Distribution (Cats)

| Cause | Indoor-Only | Outdoor-Access |
|-------|-------------|----------------|
| Vehicle strike | 45% | 50% |
| Predator (coyote, hawk, etc.) | 20% | 25% |
| Exposure/dehydration | 20% | 5% |
| Injury from fall/escape | 10% | 5% |
| Other | 5% | 15% |

### Time-Dependent Recovery

Research shows recovery drops significantly over time:

| Days Missing | Cumulative Recovery (Alive) | Notes |
|--------------|----------------------------|-------|
| 7 | 34% | Most self-returns happen |
| 14 | 45% | Threshold reached for most |
| 30 | 53% | Traps become critical |
| 60 | 58% | Plateau |
| 90 | 60% | Few found after this |
| 365 | 61% | Essentially final rate |

---

## Secondary Adoption Mechanism

Outdoor-access cats have a 12-15% probability of being fed by non-owners, which can lead to "adoption" by well-meaning strangers who believe the cat is a stray.

```
FUNCTION checkSecondaryAdoption(cat, day):

    # Only outdoor-access cats with friendly temperaments are at risk
    IF cat.accessHistory IN [OA, OO] AND cat.temperament IN [CUR, CL]:
        dailyAdoptionRisk = 0.03  # 3% per day

        IF cat.hasCollar == false:
            dailyAdoptionRisk *= 1.5

        IF cat.temperament == CUR:  # Curious cats approach readily
            dailyAdoptionRisk *= 2.0

        IF cat.isHealthyAppearing:
            dailyAdoptionRisk *= 0.7  # Looks cared-for, less likely taken in

        IF randomRoll() < dailyAdoptionRisk:
            cat.status = "ADOPTED_BY_STRANGER"
            cat.isMoving = false
            cat.location = strangerHome
            # Cat is now stationary—recovery requires flyers/social media
            # reaching this person

    RETURN cat.status
```

**Recovery from Secondary Adoption**

| Search Method | Effectiveness |
|---------------|---------------|
| Flyers in neighborhood | HIGH - neighbor may see and realize |
| Social media posts | HIGH - extends reach |
| Door-to-door interviews | VERY HIGH - direct contact |
| Waiting for return | ZERO - cat is comfortable |
| Shelter checks | LOW - cat won't be surrendered |

**Prevention Factors**

- Microchip: Allows identification if taken to vet
- Collar with ID: Immediate recognition as owned pet
- Distinctive appearance: Less likely mistaken for stray

---

## Special Scenarios

### Move Escape (DI1)

When cats escape during a move to a new home:

```
FUNCTION moveEscapeBehavior(cat, oldHome, newHome, escapePoint):

    # Cat does NOT recognize new home
    IF escapePoint.distanceTo(newHome) < 1 mile:
        # May try to return to old home
        IF cat.outdoorAccess:
            targetDirection = oldHome
            travelProbability = 0.4
        ELSE:
            # Indoor cat - freezes in confusion
            RETURN standardDisplacementBehavior()

    # Key insight: Search the OLD neighborhood too
    searchRecommendation = [
        "Search new area thoroughly",
        "Put feeder/trap at new home",
        "ALSO post flyers at OLD home - cat may appear there",
        "Check with old neighbors regularly"
    ]
```

### Window Fall Injuries (ST2)

Cats that push through or fall from window screens:

| Floor Level | Injury Probability | Injury Severity | Distance Traveled |
|-------------|-------------------|-----------------|-------------------|
| 1st floor | 20% | Minor | 10-50m |
| 2nd floor | 40% | Minor-Moderate | 5-20m |
| 3rd-6th floor | 60% | Moderate-Severe | 0-10m (if able to move) |
| 7th+ floor | 80% | Severe | 0-5m |

**Important**: Cats CAN survive falls from high floors ("high-rise syndrome"), but often with injuries. They tend to hide immediately near the building.

### Predator Areas

In areas with coyotes, birds of prey, or other predators:

```
predatorModifiers = {
    mortalityMultiplier: 1.5,     # Outdoor cats
    indoorMortalityMultiplier: 2.5, # Indoor cats have no predator awareness

    # Coyotes hunt at dawn/dusk
    highRiskHours: [5, 6, 7, 18, 19, 20],

    # Cat behavior change
    hidingIncrease: 1.3,  # Cats hide more in predator areas
    nocturnalActivityDecrease: 0.7  # Less night movement
}
```

---

## Trap-and-Reunite (TAR) Protocol

For fearful cats (CAU/X/B), humane trapping is often the ONLY recovery method.

### When to Deploy Traps

| Condition | Trap Deployment |
|-----------|-----------------|
| Indoor-only + X temperament | Day 1-2 |
| Indoor-only + CAU temperament | Day 5-7 if not found |
| Injured cat (any temperament) | Day 1 |
| Outdoor-access + X temperament | Day 7-10 |
| Feral-origin cat | Day 1 |

### Trap Placement

```
FUNCTION recommendTrapPlacement(escapePoint, sightings):

    # Primary location: Near last confirmed sighting or escape point
    primaryTrap = sightings.last() OR escapePoint

    # Secondary locations
    IF cat.accessHistory == IO:
        # Indoor cat - traps very close
        secondaryLocations = [
            "Under deck at escape address",
            "Neighbor's yard within 50m",
            "Any sighting location"
        ]
    ELSE:
        # Outdoor cat - wider radius
        secondaryLocations = [
            "Known food sources",
            "Previous outdoor territory",
            "Sighting locations"
        ]

    RETURN primaryTrap, secondaryLocations
```

### Baiting Strategy

| Time Since Escape | Bait Type | Notes |
|-------------------|-----------|-------|
| Day 1-3 | Strong-smelling (sardines, tuna) | Cat still well-fed, needs attraction |
| Day 4-7 | Regular food | Cat getting hungry |
| Day 7+ | Cat's own food + owner's scent | Familiar smell may help |
| After sighting | Whatever cat was eating at sighting | Already accepted it |

---

## Cat Search Methodology by Profile

### Indoor-Only + Curious (CUR)

1. Thorough search of 5+ block radius
2. Check ALL garages, sheds, cars
3. Door-to-door interviews
4. Flyers everywhere - cat likely went into someone's home
5. Check social media for "found cat" posts

### Indoor-Only + Cautious/Xenophobic (CAU/X)

1. **Don't call loudly** - may scare cat further
2. Physical search of immediate area (50m radius)
3. Search at night with flashlight (reflect eyes)
4. Deploy feeding station at escape point
5. Set humane trap within 48-72 hours
6. Trail cameras to confirm presence
7. Be patient - may take 2+ weeks

### Outdoor-Access + Any Temperament

1. Check all regular outdoor spots
2. Interview neighbors - may have been "adopted"
3. Check old home location if recently moved
4. Wider flyer distribution
5. Contact all vets/shelters in larger radius

### Displacement Escapes (DI1-4)

1. Search starts at displacement point, NOT home
2. Put owner's scent article at escape location
3. If move-related: search OLD home neighborhood
4. For facility escapes: search within 100m of facility

---

## Cat Profile Frequency Table

**Uncertainty Note**: Frequencies are [C] calculated from component layer probabilities. Each component has its own uncertainty (see Uncertainty Quantification section). 95% CI calculated using Monte Carlo propagation with 10,000 samples.

### HIGH FREQUENCY PROFILES (>1% each)

| Rank | Profile Code | Description | Est. Frequency | 95% CI |
|------|--------------|-------------|----------------|--------|
| 1 | ST1-CAU-F-IO-ADT-HOME-HLT | Door dash, cautious indoor family cat | 6.8% | (3.4%, 12.6%) |
| 2 | ST1-CL-F-IO-ADT-HOME-HLT | Door dash, care-less indoor family cat | 5.2% | (2.6%, 9.6%) |
| 3 | EX1-CL-F-IO-A-ADT-HOME-HLT | Curious walkout, care-less w/ outdoor access | 4.1% | (2.0%, 7.6%) |
| 4 | ST1-CUR-F-IO-ADT-HOME-HLT | Door dash, curious indoor cat | 3.8% | (1.9%, 7.0%) |
| 5 | EX1-CUR-F-IO-A-ADT-HOME-HLT | Curious walkout, curious w/ access | 3.5% | (1.7%, 6.5%) |
| 6 | ST1-X-R-IO-ADT-HOME-HLT | Door dash, xenophobic rescue indoor | 3.2% | (1.6%, 5.9%) |
| 7 | DI2-CAU-F-IO-ADT-FAR-HLT | Vet escape, cautious indoor cat | 2.9% | (1.4%, 5.4%) |
| 8 | ST1-CAU-F-IO-YNG-HOME-HLT | Door dash, cautious young indoor | 2.7% | (1.3%, 5.0%) |
| 9 | EX1-CL-F-OA-ADT-HOME-HLT | Curious walkout, care-less outdoor cat | 2.4% | (1.2%, 4.5%) |
| 10 | ST1-CL-R-IO-ADT-HOME-HLT | Door dash, care-less rescue indoor | 2.2% | (1.1%, 4.1%) |
| 11 | ST3-CAU-F-IO-ADT-HOME-HLT | Noise panic, cautious indoor | 2.0% | (1.0%, 3.7%) |
| 12 | DI1-CL-F-IO-A-ADT-FAR-HLT | Move escape, care-less w/ access | 1.8% | (0.9%, 3.3%) |
| 13 | ST2-CAU-F-IO-ADT-HOME-INJ | Window fall, cautious, injured | 1.6% | (0.8%, 3.0%) |
| 14 | EX2-CUR-F-OA-YNG-HOME-HLT | Hunting escape, curious young outdoor | 1.5% | (0.7%, 2.8%) |
| 15 | DI4-CAU-F-IO-ADT-NEAR-HLT | Pet-sitter escape, cautious | 1.3% | (0.6%, 2.4%) |

### MODERATE FREQUENCY PROFILES (0.3-1% each)

| Rank | Profile Code | Description | Est. Frequency | 95% CI |
|------|--------------|-------------|----------------|--------|
| 16 | ST1-B-F-IO-ADT-HOME-HLT | Door dash, bonded indoor | 0.9% | (0.4%, 1.7%) |
| 17 | ST4-X-R-IO-ADT-HOME-HLT | Predator panic, xenophobic rescue | 0.8% | (0.4%, 1.5%) |
| 18 | DI2-X-R-IO-ADT-FAR-HLT | Vet escape, xenophobic rescue | 0.7% | (0.3%, 1.3%) |
| 19 | ST1-X-FO-IO-ADT-HOME-HLT | Door dash, xenophobic feral-origin | 0.7% | (0.3%, 1.3%) |
| 20 | EX3-CL-F-OA-YNG-HOME-HLT | Mate-seeking, young intact outdoor | 0.6% | (0.3%, 1.1%) |
| 21 | DI1-CAU-F-IO-ADT-LOST-HLT | Move escape, cautious, at old home | 0.6% | (0.3%, 1.1%) |
| 22 | ST1-CAU-F-IO-SEN-HOME-CHR | Door dash, cautious senior w/ condition | 0.5% | (0.2%, 0.9%) |
| 23 | ST2-X-R-IO-ADT-HOME-INJ | Window fall, xenophobic rescue, injured | 0.5% | (0.2%, 0.9%) |
| 24 | DI3-CAU-F-IO-ADT-LOST-HLT | Vehicle escape, cautious | 0.4% | (0.2%, 0.7%) |
| 25 | EX1-CUR-F-OA-JUV-HOME-HLT | Curious walkout, juvenile outdoor | 0.4% | (0.2%, 0.7%) |

### LOW FREQUENCY BUT IMPORTANT PROFILES (<0.3%)

| Rank | Profile Code | Description | Est. Frequency | 95% CI | Notes |
|------|--------------|-------------|----------------|--------|-------|
| 26 | ST2-X-R-IO-ADT-HOME-INJ | Window fall, xenophobic, injured | 0.25% | (0.08%, 0.55%) | Very difficult |
| 27 | DI3-X-R-IO-ADT-LOST-INJ | Vehicle escape, xenophobic, injured, lost | 0.15% | (0.05%, 0.33%) | Worst case |
| 28 | ST4-X-FO-IO-ADT-FAR-HLT | Predator panic, feral-origin | 0.12% | (0.04%, 0.26%) | May never recover |
| 29 | DI2-X-FO-IO-SEN-FAR-MED | Vet escape, xeno senior on meds | 0.08% | (0.02%, 0.18%) | Critical timeline |
| 30 | ST1-X-R-IO-KIT-HOME-HLT | Door dash, xenophobic kitten | 0.05% | (0.01%, 0.12%) | Very vulnerable |

---

## Cat Layer Summary

| # | Layer | Type | Options | Key Impact |
|---|-------|------|---------|------------|
| 1 | Indoor/Outdoor | Intrinsic | 5 (IO/IS/IO-A/OA/OO) | Distance, behavior, survival |
| 2 | Age | Intrinsic | 5 (KIT/JUV/YNG/ADT/SEN) | Stamina, threshold time |
| 3 | Size | Intrinsic | 4 (S/M/L/XL) | Hiding ability |
| - | Brachycephalic | Physical Modifier | Boolean | Severe stamina/heat limits, faster threshold |
| 4 | Temperament | Intrinsic | 5 (CUR/CL/CAU/X/B) | Recovery method, threshold |
| 5 | Background | Intrinsic | 5 (F/R/FO/BR/MH) | Trust, survival skills |
| 6 | Territory | Situational | 4 (HOME/NEAR/FAR/LOST) | Hiding location |
| 7 | Escape Type | Situational | 11 (ST1-4, EX1-3, DI1-4) | Initial phase, distance |
| 8 | Health | Situational | 4 (HLT/INJ/CHR/MED) | Threshold time, survival |
| 9 | Owner Search | Situational | 5 (O0-O4) | Recovery probability |

---

# PART 4: SIMULATION PARAMETERS REFERENCE

All numerical parameters in one place for easy tuning.

---

## Movement Parameters

### Speed Modifiers

| Factor | Dog Value | Cat Value | Notes |
|--------|-----------|-----------|-------|
| **Size** | | | |
| Toy/Small | 0.4x-0.7x | 1.0x | Dogs vary more by size |
| Medium | 1.0x | 1.0x | Baseline |
| Large | 1.2x | 0.9x | |
| XL/Giant | 0.9x | 0.8x | |
| **Age** | | | |
| Puppy/Kitten | 0.7x | 0.7x | |
| Young | 1.2x | 1.2x | |
| Adult | 1.0x | 1.0x | |
| Senior | 0.5x | 0.5x | |
| **Brachycephalic** | 0.6x | 0.7x | |
| Brachy + Heat (>75/80°F) | 0.2x | 0.2x | Emergency |
| **Injury** | 0.3-0.7x | 0.2x | |

### Stamina Modifiers

| Factor | Dog Value | Cat Value |
|--------|-----------|-----------|
| Toy/Small | 0.3x-0.6x | N/A |
| Large | 1.3x | N/A |
| Puppy/Kitten | 0.5x | 0.4x |
| Young | 1.2x | 0.8x |
| Senior | 0.5x | 0.5x |
| Brachycephalic | 0.3x | 0.4x |

### Maximum Distance Per Day

| Factor | Dog Value | Cat Value |
|--------|-----------|-----------|
| Toy | 0.5 mi | N/A |
| Small | 1.5 mi | N/A |
| Medium | 4 mi | N/A |
| Large | 8 mi | N/A |
| XL | 5 mi | N/A |
| Indoor-only cat | N/A | 50m median |
| Outdoor-access cat | N/A | 315m median |
| Brachycephalic dog | 0.5-1.0 mi | |
| Brachycephalic cat | N/A | 50-100m |

---

## Time Dynamics Parameters

### Hunger Accumulation

| Species | Formula | Max Desperation |
|---------|---------|-----------------|
| Dog | `hunger(t) = min(1.0, t_hours / 72)` | 72 hours |
| Cat | `hunger(t) = min(1.0, t_hours / 120)` | 120 hours (5 days) |

### Thirst Accumulation

| Species | Formula | Critical Point |
|---------|---------|----------------|
| Dog | `thirst(t) = min(1.0, t_hours / 48)` | 48 hours |
| Cat | `thirst(t) = min(1.0, t_hours / 72)` | 72 hours |

### Fear Decay (Dogs - Continuous)

| Escape Type | Decay Rate (λ) | Half-Life |
|-------------|----------------|-----------|
| P1 (Noise) | 0.030 | ~23 hours |
| P2 (Attack) | 0.025 | ~28 hours |
| P3 (Trauma) | 0.012 | ~58 hours |
| D1 (Prey chase) | 0.040 | ~17 hours |
| D2 (Dog chase) | 0.050 | ~14 hours |
| W* (Walkouts) | 0.060 | ~12 hours |
| S1 (Vehicle) | 0.020 | ~35 hours |
| S2 (Facility) | 0.035 | ~20 hours |
| S3 (Handed-off) | 0.040 | ~17 hours |

Formula: `fear(t) = initial_fear × e^(-λt)`

### Cat Threshold Times (Hours)

| Temperament | Base Threshold | Injured | Senior |
|-------------|----------------|---------|--------|
| CUR | 84 (3.5 days) | 25 | 50 |
| CL | 192 (8 days) | 58 | 115 |
| CAU | 264 (11 days) | 79 | 158 |
| X | 360 (15 days) | 108 | 216 |
| B | 288 (12 days) | 86 | 173 |

Modifiers:
- Injured: × 0.3
- Senior: × 0.6
- Extreme weather (<40°F or >90°F): × 0.5
- Brachycephalic: × 0.6

### Cat Fear Decay Rates (Post-Threshold Only)

| Temperament | Decay Rate |
|-------------|------------|
| CUR | 0.05 |
| CL | 0.03 |
| CAU | 0.02 |
| X | 0.008 |
| B | 0.025 |

Minimum fear level: 0.3 (never drops below)

---

## Mortality Parameters

### Base Hourly Mortality Risk (Dogs)

| Phase | G | C | A | X | B |
|-------|---|---|---|---|---|
| Panic (0-4h) | 0.001 | 0.003 | 0.004 | 0.015 | 0.002 |
| Transition (4-24h) | 0.0002 | 0.001 | 0.001 | 0.005 | 0.0005 |
| Settled (24h+) | 0.0001 | 0.0005 | 0.0005 | 0.002 | 0.0002 |
| Settled + Flushed (X only) | - | - | - | 0.005 | - |

### Terrain Mortality Multipliers

| Terrain | Dog | Cat |
|---------|-----|-----|
| Urban | 2.0x | 1.5x |
| Suburban | 1.0x | 1.0x |
| Rural | 0.5x | 1.2x (predators) |
| Wooded | 0.4x | 1.5x (predators) |

### Brachycephalic Heat Emergency

**Dogs:**
| Temperature | Survival Hours | Hourly Death Risk |
|-------------|----------------|-------------------|
| 75-85°F | 24-48 | 0.02/hr |
| 85-95°F | 6-12 | 0.05 + (temp-85)×0.02 |
| 95°F+ | 2-4 | Critical |

Formula: `survivalHours = max(2, 24 - (temperature - 75) × 0.8)`

**Cats:**
| Temperature | Survival Hours | Hourly Death Risk |
|-------------|----------------|-------------------|
| 80-90°F | 12-24 | 0.04/hr |
| 90°F+ | 4-8 | 0.04 + (temp-80)×0.03 |

Formula: `survivalHours = max(4, 24 - (temperature - 70) × 1.0)`

---

## Recovery Parameters

### Search Intensity Multipliers

| Intensity | Found by Owner | Stranger Return |
|-----------|----------------|-----------------|
| O0 | 0.1x | 0.2x |
| O1 | 0.5x | 0.8x |
| O2 | 1.0x | 1.0x |
| O3 | 1.8x | 1.5x |
| O4 | 2.5x | 2.0x |

### Dog Pickup Rates by Size

| Size | Pickup Rate |
|------|-------------|
| Toy | 90% |
| Small | 70% |
| Medium | 40% |
| Large | 25% |
| XL | 15% |

### Cat Recovery by Time (Research Data)

| Days | Cumulative Recovery |
|------|---------------------|
| 7 | 34% |
| 14 | 45% |
| 30 | 53% |
| 60 | 58% |
| 90 | 60% |
| 365 | 61% |

### Secondary Adoption Risk (Cats)

Base daily risk: 3%
- No collar: × 1.5
- Curious temperament: × 2.0
- Healthy appearance: × 0.7

---

## Bonded Movement Parameters

### Dog (Gravity Spiral)

```
gravityStrength = 0.4      # 40% bias toward home
explorationStrength = 0.6  # 60% random exploration
scentInfluence = 0.4       # When near scent point
scentRange = 0.5 miles     # Scent detection radius
```

### Cat (Triangular Patrol)

```
anchorApproachDistance = 10 meters  # Switch to next anchor
daytimeSpeedMultiplier = 0.1        # Nearly stationary during day
activeHours = [dusk, night, dawn]
```

---

## Initial Flight Parameters

### Dog Initial Speed by Escape Type

| Escape | Speed | Duration |
|--------|-------|----------|
| P1 | 3.0x | 30-120 min |
| P2 | 3.5x | 15-60 min |
| P3 | 3.0x | 60-240 min |
| D1 | 2.5x | 5-30 min |
| D2 | 2.0x | 10-60 min |
| W1-W5 | 0.5x-1.5x | Ongoing |
| S1-S3 | 0.3x-1.5x | Variable |

### Cat Initial Speed by Escape Type

| Escape | Speed | Duration | Distance |
|--------|-------|----------|----------|
| ST1 | 2.0x | 1-5 min | 5-30m |
| ST2 | 0.3x | 0-1 min | 0-10m |
| ST3 | 3.0x | 5-15 min | 20-100m |
| ST4 | 4.0x | 10-30 min | 50-200m |
| EX1 | 0.5x | Ongoing | Variable |
| EX2 | 2.0x | 2-10 min | 10-50m |
| EX3 | 1.0x | Hours | 500m+ |
| DI1 | 1.5x | 10-60 min | Toward old home |
| DI2 | 2.5x | 5-20 min | 20-100m |
| DI3 | 0.2x | 0-5 min | Near road |
| DI4 | 0.5x | Ongoing | Variable |

---

## Cat Hiding Phase Movement

| Temperament | Radius | Frequency |
|-------------|--------|-----------|
| X | 5m | Every 24-48h |
| CAU | 20m | Every 12-24h |
| CL | 50m | Every 8-12h |
| CUR | 100m+ | Every 4-8h |
| B | 30m | Every 12h (patrol) |

---

## Uncertainty Quantification

All point estimates in this document should be treated as the **mean** of a probability distribution. The distribution width depends on parameter provenance.

### Distribution Selection by Provenance

| Provenance | Distribution | Width | Implementation |
|------------|--------------|-------|----------------|
| [R] Research | Normal | CV = 0.10 (±10%) | `Normal(μ=value, σ=value×0.10)` |
| [P] Practitioner | Normal | CV = 0.25 (±25%) | `Normal(μ=value, σ=value×0.25)` |
| [A] Assumption | Normal | CV = 0.50 (±50%) | `Normal(μ=value, σ=value×0.50)` |
| [C] Calculated | Derived | Propagate | Combine parent uncertainties |

**CV = Coefficient of Variation (standard deviation / mean)**

### Special Cases

#### Bounded Parameters (0-1 range)

For probability values, use Beta distributions:

```python
def probability_to_beta(p, provenance):
    """Convert probability with uncertainty to Beta distribution."""
    # Effective sample size determines concentration
    if provenance == 'R':
        n_eff = 100  # High confidence
    elif provenance == 'P':
        n_eff = 20   # Moderate confidence
    else:  # 'A'
        n_eff = 5    # Low confidence

    alpha = p * n_eff
    beta = (1 - p) * n_eff
    return Beta(alpha, beta)

# Example: 25% probability [P]
# Beta(5, 15) → mean=0.25, wide spread
```

#### Multipliers (must be positive)

For speed/stamina multipliers, use Log-Normal:

```python
def multiplier_to_lognormal(m, provenance):
    """Convert multiplier with uncertainty to LogNormal distribution."""
    cv = {'R': 0.10, 'P': 0.25, 'A': 0.50}[provenance]
    sigma = np.sqrt(np.log(1 + cv**2))
    mu = np.log(m) - sigma**2 / 2  # Adjust so mean = m
    return LogNormal(mu, sigma)

# Example: 1.3x speed [A]
# LogNormal → mean=1.3, cannot go negative
```

#### Time Parameters (durations, thresholds)

For time values, use Gamma distributions:

```python
def time_to_gamma(hours, provenance):
    """Convert time parameter to Gamma distribution."""
    cv = {'R': 0.10, 'P': 0.25, 'A': 0.50}[provenance]
    # Gamma parameterization: shape=k, scale=θ
    # mean = k×θ, variance = k×θ²
    # cv = 1/√k → k = 1/cv²
    k = 1 / (cv ** 2)
    theta = hours / k
    return Gamma(k, theta)

# Example: 264 hour threshold [P]
# Gamma(16, 16.5) → mean=264, positively skewed
```

### Propagating Uncertainty

When parameters combine (e.g., modifiers stacking), propagate uncertainty:

```python
def propagate_uncertainty(base_value, modifiers):
    """
    Monte Carlo propagation of uncertainty through modifier chain.
    Each modifier has its own distribution.
    """
    n_samples = 1000
    results = np.zeros(n_samples)

    for i in range(n_samples):
        value = base_value.sample()
        for mod in modifiers:
            value *= mod.sample()
        results[i] = value

    return {
        'mean': np.mean(results),
        'std': np.std(results),
        'ci_95': (np.percentile(results, 2.5), np.percentile(results, 97.5))
    }
```

### Why Composite CIs Can Be Tighter Than Component Uncertainties

The profile frequency CIs in the tables may appear narrower than the ±50% uncertainty on individual [A] parameters. This is expected for several reasons:

1. **Averaging effect**: Profile frequencies aggregate across many simulated cases. The CI reflects uncertainty in the *population frequency estimate*, not in individual case predictions.

2. **Constrained space**: Profile frequencies must sum to 100%. When one profile frequency increases, others must decrease. This constraint bounds the overall variability.

3. **Multiplicative attenuation**: When probabilities multiply (e.g., P(temperament) × P(age) × P(background)), each factor's relative contribution to the final frequency is reduced.

4. **Correlated errors**: Some component uncertainties partially cancel when combined. If one parameter is overestimated, another may compensate.

**Important caveat**: The tight CIs in the frequency tables represent *statistical uncertainty* in the model's output, not *model accuracy*. Real-world validation may reveal systematic biases that widen effective uncertainty beyond these CIs. Treat these as lower bounds on true uncertainty.

```python
# Example: Why profile frequency CI can be tighter
# Individual components all have [A] ±50% uncertainty:
#   P(Gregarious) = 25% ± 12.5%
#   P(Adult) = 60% ± 30%
#   P(Family background) = 65% ± 32.5%
#
# Compound profile frequency:
#   P(G-ADT-F) ≈ 0.25 × 0.60 × 0.65 = 9.75%
#
# But Monte Carlo propagation gives CI ≈ (5.1%, 16.2%)
# - Not 9.75% ± 50% = (4.9%, 14.6%) as simple error propagation would suggest
# - Actual spread is asymmetric due to multiplicative combination
# - The *relative* uncertainty remains high (~55% CV)
# - The *absolute* CI width looks manageable because base rate is small
```

### Example Parameter Distributions

| Parameter | Point Estimate | Provenance | Distribution |
|-----------|---------------|------------|--------------|
| Indoor cat median distance | 50m | [R] | Normal(50, 5) |
| Dog panic speed | 3.0x | [A] | LogNormal(μ=1.03, σ=0.47) |
| Cat threshold (CAU) | 264hr | [P] | Gamma(16, 16.5) |
| Gregarious temperament prob | 25% | [P] | Beta(5, 15) |
| Fear decay rate (P1) | 0.030 | [A] | Normal(0.030, 0.015) |

### Simulation Implementation

During Monte Carlo simulation, sample from distributions:

```python
def initialize_simulation_parameters(profile, provenance_tags):
    """
    Convert point estimates to distributions based on provenance.
    Sample once per simulation run for consistency.
    """
    params = {}

    for param_name, (value, provenance) in profile.items():
        if is_probability(param_name):
            dist = probability_to_beta(value, provenance)
        elif is_multiplier(param_name):
            dist = multiplier_to_lognormal(value, provenance)
        elif is_time(param_name):
            dist = time_to_gamma(value, provenance)
        else:
            dist = value_to_normal(value, provenance)

        params[param_name] = dist.sample()

    return params
```

### Reporting Results with Uncertainty

Simulation outputs should include uncertainty estimates:

```python
simulation_result = {
    'location_probability': {
        'grid': probability_grid,          # 2D array
        'grid_uncertainty': uncertainty_grid,  # Per-cell std
        'credible_region_50': polygon_50,  # 50% credible region
        'credible_region_95': polygon_95   # 95% credible region
    },
    'outcome_probabilities': {
        'self_return': {'mean': 0.23, 'ci_95': (0.18, 0.29)},
        'found_by_owner': {'mean': 0.31, 'ci_95': (0.24, 0.38)},
        'still_missing': {'mean': 0.15, 'ci_95': (0.10, 0.22)},
        'deceased': {'mean': 0.08, 'ci_95': (0.04, 0.14)}
    }
}
```

---

# PART 5: SIMULATION MECHANICS

Complete algorithmic specification for implementing the Monte Carlo simulation.

---

## Time Discretization

```yaml
simulation:
  tick_duration_minutes: 5      # Each simulation step
  max_duration_hours: 720       # 30 days maximum
  position_precision_meters: 1  # Coordinate precision
  grid_resolution_meters: 10    # Probability grid cell size

  phases:
    initial_flight:
      duration_varies_by: "escape_type"
      max_hours: 4

    transition:
      start_hours: 4
      end_hours: 24

    settled:
      start_hours: 24
      end_hours: max_duration
```

---

## Animal State Structure

```python
@dataclass
class AnimalState:
    # Position
    position: Tuple[float, float]  # (lat, lng)

    # Status
    status: Literal["fleeing", "hiding", "foraging", "traveling",
                    "resting", "collapsed", "deceased", "recovered"]

    # Physiological state (0.0 to 1.0)
    fear_level: float
    hunger_level: float
    thirst_level: float
    stamina: float

    # Health
    health: Literal["HLT", "INJ", "CHR", "MED"]
    injury_severity: float  # 0.0-1.0 if INJ

    # Temporal
    hours_since_escape: float
    hours_since_last_water: float
    hours_since_last_food: float

    # Spatial memory
    current_hiding_spot: Optional[Tuple[float, float]]
    visited_locations: List[Tuple[float, float]]

    # Cat-specific
    threshold_reached: bool  # For cats only
    hiding_phase: Literal["DEEP", "RESPONSIVE", "EMERGED"]  # Cats

    # Dog-specific
    last_scent_point: Optional[Tuple[float, float]]  # Bonded dogs
```

---

## Environment State Structure

```python
@dataclass
class Environment:
    # Terrain at current position
    terrain_at_position: Literal["urban", "suburban", "rural", "wooded"]
    terrain_distribution: Dict[str, float]  # For mixed-use areas

    # Weather
    temperature_f: float
    precipitation: Literal["none", "rain", "storm"]
    wind_speed_mph: float

    # Temporal
    time_of_day: Literal["dawn", "morning", "afternoon", "dusk", "night"]
    day_of_week: int
    is_holiday: bool  # July 4th, New Years, etc.

    # Local features
    nearby_hiding_spots: List[HidingSpot]  # Within detection radius
    nearby_water_sources: List[Tuple[float, float]]
    nearby_food_sources: List[Tuple[float, float]]

    # Risk factors
    traffic_density: float  # 0.0-1.0
    human_activity_level: float  # 0.0-1.0
    predator_risk: float  # 0.0-1.0

    # Search activity
    active_search_zones: List[Polygon]
    feeding_stations: List[Tuple[float, float]]
    traps: List[Tuple[float, float]]
    scent_articles: List[ScentArticle]


@dataclass
class HidingSpot:
    location: Tuple[float, float]
    quality: float  # 0.0-1.0 (concealment quality)
    type: Literal["vegetation", "structure", "vehicle", "other"]
    occupied: bool


@dataclass
class ScentArticle:
    location: Tuple[float, float]
    owner_scent_strength: float  # Decays over time
    placed_hours_ago: float
```

---

## Main Simulation Loop

```python
def simulate_lost_pet(
    profile: AnimalProfile,
    initial_position: Tuple[float, float],
    environment_provider: Callable,  # Returns Environment for position
    max_hours: float = 720,
    search_activity: SearchActivity = None
) -> SimulationResult:
    """
    Run single Monte Carlo simulation of lost pet.

    Returns trajectory, outcome, and all events.
    """

    # Initialize state
    state = initialize_state(profile, initial_position)
    trajectory = [state.position]
    events = []

    tick_hours = 5 / 60  # 5 minutes per tick

    while state.hours_since_escape < max_hours:
        # Get current environment
        environment = environment_provider(state.position, state.hours_since_escape)

        # Update physiological state
        state = update_physiology(state, tick_hours, environment)

        # Check for critical conditions
        critical = check_critical_conditions(state, profile, environment)
        if critical:
            events.append(critical)
            if critical.type == "DEATH":
                state.status = "deceased"
                break

        # Calculate movement
        if state.status not in ["deceased", "recovered", "collapsed"]:
            direction, distance = calculate_movement(state, profile, environment)
            new_position = apply_movement(state.position, direction, distance, environment)
            state.position = new_position
            trajectory.append(new_position)

        # Check for status transitions
        transitions = check_status_transitions(state, profile, environment, search_activity)
        for transition in transitions:
            events.append(transition)
            if transition.new_status == "recovered":
                state.status = "recovered"
                break
            elif transition.new_status == "deceased":
                state.status = "deceased"
                break

        if state.status in ["deceased", "recovered"]:
            break

        # Update temporal state
        state.hours_since_escape += tick_hours

        # Update terrain cache if moved significantly
        if should_requery_terrain(state, trajectory):
            environment = environment_provider(state.position, state.hours_since_escape)

    return SimulationResult(
        trajectory=trajectory,
        final_state=state,
        events=events,
        outcome=determine_outcome(state),
        hours_elapsed=state.hours_since_escape
    )
```

---

## Physiology Update

```python
def update_physiology(
    state: AnimalState,
    tick_hours: float,
    environment: Environment
) -> AnimalState:
    """Update hunger, thirst, stamina, fear each tick."""

    # Hunger accumulation
    # Dogs: 72 hours to max, Cats: 120 hours
    hunger_rate = 1.0 / 72 if state.species == "dog" else 1.0 / 120
    state.hunger_level = min(1.0, state.hunger_level + hunger_rate * tick_hours)

    # Thirst accumulation (more urgent)
    # Dogs: 48 hours, Cats: 72 hours
    thirst_rate = 1.0 / 48 if state.species == "dog" else 1.0 / 72
    state.thirst_level = min(1.0, state.thirst_level + thirst_rate * tick_hours)

    # Stamina recovery/depletion
    if state.status in ["resting", "hiding"]:
        # Recover stamina while resting
        recovery_rate = 0.1  # 10% per hour
        state.stamina = min(1.0, state.stamina + recovery_rate * tick_hours)
    elif state.status in ["fleeing", "traveling"]:
        # Deplete stamina while moving
        depletion_rate = 0.15  # 15% per hour at base speed
        state.stamina = max(0.0, state.stamina - depletion_rate * tick_hours)

    # Fear decay (species-specific)
    state = update_fear(state, tick_hours)

    # Water consumption if near water source
    if is_near_water(state.position, environment, threshold_m=20):
        state.thirst_level = max(0.0, state.thirst_level - 0.3)
        state.hours_since_last_water = 0

    # Food consumption if near food source
    if is_near_food(state.position, environment, threshold_m=10):
        if should_eat(state):  # Based on temperament, fear level
            state.hunger_level = max(0.0, state.hunger_level - 0.2)
            state.hours_since_last_food = 0

    return state


# Fear decay rate constants (λ values for exponential decay)
# Half-lives noted in comments; values are [A] Author estimates
# Note: These are rough estimates (~1 day, ~2 days, etc.) not precise measurements
FEAR_DECAY_RATES = {
    # Dog escape types - half-life noted in comments
    "P1": 0.030,  # Noise panic - ~1 day half-life [A]
    "P2": 0.025,  # Attack panic - ~1.2 days [A]
    "P3": 0.012,  # Trauma - ~2.5 days (PTSD-like) [A]
    "D1": 0.040,  # Prey chase - ~0.7 days [A]
    "D2": 0.050,  # Dog chase - ~0.6 days [A]
    "W1": 0.060,  # Walkout - ~0.5 days (minimal fear) [A]
    "W2": 0.060,
    "W3": 0.080,  # Habitual - ~0.4 days [A]
    "W4": 0.050,
    "W5": 0.045,
    "S1": 0.020,  # Vehicle displacement - ~1.5 days [A]
    "S2": 0.035,  # Facility escape - ~0.8 days [A]
    "S3": 0.040,  # Handed-off loss - ~0.7 days [A]
}

CAT_FEAR_DECAY_RATES = {
    # Cat temperaments - post-threshold only
    "CUR": 0.05,   # Curious cats calm quickly - ~0.6 days [A]
    "CL": 0.03,    # Care-less - ~1 day [A]
    "CAU": 0.02,   # Cautious - ~1.5 days [A]
    "X": 0.008,    # Xenophobic - ~3.5 days (very slow) [A]
    "B": 0.025,    # Bonded - ~1.2 days [A]
}


def update_fear(state: AnimalState, tick_hours: float) -> AnimalState:
    """Species-specific fear decay."""

    if state.species == "dog":
        # Dogs: Continuous exponential decay from moment of escape
        decay_rate = FEAR_DECAY_RATES[state.escape_type]
        state.fear_level *= math.exp(-decay_rate * tick_hours)

    elif state.species == "cat":
        # Cats: No decay until threshold reached
        if not state.threshold_reached:
            state.fear_level = 1.0  # Constant maximum
        else:
            # Post-threshold decay
            decay_rate = CAT_FEAR_DECAY_RATES[state.temperament]
            new_fear = state.fear_level * math.exp(-decay_rate * tick_hours)
            state.fear_level = max(0.3, new_fear)  # Floor at 0.3

    return state
```

---

## Movement Calculation

### Dog Movement

```python
def calculate_dog_movement(
    state: AnimalState,
    profile: AnimalProfile,
    environment: Environment
) -> Tuple[float, float]:  # (direction_radians, distance_meters)
    """
    Calculate dog movement vector for this tick.
    """

    # Base speed: 50 meters per 5-minute tick (~600m/hour)
    base_speed = 50

    # === APPLY SPEED MODIFIERS ===
    speed = base_speed
    speed *= SIZE_SPEED_MODIFIER[profile.size]
    speed *= AGE_SPEED_MODIFIER[profile.age]
    speed *= HEALTH_SPEED_MODIFIER[state.health]
    speed *= stamina_curve(state.stamina)
    speed *= TERRAIN_SPEED_MODIFIER[environment.terrain_at_position]
    speed *= WEATHER_SPEED_MODIFIER[environment.precipitation]
    speed *= TIME_ACTIVITY_MODIFIER[profile.temperament][environment.time_of_day]

    # Brachycephalic heat penalty
    if profile.brachycephalic and environment.temperature_f > 75:
        heat_penalty = 0.33 * (1 - (environment.temperature_f - 75) / 30)
        speed *= max(0.1, heat_penalty)

    # Apply modifier bounds (prevent extremes)
    speed = apply_speed_bounds(speed, base_speed)

    # === CALCULATE DIRECTION ===
    if state.status == "fleeing":
        direction = calculate_flight_direction(state, profile, environment)

    elif profile.temperament == "X":  # Xenophobic
        direction = calculate_xenophobic_direction(state, environment)

    elif profile.temperament == "B":  # Bonded - gravity spiral
        direction = calculate_bonded_gravity_spiral(
            state.position,
            profile.home_location,
            state.last_scent_point
        )

    elif profile.temperament == "G":  # Gregarious - human seeking
        direction = calculate_human_seeking_direction(state, environment)

    else:  # C, A - general exploration
        direction = calculate_random_walk_with_drift(state, environment)

    # Add directional noise
    direction += random.gauss(0, DIRECTION_NOISE_STD)

    # Add distance noise
    distance = speed * random.uniform(0.7, 1.3)

    return (direction, distance)


def calculate_bonded_gravity_spiral(
    current_pos: Tuple[float, float],
    home_pos: Tuple[float, float],
    scent_point: Optional[Tuple[float, float]]
) -> float:
    """
    Bonded dogs have constant directional bias toward home.
    Returns direction in radians.
    """

    # Primary attraction: home
    home_vector = normalize_vector(subtract(home_pos, current_pos))

    # Secondary attraction: last scent point (if within range)
    if scent_point and distance(current_pos, scent_point) < 800:  # 0.5 miles
        scent_vector = normalize_vector(subtract(scent_point, current_pos))
        attraction_vector = (
            0.6 * home_vector[0] + 0.4 * scent_vector[0],
            0.6 * home_vector[1] + 0.4 * scent_vector[1]
        )
    else:
        attraction_vector = home_vector

    # Random exploration component
    random_direction = random.uniform(0, 2 * math.pi)
    random_vector = (math.cos(random_direction), math.sin(random_direction))

    # Combine: 40% home bias, 60% exploration
    GRAVITY_STRENGTH = 0.4
    final_vector = (
        GRAVITY_STRENGTH * attraction_vector[0] + (1 - GRAVITY_STRENGTH) * random_vector[0],
        GRAVITY_STRENGTH * attraction_vector[1] + (1 - GRAVITY_STRENGTH) * random_vector[1]
    )

    return math.atan2(final_vector[1], final_vector[0])


def calculate_xenophobic_direction(
    state: AnimalState,
    environment: Environment
) -> float:
    """
    Xenophobic dogs flee from human activity, hide when safe.
    """

    if environment.human_activity_level > 0.3:
        # Flee away from human activity
        # Find direction with lowest human activity
        escape_direction = find_lowest_activity_direction(state.position, environment)
        return escape_direction
    else:
        # Low activity - cautious foraging behavior
        # Move toward resources if hungry/thirsty, otherwise stay put
        if state.hunger_level > 0.5 or state.thirst_level > 0.5:
            return find_nearest_resource_direction(state.position, environment)
        else:
            # Minimal movement, random short forays
            return random.uniform(0, 2 * math.pi)
```

### Cat Movement

```python
def calculate_cat_movement(
    state: AnimalState,
    profile: AnimalProfile,
    environment: Environment
) -> Tuple[float, float]:
    """
    Cat movement is phase-dependent: FLIGHT -> HIDING -> POST_THRESHOLD
    """

    phase = determine_cat_phase(state, profile)

    # === PHASE 1: INITIAL FLIGHT ===
    if phase == "FLIGHT":
        if state.hours_since_escape < get_flight_duration(profile.escape_type):
            direction = state.initial_flight_direction
            speed = FLIGHT_SPEED[profile.escape_type] * get_base_cat_speed(profile)
            return (direction, speed / 12)  # Per 5-min tick
        else:
            # Transition: find hiding spot
            nearest_hiding = find_nearest_hiding_spot(state.position, environment)
            if nearest_hiding:
                direction = direction_to(state.position, nearest_hiding.location)
                distance = min(20, distance_to(state.position, nearest_hiding.location))
                return (direction, distance)
            else:
                return (0, 0)  # Stay put if no hiding spot

    # === PHASE 2: HIDING ===
    elif phase == "HIDING":
        # Minimal movement - occasional forays for water
        if should_make_hiding_foray(state, profile, environment):
            foray_direction = calculate_foray_direction(state, environment)
            foray_distance = HIDING_FORAY_DISTANCE[profile.temperament]
            return (foray_direction, foray_distance)
        else:
            return (0, 0)  # Stay hidden

    # === PHASE 3: POST-THRESHOLD ===
    elif phase == "POST_THRESHOLD":
        if profile.temperament == "B":
            # Triangular patrol
            direction = calculate_triangular_patrol(state, profile)
            speed = POST_THRESHOLD_SPEED["B"]
        elif profile.temperament == "CUR":
            # Active exploration
            direction = calculate_curious_exploration(state, environment)
            speed = POST_THRESHOLD_SPEED["CUR"]
        else:
            # Cautious emergence
            direction = calculate_cautious_emergence(state, profile, environment)
            speed = POST_THRESHOLD_SPEED[profile.temperament]

        # Only move during low-activity hours for non-CUR cats
        if profile.temperament != "CUR":
            if environment.time_of_day not in ["dusk", "night", "dawn"]:
                speed *= 0.1

        return (direction, speed / 12)

    return (0, 0)


def calculate_triangular_patrol(
    state: AnimalState,
    profile: AnimalProfile
) -> float:
    """
    Bonded cats patrol fixed circuit between anchor points.
    """

    anchor_points = [
        profile.home_location,
        profile.escape_point,
        state.last_scent_point or profile.home_location
    ]

    # Find nearest anchor
    current_anchor_idx = find_nearest_anchor_index(state.position, anchor_points)
    current_anchor = anchor_points[current_anchor_idx]

    # If close to current anchor, move to next
    if distance(state.position, current_anchor) < 10:
        next_anchor_idx = (current_anchor_idx + 1) % len(anchor_points)
        return direction_to(state.position, anchor_points[next_anchor_idx])
    else:
        return direction_to(state.position, current_anchor)


def determine_cat_phase(state: AnimalState, profile: AnimalProfile) -> str:
    """Determine which behavioral phase cat is in."""

    flight_duration = get_flight_duration(profile.escape_type)
    threshold_time = calculate_threshold_time(profile, state)

    if state.hours_since_escape < flight_duration:
        return "FLIGHT"
    elif state.hours_since_escape < threshold_time:
        return "HIDING"
    else:
        state.threshold_reached = True
        return "POST_THRESHOLD"


def should_make_hiding_foray(
    state: AnimalState,
    profile: AnimalProfile,
    environment: Environment
) -> bool:
    """Determine if hiding cat should make resource-seeking foray."""

    # Check foray probability based on temperament and needs
    foray_interval = HIDING_FORAY_INTERVAL[profile.temperament]
    hours_since_last_foray = state.hours_since_escape % foray_interval

    # Only foray during low-activity hours
    if environment.time_of_day not in ["night", "dawn", "dusk"]:
        return False

    # More likely to foray when thirsty
    thirst_urgency = state.thirst_level > 0.6

    # Xenophobic cats are very reluctant
    if profile.temperament == "X" and not thirst_urgency:
        return False

    # Time-based trigger
    return hours_since_last_foray < 0.5  # Within 30 minutes of interval


HIDING_FORAY_INTERVAL = {
    "X": 36,    # Every 36 hours
    "CAU": 18,  # Every 18 hours
    "CL": 10,   # Every 10 hours
    "CUR": 6,   # Every 6 hours
    "B": 14     # Every 14 hours
}

HIDING_FORAY_DISTANCE = {
    "X": 5,     # 5 meters max
    "CAU": 20,  # 20 meters
    "CL": 50,   # 50 meters
    "CUR": 100, # 100 meters
    "B": 30     # 30 meters
}
```

---

## Movement Application with Obstacles

```python
def apply_movement(
    position: Tuple[float, float],
    direction: float,
    distance: float,
    environment: Environment
) -> Tuple[float, float]:
    """
    Apply movement while handling obstacles, roads, water bodies, fences.
    """

    target = calculate_target_position(position, direction, distance)

    # Get obstacles along path
    obstacles = get_obstacles_on_path(position, target, environment)

    for obstacle in obstacles:
        if obstacle.type == "road":
            # Probability of crossing based on temperament and traffic
            cross_prob = ROAD_CROSSING_PROB[obstacle.traffic_level]
            if random.random() < cross_prob:
                # Cross the road - log event for mortality check
                log_event("crossed_road", obstacle.traffic_level)
            else:
                # Deflect along road
                target = deflect_along_obstacle(position, target, obstacle)

        elif obstacle.type == "water_body":
            if obstacle.width_m > 20:
                # Can't cross - deflect
                target = deflect_along_obstacle(position, target, obstacle)
            # Small streams can be crossed

        elif obstacle.type == "fence":
            can_pass = can_overcome_fence(profile, obstacle.height_m)
            if not can_pass:
                target = deflect_along_obstacle(position, target, obstacle)

        elif obstacle.type == "building":
            target = deflect_along_obstacle(position, target, obstacle)

    # Clamp to simulation bounds
    target = clamp_to_bounds(target, environment.simulation_bounds)

    return target


ROAD_CROSSING_PROB = {
    "low": 0.9,      # Quiet residential
    "medium": 0.6,   # Moderate traffic
    "high": 0.3,     # Busy road
    "highway": 0.05  # Very unlikely to attempt
}


def can_overcome_fence(profile: AnimalProfile, height_m: float) -> bool:
    """Determine if animal can get past fence."""

    if profile.species == "cat":
        return height_m < 2.5  # Cats can climb most fences

    # Dogs based on size
    jump_heights = {
        "T": 0.3,   # Toy
        "S": 0.5,   # Small
        "M": 1.0,   # Medium
        "L": 1.5,   # Large
        "XL": 1.2   # Giant (less agile)
    }
    return height_m < jump_heights.get(profile.size, 1.0)


def deflect_along_obstacle(
    position: Tuple[float, float],
    target: Tuple[float, float],
    obstacle: Obstacle
) -> Tuple[float, float]:
    """
    When movement path is blocked by obstacle, deflect along its edge.
    Returns new target position that skirts the obstacle.
    """

    # Get intersection point with obstacle boundary
    intersection = find_path_intersection(position, target, obstacle.geometry)

    if intersection is None:
        return target  # No actual intersection

    # Calculate deflection direction (tangent to obstacle at intersection)
    tangent = calculate_obstacle_tangent(obstacle.geometry, intersection)

    # Choose deflection direction (left or right of obstacle)
    # Prefer direction that keeps us closer to original target
    original_direction = direction_to(position, target)
    tangent_direction = math.atan2(tangent[1], tangent[0])

    # Two possible tangent directions (opposite)
    tangent_alt = tangent_direction + math.pi

    # Pick the one that deviates less from original heading
    diff1 = abs(normalize_angle(tangent_direction - original_direction))
    diff2 = abs(normalize_angle(tangent_alt - original_direction))

    chosen_tangent = tangent_direction if diff1 < diff2 else tangent_alt

    # Calculate deflected target
    remaining_distance = distance(intersection, target) * 0.8  # Lose some distance
    deflected_target = (
        intersection[0] + remaining_distance * math.cos(chosen_tangent),
        intersection[1] + remaining_distance * math.sin(chosen_tangent)
    )

    # Ensure we're not deflecting INTO another obstacle
    if is_inside_obstacle(deflected_target, obstacle):
        # Push outside
        deflected_target = push_outside_obstacle(deflected_target, obstacle)

    return deflected_target


def clamp_to_bounds(
    position: Tuple[float, float],
    bounds: Tuple[float, float, float, float]  # (min_lat, min_lng, max_lat, max_lng)
) -> Tuple[float, float]:
    """Ensure position stays within simulation boundary."""
    lat, lng = position
    min_lat, min_lng, max_lat, max_lng = bounds

    clamped_lat = max(min_lat, min(max_lat, lat))
    clamped_lng = max(min_lng, min(max_lng, lng))

    return (clamped_lat, clamped_lng)
```

---

## Status Transitions

```python
def check_status_transitions(
    state: AnimalState,
    profile: AnimalProfile,
    environment: Environment,
    search_activity: SearchActivity
) -> List[StatusTransition]:
    """
    Check for recovery, death, and other status changes.
    """

    transitions = []

    # === MORTALITY CHECK ===
    mortality_prob = calculate_mortality_probability(state, profile, environment)
    if random.random() < mortality_prob:
        cause = determine_death_cause(state, profile, environment)
        transitions.append(StatusTransition(
            new_status="deceased",
            cause=cause,
            location=state.position
        ))
        return transitions  # No further checks needed

    # === RECOVERY CHECKS ===

    # Check trap capture
    if search_activity and search_activity.traps:
        for trap in search_activity.traps:
            if distance(state.position, trap.location) < 5:  # Within 5m
                capture_prob = calculate_trap_capture_prob(state, profile)
                if random.random() < capture_prob:
                    transitions.append(StatusTransition(
                        new_status="recovered",
                        recovery_type="trap",
                        location=trap.location
                    ))
                    return transitions

    # Check human encounter
    if environment.human_activity_level > 0.2:
        encounter_prob = environment.human_activity_level * 0.1  # Base encounter rate
        if random.random() < encounter_prob:
            pickup_prob = calculate_pickup_probability(state, profile)
            if random.random() < pickup_prob:
                transitions.append(StatusTransition(
                    new_status="recovered",
                    recovery_type="stranger_pickup" if random.random() > 0.3 else "owner_found",
                    location=state.position
                ))
                return transitions

    # Check self-return (near home)
    if distance(state.position, profile.home_location) < 20:
        return_prob = calculate_self_return_probability(state, profile)
        if random.random() < return_prob:
            transitions.append(StatusTransition(
                new_status="recovered",
                recovery_type="self_return",
                location=profile.home_location
            ))
            return transitions

    # === CAT THRESHOLD TRANSITION ===
    if profile.species == "cat" and not state.threshold_reached:
        threshold_time = calculate_threshold_time(profile, state)
        if state.hours_since_escape >= threshold_time:
            state.threshold_reached = True
            state.hiding_phase = "EMERGED"
            transitions.append(StatusTransition(
                event_type="threshold_reached",
                hours=state.hours_since_escape
            ))

    return transitions


def calculate_mortality_probability(
    state: AnimalState,
    profile: AnimalProfile,
    environment: Environment
) -> float:
    """Calculate per-tick mortality probability."""

    tick_hours = 5 / 60  # 5 minutes

    # Get base hourly risk for phase and temperament
    phase = determine_phase(state)
    base_hourly_risk = BASE_MORTALITY_RISK[profile.species][profile.temperament][phase]

    # Apply terrain multiplier
    risk = base_hourly_risk * TERRAIN_MORTALITY_MULT[environment.terrain_at_position]

    # Traffic risk if crossing roads
    if "crossed_road" in state.recent_events:
        traffic_level = state.recent_events["crossed_road"]
        risk += ROAD_MORTALITY_RISK[traffic_level]

    # Brachycephalic heat emergency
    if profile.brachycephalic:
        if profile.species == "dog" and environment.temperature_f > 85:
            risk += 0.05 + (environment.temperature_f - 85) * 0.02
        elif profile.species == "cat" and environment.temperature_f > 90:
            risk += 0.04 + (environment.temperature_f - 90) * 0.03

    # Injury increases risk
    if state.health == "INJ":
        risk *= 1.5 + state.injury_severity

    # Dehydration critical
    if state.thirst_level > 0.95:
        risk += 0.1  # High death risk

    # Convert hourly to per-tick
    tick_risk = risk * tick_hours

    # Apply cap
    return min(tick_risk, 0.5 / 12)  # Max 50% per hour


def calculate_pickup_probability(
    state: AnimalState,
    profile: AnimalProfile
) -> float:
    """Probability that human encounter results in pickup."""

    # Base approachability by temperament
    base_approach = {
        # Dogs
        "G": 0.9, "C": 0.5, "A": 0.2, "X": 0.05, "B": 0.3,
        # Cats
        "CUR": 0.6, "CL": 0.3, "CAU": 0.2, "X": 0.02, "B": 0.15
    }

    approachability = base_approach.get(profile.temperament, 0.3)

    # Hunger/thirst increases approachability (desperation)
    need = max(state.hunger_level, state.thirst_level * 1.5)
    need_modifier = need * 0.4  # Up to +40%

    # Temperament ceiling for X
    if profile.temperament == "X":
        max_approach = 0.25
    else:
        max_approach = 0.95

    final_prob = min(max_approach, approachability + need_modifier)

    # Size affects pickup (for dogs)
    if profile.species == "dog":
        final_prob *= SIZE_PICKUP_MODIFIER[profile.size]

    return final_prob


SIZE_PICKUP_MODIFIER = {
    "T": 1.0,    # Toy - easily picked up
    "S": 0.9,    # Small
    "M": 0.7,    # Medium
    "L": 0.5,    # Large - harder to grab
    "XL": 0.3    # Giant - intimidating
}
```

---

## Critical Condition Detection

```python
def check_critical_conditions(
    state: AnimalState,
    profile: AnimalProfile,
    environment: Environment
) -> Optional[CriticalCondition]:
    """
    Detect when stacked conditions create qualitative phase change.
    """

    # === BRACHYCEPHALIC HEAT EMERGENCY ===
    if profile.brachycephalic:
        if profile.species == "dog" and environment.temperature_f > 90:
            survival_hours = max(2, 24 - (environment.temperature_f - 75) * 0.8)
            return CriticalCondition(
                type="BRACHY_HEAT_EMERGENCY",
                behavior_override="immobile_dying",
                survival_hours=survival_hours,
                message=f"Brachycephalic dog in extreme heat - {survival_hours:.0f} hours to live"
            )

        if profile.species == "cat" and environment.temperature_f > 90:
            survival_hours = max(4, 24 - (environment.temperature_f - 70) * 1.0)
            return CriticalCondition(
                type="BRACHY_HEAT_EMERGENCY",
                behavior_override="immobile_dying",
                survival_hours=survival_hours,
                message=f"Brachycephalic cat in extreme heat - {survival_hours:.0f} hours to live"
            )

    # === SEVERE INJURY + EXPOSURE ===
    if state.health == "INJ" and state.injury_severity > 0.7:
        if environment.temperature_f < 40 or environment.temperature_f > 95:
            return CriticalCondition(
                type="INJURY_EXPOSURE_EMERGENCY",
                behavior_override="immobile_dying",
                survival_hours=12,
                message="Severely injured animal with exposure risk"
            )

    # === TOTAL EXHAUSTION ===
    if state.stamina < 0.05 and state.thirst_level > 0.9:
        return CriticalCondition(
            type="EXHAUSTION_CRITICAL",
            behavior_override="collapsed",
            survival_hours=24,
            message="Animal collapsed from exhaustion/dehydration"
        )

    # === DEHYDRATION CRITICAL ===
    if state.thirst_level >= 1.0:
        return CriticalCondition(
            type="DEHYDRATION_CRITICAL",
            behavior_override="dying",
            survival_hours=6,
            message="Animal in critical dehydration"
        )

    return None
```

---

## Modifier Bounds and Diminishing Returns

```python
# === MODIFIER BOUNDS ===
MODIFIER_BOUNDS = {
    "speed": {"min": 0.05, "max": 5.0},
    "stamina": {"min": 0.1, "max": 2.0},
    "fear_level": {"min": 0.0, "max": 1.0},
    "approachability": {"min": 0.01, "max": 0.99},
    "mortality_rate_hourly": {"min": 0.0, "max": 0.5}
}


def apply_modifiers_with_diminishing_returns(
    base_value: float,
    modifiers: List[float],
    param_type: str
) -> float:
    """
    Apply modifiers with diminishing returns for penalties.
    Prevents extreme stacking from producing unrealistic values.
    """

    bonuses = [m for m in modifiers if m > 1.0]
    penalties = [m for m in modifiers if m < 1.0]

    # Bonuses stack multiplicatively (up to cap)
    bonus_multiplier = 1.0
    for b in bonuses:
        bonus_multiplier *= b
    bonus_multiplier = min(bonus_multiplier, MODIFIER_BOUNDS[param_type]["max"])

    # Penalties use diminishing returns
    penalty_multiplier = 1.0
    for p in penalties:
        reduction = 1.0 - p
        diminished_reduction = math.sqrt(reduction) * 0.7
        penalty_multiplier *= (1.0 - diminished_reduction)

    penalty_multiplier = max(penalty_multiplier, MODIFIER_BOUNDS[param_type]["min"])

    return base_value * bonus_multiplier * penalty_multiplier


def apply_speed_bounds(speed: float, base_speed: float) -> float:
    """Clamp speed to valid range."""
    min_speed = base_speed * MODIFIER_BOUNDS["speed"]["min"]
    max_speed = base_speed * MODIFIER_BOUNDS["speed"]["max"]
    return max(min_speed, min(max_speed, speed))
```

---

## Speed Modifier Tables

```python
SIZE_SPEED_MODIFIER = {
    # Dogs
    "T": 0.4, "S": 0.7, "M": 1.0, "L": 1.2, "XL": 0.9,
    # Cats use different scale
    "cat_S": 1.0, "cat_M": 1.0, "cat_L": 0.9, "cat_XL": 0.8
}

AGE_SPEED_MODIFIER = {
    "PUP": 0.7, "KIT": 0.7,
    "JUV": 1.2,
    "YNG": 1.2,
    "ADT": 1.0,
    "SEN": 0.5
}

HEALTH_SPEED_MODIFIER = {
    "HLT": 1.0,
    "INJ": 0.4,  # Significant impairment
    "CHR": 0.7,
    "MED": 0.9   # Initially normal, degrades
}

TERRAIN_SPEED_MODIFIER = {
    "urban": 0.9,     # Obstacles, but flat
    "suburban": 1.0,  # Baseline
    "rural": 1.1,     # Open terrain
    "wooded": 0.7     # Undergrowth slows movement
}

WEATHER_SPEED_MODIFIER = {
    "none": 1.0,
    "rain": 0.7,
    "storm": 0.3
}

def stamina_curve(stamina: float) -> float:
    """Speed reduction as stamina depletes."""
    if stamina > 0.5:
        return 1.0
    elif stamina > 0.2:
        return 0.5 + stamina
    else:
        return 0.3 + stamina  # Minimum 0.3x speed
```

### Stamina System Clarification

**Tick vs Cumulative Application**:

1. **Stamina state** (0.0 to 1.0) is **cumulative** across the entire simulation:
   - Depletes when moving (fleeing/traveling status)
   - Recovers when resting/hiding
   - Persists between ticks as part of `AnimalState`

2. **Stamina curve** is applied **per-tick** as a speed multiplier:
   - Each tick, current stamina determines speed for that tick only
   - Low stamina → slower movement → less distance → less depletion
   - Creates natural feedback loop: exhausted animals slow down

3. **Update sequence each tick**:
   ```
   1. Read current stamina from state
   2. Apply stamina_curve() to calculate this tick's speed
   3. Calculate movement distance using modified speed
   4. Update stamina based on activity (deplete or recover)
   5. Store new stamina in state for next tick
   ```

4. **Edge cases**:
   - `stamina = 0.0`: Animal can still move at 0.3x base speed (crawling)
   - `stamina = 1.0`: No speed bonus beyond 1.0x (cap)
   - Status change: If animal transitions to "resting" mid-simulation, stamina begins recovering

---

## Simulation Convergence and Termination

### Termination Conditions

The simulation ends when ANY of these conditions is met:

```python
def should_terminate_simulation(
    state: AnimalState,
    max_hours: float = 720
) -> Tuple[bool, str]:
    """
    Check if simulation should end.
    Returns (should_terminate, reason).
    """

    # === EXPLICIT OUTCOMES ===
    if state.status == "recovered":
        return (True, "recovered")

    if state.status == "deceased":
        return (True, "deceased")

    # === TIME LIMIT ===
    if state.hours_since_escape >= max_hours:
        return (True, "max_duration_reached")

    # === EDGE CASES ===

    # Animal left simulation bounds and didn't return
    if state.consecutive_ticks_out_of_bounds > 100:  # ~8 hours outside
        return (True, "left_simulation_area")

    # Animal is effectively immobile (collapsed, severe injury)
    if state.status == "collapsed" and state.hours_in_collapsed > 48:
        # Transition to deceased if not rescued
        return (True, "deceased_from_collapse")

    return (False, None)
```

### Edge Case Handling

| Edge Case | Handling | Outcome |
|-----------|----------|---------|
| **Reaches max_hours (720h)** | Simulation ends | `still_missing` outcome |
| **Exits simulation bounds** | Position clamped; if persists 8+ hours, terminates | `left_simulation_area` |
| **Stamina reaches 0** | Animal continues at 0.3x speed | Continues (not terminal) |
| **Thirst reaches 1.0** | Critical condition triggered | 6-hour survival window |
| **Stuck in obstacle** | Force push to nearest valid position | Continues |
| **Trap capture during hiding** | Capture probability checked each tick | `recovered` if captured |

### Simulation Bounds

```python
def calculate_simulation_bounds(
    escape_location: Tuple[float, float],
    profile: AnimalProfile,
    hours_to_simulate: float
) -> Tuple[float, float, float, float]:
    """
    Calculate bounding box for simulation area.
    Returns (min_lat, min_lng, max_lat, max_lng).
    """

    # Estimate maximum possible travel distance
    if profile.species == "cat":
        max_speed_km_hr = 0.8  # Cats move slowly
    else:
        max_speed_km_hr = 4.0  # Dogs can cover ground

    # Theoretical maximum radius (unlikely to reach)
    max_radius_km = max_speed_km_hr * hours_to_simulate * 0.5  # 50% efficiency

    # Cap at reasonable distance
    max_radius_km = min(max_radius_km, 50)  # 50km max

    # Add buffer
    buffer_km = max_radius_km * 1.2

    # Convert to lat/lng offset (~111km per degree latitude)
    lat_offset = buffer_km / 111.0
    lng_offset = buffer_km / (111.0 * math.cos(math.radians(escape_location[0])))

    return (
        escape_location[0] - lat_offset,
        escape_location[1] - lng_offset,
        escape_location[0] + lat_offset,
        escape_location[1] + lng_offset
    )
```

### Outcome Assignment at Termination

```python
def determine_final_outcome(
    state: AnimalState,
    termination_reason: str,
    profile: AnimalProfile
) -> str:
    """
    Assign final outcome category based on termination state.
    """

    if termination_reason == "recovered":
        # Further classify recovery type
        if state.recovery_type == "self_return":
            return "self_return"
        elif state.recovery_type == "trap":
            return "found_by_owner"  # Trap implies owner effort
        elif state.recovery_type == "stranger_pickup":
            return "stranger_return"
        elif state.recovery_type == "shelter_intake":
            return "at_shelter"
        else:
            return "found_by_owner"

    elif termination_reason in ["deceased", "deceased_from_collapse"]:
        return "deceased"

    elif termination_reason == "max_duration_reached":
        # Animal survived but not recovered
        return "still_missing"

    elif termination_reason == "left_simulation_area":
        # Treat as still missing (may be found elsewhere)
        return "still_missing"

    return "still_missing"  # Default
```

---

# PART 6: SIGHTING INTEGRATION (BAYESIAN UPDATES)

Mechanism to update probability distribution based on sighting reports during active search.

---

## Sighting Data Structure

```yaml
sighting_report:
  # Core identification
  id: string
  timestamp: datetime
  reporter_id: string

  # Location
  location: [lat, lng]
  location_accuracy_m: float  # "on 5th street" vs "exact address"
  location_type: "exact_address" | "intersection" | "block" | "neighborhood"

  # Confidence
  confidence: float  # 0.0-1.0, reporter's certainty
  reporter_credibility: float  # 0.0-1.0, repeat reporter? known to owner?

  # Description match
  description_match:
    size: "match" | "close" | "mismatch" | "unknown"
    color: "match" | "close" | "mismatch" | "unknown"
    markings: "match" | "close" | "mismatch" | "unknown"
    collar: "yes" | "no" | "unknown"
    breed_match: "match" | "close" | "mismatch" | "unknown"

  # Behavioral observation
  behavior_observed: "running" | "walking" | "hiding" | "stationary" | "eating" | "unknown"
  direction_of_travel: float | null  # Radians, if observed
  appeared_injured: boolean | null
  appeared_frightened: boolean | null

  # Evidence
  photo_available: boolean
  photo_verified: boolean  # If photo confirms match
```

---

## Initializing the Prior Distribution

Before applying Bayesian updates, the probability grid must be initialized from the behavioral profile. This creates the initial search probability distribution based on where the animal is likely to be.

```python
def initialize_prior_from_profile(
    profile: AnimalProfile,
    escape_location: Tuple[float, float],  # (lat, lng)
    grid_metadata: GridMetadata,
    hours_since_escape: float = 0.0,
    terrain_map: Optional[TerrainMap] = None
) -> np.ndarray:
    """
    Create initial probability grid from behavioral profile.

    Uses profile characteristics to estimate initial distribution:
    - Temperament affects distance from escape point
    - Species affects directional bias
    - Terrain affects accessibility

    Returns:
        2D probability array normalized to sum to 1.0
    """

    grid_shape = (grid_metadata.n_rows, grid_metadata.n_cols)
    prior = np.zeros(grid_shape)

    # Get profile-based distance parameters
    if profile.species == "cat":
        # Cats stay close, especially initially
        mean_distance_m = get_cat_median_distance(profile.temperament)
        distance_std_m = mean_distance_m * 0.8  # Wide spread
    else:  # Dog
        mean_distance_m = get_dog_median_distance(
            profile.temperament,
            profile.escape_type,
            hours_since_escape
        )
        distance_std_m = mean_distance_m * 1.2  # Even wider for dogs

    # Get escape point in grid coordinates
    escape_i, escape_j = grid_metadata.coords_to_grid(escape_location)

    for i in range(grid_shape[0]):
        for j in range(grid_shape[1]):
            cell_coords = grid_metadata.grid_to_coords(i, j)
            distance_m = haversine_meters(cell_coords, escape_location)

            # === DISTANCE-BASED PROBABILITY ===
            # Rayleigh distribution for distance from origin
            # More realistic than Gaussian for 2D dispersion
            sigma = mean_distance_m / np.sqrt(np.pi / 2)  # Mode at mean_distance
            distance_prob = rayleigh_pdf(distance_m, sigma)

            # === DIRECTIONAL BIAS (optional) ===
            direction_prob = 1.0
            if profile.species == "dog" and profile.escape_type:
                # Dogs may have directional movement based on escape type
                direction_prob = get_escape_direction_weight(
                    profile.escape_type,
                    cell_coords,
                    escape_location
                )

            # === TERRAIN ACCESSIBILITY ===
            terrain_prob = 1.0
            if terrain_map is not None:
                terrain = terrain_map.get_terrain(cell_coords)
                terrain_prob = get_terrain_accessibility(terrain, profile)

            # === COMBINE FACTORS ===
            prior[i, j] = distance_prob * direction_prob * terrain_prob

    # Normalize to probability distribution
    if prior.sum() > 0:
        prior /= prior.sum()
    else:
        # Fallback: uniform distribution centered on escape point
        prior[escape_i, escape_j] = 1.0

    return prior


def get_cat_median_distance(temperament: str) -> float:
    """Return expected median distance in meters by cat temperament."""
    # From Part 3: Cat Distance Ranges by Temperament
    distances = {
        "CUR": 300,   # 1-3 houses, median ~300m [P]
        "CL": 150,    # Usually within 3 houses [P]
        "CAU": 75,    # Often hiding within 1 house [P]
        "X": 25,      # Typically within 5 houses, but frozen nearby [P]
        "B": 100      # May venture toward owner's routine places [P]
    }
    return distances.get(temperament, 100)


def get_dog_median_distance(
    temperament: str,
    escape_type: str,
    hours: float
) -> float:
    """Return expected median distance in meters by dog profile."""
    # From Part 2: Dog Movement Patterns
    # Base by temperament
    base_distances = {
        "G": 800,   # Gregarious - moderate, seeks people
        "C": 600,   # Clingy - stays closer
        "A": 1200,  # Aloof - variable
        "X": 1500,  # Xenophobic - bolts far
        "B": 500    # Bonded - returns toward known locations
    }
    base = base_distances.get(temperament, 800)

    # Modify by escape type
    escape_multipliers = {
        "P1": 2.0, "P2": 2.5, "P3": 1.5,  # Panic - far
        "D1": 1.8, "D2": 1.0,              # Distraction - varies
        "W1": 1.0, "W2": 0.8, "W3": 0.5, "W4": 0.6, "W5": 0.7,  # Wandered - moderate
        "S1": 0.5, "S2": 0.6, "S3": 0.4,   # Strayed - closer
    }
    multiplier = escape_multipliers.get(escape_type, 1.0)

    # Distance increases with time (dogs keep moving)
    time_factor = 1.0 + 0.1 * min(hours, 24)  # Cap at 24h

    return base * multiplier * time_factor


def get_terrain_accessibility(terrain: str, profile: AnimalProfile) -> float:
    """Weight probability by terrain accessibility for this profile."""
    if profile.species == "cat":
        # Cats prefer areas with hiding spots
        weights = {
            "urban": 0.7,      # Some hiding, but dangerous
            "suburban": 1.0,   # Ideal - gardens, sheds, porches
            "rural": 0.6,      # Open, fewer hiding spots
            "wooded": 0.8      # Good hiding, but predators
        }
    else:  # Dog
        # Dogs affected more by terrain traversability
        weights = {
            "urban": 0.6,      # Obstacles, traffic
            "suburban": 1.0,   # Navigable
            "rural": 0.9,      # Open
            "wooded": 0.5      # Slow going
        }
    return weights.get(terrain, 1.0)
```

---

## Bayesian Update Algorithm

```python
def update_distribution_with_sighting(
    prior_distribution: np.ndarray,  # 2D probability grid over search area
    sighting: SightingReport,
    profile: AnimalProfile,
    current_time: datetime,
    grid_metadata: GridMetadata
) -> np.ndarray:
    """
    Returns posterior distribution after incorporating sighting.

    Uses Bayes' theorem:
    P(location | sighting) ∝ P(sighting | location) × P(location)
    """

    # Calculate likelihood: P(sighting | animal actually at each location)
    likelihood_grid = np.zeros_like(prior_distribution)

    time_since_sighting_hours = (current_time - sighting.timestamp).total_seconds() / 3600

    for i in range(prior_distribution.shape[0]):
        for j in range(prior_distribution.shape[1]):
            cell_location = grid_metadata.grid_to_coords(i, j)

            # Distance from sighting location
            dist_m = haversine_meters(cell_location, sighting.location)

            # === SPATIAL LIKELIHOOD ===
            # Animal could have moved from sighting location
            max_travel_m = estimate_max_travel(profile, time_since_sighting_hours)

            # Gaussian likelihood centered on sighting location
            # Sigma accounts for location accuracy + possible travel
            sigma = sighting.location_accuracy_m + max_travel_m
            spatial_likelihood = gaussian_2d(dist_m, sigma=sigma)

            # === DESCRIPTION MATCH LIKELIHOOD ===
            description_score = calculate_description_match_score(sighting)

            # === BEHAVIORAL PLAUSIBILITY ===
            behavior_score = calculate_behavior_plausibility(
                sighting.behavior_observed,
                profile,
                time_since_sighting_hours
            )

            # === COMBINE LIKELIHOODS ===
            likelihood_grid[i, j] = (
                spatial_likelihood *
                description_score *
                behavior_score *
                sighting.confidence *
                sighting.reporter_credibility
            )

    # Apply Bayes' theorem
    posterior = prior_distribution * likelihood_grid

    # Normalize
    if posterior.sum() > 0:
        posterior /= posterior.sum()
    else:
        # Sighting doesn't match - return prior unchanged
        return prior_distribution

    return posterior


def calculate_description_match_score(sighting: SightingReport) -> float:
    """Convert description match fields to likelihood multiplier."""

    scores = {
        "match": 1.0,
        "close": 0.7,
        "mismatch": 0.1,  # Low but not zero (witness could be wrong)
        "unknown": 0.5
    }

    dm = sighting.description_match
    size_score = scores[dm.size]
    color_score = scores[dm.color]
    marking_score = scores[dm.markings]
    breed_score = scores.get(dm.breed_match, 0.5)

    # Photo verification overrides
    if sighting.photo_verified:
        return 1.0  # Confirmed match
    elif sighting.photo_available and not sighting.photo_verified:
        return 0.3  # Photo didn't match

    # Geometric mean of scores
    return (size_score * color_score * marking_score * breed_score) ** 0.25


def calculate_behavior_plausibility(
    behavior: str,
    profile: AnimalProfile,
    hours_since_escape: float
) -> float:
    """
    Is the observed behavior consistent with this profile at this time?
    """

    # Expected behaviors by temperament and time
    if profile.species == "cat":
        if hours_since_escape < calculate_threshold_time(profile, None):
            # Pre-threshold: should be hiding
            plausibility = {
                "hiding": 1.0,
                "stationary": 0.8,
                "walking": 0.2,
                "running": 0.1,
                "eating": 0.3,
                "unknown": 0.5
            }
        else:
            # Post-threshold: more active
            plausibility = {
                "hiding": 0.5,
                "stationary": 0.6,
                "walking": 1.0,
                "running": 0.4,
                "eating": 0.9,
                "unknown": 0.5
            }
    else:  # Dog
        # Dogs are generally more mobile
        if profile.temperament == "X":
            plausibility = {
                "hiding": 0.9,
                "stationary": 0.7,
                "walking": 0.3,
                "running": 0.8,  # When flushed
                "eating": 0.4,
                "unknown": 0.5
            }
        else:
            plausibility = {
                "hiding": 0.4,
                "stationary": 0.6,
                "walking": 1.0,
                "running": 0.5,
                "eating": 0.8,
                "unknown": 0.5
            }

    return plausibility.get(behavior, 0.5)


def estimate_max_travel(profile: AnimalProfile, hours: float) -> float:
    """Estimate maximum distance animal could have traveled in given hours."""

    if profile.species == "cat":
        # Cats move slowly, especially pre-threshold
        base_speed_mph = 0.5  # ~800 m/hr max
        if profile.temperament in ["X", "CAU"]:
            base_speed_mph *= 0.3  # Very slow for fearful cats
    else:
        base_speed_mph = 2.0  # Dogs can cover more ground

    # Apply temperament modifier
    speed_mult = {
        "G": 0.8, "C": 1.0, "A": 0.7, "X": 0.5, "B": 0.6,
        "CUR": 1.2, "CL": 0.8, "CAU": 0.4
    }.get(profile.temperament, 0.8)

    max_distance_miles = base_speed_mph * speed_mult * hours
    return max_distance_miles * 1609.34  # Convert to meters
```

---

## Negative Evidence (Search Effort)

```python
def update_distribution_with_search_effort(
    prior_distribution: np.ndarray,
    searched_area: Polygon,
    search_thoroughness: float,  # 0.0-1.0
    detection_probability: float,  # Given animal present, prob of finding
    grid_metadata: GridMetadata
) -> np.ndarray:
    """
    If we searched an area and found nothing, reduce probability there.

    P(location | not_found) ∝ P(not_found | location) × P(location)
    """

    # Probability of missing the animal if it was there
    miss_probability = 1 - (search_thoroughness * detection_probability)

    posterior = prior_distribution.copy()

    for i in range(posterior.shape[0]):
        for j in range(posterior.shape[1]):
            cell_location = grid_metadata.grid_to_coords(i, j)

            if point_in_polygon(cell_location, searched_area):
                # Reduce probability (animal wasn't found here)
                posterior[i, j] *= miss_probability

    # Renormalize
    if posterior.sum() > 0:
        posterior /= posterior.sum()

    return posterior


# Detection probability by search method and temperament
DETECTION_PROBABILITY = {
    "physical_search_day": {
        "G": 0.7, "C": 0.5, "A": 0.3, "X": 0.1, "B": 0.4,
        "CUR": 0.5, "CL": 0.3, "CAU": 0.2, "X": 0.05
    },
    "physical_search_night": {
        "G": 0.5, "C": 0.4, "A": 0.4, "X": 0.15, "B": 0.35,
        "CUR": 0.4, "CL": 0.35, "CAU": 0.3, "X": 0.1
    },
    "calling": {
        "G": 0.6, "C": 0.4, "A": 0.2, "X": 0.02, "B": 0.5,
        "CUR": 0.3, "CL": 0.15, "CAU": 0.1, "X": 0.01
    }
}
```

---

## Direction-of-Travel Projection

```python
def update_distribution_with_direction(
    prior_distribution: np.ndarray,
    sighting: SightingReport,
    profile: AnimalProfile,
    projection_time_hours: float,
    grid_metadata: GridMetadata
) -> np.ndarray:
    """
    If sighting includes direction of travel, project forward.
    Creates elongated probability zone in direction of travel.
    """

    if sighting.direction_of_travel is None:
        return prior_distribution

    # Estimate distance traveled since sighting
    speed_estimate = get_speed_estimate(profile, sighting.behavior_observed)
    distance_mean = speed_estimate * projection_time_hours
    distance_std = distance_mean * 0.5  # Uncertainty grows with time

    # Angular uncertainty (30 degrees = π/6 radians)
    angular_std = math.pi / 6

    # Create directional projection kernel
    projection_grid = np.zeros_like(prior_distribution)

    sighting_i, sighting_j = grid_metadata.coords_to_grid(sighting.location)

    for i in range(projection_grid.shape[0]):
        for j in range(projection_grid.shape[1]):
            cell_location = grid_metadata.grid_to_coords(i, j)

            # Vector from sighting to this cell
            dx = cell_location[0] - sighting.location[0]
            dy = cell_location[1] - sighting.location[1]
            dist = math.sqrt(dx*dx + dy*dy)
            angle = math.atan2(dy, dx)

            # Angular difference from reported direction
            angle_diff = abs(angle - sighting.direction_of_travel)
            angle_diff = min(angle_diff, 2*math.pi - angle_diff)

            # Likelihood based on distance and angle
            distance_likelihood = gaussian_1d(dist, mean=distance_mean, std=distance_std)
            angular_likelihood = gaussian_1d(angle_diff, mean=0, std=angular_std)

            projection_grid[i, j] = distance_likelihood * angular_likelihood

    # Normalize projection
    if projection_grid.sum() > 0:
        projection_grid /= projection_grid.sum()

    # Combine with prior
    posterior = prior_distribution * (0.3 + 0.7 * projection_grid)  # Blend
    posterior /= posterior.sum()

    return posterior
```

---

## Multiple Sighting Aggregation

```python
def aggregate_sightings(
    prior_distribution: np.ndarray,
    sightings: List[SightingReport],
    profile: AnimalProfile,
    current_time: datetime,
    grid_metadata: GridMetadata
) -> np.ndarray:
    """
    Process multiple sightings, weighting by recency and confidence.
    """

    posterior = prior_distribution.copy()

    # Sort by timestamp (oldest first)
    sorted_sightings = sorted(sightings, key=lambda s: s.timestamp)

    for sighting in sorted_sightings:
        # Calculate time-based weight (recent sightings matter more)
        hours_ago = (current_time - sighting.timestamp).total_seconds() / 3600
        recency_weight = math.exp(-hours_ago / 24)  # Half-life of 24 hours

        # Update distribution
        updated = update_distribution_with_sighting(
            posterior, sighting, profile, current_time, grid_metadata
        )

        # Blend based on recency weight
        posterior = (1 - recency_weight * 0.5) * posterior + (recency_weight * 0.5) * updated

        # Apply direction projection if available
        if sighting.direction_of_travel is not None:
            posterior = update_distribution_with_direction(
                posterior, sighting, profile, hours_ago, grid_metadata
            )

    return posterior
```

---

# PART 7: ADDITIONAL MODEL ELEMENTS

Regional variation, seasonality, identification, scent articles, and pre-escape state.

---

## Regional Profiles

```yaml
regional_profiles:
  southwest_us:
    states: ["AZ", "NM", "NV", "UT", "CO"]
    modifiers:
      predator_density_multiplier: 2.0  # Coyotes very common
      heat_risk_multiplier: 1.5
      shelter_density_multiplier: 0.7  # More spread out
      water_scarcity_multiplier: 1.5

  southeast_us:
    states: ["FL", "GA", "AL", "MS", "LA", "SC"]
    modifiers:
      predator_density_multiplier: 1.2  # Coyotes, alligators in FL
      heat_risk_multiplier: 1.3
      humidity_modifier: 1.2  # Affects brachycephalic
      water_availability: 1.3

  northeast_us:
    states: ["NY", "MA", "CT", "NJ", "PA", "ME", "NH", "VT", "RI"]
    modifiers:
      predator_density_multiplier: 0.8
      cold_risk_multiplier: 1.5  # Winter
      shelter_density_multiplier: 1.2
      urban_density_multiplier: 1.3

  midwest_us:
    states: ["OH", "MI", "IN", "IL", "WI", "MN", "IA", "MO"]
    modifiers:
      predator_density_multiplier: 1.0
      cold_risk_multiplier: 1.4
      rural_fraction: 1.2

  pacific_northwest:
    states: ["WA", "OR"]
    modifiers:
      predator_density_multiplier: 1.0
      rain_frequency: 0.6  # Affects movement
      wooded_fraction: 1.3
      cold_risk_multiplier: 1.1

  california:
    state: "CA"
    modifiers:
      predator_density_multiplier: 1.5  # Coyotes common
      heat_risk_multiplier: 1.2  # SoCal
      wildfire_season_risk: true
      shelter_density_multiplier: 0.9

  lookup_method: "zip_to_region_mapping"
```

```python
def get_regional_modifiers(zip_code: str) -> RegionalModifiers:
    """Look up regional modifiers by ZIP code."""

    state = zip_to_state(zip_code)
    region = state_to_region(state)

    return REGIONAL_PROFILES.get(region, DEFAULT_MODIFIERS)


def apply_regional_modifiers(
    base_params: SimulationParams,
    region: RegionalModifiers
) -> SimulationParams:
    """Apply regional adjustments to simulation parameters."""

    params = base_params.copy()

    # Mortality adjustments
    params.predator_mortality_rate *= region.predator_density_multiplier

    # Heat adjustments
    params.brachy_heat_threshold_f -= (region.heat_risk_multiplier - 1.0) * 5

    # Shelter adjustments
    params.hiding_spot_density *= region.shelter_density_multiplier

    return params
```

---

## Seasonal Events

```yaml
seasonal_events:
  july_4th:
    date_range: ["07-01", "07-05"]
    region: "all"
    escape_type_modifier:
      P1: 5.0  # 5x increase in noise panic escapes
    mortality_modifier: 1.2
    severity: "critical"
    alert_message: "July 4th period - expect 5x noise panic escapes"

  new_years:
    date_range: ["12-31", "01-01"]
    region: "all"
    escape_type_modifier:
      P1: 3.0
    severity: "high"

  hunting_season:
    regional_date_ranges:
      midwest_us: ["11-15", "12-15"]
      southeast_us: ["11-01", "01-15"]
      northeast_us: ["11-20", "12-10"]
    escape_type_modifier:
      P1: 2.0  # Gunshot panic
    predator_risk_modifier: 0.7  # Hunters reduce coyote activity
    applies_to_terrain: ["rural", "wooded"]

  spring_breeding:
    date_range: ["03-01", "05-31"]
    region: "all"
    escape_type_modifier:
      W4: 3.0  # Mate-seeking males
      W5: 3.0  # In-heat females
      EX3: 3.0  # Cat mate-seeking
    applies_to: "intact_only"

  thunderstorm_season:
    regional_date_ranges:
      southeast_us: ["06-01", "09-30"]
      midwest_us: ["04-01", "08-31"]
      southwest_us: ["07-01", "09-15"]  # Monsoon
    escape_type_modifier:
      P1: 1.5
    daily_probability: 0.3  # 30% chance of storm on any day

  winter_storm:
    regional_date_ranges:
      northeast_us: ["12-01", "03-31"]
      midwest_us: ["11-15", "03-15"]
    mortality_modifier:
      small_animals: 2.0
      senior_animals: 1.8
    shelter_seeking_modifier: 2.0
```

```python
def get_active_seasonal_events(
    date: datetime,
    region: str,
    animal_profile: AnimalProfile
) -> List[SeasonalEvent]:
    """Return all seasonal events active for given date/region/profile."""

    active_events = []

    for event_name, event in SEASONAL_EVENTS.items():
        # Check date range
        if not is_date_in_range(date, event.date_range, event.get("regional_date_ranges", {}).get(region)):
            continue

        # Check region applicability
        if event.region != "all" and region not in event.region:
            continue

        # Check animal-specific conditions
        if event.get("applies_to") == "intact_only":
            if animal_profile.is_neutered:
                continue

        if event.get("applies_to_terrain"):
            # Will be applied only when in matching terrain
            pass

        active_events.append(event)

    return active_events
```

---

## Identification Effects

```yaml
identification:
  microchip:
    prevalence:
      dog: 0.52  # 52% of pet dogs microchipped
      cat: 0.38  # 38% of pet cats
    effect_on_outcomes:
      shelter_to_owner_conversion: 0.85  # 85% of chipped shelter arrivals reunited
      vet_scan_rate: 0.95  # 95% of vets scan
      shelter_scan_rate: 0.98  # 98% of shelters scan
      stranger_vet_visit_rate: 0.15  # 15% of strangers take to vet

  collar_with_id:
    prevalence:
      dog: 0.75
      cat: 0.45
    effect_on_outcomes:
      stranger_return_multiplier: 2.5  # Much more likely to call owner
      secondary_adoption_risk_multiplier: 0.3  # Less likely to be "adopted"
      immediate_contact_probability: 0.7  # 70% will call immediately

  collar_no_id:
    prevalence:
      dog: 0.15
      cat: 0.25
    effect_on_outcomes:
      visual_identification_help: 0.3  # Slightly easier to match sightings
      still_looks_owned: 0.6  # Less likely to be taken as stray

  no_identification:
    effect_on_outcomes:
      shelter_outcome_probability: 1.3  # More likely to stay at shelter
      stranger_keeps_probability: 1.5  # More likely to be kept by finder
      secondary_adoption_probability: 1.8  # Much higher for cats
```

```python
def apply_identification_modifiers(
    base_outcomes: OutcomeProbabilities,
    profile: AnimalProfile
) -> OutcomeProbabilities:
    """Adjust outcome probabilities based on identification status."""

    outcomes = base_outcomes.copy()

    if profile.microchipped:
        # Shelter outcomes more likely to convert to owner reunification
        shelter_conversion = IDENTIFICATION["microchip"]["effect_on_outcomes"]["shelter_to_owner_conversion"]
        outcomes.at_shelter *= (1 - shelter_conversion)
        outcomes.found_by_owner += base_outcomes.at_shelter * shelter_conversion

    if profile.has_collar_with_id:
        # Strangers more likely to return
        outcomes.stranger_return *= IDENTIFICATION["collar_with_id"]["effect_on_outcomes"]["stranger_return_multiplier"]
        # Less likely to be "adopted" by neighbor
        if profile.species == "cat":
            outcomes.adopted_by_neighbor *= IDENTIFICATION["collar_with_id"]["effect_on_outcomes"]["secondary_adoption_risk_multiplier"]

    elif not profile.has_collar:
        # No collar - higher risk of being kept
        outcomes.stranger_return *= 0.5
        if profile.species == "cat":
            outcomes.adopted_by_neighbor *= IDENTIFICATION["no_identification"]["effect_on_outcomes"]["secondary_adoption_probability"]

    # Renormalize
    outcomes.normalize()

    return outcomes
```

---

## Scent Article Mechanics

```yaml
scent_articles:
  effect_radius_m: 50  # Attracts within this radius (downwind)
  peak_effectiveness_hours: 48  # Fresh article most effective
  decay_rate_per_day: 0.15  # Effectiveness decreases 15%/day [A]

  # Wind affects scent dispersal direction and range
  wind_effects:
    calm:  # < 5 mph
      radius_multiplier: 1.0
      direction: "omnidirectional"
    light:  # 5-15 mph
      radius_multiplier: 1.5  # Carries further downwind
      downwind_cone_degrees: 90
      upwind_radius_multiplier: 0.3  # Minimal upwind detection
    moderate:  # 15-25 mph
      radius_multiplier: 2.0
      downwind_cone_degrees: 60
      upwind_radius_multiplier: 0.1
    strong:  # > 25 mph
      radius_multiplier: 0.5  # Scent disperses too quickly
      direction: "not_recommended"

  # Species-specific effectiveness by temperament
  # Codes are species-prefixed to avoid collision
  effectiveness_by_temperament:
    dog:
      G: 0.4    # Gregarious - moderate attraction [A]
      C: 0.3    # Confident - mild attraction [A]
      A: 0.3    # Aloof - mild attraction [A]
      X: 0.2    # Xenophobic - limited (fear may override) [A]
      B: 0.8    # Bonded - strong attraction [P]
    cat:
      CUR: 0.3  # Curious - moderate [A]
      CL: 0.25  # Care-less - mild [A]
      CAU: 0.5  # Cautious - moderate (familiar scent reassuring) [A]
      X: 0.15   # Xenophobic - limited [A]
      B: 0.7    # Bonded - strong [P]

  placement_recommendations:
    primary: "escape_point"
    secondary:
      - "known_territory_edges"
      - "feeding_station_locations"
      - "recent_sighting_locations"
    refresh_frequency_hours: 48
    protection_required: true  # Prevent rain/animal damage
    wind_consideration: "place_upwind_of_expected_location"  # Scent carries downwind

  types:
    worn_clothing:
      effectiveness: 1.0
      duration_multiplier: 1.0
    bedding:
      effectiveness: 0.9
      duration_multiplier: 1.2  # Lasts longer
    litter_box:
      effectiveness: 1.2  # For cats, very effective
      duration_multiplier: 0.8
      applies_to: "cat"
```

```python
def calculate_scent_article_attraction(
    animal_position: Tuple[float, float],
    scent_articles: List[ScentArticle],
    profile: AnimalProfile,
    current_hours: float,
    wind_direction: float,  # Degrees, direction wind is blowing FROM
    wind_speed_mph: float
) -> Optional[Tuple[float, float]]:
    """
    Calculate attraction vector toward scent articles.
    Returns direction and strength, or None if no attraction.
    Wind affects detection radius and direction.
    """

    # Get species-specific effectiveness
    if profile.species == "dog":
        base_effectiveness = SCENT_ARTICLES["effectiveness_by_temperament"]["dog"].get(
            profile.temperament, 0.3)
    else:  # cat
        base_effectiveness = SCENT_ARTICLES["effectiveness_by_temperament"]["cat"].get(
            profile.temperament, 0.3)

    # Get wind effects
    wind_config = get_wind_config(wind_speed_mph)

    max_attraction = 0.0
    attraction_direction = None

    for article in scent_articles:
        # Check if animal is in detection range, considering wind
        dist = distance(animal_position, article.location)
        direction_from_article = direction_to(article.location, animal_position)

        # Calculate effective radius based on wind direction
        if wind_config["direction"] == "omnidirectional":
            effective_radius = SCENT_ARTICLES["effect_radius_m"]
        else:
            angle_from_downwind = abs(normalize_angle(direction_from_article - wind_direction))
            if angle_from_downwind < wind_config.get("downwind_cone_degrees", 90) / 2:
                effective_radius = SCENT_ARTICLES["effect_radius_m"] * wind_config["radius_multiplier"]
            else:
                effective_radius = SCENT_ARTICLES["effect_radius_m"] * wind_config.get("upwind_radius_multiplier", 0.3)

        if dist > effective_radius:
            continue  # Too far or wrong wind direction

        # Calculate current effectiveness
        hours_since_placed = current_hours - article.placed_at_hours
        days_since_placed = hours_since_placed / 24
        decay = (1 - SCENT_ARTICLES["decay_rate_per_day"]) ** days_since_placed

        effectiveness = base_effectiveness * decay * article.type_multiplier

        # Distance falloff within radius
        distance_factor = 1.0 - (dist / effective_radius)

        attraction_strength = effectiveness * distance_factor

        if attraction_strength > max_attraction:
            max_attraction = attraction_strength
            attraction_direction = direction_to(animal_position, article.location)

    if max_attraction > 0.1:  # Threshold for noticeable effect
        return (attraction_direction, max_attraction)

    return None


def get_wind_config(wind_speed_mph: float) -> dict:
    """Get wind configuration based on speed."""
    if wind_speed_mph < 5:
        return SCENT_ARTICLES["wind_effects"]["calm"]
    elif wind_speed_mph < 15:
        return SCENT_ARTICLES["wind_effects"]["light"]
    elif wind_speed_mph < 25:
        return SCENT_ARTICLES["wind_effects"]["moderate"]
    else:
        return SCENT_ARTICLES["wind_effects"]["strong"]


def apply_scent_article_to_movement(
    base_direction: float,
    base_distance: float,
    scent_attraction: Optional[Tuple[float, float]],
    profile: AnimalProfile
) -> Tuple[float, float]:
    """Modify movement based on scent article attraction."""

    if scent_attraction is None:
        return (base_direction, base_distance)

    scent_direction, strength = scent_attraction

    # Blend directions based on attraction strength
    # Bonded animals respond more strongly
    if profile.temperament == "B":
        strength *= 1.5

    # Maximum 50% direction influence
    effective_strength = min(strength, 0.5)

    # Vector blending
    base_vector = (math.cos(base_direction), math.sin(base_direction))
    scent_vector = (math.cos(scent_direction), math.sin(scent_direction))

    blended_vector = (
        (1 - effective_strength) * base_vector[0] + effective_strength * scent_vector[0],
        (1 - effective_strength) * base_vector[1] + effective_strength * scent_vector[1]
    )

    new_direction = math.atan2(blended_vector[1], blended_vector[0])

    return (new_direction, base_distance)
```

---

## Pre-Escape State Initialization

```yaml
pre_escape_state:
  hours_since_fed:
    distribution: "uniform"
    range: [0, 12]  # Most pets fed 1-2x daily

  hours_since_water:
    distribution: "uniform"
    range: [0, 6]  # Usually have constant water access

  initial_stamina:
    distribution: "beta"
    params:
      alpha: 8
      beta: 2  # Most pets are rested at escape time
    # Mean ~0.8, skewed toward high stamina

  initial_fear:
    by_escape_type:
      P1: 1.0  # Panic - maximum fear
      P2: 1.0
      P3: 1.0
      D1: 0.3  # Chase - excitement more than fear
      D2: 0.2
      W1: 0.1  # Walkout - minimal fear
      W2: 0.1
      W3: 0.05  # Habitual - not scared
      W4: 0.2
      W5: 0.3
      S1: 0.8  # Displacement - confusion/fear
      S2: 0.9
      S3: 0.6
      ST1: 0.7  # Cat startle
      ST2: 0.9
      ST3: 1.0
      ST4: 1.0
      EX1: 0.2
      EX2: 0.3
      EX3: 0.2
      DI1: 0.8
      DI2: 0.9
      DI3: 0.95
      DI4: 0.6
```

```python
# Python constant version of the YAML above
PRE_ESCAPE_STATE = {
    "hours_since_fed": {"distribution": "uniform", "range": (0, 12)},
    "hours_since_water": {"distribution": "uniform", "range": (0, 6)},
    "initial_stamina": {"distribution": "beta", "params": {"alpha": 8, "beta": 2}},
    "initial_fear": {
        "by_escape_type": {
            # Dogs
            "P1": 1.0, "P2": 1.0, "P3": 1.0,  # Panic - maximum fear
            "D1": 0.3, "D2": 0.2,              # Chase - excitement more than fear
            "W1": 0.1, "W2": 0.1, "W3": 0.05, "W4": 0.2, "W5": 0.3,  # Walkout
            "S1": 0.8, "S2": 0.9, "S3": 0.6,   # Displacement
            # Cats
            "ST1": 0.7, "ST2": 0.8, "ST3": 0.95, "ST4": 1.0,  # Startle
            "EX1": 0.1, "EX2": 0.3, "EX3": 0.2,  # Exploratory
            "DI1": 0.8, "DI2": 0.9, "DI3": 0.95, "DI4": 0.6   # Displacement
        }
    }
}


def initialize_pre_escape_state(profile: AnimalProfile) -> AnimalState:
    """Initialize animal state at moment of escape."""

    # Hours since fed
    hours_since_fed = random.uniform(0, 12)
    initial_hunger = hours_since_fed / 72  # Start hunger accumulation

    # Hours since water
    hours_since_water = random.uniform(0, 6)
    initial_thirst = hours_since_water / 48

    # Stamina (usually well-rested)
    initial_stamina = random.betavariate(8, 2)

    # Fear based on escape type
    initial_fear = PRE_ESCAPE_STATE["initial_fear"]["by_escape_type"].get(
        profile.escape_type, 0.5
    )

    # Initial position
    if profile.territory == "HOME":
        initial_position = profile.home_location
    elif profile.territory == "NEAR":
        # Offset from home
        offset = random.gauss(0, 200)  # ~200m standard deviation
        initial_position = offset_position(profile.home_location, offset)
    elif profile.territory == "FAR":
        # Use provided escape location
        initial_position = profile.escape_location
    else:  # LOST
        initial_position = profile.escape_location

    return AnimalState(
        position=initial_position,
        status="fleeing" if initial_fear > 0.5 else "traveling",
        fear_level=initial_fear,
        hunger_level=initial_hunger,
        thirst_level=initial_thirst,
        stamina=initial_stamina,
        health=profile.health_status,
        injury_severity=0.0 if profile.health_status != "INJ" else random.uniform(0.2, 0.8),
        hours_since_escape=0.0,
        hours_since_last_water=hours_since_water,
        hours_since_last_food=hours_since_fed,
        current_hiding_spot=None,
        visited_locations=[initial_position],
        threshold_reached=False,
        hiding_phase="DEEP" if profile.species == "cat" else None,
        last_scent_point=None
    )
```

---

# PART 8: VALIDATION FRAMEWORK

Dataset requirements, data sources, and validation metrics.

---

## Validation Dataset Requirements

```yaml
validation_dataset:
  minimum_cases:
    dogs: 500
    cats: 500

  required_fields_per_case:
    # Profile inputs
    - species
    - size_class  # T/S/M/L/XL
    - age_class  # PUP/YNG/ADT/SEN or KIT/JUV/YNG/ADT/SEN
    - breed_or_type
    - temperament_assessment  # May need to infer from owner description
    - indoor_outdoor_history  # Cats only
    - background  # F/R/ST/W or F/R/FO/BR/MH
    - escape_type
    - escape_location_coords
    - escape_datetime
    - health_status_at_escape
    - territory_familiarity

    # Environmental context
    - terrain_type_at_escape
    - weather_conditions
    - temperature_f

    # Outcome data
    - outcome_type  # self_return, found_by_owner, stranger, shelter, adopted, deceased, not_found
    - outcome_datetime  # If found
    - outcome_location_coords  # If found
    - search_intensity  # O0-O4, may need to assess from description

  nice_to_have:
    - sighting_reports[]  # For Bayesian update validation
    - search_methods_used[]
    - microchip_status
    - collar_status
    - photos  # For size/breed verification
    - distance_from_escape_to_find

  data_quality_requirements:
    - "GPS coordinates required for escape and find locations"
    - "Outcome type must be verified, not self-reported"
    - "Escape type should be categorized by trained reviewer"
    - "Temperament assessment ideally from pre-loss survey"
```

---

## Data Source Strategy

```yaml
data_sources:
  tier_1_priority:
    missing_animal_response_network:
      data_type: "Case files with detailed outcomes"
      contact: "Kat Albrecht, Missing Pet Partnership"
      expected_quality: "High - standardized assessments"
      estimated_cases: "10,000+"
      partnership_approach: "Research collaboration proposal"

    petco_love_lost:
      data_type: "Large-scale outcome data"
      contact: "API access or research partnership"
      expected_quality: "Medium - user-reported"
      estimated_cases: "100,000+"
      partnership_approach: "Data sharing agreement"

  tier_2_secondary:
    local_shelters:
      regions: "10+ metro areas for geographic diversity"
      data_type: "Intake records with found location, stray hold outcomes"
      irb_required: true
      estimated_cases_per_shelter: "500-2000/year"

    pet_detective_practitioners:
      data_type: "Detailed case files with search methods, sightings"
      expected_quality: "Very high"
      estimated_cases: "50-200 per practitioner"
      partnership_approach: "Pay for anonymized data or co-research"

  tier_3_supplementary:
    pawboost:
      data_type: "Crowdsourced lost/found reports"
      limitations: "TOS may prohibit scraping"
      partnership_approach: "Explore API or partnership"

    nextdoor:
      data_type: "Local lost pet posts"
      limitations: "TOS restrictions, privacy concerns"

    your_own_platform:
      data_type: "Cases as they come in"
      approach: "Build data collection into product from day 1"
      fields_to_collect: "All validation fields above"
```

---

## Validation Metrics

```python
VALIDATION_METRICS = {
    # === DISTANCE PREDICTION ===
    "median_distance_error_m": {
        "description": "Median absolute error between predicted and actual find distance",
        "calculation": "median(|predicted_distance - actual_distance|)",
        "acceptable_threshold": {
            "cats": 50,   # Within 50m
            "dogs": 200   # Within 200m
        },
        "stratify_by": ["species", "temperament", "indoor_outdoor"]
    },

    "distance_percentile_accuracy": {
        "description": "How often does actual find location fall within predicted probability contour?",
        "calculation": "% of cases where actual location is within 75th percentile contour",
        "acceptable_threshold": 0.75  # 75% of cases
    },

    # === OUTCOME PREDICTION ===
    "outcome_category_accuracy": {
        "description": "% of cases where highest-probability outcome matched actual",
        "calculation": "sum(predicted_top_outcome == actual_outcome) / n_cases",
        "acceptable_threshold": 0.40,  # 6-7 categories, so >40% is meaningful
        "notes": "Random baseline would be ~15%"
    },

    "outcome_top3_accuracy": {
        "description": "% of cases where actual outcome was in top 3 predicted",
        "calculation": "sum(actual_outcome in predicted_top_3) / n_cases",
        "acceptable_threshold": 0.70
    },

    # === PROBABILITY CALIBRATION ===
    "brier_score": {
        "description": "Calibration of probability estimates",
        "calculation": "mean((predicted_prob - actual_outcome)^2)",
        "acceptable_threshold": 0.25,  # Lower is better
        "interpretation": "0.0 = perfect, 0.25 = no skill"
    },

    "calibration_curve": {
        "description": "Plot predicted probability vs observed frequency",
        "bins": 10,
        "acceptable": "Points should lie near diagonal"
    },

    # === TIME PREDICTION ===
    "recovery_time_correlation": {
        "description": "Correlation between predicted and actual hours to recovery",
        "calculation": "pearson_r(predicted_hours, actual_hours)",
        "acceptable_threshold": 0.30,
        "stratify_by": ["species", "outcome_type"]
    },

    "recovery_time_mae_hours": {
        "description": "Mean absolute error in recovery time prediction",
        "calculation": "mean(|predicted_hours - actual_hours|)",
        "acceptable_threshold": {
            "self_return": 24,
            "found_by_owner": 48,
            "other": 72
        }
    },

    # === PROFILE-STRATIFIED ===
    "accuracy_by_temperament": {
        "description": "Outcome accuracy broken down by temperament category",
        "purpose": "Identify which profiles need parameter tuning",
        "flag_threshold": 0.25  # Flag if accuracy < 25% for any temperament
    },

    "accuracy_by_escape_type": {
        "description": "Outcome accuracy by escape type",
        "purpose": "Identify escape types with poor predictions"
    }
}

# Outcome type constants (shared between dogs and cats)
OUTCOME_TYPES = [
    "self_return",        # Animal returns home on its own
    "found_by_owner",     # Owner physically locates animal
    "stranger_return",    # Good Samaritan picks up and returns
    "at_shelter",         # Animal ends up at shelter/rescue
    "adopted_by_neighbor", # (Cats primarily) Taken in by neighbor
    "still_missing",      # Not recovered within time window
    "deceased"            # Animal dies during displacement
]


def calculate_validation_metrics(
    predictions: List[Prediction],
    actuals: List[ActualOutcome]
) -> ValidationReport:
    """Calculate all validation metrics on a test set."""

    report = ValidationReport()

    # Distance metrics
    distance_errors = []
    for pred, actual in zip(predictions, actuals):
        if actual.outcome_location:
            error = haversine_meters(pred.most_likely_location, actual.outcome_location)
            distance_errors.append(error)

    report.median_distance_error_m = np.median(distance_errors)

    # Outcome accuracy
    correct_outcomes = sum(
        1 for pred, actual in zip(predictions, actuals)
        if pred.top_outcome == actual.outcome_type
    )
    report.outcome_accuracy = correct_outcomes / len(predictions)

    # Brier score
    brier_scores = []
    for pred, actual in zip(predictions, actuals):
        for outcome_type in OUTCOME_TYPES:
            predicted_prob = pred.outcome_probabilities.get(outcome_type, 0)
            actual_binary = 1.0 if actual.outcome_type == outcome_type else 0.0
            brier_scores.append((predicted_prob - actual_binary) ** 2)

    report.brier_score = np.mean(brier_scores)

    # Time correlation (for recovered cases)
    pred_times = []
    actual_times = []
    for pred, actual in zip(predictions, actuals):
        if actual.outcome_type not in ["not_found", "deceased"]:
            pred_times.append(pred.expected_recovery_hours)
            actual_times.append(actual.hours_to_recovery)

    if len(pred_times) > 10:
        report.recovery_time_correlation = np.corrcoef(pred_times, actual_times)[0, 1]

    return report
```

---

## Baseline Comparison

To determine whether the behavioral profile model provides value, all metrics must be compared against naive baselines. A model that doesn't beat baselines meaningfully has no practical utility.

### Baseline Definitions

| Metric | Naive Baseline | Calculation | Expected Value |
|--------|---------------|-------------|----------------|
| **Distance prediction** | Uniform circle | Predict center of search area | Variable by area size |
| **Distance prediction** | Population mean | Always predict species mean distance | Cats: 125m, Dogs: 800m |
| **Outcome accuracy** | Random guess | 1 / (number of categories) | 14.3% (7 categories) |
| **Outcome accuracy** | Majority class | Always predict most common outcome | ~35% (species-dependent) |
| **Brier score** | Uniform probabilities | Assign equal prob to all outcomes | 0.286 (7 outcomes) |
| **Brier score** | Prior probabilities | Use overall population frequencies | ~0.22 (species-dependent) |
| **Time prediction** | Median return | Always predict population median | Cats: 5 days, Dogs: 3 days |
| **Location contour** | Concentric circles | Distance-only, no profile | ~50-60% |

### Minimum Performance Thresholds

The model should beat baselines by meaningful margins to justify complexity:

```python
BASELINE_COMPARISON = {
    "outcome_category_accuracy": {
        "random_baseline": 0.143,      # 1/7 categories
        "majority_class_baseline": 0.35,  # Most common outcome
        "minimum_lift_over_random": 2.0,   # Must be 2x random
        "minimum_lift_over_majority": 1.15,  # Must be 15% better than always guessing "self_return"
        "target": 0.45  # Achievable with good model
    },

    "brier_score": {
        "uniform_baseline": 0.286,     # Equal prob to all 7 outcomes
        "prior_baseline": 0.22,        # Population-level frequencies
        "maximum_acceptable": 0.20,    # Must beat prior baseline
        "target": 0.15                 # Calibrated predictions
    },

    "distance_percentile_accuracy": {
        "concentric_circle_baseline": 0.55,  # Distance-only model
        "minimum_acceptable": 0.65,          # Must beat by 10 points
        "target": 0.80                       # Well-calibrated spatial model
    },

    "median_distance_error_m": {
        "population_mean_baseline": {
            "cats": 200,   # Always predicting 125m median
            "dogs": 600    # Always predicting 800m median
        },
        "improvement_required": 0.30,  # Must reduce error by 30%
        "target": {
            "cats": 40,    # 80% improvement
            "dogs": 150    # 75% improvement
        }
    }
}


def calculate_baseline_metrics(actuals: List[ActualOutcome]) -> BaselineReport:
    """Calculate all baseline metrics for comparison."""

    report = BaselineReport()

    # Outcome baselines
    n_cases = len(actuals)
    n_categories = len(OUTCOME_TYPES)

    # Random guess baseline
    report.random_guess_accuracy = 1.0 / n_categories

    # Majority class baseline
    outcome_counts = Counter(a.outcome_type for a in actuals)
    most_common = outcome_counts.most_common(1)[0][1]
    report.majority_class_accuracy = most_common / n_cases

    # Prior probabilities (for Brier baseline)
    prior_probs = {ot: count/n_cases for ot, count in outcome_counts.items()}

    # Brier score with uniform probabilities
    uniform_prob = 1.0 / n_categories
    uniform_brier = 0.0
    for actual in actuals:
        for ot in OUTCOME_TYPES:
            actual_binary = 1.0 if actual.outcome_type == ot else 0.0
            uniform_brier += (uniform_prob - actual_binary) ** 2
    report.uniform_brier = uniform_brier / (n_cases * n_categories)

    # Brier score with prior probabilities
    prior_brier = 0.0
    for actual in actuals:
        for ot in OUTCOME_TYPES:
            actual_binary = 1.0 if actual.outcome_type == ot else 0.0
            prior_prob = prior_probs.get(ot, 0)
            prior_brier += (prior_prob - actual_binary) ** 2
    report.prior_brier = prior_brier / (n_cases * n_categories)

    # Distance baselines
    cat_distances = [a.distance_m for a in actuals if a.species == "cat"]
    dog_distances = [a.distance_m for a in actuals if a.species == "dog"]

    if cat_distances:
        mean_cat = np.mean(cat_distances)
        report.cat_mean_distance_error = np.median([abs(d - mean_cat) for d in cat_distances])

    if dog_distances:
        mean_dog = np.mean(dog_distances)
        report.dog_mean_distance_error = np.median([abs(d - mean_dog) for d in dog_distances])

    return report


def compare_to_baselines(model_metrics: ValidationReport, baselines: BaselineReport) -> ComparisonReport:
    """Compare model performance to baselines and flag issues."""

    comparison = ComparisonReport()

    # Outcome accuracy lift
    comparison.accuracy_vs_random = model_metrics.outcome_accuracy / baselines.random_guess_accuracy
    comparison.accuracy_vs_majority = model_metrics.outcome_accuracy / baselines.majority_class_accuracy

    comparison.passes_accuracy_threshold = (
        comparison.accuracy_vs_random >= BASELINE_COMPARISON["outcome_category_accuracy"]["minimum_lift_over_random"]
        and comparison.accuracy_vs_majority >= BASELINE_COMPARISON["outcome_category_accuracy"]["minimum_lift_over_majority"]
    )

    # Brier score improvement
    comparison.brier_vs_prior = model_metrics.brier_score / baselines.prior_brier
    comparison.passes_brier_threshold = (
        model_metrics.brier_score < BASELINE_COMPARISON["brier_score"]["maximum_acceptable"]
    )

    # Summary
    comparison.overall_pass = (
        comparison.passes_accuracy_threshold
        and comparison.passes_brier_threshold
    )

    if not comparison.overall_pass:
        comparison.failure_reasons = []
        if not comparison.passes_accuracy_threshold:
            comparison.failure_reasons.append(
                f"Accuracy lift too low: {comparison.accuracy_vs_random:.2f}x vs random, "
                f"{comparison.accuracy_vs_majority:.2f}x vs majority"
            )
        if not comparison.passes_brier_threshold:
            comparison.failure_reasons.append(
                f"Brier score too high: {model_metrics.brier_score:.3f} vs {baselines.prior_brier:.3f} prior"
            )

    return comparison
```

### Interpreting Baseline Comparisons

| Comparison Result | Interpretation | Action |
|-------------------|----------------|--------|
| Model >> Baseline | Model provides significant value | Ship it |
| Model > Baseline (marginal) | Model helps but not decisively | Consider simplifying or more data |
| Model ≈ Baseline | No meaningful improvement | Model needs fundamental rethinking |
| Model < Baseline | Model is worse than guessing | Do not deploy; investigate bugs |

**Important**: Some profile types may perform better than baselines while others perform worse. Always stratify comparisons by temperament, species, and escape type to identify where the model adds value vs. where it fails.

---

## Validation Study Design

```yaml
validation_study:
  phase_1_retrospective:
    description: "Validate against historical case data"
    data_source: "Partnered case files"
    n_cases: 1000
    split:
      training: 0.7
      validation: 0.15
      test: 0.15
    outcome: "Baseline accuracy metrics"

  phase_2_prospective:
    description: "Real-time validation on new cases"
    duration_months: 6
    n_cases_target: 500
    protocol:
      - "Generate prediction at time of report"
      - "Blind prediction to searchers"
      - "Record actual outcome"
      - "Compare prediction vs actual"
    outcome: "Production accuracy metrics"

  phase_3_ab_test:
    description: "Does using predictions improve recovery rates?"
    design: "Randomized controlled trial"
    treatment: "Searchers receive simulation predictions"
    control: "Searchers use standard methods only"
    primary_outcome: "Recovery rate at 7 days"
    secondary_outcomes:
      - "Time to recovery"
      - "Search efficiency (hours to find)"
    ethical_considerations:
      - "Both groups receive standard search guidance"
      - "Treatment group gets additional predictions"
      - "No withholding of beneficial information"

  continuous_monitoring:
    description: "Ongoing production monitoring"
    metrics:
      - "Weekly accuracy dashboard"
      - "Drift detection (are predictions getting worse?)"
      - "Profile-specific accuracy alerts"
    recalibration_trigger: "If Brier score > 0.30 for 2 consecutive weeks"
```

---

## References & Research

### Research-Backed Statistics
|-----------|-------|--------|
| Indoor cat median distance | 50m | U of Queensland 2017 |
| Outdoor cat median distance | 315m | U of Queensland 2017 |
| Indoor cats within 3-house radius | 93% | Missing Pet Partnership |
| 75% of cats found within | 500m | U of Queensland 2017 |
| Cat recovery rate (1 year) | 61% | U of Queensland 2017 |
| Dogs found <1 mile | 79% | Lord et al. 2007 |

### Framework Sources

- Temperament categories: Kat Albrecht, Missing Animal Response
- TAR Protocol: Missing Pet Partnership
- Threshold phenomenon: Albrecht behavioral research

### Assumptions Requiring Validation

- Specific probability percentages for each layer
- Movement speed multipliers
- Transition timing between behavioral phases
- Fear decay rates
- Mortality rates by terrain

---

# CHANGELOG

## v2.3 (Current)

Structural fixes and missing mechanics based on dev team review.

- **Fixed** Cross-species temperament code collision
  - Restructured scent article effectiveness table to use species-prefixed format
  - Dog codes (G, C, A, X, B) and cat codes (CUR, CL, CAU, X, B) now unambiguous in context
- **Fixed** Undefined pseudocode references
  - Added OUTCOME_TYPES constant definition (7 outcome categories)
  - Added PRE_ESCAPE_STATE Python constant for animal initialization
  - Added FEAR_DECAY_RATES and CAT_FEAR_DECAY_RATES constants with λ values
  - Added rough estimate acknowledgments for fear decay half-lives
- **Added** Why Composite CIs Can Be Tighter Than Component Uncertainties section
  - Explains averaging effect, constrained space, multiplicative attenuation
  - Notes that CIs are lower bounds on true uncertainty (validation may reveal wider)
  - Includes worked example of CI propagation
- **Added** Wind direction effects to scent article mechanics
  - Wind speed categories (calm, light, moderate, strong)
  - Radius multipliers and downwind cone angles
  - Wind-aware scent detection calculation
- **Added** Prior Grid Initialization function
  - `initialize_prior_from_profile()` creates Bayesian prior from behavioral profile
  - `get_cat_median_distance()` and `get_dog_median_distance()` helper functions
  - `get_terrain_accessibility()` for terrain-weighted priors
  - Uses Rayleigh distribution for realistic 2D dispersion
- **Added** Multi-terrain tick handling at boundaries
  - `simulate_movement_tick()` function handles terrain transitions within ticks
  - Time-proportional risk calculation for each terrain segment
  - Behavioral adaptation at terrain boundaries
  - DOG_TRAFFIC_RISK_PER_MIN and CAT_PREDATOR_RISK_PER_MIN constants
- **Added** Baseline Comparison section for validation metrics
  - Naive baseline definitions table (random guess, majority class, population mean)
  - BASELINE_COMPARISON constant with minimum performance thresholds
  - `calculate_baseline_metrics()` and `compare_to_baselines()` functions
  - Interpretation guide for baseline comparison results
- **Added** Missing movement helper functions
  - `deflect_along_obstacle()` for path deflection around obstacles
  - `clamp_to_bounds()` for simulation boundary enforcement
- **Added** Stamina System Clarification section
  - Tick vs cumulative application explained
  - Update sequence per tick documented
  - Edge cases (stamina=0, stamina=1, status changes) addressed
- **Added** Simulation Convergence and Termination section
  - `should_terminate_simulation()` function with all termination conditions
  - Edge case handling table (max_hours, bounds exit, stamina 0, thirst 1.0, stuck)
  - `calculate_simulation_bounds()` for dynamic bound calculation
  - `determine_final_outcome()` for outcome assignment at termination

## v2.2

- **Added** Parameter provenance tags throughout document
  - [R] Research-backed parameters with citations (UQ 2017, AVMA, AKC, MPP)
  - [P] Practitioner experience (Albrecht framework, veterinary knowledge)
  - [A] Author assumptions requiring validation
  - [C] Calculated/derived values
- Tagged all major parameter tables: Weather, Time-of-Day, Owner Search, Health, Territory,
  Size, Age, Breed Instinct, Brachycephalic, Background, Temperament, Escape Types,
  Movement Parameters, Cat Indoor/Outdoor, Cat Threshold times
- Added provenance key to document header
- **Added** Uncertainty Quantification section (Part 4.5)
  - Distribution selection by provenance ([R]→±10%, [P]→±25%, [A]→±50%)
  - Beta distributions for bounded probabilities
  - Log-Normal distributions for multipliers
  - Gamma distributions for time parameters
  - Monte Carlo uncertainty propagation method
  - Example parameter distributions
  - Simulation implementation guidance
  - Reporting results with confidence intervals
- **Enhanced** Terrain Classification section
  - Research-based thresholds from EPA Smart Location Database, TIGER/Line, Census, NLCD
  - Specific OSM tag combinations for Urban/Suburban/Rural/Wooded classification
  - Overpass API query examples for each terrain type
  - Predator risk table by region type
  - Regional adjustments (Southwest, Pacific NW, Florida, Mountain West)
- **Added** 95% confidence intervals to all profile frequency tables
  - Dog Profile Frequency Table (all 50 profiles)
  - Cat Profile Frequency Table (all 30 profiles)
  - Monte Carlo propagation methodology documented

## v2.1

- **Added** Part 5: Simulation Mechanics
  - Complete state structures for dog and cat simulations
  - 5-minute tick main simulation loop
  - Physiology updates (fatigue, thirst, hunger)
  - Species-specific movement algorithms with full pseudocode
  - Decision-making functions for dogs (FDM/DIR/gravity) and cats (threshold/triangular patrol)
  - Modifier application with diminishing returns
  - Parameter caps, floors, and bounds for all numerical values
- **Added** Part 6: Sighting Integration (Bayesian Updates)
  - Prior initialization from behavioral profiles
  - Likelihood calculation for sightings
  - Posterior update algorithm
  - Support for negative sightings (area searched, no pet found)
  - Multi-sighting integration
- **Added** Part 7: Additional Model Elements
  - Regional profiles for terrain type distribution
  - Seasonal event modifiers (fireworks, holidays, hunting season)
  - Identification status effects on outcomes (microchip, collar, tag combinations)
  - Scent article mechanics for dog search support
- **Added** Part 8: Validation Framework
  - Dataset requirements and sample size calculations
  - Data source strategy (shelters, GPS studies, MPP database)
  - Validation metrics (Brier score, calibration, distance error)
  - Testing protocol for initial validation and continuous monitoring

## v2.0

- **Merged** dog (v1.2) and cat (v1.1) documents into unified system
- **Consolidated** shared framework components into Part 1:
  - Probability normalization method
  - Terrain detection with species-specific subsections
  - Weather modifiers
  - Time-of-day activity patterns
  - Owner search intensity (O0-O4)
  - Health status framework
  - Territory familiarity framework
  - Outcome categories
- **Standardized** section structure across species
- **Added** Part 4: Simulation Parameters Reference for easy tuning
- **Preserved** all species-specific behaviors in separate parts:
  - Dog: Continuous fear decay, gravity spiral movement, breed instincts
  - Cat: Threshold phenomenon, triangular patrol, indoor/outdoor primary axis

---

## Pre-Merge History

### Dog Document

#### v1.2
- Added probability normalization method (multiplicative + renormalize)
- Added W5 escape type detailed behavior (in-heat females)
- Added Bonded temperament "gravity" mechanic
- Added escape-type-specific fear decay rates (P3 trauma = 58hr half-life)
- Added brachycephalic modifier application order
- Added brachycephalic heat emergency handling
- Added terrain detection implementation requirements
- Updated deceased rates for xenophobic dogs by terrain

#### v1.1
- Added 9 layers with probability distributions
- Added 50 ranked profile combinations
- Added time-dependent behavior dynamics
- Added owner search intensity layer

#### v1.0
- Initial document with 8 layers
- Basic movement parameters
- Outcome probability matrix

### Cat Document

#### v1.1
- Added brachycephalic modifier (Persian, Himalayan, Exotic Shorthair)
- Added Bonded cat movement algorithm (triangular patrol pattern)
- Added terrain detection requirements with cat-specific hiding spot density
- Added secondary adoption mechanism for outdoor cats
- Clarified fear decay timing relative to threshold (no decay pre-threshold)
- Made probability normalization section self-contained

#### v1.0
- Initial document with 9 layers adapted for cat-specific behavior
- Threshold phenomenon model (distinct from dog fear decay)
- Indoor/Outdoor access as primary behavioral determinant
- TAR (Trap-and-Reunite) protocol integration
- Research-backed distance and recovery statistics
- 30 ranked profile combinations

---

*Document Version: 2.0*
*Last Updated: January 2026*
*Created for: Lost Pet Monte Carlo Simulation*
*Species: Dogs (Canis familiaris) and Cats (Felis catus)*
