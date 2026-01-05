# Lost Pet Behavioral Profile System

## Version 2.0

A unified behavioral simulation framework for dogs and cats. This document consolidates species-specific movement patterns, recovery probabilities, and search strategies into a single reference.

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

### Shared Classification Logic

```
FUNCTION classifyTerrain(lat, lng, radius=0.25 miles):

    # Query map data for area around point
    buildingsPerAcre = countBuildings(lat, lng, radius) / acreage(radius)
    roadDensity = totalRoadLength(lat, lng, radius) / acreage(radius)
    nearHighway = isWithinDistance(lat, lng, "highway", 0.1 miles)
    treeCanopy = getCanopyCoverage(lat, lng, radius)
```

### Dog-Specific Classification

**Primary factor: Traffic risk**

Dogs in panic mode cross roads repeatedly. Traffic density is the primary mortality predictor.

```
    # Dog classification (traffic-focused)
    IF buildingsPerAcre > 20 OR nearHighway:
        RETURN "Urban"      # High traffic risk
    ELIF buildingsPerAcre > 5:
        RETURN "Suburban"   # Medium traffic risk
    ELIF treeCanopy > 0.6:
        RETURN "Wooded"     # Low traffic, some predator risk
    ELSE:
        RETURN "Rural"      # Low traffic, variable predator risk
```

### Cat-Specific Classification

**Primary factor: Hiding spot density**

Cats freeze and hide. The availability and quality of hiding spots determines survival and recovery time.

```
    # Cat classification (hiding-spot-focused)
    hidingSpotDensity = countHidingSpots(lat, lng, radius)
    # Hiding spots: sheds, porches, vehicles, dense vegetation, dumpsters

    sheds = queryOSM('building=shed OR building=garage', lat, lng, radius)
    porches = queryOSM('building:part=porch', lat, lng, radius)
    denseVegetation = queryOSM('natural=scrub OR landuse=forest', lat, lng, radius)
    vehicles = estimateParkedVehicles(buildingsPerAcre)  # ~1.5 per residence

    hidingSpotDensity = len(sheds) + len(porches) + vehicles + vegetationScore
    predatorRisk = estimatePredatorPresence(lat, lng)

    IF buildingsPerAcre > 20:
        RETURN "Urban"       # Many hiding spots but also more disturbance
    ELIF buildingsPerAcre > 5 AND hidingSpotDensity > 10:
        RETURN "Suburban"    # Optimal for cat hiding
    ELIF treeCanopy > 0.6:
        RETURN "Wooded"      # Good hiding but high predator risk
    ELSE:
        RETURN "Rural"       # Variable hiding, high predator risk
```

### Per-Tick Terrain Checks

The simulation should check terrain at each movement tick because:
- Animal may move from suburban into urban (higher traffic risk for dogs)
- Animal may find wooded area (better hiding for cats, lower traffic for dogs)
- Terrain affects speed, hiding spots, and human encounter rate

### Fallback if No Map Data

If map APIs unavailable, use user-provided terrain type for home location and assume consistent terrain within search radius (less accurate but functional).

---

## Weather Modifiers

| Weather | Speed Modifier | Shelter-Seeking | Notes |
|---------|---------------|-----------------|-------|
| Clear | 1.0x | Normal | Baseline conditions |
| Rain | 0.7x | +50% | Both species seek cover |
| Storm | 0.3x | +200% | Minimal movement |
| Extreme heat (>90°F) | 0.5x | +100% | Seek shade/water |
| Extreme cold (<40°F) | 0.6x (small animals: 0.3x) | +150% | Seek warmth |

**Species-Specific Notes:**
- **Dogs**: Heat affects brachycephalic breeds critically (see Part 2)
- **Cats**: Weather accelerates threshold timing; rain/cold forces earlier emergence

---

## Time-of-Day Activity Patterns

### Dogs

| Time | Activity Multiplier | Human Encounter Rate |
|------|---------------------|---------------------|
| Dawn (5-7am) | 1.3x | Low |
| Morning (7am-12pm) | 1.0x | High |
| Afternoon (12-5pm) | 0.8x | High |
| Dusk (5-8pm) | 1.3x | Medium |
| Night (8pm-5am) | 0.6x (except X: 1.2x) | Low |

### Cats

| Time | Activity Level | Human Encounter | Predator Risk |
|------|----------------|-----------------|---------------|
| Dawn (5-7am) | High | Low | HIGH |
| Day (7am-6pm) | Very Low (hiding) | High if moving | Low |
| Dusk (6-9pm) | High | Medium | HIGH |
| Night (9pm-5am) | Medium-High | Low | Medium |

**Key Difference**: Cats are crepuscular (dawn/dusk active). Dogs are more diurnal but xenophobic dogs become nocturnal.

---

## Owner Search Intensity (O0-O4)

Owner behavior significantly affects recovery outcomes. This is a situational modifier that affects outcome probabilities.

### Search Intensity Levels

| Code | Intensity | Description | Dog Prevalence | Cat Prevalence |
|------|-----------|-------------|----------------|----------------|
| O0 | None/Minimal | No active search, waiting for return | 5% | 15% |
| O1 | Passive | Posted on social media, called shelters | 25% | 30% |
| O2 | Active | Searching neighborhood, flyers, multiple shelter visits | 45% | 35% |
| O3 | Intensive | Feeding stations, trail cameras, professional help, daily searching | 20% | 15% |
| O4 | Professional | Hired pet detective, search dogs, extensive resources | 5% | 5% |

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

# Found by owner scales with search effort
foundByOwnerProb = baseFoundByOwner × searchIntensityMultiplier[intensity]
where multipliers = { O0: 0.1, O1: 0.5, O2: 1.0, O3: 1.8, O4: 2.5 }

# Stranger return scales with outreach (flyers, social media)
strangerReturnProb = baseStrangerReturn × outreachMultiplier[intensity]
where multipliers = { O0: 0.2, O1: 0.8, O2: 1.0, O3: 1.5, O4: 2.0 }

# Still missing inversely scales with all effort
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

| Code | Status | Description | Dog Prob | Cat Prob |
|------|--------|-------------|----------|----------|
| HLT | Healthy | No health issues | 85% | 80% |
| INJ | Injured | Injured during escape event | 6% | 8% |
| CHR | Chronic | Pre-existing chronic condition | 7% | 9% |
| MED | Medication-Dependent | Needs regular medication | 2% | 3% |

### Injury Probability Adjustments by Escape Type

**Dogs:**
```
P2 (Attack):     INJ: base × 3.0
P3 (Trauma):     INJ: base × 5.0
S1 (Vehicle):    INJ: base × 2.5
```

**Cats:**
```
ST2 (Window Screen):  INJ: base × 5.0  (falls often cause injury)
DI3 (Vehicle):        INJ: base × 4.0
ST4 (Predator):       INJ: base × 3.0
```

### Age Modifies Health Probability

```
SEN (Senior): CHR: base × 2.5, MED: base × 3.0
PUP/KIT:      CHR: base × 0.3, MED: base × 0.5
```

### Health Impact on Movement

| Status | Speed Modifier | Stamina Modifier | Behavior Change |
|--------|----------------|------------------|-----------------|
| HLT | 1.0x | 1.0x | None |
| INJ | 0.3-0.7x (dogs) / 0.2x (cats) | 0.5x | Seeks shelter faster, hides |
| CHR | 0.7x | 0.6x | Tires faster, conservative movement |
| MED | 1.0x initially | Degrades over days | Behavior changes as medication wears off |

**Cat-Specific:** Injured cats have drastically reduced threshold time (2-4 days vs 10-12) - they cannot hold out while hiding.

---

## Territory Familiarity Framework

### Base Probabilities

| Code | Territory | Description | Dog Prob | Cat Prob |
|------|-----------|-------------|----------|----------|
| HOME | Home Territory | Escaped from home or immediate yard | 72% | 75% |
| NEAR | Familiar Area | Regular walk area / neighbor's yard | 15% | 12% |
| FAR | Unfamiliar Area | Vet, groomer, relative's house | 9% | 9% |
| LOST | Completely Unknown | Fell from car, escaped during travel | 4% | 4% |

### Territory Impact - Dogs

| Territory | Homing Ability | Initial Confusion | Landmark Recognition |
|-----------|----------------|-------------------|---------------------|
| HOME | High (0.8) | Low | Full |
| NEAR | Medium (0.5) | Medium | Partial |
| FAR | Low (0.2) | High | None |
| LOST | None (0.0) | Extreme | None |

### Territory Impact - Cats

| Territory | Initial Behavior | Likely Distance | Recovery Time |
|-----------|------------------|-----------------|---------------|
| HOME | Hide nearby, may return | 0-50m | Hours to days |
| NEAR | Hide, cautiously explore | 50-200m | Days |
| FAR | Freeze in terror | 0-100m from drop point | Days to weeks |
| LOST | Completely immobile | Near drop point | Weeks+ |

**Critical Difference**: Unlike dogs, cats displaced to unfamiliar territory almost NEVER try to "find their way home." They freeze and hide. Homing behavior is rare and only documented in outdoor-access cats with established territories.

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

**Base Probabilities** (US pet dog population estimates)

| Code | Size Class | Weight Range | Base Probability |
|------|------------|--------------|------------------|
| T | Toy | <10 lbs | 12% |
| S | Small | 10-25 lbs | 23% |
| M | Medium | 25-50 lbs | 32% |
| L | Large | 50-90 lbs | 27% |
| XL | Giant | 90+ lbs | 6% |

**Movement Modifiers by Size**

| Size | Base Speed | Stamina | Max Distance/Day | Visibility | Pickup Rate |
|------|------------|---------|------------------|------------|-------------|
| T | 0.4x | 0.3x | 0.5 mi | Low (hides easily) | 90% |
| S | 0.7x | 0.6x | 1.5 mi | Medium | 70% |
| M | 1.0x | 1.0x | 4 mi | Medium | 40% |
| L | 1.2x | 1.3x | 8 mi | High | 25% |
| XL | 0.9x | 1.0x | 5 mi | Very High | 15% (intimidating) |

---

## Dog Layer 2: AGE

**Base Probabilities**

| Code | Age Class | Age Range | Base Probability |
|------|-----------|-----------|------------------|
| PUP | Puppy | <1 year | 12% |
| YNG | Young Adult | 1-3 years | 28% |
| ADT | Adult | 3-8 years | 42% |
| SEN | Senior | 8+ years | 18% |

**Movement & Behavior Modifiers by Age**

| Age | Speed | Stamina | Navigation IQ | Fear Response | Human Approach |
|-----|-------|---------|---------------|---------------|----------------|
| PUP | 0.7x | 0.5x | Very Poor | High (but recovers fast) | Very willing |
| YNG | 1.2x | 1.2x | Moderate | Normal | Normal |
| ADT | 1.0x | 1.0x | Good | Normal | Normal |
| SEN | 0.5x | 0.5x | Good (but may have cognitive decline) | May be higher | Seeks comfort |

**Age-Specific Behaviors**

- **PUP**: Easily distracted, poor decision-making, likely to approach any human, tires quickly
- **YNG**: Impulsive, high energy, may run farther than necessary, quick to chase
- **ADT**: Baseline rational behavior, balances fear and need
- **SEN**: Conservative movement, seeks shelter quickly, may be confused, needs resources sooner

---

## Dog Layer 3: BREED INSTINCT

**Base Probabilities** (Accounting for mixed breeds adopting partial traits)

| Code | Instinct Type | Example Breeds | Base Probability |
|------|---------------|----------------|------------------|
| GEN | Generic/Mixed | Mixed breeds, non-specialized | 45% |
| RET | Retriever/Companion | Labs, Goldens, Cavaliers | 18% |
| TER | Terrier | JRTs, Westies, Pit Bulls | 12% |
| HRD | Herding | Border Collies, Aussies, GSDs | 9% |
| SCT | Scent-Driven | Beagles, Bloodhounds, Bassets | 6% |
| GRD | Guardian | Great Pyrenees, Mastiffs, Rotties | 4% |
| SIT | Sighthound | Greyhounds, Whippets, Afghans | 3% |
| IND | Independent | Huskies, Shibas, Basenjis, Akitas | 3% |

**Breed Instinct Behavioral Overrides**

| Instinct | Primary Drive | Movement Pattern | Special Behavior | Escape Type Affinity |
|----------|---------------|------------------|------------------|---------------------|
| GEN | None dominant | Random walk | None | Any |
| RET | Human connection | Returns to last handler spot | Stays close, seeks people | W1, S2, S3 |
| TER | Prey/dig | Erratic, chase-driven | Pursues small animals, explores holes | D1, W1 |
| HRD | Control/manage | Circles, patrols | May "herd" traffic, animals, people | W1, D2 |
| SCT | Follow scent | Linear, nose-down | Can travel very far in one direction | W2, D1 |
| GRD | Protect territory | Stays put | Claims area, may be defensive | W1, P2 |
| SIT | Visual chase | Sprint-and-stop | Extreme bursts, then rest | D1, W1 |
| IND | Self-direction | Purposeful roaming | May not want to be found | W1, W3 |

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

| Parameter | Modifier | Notes |
|-----------|----------|-------|
| Base Speed | 0.6x | Cannot maintain pace |
| Stamina | 0.3x | Tires very quickly |
| Max Distance/Day | 0.5-1.0 mi | Physical limitation |
| Panic Duration | 0.3x | Cannot sustain flight |
| Heat Sensitivity | Extreme | Speed → 0.2x if temp > 75°F |
| Recovery Time | 2x | Needs longer rest periods |

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

| Code | Background | Description | Base Probability |
|------|------------|-------------|------------------|
| F | Family Dog | Raised in home from puppy/young, well-socialized | 65% |
| R | Rescue | Adopted as adult, unknown early history | 25% |
| ST | Former Stray | Lived on streets, later adopted | 6% |
| W | Working Dog | Trained for specific job (hunting, service, etc.) | 4% |

**Background Behavioral Modifiers**

| Background | Survival Skills | Street Smarts | Human Trust | Fear Baseline |
|------------|-----------------|---------------|-------------|---------------|
| F | Low | Low | High | Low |
| R | Variable | Variable | Medium | Medium-High |
| ST | High | High | Low | Medium |
| W | Medium | Medium | Task-dependent | Low |

**Background Influences on Temperament**

Background affects temperament probability distribution:

```
Family Dog (F):     G:35%  C:30%  A:20%  X:5%   B:10%
Rescue (R):         G:20%  C:20%  A:25%  X:25%  B:10%
Former Stray (ST):  G:10%  C:30%  A:35%  X:20%  B:5%
Working Dog (W):    G:25%  C:40%  A:20%  X:5%   B:10%
```

---

## Dog Layer 5: TEMPERAMENT

**Base Probabilities** (Before background adjustment)

| Code | Temperament | Base Probability | After Background Weighting |
|------|-------------|------------------|---------------------------|
| G | Gregarious | 25% | ~28% |
| C | Confident | 28% | ~27% |
| A | Aloof | 23% | ~23% |
| X | Xenophobic | 12% | ~13% |
| B | Bonded | 12% | ~9% |

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
hunger(t) = min(1.0, t_hours / 72)  # Reaches maximum desperation at 72 hours
```

| Hours Lost | Hunger Level | Behavioral Effect |
|------------|--------------|-------------------|
| 0-12 | 0.0-0.17 | Normal temperament expression |
| 12-24 | 0.17-0.33 | Beginning food motivation |
| 24-48 | 0.33-0.67 | Will take risks for food |
| 48-72 | 0.67-1.0 | Desperation; temperament barriers weaken |
| 72+ | 1.0 | Maximum food motivation |

### Thirst Accumulation (More Urgent)

```
thirst(t) = min(1.0, t_hours / 48)  # Critical by 48 hours
```

| Hours Lost | Thirst Level | Behavioral Effect |
|------------|--------------|-------------------|
| 0-8 | 0.0-0.17 | Normal |
| 8-16 | 0.17-0.33 | Seeking water sources |
| 16-24 | 0.33-0.50 | Will approach risky areas for water |
| 24-36 | 0.50-0.75 | Desperation; will approach humans near water |
| 36-48 | 0.75-1.0 | Critical; behavior dramatically altered |
| 48+ | - | Cognitive decline, physical deterioration |

### Dog Fear Decay

**Dogs have continuous fear decay from moment of escape.** Decay rate varies by escape type - trauma escapes (P3) create PTSD-like responses that persist much longer than noise panic:

```
fear(t) = initial_fear × e^(-λt)

# Decay rates by escape type
λ = {
    P1: 0.030,  # Noise panic - half-life ≈ 23 hours
    P2: 0.025,  # Attack panic - half-life ≈ 28 hours
    P3: 0.012,  # Trauma (car accident, fire) - half-life ≈ 58 hours
    D1: 0.040,  # Prey chase - half-life ≈ 17 hours (not fear-based)
    D2: 0.050,  # Dog chase - half-life ≈ 14 hours
    W*: 0.060,  # Walkout escapes - half-life ≈ 12 hours (minimal fear)
    S1: 0.020,  # Vehicle displacement - half-life ≈ 35 hours
    S2: 0.035,  # Facility escape - half-life ≈ 20 hours
    S3: 0.040,  # Handed-off loss - half-life ≈ 17 hours
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

**Base Probabilities** (Before temperament/breed adjustments)

### PANIC ESCAPES (32% total)

| Code | Type | Description | Base Prob | Triggers |
|------|------|-------------|-----------|----------|
| P1 | Noise Panic | Fireworks, thunder, gunshots | 18% | Loud sounds |
| P2 | Attack Panic | Chased by dog, coyote, person | 9% | Predator/threat |
| P3 | Trauma Panic | Car accident, explosion, fire | 5% | Physical trauma |

### PURSUIT ESCAPES (15% total)

| Code | Type | Description | Base Prob | Triggers |
|------|------|-------------|-----------|----------|
| D1 | Prey Chase | Chased squirrel, rabbit, cat | 12% | Prey sighting |
| D2 | Dog Chase | Followed another dog | 3% | Social attraction |

### WALKOUT ESCAPES (42% total)

| Code | Type | Description | Base Prob | Triggers |
|------|------|-------------|-----------|----------|
| W1 | Curious Explorer | Open gate, interesting smell | 28% | Opportunity |
| W2 | Scent Follower | Nose-down tracking | 4% | Scent trail |
| W3 | Habitual Escaper | Has escape history | 6% | Routine |
| W4 | Mate-Seeking (Male) | Intact male seeking female | 3% | Hormones |
| W5 | In-Heat Escape (Female) | Intact female in estrus | 2% | Hormones + male attention |

### DISPLACEMENT ESCAPES (11% total)

| Code | Type | Description | Base Prob | Triggers |
|------|------|-------------|-----------|----------|
| S1 | Vehicle Displacement | Fell/jumped from car | 3% | Accident |
| S2 | Facility Escape | Escaped from vet/groomer | 5% | Stress |
| S3 | Handed-Off Loss | Escaped from pet-sitter | 3% | Unfamiliarity |

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

**By Escape Type:**

| Escape | Initial Speed | Duration | Direction | Stopping Trigger |
|--------|---------------|----------|-----------|------------------|
| P1 | 3.0x base | 30-120 min | Away from noise | Exhaustion, quiet area |
| P2 | 3.5x base | 15-60 min | Away from threat | Exhaustion, safe distance |
| P3 | 3.0x base | 60-240 min | Random/disoriented | Exhaustion, injury |
| D1 | 2.5x base | 5-30 min | Chase direction | Prey lost, confusion |
| D2 | 2.0x base | 10-60 min | Follows other dog | Other dog stops |
| W1 | 0.5x base | Ongoing | Interest-driven | Nothing - keeps exploring |
| W2 | 0.8x base | Ongoing | Scent direction | Scent lost or new scent |
| W3 | 0.7x base | Varies | Familiar routes | Reaches usual destination |
| W4 | 1.5x base | Hours-days | Female scent direction | Finds female or exhausted |
| W5 | 1.0x base | Varies | Erratic, may seek/avoid males | Breeding or escape from males |
| S1 | 0.3x base | 0-30 min | Stays near OR random | Confusion, fear |
| S2 | 1.5x base | 15-60 min | Away from facility | Distance from stress |
| S3 | 1.0x base | Ongoing | May try to reach real home | Exhaustion, disorientation |

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

### HIGH FREQUENCY PROFILES (>1% of population each)

| Rank | Profile Code | Description | Est. Frequency |
|------|--------------|-------------|----------------|
| 1 | W1-G-F-M-ADT-HOME-GEN-HLT | Curious friendly family dog wandered out | 4.2% |
| 2 | W1-C-F-M-ADT-HOME-GEN-HLT | Curious confident family dog wandered out | 3.8% |
| 3 | P1-C-F-M-ADT-HOME-GEN-HLT | Noise panic, confident family dog | 2.9% |
| 4 | W1-G-F-S-ADT-HOME-GEN-HLT | Curious friendly small family dog | 2.7% |
| 5 | P1-A-F-M-ADT-HOME-GEN-HLT | Noise panic, aloof family dog | 2.4% |
| 6 | W1-A-F-M-ADT-HOME-GEN-HLT | Curious aloof family dog wandered out | 2.2% |
| 7 | P1-B-F-M-ADT-HOME-GEN-HLT | Noise panic, bonded family dog | 2.0% |
| 8 | D1-C-F-M-YNG-HOME-GEN-HLT | Prey chase, confident young family dog | 1.9% |
| 9 | W1-G-F-L-ADT-HOME-RET-HLT | Curious friendly large retriever | 1.8% |
| 10 | P1-X-R-M-ADT-HOME-GEN-HLT | Noise panic, xenophobic rescue | 1.7% |
| 11 | W1-C-F-L-ADT-HOME-GEN-HLT | Curious confident large family dog | 1.6% |
| 12 | P1-G-F-S-ADT-HOME-GEN-HLT | Noise panic, friendly small dog | 1.5% |
| 13 | D1-C-F-L-YNG-HOME-TER-HLT | Prey chase, confident young terrier | 1.4% |
| 14 | W1-A-R-M-ADT-HOME-GEN-HLT | Curious aloof rescue wandered out | 1.3% |
| 15 | P1-A-R-M-ADT-HOME-GEN-HLT | Noise panic, aloof rescue | 1.2% |

### MODERATE FREQUENCY PROFILES (0.3-1% each)

| Rank | Profile Code | Description | Est. Frequency |
|------|--------------|-------------|----------------|
| 16 | W3-C-F-M-ADT-HOME-GEN-HLT | Habitual escaper, confident | 0.9% |
| 17 | S2-B-F-M-ADT-NEAR-GEN-HLT | Facility escape, bonded dog | 0.8% |
| 18 | W1-G-F-T-PUP-HOME-GEN-HLT | Curious friendly toy puppy | 0.8% |
| 19 | P2-A-F-M-ADT-HOME-GEN-HLT | Attack panic, aloof family dog | 0.7% |
| 20 | W2-C-F-M-ADT-HOME-SCT-HLT | Scent follower, confident hound | 0.7% |
| 21 | D1-C-F-M-ADT-HOME-TER-HLT | Prey chase, terrier adult | 0.6% |
| 22 | P1-X-R-L-ADT-HOME-GEN-HLT | Noise panic, xenophobic large rescue | 0.6% |
| 23 | W1-C-F-M-SEN-HOME-GEN-HLT | Curious confident senior wandered out | 0.6% |
| 24 | S3-B-F-M-ADT-FAR-GEN-HLT | Escaped from pet-sitter, bonded | 0.5% |
| 25 | W4-C-F-L-YNG-HOME-GEN-HLT | Mate-seeking young intact male | 0.5% |
| 26 | P1-A-F-L-ADT-HOME-HRD-HLT | Noise panic, aloof herding dog | 0.5% |
| 27 | D2-G-F-M-YNG-HOME-GEN-HLT | Dog chase, friendly young dog | 0.4% |
| 28 | W1-X-R-M-ADT-HOME-GEN-HLT | Curious but xenophobic rescue | 0.4% |
| 29 | P1-C-F-L-ADT-HOME-GRD-HLT | Noise panic, confident guardian | 0.4% |
| 30 | W1-G-F-M-PUP-HOME-GEN-HLT | Curious friendly medium puppy | 0.4% |

### LOW FREQUENCY BUT IMPORTANT PROFILES (0.1-0.3% each)

| Rank | Profile Code | Description | Est. Frequency |
|------|--------------|-------------|----------------|
| 31 | P3-X-R-M-ADT-FAR-GEN-INJ | Trauma panic, xenophobic rescue, injured | 0.25% |
| 32 | S1-A-F-M-ADT-LOST-GEN-HLT | Vehicle displacement, aloof, completely lost | 0.22% |
| 33 | P2-X-R-M-ADT-HOME-GEN-INJ | Attack panic, xenophobic rescue, injured | 0.20% |
| 34 | W2-A-W-L-ADT-HOME-SCT-HLT | Scent follower, working hound | 0.18% |
| 35 | P1-X-ST-M-ADT-HOME-IND-HLT | Noise panic, former stray, independent breed | 0.16% |
| 36 | S1-G-F-S-SEN-LOST-RET-CHR | Vehicle fall, friendly senior, chronic condition | 0.14% |
| 37 | W3-X-R-M-ADT-HOME-IND-HLT | Habitual escaper, xenophobic, independent | 0.12% |
| 38 | P1-B-F-T-SEN-HOME-GEN-CHR | Noise panic, bonded senior toy, chronic | 0.11% |
| 39 | D1-C-F-L-YNG-HOME-SIT-HLT | Prey chase, confident sighthound | 0.10% |
| 40 | W1-A-ST-M-ADT-HOME-GEN-HLT | Curious former stray, aloof | 0.10% |

### EDGE CASES (<0.1% but important for completeness)

| Rank | Profile Code | Description | Est. Frequency | Notes |
|------|--------------|-------------|----------------|-------|
| 41 | P3-X-F-L-ADT-LOST-GEN-INJ | Trauma, xenophobic, lost, injured | 0.05% | Worst case scenario |
| 42 | P1-X-R-XL-ADT-HOME-GRD-HLT | Noise panic, xenophobic giant guardian | 0.04% | Hard to catch, intimidating |
| 43 | W4-X-R-L-YNG-HOME-IND-HLT | Mate-seeking xenophobic independent | 0.04% | Will travel extremely far |
| 44 | S1-X-R-M-PUP-LOST-GEN-INJ | Vehicle fall, xenophobic puppy, injured | 0.03% | Very vulnerable |
| 45 | P2-X-ST-L-ADT-FAR-IND-INJ | Attack, former stray, independent, injured | 0.02% | May never be recovered |
| 46 | W1-C-W-L-ADT-FAR-HRD-HLT | Curious working herding dog in unfamiliar area | 0.02% | May try to "work" |
| 47 | P3-G-F-T-SEN-LOST-GEN-INJ | Trauma, friendly senior toy, injured, lost | 0.02% | Highly vulnerable but approachable |
| 48 | W2-X-ST-M-ADT-HOME-SCT-HLT | Scent follower, xenophobic former stray | 0.01% | Will travel far, uncatchable |
| 49 | S2-X-R-L-SEN-FAR-GRD-MED | Facility escape, xenophobic senior guardian, needs meds | 0.01% | Complex recovery |
| 50 | P1-X-R-M-PUP-HOME-GEN-HLT | Noise panic, xenophobic puppy rescue | 0.01% | Unusual but happens with traumatized pups |

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

**This is THE critical factor for cat displacement behavior.** Unlike dogs where temperament dominates, indoor/outdoor history is the primary determinant of distance traveled and recovery pattern.

**Base Probabilities** (US pet cat population)

| Code | Access Type | Description | Base Probability |
|------|-------------|-------------|------------------|
| IO | Indoor-Only | Never goes outside unsupervised | 45% |
| IS | Indoor-Supervised | Only goes out on leash, in catio, or supervised | 10% |
| IO-A | Indoor w/ Outdoor Access | Primarily indoor, but has outdoor access | 25% |
| OA | Outdoor-Access | Regularly goes outside unsupervised | 15% |
| OO | Outdoor-Only | Lives primarily outdoors | 5% |

**Distance & Behavior by Access Type**

| Access | Median Distance Found | Max 75th Percentile | Primary Behavior | Homing Ability |
|--------|----------------------|---------------------|------------------|----------------|
| IO | **50 meters** (~2.5 houses) | 137 meters | Freeze & hide | None |
| IS | 75 meters | 200 meters | Freeze & hide | Very Low |
| IO-A | 150 meters | 400 meters | Hide then explore | Low |
| OA | **315 meters** (~17 houses) | 1609 meters | Cautious exploration | Medium |
| OO | 500+ meters | 3+ km | Territorial roaming | High |

**Why Indoor Cats Stay Close**

Indoor-only cats that escape outside:
- Have **no mental map** of the outdoor environment
- First instinct: run to nearest cover and freeze
- 93% found within a **3-house radius** of escape point
- Will not self-navigate home (don't know how)
- Must be physically found or lured with traps

**Why Outdoor Cats Travel Farther**

Cats with outdoor access:
- Have established territory and mental maps
- May travel to regular spots (food sources, other homes that feed them)
- Can potentially navigate home
- May be "adopted" by neighbors who think they're strays

---

## Cat Layer 2: AGE

**Base Probabilities**

| Code | Age Class | Age Range | Base Probability |
|------|-----------|-----------|------------------|
| KIT | Kitten | <6 months | 8% |
| JUV | Juvenile | 6-12 months | 10% |
| YNG | Young Adult | 1-3 years | 22% |
| ADT | Adult | 3-10 years | 45% |
| SEN | Senior | 10+ years | 15% |

**Movement & Behavior Modifiers by Age**

| Age | Speed | Stamina | Hiding Ability | Threshold Time | Survival Risk |
|-----|-------|---------|----------------|----------------|---------------|
| KIT | 0.7x | 0.4x | Poor (novice) | 2-4 days | Very High |
| JUV | 1.2x | 0.8x | Moderate | 5-8 days | High |
| YNG | 1.0x | 1.0x | Good | 10-12 days | Normal |
| ADT | 1.0x | 1.0x | Excellent | 10-14 days | Normal |
| SEN | 0.5x | 0.5x | Good | 5-7 days (needs resources sooner) | High |

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

| Code | Size Class | Weight Range | Base Probability |
|------|------------|--------------|------------------|
| S | Small | <8 lbs | 25% |
| M | Medium | 8-12 lbs | 55% |
| L | Large | 12-18 lbs | 18% |
| XL | Very Large | 18+ lbs | 2% |

**Size Effects**

| Size | Hiding Spots | Predator Risk | Visibility | Speed |
|------|--------------|---------------|------------|-------|
| S | Excellent (fits anywhere) | Higher | Low | 1.0x |
| M | Good | Normal | Medium | 1.0x |
| L | Limited | Lower | Higher | 0.9x |
| XL | Poor (can't squeeze into small spaces) | Low | High | 0.8x |

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

| Parameter | Modifier | Notes |
|-----------|----------|-------|
| Base Speed | 0.7x | Cannot maintain pace |
| Stamina | 0.4x | Tires very quickly |
| Max Distance | 50-100m | Physical limitation |
| Panic Duration | 0.3x | Cannot sustain flight |
| Heat Sensitivity | Extreme | Speed → 0.2x if temp > 80°F |
| Threshold Time | 0.6x | Breaks cover sooner due to respiratory distress |

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

Cat temperaments follow a different classification than dogs, based on Kat Albrecht's framework:

**Base Probabilities** (Before access history adjustment)

| Code | Temperament | Base Probability | Indoor-Only Adj | Outdoor-Access Adj |
|------|-------------|------------------|-----------------|-------------------|
| CUR | Curious/Clown | 20% | -5% | +10% |
| CL | Care-less | 25% | +5% | +5% |
| CAU | Cautious | 35% | +10% | -5% |
| X | Xenophobic | 15% | +5% | -10% |
| B | Bonded | 5% | +5% | -5% |

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

**Base Probabilities**

### STARTLE ESCAPES (45% total)

| Code | Type | Description | Base Prob | Typical Response |
|------|------|-------------|-----------|------------------|
| ST1 | Door Dash | Ran out when door opened | 28% | Hides near home |
| ST2 | Window Screen | Pushed through window screen | 10% | Falls/jumps, often injured |
| ST3 | Noise Panic | Fireworks, thunder, construction | 5% | Runs to first cover |
| ST4 | Predator Panic | Saw/heard coyote, dog, hawk | 2% | Fast flight, may be far |

### EXPLORATORY ESCAPES (30% total)

| Code | Type | Description | Base Prob | Typical Response |
|------|------|-------------|-----------|------------------|
| EX1 | Curious Walkout | Investigated open door/window | 20% | Explores, may return |
| EX2 | Hunting Instinct | Chased bird, squirrel, lizard | 8% | Variable distance |
| EX3 | Mate-Seeking | Intact cat seeking mate | 2% | Males travel far |

### DISPLACEMENT ESCAPES (25% total)

| Code | Type | Description | Base Prob | Typical Response |
|------|------|-------------|-----------|------------------|
| DI1 | Move Escape | Escaped during move to new home | 8% | Returns to OLD home |
| DI2 | Facility Escape | Escaped from vet/groomer/boarding | 10% | Freezes near facility |
| DI3 | Vehicle Escape | Jumped/fell from car | 4% | Freezes at roadside |
| DI4 | Visitor Escape | Left while pet-sitting | 3% | May not recognize home yet |

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

**Critical distinction from dogs**: Cats have a **threshold model** - they remain hidden until a breaking point. Fear decay does NOT begin until threshold is reached.

```
FUNCTION catThresholdStatus(hours, temperament, health):

    # Base threshold times by temperament (hours)
    baseThreshold = {
        CUR: 84,    # 3.5 days
        CL: 192,    # 8 days
        CAU: 264,   # 11 days
        X: 360,     # 15 days
        B: 288      # 12 days
    }

    # Modify by health
    IF health == INJ:
        threshold = baseThreshold[temperament] × 0.3  # Much faster
    ELIF health == SEN:
        threshold = baseThreshold[temperament] × 0.6
    ELSE:
        threshold = baseThreshold[temperament]

    # Modify by weather
    IF temperature < 40 OR > 90:
        threshold *= 0.5  # Exposure forces earlier emergence

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

**By Escape Type:**

| Escape | Initial Speed | Duration | Distance | Hiding Trigger |
|--------|---------------|----------|----------|----------------|
| ST1 | 2.0x | 1-5 min | 5-30m | First cover found |
| ST2 | 0.3x (injured) | 0-1 min | 0-10m | Impact |
| ST3 | 3.0x | 5-15 min | 20-100m | Quiet area |
| ST4 | 4.0x | 10-30 min | 50-200m | Safe distance |
| EX1 | 0.5x | Ongoing | Variable | Doesn't hide initially |
| EX2 | 2.0x | 2-10 min | 10-50m | Prey lost |
| EX3 | 1.0x | Hours | 500m+ (males) | Finds mate |
| DI1 | 1.5x | 10-60 min | Toward old home | Recognition |
| DI2 | 2.5x | 5-20 min | 20-100m | First cover |
| DI3 | 0.2x | 0-5 min | Near road | Shock |
| DI4 | 0.5x | Ongoing | Variable | Confusion |

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

### HIGH FREQUENCY PROFILES (>1% each)

| Rank | Profile Code | Description | Est. Frequency |
|------|--------------|-------------|----------------|
| 1 | ST1-CAU-F-IO-ADT-HOME-HLT | Door dash, cautious indoor family cat | 6.8% |
| 2 | ST1-CL-F-IO-ADT-HOME-HLT | Door dash, care-less indoor family cat | 5.2% |
| 3 | EX1-CL-F-IO-A-ADT-HOME-HLT | Curious walkout, care-less w/ outdoor access | 4.1% |
| 4 | ST1-CUR-F-IO-ADT-HOME-HLT | Door dash, curious indoor cat | 3.8% |
| 5 | EX1-CUR-F-IO-A-ADT-HOME-HLT | Curious walkout, curious w/ access | 3.5% |
| 6 | ST1-X-R-IO-ADT-HOME-HLT | Door dash, xenophobic rescue indoor | 3.2% |
| 7 | DI2-CAU-F-IO-ADT-FAR-HLT | Vet escape, cautious indoor cat | 2.9% |
| 8 | ST1-CAU-F-IO-YNG-HOME-HLT | Door dash, cautious young indoor | 2.7% |
| 9 | EX1-CL-F-OA-ADT-HOME-HLT | Curious walkout, care-less outdoor cat | 2.4% |
| 10 | ST1-CL-R-IO-ADT-HOME-HLT | Door dash, care-less rescue indoor | 2.2% |
| 11 | ST3-CAU-F-IO-ADT-HOME-HLT | Noise panic, cautious indoor | 2.0% |
| 12 | DI1-CL-F-IO-A-ADT-FAR-HLT | Move escape, care-less w/ access | 1.8% |
| 13 | ST2-CAU-F-IO-ADT-HOME-INJ | Window fall, cautious, injured | 1.6% |
| 14 | EX2-CUR-F-OA-YNG-HOME-HLT | Hunting escape, curious young outdoor | 1.5% |
| 15 | DI4-CAU-F-IO-ADT-NEAR-HLT | Pet-sitter escape, cautious | 1.3% |

### MODERATE FREQUENCY PROFILES (0.3-1% each)

| Rank | Profile Code | Description | Est. Frequency |
|------|--------------|-------------|----------------|
| 16 | ST1-B-F-IO-ADT-HOME-HLT | Door dash, bonded indoor | 0.9% |
| 17 | ST4-X-R-IO-ADT-HOME-HLT | Predator panic, xenophobic rescue | 0.8% |
| 18 | DI2-X-R-IO-ADT-FAR-HLT | Vet escape, xenophobic rescue | 0.7% |
| 19 | ST1-X-FO-IO-ADT-HOME-HLT | Door dash, xenophobic feral-origin | 0.7% |
| 20 | EX3-CL-F-OA-YNG-HOME-HLT | Mate-seeking, young intact outdoor | 0.6% |
| 21 | DI1-CAU-F-IO-ADT-LOST-HLT | Move escape, cautious, at old home | 0.6% |
| 22 | ST1-CAU-F-IO-SEN-HOME-CHR | Door dash, cautious senior w/ condition | 0.5% |
| 23 | ST2-X-R-IO-ADT-HOME-INJ | Window fall, xenophobic rescue, injured | 0.5% |
| 24 | DI3-CAU-F-IO-ADT-LOST-HLT | Vehicle escape, cautious | 0.4% |
| 25 | EX1-CUR-F-OA-JUV-HOME-HLT | Curious walkout, juvenile outdoor | 0.4% |

### LOW FREQUENCY BUT IMPORTANT PROFILES (<0.3%)

| Rank | Profile Code | Description | Est. Frequency | Notes |
|------|--------------|-------------|----------------|-------|
| 26 | ST2-X-R-IO-ADT-HOME-INJ | Window fall, xenophobic, injured | 0.25% | Very difficult |
| 27 | DI3-X-R-IO-ADT-LOST-INJ | Vehicle escape, xenophobic, injured, lost | 0.15% | Worst case |
| 28 | ST4-X-FO-IO-ADT-FAR-HLT | Predator panic, feral-origin | 0.12% | May never recover |
| 29 | DI2-X-FO-IO-SEN-FAR-MED | Vet escape, xeno senior on meds | 0.08% | Critical timeline |
| 30 | ST1-X-R-IO-KIT-HOME-HLT | Door dash, xenophobic kitten | 0.05% | Very vulnerable |

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

## References & Research

### Research-Backed Statistics

| Statistic | Value | Source |
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

## v2.0 (Current)

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
