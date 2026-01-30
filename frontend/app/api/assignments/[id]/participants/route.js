import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// GET /api/assignments/[id]/participants - Get all participants for an assignment
export async function GET(request, { params }) {
  try {
    const { id } = params;

    const participants = await prisma.caseParticipant.findMany({
      where: { assignmentId: id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rescueLevel: true,
          },
        },
        searchSessions: {
          where: {
            status: { in: ['READY', 'ACTIVE', 'PAUSED'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { optedInAt: 'asc' },
    });

    return NextResponse.json({ participants });
  } catch (error) {
    console.error('Error fetching participants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch participants' },
      { status: 500 }
    );
  }
}

// POST /api/assignments/[id]/participants - Member opts into case
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: assignmentId } = params;

    // Get the assignment
    const assignment = await prisma.caseAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        rescueSquad: true,
        case: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Check if case is still active
    if (assignment.case.status === 'REUNITED' || assignment.case.status === 'CLOSED_OTHER') {
      return NextResponse.json(
        { error: 'This case is already closed' },
        { status: 400 }
      );
    }

    // Check if user is a member of the squad
    const membership = await prisma.rescueSquadMember.findFirst({
      where: {
        rescueSquadId: assignment.rescueSquadId,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You must be a member of this rescue force to participate' },
        { status: 403 }
      );
    }

    // Check if already participating
    const existingParticipation = await prisma.caseParticipant.findUnique({
      where: {
        assignmentId_userId: {
          assignmentId,
          userId: session.user.id,
        },
      },
    });

    if (existingParticipation) {
      if (existingParticipation.isActive) {
        return NextResponse.json(
          { error: 'You are already participating in this case' },
          { status: 400 }
        );
      }

      // Reactivate participation
      const participant = await prisma.caseParticipant.update({
        where: { id: existingParticipation.id },
        data: {
          isActive: true,
          optedOutAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              rescueLevel: true,
            },
          },
        },
      });

      return NextResponse.json({ participant });
    }

    // Create new participation
    const participant = await prisma.caseParticipant.create({
      data: {
        assignmentId,
        userId: session.user.id,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            rescueLevel: true,
          },
        },
      },
    });

    // Update assignment active members count
    await prisma.caseAssignment.update({
      where: { id: assignmentId },
      data: {
        activeMembers: { increment: 1 },
      },
    });

    // Update squad member stats
    await prisma.rescueSquadMember.update({
      where: { id: membership.id },
      data: {
        casesParticipated: { increment: 1 },
      },
    });

    // Level up user if this is their first case participation
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (user.rescueLevel === 'SCOUT') {
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          rescueLevel: 'SENTRY', // Level up to SENTRY on first case participation
        },
      });
    }

    return NextResponse.json({ participant }, { status: 201 });
  } catch (error) {
    console.error('Error opting into case:', error);
    return NextResponse.json(
      { error: 'Failed to opt into case' },
      { status: 500 }
    );
  }
}

// DELETE /api/assignments/[id]/participants - Member opts out of case
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: assignmentId } = params;

    const participation = await prisma.caseParticipant.findUnique({
      where: {
        assignmentId_userId: {
          assignmentId,
          userId: session.user.id,
        },
      },
    });

    if (!participation || !participation.isActive) {
      return NextResponse.json(
        { error: 'You are not participating in this case' },
        { status: 400 }
      );
    }

    // Mark as inactive
    await prisma.caseParticipant.update({
      where: { id: participation.id },
      data: {
        isActive: false,
        optedOutAt: new Date(),
      },
    });

    // Update assignment active members count
    await prisma.caseAssignment.update({
      where: { id: assignmentId },
      data: {
        activeMembers: { decrement: 1 },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error opting out of case:', error);
    return NextResponse.json(
      { error: 'Failed to opt out of case' },
      { status: 500 }
    );
  }
}
