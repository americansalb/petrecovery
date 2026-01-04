# Monte Carlo Simulation Fix Plan

## Status: PHASES 1-4 COMPLETE

Last updated: 2026-01-04

## Executive Summary

After thorough code review, the simulation architecture is **fundamentally sound** - it uses proper agent-based modeling with research-backed parameters. However, there are **12 specific issues** causing unreliable results. This plan addresses them in priority order.

**Key Finding:** You do NOT need to start from scratch. Targeted fixes will resolve the problems.

### Completed Fixes

- [x] **Phase 1:** Fixed probability compounding bug in `checkSelfReturn()` - now uses decaying probability model
- [x] **Phase 2:** Recalibrated stranger encounter rate from 1%/tick to 0.2%/tick to match Weiss 2012
- [x] **Phase 3:** Consolidated engines - emergent engine is now primary, legacy deprecated
- [x] **Phase 4:** Added confidence intervals (Wilson score) and granular death statistics

---

## Phase 1: Fix Probability Compounding Bug (HIGH PRIORITY)

### Problem
Location: `engine.js:362-405` (`checkSelfReturn()`)

The self-return logic has a compounding probability bug. Each time a pet visits the home zone, it independently rolls a 30-40% chance to stay. Over multiple visits:

```
P(stay eventually) = 1 - (1 - 0.35)^n
10 visits: 1 - 0.65^10 = 97.5% (should be ~35%)
```

This artificially inflates self-return rates far above the verified Weiss 2012 data (59% cats, 15% dogs).

### Solution
Track home zone visits and only allow ONE stay-check per simulation, or use a decaying probability model where each failed stay reduces future stay probability.

### Files Changed
- `frontend/app/lib/simulator/engine.js`

---

## Phase 2: Recalibrate Stranger Encounter Rate (HIGH PRIORITY)

### Problem
Location: `engine.js:416-441` (`checkStrangerEncounter()`)

```javascript
const baseEncounterRate = isDaytime ? 0.01 : 0.002; // per 5-minute tick
```

This 1% per 5-minute tick rate means:
- 12 ticks/hour × 14 hours/day = ~168 rolls/day
- P(encounter in 3 days) = 1 - (0.99)^504 = 99.4%

But Weiss 2012 shows only **26% of dogs** are found by strangers. The rate is way too high.

### Solution
Work backwards from Weiss 2012:
- Target: 26% stranger recovery over 72 hours
- Account for capture probability after encounter
- Derive a realistic base encounter rate

### Files Changed
- `frontend/app/lib/simulator/engine.js`
- `frontend/app/lib/simulator/researchConfig.js` (add citation)

---

## Phase 3: Consolidate to Single Engine (MEDIUM PRIORITY)

### Problem
Two parallel engines exist:
- `engine.js` (legacy, 814 lines)
- `emergent/engine.js` (new, 945 lines)

The adapter (`emergent/adapter.js`) maps 15+ emergent outcomes to 7 legacy outcomes, losing information. This creates confusion about which engine is authoritative.

### Solution
1. Deprecate legacy engine
2. Update API routes to use emergent engine directly
3. Remove adapter's lossy mapping
4. Keep full outcome granularity (DECEASED_TRAFFIC, REUNITED_TRAP, etc.)

### Files Changed
- `frontend/app/api/simulator/route.js`
- `frontend/app/lib/simulator/emergent/adapter.js` (remove)
- `frontend/app/lib/simulator/engine.js` (deprecation notice)

---

## Phase 4: Add Sensitivity Analysis (MEDIUM PRIORITY)

### Problem
36% of parameters are UNVERIFIED (estimates). The simulation runs as if they're validated.

Key uncertain parameters:
| Parameter | Current Value | Plausible Range |
|-----------|---------------|-----------------|
| Stranger encounter rate | 0.01/tick | 0.001-0.02 |
| Detection rate | 0.002/step | 0.0005-0.01 |
| Movement speeds | Various | 0.5x-2x current |
| Search start delay | 2 hours | 0.5-12 hours |

### Solution
1. Add Monte Carlo parameter sampling using `researchConfig.js` bounds
2. Show confidence intervals on outputs, not just point estimates
3. Add UI warning when high-uncertainty parameters dominate results

### Files Changed
- `frontend/app/lib/simulator/emergent/engine.js`
- `frontend/app/lib/simulator/researchConfig.js`
- `frontend/app/components/SimulationResults.js` (show CI)

---

## Phase 5: Validate Against Research Benchmarks (LOW PRIORITY)

### Problem
Validation tests exist but only check:
- Displacement distribution (passes)
- Overall recovery rate (passes)
- Recovery mode split (passes)

NOT validated:
- Recovery timeline
- Search strategy effectiveness
- Detection mechanics

### Solution
1. Add timeline validation tests against Huang 2018 (cats: 34% by day 7)
2. Add search effectiveness sanity checks
3. Flag when simulated outcomes diverge >20% from research

### Files Changed
- `frontend/app/lib/simulator/__tests__/validation.test.js`
- `frontend/app/lib/simulator/researchConfig.js`

---

## Implementation Order

| Phase | Effort | Impact | Dependencies |
|-------|--------|--------|--------------|
| 1     | ~1 hour | HIGH | None |
| 2     | ~2 hours | HIGH | None |
| 3     | ~3 hours | MEDIUM | Phases 1-2 |
| 4     | ~2 hours | MEDIUM | Phase 3 |
| 5     | ~1 hour | LOW | Phase 4 |

---

## Success Criteria

After all fixes:

1. **Self-return rate matches Weiss 2012**
   - Dogs: ~15% (±5%)
   - Cats: ~59% (±10%)

2. **Stranger recovery rate matches Weiss 2012**
   - Dogs: ~26% (±5%)
   - Cats: ~9% (other) (±3%)

3. **Single authoritative engine**
   - No outcome mapping loss
   - All 15+ outcomes preserved

4. **Uncertainty shown in results**
   - Confidence intervals on recovery rate
   - Warning for high-uncertainty scenarios

---

## Questions Before Proceeding

1. **Do you want to keep backward compatibility with the legacy API?** (If not, Phase 3 is simpler)

2. **Should deaths be shown in results?** (Emergent engine tracks DECEASED_TRAFFIC, DECEASED_DEHYDRATION etc. Currently hidden)

3. **What's your target audience?** (Affects how much uncertainty to show)

---

## Ready to Start?

If this plan looks good, I'll begin with **Phase 1: Fix the probability compounding bug**. This is a concrete code fix that will immediately improve simulation accuracy.
