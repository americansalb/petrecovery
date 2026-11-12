/**
 * Search Sessions API
 *
 * POST /api/assignments/[id]/sessions - Start a new search session (check-in)
 * GET /api/assignments/[id]/sessions - Get all sessions for assignment
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { assignmentDoor } from '@/app/lib/missionControl/guard';
import { firstWord } from '@/app/lib/searchText';

export const dynamic = 'force-dynamic';

// GET all sessions for this assignment
export async function GET(request, { params }) {
  try {
    // The walks on one force's search for a pet: for the owner, the forces looking for the pet and staff. It took
    // no sign-in, and sent every walk whole, with where each helper set off from and is now, their notes, their
    // account id and last name. A walker is a first name here. Where a walker is goes to the owner and staff.
    const { id: assignmentId } = await params;
    const door = await assignmentDoor(request, assignmentId);
    if (door.status !== 200) {
      return NextResponse.json({ error: door.status === 404 ? 'Assignment not found' : 'Only the owner and the forces looking for this pet can see this.', code: door.status === 404 ? 'NOT_FOUND' : 'NOT_ALLOWED' }, { status: door.status });
    }
    const viewerId = door.who.searcher?.userId || null;
    const seesPlaces = Boolean(door.who.searcher?.isOwner || door.who.staff);

    const rows = await prisma.searchSession.findMany({
      where: {
        participant: {
          assignmentId: door.assignment.id,
        },
      },
      select: {
        id: true,
        status: true,
        startedAt: true,
        endedAt: true,
        pausedAt: true,
        totalMinutes: true,
        distanceMiles: true,
        gridCellId: true,
        divisionId: true,
        lastLocationUpdate: true,
        startLocation: true,
        currentLocation: true,
        userId: true,
        participant: { select: { userId: true, user: { select: { firstName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const sessions = rows.map(({ userId, participant, startLocation, currentLocation, ...walk }) => ({
      ...walk,
      mine: Boolean(viewerId && (userId === viewerId || participant?.userId === viewerId)),
      walker: firstWord(participant?.user?.firstName) || 'A helper',
      ...(seesPlaces ? { startLocation, currentLocation } : {}),
    }));

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// POST - Start a new search session
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: assignmentId } = params;
    const body = await request.json();
    const { action } = body;

    // Find user's participation
    const participation = await prisma.caseParticipant.findUnique({
      where: {
        assignmentId_userId: {
          assignmentId,
          userId: session.user.id,
        },
      },
      include: {
        assignment: {
          include: {
            case: true,
          },
        },
      },
    });

    if (!participation) {
      return NextResponse.json(
        { error: 'You must join this case first' },
        { status: 403 }
      );
    }

    if (!participation.isActive) {
      return NextResponse.json(
        { error: 'Your participation is no longer active' },
        { status: 400 }
      );
    }

    // Check for existing active session
    const existingSession = await prisma.searchSession.findFirst({
      where: {
        participantId: participation.id,
        status: { in: ['READY', 'ACTIVE', 'PAUSED'] },
      },
    });

    if (existingSession) {
      return NextResponse.json(
        { error: 'You already have an active session', session: existingSession },
        { status: 400 }
      );
    }

    // Create new session
    const searchSession = await prisma.searchSession.create({
      data: {
        participantId: participation.id,
        missionId: participation.assignment.case.id,
        status: 'ACTIVE',
        startedAt: new Date(),
      },
    });

    // Create activity log
    await prisma.caseUpdate.create({
      data: {
        caseId: participation.assignment.case.id, // CaseUpdate's field is caseId (no missionId)
        authorId: session.user.id,
        content: `${session.user.firstName || 'A volunteer'} started searching`,
        isUpdate: true,
      },
    });

    return NextResponse.json({ session: searchSession }, { status: 201 });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
