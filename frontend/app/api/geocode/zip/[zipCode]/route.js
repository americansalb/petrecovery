import { NextResponse } from 'next/server';

// GET /api/geocode/zip/:zipCode - Look up city name from ZIP code
export async function GET(request, { params }) {
  const { zipCode } = params;

  try {
    // Use Nominatim (OpenStreetMap) for free geocoding
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${zipCode}&country=US&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'PetRecovery.org'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding failed');
    }

    const data = await response.json();

    if (data.length === 0) {
      return NextResponse.json(
        { error: 'ZIP code not found' },
        { status: 404 }
      );
    }

    const location = data[0];

    // Extract city name from address
    const addressParts = location.display_name.split(',');
    const cityName = addressParts[0].trim();

    return NextResponse.json({
      zipCode,
      cityName,
      latitude: parseFloat(location.lat),
      longitude: parseFloat(location.lon),
      fullAddress: location.display_name
    });

  } catch (error) {
    console.error('Geocoding error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup ZIP code' },
      { status: 500 }
    );
  }
}
