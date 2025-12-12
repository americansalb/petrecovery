import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mission/[missionId]/points/leaderboard
 * Get the leaderboard for a specific case
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { missionId } = await params;

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
      select: { id: true, firstName: true, lastName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const entries = results.map((r, index) => {
      const user = userMap.get(r.userId);
      return {
        userId: r.userId,
        userName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Unknown',
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
