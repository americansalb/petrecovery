import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/mapping/track
 * Record GPS breadcrumb for live tracking during search
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { missionId, latitude, longitude, accuracy, altitude, heading, speed } = await request.json();

    if (!missionId || !latitude || !longitude) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify user is participant in case
    const assignment = await prisma.caseAssignment.findFirst({
      where: {
        missionId,
        participants: {
          some: { userId: session.user.id, isActive: true },
        },
      },
      select: { id: true },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Not a participant in this case' }, { status: 403 });
    }

    // Record breadcrumb
    const breadcrumb = await prisma.gpsBreadcrumb.create({
      data: {
        userId: session.user.id,
        missionId,
        assignmentId: assignment.id,
        latitude,
        longitude,
        accuracy,
        altitude,
        heading,
        speed,
      },
    });

    return NextResponse.json({ success: true, breadcrumb });
  } catch (error) {
    console.error('GPS track error:', error);
    return NextResponse.json({ error: 'Failed to record location' }, { status: 500 });
  }
}

/**
 * GET /api/mapping/track
 * Get GPS tracks for a case or user
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');
    const userId = searchParams.get('userId');
    const since = searchParams.get('since'); // ISO timestamp
    const limit = parseInt(searchParams.get('limit') || '1000');

    const where = {
      ...(missionId && { missionId }),
      ...(userId && { userId }),
      ...(since && { createdAt: { gte: new Date(since) } }),
    };

    const breadcrumbs = await prisma.gpsBreadcrumb.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        accuracy: true,
        speed: true,
        heading: true,
        createdAt: true,
        user: {
          select: { id: true, firstName: true },
        },
      },
    });

    // Group by user for multi-user tracking
    const tracks = {};
    for (const crumb of breadcrumbs) {
      const uid = crumb.user.id;
      if (!tracks[uid]) {
        tracks[uid] = {
          userId: uid,
          userName: crumb.user.firstName,
          points: [],
        };
      }
      tracks[uid].points.push({
        lat: crumb.latitude,
        lng: crumb.longitude,
        accuracy: crumb.accuracy,
        speed: crumb.speed,
        heading: crumb.heading,
        timestamp: crumb.createdAt,
      });
    }

    return NextResponse.json({
      tracks: Object.values(tracks),
      totalPoints: breadcrumbs.length,
    });
  } catch (error) {
    console.error('Get tracks error:', error);
    return NextResponse.json({ error: 'Failed to get tracks' }, { status: 500 });
  }
}

/**
 * DELETE /api/mapping/track
 * Clear GPS tracks for a case (admin/coordinator only)
 */
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('missionId');

    if (!missionId) {
      return NextResponse.json({ error: 'Case ID required' }, { status: 400 });
    }

    // Verify user is coordinator or admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    const isCoordinator = await prisma.caseAssignment.findFirst({
      where: {
        missionId,
        rescueForce: {
          members: {
            some: {
              userId: session.user.id,
              role: { in: ['LEADER', 'COORDINATOR', 'FOUNDER'] },
            },
          },
        },
      },
    });

    if (user?.role !== 'ADMIN' && !isCoordinator) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const result = await prisma.gpsBreadcrumb.deleteMany({
      where: { missionId },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
    });
  } catch (error) {
    console.error('Delete tracks error:', error);
    return NextResponse.json({ error: 'Failed to delete tracks' }, { status: 500 });
  }
}
