/**
 * Behavioral Profiles Simulation API
 * POST /api/simulate - Run simulation based on BEHAVIORAL_PROFILES.md
 */

import { NextResponse } from 'next/server';

// Extend timeout for batch simulations (Vercel Pro: 60s max, Hobby: 10s)
export const maxDuration = 60;
import {
  BehavioralSimulationEngine,
  runBatch,
  AnimalProfile,
  SimulationConfig,
  DOG_TEMPERAMENTS,
  CAT_TEMPERAMENTS,
} from '@/app/lib/behavioral-simulation';
import { fetchTerrainData } from '@/app/lib/behavioral-simulation/terrain';

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
  searchStartDelay?: number;
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

    // Build config - default 30 days (720 hours)
    const config: SimulationConfig = {
      seed: body.seed || Math.floor(Math.random() * 1000000),
      maxHours: body.maxHours || 720,
      timeStepMinutes: 5,
      startHour: 10,
      searchRadiusM: 2000,
      numSearchers: body.numSearchers || 3,
      searchStartDelay: body.searchStartDelay || 2,
      useTraps: false,
      useScentArticles: false,
    };

    const startPosition = { lat: body.latitude, lng: body.longitude };

    // Fetch terrain data from OSM for water detection (5km radius around home)
    let terrainData: SimulationConfig['terrainData'];
    try {
      const osmTerrain = await fetchTerrainData(startPosition, 5000);
      if (osmTerrain.waterAreas.length > 0) {
        terrainData = {
          waterPolygons: osmTerrain.waterAreas.map(w => ({
            points: w.points,
            bbox: w.bbox,
          })),
          isCoastal: osmTerrain.isCoastal,
        };
        console.log(`Loaded ${terrainData.waterPolygons.length} water areas for simulation`);
      }
    } catch (err) {
      console.warn('Could not fetch terrain data:', err);
    }

    // Add terrain data to config
    config.terrainData = terrainData;

    // Limit batch size to prevent timeout (max 60 seconds on Vercel Pro)
    // Each simulation takes ~50-100ms, so cap at 500 for safety
    const safeBatchSize = Math.min(body.batchSize || 1, 500);

    // Run single or batch
    if (safeBatchSize > 1) {
      const batchResult = runBatch(profile, startPosition, config, safeBatchSize);

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
        // Include first 10 detailed simulations with paths for viewing
        sampleSimulations: batchResult.simulations.slice(0, 10).map(sim => ({
          id: sim.id,
          outcome: sim.outcome,
          outcomeDescription: sim.outcomeDescription,
          timeToOutcomeHours: sim.timeToOutcomeHours,
          maxDistanceM: Math.round(sim.maxDistanceFromHomeM),
          pathLength: sim.petPath.length,
          petPath: sim.petPath,
          searcherPaths: sim.searcherPaths,
        })),
      });
    } else {
      // Single simulation
      const engine = new BehavioralSimulationEngine(profile, startPosition, config);
      const result = engine.run();

      // Check if position was adjusted due to water
      const positionAdjusted =
        Math.abs(result.startPosition.lat - startPosition.lat) > 0.0001 ||
        Math.abs(result.startPosition.lng - startPosition.lng) > 0.0001;

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
          startPosition: result.startPosition, // Actual start position
          finalPosition: result.finalPosition,
          petDistanceM: Math.round(result.petDistanceM),
          maxDistanceFromHomeM: Math.round(result.maxDistanceFromHomeM),
          stats: result.stats,
          positionAdjusted, // True if start was moved from water to land
        },
        path: result.petPath,
        searcherPaths: result.searcherPaths,
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
