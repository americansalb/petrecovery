import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { findPotentialMatches } from '@/app/lib/shelters';
import prisma from '@/app/lib/prisma';

// GET - Find shelter matches for a case
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const missionNumber = searchParams.get('missionNumber');
    const location = searchParams.get('location');
    const radius = parseInt(searchParams.get('radius') || '50', 10);

    if (!missionNumber) {
      return NextResponse.json({ error: 'Mission number required' }, { status: 400 });
    }

    // Get the case
    const lostCase = await prisma.case.findUnique({
      where: { missionNumber },
    });

    if (!lostCase) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Build location string
    const searchLocation = location || lostCase.lastSeenAddress?.split(',').pop()?.trim();

    if (!searchLocation) {
      return NextResponse.json({ error: 'Location required' }, { status: 400 });
    }

    // Find matches
    const matches = await findPotentialMatches(
      {
        species: lostCase.petSpecies,
        breed: lostCase.petBreed,
        color: lostCase.petColor,
        size: lostCase.petSize,
        sex: null, // Pet sex isn't stored in Case model
      },
      searchLocation,
      radius
    );

    return NextResponse.json({
      missionNumber,
      matches,
      searchLocation,
      searchRadius: radius,
    });
  } catch (error) {
    console.error('Shelter match error:', error);
    return NextResponse.json({ error: 'Failed to find matches' }, { status: 500 });
  }
}
