import { NextResponse } from 'next/server';
import { searchPetfinder, searchRescueGroups, getConfiguredSources } from '@/app/lib/shelterApi';
import { withRateLimitAsync, rateLimitResponse } from '@/app/lib/rateLimit';

const LIMIT = { windowMs: 60 * 1000, maxRequests: 10, blockDurationMs: 2 * 60 * 1000 };

/**
 * GET /api/shelters/animals
 *
 * Search for animals in shelters.
 */
export async function GET(request) {
  try {
    // Each request here asks up to three outside services, on this site's keys. It took no sign-in and had no
    // limit of its own, so anyone could spend the whole of their allowance.
    const limited = await withRateLimitAsync(request, LIMIT, 'shelters:animals');
    if (!limited.success) return rateLimitResponse(limited);

    const { searchParams } = new URL(request.url);

    const params = {
      type: searchParams.get('type'),
      breed: searchParams.get('breed'),
      size: searchParams.get('size'),
      gender: searchParams.get('gender'),
      age: searchParams.get('age'),
      color: searchParams.get('color'),
      location: searchParams.get('location'),
      distance: Math.min(Math.max(parseInt(searchParams.get('distance') || '50', 10) || 50, 1), 500),
      status: searchParams.get('status') || 'adoptable',
      page: Math.min(Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1), 100),
      limit: Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 50),
    };

    const source = searchParams.get('source'); // 'petfinder', 'rescuegroups', 'all'
    const animals = [];

    // Search PetFinder
    if (!source || source === 'petfinder' || source === 'all') {
      try {
        const petfinderResults = await searchPetfinder(params);
        animals.push(...petfinderResults);
      } catch (error) {
        console.error('PetFinder search error:', error);
      }
    }

    // Search RescueGroups
    if (!source || source === 'rescuegroups' || source === 'all') {
      try {
        const rescueGroupsResults = await searchRescueGroups(params);
        animals.push(...rescueGroupsResults);
      } catch (error) {
        console.error('RescueGroups search error:', error);
      }
    }

    // Sort by distance
    animals.sort((a, b) => {
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      return 0;
    });

    return NextResponse.json({
      animals,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: animals.length,
      },
      sources: getConfiguredSources(),
    });
  } catch (error) {
    console.error('Animal search error:', error);
    return NextResponse.json(
      { error: 'Failed to search animals' },
      { status: 500 }
    );
  }
}
