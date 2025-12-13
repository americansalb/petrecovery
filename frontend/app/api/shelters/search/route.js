import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { searchSheltersWithCache } from '@/app/lib/maps/shelterCacheService';
import { geocode } from '@/app/lib/maps/appleMapServer';

/**
 * GET /api/shelters/search
 *
 * Search for shelters near a location.
 * Uses the same cache service as mission control for consistency.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');
    const distance = parseInt(searchParams.get('distance') || '50');

    if (!location) {
      return NextResponse.json(
        { error: 'Location is required' },
        { status: 400 }
      );
    }

    console.log('[Shelter Search] Searching for:', location, 'within', distance, 'miles');

    const results = {
      shelters: [],
      source: 'database',
      location: location,
    };

    // Step 1: Geocode the location to get coordinates
    let latitude = null;
    let longitude = null;

    try {
      const geocoded = await geocode(location);
      if (geocoded?.lat && geocoded?.lng) {
        latitude = geocoded.lat;
        longitude = geocoded.lng;
        results.geocodedLocation = {
          latitude,
          longitude,
          address: geocoded.address,
        };
        console.log('[Shelter Search] Geocoded to:', latitude, longitude);
      }
    } catch (geoError) {
      console.error('[Shelter Search] Geocode failed:', geoError.message);
    }

    // Step 2: If we have coordinates, use the cache service (same as mission control)
    if (latitude && longitude) {
      try {
        const radiusMeters = distance * 1609.34; // Convert miles to meters
        const cacheResult = await searchSheltersWithCache(latitude, longitude, {
          radiusMeters,
          type: 'shelter',
          forceRefresh: false,
        });

        if (cacheResult.places && cacheResult.places.length > 0) {
          // Transform to match expected format
          results.shelters = cacheResult.places.map(place => ({
            id: place.id,
            name: place.name,
            type: place.type || 'SHELTER',
            address: place.address,
            city: place.city,
            state: place.state,
            zipCode: place.zipCode,
            phone: place.phone,
            email: place.email,
            website: place.website,
            hours: place.hours,
            latitude: place.latitude,
            longitude: place.longitude,
            distance: place.distance ? Math.round(place.distance / 1609.34 * 10) / 10 : null, // Convert to miles
            source: place.source,
            appleMapKitId: place.appleMapKitId, // Include Apple Maps ID for PlaceDetail
          }));
          results.source = cacheResult.source;
          results.cacheHit = cacheResult.cacheHit;
          console.log('[Shelter Search] Found', results.shelters.length, 'shelters from cache');
        }
      } catch (cacheError) {
        console.error('[Shelter Search] Cache search failed:', cacheError.message);
      }
    }

    // Step 3: Fallback to simple database search if no results
    if (results.shelters.length === 0) {
      console.log('[Shelter Search] Falling back to database search');

      const localWhere = { isActive: true };

      // Parse location for database search
      if (/^\d{5}$/.test(location)) {
        // For zip code, search nearby zip codes or city
        localWhere.OR = [
          { zipCode: location },
          { zipCode: { startsWith: location.substring(0, 3) } }, // Same area code
        ];
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
          hours: true,
          latitude: true,
          longitude: true,
          source: true,
          appleMapKitId: true, // Include for PlaceDetail button
        },
      });

      results.shelters = dbShelters;
      results.source = 'database';
      console.log('[Shelter Search] Found', dbShelters.length, 'shelters from database');
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
