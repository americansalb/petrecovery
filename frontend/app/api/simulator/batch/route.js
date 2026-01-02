/**
 * Batch Simulator API - Run multiple simulations
 *
 * POST /api/simulator/batch - Run a batch of simulations
 * GET /api/simulator/batch - List recent batches
 */

import { NextResponse } from 'next/server';
import { SimulationEngine, runBatch } from '@/app/lib/simulator/engine';

/**
 * POST - Run a batch of simulations
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { config, batchSize = 100 } = body;

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration is required' },
        { status: 400 }
      );
    }

    // Validate batch size
    const size = Math.min(Math.max(1, batchSize), 10000);

    // Run batch
    const results = await runBatch(config, size);

    // Format response
    const batch = {
      id: `batch_${Date.now()}`,
      status: 'COMPLETED',
      totalRuns: results.totalRuns,
      completedRuns: results.totalRuns,
      successRate: results.successRate,
      avgTimeToFindMins: results.avgTimeToFindMins,
      medianTimeToFindMins: results.medianTimeToFindMins,
      avgPetDistanceMiles: results.avgPetDistanceMiles,
      foundBySearcherCount: results.foundBySearcherCount,
      returnedHomeCount: results.returnedHomeCount,
      foundViaShelterCount: results.foundViaShelterCount,
      foundViaSocialCount: results.foundViaSocialCount,
      foundViaPlatformCount: results.foundViaPlatformCount,
      timeoutSearchingCount: results.timeoutSearchingCount,
      timeoutShelteredCount: results.timeoutShelteredCount,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      batch,
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
