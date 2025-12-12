import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { comparePets } from '@/app/lib/ai/imageMatching';
import prisma from '@/app/lib/prisma';

// POST - Find potential matches for a pet
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { missionNumber, limit = 20 } = await request.json();

    if (!missionNumber) {
      return NextResponse.json({ error: 'Mission number required' }, { status: 400 });
    }

    // Get the lost pet case
    const lostCase = await prisma.case.findUnique({
      where: { missionNumber },
    });

    if (!lostCase) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Find potential matches from found reports and shelter intakes
    const candidates = [];

    // Search found pet reports
    const foundCases = await prisma.case.findMany({
      where: {
        reportType: 'FOUND',
        status: { in: ['ACTIVE', 'IN_PROGRESS'] },
        petSpecies: lostCase.petSpecies,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    for (const foundCase of foundCases) {
      candidates.push({
        type: 'found_report',
        id: foundCase.id,
        missionNumber: foundCase.caseNumber,
        species: foundCase.petSpecies,
        breed: foundCase.petBreed,
        color: foundCase.petColor,
        size: foundCase.petSize,
        photoUrl: foundCase.petPhotoUrl,
        location: foundCase.lastSeenAddress,
        date: foundCase.createdAt,
      });
    }

    // Search shelter intakes
    const intakes = await prisma.shelterIntake.findMany({
      where: {
        species: lostCase.petSpecies?.toLowerCase(),
        status: 'AVAILABLE',
        matchedCaseId: null,
        intakeDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      include: { shelter: true },
    });

    for (const intake of intakes) {
      candidates.push({
        type: 'shelter_intake',
        id: intake.id,
        shelterId: intake.shelterId,
        shelterName: intake.shelter?.name,
        species: intake.species,
        breed: intake.breed,
        color: intake.color,
        size: intake.size,
        photoUrl: intake.photoUrls ? JSON.parse(intake.photoUrls)[0] : null,
        location: `${intake.shelter?.city}, ${intake.shelter?.state}`,
        date: intake.intakeDate,
      });
    }

    // Compare each candidate
    const matches = [];
    const lostPet = {
      species: lostCase.petSpecies,
      breed: lostCase.petBreed,
      color: lostCase.petColor,
      size: lostCase.petSize,
      photoUrl: lostCase.petPhotoUrl,
    };

    for (const candidate of candidates) {
      const comparison = await comparePets(lostPet, candidate);

      if (comparison.score > 0.4) {
        matches.push({
          ...candidate,
          matchScore: comparison.score,
          scoreBreakdown: comparison.scores,
          isLikelyMatch: comparison.isMatch,
        });
      }
    }

    // Sort by match score
    matches.sort((a, b) => b.matchScore - a.matchScore);

    return NextResponse.json({
      missionNumber,
      petName: lostCase.petName,
      matches: matches.slice(0, limit),
      totalCandidates: candidates.length,
    });
  } catch (error) {
    console.error('AI match error:', error);
    return NextResponse.json({ error: 'Match search failed' }, { status: 500 });
  }
}
