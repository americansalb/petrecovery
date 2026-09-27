/**
 * A pet's page as the one place its helpers meet (app/lib/petRoom.js and
 * GET /api/public/missions/[caseNumber]/help): which Rescue Force is
 * looking for the pet, its needs and search party for the pet, who is out
 * searching, and the force's other pets.
 *
 * The page is public. Where a search party meets and a need's notes are
 * for members of the force (SEC-12: a post can hold an address).
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findUnique: jest.fn(), findMany: jest.fn() },
    caseAssignment: { findMany: jest.fn() },
    rescueForceMember: { findMany: jest.fn() },
    squadTask: { findMany: jest.fn() },
    squadActivity: { findMany: jest.fn() },
    squadPost: { findFirst: jest.fn() },
    searchSession: { findMany: jest.fn() },
    gridCell: { findMany: jest.fn() },
  },
}));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('@/app/lib/authz', () => ({ __esModule: true, getUserRole: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { getPetRoom, searchingNow } from '@/app/lib/petRoom';
import { GET as getHelp } from '@/app/api/public/missions/[caseNumber]/help/route';

const NOW = new Date('2026-09-27T12:00:00Z');
const HOUR = 3600e3;
const MAX = { id: 'case-max', status: 'ACTIVE' };
const AUSTIN = { id: 'force-austin', name: 'Austin Rescue Force' };
const ROUND_ROCK = { id: 'force-rr', name: 'Round Rock Rescue Force' };

function other(caseNumber, status, extra = {}) {
  return {
    case: {
      id: `id-${caseNumber}`,
      caseNumber,
      status,
      reportType: 'LOST',
      resolution: null,
      petName: caseNumber,
      petSpecies: 'DOG',
      petPhotoUrl: null,
      lastSeenAt: new Date(NOW.getTime() - 48 * HOUR),
      createdAt: new Date(NOW.getTime() - 48 * HOUR),
      resolvedAt: null,
      ...extra,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findUnique.mockResolvedValue(MAX);
  prisma.case.findMany.mockResolvedValue([{ id: 'case-max', caseNumber: 'AUS-2026-0001', status: 'ACTIVE', reportType: 'LOST', petName: 'Max', petSpecies: 'DOG' }]);
  prisma.searchSession.findMany.mockResolvedValue([]);
  prisma.gridCell.findMany.mockResolvedValue([]);
  prisma.caseAssignment.findMany.mockImplementation(async (args) =>
    args.where.missionId === 'case-max' ? [{ rescueSquad: AUSTIN }] : []
  );
  prisma.rescueForceMember.findMany.mockResolvedValue([]);
  prisma.squadTask.findMany.mockResolvedValue([]);
  prisma.squadActivity.findMany.mockResolvedValue([]);
  prisma.squadPost.findFirst.mockResolvedValue(null);
});

test('no such pet: null', async () => {
  prisma.case.findUnique.mockResolvedValue(null);
  expect(await getPetRoom('AUS-2026-9999', { now: NOW })).toBeNull();
  // A case number is looked up by number, an id by id.
  expect(prisma.case.findUnique.mock.calls[0][0].where).toEqual({ caseNumber: 'AUS-2026-9999' });
  await getPetRoom('cmuh8qkj5000u3zr9156gvvqp', { now: NOW });
  expect(prisma.case.findUnique.mock.calls[1][0].where).toEqual({ id: 'cmuh8qkj5000u3zr9156gvvqp' });
});

test('no force looking for the pet: only who is searching', async () => {
  prisma.caseAssignment.findMany.mockResolvedValue([]);
  prisma.searchSession.findMany.mockResolvedValue([{ userId: 'u-sarah' }]);
  expect(await getPetRoom('AUS-2026-0001', { now: NOW })).toEqual({
    force: null,
    member: false,
    needs: [],
    done: [],
    party: null,
    searchingNow: 1,
    others: [],
  });
  // A force that withdrew is not looking any more; a deleted one is gone.
  expect(prisma.caseAssignment.findMany.mock.calls[0][0].where).toMatchObject({
    missionId: 'case-max',
    status: { not: 'WITHDRAWN' },
    rescueSquad: { is: { isDeleted: false } },
  });
});

test("a visitor sees the force's needs for this pet, a party without its place, and the force's other pets", async () => {
  prisma.squadTask.findMany.mockResolvedValue([
    {
      id: 'need-trail',
      title: 'Walk the greenbelt trail',
      description: 'Meet at 12 Oak St',
      caseId: 'case-max',
      peopleNeeded: 3,
      ownerRequested: false,
      ownerRequestedHelp: false,
      createdAt: new Date(NOW.getTime() - HOUR),
      participants: [{ userId: 'u-mike', status: 'ACTIVE' }],
    },
  ]);
  prisma.squadActivity.findMany.mockResolvedValue([
    { id: 'act-1', details: 'Call Austin Animal Center', actorId: 'u-mike', createdAt: new Date(NOW.getTime() - HOUR), actor: { firstName: 'Mike' } },
  ]);
  prisma.squadPost.findFirst.mockResolvedValue({
    id: 'party-1',
    eventAt: new Date(NOW.getTime() + 24 * HOUR),
    eventPlace: 'Zilker Park, main parking lot',
    _count: { going: 2 },
  });
  prisma.caseAssignment.findMany.mockImplementation(async (args) =>
    args.where.missionId === 'case-max'
      ? [{ rescueSquad: AUSTIN }]
      : [
          other('AUS-HOME', 'REUNITED', { resolvedAt: new Date(NOW.getTime() - 24 * HOUR) }),
          other('AUS-OLD', 'ACTIVE', { lastSeenAt: new Date(NOW.getTime() - 72 * HOUR) }),
          other('AUS-NEW', 'ACTIVE', { lastSeenAt: new Date(NOW.getTime() - 3 * HOUR) }),
        ]
  );

  const room = await getPetRoom('AUS-2026-0001', { now: NOW });

  expect(room.force).toEqual(AUSTIN);
  expect(room.member).toBe(false);
  // Only this pet's needs, and no notes for a visitor.
  expect(prisma.squadTask.findMany.mock.calls[0][0].where).toMatchObject({ rescueSquadId: 'force-austin', caseId: 'case-max' });
  expect(room.needs).toHaveLength(1);
  expect(room.needs[0]).toMatchObject({ id: 'need-trail', details: null, peopleNeeded: 3, taken: 1, mine: null });
  expect(prisma.squadActivity.findMany.mock.calls[0][0].where).toMatchObject({ rescueSquadId: 'force-austin', type: 'NEED_DONE', caseId: 'case-max' });
  expect(room.done).toEqual([{ id: 'act-1', text: 'Mike finished: Call Austin Animal Center', at: expect.any(String) }]);

  // The next party for this pet, still to come; where it meets stays with members.
  expect(prisma.squadPost.findFirst.mock.calls[0][0].where).toMatchObject({
    rescueSquadId: 'force-austin',
    caseId: 'case-max',
    topic: 'SEARCH_PARTY',
    isDeleted: false,
    eventAt: { gte: NOW },
  });
  expect(room.party).toEqual({ id: 'party-1', at: new Date(NOW.getTime() + 24 * HOUR).toISOString(), place: null, goingCount: 2, iAmGoing: false });

  // Still missing first (newest first), then home; never this pet itself.
  const othersQuery = prisma.caseAssignment.findMany.mock.calls.find((c) => c[0].where.rescueSquadId)[0];
  expect(othersQuery.where.missionId).toEqual({ not: 'case-max' });
  expect(room.others.map((p) => [p.caseNumber, p.status])).toEqual([
    ['AUS-NEW', 'lost'],
    ['AUS-OLD', 'lost'],
    ['AUS-HOME', 'home'],
  ]);
  expect(room.others[2].when).toMatch(/^Reunited/);
});

test('a member gets where the party meets, whether they are going, and the notes on a need', async () => {
  prisma.rescueForceMember.findMany.mockResolvedValue([{ rescueSquadId: 'force-austin' }]);
  prisma.squadTask.findMany.mockResolvedValue([
    {
      id: 'need-trail',
      title: 'Walk the greenbelt trail',
      description: 'Bring treats',
      caseId: 'case-max',
      peopleNeeded: 3,
      ownerRequested: true,
      ownerRequestedHelp: false,
      createdAt: new Date(NOW.getTime() - HOUR),
      participants: [{ userId: 'u-mike', status: 'ACTIVE' }],
    },
  ]);
  prisma.squadPost.findFirst.mockResolvedValue({
    id: 'party-1',
    eventAt: new Date(NOW.getTime() + 24 * HOUR),
    eventPlace: 'Zilker Park, main parking lot',
    _count: { going: 3 },
    going: [{ id: 'g1' }],
  });

  const room = await getPetRoom('AUS-2026-0001', { userId: 'u-mike', now: NOW });

  expect(room.member).toBe(true);
  expect(room.party).toMatchObject({ place: 'Zilker Park, main parking lot', goingCount: 3, iAmGoing: true });
  expect(prisma.squadPost.findFirst.mock.calls[0][0].select.going).toEqual({ where: { userId: 'u-mike' }, select: { id: true } });
  expect(room.needs[0]).toMatchObject({ details: 'Bring treats', mine: 'on', byOwner: true });
});

test("a pet two forces look for: the viewer's own force, else the first to take it on", async () => {
  prisma.caseAssignment.findMany.mockImplementation(async (args) =>
    args.where.missionId === 'case-max' ? [{ rescueSquad: AUSTIN }, { rescueSquad: ROUND_ROCK }] : []
  );
  expect((await getPetRoom('AUS-2026-0001', { now: NOW })).force).toEqual(AUSTIN);
  expect(prisma.caseAssignment.findMany.mock.calls[0][0].orderBy).toEqual({ acceptedAt: 'asc' });

  prisma.rescueForceMember.findMany.mockResolvedValue([{ rescueSquadId: 'force-rr' }]);
  const room = await getPetRoom('AUS-2026-0001', { userId: 'u-kim', now: NOW });
  expect(room.force).toEqual(ROUND_ROCK);
  expect(room.member).toBe(true);
});

test('a pet back home: the force and its other pets, but nothing left to do', async () => {
  prisma.case.findUnique.mockResolvedValue({ id: 'case-max', status: 'REUNITED' });
  const room = await getPetRoom('AUS-2026-0001', { now: NOW });
  expect(room.force).toEqual(AUSTIN);
  expect(room.needs).toEqual([]);
  expect(room.party).toBeNull();
  expect(room.searchingNow).toBe(0);
  expect(prisma.squadTask.findMany).not.toHaveBeenCalled();
  expect(prisma.squadPost.findFirst).not.toHaveBeenCalled();
  expect(prisma.searchSession.findMany).not.toHaveBeenCalled();
});

test('searching now: each person once, across walks and claimed blocks, lately only', async () => {
  prisma.searchSession.findMany.mockResolvedValue([{ userId: 'u-sarah' }, { userId: 'u-mike' }, { userId: null }]);
  prisma.gridCell.findMany.mockResolvedValue([{ claimedById: 'u-mike' }, { claimedById: 'u-david' }]);
  expect(await searchingNow('case-max', NOW)).toBe(4);

  expect(prisma.searchSession.findMany.mock.calls[0][0].where).toEqual({
    missionId: 'case-max',
    status: 'ACTIVE',
    OR: [{ lastLocationUpdate: { gte: new Date(NOW.getTime() - 30 * 60e3) } }, { startedAt: { gte: new Date(NOW.getTime() - 30 * 60e3) } }],
  });
  expect(prisma.gridCell.findMany.mock.calls[0][0].where).toEqual({
    grid: { caseId: 'case-max' },
    status: 'IN_PROGRESS',
    claimedAt: { gte: new Date(NOW.getTime() - 2 * HOUR) },
  });
});

describe('GET /api/public/missions/[caseNumber]/help', () => {
  const get = (ref) =>
    getHelp(new Request(`http://localhost/api/public/missions/${ref}/help`), { params: Promise.resolve({ caseNumber: ref }) });

  test('signed out: the public room', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await get('AUS-2026-0001');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.force).toEqual(AUSTIN);
    expect(body.member).toBe(false);
    expect(prisma.rescueForceMember.findMany).not.toHaveBeenCalled();
  });

  test('signed in: asks about that person, and 404 for no such pet', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u-mike' } });
    await get('AUS-2026-0001');
    expect(prisma.rescueForceMember.findMany.mock.calls[0][0].where).toMatchObject({ userId: 'u-mike', isActive: true });

    prisma.case.findUnique.mockResolvedValue(null);
    expect((await get('AUS-2026-9999')).status).toBe(404);
  });
});
