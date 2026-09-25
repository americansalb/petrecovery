/**
 * POST /api/geo/script/report   { token, kind, note?, guess? }
 *
 * "Something wrong?" from the Script answer screen: the player says the
 * map, a hint or the language is wrong, or something else is, and can
 * add a line about it. `kind` is one of area, hint, language, other.
 *
 * The round token is what names the language and the text, so a report
 * can only be about a round the server dealt (server/reports.js). The
 * same person reporting the same thing about the same language twice in
 * a day is stored once, which keeps the counts on the admin screen
 * honest. The rate limit in middleware.js caps everything else.
 */

import { NextResponse } from 'next/server';
import { GeoTokenError } from '@/app/lib/geo/server/tokens';
import { ScriptGameError } from '@/app/lib/geo/server/scriptGame';
import { fileReport, reportFromRound, ReportError } from '@/app/lib/geo/server/reports';
import { hashIp } from '@/app/lib/geo/server/meter';
import { getClientIP } from '@/app/lib/geo/server/limiter';
import { getGeoServerConfig } from '@/app/lib/geo/server/config';
import { schemaErrorBody } from '@/app/lib/geo/server/schemaError';

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Send a JSON body with the round and what is wrong', code: 'bad_body' }, { status: 400 });
  }

  let report;
  try {
    report = reportFromRound({ token: body?.token, kind: body?.kind, note: body?.note, guess: body?.guess });
  } catch (error) {
    if (error instanceof GeoTokenError) {
      const message = error.code === 'expired' ? 'This round is too old to report. Report it from a new round.' : 'That round token is not valid';
      return NextResponse.json({ error: message, code: error.code }, { status: error.code === 'no_secret' ? 503 : 400 });
    }
    if (error instanceof ReportError || error instanceof ScriptGameError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }
    console.error('[geo/script/report] unexpected', error);
    return NextResponse.json({ error: 'Could not send the report', code: 'internal' }, { status: 500 });
  }

  try {
    const ipHash = hashIp(getClientIP(request), getGeoServerConfig().tokenSecret);
    await fileReport(report, { ipHash });
    return NextResponse.json({ ok: true }, NO_STORE);
  } catch (error) {
    console.error('[geo/script/report]', error?.message || error);
    return NextResponse.json(schemaErrorBody(error, 'Could not send the report'), { status: 500, ...NO_STORE });
  }
}
