/**
 * On duty (app/lib/duty.js) and waking members (app/lib/wake.js): who
 * gets a push and who gets only the bell, and that duty ends by itself.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    rescueForceMember: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn(async (a) => a), count: jest.fn() },
    notification: { createMany: jest.fn(async (a) => ({ count: a.data.length })) },
  },
}));
jest.mock('@/app/lib/push', () => ({
  __esModule: true,
  isPushConfigured: jest.fn(() => true),
  sendPushToUser: jest.fn(async () => ({ success: true, sent: 1, failed: 0 })),
}));

import prisma from '@/app/lib/prisma';
import { isPushConfigured, sendPushToUser } from '@/app/lib/push';
import { isOnDuty, setDuty, membersByDuty } from '@/app/lib/duty';
import { wakeForces, WAKE_KINDS } from '@/app/lib/wake';
import { POST as duty } from '@/app/api/rescue-forces/[id]/duty/route';
import { getServerSession } from 'next-auth';

jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));

const NOW = new Date('2026-11-03T18:00:00Z');
const HOUR = 3600e3;
const later = (h) => new Date(NOW.getTime() + h * HOUR);

beforeEach(() => jest.clearAllMocks());

describe('isOnDuty', () => {
  test('on duty until a moment still ahead; off when it has passed or was never set', () => {
    expect(isOnDuty({ onDutyUntil: later(2) }, NOW)).toBe(true);
    expect(isOnDuty({ onDutyUntil: later(-1) }, NOW)).toBe(false);
    expect(isOnDuty({ onDutyUntil: null }, NOW)).toBe(false);
  });
});

describe('setDuty', () => {
  test('a member goes on duty for the hours given, capped at a day', async () => {
    prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'm1' });
    const out = await setDuty({ forceId: 'f1', userId: 'u1', hours: 12, now: NOW });
    expect(out.onDutyUntil).toBe(later(12).toISOString());
    const capped = await setDuty({ forceId: 'f1', userId: 'u1', hours: 99, now: NOW });
    expect(capped.onDutyUntil).toBe(later(24).toISOString());
  });

  test('0 hours is off duty; a non-member gets nothing', async () => {
    prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'm1' });
    expect(await setDuty({ forceId: 'f1', userId: 'u1', hours: 0, now: NOW })).toEqual({ onDutyUntil: null });
    expect(prisma.rescueForceMember.update).toHaveBeenLastCalledWith({ where: { id: 'm1' }, data: { onDutyUntil: null } });
    prisma.rescueForceMember.findFirst.mockResolvedValue(null);
    expect(await setDuty({ forceId: 'f1', userId: 'u1', hours: 12, now: NOW })).toBeNull();
  });
});

describe('membersByDuty', () => {
  test('splits members by duty, each person once, leaving out the one who caused it', async () => {
    prisma.rescueForceMember.findMany.mockResolvedValue([
      { userId: 'sarah', onDutyUntil: later(3) },
      { userId: 'mike', onDutyUntil: later(-2) },
      { userId: 'david', onDutyUntil: null },
      { userId: 'sarah', onDutyUntil: null }, // in a second force too, off duty there
    ]);
    const out = await membersByDuty(['f1', 'f2'], { exceptUserId: 'avery', now: NOW });
    expect(out.onDuty).toEqual(['sarah']);
    expect(out.offDuty.sort()).toEqual(['david', 'mike']);
    expect(prisma.rescueForceMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: { not: 'avery' } }) })
    );
  });
});

describe('wakeForces', () => {
  beforeEach(() => {
    prisma.rescueForceMember.findMany.mockResolvedValue([
      { userId: 'sarah', onDutyUntil: later(3) },
      { userId: 'mike', onDutyUntil: null },
    ]);
  });

  test('everyone gets the bell; only members on duty get the push', async () => {
    const out = await wakeForces({ forceIds: ['f1'], kind: WAKE_KINDS.SIGHTING, title: 'Max was just seen', body: 'Near the trailhead.', url: '/cases/AUS-1', now: NOW });
    expect(out).toEqual({ bell: 2, pushed: 1 });
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: 'sarah', type: 'FORCE_SIGHTING', title: 'Max was just seen', actionUrl: '/cases/AUS-1' }),
        expect.objectContaining({ userId: 'mike' }),
      ]),
    });
    expect(sendPushToUser).toHaveBeenCalledTimes(1);
    expect(sendPushToUser).toHaveBeenCalledWith(prisma, 'sarah', expect.objectContaining({ title: 'Max was just seen', url: '/cases/AUS-1' }));
  });

  test('a search party wakes everyone', async () => {
    await wakeForces({ forceIds: ['f1'], kind: WAKE_KINDS.PARTY, title: 'Search party', body: 'Saturday 9 am', url: '/x', everyone: true, now: NOW });
    expect(sendPushToUser).toHaveBeenCalledTimes(2);
  });

  test('no push set up: the bell still rings, nothing throws', async () => {
    isPushConfigured.mockReturnValueOnce(false);
    const out = await wakeForces({ forceIds: ['f1'], kind: WAKE_KINDS.NEED, title: 't', body: 'b', url: '/x', now: NOW });
    expect(out).toEqual({ bell: 2, pushed: 0 });
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  test('a failure never escapes', async () => {
    prisma.notification.createMany.mockRejectedValueOnce(new Error('db down'));
    const out = await wakeForces({ forceIds: ['f1'], kind: WAKE_KINDS.NEED, title: 't', body: 'b', url: '/x', now: NOW });
    expect(out).toEqual({ bell: 0, pushed: 0 });
  });
});

describe('POST /api/rescue-forces/[id]/duty', () => {
  const call = (body, session = { user: { id: 'u1' } }) => {
    getServerSession.mockResolvedValue(session);
    return duty(new Request('http://localhost/api/rescue-forces/f1/duty', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'f1' }) });
  };

  test('a member goes on duty, default half a day', async () => {
    prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'm1' });
    const res = await call({});
    expect(res.status).toBe(200);
    expect((await res.json()).onDutyUntil).toBeTruthy();
  });

  test('a stranger is told to join; a visitor to sign in; nonsense hours are refused', async () => {
    prisma.rescueForceMember.findFirst.mockResolvedValue(null);
    expect((await call({ hours: 12 })).status).toBe(403);
    expect((await call({ hours: 12 }, null)).status).toBe(401);
    prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'm1' });
    expect((await call({ hours: -3 })).status).toBe(400);
  });
});
