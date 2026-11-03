/**
 * PATCH /api/missions/[id]: the owner changes the photo, the description
 * or the phone on their report; nobody else does, and nothing else moves.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findUnique: jest.fn(), update: jest.fn(async ({ data }) => ({ id: 'case-max', caseNumber: 'AUS-2026-0001', ...data })) },
  },
}));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => {}) }));
jest.mock('@/app/lib/utils', () => ({ __esModule: true, normalizePhotoUrl: (u) => u }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { PATCH } from '@/app/api/missions/[missionId]/route';

const call = (body, user = { id: 'avery' }) => {
  getServerSession.mockResolvedValue(user ? { user } : null);
  return PATCH(new Request('http://localhost/api/missions/case-max', { method: 'PATCH', body: JSON.stringify(body) }), { params: { missionId: 'case-max' } });
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findUnique.mockResolvedValue({ id: 'case-max', reporterId: 'avery', caseNumber: 'AUS-2026-0001' });
});

test('the owner sets a better photo, a description and the phone', async () => {
  const res = await call({ petPhotoUrl: 'https://cdn.example/max.jpg', petDescription: 'Blue collar, answers to Max.', ownerPhone: '(512) 555 0100' });
  expect(res.status).toBe(200);
  expect(prisma.case.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: { petPhotoUrl: 'https://cdn.example/max.jpg', petDescription: 'Blue collar, answers to Max.', ownerPhone: '(512) 555 0100' } })
  );
});

test('a helper, a stranger, and the signed-out are refused', async () => {
  expect((await call({ petDescription: 'x' }, { id: 'sarah' })).status).toBe(403);
  expect((await call({ petDescription: 'x' }, null)).status).toBe(401);
  expect(prisma.case.update).not.toHaveBeenCalled();
});

test('an admin may fix a report', async () => {
  expect((await call({ petDescription: 'x' }, { id: 'staff', role: 'ADMIN' })).status).toBe(200);
});

test('bad values are refused in words, and the last-seen place never moves here', async () => {
  expect((await call({ petPhotoUrl: 'not a url' })).status).toBe(400);
  expect((await call({ ownerPhone: '555' })).status).toBe(400);
  expect((await call({ lastSeenLatitude: 1 })).status).toBe(400);
  expect((await call({})).status).toBe(400);
  expect(prisma.case.update).not.toHaveBeenCalled();
});

test('a report that is not there', async () => {
  prisma.case.findUnique.mockResolvedValue(null);
  expect((await call({ petDescription: 'x' })).status).toBe(404);
});
