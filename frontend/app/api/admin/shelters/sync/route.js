import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { syncSheltersNearLocation, syncFoundAnimals, matchIntakesWithCases } from '@/app/lib/shelters';
import { searchSheltersWithCache } from '@/app/lib/maps/shelterCacheService';
import { geocode } from '@/app/lib/maps/appleMapServer';
import prisma from '@/app/lib/prisma';

/**
 * Geocode a location string (ZIP code or city, state) to coordinates
 */
async function geocodeLocation(location) {
  // Check if it's a ZIP code (5 digits)
  const zipMatch = location.trim().match(/^\d{5}$/);
  if (zipMatch) {
    // Geocode ZIP code
    const result = await geocode(location + ', USA');
    if (result) {
      return {
        lat: result.location.lat,
        lng: result.location.lng,
        city: result.city || location,
        state: result.state || 'US',
      };
    }
  }

  // Try as city, state
  const result = await geocode(location);
  if (result) {
    return {
      lat: result.location.lat,
      lng: result.location.lng,
      city: result.city || location.split(',')[0].trim(),
      state: result.state || 'US',
    };
  }

  throw new Error(`Could not geocode location: ${location}`);
}

// POST - Sync shelter data from Apple Maps
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { location, radius = 50, syncType = 'shelters' } = await request.json();

    if (!location) {
      return NextResponse.json({ error: 'Location required (ZIP code or city, state)' }, { status: 400 });
    }

    const results = {
      shelters: null,
      animals: null,
      matches: null,
    };

    if (syncType === 'all' || syncType === 'shelters') {
      // Geocode the location first
      const geo = await geocodeLocation(location);
      console.log('[ShelterSync] Geocoded location:', geo);

      // Use Apple Maps cache service with force refresh
      const radiusMeters = radius * 1609.34; // miles to meters
      const searchResult = await searchSheltersWithCache(geo.lat, geo.lng, {
        radiusMeters,
        type: 'shelter',
        forceRefresh: true, // Force refresh to get fresh data
      });

      results.shelters = {
        count: searchResult.places?.length || 0,
        location: geo,
        source: 'APPLE_MAPS',
      };
    }

    if (syncType === 'all' || syncType === 'animals') {
      results.animals = await syncFoundAnimals(location, radius);
    }

    if (syncType === 'all' || syncType === 'matches') {
      results.matches = await matchIntakesWithCases();
    }

    return NextResponse.json({
      success: true,
      results,
      location,
      radius,
    });
  } catch (error) {
    console.error('Shelter sync error:', error);
    return NextResponse.json({ error: 'Sync failed: ' + error.message }, { status: 500 });
  }
}
