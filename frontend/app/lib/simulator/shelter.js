/**
 * Shelter Pathway Module for Lost Pet Simulator
 *
 * Implements microchip-based return-to-owner logic based on Lord 2009 research:
 * - 52.2% RTO rate for microchipped dogs at shelters
 * - 38.5% RTO rate for microchipped cats at shelters
 * - 58.1% of microchips are properly registered
 *
 * The shelter pathway is critical for realistic simulation because:
 * 1. Microchip effectiveness depends on registration status
 * 2. Different species have different shelter RTO rates
 * 3. Collar/tag visibility affects initial capture
 */

import {
  MICROCHIP,
  COLLAR_TAG,
  isMicrochipRegistered,
  getShelterRTORate
} from './researchConfig.js';

// =============================================================================
// SHELTER OUTCOME TYPES
// =============================================================================

export const ShelterOutcome = {
  RTO_VIA_CHIP: 'RTO_VIA_CHIP',           // Returned via microchip scan
  RTO_VIA_TAG: 'RTO_VIA_TAG',             // Returned via collar/tag info
  ADOPTED: 'ADOPTED',                      // Adopted by new family
  TRANSFERRED: 'TRANSFERRED',              // Transferred to rescue
  EUTHANIZED: 'EUTHANIZED',               // Euthanized (high-kill shelter)
  STILL_WAITING: 'STILL_WAITING'          // Still at shelter
};

// =============================================================================
// SHELTER INTAKE PROCESSING
// =============================================================================

/**
 * Process a pet's intake at a shelter
 *
 * Determines the outcome based on microchip status, registration, and collar/tag.
 *
 * @param {object} pet - Pet information { species, microchipped, hasCollar, ... }
 * @param {function} random - Random number generator
 * @returns {object} Shelter intake result
 */
export function processShelterIntake(pet, random) {
  const { species, microchipped, hasCollar } = pet;

  // Step 1: Check collar/tag first (fastest identification)
  if (hasCollar) {
    const tagResult = processCollarTag(pet, random);
    if (tagResult.identified) {
      return {
        outcome: ShelterOutcome.RTO_VIA_TAG,
        identified: true,
        method: 'collar_tag',
        timeToRTO: tagResult.timeToRTO,
        notes: 'Pet identified via collar/tag information'
      };
    }
  }

  // Step 2: Check microchip
  if (microchipped) {
    const chipResult = processMicrochip(pet, random);
    if (chipResult.identified) {
      return {
        outcome: ShelterOutcome.RTO_VIA_CHIP,
        identified: true,
        method: 'microchip',
        timeToRTO: chipResult.timeToRTO,
        notes: 'Pet identified via microchip scan',
        chipRegistered: chipResult.registered
      };
    }

    // Chip exists but not registered
    if (!chipResult.registered) {
      return {
        outcome: ShelterOutcome.STILL_WAITING,
        identified: false,
        method: 'none',
        notes: 'Microchip found but not registered in database',
        chipRegistered: false
      };
    }
  }

  // Step 3: No identification - fate depends on shelter type and time
  return {
    outcome: ShelterOutcome.STILL_WAITING,
    identified: false,
    method: 'none',
    notes: 'No identification found - awaiting owner claim or adoption'
  };
}

// =============================================================================
// MICROCHIP PROCESSING
// =============================================================================

/**
 * Process microchip scan at shelter
 *
 * Implements Lord 2009 findings:
 * - 58.1% of chips are properly registered
 * - 52.2% RTO rate for registered dogs
 * - 38.5% RTO rate for registered cats
 *
 * @param {object} pet - Pet information
 * @param {function} random - Random number generator
 * @returns {object} Microchip processing result
 */
export function processMicrochip(pet, random) {
  const { species } = pet;

  // Check if chip is registered (58.1% probability)
  const registered = isMicrochipRegistered(random);

  if (!registered) {
    return {
      identified: false,
      registered: false,
      rtoRate: 0,
      notes: 'Microchip not registered - cannot contact owner'
    };
  }

  // Chip is registered - apply species-specific RTO rate
  const rtoRate = getShelterRTORate(species, true);
  const rtoSuccess = random() < rtoRate;

  if (rtoSuccess) {
    return {
      identified: true,
      registered: true,
      rtoRate,
      timeToRTO: estimateChipRTOTime(random),
      notes: `Owner contacted via microchip database (${species} RTO rate: ${(rtoRate * 100).toFixed(1)}%)`
    };
  }

  // Chip registered but RTO failed (owner not reachable, declined, etc.)
  return {
    identified: false,
    registered: true,
    rtoRate,
    notes: 'Owner contacted but RTO unsuccessful (unreachable, declined, or unable to retrieve)'
  };
}

/**
 * Estimate time to RTO via microchip
 *
 * @param {function} random - Random number generator
 * @returns {number} Hours until RTO
 *
 * @status UNVERIFIED - Estimated based on typical shelter processes
 */
function estimateChipRTOTime(random) {
  // UNVERIFIED: Estimated time for chip-based RTO
  // Typically 24-72 hours for scan, database lookup, owner contact, and pickup
  const baseHours = 24;
  const variability = random() * 48; // 0-48 additional hours
  return baseHours + variability;
}

// =============================================================================
// COLLAR/TAG PROCESSING
// =============================================================================

/**
 * Process collar/tag identification
 *
 * Collar/tag provides immediate identification if:
 * 1. Tag is readable (not worn/faded)
 * 2. Contact information is current
 *
 * @param {object} pet - Pet information
 * @param {function} random - Random number generator
 * @returns {object} Collar/tag processing result
 *
 * @status UNVERIFIED - Collar/tag effect (51.2%) needs citation verification
 */
export function processCollarTag(pet, random) {
  // UNVERIFIED: Using 51.2% from Lord 2007 (needs verification)
  // This represents probability that collar leads to successful RTO
  const effectivenessRate = COLLAR_TAG.recoveryEffect;

  const identified = random() < effectivenessRate;

  if (identified) {
    return {
      identified: true,
      timeToRTO: estimateTagRTOTime(random),
      notes: 'Owner contacted via collar tag information'
    };
  }

  return {
    identified: false,
    notes: 'Collar tag unreadable or contact info outdated'
  };
}

/**
 * Estimate time to RTO via collar tag
 *
 * @param {function} random - Random number generator
 * @returns {number} Hours until RTO
 *
 * @status UNVERIFIED - Estimated based on typical processes
 */
function estimateTagRTOTime(random) {
  // UNVERIFIED: Tag-based RTO is typically faster than chip
  // Usually same-day to 24 hours
  const baseHours = 2;
  const variability = random() * 22; // 0-22 additional hours
  return baseHours + variability;
}

// =============================================================================
// SHELTER STATISTICS
// =============================================================================

/**
 * Get shelter statistics summary
 *
 * @returns {object} Summary of shelter-related parameters
 */
export function getShelterStatistics() {
  return {
    microchip: {
      registrationRate: MICROCHIP.registrationRate,
      dogRTORate: MICROCHIP.shelterRTO.dog,
      catRTORate: MICROCHIP.shelterRTO.cat,
      rtoMultiplier: MICROCHIP.rtoMultiplier,
      citation: MICROCHIP.citation,
      status: MICROCHIP.status
    },
    collarTag: {
      effectivenessRate: COLLAR_TAG.recoveryEffect,
      citation: COLLAR_TAG.citation,
      status: COLLAR_TAG.status
    }
  };
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate microchip registration rate against Lord 2009
 *
 * @param {number} n - Number of samples
 * @param {function} random - Random number generator
 * @param {number} tolerance - Acceptable deviation
 * @returns {object} Validation result
 */
export function validateMicrochipRegistration(n = 1000, random, tolerance = 0.10) {
  let registeredCount = 0;

  for (let i = 0; i < n; i++) {
    if (isMicrochipRegistered(random)) {
      registeredCount++;
    }
  }

  const expected = MICROCHIP.registrationRate;
  const actual = registeredCount / n;
  const passed = Math.abs(actual - expected) <= tolerance;

  return {
    passed,
    tests: [{
      name: 'Microchip registration rate',
      expected,
      actual,
      tolerance,
      passed,
      source: 'Lord 2009'
    }]
  };
}

/**
 * Validate shelter RTO rates against Lord 2009
 *
 * @param {string} species - 'cat' or 'dog'
 * @param {number} n - Number of samples
 * @param {function} random - Random number generator
 * @param {number} tolerance - Acceptable deviation
 * @returns {object} Validation result
 */
export function validateShelterRTO(species, n = 1000, random, tolerance = 0.10) {
  let rtoCount = 0;
  let registeredCount = 0;

  for (let i = 0; i < n; i++) {
    const pet = { species, microchipped: true, hasCollar: false };
    const result = processMicrochip(pet, random);

    if (result.registered) {
      registeredCount++;
      if (result.identified) {
        rtoCount++;
      }
    }
  }

  // RTO rate is calculated among registered chips only
  const expected = MICROCHIP.shelterRTO[species];
  const actual = registeredCount > 0 ? rtoCount / registeredCount : 0;
  const passed = Math.abs(actual - expected) <= tolerance;

  return {
    passed,
    tests: [{
      name: `${species} shelter RTO rate (among registered chips)`,
      expected,
      actual,
      tolerance,
      passed,
      source: 'Lord 2009'
    }]
  };
}
