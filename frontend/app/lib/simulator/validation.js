/**
 * Validation Suite for Lost Pet Simulator
 *
 * Tests simulation outputs against peer-reviewed research benchmarks.
 * All tests must pass before simulation results can inform product decisions.
 *
 * Sources:
 * - Displacement: Huang 2018 (cats), Kremer 2021 (dogs)
 * - Recovery rates: Weiss 2012
 * - Recovery timeline: Huang 2018 (cats)
 * - Microchip: Lord 2009
 */

import { validateDistribution, generateSamples, empiricalMedian } from './displacement.js';
import { validateRecoveryModes, sampleCatRecoveryDay } from './recovery.js';
import { validateMicrochipRegistration, validateShelterRTO } from './shelter.js';
import { CAT_RECOVERY_TIMELINE, CITATIONS } from './researchConfig.js';

// =============================================================================
// VALIDATION CONFIGURATION
// =============================================================================

const DEFAULT_SAMPLE_SIZE = 1000;
const DEFAULT_TOLERANCE = 0.20; // 20% tolerance for Monte Carlo variance

// =============================================================================
// MAIN VALIDATION RUNNER
// =============================================================================

/**
 * Run complete validation suite
 *
 * @param {function} random - Random number generator (seeded for reproducibility)
 * @param {object} options - Validation options
 * @returns {object} Complete validation results
 */
export function runValidationSuite(random, options = {}) {
  const {
    sampleSize = DEFAULT_SAMPLE_SIZE,
    tolerance = DEFAULT_TOLERANCE,
    verbose = false
  } = options;

  const results = {
    timestamp: new Date().toISOString(),
    sampleSize,
    tolerance,
    categories: {}
  };

  // Run all validation categories
  results.categories.displacement = runDisplacementValidation(random, sampleSize, tolerance);
  results.categories.recovery = runRecoveryValidation(random, sampleSize, tolerance);
  results.categories.timeline = runTimelineValidation(random, sampleSize, tolerance);
  results.categories.microchip = runMicrochipValidation(random, sampleSize, tolerance);

  // Calculate overall pass/fail
  results.passed = Object.values(results.categories).every(cat => cat.passed);
  results.totalTests = Object.values(results.categories).reduce(
    (sum, cat) => sum + cat.tests.length, 0
  );
  results.passedTests = Object.values(results.categories).reduce(
    (sum, cat) => sum + cat.tests.filter(t => t.passed).length, 0
  );

  if (verbose) {
    console.log(formatValidationReport(results));
  }

  return results;
}

// =============================================================================
// DISPLACEMENT VALIDATION
// =============================================================================

/**
 * Validate displacement distributions against research
 *
 * Tests:
 * - Indoor-only cat median: 39m (Huang 2018)
 * - Indoor-outdoor cat median: 300m (Huang 2018)
 * - Dog quantiles: 42% within 122m, 70% within 1609m (Kremer 2021)
 */
function runDisplacementValidation(random, sampleSize, tolerance) {
  const tests = [];

  // Indoor-only cats
  const indoorCatResult = validateDistribution('cat', 'indoorOnly', sampleSize, random, tolerance);
  tests.push(...indoorCatResult.tests);

  // Indoor-outdoor cats
  const outdoorCatResult = validateDistribution('cat', 'indoorOutdoor', sampleSize, random, tolerance);
  tests.push(...outdoorCatResult.tests);

  // Dogs
  const dogResult = validateDistribution('dog', null, sampleSize, random, tolerance);
  tests.push(...dogResult.tests);

  return {
    name: 'Displacement Distribution',
    passed: tests.every(t => t.passed),
    tests
  };
}

// =============================================================================
// RECOVERY VALIDATION
// =============================================================================

/**
 * Validate recovery rates and modes against Weiss 2012
 *
 * Tests:
 * - Dog overall recovery: 93%
 * - Cat overall recovery: 75%
 * - Cat self-return proportion: 59%
 * - Dog found via search: 49%
 */
function runRecoveryValidation(random, sampleSize, tolerance) {
  const tests = [];

  // Cat recovery modes
  const catResult = validateRecoveryModes('cat', sampleSize, random, tolerance);
  tests.push(...catResult.tests);

  // Dog recovery modes
  const dogResult = validateRecoveryModes('dog', sampleSize, random, tolerance);
  tests.push(...dogResult.tests);

  return {
    name: 'Recovery Rates and Modes',
    passed: tests.every(t => t.passed),
    tests
  };
}

// =============================================================================
// TIMELINE VALIDATION
// =============================================================================

/**
 * Validate cat recovery timeline against Huang 2018
 *
 * Tests:
 * - Cat recovery by day 7: 34%
 * - Cat recovery by day 30: 50%
 */
function runTimelineValidation(random, sampleSize, tolerance) {
  const tests = [];

  // Sample recovery days
  const recoveryDays = [];
  for (let i = 0; i < sampleSize; i++) {
    recoveryDays.push(sampleCatRecoveryDay(random));
  }

  // Test day 7
  const by7 = recoveryDays.filter(d => d <= 7).length / sampleSize;
  const expected7 = CAT_RECOVERY_TIMELINE.day7;
  tests.push({
    name: 'Cat recovery by day 7',
    expected: expected7,
    actual: by7,
    tolerance,
    passed: Math.abs(by7 - expected7) <= tolerance,
    source: 'Huang 2018'
  });

  // Test day 30
  const by30 = recoveryDays.filter(d => d <= 30).length / sampleSize;
  const expected30 = CAT_RECOVERY_TIMELINE.day30;
  tests.push({
    name: 'Cat recovery by day 30',
    expected: expected30,
    actual: by30,
    tolerance,
    passed: Math.abs(by30 - expected30) <= tolerance,
    source: 'Huang 2018'
  });

  return {
    name: 'Recovery Timeline',
    passed: tests.every(t => t.passed),
    tests
  };
}

// =============================================================================
// MICROCHIP VALIDATION
// =============================================================================

/**
 * Validate microchip parameters against Lord 2009
 *
 * Tests:
 * - Microchip registration rate: 58.1%
 * - Dog shelter RTO: 52.2%
 * - Cat shelter RTO: 38.5%
 */
function runMicrochipValidation(random, sampleSize, tolerance) {
  const tests = [];

  // Registration rate
  const regResult = validateMicrochipRegistration(sampleSize, random, tolerance);
  tests.push(...regResult.tests);

  // Dog shelter RTO
  const dogRTOResult = validateShelterRTO('dog', sampleSize, random, tolerance);
  tests.push(...dogRTOResult.tests);

  // Cat shelter RTO
  const catRTOResult = validateShelterRTO('cat', sampleSize, random, tolerance);
  tests.push(...catRTOResult.tests);

  return {
    name: 'Microchip Parameters',
    passed: tests.every(t => t.passed),
    tests
  };
}

// =============================================================================
// REPORTING
// =============================================================================

/**
 * Format validation results as a human-readable report
 *
 * @param {object} results - Validation results from runValidationSuite
 * @returns {string} Formatted report
 */
export function formatValidationReport(results) {
  const lines = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('           LOST PET SIMULATOR VALIDATION REPORT');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`Timestamp: ${results.timestamp}`);
  lines.push(`Sample Size: ${results.sampleSize}`);
  lines.push(`Tolerance: ±${(results.tolerance * 100).toFixed(0)}%`);
  lines.push('');

  for (const [categoryKey, category] of Object.entries(results.categories)) {
    const status = category.passed ? '✓ PASS' : '✗ FAIL';
    lines.push(`┌─ ${category.name} ${status}`);

    for (const test of category.tests) {
      const testStatus = test.passed ? '✓' : '✗';
      const expected = typeof test.expected === 'number'
        ? (test.expected * 100).toFixed(1) + '%'
        : test.expected;
      const actual = typeof test.actual === 'number'
        ? (test.actual * 100).toFixed(1) + '%'
        : test.actual;

      lines.push(`│  ${testStatus} ${test.name}`);
      lines.push(`│    Expected: ${expected} | Actual: ${actual} | Source: ${test.source}`);
    }

    lines.push('└─');
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════════');
  const overallStatus = results.passed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED';
  lines.push(`OVERALL: ${overallStatus} (${results.passedTests}/${results.totalTests})`);
  lines.push('═══════════════════════════════════════════════════════════════');

  if (!results.passed) {
    lines.push('');
    lines.push('⚠️  SIMULATION RESULTS SHOULD NOT INFORM PRODUCT DECISIONS');
    lines.push('   UNTIL ALL VALIDATION TESTS PASS');
  }

  return lines.join('\n');
}

// =============================================================================
// SEEDED RANDOM FOR REPRODUCIBILITY
// =============================================================================

/**
 * Create a seeded random number generator for reproducible tests
 *
 * Uses a simple LCG (Linear Congruential Generator) for deterministic output.
 *
 * @param {number} seed - Random seed
 * @returns {function} Seeded random function
 */
export function createSeededRandom(seed = 12345) {
  let state = seed;

  return function() {
    // LCG parameters (same as glibc)
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// =============================================================================
// QUICK VALIDATION
// =============================================================================

/**
 * Run a quick validation with smaller sample size
 *
 * Useful for development and CI pipelines.
 *
 * @param {number} seed - Random seed for reproducibility
 * @returns {object} Validation results
 */
export function runQuickValidation(seed = 42) {
  const random = createSeededRandom(seed);
  return runValidationSuite(random, {
    sampleSize: 500,
    tolerance: 0.25, // Looser tolerance for smaller samples
    verbose: true
  });
}

/**
 * Run full validation with standard sample size
 *
 * @param {number} seed - Random seed for reproducibility
 * @returns {object} Validation results
 */
export function runFullValidation(seed = 42) {
  const random = createSeededRandom(seed);
  return runValidationSuite(random, {
    sampleSize: 2000,
    tolerance: 0.15,
    verbose: true
  });
}

// =============================================================================
// EXPORTS FOR TESTING
// =============================================================================

export {
  runDisplacementValidation,
  runRecoveryValidation,
  runTimelineValidation,
  runMicrochipValidation
};
