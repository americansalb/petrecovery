/**
 * Joining a search (POST /api/mission/[missionId]/volunteer, action JOIN).
 *
 * It takes no account, so each join makes a new helper for nothing, and
 * everyone a search has joined is listed on its owner's desk and can write
 * to them. One connection may therefore not make helpers without end; a
 * whole search party joining from one house still gets in.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: { case: { findFirst: jest.fn() } } }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn(async () => null) }));
jest.mock('@/app/lib/missionControl/ensure', () => ({ __esModule: true, ensureMissionControl: jest.fn(async () => ({ id: 'mc-1' })) }));
jest.mock('@/app/lib/missionControl/volunteerOps', () => ({
  __esModule: true,
  quickJoin: jest.fn(async () => ({ success: true, volunteerId: 'vol-1' })),
  updateLocation: jest.fn(),
  flagResources: jest.fn(),
  sendSignal: jest.fn(),
  checkIn: jest.fn(async () => ({ success: true })),
  checkOut: jest.fn(),
}));
jest.mock('@/app/lib/rateLimit', () => ({ __esModule: true, withRateLimitAsync: jest.fn(async () => ({ success: true })) }));
jest.mock('@/app/lib/missionControl/guard', () => ({ __esModule: true, ownVolunteerId: jest.fn(async () => 'vol-1'), cleanPlace: (p) => p || null }));

import prisma from '@/app/lib/prisma';
import { quickJoin, checkIn } from '@/app/lib/missionControl/volunteerOps';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import { POST } from '@/app/api/mission/[missionId]/volunteer/route';

const post = (body) => POST(new NextRequest('http://localhost/api/mission/AUS-2026-0001/volunteer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: { missionId: 'AUS-2026-0001' } });
const JOIN = { action: 'JOIN', deviceId: 'dev_abc', name: 'Dana', waiverAccepted: true };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findFirst.mockResolvedValue({ id: 'case-max' });
  withRateLimitAsync.mockResolvedValue({ success: true });
});

test('a join is counted against its connection: thirty in ten minutes, enough for a search party at one house', async () => {
  const res = await post(JOIN);
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ success: true, volunteerId: 'vol-1' });
  expect(withRateLimitAsync).toHaveBeenCalledTimes(1);
  const [, limit, key] = withRateLimitAsync.mock.calls[0];
  expect(key).toBe('search:join');
  expect(limit).toEqual({ windowMs: 10 * 60 * 1000, maxRequests: 30, blockDurationMs: 10 * 60 * 1000 });
});

test('past it nobody is made, and the answer is a sentence the join card can show', async () => {
  withRateLimitAsync.mockResolvedValue({ success: false, retryAfter: 600 });
  const res = await post(JOIN);
  expect(res.status).toBe(429);
  expect(await res.json()).toEqual({ error: 'A lot of people have joined from this connection in the last few minutes. Try again in a little while.' });
  expect(quickJoin).not.toHaveBeenCalled();
  expect(prisma.case.findFirst).not.toHaveBeenCalled();
});

test('what a helper who has already joined does is not counted as joining', async () => {
  const res = await post({ action: 'CHECK_IN', volunteerId: 'vol-1', estimatedMinutes: 30 });
  expect(res.status).toBe(200);
  expect(checkIn).toHaveBeenCalled();
  // It has a count of its own (__tests__/api/mission-volunteer-proof.test.js), and never the join's.
  expect(withRateLimitAsync.mock.calls.map(([, , key]) => key)).toEqual(['search:helper']);
});
