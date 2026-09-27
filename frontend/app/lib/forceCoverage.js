/**
 * Which Rescue Forces cover a place, and telling their members about a pet
 * reported there. Lost-pet reports (app/api/reports/create) and found-pet
 * reports (app/api/reports/found-pet) both go to the forces that cover
 * where the pet was: inside a force's town outline or within a mile of it
 * (areaCovers in app/lib/maps/forceArea.js), or, for a force whose outline
 * is not looked up yet, its circle plus that mile.
 *
 * Found-pet reports used to reach no force at all, so a force's map and
 * Pets tab never showed a pet found in its town. routeFoundReports assigns
 * recent ones that came in before that changed.
 */

import prisma from '@/app/lib/prisma';
import { forceAreas } from '@/app/lib/forceAreas';
import { areaCovers, milesBetween, EDGE_MILES } from '@/app/lib/maps/forceArea';
import { placeName } from '@/app/lib/needOptions';
import { caseTitle } from '@/app/lib/caseLabels';
import { speciesLabel } from '@/app/lib/species';

// No town outline reaches farther than this from its force's center
// (app/lib/maps/townOutline.js), so farther forces are not read.
const OUTLINE_REACH_MILES = 60;
const OPEN_CASES = ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'];
const FOUND_ROUTED_DAYS = 30;

const FORCE_FIELDS = {
  id: true,
  name: true,
  city: true,
  centerLatitude: true,
  centerLongitude: true,
  radiusMiles: true,
  isAcceptingCases: true,
  updatedAt: true,
};

/** Every active force that has a center: what forcesCovering measures. */
export function activeForces() {
  return prisma.rescueForce.findMany({
    where: { isActive: true, isDeleted: false, centerLatitude: { not: null }, centerLongitude: { not: null } },
    select: FORCE_FIELDS,
  });
}

/**
 * Every active force, each with `distance` (miles from its center to the
 * place) and `covers` (the place is the force's to look after). Pass
 * `forces` (from activeForces) when measuring many places at once.
 */
export async function forcesCovering(point, { forces = null } = {}) {
  const rows = forces || (await activeForces());
  const measured = rows.map((f) => ({
    ...f,
    distance: milesBetween(point, { lat: f.centerLatitude, lng: f.centerLongitude }),
    effectiveRadius: (f.radiusMiles || 5) + EDGE_MILES,
  }));
  const reachable = measured.filter((f) => f.distance <= OUTLINE_REACH_MILES);
  const outlineOf = await forceAreas(reachable, { maxPoints: 600 });
  return measured.map((f) => ({
    ...f,
    covers: areaCovers(
      {
        area: f.distance <= OUTLINE_REACH_MILES ? outlineOf(f.id) : null,
        lat: f.centerLatitude,
        lng: f.centerLongitude,
        radiusMiles: f.radiusMiles,
      },
      point
    ),
  }));
}

/**
 * Tell the active members of these forces about a pet just reported in
 * their area, in the notification bell: a lost pet to look for, or a found
 * pet that may be one of theirs. Each person hears once, however many of
 * their forces cover the place, and never about their own report.
 */
export async function alertForceMembers({ forces, pet, exceptUserId = null }) {
  if (!forces.length) return 0;
  const members = await prisma.rescueForceMember.findMany({
    where: { rescueSquadId: { in: forces.map((f) => f.id) }, isActive: true },
    select: { userId: true, rescueSquadId: true },
  });
  const forceOf = new Map(forces.map((f) => [f.id, f]));
  const seen = new Set(exceptUserId ? [exceptUserId] : []);
  const place = placeName(pet.lastSeenAddress);
  const near = place ? ` near ${place}` : '';
  const found = pet.reportType === 'FOUND';
  const kind = speciesLabel(pet.petSpecies).toLowerCase();
  const name = caseTitle(pet);

  const rows = [];
  for (const m of members) {
    if (seen.has(m.userId)) continue;
    seen.add(m.userId);
    const force = forceOf.get(m.rescueSquadId);
    rows.push({
      userId: m.userId,
      type: found ? 'FORCE_PET_FOUND' : 'FORCE_PET_LOST',
      title: found ? `A ${kind} was found${near}` : `${name} is missing${near}`,
      message: found
        ? `Is it one of the pets ${force.name} is looking for? See the report.`
        : `${force.name} is looking for ${name}. See how you can help.`,
      actionUrl: `/cases/${encodeURIComponent(pet.caseNumber)}`,
      data: JSON.stringify({ caseId: pet.id, forceId: force.id }),
    });
  }
  if (rows.length) await prisma.notification.createMany({ data: rows });
  return rows.length;
}

/**
 * Give a found-pet report to the forces covering where it was found, with a
 * post in each force's Discussion. Returns the forces it went to.
 */
export async function routeFoundReport(report, { forces = null, reporterId = null, post = true } = {}) {
  const point = { lat: Number(report.lastSeenLatitude), lng: Number(report.lastSeenLongitude) };
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return [];
  const covering = (await forcesCovering(point, { forces })).filter((f) => f.covers && f.isAcceptingCases !== false);
  const place = placeName(report.lastSeenAddress);
  const kind = speciesLabel(report.petSpecies).toLowerCase();
  const routed = [];
  for (const force of covering) {
    try {
      await prisma.caseAssignment.create({
        data: { missionId: report.id, rescueSquadId: force.id, status: 'ACCEPTED', acceptedById: reporterId || report.reporterId },
      });
    } catch (error) {
      // Already assigned (the pair is unique): nothing to do for this force.
      if (error?.code !== 'P2002') console.error('[found] assignment failed:', error.message);
      continue;
    }
    routed.push(force);
    if (!post) continue;
    try {
      await prisma.squadPost.create({
        data: {
          rescueSquadId: force.id,
          authorId: reporterId || report.reporterId,
          title: `A ${kind} was found${place ? ` near ${place}` : ''}`,
          content: `Someone found a ${kind}${place ? ` near ${place}` : ''} and reported it. If it is one of the pets this force is looking for, tell the finder from the pet's page. Case #${report.caseNumber}.`,
          caseId: report.id,
        },
      });
    } catch (error) {
      console.error('[found] post failed:', error.message);
    }
  }
  return routed;
}

/**
 * Found-pet reports from the last 30 days, still open and given to no
 * force: route them now (no posts, no alerts; they are not news any more).
 * Run in the background from app/lib/forceOutlines.js.
 */
export async function routeFoundReports({ limit = 50, now = new Date() } = {}) {
  const reports = await prisma.case.findMany({
    where: {
      reportType: 'FOUND',
      status: { in: OPEN_CASES },
      createdAt: { gte: new Date(now.getTime() - FOUND_ROUTED_DAYS * 24 * 3600e3) },
      assignments: { none: {} },
    },
    select: { id: true, caseNumber: true, reporterId: true, petSpecies: true, lastSeenAddress: true, lastSeenLatitude: true, lastSeenLongitude: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  if (!reports.length) return { checked: 0, routed: 0 };
  const forces = await activeForces();
  let routed = 0;
  for (const report of reports) {
    if ((await routeFoundReport(report, { forces, post: false })).length) routed += 1;
  }
  return { checked: reports.length, routed };
}
