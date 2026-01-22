/**
 * Universal Water Detection
 *
 * Multiple strategies for detecting if a coordinate is on water:
 * 1. Vector tiles (most accurate - requires API key)
 * 2. IsItWater.com API (accurate, rate limited)
 * 3. Natural Earth + OSM fallback (less accurate for bays)
 *
 * Configure via environment variables:
 * - MAPTILER_API_KEY: For vector tile water detection
 * - ISITWATER_API_KEY: For IsItWater.com API (optional)
 */

export interface Position {
  lat: number;
  lng: number;
}

export interface WaterCheckResult {
  isWater: boolean;
  source: 'vector-tiles' | 'isitwater-api' | 'natural-earth' | 'osm' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  waterType?: 'ocean' | 'bay' | 'lake' | 'river' | 'unknown';
}

// Cache for water detection results
const waterCache = new Map<string, WaterCheckResult>();

function getCacheKey(pos: Position, precision: number = 5): string {
  // Round to ~1m precision at equator
  const lat = pos.lat.toFixed(precision);
  const lng = pos.lng.toFixed(precision);
  return `${lat},${lng}`;
}

/**
 * Calculate tile coordinates from lat/lng
 */
function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number; z: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor((lng + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n);
  return { x, y, z: zoom };
}

/**
 * Calculate pixel position within a tile (256x256)
 */
function latLngToPixel(lat: number, lng: number, zoom: number): { x: number; y: number; tileX: number; tileY: number } {
  const n = Math.pow(2, zoom);
  const xTile = (lng + 180) / 360 * n;
  const latRad = lat * Math.PI / 180;
  const yTile = (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n;

  const tileX = Math.floor(xTile);
  const tileY = Math.floor(yTile);
  const pixelX = Math.floor((xTile - tileX) * 256);
  const pixelY = Math.floor((yTile - tileY) * 256);

  return { x: pixelX, y: pixelY, tileX, tileY };
}

/**
 * Strategy 1: Vector Tiles (MapTiler)
 * Requires MAPTILER_API_KEY environment variable
 */
async function checkWaterVectorTiles(pos: Position): Promise<WaterCheckResult | null> {
  const apiKey = process.env.MAPTILER_API_KEY;
  if (!apiKey) return null;

  try {
    const zoom = 14; // Good detail level
    const tile = latLngToTile(pos.lat, pos.lng, zoom);

    // Fetch vector tile
    const url = `https://api.maptiler.com/tiles/v3/${tile.z}/${tile.x}/${tile.y}.pbf?key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) return null;

    // Parse PBF and check water layer
    // For now, return null - full PBF parsing would require a library like @mapbox/vector-tile
    // This is a placeholder for when you add the vector tile parsing
    return null;
  } catch (error) {
    console.warn('Vector tile water check failed:', error);
    return null;
  }
}

/**
 * Strategy 2: IsItWater.com API
 * Free tier available, uses OSM data
 */
async function checkWaterIsItWaterAPI(pos: Position): Promise<WaterCheckResult | null> {
  try {
    const url = `https://isitwater.com/api/v1?latitude=${pos.lat}&longitude=${pos.lng}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ReunitePets/1.0' },
    });

    if (!response.ok) return null;

    const data = await response.json();

    return {
      isWater: data.water === true,
      source: 'isitwater-api',
      confidence: 'high',
      waterType: 'unknown',
    };
  } catch (error) {
    console.warn('IsItWater API check failed:', error);
    return null;
  }
}

/**
 * Strategy 3: Onwater.io API (free)
 */
async function checkWaterOnwaterAPI(pos: Position): Promise<WaterCheckResult | null> {
  try {
    const url = `https://api.onwater.io/api/v1/results/${pos.lat},${pos.lng}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ReunitePets/1.0' },
    });

    if (!response.ok) return null;

    const data = await response.json();

    return {
      isWater: data.water === true,
      source: 'isitwater-api', // Same confidence level
      confidence: 'high',
      waterType: 'unknown',
    };
  } catch (error) {
    console.warn('Onwater API check failed:', error);
    return null;
  }
}

/**
 * Main water detection function
 * Tries multiple strategies in order of accuracy
 */
export async function isPointInWater(pos: Position, useCache: boolean = true): Promise<WaterCheckResult> {
  const cacheKey = getCacheKey(pos);

  // Check cache first
  if (useCache && waterCache.has(cacheKey)) {
    return waterCache.get(cacheKey)!;
  }

  // Strategy 1: Vector tiles (if API key available)
  const vectorResult = await checkWaterVectorTiles(pos);
  if (vectorResult) {
    waterCache.set(cacheKey, vectorResult);
    return vectorResult;
  }

  // Strategy 2: IsItWater.com API
  const apiResult = await checkWaterIsItWaterAPI(pos);
  if (apiResult) {
    waterCache.set(cacheKey, apiResult);
    return apiResult;
  }

  // Strategy 3: Onwater.io API (backup)
  const onwaterResult = await checkWaterOnwaterAPI(pos);
  if (onwaterResult) {
    waterCache.set(cacheKey, onwaterResult);
    return onwaterResult;
  }

  // Fallback: Unknown (let other detection methods handle it)
  const fallbackResult: WaterCheckResult = {
    isWater: false,
    source: 'unknown',
    confidence: 'low',
  };

  waterCache.set(cacheKey, fallbackResult);
  return fallbackResult;
}

/**
 * Batch check multiple points (more efficient for simulation)
 */
export async function checkWaterBatch(positions: Position[]): Promise<Map<string, WaterCheckResult>> {
  const results = new Map<string, WaterCheckResult>();

  // Check cache first, collect uncached positions
  const uncached: Position[] = [];
  for (const pos of positions) {
    const key = getCacheKey(pos);
    if (waterCache.has(key)) {
      results.set(key, waterCache.get(key)!);
    } else {
      uncached.push(pos);
    }
  }

  // Fetch uncached positions (with rate limiting)
  for (const pos of uncached) {
    const result = await isPointInWater(pos, false);
    results.set(getCacheKey(pos), result);

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  return results;
}

/**
 * Pre-warm cache for an area (useful before simulation)
 */
export async function prewarmCache(center: Position, radiusM: number, gridSizeM: number = 100): Promise<void> {
  const positions: Position[] = [];
  const latOffset = radiusM / 111000;
  const lngOffset = radiusM / (111000 * Math.cos(center.lat * Math.PI / 180));
  const latStep = gridSizeM / 111000;
  const lngStep = gridSizeM / (111000 * Math.cos(center.lat * Math.PI / 180));

  for (let lat = center.lat - latOffset; lat <= center.lat + latOffset; lat += latStep) {
    for (let lng = center.lng - lngOffset; lng <= center.lng + lngOffset; lng += lngStep) {
      positions.push({ lat, lng });
    }
  }

  console.log(`Pre-warming water cache for ${positions.length} points...`);
  await checkWaterBatch(positions);
  console.log(`Water cache warmed with ${waterCache.size} entries`);
}

/**
 * Clear the water cache
 */
export function clearWaterCache(): void {
  waterCache.clear();
}

/**
 * Get cache statistics
 */
export function getWaterCacheStats(): { size: number; sources: Record<string, number> } {
  const sources: Record<string, number> = {};
  const values = Array.from(waterCache.values());
  for (const result of values) {
    sources[result.source] = (sources[result.source] || 0) + 1;
  }
  return { size: waterCache.size, sources };
}
