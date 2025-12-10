/**
 * Places Search API
 *
 * GET /api/places/search - Search for places (shelters, vets, etc.)
 *
 * Primary: Apple Maps Server API (25K free calls/day)
 * Fallback: OpenStreetMap Overpass API (free, no key required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  searchShelters as searchSheltersOverpass,
  searchVets as searchVetsOverpass,
  searchAnimalControl as searchAnimalControlOverpass,
  searchPetStores as searchPetStoresOverpass,
  searchPlaces as searchPlacesOverpass,
} from '@/app/lib/maps/overpassSearch';
import {
  searchShelters as searchSheltersApple,
  searchVets as searchVetsApple,
  searchAnimalControl as searchAnimalControlApple,
} from '@/app/lib/maps/appleMapServer';

// Check if Apple Maps is configured
const isAppleMapsConfigured = () => {
  const teamId = process.env.APPLE_MAPKIT_TEAM_ID;
  const keyId = process.env.APPLE_MAPKIT_KEY_ID;
  const privateKey = process.env.APPLE_MAPKIT_PRIVATE_KEY;

  const configured = !!(teamId && keyId && privateKey);

  // Debug logging to help troubleshoot
  console.log(`[Places API] Apple Maps config check: TEAM_ID=${teamId ? 'SET' : 'MISSING'}, KEY_ID=${keyId ? 'SET' : 'MISSING'}, PRIVATE_KEY=${privateKey ? 'SET' : 'MISSING'}`);

  return configured;
};

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * GET /api/places/search
 *
 * Search for places near a location
 *
 * Query params:
 * - lat: Latitude (required)
 * - lng: Longitude (required)
 * - type: Place type - shelter, vet, animal_control, pet_store (default: shelter)
 * - radius: Search radius in miles (default: 25, max: 75)
 * - query: Optional text query to filter results
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const type = searchParams.get('type') || 'shelter';
    const query = searchParams.get('query');

    // Validate required params
    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Missing required params: lat, lng' },
        { status: 400 }
      );
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusMiles = Math.min(parseFloat(searchParams.get('radius') || '25'), 75);

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: 'Invalid lat/lng values' },
        { status: 400 }
      );
    }

    // Convert miles to meters for Overpass API
    const radiusMeters = radiusMiles * 1609.34;
    const options = { radiusMeters };

    let places: any[];
    let source = 'openstreetmap';

    console.log(`[Places API] Searching for ${type} near ${latitude},${longitude} within ${radiusMiles} miles`);

    // Try Apple Maps first if configured (better coverage for animal shelters)
    const useAppleMaps = isAppleMapsConfigured() && !query;

    if (useAppleMaps) {
      try {
        console.log('[Places API] Using Apple Maps Server API');
        source = 'apple';

        switch (type) {
          case 'shelter':
            places = await searchSheltersApple(latitude, longitude, { limit: 25 });
            break;
          case 'vet':
            places = await searchVetsApple(latitude, longitude, { limit: 25 });
            break;
          case 'animal_control':
            places = await searchAnimalControlApple(latitude, longitude, { limit: 25 });
            break;
          default:
            places = await searchSheltersApple(latitude, longitude, { limit: 25 });
        }

        console.log(`[Places API] Apple Maps found ${places.length} results`);
      } catch (appleError: any) {
        console.error('[Places API] Apple Maps failed, falling back to Overpass:', appleError.message);
        source = 'openstreetmap';
        places = [];
      }
    } else {
      places = [];
    }

    // Fall back to Overpass API if Apple Maps not configured or returned no results
    if (places.length === 0) {
      console.log('[Places API] Using OpenStreetMap Overpass API');
      source = 'openstreetmap';

      if (query) {
        // Custom query search
        places = await searchPlacesOverpass(query, latitude, longitude, options);
      } else {
        // Type-based search
        switch (type) {
          case 'shelter':
            places = await searchSheltersOverpass(latitude, longitude, options);
            break;
          case 'vet':
            places = await searchVetsOverpass(latitude, longitude, options);
            break;
          case 'animal_control':
            places = await searchAnimalControlOverpass(latitude, longitude, options);
            break;
          case 'pet_store':
            places = await searchPetStoresOverpass(latitude, longitude, options);
            break;
          default:
            places = await searchSheltersOverpass(latitude, longitude, options);
        }
      }
    }

    console.log(`[Places API] Found ${places.length} results from ${source}`);

    // Add distance in miles to each result
    places = places.map(p => ({
      ...p,
      distanceMiles: p.distance ? Math.round(p.distance / 1609.34 * 10) / 10 : null,
    }));

    return NextResponse.json({
      places: places.slice(0, 25), // Limit to 25 results
      total: places.length,
      radiusMiles,
      source,
    });
  } catch (error: any) {
    console.error('Places search error:', error);

    return NextResponse.json({
      places: [],
      total: 0,
      error: 'Search temporarily unavailable. Please try again.',
      source: 'openstreetmap',
    });
  }
}

/**
 * POST /api/places/search
 *
 * Get detailed info for a specific place
 * Returns the place data with a maps link
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { placeId, name, address, location } = await request.json();

    if (!placeId) {
      return NextResponse.json(
        { error: 'Missing placeId' },
        { status: 400 }
      );
    }

    // Generate Google Maps URL for directions/details (more universal)
    const lat = location?.lat;
    const lng = location?.lng;
    const mapsUrl = lat && lng
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || name || 'Location')}`;

    return NextResponse.json({
      placeId,
      name,
      address,
      location,
      mapsUrl,
      source: 'openstreetmap',
    });
  } catch (error) {
    console.error('Place details error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
