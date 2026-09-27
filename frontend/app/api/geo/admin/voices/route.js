/**
 * GET  /api/geo/admin/voices                 every Script language, for the list
 * GET  /api/geo/admin/voices?language=<code>  one language: its voices and sentences
 * POST /api/geo/admin/voices                 { action, ... }
 *
 * The Voices (beta) settings behind /geo/admin/voices (server/voice.js).
 * POST actions:
 *   language  { language, enabled }             switch a language in or out
 *   add       { language, voiceId, name, about, previewUrl, ownerId? }
 *             a voice from the account, a pasted id, or with `ownerId` a
 *             Voice Library voice, which is saved to My Voices first
 *   update    { id, enabled?, weight?, delivery? }
 *   remove    { id }                            the voice and its clips
 * Whether the API key is set is reported as a yes or no; the key itself
 * never leaves the server.
 */

import { NextResponse } from 'next/server';
import { AdminDenied, requireAdmin } from '@/app/lib/geo/server/admin';
import {
  addVoice,
  languageVoices,
  removeVoice,
  saveLibraryVoice,
  setLanguageEnabled,
  updateVoice,
  voiceOverview,
  VoiceError,
} from '@/app/lib/geo/server/voice';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const STATUS_FOR = { no_key: 503, daily_cap: 429, upstream: 502 };

function failure(error, where) {
  if (error instanceof AdminDenied) return NextResponse.json({ error: error.reason }, { status: 403, headers: NO_STORE });
  if (error instanceof VoiceError) {
    // An admin is told what ElevenLabs said, so a refusal can be acted on.
    const message = error.detail ? `${error.message}: ${error.detail}` : error.message;
    return NextResponse.json({ error: message, code: error.code }, { status: STATUS_FOR[error.code] || 400, headers: NO_STORE });
  }
  console.error(`[geo/admin/voices] ${where}`, error?.message || error);
  return NextResponse.json(schemaErrorBody(error, 'server_error'), { status: 500, headers: NO_STORE });
}

export async function GET(request) {
  try {
    await requireAdmin(request);
    const code = new URL(request.url).searchParams.get('language');
    const body = code ? { language: await languageVoices(code) } : await voiceOverview();
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
      case 'language': {
        const row = await setLanguageEnabled({ language: body.language, enabled: body.enabled });
        return NextResponse.json({ ok: true, enabled: row.enabled }, { headers: NO_STORE });
      }
      case 'add': {
        const voiceId = body.ownerId ? await saveLibraryVoice({ ownerId: body.ownerId, voiceId: body.voiceId, name: body.name }) : body.voiceId;
        const voice = await addVoice({ language: body.language, voiceId, name: body.name, about: body.about, previewUrl: body.previewUrl });
        return NextResponse.json({ ok: true, id: voice.id }, { headers: NO_STORE });
      }
      case 'update': {
        const { voice, languageOff } = await updateVoice({ id: body.id, enabled: body.enabled, weight: body.weight, delivery: body.delivery });
        return NextResponse.json({ ok: true, enabled: voice.enabled, weight: voice.weight, delivery: voice.delivery, languageOff }, { headers: NO_STORE });
      }
      case 'remove': {
        const { languageOff } = await removeVoice({ id: body.id });
        return NextResponse.json({ ok: true, languageOff }, { headers: NO_STORE });
      }
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: NO_STORE });
    }
  } catch (error) {
    return failure(error, 'POST');
  }
}
