/**
 * GET /api/geo/voice/clip?t=<round token>&n=<sentence index>
 *
 * One sentence of a Voices round, as audio (server/voice.js). The round
 * is named by its sealed token, never by a language or a text, so the
 * URL gives nothing away and nobody can ask for audio of anything but
 * a round the server dealt. The first request for a sentence makes the
 * clip with ElevenLabs and stores it; every later one plays the copy.
 */

import { NextResponse } from 'next/server';
import { GeoTokenError, openToken } from '@/app/lib/geo/server/tokens';
import { getGeoServerConfig } from '@/app/lib/geo/server/config';
import { languageByCode } from '@/app/lib/geo/languages';
import { passageSentences } from '@/app/lib/geo/server/scriptGame';
import { clipAudio, enabledVoices, VoiceError } from '@/app/lib/geo/server/voice';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';

export const dynamic = 'force-dynamic';

const STATUS_FOR = { no_key: 503, daily_cap: 429, upstream: 502 };

export async function GET(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('t') || '';
  const n = Math.floor(Number(url.searchParams.get('n')));
  const { tokenSecret } = getGeoServerConfig();
  let payload;
  try {
    payload = openToken(token, { secret: tokenSecret });
  } catch (error) {
    if (error instanceof GeoTokenError) return NextResponse.json({ error: 'That round is not valid or has expired', code: error.code }, { status: error.code === 'no_secret' ? 503 : 400 });
    throw error;
  }
  const language = languageByCode(payload.c);
  const sentences = language ? passageSentences(language, payload.seed, payload.i, tokenSecret) : [];
  if (!Number.isInteger(n) || n < 0 || n >= sentences.length) return NextResponse.json({ error: 'No such clip in this round', code: 'no_clip' }, { status: 404 });

  try {
    const voiceId = (await enabledVoices())[language.code];
    if (!voiceId) return NextResponse.json({ error: 'This language has no voice switched on', code: 'no_voice' }, { status: 404 });
    const audio = await clipAudio({ language: language.code, voiceId, text: sentences[n] });
    return new NextResponse(audio, {
      headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(audio.length), 'Cache-Control': 'private, max-age=86400' },
    });
  } catch (error) {
    if (error instanceof VoiceError) return NextResponse.json({ error: error.message, code: error.code }, { status: STATUS_FOR[error.code] || 500 });
    console.error('[geo/voice/clip]', error?.message || error);
    return NextResponse.json(schemaErrorBody(error, 'Could not load the audio'), { status: 500 });
  }
}
