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
import { areaCenter } from '@/app/lib/maps/forceArea';
import { forceAreas } from '@/app/lib/forceAreas';
import { forceUpkeepSoon } from '@/app/lib/forceUpkeep';

// The outline cache moved to app/lib/forceAreas.js; kept here for callers and tests.
export { forceAreas, clearForceAreaCache } from '@/app/lib/forceAreas';

const OPEN_CASE_STATUSES = ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'];
const LIVE_ASSIGNMENT_STATUSES = ['ACCEPTED', 'ACTIVE', 'STANDBY'];
const PHOTOS_PER_FORCE = 3;

/** The directory's forces, busiest first; null when the database read fails. */
export async function getForceDirectory() {
  // Forces still drawn as a circle get their town's outline in the
  // background, and recent found pets reach the forces around them; both
  // show on a later visit (app/lib/forceUpkeep.js).
  forceUpkeepSoon();
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
