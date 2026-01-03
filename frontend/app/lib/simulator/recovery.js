/**
 * Species-Specific Recovery Mechanisms for Lost Pet Simulator
 *
 * Implements distinct recovery pathways based on Weiss 2012 research:
 * - Cats: 59% self-return, 30% owner search, 2% shelter, 9% other
 * - Dogs: 49% active search, 26% stranger return, 15% self-return, 6% shelter, 4% other
 *
 * Recovery modes affect how and when a pet is found, which is crucial for
 * realistic simulation of search effectiveness.
 */

import {
  CAT_RECOVERY_MODES,
  DOG_RECOVERY_MODES,
  CAT_RECOVERY_TIMELINE,
  RECOVERY_RATES,
  getRecoveryModes
} from './researchConfig.js';

// =============================================================================
// RECOVERY MODE CONSTANTS
// =============================================================================

export const RecoveryMode = {
  // Cat modes
  CAT_SELF_RETURN: 'CAT_SELF_RETURN',
  CAT_OWNER_SEARCH: 'CAT_OWNER_SEARCH',
  CAT_SHELTER: 'CAT_SHELTER',
  CAT_OTHER: 'CAT_OTHER',

  // Dog modes
  DOG_ACTIVE_SEARCH: 'DOG_ACTIVE_SEARCH',
  DOG_STRANGER_RETURN: 'DOG_STRANGER_RETURN',
  DOG_SELF_RETURN: 'DOG_SELF_RETURN',
  DOG_SHELTER: 'DOG_SHELTER',
  DOG_OTHER: 'DOG_OTHER',

  // Outcome
  NOT_RECOVERED: 'NOT_RECOVERED'
};

// =============================================================================
// RECOVERY MODE DETERMINATION
// =============================================================================

/**
 * Determine the recovery mode for a lost pet
 *
 * This is a probabilistic determination based on Weiss 2012 data.
 * The mode affects how the pet is found (or if it's found at all).
 *
 * @param {string} species - 'cat' or 'dog'
 * @param {function} random - Random number generator
 * @returns {object} Recovery mode { mode, probability, description }
 */
export function determineRecoveryMode(species, random) {
  const overallRecoveryRate = RECOVERY_RATES[species]?.overall || 0.5;

  // First, determine if the pet will be recovered at all
  if (random() > overallRecoveryRate) {
    return {
      mode: RecoveryMode.NOT_RECOVERED,
      probability: 1 - overallRecoveryRate,
      description: 'Pet was not recovered',
      recovered: false
    };
  }

  // Pet will be recovered - determine the mode
  const modes = getRecoveryModes(species);
  const roll = random();

  let cumulative = 0;

  if (species === 'cat') {
    // Cat recovery modes (Weiss 2012)
    cumulative += modes.SELF_RETURN.probability;
    if (roll < cumulative) {
      return {
        mode: RecoveryMode.CAT_SELF_RETURN,
        probability: modes.SELF_RETURN.probability,
        description: 'Cat returned home on its own',
        recovered: true,
        requiresSearch: false
      };
    }

    cumulative += modes.OWNER_SEARCH.probability;
    if (roll < cumulative) {
      return {
        mode: RecoveryMode.CAT_OWNER_SEARCH,
        probability: modes.OWNER_SEARCH.probability,
        description: 'Cat found through owner search efforts',
        recovered: true,
        requiresSearch: true
      };
    }

    cumulative += modes.SHELTER.probability;
    if (roll < cumulative) {
      return {
        mode: RecoveryMode.CAT_SHELTER,
        probability: modes.SHELTER.probability,
        description: 'Cat found at local shelter',
        recovered: true,
        requiresSearch: false,
        shelterPathway: true
      };
    }

    return {
      mode: RecoveryMode.CAT_OTHER,
      probability: modes.OTHER.probability,
      description: 'Cat found by neighbor or other means',
      recovered: true,
      requiresSearch: false
    };
  }

  // Dog recovery modes (Weiss 2012)
  cumulative += modes.ACTIVE_SEARCH.probability;
  if (roll < cumulative) {
    return {
      mode: RecoveryMode.DOG_ACTIVE_SEARCH,
      probability: modes.ACTIVE_SEARCH.probability,
      description: 'Dog found through active search',
      recovered: true,
      requiresSearch: true
    };
  }

  cumulative += modes.STRANGER_RETURN.probability;
  if (roll < cumulative) {
    return {
      mode: RecoveryMode.DOG_STRANGER_RETURN,
      probability: modes.STRANGER_RETURN.probability,
      description: 'Dog returned by Good Samaritan',
      recovered: true,
      requiresSearch: false
    };
  }

  cumulative += modes.SELF_RETURN.probability;
  if (roll < cumulative) {
    return {
      mode: RecoveryMode.DOG_SELF_RETURN,
      probability: modes.SELF_RETURN.probability,
      description: 'Dog returned home on its own',
      recovered: true,
      requiresSearch: false
    };
  }

  cumulative += modes.SHELTER.probability;
  if (roll < cumulative) {
    return {
      mode: RecoveryMode.DOG_SHELTER,
      probability: modes.SHELTER.probability,
      description: 'Dog found at local shelter',
      recovered: true,
      requiresSearch: false,
      shelterPathway: true
    };
  }

  return {
    mode: RecoveryMode.DOG_OTHER,
    probability: modes.OTHER.probability,
    description: 'Dog found by other means',
    recovered: true,
    requiresSearch: false
  };
}

// =============================================================================
// RECOVERY TIMELINE (Cats)
// =============================================================================

/**
 * Determine if a cat should be recovered by a given day
 *
 * Based on Huang 2018 timeline data:
 * - 34% by day 7
 * - 50% by day 30
 * - Remaining found after day 61
 *
 * @param {number} day - Current simulation day
 * @param {function} random - Random number generator
 * @returns {boolean} Whether the cat should be recovered by this day
 */
export function shouldCatBeRecoveredByDay(day, random) {
  const roll = random();

  if (day <= 7) {
    // 34% of all recoveries happen by day 7
    // Spread linearly across days 1-7
    const dailyRate = CAT_RECOVERY_TIMELINE.day7 / 7;
    return roll < (dailyRate * day);
  }

  if (day <= 30) {
    // 50% by day 30 (already counted 34% by day 7)
    // So 16% more between days 8-30
    const remainingRate = CAT_RECOVERY_TIMELINE.day30 - CAT_RECOVERY_TIMELINE.day7;
    const dailyRate = remainingRate / (30 - 7);
    const cumulative = CAT_RECOVERY_TIMELINE.day7 + dailyRate * (day - 7);
    return roll < cumulative;
  }

  if (day <= 61) {
    // Remaining 50% spread across days 31-61
    const remainingRate = 1 - CAT_RECOVERY_TIMELINE.day30;
    const dailyRate = remainingRate / (61 - 30);
    const cumulative = CAT_RECOVERY_TIMELINE.day30 + dailyRate * (day - 30);
    return roll < cumulative;
  }

  // After day 61, assume all remaining cats found
  return true;
}

/**
 * Get expected recovery day for a cat
 *
 * Samples from the Huang 2018 timeline distribution.
 *
 * @param {function} random - Random number generator
 * @returns {number} Expected day of recovery
 */
export function sampleCatRecoveryDay(random) {
  const roll = random();

  if (roll < CAT_RECOVERY_TIMELINE.day7) {
    // Recovered by day 7 - uniform distribution within first week
    return Math.ceil(random() * 7);
  }

  if (roll < CAT_RECOVERY_TIMELINE.day30) {
    // Recovered between days 8-30
    return 8 + Math.floor(random() * (30 - 7));
  }

  // Recovered after day 30, up to day 90 (extended search)
  return 31 + Math.floor(random() * 60);
}

/**
 * Get expected recovery day for a dog
 *
 * Dogs are typically found faster than cats (no specific timeline in Weiss 2012).
 * Using reasonable estimates based on the higher recovery rate and more active behavior.
 *
 * @param {function} random - Random number generator
 * @returns {number} Expected day of recovery
 *
 * @status UNVERIFIED - No peer-reviewed timeline for dogs
 */
export function sampleDogRecoveryDay(random) {
  // UNVERIFIED: Estimated dog recovery timeline
  // Dogs are found faster than cats due to higher visibility and activity
  const roll = random();

  if (roll < 0.50) {
    // 50% found within first 3 days
    return Math.ceil(random() * 3);
  }

  if (roll < 0.80) {
    // 80% found within first week
    return 4 + Math.floor(random() * 4);
  }

  // Remaining found within 2 weeks
  return 8 + Math.floor(random() * 7);
}

// =============================================================================
// RECOVERY OUTCOME
// =============================================================================

/**
 * Generate a complete recovery outcome for a lost pet
 *
 * @param {string} species - 'cat' or 'dog'
 * @param {object} petConfig - Pet configuration { microchipped, hasCollar, lifestyle }
 * @param {function} random - Random number generator
 * @returns {object} Complete recovery outcome
 */
export function generateRecoveryOutcome(species, petConfig, random) {
  const mode = determineRecoveryMode(species, random);

  if (!mode.recovered) {
    return {
      ...mode,
      recoveryDay: null,
      method: null
    };
  }

  // Determine recovery day
  const recoveryDay = species === 'cat'
    ? sampleCatRecoveryDay(random)
    : sampleDogRecoveryDay(random);

  return {
    ...mode,
    recoveryDay,
    species,
    petConfig
  };
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validate recovery mode distribution against Weiss 2012
 *
 * @param {string} species - 'cat' or 'dog'
 * @param {number} n - Number of samples
 * @param {function} random - Random number generator
 * @param {number} tolerance - Acceptable deviation (default 0.15 = 15%)
 * @returns {object} Validation result
 */
export function validateRecoveryModes(species, n = 1000, random, tolerance = 0.15) {
  const modes = getRecoveryModes(species);
  const counts = {};

  // Initialize counts
  for (const key of Object.keys(modes)) {
    if (key !== 'citation') {
      counts[key] = 0;
    }
  }
  counts.NOT_RECOVERED = 0;

  // Sample recovery modes
  for (let i = 0; i < n; i++) {
    const outcome = determineRecoveryMode(species, random);

    if (!outcome.recovered) {
      counts.NOT_RECOVERED++;
    } else {
      // Map mode back to key
      const modeKey = outcome.mode.replace(`${species.toUpperCase()}_`, '');
      if (counts.hasOwnProperty(modeKey)) {
        counts[modeKey]++;
      }
    }
  }

  // Calculate proportions and validate
  const recoveredCount = n - counts.NOT_RECOVERED;
  const tests = [];

  for (const [key, expectedData] of Object.entries(modes)) {
    if (key === 'citation') continue;

    const expected = expectedData.probability;
    const actual = counts[key] / recoveredCount;
    const deviation = Math.abs(actual - expected);
    const passed = deviation <= tolerance;

    tests.push({
      name: `${species} ${key}`,
      expected,
      actual,
      tolerance,
      passed,
      source: 'Weiss 2012'
    });
  }

  // Validate overall recovery rate
  const overallExpected = RECOVERY_RATES[species].overall;
  const overallActual = recoveredCount / n;
  const overallPassed = Math.abs(overallActual - overallExpected) <= tolerance;

  tests.unshift({
    name: `${species} overall recovery`,
    expected: overallExpected,
    actual: overallActual,
    tolerance,
    passed: overallPassed,
    source: 'Weiss 2012'
  });

  return {
    passed: tests.every(t => t.passed),
    tests
  };
}
