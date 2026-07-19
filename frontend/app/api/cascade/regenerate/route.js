/**
 * POST /api/cascade/regenerate?case=<Case.id | Case.caseNumber>
 *
 * Regenerate a case's cascade ASSETS (AI copy + flyers + social cards) with
 * the current renderers, overwriting the stored CDN assets. Cascade assets
 * are otherwise frozen at report time, so cases created before a design or
 * copy change keep old artwork forever — this endpoint refreshes them.
 * It does NOT re-send notifications, emails, or alerts.
 *
 * Auth: same shared secret as /api/cascade/sweep (`x-sweep-secret` header or
 * `Authorization: Bearer`), matched against CASCADE_SWEEP_SECRET. Disabled
 * (503) when the env var is unset.
 */

import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { seedActivation, makeGetShared } from '@/app/lib/cascade/runCascade';
import { upsertStep, upsertAsset } from '@/app/lib/cascade/store';
import { generateAiCopy } from '@/app/lib/cascade/aiCopy';
import { runFlyers } from '@/app/lib/cascade/actions/flyers';
import { runSocial } from '@/app/lib/cascade/actions/social';
import { runShareTargets } from '@/app/lib/cascade/actions/shareTargets';
import { logEvent } from '@/lib/logging';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CASCADE_SWEEP_SECRET;
  if (!secret) return { ok: false, disabled: true };
  const header = request.headers.get('x-sweep-secret');
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return { ok: header === secret || bearer === secret, disabled: false };
}

export async function POST(request) {
  const auth = authorized(request);
  if (auth.disabled) return NextResponse.json({ error: 'Regenerate is not configured' }, { status: 503 });
  if (!auth.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ref = new URL(request.url).searchParams.get('case');
  if (!ref) return NextResponse.json({ error: 'Missing ?case=<id or caseNumber>' }, { status: 400 });

  const caseData = await prisma.case.findFirst({
    where: { OR: [{ id: ref }, { caseNumber: ref }] },
    include: { pet: true },
  });
  if (!caseData) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

  const correlationId = `regen-${caseData.caseNumber}`;
  const activation = await seedActivation(caseData, correlationId);

  const ctx = {
    case: caseData,
    activation,
    correlationId,
    results: {},
    getShared: makeGetShared(caseData),
    upsertStep: (key, patch) => upsertStep(activation, key, patch),
    upsertAsset: (kind, patch) => upsertAsset(activation, kind, patch),
  };

  const outcome = { aiCopy: 'skipped', flyers: 'failed', social: 'failed' };

  // Fresh copy pack first (falls back deterministically without an API key),
  // persisted onto the ai_copy step so the case page's captions and search
  // plan refresh along with the artwork.
  try {
    const copy = await generateAiCopy(caseData);
    ctx.results.ai_copy = copy;
    await upsertStep(activation, 'ai_copy', { status: 'SUCCESS', result: copy, finishedAt: new Date() });
    outcome.aiCopy = copy.source;
  } catch (err) {
    outcome.aiCopy = `failed: ${String(err?.message || err).slice(0, 120)}`;
  }

  try {
    const r = await runFlyers(ctx);
    outcome.flyers = `${r.count} ready`;
  } catch (err) {
    outcome.flyers = `failed: ${String(err?.message || err).slice(0, 120)}`;
  }

  try {
    const r = await runSocial(ctx);
    outcome.social = `${r.count} ready`;
  } catch (err) {
    outcome.social = `failed: ${String(err?.message || err).slice(0, 120)}`;
  }

  try {
    const r = await runShareTargets(ctx);
    await upsertStep(activation, 'share_targets', { status: 'SUCCESS', count: r.count, result: r.result, finishedAt: new Date() });
    outcome.shareTargets = `${r.count} targets`;
  } catch (err) {
    outcome.shareTargets = `failed: ${String(err?.message || err).slice(0, 120)}`;
  }

  logEvent({
    event_type: 'cascade.regenerate',
    correlation_id: correlationId,
    resource_type: 'case',
    resource_id: caseData.id,
    action: 'update',
    result: 'success',
    metadata: outcome,
  }).catch(() => {});

  return NextResponse.json(
    { ok: true, caseNumber: caseData.caseNumber, ...outcome },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
