/**
 * Draw one search's flyers again when the person running it opens it.
 *
 * Flyers and share images are drawn once, when a report is filed. When
 * their design changes, the open searches keep the old drawing. The server
 * used to redraw all of them by itself a few minutes after boot. Back to
 * back, those redraws ran the 512 MB instance out of memory: the server
 * was killed, came back, started again and was killed again, and the site
 * answered 502 on and off on 2026-11-05 and for most of an hour on
 * 2026-11-13. That job is off (instrumentation.js).
 *
 * This is what replaces it, and it is built so it cannot do that:
 *
 *  - It runs for one search, when whoever runs that search opens it
 *    (the plan route, for the owner, a force lead or staff). Nothing starts
 *    it at boot, and nothing a visitor or a crawler can reach starts it.
 *  - One at a time, with a rest between two, and only while the server has
 *    memory to spare. One redraw costs what filing a report costs, which
 *    the server does every day.
 *  - Once for each search and each renderer version. That it was started
 *    is written down BEFORE the drawing starts, so a redraw that kills the
 *    server is not started again when the server comes back. A redraw the
 *    server lived through but that failed (the file store was away) gets
 *    one more try, and a failed redraw leaves the old flyers in place
 *    (keepOrFail in refresh.js).
 *
 * A search nobody opens keeps its old flyers, and that is the price.
 */
import prisma from '@/app/lib/prisma';
import { RENDERER_VERSION } from './render/version';

/** The step row that says a search's redraw was tried for a renderer version. */
export const OPEN_REDRAW_STEP = 'redraw_on_open';
/** How much memory the server may be using before one redraw starts. Under the batch's 400: this one has no pass to stop. */
export const OPEN_REDRAW_RSS_MB = Number(process.env.KIT_REDRAW_ON_OPEN_RSS_MB) || 330;
/** The rest between two redraws, for the memory the last one took to come back. */
export const OPEN_REDRAW_REST_MS = 3 * 60 * 1000;
/** How long before the same search is looked at again: the desk asks for its plan every minute. */
const LOOK_AGAIN_MS = 10 * 60 * 1000;

const state = { busy: false, lastAt: 0, looked: new Map() };
const rssMb = () => Math.round(process.memoryUsage().rss / (1024 * 1024));

/**
 * Whether to redraw now: 'redraw', or the reason not to. Pure.
 * `stamped` is the version the kit was drawn with, `tried` the version a
 * redraw was last started for and `state` how that went, `status` the
 * kit's own state.
 */
export function openRedrawVerdict({ stamped, tried, state: was, status, rss, busy, sinceLast, version = RENDERER_VERSION, budget = OPEN_REDRAW_RSS_MB, rest = OPEN_REDRAW_REST_MS }) {
  if (stamped === version) return 'current';
  // 'retry' is the one state that lets it be tried again: it was drawn, the server lived, and a file did not come out.
  if (tried === version && was !== 'retry') return 'tried';
  if (status === 'PENDING' || status === 'RUNNING') return 'drawing';
  if (busy) return 'busy';
  if (sinceLast < rest) return 'resting';
  if (!(rss <= budget)) return 'no-room';
  return 'redraw';
}

/**
 * Redraw `caseId`'s kit if it is stale and the server has room. Resolves to
 * what happened. Never throws, and is called without being waited for.
 */
export async function redrawOnOpen(caseId, { now = Date.now() } = {}) {
  if (!caseId) return 'no-case';
  if (now - (state.looked.get(caseId) || 0) < LOOK_AGAIN_MS) return 'looked';
  if (state.looked.size > 500) state.looked.clear();
  state.looked.set(caseId, now);
  try {
    const kit = await prisma.caseActivation.findUnique({
      where: { caseId },
      select: {
        id: true,
        caseId: true,
        caseNumber: true,
        status: true,
        assets: { where: { kind: 'SOCIAL_STORY' }, select: { meta: true } },
        steps: { where: { key: OPEN_REDRAW_STEP }, select: { result: true } },
      },
    });
    if (!kit) return 'no-kit';
    const verdict = openRedrawVerdict({
      stamped: kit.assets[0]?.meta?.rendererVersion,
      tried: kit.steps[0]?.result?.version,
      state: kit.steps[0]?.result?.state,
      status: kit.status,
      rss: rssMb(),
      busy: state.busy,
      sinceLast: now - state.lastAt,
    });
    if (verdict !== 'redraw') {
      // Not now, for a reason that passes: look again the next time it is opened.
      if (verdict === 'busy' || verdict === 'resting' || verdict === 'no-room') state.looked.delete(caseId);
      if (verdict === 'no-room') console.warn(`[kits] ${kit.caseNumber} not redrawn on open: memory at ${rssMb()} MB, over ${OPEN_REDRAW_RSS_MB}`);
      return verdict;
    }
    state.busy = true;
    state.lastAt = now;
    try {
      // First, before anything is drawn: if this redraw takes the server down, it is not started again.
      const again = kit.steps[0]?.result?.version === RENDERER_VERSION && kit.steps[0]?.result?.state === 'retry';
      const note = (state) =>
        prisma.cascadeStep.upsert({
          where: { activationId_key: { activationId: kit.id, key: OPEN_REDRAW_STEP } },
          create: { activationId: kit.id, caseId: kit.caseId, caseNumber: kit.caseNumber, key: OPEN_REDRAW_STEP, status: 'SUCCESS', result: { version: RENDERER_VERSION, state, at: new Date().toISOString() } },
          update: { status: 'SUCCESS', result: { version: RENDERER_VERSION, state, at: new Date().toISOString() } },
        });
      await note(again ? 'started-again' : 'started');
      const pet = await prisma.case.findUnique({ where: { id: caseId }, include: { pet: true } });
      if (!pet || pet.reportType !== 'LOST' || pet.resolvedAt) return 'closed';
      const { regenerateCaseAssets } = await import('./refresh');
      const outcome = await regenerateCaseAssets(pet, { correlationId: `open-${pet.caseNumber}` });
      const drawn = /ready/.test(outcome?.flyers || '') && /ready/.test(outcome?.social || '');
      // The server lived through it. A redraw that did not bring its files gets one more try, on a later open.
      await note(drawn ? 'done' : again ? 'failed' : 'retry').catch(() => {});
      console.log(`[kits] ${pet.caseNumber} ${drawn ? 'redrawn' : 'not redrawn'} with ${RENDERER_VERSION} when the person running it opened it (flyers ${outcome?.flyers}; pictures ${outcome?.social}; memory ${rssMb()} MB)`);
      return drawn ? 'redrawn' : 'failed';
    } finally {
      state.busy = false;
      state.lastAt = Date.now();
      if (typeof globalThis.gc === 'function') globalThis.gc();
    }
  } catch (err) {
    console.error(`[kits] redraw on open failed for ${caseId}:`, err?.message || err);
    return 'failed';
  }
}

/** For tests: forget what has been looked at and when the last redraw was. */
export function resetOpenRedraw() {
  state.busy = false;
  state.lastAt = 0;
  state.looked.clear();
}
