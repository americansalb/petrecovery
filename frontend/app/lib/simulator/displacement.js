/**
 * Log-Normal Displacement Model for Lost Pet Simulator
 *
 * Implements research-backed displacement distributions using log-normal sampling.
 * Log-normal is appropriate because:
 * 1. Displacement cannot be negative
 * 2. Most pets stay close to home (right-skewed distribution)
 * 3. Heavy tail accounts for pets that travel far
 *
 * Parameters are derived from peer-reviewed research:
 * - Cats: Huang 2018 (indoor-only vs indoor-outdoor distinction)
 * - Dogs: Derived from Kremer 2021 quantiles
 */

import { getDisplacementParams, DOG_DISPLACEMENT } from './researchConfig.js';

// Standard normal distribution z-score for 75th percentile
const Z_75 = 0.6745;

// =============================================================================
// LOG-NORMAL PARAMETER DERIVATION
// =============================================================================

/**
 * Derive log-normal parameters (μ, σ) from median and 75th percentile
 *
 * For log-normal distribution:
 *   median = e^μ
 *   q75 = e^(μ + Z_75 * σ)
 *
 * Therefore:
 *   μ = ln(median)
 *   σ = (ln(q75) - μ) / Z_75
 *
 * @param {number} median - Median displacement in meters
 * @param {number} q75 - 75th percentile displacement in meters
 * @returns {object} Log-normal parameters { mu, sigma }
 */
export function deriveLogNormalParams(median, q75) {
  const mu = Math.log(median);
  const sigma = (Math.log(q75) - mu) / Z_75;

  return { mu, sigma };
}

/**
 * Get log-normal parameters for a species and lifestyle
 * @param {string} species - 'cat' or 'dog'
 * @param {string} lifestyle - 'indoorOnly' or 'indoorOutdoor' (cats only)
 * @returns {object} Log-normal parameters { mu, sigma, median, q75 }
 */
export function getLogNormalParams(species, lifestyle = 'indoorOutdoor') {
  const params = getDisplacementParams(species, lifestyle);
  const { mu, sigma } = deriveLogNormalParams(params.median, params.q75);

  return {
    mu,
    sigma,
    median: params.median,
    q75: params.q75,
    unit: params.unit,
    status: params.status,
    citation: params.citation
  };
}

// =============================================================================
// BOX-MULLER TRANSFORM FOR NORMAL SAMPLING
// =============================================================================

/**
 * Generate a standard normal random variable using Box-Muller transform
 * @param {function} random - Random number generator returning [0, 1)
 * @returns {number} Standard normal random variable
 */
export function boxMuller(random) {
  let u1, u2;

  // Avoid log(0)
  do {
    u1 = random();
  } while (u1 === 0);

  u2 = random();

  // Box-Muller transform
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

  return z;
}

// =============================================================================
// LOG-NORMAL SAMPLING
// =============================================================================

/**
 * Sample from a log-normal distribution
 * @param {number} mu - Log-normal location parameter
 * @param {number} sigma - Log-normal scale parameter
 * @param {function} random - Random number generator
 * @returns {number} Log-normal random variable
 */
export function sampleLogNormal(mu, sigma, random) {
  const z = boxMuller(random);
  return Math.exp(mu + sigma * z);
}

/**
 * Sample displacement distance for a lost pet
 *
 * This is the main entry point for the displacement model.
 *
 * @param {string} species - 'cat' or 'dog'
 * @param {string} lifestyle - 'indoorOnly' or 'indoorOutdoor' (cats only, defaults to indoorOutdoor)
 * @param {function} random - Random number generator
 * @returns {object} Displacement result { distance, unit, params }
 */
export function sampleDisplacement(species, lifestyle, random) {
  const params = getLogNormalParams(species, lifestyle);
  const distance = sampleLogNormal(params.mu, params.sigma, random);

  return {
    distance,                   // in meters
    distanceMiles: distance / 1609.34,  // convert to miles
    unit: 'meters',
    params: {
      mu: params.mu,
      sigma: params.sigma,
      median: params.median,
      q75: params.q75,
      status: params.status
    }
  };
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Generate multiple displacement samples for validation
 * @param {string} species - 'cat' or 'dog'
 * @param {string} lifestyle - 'indoorOnly' or 'indoorOutdoor'
 * @param {number} n - Number of samples
 * @param {function} random - Random number generator
 * @returns {number[]} Array of displacement distances in meters
 */
export function generateSamples(species, lifestyle, n, random) {
  const samples = [];
  for (let i = 0; i < n; i++) {
    const result = sampleDisplacement(species, lifestyle, random);
    samples.push(result.distance);
  }
  return samples;
}

/**
 * Calculate empirical median from samples
 * @param {number[]} samples - Array of displacement distances
 * @returns {number} Empirical median
 */
export function empiricalMedian(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

/**
 * Calculate empirical percentile from samples
 * @param {number[]} samples - Array of displacement distances
 * @param {number} p - Percentile (0-100)
 * @returns {number} Empirical percentile value
 */
export function empiricalPercentile(samples, p) {
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Calculate proportion of samples within a threshold
 * @param {number[]} samples - Array of displacement distances
 * @param {number} threshold - Distance threshold in meters
 * @returns {number} Proportion of samples within threshold (0-1)
 */
export function proportionWithin(samples, threshold) {
  const count = samples.filter(s => s <= threshold).length;
  return count / samples.length;
}

/**
 * Validate displacement distribution against research benchmarks
 *
 * For cats: Check median matches Huang 2018
 * For dogs: Check quantiles match Kremer 2021 (42% within 122m, 70% within 1609m)
 *
 * @param {string} species - 'cat' or 'dog'
 * @param {string} lifestyle - 'indoorOnly' or 'indoorOutdoor'
 * @param {number} n - Number of samples (default 1000)
 * @param {function} random - Random number generator
 * @param {number} tolerance - Acceptable deviation (default 0.2 = 20%)
 * @returns {object} Validation result { passed, expected, actual, tolerance }
 */
export function validateDistribution(species, lifestyle, n = 1000, random, tolerance = 0.2) {
  const samples = generateSamples(species, lifestyle, n, random);
  const params = getLogNormalParams(species, lifestyle);

  if (species === 'dog') {
    // Validate against Kremer 2021 quantiles
    const p42_actual = proportionWithin(samples, DOG_DISPLACEMENT.sourceQuantiles.p42);
    const p70_actual = proportionWithin(samples, DOG_DISPLACEMENT.sourceQuantiles.p70);

    const p42_expected = 0.42;
    const p70_expected = 0.70;

    const p42_passed = Math.abs(p42_actual - p42_expected) <= tolerance;
    const p70_passed = Math.abs(p70_actual - p70_expected) <= tolerance;

    return {
      passed: p42_passed && p70_passed,
      tests: [
        {
          name: '42% within 400ft (122m)',
          expected: p42_expected,
          actual: p42_actual,
          tolerance,
          passed: p42_passed,
          source: 'Kremer 2021'
        },
        {
          name: '70% within 1 mile (1609m)',
          expected: p70_expected,
          actual: p70_actual,
          tolerance,
          passed: p70_passed,
          source: 'Kremer 2021'
        }
      ]
    };
  }

  // For cats, validate median
  const actualMedian = empiricalMedian(samples);
  const expectedMedian = params.median;
  const deviation = Math.abs(actualMedian - expectedMedian) / expectedMedian;
  const passed = deviation <= tolerance;

  return {
    passed,
    tests: [
      {
        name: `${lifestyle} cat median displacement`,
        expected: expectedMedian,
        actual: actualMedian,
        tolerance,
        passed,
        source: 'Huang 2018'
      }
    ]
  };
}

// =============================================================================
// PROBABILITY ZONE CALCULATION
// =============================================================================

/**
 * Calculate probability zones for map visualization
 *
 * Returns radii for different probability contours based on the log-normal distribution.
 *
 * @param {string} species - 'cat' or 'dog'
 * @param {string} lifestyle - 'indoorOnly' or 'indoorOutdoor'
 * @returns {object} Probability zones { p25, p50, p75, p90, p95 } in meters
 */
export function getProbabilityZones(species, lifestyle = 'indoorOutdoor') {
  const params = getLogNormalParams(species, lifestyle);

  // Z-scores for different percentiles
  const percentiles = {
    p25: -0.6745,
    p50: 0,          // median
    p75: 0.6745,
    p90: 1.2816,
    p95: 1.6449
  };

  const zones = {};
  for (const [key, z] of Object.entries(percentiles)) {
    zones[key] = Math.exp(params.mu + z * params.sigma);
  }

  return {
    ...zones,
    unit: 'meters',
    species,
    lifestyle,
    status: params.status
  };
}
