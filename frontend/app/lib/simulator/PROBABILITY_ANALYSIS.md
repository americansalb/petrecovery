# Probability Analysis: Why 100% Success Rate?

## Current Simulation Parameters (72-hour, 5-minute ticks = 864 ticks)

### Timeline
- **Total ticks**: 864 (72 hours × 12 ticks/hour)
- **Daytime ticks** (~14hr/day × 3 days): ~504 ticks
- **Nighttime ticks**: ~360 ticks

---

## Pathway 1: Self-Return

### Current Logic
```
P(return) = P(near home) × P(stay | near home)

P(stay) = 0.3 + (hunger × 0.4) + ((1-energy) × 0.3)
        = 0.3 to 0.7 depending on state
```

### Problem Analysis
- Pet starts at home, must travel 0.05mi first ✅ (fixed)
- But pet may return to home area MULTIPLE times during 72 hours
- Each time pet is within 0.03mi of home, stay check runs
- If pet visits home area 10 times with 50% stay probability:
  - P(return) = 1 - (1-0.5)^10 = **99.9%**

### The Issue
**The simulation doesn't track "already decided to stay"** - if pet passes through home zone multiple times, it has multiple chances to "decide" to stay.

### Proposed Fix
Either:
1. Once pet passes through home and doesn't stay, reduce future stay probability
2. Only check stay probability once per "visit" (when entering zone, not every tick in zone)
3. Add a "homing attempt cooldown"

---

## Pathway 2: Stranger Encounter → Social Return

### Current Logic
```
ENCOUNTER:
P(encounter per tick) = base × personality × species
                      = 0.01 × 1.0 × 1.5 = 0.015 (dog, daytime)

RETURN (after encounter):
P(collar return per hour) = 0.15 (hours 1-24)
P(social return per hour) = 0.02 (hours 12+)
```

### Probability Calculation

**Step 1: Encounter**
```
P(at least one encounter in 72hr) = 1 - (1 - 0.015)^504
                                  = 1 - 0.0005
                                  = 99.95%
```
→ Virtually every dog will have a stranger encounter

**Step 2: Return (given encounter at hour 12)**
```
Collar (hours 13-24): P = 1 - (1-0.15)^11 = 84%
Social (hours 24-72): P = 1 - (1-0.02)^48 = 62%
Combined: P ≈ 95%
```

**Combined Pathway:**
```
P(found via stranger) = 0.9995 × 0.95 = 95%
```

### The Issues
1. **Encounter rate too high** - 1.5% per 5min means near-certain encounter
2. **Return rates may be reasonable** individually but compound over time

### Proposed Fixes
Option A: Reduce encounter rate significantly
```
Current: 1% base → 1.5% for dogs
Proposed: 0.1% base → 0.15% for dogs

P(encounter) = 1 - (1-0.0015)^504 = 53%
```

Option B: Make encounter a one-time event per day (not per tick)
```
P(encounter per day) = 5-10%
P(encounter in 72hr) = 15-27%
```

---

## Pathway 3: Found by Searcher

### Current Logic
```
P(detection) = Koopman POD based on distance
             = 1 - exp(-coverage)

Coverage = (sweep_width × distance_traveled) / cell_area
```

### This pathway seems reasonably calibrated
- Only 3% of recoveries via searcher in test
- POD model is research-based
- Sweep widths are conservative

---

## Pathway 4: Shelter

### Current Logic (per hour, only when sheltered)
```
P(microchip reunion) = 0.7 × min(hours/24, 1) × 0.9
P(social reunion) = 0.3 × 0.6 × 0.8 × min(hours/48, 1) / 24
P(platform reunion) = 0.4 × 1.0 × 0.3 × min(hours/72, 1) / 24
```

### Analysis
Shelter intake is rare (requires transport event), so this pathway contributes minimally.

---

## Summary: Cumulative Success Probability

| Pathway | Current P | Target P | Issue |
|---------|-----------|----------|-------|
| Self-return | ~70% | 15% (dog) | Multiple stay checks compound |
| Stranger→Social | ~27% | ~10%? | Encounter rate too high |
| Found by search | ~3% | ~5%? | Seems OK |
| Shelter | ~0% | ~5%? | Low intake rate |
| **Total** | **~100%** | **~93%** | Multiple issues |
| **Timeout** | **~0%** | **~7%** | No failures possible |

---

## Recommended Parameter Changes

### Immediate Fixes

1. **Self-Return: Add visit cooldown**
```javascript
// Only check once per home zone visit
if (this.inHomeZone && !this.wasInHomeZone) {
  // First tick in home zone - check stay
  return this.random() < stayProbability;
}
// Already checked this visit
return false;
```

2. **Stranger Encounter: Reduce rate 10x**
```javascript
const baseEncounterRate = isDaytime ? 0.001 : 0.0002; // was 0.01 / 0.002
```

3. **Self-Return: Reduce base stay probability**
```javascript
const stayProbability = 0.1 + (this.pet.hunger * 0.3) + ((1 - this.pet.energy) * 0.2);
// was: 0.3 + hunger*0.4 + fatigue*0.3
// Max now 0.6 instead of 1.0
```

### After Fixes - Expected Outcomes

| Pathway | New P | Notes |
|---------|-------|-------|
| Self-return | ~15-20% | Matches Weiss 2012 for dogs |
| Stranger→Social | ~10-15% | More realistic |
| Found by search | ~5% | Unchanged |
| Shelter | ~5% | Unchanged |
| **Total** | **~85-90%** | Closer to 93% target |
| **Timeout** | **~10-15%** | Realistic failures |

---

## Validation Checklist

After fixes, verify:
- [ ] Dog self-return ≈ 15% (Weiss 2012)
- [ ] Cat self-return ≈ 59% (Weiss 2012)
- [ ] Overall dog recovery ≈ 93% (Weiss 2012)
- [ ] Overall cat recovery ≈ 75% (Weiss 2012)
- [ ] Timeout rate > 0%
- [ ] Distribution of outcomes looks reasonable
