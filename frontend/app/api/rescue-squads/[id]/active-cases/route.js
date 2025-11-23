import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// GET /api/rescue-squads/[id]/active-cases - Get squad's accepted/active cases
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
        { error: 'Only squad members can view active cases' },
        { status: 403 }
      );
    }

    // Get all assignments for this squad
    const assignments = await prisma.caseAssignment.findMany({
      where: {
        rescueSquadId: squadId,
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
    });

    // Sort with prioritization: non-division cases first (divisionId = null), then by acceptedAt desc
    const sortedAssignments = assignments.sort((a, b) => {
      // Prioritize cases without divisionId (squad-wide cases)
      if (a.divisionId === null && b.divisionId !== null) return -1;
      if (a.divisionId !== null && b.divisionId === null) return 1;
      // If both are same type, sort by acceptedAt descending
      return new Date(b.acceptedAt) - new Date(a.acceptedAt);
    });

    // Check which cases the current user is participating in
    const assignmentsWithUserStatus = sortedAssignments.map(assignment => {
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
