import { NextResponse } from 'next/server';
import { checkRateLimitAsync, rateLimitResponse } from '@/app/lib/rateLimit';
import {
  TEAM_COOKIE,
  codeMatches,
  configuredTeamCode,
  hasTeamCookie,
  teamCookieOptions,
  teamCookieValue,
} from '@/app/rasuwa/team/teamAuth';

/**
 * The task force board's door.
 *
 * GET  -> { in, enabled }: does this browser already hold a valid
 *         board cookie, and is a code configured at all.
 * POST { code } -> sets the board cookie when the code matches.
 *
 * The middleware cap on /api/rasuwa/team/join is in-memory; guessing a
 * code is the one attack here that must survive a deploy, so POST also
 * checks the durable limiter (database-backed) with a block.
 */

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

export async function GET(request) {
  return NextResponse.json(
    { in: hasTeamCookie(request), enabled: configuredTeamCode() !== '' },
    NO_STORE
  );
}

export async function POST(request) {
  const durable = await checkRateLimitAsync(request, {
    windowMs: 60000,
    maxRequests: 20,
    blockDurationMs: 10 * 60 * 1000,
    keyPrefix: 'rasuwa-team-join',
  });
  if (!durable.success) return rateLimitResponse(durable);

  if (!configuredTeamCode()) {
    return NextResponse.json(
      { error: 'The board is not switched on yet. Ask the coordinators to set it up.' },
      { status: 503, ...NO_STORE }
    );
  }

  let code = '';
  try {
    const body = await request.json();
    code = String(body.code || '');
  } catch {
    // falls through to the mismatch answer below
  }

  if (!codeMatches(code)) {
    return NextResponse.json(
      { error: 'That code does not match. Check the group chat for the current one.' },
      { status: 403, ...NO_STORE }
    );
  }

  const res = NextResponse.json({ ok: true }, NO_STORE);
  res.cookies.set(TEAM_COOKIE, teamCookieValue(configuredTeamCode()), teamCookieOptions());
  return res;
}
