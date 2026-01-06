/**
 * Terrain Detection using OpenStreetMap Overpass API
 * Fetches water bodies, roads, highways, and railways for any location globally
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

// Road types that pets should avoid or have difficulty crossing
export type RoadType = 'motorway' | 'trunk' | 'primary' | 'secondary' | 'railway';

export interface RoadSegment {
  type: RoadType;
  points: Position[];
  name?: string;
  // Crossing difficulty: 0 = impossible, 1 = easy
  crossingDifficulty: number;
  // Danger level if pet attempts to cross: 0 = safe, 1 = very dangerous
  dangerLevel: number;
}

export interface TerrainData {
  bbox: BoundingBox;
  waterAreas: WaterPolygon[];
  coastlineSegments: Position[][];
  isCoastal: boolean;
  // New: roads and railways
  roads: RoadSegment[];
  hasHighways: boolean;
  hasRailways: boolean;
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

// Fetch water and road data from OSM Overpass API with timeout
export async function fetchTerrainData(
  center: Position,
  radiusM: number = 5000,
  timeoutMs: number = 8000
): Promise<TerrainData> {
  const bbox = getBoundingBox(center, radiusM);
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;

  // Overpass query for water bodies AND major roads/highways/railways
  const query = `
    [out:json][timeout:10];
    (
      // Water
      way["natural"="water"](${bboxStr});
      way["natural"="coastline"](${bboxStr});
      way["waterway"~"river|stream|canal"](${bboxStr});
      relation["natural"="water"](${bboxStr});
      // Major roads - motorways, trunk roads, primary roads
      way["highway"="motorway"](${bboxStr});
      way["highway"="motorway_link"](${bboxStr});
      way["highway"="trunk"](${bboxStr});
      way["highway"="trunk_link"](${bboxStr});
      way["highway"="primary"](${bboxStr});
      // Railways
      way["railway"="rail"](${bboxStr});
      way["railway"="light_rail"](${bboxStr});
    );
    out body;
    >;
    out skel qt;
  `;

  try {
    // Add AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('Overpass API request failed, using hardcoded fallback');
      return createEmptyTerrainData(bbox);
    }

    const data = await response.json();
    return parseOverpassResponse(data, bbox);
  } catch (error) {
    console.warn('Failed to fetch terrain data:', error);
    return createEmptyTerrainData(bbox);
  }
}

// Get road properties based on type
function getRoadProperties(highwayType: string): { type: RoadType; crossingDifficulty: number; dangerLevel: number } {
  switch (highwayType) {
    case 'motorway':
    case 'motorway_link':
      // Motorways: extremely dangerous, pets cannot safely cross
      return { type: 'motorway', crossingDifficulty: 0.05, dangerLevel: 0.95 };
    case 'trunk':
    case 'trunk_link':
      // Trunk roads: very dangerous, high-speed traffic
      return { type: 'trunk', crossingDifficulty: 0.15, dangerLevel: 0.8 };
    case 'primary':
      // Primary roads: dangerous but possible to cross
      return { type: 'primary', crossingDifficulty: 0.4, dangerLevel: 0.5 };
    case 'secondary':
      // Secondary roads: moderate danger
      return { type: 'secondary', crossingDifficulty: 0.7, dangerLevel: 0.25 };
    default:
      return { type: 'secondary', crossingDifficulty: 0.8, dangerLevel: 0.15 };
  }
}

// Parse Overpass API response
function parseOverpassResponse(data: any, bbox: BoundingBox): TerrainData {
  const nodes = new Map<number, Position>();
  const waterAreas: WaterPolygon[] = [];
  const coastlineSegments: Position[][] = [];
  const roads: RoadSegment[] = [];
  let hasHighways = false;
  let hasRailways = false;

  // First pass: collect all nodes
  for (const element of data.elements || []) {
    if (element.type === 'node') {
      nodes.set(element.id, { lat: element.lat, lng: element.lon });
    }
  }

  // Second pass: build polygons, lines, and roads
  for (const element of data.elements || []) {
    if (element.type === 'way' && element.nodes) {
      const points = element.nodes
        .map((nodeId: number) => nodes.get(nodeId))
        .filter(Boolean) as Position[];

      if (points.length < 2) continue;

      const tags = element.tags || {};

      // Water features
      if (tags.natural === 'coastline') {
        coastlineSegments.push(points);
      } else if (tags.natural === 'water' || tags.waterway) {
        if (points.length >= 3) {
          const polyBbox = getPolygonBbox(points);
          waterAreas.push({
            type: 'water',
            points,
            bbox: polyBbox,
          });
        }
      }

      // Roads and highways
      if (tags.highway) {
        const roadProps = getRoadProperties(tags.highway);
        roads.push({
          ...roadProps,
          points,
          name: tags.name || tags.ref,
        });
        if (tags.highway === 'motorway' || tags.highway === 'motorway_link' ||
            tags.highway === 'trunk' || tags.highway === 'trunk_link') {
          hasHighways = true;
        }
      }

      // Railways
      if (tags.railway === 'rail' || tags.railway === 'light_rail') {
        roads.push({
          type: 'railway',
          points,
          name: tags.name,
          crossingDifficulty: 0.3, // Pets can cross but it's risky
          dangerLevel: 0.7, // Very dangerous if train comes
        });
        hasRailways = true;
      }
    }
  }

  console.log(`Parsed terrain: ${waterAreas.length} water areas, ${roads.length} roads/railways`);

  return {
    bbox,
    waterAreas,
    coastlineSegments,
    isCoastal: coastlineSegments.length > 0,
    roads,
    hasHighways,
    hasRailways,
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
    roads: [],
    hasHighways: false,
    hasRailways: false,
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

// Check if two line segments intersect
function lineSegmentsIntersect(
  p1: Position, p2: Position,  // First line segment
  p3: Position, p4: Position   // Second line segment
): boolean {
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);

  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }

  if (d1 === 0 && onSegment(p3, p4, p1)) return true;
  if (d2 === 0 && onSegment(p3, p4, p2)) return true;
  if (d3 === 0 && onSegment(p1, p2, p3)) return true;
  if (d4 === 0 && onSegment(p1, p2, p4)) return true;

  return false;
}

function direction(pi: Position, pj: Position, pk: Position): number {
  return (pk.lng - pi.lng) * (pj.lat - pi.lat) - (pj.lng - pi.lng) * (pk.lat - pi.lat);
}

function onSegment(pi: Position, pj: Position, pk: Position): boolean {
  return Math.min(pi.lng, pj.lng) <= pk.lng && pk.lng <= Math.max(pi.lng, pj.lng) &&
         Math.min(pi.lat, pj.lat) <= pk.lat && pk.lat <= Math.max(pi.lat, pj.lat);
}

// Result of checking road crossing
export interface RoadCrossingResult {
  crosses: boolean;
  road?: RoadSegment;
  crossingDifficulty: number;  // 0 = blocked, 1 = easy
  dangerLevel: number;         // 0 = safe, 1 = lethal
}

// Check if a movement from p1 to p2 crosses any roads
export function checkRoadCrossing(
  from: Position,
  to: Position,
  terrain: TerrainData
): RoadCrossingResult {
  if (!terrain.roads || terrain.roads.length === 0) {
    return { crosses: false, crossingDifficulty: 1, dangerLevel: 0 };
  }

  let worstCrossing: RoadCrossingResult = {
    crosses: false,
    crossingDifficulty: 1,
    dangerLevel: 0,
  };

  for (const road of terrain.roads) {
    // Check each segment of the road
    for (let i = 0; i < road.points.length - 1; i++) {
      const roadStart = road.points[i];
      const roadEnd = road.points[i + 1];

      if (lineSegmentsIntersect(from, to, roadStart, roadEnd)) {
        // Found a crossing - keep track of the most dangerous one
        if (road.dangerLevel > worstCrossing.dangerLevel) {
          worstCrossing = {
            crosses: true,
            road,
            crossingDifficulty: road.crossingDifficulty,
            dangerLevel: road.dangerLevel,
          };
        }
      }
    }
  }

  return worstCrossing;
}

// Check distance to nearest road (for danger zone detection)
export function distanceToNearestRoad(
  point: Position,
  terrain: TerrainData
): { distance: number; road?: RoadSegment } {
  if (!terrain.roads || terrain.roads.length === 0) {
    return { distance: Infinity };
  }

  let minDistance = Infinity;
  let nearestRoad: RoadSegment | undefined;

  for (const road of terrain.roads) {
    for (let i = 0; i < road.points.length - 1; i++) {
      const dist = pointToSegmentDistance(point, road.points[i], road.points[i + 1]);
      if (dist < minDistance) {
        minDistance = dist;
        nearestRoad = road;
      }
    }
  }

  return { distance: minDistance, road: nearestRoad };
}

// Calculate distance from point to line segment in meters
function pointToSegmentDistance(p: Position, v: Position, w: Position): number {
  const l2 = (v.lat - w.lat) ** 2 + (v.lng - w.lng) ** 2;
  if (l2 === 0) {
    return Math.sqrt((p.lat - v.lat) ** 2 + (p.lng - v.lng) ** 2) * 111000;
  }

  let t = ((p.lat - v.lat) * (w.lat - v.lat) + (p.lng - v.lng) * (w.lng - v.lng)) / l2;
  t = Math.max(0, Math.min(1, t));

  const projLat = v.lat + t * (w.lat - v.lat);
  const projLng = v.lng + t * (w.lng - v.lng);

  const dLat = (p.lat - projLat) * 111000;
  const dLng = (p.lng - projLng) * 111000 * Math.cos(p.lat * Math.PI / 180);

  return Math.sqrt(dLat * dLat + dLng * dLng);
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

  // Check if moving from one point to another crosses a road
  checkRoadCrossing(from: Position, to: Position): RoadCrossingResult {
    if (!this.terrain) {
      return { crosses: false, crossingDifficulty: 1, dangerLevel: 0 };
    }
    return checkRoadCrossing(from, to, this.terrain);
  }

  // Get distance to nearest road
  distanceToRoad(point: Position): { distance: number; road?: RoadSegment } {
    if (!this.terrain) {
      return { distance: Infinity };
    }
    return distanceToNearestRoad(point, this.terrain);
  }

  // Check if we're in a coastal area
  isCoastal(): boolean {
    return this.terrain?.isCoastal || false;
  }

  // Check if area has major highways
  hasHighways(): boolean {
    return this.terrain?.hasHighways || false;
  }

  // Check if area has railways
  hasRailways(): boolean {
    return this.terrain?.hasRailways || false;
  }

  // Get terrain data for debugging
  getTerrainData(): TerrainData | null {
    return this.terrain;
  }
}
