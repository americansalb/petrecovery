import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';
import { mayKnowThePeople } from '@/app/lib/missionControl/guard';
import { firstWord } from '@/app/lib/searchText';
import { withRateLimitAsync, rateLimitResponse, RateLimitPresets } from '@/app/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mission/[missionId]/points/leaderboard
 * Get the leaderboard for a specific case
 *
 * Who did the most on one pet's search: for the owner, the forces looking
 * for the pet and staff (`mayKnowThePeople`). It answered any account with
 * each person's account id and full name. A person is a first name here,
 * and `mine` marks the reader's own row.
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await withRateLimitAsync(request, RateLimitPresets.SEARCH_READ, 'case:leaderboard');
    if (!limited.success) return rateLimitResponse(limited);

    const { missionId } = await params;
    const who = typeof missionId === 'string' && missionId ? await mayKnowThePeople(request, missionId) : { allowed: false, status: 404 };
    if (!who.allowed) {
      return NextResponse.json({ error: 'Only the owner and the forces looking for this pet can see this.', code: 'NOT_ALLOWED' }, { status: who.status });
    }

    // Aggregate verified points by user for this case
    const results = await prisma.verifiedAction.groupBy({
      by: ['userId'],
      where: { missionId },
      _sum: { totalPoints: true },
      orderBy: { _sum: { totalPoints: 'desc' } },
      take: 10,
    });

    // Get user names
    const userIds = results.map((r) => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const entries = results.map((r, index) => {
      const user = userMap.get(r.userId);
      return {
        userName: firstWord(user?.firstName) || 'A helper',
        mine: r.userId === session.user.id,
        points: r._sum.totalPoints || 0,
        rank: index + 1,
      };
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
