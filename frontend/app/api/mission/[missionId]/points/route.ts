/**
 * Case Points & Leaderboard API
 *
 * GET /api/mission/[missionId]/points - Get leaderboard for this case
 *
 * See docs/Actions_Guide.md for full specification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { getPointsService } from '@/lib/actions';
import { mayKnowThePeople } from '@/app/lib/missionControl/guard';
import { firstWord } from '@/app/lib/searchText';
import { withRateLimitAsync, rateLimitResponse, RateLimitPresets } from '@/app/lib/rateLimit';

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
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await withRateLimitAsync(request, RateLimitPresets.SEARCH_READ, 'case:points');
    if (!limited.success) return rateLimitResponse(limited) as NextResponse;

    const { missionId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10) || 10, 1), 50);

    // Verify case exists
    const missionRecord = await prisma.case.findUnique({
      where: { id: missionId },
      select: { id: true },
    });

    if (!missionRecord) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Who did the most on one pet's search: for the owner, the forces looking for the pet and staff. It
    // answered any account with each person's account id and full name.
    const who = await mayKnowThePeople(request, missionRecord.id);
    if (!who.allowed) {
      return NextResponse.json({ error: 'Only the owner and the forces looking for this pet can see this.', code: 'NOT_ALLOWED' }, { status: who.status });
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
      where: { missionId },
      _sum: { totalPoints: true },
    });

    // Get total contributors
    const contributors = await prisma.verifiedAction.groupBy({
      by: ['userId'],
      where: { missionId },
    });

    // Find current user's rank if not in top
    let currentUserRank = null;
    let currentUserPoints = null;

    if (currentUser) {
      const userPoints = await prisma.verifiedAction.aggregate({
        where: { missionId, userId: currentUser.id },
        _sum: { totalPoints: true },
      });

      if (userPoints._sum.totalPoints) {
        currentUserPoints = userPoints._sum.totalPoints;

        // Count users with more points
        const usersAbove = await prisma.verifiedAction.groupBy({
          by: ['userId'],
          where: { missionId },
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
      // A first name, and whether the row is the reader's own. Never an account id or a last name.
      leaderboard: leaderboard.entries.map(({ userId, userName, ...entry }) => ({
        ...entry,
        userName: firstWord(userName) || 'A helper',
        isCurrentUser: currentUser?.id === userId,
      })),
      summary: {
        totalPoints: totalPoints._sum.totalPoints || 0,
        totalContributors: contributors.length,
      },
      currentUser: currentUser ? {
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
