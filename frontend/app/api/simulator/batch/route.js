/**
 * Batch Simulator API - Run and save batch simulations
 *
 * POST /api/simulator/batch - Run a batch of simulations (optionally save to DB)
 * GET /api/simulator/batch - List saved batch results
 *
 * MEMORY OPTIMIZATION: Uses incremental aggregation to prevent heap exhaustion
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { SimulationEngine, loadTerrain, OUTCOMES } from '@/app/lib/simulator/engine';

/**
 * POST - Run a batch of simulations
 *
 * Options:
 * - save: boolean (default: false) - Save results to database
 * - savePaths: boolean (default: false) - Save full path data (memory intensive)
 * - includeSimulations: boolean (default: false) - Include individual sims in response
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      config,
      batchSize = 100,
      save = false,
      savePaths = false,
      includeSimulations = false,
      useTerrain = true
    } = body;

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration is required' },
        { status: 400 }
      );
    }

    if (!config.centerLatitude || !config.centerLongitude) {
      return NextResponse.json(
        { error: 'Center location is required' },
        { status: 400 }
      );
    }

    // Validate batch size (limit to 1000 for memory safety)
    const size = Math.min(Math.max(1, batchSize), 1000);

    // Load terrain data if enabled
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

    // Create database records if saving
    let savedConfig = null;
    let batch = null;

    if (save) {
      savedConfig = await prisma.simulationConfig.create({
        data: {
          petSpecies: config.petSpecies || 'DOG',
          petSize: config.petSize || 'MEDIUM',
          petPersonality: config.petPersonality || 'NEUTRAL',
          isIndoorPet: config.isIndoorPet || false,
          hasMicrochip: config.hasMicrochip || false,
          hasCollar: config.hasCollar !== false,
          initialState: config.initialState || 'FLEEING',
          centerLatitude: config.centerLatitude,
          centerLongitude: config.centerLongitude,
          terrainType: config.terrainType || 'SUBURBAN',
          searchRadiusMiles: config.searchRadiusMiles || 2.0,
          searcherCount: config.searcherCount || 5,
          searchStrategy: config.searchStrategy || 'GRID',
          searcherSpeedMph: config.searcherSpeedMph || 3.0,
          maxSimulationHours: config.maxSimulationHours || 72,
          timeStepMinutes: config.timeStepMinutes || 5,
          startHourOfDay: config.startHourOfDay || 8,
        },
      });

      batch = await prisma.simulationBatch.create({
        data: {
          configId: savedConfig.id,
          totalRuns: size,
          status: 'RUNNING',
        },
      });
    }

    // Incremental aggregation to prevent memory exhaustion
    const outcomes = {};
    Object.values(OUTCOMES).forEach(o => outcomes[o] = 0);
    let totalTimeToFind = 0;
    let foundCount = 0;
    let totalPetDistance = 0;
    const timesToFind = [];

    const startTime = Date.now();
    const simulationsToSave = [];
    const simulationsForResponse = [];

    for (let i = 0; i < size; i++) {
      const engine = new SimulationEngine(config);
      const result = engine.run();

      // Aggregate incrementally (don't store full results)
      outcomes[result.outcome]++;
      totalPetDistance += result.petDistanceMiles || 0;

      if (result.foundAtMinute && !result.outcome.startsWith('TIMEOUT')) {
        totalTimeToFind += result.foundAtMinute;
        foundCount++;
        timesToFind.push(result.foundAtMinute);
      }

      // Prepare for database save if enabled
      if (save) {
        simulationsToSave.push({
          configId: savedConfig.id,
          batchId: batch.id,
          status: 'COMPLETED',
          completedAt: new Date(),
          randomSeed: result.seed,
          outcome: result.outcome,
          foundAtMinute: result.foundAtMinute,
          foundBySearcher: result.foundBySearcher,
          foundLatitude: result.foundLatitude,
          foundLongitude: result.foundLongitude,
          petDistanceMiles: result.petDistanceMiles,
          searcherDistanceMiles: result.searcherDistanceMiles,
          finalPetState: result.finalPetState,
          wasTransported: result.wasTransported || false,
          transportedAtMinute: result.transportedAtMinute,
          petPathJson: savePaths ? JSON.stringify(result.petPath) : null,
          searcherPathsJson: savePaths ? JSON.stringify(result.searcherPaths) : null,
          eventsJson: JSON.stringify(result.events),
        });

        // Batch insert every 50 to manage memory
        if (simulationsToSave.length >= 50) {
          await prisma.simulation.createMany({ data: simulationsToSave });
          simulationsToSave.length = 0;
        }
      }

      // Include in response if requested (limited data)
      if (includeSimulations) {
        simulationsForResponse.push({
          id: `sim_${result.seed}_${i}`,
          randomSeed: result.seed,
          outcome: result.outcome,
          foundAtMinute: result.foundAtMinute,
          foundLatitude: result.foundLatitude,
          foundLongitude: result.foundLongitude,
          petDistanceMiles: result.petDistanceMiles,
          finalPetState: result.finalPetState,
          research: result.research,
        });
      }

      // Yield to prevent blocking and allow GC
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Save remaining simulations
    if (save && simulationsToSave.length > 0) {
      await prisma.simulation.createMany({ data: simulationsToSave });
    }

    // Calculate final statistics
    timesToFind.sort((a, b) => a - b);
    const medianTimeToFind = timesToFind.length > 0
      ? timesToFind[Math.floor(timesToFind.length / 2)]
      : null;

    const successCount = size - (outcomes[OUTCOMES.TIMEOUT_SEARCHING] || 0) - (outcomes[OUTCOMES.TIMEOUT_SHELTERED] || 0);

    const aggregated = {
      totalRuns: size,
      successRate: (successCount / size) * 100,
      avgTimeToFindMins: foundCount > 0 ? totalTimeToFind / foundCount : null,
      medianTimeToFindMins: medianTimeToFind,
      avgPetDistanceMiles: totalPetDistance / size,
      foundBySearcherCount: outcomes[OUTCOMES.FOUND_BY_SEARCHER] || 0,
      returnedHomeCount: outcomes[OUTCOMES.RETURNED_HOME] || 0,
      foundViaShelterCount: outcomes[OUTCOMES.FOUND_VIA_SHELTER] || 0,
      foundViaSocialCount: outcomes[OUTCOMES.FOUND_VIA_SOCIAL] || 0,
      foundViaPlatformCount: outcomes[OUTCOMES.FOUND_VIA_PLATFORM] || 0,
      timeoutSearchingCount: outcomes[OUTCOMES.TIMEOUT_SEARCHING] || 0,
      timeoutShelteredCount: outcomes[OUTCOMES.TIMEOUT_SHELTERED] || 0,
    };

    // Update batch record with results
    if (save) {
      await prisma.simulationBatch.update({
        where: { id: batch.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          completedRuns: size,
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
        },
      });
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    // Format response
    const batchResponse = {
      id: save ? batch.id : `batch_${Date.now()}`,
      saved: save,
      status: 'COMPLETED',
      ...aggregated,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      executionTimeSeconds: parseFloat(totalTime),
      simulations: includeSimulations ? simulationsForResponse : undefined,
    };

    return NextResponse.json({
      success: true,
      batch: batchResponse,
      terrainInfo,
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
 * GET - List saved batch results from database
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const [batches, total] = await Promise.all([
      prisma.simulationBatch.findMany({
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          config: true,
          _count: {
            select: { simulations: true },
          },
        },
      }),
      prisma.simulationBatch.count(),
    ]);

    return NextResponse.json({
      batches: batches.map(b => ({
        ...b,
        simulationCount: b._count.simulations,
        _count: undefined,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + batches.length < total,
      },
    });

  } catch (error) {
    console.error('Error fetching batches:', error);
    return NextResponse.json(
      { error: 'Failed to fetch batches', details: error.message },
      { status: 500 }
    );
  }
}
