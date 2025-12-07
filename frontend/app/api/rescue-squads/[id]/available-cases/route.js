import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// GET /api/rescue-squads/[id]/available-cases - Get available cases for squad leaders to accept
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: squadId } = params;

    // Check if user is a leader of this squad
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        role: { in: ['FOUNDER', 'LEADER'] },
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only squad leaders can browse available cases' },
        { status: 403 }
      );
    }

    // Get squad details for location filtering
    const squad = await prisma.rescueSquad.findUnique({
      where: { id: squadId },
      select: {
        centerLatitude: true,
        centerLongitude: true,
        radiusMiles: true,
        city: true,
        state: true,
      },
    });

    if (!squad) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    // Get all case IDs already accepted by this squad
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
      take: 50, // Limit to 50 most relevant cases
    });

    // Calculate distance for each case (if squad has coordinates)
    const casesWithDistance = cases.map(caseRecord => {
      let distance = null;
      if (squad.centerLatitude && squad.centerLongitude) {
        distance = calculateDistance(
          squad.centerLatitude,
          squad.centerLongitude,
          caseRecord.lastSeenLatitude,
          caseRecord.lastSeenLongitude
        );
      }

      return {
        ...caseRecord,
        distance,
      };
    });

    // Filter by distance if squad has coordinates
    let filteredCases = casesWithDistance;
    if (squad.centerLatitude && squad.centerLongitude) {
      filteredCases = casesWithDistance.filter(
        c => c.distance !== null && c.distance <= squad.radiusMiles
      );
    }

    // Sort by distance (closest first)
    filteredCases.sort((a, b) => {
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    });

    return NextResponse.json({
      cases: filteredCases,
      squadInfo: {
        city: squad.city,
        state: squad.state,
        radiusMiles: squad.radiusMiles,
      },
    });
  } catch (error) {
    console.error('Error fetching available cases:', error);
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
