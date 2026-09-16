/**
 * POST /api/geo/round   { config, roundIndex }
 *
 * A round and its sealed answer token. The browser gets a short list of
 * coordinates to try Look Around at, in order, each sealed on its own;
 * about one casual round in two hundred is a Not Earth panorama and one
 * token instead (app/lib/geo/notEarth.js). The answer never leaves the
 * server in the clear.
 *
 * The play meter runs first (docs/GEO.md, "The play meter"): the day's
 * ceiling, the speed limit and the site's day. A refusal is a 429 with a
 * code and our words.
 */

import { NextResponse } from 'next/server';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';
import { normalizeConfig } from '@/app/lib/geo/modes';
import { createRound, GeoGameError } from '@/app/lib/geo/server/game';
import { GeoSamplerError } from '@/app/lib/geo/server/sampler';
import { prismaRoundCache } from '@/app/lib/geo/server/roundCache';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';
import { checkRound, recordRound } from '@/app/lib/geo/server/meter';
import { meterErrorResponse, speedLimiter, subjectsFor } from '@/app/lib/geo/server/meterRequest';
import { MeterError } from '@/app/lib/geo/meter';
import { maybeSweep } from '@/app/lib/geo/server/sweep';

export const dynamic = 'force-dynamic';

const STATUS_FOR = {
  no_secret: 503,
  no_imagery: 422,
  no_candidates: 422,
  unknown_country: 400,
  unknown_continent: 400,
  unknown_mode: 400,
  no_cities: 400,
  empty_pool: 400,
};

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON body with the game config' }, { status: 400 });
  }
  const config = normalizeConfig(body?.config || body || {});
  // A game has as many rounds as its mode says; streak (rounds: 0) is
  // the only endless one. Without this a five-round daily could ask for
  // round 999 and be charged, scored and posted as one.
  const maxIndex = config.rounds > 0 ? config.rounds - 1 : 999;
  const roundIndex = Math.max(0, Math.min(maxIndex, Math.floor(Number(body?.roundIndex) || 0)));
  const attempt = Math.max(0, Math.min(20, Math.floor(Number(body?.attempt) || 0)));

  // Housekeeping, at most once an hour per process and never awaited:
  // the game has no scheduler and its tables are on the pet site's
  // database (app/lib/geo/server/sweep.js).
  maybeSweep(prismaRoomStore);

  // The meter. A store failure here is logged and the round goes on: a
  // round that cannot be counted is better than a round that cannot be
  // played, and the site's day is a shared-quota guard rather than a
  // bill.
  const subjects = await subjectsFor(request);
  // The daily and the cup are scored on a shared board, so they are
  // played as somebody. Without this, a round could be opened with no
  // identity, its answer read from /api/geo/guess for free, and then
  // played perfectly under a real profile: the round is deterministic
  // from its seed and cached, so the second draw is the same place.
  if ((config.mode === 'daily' || config.mode === 'cup') && !subjects.profileId) {
    return NextResponse.json(
      { error: 'The daily challenge and the weekly cup are scored on a board, so they need a play profile. Reload the page and start again.', code: 'no_profile' },
      { status: 401 }
    );
  }
  let decision = null;
  try {
    decision = await checkRound(prismaRoomStore, { subjects, limiter: speedLimiter });
  } catch (error) {
    if (error instanceof MeterError) return meterErrorResponse(error);
    console.error('[geo/round] meter', error?.message || error);
  }

  try {
    const round = await createRound({ config, roundIndex, attempt, subject: subjects.profileId || '', cache: prismaRoundCache });
    if (decision) await recordRound(prismaRoomStore, { subjects });
    return NextResponse.json({ ok: true, config, round }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof GeoGameError || error instanceof GeoSamplerError) {
      const status = STATUS_FOR[error.code] || 400;
      if (status >= 500) console.error('[geo/round]', error.code, error.message, error.upstream || '');
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    console.error('[geo/round] unexpected', error);
    return NextResponse.json(schemaErrorBody(error, 'Could not start the round'), { status: 500 });
  }
}
