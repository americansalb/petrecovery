/**
 * Terrain Cache with Retry Logic
 *
 * Caches terrain data by geohash to avoid repeated API calls.
 * Implements exponential backoff retry for API failures.
 */

import { fetchTerrainData, TerrainData } from '../behavioral-simulation/terrain';

interface Position {
  lat: number;
  lng: number;
}

interface CacheEntry {
  data: TerrainData;
  timestamp: number;
  radiusM: number;
}

// In-memory cache (persists for server lifetime)
const terrainCache = new Map<string, CacheEntry>();

// Cache TTL: 1 hour
const CACHE_TTL_MS = 60 * 60 * 1000;

// Max retries for API calls
const MAX_RETRIES = 3;

/**
 * Generate a geohash-style key for caching
 * Rounds coordinates to ~1km precision for cache key
 */
function getCacheKey(center: Position, radiusM: number): string {
  // Round to 2 decimal places (~1km precision)
  const lat = Math.round(center.lat * 100) / 100;
  const lng = Math.round(center.lng * 100) / 100;
  const radius = Math.round(radiusM / 1000); // km
  return `${lat},${lng},${radius}`;
}

/**
 * Sleep for exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch terrain data with caching and retry logic
 */
export async function fetchTerrainDataCached(
  center: Position,
  radiusM: number = 5000,
  timeoutMs: number = 5000
): Promise<TerrainData> {
  const cacheKey = getCacheKey(center, radiusM);

  // Check cache first
  const cached = terrainCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    // Check if cached radius covers our needs
    if (cached.radiusM >= radiusM) {
      return cached.data;
    }
  }

  // Fetch with retry logic
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const data = await fetchTerrainData(center, radiusM, timeoutMs);

      // Cache the result
      terrainCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        radiusM,
      });

      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < MAX_RETRIES - 1) {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }

  // All retries failed - return empty terrain data
  console.warn(`Terrain fetch failed after ${MAX_RETRIES} attempts:`, lastError);
  return {
    bbox: {
      south: center.lat - radiusM / 111000,
      north: center.lat + radiusM / 111000,
      west: center.lng - radiusM / (111000 * Math.cos(center.lat * Math.PI / 180)),
      east: center.lng + radiusM / (111000 * Math.cos(center.lat * Math.PI / 180)),
    },
    waterAreas: [],
    coastlineSegments: [],
    isCoastal: false,
    roads: [],
    hasHighways: false,
    hasRailways: false,
  };
}

/**
 * Preload terrain data for a set of locations
 * Useful for batch simulations
 */
export async function preloadTerrain(
  locations: Position[],
  radiusM: number = 5000
): Promise<void> {
  // Deduplicate by cache key
  const uniqueKeys = new Set<string>();
  const toFetch: Position[] = [];

  for (const loc of locations) {
    const key = getCacheKey(loc, radiusM);
    if (!uniqueKeys.has(key) && !terrainCache.has(key)) {
      uniqueKeys.add(key);
      toFetch.push(loc);
    }
  }

  // Fetch in parallel with rate limiting (max 3 concurrent)
  const batchSize = 3;
  for (let i = 0; i < toFetch.length; i += batchSize) {
    const batch = toFetch.slice(i, i + batchSize);
    await Promise.all(
      batch.map(loc => fetchTerrainDataCached(loc, radiusM).catch(() => null))
    );
  }
}

/**
 * Clear the terrain cache
 */
export function clearTerrainCache(): void {
  terrainCache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: terrainCache.size,
    entries: Array.from(terrainCache.keys()),
  };
}
