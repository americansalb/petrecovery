import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/rescue-squads/[id]/cases/[caseId]/help
 *
 * Adds the current user as a helper on this case.
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: squadId, caseId } = params;

    // Check if user is a squad member
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: squadId,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a squad member' }, { status: 403 });
    }

    // Find the case assignment for this squad
    const assignment = await prisma.caseAssignment.findFirst({
      where: {
        rescueSquadId: squadId,
        caseId: caseId,
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Case not assigned to this squad' }, { status: 404 });
    }

    // Check if already participating
    const existingParticipant = await prisma.caseParticipant.findFirst({
      where: {
        caseAssignmentId: assignment.id,
        userId: session.user.id,
      },
    });

    if (existingParticipant) {
      if (existingParticipant.isActive) {
        return NextResponse.json({ error: 'Already helping on this case' }, { status: 400 });
      }

      // Reactivate participation
      await prisma.caseParticipant.update({
        where: { id: existingParticipant.id },
        data: { isActive: true },
      });
    } else {
      // Create new participation
      await prisma.caseParticipant.create({
        data: {
          caseAssignmentId: assignment.id,
          userId: session.user.id,
          role: 'SEARCHER',
          isActive: true,
          joinedAt: new Date(),
        },
      });
    }

    // Update member stats
    await prisma.rescueSquadMember.update({
      where: { id: membership.id },
      data: {
        casesParticipated: { increment: 1 },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error helping on case:', error);
    return NextResponse.json(
      { error: 'Failed to help on case' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rescue-squads/[id]/cases/[caseId]/help
 *
 * Removes the current user as a helper on this case.
 */
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: squadId, caseId } = params;

    // Find the case assignment
    const assignment = await prisma.caseAssignment.findFirst({
      where: {
        rescueSquadId: squadId,
        caseId: caseId,
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Find and deactivate participation
    const participant = await prisma.caseParticipant.findFirst({
      where: {
        caseAssignmentId: assignment.id,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (participant) {
      await prisma.caseParticipant.update({
        where: { id: participant.id },
        data: { isActive: false },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error leaving case:', error);
    return NextResponse.json(
      { error: 'Failed to leave case' },
      { status: 500 }
    );
  }
}
