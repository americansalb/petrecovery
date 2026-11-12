/**
 * SEC-1 regression: Mission Command Center authorization.
 *
 * EA's audit found the command route had `// TODO: Verify user is a leader` and
 * zero checks - ANY logged-in user could POST {action:'RESOLVE_DECEASED'} or
 * {action:'BROADCAST'} to ANY missionId, marking a stranger's pet deceased or
 * mass-messaging all volunteers. It was first fixed with userHasCaseAuthority()
 * (owner / assigned squad leader / admin). A squad's command role turned out to
 * be something any member of a leaderless squad can take, so the gate is now
 * the owner or staff, read from the database (app/lib/missionControl/guard.js).
 *
 * Keystone assertion: an unauthorized caller is 403'd AND the dangerous action
 * functions are never invoked.
 *
 * Self-contained mock factories (jest.fn() inside the factory, imported back)
 * avoid the import-hoist TDZ.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    missionControl: { findUnique: jest.fn() },
    case: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn(async () => null) }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: jest.fn(async () => ({ success: true })),
  rateLimitResponse: () => new Response('{}', { status: 429 }),
}));
jest.mock('@/app/lib/missionControl/commandCenter', () => ({
  __esModule: true,
  getCommandView: jest.fn(),
  updateStaleZones: jest.fn(),
  assignZone: jest.fn(),
  sendBroadcast: jest.fn(),
  requestResource: jest.fn(),
  switchToTrapOps: jest.fn(),
  addTrap: jest.fn(),
  checkTrap: jest.fn(),
  getShiftSummary: jest.fn(),
}));
jest.mock('@/app/lib/missionControl/endStates', () => ({
  __esModule: true,
  resolvePetFound: jest.fn(),
  resolvePetDeceased: jest.fn(),
  pauseToColdCase: jest.fn(),
}));

import { GET, POST } from '@/app/api/mission/[missionId]/command/route';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { sendBroadcast } from '@/app/lib/missionControl/commandCenter';
import { resolvePetDeceased } from '@/app/lib/missionControl/endStates';

const PARAMS = { params: { missionId: 'case-belonging-to-someone-else' } };

function post(body) {
  return POST(
    new NextRequest('http://localhost:3000/api/mission/x/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    PARAMS
  );
}
function get() {
  return GET(new NextRequest('http://localhost:3000/api/mission/x/command'), PARAMS);
}

describe('SEC-1: mission command center authz', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: 'random-user' } });
    prisma.missionControl.findUnique.mockResolvedValue({ id: 'mc-1' });
    // Not the owner, and not staff.
    prisma.case.findUnique.mockResolvedValue({ reporterId: 'the-owner' });
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
    sendBroadcast.mockResolvedValue({ ok: true });
  });

  test('POST without a session => 401', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await post({ action: 'BROADCAST', message: 'hi' });
    expect(res.status).toBe(401);
  });

  test('KEYSTONE: a non-authorized user cannot RESOLVE_DECEASED a stranger\'s case (403, action never runs)', async () => {
    const res = await post({ action: 'RESOLVE_DECEASED' });
    expect(res.status).toBe(403);
    expect(resolvePetDeceased).not.toHaveBeenCalled();
  });

  test('a non-authorized user cannot BROADCAST to all volunteers (403, no send)', async () => {
    const res = await post({ action: 'BROADCAST', message: 'phishing', type: 'ALERT' });
    expect(res.status).toBe(403);
    expect(sendBroadcast).not.toHaveBeenCalled();
  });

  test('the owner CAN broadcast', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'the-owner' } });
    const res = await post({ action: 'BROADCAST', message: 'real alert', type: 'ALERT' });
    expect(res.status).toBe(200);
    expect(sendBroadcast).toHaveBeenCalledTimes(1);
  });

  test('staff CAN broadcast, and the role is read from the database, not the session', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'random-user', role: 'USER' } });
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    const res = await post({ action: 'BROADCAST', message: 'real alert', type: 'ALERT' });
    expect(res.status).toBe(200);
    expect(sendBroadcast).toHaveBeenCalledTimes(1);
  });

  test('a session that says ADMIN is not enough when the database says USER', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'random-user', role: 'ADMIN' } });
    const res = await post({ action: 'BROADCAST', message: 'phishing', type: 'ALERT' });
    expect(res.status).toBe(403);
    expect(sendBroadcast).not.toHaveBeenCalled();
  });

  test('GET command view requires authority (403 for non-authorized)', async () => {
    const res = await get();
    expect(res.status).toBe(403);
  });

  test('GET without a session => 401', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
  });
});
