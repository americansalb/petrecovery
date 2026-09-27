/**
 * POST /api/geo/script/round   { config, roundIndex }
 *
 * One round of the script game: a sentence, the writing system it is
 * in, and a sealed token holding the answer. The corpus stays on the
 * server, so the browser cannot look the sentence up.
 *
 * No play meter. A script round makes no upstream request and costs
 * nothing, so there is nothing to meter; the rate limit in middleware.js
 * is the only thing standing between this and a scraper.
 *
 * With `voice` in the config it is a Voices round (beta): the token and
 * how many clips to play, no text and no script id. The clips come from
 * /api/geo/voice/clip.
 */

import { NextResponse } from 'next/server';
import { normalizeScriptConfig } from '@/app/lib/geo/script';
import { createScriptRound, createVoiceRound, ScriptGameError } from '@/app/lib/geo/server/scriptGame';
import { enabledVoices } from '@/app/lib/geo/server/voice';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';
import { maybeSweep } from '@/app/lib/geo/server/sweep';
import { prismaRoomStore } from '@/app/lib/geo/server/roomStore';

export const dynamic = 'force-dynamic';

const STATUS_FOR = { no_secret: 503, empty_pool: 400, no_samples: 500 };

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON body with the game config' }, { status: 400 });
  }
  const config = normalizeScriptConfig(body?.config || body || {});
  const roundIndex = Math.max(0, Math.min(999, Math.floor(Number(body?.roundIndex) || 0)));

  // Housekeeping, the way /api/geo/round does it: at most once an hour
  // per process, never awaited, never able to fail the round. Script is
  // the game most people play now, and a site where nobody opened Street
  // would otherwise never sweep at all (app/lib/geo/server/sweep.js).
  maybeSweep(prismaRoomStore);

  try {
    // Voices (beta): drawn only from the languages with a voice switched
    // on, and sent without its text (server/scriptGame.js, createVoiceRound).
    const round = config.voice
      ? createVoiceRound({ config, roundIndex, voices: await enabledVoices() })
      : createScriptRound({ config, roundIndex });
    return NextResponse.json({ ok: true, config, round }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ScriptGameError) {
      const status = STATUS_FOR[error.code] || 400;
      if (status >= 500) console.error('[geo/script/round]', error.code, error.message);
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error('[geo/script/round] unexpected', error);
    return NextResponse.json(schemaErrorBody(error, 'Could not build the round'), { status: 500 });
  }
}
