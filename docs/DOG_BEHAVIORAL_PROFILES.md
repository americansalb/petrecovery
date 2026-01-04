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
| W4 | Mate-Seeking | Intact male seeking female | 4% | Hormones |

### DISPLACEMENT ESCAPES (11% total)

| Code | Type | Description | Base Prob | Triggers |
|------|------|-------------|-----------|----------|
| S1 | Vehicle Displacement | Fell/jumped from car | 3% | Accident |
| S2 | Facility Escape | Escaped from vet/groomer | 5% | Stress |
| S3 | Handed-Off Loss | Escaped from pet-sitter | 3% | Unfamiliarity |

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

    # Special case: W4 only possible for intact males
    IF NOT intactMale:
        escapeProbs[W4] = 0
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

| Outcome | G | C | A | X | B |
|---------|---|---|---|---|---|
| Self-return | 15% | 10% | 8% | 2% | 25% |
| Found by owner | 25% | 20% | 15% | 5% | 35% |
| Picked up by stranger | 40% | 15% | 10% | 2% | 10% |
| At shelter | 15% | 10% | 12% | 5% | 8% |
| Still missing | 4% | 40% | 50% | 75% | 20% |
| Deceased | 1% | 5% | 5% | 11% | 2% |

*Note: These are rough estimates. Actual outcomes also depend on size, age, territory, escape type, owner search effort, and environment.*

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

*Document Version: 1.0*
*Created for: Lost Pet Monte Carlo Simulation*
*Species: Dogs (Canis familiaris)*
