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

  console.log('[AppleMapsServer] >>> REQUEST:', url.toString());

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const responseText = await response.text();
  console.log('[AppleMapsServer] <<< RESPONSE STATUS:', response.status);

  // Log FULL response - don't truncate!
  console.log('[AppleMapsServer] <<< FULL RESPONSE LENGTH:', responseText.length);
  console.log('[AppleMapsServer] <<< FULL RESPONSE:', responseText);

  // Parse and deeply inspect the response
  try {
    const parsed = JSON.parse(responseText);
    if (parsed.results?.[0]) {
      const firstResult = parsed.results[0];
      console.log('[AppleMapsServer] FIRST RESULT ALL KEYS:', Object.keys(firstResult));

      // Check for any property with "hour", "open", "business" in the name
      const allKeys = Object.keys(firstResult);
      for (const key of allKeys) {
        const keyLower = key.toLowerCase();
        if (keyLower.includes('hour') || keyLower.includes('open') || keyLower.includes('business') ||
            keyLower.includes('schedule') || keyLower.includes('operation')) {
          console.log(`[AppleMapsServer] FOUND HOURS-RELATED KEY: ${key} =`, JSON.stringify(firstResult[key]));
        }
      }

      // Log ALL properties with their values (for any we might have missed)
      console.log('[AppleMapsServer] === ALL PROPERTIES OF FIRST RESULT ===');
      for (const key of allKeys) {
        const val = firstResult[key];
        console.log(`[AppleMapsServer]   ${key}:`, typeof val === 'object' ? JSON.stringify(val) : val);
      }
      console.log('[AppleMapsServer] === END ALL PROPERTIES ===');
    }
  } catch (e) {
    // Ignore parse errors for this debug block
  }

  if (!response.ok) {
    console.error('[AppleMapsServer] API error:', response.status, responseText);

    if (response.status === 401 || response.status === 403) {
      // Invalidate cached token on auth error
      cachedAccessToken = null;
      accessTokenExpiry = 0;
      throw new Error('Apple Maps token invalid. Check your credentials.');
    }
    throw new Error(`Apple Maps API error: ${response.status}`);
  }

  try {
    return JSON.parse(responseText);
  } catch (e) {
    console.error('[AppleMapsServer] Failed to parse JSON:', e.message);
    return null;
  }
}

/**
 * Detect language based on coordinates for all of North America
 * Spanish: Mexico, Central America (except Belize), Cuba, DR, PR
 * French: Quebec, Haiti, Martinique, Guadeloupe
 * English: USA, Canada (except Quebec), Belize, Jamaica, Bahamas, etc.
 */
function detectLanguage(lat, lng) {
  // Central America (Spanish-speaking) - lat 7-18, lng -93 to -77
  // Excludes Belize (English) which is lng < -87.5, lat > 15.5
  if (lat > 7 && lat < 18 && lng > -93 && lng < -77) {
    // Check if it's Belize (English-speaking)
    if (lat > 15.5 && lng < -87.5 && lng > -90) {
      return 'en-US'; // Belize speaks English
    }
    return 'es-MX'; // Guatemala, Honduras, El Salvador, Nicaragua, Costa Rica, Panama
  }

  // Mexico: roughly south of US border (lat < 32) and within Mexico's longitude range
  if (lat < 32 && lat > 14 && lng > -118 && lng < -86) {
    return 'es-MX';
  }

  // Cuba: lat 19.5-23.5, lng -85 to -74
  if (lat > 19.5 && lat < 23.5 && lng > -85 && lng < -74) {
    return 'es-MX';
  }

  // Dominican Republic: lat 17.5-20, lng -72 to -68
  if (lat > 17.5 && lat < 20 && lng > -72 && lng < -68) {
    return 'es-MX';
  }

  // Haiti (French-speaking): lat 18-20, lng -74.5 to -71.5
  if (lat > 18 && lat < 20 && lng > -74.5 && lng < -71.5) {
    return 'fr-CA';
  }

  // Puerto Rico: roughly lat 17.9-18.5, lng -67.3 to -65.2
  if (lat > 17.5 && lat < 18.6 && lng > -68 && lng < -65) {
    return 'es-PR';
  }

  // French Caribbean - Martinique & Guadeloupe: lat 14-17, lng -62 to -60
  if (lat > 14 && lat < 17 && lng > -62 && lng < -60) {
    return 'fr-CA';
  }

  // Quebec: roughly lat 45-62, lng -80 to -57
  if (lat > 45 && lat < 62 && lng > -80 && lng < -57) {
    return 'fr-CA';
  }

  // Default to English (USA, English Canada, Jamaica, Bahamas, etc.)
  return 'en-US';
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
// All North American country codes for Apple Maps search
const NORTH_AMERICA_COUNTRIES = [
  'US', 'CA', 'MX', // Major countries
  'GT', 'BZ', 'HN', 'SV', 'NI', 'CR', 'PA', // Central America
  'CU', 'JM', 'HT', 'DO', 'BS', 'TT', 'BB', // Caribbean
  'AG', 'DM', 'GD', 'KN', 'LC', 'VC', // Lesser Antilles
  'AI', 'AW', 'BM', 'KY', 'TC', 'VG', 'VI', // Territories
  'GP', 'MQ', 'CW', 'GL' // French/Dutch territories, Greenland
].join(',');

export async function searchPlaces(query, lat, lng, options = {}) {
  const {
    limit = 25,
    lang = null, // Auto-detect if not specified
    countries = NORTH_AMERICA_COUNTRIES, // All of North America
  } = options;

  // Auto-detect language based on location
  const searchLang = lang || detectLanguage(lat, lng);

  try {
    // Try requesting additional data with various undocumented parameters
    const data = await appleMapsFetch('/search', {
      q: query,
      searchLocation: `${lat},${lng}`,
      resultTypeFilter: 'Poi', // Points of Interest only
      lang: searchLang,
      limitToCountries: countries,
      // Try undocumented parameters that might return hours
      includeAddressDetails: true,
      includePoiDetails: true,
      includeBusinessInfo: true,
      fields: 'hours,telephone,urls,openingHours,businessHours',
    });

    // Log first result to see ALL available fields
    if (data.results?.[0]) {
      console.log('[AppleMapsServer] Full first result:', JSON.stringify(data.results[0], null, 2));
    }

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
      // Try ALL possible field names for phone
      phone: place.telephone || place.phoneNumbers?.[0] || place.phone || place.tel || null,
      // Try ALL possible field names for website
      url: place.url || place.urls?.[0] || place.website || place.websiteUrl || null,
      distance: place.distance, // in meters
      // Try ALL possible field names for hours
      hours: place.openingHours || place.hoursOfOperation || place.hours || place.businessHours || null,
    }));

    return places;
  } catch (error) {
    console.error('[AppleMapsServer] Search error:', error);
    throw error;
  }
}

/**
 * Get localized search terms based on language
 */
function getLocalizedShelterTerms(lang) {
  const terms = {
    // English terms (US, English Canada)
    'en-US': ['animal shelter', 'pet shelter', 'animal rescue', 'humane society', 'SPCA'],
    'en-CA': ['animal shelter', 'pet shelter', 'animal rescue', 'humane society', 'SPCA'],
    // Spanish terms (Mexico, Puerto Rico)
    'es-MX': ['refugio de animales', 'albergue animal', 'rescate animal', 'protectora de animales', 'antirrábico'],
    'es-PR': ['refugio de animales', 'albergue animal', 'rescate animal', 'humane society', 'SPCA'],
    // French terms (Quebec)
    'fr-CA': ['refuge animalier', 'refuge pour animaux', 'SPA', 'société protectrice des animaux', 'SPCA'],
  };
  return terms[lang] || terms['en-US'];
}

/**
 * Search specifically for animal shelters
 */
export async function searchShelters(lat, lng, options = {}) {
  // Detect language and get localized search terms
  const lang = options.lang || detectLanguage(lat, lng);
  const searchTerms = getLocalizedShelterTerms(lang);

  // Also include English terms as fallback (many places indexed in English)
  const allTerms = lang !== 'en-US'
    ? [...searchTerms, 'animal shelter', 'pet shelter']
    : searchTerms;

  const allResults = [];
  const seenIds = new Set();

  for (const term of allTerms) {
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
 * Get localized vet search terms
 */
function getLocalizedVetTerms(lang) {
  const terms = {
    'en-US': ['veterinary clinic', 'veterinarian', 'animal hospital', 'pet clinic'],
    'en-CA': ['veterinary clinic', 'veterinarian', 'animal hospital', 'pet clinic'],
    'es-MX': ['veterinaria', 'clínica veterinaria', 'hospital veterinario', 'médico veterinario'],
    'es-PR': ['veterinaria', 'clínica veterinaria', 'hospital veterinario', 'veterinarian'],
    'fr-CA': ['clinique vétérinaire', 'vétérinaire', 'hôpital vétérinaire', 'clinique animale'],
  };
  return terms[lang] || terms['en-US'];
}

/**
 * Get localized animal control terms
 */
function getLocalizedAnimalControlTerms(lang) {
  const terms = {
    'en-US': ['animal control', 'animal services', 'animal regulation'],
    'en-CA': ['animal control', 'animal services', 'bylaw enforcement'],
    'es-MX': ['control animal', 'centro antirrábico', 'servicios animales', 'zoonosis'],
    'es-PR': ['control animal', 'servicios animales', 'animal control'],
    'fr-CA': ['contrôle animalier', 'services animaliers', 'fourrière municipale'],
  };
  return terms[lang] || terms['en-US'];
}

/**
 * Search specifically for veterinary clinics
 */
export async function searchVets(lat, lng, options = {}) {
  const lang = options.lang || detectLanguage(lat, lng);
  const searchTerms = getLocalizedVetTerms(lang);

  // Include English fallback
  const allTerms = lang !== 'en-US'
    ? [...searchTerms, 'veterinary', 'vet clinic']
    : searchTerms;

  const allResults = [];
  const seenIds = new Set();

  for (const term of allTerms) {
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
  const lang = options.lang || detectLanguage(lat, lng);
  const searchTerms = getLocalizedAnimalControlTerms(lang);

  // Include English fallback
  const allTerms = lang !== 'en-US'
    ? [...searchTerms, 'animal control']
    : searchTerms;

  const allResults = [];
  const seenIds = new Set();

  for (const term of allTerms) {
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
 * @param {string} address - Address to geocode
 * @param {Object} options - Options including countries to limit search
 */
export async function geocode(address, options = {}) {
  const { countries = 'US,CA,MX' } = options;

  try {
    const data = await appleMapsFetch('/geocode', {
      q: address,
      limitToCountries: countries,
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
 * Get detailed place information by ID
 * The /place/{id} endpoint may return additional details like phone/hours
 *
 * @param {string} placeId - The Apple Maps place ID
 * @returns {Promise<Object|null>} Place details or null
 */
export async function getPlaceDetails(placeId) {
  if (!placeId) return null;

  console.log('[AppleMapsServer] getPlaceDetails called with placeId:', placeId);

  try {
    // Try the /place endpoint (may not exist in Server API)
    // According to Apple docs, this might need different endpoint
    const data = await appleMapsFetch(`/place/${placeId}`, {
      lang: 'en-US',
    });

    console.log('[AppleMapsServer] Place details response received');
    console.log('[AppleMapsServer] Place details ALL KEYS:', data ? Object.keys(data) : 'null');
    console.log('[AppleMapsServer] Place details full response:', JSON.stringify(data, null, 2));

    if (!data) return null;

    return {
      placeId: data.id || placeId,
      name: data.name,
      address: formatAppleAddress(data),
      location: {
        lat: data.center?.latitude || data.coordinate?.latitude,
        lng: data.center?.longitude || data.coordinate?.longitude,
      },
      category: data.poiCategory,
      // Try all possible phone field names
      phone: data.telephone || data.phoneNumbers?.[0] || data.phoneNumber || data.phone || data.tel || null,
      url: data.url || data.urls?.[0] || data.website || data.websiteUrl || null,
      // Try all possible hours field names
      hours: data.openingHours || data.hoursOfOperation || data.hours || data.businessHours || data.operatingHours || null,
    };
  } catch (error) {
    // The /place/{id} endpoint might not exist in Apple Maps Server API
    console.log('[AppleMapsServer] Place details endpoint error:', error.message);
    console.log('[AppleMapsServer] Will try alternative approach...');
    return null;
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

/**
 * Enrich search results with detailed place information
 * Fetches phone/hours for each place (rate limited)
 *
 * @param {Array} places - Array of search results
 * @param {number} limit - Max places to enrich (default 10)
 * @returns {Promise<Array>} Enriched places
 */
export async function enrichPlacesWithDetails(places, limit = 10) {
  const enriched = [];

  for (const place of places.slice(0, limit)) {
    if (place.placeId) {
      try {
        const details = await getPlaceDetails(place.placeId);
        if (details) {
          enriched.push({
            ...place,
            phone: details.phone || place.phone,
            url: details.url || place.url,
            hours: details.hours || place.hours,
          });
        } else {
          enriched.push(place);
        }
      } catch (error) {
        enriched.push(place);
      }
    } else {
      enriched.push(place);
    }
  }

  // Add remaining places without enrichment
  enriched.push(...places.slice(limit));

  return enriched;
}

export default {
  searchPlaces,
  searchShelters,
  searchVets,
  searchAnimalControl,
  geocode,
  reverseGeocode,
  getPlaceDetails,
  enrichPlacesWithDetails,
};
