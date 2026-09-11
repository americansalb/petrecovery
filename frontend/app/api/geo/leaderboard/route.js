/**
 * GET /api/geo/leaderboard?ladder=classic|duel
 *
 * The ladder: players with at least a few rated games, best rating
 * first, plus the asker's own row (x-geo-profile header or the game's own session cookie)
 * even when they are not on the board yet.
 */

import { NextResponse } from 'next/server';
import { accountFromRequest } from '@/app/lib/geo/server/identity';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { leaderboard, resolveProfile } from '@/app/lib/geo/server/profiles';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ladder = searchParams.get('ladder') || 'classic';
  try {
    const { profile } = await resolveProfile(prismaRoomStore, {
      token: request.headers.get('x-geo-profile') || '',
      accountId: accountFromRequest(request).accountId,
      createIfMissing: false,
    });
    const board = await leaderboard(prismaRoomStore, { ladder, limit: 50, profileId: profile?.id || null });
    return NextResponse.json({ ok: true, ...board }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[geo/leaderboard]', error);
    return NextResponse.json({ error: 'Could not load the leaderboard', code: 'internal' }, { status: 500 });
  }
}
