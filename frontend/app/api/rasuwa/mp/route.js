import { NextResponse } from 'next/server';
import { normalizePostalCode, parseMpResponse } from '@/app/rasuwa/mpLookup';

/**
 * POST /api/rasuwa/mp  { postalCode: "K1A 0A6" }
 *
 * Resolves a Canadian postal code to the Member of Parliament for the
 * /rasuwa letter wizard, via the Represent API (Open North; no key).
 * This proxy exists for the same reasons as the district lookup: one
 * egress point, a POST body so the postal code never rides in logged
 * query strings, nothing stored, nothing logged. Keep it that way; the
 * callers are families of missing people.
 *
 * Represent allows 60 requests per minute per client IP, and every
 * caller here shares this server's egress IP, so the middleware limit
 * ('/api/rasuwa/mp') stays well under that and failures degrade to the
 * wizard's enter-my-MP-by-hand path.
 */

export const dynamic = 'force-dynamic';

const NO_STORE = { headers: { 'Cache-Control': 'no-store' } };

// Server-wide upstream budget, on top of the per-visitor middleware
// limit: every caller shares this server's one egress IP, and Represent
// allows 60 calls a minute from it. A room of separate visitor IPs
// could otherwise add up past that and get the whole server blocked
// (per process; a burst across many instances can still exceed the
// ceiling, but each instance stays well under it).
const UPSTREAM_BUDGET_PER_MINUTE = 45;
const upstreamCalls = [];
function upstreamBudgetLeft() {
  const cutoff = Date.now() - 60000;
  while (upstreamCalls.length && upstreamCalls[0] < cutoff) upstreamCalls.shift();
  return upstreamCalls.length < UPSTREAM_BUDGET_PER_MINUTE;
}

async function fetchRepresent(code) {
  const res = await fetch(`https://represent.opennorth.ca/postcodes/${code}/`, {
    signal: AbortSignal.timeout(7000),
    cache: 'no-store',
    headers: { 'user-agent': 'rescueourfamily.org letter tool (Rasuwa flood family response)' },
  });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) throw new Error(`represent status ${res.status}`);
  return { data: await res.json() };
}

export async function POST(request) {
  let raw = '';
  try {
    const body = await request.json();
    raw = String(body.postalCode || '');
  } catch {
    // fall through to the validation below
  }
  const code = normalizePostalCode(raw);
  if (!code) {
    return NextResponse.json(
      { error: 'Enter a Canadian postal code, like K1A 0A6.' },
      { status: 400, ...NO_STORE }
    );
  }

  if (!upstreamBudgetLeft()) {
    return NextResponse.json(
      { error: 'A lot of people are looking up MPs right now. Wait a minute and try again, or enter your MP by hand below.' },
      { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } }
    );
  }

  let result;
  try {
    upstreamCalls.push(Date.now());
    try {
      result = await fetchRepresent(code);
    } catch {
      upstreamCalls.push(Date.now());
      result = await fetchRepresent(code);
    }
  } catch {
    return NextResponse.json(
      { error: 'The MP lookup did not respond. Enter your MP by hand below.' },
      { status: 502, ...NO_STORE }
    );
  }

  if (result.notFound) {
    return NextResponse.json(
      { error: 'No match for that postal code. Check it, or enter your MP by hand below.' },
      { status: 404, ...NO_STORE }
    );
  }

  const mp = parseMpResponse(result.data);
  if (!mp) {
    return NextResponse.json(
      { error: 'That postal code did not resolve to an MP. Enter your MP by hand below.' },
      { status: 404, ...NO_STORE }
    );
  }

  return NextResponse.json({ mp }, NO_STORE);
}
