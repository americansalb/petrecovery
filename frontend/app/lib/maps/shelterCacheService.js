/**
 * Shelter Cache Service
 *
 * Manages city-level caching of shelter data.
 * - Checks cache freshness (60-day expiry)
 * - Fetches from Apple Maps API for stale cities
 * - Stores results in database
 * - Returns combined results sorted by distance
 */

import { PrismaClient } from '@prisma/client';
import {
  fetchCityBoundary,
  reverseGeocodeCity,
  haversineDistance,
  findCitiesInRadius,
} from './cityBoundaryService';
import {
  searchShelters as searchSheltersApple,
  searchVets as searchVetsApple,
  searchAnimalControl as searchAnimalControlApple,
  enrichPlacesWithDetails,
} from './appleMapServer';

// Cache expiry: 60 days in milliseconds
const CACHE_EXPIRY_MS = 60 * 24 * 60 * 60 * 1000;

// Get Prisma client (singleton pattern for serverless)
let prisma;

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

/**
 * Search for shelters with city-level caching
 *
 * @param {number} lat - Search center latitude
 * @param {number} lng - Search center longitude
 * @param {Object} options - Search options
 * @returns {Object} Search results with shelters and metadata
 */
export async function searchSheltersWithCache(lat, lng, options = {}) {
  const {
    radiusMeters = 40000, // 25 miles default
    type = 'shelter',
    forceRefresh = false,
  } = options;

  const db = getPrisma();
  const now = new Date();
  const expiryDate = new Date(now.getTime() - CACHE_EXPIRY_MS);

  console.log('[ShelterCache] Search request:', { lat, lng, radiusMeters, type });

  try {
    // Step 1: Get the city for the search center
    const centerCity = await reverseGeocodeCity(lat, lng);
    console.log('[ShelterCache] Center city:', centerCity?.city, centerCity?.state);

    // Step 2: Get all cached cities in the database
    const allCityCaches = await db.cityCache.findMany({
      where: {
        country: 'US',
      },
      select: {
        id: true,
        city: true,
        state: true,
        centerLat: true,
        centerLng: true,
        boundary: true,
        lastFetchedAt: true,
        shelterCount: true,
      },
    });

    // Step 3: Find which cities intersect with our search radius
    const citiesInRadius = findCitiesInRadius(allCityCaches, lat, lng, radiusMeters);
    console.log('[ShelterCache] Cities in radius:', citiesInRadius.length);

    // Step 4: Determine which cities need fresh data
    const staleCities = citiesInRadius.filter(cache => {
      if (forceRefresh) return true;
      if (!cache.lastFetchedAt) return true;
      return new Date(cache.lastFetchedAt) < expiryDate;
    });

    console.log('[ShelterCache] Stale cities needing refresh:', staleCities.length);

    // Step 5: If center city isn't in our cache, add it
    let centerCityCache = null;
    if (centerCity?.city && centerCity?.state) {
      centerCityCache = citiesInRadius.find(
        c => c.city.toLowerCase() === centerCity.city.toLowerCase() &&
             c.state.toLowerCase() === (centerCity.stateAbbr || centerCity.state).toLowerCase()
      );

      if (!centerCityCache) {
        // Need to fetch and create cache for center city
        console.log('[ShelterCache] Center city not in cache, will fetch');
        const cityData = await fetchAndCacheCity(centerCity.city, centerCity.stateAbbr || centerCity.state, lat, lng, type, db);
        if (cityData) {
          citiesInRadius.push(cityData);
        }
      } else if (!centerCityCache.lastFetchedAt || new Date(centerCityCache.lastFetchedAt) < expiryDate) {
        // Center city is stale, refresh it
        if (!staleCities.find(c => c.id === centerCityCache.id)) {
          staleCities.push(centerCityCache);
        }
      }
    }

    // Step 6: Refresh all stale cities
    for (const staleCity of staleCities) {
      try {
        await refreshCityCache(staleCity, type, db);
      } catch (error) {
        console.error('[ShelterCache] Failed to refresh city:', staleCity.city, error.message);
      }
    }

    // Step 7: Get all shelters from database within radius
    const shelters = await getSheltersInRadius(lat, lng, radiusMeters, type, db);

    console.log('[ShelterCache] Found', shelters.length, 'shelters in database');

    // Step 8: Calculate distance and sort
    const results = shelters.map(shelter => ({
      ...shelter,
      distance: shelter.latitude && shelter.longitude
        ? haversineDistance(lat, lng, shelter.latitude, shelter.longitude)
        : null,
    })).sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));

    return {
      places: results.slice(0, 25),
      total: results.length,
      source: 'database',
      citiesSearched: citiesInRadius.length,
      citiesRefreshed: staleCities.length,
      cacheHit: staleCities.length === 0,
    };
  } catch (error) {
    console.error('[ShelterCache] Search error:', error);
    throw error;
  }
}

/**
 * Fetch shelter data for a city and create cache entry
 */
async function fetchAndCacheCity(city, state, searchLat, searchLng, type, db) {
  console.log('[ShelterCache] Fetching and caching city:', city, state);

  try {
    // Get city boundary from Nominatim
    const boundaryData = await fetchCityBoundary(city, state, 'US');

    // Use search coordinates if we couldn't get city center
    const centerLat = boundaryData?.centerLat || searchLat;
    const centerLng = boundaryData?.centerLng || searchLng;

    // Create or update city cache
    const cityCache = await db.cityCache.upsert({
      where: {
        city_state_country: {
          city: city,
          state: state,
          country: 'US',
        },
      },
      create: {
        city: city,
        state: state,
        country: 'US',
        centerLat: centerLat,
        centerLng: centerLng,
        boundary: boundaryData?.boundary || null,
      },
      update: {
        centerLat: centerLat,
        centerLng: centerLng,
        boundary: boundaryData?.boundary || null,
      },
    });

    // Fetch shelters from Apple Maps
    await fetchAndStoreShelters(cityCache, centerLat, centerLng, type, db);

    return cityCache;
  } catch (error) {
    console.error('[ShelterCache] Failed to fetch/cache city:', city, state, error.message);
    return null;
  }
}

/**
 * Refresh an existing city cache
 */
async function refreshCityCache(cityCache, type, db) {
  console.log('[ShelterCache] Refreshing city cache:', cityCache.city, cityCache.state);

  const centerLat = cityCache.centerLat;
  const centerLng = cityCache.centerLng;

  if (!centerLat || !centerLng) {
    console.warn('[ShelterCache] No coordinates for city, skipping refresh');
    return;
  }

  await fetchAndStoreShelters(cityCache, centerLat, centerLng, type, db);
}

/**
 * Fetch shelters from Apple Maps and store in database
 */
async function fetchAndStoreShelters(cityCache, lat, lng, type, db) {
  const now = new Date();

  try {
    let results = [];

    // Fetch from Apple Maps based on type
    switch (type) {
      case 'vet':
        results = await searchVetsApple(lat, lng, { limit: 50 });
        break;
      case 'animal_control':
        results = await searchAnimalControlApple(lat, lng, { limit: 50 });
        break;
      case 'shelter':
      default:
        results = await searchSheltersApple(lat, lng, { limit: 50 });
    }

    console.log('[ShelterCache] Apple Maps returned', results.length, 'results for', cityCache.city);

    // Enrich top results with phone/hours from Place Details API
    // Only enrich first 15 to avoid too many API calls
    if (results.length > 0) {
      try {
        console.log('[ShelterCache] Enriching places with phone/hours details...');
        results = await enrichPlacesWithDetails(results, 15);
        console.log('[ShelterCache] Enrichment complete');
      } catch (enrichError) {
        console.warn('[ShelterCache] Enrichment failed, continuing with basic data:', enrichError.message);
      }
    }

    // Store each shelter in database
    let storedCount = 0;
    for (const place of results) {
      try {
        await db.shelter.upsert({
          where: {
            appleMapKitId: place.placeId || `apple-${Date.now()}-${Math.random()}`,
          },
          create: {
            appleMapKitId: place.placeId,
            name: place.name,
            type: mapTypeToShelterType(type),
            address: place.address || '',
            city: cityCache.city,
            state: cityCache.state,
            zipCode: extractZipCode(place.address) || '',
            latitude: place.location?.lat,
            longitude: place.location?.lng,
            phone: place.phone || null,
            website: place.url || null,
            hours: place.hours ? JSON.stringify(place.hours) : null,
            source: 'APPLE_MAPKIT',
            fetchedAt: now,
            cityCacheId: cityCache.id,
          },
          update: {
            name: place.name,
            address: place.address || '',
            latitude: place.location?.lat,
            longitude: place.location?.lng,
            phone: place.phone || null,
            website: place.url || null,
            hours: place.hours ? JSON.stringify(place.hours) : null,
            fetchedAt: now,
            cityCacheId: cityCache.id,
            isActive: true, // Re-activate if previously soft-deleted
          },
        });
        storedCount++;
      } catch (shelterError) {
        // Skip duplicate or invalid entries
        console.warn('[ShelterCache] Failed to store shelter:', place.name, shelterError.message);
      }
    }

    // Update city cache metadata
    await db.cityCache.update({
      where: { id: cityCache.id },
      data: {
        lastFetchedAt: now,
        shelterCount: storedCount,
        fetchSource: 'APPLE_MAPKIT',
      },
    });

    console.log('[ShelterCache] Stored', storedCount, 'shelters for', cityCache.city);
  } catch (error) {
    console.error('[ShelterCache] Failed to fetch/store shelters:', error.message);
    throw error;
  }
}

/**
 * Get shelters from database within a radius
 */
async function getSheltersInRadius(lat, lng, radiusMeters, type, db) {
  // Calculate bounding box for initial filter (faster than full distance calc)
  const latDelta = radiusMeters / 111320; // approx meters per degree latitude
  const lngDelta = radiusMeters / (111320 * Math.cos(lat * Math.PI / 180));

  const shelterType = mapTypeToShelterType(type);

  const shelters = await db.shelter.findMany({
    where: {
      isActive: true,
      type: shelterType,
      latitude: {
        gte: lat - latDelta,
        lte: lat + latDelta,
      },
      longitude: {
        gte: lng - lngDelta,
        lte: lng + lngDelta,
      },
    },
    select: {
      id: true,
      name: true,
      type: true,
      address: true,
      city: true,
      state: true,
      zipCode: true,
      latitude: true,
      longitude: true,
      phone: true,
      email: true,
      website: true,
      hours: true,
      source: true,
      fetchedAt: true,
      appleMapKitId: true, // Include for PlaceDetail button
    },
    orderBy: {
      name: 'asc',
    },
  });

  // Filter by actual distance (bounding box is just an optimization)
  return shelters.filter(shelter => {
    if (!shelter.latitude || !shelter.longitude) return false;
    const distance = haversineDistance(lat, lng, shelter.latitude, shelter.longitude);
    return distance <= radiusMeters;
  });
}

/**
 * Map search type to Shelter model type
 */
function mapTypeToShelterType(searchType) {
  switch (searchType) {
    case 'vet':
      return 'VET';
    case 'animal_control':
      return 'ANIMAL_CONTROL';
    case 'shelter':
    default:
      return 'SHELTER';
  }
}

/**
 * Extract zip code from address string
 */
function extractZipCode(address) {
  if (!address) return null;
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

/**
 * Force refresh all cities in a state (admin function)
 */
export async function refreshStateCache(state, type = 'shelter') {
  const db = getPrisma();

  const cities = await db.cityCache.findMany({
    where: { state: state },
  });

  console.log('[ShelterCache] Refreshing', cities.length, 'cities in', state);

  for (const city of cities) {
    try {
      await refreshCityCache(city, type, db);
      // Rate limit: wait 2 seconds between cities
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('[ShelterCache] Failed to refresh:', city.city, error.message);
    }
  }
}

export default {
  searchSheltersWithCache,
  refreshStateCache,
};
