import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

/**
 * GET /api/cases/my-missions
 *
 * Returns all missions (cases) that the user is involved with:
 * - Cases they own
 * - Cases they're helping with (through squad assignments)
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get cases where user is owner
    const ownedCases = await prisma.case.findMany({
      where: {
        ownerId: userId,
        status: { not: 'CLOSED' },
      },
      include: {
        pet: {
          select: {
            name: true,
            species: true,
            breed: true,
            photos: {
              select: { url: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get cases where user is a participant (through squad assignments)
    const participantCases = await prisma.case.findMany({
      where: {
        assignments: {
          some: {
            participants: {
              some: {
                userId: userId,
                isActive: true,
              },
            },
          },
        },
        status: { not: 'CLOSED' },
      },
      include: {
        pet: {
          select: {
            name: true,
            species: true,
            breed: true,
            photos: {
              select: { url: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Merge and deduplicate
    const allCasesMap = new Map();

    [...ownedCases, ...participantCases].forEach(caseItem => {
      if (!allCasesMap.has(caseItem.id)) {
        // Calculate time missing
        const hoursMissing = caseItem.lastSeenAt
          ? Math.floor((Date.now() - new Date(caseItem.lastSeenAt).getTime()) / 3600000)
          : 0;

        allCasesMap.set(caseItem.id, {
          id: caseItem.id,
          caseNumber: caseItem.caseNumber,
          petName: caseItem.pet?.name || 'Unknown',
          petSpecies: caseItem.pet?.species || 'OTHER',
          petBreed: caseItem.pet?.breed,
          photoUrl: caseItem.pet?.photos?.[0]?.url || null,
          status: caseItem.status,
          resolution: caseItem.resolution,
          lastSeenAt: caseItem.lastSeenAt,
          lastSeenAddress: caseItem.lastSeenAddress,
          hoursMissing,
          timeMissing: hoursMissing < 24
            ? `${hoursMissing}h`
            : `${Math.floor(hoursMissing / 24)}d ${hoursMissing % 24}h`,
          helperCount: 0, // TODO: Calculate actual helper count
        });
      }
    });

    const missions = Array.from(allCasesMap.values());

    return NextResponse.json({ missions });
  } catch (error) {
    console.error('Error fetching my missions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch missions' },
      { status: 500 }
    );
  }
}
