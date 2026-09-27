/**
 * GET  /api/geo/admin/voices/clip?voice=<GeoVoice id>&n=<sentence>
 * POST /api/geo/admin/voices/clip   { voice, n, remake? }
 *
 * One of a language's sentences in one of its voices, for the admin to
 * hear before switching a voice on (server/voice.js). GET plays it,
 * making it first if it has not been made; POST makes it without
 * sending the audio back ("Make the rest"), or with `remake` throws the
 * stored take away and makes a new one. Every clip made here is the one
 * rounds play, so checking a voice costs nothing extra later.
 */

import { NextResponse } from 'next/server';
import { AdminDenied, requireAdmin } from '@/app/lib/geo/server/admin';
import { adminClip, clipAudio, remakeClip, VoiceError } from '@/app/lib/geo/server/voice';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const STATUS_FOR = { no_key: 503, daily_cap: 429, upstream: 502, no_voice: 404, no_clip: 404 };

function failure(error) {
  if (error instanceof AdminDenied) return NextResponse.json({ error: error.reason }, { status: 403, headers: NO_STORE });
  if (error instanceof VoiceError) {
    const message = error.detail ? `${error.message}: ${error.detail}` : error.message;
    return NextResponse.json({ error: message, code: error.code }, { status: STATUS_FOR[error.code] || 400, headers: NO_STORE });
  }
  console.error('[geo/admin/voices/clip]', error?.message || error);
  return NextResponse.json(schemaErrorBody(error, 'server_error'), { status: 500, headers: NO_STORE });
}

export async function GET(request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const audio = await clipAudio(await adminClip({ voice: url.searchParams.get('voice'), n: url.searchParams.get('n') }));
    return new NextResponse(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(audio.length), ...NO_STORE } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const clip = await adminClip({ voice: body?.voice, n: body?.n });
    await (body?.remake ? remakeClip(clip) : clipAudio(clip));
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    return failure(error);
  }
}
