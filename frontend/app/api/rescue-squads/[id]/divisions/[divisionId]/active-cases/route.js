import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// GET /api/rescue-squads/[id]/divisions/[divisionId]/active-cases
// Get active cases for this specific division
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: squadId, divisionId } = params;

    // Check if user is a member of this division
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
        OR: [
          { divisionId: divisionId }, // Member of this specific division
          { role: { in: ['MODERATOR', 'ADMINISTRATOR'] } }, // Squad moderators/admins can see all division cases
        ],
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only division members can view division active cases' },
        { status: 403 }
      );
    }

    // Verify division exists and belongs to this squad
    const division = await prisma.division.findUnique({
      where: { id: divisionId },
      select: {
        id: true,
        name: true,
        rescueSquadId: true,
      },
    });

    if (!division) {
      return NextResponse.json(
        { error: 'Division not found' },
        { status: 404 }
      );
    }

    if (division.rescueSquadId !== squadId) {
      return NextResponse.json(
        { error: 'Division does not belong to this squad' },
        { status: 400 }
      );
    }

    // Get all assignments for this division specifically
    const assignments = await prisma.caseAssignment.findMany({
      where: {
        rescueSquadId: squadId,
        divisionId: divisionId, // Only cases assigned to this division
        status: { in: ['ACCEPTED', 'ACTIVE', 'STANDBY'] }, // Exclude completed/withdrawn
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
      divisionInfo: {
        id: division.id,
        name: division.name,
      },
    });
  } catch (error) {
    console.error('Error fetching active cases for division:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active cases' },
      { status: 500 }
    );
  }
}
