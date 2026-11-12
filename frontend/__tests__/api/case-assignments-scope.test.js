/**
 * The forces assigned to one pet, and who in them is on it
 * (GET /api/missions/[missionId]/assignments).
 *
 * It took no sign-in and read the wrong name for its own address, so it
 * filtered by nothing: it answered with every assignment on the site, each
 * with its people's account ids and names. Read on the live site on
 * 2026-11-12 with a made-up id: 80 assignments came back.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { case: { findFirst: jest.fn(), findUnique: jest.fn() }, caseAssignment: { findMany: jest.fn(async () => []) }, user: { findUnique: jest.fn() }, missionVolunteer: { findFirst: jest.fn() } },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn(async () => null) }));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn(async () => null) }));
jest.mock('@/app/lib/rateLimit', () => ({ __esModule: true, withRateLimitAsync: jest.fn(async () => ({ success: true })), rateLimitResponse: () => new Response('{}', { status: 429 }), RateLimitPresets: { SEARCH_READ: {} } }));

import prisma from '@/app/lib/prisma';
import { searcherFor } from '@/app/lib/searcher';
import { GET } from '@/app/api/missions/[missionId]/assignments/route';
import { mayKnowThePeople } from '@/app/lib/missionControl/guard';

const get = (id = 'case-max') => GET(new NextRequest(`http://localhost/api/missions/${id}/assignments`), { params: { missionId: id } });
const OWNER = { id: 'u-avery', userId: 'u-avery', seesNames: true, isOwner: true };
const MEMBER = { id: 'u-sarah', userId: 'u-sarah', seesNames: true, isOwner: false };
const STRANGER = { id: 'u-x', userId: 'u-x', seesNames: false };
const HELPER = { id: 'v:vol-1', userId: null, volunteerId: 'vol-1', seesNames: false };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findFirst.mockResolvedValue({ id: 'case-max' });
  prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
  searcherFor.mockResolvedValue(null);
});

test('with no sign-in nothing is read', async () => {
  const res = await get();
  expect(res.status).toBe(401);
  expect(prisma.caseAssignment.findMany).not.toHaveBeenCalled();
});

test.each([['a signed-in stranger', STRANGER], ['a helper from the link', HELPER]])('%s is refused', async (_who, searcher) => {
  searcherFor.mockResolvedValue(searcher);
  expect((await get()).status).toBe(403);
  expect(prisma.caseAssignment.findMany).not.toHaveBeenCalled();
});

test.each([['the owner', OWNER], ['a member of a force looking for the pet', MEMBER]])('%s reads this pet\'s assignments, and only this pet\'s', async (_who, searcher) => {
  searcherFor.mockResolvedValue(searcher);
  expect((await get('AUS-2026-0001')).status).toBe(200);
  const asked = prisma.caseAssignment.findMany.mock.calls[0][0];
  // The pet the address names: never an empty filter.
  expect(asked.where).toEqual({ missionId: 'case-max' });
  // People as first names: no account id, no last name.
  expect(asked.include.participants.select.user.select).toEqual({ firstName: true, rescueLevel: true });
});

test('staff read it too', async () => {
  searcherFor.mockResolvedValue(STRANGER);
  prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
  expect((await get()).status).toBe(200);
});

test('an address that matches no pet is a 404, not everything', async () => {
  searcherFor.mockResolvedValue(OWNER);
  prisma.case.findFirst.mockResolvedValue(null);
  expect((await get('anything')).status).toBe(404);
  expect(prisma.caseAssignment.findMany).not.toHaveBeenCalled();
});

test('the guard: who may know the people on a search', async () => {
  searcherFor.mockResolvedValue(null);
  expect(await mayKnowThePeople({}, 'case-max')).toMatchObject({ allowed: false, status: 401 });
  searcherFor.mockResolvedValue(HELPER);
  expect(await mayKnowThePeople({}, 'case-max')).toMatchObject({ allowed: false, status: 403 });
  searcherFor.mockResolvedValue(MEMBER);
  expect(await mayKnowThePeople({}, 'case-max')).toMatchObject({ allowed: true, staff: false });
  searcherFor.mockResolvedValue(STRANGER);
  prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
  expect(await mayKnowThePeople({}, 'case-max')).toMatchObject({ allowed: true, staff: true });
});

test('the account that accepted the pet for a force is not in the answer', async () => {
  searcherFor.mockResolvedValue(OWNER);
  prisma.caseAssignment.findMany.mockResolvedValueOnce([{ id: 'a-1', missionId: 'case-max', rescueSquadId: 'force-1', status: 'ACCEPTED', acceptedById: 'u-sarah', rescueSquad: { id: 'force-1', name: 'Austin' }, participants: [] }]);
  const body = await (await get()).json();
  expect(body.assignments).toHaveLength(1);
  expect(JSON.stringify(body)).not.toMatch(/acceptedById|u-sarah/);
});
