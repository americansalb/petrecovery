/**
 * Apple MapKit Places API Integration
 *
 * Primary source for shelter discovery (250K free calls/day)
 * https://developer.apple.com/documentation/mapkitjs/mapkit/places
 */

import jwt from 'jsonwebtoken';
import prisma from '@/app/lib/prisma';

// Apple MapKit configuration
const APPLE_TEAM_ID = process.env.APPLE_MAPKIT_TEAM_ID;
const APPLE_KEY_ID = process.env.APPLE_MAPKIT_KEY_ID;
const APPLE_PRIVATE_KEY = process.env.APPLE_MAPKIT_PRIVATE_KEY; // Base64 encoded

// MapKit API endpoints
const MAPKIT_BASE_URL = 'https://maps-api.apple.com/v1';

// Token cache
let mapKitToken = null;
let mapKitTokenExpiry = null;

/**
 * Generate MapKit JWT token
 */
function generateMapKitToken() {
  if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) {
    throw new Error('Apple MapKit credentials not configured');
  }

  // Decode the base64 private key
  const privateKey = Buffer.from(APPLE_PRIVATE_KEY, 'base64').toString('utf-8');

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  const payload = {
    iss: APPLE_TEAM_ID,
    iat: now,
    exp: expiry,
  };

  const token = jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    header: {
      alg: 'ES256',
      kid: APPLE_KEY_ID,
      typ: 'JWT',
    },
  });

  return { token, expiry: expiry * 1000 };
}

/**
 * Get valid MapKit token (cached)
 */
function getMapKitToken() {
  if (mapKitToken && mapKitTokenExpiry && Date.now() < mapKitTokenExpiry - 60000) {
    return mapKitToken;
  }

  const { token, expiry } = generateMapKitToken();
  mapKitToken = token;
  mapKitTokenExpiry = expiry;
  return token;
}

/**
 * Search for places using Apple MapKit
 */
async function searchPlaces(query, options = {}) {
  const token = getMapKitToken();

  const params = new URLSearchParams({
    q: query,
    lang: options.lang || 'en-US',
  });

  // Add location bias if provided
  if (options.latitude && options.longitude) {
    params.set('searchLocation', `${options.latitude},${options.longitude}`);
  }

  // Add region if provided (city-level search)
  if (options.region) {
    params.set('searchRegion', options.region);
  }

  // Limit results
  if (options.limit) {
    params.set('resultTypeFilter', 'Poi'); // Points of Interest only
  }

  const response = await fetch(`${MAPKIT_BASE_URL}/search?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MapKit search failed: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Geocode a location to get coordinates
 */
async function geocode(address) {
  const token = getMapKitToken();

  const params = new URLSearchParams({
    q: address,
    lang: 'en-US',
  });

  const response = await fetch(`${MAPKIT_BASE_URL}/geocode?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`MapKit geocode failed: ${response.status}`);
  }

  const data = await response.json();
  return data.results?.[0];
}

/**
 * Search for animal shelters in a city
 */
export async function searchSheltersInCity(city, state) {
  const searchQueries = [
    'animal shelter',
    'animal control',
    'humane society',
    'SPCA',
    'animal rescue',
    'pet shelter',
    'dog pound',
  ];

  const allResults = [];
  const seenPlaceIds = new Set();

  // Get city coordinates for better results
  const cityLocation = await geocode(`${city}, ${state}`);
  const searchRegion = cityLocation ?
    `${cityLocation.coordinate.latitude},${cityLocation.coordinate.longitude},0.5,0.5` :
    null;

  for (const query of searchQueries) {
    try {
      const fullQuery = `${query} ${city} ${state}`;
      const results = await searchPlaces(fullQuery, {
        region: searchRegion,
        latitude: cityLocation?.coordinate?.latitude,
        longitude: cityLocation?.coordinate?.longitude,
      });

      if (results.results) {
        for (const place of results.results) {
          // Deduplicate by place ID
          if (place.id && !seenPlaceIds.has(place.id)) {
            seenPlaceIds.add(place.id);
            allResults.push(normalizeApplePlace(place));
          }
        }
      }

      // Rate limit: wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error searching for "${query}":`, error.message);
    }
  }

  return allResults;
}

/**
 * Search shelters within radius of coordinates
 */
export async function searchSheltersNearLocation(latitude, longitude, radiusMiles = 25) {
  const searchQueries = [
    'animal shelter',
    'animal control',
    'humane society',
  ];

  const allResults = [];
  const seenPlaceIds = new Set();

  // Convert miles to degrees (rough approximation)
  const radiusDegrees = radiusMiles / 69;
  const searchRegion = `${latitude},${longitude},${radiusDegrees},${radiusDegrees}`;

  for (const query of searchQueries) {
    try {
      const results = await searchPlaces(query, {
        region: searchRegion,
        latitude,
        longitude,
      });

      if (results.results) {
        for (const place of results.results) {
          if (place.id && !seenPlaceIds.has(place.id)) {
            seenPlaceIds.add(place.id);

            // Calculate distance from search center
            const distance = calculateDistance(
              latitude, longitude,
              place.coordinate?.latitude,
              place.coordinate?.longitude
            );

            if (distance <= radiusMiles) {
              allResults.push({
                ...normalizeApplePlace(place),
                distance,
              });
            }
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error searching for "${query}":`, error.message);
    }
  }

  // Sort by distance
  return allResults.sort((a, b) => (a.distance || 0) - (b.distance || 0));
}

/**
 * Normalize Apple MapKit place data
 */
function normalizeApplePlace(place) {
  return {
    appleMapKitId: place.id,
    name: place.name,
    phone: place.telephone,
    website: place.urls?.[0],

    // Address components
    address: [
      place.structuredAddress?.thoroughfare,
      place.structuredAddress?.subThoroughfare,
    ].filter(Boolean).join(' ') || place.formattedAddressLines?.[0],
    city: place.structuredAddress?.locality || '',
    state: place.structuredAddress?.administrativeArea || '',
    zipCode: place.structuredAddress?.postCode || '',

    // Coordinates
    latitude: place.coordinate?.latitude,
    longitude: place.coordinate?.longitude,

    // Additional data
    categories: place.categories || [],
    formattedAddress: place.formattedAddressLines?.join(', '),

    // Source tracking
    source: 'APPLE_MAPKIT',
    fetchedAt: new Date(),
  };
}

/**
 * Save shelters to database
 */
export async function saveSheltersToDatabase(shelters) {
  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const shelter of shelters) {
    try {
      // Skip if missing required fields
      if (!shelter.name || !shelter.city || !shelter.state) {
        results.skipped++;
        continue;
      }

      // Check if shelter already exists by Apple ID or name+city
      const existing = await prisma.shelter.findFirst({
        where: {
          OR: [
            { appleMapKitId: shelter.appleMapKitId },
            {
              AND: [
                { name: shelter.name },
                { city: shelter.city },
                { state: shelter.state },
              ],
            },
          ],
        },
      });

      if (existing) {
        // Update existing shelter
        await prisma.shelter.update({
          where: { id: existing.id },
          data: {
            appleMapKitId: shelter.appleMapKitId,
            phone: shelter.phone || existing.phone,
            website: shelter.website || existing.website,
            latitude: shelter.latitude ?? existing.latitude,
            longitude: shelter.longitude ?? existing.longitude,
            fetchedAt: shelter.fetchedAt,
            updatedAt: new Date(),
          },
        });
        results.updated++;
      } else {
        // Create new shelter
        await prisma.shelter.create({
          data: {
            appleMapKitId: shelter.appleMapKitId,
            name: shelter.name,
            phone: shelter.phone,
            website: shelter.website,
            address: shelter.address || '',
            city: shelter.city,
            state: shelter.state,
            zipCode: shelter.zipCode || '',
            latitude: shelter.latitude,
            longitude: shelter.longitude,
            type: determineShelterType(shelter.name, shelter.categories),
            source: 'APPLE_MAPKIT',
            fetchedAt: shelter.fetchedAt,
            isActive: true,
          },
        });
        results.created++;
      }
    } catch (error) {
      console.error(`Error saving shelter "${shelter.name}":`, error.message);
      results.errors.push({ name: shelter.name, error: error.message });
    }
  }

  return results;
}

/**
 * Determine shelter type from name and categories
 */
function determineShelterType(name, categories = []) {
  const nameLower = name.toLowerCase();

  if (nameLower.includes('animal control') || nameLower.includes('city of') || nameLower.includes('county')) {
    return 'ANIMAL_CONTROL';
  }
  if (nameLower.includes('humane society') || nameLower.includes('spca')) {
    return 'SHELTER';
  }
  if (nameLower.includes('rescue')) {
    return 'RESCUE';
  }
  if (nameLower.includes('vet') || nameLower.includes('veterinary') || nameLower.includes('animal hospital')) {
    return 'VET';
  }

  return 'SHELTER';
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;

  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Check if Apple MapKit is configured
 */
export function isConfigured() {
  return !!(APPLE_TEAM_ID && APPLE_KEY_ID && APPLE_PRIVATE_KEY);
}

export default {
  searchSheltersInCity,
  searchSheltersNearLocation,
  saveSheltersToDatabase,
  geocode,
  isConfigured,
};
