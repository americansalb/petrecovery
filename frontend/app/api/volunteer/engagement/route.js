/**
 * Engagement API
 * Streaks, badges, leaderboards
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import {
  getEngagementStats,
  getDivisionLeaderboard,
  getSquadLeaderboard,
  checkAndAwardBadges,
} from '@/app/lib/volunteer/engagement';

export async function GET(request) {
  try {
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'stats';
    const divisionId = searchParams.get('divisionId');
    const squadId = searchParams.get('squadId');
    const period = searchParams.get('period') || 'week';

    switch (type) {
      case 'stats':
        const stats = await getEngagementStats(session.user.id);
        return NextResponse.json(stats);

      case 'divisionLeaderboard':
        if (!divisionId) {
          return NextResponse.json(
            { error: 'Division ID required' },
            { status: 400 }
          );
        }
        const divisionBoard = await getDivisionLeaderboard(divisionId, period);
        return NextResponse.json({ success: true, leaderboard: divisionBoard });

      case 'squadLeaderboard':
        if (!squadId) {
          return NextResponse.json(
            { error: 'Force ID required' },
            { status: 400 }
          );
        }
        const squadBoard = await getSquadLeaderboard(squadId, period);
        return NextResponse.json({ success: true, leaderboard: squadBoard });

      default:
        return NextResponse.json(
          { error: 'Invalid type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Engagement error:', error);
    return NextResponse.json(
      { error: 'Failed to get engagement data' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'checkBadges') {
      const awarded = await checkAndAwardBadges(session.user.id);
      return NextResponse.json({
        success: true,
        newBadges: awarded,
        message: awarded.length > 0
          ? `Congratulations! You earned ${awarded.length} new badge(s)!`
          : 'No new badges yet. Keep searching!',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Engagement action error:', error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}
