/**
 * Global Water Heuristics - Coastline Detection via Geographic Math
 *
 * This module provides water detection that works ANYWHERE in the world
 * without relying on external APIs. It uses piecewise linear approximations
 * of major coastlines to determine if a point is likely in the ocean.
 */

export interface Position {
  lat: number;
  lng: number;
}

/**
 * Piecewise linear approximation of coastlines.
 * Each entry: [latitude, longitude_of_coastline]
 * Interpolate between points for intermediate latitudes.
 */

// North America - Pacific Coast (West)
// Points from north to south
const US_WEST_COAST: [number, number][] = [
  [49.0, -123.5],   // Vancouver area
  [48.5, -124.7],   // Olympic Peninsula
  [47.0, -124.5],   // Washington coast
  [46.0, -124.0],   // Columbia River
  [44.0, -124.2],   // Oregon coast
  [42.0, -124.4],   // Oregon/California border
  [41.0, -124.2],   // Northern California
  [39.0, -123.8],   // Mendocino
  [38.0, -123.0],   // Point Reyes
  [37.8, -122.5],   // Golden Gate
  [37.5, -122.5],   // SF Peninsula
  [36.5, -122.0],   // Monterey Bay
  [35.5, -121.0],   // Central Coast
  [34.5, -120.5],   // Santa Barbara
  [34.0, -118.8],   // Malibu
  [33.8, -118.4],   // LA Coast
  [33.0, -117.5],   // San Diego area
  [32.5, -117.2],   // Tijuana
  [30.0, -116.0],   // Baja California
  [25.0, -112.0],   // Southern Baja
  [23.0, -110.0],   // Cabo San Lucas
];

// North America - Atlantic Coast (East)
const US_EAST_COAST: [number, number][] = [
  [47.0, -67.0],    // Maine (Eastport)
  [44.0, -69.0],    // Maine coast
  [43.0, -70.5],    // New Hampshire/Massachusetts
  [42.0, -70.0],    // Cape Cod
  [41.5, -71.0],    // Rhode Island
  [41.0, -72.0],    // Connecticut
  [40.5, -74.0],    // New Jersey
  [39.5, -74.5],    // Atlantic City
  [38.5, -75.0],    // Delaware Bay
  [37.0, -76.0],    // Chesapeake Bay entrance
  [36.0, -75.5],    // Virginia Beach
  [35.0, -75.5],    // Outer Banks
  [34.0, -77.5],    // Wilmington NC
  [33.0, -79.0],    // Myrtle Beach
  [32.0, -80.5],    // Charleston
  [31.0, -81.0],    // Savannah
  [30.5, -81.5],    // Jacksonville
  [29.0, -81.0],    // Daytona
  [28.0, -80.5],    // Cape Canaveral
  [27.0, -80.2],    // Palm Beach
  [26.0, -80.1],    // Fort Lauderdale
  [25.8, -80.2],    // Miami
  [25.0, -80.5],    // Florida Keys start
  [24.5, -81.8],    // Key West
];

// Gulf of Mexico Coast
const GULF_COAST: [number, number][] = [
  [30.0, -84.0],    // Florida Panhandle
  [30.3, -87.5],    // Pensacola
  [30.2, -88.5],    // Mobile Bay
  [30.0, -89.5],    // Mississippi coast
  [29.5, -90.0],    // New Orleans area
  [29.0, -91.0],    // Louisiana coast
  [29.5, -93.5],    // Western Louisiana
  [29.5, -95.0],    // Galveston
  [28.0, -96.5],    // Corpus Christi
  [26.0, -97.2],    // South Texas
  [25.5, -97.5],    // Brownsville
];

// Europe - Atlantic Coast
const EUROPE_WEST_COAST: [number, number][] = [
  [71.0, 25.0],     // Northern Norway
  [70.0, 20.0],     // Norway coast
  [65.0, 12.0],     // Mid Norway
  [62.0, 5.0],      // Bergen area
  [59.0, 5.5],      // Stavanger
  [58.0, 6.0],      // Southern Norway
  [57.5, 8.0],      // Denmark (Jutland)
  [55.0, 8.0],      // Denmark west coast
  [53.5, 5.0],      // Netherlands
  [52.0, 4.0],      // Hook of Holland
  [51.0, 2.5],      // Belgium
  [50.5, 1.5],      // Calais
  [49.5, -1.5],     // Normandy
  [48.5, -4.5],     // Brittany
  [47.5, -3.0],     // Southern Brittany
  [46.0, -1.5],     // Bay of Biscay (France)
  [44.0, -1.5],     // Bordeaux area
  [43.5, -2.0],     // Basque coast
  [43.0, -9.0],     // Northern Spain (Galicia)
  [41.0, -9.0],     // Portugal (Porto)
  [38.5, -9.5],     // Lisbon
  [37.0, -9.0],     // Algarve
  [36.0, -6.0],     // Strait of Gibraltar
];

// UK & Ireland
const UK_WEST_COAST: [number, number][] = [
  [58.5, -6.5],     // Scottish Highlands
  [57.0, -7.0],     // Outer Hebrides
  [56.0, -6.5],     // Inner Hebrides
  [55.5, -6.0],     // Northern Ireland
  [54.0, -5.5],     // Irish Sea
  [53.0, -4.5],     // Wales
  [52.0, -5.0],     // St George's Channel
  [51.5, -5.0],     // South Wales
  [50.5, -5.0],     // Cornwall
];

const IRELAND_WEST_COAST: [number, number][] = [
  [55.5, -8.0],     // Donegal
  [54.0, -10.0],    // Mayo
  [53.0, -10.5],    // Galway Bay
  [52.0, -10.5],    // Kerry
  [51.5, -10.0],    // Cork
];

// Mediterranean (simplified - southern Europe coastline)
const MEDITERRANEAN_NORTH: [number, number][] = [
  [36.0, -6.0],     // Gibraltar
  [37.0, -2.0],     // Almeria
  [38.0, 0.0],      // Valencia
  [41.0, 2.0],      // Barcelona
  [43.0, 3.5],      // French Riviera start
  [43.5, 7.5],      // Nice/Monaco
  [44.0, 9.0],      // Genoa
  [42.5, 11.0],     // Tuscany
  [41.0, 13.0],     // Rome area
  [40.5, 14.5],     // Naples
  [38.0, 16.0],     // Calabria
  [38.0, 15.5],     // Messina
  [37.5, 15.0],     // Sicily east
  [37.0, 14.0],     // Sicily south
];

// Asia - East Coast
const CHINA_COAST: [number, number][] = [
  [40.0, 122.0],    // Liaoning
  [38.0, 121.0],    // Bohai Sea
  [36.0, 120.5],    // Shandong
  [34.0, 120.0],    // Jiangsu
  [31.0, 122.0],    // Shanghai
  [29.0, 122.0],    // Zhejiang
  [26.0, 120.0],    // Fujian
  [23.0, 117.0],    // Guangdong
  [22.0, 114.5],    // Hong Kong
  [21.5, 110.0],    // Hainan
];

const JAPAN_PACIFIC: [number, number][] = [
  [45.5, 142.0],    // Hokkaido
  [43.0, 145.5],    // Eastern Hokkaido
  [41.0, 141.5],    // Aomori
  [39.0, 142.0],    // Iwate
  [36.5, 141.0],    // Ibaraki
  [35.5, 140.0],    // Tokyo Bay
  [34.5, 139.0],    // Izu Peninsula
  [33.5, 136.0],    // Nagoya area
  [33.0, 133.0],    // Shikoku
  [32.0, 132.0],    // Kyushu east
  [31.5, 131.5],    // Miyazaki
];

// Australia
const AUSTRALIA_EAST: [number, number][] = [
  [-10.5, 142.5],   // Cape York
  [-15.0, 145.5],   // Cairns
  [-19.0, 147.0],   // Townsville
  [-23.0, 150.5],   // Rockhampton
  [-27.5, 153.5],   // Brisbane
  [-33.5, 151.5],   // Sydney
  [-37.5, 150.0],   // Victoria coast
  [-38.5, 146.0],   // Bass Strait
  [-43.0, 147.5],   // Tasmania
];

const AUSTRALIA_WEST: [number, number][] = [
  [-12.0, 130.5],   // Darwin
  [-17.0, 122.0],   // Broome
  [-22.0, 114.0],   // Exmouth
  [-27.0, 113.5],   // Geraldton
  [-32.0, 115.5],   // Perth
  [-34.5, 119.0],   // Albany
  [-35.0, 136.0],   // Adelaide
];

// South America - Pacific
const SOUTH_AMERICA_WEST: [number, number][] = [
  [2.0, -79.0],     // Ecuador/Colombia
  [-2.0, -81.0],    // Ecuador
  [-6.0, -81.5],    // Northern Peru
  [-12.0, -77.5],   // Lima
  [-18.0, -71.0],   // Southern Peru
  [-23.5, -70.5],   // Northern Chile
  [-33.0, -71.5],   // Santiago
  [-41.0, -73.0],   // Southern Chile
  [-46.0, -75.0],   // Patagonia
  [-53.0, -71.0],   // Strait of Magellan
];

// South America - Atlantic
const SOUTH_AMERICA_EAST: [number, number][] = [
  [10.0, -62.0],    // Venezuela
  [5.0, -52.0],     // Guyana/Suriname
  [0.0, -50.0],     // Amazon mouth
  [-3.0, -41.0],    // Northeastern Brazil
  [-8.0, -35.0],    // Recife
  [-13.0, -38.5],   // Salvador
  [-20.0, -40.0],   // Vitoria
  [-23.0, -43.0],   // Rio de Janeiro
  [-26.0, -48.5],   // Southern Brazil
  [-32.0, -52.0],   // Uruguay
  [-35.0, -57.0],   // Buenos Aires
  [-41.0, -63.0],   // Patagonia
  [-47.0, -66.0],   // Southern Argentina
  [-52.0, -69.0],   // Tierra del Fuego
];

// Africa - West Coast
const AFRICA_WEST: [number, number][] = [
  [36.0, -6.0],     // Morocco (Tangier)
  [34.0, -7.0],     // Casablanca
  [28.0, -13.0],    // Western Sahara
  [21.0, -17.0],    // Mauritania
  [15.0, -17.5],    // Senegal
  [10.0, -15.0],    // Guinea
  [6.0, -11.0],     // Sierra Leone/Liberia
  [5.0, -5.0],      // Ivory Coast
  [6.0, 1.0],       // Ghana/Togo
  [6.0, 3.0],       // Benin/Nigeria
  [4.0, 7.0],       // Nigeria (Niger Delta)
  [4.0, 9.0],       // Cameroon
  [0.0, 9.5],       // Gabon
  [-5.0, 12.0],     // Congo
  [-6.0, 12.5],     // Angola (Luanda)
  [-17.0, 12.0],    // Southern Angola
  [-22.5, 14.5],    // Namibia
  [-29.0, 17.0],    // South Africa west
  [-34.0, 18.5],    // Cape Town
];

/**
 * Interpolate longitude at a given latitude from coastline data
 */
function interpolateCoastline(coastline: [number, number][], lat: number): number | null {
  // Sort by latitude (some coastlines go N->S, some S->N)
  const sorted = [...coastline].sort((a, b) => b[0] - a[0]); // High to low lat

  // Check bounds
  if (lat > sorted[0][0] || lat < sorted[sorted.length - 1][0]) {
    return null; // Outside coastline range
  }

  // Find the two points to interpolate between
  for (let i = 0; i < sorted.length - 1; i++) {
    const [lat1, lng1] = sorted[i];
    const [lat2, lng2] = sorted[i + 1];

    if (lat <= lat1 && lat >= lat2) {
      // Linear interpolation
      const t = (lat - lat2) / (lat1 - lat2);
      return lng2 + t * (lng1 - lng2);
    }
  }

  return null;
}

/**
 * Check if a point is in the Pacific Ocean (west of Americas, east of Asia)
 */
function isInPacificOcean(pos: Position): boolean {
  const { lat, lng } = pos;

  // Americas Pacific Coast
  if (lng < 0 && lng > -180) {
    // US/Mexico/Central America West Coast
    if (lat >= 23 && lat <= 49) {
      const coastLng = interpolateCoastline(US_WEST_COAST, lat);
      if (coastLng !== null && lng < coastLng - 0.1) {
        return true;
      }
    }

    // South America Pacific Coast
    if (lat >= -55 && lat <= 2) {
      const coastLng = interpolateCoastline(SOUTH_AMERICA_WEST, lat);
      if (coastLng !== null && lng < coastLng - 0.1) {
        return true;
      }
    }
  }

  // Asia/Australia Pacific Coast
  if (lng > 100 || lng < -100) {
    // Japan Pacific
    if (lat >= 31 && lat <= 46 && lng > 130) {
      const coastLng = interpolateCoastline(JAPAN_PACIFIC, lat);
      if (coastLng !== null && lng > coastLng + 0.1) {
        return true;
      }
    }

    // Australia East - be more conservative
    // Sydney is at 151.21, coast is around 151.5
    if (lat >= -44 && lat <= -10 && lng > 140) {
      const coastLng = interpolateCoastline(AUSTRALIA_EAST, lat);
      if (coastLng !== null && lng > coastLng + 0.5) {
        return true;
      }
    }
  }

  // Deep Pacific (mid-ocean) - only truly open ocean
  // Exclude Australian east coast region
  if (lat > -60 && lat < 60) {
    // Western Pacific (east of Australia/Asia)
    if (lng > 160 && lat > -50 && lat < 50) {
      return true;
    }
    // Eastern Pacific (west of Americas)
    if (lng < -140 && lat > -50 && lat < 50) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a point is in the Atlantic Ocean
 */
function isInAtlanticOcean(pos: Position): boolean {
  const { lat, lng } = pos;

  // Americas Atlantic Coast
  if (lat >= 24 && lat <= 47 && lng > -82 && lng < -60) {
    const coastLng = interpolateCoastline(US_EAST_COAST, lat);
    if (coastLng !== null && lng > coastLng + 0.1) {
      return true;
    }
  }

  // Gulf of Mexico - complex coastline facing south
  // The coastline data is [lat, lng] pairs, but Gulf faces south not east/west
  // Use a conservative approach: only flag deep Gulf as water, avoid coastal areas
  if (lat >= 18 && lat <= 30 && lng > -98 && lng < -80) {
    // Deep Gulf (well south of coastline) - definitely water
    if (lat < 27 && lng > -96 && lng < -84) {
      return true;
    }
    // Near Florida Keys region
    if (lat < 25 && lng > -84 && lng < -80) {
      return true;
    }
  }

  // South America Atlantic
  if (lat >= -55 && lat <= 10 && lng > -70 && lng < -30) {
    const coastLng = interpolateCoastline(SOUTH_AMERICA_EAST, lat);
    if (coastLng !== null && lng > coastLng + 0.1) {
      return true;
    }
  }

  // Europe West Coast - continental Europe only
  // Exclude UK/Ireland which are islands (handled separately)
  if (lat >= 36 && lat <= 72 && lng > -15 && lng < 30) {
    // Skip if in UK/Ireland zone (islands, not continental coast)
    if (lat >= 49 && lat <= 60 && lng >= -11 && lng <= 2) {
      // UK and Ireland area - don't apply continental coast logic
      // These are islands, water detection is complex
    } else {
      const coastLng = interpolateCoastline(EUROPE_WEST_COAST, lat);
      if (coastLng !== null && lng < coastLng - 0.5) {
        return true;
      }
    }
  }

  // UK West Coast - only far west of Ireland
  if (lat >= 50 && lat <= 59 && lng < -11) {
    return true; // Atlantic west of Ireland
  }

  // Ireland West Coast - only far west
  if (lat >= 51 && lat <= 56 && lng < -11) {
    return true; // Atlantic west of Ireland
  }

  // Africa West Coast
  if (lat >= -35 && lat <= 36 && lng > -20 && lng < 20) {
    const coastLng = interpolateCoastline(AFRICA_WEST, lat);
    if (coastLng !== null && lng < coastLng - 0.1) {
      return true;
    }
  }

  // Mid-Atlantic (deep ocean) - only truly open ocean
  // Exclude areas near South American coast
  if (lat > -60 && lat < 60 && lng > -45 && lng < -25) {
    // South American coast extends to around -35 longitude in places
    // Only flag as water if clearly offshore
    if (lat >= -35 && lat <= 10) {
      // Near South America - be conservative
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Check if a point is in the Indian Ocean
 */
function isInIndianOcean(pos: Position): boolean {
  const { lat, lng } = pos;

  // East Africa coast - offshore only
  if (lat >= -35 && lat <= 12 && lng > 30 && lng < 55) {
    if (lng > 50 && lat > -30 && lat < 10) {
      return true;
    }
  }

  // Australia West - use coastline interpolation
  if (lat >= -35 && lat <= -10 && lng > 100 && lng < 130) {
    const coastLng = interpolateCoastline(AUSTRALIA_WEST, lat);
    if (coastLng !== null && lng < coastLng - 1.0) {
      return true;
    }
  }

  // Arabian Sea area (west of India)
  // Mumbai is at (19.08, 72.88) - must avoid this coastal city
  // India's west coast varies by latitude:
  // - At lat ~20 (Mumbai), coast is at ~73
  // - At lat ~10 (Kerala), coast is at ~76
  // - At lat ~8 (southern tip), coast is at ~77
  if (lat >= 0 && lat <= 25 && lng >= 55) {
    // Adjust eastern boundary based on latitude
    let eastBoundary: number;
    if (lat > 15) {
      eastBoundary = 72; // Near Mumbai - stay west
    } else if (lat > 10) {
      eastBoundary = 74; // Mid-coast
    } else {
      eastBoundary = 76; // Southern India - coast is further east
    }
    if (lng < eastBoundary) {
      return true;
    }
  }

  // Central Indian Ocean (south of India/Sri Lanka)
  if (lat >= -50 && lat < 5 && lng > 65 && lng < 95) {
    return true;
  }

  return false;
}

/**
 * Check if a point is in the Mediterranean Sea
 */
function isInMediterranean(pos: Position): boolean {
  const { lat, lng } = pos;

  // Mediterranean bounds
  if (lat < 30 || lat > 46 || lng < -6 || lng > 37) {
    return false;
  }

  // Check against northern coastline
  if (lat >= 36 && lat <= 44 && lng >= -6 && lng <= 16) {
    const coastLat = interpolateCoastline(
      MEDITERRANEAN_NORTH.map(([lt, ln]) => [ln, lt] as [number, number]),
      lng
    );
    if (coastLat !== null && lat < coastLat - 0.1) {
      return true;
    }
  }

  // Eastern Mediterranean (simplified)
  if (lat >= 31 && lat <= 37 && lng > 20 && lng < 36) {
    return true;
  }

  return false;
}

/**
 * Check if point is in the Arctic Ocean
 */
function isInArcticOcean(pos: Position): boolean {
  // Simple latitude check for Arctic
  return pos.lat > 75;
}

/**
 * Check if point is in the Antarctic Ocean
 */
function isInAntarcticOcean(pos: Position): boolean {
  // Southern Ocean
  return pos.lat < -60;
}

/**
 * Main function: Check if a point is likely in any ocean
 * This works globally without requiring any external API
 */
export function isLikelyInOcean(pos: Position): boolean {
  if (isInPacificOcean(pos)) return true;
  if (isInAtlanticOcean(pos)) return true;
  if (isInIndianOcean(pos)) return true;
  if (isInMediterranean(pos)) return true;
  if (isInArcticOcean(pos)) return true;
  if (isInAntarcticOcean(pos)) return true;
  return false;
}

/**
 * Get the approximate distance to nearest coastline (rough estimate)
 * Returns positive if on land, negative if in water
 */
export function getCoastlineDistance(pos: Position): number {
  // This is a simplified implementation
  // A full implementation would calculate actual distance to coastline
  // For now, return 0 if on land, -1 if in water
  return isLikelyInOcean(pos) ? -1 : 1;
}
