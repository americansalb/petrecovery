/**
 * Prisma persistence helpers for the cascade. Every action's output is written
 * through these so the success screen + case page can always read the current
 * state from the DB (SSE is only a live-update enhancement).
 */

import prisma from '@/app/lib/prisma';

/** Upsert a CascadeStep by (activationId, key) — idempotent across re-runs. */
export async function upsertStep(activation, key, patch = {}) {
  const base = {
    activationId: activation.id,
    caseId: activation.caseId,
    caseNumber: activation.caseNumber,
    key,
  };
  return prisma.cascadeStep.upsert({
    where: { activationId_key: { activationId: activation.id, key } },
    create: { ...base, status: 'PENDING', ...patch },
    update: patch,
  });
}

/** Upsert a CaseAsset by (caseId, kind) — deterministic, re-run overwrites. */
export async function upsertAsset(activation, kind, patch = {}) {
  const base = {
    activationId: activation.id,
    caseId: activation.caseId,
    caseNumber: activation.caseNumber,
    kind,
  };
  return prisma.caseAsset.upsert({
    where: { caseId_kind: { caseId: activation.caseId, kind } },
    create: { ...base, status: 'pending', ...patch },
    update: patch,
  });
}

/**
 * Recompute the denormalized CaseActivation.summary from step + asset rows so a
 * single read renders the dashboard. Also derives the overall status.
 */
export async function rollupSummary(activation) {
  const [steps, assets] = await Promise.all([
    prisma.cascadeStep.findMany({ where: { activationId: activation.id } }),
    prisma.caseAsset.findMany({ where: { activationId: activation.id } }),
  ]);

  const byStatus = (rows) =>
    rows.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

  const terminal = steps.length > 0 && steps.every((s) => ['SUCCESS', 'FAILED', 'SKIPPED'].includes(s.status));
  const anyFailed = steps.some((s) => s.status === 'FAILED');
  const allDone = terminal && !anyFailed;

  const summary = {
    steps: steps.map((s) => ({ key: s.key, status: s.status, count: s.count ?? undefined })),
    stepStatus: byStatus(steps),
    assetsReady: assets.filter((a) => a.status === 'ready').length,
    assetKindsReady: assets.filter((a) => a.status === 'ready').map((a) => a.kind),
    updatedAt: activation.updatedAt,
  };

  const status = !terminal ? 'RUNNING' : allDone ? 'COMPLETE' : anyFailed ? 'PARTIAL' : 'COMPLETE';

  await prisma.caseActivation.update({
    where: { id: activation.id },
    data: {
      summary,
      status,
      ...(terminal ? { completedAt: new Date() } : {}),
    },
  });

  return { summary, status, terminal };
}
