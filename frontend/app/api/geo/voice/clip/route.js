/**
 * GET /api/geo/voice/clip?t=<round token>&n=<sentence index>
 *
 * One sentence of a Voices round, as audio (server/voice.js). The round
 * is named by its sealed token, never by a language, a voice or a text,
 * so the URL gives nothing away and nobody can ask for audio of anything
 * but a round the server dealt. The first request for a sentence makes
 * the clip with ElevenLabs and stores it; every later one plays the copy.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/geo/server/db';
import { GeoTokenError, openToken } from '@/app/lib/geo/server/tokens';
import { getGeoServerConfig } from '@/app/lib/geo/server/config';
import { languageByCode } from '@/app/lib/geo/languages';
import { passageSentences } from '@/app/lib/geo/server/scriptGame';
import { voiceClip, VoiceError } from '@/app/lib/geo/server/voice';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';

export const dynamic = 'force-dynamic';

const STATUS_FOR = { no_key: 503, daily_cap: 429, upstream: 502, no_clip: 404 };

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
    // The voice the round was dealt, as long as it is still on for this
    // language: taking a voice off stops it at once, mid-round included.
    const voice = typeof payload.v === 'string' && payload.v ? await prisma.geoVoice.findUnique({ where: { id: payload.v } }) : null;
    if (!voice || voice.language !== language.code || !voice.enabled) {
      return NextResponse.json({ error: 'This round has no voice', code: 'no_voice' }, { status: 404 });
    }
    // An ElevenLabs voice's clip, or a person's approved take (server/recordings.js).
    const { audio, mime } = await voiceClip({ kind: voice.kind, language: language.code, voiceId: voice.voiceId, delivery: voice.delivery, text: sentences[n] });
    return new NextResponse(audio, {
      headers: { 'Content-Type': mime, 'Content-Length': String(audio.length), 'Cache-Control': 'private, max-age=86400' },
    });
  } catch (error) {
    // What ElevenLabs said stays in the log: a player only needs to know
    // the audio did not load.
    if (error instanceof VoiceError) return NextResponse.json({ error: error.message, code: error.code }, { status: STATUS_FOR[error.code] || 500 });
    console.error('[geo/voice/clip]', error?.message || error);
    return NextResponse.json(schemaErrorBody(error, 'Could not load the audio'), { status: 500 });
  }
}
