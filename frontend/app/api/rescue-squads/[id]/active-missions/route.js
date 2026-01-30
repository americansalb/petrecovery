import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// GET /api/rescue-squads/[id]/active-missions - Get squad's accepted/active cases
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: squadId } = params;

    // Check if user is a member of this squad
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only rescue force members can view active cases' },
        { status: 403 }
      );
    }

    // Get all assignments for this squad (exclude completed/withdrawn)
    const assignments = await prisma.caseAssignment.findMany({
      where: {
        rescueSquadId: squadId,
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
