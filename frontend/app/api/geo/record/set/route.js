/**
 * GET /api/geo/record/set?language=<code>
 *
 * The studio's page: every sentence of one language and where the
 * signed-in person's take of each one stands (server/recordings.js).
 */

import { NextResponse } from 'next/server';
import { recorderFrom, RecordingError, setDetail } from '@/app/lib/geo/server/recordings';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request) {
  try {
    const me = await recorderFrom(request);
    if (!me) return NextResponse.json({ error: 'Sign in first', code: 'signed_out' }, { status: 401, headers: NO_STORE });
    const language = new URL(request.url).searchParams.get('language') || '';
    return NextResponse.json(await setDetail({ accountId: me.accountId, language }), { headers: NO_STORE });
  } catch (error) {
    if (error instanceof RecordingError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: NO_STORE });
    console.error('[geo/record/set]', error?.message || error);
    return NextResponse.json(schemaErrorBody(error, 'Something went wrong'), { status: 500, headers: NO_STORE });
  }
}
