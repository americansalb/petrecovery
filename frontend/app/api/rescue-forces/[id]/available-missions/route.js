import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// GET /api/rescue-forces/[id]/available-missions - Get available cases for force leaders to accept
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: forceId } = params;

    // Check if user is a leader of this force
    const membership = await prisma.rescueForceMember.findFirst({
      where: {
        rescueForceId: forceId,
        userId: session.user.id,
        role: { in: ['FOUNDER', 'LEADER'] },
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only force leaders can browse available cases' },
        { status: 403 }
      );
    }

    // Get force details for location filtering
    const force = await prisma.rescueForce.findUnique({
      where: { id: forceId },
      select: {
        centerLatitude: true,
        centerLongitude: true,
        radiusMiles: true,
        city: true,
        state: true,
      },
    });

    if (!force) {
      return NextResponse.json({ error: 'Force not found' }, { status: 404 });
    }

    // Get all case IDs already accepted by this force
    const existingAssignments = await prisma.caseAssignment.findMany({
      where: { rescueForceId: forceId },
      select: { missionId: true },
    });

    const acceptedCaseIds = existingAssignments.map(a => a.missionId);

    // Find available cases (ACTIVE or IN_PROGRESS, not already accepted by this force)
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
            rescueForce: {
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

    // Calculate distance for each case (if force has coordinates)
    const casesWithDistance = cases.map(missionRecord => {
      let distance = null;
      if (force.centerLatitude && force.centerLongitude) {
        distance = calculateDistance(
          force.centerLatitude,
          force.centerLongitude,
          missionRecord.lastSeenLatitude,
          missionRecord.lastSeenLongitude
        );
      }

      return {
        ...missionRecord,
        distance,
      };
    });

    // Filter by distance if force has coordinates
    let filteredCases = casesWithDistance;
    if (force.centerLatitude && force.centerLongitude) {
      filteredCases = casesWithDistance.filter(
        c => c.distance !== null && c.distance <= force.radiusMiles
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
        city: force.city,
        state: force.state,
        radiusMiles: force.radiusMiles,
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
