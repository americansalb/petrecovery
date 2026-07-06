/**
 * Cascade orchestrator. Runs the enabled actions in tier order after a lost
 * report is created. Each action is isolated (one failure never aborts the
 * rest), each persists its output, and the activation summary is rolled up so
 * the success screen + case page render from the DB with no live connection.
 *
 * enqueueCascade is called FIRE-AND-FORGET from the create route (the app is a
 * long-lived Node server, matching the route's existing unawaited-email
 * convention) so the wizard's Post response is never blocked.
 */

import prisma from '@/app/lib/prisma';
import { logEvent } from '../../../lib/logging';
import { CASCADE_ACTIONS, ENABLED_ACTIONS, ENABLED_KEYS, MAX_TIER } from './registry';
import { ACTION_RUNNERS } from './actions/index.js';
import { upsertStep, upsertAsset, rollupSummary } from './store';
import { caseUrl, qrDataUrl } from './render/qr.js';
import { loadPetImageDataUrl } from './render/photo.js';

/** Seed the activation + one PENDING step per enabled action (idempotent). */
export async function seedActivation(caseData, correlationId) {
  const activation = await prisma.caseActivation.upsert({
    where: { caseId: caseData.id },
    create: {
      caseId: caseData.id,
      caseNumber: caseData.caseNumber,
      correlationId,
      status: 'PENDING',
    },
    update: {}, // don't clobber an in-flight run
  });

  await Promise.all(
    ENABLED_ACTIONS.map((a) =>
      prisma.cascadeStep.upsert({
        where: { activationId_key: { activationId: activation.id, key: a.key } },
        create: {
          activationId: activation.id,
          caseId: caseData.id,
          caseNumber: caseData.caseNumber,
          key: a.key,
          status: 'PENDING',
        },
        update: {},
      })
    )
  );

  return activation;
}

/** Build the memoized shared render inputs (QR + pet photos) fetched once. */
function makeGetShared(caseData) {
  let promise = null;
  return () => {
    if (promise) return promise;
    promise = (async () => {
      const url = caseUrl(caseData.caseNumber);
      let petPhotos = [];
      try {
        petPhotos = caseData.pet?.photos ? JSON.parse(caseData.pet.photos) : [];
      } catch {
        petPhotos = [];
      }
      const urls = [...new Set([caseData.petPhotoUrl, ...petPhotos].filter(Boolean))].slice(0, 3);
      const dataUrls = (await Promise.all(urls.map((u) => loadPetImageDataUrl(u)))).filter(Boolean);
      return {
        caseUrl: url,
        qrDataUrl: await qrDataUrl(url),
        photoDataUrls: dataUrls,
        photoDataUrl: dataUrls[0] || null,
      };
    })();
    return promise;
  };
}

/** Run one action, persisting its terminal step state. Never throws. */
async function runOne(action, ctx) {
  const runner = ACTION_RUNNERS[action.key];
  const started = Date.now();

  // dependency gate: any dep not SUCCESS -> SKIP
  const unmetDep = action.deps.find((d) => ctx.stepStatus[d] !== 'SUCCESS');
  if (!runner || unmetDep) {
    const reason = !runner ? 'not implemented' : `dependency "${unmetDep}" did not succeed`;
    await upsertStep(ctx.activation, action.key, { status: 'SKIPPED', error: reason, finishedAt: new Date() });
    ctx.stepStatus[action.key] = 'SKIPPED';
    return;
  }

  await upsertStep(ctx.activation, action.key, { status: 'RUNNING', startedAt: new Date() });
  try {
    const out = (await runner(ctx)) || {};
    if (out.result) ctx.results[action.key] = out.result;
    await upsertStep(ctx.activation, action.key, {
      status: 'SUCCESS',
      count: out.count ?? null,
      result: out.result ?? {},
      durationMs: Date.now() - started,
      finishedAt: new Date(),
    });
    ctx.stepStatus[action.key] = 'SUCCESS';
    logEvent({
      event_type: `cascade.step.${action.key}`,
      correlation_id: ctx.correlationId,
      resource_type: 'case',
      resource_id: ctx.case.id,
      action: action.logAction,
      result: 'success',
      metadata: { key: action.key, count: out.count ?? null, ms: Date.now() - started },
    }).catch(() => {});
  } catch (err) {
    // An action can raise a soft "not applicable" signal (err.skip) to record
    // SKIPPED instead of FAILED — e.g. no rescue force was assigned.
    const isSkip = Boolean(err?.skip);
    await upsertStep(ctx.activation, action.key, {
      status: isSkip ? 'SKIPPED' : 'FAILED',
      error: String(err.message || err).slice(0, 500),
      durationMs: Date.now() - started,
      finishedAt: new Date(),
    });
    ctx.stepStatus[action.key] = isSkip ? 'SKIPPED' : 'FAILED';
    if (isSkip) return;
    logEvent({
      event_type: `cascade.step.${action.key}`,
      correlation_id: ctx.correlationId,
      resource_type: 'case',
      resource_id: ctx.case.id,
      action: action.logAction,
      result: 'failure',
      error_message: String(err.message || err).slice(0, 300),
    }).catch(() => {});
  }
}

/** Run the whole cascade for an already-seeded activation. */
export async function runCascade(activation, caseData, correlationId) {
  await prisma.caseActivation.update({
    where: { id: activation.id },
    data: { status: 'RUNNING', startedAt: new Date(), attemptCount: { increment: 1 } },
  });

  const getShared = makeGetShared(caseData);
  const ctx = {
    case: caseData,
    activation,
    correlationId,
    results: {},
    stepStatus: {}, // key -> terminal status, drives dep gating
    getShared,
    upsertStep: (key, patch) => upsertStep(activation, key, patch),
    upsertAsset: (kind, patch) => upsertAsset(activation, kind, patch),
  };

  // seed prior successes (resume-safe): a re-run skips already-SUCCESS steps
  const existing = await prisma.cascadeStep.findMany({ where: { activationId: activation.id } });
  for (const s of existing) {
    if (s.status === 'SUCCESS') {
      ctx.stepStatus[s.key] = 'SUCCESS';
      ctx.results[s.key] = s.result || {};
    }
  }

  for (let tier = 0; tier <= MAX_TIER; tier++) {
    const inTier = ENABLED_ACTIONS.filter((a) => a.tier === tier && ctx.stepStatus[a.key] !== 'SUCCESS');
    await Promise.allSettled(inTier.map((a) => runOne(a, ctx)));
  }

  const fresh = await prisma.caseActivation.findUnique({ where: { id: activation.id } });
  return rollupSummary(fresh);
}

/**
 * Fire-and-forget entry from the create route. Loads the case (+ pet for
 * photos), ensures the activation is seeded, and runs the cascade. Swallows all
 * errors — this must never surface to the reporter.
 */
export async function enqueueCascade(caseId, { correlationId } = {}) {
  Promise.resolve()
    .then(async () => {
      const caseData = await prisma.case.findUnique({ where: { id: caseId }, include: { pet: true } });
      if (!caseData || caseData.reportType !== 'LOST') return;
      const activation = await seedActivation(caseData, correlationId || caseData.id);
      await runCascade(activation, caseData, correlationId || activation.correlationId);
    })
    .catch((err) => {
      logEvent({
        event_type: 'cascade.failed',
        correlation_id: correlationId,
        resource_type: 'case',
        resource_id: caseId,
        action: 'create',
        result: 'failure',
        error_message: String(err?.message || err).slice(0, 300),
      }).catch(() => {});
    });
}

export { CASCADE_ACTIONS, ENABLED_KEYS };
