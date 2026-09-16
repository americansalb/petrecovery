/**
 * POST /api/geo/profile   { name }   header x-geo-profile (optional)
 *
 * Who you are across rooms, for ratings. Anonymous players get a token
 * on first call and keep it in the browser; signed-in players are bound
 * to their account so the rating follows them. Returns the profile with
 * its ratings per ladder and recent games. Never returns another
 * person's token.
 */

import { NextResponse } from 'next/server';
import { accountFromRequest } from '@/app/lib/geo/server/identity';
import { RateLimitPresets, rateLimitResponse, withRateLimitAsync } from '@/app/lib/geo/server/limiter';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { GeoSuspended, profileSummary, resolveProfile } from '@/app/lib/geo/server/profiles';
import { hashIp, usageToday } from '@/app/lib/geo/server/meter';
import { getGeoServerConfig } from '@/app/lib/geo/server/config';
import { getClientIP } from '@/app/lib/geo/server/limiter';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export async function POST(request) {
  const limit = await withRateLimitAsync(request, RateLimitPresets.PUBLIC_READ, 'geo-profile');
  if (!limit.success) return rateLimitResponse(limit);
  let body = {};
  try {
    body = (await request.json()) || {};
  } catch {
    body = {};
  }
  try {
    // The game's own session cookie (app/lib/geo/server/identity.js).
    const { accountId } = accountFromRequest(request);
    const { profile, token } = await resolveProfile(prismaRoomStore, {
      token: request.headers.get('x-geo-profile') || '',
      accountId,
      name: body?.name || '',
    });
    const summary = await profileSummary(prismaRoomStore, profile);
    // Today's meter (docs/GEO.md, "The play meter"), for the lobby.
    const subjects = { profile, profileId: profile.id, signedIn: Boolean(accountId), ipHash: hashIp(getClientIP(request), getGeoServerConfig().tokenSecret) };
    summary.usage = await usageToday(prismaRoomStore, subjects).catch(() => null);
    return NextResponse.json({ ok: true, token: token || undefined, profile: summary }, NO_STORE);
  } catch (error) {
    // A suspended account is refused rather than failed: 403 with a
    // reason the screen can show, not a 500 that reads as our fault.
    if (error instanceof GeoSuspended) {
      return NextResponse.json(
        { error: 'This account has been suspended.', code: 'suspended' },
        { status: 403, ...NO_STORE }
      );
    }
    console.error('[geo/profile]', error);
    // Name a missing table rather than saying "internal". This endpoint
    // 500ing for every visitor, while working locally, is exactly the
    // shape scripts/db-sync.js exists to prevent, and the generic
    // message gave nobody a way to tell.
    return NextResponse.json(schemaErrorBody(error, 'Could not load your profile'), { status: 500, ...NO_STORE });
  }
}
