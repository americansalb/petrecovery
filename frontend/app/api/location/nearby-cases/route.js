import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { findNearbyCases } from '@/app/lib/geofence';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat'));
    const lng = parseFloat(searchParams.get('lng'));
    const radius = parseFloat(searchParams.get('radius')) || 5;

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: 'Valid lat/lng required' }, { status: 400 });
    }

    const cases = await findNearbyCases(lat, lng, radius);

    return NextResponse.json({ cases });
  } catch (error) {
    console.error('Nearby cases error:', error);
    return NextResponse.json({ error: 'Failed to find nearby cases' }, { status: 500 });
  }
}
