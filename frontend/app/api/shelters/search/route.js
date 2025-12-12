import { NextResponse } from 'next/server';
import { appleMapKit } from '@/app/lib/shelters';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/shelters/search
 *
 * Search for shelters near a location using Apple MapKit.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');
    const distance = parseInt(searchParams.get('distance') || '50');
    const live = searchParams.get('live') !== 'false'; // Default to live search

    if (!location) {
      return NextResponse.json(
        { error: 'Location is required' },
        { status: 400 }
      );
    }

    const results = {
      shelters: [],
      source: 'APPLE_MAPKIT',
    };

    // If Apple MapKit is configured and live search is enabled, search directly
    if (live && appleMapKit.isConfigured()) {
      try {
        // First geocode the location to get coordinates
        const geocoded = await appleMapKit.geocode(location);

        if (geocoded?.coordinate) {
          // Search shelters near the coordinates
          const shelters = await appleMapKit.searchSheltersNearLocation(
            geocoded.coordinate.latitude,
            geocoded.coordinate.longitude,
            distance
          );

          results.shelters = shelters;
          results.geocodedLocation = {
            latitude: geocoded.coordinate.latitude,
            longitude: geocoded.coordinate.longitude,
            formattedAddress: geocoded.formattedAddressLines?.join(', '),
          };
        } else {
          // Fallback: search by city name
          const parts = location.split(',').map(p => p.trim());
          if (parts.length >= 2) {
            const shelters = await appleMapKit.searchSheltersInCity(parts[0], parts[1]);
            results.shelters = shelters;
          }
        }
      } catch (error) {
        console.error('Apple MapKit search error:', error);
        // Fall back to database search
        results.error = 'Live search failed, showing cached results';
      }
    }

    // If no live results or Apple MapKit not configured, search local database
    if (results.shelters.length === 0) {
      const localWhere = { isActive: true };

      // Parse location for database search
      if (/^\d{5}$/.test(location)) {
        // Zip code search
        localWhere.zipCode = location;
      } else {
        // City/state search
        const parts = location.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          localWhere.city = { contains: parts[0], mode: 'insensitive' };
          localWhere.state = { contains: parts[1], mode: 'insensitive' };
        } else {
          localWhere.OR = [
            { city: { contains: location, mode: 'insensitive' } },
            { state: { contains: location, mode: 'insensitive' } },
            { name: { contains: location, mode: 'insensitive' } },
          ];
        }
      }

      const dbShelters = await prisma.shelter.findMany({
        where: localWhere,
        take: 50,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          type: true,
          address: true,
          city: true,
          state: true,
          zipCode: true,
          phone: true,
          email: true,
          website: true,
          latitude: true,
          longitude: true,
          source: true,
        },
      });

      results.shelters = dbShelters;
      results.source = 'database';
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Shelter search error:', error);
    return NextResponse.json(
      { error: 'Failed to search shelters', details: error.message },
      { status: 500 }
    );
  }
}
