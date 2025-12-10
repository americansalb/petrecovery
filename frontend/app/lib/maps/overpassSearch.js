/**
 * Overpass API (OpenStreetMap) Place Search
 *
 * Free, no API key required.
 * Used for finding shelters, vets, and animal services.
 */

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

/**
 * Calculate distance between two points using Haversine formula
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Search for places using Overpass API
 */
async function overpassQuery(query) {
  const response = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Transform Overpass result to our place format
 */
function transformPlace(element, centerLat, centerLng) {
  const lat = element.lat || element.center?.lat;
  const lng = element.lon || element.center?.lon;

  const tags = element.tags || {};

  // Build address from OSM tags
  const addressParts = [];
  if (tags['addr:housenumber']) addressParts.push(tags['addr:housenumber']);
  if (tags['addr:street']) addressParts.push(tags['addr:street']);
  if (tags['addr:city']) addressParts.push(tags['addr:city']);
  if (tags['addr:state']) addressParts.push(tags['addr:state']);
  if (tags['addr:postcode']) addressParts.push(tags['addr:postcode']);

  const address = addressParts.length > 0
    ? addressParts.join(', ')
    : tags.address || '';

  const distance = lat && lng ? haversineDistance(centerLat, centerLng, lat, lng) : null;

  return {
    placeId: `osm-${element.type}-${element.id}`,
    name: tags.name || tags.operator || 'Unnamed Location',
    address,
    location: lat && lng ? { lat, lng } : null,
    phone: tags.phone || tags['contact:phone'] || null,
    website: tags.website || tags['contact:website'] || null,
    category: tags.amenity || tags.shop || tags.healthcare || 'place',
    distance,
    openingHours: tags.opening_hours || null,
  };
}

/**
 * Search for animal shelters
 */
export async function searchShelters(lat, lng, options = {}) {
  const { radiusMeters = 40000 } = options; // Default 40km (~25 miles)

  // Search for animal shelters, animal boarding, and related
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="animal_shelter"](around:${radiusMeters},${lat},${lng});
      way["amenity"="animal_shelter"](around:${radiusMeters},${lat},${lng});
      node["amenity"="animal_boarding"](around:${radiusMeters},${lat},${lng});
      way["amenity"="animal_boarding"](around:${radiusMeters},${lat},${lng});
      node["animal"="shelter"](around:${radiusMeters},${lat},${lng});
      way["animal"="shelter"](around:${radiusMeters},${lat},${lng});
      node["name"~"humane society|animal shelter|animal rescue|spca|aspca",i](around:${radiusMeters},${lat},${lng});
      way["name"~"humane society|animal shelter|animal rescue|spca|aspca",i](around:${radiusMeters},${lat},${lng});
    );
    out center;
  `;

  try {
    const data = await overpassQuery(query);
    const places = (data.elements || [])
      .map(el => transformPlace(el, lat, lng))
      .filter(p => p.location && p.name !== 'Unnamed Location')
      .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));

    // Dedupe by name (case insensitive)
    const seen = new Set();
    return places.filter(p => {
      const key = p.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (error) {
    console.error('[Overpass] Shelter search error:', error);
    return [];
  }
}

/**
 * Search for veterinary clinics
 */
export async function searchVets(lat, lng, options = {}) {
  const { radiusMeters = 40000 } = options;

  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="veterinary"](around:${radiusMeters},${lat},${lng});
      way["amenity"="veterinary"](around:${radiusMeters},${lat},${lng});
      node["healthcare"="veterinary"](around:${radiusMeters},${lat},${lng});
      way["healthcare"="veterinary"](around:${radiusMeters},${lat},${lng});
      node["name"~"veterinary|animal hospital|pet clinic|vet clinic",i](around:${radiusMeters},${lat},${lng});
      way["name"~"veterinary|animal hospital|pet clinic|vet clinic",i](around:${radiusMeters},${lat},${lng});
    );
    out center;
  `;

  try {
    const data = await overpassQuery(query);
    const places = (data.elements || [])
      .map(el => transformPlace(el, lat, lng))
      .filter(p => p.location && p.name !== 'Unnamed Location')
      .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));

    const seen = new Set();
    return places.filter(p => {
      const key = p.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (error) {
    console.error('[Overpass] Vet search error:', error);
    return [];
  }
}

/**
 * Search for animal control offices
 */
export async function searchAnimalControl(lat, lng, options = {}) {
  const { radiusMeters = 40000 } = options;

  const query = `
    [out:json][timeout:25];
    (
      node["office"="government"]["name"~"animal control|animal services",i](around:${radiusMeters},${lat},${lng});
      way["office"="government"]["name"~"animal control|animal services",i](around:${radiusMeters},${lat},${lng});
      node["amenity"="animal_shelter"]["operator:type"="government"](around:${radiusMeters},${lat},${lng});
      way["amenity"="animal_shelter"]["operator:type"="government"](around:${radiusMeters},${lat},${lng});
      node["name"~"animal control|animal services|animal regulation",i](around:${radiusMeters},${lat},${lng});
      way["name"~"animal control|animal services|animal regulation",i](around:${radiusMeters},${lat},${lng});
    );
    out center;
  `;

  try {
    const data = await overpassQuery(query);
    const places = (data.elements || [])
      .map(el => transformPlace(el, lat, lng))
      .filter(p => p.location && p.name !== 'Unnamed Location')
      .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));

    const seen = new Set();
    return places.filter(p => {
      const key = p.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (error) {
    console.error('[Overpass] Animal control search error:', error);
    return [];
  }
}

/**
 * Search for pet stores
 */
export async function searchPetStores(lat, lng, options = {}) {
  const { radiusMeters = 40000 } = options;

  const query = `
    [out:json][timeout:25];
    (
      node["shop"="pet"](around:${radiusMeters},${lat},${lng});
      way["shop"="pet"](around:${radiusMeters},${lat},${lng});
      node["shop"="pet_grooming"](around:${radiusMeters},${lat},${lng});
      way["shop"="pet_grooming"](around:${radiusMeters},${lat},${lng});
    );
    out center;
  `;

  try {
    const data = await overpassQuery(query);
    const places = (data.elements || [])
      .map(el => transformPlace(el, lat, lng))
      .filter(p => p.location && p.name !== 'Unnamed Location')
      .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));

    const seen = new Set();
    return places.filter(p => {
      const key = p.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (error) {
    console.error('[Overpass] Pet store search error:', error);
    return [];
  }
}

/**
 * Generic place search
 */
export async function searchPlaces(query, lat, lng, options = {}) {
  const { radiusMeters = 40000 } = options;

  // Escape special regex characters in query
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const overpassQuery = `
    [out:json][timeout:25];
    (
      node["name"~"${escapedQuery}",i](around:${radiusMeters},${lat},${lng});
      way["name"~"${escapedQuery}",i](around:${radiusMeters},${lat},${lng});
    );
    out center;
  `;

  try {
    const data = await overpassQuery(overpassQuery);
    const places = (data.elements || [])
      .map(el => transformPlace(el, lat, lng))
      .filter(p => p.location && p.name !== 'Unnamed Location')
      .sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));

    const seen = new Set();
    return places.filter(p => {
      const key = p.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (error) {
    console.error('[Overpass] Place search error:', error);
    return [];
  }
}

export default {
  searchShelters,
  searchVets,
  searchAnimalControl,
  searchPetStores,
  searchPlaces,
};
