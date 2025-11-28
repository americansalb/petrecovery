import { NextResponse } from 'next/server';
import { searchPetfinderOrganizations, getConfiguredSources } from '@/app/lib/shelterApi';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/shelters/search
 *
 * Search for shelters near a location.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');
    const name = searchParams.get('name');
    const distance = parseInt(searchParams.get('distance') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const source = searchParams.get('source'); // 'petfinder', 'local', 'all'

    const results = {
      shelters: [],
      pagination: {
        page,
        limit,
        total: 0,
      },
      sources: getConfiguredSources(),
    };

    // Search local database shelters
    if (!source || source === 'local' || source === 'all') {
      const localWhere = {};

      if (name) {
        localWhere.name = { contains: name, mode: 'insensitive' };
      }

      if (location) {
        // Simple zip code search
        if (/^\d{5}$/.test(location)) {
          localWhere.zipCode = location;
        } else {
          localWhere.OR = [
            { city: { contains: location, mode: 'insensitive' } },
            { state: { contains: location, mode: 'insensitive' } },
          ];
        }
      }

      const localShelters = await prisma.shelter.findMany({
        where: localWhere,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { name: 'asc' },
      });

      results.shelters.push(
        ...localShelters.map((s) => ({
          ...s,
          source: 'local',
        }))
      );
    }

    // Search PetFinder organizations
    if ((!source || source === 'petfinder' || source === 'all') && location) {
      try {
        const petfinderShelters = await searchPetfinderOrganizations({
          location,
          distance,
          name,
          page,
          limit,
        });

        results.shelters.push(...petfinderShelters);
      } catch (error) {
        console.error('PetFinder shelter search error:', error);
        // Continue with local results
      }
    }

    // Sort by distance if available
    results.shelters.sort((a, b) => {
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      return 0;
    });

    results.pagination.total = results.shelters.length;

    return NextResponse.json(results);
  } catch (error) {
    console.error('Shelter search error:', error);
    return NextResponse.json(
      { error: 'Failed to search shelters' },
      { status: 500 }
    );
  }
}
