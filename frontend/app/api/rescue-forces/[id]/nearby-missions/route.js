import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// GET /api/rescue-forces/[id]/nearby-missions - Get nearby cases for ALL force members to see
// This is different from available-missions which is only for leaders
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: forceId } = params;

    // Check if user is a member of this force (any role)
    const membership = await prisma.rescueForceMember.findFirst({
      where: {
        rescueForceId: forceId,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only force members can view nearby cases' },
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

    if (!force || !force.centerLatitude || !force.centerLongitude) {
      return NextResponse.json({ error: 'Force location not configured' }, { status: 400 });
    }

    // Find all ACTIVE or IN_PROGRESS cases with valid coordinates
    const cases = await prisma.case.findMany({
      where: {
        status: { in: ['ACTIVE', 'IN_PROGRESS'] },
        NOT: [
          { lastSeenLatitude: null },
          { lastSeenLongitude: null },
        ],
      },
      select: {
        id: true,
        caseNumber: true,
        petName: true,
        petSpecies: true,
        petBreed: true,
        petColor: true,
        petPhotoUrl: true,
        petDescription: true,
        lastSeenLatitude: true,
        lastSeenLongitude: true,
        lastSeenAddress: true,
        lastSeenAt: true,
        status: true,
        priority: true,
        createdAt: true,
        ownerName: true,
        _count: {
          select: {
            sightings: true,
            assignments: true,
          },
        },
        assignments: {
          where: { rescueForceId: forceId },
          select: { id: true, status: true },
        },
      },
      orderBy: { lastSeenAt: 'desc' },
      take: 100,
    });

    // Calculate distance and filter by radius
    const casesWithDistance = cases
      .map(missionRecord => {
        const distance = calculateDistance(
          force.centerLatitude,
          force.centerLongitude,
          missionRecord.lastSeenLatitude,
          missionRecord.lastSeenLongitude
        );

        return {
          ...missionRecord,
          distance: Math.round(distance * 10) / 10,
          isAssignedToSquad: missionRecord.assignments.length > 0,
          squadAssignment: missionRecord.assignments[0] || null,
        };
      })
      .filter(c => c.distance <= force.radiusMiles * 1.5) // Include cases slightly beyond radius
      .sort((a, b) => a.distance - b.distance);

    return NextResponse.json({
      cases: casesWithDistance,
      squadInfo: {
        city: force.city,
        state: force.state,
        radiusMiles: force.radiusMiles,
        centerLatitude: force.centerLatitude,
        centerLongitude: force.centerLongitude,
      },
      userRole: membership.role,
    });
  } catch (error) {
    console.error('Error fetching nearby cases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nearby cases' },
      { status: 500 }
    );
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}
