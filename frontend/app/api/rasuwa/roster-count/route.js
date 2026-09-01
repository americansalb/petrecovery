import { NextResponse } from 'next/server';
import { ROSTER_COUNT_URL, LETTER_SIGNERS } from '@/app/rasuwa/letterData';
import { parseRosterCount } from '@/app/rasuwa/rosterCount';

/**
 * GET /api/rasuwa/roster-count -> { count, live }
 *
 * The current signer count on the families' roster, for the /rasuwa
 * landing pages, so the number grows with the movement instead of
 * sitting frozen at a printed figure. When the source is unset,
 * unreachable, or answers nonsense, this returns the letter's own
 * floor with live=false and the pages say "More than 3,160".
 *
 * The upstream is the organizers' Apps Script roster app, which Google
 * caps at 30 simultaneous executions, so the count is cached in-process
 * for ten minutes: page traffic must never spend that quota. The count
 * is the only thing fetched or returned; no visitor data is involved.
 * RASUWA_ROSTER_COUNT_URL overrides the source without a code change.
 *
 * Rate limited in middleware.js ('/api/rasuwa/roster-count').
 */

export const dynamic = 'force-dynamic';

const TTL_MS = 10 * 60 * 1000;
let cache = { at: 0, count: null };

async function fetchLiveCount() {
  const source = process.env.RASUWA_ROSTER_COUNT_URL || ROSTER_COUNT_URL;
  if (!source) return null;
  try {
    const res = await fetch(source, {
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!res.ok) return null;
    return parseRosterCount(await res.text());
  } catch {
    return null;
  }
}

export async function GET() {
  const now = Date.now();
  if (now - cache.at > TTL_MS) {
    // Both outcomes are cached: a dead source is re-tried every TTL,
    // not on every page view.
    cache = { at: now, count: await fetchLiveCount() };
  }
  const live = cache.count != null;
  return NextResponse.json(
    { count: live ? cache.count : LETTER_SIGNERS, live },
    { headers: { 'Cache-Control': 'public, max-age=300' } }
  );
}
