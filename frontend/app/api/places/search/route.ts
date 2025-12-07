/**
 * Places Search API (Google Maps Proxy)
 *
 * GET /api/places/search - Search for places (shelters, vets, etc.)
 *
 * NOTE: Using Google Maps as temporary fallback until Apple Maps API is approved.
 * See docs/Actions_Guide.md for full specification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

// =============================================================================
// CONSTANTS
// =============================================================================

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_URL = 'https://maps.googleapis.com/maps/api/place';

// Default search radius in meters
const DEFAULT_RADIUS_METERS = 40234; // ~25 miles
const MAX_RADIUS_METERS = 120701; // ~75 miles

// Place type mappings
const PLACE_TYPES: Record<string, string> = {
  shelter: 'animal_shelter',
  vet: 'veterinary_care',
  animal_control: 'local_government_office', // Best approximation
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
 * - type: Place type - shelter, vet, animal_control (default: shelter)
 * - radius: Search radius in miles (default: 25, max: 75)
 * - query: Optional text query to filter results
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!GOOGLE_PLACES_API_KEY) {
      return NextResponse.json(
        { error: 'Places API not configured' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const type = searchParams.get('type') || 'shelter';
    const radiusMiles = parseFloat(searchParams.get('radius') || '25');
    const query = searchParams.get('query');

    // Validate required params
    if (!lat || !lng) {
      return NextResponse.json(
        { error: 'Missing required params: lat, lng' },
        { status: 400 }
      );
    }

    // Convert radius to meters and cap
    const radiusMeters = Math.min(
      Math.round(radiusMiles * 1609.34),
      MAX_RADIUS_METERS
    );

    // Get place type
    const placeType = PLACE_TYPES[type] || PLACE_TYPES.shelter;

    // Build search URL
    let url: string;
    if (query) {
      // Text search for custom queries
      url = `${GOOGLE_PLACES_URL}/textsearch/json?` +
        `query=${encodeURIComponent(query)}` +
        `&location=${lat},${lng}` +
        `&radius=${radiusMeters}` +
        `&key=${GOOGLE_PLACES_API_KEY}`;
    } else {
      // Nearby search for type-based queries
      url = `${GOOGLE_PLACES_URL}/nearbysearch/json?` +
        `location=${lat},${lng}` +
        `&radius=${radiusMeters}` +
        `&type=${placeType}` +
        `&key=${GOOGLE_PLACES_API_KEY}`;
    }

    // Make request to Google Places API
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('Google Places API error:', data.status, data.error_message);
      return NextResponse.json(
        { error: 'Places search failed', details: data.error_message },
        { status: 502 }
      );
    }

    // Transform results
    const places = (data.results || []).map((place: any) => ({
      placeId: place.place_id,
      name: place.name,
      address: place.formatted_address || place.vicinity,
      location: {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
      },
      types: place.types,
      businessStatus: place.business_status,
      rating: place.rating,
      userRatingsTotal: place.user_ratings_total,
      openNow: place.opening_hours?.open_now,
    }));

    return NextResponse.json({
      places,
      total: places.length,
      nextPageToken: data.next_page_token,
    });
  } catch (error) {
    console.error('Places search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/places/search/details
 *
 * Get detailed info for a specific place
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!GOOGLE_PLACES_API_KEY) {
      return NextResponse.json(
        { error: 'Places API not configured' },
        { status: 503 }
      );
    }

    const { placeId } = await request.json();

    if (!placeId) {
      return NextResponse.json(
        { error: 'Missing placeId' },
        { status: 400 }
      );
    }

    // Get place details
    const url = `${GOOGLE_PLACES_URL}/details/json?` +
      `place_id=${placeId}` +
      `&fields=name,formatted_address,formatted_phone_number,website,email,geometry,opening_hours,business_status` +
      `&key=${GOOGLE_PLACES_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Places details error:', data.status, data.error_message);
      return NextResponse.json(
        { error: 'Place details fetch failed' },
        { status: 502 }
      );
    }

    const place = data.result;

    return NextResponse.json({
      placeId,
      name: place.name,
      address: place.formatted_address,
      phone: place.formatted_phone_number,
      website: place.website,
      email: place.email, // Note: Google rarely provides email
      location: {
        lat: place.geometry?.location?.lat,
        lng: place.geometry?.location?.lng,
      },
      businessStatus: place.business_status,
      openingHours: place.opening_hours?.weekday_text,
      openNow: place.opening_hours?.open_now,
    });
  } catch (error) {
    console.error('Place details error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
