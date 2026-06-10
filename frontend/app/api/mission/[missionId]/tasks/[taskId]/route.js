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

    const { missionId, taskId } = await params;

    // Get current user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get squad task if exists
    const squadTask = await prisma.squadTask.findFirst({
      where: { caseId: missionId, taskType: taskId },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        completedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
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
        participants: squadTask.participants.map((p) => ({
          userId: p.user.id,
          name: `${p.user.firstName} ${p.user.lastName || ''}`.trim(),
          joinedAt: p.joinedAt,
        })),
        completedAt: squadTask.completedAt,
        completedBy: squadTask.completedBy,
        createdBy: squadTask.createdBy,
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

    const { missionId, taskId } = await params;
    const body = await request.json();

    // Get current user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get case
    const missionRecord = await prisma.case.findUnique({
      where: { id: missionId },
      select: { id: true, reporterId: true },
    });

    if (!missionRecord) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

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
    const rescueSquad = await prisma.rescueSquad.findFirst({
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
    const rescueSquad = await prisma.rescueSquad.findFirst({
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
