/**
 * Task Actions API
 *
 * POST /api/mission/[missionId]/tasks/[taskId] - Task actions (join, leave, complete, request-help)
 * GET /api/mission/[missionId]/tasks/[taskId] - Get task details
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { mayKnowThePeople } from '@/app/lib/missionControl/guard';
import { onlyText, cut, firstWord } from '@/app/lib/searchText';
import { withRateLimitAsync, rateLimitResponse, RateLimitPresets } from '@/app/lib/rateLimit';

const REFUSAL = { error: 'Only the owner and the forces looking for this pet can see this.', code: 'NOT_ALLOWED' };
const WRITE_LIMIT = { windowMs: 60 * 1000, maxRequests: 20, blockDurationMs: 60 * 1000 };
const MESSAGE_MAX = 500;

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /api/mission/[missionId]/tasks/[taskId]
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await withRateLimitAsync(request, RateLimitPresets.SEARCH_READ, 'case:task-read');
    if (!limited.success) return rateLimitResponse(limited);

    const { missionId, taskId } = await params;

    // Get current user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Who is on one task of one pet's search, and what the owner asked: for the owner, an active member of a
    // force looking for the pet, and staff. It answered any account, with each person's account id and full
    // name. A person is a first name here.
    if (typeof missionId !== 'string' || !missionId || typeof taskId !== 'string' || !taskId) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }
    const who = await mayKnowThePeople(request, missionId);
    if (!who.allowed) return NextResponse.json(REFUSAL, { status: who.status });

    // Get squad task if exists
    const squadTask = await prisma.squadTask.findFirst({
      where: { caseId: missionId, taskType: taskId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true },
            },
          },
        },
        completedBy: {
          select: { firstName: true },
        },
        createdBy: {
          select: { firstName: true },
        },
      },
    });

    // Check if current user is participant
    const isParticipant = squadTask?.participants.some(
      (p) => p.user.id === user.id
    ) || false;

    return NextResponse.json({
      squadTask: squadTask ? {
        id: squadTask.id,
        status: squadTask.status,
        ownerRequestedHelp: squadTask.ownerRequestedHelp,
        ownerRequestedAt: squadTask.ownerRequestedAt,
        ownerRequestedMessage: squadTask.ownerRequestedMessage,
        // A first name, and whether it is the reader. The account id is read to say that and is not sent.
        participants: squadTask.participants.map((p) => ({
          name: firstWord(p.user?.firstName) || 'A helper',
          mine: p.user?.id === user.id,
          joinedAt: p.joinedAt,
        })),
        completedAt: squadTask.completedAt,
        completedBy: squadTask.completedBy ? { firstName: firstWord(squadTask.completedBy.firstName) || 'A helper' } : null,
        createdBy: squadTask.createdBy ? { firstName: firstWord(squadTask.createdBy.firstName) || 'A helper' } : null,
      } : null,
      isParticipant,
    });
  } catch (error) {
    console.error('Task GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mission/[missionId]/tasks/[taskId]
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await withRateLimitAsync(request, WRITE_LIMIT, 'case:task-write');
    if (!limited.success) return rateLimitResponse(limited);

    const { missionId, taskId } = await params;
    const sent = await request.json().catch(() => null);
    const body = sent && typeof sent === 'object' && !Array.isArray(sent) ? sent : {};
    // What the owner writes when asking for help is text, held to a length.
    if (typeof body.message === 'string') body.message = cut(onlyText(body.message).trim(), MESSAGE_MAX);
    else delete body.message;

    // Get current user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get case
    const missionRecord = typeof missionId === 'string' && missionId && typeof taskId === 'string' && taskId
      ? await prisma.case.findUnique({
          where: { id: missionId },
          select: { id: true, reporterId: true },
        })
      : null;

    if (!missionRecord) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Joining, leaving and finishing a task on a pet's search is for the people on it: the owner, an active
    // member of a force looking for the pet, and staff. Any account could put itself on any pet's tasks.
    const who = await mayKnowThePeople(request, missionRecord.id);
    if (!who.allowed) return NextResponse.json(REFUSAL, { status: who.status });

    const isOwner = missionRecord.reporterId === user.id;

    switch (body.action) {
      case 'join':
        return handleJoin(user.id, missionId, taskId);

      case 'leave':
        return handleLeave(user.id, missionId, taskId);

      case 'complete':
        return handleComplete(user.id, missionId, taskId, body);

      case 'request-help':
        if (!isOwner) {
          return NextResponse.json(
            { error: 'Only the case owner can request help' },
            { status: 403 }
          );
        }
        return handleRequestHelp(user.id, missionId, taskId, body);

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: join, leave, complete, or request-help' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Task POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// ACTION HANDLERS
// =============================================================================

async function handleJoin(userId, missionId, taskId) {
  // Get or create squad task
  let squadTask = await prisma.squadTask.findFirst({
    where: { caseId: missionId, taskType: taskId },
  });

  if (!squadTask) {
    // Need to find a rescue force for this case
    const rescueSquad = await prisma.rescueForce.findFirst({
      where: { cases: { some: { id: missionId } } },
    });

    if (!rescueSquad) {
      return NextResponse.json(
        { error: 'No rescue force found for this case' },
        { status: 400 }
      );
    }

    squadTask = await prisma.squadTask.create({
      data: {
        rescueSquad: { connect: { id: rescueSquad.id } },
        caseId: missionId,
        taskType: taskId,
        title: taskId,
        type: 'OTHER',
        priority: 'MEDIUM',
        createdBy: { connect: { id: userId } },
        status: 'IN_PROGRESS',
      },
    });
  }

  // Check if already participant
  const existingParticipant = await prisma.taskParticipant.findFirst({
    where: { taskId: squadTask.id, userId },
  });

  if (existingParticipant) {
    return NextResponse.json({
      success: true,
      message: 'Already a participant',
      alreadyJoined: true,
    });
  }

  // Add as participant
  await prisma.taskParticipant.create({
    data: {
      task: { connect: { id: squadTask.id } },
      user: { connect: { id: userId } },
      joinedAt: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    message: 'Joined task',
    alreadyJoined: false,
  });
}

async function handleLeave(userId, missionId, taskId) {
  const squadTask = await prisma.squadTask.findFirst({
    where: { caseId: missionId, taskType: taskId },
  });

  if (!squadTask) {
    return NextResponse.json({
      success: true,
      message: 'Not a participant (no task exists)',
    });
  }

  // Remove participant
  await prisma.taskParticipant.deleteMany({
    where: { taskId: squadTask.id, userId },
  });

  return NextResponse.json({
    success: true,
    message: 'Left task',
  });
}

async function handleComplete(userId, missionId, taskId, body) {
  const { outcome, notes, photoUrl } = body;

  // Simple completion - award points
  const pointsEarned = 10;

  return NextResponse.json({
    success: true,
    pointsEarned,
    isVerified: false,
  });
}

async function handleRequestHelp(userId, missionId, taskId, body) {
  const { message } = body;

  // Get or create squad task
  let squadTask = await prisma.squadTask.findFirst({
    where: { caseId: missionId, taskType: taskId },
  });

  if (!squadTask) {
    // Need to find a rescue force for this case
    const rescueSquad = await prisma.rescueForce.findFirst({
      where: { cases: { some: { id: missionId } } },
    });

    if (!rescueSquad) {
      return NextResponse.json(
        { error: 'No rescue force found for this case' },
        { status: 400 }
      );
    }

    squadTask = await prisma.squadTask.create({
      data: {
        rescueSquad: { connect: { id: rescueSquad.id } },
        caseId: missionId,
        taskType: taskId,
        title: taskId,
        type: 'OTHER',
        priority: 'MEDIUM',
        createdBy: { connect: { id: userId } },
        status: 'AVAILABLE',
        ownerRequestedHelp: true,
        ownerRequestedAt: new Date(),
        ownerRequestedMessage: message,
      },
    });
  } else {
    squadTask = await prisma.squadTask.update({
      where: { id: squadTask.id },
      data: {
        ownerRequestedHelp: true,
        ownerRequestedAt: new Date(),
        ownerRequestedMessage: message,
      },
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Help requested',
    taskId: squadTask.id,
  });
}
