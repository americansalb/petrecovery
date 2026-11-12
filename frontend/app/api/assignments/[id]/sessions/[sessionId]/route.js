/**
 * Individual Search Session API
 *
 * PATCH /api/assignments/[id]/sessions/[sessionId] - Update session (pause/resume/end)
 * GET /api/assignments/[id]/sessions/[sessionId] - Get session details
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { assignmentDoor } from '@/app/lib/missionControl/guard';
import { firstWord } from '@/app/lib/searchText';

export const dynamic = 'force-dynamic';

// GET session details
export async function GET(request, { params }) {
  try {
    // One walk on one force's search for a pet. It took no sign-in and found the walk by its id alone, whatever
    // assignment the address named: any walk's id gave where that helper was. The walk has to be on the
    // assignment the address names, the reader has to be the owner, in a force looking for the pet, or staff,
    // and where the walker is goes to the walker, the owner and staff.
    const { id: assignmentId, sessionId } = await params;
    const door = await assignmentDoor(request, assignmentId);
    if (door.status !== 200) {
      return NextResponse.json({ error: door.status === 404 ? 'Assignment not found' : 'Only the owner and the forces looking for this pet can see this.', code: door.status === 404 ? 'NOT_FOUND' : 'NOT_ALLOWED' }, { status: door.status });
    }
    const viewerId = door.who.searcher?.userId || null;

    const row = typeof sessionId === 'string' && sessionId
      ? await prisma.searchSession.findFirst({
          where: { id: sessionId, participant: { assignmentId: door.assignment.id } },
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
            gridCell: true,
          },
        })
      : null;

    if (!row) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { userId, participant, startLocation, currentLocation, ...walk } = row;
    const mine = Boolean(viewerId && (userId === viewerId || participant?.userId === viewerId));
    const seesPlaces = Boolean(mine || door.who.searcher?.isOwner || door.who.staff);
    const searchSession = {
      ...walk,
      mine,
      walker: firstWord(participant?.user?.firstName) || 'A helper',
      ...(seesPlaces ? { startLocation, currentLocation } : {}),
    };

    return NextResponse.json({ session: searchSession });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

// PATCH - Update session (pause, resume, end)
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = params;
    const body = await request.json();
    const { action, notes, location } = body;

    // Find the session
    const searchSession = await prisma.searchSession.findUnique({
      where: { id: sessionId },
      include: {
        participant: {
          include: {
            user: true,
            assignment: {
              include: {
                case: true,
              },
            },
          },
        },
      },
    });

    if (!searchSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Verify ownership
    if (searchSession.participant.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only update your own session' },
        { status: 403 }
      );
    }

    let updateData = {};
    let logMessage = '';

    switch (action) {
      case 'pause':
        if (searchSession.status !== 'ACTIVE') {
          return NextResponse.json(
            { error: 'Can only pause active sessions' },
            { status: 400 }
          );
        }
        updateData = {
          status: 'PAUSED',
          pausedAt: new Date(),
        };
        logMessage = `${session.user.firstName || 'A volunteer'} paused their search`;
        break;

      case 'resume':
        if (searchSession.status !== 'PAUSED') {
          return NextResponse.json(
            { error: 'Can only resume paused sessions' },
            { status: 400 }
          );
        }
        updateData = {
          status: 'ACTIVE',
          pausedAt: null,
        };
        logMessage = `${session.user.firstName || 'A volunteer'} resumed searching`;
        break;

      case 'end':
        if (searchSession.status === 'COMPLETED') {
          return NextResponse.json(
            { error: 'Session already ended' },
            { status: 400 }
          );
        }

        const endTime = new Date();
        const startTime = new Date(searchSession.startedAt);
        const durationMinutes = Math.floor((endTime - startTime) / 60000);
        const durationHours = durationMinutes / 60;

        updateData = {
          status: 'COMPLETED',
          endedAt: endTime,
          notes: notes || null,
        };

        // Update participant's total search hours
        await prisma.caseParticipant.update({
          where: { id: searchSession.participantId },
          data: {
            searchHours: { increment: durationHours },
          },
        });

        logMessage = `${session.user.firstName || 'A volunteer'} ended their search (${durationMinutes} min)`;
        break;

      case 'update_location':
        if (location?.latitude != null && location?.longitude != null) {
          // SearchSession stores location as currentLocation (JSON) +
          // lastLocationUpdate; lastLatitude/lastLongitude/lastLocationAt don't
          // exist on the model and 500'd update_location.
          updateData = {
            currentLocation: JSON.stringify({ lat: location.latitude, lng: location.longitude }),
            lastLocationUpdate: new Date(),
          };
        }
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Update session
    const updatedSession = await prisma.searchSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    // Create activity log (except for location updates)
    if (logMessage) {
      await prisma.caseUpdate.create({
        data: {
          caseId: searchSession.participant.assignment.case.id, // CaseUpdate's field is caseId (no missionId)
          authorId: session.user.id,
          content: logMessage,
          isUpdate: true,
        },
      });
    }

    return NextResponse.json({ session: updatedSession });
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}
