/**
 * Town outlines for Rescue Forces, looked up once and saved in the force's
 * `customBoundary` (app/lib/maps/townOutline.js does the looking up).
 *
 * A force started from the Start a Rescue Force page saved its town's
 * outline when it was made. A force set up automatically from a report
 * never did, so the directory and its page drew a circle. So:
 * - a force set up from a report is given its outline right after
 *   (fillForceOutline, from app/api/reports/create);
 * - forces still without one are filled in the background, a batch at a
 *   time, when the directory or a force's page is opened
 *   (fillMissingOutlines, run by app/lib/forceUpkeep.js);
 * - a force whose town has no outline in OpenStreetMap keeps its circle,
 *   and is looked up again after 30 days (`outlineCheckedAt`).
 */

import prisma from '@/app/lib/prisma';
import { lookupTownOutline } from '@/app/lib/maps/townOutline';

const RETRY_AFTER_MS = 30 * 24 * 3600e3;
const BATCH = 40;

const FORCE_FIELDS = { id: true, name: true, city: true, country: true, centerLatitude: true, centerLongitude: true };

/**
 * Look up one force's outline and save it, or note that there is none.
 * Returns 'saved', 'none', or 'failed' when OpenStreetMap could not be
 * reached (or refused): then nothing is saved, and the force is tried
 * again next time.
 */
export async function fillForceOutline(force, { lookup = lookupTownOutline, now = new Date() } = {}) {
  let outline;
  try {
    outline = await lookup(force);
  } catch (error) {
    console.warn(`[outlines] ${force.name}: ${error.message}`);
    return 'failed';
  }
  await prisma.rescueForce.update({
    where: { id: force.id },
    data: outline ? { customBoundary: JSON.stringify(outline), outlineCheckedAt: now } : { outlineCheckedAt: now },
  });
  return outline ? 'saved' : 'none';
}

/**
 * The next forces without an outline, most recently active first, filled
 * one after another. Stops at the first lookup that fails: when
 * OpenStreetMap is down or asking us to slow down, the rest can wait.
 */
export async function fillMissingOutlines({ limit = BATCH, lookup = lookupTownOutline, now = new Date() } = {}) {
  const forces = await prisma.rescueForce.findMany({
    where: {
      isDeleted: false,
      customBoundary: null,
      centerLatitude: { not: null },
      centerLongitude: { not: null },
      OR: [{ outlineCheckedAt: null }, { outlineCheckedAt: { lt: new Date(now.getTime() - RETRY_AFTER_MS) } }],
    },
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
    select: FORCE_FIELDS,
    take: limit,
  });
  let checked = 0;
  let saved = 0;
  for (const force of forces) {
    const result = await fillForceOutline(force, { lookup, now });
    if (result === 'failed') break;
    checked += 1;
    if (result === 'saved') saved += 1;
  }
  return { checked, saved };
}

/** Look up a new force's outline in the background, right after it is made. */
export function fillForceOutlineSoon(force) {
  if (process.env.NODE_ENV === 'test') return;
  fillForceOutline(force).catch((error) => console.warn('[outlines] new force failed:', error.message));
}
