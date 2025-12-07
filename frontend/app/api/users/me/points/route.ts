/**
 * User Points API
 *
 * GET /api/users/me/points - Get current user's points summary
 *
 * See docs/Actions_Guide.md for full specification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { getPointsService, DAILY_SELF_REPORTED_CAP } from '@/lib/actions';

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /api/users/me/points
 *
 * Get current user's points summary
 *
 * Query params:
 * - caseId: Optional - get points for a specific case
 *
 * Returns:
 * - today: { verified, selfReported, total, remaining }
 * - allTime: { verified, selfReported, total }
 * - caseTotal: (if caseId provided)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId') || undefined;

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Use points service to get summary
    const pointsService = getPointsService(prisma);
    const summary = await pointsService.getPointsSummary(user.id, caseId);

    // Get recent verified actions for activity
    const recentActions = await prisma.verifiedAction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        actionType: true,
        totalPoints: true,
        createdAt: true,
        caseId: true,
      },
    });

    return NextResponse.json({
      today: {
        verified: summary.today.verified,
        selfReported: summary.today.selfReported,
        total: summary.today.total,
        remaining: summary.today.remaining,
        cap: DAILY_SELF_REPORTED_CAP,
      },
      allTime: {
        verified: summary.allTime.verified,
        selfReported: summary.allTime.selfReported,
        total: summary.allTime.total,
      },
      caseTotal: summary.caseTotal,
      recentActions: recentActions.map((action) => ({
        id: action.id,
        type: action.actionType,
        points: action.totalPoints,
        createdAt: action.createdAt,
        caseId: action.caseId,
      })),
    });
  } catch (error) {
    console.error('User points error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
