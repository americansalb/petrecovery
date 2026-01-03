/**
 * Batch Simulator API - Run multiple simulations
 *
 * POST /api/simulator/batch - Run a batch of simulations
 * GET /api/simulator/batch - List recent batches
 */

import { NextResponse } from 'next/server';
import { SimulationEngine, loadTerrain } from '@/app/lib/simulator/engine';

/**
 * Run batch and collect individual results
 */
async function runBatchWithResults(config, count, onProgress) {
  const results = [];
  const simulations = [];

  for (let i = 0; i < count; i++) {
    const engine = new SimulationEngine(config);
    const result = engine.run();
    results.push(result);

    // Store simplified simulation data for UI (without full paths to save memory)
    simulations.push({
      id: `sim_${result.seed}_${Date.now()}_${i}`,
      randomSeed: result.seed,
      outcome: result.outcome,
      foundAtMinute: result.foundAtMinute,
      foundBySearcher: result.foundBySearcher,
      foundLatitude: result.foundLatitude,
      foundLongitude: result.foundLongitude,
      wasTransported: result.wasTransported,
      transportedAtMinute: result.transportedAtMinute,
      petDistanceMiles: result.petDistanceMiles,
      searcherDistanceMiles: result.searcherDistanceMiles,
      finalPetState: result.finalPetState,
      // Store paths as JSON strings for playback
      petPathJson: JSON.stringify(result.petPath),
      searcherPathsJson: JSON.stringify(result.searcherPaths),
      eventsJson: JSON.stringify(result.events),
    });

    if (onProgress) {
      onProgress(i + 1, count);
    }

    // Yield to prevent blocking
    if (i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return { results, simulations };
}

/**
 * Aggregate batch results into statistics
 */
function aggregateResults(results, total) {
  const outcomes = {
    FOUND_BY_SEARCHER: 0,
    RETURNED_HOME: 0,
    FOUND_VIA_SHELTER: 0,
    FOUND_VIA_SOCIAL: 0,
    FOUND_VIA_PLATFORM: 0,
    TIMEOUT_SEARCHING: 0,
    TIMEOUT_SHELTERED: 0,
  };

  let totalTimeToFind = 0;
  let foundCount = 0;
  let totalPetDistance = 0;
  const timesToFind = [];

  for (const result of results) {
    outcomes[result.outcome]++;
    totalPetDistance += result.petDistanceMiles || 0;

    if (result.foundAtMinute && !result.outcome.startsWith('TIMEOUT')) {
      totalTimeToFind += result.foundAtMinute;
      foundCount++;
      timesToFind.push(result.foundAtMinute);
    }
  }

  // Calculate median
  timesToFind.sort((a, b) => a - b);
  const medianTimeToFind = timesToFind.length > 0
    ? timesToFind[Math.floor(timesToFind.length / 2)]
    : null;

  const successCount = total - outcomes.TIMEOUT_SEARCHING - outcomes.TIMEOUT_SHELTERED;

  return {
    totalRuns: total,
    successRate: (successCount / total) * 100,
    avgTimeToFindMins: foundCount > 0 ? totalTimeToFind / foundCount : null,
    medianTimeToFindMins: medianTimeToFind,
    avgPetDistanceMiles: totalPetDistance / total,
    foundBySearcherCount: outcomes.FOUND_BY_SEARCHER,
    returnedHomeCount: outcomes.RETURNED_HOME,
    foundViaShelterCount: outcomes.FOUND_VIA_SHELTER,
    foundViaSocialCount: outcomes.FOUND_VIA_SOCIAL,
    foundViaPlatformCount: outcomes.FOUND_VIA_PLATFORM,
    timeoutSearchingCount: outcomes.TIMEOUT_SEARCHING,
    timeoutShelteredCount: outcomes.TIMEOUT_SHELTERED,
  };
}

/**
 * POST - Run a batch of simulations
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { config, batchSize = 100, includeSimulations = true, useTerrain = true } = body;

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration is required' },
        { status: 400 }
      );
    }

    // Validate batch size
    const size = Math.min(Math.max(1, batchSize), 10000);

    // Load terrain data if enabled (Phase 2 feature)
    let terrainInfo = null;
    if (useTerrain) {
      try {
        terrainInfo = await loadTerrain(
          config.centerLatitude,
          config.centerLongitude,
          config.searchRadiusMiles || 2.0
        );
      } catch (terrainError) {
        console.warn('Terrain loading failed, continuing without:', terrainError.message);
      }
    }

    // Run batch and collect individual results
    const { results, simulations } = await runBatchWithResults(config, size);
    const aggregated = aggregateResults(results, size);

    // Format response
    const batch = {
      id: `batch_${Date.now()}`,
      status: 'COMPLETED',
      totalRuns: aggregated.totalRuns,
      completedRuns: aggregated.totalRuns,
      successRate: aggregated.successRate,
      avgTimeToFindMins: aggregated.avgTimeToFindMins,
      medianTimeToFindMins: aggregated.medianTimeToFindMins,
      avgPetDistanceMiles: aggregated.avgPetDistanceMiles,
      foundBySearcherCount: aggregated.foundBySearcherCount,
      returnedHomeCount: aggregated.returnedHomeCount,
      foundViaShelterCount: aggregated.foundViaShelterCount,
      foundViaSocialCount: aggregated.foundViaSocialCount,
      foundViaPlatformCount: aggregated.foundViaPlatformCount,
      timeoutSearchingCount: aggregated.timeoutSearchingCount,
      timeoutShelteredCount: aggregated.timeoutShelteredCount,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      // Include individual simulations for Results tab
      simulations: includeSimulations ? simulations : undefined,
    };

    return NextResponse.json({
      success: true,
      batch,
      terrainInfo, // Include terrain loading stats
    });

  } catch (error) {
    console.error('Batch simulation error:', error);
    return NextResponse.json(
      { error: 'Batch simulation failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET - List batches (placeholder)
 */
export async function GET(request) {
  return NextResponse.json({
    batches: [],
    message: 'Batch results are currently stored client-side.',
  });
}
