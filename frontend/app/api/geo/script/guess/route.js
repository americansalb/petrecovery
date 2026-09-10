/**
 * POST /api/geo/script/guess   { token, guess: { lat, lng } | null }
 *
 * Scores a pin against the sealed token from /api/geo/script/round and
 * reveals the language: its name, its endonym, its family, and every
 * region it is spoken in, so the result map can draw them. A null guess
 * (the clock ran out) scores zero and still reveals.
 *
 * Points and the daily board belong to the panorama game and are not
 * awarded here. Script rounds are unranked while the corpus is a
 * starting pool rather than a curated one: rating people on content
 * still being written would put noise in the ladder
 * (docs/WANDERGUESSER_STRATEGY.md, bet 1).
 */

import { NextResponse } from 'next/server';
import { GeoTokenError } from '@/app/lib/geo/server/tokens';
import { evaluateScriptGuess, ScriptGameError } from '@/app/lib/geo/server/scriptGame';

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
    const result = evaluateScriptGuess({ token: body.token, guess });
    return NextResponse.json({ ok: true, result }, { headers: { 'Cache-Control': 'no-store' } });
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
    if (error instanceof ScriptGameError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error('[geo/script/guess] unexpected', error);
    return NextResponse.json({ error: 'Could not score the guess', code: 'internal' }, { status: 500 });
  }
}
