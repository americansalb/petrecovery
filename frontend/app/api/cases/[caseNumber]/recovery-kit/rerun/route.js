/**
 * POST /api/cases/[caseNumber]/recovery-kit/rerun
 *
 * Regenerate the recovery kit (or a subset of it) — e.g. after the owner adds
 * a photo and wants fresh flyers. Owner-only (session must match the case
 * reporter) and rate-limited. Resets the targeted steps to PENDING and fires
 * the cascade again; runCascade skips still-SUCCESS steps, so only the reset
 * ones actually re-run and their CaseAssets are overwritten in place.
 *
 * Body: { only?: string[] } — action keys to regenerate. Omit for a full rerun.
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { authOptions } from '@/app/lib/auth';
import { withRateLimit, RateLimitPresets, rateLimitResponse } from '@/app/lib/rateLimit';
import { ENABLED_KEYS, enqueueCascade } from '@/app/lib/cascade/runCascade';
import { logEvent } from '@/lib/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request, { params }) {
  const { caseNumber } = params;

  const limit = withRateLimit(request, RateLimitPresets.PUBLIC_WRITE, 'recovery-kit:rerun');
  if (!limit.success) return rateLimitResponse(limit);

  const activation = await prisma.caseActivation.findUnique({
    where: { caseNumber },
    select: { id: true, caseId: true, correlationId: true },
  });
  if (!activation) {
    return NextResponse.json({ error: 'No recovery kit for this case' }, { status: 404 });
  }

  const caseRow = await prisma.case.findUnique({
    where: { id: activation.caseId },
    select: { id: true, reporterId: true, reportType: true },
  });
  if (!caseRow || caseRow.reportType !== 'LOST') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Owner-only: the session user must be the case reporter.
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.id !== caseRow.reporterId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const requested = Array.isArray(body?.only) ? body.only : null;
  const keys = requested
    ? requested.filter((k) => ENABLED_KEYS.includes(k))
    : ENABLED_KEYS;

  if (requested && keys.length === 0) {
    return NextResponse.json({ error: 'No valid action keys in `only`' }, { status: 400 });
  }

  // Reset the targeted steps so the cascade re-runs exactly them.
  await prisma.cascadeStep.updateMany({
    where: { activationId: activation.id, key: { in: keys } },
    data: { status: 'PENDING', error: null, count: null, startedAt: null, finishedAt: null },
  });

  enqueueCascade(activation.caseId, { correlationId: activation.correlationId });

  logEvent({
    event_type: 'cascade.recovery_kit.rerun',
    resource_type: 'case',
    resource_id: activation.caseId,
    action: 'update',
    result: 'success',
    metadata: { caseNumber, keys },
  }).catch(() => {});

  return NextResponse.json(
    { ok: true, rerunning: keys },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
