import { NextResponse } from 'next/server';
import { searchPetfinder, searchRescueGroups, getConfiguredSources } from '@/app/lib/shelterApi';

/**
 * GET /api/shelters/animals
 *
 * Search for animals in shelters.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const params = {
      type: searchParams.get('type'),
      breed: searchParams.get('breed'),
      size: searchParams.get('size'),
      gender: searchParams.get('gender'),
      age: searchParams.get('age'),
      color: searchParams.get('color'),
      location: searchParams.get('location'),
      distance: parseInt(searchParams.get('distance') || '50'),
      status: searchParams.get('status') || 'adoptable',
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
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
