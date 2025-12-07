import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import prisma from '@/app/lib/db';
import {
  ACHIEVEMENTS,
  checkAchievements,
  calculateLevel,
  getLeaderboard,
  awardPoints,
} from '@/app/lib/gamification/challenges';

/**
 * GET /api/gamification/achievements
 * Get user achievements and leaderboard
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'user';

    if (type === 'leaderboard') {
      const period = searchParams.get('period') || 'weekly';
      const leaderboard = await getLeaderboard(prisma, { period });
      return NextResponse.json({ leaderboard });
    }

    // Get user's achievements
    const userAchievements = await prisma.userAchievement.findMany({
      where: { userId: session.user.id },
    });

    // Get user's stats
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        successfulReunions: true,
        areasMarkedCount: true,
        squadsJoinedCount: true,
      },
    });

    // Calculate level
    const points =
      (user.successfulReunions || 0) * 1000 +
      (user.areasMarkedCount || 0) * 10 +
      (user.squadsJoinedCount || 0) * 50;

    const level = calculateLevel(points);

    return NextResponse.json({
      achievements: {
        earned: userAchievements.map(ua => ({
          ...ACHIEVEMENTS[ua.achievementId.toUpperCase()],
          earnedAt: ua.earnedAt,
        })),
        available: Object.values(ACHIEVEMENTS),
      },
      level,
      points,
    });
  } catch (error) {
    console.error('Achievements error:', error);
    return NextResponse.json(
      { error: 'Failed to get achievements' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gamification/achievements
 * Award points or check for new achievements
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, points, reason } = body;

    if (action === 'award') {
      const result = await awardPoints(prisma, session.user.id, points, reason);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Achievement action error:', error);
    return NextResponse.json(
      { error: 'Action failed' },
      { status: 500 }
    );
  }
}
