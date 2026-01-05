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
        RETURN "Suburban"    # Optimal for cat hiding [P] Huang et al. 2018 finding
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
| HOME | Hide nearby, may return | 0-39m | Hours to days | [R] Huang et al. 2018 |
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

**Model Limitations - Fear Decay** [A]:

The simple exponential decay model is mathematically validated (Krypotos et al. 2021,
*Biological Psychiatry*) and the ~23-hour P1 half-life aligns with Riemer's 2019 finding
that ~75% of dogs recovered from acute noise panic by the next morning. However, the
P3 half-life (58 hours) may be **too short for severe trauma**—military working dog PTSD
literature indicates recovery taking "weeks or months, not days."

For severe trauma (P3), consider a **multi-component model**: fast initial decay for
acute fear plus slow residual component for traumatic memory. The current model also
does not capture:
- **Spontaneous recovery**: Extinguished fears can return with time passage
- **Reinstatement**: Re-exposure to trauma triggers restores fear
- **Context dependence**: Extinction is location-specific
- **Individual heterogeneity**: Some dogs sensitize rather than habituate

These limitations are marked for future model refinement pending GPS tracking validation.

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

**Physiological Clarification** [A]:
The 10-12 day threshold assumes cats are finding **opportunistic water** (puddles,
irrigation, condensation, pet bowls) while remaining hidden and undetected. Veterinary
consensus establishes cats can only survive 3-4 days without water, with serious
dehydration at 24-48 hours. The threshold refers to **time until detection/emergence**,
not continuous fasting without hydration. This is why injured cats show 2-4 day
thresholds—reduced mobility limits opportunistic water access. Note: Missing Animal
Response Network acknowledges this phenomenon has not yet been validated in controlled
scientific study.

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

**Distance & Behavior by Access Type** [R] Huang et al. 2018 (*Animals* journal, n=1,210)

| Access | Median Distance Found | Max 75th Percentile | Primary Behavior | Homing Ability | Provenance |
|--------|----------------------|---------------------|------------------|----------------|------------|
| IO | **39 meters** (~2 houses) | 137 meters | Freeze & hide | None | [R] Huang et al. 2018 |
| IS | 65 meters | 200 meters | Freeze & hide | Very Low | [A] Interpolated |
| IO-A | 125 meters | 400 meters | Hide then explore | Low | [A] Interpolated |
| OA | **300 meters** (~16 houses) | 1609 meters | Cautious exploration | Medium | [R] Huang et al. 2018 |
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
| 30 | 50% | Traps become critical |
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
| Indoor-only cat | N/A | 39m median |
| Outdoor-access cat | N/A | 300m median |
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
| 30 | 50% |
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
| Indoor cat median distance | 39m | [R] | Normal(39, 5) |
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

## Trap Capture Probability

Parameters governing humane trap effectiveness by species, temperament, and physiological state.

```python
# [A] Analytical estimates - limited field data on trap success rates
# Trap capture is probabilistic per tick when animal is within trap detection range

DOG_TRAP_CAPTURE_PROBABILITY = {
    # Base probability per tick (5-minute) when within 5m of baited trap
    "base_rate_per_tick": 0.02,  # [A] ~2% per 5-min tick when in range

    # Temperament multipliers (codes from Layer 5)
    "temperament_multiplier": {
        "G": 1.5,   # Gregarious - approaches novel food sources readily
        "C": 1.2,   # Confident - neutral, will approach if beneficial
        "A": 0.6,   # Aloof - slow to approach, needs habituation
        "X": 0.3,   # Xenophobic - extreme wariness, may never enter
        "B": 1.0,   # Bonded - depends on scent; owner-scented bait helps
    },

    # Hunger threshold effects (hunger_level 0.0-1.0)
    "hunger_thresholds": {
        "no_interest": 0.2,      # Below this, trap food not attractive
        "mild_interest": 0.4,    # Will investigate but not enter
        "moderate_drive": 0.6,   # Will attempt entry if comfortable
        "desperate": 0.8,        # Hunger overrides caution significantly
    },

    # Hunger multiplier curve
    "hunger_multiplier": {
        0.0: 0.1,   # Well-fed - minimal interest
        0.3: 0.3,   # Slightly hungry
        0.5: 0.7,   # Moderately hungry
        0.7: 1.2,   # Hungry - enhanced motivation
        0.9: 2.0,   # Very hungry - desperation boost
        1.0: 2.5,   # Starving - maximum drive
    },

    # Fear level effects (reduces capture probability)
    "fear_multiplier": {
        0.0: 1.0,   # Calm - no reduction
        0.3: 0.8,   # Mild fear
        0.5: 0.5,   # Moderate fear - significant wariness
        0.7: 0.2,   # High fear - very unlikely to enter
        0.9: 0.05,  # Extreme fear - almost impossible
    },

    # Time-of-day modifiers (dogs more active during day)
    "time_of_day_multiplier": {
        "dawn": 1.2,      # 5-8 AM
        "morning": 1.0,   # 8-12 PM
        "afternoon": 0.8, # 12-5 PM (heat, less active)
        "dusk": 1.3,      # 5-8 PM (peak activity)
        "night": 0.6,     # 8 PM - 5 AM
    },

    # Habituation bonus (days trap has been in place)
    "habituation_bonus_per_day": 0.05,  # +5% per day, max +25%
    "max_habituation_bonus": 0.25,

    # Bait type effectiveness
    "bait_effectiveness": {
        "owner_scented_item": 1.5,  # Familiar smell reduces wariness
        "high_value_food": 1.3,     # Rotisserie chicken, etc.
        "standard_dog_food": 1.0,   # Baseline
        "generic_meat": 0.9,
    },
}

CAT_TRAP_CAPTURE_PROBABILITY = {
    # Base probability per tick when within 3m of baited trap
    # Cats require closer approach and more time than dogs
    "base_rate_per_tick": 0.015,  # [A] ~1.5% per 5-min tick - more cautious

    # Temperament multipliers (codes from Layer 4)
    "temperament_multiplier": {
        "CUR": 1.3,   # Curious/Clown - curious, food-motivated, will explore
        "CL": 1.1,    # Care-less - not avoiding, not seeking humans
        "CAU": 0.5,   # Cautious - needs extensive habituation
        "X": 0.2,     # Xenophobic - rarely enters without starvation
        "B": 1.4,     # Bonded - will approach owner-scented items
    },

    # Threshold state is CRITICAL for cats
    # Pre-threshold cats are in deep hiding and won't approach traps
    "threshold_multiplier": {
        "pre_threshold": 0.05,   # [A] Almost never - survival instinct dominant
        "threshold_reached": 1.0, # Normal probability applies
        "post_threshold_desperate": 1.5,  # Actively seeking food
    },

    # Hunger multiplier (threshold must be reached first)
    "hunger_multiplier": {
        0.0: 0.1,
        0.3: 0.2,
        0.5: 0.5,
        0.7: 1.0,   # Hunger becomes primary driver
        0.9: 1.8,   # Desperation
        1.0: 2.2,
    },

    # Fear multiplier (post-threshold fear is lower but still matters)
    "fear_multiplier": {
        0.0: 1.0,
        0.3: 0.7,
        0.5: 0.4,
        0.7: 0.15,
        0.9: 0.03,  # [A] Even starving cats avoid when terrified
    },

    # Time-of-day (cats are crepuscular/nocturnal)
    "time_of_day_multiplier": {
        "dawn": 1.4,      # Peak activity
        "morning": 0.5,   # Sleeping
        "afternoon": 0.3, # Deep sleep
        "dusk": 1.5,      # Peak activity
        "night": 1.2,     # Active hunting time
    },

    # Habituation is even more important for cats
    "habituation_bonus_per_day": 0.08,  # +8% per day
    "max_habituation_bonus": 0.40,      # Can reach +40% with patience

    # Bait effectiveness
    "bait_effectiveness": {
        "owner_scented_item": 1.8,      # [A] Very effective for owned cats
        "cat_from_same_household": 1.4, # Familiar cat scent
        "wet_cat_food_warmed": 1.3,     # Strong smell
        "tuna_or_sardines": 1.2,
        "dry_cat_food": 0.8,            # Less aromatic
    },

    # Indoor vs outdoor cat modifier
    "indoor_outdoor_modifier": {
        "indoor_only": 1.3,   # Less trap-wary, more food-dependent
        "indoor_outdoor": 1.0,
        "outdoor_only": 0.7,  # More self-sufficient, trap-experienced
        "feral": 0.4,         # [A] Extremely trap-wary
    },
}


def calculate_trap_capture_probability(
    state: AnimalState,
    profile: AnimalProfile,
    trap: TrapInfo,
    environment: Environment
) -> float:
    """
    Calculate probability of trap capture for current tick.
    Returns probability 0.0-1.0 for this tick.
    """

    if profile.species == "dog":
        params = DOG_TRAP_CAPTURE_PROBABILITY
        detection_range = 5.0  # meters
    else:
        params = CAT_TRAP_CAPTURE_PROBABILITY
        detection_range = 3.0  # meters

    dist = distance(state.position, trap.location)
    if dist > detection_range:
        return 0.0

    prob = params["base_rate_per_tick"]
    # Use temperament code directly (G/C/A/X/B for dogs, CUR/CL/CAU/X/B for cats)
    prob *= params["temperament_multiplier"].get(profile.temperament, 1.0)
    prob *= interpolate_multiplier(state.hunger_level, params["hunger_multiplier"])
    prob *= interpolate_multiplier(state.fear_level, params["fear_multiplier"])

    time_period = get_time_period(environment.current_hour)
    prob *= params["time_of_day_multiplier"].get(time_period, 1.0)

    days_in_place = trap.days_since_placement
    habituation = min(days_in_place * params["habituation_bonus_per_day"], params["max_habituation_bonus"])
    prob *= (1.0 + habituation)
    prob *= params["bait_effectiveness"].get(trap.bait_type, 1.0)

    if profile.species == "cat":
        if not state.threshold_reached:
            prob *= params["threshold_multiplier"]["pre_threshold"]
        elif state.hunger_level > 0.85:
            prob *= params["threshold_multiplier"]["post_threshold_desperate"]
        prob *= params["indoor_outdoor_modifier"].get(profile.indoor_outdoor_status, 1.0)

    if hasattr(state, 'trap_wariness') and trap.trap_type in state.trap_wariness:
        prob *= (1.0 - state.trap_wariness[trap.trap_type])

    distance_factor = 1.0 - (dist / detection_range) * 0.5
    prob *= distance_factor

    return min(prob, 0.95)
```

---

## Fear Re-Triggering Mechanics

Fear dynamics differ fundamentally between species. Dogs experience continuous fear decay that can spike with new triggers. Cats experience threshold-based fear that doesn't decay until physiological needs override it.

```python
# [A] Analytical model based on behavioral research

DOG_FEAR_TRIGGERS = {
    "loud_noise": {
        "examples": ["fireworks", "thunder", "gunshot", "car_backfire"],
        "fear_spike": 0.4,
        "decay_reset": True,
        "detection_radius_m": 500,
        "duration_effect_min": 30,
        "temperament_sensitivity": {"G": 0.5, "C": 0.8, "A": 1.2, "X": 1.5, "B": 0.9},
    },
    "human_approach": {
        "examples": ["person_walking_toward", "person_running", "person_calling"],
        "fear_spike": 0.2,
        "decay_reset": True,
        "detection_radius_m": 50,
        "duration_effect_min": 15,
        "temperament_sensitivity": {"G": 0.2, "C": 0.7, "A": 1.3, "X": 2.0, "B": 0.6},
    },
    "capture_attempt_failed": {
        "examples": ["grab_missed", "trap_triggered_empty", "net_missed"],
        "fear_spike": 0.5,
        "decay_reset": True,
        "detection_radius_m": 0,
        "duration_effect_min": 120,
        "temperament_sensitivity": {"G": 0.8, "C": 1.2, "A": 1.5, "X": 2.0, "B": 1.0},
        "special_effects": {
            "approach_wariness_increase": 0.3,
            "trap_wariness_increase": 0.5,
            "location_avoidance_hours": 48,
        },
    },
    "predator_encounter": {
        "examples": ["coyote", "large_dog_pack", "bear"],
        "fear_spike": 0.6,
        "decay_reset": True,
        "detection_radius_m": 100,
        "duration_effect_min": 180,
        "temperament_sensitivity": {"G": 1.0, "C": 1.0, "A": 1.2, "X": 1.3, "B": 1.0},
    },
}

DOG_FEAR_DECAY = {
    "base_half_life_hours": 4.0,
    "temperament_half_life_modifier": {"G": 0.7, "C": 1.0, "A": 1.5, "X": 2.5, "B": 1.2},
    "minimum_fear_floor": 0.05,
    "reset_on_trigger": True,
    "cumulative_trauma_factor": 0.1,
}

CAT_FEAR_TRIGGERS = {
    "loud_noise": {
        "examples": ["fireworks", "thunder", "construction"],
        "fear_spike": 0.3,
        "threshold_delay_hours": 6,
        "relocation_probability": 0.3,
        "detection_radius_m": 300,
        "temperament_sensitivity": {"CUR": 0.7, "CL": 0.8, "CAU": 1.3, "X": 1.8, "B": 0.9},
    },
    "human_approach": {
        "examples": ["person_near_hiding_spot", "person_searching"],
        "fear_spike": 0.25,
        "threshold_delay_hours": 12,
        "relocation_probability": 0.5,
        "detection_radius_m": 20,
        "temperament_sensitivity": {"CUR": 0.6, "CL": 0.7, "CAU": 1.4, "X": 2.0, "B": 0.4},
        "owner_vs_stranger": {"owner": 0.2, "familiar_person": 0.5, "stranger": 1.0},
    },
    "capture_attempt_failed": {
        "examples": ["grab_missed", "trap_sprung_escaped", "carrier_refused"],
        "fear_spike": 0.6,
        "threshold_delay_hours": 48,
        "relocation_probability": 0.85,
        "relocation_distance_m": {"min": 50, "max": 300, "mean": 150},
        "detection_radius_m": 0,
        "temperament_sensitivity": {"CUR": 1.0, "CL": 1.0, "CAU": 1.5, "X": 2.0, "B": 0.9},
        "special_effects": {
            "trust_damage": 0.4,
            "trap_type_wariness": 0.7,
            "location_permanent_avoid": True,
            "threshold_reset": True,
        },
    },
}

CAT_THRESHOLD_MODEL = {
    "base_threshold_hours": {"indoor_only": 72, "indoor_outdoor": 96, "outdoor_only": 120, "feral": 168},
    "temperament_threshold_modifier": {"CUR": 0.85, "CL": 0.9, "CAU": 1.2, "X": 1.5, "B": 0.95},
    "max_threshold_delay_hours": 168,
    "post_threshold_behavior": {
        "emergence_pattern": "crepuscular",
        "initial_emergence_radius_m": 20,
        "daily_radius_expansion_m": 10,
        "vocalization_probability": 0.3,
    },
}
```

---

## Failed Capture Attempt Consequences

Failed capture attempts are among the most consequential events in lost pet recovery. A botched attempt can transform a 3-day recovery into a 3-week ordeal.

```python
# [A] Analytical model - critical for realistic simulation

FAILED_CAPTURE_CONSEQUENCES = {
    "dog": {
        "immediate_effects": {
            "fear_spike": 0.5,
            "flee_distance_m": {"min": 100, "max": 800, "mean": 300, "distribution": "lognormal"},
            "flee_duration_min": {"min": 15, "max": 120, "mean": 45},
        },
        "behavioral_changes": {
            "approach_wariness_increase": 0.3,
            "trust_decay_factor": 0.7,
            "flight_distance_increase_m": 50,
            "flight_distance_duration_hours": 72,
        },
        "location_effects": {
            "avoids_capture_location": True,
            "avoidance_radius_m": 100,
            "avoidance_duration_hours": 48,
            "returns_to_area_probability": 0.6,
        },
        "temperament_specific": {
            "G": {"recovery_time_hours": 24, "permanent_wariness_increase": 0.1},
            "C": {"recovery_time_hours": 48, "permanent_wariness_increase": 0.15},
            "A": {"recovery_time_hours": 96, "permanent_wariness_increase": 0.25},
            "X": {"recovery_time_hours": 168, "permanent_wariness_increase": 0.4, "may_become_uncatchable_prob": 0.2},
            "B": {"recovery_time_hours": 36, "permanent_wariness_increase": 0.1, "owner_trust_retained": True},
        },
    },
    "cat": {
        "immediate_effects": {
            "fear_spike": 0.6,
            "relocation_probability": 0.85,
            "relocation_distance_m": {"min": 50, "max": 500, "mean": 150, "distribution": "lognormal"},
        },
        "threshold_effects": {
            "threshold_reset": True,
            "threshold_delay_hours": 48,
            "threshold_progress_retained": 0.0,
        },
        "return_behavior": {
            "return_to_exact_spot": {
                "probability": 0.15,
                "conditions": {"requires_threshold_reached": True, "requires_no_alternative_food": True, "minimum_hours_before_return": 72},
                "temperament_modifier": {"CUR": 1.1, "CL": 1.0, "CAU": 0.7, "X": 0.3, "B": 1.3},
            },
            "return_to_general_area": {
                "probability": 0.45,
                "area_radius_m": 50,
                "conditions": {"requires_threshold_reached": True, "minimum_hours_before_return": 48},
                "temperament_modifier": {"CUR": 1.1, "CL": 1.0, "CAU": 0.8, "X": 0.5, "B": 1.2},
            },
            "never_returns": {"probability": 0.40},
        },
        "temperament_specific": {
            "CUR": {"threshold_delay_hours": 42, "trust_recovery_possible": True, "trust_recovery_time_hours": 96},
            "CL": {"threshold_delay_hours": 48, "trust_recovery_possible": True, "trust_recovery_time_hours": 120},
            "CAU": {"threshold_delay_hours": 72, "trust_recovery_possible": True, "trust_recovery_time_hours": 168},
            "X": {"threshold_delay_hours": 96, "trust_recovery_possible": False, "may_become_uncatchable_prob": 0.35},
            "B": {"threshold_delay_hours": 36, "trust_recovery_possible": True, "trust_recovery_time_hours": 72},
        },
    },
}
```

---

## Search Outreach and Reach Model

Replaces the simple O0-O4 search effort levels with a more realistic model of search reach, visibility, and effectiveness.

```python
# [A] Analytical model replacing categorical O0-O4 levels

SEARCH_REACH_MODEL = {
    "physical_search": {
        "searcher_detection_radius_m": {
            "walking_casual": 30, "walking_focused": 50, "driving_slow": 100, "driving_fast": 20, "stationary_calling": 40,
        },
        "searcher_effectiveness": {"novice": 0.3, "experienced": 0.5, "professional": 0.7, "with_search_dog": 0.85},
        "terrain_detection_modifier": {"open_field": 1.2, "suburban_yards": 1.0, "wooded": 0.5, "dense_brush": 0.3, "urban_structures": 0.7},
        "time_of_day_modifier": {"daylight": 1.0, "dawn_dusk": 0.7, "night_with_flashlight": 0.4, "night_no_light": 0.1},
        "coverage_rate_sqm_per_hour": {"on_foot": 10000, "by_car": 50000, "drone": 100000},
    },
    "social_media_reach": {
        "platforms": {
            "nextdoor": {"local_reach_multiplier": 3.0, "radius_km": 5, "response_rate": 0.02},
            "facebook_local_groups": {"local_reach_multiplier": 2.5, "radius_km": 15, "response_rate": 0.015},
            "pawboost": {"local_reach_multiplier": 2.0, "radius_km": 25, "response_rate": 0.025},
            "craigslist": {"local_reach_multiplier": 1.5, "radius_km": 30, "response_rate": 0.005},
        },
        "post_quality_multiplier": {"poor": 0.5, "basic": 1.0, "good": 1.5, "excellent": 2.0},
        "paid_boost": {
            "facebook_boost": {"cost_per_day": 10, "reach_multiplier": 3.0, "diminishing_returns_after_days": 7},
            "pawboost_premium": {"cost_per_day": 5, "reach_multiplier": 2.0},
        },
    },
    "community_engagement": {
        "flyer_effectiveness": {"per_flyer_visibility_radius_m": 50, "viewer_report_probability": 0.01, "weather_degradation_per_day": 0.1},
        "door_to_door": {"houses_per_hour": 20, "positive_engagement_rate": 0.7, "will_watch_for_pet_rate": 0.5, "watch_duration_days": 7},
        "shelter_notification": {"check_frequency_recommended_hours": 24, "intake_notification_probability": 0.9},
    },
    "sighting_quality": {
        "probability_given_detection": {"no_social_media": 0.1, "saw_social_media": 0.6, "has_flyer_info": 0.7},
        "report_accuracy": {"definite_identification": 0.9, "probable_match": 0.6, "possible_match": 0.3, "wrong_animal": 0.1},
    },
}


def convert_legacy_search_level(o_level: str) -> SearchActivity:
    """Convert legacy O0-O4 search levels to new SearchActivity model."""
    conversions = {
        "O0": SearchActivity(physical_search=False, social_media_posts={}, flyers_posted=0, searchers=[]),
        "O1": SearchActivity(physical_search=True, social_media_posts={"nextdoor": Post(quality="basic")}, flyers_posted=10, searchers=[Searcher(method="walking_casual", skill="novice")]),
        "O2": SearchActivity(physical_search=True, social_media_posts={"nextdoor": Post(quality="good"), "facebook_local_groups": Post(quality="good")}, flyers_posted=50, searchers=[Searcher(method="walking_focused", skill="experienced"), Searcher(method="driving_slow", skill="novice")]),
        "O3": SearchActivity(physical_search=True, social_media_posts={"nextdoor": Post(quality="excellent", is_boosted=True), "facebook_local_groups": Post(quality="excellent"), "pawboost": Post(quality="excellent")}, flyers_posted=200, searchers=[Searcher(method="walking_focused", skill="experienced")], traps=[Trap(type="humane_live")], cameras=[Camera(type="wildlife")]),
        "O4": SearchActivity(physical_search=True, social_media_posts={"nextdoor": Post(quality="excellent", is_boosted=True), "facebook_local_groups": Post(quality="excellent", is_boosted=True), "pawboost": Post(quality="excellent", is_boosted=True)}, flyers_posted=500, searchers=[Searcher(method="walking_focused", skill="professional"), Searcher(method="with_search_dog", skill="professional")], traps=[Trap(type="humane_live"), Trap(type="humane_live")], professional_help=True),
    }
    return conversions.get(o_level, conversions["O1"])
```

---

## Injury Progression Model

Injuries worsen or heal based on activity level, shelter quality, and environmental conditions.

```python
# [A] Analytical model for injury dynamics

INJURY_PROGRESSION_MODEL = {
    "injury_types": {
        "laceration": {"initial_severity_range": (0.1, 0.6), "infection_risk_per_day": 0.15, "natural_healing_rate_per_day": 0.05, "activity_worsening_rate": 0.02, "movement_penalty": 0.3},
        "fracture": {"initial_severity_range": (0.3, 0.9), "infection_risk_per_day": 0.05, "natural_healing_rate_per_day": 0.01, "activity_worsening_rate": 0.05, "movement_penalty": 0.6},
        "internal": {"initial_severity_range": (0.2, 0.8), "infection_risk_per_day": 0.2, "natural_healing_rate_per_day": 0.02, "activity_worsening_rate": 0.03, "movement_penalty": 0.4, "hidden": True},
        "sprain": {"initial_severity_range": (0.1, 0.4), "infection_risk_per_day": 0.0, "natural_healing_rate_per_day": 0.1, "activity_worsening_rate": 0.01, "movement_penalty": 0.2},
        "bite_wound": {"initial_severity_range": (0.2, 0.7), "infection_risk_per_day": 0.25, "natural_healing_rate_per_day": 0.03, "activity_worsening_rate": 0.02, "movement_penalty": 0.25},
    },
    "environmental_factors": {
        "shelter_quality": {
            "none": {"healing_multiplier": 0.3, "infection_multiplier": 2.0},
            "poor": {"healing_multiplier": 0.5, "infection_multiplier": 1.5},
            "moderate": {"healing_multiplier": 0.8, "infection_multiplier": 1.2},
            "good": {"healing_multiplier": 1.0, "infection_multiplier": 1.0},
        },
        "weather": {
            "rain": {"healing_multiplier": 0.5, "infection_multiplier": 1.5},
            "extreme_cold": {"healing_multiplier": 0.3, "infection_multiplier": 1.2},
            "extreme_heat": {"healing_multiplier": 0.7, "infection_multiplier": 1.8},
            "normal": {"healing_multiplier": 1.0, "infection_multiplier": 1.0},
        },
    },
    "activity_effects": {
        "resting": {"healing_bonus": 0.02, "worsening_rate": 0.0},
        "walking": {"healing_bonus": 0.0, "worsening_rate": 0.005},
        "running": {"healing_bonus": -0.01, "worsening_rate": 0.02},
        "fleeing": {"healing_bonus": -0.02, "worsening_rate": 0.04},
    },
    "severity_thresholds": {"minor": 0.3, "moderate": 0.6, "severe": 0.8, "critical": 0.95},
    "mortality_risk_per_day": {0.0: 0.0, 0.3: 0.001, 0.5: 0.005, 0.7: 0.02, 0.9: 0.08, 1.0: 0.2},
    "infection": {"severity_increase_per_day": 0.15, "sepsis_threshold": 0.9, "sepsis_mortality_per_day": 0.3},
}


def update_injury_status(state: AnimalState, profile: AnimalProfile, environment: Environment, hours_elapsed: float) -> AnimalState:
    """Update injury severity based on activity and conditions."""
    if state.injury_severity <= 0:
        return state

    new_state = state.copy()
    params = INJURY_PROGRESSION_MODEL

    activity = "resting" if state.status in ["resting", "hiding"] else "fleeing" if state.status == "fleeing" else "running" if state.speed_mps > 2.0 else "walking"
    shelter_quality = get_shelter_quality(state.current_hiding_spot, environment)
    shelter_factors = params["environmental_factors"]["shelter_quality"][shelter_quality]
    weather_factors = params["environmental_factors"]["weather"][environment.weather]

    injury_type = state.injury_type or "laceration"
    injury_params = params["injury_types"][injury_type]

    base_healing = injury_params["natural_healing_rate_per_day"] * (hours_elapsed / 24)
    activity_bonus = params["activity_effects"][activity]["healing_bonus"] * hours_elapsed
    total_healing = (base_healing + activity_bonus) * shelter_factors["healing_multiplier"] * weather_factors["healing_multiplier"]

    base_worsening = injury_params["activity_worsening_rate"] * hours_elapsed
    activity_worsening = params["activity_effects"][activity]["worsening_rate"] * hours_elapsed
    severity_change = (base_worsening + activity_worsening) - total_healing

    if state.injury_infected:
        severity_change += params["infection"]["severity_increase_per_day"] * (hours_elapsed / 24)
    else:
        infection_risk = injury_params["infection_risk_per_day"] * (hours_elapsed / 24) * shelter_factors["infection_multiplier"] * weather_factors["infection_multiplier"]
        if random.random() < infection_risk:
            new_state.injury_infected = True

    new_state.injury_severity = max(0.0, min(1.0, state.injury_severity + severity_change))
    new_state.movement_speed_modifier = 1.0 - (injury_params["movement_penalty"] * new_state.injury_severity)

    mortality_risk = interpolate_multiplier(new_state.injury_severity, params["mortality_risk_per_day"]) * (hours_elapsed / 24)
    if new_state.injury_infected and new_state.injury_severity > params["infection"]["sepsis_threshold"]:
        mortality_risk += params["infection"]["sepsis_mortality_per_day"] * (hours_elapsed / 24)

    if random.random() < mortality_risk:
        new_state.status = "deceased"
        new_state.death_cause = "injury_complications"

    return new_state
```

---

## Trap-Type Wariness Model

Animals that escape from traps develop wariness specific to that trap type. This wariness transfers partially to similar trap types.

```python
# [A] Analytical model for trap-specific wariness

TRAP_TYPE_WARINESS = {
    "trap_types": {
        "box_trap_small": {"description": "Small wire box trap (cat-sized)", "species": ["cat"], "base_capture_modifier": 1.0},
        "box_trap_large": {"description": "Large wire box trap (dog-sized)", "species": ["dog", "cat"], "base_capture_modifier": 1.0},
        "drop_trap": {"description": "Triggered drop trap", "species": ["cat"], "base_capture_modifier": 1.2},
        "enclosure_trap": {"description": "Large walk-in enclosure", "species": ["dog"], "base_capture_modifier": 0.9},
        "net_capture": {"description": "Net thrown by rescuer", "species": ["dog", "cat"], "base_capture_modifier": 0.7},
        "direct_approach": {"description": "Direct approach and grab", "species": ["dog", "cat"], "base_capture_modifier": 0.5},
    },
    "wariness_transfer_matrix": {
        "box_trap_small": {"box_trap_small": 1.0, "box_trap_large": 0.7, "drop_trap": 0.4, "enclosure_trap": 0.5, "net_capture": 0.2, "direct_approach": 0.3},
        "box_trap_large": {"box_trap_small": 0.7, "box_trap_large": 1.0, "drop_trap": 0.4, "enclosure_trap": 0.6, "net_capture": 0.2, "direct_approach": 0.3},
        "drop_trap": {"box_trap_small": 0.3, "box_trap_large": 0.3, "drop_trap": 1.0, "enclosure_trap": 0.3, "net_capture": 0.4, "direct_approach": 0.4},
        "enclosure_trap": {"box_trap_small": 0.4, "box_trap_large": 0.5, "drop_trap": 0.2, "enclosure_trap": 1.0, "net_capture": 0.2, "direct_approach": 0.3},
        "net_capture": {"box_trap_small": 0.2, "box_trap_large": 0.2, "drop_trap": 0.5, "enclosure_trap": 0.2, "net_capture": 1.0, "direct_approach": 0.6},
        "direct_approach": {"box_trap_small": 0.2, "box_trap_large": 0.2, "drop_trap": 0.3, "enclosure_trap": 0.2, "net_capture": 0.5, "direct_approach": 1.0},
    },
    "wariness_dynamics": {
        "initial_wariness_on_escape": 0.7,
        "wariness_increase_per_escape": 0.2,
        "max_wariness": 0.95,
        "decay_rate_per_day": 0.01,
        "decay_starts_after_days": 7,
        "minimum_wariness": 0.2,
        "hunger_wariness_reduction": {0.5: 1.0, 0.7: 0.9, 0.85: 0.7, 0.95: 0.4, 1.0: 0.2},
    },
    "temperament_wariness_modifier": {
        "dog": {"G": 0.7, "C": 0.9, "A": 1.2, "X": 1.5, "B": 0.85},
        "cat": {"CUR": 0.85, "CL": 0.9, "CAU": 1.3, "X": 1.6, "B": 0.8},
    },
}


def update_trap_wariness(state: AnimalState, profile: AnimalProfile, escape_from_trap_type: str) -> AnimalState:
    """Update trap wariness after a failed capture attempt."""
    new_state = state.copy()
    params = TRAP_TYPE_WARINESS

    if not hasattr(new_state, 'trap_wariness'):
        new_state.trap_wariness = {}

    # Use temperament code directly (G/C/A/X/B for dogs, CUR/CL/CAU/X/B for cats)
    temp_modifier = params["temperament_wariness_modifier"][profile.species].get(profile.temperament, 1.0)

    dynamics = params["wariness_dynamics"]
    current_wariness = new_state.trap_wariness.get(escape_from_trap_type, 0.0)
    wariness_increase = dynamics["initial_wariness_on_escape"] if current_wariness == 0 else dynamics["wariness_increase_per_escape"]
    wariness_increase *= temp_modifier

    new_state.trap_wariness[escape_from_trap_type] = min(current_wariness + wariness_increase, dynamics["max_wariness"])

    transfer_matrix = params["wariness_transfer_matrix"][escape_from_trap_type]
    for other_trap_type, transfer_rate in transfer_matrix.items():
        if other_trap_type != escape_from_trap_type:
            transferred = wariness_increase * transfer_rate
            current_other = new_state.trap_wariness.get(other_trap_type, 0.0)
            new_other = min(current_other + transferred, dynamics["max_wariness"])
            if new_other > current_other:
                new_state.trap_wariness[other_trap_type] = new_other

    return new_state


def get_effective_trap_wariness(state: AnimalState, trap_type: str) -> float:
    """Get effective wariness for a trap type, accounting for hunger override."""
    if not hasattr(state, 'trap_wariness'):
        return 0.0
    base_wariness = state.trap_wariness.get(trap_type, 0.0)
    if base_wariness == 0:
        return 0.0
    hunger_reduction = interpolate_multiplier(state.hunger_level, TRAP_TYPE_WARINESS["wariness_dynamics"]["hunger_wariness_reduction"])
    return base_wariness * hunger_reduction
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
| Statistic | Value | Source |
|-----------|-------|--------|
| Indoor cat median distance | 39m | Huang et al. 2018 (*Animals* journal, n=1,210) |
| Outdoor cat median distance | 300m | Huang et al. 2018 |
| Indoor cats within 3-house radius | 93% | Missing Pet Partnership |
| 75% of cats found within | 500m | Huang et al. 2018 |
| Cat recovery rate (1 year) | 61% | Huang et al. 2018 (95% CI: 57-64%) |
| Dogs found <1 mile | 70% | Rowan et al. 2021 (*Frontiers in Vet Sci*, n=10,000+) |

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

# PART 9: RESEARCH VALIDATION STATUS

This section consolidates the empirical basis and validation needs for model parameters,
enabling developers to prioritize validation effort and users to interpret outputs appropriately.

---

## Parameters with Peer-Reviewed Support

| Parameter | Source | Sample Size | Confidence |
|-----------|--------|-------------|------------|
| Cat distance by indoor/outdoor | Huang et al. 2018 (*Animals*) | n=1,210 | High |
| Cat recovery rates (7/30/365 day) | Huang et al. 2018 | n=1,210 | High |
| Dog distance <1 mile | Rowan et al. 2021 (*Frontiers in Vet Sci*) | n=10,000+ | High |
| Fear decay functional form (exponential) | Krypotos et al. 2021 (*Biol Psychiatry*) | Meta-analysis | High |
| Noise panic recovery ~75% by morning | Riemer 2019 | n=1,225 | Moderate |
| Temperament framework structure | Aligns with C-BARQ, Feline Five | 35,000+ (C-BARQ) | Moderate |
| Cats 93% within 3-house radius | Missing Pet Partnership | Practitioner data | Moderate |

---

## Parameters Requiring Validation

| Parameter | Current Basis | Priority | Validation Approach |
|-----------|---------------|----------|---------------------|
| Trap capture probability by temperament | [A] Practitioner estimate | **Critical** | TNR outcome tracking with temperament assessment |
| Mortality rates by terrain | [A] Estimate | High | Shelter intake vs. return data by location type |
| Fear decay half-lives (esp. P3) | [A] Extrapolated | High | GPS tracking studies with behavioral scoring |
| Threshold timing (10-12 days) | [P] Practitioner | Medium | Validate via recovery timestamps vs. escape times |
| Failed capture flight distance | [A] Estimate | Medium | Controlled observation during TNR operations |
| Temperament distribution in population | [A] Estimate | Medium | Shelter intake behavioral assessments |

---

## Known Model Limitations

### 1. Severe Trauma Fear Decay
The simple exponential decay model may underestimate fear persistence for P3 (severe trauma)
escapes. Military working dog PTSD literature indicates recovery taking weeks to months.
Consider multi-component model: fast initial decay + slow residual component.

### 2. Individual Heterogeneity
Within-temperament variation is substantial. A "gregarious" dog's actual behavior depends
on countless unmeasured factors (early socialization, specific fear triggers, health status).
**Predictions are population-level tendencies, not individual guarantees.**

### 3. Suburban vs Urban Mortality
Limited evidence exists for mortality rate assumptions. Notably, an Indian street dog study
(Paul et al. 2016) found suburban mortality **exceeded** urban—opposite to model assumption.
This parameter warrants particular scrutiny.

### 4. Threshold Phenomenon Validation
The cat threshold phenomenon (10-12 day hiding before emergence) is widely accepted by
practitioners but has not been validated in controlled scientific study. Missing Animal
Response Network explicitly acknowledges this gap.

### 5. Environmental Factors Not Modeled
Current model does not integrate:
- Real-time landscape barriers (fences, highways, water bodies)
- Traffic pattern variations
- Predator activity schedules
- Weather effects beyond temperature extremes

---

## Recommended Validation Studies

### Immediate Priority
1. **Retrospective validation**: Test against database of lost pet initial/recovery locations
   with timestamps. Use leave-one-out cross-validation with energy distance statistics.

2. **Parameter sensitivity analysis**: Identify which inputs most affect outputs using
   Sobol indices to quantify interaction effects.

### Medium-Term
3. **GPS tracking validation**: Deploy trackers on pets in controlled scenarios (with owner
   consent) to measure actual movement patterns vs. predicted.

4. **Outcome tracking**: Monitor whether users following model recommendations achieve
   higher recovery rates than baseline.

### Long-Term
5. **Shelter partnership**: Partner with high-volume shelters to collect standardized
   behavioral assessments and recovery outcomes for model calibration.

---

## Provenance Tag Reference

| Tag | Meaning | Confidence Level |
|-----|---------|------------------|
| [R] | Research-backed with peer-reviewed citation | Highest |
| [P] | Practitioner consensus (MPP, Albrecht, MARN) | Moderate |
| [C] | Calculated/derived from other parameters | Moderate |
| [A] | Author assumption requiring validation | Lowest |

**Interpretation guidance**: Distance predictions [R] deserve more confidence than mortality
estimates [A]. Temperament-based modifiers [P] reflect practitioner experience but lack
psychometric validation. All [A] parameters are targets for empirical calibration.

---

# PART 10: ENVIRONMENT INTEGRATION

This section defines how OpenStreetMap data is transformed into a simulation environment
and how animal agents interact with environmental features.

---

## OpenStreetMap Data Extraction

### Required OSM Layers

```python
OSM_REQUIRED_LAYERS = {
    # Primary layers for environment construction
    "buildings": {
        "osm_key": "building",
        "values": ["*"],  # All building types
        "use": "hiding_spots, barriers, human_activity",
    },
    "landuse": {
        "osm_key": "landuse",
        "values": ["residential", "commercial", "industrial", "forest",
                   "farmland", "grass", "cemetery", "park"],
        "use": "terrain_classification, hiding_density",
    },
    "natural": {
        "osm_key": "natural",
        "values": ["wood", "water", "wetland", "scrub", "grassland", "tree_row"],
        "use": "terrain, water_sources, hiding_spots",
    },
    "highway": {
        "osm_key": "highway",
        "values": ["motorway", "primary", "secondary", "tertiary",
                   "residential", "service", "footway", "path"],
        "use": "traffic_risk, movement_corridors, barriers",
    },
    "waterway": {
        "osm_key": "waterway",
        "values": ["river", "stream", "canal", "ditch", "drain"],
        "use": "water_sources, barriers",
    },
    "amenity": {
        "osm_key": "amenity",
        "values": ["parking", "school", "restaurant", "fuel", "veterinary",
                   "animal_shelter", "waste_basket"],
        "use": "food_sources, human_activity, recovery_points",
    },
    "barrier": {
        "osm_key": "barrier",
        "values": ["fence", "wall", "hedge", "gate"],
        "use": "movement_barriers",
    },
    "leisure": {
        "osm_key": "leisure",
        "values": ["park", "garden", "dog_park", "playground", "nature_reserve"],
        "use": "terrain, hiding_spots, off_leash_areas",
    },
}
```

### Overpass API Query Template

```python
def build_overpass_query(center_lat: float, center_lon: float, radius_m: int = 5000) -> str:
    """
    Build Overpass API query to fetch all required OSM data for simulation area.

    Args:
        center_lat: Escape point latitude
        center_lon: Escape point longitude
        radius_m: Search radius in meters (default 5km for dogs, 500m sufficient for cats)

    Returns:
        Overpass QL query string
    """

    query = f"""
    [out:json][timeout:60];
    (
      // Buildings
      way["building"](around:{radius_m},{center_lat},{center_lon});
      relation["building"](around:{radius_m},{center_lat},{center_lon});

      // Land use
      way["landuse"](around:{radius_m},{center_lat},{center_lon});
      relation["landuse"](around:{radius_m},{center_lat},{center_lon});

      // Natural features
      way["natural"](around:{radius_m},{center_lat},{center_lon});
      node["natural"="tree"](around:{radius_m},{center_lat},{center_lon});

      // Roads and paths
      way["highway"](around:{radius_m},{center_lat},{center_lon});

      // Water
      way["waterway"](around:{radius_m},{center_lat},{center_lon});
      way["natural"="water"](around:{radius_m},{center_lat},{center_lon});

      // Amenities
      node["amenity"](around:{radius_m},{center_lat},{center_lon});
      way["amenity"](around:{radius_m},{center_lat},{center_lon});

      // Barriers
      way["barrier"](around:{radius_m},{center_lat},{center_lon});

      // Leisure areas
      way["leisure"](around:{radius_m},{center_lat},{center_lon});
    );
    out body;
    >;
    out skel qt;
    """

    return query


def fetch_osm_data(center_lat: float, center_lon: float, radius_m: int = 5000) -> dict:
    """Fetch OSM data from Overpass API."""

    import requests

    query = build_overpass_query(center_lat, center_lon, radius_m)

    response = requests.post(
        "https://overpass-api.de/api/interpreter",
        data={"data": query},
        timeout=120
    )

    if response.status_code == 200:
        return response.json()
    else:
        raise Exception(f"Overpass API error: {response.status_code}")
```

---

## Grid Cell Structure

The simulation environment is discretized into a grid of cells. Each cell contains
properties derived from OSM features that affect animal behavior.

### Cell Definition

```python
from dataclasses import dataclass, field
from typing import List, Optional, Tuple
from enum import Enum

class TerrainType(Enum):
    URBAN = "urban"
    SUBURBAN = "suburban"
    RURAL = "rural"
    WOODED = "wooded"
    WATER = "water"
    ROAD = "road"
    HIGHWAY = "highway"  # High-speed roads, major barrier


@dataclass
class HidingSpot:
    """A specific hiding location within a cell."""
    spot_type: str          # "under_deck", "dense_bush", "shed", etc.
    quality: float          # 0-1, how good is the concealment
    accessibility: float    # 0-1, how easy to enter (cats can access more spots)
    capacity: str           # "cat_only", "small_dog", "medium_dog", "large_dog"
    weather_protection: float  # 0-1, protection from rain/cold
    position: Tuple[float, float]  # Precise location within cell


@dataclass
class WaterSource:
    """A water source within a cell."""
    source_type: str        # "stream", "pond", "puddle", "birdbath", "ac_drip"
    reliability: float      # 0-1, how consistently available
    accessibility: float    # 0-1, how easy to access
    position: Tuple[float, float]


@dataclass
class FoodSource:
    """A potential food source within a cell."""
    source_type: str        # "garbage", "bird_feeder", "restaurant_dumpster", "pet_food_outside"
    availability_hours: List[int]  # Hours when accessible (e.g., garbage out certain days)
    quality: float          # 0-1, nutritional value
    competition: float      # 0-1, likelihood of other animals present
    position: Tuple[float, float]


@dataclass
class EnvironmentCell:
    """
    A single cell in the simulation grid.
    Default cell size: 10m x 10m (adjustable based on required precision)
    """

    # Grid position
    grid_x: int
    grid_y: int

    # Geographic position (center of cell)
    lat: float
    lon: float

    # Terrain classification (from behavioral profiles Part 1)
    terrain_type: TerrainType

    # Movement properties
    traversable: bool = True          # Can animal enter this cell?
    movement_speed_modifier: float = 1.0  # Multiplier on base movement speed

    # Risk factors (connect to MORTALITY section in profiles)
    traffic_risk_per_hour: float = 0.0    # Probability of traffic incident per hour in cell
    predator_risk_per_hour: float = 0.0   # Probability of predator encounter per hour
    human_activity_level: float = 0.0     # 0-1, affects detection and fear triggers

    # Resources
    hiding_spots: List[HidingSpot] = field(default_factory=list)
    water_sources: List[WaterSource] = field(default_factory=list)
    food_sources: List[FoodSource] = field(default_factory=list)

    # Barriers (edges of cell that block movement)
    barriers: dict = field(default_factory=dict)  # {"north": True, "east": False, ...}
    barrier_type: Optional[str] = None  # "fence", "wall", "highway", "river"

    # Scent properties (for scent article searches)
    wind_exposure: float = 0.5        # 0-1, how exposed to wind
    scent_retention: float = 0.5      # 0-1, how well scent lingers

    # Building/structure info
    has_building: bool = False
    building_type: Optional[str] = None  # "residential", "commercial", "shed", etc.

    # Time-varying properties (updated during simulation)
    current_noise_level: float = 0.0  # Can trigger fear responses
    current_human_presence: int = 0   # Number of humans currently in/near cell


# Grid configuration
GRID_CONFIG = {
    "cell_size_meters": 10,           # 10m x 10m cells
    "default_radius_dog_m": 5000,     # 5km radius for dogs
    "default_radius_cat_m": 500,      # 500m radius for cats (they stay close)
    "coordinate_system": "WGS84",     # Standard GPS coordinates
}
```

### Grid Construction from OSM

```python
import numpy as np
from shapely.geometry import Point, Polygon, LineString
from shapely.ops import unary_union

def create_environment_grid(
    osm_data: dict,
    center_lat: float,
    center_lon: float,
    radius_m: int,
    cell_size_m: int = 10
) -> np.ndarray:
    """
    Create simulation grid from OSM data.

    Returns:
        2D numpy array of EnvironmentCell objects
    """

    # Calculate grid dimensions
    # Approximate: 1 degree lat ≈ 111,000m, 1 degree lon ≈ 111,000m * cos(lat)
    meters_per_deg_lat = 111000
    meters_per_deg_lon = 111000 * np.cos(np.radians(center_lat))

    grid_radius_cells = radius_m // cell_size_m
    grid_size = 2 * grid_radius_cells + 1

    # Initialize grid
    grid = np.empty((grid_size, grid_size), dtype=object)

    # Parse OSM elements into geometries
    buildings = extract_polygons(osm_data, "building")
    roads = extract_linestrings(osm_data, "highway")
    water = extract_polygons(osm_data, "natural", "water") + \
            extract_linestrings(osm_data, "waterway")
    landuse = extract_polygons(osm_data, "landuse")
    barriers = extract_linestrings(osm_data, "barrier")

    # Populate each cell
    for gx in range(grid_size):
        for gy in range(grid_size):
            # Calculate cell center coordinates
            offset_x = (gx - grid_radius_cells) * cell_size_m
            offset_y = (gy - grid_radius_cells) * cell_size_m

            cell_lat = center_lat + (offset_y / meters_per_deg_lat)
            cell_lon = center_lon + (offset_x / meters_per_deg_lon)

            # Create cell polygon for intersection tests
            cell_polygon = create_cell_polygon(cell_lat, cell_lon, cell_size_m)

            # Determine cell properties from OSM features
            cell = EnvironmentCell(
                grid_x=gx,
                grid_y=gy,
                lat=cell_lat,
                lon=cell_lon,
                terrain_type=classify_terrain(cell_polygon, landuse, buildings, roads),
                traversable=not is_blocked(cell_polygon, water, buildings),
                traffic_risk_per_hour=calculate_traffic_risk(cell_polygon, roads),
                hiding_spots=find_hiding_spots(cell_polygon, buildings, landuse),
                water_sources=find_water_sources(cell_polygon, water),
                barriers=detect_barriers(cell_polygon, barriers, roads),
            )

            grid[gx, gy] = cell

    return grid
```

---

## OSM Feature to Simulation Property Mapping

### Terrain Classification

```python
def classify_terrain(
    cell_polygon: Polygon,
    landuse_features: List[dict],
    building_features: List[dict],
    road_features: List[dict]
) -> TerrainType:
    """
    Classify cell terrain type based on OSM features.
    Maps to terrain types used in behavioral profiles (Part 1).
    """

    cell_area = cell_polygon.area

    # Check what features intersect this cell
    building_coverage = sum(
        cell_polygon.intersection(b["geometry"]).area
        for b in building_features
        if cell_polygon.intersects(b["geometry"])
    ) / cell_area

    road_coverage = sum(
        cell_polygon.intersection(r["geometry"].buffer(3)).area  # 3m road width
        for r in road_features
        if cell_polygon.intersects(r["geometry"])
    ) / cell_area

    # Check landuse
    dominant_landuse = get_dominant_landuse(cell_polygon, landuse_features)

    # Classification logic (matches behavioral profile terrain types)

    # Highway check first
    for road in road_features:
        if road.get("highway") in ["motorway", "trunk", "primary"]:
            if cell_polygon.intersects(road["geometry"].buffer(10)):
                return TerrainType.HIGHWAY

    # Water check
    if dominant_landuse == "water":
        return TerrainType.WATER

    # Urban: high building density
    if building_coverage > 0.4 or dominant_landuse in ["commercial", "industrial"]:
        return TerrainType.URBAN

    # Suburban: moderate building density, residential
    if building_coverage > 0.1 or dominant_landuse == "residential":
        return TerrainType.SUBURBAN

    # Wooded: forest or significant tree coverage
    if dominant_landuse in ["forest", "wood"] or has_tree_coverage(cell_polygon):
        return TerrainType.WOODED

    # Road: if mostly road
    if road_coverage > 0.5:
        return TerrainType.ROAD

    # Default to rural
    return TerrainType.RURAL


# Terrain to behavioral profile parameter mapping
TERRAIN_TO_PROFILE_PARAMS = {
    # Maps to DOG_TRAFFIC_RISK_PER_MIN from Part 5
    TerrainType.URBAN: {
        "traffic_risk_per_min": 0.0005,      # ~3% per hour
        "predator_risk_per_hour": 0.001,     # Low - few coyotes
        "hiding_spot_density": 0.8,          # Many structures
        "human_activity": 0.9,               # High foot traffic
        "speed_modifier": 0.7,               # Obstacles slow movement
    },
    TerrainType.SUBURBAN: {
        "traffic_risk_per_min": 0.0002,      # ~1.2% per hour
        "predator_risk_per_hour": 0.005,     # Moderate coyote presence
        "hiding_spot_density": 0.6,          # Yards, decks, sheds
        "human_activity": 0.5,
        "speed_modifier": 0.85,
    },
    TerrainType.RURAL: {
        "traffic_risk_per_min": 0.00005,     # ~0.3% per hour
        "predator_risk_per_hour": 0.015,     # Higher predator density
        "hiding_spot_density": 0.3,
        "human_activity": 0.1,
        "speed_modifier": 1.0,
    },
    TerrainType.WOODED: {
        "traffic_risk_per_min": 0.00001,     # ~0.06% per hour
        "predator_risk_per_hour": 0.02,      # Highest predator risk
        "hiding_spot_density": 0.9,          # Excellent natural cover
        "human_activity": 0.05,
        "speed_modifier": 0.6,               # Dense vegetation slows movement
    },
    TerrainType.ROAD: {
        "traffic_risk_per_min": 0.002,       # High risk while on road
        "predator_risk_per_hour": 0.001,
        "hiding_spot_density": 0.0,
        "human_activity": 0.3,
        "speed_modifier": 1.2,               # Fast travel on pavement
    },
    TerrainType.HIGHWAY: {
        "traffic_risk_per_min": 0.01,        # Very high - crossing attempt often fatal
        "predator_risk_per_hour": 0.0,
        "hiding_spot_density": 0.0,
        "human_activity": 0.0,               # No pedestrians
        "speed_modifier": 0.5,               # Hesitation, noise aversion
        "barrier": True,                     # Major movement barrier
    },
    TerrainType.WATER: {
        "traffic_risk_per_min": 0.0,
        "predator_risk_per_hour": 0.005,
        "hiding_spot_density": 0.0,
        "human_activity": 0.1,
        "speed_modifier": 0.0,               # Impassable (for most)
        "traversable": False,                # Barrier
        "is_water_source": True,
    },
}
```

### Hiding Spot Extraction

```python
# OSM feature to hiding spot mapping
OSM_HIDING_SPOT_MAPPING = {
    # Building types that create hiding opportunities
    "building": {
        "residential": {
            "generates": ["under_deck", "in_shed", "behind_garage", "in_bushes"],
            "quality_range": (0.6, 0.9),
            "cat_accessible": True,
            "dog_accessible": "medium",  # Up to medium dogs
        },
        "garage": {
            "generates": ["under_vehicle", "behind_equipment"],
            "quality_range": (0.5, 0.8),
            "cat_accessible": True,
            "dog_accessible": "small",
        },
        "shed": {
            "generates": ["inside_if_open", "underneath", "behind"],
            "quality_range": (0.7, 0.95),
            "cat_accessible": True,
            "dog_accessible": "small",
        },
        "commercial": {
            "generates": ["behind_dumpster", "loading_dock", "hvac_area"],
            "quality_range": (0.4, 0.7),
            "cat_accessible": True,
            "dog_accessible": "large",
        },
    },

    # Natural features
    "natural": {
        "scrub": {
            "generates": ["dense_brush"],
            "quality_range": (0.7, 0.9),
            "cat_accessible": True,
            "dog_accessible": "large",
        },
        "tree_row": {
            "generates": ["under_tree", "in_hedge"],
            "quality_range": (0.5, 0.7),
            "cat_accessible": True,
            "dog_accessible": "medium",
        },
        "wood": {
            "generates": ["fallen_log", "root_hollow", "dense_vegetation"],
            "quality_range": (0.8, 1.0),
            "cat_accessible": True,
            "dog_accessible": "large",
        },
    },

    # Leisure areas
    "leisure": {
        "garden": {
            "generates": ["in_bushes", "under_deck", "garden_shed"],
            "quality_range": (0.5, 0.8),
            "cat_accessible": True,
            "dog_accessible": "medium",
        },
    },
}


def find_hiding_spots(
    cell_polygon: Polygon,
    buildings: List[dict],
    landuse: List[dict]
) -> List[HidingSpot]:
    """
    Identify hiding spots within a cell based on OSM features.
    """

    spots = []

    for building in buildings:
        if not cell_polygon.intersects(building["geometry"]):
            continue

        building_type = building.get("building", "yes")
        mapping = OSM_HIDING_SPOT_MAPPING.get("building", {}).get(building_type)

        if mapping:
            for spot_type in mapping["generates"]:
                # Probabilistically generate spots based on building size
                building_area = building["geometry"].area
                num_spots = max(1, int(building_area / 100))  # 1 spot per 100m²

                for _ in range(num_spots):
                    quality = random.uniform(*mapping["quality_range"])

                    # Determine dog accessibility
                    dog_access = mapping["dog_accessible"]
                    if dog_access == "large":
                        capacity = "large_dog"
                    elif dog_access == "medium":
                        capacity = "medium_dog"
                    elif dog_access == "small":
                        capacity = "small_dog"
                    else:
                        capacity = "cat_only"

                    spots.append(HidingSpot(
                        spot_type=spot_type,
                        quality=quality,
                        accessibility=random.uniform(0.5, 1.0),
                        capacity=capacity,
                        weather_protection=0.8 if "inside" in spot_type or "under" in spot_type else 0.3,
                        position=random_point_near(building["geometry"], cell_polygon)
                    ))

    return spots
```

### Traffic Risk Calculation

```python
# Road type to traffic risk mapping
ROAD_TRAFFIC_RISK = {
    # OSM highway type: (vehicles_per_hour_estimate, speed_estimate_mph)
    "motorway": (2000, 65),
    "trunk": (1000, 55),
    "primary": (500, 45),
    "secondary": (200, 35),
    "tertiary": (100, 30),
    "residential": (20, 25),
    "service": (10, 15),
    "footway": (0, 0),
    "path": (0, 0),
}


def calculate_traffic_risk(cell_polygon: Polygon, roads: List[dict]) -> float:
    """
    Calculate traffic mortality risk for a cell based on roads present.

    Returns probability of traffic incident per hour spent in cell.
    """

    total_risk = 0.0

    for road in roads:
        if not cell_polygon.intersects(road["geometry"]):
            continue

        highway_type = road.get("highway", "residential")
        risk_params = ROAD_TRAFFIC_RISK.get(highway_type, (20, 25))

        vehicles_per_hour, speed_mph = risk_params

        # Risk model: more vehicles + higher speed = higher risk
        # Base risk per crossing attempt, scaled by presence in cell

        # Calculate how much of cell is road
        road_buffer = road["geometry"].buffer(3)  # 3m road half-width
        intersection_area = cell_polygon.intersection(road_buffer).area
        road_fraction = intersection_area / cell_polygon.area

        # Risk increases with traffic volume and speed
        # An animal in a "road" cell must cross at some point
        base_crossing_risk = (vehicles_per_hour / 1000) * (speed_mph / 30) * 0.01

        # Scale by how much of the cell is road
        cell_risk = base_crossing_risk * road_fraction

        total_risk += cell_risk

    # Cap at reasonable maximum
    return min(total_risk, 0.05)  # Max 5% per hour
```

### Water Source Identification

```python
OSM_WATER_SOURCES = {
    "waterway": {
        "stream": {"reliability": 0.9, "accessibility": 0.8},
        "river": {"reliability": 1.0, "accessibility": 0.6},  # Harder to access
        "ditch": {"reliability": 0.5, "accessibility": 0.9},
        "drain": {"reliability": 0.3, "accessibility": 0.7},
    },
    "natural": {
        "water": {"reliability": 1.0, "accessibility": 0.7},  # Pond/lake
        "wetland": {"reliability": 0.8, "accessibility": 0.5},
    },
    "amenity": {
        # Human-placed water sources
        "fountain": {"reliability": 0.7, "accessibility": 0.9},
        "drinking_water": {"reliability": 0.9, "accessibility": 1.0},
    },
    # Implicit sources (not in OSM but generated near buildings)
    "implicit": {
        "puddle": {"reliability": 0.2, "accessibility": 1.0},       # After rain
        "birdbath": {"reliability": 0.5, "accessibility": 0.9},     # In residential
        "ac_drip": {"reliability": 0.6, "accessibility": 0.8},      # Near buildings in summer
        "irrigation": {"reliability": 0.4, "accessibility": 0.9},   # Residential lawns
    },
}


def find_water_sources(cell_polygon: Polygon, water_features: List[dict]) -> List[WaterSource]:
    """
    Identify water sources within a cell.
    Critical for cat threshold timing (opportunistic hydration).
    """

    sources = []

    # Explicit OSM water features
    for feature in water_features:
        if not cell_polygon.intersects(feature["geometry"]):
            continue

        feature_type = feature.get("waterway") or feature.get("natural") or feature.get("amenity")
        category = None
        for cat, types in OSM_WATER_SOURCES.items():
            if feature_type in types:
                category = cat
                break

        if category and feature_type in OSM_WATER_SOURCES[category]:
            params = OSM_WATER_SOURCES[category][feature_type]
            sources.append(WaterSource(
                source_type=feature_type,
                reliability=params["reliability"],
                accessibility=params["accessibility"],
                position=nearest_point(feature["geometry"], cell_polygon.centroid)
            ))

    # Generate implicit sources based on terrain
    terrain = classify_terrain(cell_polygon, [], [], [])  # Simplified call

    if terrain == TerrainType.SUBURBAN:
        # Residential areas have birdbaths, AC drips, irrigation
        if random.random() < 0.3:  # 30% of suburban cells
            sources.append(WaterSource(
                source_type=random.choice(["birdbath", "ac_drip", "irrigation"]),
                reliability=random.uniform(0.3, 0.6),
                accessibility=0.9,
                position=random_point_in(cell_polygon)
            ))

    return sources
```

### Barrier Detection

```python
BARRIER_PROPERTIES = {
    # OSM barrier types and their traversability
    "barrier": {
        "fence": {
            "dog_passable": {"small": 0.3, "medium": 0.1, "large": 0.05},
            "cat_passable": 0.9,  # Cats can usually climb or squeeze through
        },
        "wall": {
            "dog_passable": {"small": 0.05, "medium": 0.01, "large": 0.0},
            "cat_passable": 0.7,  # Can often climb
        },
        "hedge": {
            "dog_passable": {"small": 0.8, "medium": 0.5, "large": 0.2},
            "cat_passable": 1.0,  # Easy passage
        },
        "gate": {
            "dog_passable": {"small": 0.2, "medium": 0.1, "large": 0.1},
            "cat_passable": 0.5,  # Depends on gate type
        },
    },
    # Roads as barriers
    "highway": {
        "motorway": {
            "dog_passable": {"small": 0.3, "medium": 0.3, "large": 0.3},  # Can cross but dangerous
            "cat_passable": 0.2,  # Cats more hesitant
            "crossing_mortality": 0.4,  # 40% chance of death if attempted
        },
        "primary": {
            "dog_passable": {"small": 0.6, "medium": 0.6, "large": 0.6},
            "cat_passable": 0.4,
            "crossing_mortality": 0.15,
        },
        "residential": {
            "dog_passable": {"small": 0.95, "medium": 0.95, "large": 0.95},
            "cat_passable": 0.8,
            "crossing_mortality": 0.02,
        },
    },
    # Water as barrier
    "waterway": {
        "river": {
            "dog_passable": {"small": 0.1, "medium": 0.3, "large": 0.5},  # Dogs can swim
            "cat_passable": 0.05,  # Cats avoid water
        },
        "stream": {
            "dog_passable": {"small": 0.8, "medium": 0.9, "large": 0.95},
            "cat_passable": 0.3,
        },
    },
}


def detect_barriers(
    cell_polygon: Polygon,
    barriers: List[dict],
    roads: List[dict]
) -> dict:
    """
    Detect barriers on each edge of a cell.

    Returns dict with keys "north", "south", "east", "west" containing
    barrier information if present.
    """

    cell_bounds = cell_polygon.bounds  # (minx, miny, maxx, maxy)

    edges = {
        "north": LineString([(cell_bounds[0], cell_bounds[3]), (cell_bounds[2], cell_bounds[3])]),
        "south": LineString([(cell_bounds[0], cell_bounds[1]), (cell_bounds[2], cell_bounds[1])]),
        "east": LineString([(cell_bounds[2], cell_bounds[1]), (cell_bounds[2], cell_bounds[3])]),
        "west": LineString([(cell_bounds[0], cell_bounds[1]), (cell_bounds[0], cell_bounds[3])]),
    }

    cell_barriers = {}

    for direction, edge in edges.items():
        # Check explicit barriers
        for barrier in barriers:
            if edge.intersects(barrier["geometry"]):
                barrier_type = barrier.get("barrier", "fence")
                cell_barriers[direction] = {
                    "type": barrier_type,
                    "properties": BARRIER_PROPERTIES["barrier"].get(barrier_type, {})
                }
                break

        # Check roads as barriers
        if direction not in cell_barriers:
            for road in roads:
                if edge.intersects(road["geometry"]):
                    highway_type = road.get("highway", "residential")
                    if highway_type in ["motorway", "trunk", "primary"]:
                        cell_barriers[direction] = {
                            "type": f"road_{highway_type}",
                            "properties": BARRIER_PROPERTIES["highway"].get(highway_type, {})
                        }
                        break

    return cell_barriers
```

---

## Animal-Environment Interaction

This section connects the behavioral profiles (Parts 2-3) to the environment grid.

### Movement Through Environment

```python
def attempt_movement(
    animal: AnimalState,
    profile: AnimalProfile,
    current_cell: EnvironmentCell,
    target_cell: EnvironmentCell,
    grid: np.ndarray
) -> Tuple[bool, AnimalState]:
    """
    Attempt to move animal from current cell to target cell.

    Integrates with:
    - Terrain speed modifiers (Part 5: SIMULATION PARAMETERS)
    - Barrier crossing (this section)
    - Traffic risk (MORTALITY section)
    - Fear triggers (Part 2/3: species profiles)

    Returns:
        (success: bool, updated_state: AnimalState)
    """

    new_state = animal.copy()

    # Check if target is traversable
    if not target_cell.traversable:
        # Try to deflect along obstacle (uses deflect_along_obstacle from Part 5)
        new_target = deflect_along_obstacle(
            (current_cell.lat, current_cell.lon),
            (target_cell.lat, target_cell.lon),
            target_cell
        )
        if new_target is None:
            return False, animal  # Cannot move
        target_cell = get_cell_at(grid, new_target)

    # Check for barriers between cells
    direction = get_direction(current_cell, target_cell)
    barrier = current_cell.barriers.get(direction)

    if barrier:
        # Determine if animal can cross barrier
        if profile.species == "cat":
            pass_prob = barrier["properties"].get("cat_passable", 0.5)
        else:
            size_key = profile.size_class.lower()
            pass_prob = barrier["properties"].get("dog_passable", {}).get(size_key, 0.5)

        if random.random() > pass_prob:
            # Blocked by barrier - deflect
            return False, animal

        # Check for crossing mortality (highways, rivers)
        mortality = barrier["properties"].get("crossing_mortality", 0.0)
        if random.random() < mortality:
            new_state.status = "deceased"
            new_state.death_cause = f"crossing_{barrier['type']}"
            return True, new_state

    # Apply terrain-based speed modifier
    terrain_params = TERRAIN_TO_PROFILE_PARAMS[target_cell.terrain_type]
    new_state.current_speed *= terrain_params["speed_modifier"]

    # Check for traffic risk (time spent in cell)
    time_in_cell_hours = calculate_traversal_time(current_cell, target_cell, new_state.current_speed)
    traffic_risk = target_cell.traffic_risk_per_hour * time_in_cell_hours

    if random.random() < traffic_risk:
        new_state.status = "deceased"
        new_state.death_cause = "traffic"
        return True, new_state

    # Check for fear triggers based on human activity
    if target_cell.human_activity_level > 0.5:
        if profile.species == "dog":
            # Reference DOG_FEAR_TRIGGERS from Part 7
            trigger_prob = target_cell.human_activity_level * 0.1  # 10% per activity unit
            if random.random() < trigger_prob:
                new_state = apply_dog_fear_trigger(
                    new_state, "human_approach", profile,
                    distance_to_trigger=5.0  # Close encounter
                )
        else:
            # Reference CAT_FEAR_TRIGGERS from Part 7
            trigger_prob = target_cell.human_activity_level * 0.15
            if random.random() < trigger_prob:
                new_state = apply_cat_fear_trigger(
                    new_state, "human_approach", profile,
                    distance_to_trigger=10.0,
                    is_owner=False
                )

    # Move successful
    new_state.position = (target_cell.lat, target_cell.lon)
    new_state.current_cell = (target_cell.grid_x, target_cell.grid_y)

    return True, new_state
```

### Hiding Spot Selection

```python
def find_and_select_hiding_spot(
    animal: AnimalState,
    profile: AnimalProfile,
    current_cell: EnvironmentCell,
    nearby_cells: List[EnvironmentCell]
) -> Optional[HidingSpot]:
    """
    Find appropriate hiding spot based on animal profile and state.

    Cats prioritize concealment quality.
    Dogs prioritize accessibility and size.

    Integrates with:
    - Cat hiding behavior (Part 3: threshold phenomenon)
    - Dog terrain preferences (Part 2)
    """

    all_spots = []

    # Collect spots from current and nearby cells
    for cell in [current_cell] + nearby_cells:
        for spot in cell.hiding_spots:
            all_spots.append((cell, spot))

    if not all_spots:
        return None

    # Score each spot based on animal needs
    scored_spots = []

    for cell, spot in all_spots:
        score = 0.0

        # Size compatibility
        if profile.species == "cat":
            score += 1.0  # Cats fit everywhere
        else:
            size_map = {"toy": 1, "small": 2, "medium": 3, "large": 4, "xl": 5}
            capacity_map = {"cat_only": 0, "small_dog": 2, "medium_dog": 3, "large_dog": 5}

            animal_size = size_map.get(profile.size_class.lower(), 3)
            spot_capacity = capacity_map.get(spot.capacity, 3)

            if animal_size <= spot_capacity:
                score += 1.0
            else:
                continue  # Can't fit, skip this spot

        # Quality preference (higher for more fearful animals)
        fear_weight = animal.fear_level
        score += spot.quality * fear_weight * 2.0

        # Weather protection (more important if injured or bad weather)
        if animal.injury_severity > 0 or cell.current_noise_level > 0.5:
            score += spot.weather_protection * 1.5

        # Accessibility (less important when desperate)
        score += spot.accessibility * (1.0 - animal.fear_level)

        # Distance penalty (prefer closer spots when afraid)
        distance = haversine(
            (animal.position[0], animal.position[1]),
            (cell.lat, cell.lon)
        )
        distance_penalty = min(distance / 50, 1.0)  # Normalize to 50m
        score -= distance_penalty * animal.fear_level

        scored_spots.append((score, cell, spot))

    if not scored_spots:
        return None

    # Select spot (weighted random, not just best)
    # This adds realistic variability
    scored_spots.sort(key=lambda x: x[0], reverse=True)

    # Take top 3, weighted selection
    top_spots = scored_spots[:3]
    weights = [s[0] for s in top_spots]
    total = sum(weights)
    if total == 0:
        return top_spots[0][2]  # Return first if all zero

    weights = [w/total for w in weights]
    selected = random.choices(top_spots, weights=weights, k=1)[0]

    return selected[2]
```

### Water and Food Seeking

```python
def seek_water(
    animal: AnimalState,
    profile: AnimalProfile,
    current_cell: EnvironmentCell,
    grid: np.ndarray,
    search_radius_cells: int = 5
) -> Optional[Tuple[float, float]]:
    """
    Find nearest accessible water source.

    Critical for cat threshold model:
    - Cats finding water extends time before threshold
    - Cats not finding water accelerates threshold

    Integrates with:
    - Thirst mechanics (Part 4: SIMULATION PARAMETERS)
    - Cat threshold (Part 3)
    """

    # Only seek water if thirsty enough
    thirst_threshold = 0.3 if profile.species == "cat" else 0.4
    if animal.thirst_level < thirst_threshold:
        return None

    # Search nearby cells for water
    water_options = []

    cx, cy = animal.current_cell
    for dx in range(-search_radius_cells, search_radius_cells + 1):
        for dy in range(-search_radius_cells, search_radius_cells + 1):
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < grid.shape[0] and 0 <= ny < grid.shape[1]:
                cell = grid[nx, ny]
                for source in cell.water_sources:
                    # Check if source is currently available
                    if random.random() < source.reliability:
                        distance = abs(dx) + abs(dy)  # Manhattan distance in cells
                        water_options.append((distance, source, cell))

    if not water_options:
        return None

    # Sort by distance
    water_options.sort(key=lambda x: x[0])

    # Fearful animals may not travel far for water
    max_distance = int(5 * (1.0 - animal.fear_level * 0.5))  # Fear reduces search range

    for distance, source, cell in water_options:
        if distance <= max_distance:
            return (cell.lat, cell.lon)

    return None


def update_thirst_with_environment(
    animal: AnimalState,
    current_cell: EnvironmentCell,
    hours_elapsed: float
) -> AnimalState:
    """
    Update thirst based on water source availability.

    Implements the opportunistic hydration model for cats:
    cats may find water while hiding, extending threshold time.
    """

    new_state = animal.copy()

    # Check for water in current cell
    water_available = False
    for source in current_cell.water_sources:
        if random.random() < source.reliability * source.accessibility:
            water_available = True
            break

    if water_available:
        # Animal drinks - reset thirst
        new_state.thirst_level = 0.0
        new_state.hours_since_last_water = 0.0

        # For cats, this extends threshold
        if new_state.species == "cat":
            # Opportunistic hydration - threshold clock continues but survival assured
            pass  # Threshold based on hunger, not thirst when water available
    else:
        # Thirst accumulates per Part 4 parameters
        # Cats: critical at 48hrs, Dogs: critical at 72hrs
        thirst_rate = 1.0 / 48 if animal.species == "cat" else 1.0 / 72
        new_state.thirst_level = min(1.0, animal.thirst_level + thirst_rate * hours_elapsed)
        new_state.hours_since_last_water += hours_elapsed

    return new_state
```

### Predator Encounters

```python
# Predator activity by terrain and time
PREDATOR_ACTIVITY = {
    TerrainType.URBAN: {
        "types": ["loose_dog", "raccoon"],
        "peak_hours": [22, 23, 0, 1, 2, 3, 4, 5],  # Night
        "base_encounter_rate": 0.001,
    },
    TerrainType.SUBURBAN: {
        "types": ["coyote", "loose_dog", "raccoon"],
        "peak_hours": [5, 6, 19, 20, 21, 22],  # Dawn/dusk
        "base_encounter_rate": 0.005,
    },
    TerrainType.RURAL: {
        "types": ["coyote", "coyote_pack", "loose_dog"],
        "peak_hours": [5, 6, 19, 20, 21, 22],
        "base_encounter_rate": 0.01,
    },
    TerrainType.WOODED: {
        "types": ["coyote", "coyote_pack", "fox", "fisher"],  # Fisher preys on cats
        "peak_hours": list(range(24)),  # Active all times
        "base_encounter_rate": 0.02,
    },
}


def check_predator_encounter(
    animal: AnimalState,
    profile: AnimalProfile,
    cell: EnvironmentCell,
    current_hour: int
) -> Tuple[bool, Optional[str]]:
    """
    Check for predator encounter and outcome.

    Integrates with:
    - Mortality rates (Part 4)
    - Fear triggers (Part 7)
    - Size-based vulnerability
    """

    predator_config = PREDATOR_ACTIVITY.get(cell.terrain_type)
    if not predator_config:
        return False, None

    # Base encounter rate
    encounter_rate = predator_config["base_encounter_rate"]

    # Increase during peak hours
    if current_hour in predator_config["peak_hours"]:
        encounter_rate *= 2.0

    # Small animals more vulnerable
    if profile.species == "cat":
        encounter_rate *= 1.5
    elif profile.size_class in ["toy", "small"]:
        encounter_rate *= 1.3
    elif profile.size_class in ["large", "xl"]:
        encounter_rate *= 0.7

    # Hiding reduces encounter rate
    if animal.status == "hiding":
        encounter_rate *= 0.2

    if random.random() > encounter_rate:
        return False, None

    # Encounter occurred - determine outcome
    predator_type = random.choice(predator_config["types"])

    # Survival probability based on size and predator
    survival_prob = calculate_predator_survival(profile, predator_type)

    if random.random() < survival_prob:
        # Survived but triggered fear response
        return True, predator_type  # Caller should apply fear trigger
    else:
        # Fatal encounter
        return True, f"killed_by_{predator_type}"


def calculate_predator_survival(profile: AnimalProfile, predator_type: str) -> float:
    """Calculate probability of surviving predator encounter."""

    # Base survival by predator type
    base_survival = {
        "raccoon": 0.95,        # Rarely fatal
        "loose_dog": 0.80,      # Depends on size
        "fox": 0.90,            # Usually flee
        "coyote": 0.60,         # Serious threat to small animals
        "coyote_pack": 0.30,    # Very dangerous
        "fisher": 0.50,         # Cat specialist
    }

    survival = base_survival.get(predator_type, 0.7)

    # Size modifier
    if profile.species == "cat":
        survival *= 0.8  # Cats more vulnerable
    elif profile.size_class in ["large", "xl"]:
        survival *= 1.3  # Large dogs can fight back
        survival = min(survival, 0.95)
    elif profile.size_class in ["toy", "small"]:
        survival *= 0.7

    return survival
```

---

## Environment-Aware Simulation Loop

```python
def simulate_tick(
    animal: AnimalState,
    profile: AnimalProfile,
    grid: np.ndarray,
    environment_config: dict,
    tick_duration_minutes: int = 5
) -> AnimalState:
    """
    Single simulation tick integrating behavior and environment.

    This is the main loop that connects:
    - Behavioral profiles (Parts 2-3)
    - Simulation parameters (Part 4-5)
    - Fear/capture mechanics (Part 7)
    - Environment (Part 10)
    """

    current_cell = grid[animal.current_cell[0], animal.current_cell[1]]
    hours_elapsed = tick_duration_minutes / 60.0

    # 1. Update physiological state
    animal = update_hunger(animal, hours_elapsed)
    animal = update_thirst_with_environment(animal, current_cell, hours_elapsed)
    animal = update_stamina(animal, hours_elapsed)

    # 2. Update fear (species-specific)
    if profile.species == "dog":
        animal = apply_dog_fear_decay(animal, profile, hours_elapsed)
    else:
        animal = check_cat_threshold(animal, profile, hours_elapsed)

    # 3. Update injury if applicable
    if animal.injury_severity > 0:
        animal = update_injury_status(animal, profile, current_cell, hours_elapsed)

    # 4. Check for predator encounter
    current_hour = int(animal.hours_since_escape) % 24
    encounter, result = check_predator_encounter(animal, profile, current_cell, current_hour)
    if encounter:
        if result.startswith("killed_by"):
            animal.status = "deceased"
            animal.death_cause = result
            return animal
        else:
            # Apply fear trigger from predator sighting
            if profile.species == "dog":
                animal = apply_dog_fear_trigger(animal, "predator_encounter", profile, 20.0)
            else:
                animal = apply_cat_fear_trigger(animal, "predator_sighting", profile, 30.0)

    # 5. Determine behavior based on state
    behavior = determine_behavior(animal, profile)

    # 6. Execute behavior
    if behavior == "hiding":
        # Stay in hiding spot
        if animal.current_hiding_spot is None:
            spot = find_and_select_hiding_spot(animal, profile, current_cell,
                                                get_adjacent_cells(grid, animal.current_cell))
            animal.current_hiding_spot = spot
        # Hiding - no movement

    elif behavior == "seeking_water":
        target = seek_water(animal, profile, current_cell, grid)
        if target:
            target_cell = get_cell_at_coords(grid, target)
            success, animal = attempt_movement(animal, profile, current_cell, target_cell, grid)

    elif behavior == "seeking_food":
        target = seek_food(animal, profile, current_cell, grid)
        if target:
            target_cell = get_cell_at_coords(grid, target)
            success, animal = attempt_movement(animal, profile, current_cell, target_cell, grid)

    elif behavior == "fleeing":
        # Move away from fear source
        flee_direction = calculate_flee_direction(animal, current_cell)
        target_cell = get_cell_in_direction(grid, animal.current_cell, flee_direction)
        success, animal = attempt_movement(animal, profile, current_cell, target_cell, grid)

    elif behavior == "traveling":
        # Goal-directed movement (home, territory exploration)
        target = calculate_travel_target(animal, profile, grid)
        if target:
            target_cell = get_cell_at_coords(grid, target)
            success, animal = attempt_movement(animal, profile, current_cell, target_cell, grid)

    elif behavior == "resting":
        # Recover stamina, stay in place
        animal.stamina = min(1.0, animal.stamina + 0.1 * hours_elapsed)

    # 7. Update time
    animal.hours_since_escape += hours_elapsed

    return animal
```

---

## Usage Example

```python
# Complete workflow: Profile → Environment → Simulation

# 1. Create animal profile (from Parts 2-3)
cat_profile = AnimalProfile(
    species="cat",
    temperament="CAU",  # Cautious
    size_class="medium",
    age_class="ADT",
    indoor_outdoor="IO",  # Indoor-only
    background="F",       # Family pet
    health_status="HLT",
    escape_type="W1",     # Door dash
    escape_location=(37.7749, -122.4194),  # San Francisco coordinates
    home_location=(37.7749, -122.4194),
    territory="HOME",
)

# 2. Build environment from OSM
osm_data = fetch_osm_data(
    center_lat=cat_profile.escape_location[0],
    center_lon=cat_profile.escape_location[1],
    radius_m=500  # 500m for indoor cat
)

grid = create_environment_grid(
    osm_data=osm_data,
    center_lat=cat_profile.escape_location[0],
    center_lon=cat_profile.escape_location[1],
    radius_m=500,
    cell_size_m=10
)

# 3. Initialize animal state
cat_state = initialize_animal_state(cat_profile, grid)

# 4. Run simulation
MAX_HOURS = 720  # 30 days
TICK_MINUTES = 5

while cat_state.hours_since_escape < MAX_HOURS:
    cat_state = simulate_tick(cat_state, cat_profile, grid, {}, TICK_MINUTES)

    if cat_state.status in ["recovered", "deceased"]:
        break

# 5. Analyze outcome
print(f"Outcome: {cat_state.status}")
print(f"Final position: {cat_state.position}")
print(f"Distance from home: {haversine(cat_state.position, cat_profile.home_location)}m")
print(f"Time elapsed: {cat_state.hours_since_escape} hours")
```

---

# PART 11: SEARCHER AGENTS

## Design Philosophy

**Critical Design Decision**: Searchers are modeled as discrete agents, NOT percentages.

The previous model's "volunteer ramp-up percentage" approach is fundamentally flawed:
- If you have 2 searchers and "20% volunteer ramp-up", what does that mean?
- Percentages don't connect to actual search behavior
- Can't model individual searcher effectiveness, areas covered, or methods used

**Correct Approach**: Each searcher is an individual agent with:
- Specific properties (knowledge, equipment, time availability)
- Specific behaviors (search patterns, methods used)
- Specific effectiveness (detection probability based on circumstances)

Adding a volunteer means adding a new agent with defined properties, not incrementing a percentage.

---

## Searcher Data Structures

```python
from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict
from enum import Enum
from datetime import datetime, time

class SearcherType(Enum):
    """Types of searchers with inherently different capabilities."""
    OWNER = "owner"              # Pet owner - highest motivation, knows pet best
    HOUSEHOLD = "household"      # Family members - high motivation, knows pet
    FRIEND = "friend"            # Friends/neighbors - medium motivation, may know pet
    VOLUNTEER = "volunteer"      # Community volunteer - variable dedication
    PROFESSIONAL = "professional" # Professional pet detective/tracker
    SHELTER_STAFF = "shelter"    # Shelter workers checking intake
    ACO = "aco"                  # Animal Control Officer

class SearchMethod(Enum):
    """Active search methods a searcher can employ."""
    WALKING_CALLING = "walking_calling"     # Walking while calling pet's name
    WALKING_SILENT = "walking_silent"       # Walking, visual search only
    DRIVING_SLOW = "driving_slow"           # Slow driving, visual scan
    STATIONARY_CALLING = "stationary"       # Staying in one spot, calling
    TRAP_MONITORING = "trap_monitoring"     # Checking/monitoring traps
    TRAIL_CAMERA = "trail_camera"           # Monitoring trail cameras
    SCENT_TRACKING = "scent_tracking"       # Using tracking dog (professional)
    DRONE = "drone"                         # Aerial drone search (professional)
    THERMAL = "thermal"                     # Thermal imaging (professional)
    FEEDING_STATION = "feeding_station"     # Monitoring feeding station

class PassiveMethod(Enum):
    """Passive search methods that work without active searching."""
    FLYERS = "flyers"                       # Posted flyers in area
    ONLINE_POSTING = "online"               # Social media, lost pet sites
    SHELTER_ALERT = "shelter_alert"         # Alerts to local shelters
    NEIGHBOR_NETWORK = "neighbor_network"   # Neighbors watching
    MICROCHIP_REGISTERED = "microchip"      # Microchip in database

@dataclass
class SearcherProfile:
    """
    Individual searcher agent with all properties affecting search effectiveness.

    Each searcher is a discrete entity - adding searchers means adding
    new SearcherProfile instances, NOT incrementing percentages.
    """
    searcher_id: str
    searcher_type: SearcherType

    # Knowledge of the pet (affects calling effectiveness, recognition)
    knows_pet_name: bool = False
    knows_pet_appearance: bool = True  # Everyone has at least a photo
    knows_pet_habits: bool = False     # Knows favorite spots, behaviors
    knows_pet_sounds: bool = False     # Can recognize pet's specific meow/bark
    familiarity_score: float = 0.5     # 0-1, how well they know the pet [C]

    # Relationship to pet (affects pet's response)
    pet_recognizes_searcher: bool = False  # Pet knows this person
    pet_trust_level: float = 0.0           # 0-1, how much pet trusts searcher [C]

    # Search capabilities
    physical_fitness: str = "average"      # poor/average/good/excellent
    has_vehicle: bool = False
    has_flashlight: bool = True
    has_treats: bool = False
    has_carrier: bool = False              # Can safely capture if found
    has_trap: bool = False
    has_leash: bool = False

    # Professional equipment (SearcherType.PROFESSIONAL only)
    has_tracking_dog: bool = False
    has_thermal_camera: bool = False
    has_drone: bool = False
    years_experience: int = 0

    # Time availability
    available_hours_per_day: float = 2.0   # Hours they can search daily
    available_days: List[int] = field(default_factory=lambda: [0,1,2,3,4,5,6])  # 0=Mon
    earliest_search_time: time = field(default_factory=lambda: time(6, 0))
    latest_search_time: time = field(default_factory=lambda: time(22, 0))

    # Persistence and dedication
    dedication_level: float = 0.5          # 0-1, affects consistency [C]
    burnout_rate: float = 0.1              # How quickly dedication decreases [C]

    # Current state
    is_active: bool = True
    days_searching: int = 0
    total_hours_searched: float = 0.0
    current_dedication: float = 0.5        # Tracks burnout over time

@dataclass
class SearcherState:
    """
    Runtime state for a searcher during simulation.
    """
    searcher_id: str
    position: Tuple[float, float]          # Current (lat, lon)
    current_method: SearchMethod = SearchMethod.WALKING_CALLING
    hours_searched_today: float = 0.0
    is_currently_searching: bool = False
    areas_covered_today: List[str] = field(default_factory=list)  # Grid cell IDs
    last_search_time: Optional[datetime] = None
```

---

## Searcher Type Defaults [P][C]

```python
SEARCHER_TYPE_DEFAULTS = {
    SearcherType.OWNER: {
        "knows_pet_name": True,
        "knows_pet_appearance": True,
        "knows_pet_habits": True,
        "knows_pet_sounds": True,
        "familiarity_score": 1.0,
        "pet_recognizes_searcher": True,
        "pet_trust_level": 0.95,        # [P] Owner trust based on behavioral studies
        "has_treats": True,
        "has_carrier": True,
        "has_leash": True,
        "available_hours_per_day": 4.0, # [C] Estimated, varies widely
        "dedication_level": 0.95,
        "burnout_rate": 0.02,           # [C] Owners persist longer
    },

    SearcherType.HOUSEHOLD: {
        "knows_pet_name": True,
        "knows_pet_appearance": True,
        "knows_pet_habits": True,
        "knows_pet_sounds": True,
        "familiarity_score": 0.9,
        "pet_recognizes_searcher": True,
        "pet_trust_level": 0.85,
        "has_treats": True,
        "has_carrier": True,
        "has_leash": True,
        "available_hours_per_day": 3.0,
        "dedication_level": 0.85,
        "burnout_rate": 0.03,
    },

    SearcherType.FRIEND: {
        "knows_pet_name": True,
        "knows_pet_appearance": True,
        "knows_pet_habits": False,
        "knows_pet_sounds": False,
        "familiarity_score": 0.5,
        "pet_recognizes_searcher": False,  # May or may not
        "pet_trust_level": 0.3,
        "has_treats": False,
        "has_carrier": False,
        "has_leash": False,
        "available_hours_per_day": 1.5,
        "dedication_level": 0.6,
        "burnout_rate": 0.08,
    },

    SearcherType.VOLUNTEER: {
        "knows_pet_name": True,           # Given name
        "knows_pet_appearance": True,     # Given photo
        "knows_pet_habits": False,
        "knows_pet_sounds": False,
        "familiarity_score": 0.2,
        "pet_recognizes_searcher": False,
        "pet_trust_level": 0.0,           # Stranger to pet
        "has_treats": False,
        "has_carrier": False,
        "has_leash": False,
        "available_hours_per_day": 1.0,
        "dedication_level": 0.4,
        "burnout_rate": 0.15,             # [C] Volunteers drop off quickly
    },

    SearcherType.PROFESSIONAL: {
        "knows_pet_name": True,
        "knows_pet_appearance": True,
        "knows_pet_habits": True,         # Interviews owner extensively
        "knows_pet_sounds": False,
        "familiarity_score": 0.6,
        "pet_recognizes_searcher": False,
        "pet_trust_level": 0.0,
        "has_treats": True,
        "has_carrier": True,
        "has_leash": True,
        "has_vehicle": True,
        "has_flashlight": True,
        "physical_fitness": "good",
        "available_hours_per_day": 8.0,   # Full-time when hired
        "dedication_level": 0.9,          # Professional commitment
        "burnout_rate": 0.01,
    },

    SearcherType.SHELTER_STAFF: {
        "knows_pet_name": True,
        "knows_pet_appearance": True,
        "knows_pet_habits": False,
        "knows_pet_sounds": False,
        "familiarity_score": 0.3,
        "pet_recognizes_searcher": False,
        "pet_trust_level": 0.0,
        "available_hours_per_day": 0.5,   # Only checking intake
        "dedication_level": 0.3,
        "burnout_rate": 0.0,              # Part of job, not personal
    },

    SearcherType.ACO: {
        "knows_pet_name": False,          # Responding to reports
        "knows_pet_appearance": True,     # Given description
        "knows_pet_habits": False,
        "knows_pet_sounds": False,
        "familiarity_score": 0.2,
        "pet_recognizes_searcher": False,
        "pet_trust_level": 0.0,
        "has_carrier": True,
        "has_leash": True,
        "has_vehicle": True,
        "has_trap": True,
        "available_hours_per_day": 1.0,   # Limited time per case
        "dedication_level": 0.3,
        "burnout_rate": 0.0,
    },
}
```

---

## Search Method Effectiveness [P][C][A]

Each search method has different effectiveness based on animal state.

```python
# Base detection probability per hour by method
# Assumes searcher is in correct grid cell and animal is present
# Modified by animal visibility state, terrain, etc.

SEARCH_METHOD_BASE_EFFECTIVENESS = {
    # Method: {
    #     "visible_detection": P(detect) if animal visible, per hour in same cell
    #     "hidden_detection": P(detect) if animal hiding, per hour in same cell
    #     "area_coverage_rate": grid cells per hour
    #     "noise_level": 0-1, affects animal flight response
    #     "requires": list of required equipment/conditions
    # }

    SearchMethod.WALKING_CALLING: {
        "visible_detection": 0.70,     # [A] Good for visible animals
        "hidden_detection": 0.15,      # [C] Calling may coax out
        "area_coverage_rate": 6,       # [A] ~6 cells/hour walking pace
        "noise_level": 0.6,            # Calling creates noise
        "requires": [],
        "effectiveness_factors": {
            "knows_pet_name": 1.3,     # +30% if knows name
            "knows_pet_sounds": 1.2,   # +20% if can recognize response
            "pet_trust_level_weight": 0.5,  # Trust affects response to calling
        },
    },

    SearchMethod.WALKING_SILENT: {
        "visible_detection": 0.60,
        "hidden_detection": 0.05,      # Very hard to find hidden animals silently
        "area_coverage_rate": 8,       # Can move faster without calling
        "noise_level": 0.2,
        "requires": [],
        "effectiveness_factors": {
            "physical_fitness_good": 1.1,
            "physical_fitness_excellent": 1.2,
        },
    },

    SearchMethod.DRIVING_SLOW: {
        "visible_detection": 0.40,     # [A] Harder from vehicle
        "hidden_detection": 0.02,      # Almost impossible
        "area_coverage_rate": 30,      # [A] Much more area
        "noise_level": 0.7,            # Vehicle noise
        "requires": ["has_vehicle"],
        "effectiveness_factors": {},
    },

    SearchMethod.STATIONARY_CALLING: {
        "visible_detection": 0.30,     # Limited visual range
        "hidden_detection": 0.25,      # [C] Better for coaxing hiding animals
        "area_coverage_rate": 1,       # Single cell
        "noise_level": 0.5,
        "requires": [],
        "effectiveness_factors": {
            "knows_pet_name": 1.5,
            "knows_pet_sounds": 1.4,
            "pet_trust_level_weight": 0.8,  # High trust impact
            "has_treats": 1.3,
        },
    },

    SearchMethod.TRAP_MONITORING: {
        "visible_detection": 0.10,     # Not actively looking
        "hidden_detection": 0.0,       # Trap does the work
        "area_coverage_rate": 1,
        "noise_level": 0.1,
        "requires": ["has_trap"],
        "effectiveness_factors": {},
        "special": "trap_check",       # See trap mechanics in PART 6
    },

    SearchMethod.TRAIL_CAMERA: {
        "visible_detection": 0.0,      # Camera does detection
        "hidden_detection": 0.0,
        "area_coverage_rate": 1,
        "noise_level": 0.0,
        "requires": ["trail_camera"],
        "effectiveness_factors": {},
        "special": "trail_camera",     # Passive monitoring
    },

    SearchMethod.SCENT_TRACKING: {
        "visible_detection": 0.85,     # [P] Professional tracking dogs effective
        "hidden_detection": 0.60,      # [P] Can find hidden animals
        "area_coverage_rate": 4,       # Slower, following scent
        "noise_level": 0.4,
        "requires": ["has_tracking_dog"],
        "effectiveness_factors": {
            "years_experience": 0.05,  # +5% per year experience
        },
        "notes": "Effectiveness degrades with time since escape and rain",
    },

    SearchMethod.DRONE: {
        "visible_detection": 0.75,     # [A] Good aerial coverage
        "hidden_detection": 0.10,      # Can sometimes spot in vegetation
        "area_coverage_rate": 50,      # Very fast coverage
        "noise_level": 0.8,            # Drone noise may scare animal
        "requires": ["has_drone"],
        "effectiveness_factors": {},
        "notes": "Best in open areas, limited in dense urban/forest",
    },

    SearchMethod.THERMAL: {
        "visible_detection": 0.90,     # [A] Excellent at night
        "hidden_detection": 0.70,      # [A] Can see through vegetation
        "area_coverage_rate": 3,
        "noise_level": 0.2,
        "requires": ["has_thermal_camera"],
        "effectiveness_factors": {},
        "notes": "Most effective at night, in cooler weather",
    },

    SearchMethod.FEEDING_STATION: {
        "visible_detection": 0.20,     # When checking
        "hidden_detection": 0.0,
        "area_coverage_rate": 1,
        "noise_level": 0.1,
        "requires": [],
        "effectiveness_factors": {},
        "special": "feeding_station",  # Works over time
    },
}
```

---

## Passive Method Effectiveness [P][C][A]

Passive methods work continuously without active searching.

```python
PASSIVE_METHOD_EFFECTIVENESS = {
    # Method: {
    #     "daily_sighting_probability": P(someone reports sighting) per day
    #     "report_accuracy": P(report is actually the pet)
    #     "response_delay_hours": time from sighting to searcher arrival
    #     "coverage_radius_m": area covered by method
    #     "setup_time_hours": time to implement
    #     "decay_rate": daily decay in effectiveness
    # }

    PassiveMethod.FLYERS: {
        "daily_sighting_probability": 0.03,  # [C] 3% chance/day someone sees & reports
        "report_accuracy": 0.15,             # [C] Many false reports
        "response_delay_hours": 4.0,         # [C] Time to respond to call
        "coverage_radius_m": 500,            # [C] Typical flyering radius
        "setup_time_hours": 3.0,
        "decay_rate": 0.05,                  # [C] Flyers degrade, get removed
        "effectiveness_factors": {
            "flyer_count": 0.002,            # +0.2% per 100 flyers
            "flyer_quality": 1.0,            # Color photo, clear description
            "urban_bonus": 1.5,              # More effective in urban areas
        },
    },

    PassiveMethod.ONLINE_POSTING: {
        "daily_sighting_probability": 0.05,  # [C] More reach than flyers
        "report_accuracy": 0.10,             # [C] Even more false positives
        "response_delay_hours": 2.0,         # [C] Faster notification
        "coverage_radius_m": 2000,           # [C] Wider online reach
        "setup_time_hours": 1.0,
        "decay_rate": 0.10,                  # [C] Posts get buried
        "effectiveness_factors": {
            "platform_count": 0.01,          # +1% per platform used
            "share_count": 0.001,            # +0.1% per share
        },
    },

    PassiveMethod.SHELTER_ALERT: {
        "daily_sighting_probability": 0.02,  # [P] If pet enters shelter
        "report_accuracy": 0.80,             # [P] Shelter ID is reliable
        "response_delay_hours": 12.0,        # [C] Daily checks
        "coverage_radius_m": 10000,          # All shelters in county
        "setup_time_hours": 0.5,
        "decay_rate": 0.0,                   # Stays active
        "notes": "Only triggers if pet is captured and taken to shelter",
    },

    PassiveMethod.NEIGHBOR_NETWORK: {
        "daily_sighting_probability": 0.08,  # [C] Higher if pet in area
        "report_accuracy": 0.40,             # [C] Neighbors may recognize
        "response_delay_hours": 1.0,         # [C] Quick notification
        "coverage_radius_m": 200,            # [C] Immediate neighborhood
        "setup_time_hours": 2.0,
        "decay_rate": 0.08,                  # [C] Attention fades
        "effectiveness_factors": {
            "neighbor_count": 0.005,         # +0.5% per neighbor contacted
        },
    },

    PassiveMethod.MICROCHIP_REGISTERED: {
        "daily_sighting_probability": 0.01,  # [P] Requires vet/shelter scan
        "report_accuracy": 1.00,             # [P] Definitive ID
        "response_delay_hours": 24.0,        # [C] May take time to contact
        "coverage_radius_m": 50000,          # Any vet/shelter
        "setup_time_hours": 0.0,             # Already done
        "decay_rate": 0.0,
        "notes": "Only triggers if pet is scanned at vet/shelter",
    },
}
```

---

## Animal Response to Searchers [P][C]

How the animal responds depends on who's searching and the animal's state.

```python
def calculate_animal_response_to_searcher(
    animal_state: "AnimalState",
    animal_profile: "AnimalProfile",
    searcher_profile: SearcherProfile,
    search_method: SearchMethod,
    distance_m: float,
) -> dict:
    """
    Calculate how animal responds to searcher presence.

    Returns:
        dict with probabilities for different responses
    """

    # Base response based on animal fear state
    current_fear = animal_state.fear_level  # 0-1

    # Species-specific baseline responses
    if animal_profile.species == "dog":
        base_responses = {
            "approach": 0.30,      # Come to searcher
            "stay": 0.30,          # Stay put
            "flee": 0.20,          # Run away
            "hide": 0.20,          # Hide
        }
    else:  # cat
        base_responses = {
            "approach": 0.10,      # Cats less likely to approach
            "stay": 0.20,
            "flee": 0.25,
            "hide": 0.45,          # Cats prefer hiding
        }

    # Modify by fear level (high fear = more flee/hide)
    fear_modifier = {
        "approach": 1 - (current_fear * 0.8),  # Fear reduces approach
        "stay": 1 - (current_fear * 0.5),
        "flee": 1 + (current_fear * 1.5),      # Fear increases flight
        "hide": 1 + (current_fear * 1.0),
    }

    # Modify by trust in searcher
    trust = searcher_profile.pet_trust_level
    if searcher_profile.pet_recognizes_searcher:
        trust_modifier = {
            "approach": 1 + (trust * 2.0),     # Trust greatly increases approach
            "stay": 1 + (trust * 0.5),
            "flee": 1 - (trust * 0.8),         # Trust reduces flight
            "hide": 1 - (trust * 0.6),
        }
    else:
        trust_modifier = {"approach": 1, "stay": 1, "flee": 1, "hide": 1}

    # Modify by search method noise
    method_info = SEARCH_METHOD_BASE_EFFECTIVENESS.get(search_method, {})
    noise_level = method_info.get("noise_level", 0.5)
    noise_modifier = {
        "approach": 1 - (noise_level * 0.3),
        "stay": 1 - (noise_level * 0.2),
        "flee": 1 + (noise_level * 0.5),
        "hide": 1 + (noise_level * 0.3),
    }

    # Modify by distance (closer = more likely to flee if scared)
    distance_factor = max(0.1, min(1.0, distance_m / 50))  # Normalize to 50m
    distance_modifier = {
        "approach": 1,  # Distance doesn't affect approach decision
        "stay": distance_factor,  # More likely to stay if far
        "flee": 1 / distance_factor,  # More likely to flee if close
        "hide": 1 / (distance_factor ** 0.5),
    }

    # Modify by temperament
    temperament = animal_profile.temperament
    temperament_modifiers = get_temperament_modifiers(temperament, animal_profile.species)

    # Combine all modifiers
    final_responses = {}
    for response in base_responses:
        prob = base_responses[response]
        prob *= fear_modifier.get(response, 1)
        prob *= trust_modifier.get(response, 1)
        prob *= noise_modifier.get(response, 1)
        prob *= distance_modifier.get(response, 1)
        prob *= temperament_modifiers.get(response, 1)
        final_responses[response] = prob

    # Normalize to sum to 1
    total = sum(final_responses.values())
    final_responses = {k: v/total for k, v in final_responses.items()}

    return final_responses


def get_temperament_modifiers(temperament: str, species: str) -> dict:
    """Get response modifiers based on temperament."""

    if species == "dog":
        # Dog codes: G=Gregarious, C=Confident, A=Aloof, X=Xenophobic, B=Bonded
        modifiers = {
            "G": {"approach": 1.8, "stay": 1.2, "flee": 0.5, "hide": 0.6},   # Gregarious
            "C": {"approach": 0.8, "stay": 1.0, "flee": 1.0, "hide": 1.2},   # Confident
            "A": {"approach": 0.3, "stay": 0.6, "flee": 1.8, "hide": 1.5},   # Aloof
            "X": {"approach": 0.2, "stay": 0.4, "flee": 2.0, "hide": 1.8},   # Xenophobic
            "B": {"approach": 1.5, "stay": 1.3, "flee": 0.6, "hide": 0.7},   # Bonded
        }
    else:  # cat
        # Cat codes: CUR=Curious, CL=Care-less, CAU=Cautious, X=Xenophobic, B=Bonded
        modifiers = {
            "CUR": {"approach": 1.6, "stay": 1.3, "flee": 0.6, "hide": 0.7},  # Curious/Clown
            "CL": {"approach": 0.7, "stay": 0.9, "flee": 1.0, "hide": 1.1},   # Care-less
            "CAU": {"approach": 0.5, "stay": 0.8, "flee": 1.3, "hide": 1.5},  # Cautious
            "X": {"approach": 0.1, "stay": 0.3, "flee": 1.8, "hide": 2.0},    # Xenophobic
            "B": {"approach": 1.4, "stay": 1.2, "flee": 0.7, "hide": 0.8},    # Bonded
        }

    return modifiers.get(temperament, {"approach": 1, "stay": 1, "flee": 1, "hide": 1})
```

---

## Owner Effect on Fear Decay [P]

Owner presence affects fear differently than stranger presence.

```python
def calculate_owner_proximity_effect(
    animal_state: "AnimalState",
    animal_profile: "AnimalProfile",
    searcher_profile: SearcherProfile,
    distance_m: float,
    duration_minutes: float,
) -> dict:
    """
    Calculate effect of owner/trusted person proximity on animal fear.

    Research basis: Familiar human presence reduces cortisol in dogs [P]
    Cats show reduced stress behaviors with familiar humans [P]
    """

    # Only applies if pet recognizes and trusts searcher
    if not searcher_profile.pet_recognizes_searcher:
        return {"fear_reduction": 0.0, "comfort_increase": 0.0}

    trust = searcher_profile.pet_trust_level

    # Distance effect (must be close enough to sense owner)
    if distance_m > 100:
        return {"fear_reduction": 0.0, "comfort_increase": 0.0}

    distance_factor = max(0, 1 - (distance_m / 100))  # 1 at 0m, 0 at 100m

    # Base fear reduction per minute of proximity
    # [P] Based on cortisol reduction studies in sheltered dogs
    base_fear_reduction_per_min = 0.002  # 0.2% per minute

    # Modify by trust level
    fear_reduction = base_fear_reduction_per_min * trust * distance_factor * duration_minutes

    # Species modifier (dogs respond more to owner presence)
    if animal_profile.species == "dog":
        fear_reduction *= 1.5
    else:
        fear_reduction *= 0.8  # Cats less affected by proximity alone

    # Cap at reasonable maximum (can't reduce fear too quickly)
    fear_reduction = min(fear_reduction, 0.15)  # Max 15% reduction per encounter

    # Comfort increase (affects likelihood of approach on next encounter)
    comfort_increase = fear_reduction * 0.5

    return {
        "fear_reduction": fear_reduction,
        "comfort_increase": comfort_increase,
    }
```

---

## Detection Probability Calculation [A][C]

Master function for calculating if a searcher detects the animal.

```python
def calculate_detection_probability(
    searcher_state: SearcherState,
    searcher_profile: SearcherProfile,
    animal_state: "AnimalState",
    animal_profile: "AnimalProfile",
    environment_cell: "EnvironmentCell",
    time_in_cell_minutes: float,
) -> float:
    """
    Calculate probability of searcher detecting animal.

    Args:
        searcher_state: Current searcher runtime state
        searcher_profile: Searcher's profile/capabilities
        animal_state: Current animal state
        animal_profile: Animal's profile
        environment_cell: The cell where both are located
        time_in_cell_minutes: How long searcher has been searching this cell

    Returns:
        Probability of detection (0-1)
    """

    method = searcher_state.current_method
    method_info = SEARCH_METHOD_BASE_EFFECTIVENESS.get(method, {})

    # Base detection rate depends on animal visibility
    if animal_state.is_hiding:
        base_detection = method_info.get("hidden_detection", 0.05)
    else:
        base_detection = method_info.get("visible_detection", 0.5)

    # Convert hourly rate to per-minute probability
    # P(detect in t minutes) = 1 - (1 - hourly_rate)^(t/60)
    time_factor = time_in_cell_minutes / 60.0
    detection_prob = 1 - ((1 - base_detection) ** time_factor)

    # === Apply modifiers ===

    # 1. Knowledge modifiers
    effectiveness_factors = method_info.get("effectiveness_factors", {})

    if effectiveness_factors.get("knows_pet_name") and searcher_profile.knows_pet_name:
        detection_prob *= effectiveness_factors["knows_pet_name"]

    if effectiveness_factors.get("knows_pet_sounds") and searcher_profile.knows_pet_sounds:
        detection_prob *= effectiveness_factors["knows_pet_sounds"]

    if effectiveness_factors.get("has_treats") and searcher_profile.has_treats:
        detection_prob *= effectiveness_factors["has_treats"]

    # 2. Trust modifier for methods that involve calling
    if method in [SearchMethod.WALKING_CALLING, SearchMethod.STATIONARY_CALLING]:
        trust_weight = effectiveness_factors.get("pet_trust_level_weight", 0)
        trust_bonus = 1 + (searcher_profile.pet_trust_level * trust_weight)
        detection_prob *= trust_bonus

    # 3. Professional experience modifier
    if searcher_profile.searcher_type == SearcherType.PROFESSIONAL:
        exp_bonus = effectiveness_factors.get("years_experience", 0) * searcher_profile.years_experience
        detection_prob *= (1 + min(exp_bonus, 0.5))  # Cap at +50%

    # 4. Environmental modifiers
    terrain = environment_cell.terrain_type
    terrain_modifiers = {
        TerrainType.URBAN: 0.9,         # Lots of visual clutter
        TerrainType.SUBURBAN: 1.0,
        TerrainType.PARK: 1.1,          # Open, easier to spot
        TerrainType.FOREST: 0.6,        # Dense, hard to see
        TerrainType.DEEP_FOREST: 0.4,
        TerrainType.WETLAND: 0.7,
        TerrainType.AGRICULTURAL: 1.2,  # Very open
        TerrainType.INDUSTRIAL: 0.8,
        TerrainType.WATER: 0.5,
    }
    detection_prob *= terrain_modifiers.get(terrain, 1.0)

    # 5. Hiding spot density modifier
    if animal_state.is_hiding:
        hiding_density = len(environment_cell.hiding_spots)
        # More hiding spots = harder to check them all
        hiding_modifier = max(0.3, 1 - (hiding_density * 0.05))
        detection_prob *= hiding_modifier

    # 6. Time of day modifier
    hour = animal_state.time_of_day  # 0-23
    if 6 <= hour <= 18:  # Daylight
        time_modifier = 1.0
    elif 18 < hour <= 20 or 5 <= hour < 6:  # Dusk/dawn
        time_modifier = 0.7
    else:  # Night
        if searcher_profile.has_flashlight:
            time_modifier = 0.5
        elif method == SearchMethod.THERMAL:
            time_modifier = 1.3  # Thermal better at night
        else:
            time_modifier = 0.2
    detection_prob *= time_modifier

    # 7. Weather modifier (if tracked)
    # Heavy rain: 0.5, light rain: 0.8, fog: 0.6

    # 8. Searcher fatigue modifier
    hours_today = searcher_state.hours_searched_today
    fatigue_modifier = max(0.6, 1 - (hours_today * 0.05))  # -5% per hour, min 60%
    detection_prob *= fatigue_modifier

    # 9. Dedication/attention modifier
    detection_prob *= (0.5 + searcher_profile.current_dedication * 0.5)

    # Cap probability
    detection_prob = min(0.95, max(0.001, detection_prob))

    return detection_prob
```

---

## Capture Success After Detection [P][C]

Detection doesn't mean capture. Animal may flee.

```python
def calculate_capture_probability(
    searcher_profile: SearcherProfile,
    animal_state: "AnimalState",
    animal_profile: "AnimalProfile",
    animal_response: str,  # Result from calculate_animal_response_to_searcher
    distance_m: float,
) -> float:
    """
    Calculate probability of successful capture after detection.

    Detection → Animal Response → Capture Attempt → Success/Failure
    """

    # If animal is approaching, capture is likely
    if animal_response == "approach":
        base_capture = 0.90
        # Modify by equipment
        if searcher_profile.has_carrier or searcher_profile.has_leash:
            base_capture = 0.95
        return base_capture

    # If animal stays put, capture depends on approach
    if animal_response == "stay":
        base_capture = 0.60
        # Can they approach without spooking?
        if searcher_profile.pet_trust_level > 0.5:
            base_capture = 0.75
        if searcher_profile.has_treats:
            base_capture += 0.10
        if searcher_profile.has_carrier:
            base_capture += 0.05
        return min(0.90, base_capture)

    # If animal flees, capture is unlikely
    if animal_response == "flee":
        base_capture = 0.05  # Very hard to catch fleeing animal
        # Professional with tracking dog might pursue
        if searcher_profile.has_tracking_dog:
            base_capture = 0.30
        # Good physical fitness helps slightly
        if searcher_profile.physical_fitness in ["good", "excellent"]:
            base_capture += 0.05
        return base_capture

    # If animal hides, need to coax out or extract
    if animal_response == "hide":
        base_capture = 0.20
        if searcher_profile.has_treats:
            base_capture += 0.15
        if searcher_profile.pet_trust_level > 0.5:
            base_capture += 0.20
        if searcher_profile.knows_pet_name:
            base_capture += 0.10
        # If animal is in inaccessible spot
        if animal_state.hiding_spot_quality > 0.8:
            base_capture *= 0.5  # Halve chances for excellent hiding spots
        return min(0.70, base_capture)

    return 0.10  # Default low probability


def process_capture_attempt(
    searcher_profile: SearcherProfile,
    animal_state: "AnimalState",
    animal_profile: "AnimalProfile",
    capture_successful: bool,
) -> "AnimalState":
    """
    Process the outcome of a capture attempt.

    Failed capture has consequences (see PART 6 for details).
    """

    if capture_successful:
        animal_state.status = "recovered"
        animal_state.recovery_method = "active_search"
        animal_state.recovered_by = searcher_profile.searcher_id
        return animal_state

    # Failed capture - animal becomes more wary
    # Reference: PART 6 FAILED_CAPTURE_CONSEQUENCE

    # Increase fear
    fear_increase = 0.15  # Base fear increase from failed capture

    # Stranger attempts are more traumatic
    if not searcher_profile.pet_recognizes_searcher:
        fear_increase *= 1.5

    # Aggressive capture attempts (chasing) are worse
    # This would be tracked in the capture attempt details

    animal_state.fear_level = min(1.0, animal_state.fear_level + fear_increase)

    # Increase wariness of humans
    animal_state.human_wariness = min(1.0,
        animal_state.human_wariness + 0.20)

    # Log for simulation tracking
    animal_state.failed_capture_count += 1
    animal_state.last_failed_capture_time = animal_state.hours_since_escape

    return animal_state
```

---

## Searcher Behavior Simulation [A][C]

How searchers decide where to search and what methods to use.

```python
def simulate_searcher_behavior(
    searcher_state: SearcherState,
    searcher_profile: SearcherProfile,
    animal_profile: "AnimalProfile",
    grid: Dict[str, "EnvironmentCell"],
    known_sightings: List[dict],
    hours_since_escape: float,
) -> SearcherState:
    """
    Simulate searcher's search pattern and method selection.

    Searchers don't have perfect knowledge - they search based on:
    1. Pet's likely behavior (from profile)
    2. Any sighting reports
    3. Terrain accessibility
    4. Time available
    """

    # Determine search area priority
    priority_areas = calculate_search_priorities(
        searcher_profile=searcher_profile,
        animal_profile=animal_profile,
        grid=grid,
        known_sightings=known_sightings,
        hours_since_escape=hours_since_escape,
    )

    # Select search method based on terrain and capabilities
    searcher_state.current_method = select_search_method(
        searcher_profile=searcher_profile,
        target_terrain=priority_areas[0]["terrain"] if priority_areas else None,
        time_of_day=searcher_state.current_time.hour,
    )

    # Move to highest priority uncovered area
    for area in priority_areas:
        if area["cell_id"] not in searcher_state.areas_covered_today:
            searcher_state.position = area["position"]
            break

    return searcher_state


def calculate_search_priorities(
    searcher_profile: SearcherProfile,
    animal_profile: "AnimalProfile",
    grid: Dict[str, "EnvironmentCell"],
    known_sightings: List[dict],
    hours_since_escape: float,
) -> List[dict]:
    """
    Calculate which areas to search first.

    Uses knowledge of pet behavior to prioritize likely locations.
    """

    priorities = []

    for cell_id, cell in grid.items():
        priority_score = 0.5  # Base priority

        # 1. Recent sightings strongly increase priority
        for sighting in known_sightings:
            if sighting["cell_id"] == cell_id:
                hours_since_sighting = hours_since_escape - sighting["time"]
                sighting_weight = max(0.1, 1 - (hours_since_sighting / 24))
                priority_score += sighting_weight * 2.0

        # 2. Distance from home affects priority
        home_distance = calculate_distance(cell.position, animal_profile.home_location)

        if animal_profile.species == "dog":
            # Dogs may travel far, but check nearby first
            if home_distance < 200:
                priority_score += 0.3
            elif home_distance < 500:
                priority_score += 0.2
        else:  # cat
            # Cats usually stay close
            if home_distance < 50:
                priority_score += 0.5
            elif home_distance < 150:
                priority_score += 0.3
            elif home_distance > 300:
                priority_score -= 0.3  # Less likely to be far

        # 3. Terrain affects priority based on species
        terrain_priority = get_terrain_search_priority(
            cell.terrain_type,
            animal_profile.species,
            animal_profile.temperament,
        )
        priority_score += terrain_priority

        # 4. Owner knowledge affects priority
        if searcher_profile.knows_pet_habits:
            # Owner knows favorite spots - handled separately
            pass

        # 5. Accessibility affects priority (can searcher get there?)
        if not cell.traversable:
            priority_score = 0

        priorities.append({
            "cell_id": cell_id,
            "position": (cell.lat, cell.lon),
            "terrain": cell.terrain_type,
            "priority": priority_score,
        })

    # Sort by priority
    priorities.sort(key=lambda x: x["priority"], reverse=True)

    return priorities


def get_terrain_search_priority(terrain: "TerrainType", species: str, temperament: str) -> float:
    """Get search priority modifier for terrain based on animal profile."""

    if species == "dog":
        priorities = {
            TerrainType.URBAN: 0.2,
            TerrainType.SUBURBAN: 0.3,
            TerrainType.PARK: 0.4,       # Dogs often found in parks
            TerrainType.FOREST: 0.2,
            TerrainType.DEEP_FOREST: 0.1,
            TerrainType.AGRICULTURAL: 0.2,
            TerrainType.INDUSTRIAL: 0.1,
        }
        # Fearful dogs hide more
        if temperament in ["A", "X"]:  # Aloof or Xenophobic for dogs
            priorities[TerrainType.FOREST] += 0.2
            priorities[TerrainType.DEEP_FOREST] += 0.2
    else:  # cat
        priorities = {
            TerrainType.URBAN: 0.3,      # Cats hide in structures
            TerrainType.SUBURBAN: 0.4,   # Highest for cats
            TerrainType.PARK: 0.2,
            TerrainType.FOREST: 0.3,     # Cats use vegetation
            TerrainType.DEEP_FOREST: 0.1,
            TerrainType.AGRICULTURAL: 0.1,
            TerrainType.INDUSTRIAL: 0.2,
        }

    return priorities.get(terrain, 0.1)


def select_search_method(
    searcher_profile: SearcherProfile,
    target_terrain: Optional["TerrainType"],
    time_of_day: int,
) -> SearchMethod:
    """Select appropriate search method based on situation."""

    # Night search considerations
    if time_of_day < 6 or time_of_day > 20:
        if searcher_profile.has_thermal_camera:
            return SearchMethod.THERMAL
        if not searcher_profile.has_flashlight:
            return SearchMethod.DRIVING_SLOW  # Safer at night

    # Professional methods
    if searcher_profile.searcher_type == SearcherType.PROFESSIONAL:
        if searcher_profile.has_tracking_dog:
            return SearchMethod.SCENT_TRACKING
        if searcher_profile.has_thermal_camera and time_of_day > 18:
            return SearchMethod.THERMAL

    # Terrain-based selection
    if target_terrain in [TerrainType.FOREST, TerrainType.DEEP_FOREST]:
        return SearchMethod.WALKING_SILENT  # Less noise in quiet areas

    if target_terrain == TerrainType.AGRICULTURAL:
        if searcher_profile.has_vehicle:
            return SearchMethod.DRIVING_SLOW

    # Default: walking and calling is most effective for owned pets
    if searcher_profile.knows_pet_name:
        return SearchMethod.WALKING_CALLING
    else:
        return SearchMethod.WALKING_SILENT
```

---

## Searcher Fatigue and Burnout [C]

Searchers don't maintain constant effort indefinitely.

```python
def update_searcher_dedication(
    searcher_profile: SearcherProfile,
    days_elapsed: int,
    any_sightings: bool,
    any_near_misses: bool,
) -> SearcherProfile:
    """
    Update searcher's dedication level over time.

    Dedication affects:
    - Hours actually searched per day
    - Attention/effectiveness during search
    - Likelihood of continuing to search
    """

    base_decay = searcher_profile.burnout_rate

    # Sightings reinvigorate search
    if any_sightings:
        searcher_profile.current_dedication = min(1.0,
            searcher_profile.current_dedication + 0.2)

    # Near misses (saw pet but couldn't catch) have mixed effect
    if any_near_misses:
        # Frustrating but also motivating
        pass  # No change

    # Daily decay
    searcher_profile.current_dedication -= base_decay

    # Owners have a minimum dedication floor
    if searcher_profile.searcher_type == SearcherType.OWNER:
        searcher_profile.current_dedication = max(0.3,
            searcher_profile.current_dedication)
    elif searcher_profile.searcher_type == SearcherType.HOUSEHOLD:
        searcher_profile.current_dedication = max(0.2,
            searcher_profile.current_dedication)
    else:
        searcher_profile.current_dedication = max(0.0,
            searcher_profile.current_dedication)

    # Check if searcher stops searching entirely
    if searcher_profile.current_dedication <= 0:
        searcher_profile.is_active = False

    return searcher_profile


def calculate_actual_search_hours(
    searcher_profile: SearcherProfile,
    day_of_week: int,
) -> float:
    """Calculate actual hours searched today based on dedication and availability."""

    # Base hours from profile
    max_hours = searcher_profile.available_hours_per_day

    # Check if searching today (day availability)
    if day_of_week not in searcher_profile.available_days:
        return 0.0

    # Dedication affects actual hours
    dedication_factor = 0.5 + (searcher_profile.current_dedication * 0.5)
    actual_hours = max_hours * dedication_factor

    # Minimum hours if active
    if searcher_profile.is_active and actual_hours > 0:
        actual_hours = max(0.5, actual_hours)

    return actual_hours
```

---

## Adding Searchers to Simulation [A]

Functions for managing the searcher roster.

```python
def create_owner_searcher(
    pet_profile: "AnimalProfile",
    owner_fitness: str = "average",
) -> SearcherProfile:
    """
    Create the owner searcher - always the first searcher.

    Owner has maximum knowledge and trust but may have limited time.
    """

    defaults = SEARCHER_TYPE_DEFAULTS[SearcherType.OWNER].copy()

    return SearcherProfile(
        searcher_id="owner_001",
        searcher_type=SearcherType.OWNER,
        physical_fitness=owner_fitness,
        has_vehicle=True,  # Assume owner has transport
        **{k: v for k, v in defaults.items() if k not in ["physical_fitness"]},
    )


def add_searcher(
    existing_searchers: List[SearcherProfile],
    searcher_type: SearcherType,
    custom_attributes: dict = None,
) -> List[SearcherProfile]:
    """
    Add a new searcher to the simulation.

    This is the correct way to add search effort - add discrete agents,
    not increment percentages.
    """

    # Get defaults for this type
    defaults = SEARCHER_TYPE_DEFAULTS.get(searcher_type, {}).copy()

    # Apply any custom attributes
    if custom_attributes:
        defaults.update(custom_attributes)

    # Generate unique ID
    type_count = sum(1 for s in existing_searchers if s.searcher_type == searcher_type)
    searcher_id = f"{searcher_type.value}_{type_count + 1:03d}"

    new_searcher = SearcherProfile(
        searcher_id=searcher_id,
        searcher_type=searcher_type,
        **defaults,
    )

    existing_searchers.append(new_searcher)

    return existing_searchers


def remove_searcher(
    searchers: List[SearcherProfile],
    searcher_id: str,
) -> List[SearcherProfile]:
    """Remove a searcher from active search (volunteer gives up, etc.)"""

    return [s for s in searchers if s.searcher_id != searcher_id]
```

---

## Integrated Simulation Loop with Searchers [A]

Putting it all together with the environment and animal behavior.

```python
def simulate_tick_with_searchers(
    animal_state: "AnimalState",
    animal_profile: "AnimalProfile",
    searchers: List[SearcherProfile],
    searcher_states: Dict[str, SearcherState],
    grid: Dict[str, "EnvironmentCell"],
    tick_duration_minutes: float = 5,
) -> Tuple["AnimalState", Dict[str, SearcherState], dict]:
    """
    Simulate one tick with both animal and searcher behavior.

    Returns:
        Updated animal state, searcher states, and events dict
    """

    events = {
        "detections": [],
        "capture_attempts": [],
        "sightings": [],
    }

    # 1. Simulate animal behavior (from PART 10)
    animal_state = simulate_animal_tick(
        animal_state, animal_profile, grid, {}, tick_duration_minutes
    )

    # 2. Check if animal is already recovered/deceased
    if animal_state.status in ["recovered", "deceased"]:
        return animal_state, searcher_states, events

    # 3. Simulate each active searcher
    for searcher_profile in searchers:
        if not searcher_profile.is_active:
            continue

        searcher_id = searcher_profile.searcher_id
        searcher_state = searcher_states.get(searcher_id)

        if not searcher_state or not searcher_state.is_currently_searching:
            continue

        # Get searcher's current cell
        searcher_cell_id = get_cell_id_for_position(
            searcher_state.position, grid
        )

        # Get animal's current cell
        animal_cell_id = get_cell_id_for_position(
            animal_state.position, grid
        )

        # 4. Check for detection if in same cell
        if searcher_cell_id == animal_cell_id:
            cell = grid.get(searcher_cell_id)

            detection_prob = calculate_detection_probability(
                searcher_state=searcher_state,
                searcher_profile=searcher_profile,
                animal_state=animal_state,
                animal_profile=animal_profile,
                environment_cell=cell,
                time_in_cell_minutes=tick_duration_minutes,
            )

            if random.random() < detection_prob:
                events["detections"].append({
                    "searcher_id": searcher_id,
                    "time": animal_state.hours_since_escape,
                    "position": animal_state.position,
                })

                # 5. Animal responds to detection
                distance = calculate_distance(
                    searcher_state.position,
                    animal_state.position
                )

                response_probs = calculate_animal_response_to_searcher(
                    animal_state=animal_state,
                    animal_profile=animal_profile,
                    searcher_profile=searcher_profile,
                    search_method=searcher_state.current_method,
                    distance_m=distance,
                )

                # Roll for response
                response = weighted_random_choice(response_probs)

                # 6. Attempt capture
                capture_prob = calculate_capture_probability(
                    searcher_profile=searcher_profile,
                    animal_state=animal_state,
                    animal_profile=animal_profile,
                    animal_response=response,
                    distance_m=distance,
                )

                capture_successful = random.random() < capture_prob

                events["capture_attempts"].append({
                    "searcher_id": searcher_id,
                    "time": animal_state.hours_since_escape,
                    "response": response,
                    "success": capture_successful,
                })

                # 7. Process capture result
                animal_state = process_capture_attempt(
                    searcher_profile=searcher_profile,
                    animal_state=animal_state,
                    animal_profile=animal_profile,
                    capture_successful=capture_successful,
                )

                if capture_successful:
                    return animal_state, searcher_states, events

        # 8. Check for owner proximity effect (even if not same cell)
        if searcher_profile.pet_recognizes_searcher:
            distance = calculate_distance(
                searcher_state.position,
                animal_state.position
            )

            if distance < 100:  # Within effect range
                effect = calculate_owner_proximity_effect(
                    animal_state=animal_state,
                    animal_profile=animal_profile,
                    searcher_profile=searcher_profile,
                    distance_m=distance,
                    duration_minutes=tick_duration_minutes,
                )

                animal_state.fear_level = max(0,
                    animal_state.fear_level - effect["fear_reduction"]
                )

        # 9. Update searcher state (movement, fatigue)
        searcher_state = simulate_searcher_behavior(
            searcher_state=searcher_state,
            searcher_profile=searcher_profile,
            animal_profile=animal_profile,
            grid=grid,
            known_sightings=events.get("sightings", []),
            hours_since_escape=animal_state.hours_since_escape,
        )

        searcher_state.hours_searched_today += tick_duration_minutes / 60
        searcher_states[searcher_id] = searcher_state

    return animal_state, searcher_states, events
```

---

## Passive Detection Events [A][C]

Handling passive methods like flyers and online posts.

```python
def check_passive_detections(
    animal_state: "AnimalState",
    animal_profile: "AnimalProfile",
    active_passive_methods: Dict[PassiveMethod, dict],
    grid: Dict[str, "EnvironmentCell"],
    hours_since_escape: float,
) -> List[dict]:
    """
    Check if any passive methods generate sighting reports.

    Passive methods don't directly find the pet - they generate
    sighting reports that searchers can then investigate.
    """

    sightings = []

    # Only check if animal is visible (not hiding)
    if animal_state.is_hiding:
        return sightings

    for method, method_state in active_passive_methods.items():
        method_info = PASSIVE_METHOD_EFFECTIVENESS.get(method, {})

        # Check if animal is within coverage area
        coverage_radius = method_info.get("coverage_radius_m", 0)
        distance_from_home = calculate_distance(
            animal_state.position,
            animal_profile.home_location
        )

        if distance_from_home > coverage_radius:
            continue

        # Calculate daily probability (convert to per-tick)
        daily_prob = method_info.get("daily_sighting_probability", 0)

        # Apply decay
        days_active = method_state.get("days_active", 0)
        decay_rate = method_info.get("decay_rate", 0)
        current_prob = daily_prob * ((1 - decay_rate) ** days_active)

        # Convert to probability per 5-minute tick
        # P(sighting in tick) = 1 - (1 - daily_prob)^(tick_duration/1440)
        tick_prob = 1 - ((1 - current_prob) ** (5 / 1440))

        if random.random() < tick_prob:
            # Generate sighting report
            accuracy = method_info.get("report_accuracy", 0.5)
            is_accurate = random.random() < accuracy

            sighting = {
                "method": method.value,
                "time": hours_since_escape,
                "reported_position": animal_state.position if is_accurate else generate_false_position(animal_profile),
                "is_accurate": is_accurate,
                "response_delay_hours": method_info.get("response_delay_hours", 2),
            }

            sightings.append(sighting)

    return sightings


def generate_false_position(animal_profile: "AnimalProfile") -> Tuple[float, float]:
    """Generate a plausible but incorrect sighting location."""

    # False sightings tend to be within reasonable distance of home
    # but not at the actual location
    home = animal_profile.home_location

    # Random distance 100-1000m from home
    distance = random.uniform(100, 1000)
    angle = random.uniform(0, 2 * math.pi)

    # Convert to lat/lon offset (approximate)
    lat_offset = (distance * math.cos(angle)) / 111000
    lon_offset = (distance * math.sin(angle)) / (111000 * math.cos(math.radians(home[0])))

    return (home[0] + lat_offset, home[1] + lon_offset)
```

---

## Usage Example with Searchers

```python
# Complete workflow with discrete searcher agents

# 1. Create animal profile (from Parts 2-3)
dog_profile = AnimalProfile(
    species="dog",
    temperament="A",  # Aloof (cautious, avoids initially)
    size_class="medium",
    escape_location=(37.7749, -122.4194),
    home_location=(37.7749, -122.4194),
)

# 2. Create owner searcher (always first)
owner = create_owner_searcher(dog_profile, owner_fitness="average")
searchers = [owner]

# 3. Add household member after day 1
household_member = SearcherProfile(
    searcher_id="household_001",
    searcher_type=SearcherType.HOUSEHOLD,
    **SEARCHER_TYPE_DEFAULTS[SearcherType.HOUSEHOLD],
)
searchers.append(household_member)

# 4. Add 3 volunteers on day 3 (discrete agents, NOT percentages!)
for i in range(3):
    searchers = add_searcher(
        existing_searchers=searchers,
        searcher_type=SearcherType.VOLUNTEER,
        custom_attributes={
            "available_hours_per_day": random.uniform(0.5, 2.0),
            "dedication_level": random.uniform(0.3, 0.6),
        }
    )

# 5. Hire professional on day 7
professional = SearcherProfile(
    searcher_id="professional_001",
    searcher_type=SearcherType.PROFESSIONAL,
    has_tracking_dog=True,
    years_experience=5,
    **{k: v for k, v in SEARCHER_TYPE_DEFAULTS[SearcherType.PROFESSIONAL].items()
       if k not in ["has_tracking_dog", "years_experience"]},
)
searchers.append(professional)

# 6. Set up passive methods
active_passive_methods = {
    PassiveMethod.FLYERS: {"days_active": 0, "flyer_count": 200},
    PassiveMethod.ONLINE_POSTING: {"days_active": 0, "platform_count": 5},
    PassiveMethod.SHELTER_ALERT: {"days_active": 0},
    PassiveMethod.NEIGHBOR_NETWORK: {"days_active": 0, "neighbor_count": 20},
    PassiveMethod.MICROCHIP_REGISTERED: {"days_active": 0},
}

# 7. Run simulation
# (Searchers and methods are discrete entities, not percentages)
# Each volunteer is a real agent with their own behavior
# Adding search effort = adding more agents, not incrementing a number

print(f"Active searchers: {len([s for s in searchers if s.is_active])}")
print(f"Search methods active: {len(active_passive_methods)}")
# NOT: "Volunteer percentage: 20%" <- This is meaningless
```

---

## Search Strategy Framework [A]

Pluggable strategy system for testing different search approaches.

### Design Goals

1. **A/B Testing**: Compare strategies head-to-head across Monte Carlo runs
2. **Mixed Strategies**: Different searchers can use different strategies
3. **Dynamic Switching**: Strategies can change based on time, events, or rules
4. **Profile-Aware vs Naive**: Some strategies use pet profile, some don't
5. **Measurable Impact**: Every strategy choice affects simulation outcomes

```python
from abc import ABC, abstractmethod
from enum import Enum
from typing import Protocol, Callable

class StrategyAwareness(Enum):
    """How much the strategy uses pet profile information."""
    NAIVE = "naive"                     # Ignores pet profile entirely
    BASIC = "basic"                     # Uses species only
    MODERATE = "moderate"               # Uses species + temperament
    FULL = "full"                       # Uses complete profile
    EXPERT = "expert"                   # Uses profile + behavioral predictions


class SearchStrategy(ABC):
    """
    Base class for all search strategies.

    Strategies define HOW a searcher searches, not WHO they are.
    The same searcher can switch strategies over time.
    """

    name: str
    awareness_level: StrategyAwareness

    @abstractmethod
    def select_search_area(
        self,
        searcher: SearcherProfile,
        grid: Dict[str, "EnvironmentCell"],
        context: "SearchContext",
    ) -> List[dict]:
        """Return prioritized list of areas to search."""
        pass

    @abstractmethod
    def select_search_method(
        self,
        searcher: SearcherProfile,
        target_cell: "EnvironmentCell",
        context: "SearchContext",
    ) -> SearchMethod:
        """Select search method for target area."""
        pass

    @abstractmethod
    def should_switch_area(
        self,
        searcher: SearcherProfile,
        current_cell: "EnvironmentCell",
        time_in_cell_minutes: float,
        context: "SearchContext",
    ) -> bool:
        """Determine if searcher should move to new area."""
        pass


@dataclass
class SearchContext:
    """
    All information available to a search strategy.

    Strategies can choose to use or ignore any of this.
    """
    # Time information
    hours_since_escape: float
    current_hour: int  # 0-23
    day_of_search: int

    # Pet profile (may be ignored by naive strategies)
    pet_profile: Optional["AnimalProfile"]

    # Sighting history
    confirmed_sightings: List[dict]
    unconfirmed_sightings: List[dict]

    # Search history
    areas_searched: Dict[str, float]  # cell_id -> total hours searched
    failed_captures: List[dict]

    # Other searchers (for coordination)
    other_searcher_positions: List[Tuple[float, float]]

    # Environment summary
    terrain_summary: Dict[str, int]  # terrain_type -> cell count
```

---

### Built-in Search Strategies

```python
class NaiveExpandingCircleStrategy(SearchStrategy):
    """
    Naive strategy: Expand outward from last known location.

    Does NOT use pet profile. This is what uninformed searchers do.
    Useful as a baseline for comparison.
    """

    name = "naive_expanding_circle"
    awareness_level = StrategyAwareness.NAIVE

    def __init__(self, expansion_rate_m_per_hour: float = 50):
        self.expansion_rate = expansion_rate_m_per_hour

    def select_search_area(self, searcher, grid, context):
        """Expand search radius over time, ignoring pet behavior."""

        # Calculate current search radius
        hours = context.hours_since_escape
        max_radius = hours * self.expansion_rate

        # Use last sighting or home as center
        if context.confirmed_sightings:
            center = context.confirmed_sightings[-1]["position"]
        else:
            center = context.pet_profile.home_location if context.pet_profile else (0, 0)

        # Prioritize by distance from center (closer = higher priority)
        priorities = []
        for cell_id, cell in grid.items():
            distance = calculate_distance((cell.lat, cell.lon), center)

            if distance > max_radius:
                continue  # Outside current search radius

            # Simple distance-based priority
            priority = max(0, 1 - (distance / max_radius))

            # Reduce priority for already-searched areas
            hours_searched = context.areas_searched.get(cell_id, 0)
            priority *= max(0.2, 1 - (hours_searched * 0.3))

            priorities.append({
                "cell_id": cell_id,
                "position": (cell.lat, cell.lon),
                "terrain": cell.terrain_type,
                "priority": priority,
            })

        priorities.sort(key=lambda x: x["priority"], reverse=True)
        return priorities

    def select_search_method(self, searcher, target_cell, context):
        """Use whatever method searcher has available."""
        if searcher.knows_pet_name:
            return SearchMethod.WALKING_CALLING
        return SearchMethod.WALKING_SILENT

    def should_switch_area(self, searcher, current_cell, time_in_cell, context):
        """Switch after fixed time per cell."""
        return time_in_cell >= 15  # 15 minutes per cell


class ProfileAwareStrategy(SearchStrategy):
    """
    Uses pet profile to prioritize likely locations.

    This is what informed searchers should do.
    """

    name = "profile_aware"
    awareness_level = StrategyAwareness.FULL

    def select_search_area(self, searcher, grid, context):
        """Prioritize based on pet's likely behavior."""

        profile = context.pet_profile
        if not profile:
            # Fall back to naive if no profile
            return NaiveExpandingCircleStrategy().select_search_area(searcher, grid, context)

        priorities = []

        for cell_id, cell in grid.items():
            priority = 0.5

            distance = calculate_distance(
                (cell.lat, cell.lon),
                profile.home_location
            )

            # === Species-specific distance expectations ===
            if profile.species == "cat":
                # Indoor cats stay very close
                if profile.indoor_outdoor == "IO":
                    if distance < 50:
                        priority += 0.5
                    elif distance < 150:
                        priority += 0.3
                    elif distance > 300:
                        priority -= 0.4
                else:  # Outdoor cats range further
                    if distance < 200:
                        priority += 0.3
                    elif distance < 500:
                        priority += 0.2

            else:  # dog
                # Size affects travel distance
                if profile.size_class in ["TOY", "SML"]:
                    if distance < 300:
                        priority += 0.3
                elif profile.size_class in ["LRG", "GNT"]:
                    if distance < 1000:
                        priority += 0.2

            # === Temperament-based terrain preferences ===
            terrain_prefs = self._get_temperament_terrain_preference(
                profile.temperament,
                profile.species
            )
            priority += terrain_prefs.get(cell.terrain_type, 0)

            # === Time-based behavior ===
            if profile.species == "cat":
                # Cats more active at dawn/dusk
                if context.current_hour in [5, 6, 18, 19, 20]:
                    # Prioritize areas with good cover but some visibility
                    if cell.terrain_type in [TerrainType.SUBURBAN, TerrainType.PARK]:
                        priority += 0.15

            # === Sighting boost ===
            for sighting in context.confirmed_sightings:
                sighting_distance = calculate_distance(
                    (cell.lat, cell.lon),
                    sighting["position"]
                )
                hours_ago = context.hours_since_escape - sighting["time"]
                if sighting_distance < 100 and hours_ago < 24:
                    priority += 0.4 * max(0, 1 - hours_ago/24)

            # === Reduce priority for over-searched areas ===
            hours_searched = context.areas_searched.get(cell_id, 0)
            priority *= max(0.3, 1 - (hours_searched * 0.2))

            if cell.traversable:
                priorities.append({
                    "cell_id": cell_id,
                    "position": (cell.lat, cell.lon),
                    "terrain": cell.terrain_type,
                    "priority": max(0, priority),
                })

        priorities.sort(key=lambda x: x["priority"], reverse=True)
        return priorities

    def _get_temperament_terrain_preference(self, temperament, species):
        """Get terrain preferences based on temperament."""

        if species == "dog":
            # Dog codes: G=Gregarious, C=Confident, A=Aloof, X=Xenophobic, B=Bonded
            prefs = {
                "G": {  # Gregarious - stays in human areas
                    TerrainType.URBAN: 0.2,
                    TerrainType.SUBURBAN: 0.3,
                    TerrainType.PARK: 0.3,
                },
                "C": {  # Confident - neutral, will explore
                    TerrainType.SUBURBAN: 0.2,
                    TerrainType.PARK: 0.2,
                },
                "A": {  # Aloof - seeks cover but can warm up
                    TerrainType.FOREST: 0.3,
                    TerrainType.PARK: 0.2,
                    TerrainType.SUBURBAN: 0.1,
                },
                "X": {  # Xenophobic - avoids humans
                    TerrainType.FOREST: 0.4,
                    TerrainType.DEEP_FOREST: 0.3,
                    TerrainType.AGRICULTURAL: 0.2,
                },
                "B": {  # Bonded - stays near home
                    TerrainType.SUBURBAN: 0.3,
                    TerrainType.PARK: 0.2,
                },
            }
        else:  # cat
            # Cat codes: CUR=Curious, CL=Care-less, CAU=Cautious, X=Xenophobic, B=Bonded
            prefs = {
                "CUR": {  # Curious/Clown - explores, may enter buildings
                    TerrainType.SUBURBAN: 0.3,
                    TerrainType.URBAN: 0.2,
                },
                "CL": {  # Care-less - neutral, stays nearby
                    TerrainType.SUBURBAN: 0.2,
                    TerrainType.PARK: 0.1,
                },
                "CAU": {  # Cautious - hides nearby
                    TerrainType.SUBURBAN: 0.2,
                    TerrainType.FOREST: 0.2,
                },
                "X": {  # Xenophobic - deep hiding
                    TerrainType.FOREST: 0.3,
                    TerrainType.SUBURBAN: 0.2,
                },
                "B": {  # Bonded - stays very close to home
                    TerrainType.SUBURBAN: 0.4,
                },
            }

        return prefs.get(temperament, {})

    def select_search_method(self, searcher, target_cell, context):
        """Select method based on terrain and pet profile."""

        profile = context.pet_profile

        # Aloof/xenophobic pets - use quieter methods
        # Dogs: A (Aloof), X (Xenophobic); Cats: CAU (Cautious), X (Xenophobic)
        fearful_temperaments = ["A", "X"] if profile.species == "dog" else ["CAU", "X"]
        if profile and profile.temperament in fearful_temperaments:
            if searcher.pet_trust_level > 0.5:
                return SearchMethod.STATIONARY_CALLING
            return SearchMethod.WALKING_SILENT

        # Default based on terrain
        if target_cell.terrain_type in [TerrainType.FOREST, TerrainType.DEEP_FOREST]:
            return SearchMethod.WALKING_SILENT

        if searcher.knows_pet_name:
            return SearchMethod.WALKING_CALLING
        return SearchMethod.WALKING_SILENT

    def should_switch_area(self, searcher, current_cell, time_in_cell, context):
        """Switch based on terrain and hiding spot density."""

        # More hiding spots = longer search time needed
        hiding_spots = len(current_cell.hiding_spots)
        base_time = 10 + (hiding_spots * 2)  # 10-30+ minutes

        return time_in_cell >= base_time


class TrapFocusedStrategy(SearchStrategy):
    """
    Strategy focused on trap placement rather than active searching.

    Best for fearful cats that won't approach humans.
    """

    name = "trap_focused"
    awareness_level = StrategyAwareness.MODERATE

    def select_search_area(self, searcher, grid, context):
        """Prioritize areas good for trap placement."""

        priorities = []

        for cell_id, cell in grid.items():
            priority = 0.3

            # Good trap locations:
            # - Near sightings
            # - Low human traffic
            # - Has cover nearby
            # - Near food/water sources

            if cell.human_activity_level < 0.3:
                priority += 0.2

            if cell.hiding_spots:
                priority += 0.15

            if cell.water_sources or cell.food_sources:
                priority += 0.2

            # Near recent sightings
            for sighting in context.confirmed_sightings[-5:]:
                dist = calculate_distance(
                    (cell.lat, cell.lon),
                    sighting["position"]
                )
                if dist < 50:
                    priority += 0.3

            priorities.append({
                "cell_id": cell_id,
                "position": (cell.lat, cell.lon),
                "terrain": cell.terrain_type,
                "priority": priority,
            })

        priorities.sort(key=lambda x: x["priority"], reverse=True)
        return priorities

    def select_search_method(self, searcher, target_cell, context):
        """Focus on trap-related methods."""
        if searcher.has_trap:
            return SearchMethod.TRAP_MONITORING
        return SearchMethod.FEEDING_STATION

    def should_switch_area(self, searcher, current_cell, time_in_cell, context):
        """Trap monitoring doesn't require constant presence."""
        return time_in_cell >= 5  # Quick check, then move on


class CoordinatedGridStrategy(SearchStrategy):
    """
    Coordinates with other searchers to avoid overlap.

    Best when multiple searchers are active.
    """

    name = "coordinated_grid"
    awareness_level = StrategyAwareness.MODERATE

    def select_search_area(self, searcher, grid, context):
        """Avoid areas other searchers are covering."""

        priorities = []
        other_positions = context.other_searcher_positions

        for cell_id, cell in grid.items():
            priority = 0.5

            cell_pos = (cell.lat, cell.lon)

            # Reduce priority if other searchers are nearby
            for other_pos in other_positions:
                dist = calculate_distance(cell_pos, other_pos)
                if dist < 100:
                    priority -= 0.4
                elif dist < 200:
                    priority -= 0.2

            # Standard profile-based adjustments
            if context.pet_profile:
                home_dist = calculate_distance(cell_pos, context.pet_profile.home_location)
                if home_dist < 200:
                    priority += 0.2

            priorities.append({
                "cell_id": cell_id,
                "position": cell_pos,
                "terrain": cell.terrain_type,
                "priority": max(0, priority),
            })

        priorities.sort(key=lambda x: x["priority"], reverse=True)
        return priorities

    def select_search_method(self, searcher, target_cell, context):
        if searcher.knows_pet_name:
            return SearchMethod.WALKING_CALLING
        return SearchMethod.WALKING_SILENT

    def should_switch_area(self, searcher, current_cell, time_in_cell, context):
        return time_in_cell >= 15


class SightingChaserStrategy(SearchStrategy):
    """
    Reactive strategy: Rush to latest sighting location.

    High intensity but can miss pets that move.
    """

    name = "sighting_chaser"
    awareness_level = StrategyAwareness.BASIC

    def select_search_area(self, searcher, grid, context):
        """Prioritize areas near recent sightings."""

        priorities = []

        if not context.confirmed_sightings and not context.unconfirmed_sightings:
            # No sightings - fall back to expanding circle
            return NaiveExpandingCircleStrategy().select_search_area(searcher, grid, context)

        # Combine and sort sightings by recency
        all_sightings = (
            [(s, True) for s in context.confirmed_sightings] +
            [(s, False) for s in context.unconfirmed_sightings]
        )
        all_sightings.sort(key=lambda x: x[0]["time"], reverse=True)

        for cell_id, cell in grid.items():
            priority = 0.1
            cell_pos = (cell.lat, cell.lon)

            for sighting, is_confirmed in all_sightings[:10]:  # Last 10 sightings
                dist = calculate_distance(cell_pos, sighting["position"])
                hours_ago = context.hours_since_escape - sighting["time"]

                if dist < 200:
                    recency_weight = max(0, 1 - (hours_ago / 12))  # Decay over 12 hours
                    confidence = 1.0 if is_confirmed else 0.4
                    priority += recency_weight * confidence * (1 - dist/200)

            priorities.append({
                "cell_id": cell_id,
                "position": cell_pos,
                "terrain": cell.terrain_type,
                "priority": priority,
            })

        priorities.sort(key=lambda x: x["priority"], reverse=True)
        return priorities

    def select_search_method(self, searcher, target_cell, context):
        # Urgent search - use fastest method
        if searcher.has_vehicle:
            return SearchMethod.DRIVING_SLOW
        return SearchMethod.WALKING_CALLING

    def should_switch_area(self, searcher, current_cell, time_in_cell, context):
        # Move quickly between areas
        return time_in_cell >= 10
```

---

### Strategy Assignment and Switching

```python
@dataclass
class StrategyAssignment:
    """
    Assigns strategies to searchers with optional dynamic switching.
    """
    searcher_id: str
    strategy: SearchStrategy
    switch_rules: List["StrategySwitchRule"] = field(default_factory=list)


@dataclass
class StrategySwitchRule:
    """
    Rule for when to switch strategies.
    """
    condition: Callable[["SearchContext"], bool]
    new_strategy: SearchStrategy
    description: str


class StrategyController:
    """
    Manages strategy assignments for all searchers.

    Supports:
    - Uniform strategy (all searchers use same)
    - Mixed strategies (different searchers, different strategies)
    - Dynamic switching (strategies change based on events)
    """

    def __init__(self):
        self.assignments: Dict[str, StrategyAssignment] = {}
        self.strategy_history: List[dict] = []

    def assign_uniform_strategy(
        self,
        searchers: List[SearcherProfile],
        strategy: SearchStrategy,
    ):
        """Assign same strategy to all searchers."""
        for searcher in searchers:
            self.assignments[searcher.searcher_id] = StrategyAssignment(
                searcher_id=searcher.searcher_id,
                strategy=strategy,
            )

    def assign_mixed_strategies(
        self,
        assignments: Dict[str, SearchStrategy],
    ):
        """Assign different strategies to different searchers."""
        for searcher_id, strategy in assignments.items():
            self.assignments[searcher_id] = StrategyAssignment(
                searcher_id=searcher_id,
                strategy=strategy,
            )

    def assign_by_type(
        self,
        searchers: List[SearcherProfile],
        type_strategies: Dict[SearcherType, SearchStrategy],
        default: SearchStrategy,
    ):
        """Assign strategies based on searcher type."""
        for searcher in searchers:
            strategy = type_strategies.get(searcher.searcher_type, default)
            self.assignments[searcher.searcher_id] = StrategyAssignment(
                searcher_id=searcher.searcher_id,
                strategy=strategy,
            )

    def add_switch_rule(
        self,
        searcher_id: str,
        condition: Callable[["SearchContext"], bool],
        new_strategy: SearchStrategy,
        description: str,
    ):
        """Add a rule for dynamic strategy switching."""
        if searcher_id in self.assignments:
            self.assignments[searcher_id].switch_rules.append(
                StrategySwitchRule(
                    condition=condition,
                    new_strategy=new_strategy,
                    description=description,
                )
            )

    def get_strategy(
        self,
        searcher_id: str,
        context: SearchContext,
    ) -> SearchStrategy:
        """Get current strategy for searcher, applying switch rules."""

        if searcher_id not in self.assignments:
            return NaiveExpandingCircleStrategy()  # Default fallback

        assignment = self.assignments[searcher_id]

        # Check switch rules in order
        for rule in assignment.switch_rules:
            if rule.condition(context):
                # Log the switch
                self.strategy_history.append({
                    "searcher_id": searcher_id,
                    "time": context.hours_since_escape,
                    "from_strategy": assignment.strategy.name,
                    "to_strategy": rule.new_strategy.name,
                    "reason": rule.description,
                })
                # Update assignment
                assignment.strategy = rule.new_strategy
                break

        return assignment.strategy


# Pre-built switch conditions
def make_sighting_trigger(min_sightings: int = 1):
    """Switch strategy when sightings occur."""
    def condition(context):
        return len(context.confirmed_sightings) >= min_sightings
    return condition

def make_time_trigger(hours: float):
    """Switch strategy after elapsed time."""
    def condition(context):
        return context.hours_since_escape >= hours
    return condition

def make_failure_trigger(max_failures: int = 3):
    """Switch strategy after failed capture attempts."""
    def condition(context):
        return len(context.failed_captures) >= max_failures
    return condition

def make_day_trigger(day: int):
    """Switch strategy on specific day."""
    def condition(context):
        return context.day_of_search >= day
    return condition
```

---

### Strategy Comparison Framework

```python
@dataclass
class StrategyTestConfig:
    """
    Configuration for A/B testing search strategies.
    """
    name: str
    strategy_assignments: Dict[str, SearchStrategy]
    num_simulations: int = 1000
    max_hours: float = 720  # 30 days


def compare_strategies(
    pet_profile: "AnimalProfile",
    grid: Dict[str, "EnvironmentCell"],
    searchers: List[SearcherProfile],
    test_configs: List[StrategyTestConfig],
) -> Dict[str, dict]:
    """
    Run Monte Carlo comparison of different strategy configurations.

    Returns statistics for each configuration.
    """

    results = {}

    for config in test_configs:
        outcomes = {
            "recovered": 0,
            "deceased": 0,
            "still_missing": 0,
            "recovery_times": [],
            "distances_traveled": [],
            "capture_attempts": [],
        }

        controller = StrategyController()
        controller.assign_mixed_strategies(config.strategy_assignments)

        for sim in range(config.num_simulations):
            # Run single simulation with this strategy config
            outcome = run_single_simulation(
                pet_profile=pet_profile,
                grid=grid,
                searchers=copy.deepcopy(searchers),
                strategy_controller=controller,
                max_hours=config.max_hours,
            )

            outcomes[outcome["status"]] += 1
            if outcome["status"] == "recovered":
                outcomes["recovery_times"].append(outcome["hours"])
            outcomes["capture_attempts"].append(outcome["capture_attempts"])

        # Calculate statistics
        n = config.num_simulations
        results[config.name] = {
            "recovery_rate": outcomes["recovered"] / n,
            "mortality_rate": outcomes["deceased"] / n,
            "still_missing_rate": outcomes["still_missing"] / n,
            "mean_recovery_time": (
                statistics.mean(outcomes["recovery_times"])
                if outcomes["recovery_times"] else None
            ),
            "median_recovery_time": (
                statistics.median(outcomes["recovery_times"])
                if outcomes["recovery_times"] else None
            ),
            "mean_capture_attempts": statistics.mean(outcomes["capture_attempts"]),
        }

    return results


# Example usage:
# test_configs = [
#     StrategyTestConfig(
#         name="all_naive",
#         strategy_assignments={s.searcher_id: NaiveExpandingCircleStrategy() for s in searchers},
#     ),
#     StrategyTestConfig(
#         name="all_profile_aware",
#         strategy_assignments={s.searcher_id: ProfileAwareStrategy() for s in searchers},
#     ),
#     StrategyTestConfig(
#         name="mixed_owner_aware_volunteers_naive",
#         strategy_assignments={
#             "owner_001": ProfileAwareStrategy(),
#             "volunteer_001": NaiveExpandingCircleStrategy(),
#             "volunteer_002": NaiveExpandingCircleStrategy(),
#         },
#     ),
# ]
#
# results = compare_strategies(profile, grid, searchers, test_configs)
# print(f"Profile-aware recovery rate: {results['all_profile_aware']['recovery_rate']:.1%}")
# print(f"Naive recovery rate: {results['all_naive']['recovery_rate']:.1%}")
```

---

## Equipment and Passive Method Scaling [A][C]

How equipment quantities and quality affect outcomes.

### Flyer Scaling Model

```python
@dataclass
class FlyerCampaign:
    """
    Models a physical flyer distribution campaign.
    """
    flyer_count: int
    flyer_quality: str = "standard"  # poor/standard/high/professional
    distribution_radius_m: float = 500
    distribution_density: str = "even"  # even/concentrated/sparse
    locations: List[str] = field(default_factory=list)  # specific locations
    start_day: int = 0
    refresh_interval_days: Optional[int] = None  # Replace degraded flyers


FLYER_QUALITY_MODIFIERS = {
    "poor": {  # Black & white, small photo, minimal info
        "visibility": 0.5,
        "recognition": 0.6,
        "call_to_action": 0.5,
        "durability_days": 3,
    },
    "standard": {  # Color photo, basic info
        "visibility": 1.0,
        "recognition": 1.0,
        "call_to_action": 1.0,
        "durability_days": 7,
    },
    "high": {  # Large, laminated, multiple photos
        "visibility": 1.3,
        "recognition": 1.2,
        "call_to_action": 1.2,
        "durability_days": 14,
    },
    "professional": {  # Weatherproof, reflective, QR code
        "visibility": 1.5,
        "recognition": 1.3,
        "call_to_action": 1.4,
        "durability_days": 30,
    },
}


def calculate_flyer_effectiveness(
    campaign: FlyerCampaign,
    days_since_start: int,
    area_population_density: float,  # people per sq km
) -> dict:
    """
    Calculate current effectiveness of flyer campaign.

    Returns daily sighting probability and accuracy.
    """

    quality = FLYER_QUALITY_MODIFIERS.get(campaign.flyer_quality, FLYER_QUALITY_MODIFIERS["standard"])

    # Base effectiveness from flyer count
    # Diminishing returns: doubling flyers doesn't double effectiveness
    # [C] Logarithmic model - 100 flyers = 1.0, 1000 = 1.5, 10000 = 2.0
    count_factor = math.log10(max(10, campaign.flyer_count)) / 2

    # Quality modifiers
    visibility = quality["visibility"]
    recognition = quality["recognition"]

    # Degradation over time
    durability = quality["durability_days"]
    if campaign.refresh_interval_days:
        # Calculate effective age (reset on refresh)
        effective_days = days_since_start % campaign.refresh_interval_days
    else:
        effective_days = days_since_start

    degradation = max(0.1, 1 - (effective_days / durability) ** 2)

    # Population density effect
    # More people = more potential reporters
    # [C] Normalized to suburban baseline (2000 people/sq km)
    population_factor = math.sqrt(area_population_density / 2000)
    population_factor = max(0.3, min(2.0, population_factor))

    # Distribution pattern effect
    distribution_modifiers = {
        "even": 1.0,
        "concentrated": 0.8,  # Misses peripheral areas
        "sparse": 0.6,
    }
    distribution_factor = distribution_modifiers.get(campaign.distribution_density, 1.0)

    # Calculate final probabilities
    base_daily_sighting_prob = 0.03  # From PASSIVE_METHOD_EFFECTIVENESS

    daily_prob = (
        base_daily_sighting_prob
        * count_factor
        * visibility
        * degradation
        * population_factor
        * distribution_factor
    )

    # Cap at reasonable maximum
    daily_prob = min(0.25, daily_prob)

    # Accuracy depends on recognition quality
    base_accuracy = 0.15
    accuracy = min(0.5, base_accuracy * recognition)

    return {
        "daily_sighting_probability": daily_prob,
        "report_accuracy": accuracy,
        "current_degradation": degradation,
        "effective_flyer_count": campaign.flyer_count * degradation,
    }
```

---

### Online Posting Scaling Model

```python
@dataclass
class OnlineCampaign:
    """
    Models online/social media posting campaign.
    """
    platforms: List[str]  # facebook, nextdoor, pawboost, craigslist, etc.
    initial_shares: int = 0
    paid_boost_budget: float = 0.0  # USD
    post_quality: str = "standard"  # poor/standard/high
    update_frequency_days: float = 3.0  # How often post is refreshed
    start_day: int = 0


PLATFORM_EFFECTIVENESS = {
    "nextdoor": {
        "base_reach": 0.8,      # High local engagement
        "decay_rate": 0.05,    # Slow decay (stays visible)
        "share_multiplier": 1.5,
        "local_focus": True,
    },
    "facebook": {
        "base_reach": 1.0,
        "decay_rate": 0.15,    # Fast decay (algorithm buries)
        "share_multiplier": 2.0,
        "local_focus": False,
    },
    "pawboost": {
        "base_reach": 0.6,     # Smaller but targeted audience
        "decay_rate": 0.02,    # Very slow decay (dedicated platform)
        "share_multiplier": 1.2,
        "local_focus": True,
    },
    "craigslist": {
        "base_reach": 0.4,
        "decay_rate": 0.10,
        "share_multiplier": 1.0,
        "local_focus": True,
    },
    "instagram": {
        "base_reach": 0.5,
        "decay_rate": 0.20,    # Very fast decay
        "share_multiplier": 1.8,
        "local_focus": False,
    },
    "ring_neighbors": {
        "base_reach": 0.7,
        "decay_rate": 0.08,
        "share_multiplier": 1.3,
        "local_focus": True,
    },
}


PAID_BOOST_EFFECTIVENESS = {
    # USD spent -> reach multiplier
    # [C] Diminishing returns model
    0: 1.0,
    10: 1.3,
    25: 1.5,
    50: 1.7,
    100: 1.9,
    200: 2.0,
    500: 2.2,
}


def calculate_online_effectiveness(
    campaign: OnlineCampaign,
    days_since_start: int,
) -> dict:
    """
    Calculate current effectiveness of online campaign.
    """

    total_reach = 0
    total_accuracy = 0
    platform_count = 0

    for platform_name in campaign.platforms:
        platform = PLATFORM_EFFECTIVENESS.get(
            platform_name,
            {"base_reach": 0.3, "decay_rate": 0.10, "share_multiplier": 1.0, "local_focus": False}
        )

        # Calculate days since last update
        if campaign.update_frequency_days > 0:
            days_since_update = days_since_start % campaign.update_frequency_days
        else:
            days_since_update = days_since_start

        # Decay based on time since post/update
        decay = (1 - platform["decay_rate"]) ** days_since_update

        # Share effect (viral spread)
        share_boost = 1 + (campaign.initial_shares * 0.01 * platform["share_multiplier"])
        share_boost = min(3.0, share_boost)  # Cap at 3x

        # Paid boost effect
        boost_multiplier = 1.0
        for threshold, multiplier in sorted(PAID_BOOST_EFFECTIVENESS.items()):
            if campaign.paid_boost_budget >= threshold:
                boost_multiplier = multiplier

        platform_reach = (
            platform["base_reach"]
            * decay
            * share_boost
            * boost_multiplier
        )

        total_reach += platform_reach

        # Accuracy is lower for non-local platforms
        platform_accuracy = 0.10 if platform["local_focus"] else 0.05
        total_accuracy += platform_accuracy

        platform_count += 1

    # Average across platforms
    if platform_count > 0:
        avg_reach = total_reach / platform_count
        avg_accuracy = total_accuracy / platform_count
    else:
        avg_reach = 0
        avg_accuracy = 0

    # Multi-platform bonus (cross-pollination)
    multi_platform_bonus = 1 + (platform_count - 1) * 0.1
    avg_reach *= multi_platform_bonus

    # Convert to daily probability
    base_daily_prob = 0.05  # From PASSIVE_METHOD_EFFECTIVENESS
    daily_prob = min(0.30, base_daily_prob * avg_reach)

    return {
        "daily_sighting_probability": daily_prob,
        "report_accuracy": avg_accuracy,
        "effective_reach": avg_reach,
        "platforms_active": platform_count,
    }
```

---

### Equipment Impact Summary

```python
EQUIPMENT_EFFECTIVENESS_SUMMARY = {
    # Equipment -> impact on search outcomes
    # [A][C] Estimated based on professional pet recovery guidance

    "treats": {
        "detection_bonus": 1.15,       # +15% detection when used
        "capture_bonus": 1.20,         # +20% capture success
        "applies_to": ["visible", "hiding"],
        "notes": "Most effective for food-motivated pets",
    },

    "carrier": {
        "detection_bonus": 1.0,
        "capture_bonus": 1.10,         # +10% - safe containment
        "applies_to": ["capture"],
        "notes": "Essential for cats, helpful for small dogs",
    },

    "leash": {
        "detection_bonus": 1.0,
        "capture_bonus": 1.05,
        "applies_to": ["capture"],
        "notes": "Essential for dogs that approach",
    },

    "flashlight": {
        "night_detection_bonus": 2.0,  # Double effectiveness at night
        "applies_to": ["night_search"],
        "notes": "Critical for dusk/dawn/night searching",
    },

    "humane_trap": {
        "passive_capture_rate": 0.15,  # 15% daily capture if pet in area
        "setup_time_hours": 0.5,
        "check_frequency_hours": 12,
        "applies_to": ["fearful_cats", "xenophobic_dogs"],
        "notes": "Best for pets that won't approach humans",
    },

    "trail_camera": {
        "detection_rate": 0.30,        # 30% chance to capture on camera if present
        "confirmation_value": "high",  # Confirms pet is alive and in area
        "applies_to": ["monitoring", "trap_placement"],
        "notes": "Doesn't catch pet but confirms location",
    },

    "tracking_dog": {
        "detection_bonus": 3.0,        # 3x detection rate
        "hidden_detection_bonus": 4.0, # 4x for finding hidden pets
        "scent_decay_hours": 72,       # Effectiveness drops after 72 hours
        "applies_to": ["professional"],
        "notes": "Most effective method, requires professional handler",
    },

    "thermal_camera": {
        "night_detection_bonus": 3.0,
        "hidden_detection_bonus": 2.5,
        "applies_to": ["professional", "night_search"],
        "notes": "Best in cooler weather, open terrain",
    },

    "drone": {
        "area_coverage_multiplier": 5.0,
        "detection_rate": 0.50,        # In open terrain
        "applies_to": ["professional", "open_terrain"],
        "notes": "Limited by regulations, weather, terrain",
    },
}
```

---

## Information Flow and Decision Making [A][C]

How searchers receive and act on information.

```python
@dataclass
class InformationState:
    """
    Tracks what information a searcher has access to.

    Key question: Does the searcher USE the pet profile we provide?
    """
    # What they've been told
    has_pet_profile: bool = False
    profile_detail_level: StrategyAwareness = StrategyAwareness.NAIVE

    # What they've received
    sighting_reports: List[dict] = field(default_factory=list)
    search_tips: List[str] = field(default_factory=list)

    # Their interpretation (may differ from reality)
    believed_search_radius_m: float = 500  # What they think the range is
    believed_pet_status: str = "alive"     # What they believe

    # Information quality
    trust_in_information: float = 0.8      # How much they trust guidance


def apply_information_to_behavior(
    searcher: SearcherProfile,
    info_state: InformationState,
    base_strategy: SearchStrategy,
) -> SearchStrategy:
    """
    Modify strategy based on information state.

    This models whether searchers actually USE information provided.
    """

    # If they have no profile info or don't trust it, use naive strategy
    if not info_state.has_pet_profile or info_state.trust_in_information < 0.3:
        return NaiveExpandingCircleStrategy()

    # If they have profile but only basic awareness
    if info_state.profile_detail_level == StrategyAwareness.BASIC:
        # They might search too wide for a cat, too narrow for a dog
        modified = copy.copy(base_strategy)
        # Strategy uses profile but may not apply it correctly
        return modified

    # Full information and high trust
    if (info_state.profile_detail_level in [StrategyAwareness.FULL, StrategyAwareness.EXPERT]
        and info_state.trust_in_information > 0.7):
        return ProfileAwareStrategy()

    return base_strategy


# Example: Testing impact of information
def test_information_impact(
    pet_profile: "AnimalProfile",
    grid: Dict[str, "EnvironmentCell"],
    num_simulations: int = 1000,
):
    """
    Compare outcomes when searchers have vs don't have profile information.
    """

    results = {}

    # Scenario 1: No profile information given
    results["no_information"] = run_simulations(
        pet_profile=pet_profile,
        grid=grid,
        info_state=InformationState(has_pet_profile=False),
        num_simulations=num_simulations,
    )

    # Scenario 2: Basic information (species only)
    results["basic_information"] = run_simulations(
        pet_profile=pet_profile,
        grid=grid,
        info_state=InformationState(
            has_pet_profile=True,
            profile_detail_level=StrategyAwareness.BASIC,
        ),
        num_simulations=num_simulations,
    )

    # Scenario 3: Full profile information
    results["full_information"] = run_simulations(
        pet_profile=pet_profile,
        grid=grid,
        info_state=InformationState(
            has_pet_profile=True,
            profile_detail_level=StrategyAwareness.FULL,
        ),
        num_simulations=num_simulations,
    )

    # Scenario 4: Full information but searcher doesn't trust/use it
    results["full_but_ignored"] = run_simulations(
        pet_profile=pet_profile,
        grid=grid,
        info_state=InformationState(
            has_pet_profile=True,
            profile_detail_level=StrategyAwareness.FULL,
            trust_in_information=0.2,  # Low trust = ignores info
        ),
        num_simulations=num_simulations,
    )

    return results
```

---

## Complete Searcher Simulation Example

```python
# Full example showing all searcher features

# 1. Create pet profile
cat = AnimalProfile(
    species="cat",
    temperament="CAU",  # Cautious (fearful, hides but can emerge)
    indoor_outdoor="IO",  # Indoor-only (will hide intensely)
    home_location=(37.7749, -122.4194),
    escape_location=(37.7749, -122.4194),
)

# 2. Create environment
grid = create_environment_grid(...)

# 3. Create searchers (discrete agents, not percentages!)
owner = create_owner_searcher(cat, owner_fitness="average")

spouse = SearcherProfile(
    searcher_id="household_001",
    searcher_type=SearcherType.HOUSEHOLD,
    **SEARCHER_TYPE_DEFAULTS[SearcherType.HOUSEHOLD],
)

volunteer_1 = SearcherProfile(
    searcher_id="volunteer_001",
    searcher_type=SearcherType.VOLUNTEER,
    available_hours_per_day=1.5,
    dedication_level=0.5,
)

searchers = [owner, spouse, volunteer_1]

# 4. Set up strategy controller with mixed strategies and switching
controller = StrategyController()

# Owner uses profile-aware strategy
controller.assignments["owner_001"] = StrategyAssignment(
    searcher_id="owner_001",
    strategy=ProfileAwareStrategy(),
    switch_rules=[
        # Switch to trap-focused after 3 days if fearful cat
        StrategySwitchRule(
            condition=make_day_trigger(3),
            new_strategy=TrapFocusedStrategy(),
            description="Fearful cat not responding to active search",
        ),
    ],
)

# Spouse coordinates with owner
controller.assignments["household_001"] = StrategyAssignment(
    searcher_id="household_001",
    strategy=CoordinatedGridStrategy(),
)

# Volunteer uses naive strategy (doesn't know pet)
controller.assignments["volunteer_001"] = StrategyAssignment(
    searcher_id="volunteer_001",
    strategy=NaiveExpandingCircleStrategy(),
    switch_rules=[
        # Switch to sighting chaser if sightings come in
        StrategySwitchRule(
            condition=make_sighting_trigger(1),
            new_strategy=SightingChaserStrategy(),
            description="Responding to sighting report",
        ),
    ],
)

# 5. Set up passive methods with scaling
flyer_campaign = FlyerCampaign(
    flyer_count=200,
    flyer_quality="high",
    distribution_radius_m=300,  # Indoor cats stay close
    refresh_interval_days=7,
)

online_campaign = OnlineCampaign(
    platforms=["nextdoor", "pawboost", "facebook"],
    initial_shares=50,
    paid_boost_budget=25.0,
    update_frequency_days=2.0,
)

# 6. Run simulation
# Each searcher independently executes their strategy
# Strategies can change based on events
# Equipment affects effectiveness
# Information flow affects strategy effectiveness

print("Simulation configuration:")
print(f"  Searchers: {len(searchers)}")
print(f"  Owner strategy: {controller.assignments['owner_001'].strategy.name}")
print(f"  Flyers: {flyer_campaign.flyer_count} ({flyer_campaign.flyer_quality})")
print(f"  Platforms: {len(online_campaign.platforms)}")
print("  NOT: 'Search intensity: 60%' <- This is meaningless")
```

---

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

*Document Version: 2.5*
*Last Updated: January 2026*
*Created for: Lost Pet Monte Carlo Simulation*
*Species: Dogs (Canis familiaris) and Cats (Felis catus)*
