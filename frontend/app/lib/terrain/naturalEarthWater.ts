/**
 * Natural Earth Water Detection
 *
 * Uses Natural Earth dataset (public domain) for authoritative global water detection.
 * This replaces hand-coded heuristics with real geographic data.
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

interface WaterPolygon {
  coordinates: number[][][]; // [lng, lat][] rings
  bbox: BBox;
}

// Cache for loaded data
let oceanPolygons: WaterPolygon[] | null = null;
let lakePolygons: WaterPolygon[] | null = null;
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
 * Check if point is in a water polygon (handles holes)
 */
function isInWaterPolygon(pos: Position, polygon: WaterPolygon): boolean {
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

  // Check holes (if point is in a hole, it's not in water)
  for (let i = 1; i < polygon.coordinates.length; i++) {
    if (pointInPolygon(pos, polygon.coordinates[i])) {
      return false; // In a hole (island within water)
    }
  }

  return true;
}

/**
 * Parse GeoJSON and extract polygons with bboxes
 */
function parseGeoJSON(geojson: any): WaterPolygon[] {
  const polygons: WaterPolygon[] = [];

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
 * Load Natural Earth water data from static files
 * Works in both browser (fetch) and Node.js (fs) environments
 */
export async function loadNaturalEarthData(): Promise<void> {
  if (oceanPolygons !== null && lakePolygons !== null) {
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
        const [oceanResponse, lakesResponse] = await Promise.all([
          fetch('/data/natural-earth/ocean.json'),
          fetch('/data/natural-earth/lakes.json'),
        ]);

        if (oceanResponse.ok) {
          const oceanData = await oceanResponse.json();
          oceanPolygons = parseGeoJSON(oceanData);
          console.log(`Loaded ${oceanPolygons.length} ocean polygons`);
        } else {
          console.warn('Failed to load ocean data:', oceanResponse.status);
          oceanPolygons = [];
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
          const oceanPath = path.join(dataDir, 'ocean.json');
          const oceanData = JSON.parse(fs.readFileSync(oceanPath, 'utf-8'));
          oceanPolygons = parseGeoJSON(oceanData);
          console.log(`Loaded ${oceanPolygons.length} ocean polygons from ${oceanPath}`);
        } catch (e) {
          console.warn('Failed to load ocean data from disk:', e);
          oceanPolygons = [];
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
      oceanPolygons = [];
      lakePolygons = [];
    }
  })();

  return loadingPromise;
}

/**
 * Check if a point is in the ocean (using Natural Earth data)
 */
export function isInOcean(pos: Position): boolean {
  if (!oceanPolygons) return false;

  for (const polygon of oceanPolygons) {
    if (isInWaterPolygon(pos, polygon)) {
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
    if (isInWaterPolygon(pos, polygon)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a point is in any water body (ocean or major lake)
 * This is the main function to use for water detection
 */
export function isInNaturalEarthWater(pos: Position): boolean {
  return isInOcean(pos) || isInMajorLake(pos);
}

/**
 * Check if Natural Earth data is loaded
 */
export function isDataLoaded(): boolean {
  return oceanPolygons !== null && lakePolygons !== null;
}

/**
 * Get statistics about loaded data
 */
export function getStats(): { oceanPolygons: number; lakePolygons: number } {
  return {
    oceanPolygons: oceanPolygons?.length || 0,
    lakePolygons: lakePolygons?.length || 0,
  };
}
