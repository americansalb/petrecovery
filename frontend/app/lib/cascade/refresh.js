/**
 * Redrawing a case's kit with the renderers that are live now.
 *
 * A lost report's flyers and share images are drawn once, by the cascade,
 * the moment the report is filed. The design has changed since many of the
 * open cases were filed, and the stored PDFs and PNGs did not change with
 * it. This module brings them up to date:
 *
 * - `regenerateCaseAssets(caseData)` redraws one case: fresh copy pack,
 *   the three flyers, the three share images, the local share targets,
 *   then the activation summary, so a kit stuck at RUNNING settles.
 *   It never re-sends emails, texts or alerts.
 * - `findStaleCases()` lists the unresolved lost cases whose stored
 *   flyer carries an older `rendererVersion` than the code (or none).
 * - `refreshStaleKits()` redraws them one at a time, newest first.
 *
 * After each boot the server runs the stale pass by itself, so a deploy
 * that changes the design redraws every open case with no one asking
 * (refreshBoot.js, called from instrumentation.js).
 *
 * One case at a time, deliberately: each redraw runs react-pdf, satori
 * and sharp inside the web server, the same work a new report does, and
 * the production heap is small.
 */

import prisma from '@/app/lib/prisma';
import { seedActivation, makeGetShared } from './runCascade';
import { upsertStep, upsertAsset, rollupSummary } from './store';
import { generateAiCopy } from './aiCopy';
import { runFlyers } from './actions/flyers';
import { runSocial } from './actions/social';
import { runShareTargets } from './actions/shareTargets';
import { RENDERER_VERSION } from './render/version';
import { logEvent } from '@/lib/logging';

/** Case statuses that still have a search going. */
export const UNRESOLVED_STATUSES = ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'];

const errText = (err) => String(err?.message || err).slice(0, 160);

/**
 * The Prisma `where` for cases whose kit was drawn by an older renderer:
 * an open lost report with no FLYER_LETTER asset stamped with the current
 * version. A case with no activation at all (reported before the cascade
 * existed) counts as stale too. A failed draw is stamped as well, so one
 * case with a broken photo is tried once per version, not once per boot.
 */
export function staleKitWhere(version = RENDERER_VERSION) {
  const stamped = { kind: 'FLYER_LETTER', meta: { path: ['rendererVersion'], equals: version } };
  return {
    reportType: 'LOST',
    status: { in: UNRESOLVED_STATUSES },
    resolvedAt: null,
    OR: [{ activation: { is: null } }, { activation: { assets: { none: stamped } } }],
  };
}

export async function findStaleCases({ limit = 50, version = RENDERER_VERSION } = {}) {
  return prisma.case.findMany({
    where: staleKitWhere(version),
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { pet: true },
  });
}

export async function countStaleCases(version = RENDERER_VERSION) {
  return prisma.case.count({ where: staleKitWhere(version) });
}

/**
 * Redraw one case's kit with the current renderers, overwriting the stored
 * CDN files (deterministic keys, so the URLs do not change).
 *
 * @param {object} caseData a Case row with its pet
 * @param {{correlationId?: string}} [opts]
 * @returns {Promise<{aiCopy:string, flyers:string, social:string, shareTargets?:string}>}
 */
export async function regenerateCaseAssets(caseData, { correlationId } = {}) {
  const cid = correlationId || `regen-${caseData.caseNumber}`;
  const activation = await seedActivation(caseData, cid);
  const stamp = { rendererVersion: RENDERER_VERSION };

  const ctx = {
    case: caseData,
    activation,
    correlationId: cid,
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
    outcome.aiCopy = `failed: ${errText(err)}`;
  }

  try {
    const r = await runFlyers(ctx);
    await upsertStep(activation, 'flyers', { status: 'SUCCESS', count: r.count, result: r.result, finishedAt: new Date() });
    outcome.flyers = `${r.count} ready`;
  } catch (err) {
    outcome.flyers = `failed: ${errText(err)}`;
    await upsertStep(activation, 'flyers', { status: 'FAILED', error: errText(err), finishedAt: new Date() }).catch(() => {});
    // The stamp is what says "this version was tried". Without it a case
    // whose photo cannot be read would be redrawn on every boot.
    await upsertAsset(activation, 'FLYER_LETTER', { status: 'failed', error: errText(err), meta: stamp }).catch(() => {});
  }

  try {
    const r = await runSocial(ctx);
    await upsertStep(activation, 'social', { status: 'SUCCESS', count: r.count, result: r.result, finishedAt: new Date() });
    outcome.social = `${r.count} ready`;
  } catch (err) {
    outcome.social = `failed: ${errText(err)}`;
    await upsertStep(activation, 'social', { status: 'FAILED', error: errText(err), finishedAt: new Date() }).catch(() => {});
  }

  try {
    const r = await runShareTargets(ctx);
    await upsertStep(activation, 'share_targets', { status: 'SUCCESS', count: r.count, result: r.result, finishedAt: new Date() });
    outcome.shareTargets = `${r.count} targets`;
  } catch (err) {
    outcome.shareTargets = `failed: ${errText(err)}`;
  }

  // Settle the activation from its steps and assets. A kit the cascade left
  // at RUNNING (the recovery-kit page polls it forever) becomes COMPLETE or
  // PARTIAL here.
  try {
    const fresh = await prisma.caseActivation.findUnique({ where: { id: activation.id } });
    if (fresh) await rollupSummary(fresh);
  } catch (err) {
    outcome.rollup = `failed: ${errText(err)}`;
  }

  logEvent({
    event_type: 'cascade.regenerate',
    correlation_id: cid,
    resource_type: 'case',
    resource_id: caseData.id,
    action: 'update',
    result: 'success',
    metadata: { ...outcome, rendererVersion: RENDERER_VERSION },
  }).catch(() => {});

  return outcome;
}

let refreshRunning = false;

/**
 * Redraw the stale kits, one case at a time, newest report first.
 *
 * @param {{limit?: number, pauseMs?: number}} [opts] at most `limit` cases
 *   this call; `pauseMs` of rest between cases
 * @returns {Promise<object>} what was done and how many are still stale
 */
export async function refreshStaleKits({ limit = 50, pauseMs = 1500 } = {}) {
  if (refreshRunning) return { version: RENDERER_VERSION, skipped: 'a refresh is already running' };
  refreshRunning = true;
  const started = Date.now();
  const cases = [];
  const failed = [];
  try {
    const stale = await findStaleCases({ limit });
    for (let i = 0; i < stale.length; i++) {
      const c = stale[i];
      try {
        const outcome = await regenerateCaseAssets(c);
        cases.push({ caseNumber: c.caseNumber, ...outcome });
        if (!/ready/.test(outcome.flyers) || !/ready/.test(outcome.social)) failed.push(c.caseNumber);
      } catch (err) {
        cases.push({ caseNumber: c.caseNumber, error: errText(err) });
        failed.push(c.caseNumber);
      }
      if (pauseMs > 0 && i < stale.length - 1) await new Promise((r) => setTimeout(r, pauseMs));
    }
    const remaining = await countStaleCases();
    return {
      version: RENDERER_VERSION,
      attempted: cases.length,
      redrawn: cases.length - failed.length,
      failed,
      remaining,
      ms: Date.now() - started,
      cases,
    };
  } finally {
    refreshRunning = false;
  }
}
