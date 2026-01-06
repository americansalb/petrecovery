/**
 * Behavioral Profiles Simulation API
 * POST /api/simulate - Run simulation based on BEHAVIORAL_PROFILES.md
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

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
import { fetchTerrainData, TerrainData } from '@/app/lib/behavioral-simulation/terrain';
import { findNearestCachedCity, getCityCacheKey, CityInfo } from '@/app/lib/terrain/cityTerrainCache';
import { loadNaturalEarthData } from '@/app/lib/terrain/naturalEarthWater';

// In-memory cache for loaded terrain files (persists across requests)
const terrainFileCache = new Map<string, TerrainData>();

/**
 * Load cached terrain data from static JSON file
 */
async function loadCachedTerrainFile(city: CityInfo): Promise<TerrainData | null> {
  const cacheKey = getCityCacheKey(city);

  // Check in-memory cache first
  if (terrainFileCache.has(cacheKey)) {
    return terrainFileCache.get(cacheKey)!;
  }

  try {
    // Try to load from public/data/terrain directory
    const filePath = path.join(process.cwd(), 'public', 'data', 'terrain', `${cacheKey}.json`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent) as TerrainData;

    // Store in memory cache
    terrainFileCache.set(cacheKey, data);
    console.log(`Loaded cached terrain for ${city.name}: ${data.waterAreas?.length || 0} water areas, ${data.roads?.length || 0} roads`);

    return data;
  } catch {
    // File doesn't exist or can't be read
    return null;
  }
}

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
    // Load Natural Earth water data (cached after first load)
    await loadNaturalEarthData();

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

    // Fetch terrain data with priority: cached file > OSM API > heuristics fallback
    let terrainData: SimulationConfig['terrainData'];
    let terrainSource: 'cache' | 'api' | 'heuristics' = 'heuristics';

    // 1. Check for pre-cached terrain file (instant, 20km radius)
    const cachedCity = findNearestCachedCity(body.latitude, body.longitude);
    if (cachedCity) {
      const cachedTerrain = await loadCachedTerrainFile(cachedCity);
      if (cachedTerrain) {
        terrainData = {
          waterPolygons: cachedTerrain.waterAreas?.map(w => ({
            points: w.points,
            bbox: w.bbox,
          })) || [],
          isCoastal: cachedTerrain.isCoastal || false,
          roads: cachedTerrain.roads || [],
          hasHighways: cachedTerrain.hasHighways || false,
          hasRailways: cachedTerrain.hasRailways || false,
        };
        terrainSource = 'cache';
        console.log(`Using CACHED terrain for ${cachedCity.name}: ${terrainData.waterPolygons.length} water areas, ${terrainData.roads?.length || 0} roads`);
      }
    }

    // 2. If no cache, try OSM API (slower, 20km radius)
    if (!terrainData) {
      try {
        const osmTerrain = await fetchTerrainData(startPosition, 20000); // Increased to 20km
        terrainData = {
          waterPolygons: osmTerrain.waterAreas.map(w => ({
            points: w.points,
            bbox: w.bbox,
          })),
          isCoastal: osmTerrain.isCoastal,
          roads: osmTerrain.roads,
          hasHighways: osmTerrain.hasHighways,
          hasRailways: osmTerrain.hasRailways,
        };
        terrainSource = 'api';
        console.log(`Loaded terrain from API: ${terrainData.waterPolygons.length} water areas, ${terrainData.roads?.length || 0} roads/railways`);
      } catch (err) {
        console.warn('Could not fetch terrain data from API:', err);
        // 3. Fall back to global heuristics (no detailed terrain, but ocean/coastline detection still works)
        terrainSource = 'heuristics';
        console.log('Using global water heuristics (no detailed terrain)');
      }
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
        // Include terrain data for visualization
        terrain: terrainData ? {
          waterPolygons: terrainData.waterPolygons,
          roads: terrainData.roads,
          hasHighways: terrainData.hasHighways,
          hasRailways: terrainData.hasRailways,
          source: terrainSource,
          cachedCity: cachedCity ? `${cachedCity.name}, ${cachedCity.state}` : undefined,
        } : { source: terrainSource },
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
