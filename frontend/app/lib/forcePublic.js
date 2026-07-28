/**
 * Server-side data for the public Rescue Force page (Phase 1 of
 * docs/RESCUE_FORCES_REDESIGN.md). One shaped query set so the page can
 * be a server component: identity, territory geometry, crew, live
 * missions (with a best-effort division placement for map flares),
 * activity pulse, and the reunion shelf.
 */

import prisma from '@/app/lib/prisma';

const LIVE_CASE_STATUSES = ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'];
const LIVE_ASSIGNMENT_STATUSES = ['ACCEPTED', 'ACTIVE', 'STANDBY'];

function milesBetween(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getPublicForce(id) {
  const force = await prisma.rescueForce.findFirst({
    where: { id, isDeleted: false },
    select: {
      id: true,
      name: true,
      slogan: true,
      description: true,
      city: true,
      state: true,
      country: true,
      logoUrl: true,
      photoUrl: true,
      centerLatitude: true,
      centerLongitude: true,
      radiusMiles: true,
      customBoundary: true,
      hasTrackingDogs: true,
      hasDrones: true,
      availableNight: true,
      rescueSquadLevel: true,
      successfulReunions: true,
      avgResponseTimeMinutes: true,
      isActive: true,
      createdAt: true,
      divisions: {
        where: { isActive: true, isDeleted: false },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          centerLatitude: true,
          centerLongitude: true,
          radiusMiles: true,
          customBoundary: true,
        },
      },
      members: {
        where: { isActive: true },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        select: {
          id: true,
          role: true,
          divisionId: true,
          availabilityStatus: true,
          user: { select: { id: true, firstName: true, lastName: true, profileImage: true } },
        },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, type: true, message: true, createdAt: true },
      },
      caseAssignments: {
        where: { status: { in: LIVE_ASSIGNMENT_STATUSES } },
        select: {
          id: true,
          participants: {
            select: {
              user: { select: { id: true, firstName: true, lastName: true, profileImage: true } },
            },
          },
          case: {
            select: {
              id: true,
              caseNumber: true,
              status: true,
              reportType: true,
              petName: true,
              petSpecies: true,
              petBreed: true,
              petPhotoUrl: true,
              lastSeenAddress: true,
              lastSeenAt: true,
              lastSeenLatitude: true,
              lastSeenLongitude: true,
            },
          },
        },
      },
    },
  });
  if (!force) return null;

  // The User model stores firstName/lastName/profileImage; the page wants
  // a plain display shape.
  const displayUser = (u) => ({
    id: u.id,
    name: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || null,
    image: u.profileImage || null,
  });
  force.members = force.members.map((m) => ({ ...m, user: displayUser(m.user) }));

  const liveMissions = force.caseAssignments
    .filter((a) => LIVE_CASE_STATUSES.includes(a.case?.status))
    .map((a) => ({ ...a.case, searchers: a.participants.map((p) => displayUser(p.user)) }))
    .sort((a, b) => new Date(b.lastSeenAt || 0) - new Date(a.lastSeenAt || 0));

  // Best-effort flare→zone placement: a mission belongs to the nearest
  // division whose radius contains it. GeoJSON-boundary divisions fall
  // back to their center+radius for this purpose.
  const zones = force.divisions.map((d) => {
    const onDuty = force.members.filter(
      (m) => m.divisionId === d.id && m.availabilityStatus === 'AVAILABLE'
    ).length;
    const memberCount = force.members.filter((m) => m.divisionId === d.id).length;
    return { ...d, onDuty, memberCount, missionCount: 0 };
  });
  for (const mission of liveMissions) {
    if (mission.lastSeenLatitude == null) continue;
    let best = null;
    for (const z of zones) {
      if (z.centerLatitude == null) continue;
      const dist = milesBetween(
        mission.lastSeenLatitude,
        mission.lastSeenLongitude,
        z.centerLatitude,
        z.centerLongitude
      );
      if (dist <= (z.radiusMiles || 3) && (!best || dist < best.dist)) best = { z, dist };
    }
    if (best) best.z.missionCount += 1;
  }

  const reunions = await prisma.caseAssignment.findMany({
    where: { rescueSquadId: id, case: { status: 'REUNITED' } },
    orderBy: { case: { resolvedAt: 'desc' } },
    take: 3,
    select: {
      case: {
        select: {
          id: true,
          petName: true,
          petPhotoUrl: true,
          lastSeenAt: true,
          resolvedAt: true,
        },
      },
    },
  });

  return {
    force,
    zones,
    liveMissions,
    reunions: reunions.map((r) => r.case),
    onDutyCount: force.members.filter((m) => m.availabilityStatus === 'AVAILABLE').length,
  };
}
