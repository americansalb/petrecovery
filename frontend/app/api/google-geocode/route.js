import { NextResponse } from 'next/server';

/**
 * GET /api/google-geocode
 *
 * Backend proxy for Google Maps Geocoding API
 * Used ONLY for report creation to get precise coordinates
 *
 * Forward geocoding (address to coordinates):
 * - address: search query (address string)
 *
 * Reverse geocoding (coordinates to address):
 * - latlng: comma-separated lat,lng (e.g., "41.8781,-87.6298")
 *
 * Autocomplete:
 * - input: partial address for autocomplete suggestions
 * - types: address (default) or geocode
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const latlng = searchParams.get('latlng');
    const input = searchParams.get('input');

    const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

    if (!GOOGLE_MAPS_API_KEY) {
      console.error('[GOOGLE-GEOCODE] API key not configured');
      return NextResponse.json(
        { error: 'Google Maps not configured', fallback: true },
        { status: 503 }
      );
    }

    let googleUrl;
    let isAutocomplete = false;

    // Autocomplete for address suggestions
    if (input) {
      isAutocomplete = true;
      const params = new URLSearchParams({
        input,
        types: 'address',
        components: 'country:us',
        key: GOOGLE_MAPS_API_KEY,
      });
      googleUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`;
    }
    // Reverse geocoding (coordinates to address)
    else if (latlng) {
      const params = new URLSearchParams({
        latlng,
        key: GOOGLE_MAPS_API_KEY,
      });
      googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
    }
    // Forward geocoding (address to coordinates)
    else if (address) {
      const params = new URLSearchParams({
        address,
        components: 'country:US',
        key: GOOGLE_MAPS_API_KEY,
      });
      googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;
    }
    // Invalid request
    else {
      return NextResponse.json(
        { error: 'Either address, latlng, or input required' },
        { status: 400 }
      );
    }

    console.log('[GOOGLE-GEOCODE] Fetching:', googleUrl.replace(GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN'));

    const response = await fetch(googleUrl);

    if (!response.ok) {
      console.error('[GOOGLE-GEOCODE] Google API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Google Maps API unavailable', fallback: true },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Check Google API status
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[GOOGLE-GEOCODE] Google API status:', data.status, data.error_message);

      // Return fallback signal for quota exceeded or API issues
      if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'REQUEST_DENIED') {
        return NextResponse.json(
          { error: data.error_message || 'API limit exceeded', fallback: true },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: data.error_message || 'Geocoding failed', fallback: true },
        { status: 500 }
      );
    }

    if (isAutocomplete) {
      console.log('[GOOGLE-GEOCODE] Found predictions:', data.predictions?.length || 0);
      return NextResponse.json({
        predictions: data.predictions || [],
        status: data.status,
      });
    } else {
      console.log('[GOOGLE-GEOCODE] Found results:', data.results?.length || 0);
      return NextResponse.json({
        results: data.results || [],
        status: data.status,
      });
    }

  } catch (error) {
    console.error('[GOOGLE-GEOCODE] Error:', error);
    return NextResponse.json(
      { error: 'Geocoding failed', fallback: true },
      { status: 500 }
    );
  }
}
