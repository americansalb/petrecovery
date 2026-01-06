/**
 * City Terrain Cache - Pre-downloaded terrain data for major cities
 *
 * This provides instant terrain data without API calls for common locations.
 * Data is stored as static JSON files and loaded on-demand.
 *
 * Coverage: 20km radius around each city center
 * Fallback: OSM API for uncached areas, then global heuristics
 */

import { TerrainData } from '../behavioral-simulation/terrain';

export interface CityInfo {
  name: string;
  state: string;
  lat: number;
  lng: number;
  radiusKm: number;
  population: number;
}

// Top 30 US metro areas by population - these get pre-cached terrain
export const CACHED_CITIES: CityInfo[] = [
  { name: 'New York', state: 'NY', lat: 40.7128, lng: -74.0060, radiusKm: 20, population: 8336817 },
  { name: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437, radiusKm: 20, population: 3979576 },
  { name: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298, radiusKm: 20, population: 2693976 },
  { name: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698, radiusKm: 20, population: 2320268 },
  { name: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740, radiusKm: 20, population: 1680992 },
  { name: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652, radiusKm: 20, population: 1584064 },
  { name: 'San Antonio', state: 'TX', lat: 29.4241, lng: -98.4936, radiusKm: 20, population: 1547253 },
  { name: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611, radiusKm: 20, population: 1423851 },
  { name: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970, radiusKm: 20, population: 1343573 },
  { name: 'San Jose', state: 'CA', lat: 37.3382, lng: -121.8863, radiusKm: 20, population: 1021795 },
  { name: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431, radiusKm: 20, population: 978908 },
  { name: 'Jacksonville', state: 'FL', lat: 30.3322, lng: -81.6557, radiusKm: 20, population: 911507 },
  { name: 'Fort Worth', state: 'TX', lat: 32.7555, lng: -97.3308, radiusKm: 20, population: 909585 },
  { name: 'Columbus', state: 'OH', lat: 39.9612, lng: -82.9988, radiusKm: 20, population: 898553 },
  { name: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194, radiusKm: 20, population: 873965 },
  { name: 'Charlotte', state: 'NC', lat: 35.2271, lng: -80.8431, radiusKm: 20, population: 872498 },
  { name: 'Indianapolis', state: 'IN', lat: 39.7684, lng: -86.1581, radiusKm: 20, population: 867125 },
  { name: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321, radiusKm: 20, population: 753675 },
  { name: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903, radiusKm: 20, population: 727211 },
  { name: 'Washington', state: 'DC', lat: 38.9072, lng: -77.0369, radiusKm: 20, population: 702455 },
  { name: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589, radiusKm: 20, population: 692600 },
  { name: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816, radiusKm: 20, population: 689447 },
  { name: 'Detroit', state: 'MI', lat: 42.3314, lng: -83.0458, radiusKm: 20, population: 670031 },
  { name: 'Portland', state: 'OR', lat: 45.5152, lng: -122.6784, radiusKm: 20, population: 654741 },
  { name: 'Memphis', state: 'TN', lat: 35.1495, lng: -90.0490, radiusKm: 20, population: 651073 },
  { name: 'Oklahoma City', state: 'OK', lat: 35.4676, lng: -97.5164, radiusKm: 20, population: 649021 },
  { name: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398, radiusKm: 20, population: 641903 },
  { name: 'Louisville', state: 'KY', lat: 38.2527, lng: -85.7585, radiusKm: 20, population: 617638 },
  { name: 'Baltimore', state: 'MD', lat: 39.2904, lng: -76.6122, radiusKm: 20, population: 585708 },
  { name: 'Milwaukee', state: 'WI', lat: 43.0389, lng: -87.9065, radiusKm: 20, population: 577222 },
];

// Calculate distance between two points in km
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find the nearest cached city to a given position
 * Returns the city if within its coverage radius, otherwise null
 */
export function findNearestCachedCity(lat: number, lng: number): CityInfo | null {
  let nearest: CityInfo | null = null;
  let nearestDistance = Infinity;

  for (const city of CACHED_CITIES) {
    const distance = haversineDistance(lat, lng, city.lat, city.lng);
    if (distance < nearestDistance && distance <= city.radiusKm) {
      nearest = city;
      nearestDistance = distance;
    }
  }

  return nearest;
}

/**
 * Get the cache key for a city (used for file naming)
 */
export function getCityCacheKey(city: CityInfo): string {
  return `${city.name.toLowerCase().replace(/\s+/g, '-')}-${city.state.toLowerCase()}`;
}

// In-memory cache for loaded terrain data
const loadedTerrainCache = new Map<string, TerrainData>();

/**
 * Load cached terrain data for a city
 * Returns null if not cached or load fails
 */
export async function loadCachedTerrain(city: CityInfo): Promise<TerrainData | null> {
  const cacheKey = getCityCacheKey(city);

  // Check in-memory cache first
  if (loadedTerrainCache.has(cacheKey)) {
    return loadedTerrainCache.get(cacheKey)!;
  }

  try {
    // Try to load from static file
    const response = await fetch(`/data/terrain/${cacheKey}.json`);
    if (!response.ok) {
      console.warn(`No cached terrain for ${city.name}, ${city.state}`);
      return null;
    }

    const data: TerrainData = await response.json();

    // Store in memory for subsequent requests
    loadedTerrainCache.set(cacheKey, data);
    console.log(`Loaded cached terrain for ${city.name}: ${data.waterAreas?.length || 0} water areas, ${data.roads?.length || 0} roads`);

    return data;
  } catch (err) {
    console.warn(`Failed to load cached terrain for ${city.name}:`, err);
    return null;
  }
}

/**
 * Get terrain data for a position - tries cache first, then API, then heuristics
 */
export async function getTerrainForPosition(
  lat: number,
  lng: number,
  fetchFromApi: (lat: number, lng: number, radiusM: number) => Promise<TerrainData>
): Promise<{ terrain: TerrainData | null; source: 'cache' | 'api' | 'heuristics' }> {
  // 1. Check if position is within a cached city
  const cachedCity = findNearestCachedCity(lat, lng);

  if (cachedCity) {
    const cachedTerrain = await loadCachedTerrain(cachedCity);
    if (cachedTerrain) {
      return { terrain: cachedTerrain, source: 'cache' };
    }
  }

  // 2. Try fetching from API
  try {
    const apiTerrain = await fetchFromApi(lat, lng, 20000); // 20km radius
    if (apiTerrain && (apiTerrain.waterAreas?.length > 0 || apiTerrain.roads?.length > 0)) {
      return { terrain: apiTerrain, source: 'api' };
    }
  } catch (err) {
    console.warn('API terrain fetch failed:', err);
  }

  // 3. Fall back to heuristics (no detailed terrain, just global water detection)
  return { terrain: null, source: 'heuristics' };
}

/**
 * Check if a position is covered by cached terrain
 */
export function isPositionCached(lat: number, lng: number): boolean {
  return findNearestCachedCity(lat, lng) !== null;
}

/**
 * Get coverage statistics
 */
export function getCacheStats(): {
  totalCities: number;
  totalPopulation: number;
  loadedCities: number;
} {
  return {
    totalCities: CACHED_CITIES.length,
    totalPopulation: CACHED_CITIES.reduce((sum, c) => sum + c.population, 0),
    loadedCities: loadedTerrainCache.size,
  };
}
