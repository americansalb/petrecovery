/**
 * Natural Earth Water Detection
 *
 * Uses Natural Earth 10m land polygons for global land/water detection.
 * Logic: If a point is NOT on any land polygon, it's in water (ocean).
 * For bays and inland water, we combine with OSM local water data.
 *
 * Data source: https://www.naturalearthdata.com/
 * GeoJSON source: https://github.com/martynafford/natural-earth-geojson
 */

interface Position {
  lat: number;
  lng: number;
}

interface BBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface LandPolygon {
  coordinates: number[][][]; // [lng, lat][] rings
  bbox: BBox;
}

// Cache for loaded data
let landPolygons: LandPolygon[] | null = null;
let lakePolygons: LandPolygon[] | null = null;
let loadingPromise: Promise<void> | null = null;

/**
 * Calculate bounding box for a polygon ring
 */
function calculateBBox(coords: number[][]): BBox {
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  for (const [lng, lat] of coords) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }

  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Point in polygon using ray casting algorithm
 */
function pointInPolygon(pos: Position, coords: number[][]): boolean {
  const x = pos.lng, y = pos.lat;
  let inside = false;

  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    const xi = coords[i][0], yi = coords[i][1];
    const xj = coords[j][0], yj = coords[j][1];

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Check if point is in a polygon (handles holes)
 */
function isInPolygon(pos: Position, polygon: LandPolygon): boolean {
  // Quick bbox check
  if (pos.lat < polygon.bbox.minLat || pos.lat > polygon.bbox.maxLat ||
      pos.lng < polygon.bbox.minLng || pos.lng > polygon.bbox.maxLng) {
    return false;
  }

  // Check outer ring
  const outerRing = polygon.coordinates[0];
  if (!pointInPolygon(pos, outerRing)) {
    return false;
  }

  // Check holes (if point is in a hole, it's not in the polygon)
  for (let i = 1; i < polygon.coordinates.length; i++) {
    if (pointInPolygon(pos, polygon.coordinates[i])) {
      return false;
    }
  }

  return true;
}

/**
 * Parse GeoJSON and extract polygons with bboxes
 */
function parseGeoJSON(geojson: any): LandPolygon[] {
  const polygons: LandPolygon[] = [];

  for (const feature of geojson.features || []) {
    const geometry = feature.geometry;
    if (!geometry) continue;

    if (geometry.type === 'Polygon') {
      polygons.push({
        coordinates: geometry.coordinates,
        bbox: calculateBBox(geometry.coordinates[0]),
      });
    } else if (geometry.type === 'MultiPolygon') {
      for (const polygon of geometry.coordinates) {
        polygons.push({
          coordinates: polygon,
          bbox: calculateBBox(polygon[0]),
        });
      }
    }
  }

  return polygons;
}

/**
 * Load Natural Earth land and lake data from static files
 * Works in both browser (fetch) and Node.js (fs) environments
 */
export async function loadNaturalEarthData(): Promise<void> {
  if (landPolygons !== null && lakePolygons !== null) {
    return; // Already loaded
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      // Detect environment and load accordingly
      if (typeof window !== 'undefined') {
        // Browser environment - use fetch
        const [landResponse, lakesResponse] = await Promise.all([
          fetch('/data/natural-earth/land_10m.json'),
          fetch('/data/natural-earth/lakes.json'),
        ]);

        if (landResponse.ok) {
          const landData = await landResponse.json();
          landPolygons = parseGeoJSON(landData);
          console.log(`Loaded ${landPolygons.length} land polygons (10m resolution)`);
        } else {
          console.warn('Failed to load land data:', landResponse.status);
          landPolygons = [];
        }

        if (lakesResponse.ok) {
          const lakesData = await lakesResponse.json();
          lakePolygons = parseGeoJSON(lakesData);
          console.log(`Loaded ${lakePolygons.length} lake polygons`);
        } else {
          console.warn('Failed to load lakes data:', lakesResponse.status);
          lakePolygons = [];
        }
      } else {
        // Node.js environment - use fs
        const fs = await import('fs');
        const path = await import('path');

        const dataDir = path.join(process.cwd(), 'public', 'data', 'natural-earth');

        try {
          const landPath = path.join(dataDir, 'land_10m.json');
          const landData = JSON.parse(fs.readFileSync(landPath, 'utf-8'));
          landPolygons = parseGeoJSON(landData);
          console.log(`Loaded ${landPolygons.length} land polygons from ${landPath}`);
        } catch (e) {
          console.warn('Failed to load land data from disk:', e);
          landPolygons = [];
        }

        try {
          const lakesPath = path.join(dataDir, 'lakes.json');
          const lakesData = JSON.parse(fs.readFileSync(lakesPath, 'utf-8'));
          lakePolygons = parseGeoJSON(lakesData);
          console.log(`Loaded ${lakePolygons.length} lake polygons from ${lakesPath}`);
        } catch (e) {
          console.warn('Failed to load lakes data from disk:', e);
          lakePolygons = [];
        }
      }
    } catch (error) {
      console.error('Failed to load Natural Earth data:', error);
      landPolygons = [];
      lakePolygons = [];
    }
  })();

  return loadingPromise;
}

/**
 * Check if a point is on land (using Natural Earth 10m land data)
 */
export function isOnLand(pos: Position): boolean {
  if (!landPolygons) return true; // Default to land if data not loaded

  for (const polygon of landPolygons) {
    if (isInPolygon(pos, polygon)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a point is in a major lake (using Natural Earth data)
 */
export function isInMajorLake(pos: Position): boolean {
  if (!lakePolygons) return false;

  for (const polygon of lakePolygons) {
    if (isInPolygon(pos, polygon)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a point is in the ocean (NOT on land)
 * This is the inverse of isOnLand - if not on any land polygon, it's ocean
 */
export function isInOcean(pos: Position): boolean {
  return !isOnLand(pos);
}

/**
 * Check if a point is in any water body (ocean or major lake)
 * For ocean: uses land polygon inverse (NOT on land = ocean)
 * For lakes: uses lake polygons directly
 *
 * Note: Bays like SF Bay may show as "land" because Natural Earth's
 * land polygons include bays. For accurate bay detection, use OSM data.
 */
export function isInNaturalEarthWater(pos: Position): boolean {
  // If not on land, it's in the ocean
  if (isInOcean(pos)) {
    return true;
  }

  // Check major lakes
  if (isInMajorLake(pos)) {
    return true;
  }

  return false;
}

/**
 * Check if Natural Earth data is loaded
 */
export function isDataLoaded(): boolean {
  return landPolygons !== null && lakePolygons !== null;
}

/**
 * Get statistics about loaded data
 */
export function getStats(): { landPolygons: number; lakePolygons: number } {
  return {
    landPolygons: landPolygons?.length || 0,
    lakePolygons: lakePolygons?.length || 0,
  };
}
