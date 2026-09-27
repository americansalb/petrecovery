/**
 * Force outlines, thinned for drawing and for matching, and kept between
 * requests: the directory draws dozens (app/lib/forceDirectory.js), a force's
 * page draws one larger (app/lib/forcePage.js), and new reports are matched
 * to them (app/lib/forceCoverage.js).
 */

import prisma from '@/app/lib/prisma';
import { simplifyArea } from '@/app/lib/maps/forceArea';

// Thinned outlines by force id and size, kept between requests. A stored
// outline can be hundreds of kilobytes and changes only when its force row
// does, so the raw text is read again only for a force whose row changed.
const areaCache = new Map(); // `${id}:${maxPoints}` -> { stamp, area }

/**
 * The thinned outlines of these forces (each `{ id, updatedAt }`), as a
 * lookup by id. The directory draws dozens at town scale (160 points each);
 * a force's own page draws one, larger (app/lib/forcePage.js).
 */
export async function forceAreas(rows, { maxPoints = 160 } = {}) {
  const stamp = (f) => new Date(f.updatedAt).getTime();
  const key = (id) => `${id}:${maxPoints}`;
  const stale = rows.filter((f) => areaCache.get(key(f.id))?.stamp !== stamp(f));
  if (stale.length > 0) {
    const raw = await prisma.rescueForce.findMany({
      where: { id: { in: stale.map((f) => f.id) }, customBoundary: { not: null } },
      select: { id: true, customBoundary: true },
    });
    const byId = new Map(raw.map((r) => [r.id, r.customBoundary]));
    for (const f of stale) {
      areaCache.set(key(f.id), { stamp: stamp(f), area: simplifyArea(byId.get(f.id) || null, { maxPoints }) });
    }
  }
  return (id) => areaCache.get(key(id))?.area || null;
}

/** Test hook: forget the cached outlines. */
export function clearForceAreaCache() {
  areaCache.clear();
}

