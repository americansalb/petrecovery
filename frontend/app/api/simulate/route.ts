/**
 * Behavioral Profiles Simulation API
 * POST /api/simulate - Run simulation based on BEHAVIORAL_PROFILES.md
 */

import { NextResponse } from 'next/server';
import {
  BehavioralSimulationEngine,
  runBatch,
  AnimalProfile,
  SimulationConfig,
  DOG_TEMPERAMENTS,
  CAT_TEMPERAMENTS,
} from '@/app/lib/behavioral-simulation';

interface SimulateRequest {
  species: 'dog' | 'cat';
  temperament?: string;
  size?: string;
  age?: string;
  isIndoorOnly?: boolean;
  hasMicrochip?: boolean;
  hasCollar?: boolean;
  latitude: number;
  longitude: number;
  maxHours?: number;
  numSearchers?: number;
  batchSize?: number;
  seed?: number;
}

export async function POST(request: Request) {
  try {
    const body: SimulateRequest = await request.json();

    // Validate required fields
    if (!body.latitude || !body.longitude) {
      return NextResponse.json(
        { error: 'Location (latitude, longitude) is required' },
        { status: 400 }
      );
    }

    // Build profile
    const species = body.species || 'dog';
    const defaultTemp = species === 'dog' ? 'C' : 'CAU';

    const profile: AnimalProfile = {
      species,
      temperament: (body.temperament || defaultTemp) as AnimalProfile['temperament'],
      size: (body.size || 'MED') as AnimalProfile['size'],
      age: (body.age || 'ADT') as AnimalProfile['age'],
      isIndoorOnly: body.isIndoorOnly ?? (species === 'cat'),
      hasMicrochip: body.hasMicrochip ?? false,
      hasCollar: body.hasCollar ?? true,
    };

    // Build config
    const config: SimulationConfig = {
      seed: body.seed || Math.floor(Math.random() * 1000000),
      maxHours: body.maxHours || 72,
      timeStepMinutes: 5,
      startHour: 10,
      searchRadiusM: 2000,
      numSearchers: body.numSearchers || 3,
      useTraps: false,
      useScentArticles: false,
    };

    const startPosition = { lat: body.latitude, lng: body.longitude };

    // Run single or batch
    if (body.batchSize && body.batchSize > 1) {
      const batchResult = runBatch(profile, startPosition, config, body.batchSize);

      return NextResponse.json({
        success: true,
        type: 'batch',
        profile: {
          species,
          temperament: profile.temperament,
          temperamentName: species === 'dog'
            ? DOG_TEMPERAMENTS[profile.temperament as keyof typeof DOG_TEMPERAMENTS]?.name
            : CAT_TEMPERAMENTS[profile.temperament as keyof typeof CAT_TEMPERAMENTS]?.name,
        },
        result: {
          totalRuns: batchResult.totalRuns,
          successRate: batchResult.successRate.toFixed(1),
          avgTimeToFindHours: batchResult.avgTimeToFindHours?.toFixed(1),
          medianTimeToFindHours: batchResult.medianTimeToFindHours?.toFixed(1),
          avgDistanceM: Math.round(batchResult.avgDistanceM),
          outcomes: batchResult.outcomes,
        },
        // Include first 5 detailed simulations
        sampleSimulations: batchResult.simulations.slice(0, 5).map(sim => ({
          id: sim.id,
          outcome: sim.outcome,
          outcomeDescription: sim.outcomeDescription,
          timeToOutcomeHours: sim.timeToOutcomeHours,
          maxDistanceM: Math.round(sim.maxDistanceFromHomeM),
          pathLength: sim.petPath.length,
        })),
      });
    } else {
      // Single simulation
      const engine = new BehavioralSimulationEngine(profile, startPosition, config);
      const result = engine.run();

      return NextResponse.json({
        success: true,
        type: 'single',
        profile: {
          species,
          temperament: profile.temperament,
          temperamentName: species === 'dog'
            ? DOG_TEMPERAMENTS[profile.temperament as keyof typeof DOG_TEMPERAMENTS]?.name
            : CAT_TEMPERAMENTS[profile.temperament as keyof typeof CAT_TEMPERAMENTS]?.name,
        },
        result: {
          id: result.id,
          seed: result.seed,
          outcome: result.outcome,
          outcomeDescription: result.outcomeDescription,
          timeToOutcomeHours: result.timeToOutcomeHours,
          finalPosition: result.finalPosition,
          petDistanceM: Math.round(result.petDistanceM),
          maxDistanceFromHomeM: Math.round(result.maxDistanceFromHomeM),
          stats: result.stats,
        },
        path: result.petPath,
      });
    }
  } catch (error) {
    console.error('Simulation error:', error);
    return NextResponse.json(
      { error: 'Simulation failed', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/simulate',
    method: 'POST',
    description: 'Run Monte Carlo simulation based on BEHAVIORAL_PROFILES.md research',
    parameters: {
      species: 'dog | cat (required)',
      temperament: 'Dog: G/C/A/X/B, Cat: CUR/CL/CAU/X/B',
      latitude: 'number (required)',
      longitude: 'number (required)',
      maxHours: 'number (default: 72)',
      numSearchers: 'number (default: 3)',
      batchSize: 'number (optional, for Monte Carlo batch)',
    },
    temperaments: {
      dog: Object.entries(DOG_TEMPERAMENTS).map(([code, params]) => ({
        code,
        name: params.name,
        description: params.description,
      })),
      cat: Object.entries(CAT_TEMPERAMENTS).map(([code, params]) => ({
        code,
        name: params.name,
        description: params.description,
      })),
    },
  });
}
