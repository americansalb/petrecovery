/**
 * GET  /api/geo/admin/voices
 * POST /api/geo/admin/voices   { language, voiceId, enabled }
 *
 * The Voices (beta) settings on /geo/admin: every Script language, the
 * ElevenLabs voice it speaks with, whether it is switched on, and how
 * many of its clips are stored (server/voice.js), plus the voices on the
 * ElevenLabs account to pick from. Whether the API key is set is reported
 * as a yes or no; the key itself never leaves the server.
 */

import { NextResponse } from 'next/server';
import { AdminDenied, requireAdmin } from '@/app/lib/geo/server/admin';
import { LANGUAGES } from '@/app/lib/geo/languages';
import { accountVoices, saveVoiceSetting, V3_LANGUAGES, voiceSettings, VoiceError } from '@/app/lib/geo/server/voice';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export async function GET(request) {
  try {
    await requireAdmin(request);
    const [settings, voices] = await Promise.all([voiceSettings(), accountVoices()]);
    const languages = LANGUAGES.map((language) => ({
      code: language.code,
      name: language.name,
      v3: V3_LANGUAGES.includes(language.code),
      voiceId: settings[language.code]?.voiceId || '',
      enabled: Boolean(settings[language.code]?.enabled),
      clips: settings[language.code]?.clips || 0,
    }));
    return NextResponse.json({ keySet: Boolean(process.env.ELEVENLABS_API_KEY), voices, languages }, NO_STORE);
  } catch (error) {
    if (error instanceof AdminDenied) return NextResponse.json({ error: error.reason }, { status: 403 });
    console.error('[geo/admin/voices]', error?.message || error);
    return NextResponse.json(schemaErrorBody(error, 'server_error'), { status: 500, ...NO_STORE });
  }
}

export async function POST(request) {
  try {
    await requireAdmin(request);
    const body = await request.json().catch(() => ({}));
    const row = await saveVoiceSetting({ language: body?.language, voiceId: body?.voiceId, enabled: body?.enabled });
    return NextResponse.json({ ok: true, voiceId: row.voiceId, enabled: row.enabled }, NO_STORE);
  } catch (error) {
    if (error instanceof AdminDenied) return NextResponse.json({ error: error.reason }, { status: 403 });
    if (error instanceof VoiceError) return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    console.error('[geo/admin/voices]', error?.message || error);
    return NextResponse.json(schemaErrorBody(error, 'server_error'), { status: 500, ...NO_STORE });
  }
}
