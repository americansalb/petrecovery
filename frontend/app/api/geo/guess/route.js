/**
 * POST /api/geo/guess   { token, guess: { lat, lng } | { countryCode } | null }
 *
 * Scores a guess against the sealed token from /api/geo/round and reveals
 * the answer. A null guess (timer ran out) scores zero and still reveals.
 */

import { NextResponse } from 'next/server';
import { evaluateGuess } from '@/app/lib/geo/server/game';
import { GeoTokenError } from '@/app/lib/geo/server/tokens';

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
    console.error('[geo/guess] unexpected', error);
    return NextResponse.json({ error: 'Could not score the guess', code: 'internal' }, { status: 500 });
  }
}
