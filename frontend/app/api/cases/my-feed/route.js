import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// GET /api/cases/my-feed - Get cases prioritized by Division → Squad → Distance
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeCompleted = searchParams.get('includeCompleted') === 'true';

    // Get user's rescue squad memberships (including divisions)
    const memberships = await prisma.rescueSquadMember.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      include: {
        rescueSquad: {
          select: {
            id: true,
            name: true,
            centerLatitude: true,
            centerLongitude: true,
          },
        },
        division: {
          select: {
            id: true,
            name: true,
            centerLatitude: true,
            centerLongitude: true,
            radiusMiles: true,
          },
        },
      },
    });

    if (memberships.length === 0) {
      return NextResponse.json({
        cases: [],
        message: 'Join a Rescue Squad to see active cases',
      });
    }

    // Extract squad and division IDs
    const squadIds = memberships.map((m) => m.rescueSquadId);
    const divisionIds = memberships
      .filter((m) => m.divisionId)
      .map((m) => m.divisionId);

    // Get all active cases assigned to user's squads
    const caseAssignments = await prisma.caseAssignment.findMany({
      where: {
        rescueSquadId: { in: squadIds },
        status: { in: ['ACCEPTED', 'ACTIVE', 'STANDBY'] },
      },
      include: {
        case: {
          include: {
            reporter: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        rescueSquad: {
          select: {
            id: true,
            name: true,
          },
        },
        participants: {
          where: {
            userId: session.user.id,
            isActive: true,
          },
        },
      },
    });

    // Filter cases by status if needed
    const filteredAssignments = includeCompleted
      ? caseAssignments
      : caseAssignments.filter((a) =>
          ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'].includes(
            a.case.status
          )
        );

    // Enrich cases with priority information
    const enrichedCases = filteredAssignments.map((assignment) => {
      const caseData = assignment.case;

      // Determine match type and priority
      let matchType = 'OTHER_SQUAD';
      let priority = 3;
      let matchedDivision = null;
      let matchedSquad = null;

      // Find the user's membership in this squad
      const membership = memberships.find(
        (m) => m.rescueSquadId === assignment.rescueSquadId
      );

      if (membership) {
        matchedSquad = membership.rescueSquad;

        // Check if case is in user's division
        if (membership.divisionId && divisionIds.includes(membership.divisionId)) {
          const division = membership.division;

          // Calculate if case is within division radius
          if (division.centerLatitude && division.centerLongitude) {
            const distance = calculateDistance(
              caseData.lastSeenLatitude,
              caseData.lastSeenLongitude,
              division.centerLatitude,
              division.centerLongitude
            );

            if (distance <= division.radiusMiles) {
              matchType = 'YOUR_DIVISION';
              priority = 1;
              matchedDivision = division;
            }
          }
        }

        // If not in division, but in squad
        if (matchType === 'OTHER_SQUAD') {
          matchType = 'YOUR_SQUAD';
          priority = 2;
        }
      }

      // Calculate distance to user's location (if available)
      let distanceToUser = null;
      if (
        membership?.rescueSquad?.centerLatitude &&
        membership?.rescueSquad?.centerLongitude
      ) {
        distanceToUser = calculateDistance(
          caseData.lastSeenLatitude,
          caseData.lastSeenLongitude,
          membership.rescueSquad.centerLatitude,
          membership.rescueSquad.centerLongitude
        );
      }

      // Check if user is actively participating
      const isParticipating = assignment.participants.length > 0;

      return {
        id: caseData.id,
        caseNumber: caseData.caseNumber,
        petName: caseData.petName,
        petSpecies: caseData.petSpecies,
        petBreed: caseData.petBreed,
        petColor: caseData.petColor,
        petSize: caseData.petSize,
        petPhotoUrl: caseData.petPhotoUrl,
        petDescription: caseData.petDescription,
        status: caseData.status,
        priority: caseData.priority,
        lastSeenAt: caseData.lastSeenAt,
        lastSeenAddress: caseData.lastSeenAddress,
        lastSeenLatitude: caseData.lastSeenLatitude,
        lastSeenLongitude: caseData.lastSeenLongitude,
        searchRadius: caseData.searchRadius,
        hasReward: caseData.hasReward,
        rewardAmount: caseData.rewardAmount,
        createdAt: caseData.createdAt,

        // Match information
        matchType,
        matchPriority: priority,
        distanceToUser,

        // Squad/Division info
        rescueSquad: matchedSquad,
        division: matchedDivision,

        // Assignment info
        assignmentId: assignment.id,
        assignmentStatus: assignment.status,
        activeMembers: assignment.activeMembers,
        isParticipating,

        // Reporter info
        reporter: caseData.reporter,
      };
    });

    // Sort by priority, then distance
    const sortedCases = enrichedCases.sort((a, b) => {
      // First by match priority (1 = division, 2 = squad, 3 = other)
      if (a.matchPriority !== b.matchPriority) {
        return a.matchPriority - b.matchPriority;
      }

      // Then by case priority (URGENT > HIGH > NORMAL > LOW)
      const priorityOrder = { URGENT: 1, HIGH: 2, NORMAL: 3, LOW: 4 };
      const aPrio = priorityOrder[a.priority] || 3;
      const bPrio = priorityOrder[b.priority] || 3;
      if (aPrio !== bPrio) {
        return aPrio - bPrio;
      }

      // Then by distance
      if (a.distanceToUser !== null && b.distanceToUser !== null) {
        return a.distanceToUser - b.distanceToUser;
      }

      // Finally by creation date (newest first)
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return NextResponse.json({
      cases: sortedCases,
      stats: {
        total: sortedCases.length,
        inDivision: sortedCases.filter((c) => c.matchType === 'YOUR_DIVISION')
          .length,
        inSquad: sortedCases.filter((c) => c.matchType === 'YOUR_SQUAD')
          .length,
        participating: sortedCases.filter((c) => c.isParticipating).length,
      },
    });
  } catch (error) {
    console.error('Error fetching case feed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch case feed' },
      { status: 500 }
    );
  }
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}
