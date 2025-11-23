import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// POST /api/rescue-squads/:id/divisions/:divisionId/leave - Leave a division
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Verify division exists
    const division = await prisma.division.findUnique({
      where: { id: params.divisionId },
    });

    if (!division) {
      return NextResponse.json(
        { error: 'Division not found' },
        { status: 404 }
      );
    }

    if (division.rescueSquadId !== params.id) {
      return NextResponse.json(
        { error: 'Division does not belong to this rescue squad' },
        { status: 400 }
      );
    }

    // Check if user is a member of the division
    const membership = await prisma.rescueSquadMember.findUnique({
      where: {
        rescueSquadId_userId: {
          rescueSquadId: params.id,
          userId: userId,
        },
      },
    });

    if (!membership || membership.divisionId !== params.divisionId) {
      return NextResponse.json(
        { error: 'You are not a member of this division' },
        { status: 400 }
      );
    }

    // Remove user from division-specific cases (opt them out)
    // Find all active case assignments for this division
    const divisionAssignments = await prisma.caseAssignment.findMany({
      where: {
        rescueSquadId: params.id,
        divisionId: params.divisionId,
        status: {
          in: ['ACCEPTED', 'ACTIVE'],
        },
      },
      select: { id: true },
    });

    // Opt user out of all division cases
    for (const assignment of divisionAssignments) {
      await prisma.caseParticipant.updateMany({
        where: {
          assignmentId: assignment.id,
          userId: userId,
          isActive: true,
        },
        data: {
          isActive: false,
          optedOutAt: new Date(),
        },
      });
    }

    // Update squad membership to remove division assignment
    // User remains in the squad, just not in the division
    await prisma.rescueSquadMember.update({
      where: {
        rescueSquadId_userId: {
          rescueSquadId: params.id,
          userId: userId,
        },
      },
      data: {
        divisionId: null, // Remove division assignment
      },
    });

    // Update division member count
    await prisma.division.update({
      where: { id: params.divisionId },
      data: {
        totalMembers: { decrement: 1 },
      },
    });

    return NextResponse.json({
      message: 'Successfully left division. You remain a member of the parent rescue squad.',
    });
  } catch (error) {
    console.error('Error leaving division:', error);
    return NextResponse.json(
      { error: 'Failed to leave division' },
      { status: 500 }
    );
  }
}
