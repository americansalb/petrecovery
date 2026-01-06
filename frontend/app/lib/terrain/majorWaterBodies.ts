/**
 * Major Water Bodies - Predefined Polygons for Global Lakes, Bays, and Inland Seas
 *
 * These are simplified bounding polygons for major water bodies that pets
 * cannot cross. This provides water detection for inland areas where
 * coastline detection doesn't apply.
 */

export interface Position {
  lat: number;
  lng: number;
}

export interface WaterBody {
  name: string;
  type: 'lake' | 'bay' | 'sea' | 'river';
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  // Optional polygon for more precise detection
  polygon?: Position[];
}

// === NORTH AMERICA ===

// Great Lakes
const LAKE_SUPERIOR: WaterBody = {
  name: 'Lake Superior',
  type: 'lake',
  bounds: { north: 49.0, south: 46.4, west: -92.2, east: -84.3 },
};

const LAKE_MICHIGAN: WaterBody = {
  name: 'Lake Michigan',
  type: 'lake',
  bounds: { north: 46.1, south: 41.6, west: -87.5, east: -86.0 },
  // Lake Michigan western shore is around -87.5 to -87.6
  // Chicago downtown is at -87.65 which is on land WEST of the lake
};

const LAKE_HURON: WaterBody = {
  name: 'Lake Huron',
  type: 'lake',
  bounds: { north: 46.3, south: 43.0, west: -84.8, east: -79.7 },
};

const LAKE_ERIE: WaterBody = {
  name: 'Lake Erie',
  type: 'lake',
  bounds: { north: 42.9, south: 41.4, west: -83.5, east: -78.9 },
};

const LAKE_ONTARIO: WaterBody = {
  name: 'Lake Ontario',
  type: 'lake',
  bounds: { north: 44.3, south: 43.2, west: -79.9, east: -76.1 },
};

// Major US Bays
const SAN_FRANCISCO_BAY: WaterBody = {
  name: 'San Francisco Bay',
  type: 'bay',
  bounds: { north: 38.2, south: 37.4, west: -122.45, east: -122.15 },
  // SF Bay - conservative polygon, SF downtown (37.79, -122.40) is LAND
  // The waterfront is around -122.39, bay water starts east of that
  polygon: [
    { lat: 37.82, lng: -122.42 }, // Golden Gate (eastern side)
    { lat: 37.85, lng: -122.40 }, // Richardson Bay
    { lat: 37.88, lng: -122.38 }, // Tiburon peninsula
    { lat: 37.92, lng: -122.38 }, // San Pablo Bay entrance
    { lat: 38.00, lng: -122.40 }, // San Pablo Bay west
    { lat: 38.05, lng: -122.35 }, // San Pablo Bay north
    { lat: 38.00, lng: -122.28 }, // San Pablo Bay east
    { lat: 37.90, lng: -122.32 }, // Richmond waterfront
    { lat: 37.85, lng: -122.32 }, // Berkeley waterfront
    { lat: 37.80, lng: -122.30 }, // Oakland waterfront
    { lat: 37.75, lng: -122.28 }, // South of Oakland
    { lat: 37.68, lng: -122.22 }, // San Leandro Bay area
    { lat: 37.58, lng: -122.18 }, // Fremont/Newark area
    { lat: 37.50, lng: -122.15 }, // South Bay east
    { lat: 37.45, lng: -122.18 }, // Far south bay
    { lat: 37.50, lng: -122.25 }, // Redwood City
    { lat: 37.55, lng: -122.28 }, // San Mateo Bridge area
    { lat: 37.60, lng: -122.35 }, // SFO area
    { lat: 37.68, lng: -122.38 }, // Brisbane waterfront
    { lat: 37.78, lng: -122.38 }, // SF waterfront (east of downtown)
    { lat: 37.80, lng: -122.38 }, // Embarcadero
    { lat: 37.82, lng: -122.42 }, // Back to Golden Gate
  ],
};

const CHESAPEAKE_BAY: WaterBody = {
  name: 'Chesapeake Bay',
  type: 'bay',
  bounds: { north: 39.6, south: 36.9, west: -77.2, east: -75.7 },
};

const PUGET_SOUND: WaterBody = {
  name: 'Puget Sound',
  type: 'bay',
  bounds: { north: 48.5, south: 47.0, west: -123.2, east: -122.4 },
  // Seattle downtown is at -122.33, waterfront is around -122.35
};

const TAMPA_BAY: WaterBody = {
  name: 'Tampa Bay',
  type: 'bay',
  bounds: { north: 28.0, south: 27.5, west: -82.8, east: -82.3 },
};

const MOBILE_BAY: WaterBody = {
  name: 'Mobile Bay',
  type: 'bay',
  bounds: { north: 30.8, south: 30.2, west: -88.1, east: -87.7 },
};

const GALVESTON_BAY: WaterBody = {
  name: 'Galveston Bay',
  type: 'bay',
  bounds: { north: 29.8, south: 29.3, west: -95.1, east: -94.5 },
};

const NARRAGANSETT_BAY: WaterBody = {
  name: 'Narragansett Bay',
  type: 'bay',
  bounds: { north: 41.9, south: 41.4, west: -71.5, east: -71.1 },
};

const LONG_ISLAND_SOUND: WaterBody = {
  name: 'Long Island Sound',
  type: 'bay',
  bounds: { north: 41.3, south: 40.8, west: -73.8, east: -72.0 },
};

// Other major US lakes
const LAKE_TAHOE: WaterBody = {
  name: 'Lake Tahoe',
  type: 'lake',
  bounds: { north: 39.3, south: 38.9, west: -120.2, east: -119.9 },
};

const GREAT_SALT_LAKE: WaterBody = {
  name: 'Great Salt Lake',
  type: 'lake',
  bounds: { north: 41.7, south: 40.6, west: -113.1, east: -111.9 },
};

const LAKE_OKEECHOBEE: WaterBody = {
  name: 'Lake Okeechobee',
  type: 'lake',
  bounds: { north: 27.2, south: 26.7, west: -81.1, east: -80.6 },
};

// === EUROPE ===

const BALTIC_SEA: WaterBody = {
  name: 'Baltic Sea',
  type: 'sea',
  bounds: { north: 66.0, south: 53.5, west: 9.5, east: 30.0 },
};

const BLACK_SEA: WaterBody = {
  name: 'Black Sea',
  type: 'sea',
  bounds: { north: 47.0, south: 40.5, west: 27.5, east: 42.0 },
};

const CASPIAN_SEA: WaterBody = {
  name: 'Caspian Sea',
  type: 'sea',
  bounds: { north: 47.0, south: 36.5, west: 46.5, east: 54.5 },
};

const LAKE_GENEVA: WaterBody = {
  name: 'Lake Geneva',
  type: 'lake',
  bounds: { north: 46.5, south: 46.2, west: 6.1, east: 6.9 },
};

const LAKE_CONSTANCE: WaterBody = {
  name: 'Lake Constance',
  type: 'lake',
  bounds: { north: 47.8, south: 47.4, west: 9.0, east: 9.7 },
};

const LOCH_NESS: WaterBody = {
  name: 'Loch Ness',
  type: 'lake',
  bounds: { north: 57.4, south: 57.1, west: -4.7, east: -4.2 },
};

// === ASIA ===

const LAKE_BAIKAL: WaterBody = {
  name: 'Lake Baikal',
  type: 'lake',
  bounds: { north: 55.8, south: 51.4, west: 103.7, east: 110.0 },
};

const DEAD_SEA: WaterBody = {
  name: 'Dead Sea',
  type: 'sea',
  bounds: { north: 31.8, south: 31.0, west: 35.3, east: 35.6 },
};

const ARAL_SEA: WaterBody = {
  name: 'Aral Sea',
  type: 'sea',
  bounds: { north: 46.5, south: 43.5, west: 58.0, east: 61.5 },
};

const TOKYO_BAY: WaterBody = {
  name: 'Tokyo Bay',
  type: 'bay',
  bounds: { north: 35.7, south: 35.2, west: 139.6, east: 140.1 },
};

const OSAKA_BAY: WaterBody = {
  name: 'Osaka Bay',
  type: 'bay',
  bounds: { north: 34.8, south: 34.3, west: 135.0, east: 135.5 },
};

// China major lakes
const POYANG_LAKE: WaterBody = {
  name: 'Poyang Lake',
  type: 'lake',
  bounds: { north: 29.8, south: 28.4, west: 115.8, east: 116.8 },
};

const DONGTING_LAKE: WaterBody = {
  name: 'Dongting Lake',
  type: 'lake',
  bounds: { north: 29.7, south: 28.7, west: 112.0, east: 113.2 },
};

// === AFRICA ===

const LAKE_VICTORIA: WaterBody = {
  name: 'Lake Victoria',
  type: 'lake',
  bounds: { north: 0.5, south: -3.1, west: 31.5, east: 34.9 },
};

const LAKE_TANGANYIKA: WaterBody = {
  name: 'Lake Tanganyika',
  type: 'lake',
  bounds: { north: -3.3, south: -8.8, west: 29.0, east: 31.2 },
};

const LAKE_MALAWI: WaterBody = {
  name: 'Lake Malawi',
  type: 'lake',
  bounds: { north: -9.5, south: -14.4, west: 33.9, east: 35.2 },
};

const RED_SEA: WaterBody = {
  name: 'Red Sea',
  type: 'sea',
  bounds: { north: 30.0, south: 12.5, west: 32.0, east: 44.0 },
};

// === SOUTH AMERICA ===

const LAKE_TITICACA: WaterBody = {
  name: 'Lake Titicaca',
  type: 'lake',
  bounds: { north: -15.2, south: -16.6, west: -70.1, east: -68.6 },
};

const LAKE_MARACAIBO: WaterBody = {
  name: 'Lake Maracaibo',
  type: 'lake',
  bounds: { north: 11.0, south: 8.5, west: -72.5, east: -71.0 },
};

// === AUSTRALIA ===

const SYDNEY_HARBOUR: WaterBody = {
  name: 'Sydney Harbour',
  type: 'bay',
  bounds: { north: -33.8, south: -33.9, west: 151.1, east: 151.3 },
};

const PORT_PHILLIP_BAY: WaterBody = {
  name: 'Port Phillip Bay',
  type: 'bay',
  bounds: { north: -37.8, south: -38.4, west: 144.4, east: 145.1 },
};

// Collect all water bodies
const ALL_WATER_BODIES: WaterBody[] = [
  // Great Lakes
  LAKE_SUPERIOR,
  LAKE_MICHIGAN,
  LAKE_HURON,
  LAKE_ERIE,
  LAKE_ONTARIO,
  // US Bays
  SAN_FRANCISCO_BAY,
  CHESAPEAKE_BAY,
  PUGET_SOUND,
  TAMPA_BAY,
  MOBILE_BAY,
  GALVESTON_BAY,
  NARRAGANSETT_BAY,
  LONG_ISLAND_SOUND,
  // US Lakes
  LAKE_TAHOE,
  GREAT_SALT_LAKE,
  LAKE_OKEECHOBEE,
  // Europe
  BALTIC_SEA,
  BLACK_SEA,
  CASPIAN_SEA,
  LAKE_GENEVA,
  LAKE_CONSTANCE,
  LOCH_NESS,
  // Asia
  LAKE_BAIKAL,
  DEAD_SEA,
  ARAL_SEA,
  TOKYO_BAY,
  OSAKA_BAY,
  POYANG_LAKE,
  DONGTING_LAKE,
  // Africa
  LAKE_VICTORIA,
  LAKE_TANGANYIKA,
  LAKE_MALAWI,
  RED_SEA,
  // South America
  LAKE_TITICACA,
  LAKE_MARACAIBO,
  // Australia
  SYDNEY_HARBOUR,
  PORT_PHILLIP_BAY,
];

/**
 * Check if point is inside a polygon using ray casting
 */
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

/**
 * Check if a point is within a water body's bounding box
 */
function isInBounds(pos: Position, bounds: WaterBody['bounds']): boolean {
  return (
    pos.lat >= bounds.south &&
    pos.lat <= bounds.north &&
    pos.lng >= bounds.west &&
    pos.lng <= bounds.east
  );
}

/**
 * Check if a point is in any major water body
 * Returns the name of the water body if found, null otherwise
 */
export function isInMajorWaterBody(pos: Position): string | null {
  for (const body of ALL_WATER_BODIES) {
    // Quick bounding box check
    if (!isInBounds(pos, body.bounds)) {
      continue;
    }

    // If there's a polygon, use precise detection
    if (body.polygon) {
      if (pointInPolygon(pos, body.polygon)) {
        return body.name;
      }
    } else {
      // Use bounding box only (less precise but works for most lakes)
      // Add a small buffer to avoid edge cases
      const innerBounds = {
        north: body.bounds.north - 0.05,
        south: body.bounds.south + 0.05,
        east: body.bounds.east - 0.05,
        west: body.bounds.west + 0.05,
      };
      if (isInBounds(pos, innerBounds)) {
        return body.name;
      }
    }
  }

  return null;
}

/**
 * Check if a point is in any major water body (boolean version)
 */
export function isInMajorWater(pos: Position): boolean {
  return isInMajorWaterBody(pos) !== null;
}

/**
 * Get all water bodies that could be relevant for a given area
 * Useful for caching/optimization
 */
export function getWaterBodiesInArea(
  center: Position,
  radiusKm: number
): WaterBody[] {
  const latOffset = radiusKm / 111;
  const lngOffset = radiusKm / (111 * Math.cos(center.lat * Math.PI / 180));

  const searchBounds = {
    north: center.lat + latOffset,
    south: center.lat - latOffset,
    east: center.lng + lngOffset,
    west: center.lng - lngOffset,
  };

  return ALL_WATER_BODIES.filter(body => {
    // Check if the water body's bounds intersect with search area
    return !(
      body.bounds.south > searchBounds.north ||
      body.bounds.north < searchBounds.south ||
      body.bounds.west > searchBounds.east ||
      body.bounds.east < searchBounds.west
    );
  });
}
