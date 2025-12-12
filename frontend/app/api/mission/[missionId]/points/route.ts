/**
 * Case Points & Leaderboard API
 *
 * GET /api/mission/[missionId]/points - Get leaderboard for this case
 *
 * See docs/Actions_Guide.md for full specification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { getPointsService } from '@/lib/actions';

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * GET /api/mission/[missionId]/points
 *
 * Get leaderboard for this case (per-mission points only)
 *
 * Returns top contributors ranked by verified + self-reported points
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { missionId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Verify case exists
    const missionRecord = await prisma.case.findUnique({
      where: { id: missionId },
      select: { id: true },
    });

    if (!missionRecord) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Get current user for highlighting
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    // Use points service to get leaderboard
    const pointsService = getPointsService(prisma);
    const leaderboard = await pointsService.getCaseLeaderboard(missionId, limit);

    // Get total points for the case
    const totalPoints = await prisma.verifiedAction.aggregate({
      where: { caseId: missionId },
      _sum: { totalPoints: true },
    });

    // Get total contributors
    const contributors = await prisma.verifiedAction.groupBy({
      by: ['userId'],
      where: { caseId: missionId },
    });

    // Find current user's rank if not in top
    let currentUserRank = null;
    let currentUserPoints = null;

    if (currentUser) {
      const userPoints = await prisma.verifiedAction.aggregate({
        where: { caseId: missionId, userId: currentUser.id },
        _sum: { totalPoints: true },
      });

      if (userPoints._sum.totalPoints) {
        currentUserPoints = userPoints._sum.totalPoints;

        // Count users with more points
        const usersAbove = await prisma.verifiedAction.groupBy({
          by: ['userId'],
          where: { caseId: missionId },
          _sum: { totalPoints: true },
          having: {
            totalPoints: {
              _sum: {
                gt: currentUserPoints,
              },
            },
          },
        });

        currentUserRank = usersAbove.length + 1;
      }
    }

    return NextResponse.json({
      leaderboard: leaderboard.entries.map((entry) => ({
        ...entry,
        isCurrentUser: currentUser?.id === entry.userId,
      })),
      summary: {
        totalPoints: totalPoints._sum.totalPoints || 0,
        totalContributors: contributors.length,
      },
      currentUser: currentUser ? {
        id: currentUser.id,
        rank: currentUserRank,
        points: currentUserPoints,
      } : null,
    });
  } catch (error) {
    console.error('Points leaderboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
