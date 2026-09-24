import { NextResponse } from 'next/server';
import { describeRateLimitBackend, rateLimitKeyIsSpoofable } from '@/app/lib/rateLimit';

/**
 * Operational status for the rate limiter, readable from outside the box.
 *
 * The plain /api/health probe is short-circuited in middleware for the load
 * balancer, so it can never report this. Rate limiting silently stopped holding
 * in production - honest same-IP requests were never turned away - and the cause
 * is which backend is actually live: in-memory is per-process, so on more than
 * one instance it never accumulates a shared count and every cap is advisory.
 * This reports the live backend and whether it survives a restart, so that can
 * be told apart from a working limiter without reading the host's logs.
 *
 * It exposes nothing an attacker cannot already learn by sending a burst and
 * watching for a 429; it names no host, URL or secret.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  let rateLimit;
  try {
    const backend = await describeRateLimitBackend();
    rateLimit = { ...backend, keySpoofable: rateLimitKeyIsSpoofable() };
  } catch (error) {
    rateLimit = { backend: 'unknown', durable: false, error: error.message };
  }
  return NextResponse.json(
    { status: 'ok', timestamp: new Date().toISOString(), rateLimit },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
