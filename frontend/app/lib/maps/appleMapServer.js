/**
 * Apple Maps Server API Integration
 *
 * Server-side API for geocoding and place search.
 * 25,000 free API calls per day.
 *
 * Documentation: https://developer.apple.com/documentation/applemapsserverapi
 */

const APPLE_MAPS_API_BASE = 'https://maps-api.apple.com/v1';

// Apple Maps token - MUST be set in environment for your domain
// Generate at: https://developer.apple.com/account/resources/services/maps
const MAPKIT_TOKEN = process.env.NEXT_PUBLIC_APPLE_MAPKIT_TOKEN || process.env.APPLE_MAPKIT_TOKEN;

if (!MAPKIT_TOKEN) {
  console.error('[AppleMapsServer] No APPLE_MAPKIT_TOKEN set! Shelter search will not work.');
}

/**
 * Make authenticated request to Apple Maps API
 */
async function appleMapsFetch(endpoint, params = {}) {
  if (!MAPKIT_TOKEN) {
    console.error('[AppleMapsServer] Cannot make API call - no token configured');
    throw new Error('Apple Maps not configured. Set APPLE_MAPKIT_TOKEN env var.');
  }

  const url = new URL(`${APPLE_MAPS_API_BASE}${endpoint}`);

  // Add query params
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  console.log('[AppleMapsServer] Request:', endpoint, params);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${MAPKIT_TOKEN}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[AppleMapsServer] API error:', response.status, errorText);

    if (response.status === 401 || response.status === 403) {
      throw new Error('Apple Maps token invalid or expired. Generate new token for your domain.');
    }
    throw new Error(`Apple Maps API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Search for places near a location
 *
 * @param {string} query - Search query (e.g., "animal shelter", "veterinary")
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} Array of place results
 */
export async function searchPlaces(query, lat, lng, options = {}) {
  const {
    limit = 25,
    lang = 'en-US',
  } = options;

  try {
    const data = await appleMapsFetch('/search', {
      q: query,
      searchLocation: `${lat},${lng}`,
      resultTypeFilter: 'Poi', // Points of Interest only
      lang,
      limitToCountries: 'US',
    });

    // Transform results to our format
    const places = (data.results || []).slice(0, limit).map(place => ({
      placeId: place.id || place.muid,
      name: place.name,
      address: formatAppleAddress(place),
      location: {
        lat: place.center?.latitude || place.coordinate?.latitude,
        lng: place.center?.longitude || place.coordinate?.longitude,
      },
      category: place.poiCategory,
      phone: place.telephone,
      url: place.url,
      distance: place.distance, // in meters
    }));

    return places;
  } catch (error) {
    console.error('[AppleMapsServer] Search error:', error);
    throw error;
  }
}

/**
 * Search specifically for animal shelters
 */
export async function searchShelters(lat, lng, options = {}) {
  // Try multiple search terms to get better results
  const searchTerms = [
    'animal shelter',
    'pet shelter',
    'animal rescue',
    'humane society',
  ];

  const allResults = [];
  const seenIds = new Set();

  for (const term of searchTerms) {
    try {
      const results = await searchPlaces(term, lat, lng, { ...options, limit: 10 });
      for (const place of results) {
        if (!seenIds.has(place.placeId)) {
          seenIds.add(place.placeId);
          allResults.push({ ...place, searchTerm: term });
        }
      }
    } catch (error) {
      console.warn(`[AppleMapsServer] Search for "${term}" failed:`, error.message);
    }
  }

  // Sort by distance
  allResults.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));

  return allResults.slice(0, options.limit || 25);
}

/**
 * Search specifically for veterinary clinics
 */
export async function searchVets(lat, lng, options = {}) {
  const searchTerms = [
    'veterinary clinic',
    'veterinarian',
    'animal hospital',
    'pet clinic',
  ];

  const allResults = [];
  const seenIds = new Set();

  for (const term of searchTerms) {
    try {
      const results = await searchPlaces(term, lat, lng, { ...options, limit: 10 });
      for (const place of results) {
        if (!seenIds.has(place.placeId)) {
          seenIds.add(place.placeId);
          allResults.push({ ...place, searchTerm: term });
        }
      }
    } catch (error) {
      console.warn(`[AppleMapsServer] Search for "${term}" failed:`, error.message);
    }
  }

  // Sort by distance
  allResults.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));

  return allResults.slice(0, options.limit || 25);
}

/**
 * Search for animal control offices
 */
export async function searchAnimalControl(lat, lng, options = {}) {
  const searchTerms = [
    'animal control',
    'animal services',
    'animal regulation',
  ];

  const allResults = [];
  const seenIds = new Set();

  for (const term of searchTerms) {
    try {
      const results = await searchPlaces(term, lat, lng, { ...options, limit: 10 });
      for (const place of results) {
        if (!seenIds.has(place.placeId)) {
          seenIds.add(place.placeId);
          allResults.push({ ...place, searchTerm: term });
        }
      }
    } catch (error) {
      console.warn(`[AppleMapsServer] Search for "${term}" failed:`, error.message);
    }
  }

  // Sort by distance
  allResults.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));

  return allResults.slice(0, options.limit || 25);
}

/**
 * Geocode an address to coordinates
 */
export async function geocode(address) {
  try {
    const data = await appleMapsFetch('/geocode', {
      q: address,
      limitToCountries: 'US',
    });

    if (!data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];
    return {
      lat: result.coordinate?.latitude,
      lng: result.coordinate?.longitude,
      address: formatAppleAddress(result),
      displayName: result.displayMapRegion?.displayName || result.name,
    };
  } catch (error) {
    console.error('[AppleMapsServer] Geocode error:', error);
    throw error;
  }
}

/**
 * Reverse geocode coordinates to address
 */
export async function reverseGeocode(lat, lng) {
  try {
    const data = await appleMapsFetch('/reverseGeocode', {
      loc: `${lat},${lng}`,
    });

    if (!data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];
    return {
      address: formatAppleAddress(result),
      city: result.locality,
      state: result.administrativeArea,
      country: result.country,
      postalCode: result.postCode,
    };
  } catch (error) {
    console.error('[AppleMapsServer] Reverse geocode error:', error);
    throw error;
  }
}

/**
 * Format Apple Maps address object to string
 */
function formatAppleAddress(place) {
  if (!place) return '';

  // If it's already a string
  if (typeof place.formattedAddressLines === 'string') {
    return place.formattedAddressLines;
  }

  // If it's an array, join it
  if (Array.isArray(place.formattedAddressLines)) {
    return place.formattedAddressLines.join(', ');
  }

  // Build from components
  const parts = [];
  if (place.subThoroughfare) parts.push(place.subThoroughfare);
  if (place.thoroughfare) parts.push(place.thoroughfare);
  if (place.locality) parts.push(place.locality);
  if (place.administrativeArea) parts.push(place.administrativeArea);
  if (place.postCode) parts.push(place.postCode);

  return parts.join(', ') || place.name || '';
}

export default {
  searchPlaces,
  searchShelters,
  searchVets,
  searchAnimalControl,
  geocode,
  reverseGeocode,
};
