/**
 * The older mission routes that are the owner's alone:
 *
 *   GET  /api/mission/[missionId]          the state (home address, where helpers are)
 *   POST /api/mission/[missionId]          ACTIVATE, PAUSE, RESUME
 *   call mode in app/lib/missionControl/ownerHub.js (the owner's voice to every phone)
 *
 * Pausing took no check at all, pushed a sentence of the caller's own to
 * every helper's phone, and acted on whatever mission id the request named
 * whatever pet the address was for. The state went to anyone signed in.
 * Call mode could be started and stopped by anyone signed in.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findFirst: jest.fn(), findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    missionControl: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
    missionVolunteer: { findMany: jest.fn(async () => []) },
    missionLog: { create: jest.fn(async () => ({})) },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn(async () => null) }));
jest.mock('@/app/lib/missionControl/state', () => ({ __esModule: true, getMissionState: jest.fn(async () => ({ id: 'mc-1', lastSeen: { address: '4001 Ramsey Ave' } })) }));
jest.mock('@/app/lib/missionControl/activation', () => ({
  __esModule: true,
  activateMission: jest.fn(async () => ({ success: true, mode: 'LIVE_SEARCH' })),
  pauseMission: jest.fn(async () => ({ success: true, mode: 'STANDBY' })),
  resumeMission: jest.fn(async () => ({ success: true, mode: 'LIVE_SEARCH' })),
}));
jest.mock('@/app/lib/rateLimit', () => ({ __esModule: true, withRateLimitAsync: jest.fn(async () => ({ success: true })), rateLimitResponse: () => new Response('{}', { status: 429 }) }));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn(async () => null) }));
jest.mock('@/app/lib/push', () => ({ __esModule: true, sendPushToMany: jest.fn(async () => ({})), PUSH_TEMPLATES: { GENERIC: () => ({}) } }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { getMissionState } from '@/app/lib/missionControl/state';
import { activateMission, pauseMission, resumeMission } from '@/app/lib/missionControl/activation';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import { GET, POST } from '@/app/api/mission/[missionId]/route';

const URL = 'http://localhost/api/mission/AUS-2026-0001';
const ctx = { params: { missionId: 'AUS-2026-0001' } };
const get = () => GET(new NextRequest(URL), ctx);
const post = (body) => POST(new NextRequest(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }), ctx);
const as = (id) => getServerSession.mockResolvedValue(id ? { user: { id } } : null);

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findFirst.mockResolvedValue({ id: 'case-max', reporterId: 'u-avery' });
  prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
  prisma.missionControl.findUnique.mockResolvedValue({ id: 'mc-max' });
  withRateLimitAsync.mockResolvedValue({ success: true });
  as(null);
});

describe('the state', () => {
  test('nobody signed in: 401', async () => {
    expect((await get()).status).toBe(401);
    expect(getMissionState).not.toHaveBeenCalled();
  });

  test('someone signed in who is not the owner: 403, and nothing is read', async () => {
    as('u-stranger');
    const res = await get();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Only the owner can do that.', code: 'NOT_ALLOWED' });
    expect(getMissionState).not.toHaveBeenCalled();
  });

  test('the owner reads it, for the pet the address names (its number works as well as its id)', async () => {
    as('u-avery');
    const res = await get();
    expect(res.status).toBe(200);
    expect(getMissionState).toHaveBeenCalledWith('case-max');
  });

  test('staff read it', async () => {
    as('u-staff');
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    expect((await get()).status).toBe(200);
  });

  test('a link that matches no pet: 404', async () => {
    as('u-avery');
    prisma.case.findFirst.mockResolvedValue(null);
    expect((await get()).status).toBe(404);
  });
});

describe('pausing, resuming, activating', () => {
  test.each(['ACTIVATE', 'PAUSE', 'RESUME'])('%s by someone who is not the owner: 403, and nothing is done', async (action) => {
    as('u-stranger');
    const res = await post({ action, missionId: 'mc-other-pet', reason: 'Everyone go home.' });
    expect(res.status).toBe(403);
    expect(activateMission).not.toHaveBeenCalled();
    expect(pauseMission).not.toHaveBeenCalled();
    expect(resumeMission).not.toHaveBeenCalled();
  });

  test('a command role in a Rescue Force is not the owner', async () => {
    // The route asks only who reported the pet and who is staff: it never reads force membership.
    as('u-force-leader');
    expect((await post({ action: 'PAUSE' })).status).toBe(403);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u-force-leader' }, select: { role: true } });
  });

  test('the owner pauses the mission of the pet the address names, never the one an id in the request names', async () => {
    as('u-avery');
    const res = await post({ action: 'PAUSE', missionId: 'mc-other-pet', reason: `  Back at   nine.${String.fromCharCode(0x202e)}  ` });
    expect(res.status).toBe(200);
    expect(prisma.missionControl.findUnique).toHaveBeenCalledWith({ where: { caseId: 'case-max' }, select: { id: true } });
    // The reason goes to phones: one line, without what is not text.
    expect(pauseMission).toHaveBeenCalledWith('mc-max', 'u-avery', 'Back at nine.');
  });

  test('a reason is a sentence: 200 characters at most, and only text', async () => {
    as('u-avery');
    await post({ action: 'PAUSE', reason: 'x'.repeat(5000) });
    expect(pauseMission.mock.calls[0][2]).toHaveLength(200);
    await post({ action: 'PAUSE', reason: { $ne: null } });
    expect(pauseMission.mock.calls[1][2]).toBeUndefined();
  });

  test('resuming is the same pet too', async () => {
    as('u-avery');
    await post({ action: 'RESUME', missionId: 'mc-other-pet' });
    expect(resumeMission).toHaveBeenCalledWith('mc-max', 'u-avery');
  });

  test('activating takes the pet from the address and a radius that is a number', async () => {
    as('u-avery');
    await post({ action: 'ACTIVATE', radiusMiles: 9999, anything: 'else' });
    expect(activateMission).toHaveBeenCalledWith('case-max', 'u-avery', { radiusMiles: 25 });
    await post({ action: 'ACTIVATE', radiusMiles: 'wide' });
    expect(activateMission).toHaveBeenLastCalledWith('case-max', 'u-avery', {});
  });

  test('an action nobody knows, or a body that is not an object: 400 before anything is read', async () => {
    as('u-avery');
    expect((await post({ action: 'DELETE_EVERYTHING' })).status).toBe(400);
    expect((await post('[]')).status).toBe(400);
    expect((await post('nonsense')).status).toBe(400);
    expect(prisma.case.findFirst).not.toHaveBeenCalled();
  });

  test('counted per connection, and nothing happens past the count', async () => {
    as('u-avery');
    withRateLimitAsync.mockResolvedValue({ success: false });
    expect((await post({ action: 'PAUSE' })).status).toBe(429);
    expect(pauseMission).not.toHaveBeenCalled();
  });
});

describe('who may activate, in the library itself', () => {
  test('the owner and staff, and not a force leader', async () => {
    const { canActivate } = jest.requireActual('@/app/lib/missionControl/activation');
    const members = [{ userId: 'u-force-leader', role: 'LEADER' }];
    prisma.case.findUnique.mockResolvedValue({ id: 'case-max', reporterId: 'u-avery', assignment: { rescueSquad: { members } } });
    expect(await canActivate('case-max', 'u-avery')).toEqual({ allowed: true, role: 'OWNER' });
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
    expect(await canActivate('case-max', 'u-force-leader')).toEqual({ allowed: false, reason: 'Only the owner can activate' });
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    expect(await canActivate('case-max', 'u-staff')).toEqual({ allowed: true, role: 'ADMIN' });
  });
});

describe('call mode: the owner\'s voice on every helper\'s phone', () => {
  const { triggerCallMode, stopCallMode } = jest.requireActual('@/app/lib/missionControl/ownerHub');
  const mission = { id: 'mc-max', ownerVoiceClipUrl: 'https://cdn.example/voice.mp3', case: { reporterId: 'u-avery' } };

  test('someone who is not the owner starts nothing', async () => {
    prisma.missionControl.findUnique.mockResolvedValue(mission);
    expect(await triggerCallMode('mc-max', 'u-stranger')).toEqual({ success: false, error: 'Unauthorized' });
    expect(prisma.missionControl.update).not.toHaveBeenCalled();
    expect(prisma.missionVolunteer.findMany).not.toHaveBeenCalled();
  });

  test('and stops nothing', async () => {
    prisma.missionControl.findUnique.mockResolvedValue(mission);
    expect(await stopCallMode('mc-max', 'u-stranger')).toEqual({ success: false, error: 'Unauthorized' });
    expect(await stopCallMode('mc-max', undefined)).toEqual({ success: false, error: 'Unauthorized' });
    expect(prisma.missionControl.update).not.toHaveBeenCalled();
  });

  test('a mission that is not there is refused, not a crash', async () => {
    prisma.missionControl.findUnique.mockResolvedValue(null);
    expect(await triggerCallMode('mc-gone', 'u-avery')).toEqual({ success: false, error: 'Unauthorized' });
    expect(await stopCallMode('mc-gone', 'u-avery')).toEqual({ success: false, error: 'Unauthorized' });
  });

  test('the owner stops it', async () => {
    prisma.missionControl.findUnique.mockResolvedValue(mission);
    expect(await stopCallMode('mc-max', 'u-avery')).toEqual({ success: true });
    expect(prisma.missionControl.update).toHaveBeenCalledWith({ where: { id: 'mc-max' }, data: { callModeActive: false } });
  });
});
