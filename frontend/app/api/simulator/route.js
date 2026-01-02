/**
 * Simulator API - Run single simulations
 *
 * POST /api/simulator - Run a single simulation
 * GET /api/simulator - List recent simulations
 */

import { NextResponse } from 'next/server';
import { SimulationEngine } from '@/app/lib/simulator/engine';

// For now, we'll run simulations in-memory without database
// Once the schema is migrated, we can persist results

/**
 * POST - Run a single simulation
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { config, mode = 'single' } = body;

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration is required' },
        { status: 400 }
      );
    }

    // Validate required config fields
    if (!config.centerLatitude || !config.centerLongitude) {
      return NextResponse.json(
        { error: 'Center location is required' },
        { status: 400 }
      );
    }

    // Run simulation
    const engine = new SimulationEngine(config);
    const result = engine.run();

    // Format response
    const simulation = {
      id: `sim_${result.seed}_${Date.now()}`,
      randomSeed: result.seed,
      status: 'COMPLETED',
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
      petPathJson: JSON.stringify(result.petPath),
      searcherPathsJson: JSON.stringify(result.searcherPaths),
      eventsJson: JSON.stringify(result.events),
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      simulation,
    });

  } catch (error) {
    console.error('Simulation error:', error);
    return NextResponse.json(
      { error: 'Simulation failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET - List simulations (placeholder for when DB is connected)
 */
export async function GET(request) {
  // For now, return empty list - simulations are client-side only
  return NextResponse.json({
    simulations: [],
    message: 'Simulations are currently stored client-side. Run a simulation to see results.',
  });
}
