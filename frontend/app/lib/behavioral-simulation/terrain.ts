/**
 * Terrain Detection using OpenStreetMap Overpass API
 * Fetches water bodies and coastlines for any location globally
 */

export interface Position {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface WaterPolygon {
  type: 'water' | 'coastline';
  points: Position[];
  bbox: BoundingBox;
}

export interface TerrainData {
  bbox: BoundingBox;
  waterAreas: WaterPolygon[];
  coastlineSegments: Position[][];
  isCoastal: boolean;
}

// Calculate bounding box for search radius
function getBoundingBox(center: Position, radiusM: number): BoundingBox {
  const latOffset = radiusM / 111000;
  const lngOffset = radiusM / (111000 * Math.cos(center.lat * Math.PI / 180));

  return {
    south: center.lat - latOffset,
    north: center.lat + latOffset,
    west: center.lng - lngOffset,
    east: center.lng + lngOffset,
  };
}

// Fetch water data from OSM Overpass API
export async function fetchTerrainData(
  center: Position,
  radiusM: number = 5000
): Promise<TerrainData> {
  const bbox = getBoundingBox(center, radiusM);
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

  // Overpass query for water bodies
  const query = `
    [out:json][timeout:10];
    (
      way["natural"="water"](${bboxStr});
      way["natural"="coastline"](${bboxStr});
      way["waterway"~"river|stream|canal"](${bboxStr});
      relation["natural"="water"](${bboxStr});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      console.warn('Overpass API request failed, using fallback');
      return createEmptyTerrainData(bbox);
    }

    const data = await response.json();
    return parseOverpassResponse(data, bbox);
  } catch (error) {
    console.warn('Failed to fetch terrain data:', error);
    return createEmptyTerrainData(bbox);
  }
}

// Parse Overpass API response
function parseOverpassResponse(data: any, bbox: BoundingBox): TerrainData {
  const nodes = new Map<number, Position>();
  const waterAreas: WaterPolygon[] = [];
  const coastlineSegments: Position[][] = [];

  // First pass: collect all nodes
  for (const element of data.elements || []) {
    if (element.type === 'node') {
      nodes.set(element.id, { lat: element.lat, lng: element.lon });
    }
  }

  // Second pass: build polygons and lines
  for (const element of data.elements || []) {
    if (element.type === 'way' && element.nodes) {
      const points = element.nodes
        .map((nodeId: number) => nodes.get(nodeId))
        .filter(Boolean) as Position[];

      if (points.length < 3) continue;

      const tags = element.tags || {};

      if (tags.natural === 'coastline') {
        coastlineSegments.push(points);
      } else if (tags.natural === 'water' || tags.waterway) {
        const polyBbox = getPolygonBbox(points);
        waterAreas.push({
          type: 'water',
          points,
          bbox: polyBbox,
        });
      }
    }
  }

  return {
    bbox,
    waterAreas,
    coastlineSegments,
    isCoastal: coastlineSegments.length > 0,
  };
}

function getPolygonBbox(points: Position[]): BoundingBox {
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
  for (const p of points) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
  }
  return { south, west, north, east };
}

function createEmptyTerrainData(bbox: BoundingBox): TerrainData {
  return {
    bbox,
    waterAreas: [],
    coastlineSegments: [],
    isCoastal: false,
  };
}

// Check if a point is inside a polygon using ray casting
function pointInPolygon(point: Position, polygon: Position[]): boolean {
  let inside = false;
  const x = point.lng, y = point.lat;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }

  return inside;
}

// Check if a point is in water using cached terrain data
export function isPointInWater(point: Position, terrain: TerrainData): boolean {
  // Quick bbox check
  if (
    point.lat < terrain.bbox.south ||
    point.lat > terrain.bbox.north ||
    point.lng < terrain.bbox.west ||
    point.lng > terrain.bbox.east
  ) {
    return false; // Outside our data area - assume land
  }

  // Check each water polygon
  for (const water of terrain.waterAreas) {
    // Quick bbox check for this polygon
    if (
      point.lat < water.bbox.south ||
      point.lat > water.bbox.north ||
      point.lng < water.bbox.west ||
      point.lng > water.bbox.east
    ) {
      continue;
    }

    if (pointInPolygon(point, water.points)) {
      return true;
    }
  }

  return false;
}

// Create a simple terrain checker that can be used synchronously
export class TerrainChecker {
  private terrain: TerrainData | null = null;
  private loading: boolean = false;
  private center: Position;
  private radiusM: number;

  constructor(center: Position, radiusM: number = 5000) {
    this.center = center;
    this.radiusM = radiusM;
  }

  // Initialize - call this before simulation starts
  async initialize(): Promise<void> {
    if (this.terrain || this.loading) return;
    this.loading = true;
    try {
      this.terrain = await fetchTerrainData(this.center, this.radiusM);
    } finally {
      this.loading = false;
    }
  }

  // Check if point is in water (synchronous after init)
  isWater(point: Position): boolean {
    if (!this.terrain) return false;
    return isPointInWater(point, this.terrain);
  }

  // Check if we're in a coastal area
  isCoastal(): boolean {
    return this.terrain?.isCoastal || false;
  }

  // Get terrain data for debugging
  getTerrainData(): TerrainData | null {
    return this.terrain;
  }
}
