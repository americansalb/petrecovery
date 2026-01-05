# Monte Carlo Simulation - EMERGENT DESIGN

## CRITICAL: NO CALIBRATED OUTCOME TARGETING

**This simulation is PURELY EMERGENT. Outcomes are NOT targeted to match any statistics.**

- We do NOT calibrate base rates to hit Weiss 2012 percentages
- We do NOT tune probabilities to produce expected recovery rates
- Whatever outcomes emerge from the physics ARE the outcomes
- If results differ from published research, that's data about our model

---

## How It Works (The Right Way)

### Input: Physical/Behavioral Parameters
- Pet speed (based on species, size, energy)
- Detection distance (Koopman POD model)
- Population density (terrain type, time of day)
- Pet visibility (behavior state, hiding vs moving)
- Fear decay (exponential model)
- Physiological needs (hunger, thirst, energy)

### Process: Agent-Based Simulation
1. Pet moves according to behavior state machine
2. Searchers move according to search pattern
3. Strangers encounter based on population density × visibility
4. Detection occurs when distance < detection threshold
5. Outcomes are checked each tick based on current state

### Output: Whatever Emerges
- Could be 30% recovery, could be 80% - depends on config
- NOT tuned to match any research statistics
- Research is for VALIDATION (comparing), not CALIBRATION (targeting)

---

## Files Changed for Emergent Design

### `emergent/petAgent.js` - calculateStayProbability()
Probability based ONLY on:
- Physiological needs (hunger, thirst, exhaustion)
- Fear level
- Home recognition (indoor vs outdoor history)
- Territorial bond (species difference)
- Behavioral commitment decay

NOT based on target self-return percentages.

### `emergent/engine.js` - checkStrangerEncounter()
Encounter rate based ONLY on:
- Pet visibility (behavior state, size)
- Population density (time of day)
- Terrain density (urban/suburban/rural)

NOT based on target stranger-found percentages.

### `emergent/engine.js` - handleStrangerCapture()
What stranger does based on:
- Does pet have visible ID?
- Did owner post flyers?
- Random human behavior

NOT calibrated to outcome statistics.

---

## Test Results (After Emergent Refactor)

Config: Dog, no collar, no tags, no chip, suburban
Results (n=50):
- REUNITED: 46%
- DECEASED: 4%
- STILL_MISSING: 50%

These are the ACTUAL emergent results. We don't "fix" them to match research.

---

## What We Use Research For

Research (Weiss 2012, Huang 2018) is used for:
1. **VALIDATION** - Comparing our emergent results to published data
2. **BEHAVIORAL PARAMETERS** - Displacement distances, hiding durations
3. **SANITY CHECKS** - Are results in reasonable ballpark?

Research is NOT used for:
- Setting base rates to hit target percentages
- Calibrating probabilities to match outcome distributions
- Working backwards from desired results
