import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { fetchAndSaveSheltersForCity, appleMapKit, petfinder } from '@/app/lib/shelters';
import { searchPetfinderOrganizations } from '@/app/lib/shelterApi';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/shelters/fetch
 *
 * Fetch shelters and save to database.
 * Uses Apple MapKit (primary) or PetFinder (fallback).
 * Admin only.
 *
 * Body: { city: string, state: string }
 */
export async function POST(request) {
  try {
    // Check authentication (admin only)
    const session = await getServerSession(authOptions);
    if (!session?.user || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { city, state } = body;

    if (!city || !state) {
      return NextResponse.json(
        { error: 'City and state are required' },
        { status: 400 }
      );
    }

    let results;
    let source;

    // Try Apple MapKit first (primary)
    if (appleMapKit.isConfigured()) {
      source = 'APPLE_MAPKIT';
      results = await fetchAndSaveSheltersForCity(city, state);
    } else {
      // Fallback to PetFinder
      source = 'PETFINDER';
      results = await fetchSheltersFromPetFinder(city, state);
    }

    return NextResponse.json({
      success: true,
      source,
      message: `Fetched ${results.total} shelters for ${city}, ${state}`,
      ...results,
    });
  } catch (error) {
    console.error('Shelter fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shelters', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Fetch shelters from PetFinder and save to database
 */
async function fetchSheltersFromPetFinder(city, state) {
  const location = `${city}, ${state}`;

  // Fetch organizations from PetFinder
  const organizations = await searchPetfinderOrganizations({
    location,
    distance: 50,
    limit: 100,
  });

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    total: organizations.length,
    city,
    state,
  };

  for (const org of organizations) {
    try {
      // Skip if missing required fields
      if (!org.name || !org.address?.city || !org.address?.state) {
        results.skipped++;
        continue;
      }

      // Check if exists
      const existing = await prisma.shelter.findFirst({
        where: {
          OR: [
            { petfinderId: org.externalId },
            {
              AND: [
                { name: org.name },
                { city: org.address.city },
                { state: org.address.state },
              ],
            },
          ],
        },
      });

      if (existing) {
        await prisma.shelter.update({
          where: { id: existing.id },
          data: {
            petfinderId: org.externalId,
            phone: org.phone || existing.phone,
            email: org.email || existing.email,
            website: org.website || existing.website,
            fetchedAt: new Date(),
          },
        });
        results.updated++;
      } else {
        await prisma.shelter.create({
          data: {
            petfinderId: org.externalId,
            name: org.name,
            address: org.address?.address1 || '',
            city: org.address.city,
            state: org.address.state,
            zipCode: org.address?.postcode || '',
            phone: org.phone,
            email: org.email,
            website: org.website,
            type: 'SHELTER',
            source: 'PETFINDER',
            fetchedAt: new Date(),
            isActive: true,
          },
        });
        results.created++;
      }
    } catch (error) {
      console.error(`Error saving shelter ${org.name}:`, error.message);
      results.skipped++;
    }
  }

  return results;
}

/**
 * GET /api/shelters/fetch
 *
 * Get shelter fetch status and list shelters by city.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const state = searchParams.get('state');

    const where = { isActive: true };

    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }
    if (state) {
      where.state = state.toUpperCase();
    }

    const shelters = await prisma.shelter.findMany({
      where,
      orderBy: [{ city: 'asc' }, { name: 'asc' }],
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
        fetchedAt: true,
        isVerified: true,
      },
    });

    // Get stats by source
    const sourceStats = await prisma.shelter.groupBy({
      by: ['source'],
      _count: { id: true },
      where: { isActive: true },
    });

    // Get stats by city (top 10)
    const cityStats = await prisma.shelter.groupBy({
      by: ['city', 'state'],
      _count: { id: true },
      where: { isActive: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    return NextResponse.json({
      shelters,
      count: shelters.length,
      stats: {
        bySource: sourceStats.reduce((acc, s) => {
          acc[s.source] = s._count.id;
          return acc;
        }, {}),
        topCities: cityStats.map(c => ({
          city: c.city,
          state: c.state,
          count: c._count.id,
        })),
      },
      appleMapKitConfigured: appleMapKit.isConfigured(),
    });
  } catch (error) {
    console.error('Shelter list error:', error);
    return NextResponse.json(
      { error: 'Failed to list shelters' },
      { status: 500 }
    );
  }
}
