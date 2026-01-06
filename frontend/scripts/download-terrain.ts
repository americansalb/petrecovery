#!/usr/bin/env npx ts-node
/**
 * Download Terrain Data Script
 *
 * Downloads terrain data from OSM Overpass API for major US cities
 * and saves as JSON files for use in simulations.
 *
 * Usage:
 *   npx ts-node scripts/download-terrain.ts
 *   npx ts-node scripts/download-terrain.ts --city "San Francisco"
 *   npx ts-node scripts/download-terrain.ts --all
 */

import * as fs from 'fs';
import * as path from 'path';

// City definitions (same as cityTerrainCache.ts)
interface CityInfo {
  name: string;
  state: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

const CACHED_CITIES: CityInfo[] = [
  { name: 'New York', state: 'NY', lat: 40.7128, lng: -74.0060, radiusKm: 20 },
  { name: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437, radiusKm: 20 },
  { name: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298, radiusKm: 20 },
  { name: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698, radiusKm: 20 },
  { name: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740, radiusKm: 20 },
  { name: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652, radiusKm: 20 },
  { name: 'San Antonio', state: 'TX', lat: 29.4241, lng: -98.4936, radiusKm: 20 },
  { name: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611, radiusKm: 20 },
  { name: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970, radiusKm: 20 },
  { name: 'San Jose', state: 'CA', lat: 37.3382, lng: -121.8863, radiusKm: 20 },
  { name: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431, radiusKm: 20 },
  { name: 'Jacksonville', state: 'FL', lat: 30.3322, lng: -81.6557, radiusKm: 20 },
  { name: 'Fort Worth', state: 'TX', lat: 32.7555, lng: -97.3308, radiusKm: 20 },
  { name: 'Columbus', state: 'OH', lat: 39.9612, lng: -82.9988, radiusKm: 20 },
  { name: 'San Francisco', state: 'CA', lat: 37.7749, lng: -122.4194, radiusKm: 20 },
  { name: 'Charlotte', state: 'NC', lat: 35.2271, lng: -80.8431, radiusKm: 20 },
  { name: 'Indianapolis', state: 'IN', lat: 39.7684, lng: -86.1581, radiusKm: 20 },
  { name: 'Seattle', state: 'WA', lat: 47.6062, lng: -122.3321, radiusKm: 20 },
  { name: 'Denver', state: 'CO', lat: 39.7392, lng: -104.9903, radiusKm: 20 },
  { name: 'Washington', state: 'DC', lat: 38.9072, lng: -77.0369, radiusKm: 20 },
  { name: 'Boston', state: 'MA', lat: 42.3601, lng: -71.0589, radiusKm: 20 },
  { name: 'Nashville', state: 'TN', lat: 36.1627, lng: -86.7816, radiusKm: 20 },
  { name: 'Detroit', state: 'MI', lat: 42.3314, lng: -83.0458, radiusKm: 20 },
  { name: 'Portland', state: 'OR', lat: 45.5152, lng: -122.6784, radiusKm: 20 },
  { name: 'Memphis', state: 'TN', lat: 35.1495, lng: -90.0490, radiusKm: 20 },
  { name: 'Oklahoma City', state: 'OK', lat: 35.4676, lng: -97.5164, radiusKm: 20 },
  { name: 'Las Vegas', state: 'NV', lat: 36.1699, lng: -115.1398, radiusKm: 20 },
  { name: 'Louisville', state: 'KY', lat: 38.2527, lng: -85.7585, radiusKm: 20 },
  { name: 'Baltimore', state: 'MD', lat: 39.2904, lng: -76.6122, radiusKm: 20 },
  { name: 'Milwaukee', state: 'WI', lat: 43.0389, lng: -87.9065, radiusKm: 20 },
];

interface Position {
  lat: number;
  lng: number;
}

interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface WaterPolygon {
  type: 'water' | 'coastline';
  points: Position[];
  bbox: BoundingBox;
}

interface RoadSegment {
  type: 'motorway' | 'trunk' | 'primary' | 'secondary' | 'railway';
  points: Position[];
  name?: string;
  crossingDifficulty: number;
  dangerLevel: number;
}

interface TerrainData {
  bbox: BoundingBox;
  waterAreas: WaterPolygon[];
  coastlineSegments: Position[][];
  isCoastal: boolean;
  roads: RoadSegment[];
  hasHighways: boolean;
  hasRailways: boolean;
  metadata: {
    city: string;
    state: string;
    downloadedAt: string;
    radiusKm: number;
    center: Position;
  };
}

// Overpass API query
function buildOverpassQuery(lat: number, lng: number, radiusM: number): string {
  return `
[out:json][timeout:90];
(
  // Water bodies
  way["natural"="water"](around:${radiusM},${lat},${lng});
  relation["natural"="water"](around:${radiusM},${lat},${lng});
  way["waterway"~"river|stream|canal"](around:${radiusM},${lat},${lng});
  way["natural"="coastline"](around:${radiusM},${lat},${lng});

  // Major roads
  way["highway"="motorway"](around:${radiusM},${lat},${lng});
  way["highway"="trunk"](around:${radiusM},${lat},${lng});
  way["highway"="primary"](around:${radiusM},${lat},${lng});

  // Railways
  way["railway"~"rail|light_rail"](around:${radiusM},${lat},${lng});
);
out body;
>;
out skel qt;
`;
}

// Parse Overpass response
function parseOverpassResponse(data: any): {
  waterAreas: WaterPolygon[];
  coastlineSegments: Position[][];
  roads: RoadSegment[];
} {
  const nodes = new Map<number, Position>();
  const waterAreas: WaterPolygon[] = [];
  const coastlineSegments: Position[][] = [];
  const roads: RoadSegment[] = [];

  // Build node lookup
  for (const element of data.elements) {
    if (element.type === 'node') {
      nodes.set(element.id, { lat: element.lat, lng: element.lon });
    }
  }

  // Process ways
  for (const element of data.elements) {
    if (element.type !== 'way' || !element.nodes) continue;

    const points: Position[] = [];
    for (const nodeId of element.nodes) {
      const node = nodes.get(nodeId);
      if (node) points.push(node);
    }

    if (points.length < 2) continue;

    const tags = element.tags || {};

    // Water bodies
    if (tags.natural === 'water' || tags.waterway) {
      const bbox = calculateBbox(points);
      waterAreas.push({
        type: 'water',
        points,
        bbox,
      });
    }

    // Coastlines
    if (tags.natural === 'coastline') {
      coastlineSegments.push(points);
    }

    // Roads
    if (tags.highway) {
      const roadType = tags.highway as RoadSegment['type'];
      if (['motorway', 'trunk', 'primary'].includes(roadType)) {
        roads.push({
          type: roadType as 'motorway' | 'trunk' | 'primary',
          points,
          name: tags.name,
          ...getRoadProperties(roadType),
        });
      }
    }

    // Railways
    if (tags.railway && ['rail', 'light_rail'].includes(tags.railway)) {
      roads.push({
        type: 'railway',
        points,
        name: tags.name,
        crossingDifficulty: 0.3,
        dangerLevel: 0.7,
      });
    }
  }

  return { waterAreas, coastlineSegments, roads };
}

function calculateBbox(points: Position[]): BoundingBox {
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
  for (const p of points) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
  }
  return { south, west, north, east };
}

function getRoadProperties(highwayType: string): { crossingDifficulty: number; dangerLevel: number } {
  switch (highwayType) {
    case 'motorway': return { crossingDifficulty: 0.05, dangerLevel: 0.95 };
    case 'trunk': return { crossingDifficulty: 0.15, dangerLevel: 0.8 };
    case 'primary': return { crossingDifficulty: 0.4, dangerLevel: 0.5 };
    default: return { crossingDifficulty: 0.6, dangerLevel: 0.3 };
  }
}

async function fetchTerrainForCity(city: CityInfo): Promise<TerrainData | null> {
  const radiusM = city.radiusKm * 1000;
  const query = buildOverpassQuery(city.lat, city.lng, radiusM);

  console.log(`  Fetching terrain for ${city.name}, ${city.state}...`);

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const { waterAreas, coastlineSegments, roads } = parseOverpassResponse(data);

    // Calculate overall bbox
    const allPoints: Position[] = [
      ...waterAreas.flatMap(w => w.points),
      ...coastlineSegments.flat(),
      ...roads.flatMap(r => r.points),
    ];

    const bbox = allPoints.length > 0
      ? calculateBbox(allPoints)
      : {
        south: city.lat - city.radiusKm / 111,
        north: city.lat + city.radiusKm / 111,
        west: city.lng - city.radiusKm / (111 * Math.cos(city.lat * Math.PI / 180)),
        east: city.lng + city.radiusKm / (111 * Math.cos(city.lat * Math.PI / 180)),
      };

    const terrain: TerrainData = {
      bbox,
      waterAreas,
      coastlineSegments,
      isCoastal: coastlineSegments.length > 0,
      roads,
      hasHighways: roads.some(r => r.type === 'motorway' || r.type === 'trunk'),
      hasRailways: roads.some(r => r.type === 'railway'),
      metadata: {
        city: city.name,
        state: city.state,
        downloadedAt: new Date().toISOString(),
        radiusKm: city.radiusKm,
        center: { lat: city.lat, lng: city.lng },
      },
    };

    console.log(`  ✓ ${city.name}: ${waterAreas.length} water areas, ${roads.length} roads`);
    return terrain;
  } catch (err) {
    console.error(`  ✗ ${city.name}: ${err}`);
    return null;
  }
}

function getCityCacheKey(city: CityInfo): string {
  return `${city.name.toLowerCase().replace(/\s+/g, '-')}-${city.state.toLowerCase()}`;
}

async function downloadCity(city: CityInfo, outputDir: string): Promise<boolean> {
  const terrain = await fetchTerrainForCity(city);
  if (!terrain) return false;

  const filename = `${getCityCacheKey(city)}.json`;
  const filepath = path.join(outputDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(terrain, null, 2));

  const stats = fs.statSync(filepath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
  console.log(`  Saved: ${filename} (${sizeMB} MB)`);

  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const outputDir = path.join(__dirname, '..', 'public', 'data', 'terrain');

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  let citiesToDownload: CityInfo[] = [];

  if (args.includes('--all')) {
    citiesToDownload = CACHED_CITIES;
  } else if (args.includes('--city')) {
    const cityIndex = args.indexOf('--city');
    const cityName = args[cityIndex + 1];
    const city = CACHED_CITIES.find(c =>
      c.name.toLowerCase() === cityName?.toLowerCase()
    );
    if (!city) {
      console.error(`City not found: ${cityName}`);
      console.log('Available cities:', CACHED_CITIES.map(c => c.name).join(', '));
      process.exit(1);
    }
    citiesToDownload = [city];
  } else {
    // Default: download first 5 cities
    citiesToDownload = CACHED_CITIES.slice(0, 5);
    console.log('Downloading first 5 cities. Use --all for all cities, or --city "Name" for specific city.');
  }

  console.log(`\nDownloading terrain for ${citiesToDownload.length} cities...\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < citiesToDownload.length; i++) {
    const city = citiesToDownload[i];
    console.log(`[${i + 1}/${citiesToDownload.length}] ${city.name}, ${city.state}`);

    const ok = await downloadCity(city, outputDir);
    if (ok) {
      success++;
    } else {
      failed++;
    }

    // Rate limit: wait between requests to avoid overwhelming the API
    if (i < citiesToDownload.length - 1) {
      console.log('  Waiting 5s before next request...\n');
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log(`\n✓ Complete: ${success} succeeded, ${failed} failed`);
  console.log(`Output directory: ${outputDir}`);
}

main().catch(console.error);
