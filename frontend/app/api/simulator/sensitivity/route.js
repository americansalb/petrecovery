/**
 * Sensitivity Analysis API - Compare simulations with single variable changes
 *
 * POST /api/simulator/sensitivity
 *
 * This implements "One-at-a-Time" (OAT) sensitivity analysis:
 * - Uses the SAME seed as a reference simulation
 * - Changes only ONE variable
 * - Compares outcomes to isolate variable impact
 *
 * Request body:
 * {
 *   config: { ... base config ... },
 *   seed: 12345,
 *   variableChanges: [
 *     { path: 'searcherCount', value: 10 },
 *     { path: 'petPersonality', value: 'SHY' },
 *   ]
 * }
 *
 * Response:
 * {
 *   baseline: { seed, outcome, foundAtMinute, ... },
 *   variations: [
 *     { change: { path, oldValue, newValue }, result: { outcome, ... }, delta: { ... } }
 *   ]
 * }
 */

import {
  LegacyEmergentSimulationEngine as SimulationEngine,
  loadTerrain,
} from '@/app/lib/simulator/emergent/adapter';

export const runtime = 'nodejs';

/**
 * Set a nested property by path (e.g., "searcherCount" or "nested.prop")
 */
function setByPath(obj, path, value) {
  const clone = JSON.parse(JSON.stringify(obj));
  const keys = path.split('.');
  let current = clone;

  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }

  current[keys[keys.length - 1]] = value;
  return clone;
}

/**
 * Get a nested property by path
 */
function getByPath(obj, path) {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current == null || !(key in current)) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

/**
 * Run a single simulation and extract key metrics
 */
function runSimulation(config, seed) {
  const engine = new SimulationEngine(config, seed);
  const result = engine.run();

  return {
    seed: result.seed,
    outcome: result.outcome,
    foundAtMinute: result.foundAtMinute,
    foundBySearcher: result.foundBySearcher,
    petDistanceMiles: result.petDistanceMiles,
    wasTransported: result.wasTransported,
    finalPetState: result.finalPetState,
    research: result.research,
  };
}

/**
 * Calculate delta between baseline and variation
 */
function calculateDelta(baseline, variation) {
  const delta = {
    outcomeChanged: baseline.outcome !== variation.outcome,
    foundTimeChange: null,
    recoveryModeChanged: baseline.research?.recoveryMode !== variation.research?.recoveryMode,
  };

  if (baseline.foundAtMinute != null && variation.foundAtMinute != null) {
    delta.foundTimeChange = variation.foundAtMinute - baseline.foundAtMinute;
    delta.foundTimeChangePercent = ((variation.foundAtMinute - baseline.foundAtMinute) / baseline.foundAtMinute * 100).toFixed(1);
  }

  return delta;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { config, seed, variableChanges = [], useTerrain = true } = body;

    if (!config || !seed) {
      return Response.json(
        { error: 'Config and seed are required' },
        { status: 400 }
      );
    }

    if (variableChanges.length === 0) {
      return Response.json(
        { error: 'At least one variable change is required' },
        { status: 400 }
      );
    }

    // Load terrain if needed
    if (useTerrain && config.centerLatitude && config.centerLongitude) {
      try {
        await loadTerrain(
          config.centerLatitude,
          config.centerLongitude,
          config.searchRadiusMiles || 2.0
        );
      } catch (e) {
        console.warn('Terrain loading failed:', e.message);
      }
    }

    // Run baseline simulation
    const baseline = runSimulation(config, seed);

    // Run variations (same seed, different config)
    const variations = [];

    for (const change of variableChanges) {
      const oldValue = getByPath(config, change.path);
      const modifiedConfig = setByPath(config, change.path, change.value);

      const result = runSimulation(modifiedConfig, seed);
      const delta = calculateDelta(baseline, result);

      variations.push({
        change: {
          path: change.path,
          oldValue,
          newValue: change.value,
        },
        result,
        delta,
      });
    }

    return Response.json({
      baseline,
      variations,
      analysisType: 'One-at-a-Time (OAT) Sensitivity Analysis',
      note: 'Same seed ensures identical random events. Only the changed variable affects outcome.',
    });

  } catch (error) {
    console.error('Sensitivity analysis error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
