/**
 * GET  /api/geo/record          the languages open for recording, and the
 *                               signed-in person's progress in each
 * POST /api/geo/record          { action, ... }
 *   join    { name, agree }              agree to the terms, say how to be credited
 *   start   { language, region }         begin a language
 *   flag    { language, n, note }        say a sentence is wrong instead of reading it
 *   delete  { language? }                delete my recordings (one language, or all)
 *
 * Voices (beta): recordings from the public (server/recordings.js).
 * Reading the open languages needs no account; everything else needs a
 * game account, which is an email address confirmed by a code.
 */

import { NextResponse } from 'next/server';
import {
  contributorState,
  deleteRecordings,
  flagSentence,
  joinRecording,
  openLanguages,
  recorderFrom,
  RecordingError,
  startSet,
} from '@/app/lib/geo/server/recordings';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

function failure(error, where) {
  if (error instanceof RecordingError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: NO_STORE });
  console.error(`[geo/record] ${where}`, error?.message || error);
  return NextResponse.json(schemaErrorBody(error, 'Something went wrong'), { status: 500, headers: NO_STORE });
}

export async function GET(request) {
  try {
    const [open, me] = await Promise.all([openLanguages(), recorderFrom(request)]);
    if (!me) return NextResponse.json({ signedIn: false, open }, { headers: NO_STORE });
    return NextResponse.json({ signedIn: true, email: me.email, open, ...(await contributorState(me.accountId)) }, { headers: NO_STORE });
  } catch (error) {
    return failure(error, 'GET');
  }
}

export async function POST(request) {
  try {
    const me = await recorderFrom(request);
    if (!me) return NextResponse.json({ error: 'Sign in first', code: 'signed_out' }, { status: 401, headers: NO_STORE });
    const body = await request.json().catch(() => ({}));
    switch (body?.action) {
      case 'join':
        await joinRecording({ accountId: me.accountId, name: body.name, agree: body.agree });
        break;
      case 'start':
        await startSet({ accountId: me.accountId, language: body.language, region: body.region });
        break;
      case 'flag':
        await flagSentence({ accountId: me.accountId, language: body.language, n: body.n, note: body.note });
        break;
      case 'delete':
        await deleteRecordings({ accountId: me.accountId, language: body.language || '' });
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true, ...(await contributorState(me.accountId)) }, { headers: NO_STORE });
  } catch (error) {
    return failure(error, 'POST');
  }
}
