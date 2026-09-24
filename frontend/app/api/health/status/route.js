import { NextResponse } from 'next/server';
import { describeRateLimitBackend, rateLimitKeyIsSpoofable, getClientIP } from '@/app/lib/rateLimit';

/**
 * Operational status for the rate limiter, readable from outside the box.
 *
 * The plain /api/health probe is short-circuited in middleware for the load
 * balancer, so it can never report this. Rate limiting silently stopped holding
 * in production - honest same-IP requests were never turned away. The backend
 * reports healthy and durable, so the remaining suspect is the key: every limit
 * is keyed by the caller's address, and if that value differs from one request
 * to the next, each request opens a fresh counter and no cap ever accumulates.
 *
 * observedClient echoes the address THIS request was keyed under (the caller's
 * own, and nobody else's). Call it twice: a value that changes between two
 * calls from one machine is the whole bug. It names no host, URL or secret, and
 * reveals nothing an attacker cannot already learn by sending a burst.
 */
export const dynamic = 'force-dynamic';

export async function GET(request) {
  let rateLimit;
  try {
    const backend = await describeRateLimitBackend();
    rateLimit = {
      ...backend,
      keySpoofable: rateLimitKeyIsSpoofable(),
      observedClient: getClientIP(request),
    };
  } catch (error) {
    rateLimit = { backend: 'unknown', durable: false, error: error.message };
  }
  return NextResponse.json(
    { status: 'ok', timestamp: new Date().toISOString(), rateLimit },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
