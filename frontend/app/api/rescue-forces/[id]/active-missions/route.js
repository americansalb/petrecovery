import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// GET /api/rescue-forces/[id]/active-missions - Get force's accepted/active cases
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: forceId } = params;

    // Check if user is a member of this force
    const membership = await prisma.rescueForceMember.findFirst({
      where: {
        rescueForceId: forceId,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only force members can view active cases' },
        { status: 403 }
      );
    }

    // Get all assignments for this force (exclude completed/withdrawn)
    const assignments = await prisma.caseAssignment.findMany({
      where: {
        rescueForceId: forceId,
        status: { in: ['ACCEPTED', 'ACTIVE', 'STANDBY'] },
      },
      include: {
        case: {
          include: {
            reporter: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        participants: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        _count: {
          select: {
            participants: true,
            searchAreas: true,
            petSpottings: true,
          },
        },
      },
      orderBy: {
        acceptedAt: 'desc',
      },
    });

    // Check which cases the current user is participating in
    const assignmentsWithUserStatus = assignments.map(assignment => {
      const userParticipation = assignment.participants.find(
        p => p.userId === session.user.id
      );
      return {
        ...assignment,
        isUserParticipating: !!userParticipation,
        userParticipationId: userParticipation?.id || null,
      };
    });

    return NextResponse.json({
      assignments: assignmentsWithUserStatus,
    });
  } catch (error) {
    console.error('Error fetching active cases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active cases' },
      { status: 500 }
    );
  }
}
