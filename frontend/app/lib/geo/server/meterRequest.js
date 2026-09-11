/**
 * The play meter's request side: who is asking, the speed limiter, and
 * the refusal as a response. Kept apart from meter.js so the room
 * engine and its tests never load next-auth.
 */

import { NextResponse } from 'next/server';
import { accountFromRequest } from './identity';
import { checkRateLimitForKeyAsync, getClientIP } from '@/app/lib/geo/server/limiter';
import { prismaRoomStore } from './roomStore';
import { resolveProfile } from './profiles';
import { getGeoServerConfig } from './config';
import { hashIp } from './meter';

/**
 * The subjects behind a request: the profile (the browser's token or
 * the game's own signed-in account; created only when asked), whether
 * they are signed in, and the hashed IP. Never throws: a failed lookup
 * leaves the profile out and the IP in.
 *
 * "Signed in" here means a WanderGuesser account, which is an email
 * address and nothing else. It has never meant a ReunitePets account
 * since phase 1.7 of the split; the two products do not share identity.
 */
export async function subjectsFor(request, { name = '', store = prismaRoomStore, createIfMissing = false } = {}) {
  // The game's own session cookie, not the pet site's (server/identity.js).
  const { accountId } = accountFromRequest(request);
  let profile = null;
  let token = null;
  try {
    const resolved = await resolveProfile(store, {
      token: request.headers.get('x-geo-profile') || '',
      accountId,
      name,
      createIfMissing,
    });
    profile = resolved.profile;
    token = resolved.token;
  } catch (error) {
    console.error('[geo/meter] profile lookup', error?.message || error);
  }
  return {
    profile,
    profileId: profile?.id || null,
    signedIn: Boolean(accountId),
    ipHash: hashIp(getClientIP(request), getGeoServerConfig().tokenSecret),
    token,
  };
}

/** The per-minute speed check on the site's rate limiter. */
export function speedLimiter(key, options) {
  return checkRateLimitForKeyAsync(key, options);
}

export function meterErrorResponse(error) {
  const retryAfter = Math.max(1, Math.ceil(((error.resetAt || Date.now() + 60000) - Date.now()) / 1000));
  return NextResponse.json(
    { error: error.message, code: error.code, provider: error.provider || null, resetAt: error.resetAt || null },
    { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(retryAfter) } }
  );
}
