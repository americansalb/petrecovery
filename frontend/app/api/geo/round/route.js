/**
 * POST /api/geo/round   { config, roundIndex }
 *
 * Finds imagery for one round and returns it with a sealed answer token.
 * Google: the server probes random points against the free Street View
 * metadata endpoint and returns only a panorama id. Apple: the browser
 * gets a short list of coordinates to try in order, each with its own
 * token. The answer never leaves the server in the clear.
 */

import { NextResponse } from 'next/server';
import { normalizeConfig } from '@/app/lib/geo/modes';
import { createRound, GeoGameError } from '@/app/lib/geo/server/game';
import { GeoSamplerError } from '@/app/lib/geo/server/sampler';

export const dynamic = 'force-dynamic';

const STATUS_FOR = {
  google_not_configured: 503,
  no_secret: 503,
  no_imagery: 422,
  probe_failed: 502,
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
  const roundIndex = Math.max(0, Math.min(999, Math.floor(Number(body?.roundIndex) || 0)));
  const attempt = Math.max(0, Math.min(20, Math.floor(Number(body?.attempt) || 0)));

  try {
    const round = await createRound({ config, roundIndex, attempt });
    return NextResponse.json({ ok: true, config, round }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof GeoGameError || error instanceof GeoSamplerError) {
      const status = STATUS_FOR[error.code] || 400;
      if (status >= 500) console.error('[geo/round]', error.code, error.message, error.upstream || '');
      return NextResponse.json(
        { error: error.message, code: error.code, stats: error.stats || null },
        { status, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    console.error('[geo/round] unexpected', error);
    return NextResponse.json({ error: 'Could not start the round', code: 'internal' }, { status: 500 });
  }
}
