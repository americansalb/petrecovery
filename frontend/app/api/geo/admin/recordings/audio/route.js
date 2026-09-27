/**
 * GET /api/geo/admin/recordings/audio?id=<recording>
 *
 * Any take from /geo/record, for an admin to hear before deciding
 * (server/recordings.js).
 */

import { NextResponse } from 'next/server';
import { AdminDenied, requireAdmin } from '@/app/lib/geo/server/admin';
import { RecordingError, takeAudio } from '@/app/lib/geo/server/recordings';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request) {
  try {
    await requireAdmin(request);
    const { audio, mime } = await takeAudio(new URL(request.url).searchParams.get('id'));
    return new NextResponse(audio, { headers: { 'Content-Type': mime, 'Content-Length': String(audio.length), ...NO_STORE } });
  } catch (error) {
    if (error instanceof AdminDenied) return NextResponse.json({ error: error.reason }, { status: 403, headers: NO_STORE });
    if (error instanceof RecordingError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: NO_STORE });
    console.error('[geo/admin/recordings/audio]', error?.message || error);
    return NextResponse.json(schemaErrorBody(error, 'server_error'), { status: 500, headers: NO_STORE });
  }
}
