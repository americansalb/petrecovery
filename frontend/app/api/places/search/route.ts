/**
 * Places Search API (Apple Maps)
 *
 * GET /api/places/search - Search for places (shelters, vets, etc.)
 *
 * Powered by Apple Maps Server API (25K free calls/day)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  searchShelters,
  searchVets,
  searchAnimalControl,
  searchPlaces,
} from '@/app/lib/maps/appleMapServer';

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
 * - type: Place type - shelter, vet, animal_control (default: shelter)
 * - radius: Search radius in miles (default: 25, max: 75) - Note: Apple Maps uses proximity ranking
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

    if (isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: 'Invalid lat/lng values' },
        { status: 400 }
      );
    }

    let places: any[];

    // Search based on type or custom query
    if (query) {
      // Custom query search
      places = await searchPlaces(query, latitude, longitude, { limit: 25 });
    } else {
      // Type-based search
      switch (type) {
        case 'shelter':
          places = await searchShelters(latitude, longitude, { limit: 25 });
          break;
        case 'vet':
          places = await searchVets(latitude, longitude, { limit: 25 });
          break;
        case 'animal_control':
          places = await searchAnimalControl(latitude, longitude, { limit: 25 });
          break;
        default:
          places = await searchShelters(latitude, longitude, { limit: 25 });
      }
    }

    return NextResponse.json({
      places,
      total: places.length,
      source: 'apple_maps',
    });
  } catch (error) {
    console.error('Places search error:', error);

    // Return empty results instead of error for better UX
    return NextResponse.json({
      places: [],
      total: 0,
      error: 'Search temporarily unavailable',
      source: 'apple_maps',
    });
  }
}

/**
 * POST /api/places/search
 *
 * Get detailed info for a specific place
 * Returns the place data with an Apple Maps link
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

    // Generate Apple Maps URL for directions/details
    const lat = location?.lat;
    const lng = location?.lng;
    const mapsUrl = lat && lng
      ? `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name || 'Location')}`
      : `https://maps.apple.com/?q=${encodeURIComponent(address || name || 'Location')}`;

    return NextResponse.json({
      placeId,
      name,
      address,
      location,
      mapsUrl,
      source: 'apple_maps',
    });
  } catch (error) {
    console.error('Place details error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
