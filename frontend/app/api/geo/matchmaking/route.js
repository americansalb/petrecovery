import { NextResponse } from 'next/server';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { requireAccount } from '@/app/lib/geo/server/requireAccount';
import { subjectsFor } from '@/app/lib/geo/server/meterRequest';
import { matchmaking } from '@/app/lib/geo/server/matchmaking';
import { NO_STORE, roomErrorResponse } from '@/app/lib/geo/server/roomRoute';
import { withRateLimitAsync, rateLimitResponse } from '@/app/lib/geo/server/limiter';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const denied = await requireAccount(request);
  if (denied) return denied;
  const limit = await withRateLimitAsync(request, { windowMs: 60000, maxRequests: 40, blockDurationMs: 60000 }, 'geo-matchmaking');
  if (!limit.success) return rateLimitResponse(limit);
  try {
    const raw = await request.text();
    if (raw.length > 2000) return NextResponse.json({ error: 'Request too large.' }, { status: 413, ...NO_STORE });
    let body;
    try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Send a valid game choice.' }, { status: 400, ...NO_STORE }); }
    const subjects = await subjectsFor(request, { createIfMissing: true });
    // Profile and account identity come only from the verified session, never JSON.
    return NextResponse.json(await matchmaking(prismaRoomStore, { subjects, game: body?.game, action: body?.action }), NO_STORE);
  } catch (error) { return roomErrorResponse(error, 'matchmaking'); }
}
