# Emergent Monte Carlo Simulation - Behavioral Mechanics

## Core Philosophy

**NO hardcoded outcome probabilities.** All outcomes emerge from the interaction of behavioral mechanics, environment, and search efforts.

If simulated outcomes don't match empirical data (Weiss 2012, Huang 2018), we adjust the **underlying behavioral mechanics**, not outcome probabilities.

---

## 1. Pet Agent State Machine

The pet transitions through behavioral states based on internal drives and external stimuli:

```
FLEEING → HIDING → FORAGING → TRAVELING → SHELTERING
    ↑                                          ↓
    └──────────── (fear spike) ←───────────────┘
```

### States

| State | Description | Movement | Visibility |
|-------|-------------|----------|------------|
| FLEEING | Panicked, running from threat | Fast, erratic | High |
| HIDING | Concealed, waiting for safety | None | Very low |
| FORAGING | Seeking food/water | Slow, local | Medium |
| TRAVELING | Moving purposefully | Moderate | High |
| SHELTERING | With human/in shelter | None | Low |

### State Transition Triggers

- **FLEEING → HIDING**: Fear decreases below 0.5, finds concealment
- **HIDING → FORAGING**: Hunger or thirst exceeds 0.7
- **FORAGING → TRAVELING**: Physiological needs met, fear low
- **TRAVELING → FLEEING**: New threat (fear spike)
- **Any → SHELTERING**: Captured by stranger or enters shelter

---

## 2. Fear Dynamics

Fear is the primary driver of behavior. It decays exponentially over time but can spike from new threats.

### Fear Formula
```
F(t) = F₀ × e^(-λt)

Where:
- F₀ = Initial fear (0-1) based on escape type
- λ = Decay rate (0.0003/min for cats, 0.0005/min for dogs)
- t = Minutes since escape/last spike
```

### Fear Half-Lives
- Cats: ~40 hours (2,400 minutes)
- Dogs: ~24 hours (1,400 minutes)

### Initial Fear by Escape Type

| Escape Type | Initial Fear | Description |
|-------------|-------------|-------------|
| DISASTER | 0.95 | Fire, earthquake, tornado |
| CHASED_BY_ANIMAL | 0.90 | Coyote, dog, aggressive animal |
| LOUD_NOISE_STARTLE | 0.85 | Fireworks, thunder, construction |
| FELL_FROM_VEHICLE | 0.80 | Jumped/fell from car |
| DOOR_DASH | 0.60 | Bolted when door opened |
| GATE_LEFT_OPEN | 0.30 | Wandered out of yard |
| WANDERED | 0.20 | Gradually expanded territory |

### Fear Effects on Behavior

| Fear Level | Behavioral Effect |
|------------|-------------------|
| > 0.8 | FLEEING state, rapid erratic movement |
| 0.5 - 0.8 | HIDING state, minimal movement |
| 0.3 - 0.5 | Cautious FORAGING |
| < 0.3 | TRAVELING, may approach home |

---

## 3. Physiology System

Pets have physiological needs that drive foraging behavior and affect survival.

### Physiological Drives

| Drive | Increase Rate | Critical Threshold | Death Threshold |
|-------|---------------|-------------------|-----------------|
| Hunger | 0.0002/min | 0.7 (triggers foraging) | 1.0 for 7 days |
| Thirst | 0.0005/min | 0.7 (triggers foraging) | 1.0 for 48 hours |
| Energy | -0.0001/min when moving | 0.3 (triggers rest) | 0 (collapses) |

### Foraging Success

Probability of finding food/water depends on:
- Terrain type (urban = dumpsters, suburban = yards, rural = streams)
- Time spent foraging
- Pet's previous outdoor experience (indoor-only = 50% penalty)

---

## 4. Movement Mechanics

### Speed by State (miles/hour)

| State | Cat | Dog (medium) |
|-------|-----|--------------|
| FLEEING | 1.5 | 3.0 |
| FORAGING | 0.1 | 0.2 |
| TRAVELING | 0.3 | 0.8 |
| HIDING | 0 | 0 |

### Displacement Targets (Huang 2018)

| Pet Type | Median Displacement | 75th Percentile |
|----------|---------------------|-----------------|
| Indoor-only cat | 39 meters | 137 meters |
| Indoor-outdoor cat | 300 meters | 1,609 meters |
| Small dog | 0.5 miles | 1.5 miles |
| Large dog | 1.5 miles | 5 miles |

### Movement Direction

1. **FLEEING**: Random direction away from threat
2. **FORAGING**: Random walk within small radius
3. **TRAVELING**: Biased toward home (if fear low) or away (if fear high)

---

## 5. Stranger Encounter System

### Encounter Probability

```
P(encounter) = human_density × pet_visibility × time_step

Where:
- human_density varies by terrain and time of day
- pet_visibility varies by state (HIDING = 0.1, TRAVELING = 0.8)
```

### Human Density by Terrain & Time

| Terrain | Base Density | Rush Hour | Night |
|---------|--------------|-----------|-------|
| Urban | 0.003 | ×1.5 | ×0.1 |
| Suburban | 0.001 | ×1.5 | ×0.1 |
| Rural | 0.0002 | ×1.2 | ×0.05 |
| Wooded | 0.0001 | ×1.0 | ×0.02 |

### Stranger Encounter Flow

```
Stranger sees pet
     │
     ├─→ Pet approaches? (based on temperament + fear)
     │        │
     │        ├─→ Yes: Capture attempt
     │        │        │
     │        │        ├─→ Success (temperament-based)
     │        │        │        │
     │        │        │        └─→ What does stranger do?
     │        │        │              ├─→ Has tags → 80% calls owner
     │        │        │              ├─→ Recognizes from posting? (visibility score)
     │        │        │              ├─→ Takes to shelter (40%)
     │        │        │              ├─→ Posts online (30%)
     │        │        │              └─→ Keeps pet (30%)
     │        │        │
     │        │        └─→ Failure: Pet escapes
     │        │
     │        └─→ No: Pet observed, not captured
     │
     └─→ Report sighting? (based on visibility score + collar)
              │
              └─→ If reported: Search team focuses on this area
```

---

## 6. Visibility Score (Outreach Effect)

The visibility score represents how likely strangers are to recognize the pet from owner's outreach efforts.

### Visibility Score Calculation

```
visibility_score = base (0.10)
                 + posted_on_social_media (0.25)
                 + posted_flyers (0.20)
                 + contacted_shelters (0.15)
                 + listed_on_platform (0.15)

Max: 0.85 (if all outreach done)
```

### Visibility Score Effects

| Visibility Score | Effect |
|-----------------|--------|
| 0.10 (base) | 10% chance stranger recognizes pet |
| 0.35 | 35% recognition + 51% report probability |
| 0.60 | 60% recognition + 66% report probability |
| 0.85 | 85% recognition + 81% report probability |

### Report Probability Formula

```
P(report) = 0.20 (base)
          + visibility_score × 0.60
          + has_collar × 0.30
```

---

## 7. Sighting & Search Focus Mechanic

When a sighting is reported, the search team focuses on that area, increasing detection probability.

### Search Focus Boost

```
If pet is within 0.5 miles of reported sighting:
  proximity_boost = max(1, 10 - distance × 18)   // 10x at 0, 1x at 0.5mi
  time_decay = e^(-minutes_since_sighting / 720)  // Half-life of 12 hours

  detection_rate *= proximity_boost × time_decay
```

### Example

| Distance from Sighting | Time Since | Detection Boost |
|------------------------|------------|-----------------|
| 0 miles | 0 hours | 10x |
| 0 miles | 12 hours | 5x |
| 0.25 miles | 6 hours | 4.5x |
| 0.5 miles | 24 hours | 1x (no boost) |

---

## 8. Searcher Detection

### Base Detection Formula

```
P(detection) = base_rate × visibility × terrain_mod × light_mod × sighting_boost

Where:
- base_rate = 0.0001 per tick per searcher
- visibility = pet's current visibility (0-1)
- terrain_mod = {URBAN: 0.5, SUBURBAN: 1.0, RURAL: 1.5, WOODED: 0.3}
- light_mod = {DAY: 1.0, NIGHT: 0.2}
- sighting_boost = from reported sightings (see above)
```

### Post-Detection Outcomes

```
Searcher detects pet
     │
     ├─→ Is it the owner?
     │        │
     │        ├─→ Yes: Use recall training × (1 - fear×0.5)
     │        │        │
     │        │        ├─→ Pet approaches → REUNITED_OWNER_SEARCH
     │        │        └─→ Pet flees → Continue search
     │        │
     │        └─→ No (volunteer): Use stranger_approach_prob × (1 - fear)
     │                 │
     │                 ├─→ Pet approaches → REUNITED_SEARCH_TEAM
     │                 └─→ Pet flees → Sighting recorded
```

---

## 9. Temperament Effects

### Temperament Modifiers

| Behavior | Gregarious | Aloof | Xenophobic |
|----------|------------|-------|------------|
| Stranger approach | 0.6 | 0.2 | 0.05 |
| Stranger capture success | 0.9 | 0.6 | 0.3 |
| Flee from searcher | 0.2 | 0.5 | 0.8 |
| Self-return probability | 1.2× | 1.0× | 0.8× |

### Species Defaults

| Species | Default Temperament | Notes |
|---------|---------------------|-------|
| Dog | Gregarious | Most dogs approach strangers |
| Cat (indoor-only) | Xenophobic | Scared, hides close to home |
| Cat (indoor-outdoor) | Aloof | Cautious but experienced |

---

## 10. Outcome Categories

### FOUND (Reunited with Owner)

| Outcome | Trigger |
|---------|---------|
| REUNITED_SELF_RETURN | Pet reaches home, fear < 0.3, stays |
| REUNITED_OWNER_SEARCH | Owner detects + captures pet |
| REUNITED_SEARCH_TEAM | Volunteer detects + captures pet |
| REUNITED_STRANGER_DIRECT | Stranger captures, calls from tags or recognizes from posting |
| REUNITED_STRANGER_POST | Stranger captures, posts online, owner sees |
| REUNITED_SHELTER | Pet at shelter, microchip scanned or owner visits |
| REUNITED_TRAP | Pet enters humane trap |
| REUNITED_CALLED | Pet responds to owner's call |

### NOT FOUND

| Outcome | Trigger |
|---------|---------|
| STILL_MISSING | Simulation ends, no resolution |
| AT_SHELTER_PENDING | At shelter, no match yet |
| WITH_STRANGER_PENDING | Stranger holding, no contact yet |
| ADOPTED_BY_FINDER | Stranger kept pet, no return attempt |
| ADOPTED_FROM_SHELTER | Shelter adopted out after holding period |
| DECEASED_TRAFFIC | Hit by vehicle |
| DECEASED_PREDATOR | Killed by coyote, etc. |
| DECEASED_DEHYDRATION | Thirst at max for 48+ hours |
| DECEASED_STARVATION | Hunger at max for 7+ days |

---

## 11. Validation Benchmarks

The simulation is validated against empirical research:

### Cat Recovery (Weiss 2012, Huang 2018)

| Metric | Target | Tolerance |
|--------|--------|-----------|
| Overall recovery rate | 74.9% | ±10% |
| Self-return rate | 59% | ±15% |
| Indoor-only displacement | 39m median | log ±0.5 |
| Indoor-outdoor displacement | 300m median | log ±0.5 |

### Dog Recovery (Weiss 2012, Lord 2009)

| Metric | Target | Tolerance |
|--------|--------|-----------|
| Overall recovery rate | 93% | ±10% |
| Active search success | 49% | ±15% |
| Stranger return rate | 26% | ±15% |

---

## 12. Key Formulas Summary

| Mechanic | Formula |
|----------|---------|
| Fear decay | F(t) = F₀ × e^(-0.0003t) |
| Encounter prob | P = density × visibility × dt |
| Report prob | P = 0.2 + visibility×0.6 + collar×0.3 |
| Sighting boost | boost = proximity × e^(-t/720) |
| Detection prob | P = 0.0001 × vis × terrain × light × boost |
| Approach prob | P = temperament × (1 - fear) |

---

## Usage in Simulator

All these mechanics run every 5 minutes (configurable). No manual probability tuning needed - outcomes emerge naturally from the interactions.

To improve realism, adjust the **mechanics** (fear decay rate, movement speed, human density), not outcome probabilities.
