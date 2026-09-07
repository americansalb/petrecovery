/**
 * POST /api/geo/guess   { token, guess: { lat, lng } | { countryCode } | null }
 *
 * Scores a guess against the sealed token from /api/geo/round and reveals
 * the answer. A null guess (timer ran out) scores zero and still reveals.
 *
 * A daily challenge round is also recorded on the day's board for the
 * profile behind the request (docs/GEO.md, "The daily challenge"); the
 * first guess on a round is the one that counts. The reply then carries
 * `challenge` with the running total. Every scored round also earns
 * points and maybe a country badge for that profile (`points`).
 */

import { NextResponse } from 'next/server';
import { evaluateGuess } from '@/app/lib/geo/server/game';
import { GeoTokenError } from '@/app/lib/geo/server/tokens';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { dailyKey, recordChallengeRound } from '@/app/lib/geo/server/challenges';
import { awardSoloRound } from '@/app/lib/geo/server/points';
import { subjectsFor } from '@/app/lib/geo/server/meterRequest';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON body with the round token and your guess' }, { status: 400 });
  }
  if (!body?.token || typeof body.token !== 'string') {
    return NextResponse.json({ error: 'Missing round token', code: 'no_token' }, { status: 400 });
  }
  const guess = body.guess && typeof body.guess === 'object' ? body.guess : null;

  try {
    const result = evaluateGuess({ token: body.token, guess });
    let challenge = null;
    let points = null;
    const key = result.mode === 'daily' ? dailyKey(result.seed) : null;
    // The board and the points are for the profile behind the request.
    // The guess is scored either way; a failure here only loses a row.
    let profileId = null;
    try {
      ({ profileId } = await subjectsFor(request));
    } catch (error) {
      console.error('[geo/guess] profile', error?.message || error);
    }
    if (profileId && key) {
      try {
        challenge = await recordChallengeRound(prismaRoomStore, { profileId, key, index: result.roundIndex, score: result.score, distanceKm: result.distanceKm });
      } catch (error) {
        console.error('[geo/guess] daily board', error?.message || error);
      }
    }
    if (profileId) {
      try {
        points = await awardSoloRound(prismaRoomStore, { profileId, result });
      } catch (error) {
        console.error('[geo/guess] points', error?.message || error);
      }
    }
    return NextResponse.json({ ok: true, result, challenge, points }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof GeoTokenError) {
      const message =
        error.code === 'expired'
          ? 'This round has expired. Start a new game.'
          : error.code === 'no_secret'
            ? 'The server has no token secret configured'
            : 'That round token is not valid';
      return NextResponse.json({ error: message, code: error.code }, { status: error.code === 'no_secret' ? 503 : 400 });
    }
    console.error('[geo/guess] unexpected', error);
    return NextResponse.json({ error: 'Could not score the guess', code: 'internal' }, { status: 500 });
  }
}
