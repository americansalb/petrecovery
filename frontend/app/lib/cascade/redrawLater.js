/**
 * Redraw a case's kit a little after its report changed.
 *
 * The owner adds details from the success screen and the pet's page one
 * answer at a time (PATCH /api/missions/[id]); each answer goes on the
 * flyers, so the kit is redrawn, but once, a minute after the last change,
 * not nine times in a row. While the report's first cascade is still
 * running, the redraw waits for it rather than racing it.
 *
 * In-process timers: a restart loses a pending redraw, and the next edit
 * or the next renderer version catches it up.
 */

const timers = new Map();
const DELAY_MS = 60 * 1000;
const RETRY_MS = 30 * 1000;
const MAX_WAITS = 10;

async function redraw(caseId, waits) {
  timers.delete(caseId);
  try {
    const prisma = (await import('@/app/lib/prisma')).default;
    const c = await prisma.case.findUnique({ where: { id: caseId }, include: { pet: true, activation: { select: { status: true } } } });
    if (!c || c.reportType !== 'LOST' || c.resolvedAt) return;
    if (c.activation && ['PENDING', 'RUNNING'].includes(c.activation.status) && waits < MAX_WAITS) {
      scheduleKitRedraw(caseId, { delayMs: RETRY_MS, waits: waits + 1 });
      return;
    }
    const { regenerateCaseAssets } = await import('./refresh');
    const { activation, ...caseData } = c;
    await regenerateCaseAssets(caseData, { correlationId: `edit-${caseData.caseNumber}-${Date.now()}` });
  } catch (err) {
    console.error(`[kits] redraw after edit failed for ${caseId}:`, err?.message || err);
  }
}

/** Redraw `caseId`'s kit `delayMs` from now; a newer call for the same case resets the clock. */
export function scheduleKitRedraw(caseId, { delayMs = DELAY_MS, waits = 0 } = {}) {
  if (!caseId) return;
  clearTimeout(timers.get(caseId));
  const t = setTimeout(() => redraw(caseId, waits), delayMs);
  if (typeof t.unref === 'function') t.unref();
  timers.set(caseId, t);
}

/** For tests: forget every pending redraw. */
export function clearPendingRedraws() {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
}
