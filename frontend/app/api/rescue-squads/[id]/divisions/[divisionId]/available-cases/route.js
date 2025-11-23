import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// GET /api/rescue-squads/[id]/divisions/[divisionId]/available-cases
// Get available cases for division leaders to accept (within division boundaries)
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: squadId, divisionId } = params;

    // Check if user is a division leader or squad moderator/admin
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
        OR: [
          { role: 'MODERATOR' }, // Squad moderators can manage all divisions
          { role: 'ADMINISTRATOR' }, // Admins can manage all divisions
          {
            role: 'DIVISION_LEADER',
            divisionId: divisionId, // Division leaders only for their division
          },
        ],
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only division leaders and squad moderators can browse available cases' },
        { status: 403 }
      );
    }

    // Get division details for location filtering
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      select: {
        id: true,
        name: true,
        centerLatitude: true,
        centerLongitude: true,
        boundaries: true,
        rescueSquad: {
          select: {
            id: true,
            name: true,
            areaDensity: true,
          },
        },
      },
    });

    if (!division) {
      return NextResponse.json({ error: 'Division not found' }, { status: 404 });
    }

    if (division.rescueSquad.id !== squadId) {
      return NextResponse.json(
        { error: 'Division does not belong to this squad' },
        { status: 400 }
      );
    }

    // Get all case IDs already accepted by this squad (any division or squad-level)
    const existingAssignments = await prisma.caseAssignment.findMany({
      where: { rescueSquadId: squadId },
      select: { caseId: true },
    });

    const acceptedCaseIds = existingAssignments.map(a => a.caseId);

    // Find available cases (ACTIVE or IN_PROGRESS, not already accepted by this squad)
    const cases = await prisma.case.findMany({
      where: {
        status: { in: ['ACTIVE', 'IN_PROGRESS'] },
        id: { notIn: acceptedCaseIds },
      },
      include: {
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        assignments: {
          include: {
            rescueSquad: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            assignments: true,
            sightings: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 100, // Get more cases for filtering
    });

    // Calculate distance and filter by division boundaries
    const casesWithDistance = cases.map(caseRecord => {
      let distance = null;
      if (division.centerLatitude && division.centerLongitude) {
        distance = calculateDistance(
          division.centerLatitude,
          division.centerLongitude,
          caseRecord.lastSeenLatitude,
          caseRecord.lastSeenLongitude
        );
      }

      return {
        ...caseRecord,
        distance,
      };
    });

    // Filter cases within division area
    // TODO: Implement proper polygon intersection when boundaries are available
    // For now, use a simplified approach:
    // 1. If division has boundaries (polygon), use notification radius based on area density
    // 2. Otherwise, use a default 3-mile radius for divisions

    const notificationRadius = division.rescueSquad.areaDensity === 'URBAN'
      ? 0.5
      : division.rescueSquad.areaDensity === 'RURAL'
      ? 1.5
      : 1.0; // SUBURBAN default

    // For divisions with polygon boundaries, we use a larger search radius
    // and filter to cases near the division center
    const searchRadius = division.boundaries ? 5 : 3; // Miles from division center

    let filteredCases = casesWithDistance;
    if (division.centerLatitude && division.centerLongitude) {
      filteredCases = casesWithDistance.filter(
        c => c.distance !== null && c.distance <= searchRadius
      );
    }

    // Sort by distance (closest first) and priority
    filteredCases.sort((a, b) => {
      // First by priority
      const priorityOrder = { 'URGENT': 0, 'HIGH': 1, 'NORMAL': 2, 'LOW': 3 };
      const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      if (priorityDiff !== 0) return priorityDiff;

      // Then by distance
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

    return NextResponse.json({
      cases: filteredCases.slice(0, 20), // Return top 20 most relevant cases
      divisionInfo: {
        name: division.name,
        notificationRadius,
        hasBoundaries: !!division.boundaries,
      },
    });
  } catch (error) {
    console.error('Error fetching available cases for division:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available cases' },
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
