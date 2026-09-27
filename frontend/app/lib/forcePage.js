/**
 * Everything the top of a Rescue Force's page needs, whichever tab is open
 * (app/rescue-forces/[id]/(tabs)/layout.js): the force and its area, its
 * members by first name, the pets on its map and in its Pets tab, how many
 * needs are open, and who is looking.
 *
 * Wrapped in React's cache(), so the layout and the tab's page share one
 * read per request.
 *
 * The page is public. Members are first names only (the rule
 * /api/rescue-forces/[id]/members applies to the public), and a pet's place
 * is the first part of its last-seen address without a house number: the
 * pet's own page already shows the spot on a map.
 */

import * as React from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/lib/auth';
import { getUserRole } from '@/app/lib/authz';
import prisma from '@/app/lib/prisma';
import { forceAreas } from '@/app/lib/forceDirectory';
import { areaCenter } from '@/app/lib/maps/forceArea';
import { caseStatus, caseTitle, timeAgo } from '@/app/lib/caseLabels';
import { looksLikeCoordinates } from '@/app/lib/maps/reverseLabel';
import { parsePlace } from '@/app/lib/placeLabel';
import { OPEN_NEED_STATUSES } from '@/app/lib/forceNeeds';

const OPEN_CASE_STATUSES = ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'];
const LIVE_ASSIGNMENT_STATUSES = ['ACCEPTED', 'ACTIVE', 'STANDBY'];
const LEADER_ROLES = ['FOUNDER', 'LEADER', 'ADMINISTRATOR'];
const ROLE_ORDER = { FOUNDER: 0, LEADER: 1, ADMINISTRATOR: 2 };
const REUNITED_SHOWN = 30;
// Detailed enough for one town filling a map; the directory uses 160.
const AREA_POINTS = 600;

const CASE_FIELDS = {
  id: true,
  caseNumber: true,
  status: true,
  reportType: true,
  resolution: true,
  petName: true,
  petSpecies: true,
  petPhotoUrl: true,
  lastSeenAddress: true,
  lastSeenAt: true,
  lastSeenLatitude: true,
  lastSeenLongitude: true,
  createdAt: true,
  resolvedAt: true,
};

/** "Near Burnet Rd" from "6701 Burnet Rd, Austin, TX"; the town when the first part is only a number. */
export function nearText(address) {
  if (!address || looksLikeCoordinates(address)) return '';
  const first = address.split(',')[0].trim().replace(/^near\s+/i, '').replace(/^\d+[a-z]?\s+/i, '');
  if (first && !/^\d/.test(first)) return `Near ${first}`;
  const place = parsePlace(address)?.label;
  return place ? `Near ${place}` : '';
}

/** "Lost 18 hours ago", "Found 2 days ago", "Reunited Sep 3". */
export function whenText(c, key) {
  if (key === 'home') {
    const at = timeAgo(c.resolvedAt);
    return at ? `Reunited ${at}` : 'Reunited';
  }
  const at = timeAgo(c.lastSeenAt || c.createdAt);
  const word = key === 'found' ? 'Found' : 'Lost';
  return at ? `${word} ${at}` : word;
}

function petShape(c, needsByCase) {
  const key = caseStatus(c).key;
  return {
    id: c.id,
    caseNumber: c.caseNumber,
    name: caseTitle(c),
    species: c.petSpecies || null,
    status: key,
    when: whenText(c, key),
    near: nearText(c.lastSeenAddress),
    photo: c.petPhotoUrl || null,
    lat: c.lastSeenLatitude ?? null,
    lng: c.lastSeenLongitude ?? null,
    needs: needsByCase.get(c.id) || 0,
  };
}

async function readForcePage(id) {
  const force = await prisma.rescueForce.findFirst({
    where: { id, isDeleted: false },
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      photoUrl: true,
      logoUrl: true,
      centerLatitude: true,
      centerLongitude: true,
      radiusMiles: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!force) return null;

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || null;

  const [members, live, reunited, needRows, areaOf, platformRole] = await Promise.all([
    prisma.rescueForceMember.findMany({
      where: { rescueSquadId: id, isActive: true },
      orderBy: { joinedAt: 'asc' },
      select: { id: true, role: true, user: { select: { id: true, firstName: true, profileImage: true } } },
    }),
    prisma.caseAssignment.findMany({
      where: { rescueSquadId: id, status: { in: LIVE_ASSIGNMENT_STATUSES }, case: { status: { in: OPEN_CASE_STATUSES } } },
      select: { case: { select: CASE_FIELDS } },
      take: 200,
    }),
    prisma.caseAssignment.findMany({
      where: { rescueSquadId: id, case: { status: 'REUNITED' } },
      orderBy: { case: { resolvedAt: 'desc' } },
      select: { case: { select: CASE_FIELDS } },
      take: REUNITED_SHOWN,
    }),
    prisma.squadTask.groupBy({
      by: ['caseId'],
      where: { rescueSquadId: id, status: { in: OPEN_NEED_STATUSES }, role: { not: 'OWNER' } },
      _count: { _all: true },
    }),
    forceAreas([force], { maxPoints: AREA_POINTS }),
    userId ? getUserRole(userId) : null,
  ]);

  // Needs of the force as a whole, and of the pets still being looked for.
  const liveIds = new Set(live.map((a) => a.case.id));
  const needsByCase = new Map(needRows.filter((r) => r.caseId).map((r) => [r.caseId, r._count._all]));
  const needsCount = needRows
    .filter((r) => !r.caseId || liveIds.has(r.caseId))
    .reduce((sum, r) => sum + r._count._all, 0);

  const pets = [
    ...live
      .map((a) => a.case)
      .sort((a, b) => new Date(b.lastSeenAt || b.createdAt) - new Date(a.lastSeenAt || a.createdAt)),
    ...reunited.map((a) => a.case),
  ].map((c) => petShape(c, needsByCase));

  // Leaders first; no user ids, which the public page has no use for.
  const people = members
    .map((m) => ({
      id: m.id,
      name: (m.user.firstName || '').trim() || null,
      image: m.user.profileImage || null,
      role: m.role,
    }))
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9));

  const mine = userId ? members.find((m) => m.user.id === userId) : null;
  const area = areaOf(force.id);
  const center =
    force.centerLatitude != null && force.centerLongitude != null
      ? { lat: force.centerLatitude, lng: force.centerLongitude }
      : areaCenter(area);

  return {
    force: {
      id: force.id,
      name: force.name,
      city: force.city || null,
      place: [force.city, force.state].filter(Boolean).join(', '),
      photo: force.photoUrl || force.logoUrl || null,
      isActive: force.isActive,
      startedAt: force.createdAt.toISOString(),
      lat: center ? center.lat : null,
      lng: center ? center.lng : null,
      radiusMiles: force.radiusMiles || 5,
      area,
    },
    members: people,
    pets,
    needsCount,
    viewer: {
      signedIn: Boolean(userId),
      isMember: Boolean(mine),
      isLeader: LEADER_ROLES.includes(mine?.role),
      isAdmin: platformRole === 'ADMIN',
      role: mine?.role || null,
    },
  };
}

// React's per-request cache is in the server build Next.js runs; plain
// React (the tests) has none, and there each call reads afresh.
const perRequest = React.cache || ((fn) => fn);

export const getForcePage = perRequest(readForcePage);
