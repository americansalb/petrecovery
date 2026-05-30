/**
 * SEC-1 regression: Mission Command Center authorization.
 *
 * EA's audit found the command route had `// TODO: Verify user is a leader` and
 * zero checks — ANY logged-in user could POST {action:'RESOLVE_DECEASED'} or
 * {action:'BROADCAST'} to ANY missionId, marking a stranger's pet deceased or
 * mass-messaging all volunteers. Fixed with userHasCaseAuthority() (owner /
 * assigned squad leader / admin) gating both GET and POST before any action.
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
  default: { missionControl: { findUnique: jest.fn() } },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/authz', () => ({ __esModule: true, userHasCaseAuthority: jest.fn() }));
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
import { userHasCaseAuthority } from '@/app/lib/authz';
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
    userHasCaseAuthority.mockResolvedValue(false); // not owner/leader/admin
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

  test('an authorized user (owner/leader/admin) CAN broadcast', async () => {
    userHasCaseAuthority.mockResolvedValue(true);
    const res = await post({ action: 'BROADCAST', message: 'real alert', type: 'ALERT' });
    expect(sendBroadcast).toHaveBeenCalledTimes(1);
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
