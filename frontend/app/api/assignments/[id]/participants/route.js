import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { assignmentDoor } from '@/app/lib/missionControl/guard';
import { firstWord } from '@/app/lib/searchText';

// GET /api/assignments/[id]/participants - Who is on one force's search for a pet
//
// For the owner, the forces looking for the pet and staff (`assignmentDoor`). It took no sign-in: anyone with an
// assignment's id read each helper's account id and last name and the newest open walk whole, with where the
// helper was. A helper is a first name here. Where a helper is goes to the owner and staff only.
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const door = await assignmentDoor(request, id);
    if (door.status !== 200) {
      return NextResponse.json({ error: door.status === 404 ? 'Assignment not found' : 'Only the owner and the forces looking for this pet can see this.', code: door.status === 404 ? 'NOT_FOUND' : 'NOT_ALLOWED' }, { status: door.status });
    }
    const viewerId = door.who.searcher?.userId || null;
    const seesPlaces = Boolean(door.who.searcher?.isOwner || door.who.staff);

    const rows = await prisma.caseParticipant.findMany({
      where: { assignmentId: door.assignment.id },
      select: {
        id: true,
        userId: true,
        isActive: true,
        optedInAt: true,
        user: { select: { firstName: true, rescueLevel: true } },
        searchSessions: {
          where: {
            status: { in: ['READY', 'ACTIVE', 'PAUSED'] },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, startedAt: true, lastLocationUpdate: true, currentLocation: true },
        },
      },
      orderBy: { optedInAt: 'asc' },
      take: 500,
    });

    const participants = rows.map(({ userId, user, searchSessions, ...row }) => ({
      ...row,
      mine: Boolean(viewerId && userId === viewerId),
      user: { firstName: firstWord(user?.firstName) || 'A helper', rescueLevel: user?.rescueLevel || null },
      searchSessions: searchSessions.map(({ currentLocation, ...walk }) => (seesPlaces ? { ...walk, currentLocation } : walk)),
    }));

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
    const membership = await prisma.rescueForceMember.findFirst({
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
    await prisma.rescueForceMember.update({
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
