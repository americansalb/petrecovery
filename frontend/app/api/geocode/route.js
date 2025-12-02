import { NextResponse } from 'next/server';

/**
 * GET /api/geocode
 *
 * Backend proxy for OpenStreetMap Nominatim API to avoid CORS issues
 * Forward geocoding (address to coordinates):
 * - q: search query (address)
 * - limit: number of results (default 1)
 * - addressdetails: include address breakdown (default 1)
 * - countrycodes: filter by country (e.g., 'us')
 *
 * Reverse geocoding (coordinates to address):
 * - lat: latitude
 * - lon: longitude
 * - addressdetails: include address breakdown (default 1)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const limit = searchParams.get('limit') || '1';
    const addressdetails = searchParams.get('addressdetails') || '1';
    const countrycodes = searchParams.get('countrycodes') || '';

    let nominatimUrl;

    // Reverse geocoding (coordinates to address)
    if (lat && lon) {
      const params = new URLSearchParams({
        lat,
        lon,
        format: 'json',
        addressdetails,
      });
      nominatimUrl = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;
    }
    // Forward geocoding (address to coordinates)
    else if (query) {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit,
        addressdetails,
      });

      if (countrycodes) {
        params.append('countrycodes', countrycodes);
      }

      nominatimUrl = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    }
    // Invalid request
    else {
      return NextResponse.json(
        { error: 'Either query (q) or coordinates (lat, lon) required' },
        { status: 400 }
      );
    }

    console.log('[GEOCODE] Fetching:', nominatimUrl);

    // Fetch from Nominatim with proper headers
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'PetRecovery.org (contact@petrecovery.org)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('[GEOCODE] Nominatim error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Geocoding service unavailable' },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('[GEOCODE] Found results:', data.length);

    return NextResponse.json(data);

  } catch (error) {
    console.error('[GEOCODE] Error:', error);
    return NextResponse.json(
      { error: 'Geocoding failed' },
      { status: 500 }
    );
  }
}
