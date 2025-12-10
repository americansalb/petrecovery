/**
 * Places Search API (OpenStreetMap Overpass)
 *
 * GET /api/places/search - Search for places (shelters, vets, etc.)
 *
 * Powered by Overpass API - completely free, no API key required
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  searchShelters,
  searchVets,
  searchAnimalControl,
  searchPetStores,
  searchPlaces,
} from '@/app/lib/maps/overpassSearch';

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

    console.log(`[Places API] Searching for ${type} near ${latitude},${longitude} within ${radiusMiles} miles`);

    // Search based on type or custom query
    if (query) {
      // Custom query search
      places = await searchPlaces(query, latitude, longitude, options);
    } else {
      // Type-based search
      switch (type) {
        case 'shelter':
          places = await searchShelters(latitude, longitude, options);
          break;
        case 'vet':
          places = await searchVets(latitude, longitude, options);
          break;
        case 'animal_control':
          places = await searchAnimalControl(latitude, longitude, options);
          break;
        case 'pet_store':
          places = await searchPetStores(latitude, longitude, options);
          break;
        default:
          places = await searchShelters(latitude, longitude, options);
      }
    }

    console.log(`[Places API] Found ${places.length} results`);

    // Add distance in miles to each result
    places = places.map(p => ({
      ...p,
      distanceMiles: p.distance ? Math.round(p.distance / 1609.34 * 10) / 10 : null,
    }));

    return NextResponse.json({
      places: places.slice(0, 25), // Limit to 25 results
      total: places.length,
      radiusMiles,
      source: 'openstreetmap',
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
