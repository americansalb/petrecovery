# Research-Backed Calibration Implementation Plan

## Overview

This plan implements peer-reviewed parameters from the research documentation into the Lost Pet Simulator. Each phase is self-contained and testable.

**Status Key:**
- `VERIFIED` - Peer-reviewed source with citation
- `UNVERIFIED` - Placeholder requiring Phase 0 research

---

## Phase 1: Research Configuration Module
**Goal:** Create centralized config with all parameters and citations

### Files to Create:
- `frontend/app/lib/simulator/researchConfig.js`

### Parameters to Include:

| Parameter | Value | Source | Status |
|-----------|-------|--------|--------|
| Cat median displacement | 50m (0.031 mi) | Huang 2018 | VERIFIED |
| Cat 75th percentile | 182m (0.113 mi) | Huang 2018 | VERIFIED |
| Cat recovery rate | 74.9% | Weiss 2012 | VERIFIED |
| Cat self-return rate | 59% of recoveries | Weiss 2012 | VERIFIED |
| Dog median displacement | 0.39 mi | Kremer 2021 | VERIFIED |
| Dog 75th percentile | 1.22 mi | Kremer 2021 | VERIFIED |
| Dog recovery rate | 93% | Weiss 2012 | VERIFIED |
| Dog found via search | 49% of recoveries | Weiss 2012 | VERIFIED |
| Microchip RTO multiplier | 2.4x | Lord 2009 | VERIFIED |
| Collar/tag effect | +51.2% recovery | Lord 2007 | VERIFIED |

### Deliverable:
```javascript
// researchConfig.js exports:
export const VERIFIED_PARAMS = { ... }
export const UNVERIFIED_PARAMS = { ... }
export const CITATIONS = { ... }
```

---

## Phase 2: Log-Normal Displacement Model
**Goal:** Replace linear movement with research-backed displacement distribution

### Files to Create:
- `frontend/app/lib/simulator/displacement.js`

### Implementation:
```javascript
// Log-normal sampling that produces:
// - Cat: median 50m, 75th 182m
// - Dog: median 0.39mi, 75th 1.22mi
export function sampleDisplacement(species, random) { ... }
```

### Changes to Existing Files:
- `petBehavior.js` - Import and use `sampleDisplacement()` for final position calculation

### Validation Criteria:
- 1000 cat samples → median within ±10% of 50m
- 1000 dog samples → median within ±10% of 0.39mi

---

## Phase 3: Species-Specific Recovery Mechanisms
**Goal:** Implement distinct recovery pathways matching research

### Files to Create:
- `frontend/app/lib/simulator/recovery.js`

### Recovery Modes:

**Cats (per Weiss 2012):**
| Mode | Percentage |
|------|------------|
| Self-return | 59% |
| Owner search | 30% |
| Shelter intake | 11% |

**Dogs (per Weiss 2012):**
| Mode | Percentage |
|------|------------|
| Active search | 49% |
| Stranger return | 26% |
| Self-return | 15% |
| Shelter intake | 10% |

### Changes to Existing Files:
- `engine.js` - Use `determineRecoveryMode()` for outcome determination
- `detection.js` - Adjust detection rates based on recovery mode

---

## Phase 4: Validation Test Suite
**Goal:** Ensure simulation outputs match research baselines

### Files to Create:
- `frontend/app/lib/simulator/validation.js`
- `frontend/app/lib/simulator/__tests__/validation.test.js`

### Tests:

| Test | Expected | Tolerance |
|------|----------|-----------|
| Cat median displacement | 50m | ±20% |
| Cat recovery rate (72h) | 74.9% | ±10% |
| Cat self-return proportion | 59% | ±15% |
| Dog median displacement | 0.39mi | ±20% |
| Dog recovery rate (72h) | 93% | ±5% |
| Microchip effect | 2.4x RTO | ±20% |

### Validation Command:
```bash
npm run test:validation
```

---

## Phase 5: Sensitivity Analysis Framework
**Goal:** Document impact of UNVERIFIED parameters

### Files to Create:
- `frontend/app/lib/simulator/sensitivity.js`

### UNVERIFIED Parameters to Analyze:
| Parameter | Current Value | Range to Test |
|-----------|---------------|---------------|
| STATE_SPEEDS.FLEEING | 0.04 mi/5min | 0.01 - 0.1 |
| STATE_SPEEDS.HIDING | 0.001 mi/5min | 0.0005 - 0.005 |
| Detection base rate | 0.002 | 0.001 - 0.01 |
| Volunteer fatigue curve | Linear | Linear/Exponential |
| Search delay hours | 2 | 0.5 - 8 |

### Output:
Report showing which UNVERIFIED parameters most affect outcomes, prioritizing Phase 0 research.

---

## Phase 6: Integration & Cleanup
**Goal:** Wire everything together, remove empirical calibration

### Changes to Existing Files:

**`petBehavior.js`:**
- Import `VERIFIED_PARAMS` from researchConfig
- Replace hardcoded speeds with config values
- Add `// UNVERIFIED` comments to remaining placeholders
- Use displacement sampling for movement calculations

**`engine.js`:**
- Import recovery mechanisms
- Use research-backed volunteer timing
- Add recovery mode tracking to simulation output

**`detection.js`:**
- Adjust base rates per recovery mode
- Apply microchip/collar multipliers from research

**`SimulatorMap.js`:**
- Update probability zone colors/labels to match research distributions

---

## Implementation Order

```
Week 1:
├── Phase 1: researchConfig.js (Day 1-2)
├── Phase 2: displacement.js (Day 2-3)
└── Phase 3: recovery.js (Day 3-4)

Week 2:
├── Phase 4: validation.js + tests (Day 1-2)
├── Phase 5: sensitivity.js (Day 2-3)
└── Phase 6: Integration (Day 3-5)

Week 3:
└── Phase 0 Research (ongoing, informed by sensitivity analysis)
```

---

## Success Criteria

Before any simulation results can inform product decisions:

1. [ ] All VERIFIED parameters have inline citations
2. [ ] All UNVERIFIED parameters are flagged in code
3. [ ] Validation tests pass within tolerance
4. [ ] Sensitivity analysis identifies critical UNVERIFIED params
5. [ ] Phase 0 researcher has prioritized list of params needing sources

---

## Files Summary

### New Files (6):
```
frontend/app/lib/simulator/
├── researchConfig.js      # Phase 1: Centralized params + citations
├── displacement.js        # Phase 2: Log-normal sampling
├── recovery.js            # Phase 3: Species-specific recovery modes
├── validation.js          # Phase 4: Research baseline comparison
├── sensitivity.js         # Phase 5: UNVERIFIED param analysis
└── __tests__/
    └── validation.test.js # Phase 4: Automated tests
```

### Modified Files (4):
```
frontend/app/lib/simulator/
├── petBehavior.js         # Phase 6: Use research config
├── engine.js              # Phase 6: Recovery mode tracking
├── detection.js           # Phase 6: Research-backed rates
└── terrain.js             # No changes needed
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Each phase has validation tests |
| Research sources contested | All citations in CITATIONS object, easy to update |
| New parameters cause regressions | Run 1000-sim validation after each phase |
| Sensitivity analysis reveals major gaps | Prioritizes Phase 0 research focus |

---

## Notes for Reviewer

1. **No timeline estimates** - Phases are ordered by dependency, not duration
2. **Phase 0 is parallel** - Research can proceed while implementation happens
3. **Simulation runs paused** - No product decisions until Phase 4 passes
4. **Architecture unchanged** - This is calibration, not refactoring
