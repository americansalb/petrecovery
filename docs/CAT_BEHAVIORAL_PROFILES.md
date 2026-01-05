# Cat Behavioral Profile System for Lost Pet Simulation

## Overview

This document defines a comprehensive behavioral profile system for simulating lost cat movement patterns. Unlike dogs, cats are territorial ambush predators whose primary survival response is **hiding in silence**. This fundamentally changes how displacement and recovery work.

**Key Insight**: A lost cat is usually not "lost" - they are **displaced** and hiding, often very close to home.

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

## Profile Generation Flow

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

## Probability Normalization Method

When multiple modifiers stack (e.g., temperament +50% to threshold, background +30% to fear), we use multiplicative adjustment with renormalization:

```
FUNCTION applyModifiers(baseProbabilities, modifiers):

    # Step 1: Apply all modifiers multiplicatively
    adjustedProbs = {}
    FOR each outcome in baseProbabilities:
        multiplier = 1.0
        FOR each modifier that affects this outcome:
            multiplier *= (1 + modifier.percentage / 100)
        adjustedProbs[outcome] = baseProbabilities[outcome] * multiplier

    # Step 2: Renormalize so probabilities sum to 1.0
    total = SUM(adjustedProbs.values())
    FOR each outcome in adjustedProbs:
        adjustedProbs[outcome] /= total

    RETURN adjustedProbs
```

---

## Layer 1: INDOOR/OUTDOOR ACCESS

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

## Layer 2: AGE

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

## Layer 3: SIZE

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

## Physical Modifier: BRACHYCEPHALIC

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

### BRACHYCEPHALIC HEAT EMERGENCY

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

## Layer 4: TEMPERAMENT

Cat temperaments follow a different classification than dogs, based on Kat Albrecht's framework:

**Base Probabilities** (Before access history adjustment)

| Code | Temperament | Base Probability | Indoor-Only Adj | Outdoor-Access Adj |
|------|-------------|------------------|-----------------|-------------------|
| CUR | Curious/Clown | 20% | -5% | +10% |
| CL | Care-less | 25% | +5% | +5% |
| CAU | Cautious | 35% | +10% | -5% |
| X | Xenophobic | 15% | +5% | -10% |
| B | Bonded | 5% | +5% | -5% |

**Temperament Definitions**

### CUR - Curious/Clown (Gregarious)

- **Normal behavior**: Gets into everything, greets strangers, runs to door when it opens
- **When displaced**: May initially hide, but **will travel** once fear subsides
- **Recovery pattern**: Likely found inside someone else's home, garage, or shed
- **Search strategy**: Flyers in 5+ block radius, door-to-door interviews
- **Catchability**: Medium - may approach humans but may also keep exploring

### CL - Care-less (Aloof)

- **Normal behavior**: Doesn't care much about people, watches strangers from distance
- **When displaced**: Hides initially, then will break cover and explore or return home
- **Recovery pattern**: May return on own after threshold, or be sighted nearby
- **Search strategy**: Physical search nearby, feeding stations, patience
- **Catchability**: Medium - not seeking humans but not avoiding them

### CAU - Cautious (Shy but Stable)

- **Normal behavior**: Likes familiar people, hides when strangers visit, peeks out eventually
- **When displaced**: Hides in fear, typically close to escape point
- **Recovery pattern**: Often found hiding on own property or immediate neighbor's yard
- **Search strategy**: Thorough physical search of immediate area at night, calling softly
- **Catchability**: Easy if owner finds them, may come to familiar voice

### X - Xenophobic (Fearful/Feral-like)

- **Normal behavior**: Panics when strangers come, hides under bed, won't emerge until they leave
- **When displaced**: Hides in silence, may not respond even to owner
- **Recovery pattern**: Typically found within 3 houses but may take weeks
- **Search strategy**: Humane trap REQUIRED, feeding stations, wildlife cameras
- **Catchability**: Very difficult - will not approach humans, may not even approach owner

### B - Bonded (Single-Person Cat)

- **Normal behavior**: Attached to one person, follows them around, wary of others
- **When displaced**: Terrified, will only respond to specific owner
- **Recovery pattern**: May return to home/escape point looking for owner
- **Search strategy**: Owner-focused search, scent articles, calling at night
- **Catchability**: Easy for bonded person, very hard for others

#### Bonded Cat Movement Algorithm

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

**Temperament Effects on Threshold**

| Temperament | Time to Threshold | Threshold Behavior |
|-------------|-------------------|-------------------|
| CUR | 3-5 days | Starts exploring, may go into neighbor's house |
| CL | 7-10 days | Returns to escape point or meows |
| CAU | 10-12 days | Emerges at night, may return home |
| X | 14-21+ days | May enter trap when starving, still won't approach |
| B | 10-14 days | Returns to escape point, calling for owner |

---

## Layer 5: BACKGROUND

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

## Layer 6: TERRITORY FAMILIARITY

**Base Probabilities**

| Code | Territory | Description | Base Probability |
|------|-----------|-------------|------------------|
| HOME | Home Territory | Escaped from home/yard | 75% |
| NEAR | Adjacent Territory | Neighbor's yard, nearby street | 12% |
| FAR | Unfamiliar Area | Vet, groomer, boarding | 9% |
| LOST | Completely Unknown | Fell from car, moved houses | 4% |

**Territory Impact on Behavior**

| Territory | Initial Behavior | Likely Distance | Recovery Time |
|-----------|------------------|-----------------|---------------|
| HOME | Hide nearby, may return | 0-50m | Hours to days |
| NEAR | Hide, cautiously explore | 50-200m | Days |
| FAR | Freeze in terror | 0-100m from drop point | Days to weeks |
| LOST | Completely immobile | Near drop point | Weeks+ |

**Important**: Unlike dogs, cats displaced to unfamiliar territory almost NEVER try to "find their way home." They freeze and hide. Homing behavior is rare and only documented in outdoor-access cats with established territories.

---

## Layer 7: ESCAPE TYPE

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

## Layer 8: HEALTH STATUS

**Base Probabilities**

| Code | Status | Description | Base Probability |
|------|--------|-------------|------------------|
| HLT | Healthy | No health issues | 80% |
| INJ | Injured | Injured during escape (especially window falls) | 8% |
| CHR | Chronic | Pre-existing chronic condition | 9% |
| MED | Medication-Dependent | Needs regular medication | 3% |

**Injury Probability by Escape Type**

```
ST2 (Window Screen):  INJ: base × 5.0  (falls often cause injury)
DI3 (Vehicle):        INJ: base × 4.0
ST4 (Predator):       INJ: base × 3.0
```

**Health Impact on Survival**

| Status | Speed | Threshold Time | Mortality Risk | Notes |
|--------|-------|----------------|----------------|-------|
| HLT | 1.0x | Normal | Normal | |
| INJ | 0.2x | 2-4 days (can't hold out) | Very High | May not survive to threshold |
| CHR | 0.7x | 60-80% of normal | Elevated | Condition may worsen |
| MED | 1.0x → declining | Depends on medication | High after 48-72h | Diabetic cats critical |

---

## Layer 9: OWNER SEARCH INTENSITY

**Search Intensity Levels**

| Code | Intensity | Description | Prevalence |
|------|-----------|-------------|------------|
| O0 | None | "Cat will come back when hungry" | 15% |
| O1 | Passive | Online posts, called shelter | 30% |
| O2 | Active | Physical searching, flyers, multiple shelter visits | 35% |
| O3 | Intensive | Feeding stations, traps, cameras, daily searching | 15% |
| O4 | Professional | Pet detective, specialized search | 5% |

**Critical Finding**: Physical searching is THE most effective recovery method for cats.

**Search Method Effectiveness**

| Method | Effectiveness for CAU/X cats | Effectiveness for CUR/CL cats |
|--------|------------------------------|-------------------------------|
| Waiting for return | Low | Medium |
| Online posting | Low | Medium-High |
| Calling/searching | Medium | Medium |
| Physical search at night | HIGH | HIGH |
| Flyers | Low | Medium-High |
| Feeding stations | HIGH | Medium |
| Humane traps | VERY HIGH | Medium |
| Scent articles | Unknown efficacy | Unknown efficacy |

**Impact on Recovery**

```
# Physical search dramatically increases live recovery
liveRecoveryBonus = {
    O0: -0.30,  # Cat may die while waiting
    O1: 0.0,    # Baseline
    O2: +0.15,  # Physical search helps
    O3: +0.35,  # Traps/cameras crucial for scared cats
    O4: +0.50   # Professional methods
}

# For Xenophobic cats, O3-O4 is nearly required
IF temperament == X AND searchIntensity < O3:
    recoveryProbability *= 0.3  # Very low chance without traps
```

---

## Time-Dependent Behavior Dynamics

### The Threshold Model

Unlike dogs who have continuous fear decay, cats have a **threshold model** - they remain hidden until a breaking point.

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

### Hunger & Thirst Accumulation

```
hunger(t) = min(1.0, t_hours / 120)   # Cats can go ~5 days without food
thirst(t) = min(1.0, t_hours / 72)    # But only ~3 days without water

# Thirst is the primary threshold trigger
thresholdModifier = max(hunger, thirst × 1.5)
```

### Fear Persistence (Different from Dogs)

**Critical distinction**: Fear decay does NOT begin until threshold is reached. Pre-threshold, fear remains at maximum (1.0). This is fundamentally different from dogs who have continuous fear decay from the moment of escape.

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

## Movement Parameters by Profile Component

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
        movementPattern = "spiral toward home"
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

## Outcome Probability Matrix

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

### Cause of Death Distribution

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

## Secondary Adoption Modeling

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

## Profile Frequency Table

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

## Environmental Modifiers

### Time of Day

| Time | Activity Level | Human Encounter | Predator Risk |
|------|----------------|-----------------|---------------|
| Dawn (5-7am) | High | Low | HIGH |
| Day (7am-6pm) | Very Low (hiding) | High if moving | Low |
| Dusk (6-9pm) | High | Medium | HIGH |
| Night (9pm-5am) | Medium-High | Low | Medium |

**Key**: Cats are crepuscular (dawn/dusk active). Search efforts should focus on these times.

### Weather

| Weather | Effect on Cat |
|---------|---------------|
| Rain | Stays hidden, threshold may accelerate |
| Cold (<40F) | Seeks shelter, may approach buildings |
| Hot (>90F) | Threshold accelerates, seeks water |
| Storm | Deep hiding, may move after storm |

### Terrain (Urban vs Rural)

| Terrain | Hiding Spots | Predator Risk | Recovery Rate |
|---------|--------------|---------------|---------------|
| Urban | Many (buildings, cars, dumpsters) | Low | Medium-High |
| Suburban | Very Many (yards, decks, sheds) | Medium | Highest |
| Rural | Variable | High | Medium |
| Wooded | Very Many | Very High | Lower |

### Terrain Detection Implementation Requirements

The simulation needs a map layer to determine terrain type from coordinates. **For cats, hiding spot density is the primary classification factor** (unlike dogs where traffic risk dominates).

**Required Data Sources** (choose one):

| Source | Pros | Cons |
|--------|------|------|
| OpenStreetMap (Overpass API) | Free, detailed building/structure data | Requires parsing, rate limits |
| Google Maps API | Easy to use, reliable | Costs money at scale |
| Census TIGER/Line | Free, official boundaries | Less granular |
| Pre-computed grid | Fast runtime | Requires upfront processing |

**Cat-Specific Classification Algorithm**

```
FUNCTION classifyTerrainForCat(lat, lng, radius=0.25 miles):

    # Query map data for area around point
    buildingsPerAcre = countBuildings(lat, lng, radius) / acreage(radius)

    # Cat-specific: hiding spot density is primary factor
    hidingSpotDensity = countHidingSpots(lat, lng, radius)
    # Hiding spots: sheds, porches, vehicles, dense vegetation, dumpsters

    sheds = queryOSM('building=shed OR building=garage', lat, lng, radius)
    porches = queryOSM('building:part=porch', lat, lng, radius)
    denseVegetation = queryOSM('natural=scrub OR landuse=forest', lat, lng, radius)
    vehicles = estimateParkedVehicles(buildingsPerAcre)  # ~1.5 per residence

    hidingSpotDensity = len(sheds) + len(porches) + vehicles + vegetationScore

    treeCanopy = getCanopyCoverage(lat, lng, radius)
    predatorRisk = estimatePredatorPresence(lat, lng)  # Coyote reports, rural indicators

    # Classification rules (cat-optimized)
    IF buildingsPerAcre > 20:
        RETURN "Urban"       # Many hiding spots but also more disturbance
    ELIF buildingsPerAcre > 5 AND hidingSpotDensity > 10:
        RETURN "Suburban"    # Optimal for cat hiding
    ELIF treeCanopy > 0.6:
        RETURN "Wooded"      # Good hiding but high predator risk
    ELSE:
        RETURN "Rural"       # Variable hiding, high predator risk

    # Dynamic reclassification as cat moves
    # (terrain type may change during simulation)
```

**Per-Tick Terrain Checks**

The simulation should check terrain at each movement tick because:
- Cat may find better hiding spot in adjacent terrain
- Predator risk varies by terrain (critical for cats)
- Hiding spot quality affects threshold timing

**Fallback if No Map Data**

If map APIs unavailable, use user-provided terrain type for home location and assume consistent terrain within search radius (less accurate but functional).

---

## Search Methodology by Profile

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

## Summary of Layers

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

## References & Research

### Research-Backed

- **University of Queensland Study (2017)** - Rand et al.: 1,210 cats, 61% recovery rate, median distance 50m (indoor) / 315m (outdoor), 75% within 500m
- **Missing Pet Partnership** - Albrecht: Temperament categories, threshold phenomenon, TAR methodology
- **ASPCA/Humane Society data**: Recovery rates by time, cause of death distributions

### Key Statistics (Research-Validated)

| Statistic | Value | Source |
|-----------|-------|--------|
| Indoor-only cats within 3-house radius | 93% | Missing Pet Partnership |
| Median distance - indoor-only | 50m | U of Queensland |
| Median distance - outdoor-access | 315m | U of Queensland |
| 75% found within | 500m | U of Queensland |
| Physical search most effective | Yes | U of Queensland |
| Recovery within 7 days | 34% | U of Queensland |
| Final recovery rate (1 year) | 61% | U of Queensland |

### Assumptions (Need Validation)

- Specific threshold times by temperament
- Fear decay rates post-threshold
- Mortality rates by terrain
- Predator encounter probabilities

---

*Document Version: 1.1*
*Last Updated: January 2026*
*Created for: Lost Pet Monte Carlo Simulation*
*Species: Cats (Felis catus)*

---

## Changelog

### v1.1
- Added brachycephalic modifier (Persian, Himalayan, Exotic Shorthair)
- Added Bonded cat movement algorithm (triangular patrol pattern)
- Added terrain detection requirements with cat-specific hiding spot density
- Added secondary adoption mechanism for outdoor cats
- Clarified fear decay timing relative to threshold (no decay pre-threshold)
- Made probability normalization section self-contained

### v1.0
- Initial document with 9 layers adapted for cat-specific behavior
- Threshold phenomenon model (distinct from dog fear decay)
- Indoor/Outdoor access as primary behavioral determinant
- TAR (Trap-and-Reunite) protocol integration
- Research-backed distance and recovery statistics
- 30 ranked profile combinations
