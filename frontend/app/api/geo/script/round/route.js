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
 */

import { NextResponse } from 'next/server';
import { normalizeScriptConfig } from '@/app/lib/geo/script';
import { createScriptRound, ScriptGameError } from '@/app/lib/geo/server/scriptGame';

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

  try {
    const round = createScriptRound({ config, roundIndex });
    return NextResponse.json({ ok: true, config, round }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ScriptGameError) {
      const status = STATUS_FOR[error.code] || 400;
      if (status >= 500) console.error('[geo/script/round]', error.code, error.message);
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error('[geo/script/round] unexpected', error);
    return NextResponse.json({ error: 'Could not build the round', code: 'internal' }, { status: 500 });
  }
}
