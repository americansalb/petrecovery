/**
 * Every active Rescue Force, shaped for the directory at /rescue-forces:
 * where it is, its area, how many members it has, and the lost pets it is
 * looking for now (a count and up to three photos).
 *
 * "Missing" is a LOST report that is still open and assigned to the force.
 * Found-pet reports are assigned to forces too, but a found pet is not a
 * missing one; the old list counted both.
 *
 * Plain data only, so the same shape can back an API for the phone apps.
 */

import prisma from '@/app/lib/prisma';
import { simplifyArea, areaCenter } from '@/app/lib/maps/forceArea';

const OPEN_CASE_STATUSES = ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'];
const LIVE_ASSIGNMENT_STATUSES = ['ACCEPTED', 'ACTIVE', 'STANDBY'];
const PHOTOS_PER_FORCE = 3;

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

/** The directory's forces, busiest first; null when the database read fails. */
export async function getForceDirectory() {
  try {
    const rows = await prisma.rescueForce.findMany({
      where: { isActive: true, isDeleted: false },
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        centerLatitude: true,
        centerLongitude: true,
        radiusMiles: true,
        updatedAt: true,
        _count: { select: { members: { where: { isActive: true } } } },
        caseAssignments: {
          where: {
            status: { in: LIVE_ASSIGNMENT_STATUSES },
            case: { status: { in: OPEN_CASE_STATUSES }, reportType: 'LOST' },
          },
          orderBy: { case: { createdAt: 'desc' } },
          select: { case: { select: { petName: true, petPhotoUrl: true } } },
        },
      },
      take: 500,
    });
    const areaOf = await forceAreas(rows);

    return rows
      .map((f) => {
        const area = areaOf(f.id);
        const center =
          f.centerLatitude != null && f.centerLongitude != null
            ? { lat: f.centerLatitude, lng: f.centerLongitude }
            : areaCenter(area);
        return {
          id: f.id,
          name: f.name,
          city: f.city || null,
          place: [f.city, f.state].filter(Boolean).join(', '),
          members: f._count.members,
          missing: f.caseAssignments.length,
          pets: f.caseAssignments.slice(0, PHOTOS_PER_FORCE).map(({ case: c }) => ({
            name: c.petName || null,
            photo: c.petPhotoUrl || null,
          })),
          lat: center ? center.lat : null,
          lng: center ? center.lng : null,
          radiusMiles: f.radiusMiles || 5,
          area,
        };
      })
      .sort((a, b) => b.members - a.members || b.missing - a.missing || a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Rescue Forces directory failed:', error);
    return null;
  }
}
