import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const missionId = searchParams.get('missionId');

    const forceId = params.id;

    // Verify user is a member of this force
    const membership = await prisma.rescueForceMember.findFirst({
      where: {
        rescueForceId: forceId,
        userId: session.user.id,
        isActive: true
      }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a force member' }, { status: 403 });
    }

    // Build where clause based on filter
    let whereClause = { rescueForceId: forceId };

    // Filter by specific case if provided
    if (missionId) {
      whereClause.missionId = missionId;
    }

    if (filter === 'missions') {
      whereClause.type = {
        in: ['CASE_ACCEPTED', 'CASE_UPDATED', 'CASE_RESOLVED', 'SIGHTING_REPORTED']
      };
    } else if (filter === 'members') {
      whereClause.type = {
        in: ['MEMBER_JOINED', 'MEMBER_OPTED_IN', 'MEMBER_OPTED_OUT', 'MEMBER_PROMOTED']
      };
    } else if (filter === 'tasks') {
      whereClause.type = {
        in: ['TASK_CREATED', 'TASK_COMPLETED', 'TASK_ASSIGNED', 'SEARCH_AREA_ASSIGNED']
      };
    }

    // Fetch activities
    const activities = await prisma.squadActivity.findMany({
      where: whereClause,
      include: {
        actor: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        case: {
          select: {
            id: true,
            petName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    // Format activities
    const formattedActivities = activities.map(activity => ({
      id: activity.id,
      type: activity.type,
      message: activity.message,
      details: activity.details,
      actorName: activity.actor ? `${activity.actor.firstName} ${activity.actor.lastName}` : null,
      missionId: activity.missionId,
      caseName: activity.case?.petName,
      createdAt: activity.createdAt
    }));

    return NextResponse.json({ activities: formattedActivities });

  } catch (error) {
    console.error('Error fetching force activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}
