/**
 * GET /api/geo/admin/voices/sample?language=<code>&voiceId=<id>
 *
 * A language's first sentence in a voice, so an admin can hear a voice
 * before switching the language on. It is made and stored like any other
 * clip (server/voice.js), so a voice that is kept costs nothing extra
 * when the round plays it.
 */

import { NextResponse } from 'next/server';
import { AdminDenied, requireAdmin } from '@/app/lib/geo/server/admin';
import { languageByCode } from '@/app/lib/geo/languages';
import { samplesFor } from '@/app/lib/geo/server/samples';
import { clipAudio, VoiceError } from '@/app/lib/geo/server/voice';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';

export const dynamic = 'force-dynamic';

const STATUS_FOR = { no_key: 503, daily_cap: 429, upstream: 502 };

export async function GET(request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    const language = languageByCode(url.searchParams.get('language') || '');
    const voiceId = (url.searchParams.get('voiceId') || '').trim();
    if (!language) return NextResponse.json({ error: 'No such language' }, { status: 400 });
    if (!/^[A-Za-z0-9]{8,40}$/.test(voiceId)) return NextResponse.json({ error: 'That does not look like an ElevenLabs voice id' }, { status: 400 });
    const [text] = samplesFor(language.code);
    if (!text) return NextResponse.json({ error: 'This language has no sentences' }, { status: 400 });
    const audio = await clipAudio({ language: language.code, voiceId, text });
    return new NextResponse(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AdminDenied) return NextResponse.json({ error: error.reason }, { status: 403 });
    if (error instanceof VoiceError) return NextResponse.json({ error: error.message, code: error.code }, { status: STATUS_FOR[error.code] || 500 });
    console.error('[geo/admin/voices/sample]', error?.message || error);
    return NextResponse.json(schemaErrorBody(error, 'server_error'), { status: 500 });
  }
}
