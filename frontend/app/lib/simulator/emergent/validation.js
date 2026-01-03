/**
 * Validation Framework for Emergent Simulation
 *
 * Tests displacement distributions against Huang 2018 empirical benchmarks.
 *
 * Huang 2018 Key Findings:
 * - Indoor-only cats: median displacement 39m, 75th percentile 137m
 * - Indoor-outdoor cats: median displacement 300m, 75th percentile 1609m
 *
 * If simulated displacements don't match, we adjust behavioral mechanics
 * (flee duration, speed, fear decay) - NOT outcome probabilities.
 */

import {
  SPECIES,
  SIZE,
  AGE_CATEGORY,
  TEMPERAMENT,
  ESCAPE_TYPE,
  TERRAIN_TYPE,
  buildPetConfig,
  buildSearcherConfig,
  buildEnvironmentConfig,
} from './config.js';
import { EmergentSimulationEngine } from './engine.js';
import { VALIDATION_BENCHMARKS } from './outcomes.js';

// =============================================================================
// DISPLACEMENT VALIDATION
// =============================================================================

/**
 * Run displacement validation for cats
 * Compares simulated displacements against Huang 2018 benchmarks
 *
 * @param {number} batchSize - Number of simulations per category
 * @param {boolean} verbose - Whether to print detailed output
 */
export async function validateDisplacement(batchSize = 100, verbose = true) {
  const results = {
    indoorOnly: null,
    indoorOutdoor: null,
    benchmarks: VALIDATION_BENCHMARKS.cats.displacement,
    timestamp: new Date().toISOString(),
    batchSize,
  };

  // Test indoor-only cats
  if (verbose) console.log('\n=== Indoor-Only Cat Displacement Test ===');
  results.indoorOnly = await runDisplacementBatch({
    species: SPECIES.CAT,
    isIndoorOnly: true,
    size: SIZE.SMALL,
    ageCategory: AGE_CATEGORY.ADULT,
    temperament: TEMPERAMENT.ALOOF,
    escapeType: ESCAPE_TYPE.DOOR_DASH,
  }, batchSize, verbose);

  // Test indoor-outdoor cats
  if (verbose) console.log('\n=== Indoor-Outdoor Cat Displacement Test ===');
  results.indoorOutdoor = await runDisplacementBatch({
    species: SPECIES.CAT,
    isIndoorOnly: false,
    size: SIZE.SMALL,
    ageCategory: AGE_CATEGORY.ADULT,
    temperament: TEMPERAMENT.ALOOF,
    escapeType: ESCAPE_TYPE.DOOR_DASH,
  }, batchSize, verbose);

  // Compare to benchmarks
  const comparison = compareToHuang2018(results);

  if (verbose) {
    console.log('\n=== VALIDATION SUMMARY ===');
    console.log('\nIndoor-Only Cats:');
    console.log(`  Simulated median: ${comparison.indoorOnly.simMedian.toFixed(1)}m`);
    console.log(`  Expected median:  ${comparison.indoorOnly.expectedMedian}m (Huang 2018)`);
    console.log(`  Ratio: ${comparison.indoorOnly.medianRatio.toFixed(2)}x`);
    console.log(`  Pass: ${comparison.indoorOnly.pass ? '✓' : '✗'}`);

    console.log('\nIndoor-Outdoor Cats:');
    console.log(`  Simulated median: ${comparison.indoorOutdoor.simMedian.toFixed(1)}m`);
    console.log(`  Expected median:  ${comparison.indoorOutdoor.expectedMedian}m (Huang 2018)`);
    console.log(`  Ratio: ${comparison.indoorOutdoor.medianRatio.toFixed(2)}x`);
    console.log(`  Pass: ${comparison.indoorOutdoor.pass ? '✓' : '✗'}`);

    console.log('\n=== CALIBRATION RECOMMENDATIONS ===');
    if (!comparison.indoorOnly.pass || !comparison.indoorOutdoor.pass) {
      printCalibrationAdvice(comparison);
    } else {
      console.log('Displacement distributions match Huang 2018 benchmarks!');
    }
  }

  return { results, comparison };
}

/**
 * Run a batch of simulations and collect displacement data
 */
async function runDisplacementBatch(petOptions, batchSize, verbose) {
  const displacements = [];
  const maxDisplacements = [];
  const fleeingDurations = [];
  const stateTransitions = [];

  // Fixed test location (doesn't matter for displacement calculation)
  const testLat = 40.7128;
  const testLng = -74.0060;

  const petConfig = buildPetConfig({
    ...petOptions,
    escapeLatitude: testLat,
    escapeLongitude: testLng,
    escapeDatetime: new Date().toISOString(),
  });

  const searcherConfig = buildSearcherConfig({
    searcherCount: 0,  // No searchers for displacement test
    searchStartDelayHours: 1000,  // Effectively disable search
  });

  const environmentConfig = buildEnvironmentConfig({
    terrainType: TERRAIN_TYPE.SUBURBAN,
    maxSimulationHours: 48,  // 2 days
    timeStepMinutes: 5,
  });

  const startTime = Date.now();

  for (let i = 0; i < batchSize; i++) {
    const engine = new EmergentSimulationEngine(petConfig, searcherConfig, environmentConfig);
    const result = engine.run();

    // Convert miles to meters
    const maxDispMeters = result.maxDisplacementMiles * 1609.34;
    const finalDispMeters = result.finalDisplacementMiles * 1609.34;

    maxDisplacements.push(maxDispMeters);
    displacements.push(finalDispMeters);
    stateTransitions.push(result.stateTransitionCount);

    // Track how long pet was in FLEEING state (estimate from path)
    const fleeingTime = result.petPath.filter(p => p.state === 'FLEEING').length * 5;  // 5-min ticks
    fleeingDurations.push(fleeingTime);

    // Progress indicator
    if (verbose && (i + 1) % 25 === 0) {
      console.log(`  Progress: ${i + 1}/${batchSize} simulations`);
    }

    // Yield to prevent blocking
    if (i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Calculate statistics
  maxDisplacements.sort((a, b) => a - b);
  displacements.sort((a, b) => a - b);
  fleeingDurations.sort((a, b) => a - b);

  const stats = {
    maxDisplacement: {
      min: maxDisplacements[0],
      q25: percentile(maxDisplacements, 25),
      median: percentile(maxDisplacements, 50),
      q75: percentile(maxDisplacements, 75),
      max: maxDisplacements[maxDisplacements.length - 1],
      mean: mean(maxDisplacements),
      stdDev: stdDev(maxDisplacements),
    },
    finalDisplacement: {
      min: displacements[0],
      q25: percentile(displacements, 25),
      median: percentile(displacements, 50),
      q75: percentile(displacements, 75),
      max: displacements[displacements.length - 1],
      mean: mean(displacements),
      stdDev: stdDev(displacements),
    },
    fleeingDuration: {
      median: percentile(fleeingDurations, 50),
      mean: mean(fleeingDurations),
    },
    stateTransitions: {
      median: percentile(stateTransitions, 50),
      mean: mean(stateTransitions),
    },
    executionTimeSeconds: (Date.now() - startTime) / 1000,
  };

  if (verbose) {
    console.log(`  Completed in ${stats.executionTimeSeconds.toFixed(1)}s`);
    console.log(`  Max displacement - Median: ${stats.maxDisplacement.median.toFixed(1)}m, Mean: ${stats.maxDisplacement.mean.toFixed(1)}m`);
    console.log(`  Fleeing duration - Median: ${stats.fleeingDuration.median.toFixed(0)} min`);
    console.log(`  State transitions - Mean: ${stats.stateTransitions.mean.toFixed(1)}`);
  }

  return stats;
}

/**
 * Compare simulation results to Huang 2018 benchmarks
 */
function compareToHuang2018(results) {
  const benchmarks = VALIDATION_BENCHMARKS.cats.displacement;

  // For indoor-only cats, we use MAX displacement (where pet was found)
  // Huang 2018 measured where cats were recovered, which is max displacement
  const indoorOnlyComparison = {
    simMedian: results.indoorOnly.maxDisplacement.median,
    simQ75: results.indoorOnly.maxDisplacement.q75,
    expectedMedian: benchmarks.indoorOnly.median_meters,
    expectedQ75: benchmarks.indoorOnly.q75_meters,
    medianRatio: results.indoorOnly.maxDisplacement.median / benchmarks.indoorOnly.median_meters,
    q75Ratio: results.indoorOnly.maxDisplacement.q75 / benchmarks.indoorOnly.q75_meters,
    // Pass if within factor of 3 (log-scale tolerance)
    pass: Math.abs(Math.log(results.indoorOnly.maxDisplacement.median / benchmarks.indoorOnly.median_meters)) < Math.log(3),
  };

  const indoorOutdoorComparison = {
    simMedian: results.indoorOutdoor.maxDisplacement.median,
    simQ75: results.indoorOutdoor.maxDisplacement.q75,
    expectedMedian: benchmarks.indoorOutdoor.median_meters,
    expectedQ75: benchmarks.indoorOutdoor.q75_meters,
    medianRatio: results.indoorOutdoor.maxDisplacement.median / benchmarks.indoorOutdoor.median_meters,
    q75Ratio: results.indoorOutdoor.maxDisplacement.q75 / benchmarks.indoorOutdoor.q75_meters,
    pass: Math.abs(Math.log(results.indoorOutdoor.maxDisplacement.median / benchmarks.indoorOutdoor.median_meters)) < Math.log(3),
  };

  return {
    indoorOnly: indoorOnlyComparison,
    indoorOutdoor: indoorOutdoorComparison,
    overallPass: indoorOnlyComparison.pass && indoorOutdoorComparison.pass,
  };
}

/**
 * Print calibration advice based on comparison
 */
function printCalibrationAdvice(comparison) {
  // Indoor-only cats
  if (!comparison.indoorOnly.pass) {
    const ratio = comparison.indoorOnly.medianRatio;
    if (ratio > 1) {
      console.log('\nIndoor-only cats displacing TOO FAR:');
      console.log('  - Reduce flee_duration_base_minutes for cats');
      console.log('  - Reduce base_speed_miles_per_tick');
      console.log('  - Increase energy_exhaustion_threshold');
      console.log('  - Reduce flee_speed_multiplier');
    } else {
      console.log('\nIndoor-only cats NOT displacing FAR ENOUGH:');
      console.log('  - Increase flee_duration_base_minutes for cats');
      console.log('  - Increase base_speed_miles_per_tick');
      console.log('  - Reduce energy_exhaustion_threshold');
      console.log('  - Increase flee_speed_multiplier');
    }
  }

  // Indoor-outdoor cats
  if (!comparison.indoorOutdoor.pass) {
    const ratio = comparison.indoorOutdoor.medianRatio;
    if (ratio > 1) {
      console.log('\nIndoor-outdoor cats displacing TOO FAR:');
      console.log('  - Reduce territory familiarity outdoor default');
      console.log('  - Increase base_fear_threshold for cats');
    } else {
      console.log('\nIndoor-outdoor cats NOT displacing FAR ENOUGH:');
      console.log('  - Increase territory familiarity outdoor default');
      console.log('  - Reduce base_fear_threshold for cats');
    }
  }

  // Relative comparison
  const indoorRatio = comparison.indoorOnly.simMedian;
  const outdoorRatio = comparison.indoorOutdoor.simMedian;
  const relativeRatio = outdoorRatio / indoorRatio;
  const expectedRelativeRatio = comparison.indoorOutdoor.expectedMedian / comparison.indoorOnly.expectedMedian;

  console.log(`\nRelative displacement ratio (outdoor/indoor):`);
  console.log(`  Simulated: ${relativeRatio.toFixed(1)}x`);
  console.log(`  Expected:  ${expectedRelativeRatio.toFixed(1)}x`);

  if (relativeRatio < expectedRelativeRatio * 0.5) {
    console.log('  → Indoor-outdoor cats need LARGER familiar range');
  } else if (relativeRatio > expectedRelativeRatio * 2) {
    console.log('  → Indoor-only cats need SMALLER familiar range');
  }
}

// =============================================================================
// OUTCOME VALIDATION
// =============================================================================

/**
 * Validate recovery rates against Weiss 2012
 */
export async function validateRecoveryRates(batchSize = 100, verbose = true) {
  const results = {
    dogs: null,
    cats: null,
    timestamp: new Date().toISOString(),
    batchSize,
  };

  if (verbose) console.log('\n=== Dog Recovery Rate Test ===');
  results.dogs = await runRecoveryBatch(SPECIES.DOG, batchSize, verbose);

  if (verbose) console.log('\n=== Cat Recovery Rate Test ===');
  results.cats = await runRecoveryBatch(SPECIES.CAT, batchSize, verbose);

  if (verbose) {
    console.log('\n=== RECOVERY RATE VALIDATION ===');

    const dogBenchmark = VALIDATION_BENCHMARKS.dogs.overallRecoveryRate;
    console.log(`\nDogs:`);
    console.log(`  Simulated: ${(results.dogs.recoveryRate * 100).toFixed(1)}%`);
    console.log(`  Expected:  ${(dogBenchmark * 100).toFixed(1)}% (Weiss 2012)`);
    console.log(`  Pass: ${Math.abs(results.dogs.recoveryRate - dogBenchmark) < 0.1 ? '✓' : '✗'}`);

    const catBenchmark = VALIDATION_BENCHMARKS.cats.overallRecoveryRate;
    console.log(`\nCats:`);
    console.log(`  Simulated: ${(results.cats.recoveryRate * 100).toFixed(1)}%`);
    console.log(`  Expected:  ${(catBenchmark * 100).toFixed(1)}% (Weiss 2012)`);
    console.log(`  Pass: ${Math.abs(results.cats.recoveryRate - catBenchmark) < 0.1 ? '✓' : '✗'}`);
  }

  return results;
}

/**
 * Run recovery rate batch
 */
async function runRecoveryBatch(species, batchSize, verbose) {
  const outcomes = {};
  let recoveredCount = 0;
  let selfReturnCount = 0;

  const testLat = 40.7128;
  const testLng = -74.0060;

  const petConfig = buildPetConfig({
    species,
    isIndoorOnly: species === SPECIES.CAT,
    size: species === SPECIES.CAT ? SIZE.SMALL : SIZE.MEDIUM,
    ageCategory: AGE_CATEGORY.ADULT,
    temperament: TEMPERAMENT.ALOOF,
    escapeType: ESCAPE_TYPE.DOOR_DASH,
    escapeLatitude: testLat,
    escapeLongitude: testLng,
    escapeDatetime: new Date().toISOString(),
    hasMicrochip: true,
    microchipRegistered: true,
    hasCollar: true,
    hasVisibleTags: true,
  });

  const searcherConfig = buildSearcherConfig({
    searcherCount: 2,
    searchStartDelayHours: 2,
  });

  const environmentConfig = buildEnvironmentConfig({
    terrainType: TERRAIN_TYPE.SUBURBAN,
    maxSimulationHours: 168,  // 7 days
    timeStepMinutes: 5,
  });

  for (let i = 0; i < batchSize; i++) {
    const engine = new EmergentSimulationEngine(petConfig, searcherConfig, environmentConfig);
    const result = engine.run();

    outcomes[result.outcome] = (outcomes[result.outcome] || 0) + 1;

    if (result.outcomeCategory === 'REUNITED') {
      recoveredCount++;
    }
    if (result.outcome === 'REUNITED_SELF_RETURN') {
      selfReturnCount++;
    }

    if (verbose && (i + 1) % 25 === 0) {
      console.log(`  Progress: ${i + 1}/${batchSize}`);
    }

    if (i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return {
    outcomes,
    recoveryRate: recoveredCount / batchSize,
    selfReturnRate: selfReturnCount / batchSize,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const idx = Math.floor((p / 100) * (arr.length - 1));
  return arr[idx];
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, val) => sum + (val - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

// =============================================================================
// CLI RUNNER
// =============================================================================

/**
 * Run all validations from command line
 */
export async function runAllValidations(batchSize = 100) {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     EMERGENT SIMULATION VALIDATION FRAMEWORK               ║');
  console.log('║     Testing against Huang 2018 & Weiss 2012 benchmarks     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nBatch size: ${batchSize} simulations per test`);

  const displacementResults = await validateDisplacement(batchSize, true);
  const recoveryResults = await validateRecoveryRates(batchSize, true);

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    FINAL RESULTS                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const allPass = displacementResults.comparison.overallPass;
  console.log(`\nDisplacement validation: ${displacementResults.comparison.overallPass ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Recovery rate validation: See above`);
  console.log(`\nOverall: ${allPass ? 'VALIDATION PASSED' : 'CALIBRATION NEEDED'}`);

  return { displacementResults, recoveryResults };
}
