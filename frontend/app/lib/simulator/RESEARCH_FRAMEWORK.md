# Lost Pet Recovery Simulation: Research Framework

## Overview

This document maps the complete variable space for the Monte Carlo lost pet recovery simulation. Each variable is classified by:

- **VERIFIED**: Peer-reviewed research with citation
- **DERIVED**: Mathematically derived from verified data
- **ASSUMED**: Reasonable assumption without empirical backing
- **MISSING**: Not currently modeled but potentially significant

---

## 1. Recovery Outcome Pathways

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        LOST PET RECOVERY PATHWAYS                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────┐                                                                    │
│  │ PET LOST│                                                                    │
│  └────┬────┘                                                                    │
│       │                                                                         │
│       ▼                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         PET MOVEMENT PHASE                              │    │
│  │  States: FLEEING → HIDING → FORAGING → WANDERING → TERRITORIAL          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│       │                                                                         │
│       ├──────────────────┬──────────────────┬──────────────────┐                │
│       ▼                  ▼                  ▼                  ▼                │
│  ┌─────────┐       ┌───────────┐     ┌───────────┐      ┌───────────┐           │
│  │ SELF-   │       │ FOUND BY  │     │ STRANGER  │      │ SHELTER   │           │
│  │ RETURN  │       │ SEARCHER  │     │ ENCOUNTER │      │ INTAKE    │           │
│  └────┬────┘       └─────┬─────┘     └─────┬─────┘      └─────┬─────┘           │
│       │                  │                 │                  │                 │
│       ▼                  ▼                 ▼                  ▼                 │
│  ┌─────────┐       ┌───────────┐     ┌───────────┐      ┌───────────┐           │
│  │RETURNED │       │ FOUND BY  │     │           │      │           │           │
│  │  HOME   │       │ SEARCHER  │     │  ┌───┴───┐│      │  ┌───┴───┐│           │
│  │  (15%*) │       │   (3%?)   │     │  │COLLAR ││      │  │MICROCHIP│           │
│  └─────────┘       └───────────┘     │  │RETURN ││      │  │ SCAN   ││           │
│                                      │  │(15%/hr)│      │  │ (70%)  ││           │
│                                      │  └───────┘│      │  └────────┘│           │
│                                      │  ┌───────┐│      │  ┌────────┐│           │
│                                      │  │SOCIAL ││      │  │SOCIAL  ││           │
│                                      │  │MEDIA  ││      │  │MEDIA   ││           │
│                                      │  │(2%/hr)││      │  │MATCH   ││           │
│                                      │  └───────┘│      │  └────────┘│           │
│                                      │  ┌───────┐│      │  ┌────────┐│           │
│                                      │  │TAKE TO││      │  │PLATFORM││           │
│                                      │  │SHELTER││      │  │MATCH   ││           │
│                                      │  └───────┘│      │  └────────┘│           │
│                                      └───────────┘      └───────────┘           │
│                                                                                 │
│  * Weiss 2012: Dogs 15%, Cats 59% self-return                                   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         TIMEOUT (NOT FOUND)                             │    │
│  │  - Still searching after max simulation hours                           │    │
│  │  - In shelter but not reunited                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Variable Classification Table

### 2.1 Pet Displacement / Movement

| Variable | Current Value | Status | Source | Confidence | Notes |
|----------|---------------|--------|--------|------------|-------|
| **Cat indoor-only median displacement** | 39m | VERIFIED | Huang 2018 | HIGH | n=42, GPS tracking |
| **Cat indoor-only 75th percentile** | 137m | VERIFIED | Huang 2018 | HIGH | Same study |
| **Cat indoor-outdoor median displacement** | 300m | VERIFIED | Huang 2018 | HIGH | n=42, GPS tracking |
| **Cat indoor-outdoor 75th percentile** | 1609m | VERIFIED | Huang 2018 | HIGH | Same study |
| **Dog median displacement** | 460m | DERIVED | Kremer 2021 | MEDIUM | Derived from quantiles |
| **Dog 75th percentile** | 1200m | DERIVED | Kremer 2021 | MEDIUM | Interpolated |
| **Dog 42% within 400ft (122m)** | 42% | VERIFIED | Kremer 2021 | HIGH | Survey data, n=? |
| **Dog 70% within 1 mile (1609m)** | 70% | VERIFIED | Kremer 2021 | HIGH | Survey data |
| Distribution shape | Log-normal | ASSUMED | - | MEDIUM | Standard for movement data |

**RESEARCH GAPS:**
- [ ] Dog GPS tracking study (comparable to Huang 2018 for cats)
- [ ] Bird displacement data
- [ ] Small animal (rabbit, ferret) displacement data
- [ ] Effect of prior outdoor experience on displacement
- [ ] Urban vs rural displacement differences

---

### 2.2 Pet Behavioral States

| Variable | Current Value | Status | Source | Confidence | Notes |
|----------|---------------|--------|--------|------------|-------|
| **Initial state** | FLEEING | ASSUMED | Lord 2007 | LOW | Logical but not quantified |
| **Fleeing duration (dogs)** | 120 min | ASSUMED | - | LOW | No empirical data |
| **Fleeing duration (cats)** | 60 min | ASSUMED | - | LOW | No empirical data |
| **Hiding behavior (cats)** | Yes, high | VERIFIED | Lord 2007 | HIGH | Well-documented |
| **Hiding behavior (dogs)** | Yes, low | ASSUMED | - | MEDIUM | Less documented |
| **Foraging timing** | Dawn/dusk | ASSUMED | General biology | MEDIUM | Species-typical |
| **Cat nocturnal activity** | 1.5x night modifier | ASSUMED | - | LOW | Needs quantification |

**State Transition Probabilities (ALL ASSUMED):**

| From State | To State | Trigger | Current P | Confidence |
|------------|----------|---------|-----------|------------|
| FLEEING | HIDING | Energy < 0.2 | 100% | LOW |
| FLEEING | HIDING | Time > 120min | 100% | LOW |
| FLEEING | WANDERING | Time > 120min | 30% | LOW |
| HIDING | FORAGING | Hunger > 0.5 + dawn/dusk | 30% | LOW |
| HIDING | FORAGING | Hunger > 0.85 | 25% | LOW |
| FORAGING | HIDING | Daytime + random | 30% | LOW |
| FORAGING | WANDERING | Hunger < 0.3 | 20% | LOW |
| WANDERING | TERRITORIAL | Time > 24hr | 10% | LOW |
| WANDERING | HIDING | Random | 2% | LOW |

**RESEARCH GAPS:**
- [ ] GPS/accelerometer studies on lost pet behavior over time
- [ ] State transition timing from actual lost pet cases
- [ ] Personality effects on state transitions (verified)
- [ ] How long do pets stay in each state?

---

### 2.3 Movement Speeds by State

| State | Current Speed (mi/5min) | Effective MPH | Status | Confidence |
|-------|------------------------|---------------|--------|------------|
| FLEEING | 0.04 | 0.48 | ASSUMED | LOW |
| HIDING | 0.001 | 0.012 | ASSUMED | LOW |
| FORAGING | 0.0083 | 0.10 | ASSUMED | LOW |
| WANDERING | 0.015 | 0.18 | ASSUMED | LOW |
| TERRITORIAL | 0.005 | 0.06 | ASSUMED | LOW |
| SHELTERED | 0 | 0 | LOGICAL | HIGH |

**Species Modifiers:**

| Species | Modifier | Status | Confidence |
|---------|----------|--------|------------|
| DOG | 1.4x | ASSUMED | MEDIUM |
| CAT | 0.7x | ASSUMED | MEDIUM |
| BIRD | 0.3x | ASSUMED | LOW |

**RESEARCH GAPS:**
- [ ] Actual movement speeds from GPS tracking of lost pets
- [ ] Speed variation by terrain type
- [ ] Speed variation by time of day

---

### 2.4 Self-Return Behavior

| Variable | Current Value | Status | Source | Confidence | Notes |
|----------|---------------|--------|--------|------------|-------|
| **Dog self-return rate** | 15% | VERIFIED | Weiss 2012 | HIGH | Large survey |
| **Cat self-return rate** | 59% | VERIFIED | Weiss 2012 | HIGH | Large survey |
| **Homing strength (dog)** | 0.15 | ASSUMED | - | LOW | Tuned to match 15% |
| **Homing strength (cat)** | 0.08 | ASSUMED | - | LOW | Tuned to match 59% |
| **Home detection radius** | 0.03 mi (50m) | ASSUMED | - | MEDIUM | Reasonable estimate |
| **Stay probability formula** | 0.3 + hunger×0.4 + fatigue×0.3 | ASSUMED | - | LOW | No empirical basis |
| **Minimum travel before return** | 0.05 mi (80m) | LOGICAL | - | HIGH | Prevents instant return |

**CRITICAL QUESTION:** How do we make the simulation PRODUCE 15%/59% self-return rates through emergent behavior rather than forcing it?

**RESEARCH GAPS:**
- [ ] What triggers a pet to return home vs. keep wandering?
- [ ] Time distribution of self-returns (when do they come back?)
- [ ] Distance traveled before self-return
- [ ] Role of familiarity with neighborhood

---

### 2.5 Stranger Encounter & Community Recovery

| Variable | Current Value | Status | Source | Confidence | Notes |
|----------|---------------|--------|--------|------------|-------|
| **Base encounter rate (daytime)** | 1% per 5min tick | ASSUMED | - | LOW | No data |
| **Base encounter rate (night)** | 0.2% per 5min tick | ASSUMED | - | LOW | No data |
| **Dog visibility modifier** | 1.5x | ASSUMED | - | MEDIUM | Dogs more visible |
| **Cat visibility modifier** | 0.7x | ASSUMED | - | MEDIUM | Cats hide more |
| **Friendly personality modifier** | 2.0x | ASSUMED | - | LOW | No data |
| **Timid personality modifier** | 0.3x | ASSUMED | - | LOW | No data |
| **Collar return rate** | 15% per hour | ASSUMED | - | LOW | No data |
| **Social media post rate** | 2% per hour | ASSUMED | - | LOW | No data |
| **Take to shelter rate** | ? | MISSING | - | - | Not modeled |

**RESEARCH GAPS:**
- [ ] How often do strangers actually encounter lost pets?
- [ ] What % of finders call collar numbers vs. post online vs. take to shelter?
- [ ] Effect of neighborhood density on encounter rate
- [ ] Effect of pet behavior on stranger approach
- [ ] Time delay between finding and taking action

---

### 2.6 Shelter Pathways

| Variable | Current Value | Status | Source | Confidence | Notes |
|----------|---------------|--------|--------|------------|-------|
| **Shelter intake rate** | Via transport event | ASSUMED | - | LOW | Simplified model |
| **Microchip scan rate** | 90% within 24hr | ASSUMED | - | MEDIUM | Most shelters scan |
| **Microchip reunion rate** | 70% if scanned | ASSUMED | - | LOW | Depends on current info |
| **Social media post rate (shelter)** | 30% × 60% × 80% | ASSUMED | - | LOW | Complex pathway |
| **Platform listing rate** | 40% × 100% × 30% | ASSUMED | - | LOW | Complex pathway |
| **Time to scan** | Linear over 24hr | ASSUMED | - | LOW | Varies by shelter |

**RESEARCH GAPS:**
- [ ] Actual shelter intake rates by region
- [ ] Time from intake to microchip scan
- [ ] Microchip database accuracy rates
- [ ] Shelter-to-owner reunion rates by method
- [ ] Stray hold times by jurisdiction

---

### 2.7 Active Search (Searcher Detection)

| Variable | Current Value | Status | Source | Confidence | Notes |
|----------|---------------|--------|--------|------------|-------|
| **Detection model** | Koopman POD | VERIFIED | Koopman 1980 | HIGH | SAR standard |
| **Sweep width (responsive dog)** | 100m | DERIVED | SAR data | MEDIUM | Adapted from human SAR |
| **Sweep width (unresponsive dog)** | 25m | DERIVED | SAR data | MEDIUM | Adapted |
| **Sweep width (responsive cat)** | 40m | DERIVED | SAR data | LOW | Less data |
| **Sweep width (unresponsive cat)** | 10m | DERIVED | SAR data | LOW | Less data |
| **Terrain modifier (open)** | 1.0 | DERIVED | SAR manuals | MEDIUM | Standard |
| **Terrain modifier (suburban)** | 0.7 | DERIVED | SAR manuals | MEDIUM | Standard |
| **Terrain modifier (urban)** | 0.4 | ASSUMED | - | LOW | No pet-specific data |
| **Terrain modifier (wooded)** | 0.3 | DERIVED | SAR manuals | MEDIUM | Standard |
| **Night modifier (flashlight)** | 0.3 | DERIVED | SAR manuals | MEDIUM | Standard |
| **Fatigue modifier** | 0.5-1.0 | ASSUMED | - | LOW | General principle |
| **Searcher speed** | 3 mph default | ASSUMED | - | MEDIUM | Reasonable walking pace |
| **Search start delay** | 2 hours default | ASSUMED | - | LOW | Varies widely |
| **Search hours** | 7am-9pm default | ASSUMED | - | MEDIUM | Reasonable |
| **Volunteer ramp-up** | 20% → 100% over 24hr | ASSUMED | - | LOW | No data |

**RESEARCH GAPS:**
- [ ] Pet-specific sweep width studies
- [ ] Effect of pet responsiveness on detection
- [ ] Optimal search strategies for pets (vs. humans)
- [ ] Volunteer mobilization patterns in real cases
- [ ] Effect of social media mobilization on search efforts

---

### 2.8 Environmental Factors

| Variable | Current Value | Status | Source | Confidence | Notes |
|----------|---------------|--------|--------|------------|-------|
| **Terrain types** | URBAN, SUBURBAN, RURAL, WOODED | ASSUMED | - | MEDIUM | Broad categories |
| **Barriers** | Water, highways (via OSM) | IMPLEMENTED | OSM | HIGH | Real geography |
| **Shelter zones** | Near vet/shelter locations | IMPLEMENTED | OSM | MEDIUM | May be incomplete |
| **Population density effect** | Not modeled | MISSING | - | - | Affects encounters |
| **Weather effects** | Not modeled | MISSING | - | - | Major factor |
| **Season effects** | Not modeled | MISSING | - | - | Daylight, temperature |
| **Traffic patterns** | Not modeled | MISSING | - | - | Barrier permeability |

**RESEARCH GAPS:**
- [ ] How does weather affect lost pet behavior?
- [ ] Seasonal variation in recovery rates
- [ ] Effect of holidays/events on search effectiveness
- [ ] Urban heat island effects on pet movement

---

### 2.9 Pet Characteristics

| Variable | Options | Effect | Status | Confidence |
|----------|---------|--------|--------|------------|
| **Species** | DOG, CAT, BIRD, OTHER | Movement, detection, behavior | PARTIAL | MEDIUM |
| **Size** | TINY → GIANT | Speed modifier (0.6-1.5x) | ASSUMED | LOW |
| **Personality** | FRIENDLY, NEUTRAL, SHY | Detection, encounter, hiding | ASSUMED | LOW |
| **Indoor/Outdoor history** | Boolean | Displacement distribution | VERIFIED | HIGH |
| **Microchip** | Boolean | Shelter reunion pathway | LOGICAL | HIGH |
| **Collar** | Boolean | Stranger return pathway | LOGICAL | HIGH |
| **Age** | Not modeled | MISSING | - | - |
| **Health status** | Not modeled | MISSING | - | - |
| **Breed** | Not modeled | MISSING | - | - |
| **Training level** | Not modeled | MISSING | - | - |
| **Spay/neuter status** | Not modeled | MISSING | - | - |

---

## 3. Assumption Dependency Map

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    ASSUMPTION DEPENDENCY HIERARCHY                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  TIER 1: VERIFIED (Peer-reviewed, cited)                                        │
│  ════════════════════════════════════════                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Cat Displacement│  │ Dog Displacement│  │ Self-Return %   │                  │
│  │ Huang 2018      │  │ Kremer 2021     │  │ Weiss 2012      │                  │
│  │ n=42, GPS       │  │ Survey quantiles│  │ Large survey    │                  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                    │                           │
│           ▼                    ▼                    ▼                           │
│  TIER 2: DERIVED (Mathematically derived from Tier 1)                           │
│  ═════════════════════════════════════════════════════                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Log-normal      │  │ Dog median/σ    │  │ Homing strength │                  │
│  │ parameters μ,σ  │  │ from quantiles  │  │ calibrated to   │                  │
│  │ from median/q75 │  │                 │  │ match outcomes  │                  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                  │
│           │                    │                    │                           │
│           ▼                    ▼                    ▼                           │
│  TIER 3: ASSUMED (Reasonable but unvalidated)                                   │
│  ═════════════════════════════════════════════                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Movement speeds │  │ State transition│  │ Stranger        │                  │
│  │ by state        │  │ probabilities   │  │ encounter rates │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Personality     │  │ Size modifiers  │  │ Shelter pathway │                  │
│  │ effects         │  │                 │  │ probabilities   │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│                                                                                 │
│  TIER 4: MISSING (Not modeled, potentially significant)                         │
│  ══════════════════════════════════════════════════════                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Weather effects │  │ Breed-specific  │  │ Age/health      │                  │
│  │                 │  │ behavior        │  │ effects         │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Population      │  │ Time since      │  │ Prior escape    │                  │
│  │ density effects │  │ last feeding    │  │ history         │                  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Validation Targets

To validate the simulation produces realistic results, we need to match these known outcomes:

| Metric | Target Value | Source | Current Sim | Status |
|--------|--------------|--------|-------------|--------|
| Dog self-return rate | 15% | Weiss 2012 | ~70%? | ❌ TOO HIGH |
| Cat self-return rate | 59% | Weiss 2012 | ? | UNKNOWN |
| Dog overall recovery | 93% | Weiss 2012 | 100% | ❌ TOO HIGH |
| Cat overall recovery | 75% | Weiss 2012 | ? | UNKNOWN |
| Median time to find (dog) | ? | MISSING | ? | NO TARGET |
| Median time to find (cat) | ? | MISSING | ? | NO TARGET |
| % found by search | ? | MISSING | ~3% | NO TARGET |
| % found via shelter | ? | MISSING | ? | NO TARGET |

**CRITICAL:** The simulation currently produces ~100% success which doesn't match the 93%/75% real-world rates from Weiss 2012.

---

## 5. Sensitivity Analysis Priority

Based on uncertainty and impact, these parameters need sensitivity analysis:

### HIGH PRIORITY (High uncertainty + High impact)
1. **Stranger encounter rate** - Drives social recovery pathway
2. **Self-return stay probability** - Drives largest outcome category
3. **State transition probabilities** - Affects all movement patterns
4. **Movement speeds by state** - Affects displacement and search intersection

### MEDIUM PRIORITY
5. Shelter pathway probabilities
6. Detection sweep widths for pets
7. Personality effect magnitudes
8. Size effect magnitudes

### LOWER PRIORITY
9. Terrain modifiers (have SAR basis)
10. Time-of-day effects
11. Fatigue effects

---

## 6. Recommended Research to Fill Gaps

### Near-term (Can derive from existing data)
1. Analyze ASPCA/shelter databases for recovery method breakdown
2. Survey lost pet finders about their actions
3. Analyze social media lost pet posts for timing patterns

### Medium-term (Primary research needed)
4. GPS tracking study on intentionally "lost" pets (ethical challenges)
5. Survey of successful pet recoveries with detailed timelines
6. Analysis of microchip database reunion rates

### Long-term (Major studies)
7. Multi-site prospective study of lost pet cases
8. Controlled search strategy effectiveness study
9. Weather/season impact analysis across large dataset

---

## 7. Known Bugs / Issues Fixed

| Issue | Status | Fix |
|-------|--------|-----|
| Instant self-return on first tick | ✅ FIXED | Require 0.05mi travel first |
| Stranger return checked every tick | ✅ FIXED | Rate-limit to once per hour |
| Still 100% success rate | ❓ INVESTIGATING | May need probability tuning |

---

## 8. Next Steps for Research-Grade Simulation

1. **Calibration Study**: Run parameter sweeps to find values that produce Weiss 2012 outcomes
2. **Sensitivity Analysis**: Implement tornado diagrams for key uncertainties
3. **Validation Dataset**: Collect real lost pet cases with known outcomes for backtesting
4. **Confidence Intervals**: Report uncertainty bounds on all predictions
5. **Peer Review**: Document methodology for external review

---

## References

1. Weiss, E., Slater, M., & Lord, L. K. (2012). Frequency of lost dogs and cats in the United States and the methods used to locate them. Animals, 2(2), 301-315.

2. Huang, L., Coradini, M., Rand, J., Morton, J., Albrecht, K., Wahlberg, B., & Robertson, D. (2018). Search Methods Used to Locate Missing Cats and Locations Where Missing Cats Are Found. Animals, 8(1), 5.

3. Lord, L. K., Ingwersen, W., Gray, J. L., & Wintz, D. J. (2007). Characterization of animals with microchips entering animal shelters. Journal of the American Veterinary Medical Association, 231(2), 237-241.

4. Kremer, E. (2021). Missing Animal Response Network data analysis. [Specific publication details needed]

5. Koopman, B. O. (1980). Search and screening: general principles with historical applications. Pergamon Press.

6. Koester, R. J. (2008). Lost person behavior: A search and rescue guide on where to look for land, air and water. dbS Productions.
