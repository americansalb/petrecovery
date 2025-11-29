import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
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
    const caseNumber = searchParams.get('caseNumber');
    const location = searchParams.get('location');
    const radius = parseInt(searchParams.get('radius') || '50', 10);

    if (!caseNumber) {
      return NextResponse.json({ error: 'Case number required' }, { status: 400 });
    }

    // Get the case
    const lostCase = await prisma.case.findUnique({
      where: { caseNumber },
    });

    if (!lostCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
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
      caseNumber,
      matches,
      searchLocation,
      searchRadius: radius,
    });
  } catch (error) {
    console.error('Shelter match error:', error);
    return NextResponse.json({ error: 'Failed to find matches' }, { status: 500 });
  }
}
