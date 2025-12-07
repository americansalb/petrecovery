import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { syncSheltersNearLocation, syncFoundAnimals, matchIntakesWithCases } from '@/app/lib/shelters';
import prisma from '@/app/lib/prisma';

// POST - Sync shelter data
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

    const { location, radius = 100, syncType = 'all' } = await request.json();

    if (!location) {
      return NextResponse.json({ error: 'Location required (ZIP code or city, state)' }, { status: 400 });
    }

    const results = {
      shelters: null,
      animals: null,
      matches: null,
    };

    if (syncType === 'all' || syncType === 'shelters') {
      results.shelters = await syncSheltersNearLocation(location, radius);
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
