/**
 * GET  /api/geo/admin/recordings?view=queue|speakers|languages&language=<code>
 * POST /api/geo/admin/recordings   { action, ... }
 *   review    { id, decision: approve|reject|dismiss, reason? }
 *   approveSet { setId }       every take still waiting in one person's language
 *   addVoice  { setId }        a fully approved set into Voices games
 *   open      { language, open }  open or close a language on /geo/record
 *
 * Voices (beta): what the public recorded, behind /geo/admin/recordings
 * (server/recordings.js).
 */

import { NextResponse } from 'next/server';
import { AdminDenied, requireAdmin } from '@/app/lib/geo/server/admin';
import {
  addSetAsVoice,
  approveSet,
  recordingLanguages,
  RecordingError,
  reviewQueue,
  reviewTake,
  setRecordingOpen,
  speakerSets,
} from '@/app/lib/geo/server/recordings';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

function failure(error, where) {
  if (error instanceof AdminDenied) return NextResponse.json({ error: error.reason }, { status: 403, headers: NO_STORE });
  if (error instanceof RecordingError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: NO_STORE });
  console.error(`[geo/admin/recordings] ${where}`, error?.message || error);
  return NextResponse.json(schemaErrorBody(error, 'server_error'), { status: 500, headers: NO_STORE });
}

export async function GET(request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const language = url.searchParams.get('language') || '';
    const view = url.searchParams.get('view') || 'queue';
    const body = view === 'speakers' ? { sets: await speakerSets({ language }) } : view === 'languages' ? { languages: await recordingLanguages() } : await reviewQueue({ language });
    return NextResponse.json(body, { headers: NO_STORE });
  } catch (error) {
    return failure(error, 'GET');
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    switch (body?.action) {
      case 'review': {
        const row = await reviewTake({ id: body.id, decision: body.decision, reason: body.reason });
        return NextResponse.json({ ok: true, status: row.status }, { headers: NO_STORE });
      }
      case 'approveSet':
        return NextResponse.json({ ok: true, ...(await approveSet({ setId: body.setId })) }, { headers: NO_STORE });
      case 'addVoice': {
        const voice = await addSetAsVoice({ setId: body.setId });
        return NextResponse.json({ ok: true, voiceId: voice.id, language: voice.language }, { headers: NO_STORE });
      }
      case 'open': {
        const row = await setRecordingOpen({ language: body.language, open: body.open });
        return NextResponse.json({ ok: true, open: row.recording }, { headers: NO_STORE });
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: NO_STORE });
    }
  } catch (error) {
    return failure(error, 'POST');
  }
}
