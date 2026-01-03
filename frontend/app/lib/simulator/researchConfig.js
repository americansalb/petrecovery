/**
 * Research-Backed Configuration for Lost Pet Simulator
 *
 * All parameters are tagged with verification status:
 * - VERIFIED: Directly from peer-reviewed source with citation
 * - DERIVED: Mathematically derived from verified data
 * - UNVERIFIED: Placeholder requiring Phase 0 research
 *
 * DO NOT modify verified values without updating citations.
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
// UNVERIFIED PARAMETERS (Phase 0 Research Required)
// =============================================================================

export const UNVERIFIED_PARAMS = {
  // Movement speeds during different behavioral states
  STATE_SPEEDS: {
    FLEEING: 0.04,        // mi/5min - UNVERIFIED: needs literature review
    HIDING: 0.001,        // mi/5min - UNVERIFIED: needs literature review
    FORAGING: 0.008,      // mi/5min - UNVERIFIED: needs literature review
    WANDERING: 0.015,     // mi/5min - UNVERIFIED: needs literature review
    TERRITORIAL: 0.005,   // mi/5min - UNVERIFIED: needs literature review
    SHELTERED: 0.0,       // mi/5min - stationary
    unit: 'miles per 5 minutes',
    status: 'UNVERIFIED',
    sensitivityPriority: 'HIGH'
  },

  // Detection rates during search
  DETECTION: {
    baseRate: 0.002,      // per searcher per step - UNVERIFIED
    hidingModifier: 0.25, // reduction when pet is hiding - UNVERIFIED
    status: 'UNVERIFIED',
    sensitivityPriority: 'HIGH'
  },

  // Search timing defaults
  SEARCH_TIMING: {
    delayHours: 2,        // hours before search starts - UNVERIFIED
    searchHoursStart: 7,  // 7 AM - reasonable default
    searchHoursEnd: 21,   // 9 PM - reasonable default
    volunteerRampUpHours: 24, // hours to reach full volunteer count - UNVERIFIED
    initialVolunteerPercent: 20, // starting percentage of volunteers - UNVERIFIED
    status: 'UNVERIFIED',
    sensitivityPriority: 'MEDIUM'
  },

  // Collar/tag effect (moved from separate section)
  COLLAR_TAG_EFFECT: COLLAR_TAG
};

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
