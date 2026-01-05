# Dog Behavioral Profile System for Lost Pet Simulation

## Overview

This document defines a comprehensive behavioral profile system for simulating lost dog movement patterns. Profiles are generated through a layered system where some characteristics are **intrinsic** (part of the dog's identity) and others are **situational** (determined by escape circumstances).

---

## Profile Generation Flow

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

## Probability Normalization Method

When multiple modifiers stack (e.g., temperament +50% to P1, breed +30% to D1, age -20% to P1), we use the following resolution method:

### Method: Multiplicative Adjustment with Renormalization

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

### Example: Xenophobic Rescue with Terrier Instinct

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

## Layer 1: SIZE

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

## Layer 2: AGE

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

## Layer 3: BREED INSTINCT

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

## Physical Modifier: BRACHYCEPHALIC

Brachycephalic breeds (flat-faced dogs) have severe physiological limitations that don't map to behavior instincts but critically affect movement capability.

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

Brachycephalic physical constraints **override** breed instinct modifiers. Apply in this order:

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

### ⚠️ BRACHYCEPHALIC HEAT EMERGENCY

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

## Layer 4: BACKGROUND

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

## Layer 5: TEMPERAMENT

**Base Probabilities** (Before background adjustment)

| Code | Temperament | Base Probability | After Background Weighting |
|------|-------------|------------------|---------------------------|
| G | Gregarious | 25% | ~28% |
| C | Confident | 28% | ~27% |
| A | Aloof | 23% | ~23% |
| X | Xenophobic | 12% | ~13% |
| B | Bonded | 12% | ~9% |

**Temperament Behavioral Definitions**

### G - Gregarious (Social Butterfly)
- **Human response**: Approaches strangers readily, tail wagging
- **Travel pattern**: Short distances - gets "rescued" quickly
- **Catchability**: Very easy
- **Risk**: May go home with wrong person

### C - Confident (Self-Assured Explorer)
- **Human response**: Neutral, will approach if beneficial
- **Travel pattern**: Purposeful, can cover significant distance
- **Catchability**: Medium - approachable but not seeking help
- **Risk**: May travel far before needing assistance

### A - Aloof (Wary but Rational)
- **Human response**: Avoids initially, warms up over 24-72 hours when hungry
- **Travel pattern**: Moderate distance, cautious movement
- **Catchability**: Medium - requires patience, food luring
- **Risk**: May be mistaken for "abused" due to wariness

### X - Xenophobic (Fear-Dominant)
- **Human response**: Flees from ALL humans including owner
- **Travel pattern**: Far and fast when triggered, hides otherwise
- **Catchability**: Very hard - may require traps
- **Risk**: High injury/death risk from running into traffic

### B - Bonded (Owner-Focused)
- **Human response**: Seeks owner specifically, wary of strangers
- **Travel pattern**: Circles home area, returns to familiar spots
- **Catchability**: Easy for owner, hard for strangers
- **Risk**: May refuse help from non-owner
- **Movement mechanic**: See "Bonded Gravity" below

#### Bonded Gravity Mechanic

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

## Time-Dependent Behavior Dynamics

Temperament expression changes over time as physiological needs accumulate. A xenophobic dog at hour 6 behaves very differently than at hour 72.

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

### Fear Decay

Fear decay rate varies by escape type. Trauma escapes (P3) create PTSD-like responses that persist much longer than noise panic:

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

## Layer 6: TERRITORY FAMILIARITY

**Base Probabilities**

| Code | Territory | Description | Base Probability |
|------|-----------|-------------|------------------|
| HOME | Home Territory | Escaped from home or immediate yard | 72% |
| NEAR | Familiar Area | Regular walk area, friend's house, nearby park | 15% |
| FAR | Unfamiliar Area | Vet across town, new groomer, relative's house | 9% |
| LOST | Completely Unknown | Fell from car on highway, escaped during travel | 4% |

**Territory Impact on Navigation**

| Territory | Homing Ability | Initial Confusion | Landmark Recognition |
|-----------|----------------|-------------------|---------------------|
| HOME | High (0.8) | Low | Full |
| NEAR | Medium (0.5) | Medium | Partial |
| FAR | Low (0.2) | High | None |
| LOST | None (0.0) | Extreme | None |

---

## Layer 7: ESCAPE TYPE

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

Intact females in estrus have distinctive escape and movement patterns that differ significantly from males (W4):

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
- Spay/neuter advocacy opportunity

**Escape Type Probability Adjustments**

Temperament modifies escape type probability:
```
Xenophobic (X):  P1: +50%, P2: +30%, P3: +20%, W1: -30%
Gregarious (G):  P1: -20%, W1: +20%, D2: +30%
Confident (C):   W1: +10%, D1: +10%
Bonded (B):      S2: +40%, S3: +40% (more stressed when away from owner)
```

Breed instinct modifies escape type probability:
```
SCT (Scent):     W2: +200%, D1: +30%
TER (Terrier):   D1: +50%
SIT (Sighthound): D1: +40%
HRD (Herding):   D2: +30%
IND (Independent): W3: +50%
```

Age modifies escape type probability:
```
PUP: W1: +40%, D1: +20%, P1: -20%
YNG: D1: +30%, W4: +50% (if intact)
SEN: W1: +20%, P1: +10%, D1: -30%
```

---

## Layer 8: HEALTH STATUS

**Base Probabilities**

| Code | Status | Description | Base Probability |
|------|--------|-------------|------------------|
| HLT | Healthy | No health issues | 85% |
| INJ | Injured | Injured during escape event | 6% |
| CHR | Chronic | Pre-existing chronic condition | 7% |
| MED | Medication-Dependent | Needs regular medication | 2% |

**Health Probability Adjustments**

Escape type modifies injury probability:
```
P2 (Attack):     INJ: base × 3.0
P3 (Trauma):     INJ: base × 5.0
S1 (Vehicle):    INJ: base × 2.5
```

Age modifies chronic condition probability:
```
SEN: CHR: base × 2.5, MED: base × 3.0
PUP: CHR: base × 0.3, MED: base × 0.5
```

**Health Impact on Movement**

| Status | Speed Modifier | Stamina Modifier | Behavior Change |
|--------|----------------|------------------|-----------------|
| HLT | 1.0x | 1.0x | None |
| INJ | 0.3-0.7x | 0.5x | Seeks shelter faster, hides |
| CHR | 0.7x | 0.6x | Tires faster, conservative movement |
| MED | 1.0x initially | Degrades over days | Behavior changes as medication wears off |

---

## Layer 9: OWNER SEARCH INTENSITY

Owner behavior significantly affects recovery outcomes. This is a **situational modifier** that affects outcome probabilities but not the dog's inherent movement behavior.

**Search Intensity Levels**

| Code | Intensity | Description | Prevalence |
|------|-----------|-------------|------------|
| O0 | None/Minimal | No active search, waiting for dog to return | 5% |
| O1 | Passive | Posted on social media, called shelters | 25% |
| O2 | Active | Searching neighborhood, flyers, multiple shelter visits | 45% |
| O3 | Intensive | Feeding stations, trail cameras, professional help, daily searching | 20% |
| O4 | Professional | Hired pet detective, search dogs, extensive resources | 5% |

**Search Intensity Components**

| Component | O0 | O1 | O2 | O3 | O4 |
|-----------|----|----|----|----|-----|
| Physical searching (hours/day) | 0 | 0-1 | 2-4 | 4-8 | 8+ |
| Flyers posted | 0 | 0 | 10-50 | 50-200 | 200+ |
| Social media reach | 0 | Low | Medium | High | Professional |
| Shelter checks | 0 | Once | Daily | 2x daily | Continuous |
| Feeding stations | No | No | Maybe | Yes | Multiple |
| Trail cameras | No | No | No | Yes | Yes |
| Scent articles distributed | No | No | No | Yes | Yes |

**Impact on Outcome Probabilities**

Search intensity modifies the probability of various outcomes:

```
# Self-return is independent of search intensity (dog's behavior)
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

**Special Case: Xenophobic Dogs with Intensive Search**

For X temperament dogs, O3/O4 search intensity has specific strategies:

| Strategy | Effect on X Dogs |
|----------|------------------|
| Feeding stations | +30% chance of sighting, enables trap placement |
| Trail cameras | Identifies patterns without spooking dog |
| Scent articles | Minimal effect (dog still flees from owner) |
| Calling/searching | May actually DECREASE recovery (flushes dog further) |
| Humane traps | Primary recovery method, +40% recovery rate |

```
IF temperament == X AND searchIntensity >= O3:
    # Intensive search can backfire without proper technique
    IF usingFeedingStations AND usingTraps:
        recoveryBonus = +0.35
    ELIF activelySearchingAndCalling:
        recoveryPenalty = -0.15  # May push dog further away
```

---

## Complete Profile Generation Algorithm

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

## Profile Frequency Table

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

## Movement Parameters by Profile Component

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

## Outcome Probability Matrix

Based on profile, estimate probability of each outcome after 72 hours:

### Base Rates by Temperament (Suburban baseline)

| Outcome | G | C | A | X | B |
|---------|---|---|---|---|---|
| Self-return | 15% | 10% | 8% | 2% | 25% |
| Found by owner | 25% | 20% | 15% | 5% | 35% |
| Picked up by stranger | 40% | 15% | 10% | 2% | 10% |
| At shelter | 15% | 10% | 12% | 5% | 8% |
| Still missing | 4% | 40% | 50% | 68% | 20% |
| Deceased | 1% | 5% | 5% | 18% | 2% |

### Deceased Rate Adjustments by Terrain

Xenophobic dogs have significantly higher mortality in urban areas due to:
- More traffic encounters during panicked flight
- Fewer hiding spots, more flushing
- Higher human encounter rate → more fleeing → more road crossings

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

Mortality risk is not uniform over time:

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

*Note: These are estimates. Actual outcomes also depend on size, age, territory, escape type, owner search effort, and environment.*

---

## Environmental Modifiers (Applied at Runtime)

These modify movement parameters but don't create new profile types:

### Time of Day
| Time | Activity Multiplier | Human Encounter Rate |
|------|---------------------|---------------------|
| Dawn (5-7am) | 1.3x | Low |
| Morning (7am-12pm) | 1.0x | High |
| Afternoon (12-5pm) | 0.8x | High |
| Dusk (5-8pm) | 1.3x | Medium |
| Night (8pm-5am) | 0.6x (except X: 1.2x) | Low |

### Weather
| Weather | Speed Modifier | Shelter-Seeking |
|---------|---------------|-----------------|
| Clear | 1.0x | Normal |
| Rain | 0.7x | +50% |
| Storm | 0.3x | +200% |
| Extreme heat | 0.5x | +100% |
| Extreme cold | 0.6x (small dogs: 0.3x) | +150% |

### Terrain
| Terrain | Speed Modifier | Hiding Spots | Traffic Risk |
|---------|---------------|--------------|--------------|
| Urban | 0.8x | Medium | High |
| Suburban | 1.0x | High | Medium |
| Rural | 1.2x | Medium | Low |
| Wooded | 0.7x | Very High | Very Low |

### Terrain Detection Implementation Requirements

The mortality and behavior rates depend heavily on terrain classification. **The simulation needs a map layer** to determine terrain type from coordinates.

**Required Data Sources** (choose one):

| Source | Pros | Cons |
|--------|------|------|
| OpenStreetMap (Overpass API) | Free, detailed building/road data | Requires parsing, rate limits |
| Google Maps API | Easy to use, reliable | Costs money at scale |
| Census TIGER/Line | Free, official boundaries | Less granular |
| Pre-computed grid | Fast runtime | Requires upfront processing |

**Classification Algorithm**

```
FUNCTION classifyTerrain(lat, lng, radius=0.25 miles):

    # Query map data for area around point
    buildingsPerAcre = countBuildings(lat, lng, radius) / acreage(radius)
    roadDensity = totalRoadLength(lat, lng, radius) / acreage(radius)
    nearHighway = isWithinDistance(lat, lng, "highway", 0.1 miles)
    treeCanopy = getCanopyCoverage(lat, lng, radius)

    # Classification rules
    IF buildingsPerAcre > 20 OR nearHighway:
        RETURN "Urban"
    ELIF buildingsPerAcre > 5:
        RETURN "Suburban"
    ELIF treeCanopy > 0.6:
        RETURN "Wooded"
    ELSE:
        RETURN "Rural"

    # Dynamic reclassification as dog moves
    # (terrain type may change during simulation)
```

**Per-Tick Terrain Checks**

The simulation should check terrain at each movement tick because:
- Dog may move from suburban into urban (higher traffic risk)
- Dog may find wooded area (better hiding, lower traffic risk)
- Terrain affects speed, hiding spots, and human encounter rate

**Fallback if No Map Data**

If map APIs unavailable, use user-provided terrain type for home location and assume consistent terrain within search radius (less accurate but functional).

---

## Usage Notes

1. **For specific pet simulation**: User inputs their dog's known characteristics (size, breed, temperament, etc.) and we generate the situational layers

2. **For population baseline**: Generate profiles using the weighted probability system to create realistic distribution of lost dogs

3. **Monte Carlo runs**: Each run should generate a fresh profile (for baseline) or use fixed intrinsic characteristics with randomized situational factors (for specific pet)

4. **Validation**: These probabilities are ESTIMATES based on practitioner knowledge and limited research. They should be validated against actual lost dog recovery data when available.

---

## References & Assumptions

**Research-backed:**
- Temperament categories (G/A/X) from Kat Albrecht's Missing Animal Response framework
- Distance data roughly based on Lord et al. 2007 (79% found <1 mile)
- Size affecting pickup rate from various shelter intake studies

**Assumed (need validation):**
- Specific probability percentages for each layer
- Movement speed multipliers
- Transition timing between behavioral phases
- Breed instinct probability distribution

---

## Summary of Layers

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

*Document Version: 1.2*
*Last Updated: January 2026*
*Created for: Lost Pet Monte Carlo Simulation*
*Species: Dogs (Canis familiaris)*

---

## Changelog

### v1.2
- Added probability normalization method (multiplicative + renormalize)
- Added W5 escape type detailed behavior (in-heat females)
- Added Bonded temperament "gravity" mechanic
- Added escape-type-specific fear decay rates (P3 trauma = 58hr half-life)
- Added brachycephalic modifier application order
- Added brachycephalic heat emergency handling (⚠️ medical emergency)
- Added terrain detection implementation requirements
- Updated deceased rates for xenophobic dogs by terrain

### v1.1
- Added 9 layers with probability distributions
- Added 50 ranked profile combinations
- Added time-dependent behavior dynamics
- Added owner search intensity layer

### v1.0
- Initial document with 8 layers
- Basic movement parameters
- Outcome probability matrix
