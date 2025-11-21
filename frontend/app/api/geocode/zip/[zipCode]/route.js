import { NextResponse } from 'next/server';
import { geocodeZipCode } from '@/app/lib/geocoding';

// GET /api/geocode/zip/:zipCode - Look up city name from ZIP code
export async function GET(request, { params }) {
  const { zipCode } = params;

  try {
    const result = await geocodeZipCode(zipCode);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 404 }
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Geocoding error:', error);
    return NextResponse.json(
      { error: 'Failed to lookup ZIP code' },
      { status: 500 }
    );
  }
}
