import { NextResponse } from 'next/server';
import { appleMapKit } from '@/app/lib/shelters';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/shelters/search
 *
 * Search for shelters near a location using Apple MapKit.
 * Results are automatically saved to the database for caching.
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
      savedToDatabase: 0,
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

          // Save results to database in background (don't await)
          saveSheltersToDatabase(shelters).then(saveResult => {
            console.log(`Saved ${saveResult.created} new shelters, updated ${saveResult.updated}`);
          }).catch(err => {
            console.error('Failed to save shelters to database:', err);
          });

        } else {
          // Fallback: search by city name
          const parts = location.split(',').map(p => p.trim());
          if (parts.length >= 2) {
            const shelters = await appleMapKit.searchSheltersInCity(parts[0], parts[1]);
            results.shelters = shelters;

            // Save to database
            saveSheltersToDatabase(shelters).catch(err => {
              console.error('Failed to save shelters to database:', err);
            });
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

/**
 * Save shelters from Apple Maps to database
 */
async function saveSheltersToDatabase(shelters) {
  const results = { created: 0, updated: 0, skipped: 0 };

  for (const shelter of shelters) {
    try {
      if (!shelter.name || !shelter.city || !shelter.state) {
        results.skipped++;
        continue;
      }

      // Check if shelter already exists
      const existing = await prisma.shelter.findFirst({
        where: {
          OR: [
            { appleMapKitId: shelter.appleMapKitId },
            {
              AND: [
                { name: shelter.name },
                { city: shelter.city },
                { state: shelter.state },
              ],
            },
          ],
        },
      });

      if (existing) {
        // Update existing shelter with fresh data
        await prisma.shelter.update({
          where: { id: existing.id },
          data: {
            appleMapKitId: shelter.appleMapKitId || existing.appleMapKitId,
            phone: shelter.phone || existing.phone,
            website: shelter.website || existing.website,
            address: shelter.address || existing.address,
            latitude: shelter.latitude ?? existing.latitude,
            longitude: shelter.longitude ?? existing.longitude,
            hours: shelter.hours || existing.hours,
            fetchedAt: new Date(),
            updatedAt: new Date(),
          },
        });
        results.updated++;
      } else {
        // Create new shelter
        await prisma.shelter.create({
          data: {
            appleMapKitId: shelter.appleMapKitId,
            name: shelter.name,
            phone: shelter.phone,
            website: shelter.website,
            address: shelter.address || '',
            city: shelter.city,
            state: shelter.state,
            zipCode: shelter.zipCode || '',
            latitude: shelter.latitude,
            longitude: shelter.longitude,
            hours: shelter.hours,
            type: determineShelterType(shelter.name),
            source: 'APPLE_MAPKIT',
            fetchedAt: new Date(),
            isActive: true,
          },
        });
        results.created++;
      }
    } catch (error) {
      console.error(`Error saving shelter "${shelter.name}":`, error.message);
      results.skipped++;
    }
  }

  return results;
}

/**
 * Determine shelter type from name
 */
function determineShelterType(name) {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('animal control') || nameLower.includes('city of') || nameLower.includes('county')) {
    return 'ANIMAL_CONTROL';
  }
  if (nameLower.includes('humane society') || nameLower.includes('spca')) {
    return 'SHELTER';
  }
  if (nameLower.includes('rescue')) {
    return 'RESCUE';
  }
  if (nameLower.includes('vet') || nameLower.includes('veterinary') || nameLower.includes('animal hospital')) {
    return 'VET';
  }
  return 'SHELTER';
}
