import { NextResponse } from 'next/server';
import { createDetectiveRound } from '@/app/lib/geo/server/scriptDetective';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid round request.' }, { status: 400 }); }
  try {
    return NextResponse.json({ round: createDetectiveRound({ config: body?.config, roundIndex: body?.roundIndex }) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error?.code === 'no_secret') return NextResponse.json({ error: 'The game is not configured yet.' }, { status: 503 });
    console.error('[geo/script/detective/round]', error?.message);
    return NextResponse.json({ error: 'Could not load a sentence. Try again.' }, { status: 500 });
  }
}
