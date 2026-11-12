/**
 * The list of reports (GET /api/missions).
 *
 * Every row carries its owner's name and email address. It went, whole, to
 * any signed-in account: a hundred reports a page. The whole list is
 * staff's, by the role in the database; anyone else is given their own
 * reports, whatever the request asks for.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: { case: { findMany: jest.fn(async () => []), count: jest.fn(async () => 0) }, user: { findUnique: jest.fn() } } }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => ({})) }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { GET } from '@/app/api/missions/route';

const list = (query = '') => GET(new NextRequest(`http://localhost/api/missions${query}`));
const asked = () => prisma.case.findMany.mock.calls.at(-1)[0].where;

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: 'u-david', role: 'USER' } });
  prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
});

test('an ordinary account is given its own reports, and nobody else\'s', async () => {
  expect((await list()).status).toBe(200);
  expect(asked()).toMatchObject({ reporterId: 'u-david' });
});

test('whatever it asks for: no filter widens the list', async () => {
  for (const query of ['?myOnly=false', '?limit=100&offset=0', '?status=ACTIVE&unassigned=true', '?search=a', '?squadId=force-1']) {
    await list(query);
    expect({ query, own: asked().reporterId }).toEqual({ query, own: 'u-david' });
  }
});

test('a session that says ADMIN is not believed: the role is read from the database', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'u-david', role: 'ADMIN' } });
  await list();
  expect(asked()).toMatchObject({ reporterId: 'u-david' });
  expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u-david' }, select: { role: true } });
});

test('staff read the whole list, or their own when they ask for it', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'u-staff', role: 'ADMIN' } });
  prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
  await list();
  expect(asked().reporterId).toBeUndefined();
  await list('?myOnly=true');
  expect(asked().reporterId).toBe('u-staff');
});

test('nobody signed in: 401, and nothing is read', async () => {
  getServerSession.mockResolvedValue(null);
  expect((await list()).status).toBe(401);
  expect(prisma.case.findMany).not.toHaveBeenCalled();
});
