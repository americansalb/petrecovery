/**
 * Where each person walked (GET /api/missions/[missionId]/coverage).
 *
 * Nothing on the site calls it. It answered any account, for any pet, with
 * every walker's account id, full name, picture and whole path, and where
 * the ones out now are. The search shows streets as walked, never a
 * person's dot: this is for the owner, the forces looking and staff, and
 * names a person by first name only.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { case: { findUnique: jest.fn() }, searchSession: { findMany: jest.fn() }, user: { findMany: jest.fn(), findUnique: jest.fn() } },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn(async () => ({ user: { id: 'u-x', email: 'x@example.com' } })) }));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { searcherFor } from '@/app/lib/searcher';
import { GET } from '@/app/api/missions/[missionId]/coverage/route';

const get = () => GET(new NextRequest('http://localhost/api/missions/case-max/coverage'), { params: { missionId: 'case-max' } });
const WALK = { id: 'walk-1', userId: 'u-dana', startedAt: new Date(0), endedAt: new Date(1000), endReason: 'USER_ENDED', validatedDistanceMiles: 0.4, locationPings: [{ latitude: 30.3, longitude: -97.7, createdAt: new Date(0) }] };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findUnique.mockResolvedValue({ id: 'case-max' });
  prisma.searchSession.findMany.mockResolvedValue([WALK]);
  prisma.user.findMany.mockResolvedValue([{ id: 'u-dana', firstName: 'Dana' }]);
  prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
});

test('an account that is neither the owner nor in a force looking is given nobody\'s path', async () => {
  searcherFor.mockResolvedValue({ userId: 'u-x', seesNames: false });
  const res = await get();
  expect(res.status).toBe(403);
  expect(prisma.searchSession.findMany).not.toHaveBeenCalled();
});

test('the owner reads it: a first name and a path, and no account id, last name, picture or walk id', async () => {
  searcherFor.mockResolvedValue({ userId: 'u-avery', seesNames: true, isOwner: true });
  const res = await get();
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.completed[0]).toMatchObject({ userName: 'Dana', walker: 1 });
  expect(body.completed[0].path).toHaveLength(1);
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/u-dana|userId|userImage|walk-1|lastName/);
  expect(prisma.user.findMany.mock.calls[0][0].select).toEqual({ id: true, firstName: true });
});
