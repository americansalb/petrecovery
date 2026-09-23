import { NextResponse } from 'next/server';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { requireAccount } from '@/app/lib/geo/server/requireAccount';
import { subjectsFor } from '@/app/lib/geo/server/meterRequest';
import { matchmaking } from '@/app/lib/geo/server/matchmaking';
import { NO_STORE, roomErrorResponse } from '@/app/lib/geo/server/roomRoute';
import { accountFromRequest } from '@/app/lib/geo/server/identity';
import { checkRateLimitForKeyAsync, getClientIP, rateLimitResponse } from '@/app/lib/geo/server/limiter';

export const dynamic = 'force-dynamic';

/** One searching player polls fifteen times a minute (Matchmaker.js). */
const PER_ACCOUNT = { windowMs: 60000, maxRequests: 40, blockDurationMs: 60000 };

/**
 * An address may spend this many players' allowances. The same factor as
 * the middleware's address ceiling: a household, a classroom or a
 * carrier's shared address, and far below a flood.
 */
const ADDRESS_CEILING_FACTOR = 16;

export async function POST(request) {
  const denied = await requireAccount(request);
  if (denied) return denied;
  // Per account, which the session proves, then per address. Keyed on the
  // address alone, the third player searching from one school, office or
  // carrier address was refused, and the search gave up on them.
  const { accountId } = accountFromRequest(request);
  const address = getClientIP(request);
  const limit = await checkRateLimitForKeyAsync(`geo-matchmaking:${address}:${accountId}`, PER_ACCOUNT);
  if (!limit.success) return rateLimitResponse(limit);
  const ceiling = await checkRateLimitForKeyAsync(`geo-matchmaking:${address}`, {
    ...PER_ACCOUNT,
    maxRequests: PER_ACCOUNT.maxRequests * ADDRESS_CEILING_FACTOR,
  });
  if (!ceiling.success) return rateLimitResponse(ceiling);
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
