/**
 * A pet's page (app/cases/[caseNumber]) is the one place where everyone
 * helping with that pet meets. This reads what the Rescue Force looking for
 * the pet has for it: the force, the pet's open needs and the ones already
 * done, the next search party, how many people are out searching now, and
 * the force's other pets. GET /api/public/missions/[caseNumber]/help serves
 * it to the page and to the phone apps.
 *
 * Public, like the force's own page. Need notes, where the viewer stands on
 * each need, and where a search party meets are for members of the force:
 * a post can hold an address (SEC-12, the rule the Discussion follows).
 */

import prisma from '@/app/lib/prisma';
import { listNeeds, recentNeedActivity } from '@/app/lib/forceNeeds';
import { caseStatus, caseTitle } from '@/app/lib/caseLabels';
import { isCaseOpen } from '@/app/lib/caseStatus';
import { whenText } from '@/app/lib/forcePage';

const LIVE_ASSIGNMENTS = ['ACCEPTED', 'ACTIVE', 'STANDBY'];
const OPEN_CASES = ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'];
// Out searching now: recording a walk in the last half hour, or holding a
// block of the search map claimed in the last two hours.
const WALK_WINDOW_MS = 30 * 60 * 1000;
const CLAIM_WINDOW_MS = 2 * 3600 * 1000;
const OTHERS_SHOWN = 8;
const CASE_ID = /^c[a-z0-9]{24}$/;

const OTHER_FIELDS = {
  id: true,
  caseNumber: true,
  status: true,
  reportType: true,
  resolution: true,
  petName: true,
  petSpecies: true,
  petPhotoUrl: true,
  lastSeenAt: true,
  createdAt: true,
  resolvedAt: true,
};

/** People searching for the pet right now, each counted once. */
export async function searchingNow(caseId, now = new Date()) {
  const walkSince = new Date(now.getTime() - WALK_WINDOW_MS);
  const claimSince = new Date(now.getTime() - CLAIM_WINDOW_MS);
  const [walks, claims] = await Promise.all([
    prisma.searchSession.findMany({
      where: {
        missionId: caseId,
        status: 'ACTIVE',
        OR: [{ lastLocationUpdate: { gte: walkSince } }, { startedAt: { gte: walkSince } }],
      },
      select: { userId: true },
    }),
    prisma.gridCell.findMany({
      where: { grid: { caseId }, status: 'IN_PROGRESS', claimedAt: { gte: claimSince } },
      select: { claimedById: true },
    }),
  ]);
  const people = new Set([...walks.map((w) => w.userId), ...claims.map((c) => c.claimedById)].filter(Boolean));
  // A walk recorded without an account is still a person out searching.
  return people.size + walks.filter((w) => !w.userId).length;
}

/** The pet's next search party. Where it meets only for members. */
async function nextParty(forceId, caseId, { userId, member, now }) {
  const post = await prisma.squadPost.findFirst({
    where: { rescueSquadId: forceId, caseId, isDeleted: false, topic: 'SEARCH_PARTY', eventAt: { gte: now } },
    orderBy: { eventAt: 'asc' },
    select: {
      id: true,
      eventAt: true,
      eventPlace: true,
      _count: { select: { going: true } },
      ...(userId && { going: { where: { userId }, select: { id: true } } }),
    },
  });
  if (!post) return null;
  return {
    id: post.id,
    at: post.eventAt.toISOString(),
    place: member ? post.eventPlace : null,
    goingCount: post._count.going,
    iAmGoing: Boolean(post.going?.length),
  };
}

/** The force's other pets: still missing first, newest first, then the latest home. */
async function otherPets(forceId, caseId) {
  const rows = await prisma.caseAssignment.findMany({
    where: {
      rescueSquadId: forceId,
      missionId: { not: caseId },
      OR: [{ status: { in: LIVE_ASSIGNMENTS }, case: { status: { in: OPEN_CASES } } }, { case: { status: 'REUNITED' } }],
    },
    orderBy: { case: { lastSeenAt: 'desc' } },
    select: { case: { select: OTHER_FIELDS } },
    take: 40,
  });
  const pets = rows.map((r) => ({ c: r.case, key: caseStatus(r.case).key }));
  const at = (d) => (d ? new Date(d).getTime() : 0);
  const live = pets
    .filter((p) => p.key === 'lost' || p.key === 'found')
    .sort((a, b) => at(b.c.lastSeenAt || b.c.createdAt) - at(a.c.lastSeenAt || a.c.createdAt));
  const home = pets.filter((p) => p.key === 'home').sort((a, b) => at(b.c.resolvedAt) - at(a.c.resolvedAt));
  return [...live, ...home].slice(0, OTHERS_SHOWN).map(({ c, key }) => ({
    caseNumber: c.caseNumber,
    name: caseTitle(c),
    species: c.petSpecies || null,
    photo: c.petPhotoUrl || null,
    status: key,
    when: whenText(c, key),
  }));
}

/**
 * Everything the pet's page shows about the force looking for it, or null
 * when there is no such pet. `caseRef` is a case number or a case id.
 */
export async function getPetRoom(caseRef, { userId = null, now = new Date() } = {}) {
  const pet = await prisma.case.findUnique({
    where: CASE_ID.test(String(caseRef)) ? { id: caseRef } : { caseNumber: String(caseRef) },
    select: { id: true, status: true },
  });
  if (!pet) return null;

  const open = isCaseOpen(pet.status);
  const [assignments, searching] = await Promise.all([
    prisma.caseAssignment.findMany({
      where: { missionId: pet.id, status: { not: 'WITHDRAWN' }, rescueSquad: { is: { isDeleted: false } } },
      orderBy: { acceptedAt: 'asc' },
      select: { rescueSquad: { select: { id: true, name: true } } },
    }),
    open ? searchingNow(pet.id, now) : 0,
  ]);

  const empty = { force: null, member: false, needs: [], done: [], party: null, searchingNow: searching, others: [] };
  const forces = assignments.map((a) => a.rescueSquad).filter(Boolean);
  if (!forces.length) return empty;

  // The viewer's own force when they are in one, else the first to take the pet on.
  const memberships = userId
    ? await prisma.rescueForceMember.findMany({
        where: { userId, isActive: true, rescueSquadId: { in: forces.map((f) => f.id) } },
        select: { rescueSquadId: true },
      })
    : [];
  const mine = new Set(memberships.map((m) => m.rescueSquadId));
  const force = forces.find((f) => mine.has(f.id)) || forces[0];
  const member = mine.has(force.id);

  const [needs, done, party, others] = await Promise.all([
    open ? listNeeds(force.id, { userId: member ? userId : null, member, caseId: pet.id }) : [],
    recentNeedActivity(force.id, { userId, caseId: pet.id, take: 10 }),
    open ? nextParty(force.id, pet.id, { userId: member ? userId : null, member, now }) : null,
    otherPets(force.id, pet.id),
  ]);

  return { ...empty, force: { id: force.id, name: force.name }, member, needs, done, party, others };
}
