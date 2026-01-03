# Research-Backed Calibration Implementation Plan

## Overview

This plan implements peer-reviewed parameters from the research documentation into the Lost Pet Simulator. Each phase is self-contained and testable.

**Status Key:**
- `VERIFIED` - Peer-reviewed source with citation
- `DERIVED` - Calculated from verified data to fit distribution
- `UNVERIFIED` - Placeholder requiring Phase 0 research

---

## Phase 1: Research Configuration Module
**Goal:** Create centralized config with all parameters and citations

### Files to Create:
- `frontend/app/lib/simulator/researchConfig.js`

### Cat Displacement Parameters (Huang 2018, Table 2):

| Lifestyle | Median | 75th Percentile | Source | Status |
|-----------|--------|-----------------|--------|--------|
| Indoor-only | 39m (0.024 mi) | 137m (0.085 mi) | Huang 2018 | VERIFIED |
| Indoor-outdoor | 300m (0.186 mi) | 1,609m (1.0 mi) | Huang 2018 | VERIFIED |

**Note:** The 50m combined average masks an 8× behavioral difference. Simulation MUST stratify by indoor/outdoor status.

### Dog Displacement Parameters (Kremer 2021):

| Parameter | Value | Derivation | Status |
|-----------|-------|------------|--------|
| Median displacement | ~200m (0.12 mi) | DERIVED to reproduce Kremer quantiles | DERIVED |
| 75th percentile | ~800m (0.5 mi) | DERIVED to reproduce Kremer quantiles | DERIVED |

**Source data from Kremer 2021:**
- 42% found within 400 feet (122m)
- 70% found within 1 mile (1,609m)

The derived log-normal parameters (μ, σ) must reproduce these quantiles. The 0.39 mi figure in the previous draft was incorrect.

### Recovery Rates (Weiss 2012):

| Species | Overall Recovery | Time Frame | Status |
|---------|-----------------|------------|--------|
| Dogs | 93% | Overall (any time) | VERIFIED |
| Cats | 75% (74.9%) | Overall (any time) | VERIFIED |

**Cat Recovery Timeline (Huang 2018):**
| Time Point | Cumulative Recovery |
|------------|---------------------|
| Day 7 | 34% |
| Day 30 | 50% |
| Day 61+ | Remaining found |

### Recovery Mode Distribution (Weiss 2012):

**Cats:**
| Mode | Percentage | Status |
|------|------------|--------|
| Self-return | 59% | VERIFIED |
| Owner search | 30% | VERIFIED |
| Shelter intake | 2% | VERIFIED (CI: 0.04-10%) |
| Other (neighbor found, etc.) | 9% | VERIFIED |

**Dogs:**
| Mode | Percentage | Status |
|------|------------|--------|
| Active search | 49% | VERIFIED |
| Stranger return | 26% | VERIFIED |
| Self-return | 15% | VERIFIED |
| Shelter intake | 10% | VERIFIED |

### Microchip Parameters (Lord 2009):

| Parameter | Value | Status |
|-----------|-------|--------|
| Dog shelter RTO rate (microchipped) | 52.2% | VERIFIED |
| Cat shelter RTO rate (microchipped) | 38.5% | VERIFIED |
| Microchip registration rate | 58.1% | VERIFIED |
| RTO multiplier vs. non-chipped | 2.4× | VERIFIED |

**Implementation note:** Before applying RTO rates, check if chip is registered (58.1% probability).

### Collar/Tag Parameters:

| Parameter | Value | Source | Status |
|-----------|-------|--------|--------|
| Collar/tag recovery effect | +51.2% | Lord 2007 (needs page/table) | NEEDS VERIFICATION |

**Action required:** Locate specific table/page in Lord 2007 or flag as UNVERIFIED.

### Deliverable:
```javascript
// researchConfig.js exports:
export const CAT_DISPLACEMENT = {
  indoorOnly: { median: 39, q75: 137, unit: 'meters' },    // Huang 2018
  indoorOutdoor: { median: 300, q75: 1609, unit: 'meters' } // Huang 2018
};

export const DOG_DISPLACEMENT = {
  median: 200,   // DERIVED from Kremer 2021 quantiles
  q75: 800,      // DERIVED from Kremer 2021 quantiles
  unit: 'meters'
};

export const RECOVERY_RATES = { ... };
export const MICROCHIP = { ... };
export const CITATIONS = { ... };
```

---

## Phase 2: Log-Normal Displacement Model
**Goal:** Replace linear movement with research-backed displacement distribution

### Files to Create:
- `frontend/app/lib/simulator/displacement.js`

### Implementation:

```javascript
// Log-normal parameters derived to match research quantiles
// For indoor-only cats: median=39m, q75=137m
// For indoor-outdoor cats: median=300m, q75=1609m
// For dogs: median=200m, q75=800m (derived from Kremer quantiles)

export function sampleDisplacement(species, lifestyle, random) {
  const params = getLogNormalParams(species, lifestyle);
  return sampleLogNormal(params.mu, params.sigma, random);
}
```

### Changes to Existing Files:
- `petBehavior.js` - Import and use `sampleDisplacement()` for final position
- Add `lifestyle` parameter to cat simulation config (indoor-only vs indoor-outdoor)

### Validation Criteria:
- 1000 indoor-only cat samples → median within ±10% of 39m
- 1000 indoor-outdoor cat samples → median within ±10% of 300m
- 1000 dog samples → 42% within 122m, 70% within 1609m (Kremer quantiles)

---

## Phase 3: Species-Specific Recovery Mechanisms
**Goal:** Implement distinct recovery pathways matching research

### Files to Create:
- `frontend/app/lib/simulator/recovery.js`
- `frontend/app/lib/simulator/shelter.js`

### Recovery Mode Implementation:

**Cats (Weiss 2012):**
```javascript
const CAT_RECOVERY_MODES = {
  SELF_RETURN: 0.59,
  OWNER_SEARCH: 0.30,
  SHELTER: 0.02,
  OTHER: 0.09
};
```

**Dogs (Weiss 2012):**
```javascript
const DOG_RECOVERY_MODES = {
  ACTIVE_SEARCH: 0.49,
  STRANGER_RETURN: 0.26,
  SELF_RETURN: 0.15,
  SHELTER: 0.10
};
```

### Shelter Pathway (shelter.js):

```javascript
export function processShelterIntake(pet, random) {
  const hasMicrochip = pet.microchipped;
  const isRegistered = hasMicrochip && random() < 0.581; // 58.1% registration rate

  if (!isRegistered) {
    return { rtoRate: 0.0 }; // No chip scan benefit
  }

  // Lord 2009 shelter RTO rates
  const rtoRate = pet.species === 'dog' ? 0.522 : 0.385;
  return { rtoRate };
}
```

### Changes to Existing Files:
- `engine.js` - Use `determineRecoveryMode()` for outcome determination
- `detection.js` - Adjust detection rates based on recovery mode
- `SimulatorConfig.js` - Add cat lifestyle selector (indoor-only/indoor-outdoor)

---

## Phase 4: Validation Test Suite
**Goal:** Ensure simulation outputs match research baselines

### Files to Create:
- `frontend/app/lib/simulator/validation.js`
- `frontend/app/lib/simulator/__tests__/validation.test.js`

### Displacement Tests:

| Test | Expected | Tolerance | Source |
|------|----------|-----------|--------|
| Indoor-only cat median | 39m | ±20% | Huang 2018 |
| Indoor-outdoor cat median | 300m | ±20% | Huang 2018 |
| Dog % within 400ft | 42% | ±10% | Kremer 2021 |
| Dog % within 1 mile | 70% | ±10% | Kremer 2021 |

### Recovery Tests (run simulation to completion):

| Test | Expected | Tolerance | Source |
|------|----------|-----------|--------|
| Dog overall recovery | 93% | ±5% | Weiss 2012 |
| Cat overall recovery | 75% | ±10% | Weiss 2012 |
| Cat self-return proportion | 59% | ±15% | Weiss 2012 |
| Dog found via search | 49% | ±15% | Weiss 2012 |

### Timeline Tests (cats only):

| Test | Expected | Tolerance | Source |
|------|----------|-----------|--------|
| Cat recovery by day 7 | 34% | ±15% | Huang 2018 |
| Cat recovery by day 30 | 50% | ±15% | Huang 2018 |

### Microchip Tests:

| Test | Expected | Tolerance | Source |
|------|----------|-----------|--------|
| Microchipped dog shelter RTO | 52.2% | ±10% | Lord 2009 |
| Microchipped cat shelter RTO | 38.5% | ±10% | Lord 2009 |
| Chip registration check | 58.1% registered | ±10% | Lord 2009 |

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

| Parameter | Current Value | Range to Test | Priority |
|-----------|---------------|---------------|----------|
| STATE_SPEEDS.FLEEING | 0.04 mi/5min | 0.01 - 0.1 | High |
| STATE_SPEEDS.HIDING | 0.001 mi/5min | 0.0005 - 0.005 | Medium |
| Detection base rate | 0.002 | 0.001 - 0.01 | High |
| Collar/tag effect | +51.2% | +20% - +80% | High (pending verification) |
| Volunteer fatigue curve | Linear | Linear/Exponential | Low |
| Search delay hours | 2 | 0.5 - 8 | Medium |

### Output:
Tornado diagram showing parameter sensitivity, prioritizing Phase 0 research on high-impact UNVERIFIED params.

---

## Phase 6: Integration & Cleanup
**Goal:** Wire everything together, remove empirical calibration

### Changes to Existing Files:

**`petBehavior.js`:**
- Import `CAT_DISPLACEMENT`, `DOG_DISPLACEMENT` from researchConfig
- Replace hardcoded speeds with config values
- Add `// UNVERIFIED` comments to remaining placeholders
- Use `sampleDisplacement(species, lifestyle)` for movement

**`engine.js`:**
- Import recovery mechanisms from recovery.js
- Track recovery mode in simulation output
- Implement timeline-aware recovery (cats slower than dogs)

**`detection.js`:**
- Apply microchip logic via shelter.js
- Flag collar/tag effect as NEEDS VERIFICATION pending citation check

**`SimulatorConfig.js`:**
- Add cat lifestyle dropdown: "Indoor-only" / "Indoor-outdoor"
- Update probability zone labels to reflect indoor/outdoor distinction

**`SimulatorMap.js`:**
- Render different probability zones based on cat lifestyle
- Indoor-only: smaller zones (39m median)
- Indoor-outdoor: larger zones (300m median)

---

## Implementation Order

```
Phase 1: researchConfig.js
├── All verified parameters with citations
├── Derived parameters flagged as DERIVED
└── Collar/tag effect flagged as NEEDS VERIFICATION

Phase 2: displacement.js
├── Log-normal sampling for each species/lifestyle
├── Unit tests for distribution shape
└── Integration with petBehavior.js

Phase 3: recovery.js + shelter.js
├── Recovery mode determination
├── Shelter pathway with microchip logic
└── Cat lifestyle config in UI

Phase 4: validation.js + tests
├── Displacement distribution tests
├── Overall recovery rate tests (NOT 72h)
├── Timeline tests for cats (day 7, day 30)
└── Microchip shelter RTO tests

Phase 5: sensitivity.js
├── Parameter sweep framework
├── Tornado diagram output
└── Priority ranking for Phase 0 research

Phase 6: Integration
├── Wire all modules together
├── Update UI for cat lifestyle
└── Flag all remaining UNVERIFIED params
```

---

## Success Criteria

Before any simulation results can inform product decisions:

1. [ ] All VERIFIED parameters have inline citations with page/table references
2. [ ] All DERIVED parameters document their derivation method
3. [ ] All UNVERIFIED parameters are flagged in code
4. [ ] Collar/tag citation verified or downgraded to UNVERIFIED
5. [ ] Validation tests pass within tolerance
6. [ ] Cat lifestyle stratification implemented and tested
7. [ ] Microchip registration check (58.1%) implemented
8. [ ] Timeline tests pass (cat recovery at day 7, day 30)
9. [ ] Sensitivity analysis identifies critical UNVERIFIED params

---

## Files Summary

### New Files (7):
```
frontend/app/lib/simulator/
├── researchConfig.js      # Phase 1: Centralized params + citations
├── displacement.js        # Phase 2: Log-normal sampling by species/lifestyle
├── recovery.js            # Phase 3: Species-specific recovery modes
├── shelter.js             # Phase 3: Shelter pathway + microchip logic
├── validation.js          # Phase 4: Research baseline comparison
├── sensitivity.js         # Phase 5: UNVERIFIED param analysis
└── __tests__/
    └── validation.test.js # Phase 4: Automated tests
```

### Modified Files (5):
```
frontend/app/lib/simulator/
├── petBehavior.js         # Phase 6: Use research config + displacement
├── engine.js              # Phase 6: Recovery mode tracking
├── detection.js           # Phase 6: Research-backed rates
├── SimulatorConfig.js     # Phase 3: Cat lifestyle selector
└── SimulatorMap.js        # Phase 6: Lifestyle-aware probability zones
```

---

## Corrections from Previous Draft

| Issue | Previous Value | Corrected Value |
|-------|----------------|-----------------|
| Cat displacement | Single 50m value | Split: 39m indoor-only, 300m indoor-outdoor |
| Cat 75th percentile | 182m (unsourced) | 137m indoor-only, 1609m indoor-outdoor |
| Dog median | 0.39 mi | ~0.12 mi (derived from Kremer quantiles) |
| Cat shelter intake | 11% | 2% (Weiss 2012) |
| Recovery test timing | 72h | Overall recovery (no 72h benchmark exists) |
| Microchip | Multiplier only | Added baseline rates + registration check |
| Collar/tag | VERIFIED | NEEDS VERIFICATION (citation unclear) |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Each phase has validation tests |
| Research sources contested | All citations include page/table references |
| Derived parameters inaccurate | Document derivation, validate against source quantiles |
| Cat lifestyle unknown | Default to indoor-outdoor (conservative larger radius) |
| Sensitivity analysis reveals major gaps | Prioritizes Phase 0 research focus |

---

## Notes for Reviewer

1. **No timeline estimates** - Phases are ordered by dependency, not duration
2. **Phase 0 is parallel** - Research can proceed while implementation happens
3. **Simulation runs paused** - No product decisions until Phase 4 passes
4. **Indoor/outdoor distinction** - This is the most impactful correction; 8× difference in search radius
5. **DERIVED vs VERIFIED** - Dog displacement params are mathematically derived from Kremer's reported quantiles, not directly stated in the paper
