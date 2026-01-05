/**
 * Outcome Enumeration for Emergent Simulation
 *
 * Complete enumeration of all possible simulation outcomes.
 * Each outcome has specific trigger conditions that are checked
 * during the simulation loop.
 *
 * NO probabilities are assigned to outcomes. They emerge from mechanics.
 */

// =============================================================================
// OUTCOME CATEGORIES
// =============================================================================

export const OUTCOME_CATEGORY = {
  REUNITED: 'REUNITED',           // Pet returned to owner
  ALIVE_NOT_REUNITED: 'ALIVE_NOT_REUNITED',  // Pet alive but not with owner
  DECEASED: 'DECEASED',           // Pet died
  INTERMEDIATE: 'INTERMEDIATE',   // Simulation ended without resolution
};

// =============================================================================
// COMPLETE OUTCOME ENUMERATION
// =============================================================================

export const OUTCOME = {
  // ----- REUNITED (Success) -----

  REUNITED_SELF_RETURN: {
    code: 'REUNITED_SELF_RETURN',
    category: OUTCOME_CATEGORY.REUNITED,
    description: 'Pet navigated home on its own',
    triggerCondition: 'Pet reaches home position, recognizes it, and stays',
  },

  REUNITED_OWNER_SEARCH: {
    code: 'REUNITED_OWNER_SEARCH',
    category: OUTCOME_CATEGORY.REUNITED,
    description: 'Owner/family found pet during active search',
    triggerCondition: 'Detection + capture by owner/family searcher',
  },

  REUNITED_SEARCH_TEAM: {
    code: 'REUNITED_SEARCH_TEAM',
    category: OUTCOME_CATEGORY.REUNITED,
    description: 'Non-family searcher found pet, returned to owner',
    triggerCondition: 'Detection + capture by volunteer/professional searcher',
  },

  REUNITED_STRANGER_DIRECT: {
    code: 'REUNITED_STRANGER_DIRECT',
    category: OUTCOME_CATEGORY.REUNITED,
    description: 'Stranger found pet, contacted owner via tags',
    triggerCondition: 'Stranger encounter + collar with visible tags + call made',
  },

  REUNITED_STRANGER_POST: {
    code: 'REUNITED_STRANGER_POST',
    category: OUTCOME_CATEGORY.REUNITED,
    description: 'Stranger found pet, posted online, owner saw post',
    triggerCondition: 'Stranger encounter + capture + online post + owner match',
  },

  REUNITED_SHELTER: {
    code: 'REUNITED_SHELTER',
    category: OUTCOME_CATEGORY.REUNITED,
    description: 'Pet went to shelter, owner retrieved via microchip or visit',
    triggerCondition: 'Shelter intake + (microchip scan match OR owner visit)',
  },

  REUNITED_TRAP: {
    code: 'REUNITED_TRAP',
    category: OUTCOME_CATEGORY.REUNITED,
    description: 'Pet captured in humane trap set by searchers',
    triggerCondition: 'Pet in FORAGING state + near trap + enters trap',
  },

  REUNITED_CALLED: {
    code: 'REUNITED_CALLED',
    category: OUTCOME_CATEGORY.REUNITED,
    description: 'Pet responded to owner calling and approached',
    triggerCondition: 'Searcher calling + pet within audio range + pet responds',
  },

  // ----- ALIVE BUT NOT REUNITED -----

  ADOPTED_BY_FINDER: {
    code: 'ADOPTED_BY_FINDER',
    category: OUTCOME_CATEGORY.ALIVE_NOT_REUNITED,
    description: 'Stranger found pet and kept it',
    triggerCondition: 'Stranger encounter + capture + no reunion attempt + time elapsed',
  },

  ADOPTED_FROM_SHELTER: {
    code: 'ADOPTED_FROM_SHELTER',
    category: OUTCOME_CATEGORY.ALIVE_NOT_REUNITED,
    description: 'Pet went to shelter, adopted by someone else',
    triggerCondition: 'Shelter intake + holding period expires + no owner claim',
  },

  FERAL_PERMANENTLY: {
    code: 'FERAL_PERMANENTLY',
    category: OUTCOME_CATEGORY.ALIVE_NOT_REUNITED,
    description: 'Pet survives but becomes feral, never recovered',
    triggerCondition: 'Extended time (>30 days) + territorial establishment + no contact',
  },

  // ----- DECEASED -----

  DECEASED_TRAFFIC: {
    code: 'DECEASED_TRAFFIC',
    category: OUTCOME_CATEGORY.DECEASED,
    description: 'Killed by vehicle',
    triggerCondition: 'Pet crosses road cell + traffic encounter + fatal outcome',
  },

  DECEASED_PREDATOR: {
    code: 'DECEASED_PREDATOR',
    category: OUTCOME_CATEGORY.DECEASED,
    description: 'Killed by predator (coyote, etc.)',
    triggerCondition: 'Predator encounter + lethal outcome roll',
  },

  DECEASED_EXPOSURE: {
    code: 'DECEASED_EXPOSURE',
    category: OUTCOME_CATEGORY.DECEASED,
    description: 'Died from weather exposure',
    triggerCondition: 'Extended exposure + inadequate shelter + health reaches 0',
  },

  DECEASED_DEHYDRATION: {
    code: 'DECEASED_DEHYDRATION',
    category: OUTCOME_CATEGORY.DECEASED,
    description: 'Died from dehydration',
    triggerCondition: 'Thirst at 1.0 for extended period (>48 hours)',
  },

  DECEASED_STARVATION: {
    code: 'DECEASED_STARVATION',
    category: OUTCOME_CATEGORY.DECEASED,
    description: 'Died from starvation',
    triggerCondition: 'Hunger at 1.0 for extended period (>7 days)',
  },

  DECEASED_INJURY: {
    code: 'DECEASED_INJURY',
    category: OUTCOME_CATEGORY.DECEASED,
    description: 'Died from injury',
    triggerCondition: 'Accumulated injury > 1.0',
  },

  DECEASED_EUTHANIZED: {
    code: 'DECEASED_EUTHANIZED',
    category: OUTCOME_CATEGORY.DECEASED,
    description: 'Shelter euthanized pet',
    triggerCondition: 'Shelter intake at kill-shelter + holding period + no claim',
  },

  // ----- INTERMEDIATE (Simulation ended without resolution) -----

  STILL_MISSING: {
    code: 'STILL_MISSING',
    category: OUTCOME_CATEGORY.INTERMEDIATE,
    description: 'Simulation time limit reached, pet still missing',
    triggerCondition: 'max_simulation_time reached with no terminal outcome',
  },

  AT_SHELTER_PENDING: {
    code: 'AT_SHELTER_PENDING',
    category: OUTCOME_CATEGORY.INTERMEDIATE,
    description: 'Pet is at shelter, outcome pending',
    triggerCondition: 'Shelter intake occurred, within holding period',
  },

  WITH_STRANGER_PENDING: {
    code: 'WITH_STRANGER_PENDING',
    category: OUTCOME_CATEGORY.INTERMEDIATE,
    description: 'Stranger is holding pet, outcome pending',
    triggerCondition: 'Stranger captured pet, reunion process ongoing',
  },

  SIGHTED_NOT_CAPTURED: {
    code: 'SIGHTED_NOT_CAPTURED',
    category: OUTCOME_CATEGORY.INTERMEDIATE,
    description: 'Pet was seen but escaped',
    triggerCondition: 'Detection occurred but capture failed',
  },
};

// =============================================================================
// OUTCOME TRACKING
// =============================================================================

/**
 * Track outcome-related state during simulation
 */
export class OutcomeTracker {
  constructor() {
    this.outcome = null;
    this.outcomeMinute = null;
    this.outcomeDetails = {};

    // Intermediate states
    this.isAtShelter = false;
    this.shelterIntakeMinute = null;
    this.isWithStranger = false;
    this.strangerCaptureMinute = null;

    // Sighting history
    this.sightings = [];
    this.reportedSightings = [];  // Sightings reported to owner/search team
    this.lastReportedSightingMinute = null;

    // Health tracking for deceased outcomes
    this.injury = 0;
    this.consecutiveTicksAtMaxThirst = 0;
    this.consecutiveTicksAtMaxHunger = 0;
  }

  /**
   * Record a sighting
   */
  recordSighting(lat, lng, minute, confidence, source) {
    this.sightings.push({
      lat,
      lng,
      minute,
      confidence,  // HIGH, MEDIUM, LOW
      source,      // SEARCHER, STRANGER, CAMERA, etc.
      reported: false,
    });
  }

  /**
   * Record a reported sighting (to owner/search team)
   * This will attract searchers to this location
   */
  recordReportedSighting(lat, lng, minute, source, visibilityScore) {
    const sighting = {
      lat,
      lng,
      minute,
      source,
      visibilityScore,
    };
    this.reportedSightings.push(sighting);
    this.lastReportedSightingMinute = minute;

    // Mark the original sighting as reported
    const lastSighting = this.sightings[this.sightings.length - 1];
    if (lastSighting) {
      lastSighting.reported = true;
    }
  }

  /**
   * Get most recent reported sighting location for search team to focus on
   */
  getSearchFocusLocation() {
    if (this.reportedSightings.length === 0) return null;
    return this.reportedSightings[this.reportedSightings.length - 1];
  }

  /**
   * Set the final outcome
   */
  setOutcome(outcomeCode, minute, details = {}) {
    if (this.outcome !== null) {
      return;  // Silently ignore - outcome already determined
    }

    this.outcome = outcomeCode;
    this.outcomeMinute = minute;
    this.outcomeDetails = details;
  }

  /**
   * Check if simulation has reached a terminal outcome
   */
  isTerminal() {
    if (this.outcome === null) return false;

    const outcomeInfo = OUTCOME[this.outcome];
    return outcomeInfo &&
           outcomeInfo.category !== OUTCOME_CATEGORY.INTERMEDIATE;
  }

  /**
   * Get summary for results
   */
  getSummary() {
    return {
      outcome: this.outcome,
      outcomeMinute: this.outcomeMinute,
      outcomeHours: this.outcomeMinute ? this.outcomeMinute / 60 : null,
      outcomeDetails: this.outcomeDetails,
      category: this.outcome ? OUTCOME[this.outcome]?.category : null,
      description: this.outcome ? OUTCOME[this.outcome]?.description : null,
      sightingCount: this.sightings.length,
      sightings: this.sightings,
    };
  }
}

// =============================================================================
// VALIDATION BENCHMARKS
// =============================================================================

/**
 * Empirical benchmarks for validating simulation outputs
 *
 * IMPORTANT: These are NOT inputs to the simulation.
 * They are targets for checking whether the model is realistic.
 * If outputs don't match, we adjust behavioral mechanics, not outcome probabilities.
 */
export const VALIDATION_BENCHMARKS = {
  dogs: {
    source: 'Weiss 2012, Lord 2009',
    overallRecoveryRate: 0.93,

    recoveryModeDistribution: {
      // How dogs are typically found (Weiss 2012)
      ACTIVE_SEARCH: 0.49,      // Owner/searcher found
      STRANGER_RETURN: 0.26,    // Good Samaritan found and returned
      SELF_RETURN: 0.15,        // Pet came home on own
      SHELTER: 0.06,            // Found at shelter
      OTHER: 0.04,
    },

    shelterRTOWithMicrochip: 0.522,    // Lord 2009
    shelterRTOWithoutMicrochip: 0.22,  // Lord 2009 (estimated)

    // Time to recovery (no good source, estimates)
    medianRecoveryDays: 2,
  },

  cats: {
    source: 'Weiss 2012, Huang 2018, Lord 2009',
    overallRecoveryRate: 0.749,

    recoveryModeDistribution: {
      SELF_RETURN: 0.59,        // Weiss 2012
      OWNER_SEARCH: 0.30,       // Weiss 2012
      SHELTER: 0.02,            // Weiss 2012
      OTHER: 0.09,              // Neighbor found, etc.
    },

    shelterRTOWithMicrochip: 0.385,    // Lord 2009
    shelterRTOWithoutMicrochip: 0.02,  // Lord 2009 (very low)

    // Displacement (Huang 2018)
    displacement: {
      indoorOnly: {
        median_meters: 39,
        q75_meters: 137,
      },
      indoorOutdoor: {
        median_meters: 300,
        q75_meters: 1609,
      },
    },

    // Time to recovery (Huang 2018)
    percentRecoveredDay7: 0.34,
    percentRecoveredDay30: 0.50,
    medianRecoveryDays: 5,
  },
};

/**
 * Compare simulation outputs to benchmarks
 *
 * @param {Object} simulationResults - Aggregated results from batch run
 * @param {string} species - 'DOG' or 'CAT'
 * @returns {Object} Comparison with pass/fail indicators
 */
export function validateAgainstBenchmarks(simulationResults, species) {
  const benchmarks = species === 'DOG'
    ? VALIDATION_BENCHMARKS.dogs
    : VALIDATION_BENCHMARKS.cats;

  const comparisons = [];

  // Overall recovery rate
  const simRecoveryRate = simulationResults.recoveryRate;
  const expectedRecoveryRate = benchmarks.overallRecoveryRate;
  const recoveryRateDiff = Math.abs(simRecoveryRate - expectedRecoveryRate);

  comparisons.push({
    metric: 'Overall recovery rate',
    simulated: simRecoveryRate,
    expected: expectedRecoveryRate,
    difference: recoveryRateDiff,
    tolerance: 0.10,  // 10% tolerance
    pass: recoveryRateDiff < 0.10,
    source: benchmarks.source,
  });

  // Self-return rate
  if (simulationResults.selfReturnRate !== undefined) {
    const expectedSelfReturn = species === 'DOG'
      ? benchmarks.recoveryModeDistribution.SELF_RETURN
      : benchmarks.recoveryModeDistribution.SELF_RETURN;

    const selfReturnDiff = Math.abs(simulationResults.selfReturnRate - expectedSelfReturn);

    comparisons.push({
      metric: 'Self-return rate',
      simulated: simulationResults.selfReturnRate,
      expected: expectedSelfReturn,
      difference: selfReturnDiff,
      tolerance: 0.15,  // 15% tolerance (more variance expected)
      pass: selfReturnDiff < 0.15,
      source: 'Weiss 2012',
    });
  }

  // Displacement (cats only)
  if (species === 'CAT' && simulationResults.displacementMedian !== undefined) {
    const isIndoorOnly = simulationResults.isIndoorOnly;
    const expectedDisplacement = isIndoorOnly
      ? benchmarks.displacement.indoorOnly
      : benchmarks.displacement.indoorOutdoor;

    // Convert simulation result to meters
    const simMedianMeters = simulationResults.displacementMedian * 1609.34;
    const expectedMedianMeters = expectedDisplacement.median_meters;

    // Log-scale comparison (displacement is log-normal)
    const logRatio = Math.log(simMedianMeters / expectedMedianMeters);

    comparisons.push({
      metric: 'Displacement median',
      simulated: simMedianMeters,
      expected: expectedMedianMeters,
      difference: Math.abs(logRatio),
      tolerance: 0.5,  // Within factor of ~1.6
      pass: Math.abs(logRatio) < 0.5,
      source: 'Huang 2018',
    });
  }

  // Summary
  const passCount = comparisons.filter(c => c.pass).length;
  const totalCount = comparisons.length;

  return {
    species,
    comparisons,
    passCount,
    totalCount,
    overallPass: passCount === totalCount,
    summary: `${passCount}/${totalCount} benchmarks passed`,
  };
}
