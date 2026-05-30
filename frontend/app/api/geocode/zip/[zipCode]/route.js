import { NextResponse } from 'next/server';
import { geocodeZipCode } from '@/app/lib/geocoding';

// GET /api/geocode/zip/:zipCode - Look up city name from ZIP code
export async function GET(request, { params }) {
  const { zipCode } = params;

  try {
    const result = await geocodeZipCode(zipCode);

    if (result.error) {
      // A genuine "not found" is a 404; anything else (the external geocoder
      // being unreachable/erroring) is a retryable 503, not a 404.
      const notFound = /not found/i.test(result.error);
      return NextResponse.json(
        { error: notFound ? 'ZIP code not found' : 'Geocoding temporarily unavailable' },
        { status: notFound ? 404 : 503 }
      );
    }

    return NextResponse.json(result);

  } catch (error) {
    // Don't leak the raw error; the geocoder being down is a degradation (503).
    console.error('Geocoding error:', error?.message);
    return NextResponse.json(
      { error: 'Geocoding temporarily unavailable' },
      { status: 503 }
    );
  }
}
