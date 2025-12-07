/**
 * Task Actions API
 *
 * POST /api/mission/[caseId]/tasks/[taskId] - Task actions (join, leave, complete, request-help)
 * GET /api/mission/[caseId]/tasks/[taskId] - Get task details
 *
 * See docs/Actions_Guide.md for full specification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { TASK_DEFINITIONS, getTaskBasePoints } from '@/lib/actions';
import { getPointsService, getVerificationService } from '@/lib/actions';

// =============================================================================
// TYPES
// =============================================================================

interface JoinBody {
  action: 'join';
}

interface LeaveBody {
  action: 'leave';
}

interface CompleteBody {
  action: 'complete';
  outcome?: string;
  notes?: string;
  photoUrl?: string;
}

interface RequestHelpBody {
  action: 'request-help';
  message?: string;
}

type TaskActionBody = JoinBody | LeaveBody | CompleteBody | RequestHelpBody;

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /api/mission/[caseId]/tasks/[taskId]
 *
 * Get detailed information about a specific task
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string; taskId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId, taskId } = await params;

    // Get task definition
    const taskDef = TASK_DEFINITIONS[taskId];
    if (!taskDef) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

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
      where: { caseId, taskType: taskId },
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
        creator: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Get verified actions for this task
    const verifiedActions = await prisma.verifiedAction.findMany({
      where: { caseId, actionType: taskId as any },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: { id: true, firstName: true },
        },
      },
    });

    // Check if current user is participant
    const isParticipant = squadTask?.participants.some(
      (p) => p.user.id === user.id
    ) || false;

    return NextResponse.json({
      task: {
        id: taskDef.id,
        displayName: taskDef.displayName,
        description: taskDef.description,
        category: taskDef.category,
        icon: taskDef.icon,
        basePoints: taskDef.basePoints,
        verificationMethod: taskDef.verificationMethod,
        tips: taskDef.tips,
      },
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
        creator: squadTask.creator,
      } : null,
      recentActivity: verifiedActions.map((va) => ({
        id: va.id,
        userId: va.user.id,
        userName: va.user.firstName,
        points: va.totalPoints,
        createdAt: va.createdAt,
      })),
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
 * POST /api/mission/[caseId]/tasks/[taskId]
 *
 * Perform task actions:
 * - action: 'join' - Add current user as participant
 * - action: 'leave' - Remove current user as participant
 * - action: 'complete' - Mark task complete with outcome
 * - action: 'request-help' - Owner requests help (sets ownerRequestedHelp flag)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string; taskId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId, taskId } = await params;
    const body: TaskActionBody = await request.json();

    // Get task definition
    const taskDef = TASK_DEFINITIONS[taskId];
    if (!taskDef) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get case
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true, reporterId: true, createdAt: true },
    });

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const isOwner = caseRecord.reporterId === user.id;

    switch (body.action) {
      case 'join':
        return handleJoin(user.id, caseId, taskId);

      case 'leave':
        return handleLeave(user.id, caseId, taskId);

      case 'complete':
        return handleComplete(user.id, caseId, taskId, body, caseRecord.createdAt);

      case 'request-help':
        if (!isOwner) {
          return NextResponse.json(
            { error: 'Only the case owner can request help' },
            { status: 403 }
          );
        }
        return handleRequestHelp(user.id, caseId, taskId, body);

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

/**
 * Join a task as participant
 */
async function handleJoin(
  userId: string,
  caseId: string,
  taskId: string
): Promise<NextResponse> {
  // Get or create squad task
  let squadTask = await prisma.squadTask.findFirst({
    where: { caseId, taskType: taskId },
  });

  if (!squadTask) {
    squadTask = await prisma.squadTask.create({
      data: {
        caseId,
        taskType: taskId,
        creatorId: userId,
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
      taskId: squadTask.id,
      userId,
      joinedAt: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    message: 'Joined task',
    alreadyJoined: false,
  });
}

/**
 * Leave a task
 */
async function handleLeave(
  userId: string,
  caseId: string,
  taskId: string
): Promise<NextResponse> {
  const squadTask = await prisma.squadTask.findFirst({
    where: { caseId, taskType: taskId },
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

/**
 * Complete a task (self-reported for non-GPS/non-email tasks)
 */
async function handleComplete(
  userId: string,
  caseId: string,
  taskId: string,
  body: CompleteBody,
  caseCreatedAt: Date
): Promise<NextResponse> {
  const { outcome, notes, photoUrl } = body;
  const taskDef = TASK_DEFINITIONS[taskId];

  // Check verification method
  const verificationMethod = taskDef.verificationMethod;

  // For PHOTO verification tasks, require photo
  if (verificationMethod === 'PHOTO') {
    if (!photoUrl) {
      return NextResponse.json(
        { error: 'Photo required for this task' },
        { status: 400 }
      );
    }

    // Create verified action with photo
    const verificationService = getVerificationService(prisma);
    const result = await verificationService.verifyPhotoAction({
      userId,
      caseId,
      actionType: taskId as any,
      photoUrl,
      notes,
      caseCreatedAt,
    });

    return NextResponse.json({
      success: true,
      pointsEarned: result.pointsEarned,
      isVerified: true,
      verifiedActionId: result.verifiedActionId,
    });
  }

  // For SELF_REPORT or null verification, award self-reported points
  if (!verificationMethod || verificationMethod === 'SELF_REPORT') {
    const basePoints = getTaskBasePoints(taskId);
    const pointsService = getPointsService(prisma);
    const result = await pointsService.awardSelfReportedPoints({
      userId,
      points: basePoints,
    });

    return NextResponse.json({
      success: true,
      pointsEarned: result.awardedPoints,
      isVerified: false,
      remainingDaily: result.dailyTotals.remaining,
    });
  }

  // For GPS/PLATFORM_EMAIL, they should use specific endpoints
  return NextResponse.json({
    success: true,
    message: `Use the specific ${verificationMethod} endpoint for this task`,
    pointsEarned: 0,
    isVerified: false,
  });
}

/**
 * Owner requests help on a task
 */
async function handleRequestHelp(
  userId: string,
  caseId: string,
  taskId: string,
  body: RequestHelpBody
): Promise<NextResponse> {
  const { message } = body;

  // Get or create squad task
  let squadTask = await prisma.squadTask.findFirst({
    where: { caseId, taskType: taskId },
  });

  if (!squadTask) {
    squadTask = await prisma.squadTask.create({
      data: {
        caseId,
        taskType: taskId,
        creatorId: userId,
        status: 'PENDING',
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
