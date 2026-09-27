/**
 * POST /api/geo/record/take?language=<code>&n=<sentence>&ms=<duration>
 *      the body is the recording itself, with its type as Content-Type
 * GET  /api/geo/record/take?id=<recording>
 *      one of the signed-in person's own takes, to play back
 *
 * Voices (beta): one sentence read aloud on /geo/record
 * (server/recordings.js). A new take of a sentence replaces the last and
 * waits for an admin again.
 */

import { NextResponse } from 'next/server';
import { MAX_TAKE_BYTES, ownTake, recorderFrom, RecordingError, saveTake } from '@/app/lib/geo/server/recordings';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * The body, read no further than the largest take kept: Content-Length
 * is the sender's word, and a body sent without one would otherwise be
 * read whole before it was measured.
 */
async function readLimited(request, max) {
  const reader = request.body?.getReader?.();
  if (!reader) return Buffer.from(await request.arrayBuffer());
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel().catch(() => {});
      throw new RecordingError('too_big', 'That recording is too long', 413);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

function failure(error, where) {
  if (error instanceof RecordingError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: NO_STORE });
  console.error(`[geo/record/take] ${where}`, error?.message || error);
  return NextResponse.json(schemaErrorBody(error, 'Something went wrong'), { status: 500, headers: NO_STORE });
}

export async function POST(request) {
  try {
    const me = await recorderFrom(request);
    if (!me) return NextResponse.json({ error: 'Sign in first', code: 'signed_out' }, { status: 401, headers: NO_STORE });
    // Refuse an oversized upload before reading it.
    if (Number(request.headers.get('content-length')) > MAX_TAKE_BYTES) {
      return NextResponse.json({ error: 'That recording is too long', code: 'too_big' }, { status: 413, headers: NO_STORE });
    }
    const url = new URL(request.url);
    const audio = await readLimited(request, MAX_TAKE_BYTES);
    const row = await saveTake({
      accountId: me.accountId,
      language: url.searchParams.get('language') || '',
      n: url.searchParams.get('n'),
      durationMs: url.searchParams.get('ms'),
      mime: request.headers.get('content-type') || '',
      audio,
    });
    return NextResponse.json({ ok: true, id: row.id, status: row.status }, { headers: NO_STORE });
  } catch (error) {
    return failure(error, 'POST');
  }
}

export async function GET(request) {
  try {
    const me = await recorderFrom(request);
    if (!me) return NextResponse.json({ error: 'Sign in first', code: 'signed_out' }, { status: 401, headers: NO_STORE });
    const { audio, mime } = await ownTake({ accountId: me.accountId, id: new URL(request.url).searchParams.get('id') });
    return new NextResponse(audio, { headers: { 'Content-Type': mime, 'Content-Length': String(audio.length), ...NO_STORE } });
  } catch (error) {
    return failure(error, 'GET');
  }
}
