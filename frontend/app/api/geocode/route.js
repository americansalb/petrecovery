import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

/**
 * GET /api/geocode
 *
 * Backend proxy for OpenStreetMap Nominatim API to avoid CORS issues
 * Forward geocoding (address to coordinates):
 * - q: search query (address)
 * - limit: number of results (default 1)
 * - addressdetails: include address breakdown (default 1)
 * - countrycodes: filter by country (e.g., 'us')
 * - format: json (default) or geojson
 * - polygon_geojson: 1 to include polygon boundaries (for format=geojson)
 *
 * Reverse geocoding (coordinates to address):
 * - lat: latitude
 * - lon: longitude
 * - addressdetails: include address breakdown (default 1)
 */
export async function GET(request) {
  try {
    // Require authentication to prevent abuse as open proxy
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    const limit = searchParams.get('limit') || '1';
    const addressdetails = searchParams.get('addressdetails') || '1';
    const countrycodes = searchParams.get('countrycodes') || '';
    const format = searchParams.get('format') || 'json';
    const polygon_geojson = searchParams.get('polygon_geojson') || '';

    let nominatimUrl;

    // Reverse geocoding (coordinates to address)
    if (lat && lon) {
      const params = new URLSearchParams({
        lat,
        lon,
        format,
        addressdetails,
      });
      nominatimUrl = `https://nominatim.openstreetmap.org/reverse?${params.toString()}`;
    }
    // Forward geocoding (address to coordinates)
    else if (query) {
      const params = new URLSearchParams({
        q: query,
        format,
        limit,
        addressdetails,
      });

      if (countrycodes) {
        params.append('countrycodes', countrycodes);
      }

      if (polygon_geojson) {
        params.append('polygon_geojson', polygon_geojson);
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

    // Log results differently for geojson vs json
    if (format === 'geojson') {
      console.log('[GEOCODE] Found GeoJSON features:', data.features?.length || 0);
    } else {
      console.log('[GEOCODE] Found results:', Array.isArray(data) ? data.length : 1);
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('[GEOCODE] Error:', error);
    return NextResponse.json(
      { error: 'Geocoding failed' },
      { status: 500 }
    );
  }
}
