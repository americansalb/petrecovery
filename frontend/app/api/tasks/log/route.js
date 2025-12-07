import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { getPointsService } from '@/lib/actions/pointsService';
import { getTaskBasePoints } from '@/lib/taskDefinitions';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tasks/log
 * Log a self-reported task completion
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { caseId, taskId, actionType, notes } = await request.json();

    if (!taskId && !actionType) {
      return NextResponse.json(
        { error: 'taskId or actionType is required' },
        { status: 400 }
      );
    }

    const taskType = taskId || actionType;
    const basePoints = getTaskBasePoints(taskType);

    // Award self-reported points
    const pointsService = getPointsService(prisma);
    const result = await pointsService.awardSelfReportedPoints({
      userId: session.user.id,
      points: basePoints,
    });

    // Create a case update if caseId provided
    if (caseId) {
      await prisma.caseUpdate.create({
        data: {
          caseId,
          authorId: session.user.id,
          content: `Logged action: ${taskType}${notes ? ` - ${notes}` : ''}`,
          isUpdate: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      pointsEarned: result.awardedPoints,
      remainingDaily: result.dailyTotals.remaining,
      dailyTotals: result.dailyTotals,
    });
  } catch (error) {
    console.error('Error logging task:', error);
    return NextResponse.json(
      { error: 'Failed to log task' },
      { status: 500 }
    );
  }
}
