/**
 * Sensitivity Analysis Framework for Lost Pet Simulator
 *
 * Analyzes the impact of UNVERIFIED parameters on simulation outcomes.
 * Results prioritize Phase 0 research by identifying high-impact parameters.
 *
 * Purpose:
 * 1. Quantify how much each UNVERIFIED parameter affects key outcomes
 * 2. Generate tornado diagrams showing parameter importance
 * 3. Guide Phase 0 research toward parameters that matter most
 */

import {
  UNVERIFIED_PARAMS,
  COLLAR_TAG,
  getUncertainParameters,
  sampleUncertainParam,
  rankParametersByUncertainty
} from './researchConfig.js';
import { createSeededRandom } from './validation.js';
import { SimulationEngine, OUTCOMES } from './engine.js';

// =============================================================================
// SENSITIVITY ANALYSIS CONFIGURATION
// =============================================================================

/**
 * Parameters to analyze with their test ranges
 *
 * Each parameter specifies:
 * - baseline: Current default value
 * - low: Lower bound for sensitivity test
 * - high: Upper bound for sensitivity test
 * - unit: Unit of measurement
 * - priority: Research priority (HIGH, MEDIUM, LOW)
 */
export const SENSITIVITY_PARAMS = {
  // Movement speeds
  FLEEING_SPEED: {
    name: 'Fleeing Speed',
    baseline: UNVERIFIED_PARAMS.STATE_SPEEDS.FLEEING,
    low: 0.01,
    high: 0.10,
    unit: 'mi/5min',
    priority: 'HIGH',
    category: 'Movement'
  },

  HIDING_SPEED: {
    name: 'Hiding Speed',
    baseline: UNVERIFIED_PARAMS.STATE_SPEEDS.HIDING,
    low: 0.0005,
    high: 0.005,
    unit: 'mi/5min',
    priority: 'MEDIUM',
    category: 'Movement'
  },

  FORAGING_SPEED: {
    name: 'Foraging Speed',
    baseline: UNVERIFIED_PARAMS.STATE_SPEEDS.FORAGING,
    low: 0.002,
    high: 0.02,
    unit: 'mi/5min',
    priority: 'MEDIUM',
    category: 'Movement'
  },

  WANDERING_SPEED: {
    name: 'Wandering Speed',
    baseline: UNVERIFIED_PARAMS.STATE_SPEEDS.WANDERING,
    low: 0.005,
    high: 0.03,
    unit: 'mi/5min',
    priority: 'MEDIUM',
    category: 'Movement'
  },

  // Detection rates
  DETECTION_BASE_RATE: {
    name: 'Detection Base Rate',
    baseline: UNVERIFIED_PARAMS.DETECTION.baseRate,
    low: 0.001,
    high: 0.01,
    unit: 'per step',
    priority: 'HIGH',
    category: 'Detection'
  },

  HIDING_DETECTION_MODIFIER: {
    name: 'Hiding Detection Modifier',
    baseline: UNVERIFIED_PARAMS.DETECTION.hidingModifier,
    low: 0.1,
    high: 0.5,
    unit: 'multiplier',
    priority: 'HIGH',
    category: 'Detection'
  },

  // Search timing
  SEARCH_DELAY_HOURS: {
    name: 'Search Start Delay',
    baseline: UNVERIFIED_PARAMS.SEARCH_TIMING.delayHours,
    low: 0.5,
    high: 8,
    unit: 'hours',
    priority: 'MEDIUM',
    category: 'Search'
  },

  VOLUNTEER_RAMP_UP: {
    name: 'Volunteer Ramp-up Time',
    baseline: UNVERIFIED_PARAMS.SEARCH_TIMING.volunteerRampUpHours,
    low: 6,
    high: 48,
    unit: 'hours',
    priority: 'LOW',
    category: 'Search'
  },

  INITIAL_VOLUNTEER_PERCENT: {
    name: 'Initial Volunteer %',
    baseline: UNVERIFIED_PARAMS.SEARCH_TIMING.initialVolunteerPercent,
    low: 5,
    high: 50,
    unit: '%',
    priority: 'LOW',
    category: 'Search'
  },

  // Collar/tag effect (UNVERIFIED from Lord 2007)
  COLLAR_TAG_EFFECT: {
    name: 'Collar/Tag Effect',
    baseline: COLLAR_TAG.recoveryEffect,
    low: 0.20,
    high: 0.80,
    unit: 'multiplier',
    priority: 'HIGH',
    category: 'Identification'
  }
};

// =============================================================================
// OUTCOME METRICS
// =============================================================================

/**
 * Key outcome metrics to measure sensitivity against
 */
export const OUTCOME_METRICS = {
  RECOVERY_RATE: {
    name: 'Recovery Rate',
    description: 'Percentage of pets recovered',
    unit: '%'
  },
  MEDIAN_RECOVERY_TIME: {
    name: 'Median Recovery Time',
    description: 'Median hours until recovery',
    unit: 'hours'
  },
  SEARCH_EFFECTIVENESS: {
    name: 'Search Effectiveness',
    description: 'Percentage found via active search',
    unit: '%'
  },
  DISPLACEMENT_DISTANCE: {
    name: 'Displacement Distance',
    description: 'Median distance from home at recovery',
    unit: 'meters'
  }
};

// =============================================================================
// SENSITIVITY ANALYSIS RUNNER
// =============================================================================

/**
 * Run sensitivity analysis for a single parameter
 *
 * @param {string} paramKey - Key from SENSITIVITY_PARAMS
 * @param {function} simulationRunner - Function that runs simulation with modified params
 * @param {object} options - Analysis options
 * @returns {object} Sensitivity results for this parameter
 */
export function analyzeParameter(paramKey, simulationRunner, options = {}) {
  const {
    samples = 100,
    seed = 42
  } = options;

  const param = SENSITIVITY_PARAMS[paramKey];
  if (!param) {
    throw new Error(`Unknown parameter: ${paramKey}`);
  }

  const random = createSeededRandom(seed);

  // Run baseline
  const baselineResults = simulationRunner({
    [paramKey]: param.baseline
  }, samples, random);

  // Run with low value
  const lowResults = simulationRunner({
    [paramKey]: param.low
  }, samples, createSeededRandom(seed));

  // Run with high value
  const highResults = simulationRunner({
    [paramKey]: param.high
  }, samples, createSeededRandom(seed));

  // Calculate sensitivity for each outcome metric
  const sensitivity = {};

  for (const [metricKey, metric] of Object.entries(OUTCOME_METRICS)) {
    const baseValue = baselineResults[metricKey];
    const lowValue = lowResults[metricKey];
    const highValue = highResults[metricKey];

    // Sensitivity = (high - low) / baseline
    const swing = Math.abs(highValue - lowValue);
    const normalizedSwing = baseValue > 0 ? swing / baseValue : swing;

    sensitivity[metricKey] = {
      metric: metric.name,
      baseline: baseValue,
      low: lowValue,
      high: highValue,
      swing,
      normalizedSwing,
      unit: metric.unit
    };
  }

  return {
    parameter: param.name,
    paramKey,
    category: param.category,
    priority: param.priority,
    values: {
      baseline: param.baseline,
      low: param.low,
      high: param.high,
      unit: param.unit
    },
    sensitivity
  };
}

/**
 * Run full sensitivity analysis on all UNVERIFIED parameters
 *
 * @param {function} simulationRunner - Function that runs simulation with modified params
 * @param {object} options - Analysis options
 * @returns {object} Complete sensitivity analysis results
 */
export function runSensitivityAnalysis(simulationRunner, options = {}) {
  const results = {
    timestamp: new Date().toISOString(),
    parameters: {},
    rankings: {}
  };

  // Analyze each parameter
  for (const paramKey of Object.keys(SENSITIVITY_PARAMS)) {
    try {
      results.parameters[paramKey] = analyzeParameter(paramKey, simulationRunner, options);
    } catch (error) {
      results.parameters[paramKey] = {
        error: error.message,
        paramKey
      };
    }
  }

  // Rank parameters by impact on each metric
  for (const metricKey of Object.keys(OUTCOME_METRICS)) {
    const ranked = Object.entries(results.parameters)
      .filter(([_, result]) => result.sensitivity && result.sensitivity[metricKey])
      .map(([key, result]) => ({
        paramKey: key,
        parameter: result.parameter,
        priority: result.priority,
        normalizedSwing: result.sensitivity[metricKey].normalizedSwing
      }))
      .sort((a, b) => b.normalizedSwing - a.normalizedSwing);

    results.rankings[metricKey] = ranked;
  }

  return results;
}

// =============================================================================
// TORNADO DIAGRAM DATA
// =============================================================================

/**
 * Generate tornado diagram data for visualization
 *
 * @param {object} analysisResults - Results from runSensitivityAnalysis
 * @param {string} metricKey - Outcome metric to visualize
 * @returns {object} Data formatted for tornado chart
 */
export function generateTornadoData(analysisResults, metricKey) {
  const metric = OUTCOME_METRICS[metricKey];
  if (!metric) {
    throw new Error(`Unknown metric: ${metricKey}`);
  }

  const data = [];

  for (const [paramKey, result] of Object.entries(analysisResults.parameters)) {
    if (result.error || !result.sensitivity || !result.sensitivity[metricKey]) {
      continue;
    }

    const sens = result.sensitivity[metricKey];

    data.push({
      parameter: result.parameter,
      paramKey,
      category: result.category,
      priority: result.priority,
      baseline: sens.baseline,
      low: sens.low,
      high: sens.high,
      lowDelta: sens.low - sens.baseline,
      highDelta: sens.high - sens.baseline,
      swing: sens.swing,
      normalizedSwing: sens.normalizedSwing
    });
  }

  // Sort by absolute swing (largest impact first)
  data.sort((a, b) => b.swing - a.swing);

  return {
    metric: metric.name,
    metricKey,
    unit: metric.unit,
    bars: data
  };
}

// =============================================================================
// REPORTING
// =============================================================================

/**
 * Format sensitivity analysis results as text report
 *
 * @param {object} results - Results from runSensitivityAnalysis
 * @returns {string} Formatted report
 */
export function formatSensitivityReport(results) {
  const lines = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('         SENSITIVITY ANALYSIS - UNVERIFIED PARAMETERS');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`Timestamp: ${results.timestamp}`);
  lines.push('');
  lines.push('Purpose: Identify which UNVERIFIED parameters have the largest');
  lines.push('impact on simulation outcomes, to prioritize Phase 0 research.');
  lines.push('');

  // Summary by priority
  lines.push('┌─ RESEARCH PRIORITY RECOMMENDATIONS');
  lines.push('│');

  const highPriority = Object.entries(results.parameters)
    .filter(([_, r]) => r.priority === 'HIGH')
    .map(([_, r]) => r.parameter);

  const mediumPriority = Object.entries(results.parameters)
    .filter(([_, r]) => r.priority === 'MEDIUM')
    .map(([_, r]) => r.parameter);

  lines.push('│  HIGH PRIORITY (research first):');
  highPriority.forEach(p => lines.push(`│    • ${p}`));
  lines.push('│');
  lines.push('│  MEDIUM PRIORITY:');
  mediumPriority.forEach(p => lines.push(`│    • ${p}`));
  lines.push('└─');
  lines.push('');

  // Rankings for each metric
  for (const [metricKey, ranking] of Object.entries(results.rankings)) {
    const metric = OUTCOME_METRICS[metricKey];
    lines.push(`┌─ IMPACT ON ${metric.name.toUpperCase()}`);

    ranking.slice(0, 5).forEach((item, i) => {
      const impact = (item.normalizedSwing * 100).toFixed(1);
      lines.push(`│  ${i + 1}. ${item.parameter} (${impact}% swing) [${item.priority}]`);
    });

    lines.push('└─');
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('NOTE: Parameters with high swing values should be prioritized');
  lines.push('for literature review in Phase 0 research.');
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

// =============================================================================
// MOCK SIMULATION RUNNER (for testing)
// =============================================================================

/**
 * Mock simulation runner for testing sensitivity framework
 *
 * This is a simplified simulation that demonstrates the sensitivity analysis
 * without requiring the full simulation engine.
 *
 * @param {object} params - Modified parameters
 * @param {number} samples - Number of samples
 * @param {function} random - Random number generator
 * @returns {object} Simulated outcome metrics
 */
export function mockSimulationRunner(params, samples, random) {
  // Simplified simulation logic for testing
  let totalRecovered = 0;
  let totalRecoveryTime = 0;
  let totalSearchFound = 0;
  let totalDisplacement = 0;
  let recoveredCount = 0;

  for (let i = 0; i < samples; i++) {
    // Base recovery probability affected by detection rate
    const detectionRate = params.DETECTION_BASE_RATE || SENSITIVITY_PARAMS.DETECTION_BASE_RATE.baseline;
    const baseRecovery = 0.75 + (detectionRate - 0.002) * 10;

    if (random() < Math.min(0.95, Math.max(0.5, baseRecovery))) {
      totalRecovered++;
      recoveredCount++;

      // Recovery time affected by search delay and volunteer ramp-up
      const delay = params.SEARCH_DELAY_HOURS || SENSITIVITY_PARAMS.SEARCH_DELAY_HOURS.baseline;
      const rampUp = params.VOLUNTEER_RAMP_UP || SENSITIVITY_PARAMS.VOLUNTEER_RAMP_UP.baseline;
      const baseTime = 24 + delay + (rampUp / 4);
      totalRecoveryTime += baseTime + random() * 48;

      // Search effectiveness affected by detection rate and hiding modifier
      const hidingMod = params.HIDING_DETECTION_MODIFIER || SENSITIVITY_PARAMS.HIDING_DETECTION_MODIFIER.baseline;
      if (random() < 0.49 * (detectionRate / 0.002) * hidingMod) {
        totalSearchFound++;
      }

      // Displacement affected by movement speeds
      const fleeingSpeed = params.FLEEING_SPEED || SENSITIVITY_PARAMS.FLEEING_SPEED.baseline;
      const wanderingSpeed = params.WANDERING_SPEED || SENSITIVITY_PARAMS.WANDERING_SPEED.baseline;
      totalDisplacement += 50 + (fleeingSpeed + wanderingSpeed) * 1000 * random();
    }
  }

  return {
    RECOVERY_RATE: (totalRecovered / samples) * 100,
    MEDIAN_RECOVERY_TIME: recoveredCount > 0 ? totalRecoveryTime / recoveredCount : 0,
    SEARCH_EFFECTIVENESS: recoveredCount > 0 ? (totalSearchFound / recoveredCount) * 100 : 0,
    DISPLACEMENT_DISTANCE: recoveredCount > 0 ? totalDisplacement / recoveredCount : 0
  };
}

// =============================================================================
// MONTE CARLO UNCERTAINTY QUANTIFICATION
// =============================================================================

/**
 * Run Monte Carlo uncertainty quantification
 *
 * For each simulation, randomly sample ALL uncertain parameters from their
 * distributions, then aggregate results to build output distributions.
 *
 * @param {object} baseConfig - Base simulation configuration
 * @param {number} runs - Number of Monte Carlo runs (default 500)
 * @param {function} progressCallback - Called with progress updates
 * @returns {Promise<object>} Uncertainty quantification results with confidence intervals
 */
export async function runMonteCarloUQ(baseConfig, runs = 500, progressCallback = null) {
  const uncertainParams = getUncertainParameters();
  const successRates = [];
  const timesToFind = [];
  const allOutcomes = [];

  const seededRandom = createSeededRandom(Date.now());

  for (let i = 0; i < runs; i++) {
    // Sample all uncertain parameters
    const overrides = {};

    for (const param of uncertainParams) {
      const sampledValue = sampleUncertainParam(param, seededRandom);
      overrides[param.path] = sampledValue;
    }

    // Run single simulation with sampled parameters
    try {
      const engine = new SimulationEngine({
        ...baseConfig,
        _parameterOverrides: overrides,
      });
      const result = engine.run();

      const isSuccess = !result.outcome.startsWith('TIMEOUT');
      successRates.push(isSuccess ? 1 : 0);
      allOutcomes.push(result.outcome);

      if (result.foundAtMinute && isSuccess) {
        timesToFind.push(result.foundAtMinute);
      }

    } catch (e) {
      console.warn(`Monte Carlo run ${i} failed:`, e.message);
    }

    if (progressCallback && (i + 1) % 10 === 0) {
      progressCallback({
        completed: i + 1,
        total: runs,
        percent: Math.round(((i + 1) / runs) * 100),
      });
    }

    // Yield periodically to prevent blocking
    if (i % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Calculate statistics
  const stats = calculateStatistics(successRates);
  const timeStats = timesToFind.length > 0 ? calculateStatistics(timesToFind) : null;

  // Outcome distribution
  const outcomeCounts = {};
  for (const outcome of allOutcomes) {
    outcomeCounts[outcome] = (outcomeCounts[outcome] || 0) + 1;
  }

  return {
    runs,
    successRate: {
      mean: stats.mean * 100,
      stdDev: stats.stdDev * 100,
      ci95Lower: Math.max(0, (stats.mean - 1.96 * stats.stdError) * 100),
      ci95Upper: Math.min(100, (stats.mean + 1.96 * stats.stdError) * 100),
      ci99Lower: Math.max(0, (stats.mean - 2.576 * stats.stdError) * 100),
      ci99Upper: Math.min(100, (stats.mean + 2.576 * stats.stdError) * 100),
    },
    timeToFind: timeStats ? {
      mean: timeStats.mean,
      stdDev: timeStats.stdDev,
      median: timeStats.median,
      ci95Lower: Math.max(0, timeStats.mean - 1.96 * timeStats.stdError),
      ci95Upper: timeStats.mean + 1.96 * timeStats.stdError,
    } : null,
    outcomeDistribution: outcomeCounts,
    parametersAnalyzed: uncertainParams.length,
    analysisDate: new Date().toISOString(),
  };
}

/**
 * Calculate statistics for an array of numbers
 */
function calculateStatistics(values) {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, stdError: 0, median: 0 };
  }

  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;

  const squaredDiffs = values.map(v => (v - mean) ** 2);
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / n;
  const stdDev = Math.sqrt(variance);
  const stdError = stdDev / Math.sqrt(n);

  const sorted = [...values].sort((a, b) => a - b);
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  return { mean, stdDev, stdError, median, n };
}

// =============================================================================
// QUICK UNCERTAINTY ESTIMATE
// =============================================================================

/**
 * Get a quick uncertainty estimate without running full Monte Carlo
 *
 * Uses analytical approximation based on parameter uncertainty ranges.
 * Less accurate but instant.
 *
 * @param {number} nominalSuccessRate - Success rate from nominal simulation (0-100)
 * @returns {object} Estimated uncertainty bounds
 */
export function estimateUncertaintyBounds(nominalSuccessRate) {
  const rankedParams = rankParametersByUncertainty();

  // Sum of squared uncertainty contributions (simplified)
  let totalUncertainty = 0;

  for (const param of rankedParams) {
    // Estimate each parameter's contribution to output uncertainty
    // Using a rough sensitivity coefficient
    const paramUncertainty = param.uncertaintyScore * 0.03; // 3% per unit score
    totalUncertainty += paramUncertainty * paramUncertainty;
  }

  // Combined standard deviation (root sum of squares)
  const combinedStdDev = Math.sqrt(totalUncertainty) * nominalSuccessRate;

  return {
    nominal: nominalSuccessRate,
    estimatedStdDev: combinedStdDev,
    ci95Lower: Math.max(0, nominalSuccessRate - 1.96 * combinedStdDev),
    ci95Upper: Math.min(100, nominalSuccessRate + 1.96 * combinedStdDev),
    warning: 'Quick estimate - run full Monte Carlo UQ for accurate bounds',
    unverifiedParameterCount: rankedParams.length,
  };
}

/**
 * Format uncertainty analysis results for display
 */
export function formatUncertaintyReport(uqResults) {
  const sr = uqResults.successRate;

  return {
    summary: `${sr.mean.toFixed(1)}% ± ${sr.stdDev.toFixed(1)}%`,
    confidence95: `${sr.ci95Lower.toFixed(1)}% - ${sr.ci95Upper.toFixed(1)}%`,
    confidence99: `${sr.ci99Lower.toFixed(1)}% - ${sr.ci99Upper.toFixed(1)}%`,
    interpretation: getConfidenceInterpretation(sr),
    timeToFind: uqResults.timeToFind
      ? `${uqResults.timeToFind.mean.toFixed(0)} ± ${uqResults.timeToFind.stdDev.toFixed(0)} minutes`
      : 'N/A',
  };
}

function getConfidenceInterpretation(successRate) {
  const range = successRate.ci95Upper - successRate.ci95Lower;

  if (range < 5) {
    return 'High confidence - results are robust to parameter uncertainty';
  } else if (range < 15) {
    return 'Moderate confidence - some sensitivity to uncertain parameters';
  } else if (range < 30) {
    return 'Low confidence - results significantly affected by uncertain parameters';
  } else {
    return 'Very low confidence - more research needed to validate parameters';
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  analyzeParameter as analyzeSingleParameter,
  calculateStatistics
};
