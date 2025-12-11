/**
 * City Boundary Service
 *
 * Uses OpenStreetMap Nominatim API to fetch city boundaries
 * and perform point-in-polygon tests for radius searches.
 */

const NOMINATIM_API = 'https://nominatim.openstreetmap.org';

// Rate limit: max 1 request per second to be respectful to Nominatim
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds

async function rateLimitedFetch(url) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'PetRecovery/1.0 (pet recovery application)',
    },
  });

  return response;
}

/**
 * Fetch city boundary polygon from Nominatim
 *
 * @param {string} city - City name
 * @param {string} state - State abbreviation or name
 * @param {string} country - Country code (default: US)
 * @returns {Object|null} City data with boundary polygon
 */
export async function fetchCityBoundary(city, state, country = 'US') {
  try {
    const query = encodeURIComponent(`${city}, ${state}, ${country}`);
    const url = `${NOMINATIM_API}/search?q=${query}&format=json&polygon_geojson=1&limit=1`;

    console.log('[CityBoundary] Fetching boundary for:', city, state);

    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }

    const results = await response.json();

    if (!results || results.length === 0) {
      console.log('[CityBoundary] No results found for:', city, state);
      return null;
    }

    const result = results[0];

    // Check if we got a polygon boundary
    const hasPolygon = result.geojson &&
      (result.geojson.type === 'Polygon' || result.geojson.type === 'MultiPolygon');

    return {
      city: city,
      state: state,
      country: country,
      centerLat: parseFloat(result.lat),
      centerLng: parseFloat(result.lon),
      displayName: result.display_name,
      osmType: result.osm_type,
      osmId: result.osm_id,
      boundingBox: result.boundingbox ? {
        south: parseFloat(result.boundingbox[0]),
        north: parseFloat(result.boundingbox[1]),
        west: parseFloat(result.boundingbox[2]),
        east: parseFloat(result.boundingbox[3]),
      } : null,
      boundary: hasPolygon ? JSON.stringify(result.geojson) : null,
    };
  } catch (error) {
    console.error('[CityBoundary] Fetch error:', error);
    throw error;
  }
}

/**
 * Reverse geocode coordinates to get city/state
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Object|null} Location info with city and state
 */
export async function reverseGeocodeCity(lat, lng) {
  try {
    const url = `${NOMINATIM_API}/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`;

    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }

    const result = await response.json();

    if (!result || !result.address) {
      return null;
    }

    const address = result.address;

    return {
      city: address.city || address.town || address.village || address.municipality,
      county: address.county,
      state: address.state,
      stateAbbr: getStateAbbreviation(address.state),
      country: address.country_code?.toUpperCase() || 'US',
      displayName: result.display_name,
    };
  } catch (error) {
    console.error('[CityBoundary] Reverse geocode error:', error);
    throw error;
  }
}

/**
 * Calculate Haversine distance between two points
 *
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} Distance in meters
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Check if a point is inside a GeoJSON polygon
 * Uses ray casting algorithm
 *
 * @param {number} lat
 * @param {number} lng
 * @param {Object} geojson - GeoJSON Polygon or MultiPolygon
 * @returns {boolean}
 */
export function pointInPolygon(lat, lng, geojson) {
  if (!geojson) return false;

  const polygon = typeof geojson === 'string' ? JSON.parse(geojson) : geojson;

  if (polygon.type === 'Polygon') {
    return pointInRing(lng, lat, polygon.coordinates[0]);
  } else if (polygon.type === 'MultiPolygon') {
    return polygon.coordinates.some(poly => pointInRing(lng, lat, poly[0]));
  }

  return false;
}

/**
 * Ray casting algorithm for point-in-polygon
 */
function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Check if a bounding box intersects with a circle (radius search)
 *
 * @param {Object} bbox - Bounding box {south, north, west, east}
 * @param {number} centerLat - Circle center latitude
 * @param {number} centerLng - Circle center longitude
 * @param {number} radiusMeters - Circle radius in meters
 * @returns {boolean}
 */
export function bboxIntersectsCircle(bbox, centerLat, centerLng, radiusMeters) {
  if (!bbox) return false;

  // Find the closest point on the bbox to the circle center
  const closestLat = Math.max(bbox.south, Math.min(centerLat, bbox.north));
  const closestLng = Math.max(bbox.west, Math.min(centerLng, bbox.east));

  // Check if this closest point is within the radius
  const distance = haversineDistance(centerLat, centerLng, closestLat, closestLng);

  return distance <= radiusMeters;
}

/**
 * Find all cities within a radius that might contain results
 * Uses bounding box intersection for initial filtering
 *
 * @param {Array} cityCaches - Array of CityCache records from database
 * @param {number} centerLat - Search center latitude
 * @param {number} centerLng - Search center longitude
 * @param {number} radiusMeters - Search radius in meters
 * @returns {Array} Filtered city caches that intersect with search area
 */
export function findCitiesInRadius(cityCaches, centerLat, centerLng, radiusMeters) {
  return cityCaches.filter(cache => {
    // If we have a boundary, check bbox intersection
    if (cache.boundary) {
      try {
        const geojson = JSON.parse(cache.boundary);
        // Extract bbox from geojson or use stored bbox
        const bbox = extractBboxFromGeojson(geojson) || {
          south: cache.centerLat - 0.5,
          north: cache.centerLat + 0.5,
          west: cache.centerLng - 0.5,
          east: cache.centerLng + 0.5,
        };
        return bboxIntersectsCircle(bbox, centerLat, centerLng, radiusMeters);
      } catch (e) {
        // Fall back to center point distance
      }
    }

    // Fallback: check if city center is within radius + buffer (50km buffer for city size)
    if (cache.centerLat && cache.centerLng) {
      const distance = haversineDistance(centerLat, centerLng, cache.centerLat, cache.centerLng);
      return distance <= radiusMeters + 50000; // 50km buffer
    }

    return false;
  });
}

/**
 * Extract bounding box from GeoJSON geometry
 */
function extractBboxFromGeojson(geojson) {
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  function processCoords(coords) {
    if (typeof coords[0] === 'number') {
      // It's a coordinate pair [lng, lat]
      minLng = Math.min(minLng, coords[0]);
      maxLng = Math.max(maxLng, coords[0]);
      minLat = Math.min(minLat, coords[1]);
      maxLat = Math.max(maxLat, coords[1]);
    } else {
      // It's an array of coordinates/rings
      coords.forEach(processCoords);
    }
  }

  if (geojson.coordinates) {
    processCoords(geojson.coordinates);
  }

  if (minLat === Infinity) return null;

  return {
    south: minLat,
    north: maxLat,
    west: minLng,
    east: maxLng,
  };
}

/**
 * Convert state name to abbreviation
 */
const STATE_ABBREV = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
};

function getStateAbbreviation(stateName) {
  if (!stateName) return null;
  // Already an abbreviation
  if (stateName.length === 2) return stateName.toUpperCase();
  return STATE_ABBREV[stateName] || null;
}

export default {
  fetchCityBoundary,
  reverseGeocodeCity,
  haversineDistance,
  pointInPolygon,
  bboxIntersectsCircle,
  findCitiesInRadius,
};
