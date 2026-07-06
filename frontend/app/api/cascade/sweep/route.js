/**
 * POST (or GET) /api/cascade/sweep
 *
 * Secret-gated drain of due CaseFollowUp reminders. Point a scheduler (Render
 * Cron, GitHub Action, uptime pinger) at this a few times a day with the shared
 * secret and the day-1/3/7 check-ins go out punctually. Delivery is also
 * piggybacked opportunistically elsewhere, so this endpoint is about
 * punctuality, not correctness.
 *
 * Auth: `x-sweep-secret: <secret>` header or `Authorization: Bearer <secret>`,
 * matched against CASCADE_SWEEP_SECRET. If the env var is unset the endpoint is
 * disabled (503) rather than open.
 */

import { NextResponse } from 'next/server';
import { drainDueFollowUps } from '@/app/lib/cascade/followups';
import { logEvent } from '@/lib/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request) {
  const secret = process.env.CASCADE_SWEEP_SECRET;
  if (!secret) return { ok: false, disabled: true };
  const header = request.headers.get('x-sweep-secret');
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return { ok: header === secret || bearer === secret, disabled: false };
}

async function handle(request) {
  const auth = authorized(request);
  if (auth.disabled) {
    return NextResponse.json({ error: 'Sweep is not configured' }, { status: 503 });
  }
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit')) || 50, 100));

  const stats = await drainDueFollowUps({ limit });

  logEvent({
    event_type: 'cascade.followups.sweep',
    resource_type: 'case',
    action: 'update',
    result: 'success',
    metadata: stats,
  }).catch(() => {});

  return NextResponse.json({ ok: true, ...stats }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  return handle(request);
}

export async function GET(request) {
  return handle(request);
}
