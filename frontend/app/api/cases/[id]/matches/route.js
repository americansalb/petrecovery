import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { findPotentialMatches } from '@/app/lib/shelterApi';

/**
 * GET /api/cases/:id/matches
 *
 * Get potential shelter matches for a lost pet case.
 */
export async function GET(request, { params }) {
  try {
    const { id: caseId } = await params;

    // Get the case
    const lostPetCase = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        petName: true,
        petType: true,
        breed: true,
        primaryColor: true,
        secondaryColor: true,
        size: true,
        gender: true,
        age: true,
        lastSeenLocation: true,
        lastSeenCity: true,
        lastSeenState: true,
        lastSeenZipCode: true,
        distinguishingFeatures: true,
        userId: true,
      },
    });

    if (!lostPetCase) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // Find potential matches
    let matches = [];
    try {
      matches = await findPotentialMatches(lostPetCase);
    } catch (err) {
      console.error('Error finding matches:', err);
    }

    // Get any previously saved matches
    let savedMatches = [];
    try {
      savedMatches = await prisma.shelterMatch.findMany({
        where: { caseId },
        select: {
          externalId: true,
          status: true,
          notes: true,
        },
      });
    } catch (err) {
      console.log('ShelterMatch table not available');
    }

    const savedMatchMap = new Map(
      savedMatches.map((m) => [m.externalId, m])
    );

    // Merge saved status with matches
    const enrichedMatches = matches.map((match) => {
      const saved = savedMatchMap.get(match.externalId);
      return {
        ...match,
        savedStatus: saved?.status || null,
        savedNotes: saved?.notes || null,
      };
    });

    return NextResponse.json({
      caseId,
      petName: lostPetCase.petName,
      matches: enrichedMatches,
      totalMatches: enrichedMatches.length,
    });
  } catch (error) {
    console.error('Match search error:', error);
    return NextResponse.json(
      { error: 'Failed to find matches' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cases/:id/matches
 *
 * Save a potential match for review.
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: caseId } = await params;
    const body = await request.json();
    const { externalId, source, status, notes, matchData } = body;

    // Verify case ownership
    const lostPetCase = await prisma.case.findUnique({
      where: { id: caseId },
      select: { userId: true },
    });

    if (!lostPetCase) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    if (lostPetCase.userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Not authorized to modify this case' },
        { status: 403 }
      );
    }

    // Save or update the match
    const match = await prisma.shelterMatch.upsert({
      where: {
        caseId_externalId: {
          caseId,
          externalId,
        },
      },
      create: {
        caseId,
        externalId,
        source,
        status: status || 'PENDING',
        notes,
        matchData: matchData ? JSON.stringify(matchData) : null,
      },
      update: {
        status,
        notes,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      match,
    });
  } catch (error) {
    console.error('Save match error:', error);
    return NextResponse.json(
      { error: 'Failed to save match' },
      { status: 500 }
    );
  }
}
