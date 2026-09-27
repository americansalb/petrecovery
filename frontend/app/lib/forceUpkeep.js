/**
 * Rescue Force upkeep done in the background, a batch at a time, when the
 * directory or a force's page is opened:
 * - recent found-pet reports given to the forces around them
 *   (routeFoundReports, app/lib/forceCoverage.js);
 * - town outlines looked up for forces still drawn as a circle
 *   (fillMissingOutlines, app/lib/forceOutlines.js).
 * At most one batch every ten minutes per server, and never waited for:
 * the page draws what is saved now, and the rest shows on a later visit.
 */

import { fillMissingOutlines } from '@/app/lib/forceOutlines';
import { routeFoundReports } from '@/app/lib/forceCoverage';

const EVERY_MS = 10 * 60e3;

let running = false;
let startedAt = 0;

async function upkeep() {
  try {
    const found = await routeFoundReports();
    if (found.routed) console.log(`[upkeep] gave ${found.routed} found pets to the forces around them`);
  } catch (error) {
    console.warn('[upkeep] found pets:', error.message);
  }
  try {
    const outlines = await fillMissingOutlines();
    if (outlines.checked) console.log(`[upkeep] looked up ${outlines.checked} towns, saved ${outlines.saved} outlines`);
  } catch (error) {
    console.warn('[upkeep] outlines:', error.message);
  }
}

/** Start a batch in the background, unless one is running or one started in the last ten minutes. */
export function forceUpkeepSoon() {
  if (process.env.NODE_ENV === 'test' || running || Date.now() - startedAt < EVERY_MS) return;
  running = true;
  startedAt = Date.now();
  upkeep().finally(() => {
    running = false;
  });
}
