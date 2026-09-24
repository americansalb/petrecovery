/**
 * Server-side data for the public Rescue Force page (Phase 1 of
 * docs/RESCUE_FORCES_REDESIGN.md). One shaped query set so the page can
 * be a server component: identity, territory geometry, crew, live
 * missions (with a best-effort division placement for map flares), and
 * the reunion shelf.
 *
 * No activity feed: the force's activity rows include its members' chat
 * messages and announcements, and the public page used to print the latest
 * eight of them for anyone (and for search engines).
 */

import prisma from '@/app/lib/prisma';
import { parsePlace } from '@/app/lib/placeLabel';

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
          user: { select: { id: true, firstName: true, profileImage: true } },
        },
      },
      caseAssignments: {
        where: { status: { in: LIVE_ASSIGNMENT_STATUSES } },
        select: {
          id: true,
          participants: {
            select: {
              user: { select: { id: true, firstName: true, profileImage: true } },
            },
          },
          case: {
            select: {
              id: true,
              caseNumber: true,
              status: true,
              reportType: true,
              resolution: true,
              petName: true,
              petSpecies: true,
              petBreed: true,
              petColor: true,
              petPhotoUrl: true,
              lastSeenAddress: true,
              lastSeenAt: true,
              lastSeenLatitude: true,
              lastSeenLongitude: true,
              createdAt: true,
              _count: { select: { sightings: true } },
            },
          },
        },
      },
    },
  });
  if (!force) return null;

  // The User model stores firstName/lastName/profileImage; the page wants
  // a plain display shape. This page is public, so it shows first names
  // only, the same rule /api/rescue-forces/[id]/members applies to anyone
  // who is not in the force. It used to print every volunteer's full name.
  const displayUser = (u) => ({
    id: u.id,
    name: (u.firstName || '').trim() || null,
    image: u.profileImage || null,
  });
  force.members = force.members.map((m) => ({ ...m, user: displayUser(m.user) }));

  // Shaped for the Lost & Found PetCard: a readable place instead of the
  // first comma part of the address (which was the house number, "6701",
  // on most real reports), a sighting count, and dates as strings so the
  // server page can hand them to a client component.
  const cardShape = (c) => ({
    ...c,
    place: parsePlace(c.lastSeenAddress)?.label || null,
    sightingCount: c._count?.sightings || 0,
    lastSeenAt: c.lastSeenAt ? new Date(c.lastSeenAt).toISOString() : null,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
    resolvedAt: c.resolvedAt ? new Date(c.resolvedAt).toISOString() : null,
    _count: undefined,
  });

  const liveMissions = force.caseAssignments
    .filter((a) => LIVE_CASE_STATUSES.includes(a.case?.status))
    .map((a) => ({ ...cardShape(a.case), searchers: a.participants.map((p) => displayUser(p.user)) }))
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
    // Kept on the mission so a division page can list its own pets.
    mission.zoneId = best ? best.z.id : null;
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
          caseNumber: true,
          status: true,
          reportType: true,
          resolution: true,
          petName: true,
          petSpecies: true,
          petBreed: true,
          petColor: true,
          petPhotoUrl: true,
          lastSeenAddress: true,
          lastSeenAt: true,
          createdAt: true,
          resolvedAt: true,
          _count: { select: { sightings: true } },
        },
      },
    },
  });

  return {
    force,
    zones,
    liveMissions,
    reunions: reunions.map((r) => cardShape(r.case)),
    onDutyCount: force.members.filter((m) => m.availabilityStatus === 'AVAILABLE').length,
  };
}
