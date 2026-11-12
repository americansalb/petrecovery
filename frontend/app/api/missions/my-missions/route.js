import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { firstWord } from '@/app/lib/searchText';

/**
 * GET /api/missions/my-missions
 *
 * Returns all missions (cases) that the user is involved with:
 * - Cases they own
 * - Cases they're helping with (through squad assignments)
 *
 * An owner's contact details go to the owner. For a pet someone is helping with, this used to send the
 * owner's account email, account phone and full name. Starting a walk makes anyone a helper, so that was any
 * account reading any owner's sign-in address. A helper gets the owner's first name: the number to call is the
 * one the owner put on the pet's own page.
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get cases where user is the reporter (owner)
    // Uses denormalized pet fields on Case for performance
    const ownedCases = await prisma.case.findMany({
      where: {
        reporterId: userId,
        status: { notIn: ['REUNITED', 'CLOSED_OTHER'] },
      },
      select: {
        id: true,
        caseNumber: true,
        petName: true,
        petSpecies: true,
        petBreed: true,
        petPhotoUrl: true,
        petColor: true,
        status: true,
        resolution: true,
        lastSeenAt: true,
        lastSeenAddress: true,
        lastSeenLatitude: true,
        lastSeenLongitude: true,
        assignments: {
          select: {
            rescueSquadId: true,
            rescueSquad: {
              select: { id: true, name: true },
            },
          },
          take: 1,
        },
        reporter: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
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
        status: { notIn: ['REUNITED', 'CLOSED_OTHER'] },
      },
      select: {
        id: true,
        caseNumber: true,
        petName: true,
        petSpecies: true,
        petBreed: true,
        petPhotoUrl: true,
        petColor: true,
        status: true,
        resolution: true,
        lastSeenAt: true,
        lastSeenAddress: true,
        lastSeenLatitude: true,
        lastSeenLongitude: true,
        assignments: {
          select: {
            rescueSquadId: true,
            rescueSquad: {
              select: { id: true, name: true },
            },
          },
          take: 1,
        },
        // A first name, and nothing else about the owner's account.
        reporter: {
          select: {
            firstName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Merge and deduplicate
    const allCasesMap = new Map();

    const owned = new Set(ownedCases.map((caseItem) => caseItem.id));

    [...ownedCases, ...participantCases].forEach(caseItem => {
      if (!allCasesMap.has(caseItem.id)) {
        const mine = owned.has(caseItem.id);
        // Calculate time missing
        const hoursMissing = caseItem.lastSeenAt
          ? Math.floor((Date.now() - new Date(caseItem.lastSeenAt).getTime()) / 3600000)
          : 0;

        // Get squadId from first assignment
        const squadId = caseItem.assignments?.[0]?.rescueSquad?.id || caseItem.assignments?.[0]?.rescueSquadId;

        allCasesMap.set(caseItem.id, {
          id: caseItem.id,
          missionNumber: caseItem.caseNumber,
          petName: caseItem.petName || 'Unknown',
          petSpecies: caseItem.petSpecies || 'OTHER',
          petType: caseItem.petSpecies || 'OTHER', // Alias for compatibility
          petBreed: caseItem.petBreed,
          breed: caseItem.petBreed, // Alias for compatibility
          petColor: caseItem.petColor,
          color: caseItem.petColor, // Alias for compatibility
          photoUrl: caseItem.petPhotoUrl || null,
          status: caseItem.status,
          resolution: caseItem.resolution,
          lastSeenAt: caseItem.lastSeenAt,
          lastSeenAddress: caseItem.lastSeenAddress,
          lastSeenLocation: caseItem.lastSeenAddress, // Alias for compatibility
          lastSeenLatitude: caseItem.lastSeenLatitude,
          lastSeenLongitude: caseItem.lastSeenLongitude,
          hoursMissing,
          timeMissing: hoursMissing < 24
            ? `${hoursMissing}h`
            : `${Math.floor(hoursMissing / 24)}d ${hoursMissing % 24}h`,
          helperCount: 0, // TODO: Calculate actual helper count
          rescueSquadId: squadId,
          // The owner's own contact details, for their own pets. For anyone else's, a first name.
          ownerName: caseItem.reporter
            ? mine
              ? `${caseItem.reporter.firstName || ''} ${caseItem.reporter.lastName || ''}`.trim()
              : firstWord(caseItem.reporter.firstName) || null
            : null,
          ownerPhone: mine ? caseItem.reporter?.phone || null : null,
          ownerEmail: mine ? caseItem.reporter?.email || null : null,
        });
      }
    });

    const missions = Array.from(allCasesMap.values());

    return NextResponse.json({ missions });
  } catch (error) {
    console.error('Error fetching my missions:', error);
    console.error('Error stack:', error.stack);
    // What went wrong is in the log above, and is not sent to whoever asked.
    return NextResponse.json(
      { error: 'Failed to fetch missions' },
      { status: 500 }
    );
  }
}
