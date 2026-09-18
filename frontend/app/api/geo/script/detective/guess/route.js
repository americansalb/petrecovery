import { NextResponse } from 'next/server';
import { evaluateDetectiveGuess } from '@/app/lib/geo/server/scriptDetective';
import { ScriptGameError } from '@/app/lib/geo/server/scriptGame';
import { GeoTokenError } from '@/app/lib/geo/server/tokens';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid guess.' }, { status: 400 }); }
  if (typeof body?.token !== 'string' || !body.token) return NextResponse.json({ error: 'This round is missing. Start again.' }, { status: 400 });
  try {
    return NextResponse.json({ result: evaluateDetectiveGuess({ token: body.token, guess: body.guess }) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof GeoTokenError || error instanceof ScriptGameError) return NextResponse.json({ error: error.code === 'expired' ? 'This round expired. Start a new game.' : 'That guess could not be checked. Try again.', code: error.code }, { status: 400 });
    console.error('[geo/script/detective/guess]', error?.message);
    return NextResponse.json({ error: 'Could not check your guess. Try again.' }, { status: 500 });
  }
}
