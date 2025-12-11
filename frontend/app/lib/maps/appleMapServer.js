/**
 * Apple Maps Server API Integration
 *
 * Server-side API for geocoding and place search.
 * 25,000 free API calls per day.
 *
 * Documentation: https://developer.apple.com/documentation/applemapsserverapi
 */

import * as jose from 'jose';

const APPLE_MAPS_API_BASE = 'https://maps-api.apple.com/v1';

// Apple Maps credentials for Server API
// Supports both APPLE_MAPKIT_* (documented) and APPLE_MAPS_* (legacy) naming
const TEAM_ID = process.env.APPLE_MAPKIT_TEAM_ID || process.env.APPLE_MAPS_TEAM_ID;
const KEY_ID = process.env.APPLE_MAPKIT_KEY_ID || process.env.APPLE_MAPS_KEY_ID;
const PRIVATE_KEY = process.env.APPLE_MAPKIT_PRIVATE_KEY || process.env.APPLE_MAPS_PRIVATE_KEY;

// Cache the access token (valid for 30 min, we refresh at 25 min)
let cachedAccessToken = null;
let accessTokenExpiry = 0;

/**
 * Generate a JWT Auth Token and exchange it for an Access Token
 * Apple Maps Server API requires this two-step process
 */
async function getAppleMapsToken() {
  // Return cached access token if still valid
  if (cachedAccessToken && Date.now() < accessTokenExpiry) {
    return cachedAccessToken;
  }

  if (!TEAM_ID || !KEY_ID || !PRIVATE_KEY) {
    console.error('[AppleMapsServer] Missing credentials. Set APPLE_MAPKIT_TEAM_ID, APPLE_MAPKIT_KEY_ID, APPLE_MAPKIT_PRIVATE_KEY');
    throw new Error('Apple Maps not configured. Set environment variables.');
  }

  try {
    // Handle private key format issues from environment variables
    let privateKeyPem = PRIVATE_KEY;

    // Step 1: Convert escaped newlines to actual newlines
    if (privateKeyPem.includes('\\n')) {
      privateKeyPem = privateKeyPem.replace(/\\n/g, '\n');
    }

    // Step 2: If still no newlines, reconstruct the PEM format
    if (!privateKeyPem.includes('\n') || privateKeyPem.split('\n').length < 3) {
      const beginMarker = '-----BEGIN PRIVATE KEY-----';
      const endMarker = '-----END PRIVATE KEY-----';

      let keyContent = privateKeyPem
        .replace(beginMarker, '')
        .replace(endMarker, '')
        .replace(/\s/g, '');

      const lines = [];
      for (let i = 0; i < keyContent.length; i += 64) {
        lines.push(keyContent.substring(i, i + 64));
      }

      privateKeyPem = `${beginMarker}\n${lines.join('\n')}\n${endMarker}`;
    }

    console.log('[AppleMapsServer] Key format check - lines:', privateKeyPem.split('\n').length);

    // Import the private key
    const privateKey = await jose.importPKCS8(privateKeyPem, 'ES256');
    console.log('[AppleMapsServer] Key imported successfully');

    // Step 1: Generate JWT Auth Token
    const now = Math.floor(Date.now() / 1000);
    const authToken = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })
      .setIssuer(TEAM_ID)
      .setIssuedAt(now)
      .setExpirationTime(now + 1800)
      .sign(privateKey);

    console.log('[AppleMapsServer] Auth token generated, exchanging for access token...');

    // Step 2: Exchange Auth Token for Access Token at /v1/token
    const tokenResponse = await fetch(`${APPLE_MAPS_API_BASE}/token`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[AppleMapsServer] Token exchange failed:', tokenResponse.status, errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.status} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.accessToken;

    if (!accessToken) {
      throw new Error('No access token in response');
    }

    console.log('[AppleMapsServer] Access token received, expires in:', tokenData.expiresInSeconds, 'seconds');

    // Cache the access token (refresh 5 min before expiry)
    cachedAccessToken = accessToken;
    const expiresIn = tokenData.expiresInSeconds || 1800;
    accessTokenExpiry = Date.now() + (expiresIn - 300) * 1000; // 5 min before expiry

    return accessToken;
  } catch (error) {
    console.error('[AppleMapsServer] Token generation failed:', error);
    throw new Error('Failed to generate Apple Maps token. Check your credentials.');
  }
}

/**
 * Make authenticated request to Apple Maps API
 */
async function appleMapsFetch(endpoint, params = {}) {
  const token = await getAppleMapsToken();

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
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[AppleMapsServer] API error:', response.status, errorText);

    if (response.status === 401 || response.status === 403) {
      // Invalidate cached token on auth error
      cachedAccessToken = null;
      accessTokenExpiry = 0;
      throw new Error('Apple Maps token invalid. Check your credentials.');
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
