/**
 * User Points History API
 *
 * GET /api/users/me/points/history - Get user's points history
 *
 * See docs/Actions_Guide.md for full specification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /api/users/me/points/history
 *
 * Get current user's points history
 *
 * Query params:
 * - days: Number of days to look back (default: 30, max: 90)
 * - missionId: Optional - filter to specific case
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90);
    const missionId = searchParams.get('missionId') || undefined;

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateString = startDate.toISOString().split('T')[0];

    // Get daily points logs
    const dailyLogs = await prisma.dailyPointsLog.findMany({
      where: {
        userId: user.id,
        date: { gte: startDateString },
      },
      orderBy: { date: 'desc' },
    });

    // Get verified actions for the period
    const actionsWhere: any = {
      userId: user.id,
      createdAt: { gte: startDate },
    };
    if (missionId) {
      actionsWhere.missionId = missionId;
    }

    const verifiedActions = await prisma.verifiedAction.findMany({
      where: actionsWhere,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        actionType: true,
        verificationMethod: true,
        totalPoints: true,
        basePoints: true,
        bonusPoints: true,
        multipliers: true,
        createdAt: true,
        missionId: true,
      },
    });

    // Format response
    return NextResponse.json({
      dailyLogs: dailyLogs.map((log) => ({
        date: log.date,
        verified: log.verifiedPoints,
        selfReported: log.selfReportedPoints,
        total: log.verifiedPoints + log.selfReportedPoints,
      })),
      verifiedActions: verifiedActions.map((action) => ({
        id: action.id,
        type: action.actionType,
        method: action.verificationMethod,
        points: action.totalPoints,
        basePoints: action.basePoints,
        bonusPoints: action.bonusPoints,
        multipliers: action.multipliers ? JSON.parse(action.multipliers) : [],
        createdAt: action.createdAt,
        missionId: action.missionId,
      })),
      summary: {
        days,
        totalDays: dailyLogs.length,
        totalVerified: dailyLogs.reduce((sum, log) => sum + log.verifiedPoints, 0),
        totalSelfReported: dailyLogs.reduce((sum, log) => sum + log.selfReportedPoints, 0),
        totalActions: verifiedActions.length,
      },
    });
  } catch (error) {
    console.error('Points history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
