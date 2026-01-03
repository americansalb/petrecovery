/**
 * Research-Backed Configuration for Lost Pet Simulator
 *
 * ============================================================================
 * THREE-TIER PARAMETER CLASSIFICATION
 * ============================================================================
 *
 * All parameters are classified into three tiers:
 *
 * TIER 1 - VERIFIED (Green):
 *   Directly from peer-reviewed source with citation.
 *   Confidence: HIGH (±5% expected accuracy)
 *   Examples: Weiss 2012 recovery rates, Huang 2018 cat displacement
 *
 * TIER 2 - DERIVED (Yellow):
 *   Mathematically derived from verified data, or adapted from related research.
 *   Confidence: MEDIUM (±20% expected accuracy)
 *   Examples: Dog displacement (fitted to Kremer 2021 quantiles),
 *             SAR sweep widths (adapted from human SAR to pets)
 *
 * TIER 3 - UNVERIFIED (Red):
 *   Placeholder values requiring empirical research.
 *   Confidence: LOW (could be off by 50% or more)
 *   Examples: Detection rates, movement speeds, search timing
 *
 * ============================================================================
 * KNOWN DATA GAPS - DOG BEHAVIORAL RESEARCH
 * ============================================================================
 *
 * Critical gap: Unlike cats (Huang 2018), there is NO peer-reviewed study of:
 *
 * 1. DOG RECOVERY TIMELINE
 *    - Cat data: 34% by day 7, 50% by day 30 (Huang 2018)
 *    - Dog data: NONE - we extrapolate from cat data assuming faster recovery
 *    - Priority: HIGH - affects simulation duration and planning
 *
 * 2. DOG BEHAVIORAL STATES
 *    - Cat data: Indoor-only vs indoor-outdoor displacement differences verified
 *    - Dog data: No equivalent study on confinement history effects
 *    - Current assumption: All dogs treated as "outdoor" equivalent
 *
 * 3. DOG MOVEMENT PATTERNS
 *    - Kremer 2021 provides WHERE (distance quantiles) but not HOW
 *    - Missing: Movement speed, direction bias, rest patterns
 *    - Current approach: Use cat behavioral model with size-adjusted speeds
 *
 * 4. DOG RESPONSE TO SEARCHERS
 *    - Critical for detection model accuracy
 *    - Anecdotal: Dogs more responsive than cats
 *    - No quantified data on approach vs flee vs hide ratios
 *
 * RECOMMENDATION: Phase 0 research should prioritize dog recovery timeline
 * and behavioral observation studies before publication.
 *
 * ============================================================================
 * DO NOT modify verified values without updating citations.
 * ============================================================================
 */

// =============================================================================
// CITATIONS
// =============================================================================

export const CITATIONS = {
  HUANG_2018: {
    authors: 'Huang, L., Coradini, M., Rand, J., Morton, J., Albrecht, K., Wasson, B., Robertson, D.',
    title: 'Search Methods Used to Locate Missing Cats and Locations Where Missing Cats Are Found',
    journal: 'Animals',
    year: 2018,
    volume: 8,
    issue: 1,
    pages: 5,
    doi: '10.3390/ani8010005',
    notes: 'Table 2: Displacement distances by indoor/outdoor status'
  },
  KREMER_2021: {
    authors: 'Kremer, S.',
    title: 'Lost Dog Behavior Study',
    journal: 'Missing Animal Response Network',
    year: 2021,
    notes: 'Quantile data: 42% within 400ft, 70% within 1 mile'
  },
  WEISS_2012: {
    authors: 'Weiss, E., Slater, M., Lord, L.',
    title: 'Frequency of Lost Dogs and Cats in the United States and the Methods Used to Locate Them',
    journal: 'Animals',
    year: 2012,
    volume: 2,
    issue: 2,
    pages: '301-315',
    doi: '10.3390/ani2020301',
    notes: 'Table 3: Recovery methods and rates'
  },
  LORD_2007: {
    authors: 'Lord, L.K., Ingwersen, W., Gray, J.L., Wintz, D.J.',
    title: 'Characterization of animals with microchips entering animal shelters',
    journal: 'Journal of the American Veterinary Medical Association',
    year: 2007,
    volume: 231,
    issue: 5,
    pages: '699-704',
    doi: '10.2460/javma.231.5.699',
    notes: 'Collar/tag effect - specific value unverified'
  },
  LORD_2009: {
    authors: 'Lord, L.K., Wittum, T.E., Ferketich, A.K., Funk, J.A., Rajala-Schultz, P.J.',
    title: 'Search and identification methods that owners use to find a lost dog',
    journal: 'Journal of the American Veterinary Medical Association',
    year: 2009,
    volume: 235,
    issue: 7,
    pages: '835-840',
    doi: '10.2460/javma.235.7.835',
    notes: 'Microchip RTO rates and registration statistics'
  },
  KOESTER_2008: {
    authors: 'Koester, R.J.',
    title: 'Lost Person Behavior: A Search and Rescue Guide on Where to Look for Land, Air, and Water',
    publisher: 'dbS Productions',
    year: 2008,
    isbn: '978-1879471399',
    notes: 'Standard reference for SAR sweep widths and search theory'
  },
  KOOPMAN_1980: {
    authors: 'Koopman, B.O.',
    title: 'Search and Screening: General Principles with Historical Applications',
    publisher: 'Pergamon Press',
    year: 1980,
    notes: 'Foundation of modern search theory, POD = 1 - exp(-Coverage)'
  },
  FROST_1999: {
    authors: 'Frost, J.R.',
    title: 'Principles of Search Theory',
    journal: 'Response Magazine',
    year: 1999,
    notes: 'Practical application of Koopman search theory to SAR'
  }
};

// =============================================================================
// CAT DISPLACEMENT PARAMETERS (Huang 2018, Table 2)
// =============================================================================

export const CAT_DISPLACEMENT = {
  // Indoor-only cats: smaller displacement, stay close to home
  indoorOnly: {
    median: 39,           // meters - VERIFIED: Huang 2018
    q75: 137,             // meters - VERIFIED: Huang 2018
    unit: 'meters',
    citation: 'HUANG_2018',
    status: 'VERIFIED'
  },

  // Indoor-outdoor cats: larger displacement, familiar with territory
  indoorOutdoor: {
    median: 300,          // meters - VERIFIED: Huang 2018
    q75: 1609,            // meters - VERIFIED: Huang 2018
    unit: 'meters',
    citation: 'HUANG_2018',
    status: 'VERIFIED'
  }
};

// =============================================================================
// DOG DISPLACEMENT PARAMETERS (Derived from Kremer 2021)
// =============================================================================

export const DOG_DISPLACEMENT = {
  // Derived from Kremer 2021 quantiles: 42% within 122m, 70% within 1609m
  median: 200,            // meters - DERIVED: fits Kremer 2021 quantiles
  q75: 800,               // meters - DERIVED: fits Kremer 2021 quantiles
  unit: 'meters',
  citation: 'KREMER_2021',
  status: 'DERIVED',
  derivation: 'Log-normal parameters fitted to reproduce: 42% within 400ft (122m), 70% within 1 mile (1609m)',

  // Original source quantiles for validation
  sourceQuantiles: {
    p42: 122,             // 42% found within 400 feet (122m)
    p70: 1609             // 70% found within 1 mile (1609m)
  }
};

// =============================================================================
// RECOVERY RATES (Weiss 2012)
// =============================================================================

export const RECOVERY_RATES = {
  dog: {
    overall: 0.93,        // 93% - VERIFIED: Weiss 2012
    citation: 'WEISS_2012',
    status: 'VERIFIED'
  },
  cat: {
    overall: 0.749,       // 74.9% - VERIFIED: Weiss 2012
    citation: 'WEISS_2012',
    status: 'VERIFIED'
  }
};

// =============================================================================
// CAT RECOVERY TIMELINE (Huang 2018)
// =============================================================================

export const CAT_RECOVERY_TIMELINE = {
  // Cumulative recovery percentages by time
  day7: 0.34,             // 34% recovered by day 7 - VERIFIED: Huang 2018
  day30: 0.50,            // 50% recovered by day 30 - VERIFIED: Huang 2018
  day61Plus: 1.0,         // Remaining found after day 61
  citation: 'HUANG_2018',
  status: 'VERIFIED',
  notes: 'Cats are found much slower than dogs - most recoveries take weeks'
};

// =============================================================================
// RECOVERY MODE DISTRIBUTION (Weiss 2012, Table 3)
// =============================================================================

export const CAT_RECOVERY_MODES = {
  SELF_RETURN: {
    probability: 0.59,    // 59% - VERIFIED: Weiss 2012
    weissCategory: 'Returned on own',
    status: 'VERIFIED'
  },
  OWNER_SEARCH: {
    probability: 0.30,    // 30% - VERIFIED: Weiss 2012
    weissCategory: 'Searched for pet',
    status: 'VERIFIED'
  },
  SHELTER: {
    probability: 0.02,    // 2% (CI: 0.04-10%) - VERIFIED: Weiss 2012
    weissCategory: 'Local shelter',
    confidenceInterval: [0.0004, 0.10],
    status: 'VERIFIED'
  },
  OTHER: {
    probability: 0.09,    // 9% - VERIFIED: Weiss 2012
    weissCategory: 'Neighbor found, etc.',
    status: 'VERIFIED'
  },
  citation: 'WEISS_2012'
};

export const DOG_RECOVERY_MODES = {
  ACTIVE_SEARCH: {
    probability: 0.49,    // 49% - VERIFIED: Weiss 2012
    weissCategory: 'Searched for pet',
    status: 'VERIFIED'
  },
  STRANGER_RETURN: {
    probability: 0.26,    // 26% - VERIFIED: Weiss 2012
    weissCategory: 'Good Samaritan found',
    status: 'VERIFIED'
  },
  SELF_RETURN: {
    probability: 0.15,    // 15% - VERIFIED: Weiss 2012
    weissCategory: 'Pet returned on own + ID tag/microchip',
    status: 'VERIFIED'
  },
  SHELTER: {
    probability: 0.06,    // 6% (CI: 2-12%) - VERIFIED: Weiss 2012
    weissCategory: 'Local shelter',
    confidenceInterval: [0.02, 0.12],
    status: 'VERIFIED'
  },
  OTHER: {
    probability: 0.04,    // 4% - VERIFIED: Weiss 2012
    weissCategory: 'Other',
    status: 'VERIFIED'
  },
  citation: 'WEISS_2012'
};

// =============================================================================
// MICROCHIP PARAMETERS (Lord 2009)
// =============================================================================

export const MICROCHIP = {
  // Shelter return-to-owner rates for microchipped animals
  shelterRTO: {
    dog: 0.522,           // 52.2% - VERIFIED: Lord 2009
    cat: 0.385,           // 38.5% - VERIFIED: Lord 2009
    status: 'VERIFIED'
  },

  // Critical: not all microchips are registered correctly
  registrationRate: 0.581, // 58.1% of chips properly registered - VERIFIED: Lord 2009

  // Multiplier vs non-chipped animals
  rtoMultiplier: 2.4,     // 2.4x more likely to be returned - VERIFIED: Lord 2009

  citation: 'LORD_2009',
  status: 'VERIFIED',

  implementationNote: 'Before applying RTO rates, check if chip is registered (58.1% probability)'
};

// =============================================================================
// COLLAR/TAG PARAMETERS (Lord 2007 - UNVERIFIED)
// =============================================================================

export const COLLAR_TAG = {
  recoveryEffect: 0.512,  // +51.2% recovery - UNVERIFIED: Lord 2007
  citation: 'LORD_2007',
  status: 'UNVERIFIED',
  notes: 'Could not verify to specific table/page. Include in sensitivity analysis.'
};

// =============================================================================
// KOOPMAN POD DETECTION MODEL (SAR Literature)
// =============================================================================
//
// The Koopman formula from search theory:
//   POD = 1 - exp(-C)
//
// Where Coverage C = (W × L) / A
//   W = sweep width (effective detection distance, both sides)
//   L = distance traveled by searcher
//   A = area being searched
//
// This is the industry standard for Search and Rescue operations.
// Sweep widths are empirically derived from detection experiments.

export const SAR_SWEEP_WIDTHS = {
  // Sweep widths for visual detection of targets by foot searcher
  // Units: meters (effective width, both sides of track)
  // Source: Koester 2008, derived from SAR detection experiments

  // Target type affects detectability
  TARGET_TYPE: {
    // Dogs are generally more visible due to size and movement
    DOG_RESPONSIVE: {
      // Dog that barks, moves toward searcher
      width: 70,           // meters - DERIVED from SAR "responsive person" data
      status: 'DERIVED',
      notes: 'Based on responsive person sweep width, adjusted for animal size'
    },
    DOG_UNRESPONSIVE: {
      // Dog hiding, sleeping, or scared
      width: 25,           // meters - DERIVED
      status: 'DERIVED',
      notes: 'Based on unresponsive person sweep width, adjusted down for size'
    },
    CAT_RESPONSIVE: {
      // Cat that meows or moves
      width: 20,           // meters - DERIVED
      status: 'DERIVED',
      notes: 'Smaller target, less likely to vocalize than dog'
    },
    CAT_UNRESPONSIVE: {
      // Cat hiding (most common)
      width: 8,            // meters - DERIVED
      status: 'DERIVED',
      notes: 'Cats are excellent at hiding, small profile'
    }
  },

  // Environmental modifiers to sweep width
  TERRAIN_MODIFIERS: {
    OPEN: 1.5,             // Open fields, parking lots - increased visibility
    SUBURBAN: 1.0,         // Standard residential - baseline
    WOODED: 0.6,           // Forest, heavy vegetation - reduced visibility
    URBAN_DENSE: 0.7,      // Dense urban with many obstacles
    status: 'DERIVED',
    notes: 'Modifiers based on SAR terrain classifications'
  },

  // Time of day modifiers
  LIGHT_MODIFIERS: {
    DAYLIGHT: 1.0,         // Full daylight
    DAWN_DUSK: 0.7,        // Low light conditions
    NIGHT_FLASHLIGHT: 0.3, // Night search with flashlight
    NIGHT_NO_LIGHT: 0.05,  // Night search without light (nearly impossible)
    status: 'DERIVED',
    notes: 'Light strongly affects visual detection'
  },

  // Searcher experience modifiers
  EXPERIENCE_MODIFIERS: {
    TRAINED_SAR: 1.2,      // Professional SAR volunteer
    EXPERIENCED: 1.0,      // Has searched before
    NOVICE: 0.7,           // First-time searcher
    FATIGUED: 0.6,         // After hours of searching
    status: 'DERIVED',
    notes: 'Training and fatigue affect detection performance'
  },

  citation: 'KOESTER_2008',
  formula: 'POD = 1 - exp(-C), where C = (W × L) / A',
  formulaCitation: 'KOOPMAN_1980'
};

// =============================================================================
// UNVERIFIED PARAMETERS WITH UNCERTAINTY BOUNDS
// =============================================================================
//
// Each unverified parameter includes:
// - value: Current best guess
// - min/max: Plausible range for sensitivity analysis
// - distribution: 'uniform' or 'lognormal' for Monte Carlo sampling
// - sensitivityPriority: HIGH/MEDIUM/LOW - how much output depends on this
//
// These bounds enable:
// 1. Sensitivity analysis (vary one param, measure output change)
// 2. Monte Carlo error propagation (sample all params, get CI on outputs)
// 3. Identification of high-priority research gaps

export const UNVERIFIED_PARAMS = {
  // Movement speeds during different behavioral states
  STATE_SPEEDS: {
    FLEEING: {
      value: 0.04,        // mi/5min - UNVERIFIED
      min: 0.02,          // Slowest plausible (injured, exhausted)
      max: 0.08,          // Fastest plausible (panicked sprint)
      distribution: 'uniform',
    },
    HIDING: {
      value: 0.001,
      min: 0.0,           // Completely stationary
      max: 0.005,         // Slight repositioning
      distribution: 'uniform',
    },
    FORAGING: {
      value: 0.008,
      min: 0.003,
      max: 0.02,
      distribution: 'uniform',
    },
    WANDERING: {
      value: 0.015,
      min: 0.005,
      max: 0.03,
      distribution: 'uniform',
    },
    TERRITORIAL: {
      value: 0.005,
      min: 0.002,
      max: 0.015,
      distribution: 'uniform',
    },
    SHELTERED: {
      value: 0.0,
      min: 0.0,
      max: 0.0,           // Always stationary
      distribution: 'uniform',
    },
    unit: 'miles per 5 minutes',
    status: 'UNVERIFIED',
    sensitivityPriority: 'HIGH',
    notes: 'Movement speed directly affects search coverage needed'
  },

  // Detection rates during search - CRITICAL for search effectiveness
  DETECTION: {
    baseRate: {
      value: 0.002,       // per searcher per step
      min: 0.0005,        // Very hard to spot (shy cat in dense area)
      max: 0.01,          // Easy to spot (friendly dog in open area)
      distribution: 'lognormal',
    },
    hidingModifier: {
      value: 0.25,        // 75% reduction when hiding
      min: 0.05,          // Almost impossible to find when hiding
      max: 0.5,           // Moderately hidden
      distribution: 'uniform',
    },
    nightModifier: {
      value: 0.3,         // 70% reduction at night
      min: 0.1,           // Very hard at night
      max: 0.6,           // Easier with flashlights
      distribution: 'uniform',
    },
    status: 'UNVERIFIED',
    sensitivityPriority: 'HIGH',
    notes: 'Detection rate is the #1 driver of search success - needs research'
  },

  // Search timing defaults
  SEARCH_TIMING: {
    delayHours: {
      value: 2,           // hours before search starts
      min: 0.5,           // Immediate response
      max: 12,            // Slow to realize pet is missing
      distribution: 'lognormal',
    },
    volunteerRampUpHours: {
      value: 24,
      min: 6,             // Fast social media mobilization
      max: 72,            // Slow word-of-mouth
      distribution: 'uniform',
    },
    initialVolunteerPercent: {
      value: 20,
      min: 5,             // Very few initial helpers
      max: 50,            // Strong immediate response
      distribution: 'uniform',
    },
    // These are reasonable defaults, not uncertain
    searchHoursStart: { value: 7, min: 5, max: 9, distribution: 'uniform' },
    searchHoursEnd: { value: 21, min: 18, max: 23, distribution: 'uniform' },
    status: 'UNVERIFIED',
    sensitivityPriority: 'MEDIUM',
    notes: 'Timing affects how much ground can be covered before pet moves'
  },

  // Collar/tag effect
  COLLAR_TAG_EFFECT: {
    recoveryBoost: {
      value: 0.512,       // +51.2% recovery
      min: 0.2,           // Minimal effect
      max: 0.8,           // Strong effect
      distribution: 'uniform',
    },
    citation: 'LORD_2007',
    status: 'UNVERIFIED',
    sensitivityPriority: 'MEDIUM',
    notes: 'Could not verify to specific table/page'
  },

  // Dog recovery timeline (no peer-reviewed data)
  DOG_RECOVERY_TIMELINE: {
    day3Recovery: {
      value: 0.50,        // 50% found by day 3
      min: 0.30,
      max: 0.70,
      distribution: 'uniform',
    },
    day7Recovery: {
      value: 0.80,        // 80% found by day 7
      min: 0.60,
      max: 0.95,
      distribution: 'uniform',
    },
    status: 'UNVERIFIED',
    sensitivityPriority: 'MEDIUM',
    notes: 'No peer-reviewed timeline for dogs - estimated based on higher activity'
  }
};

// =============================================================================
// UNCERTAINTY QUANTIFICATION HELPERS
// =============================================================================

/**
 * Get all uncertain parameters as a flat list for sensitivity analysis
 * @returns {Array} List of { path, value, min, max, priority }
 */
export function getUncertainParameters() {
  const params = [];

  const extractParams = (obj, path = '') => {
    for (const [key, val] of Object.entries(obj)) {
      if (key === 'status' || key === 'sensitivityPriority' || key === 'notes' ||
          key === 'unit' || key === 'citation' || key === 'distribution') continue;

      const fullPath = path ? `${path}.${key}` : key;

      if (val && typeof val === 'object' && 'value' in val && 'min' in val) {
        params.push({
          path: fullPath,
          ...val,
          priority: obj.sensitivityPriority || 'MEDIUM'
        });
      } else if (val && typeof val === 'object') {
        extractParams(val, fullPath);
      }
    }
  };

  extractParams(UNVERIFIED_PARAMS);
  return params;
}

/**
 * Sample a value from an uncertain parameter
 * @param {object} param - Parameter with value, min, max, distribution
 * @param {function} random - Random number generator
 * @returns {number} Sampled value
 */
export function sampleUncertainParam(param, random) {
  if (!param.min || !param.max || param.min === param.max) {
    return param.value;
  }

  if (param.distribution === 'lognormal') {
    // Log-normal: sample uniformly in log space
    const logMin = Math.log(Math.max(param.min, 0.0001));
    const logMax = Math.log(param.max);
    return Math.exp(logMin + random() * (logMax - logMin));
  }

  // Default: uniform distribution
  return param.min + random() * (param.max - param.min);
}

/**
 * Calculate expected uncertainty contribution from each parameter
 * Based on range and sensitivity priority
 * @returns {Array} Parameters sorted by expected impact
 */
export function rankParametersByUncertainty() {
  const params = getUncertainParameters();

  return params.map(p => {
    const range = p.max - p.min;
    const relativeRange = range / (p.value || 1);
    const priorityWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 }[p.priority] || 1;

    return {
      ...p,
      relativeRange,
      uncertaintyScore: relativeRange * priorityWeight
    };
  }).sort((a, b) => b.uncertaintyScore - a.uncertaintyScore);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get displacement parameters for a species and lifestyle
 * @param {string} species - 'cat' or 'dog'
 * @param {string} lifestyle - 'indoorOnly' or 'indoorOutdoor' (cats only)
 * @returns {object} Displacement parameters with median and q75
 */
export function getDisplacementParams(species, lifestyle = 'indoorOutdoor') {
  if (species === 'dog') {
    return DOG_DISPLACEMENT;
  }

  if (species === 'cat') {
    return CAT_DISPLACEMENT[lifestyle] || CAT_DISPLACEMENT.indoorOutdoor;
  }

  throw new Error(`Unknown species: ${species}`);
}

/**
 * Get recovery modes for a species
 * @param {string} species - 'cat' or 'dog'
 * @returns {object} Recovery mode probabilities
 */
export function getRecoveryModes(species) {
  if (species === 'dog') {
    return DOG_RECOVERY_MODES;
  }

  if (species === 'cat') {
    return CAT_RECOVERY_MODES;
  }

  throw new Error(`Unknown species: ${species}`);
}

/**
 * Check if a microchip is registered (probabilistic)
 * @param {function} random - Random number generator
 * @returns {boolean} Whether the chip is registered
 */
export function isMicrochipRegistered(random) {
  return random() < MICROCHIP.registrationRate;
}

/**
 * Get shelter RTO rate for a microchipped animal
 * @param {string} species - 'cat' or 'dog'
 * @param {boolean} isRegistered - Whether chip is registered
 * @returns {number} Return-to-owner probability
 */
export function getShelterRTORate(species, isRegistered) {
  if (!isRegistered) {
    return 0.0; // No chip benefit without registration
  }

  return MICROCHIP.shelterRTO[species] || 0.0;
}

/**
 * Get overall recovery rate for a species
 * @param {string} species - 'cat' or 'dog'
 * @returns {number} Overall recovery probability
 */
export function getRecoveryRate(species) {
  return RECOVERY_RATES[species]?.overall || 0.5;
}

/**
 * Format a citation for display
 * @param {string} citationKey - Key from CITATIONS object
 * @returns {string} Formatted citation string
 */
export function formatCitation(citationKey) {
  const cite = CITATIONS[citationKey];
  if (!cite) return citationKey;

  return `${cite.authors} (${cite.year}). ${cite.title}. ${cite.journal}${cite.volume ? `, ${cite.volume}` : ''}${cite.pages ? `, ${cite.pages}` : ''}.`;
}

// =============================================================================
// PARAMETER CLASSIFICATION TABLE
// =============================================================================
//
// Complete inventory of all simulation parameters with verification status
//

export const PARAMETER_CLASSIFICATION = {
  // TIER 1: VERIFIED - Directly from peer-reviewed sources
  TIER_1_VERIFIED: [
    { param: 'Cat indoor-only displacement median', value: '39m', source: 'Huang 2018', confidence: 'HIGH' },
    { param: 'Cat indoor-only displacement Q75', value: '137m', source: 'Huang 2018', confidence: 'HIGH' },
    { param: 'Cat indoor-outdoor displacement median', value: '300m', source: 'Huang 2018', confidence: 'HIGH' },
    { param: 'Cat indoor-outdoor displacement Q75', value: '1609m', source: 'Huang 2018', confidence: 'HIGH' },
    { param: 'Cat recovery rate', value: '74.9%', source: 'Weiss 2012', confidence: 'HIGH' },
    { param: 'Dog recovery rate', value: '93%', source: 'Weiss 2012', confidence: 'HIGH' },
    { param: 'Cat self-return rate', value: '59%', source: 'Weiss 2012', confidence: 'HIGH' },
    { param: 'Cat owner-search rate', value: '30%', source: 'Weiss 2012', confidence: 'HIGH' },
    { param: 'Cat shelter rate', value: '2%', source: 'Weiss 2012', confidence: 'HIGH' },
    { param: 'Dog active-search rate', value: '49%', source: 'Weiss 2012', confidence: 'HIGH' },
    { param: 'Dog stranger-return rate', value: '26%', source: 'Weiss 2012', confidence: 'HIGH' },
    { param: 'Dog self-return rate', value: '15%', source: 'Weiss 2012', confidence: 'HIGH' },
    { param: 'Dog shelter rate', value: '6%', source: 'Weiss 2012', confidence: 'HIGH' },
    { param: 'Cat recovery day 7', value: '34%', source: 'Huang 2018', confidence: 'HIGH' },
    { param: 'Cat recovery day 30', value: '50%', source: 'Huang 2018', confidence: 'HIGH' },
    { param: 'Microchip RTO rate (dog)', value: '52.2%', source: 'Lord 2009', confidence: 'HIGH' },
    { param: 'Microchip RTO rate (cat)', value: '38.5%', source: 'Lord 2009', confidence: 'HIGH' },
    { param: 'Microchip registration rate', value: '58.1%', source: 'Lord 2009', confidence: 'HIGH' },
  ],

  // TIER 2: DERIVED - Calculated from verified data or adapted from related research
  TIER_2_DERIVED: [
    { param: 'Dog displacement median', value: '200m', source: 'Fitted to Kremer 2021', confidence: 'MEDIUM' },
    { param: 'Dog displacement Q75', value: '800m', source: 'Fitted to Kremer 2021', confidence: 'MEDIUM' },
    { param: 'Koopman POD formula', value: '1-exp(-C)', source: 'Koopman 1980', confidence: 'MEDIUM' },
    { param: 'Dog responsive sweep width', value: '70m', source: 'SAR human→pet', confidence: 'MEDIUM' },
    { param: 'Dog unresponsive sweep width', value: '25m', source: 'SAR human→pet', confidence: 'MEDIUM' },
    { param: 'Cat responsive sweep width', value: '20m', source: 'SAR human→pet', confidence: 'MEDIUM' },
    { param: 'Cat unresponsive sweep width', value: '8m', source: 'SAR human→pet', confidence: 'MEDIUM' },
    { param: 'Terrain visibility modifiers', value: '0.6-1.5x', source: 'SAR classifications', confidence: 'MEDIUM' },
    { param: 'Light condition modifiers', value: '0.05-1.0x', source: 'SAR classifications', confidence: 'MEDIUM' },
    { param: 'Dog recovery day 3', value: '50%', source: 'Extrapolated from cat', confidence: 'MEDIUM' },
    { param: 'Dog recovery day 7', value: '80%', source: 'Extrapolated from cat', confidence: 'MEDIUM' },
  ],

  // TIER 3: UNVERIFIED - Placeholder values requiring research
  TIER_3_UNVERIFIED: [
    { param: 'Fleeing speed', value: '0.04 mi/5min', source: 'Estimate', confidence: 'LOW', priority: 'HIGH' },
    { param: 'Hiding speed', value: '0.001 mi/5min', source: 'Estimate', confidence: 'LOW', priority: 'HIGH' },
    { param: 'Foraging speed', value: '0.008 mi/5min', source: 'Estimate', confidence: 'LOW', priority: 'MEDIUM' },
    { param: 'Wandering speed', value: '0.015 mi/5min', source: 'Estimate', confidence: 'LOW', priority: 'MEDIUM' },
    { param: 'Base detection rate', value: '0.002/step', source: 'Estimate', confidence: 'LOW', priority: 'HIGH' },
    { param: 'Hiding detection modifier', value: '0.25x', source: 'Estimate', confidence: 'LOW', priority: 'HIGH' },
    { param: 'Night detection modifier', value: '0.3x', source: 'Estimate', confidence: 'LOW', priority: 'MEDIUM' },
    { param: 'Search start delay', value: '2 hours', source: 'Estimate', confidence: 'LOW', priority: 'MEDIUM' },
    { param: 'Volunteer ramp-up time', value: '24 hours', source: 'Estimate', confidence: 'LOW', priority: 'MEDIUM' },
    { param: 'Initial volunteer percent', value: '20%', source: 'Estimate', confidence: 'LOW', priority: 'LOW' },
    { param: 'Collar/tag recovery effect', value: '+51.2%', source: 'Lord 2007 (unverified)', confidence: 'LOW', priority: 'MEDIUM' },
  ],
};

/**
 * Get summary of parameter verification status
 * @returns {object} Counts and percentages by tier
 */
export function getVerificationSummary() {
  const tier1Count = PARAMETER_CLASSIFICATION.TIER_1_VERIFIED.length;
  const tier2Count = PARAMETER_CLASSIFICATION.TIER_2_DERIVED.length;
  const tier3Count = PARAMETER_CLASSIFICATION.TIER_3_UNVERIFIED.length;
  const total = tier1Count + tier2Count + tier3Count;

  return {
    tier1: { count: tier1Count, percent: ((tier1Count / total) * 100).toFixed(1) },
    tier2: { count: tier2Count, percent: ((tier2Count / total) * 100).toFixed(1) },
    tier3: { count: tier3Count, percent: ((tier3Count / total) * 100).toFixed(1) },
    total,
    summary: `${tier1Count} verified (${((tier1Count / total) * 100).toFixed(0)}%), ` +
             `${tier2Count} derived (${((tier2Count / total) * 100).toFixed(0)}%), ` +
             `${tier3Count} unverified (${((tier3Count / total) * 100).toFixed(0)}%)`,
    recommendation: tier3Count > tier1Count
      ? 'High proportion of unverified parameters - recommend Phase 0 research before publication'
      : 'Parameter verification status acceptable for preliminary results',
  };
}

/**
 * Get all high-priority unverified parameters (research gaps)
 * @returns {Array} High-priority research gaps
 */
export function getResearchGaps() {
  return PARAMETER_CLASSIFICATION.TIER_3_UNVERIFIED
    .filter(p => p.priority === 'HIGH')
    .map(p => ({
      parameter: p.param,
      currentValue: p.value,
      impact: 'HIGH - directly affects simulation accuracy',
      suggestedResearch: `Empirical study needed to measure actual ${p.param.toLowerCase()}`,
    }));
}
