/**
 * The older command route (/api/mission/[missionId]/command).
 *
 * It reads where every helper is, pushes a broadcast to every helper's
 * phone, and ends a search (found, deceased, cold case). It trusted a
 * command role in a Rescue Force assigned to the pet, which any member of
 * a force with no leader can take, so a stranger could reach it in two
 * taps. It is the owner's and staff's. A zone, a helper and a trap named in
 * a request must be on this pet's own search.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    missionControl: { findUnique: jest.fn() },
    missionZone: { findFirst: jest.fn() },
    missionVolunteer: { findFirst: jest.fn() },
    missionTrap: { findFirst: jest.fn() },
    rescueForceMember: { findFirst: jest.fn(), findMany: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/missionControl/commandCenter', () => ({
  __esModule: true,
  getCommandView: jest.fn(async () => ({ volunteers: [] })),
  updateStaleZones: jest.fn(async () => ({ success: true })),
  assignZone: jest.fn(async () => ({ success: true })),
  sendBroadcast: jest.fn(async () => ({ success: true })),
  requestResource: jest.fn(async () => ({ success: true })),
  switchToTrapOps: jest.fn(async () => ({ success: true })),
  addTrap: jest.fn(async () => ({ success: true })),
  checkTrap: jest.fn(async () => ({ success: true })),
  getShiftSummary: jest.fn(async () => ({})),
}));
jest.mock('@/app/lib/missionControl/endStates', () => ({
  __esModule: true,
  resolvePetFound: jest.fn(async () => ({ success: true })),
  resolvePetDeceased: jest.fn(async () => ({ success: true })),
  pauseToColdCase: jest.fn(async () => ({ success: true })),
}));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn(async () => null) }));
jest.mock('@/app/lib/rateLimit', () => ({ __esModule: true, withRateLimitAsync: jest.fn(async () => ({ success: true })), rateLimitResponse: () => new Response('{}', { status: 429 }) }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { getCommandView, sendBroadcast, assignZone, checkTrap } from '@/app/lib/missionControl/commandCenter';
import { resolvePetFound, resolvePetDeceased, pauseToColdCase } from '@/app/lib/missionControl/endStates';
import { GET, POST } from '@/app/api/mission/[missionId]/command/route';

const URL = 'http://localhost/api/mission/case-max/command';
const ctx = { params: { missionId: 'case-max' } };
const get = () => GET(new NextRequest(URL), ctx);
const post = (body) => POST(new NextRequest(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }), ctx);
const as = (id) => getServerSession.mockResolvedValue(id ? { user: { id } } : null);

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findUnique.mockResolvedValue({ reporterId: 'u-avery' });
  prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
  prisma.missionControl.findUnique.mockResolvedValue({ id: 'mc-max' });
  prisma.missionZone.findFirst.mockResolvedValue(null);
  prisma.missionVolunteer.findFirst.mockResolvedValue(null);
  prisma.missionTrap.findFirst.mockResolvedValue(null);
  // Whatever a force says about this account, the route does not ask it.
  prisma.rescueForceMember.findFirst.mockResolvedValue({ role: 'LEADER', isActive: true });
  prisma.rescueForceMember.findMany.mockResolvedValue([{ role: 'LEADER', isActive: true }]);
  as('u-force-leader');
});

describe('a command role in a Rescue Force does not open it', () => {
  test('the view, with where every helper is, is refused', async () => {
    expect((await get()).status).toBe(403);
    expect(getCommandView).not.toHaveBeenCalled();
    expect(prisma.rescueForceMember.findFirst).not.toHaveBeenCalled();
    expect(prisma.rescueForceMember.findMany).not.toHaveBeenCalled();
  });

  test.each(['BROADCAST', 'RESOLVE_FOUND', 'RESOLVE_DECEASED', 'COLD_CASE', 'ASSIGN_ZONE', 'SWITCH_TRAP_OPS'])('%s is refused, and nothing is done', async (action) => {
    const res = await post({ action, message: 'Everyone go home.' });
    expect(res.status).toBe(403);
    for (const op of [sendBroadcast, resolvePetFound, resolvePetDeceased, pauseToColdCase, assignZone]) expect(op).not.toHaveBeenCalled();
  });

  test('nobody signed in: 401', async () => {
    as(null);
    expect((await get()).status).toBe(401);
    expect((await post({ action: 'BROADCAST', message: 'x' })).status).toBe(401);
  });
});

describe('the owner, and staff', () => {
  test('the owner reads the view', async () => {
    as('u-avery');
    expect((await get()).status).toBe(200);
    expect(getCommandView).toHaveBeenCalledWith('mc-max', 'u-avery');
  });

  test('staff read it', async () => {
    as('u-staff');
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    expect((await get()).status).toBe(200);
  });

  test('a broadcast is a few sentences of text: 300 characters, one line, nothing that is not text', async () => {
    as('u-avery');
    await post({ action: 'BROADCAST', message: `  Meet at\n the park.${String.fromCharCode(0x202e)}  `, type: 'INFO' });
    expect(sendBroadcast).toHaveBeenCalledWith('mc-max', 'Meet at the park.', 'INFO', 'u-avery');
    await post({ action: 'BROADCAST', message: 'x'.repeat(4000) });
    expect(sendBroadcast.mock.calls[1][1]).toHaveLength(300);
    expect((await post({ action: 'BROADCAST', message: { $ne: null } })).status).toBe(400);
    expect((await post({ action: 'BROADCAST', message: '   ' })).status).toBe(400);
    expect(sendBroadcast).toHaveBeenCalledTimes(2);
  });

  test('a zone and a helper must be on this pet\'s own search', async () => {
    as('u-avery');
    expect((await post({ action: 'ASSIGN_ZONE', zoneId: 'zone-of-another-pet', volunteerId: 'vol-of-another-pet' })).status).toBe(404);
    expect(assignZone).not.toHaveBeenCalled();
    expect(prisma.missionZone.findFirst).toHaveBeenCalledWith({ where: { id: 'zone-of-another-pet', missionId: 'mc-max' }, select: { id: true } });
    expect(prisma.missionVolunteer.findFirst).toHaveBeenCalledWith({ where: { id: 'vol-of-another-pet', missionId: 'mc-max' }, select: { id: true } });
    prisma.missionZone.findFirst.mockResolvedValue({ id: 'zone-1' });
    prisma.missionVolunteer.findFirst.mockResolvedValue({ id: 'vol-1' });
    expect((await post({ action: 'ASSIGN_ZONE', zoneId: 'zone-1', volunteerId: 'vol-1' })).status).toBe(200);
    expect(assignZone).toHaveBeenCalledWith('mc-max', 'zone-1', 'vol-1', 'u-avery');
    expect((await post({ action: 'ASSIGN_ZONE', zoneId: { $ne: null }, volunteerId: ['x'] })).status).toBe(404);
  });

  test('and so must a trap', async () => {
    as('u-avery');
    expect((await post({ action: 'CHECK_TRAP', trapId: 'trap-of-another-pet' })).status).toBe(404);
    expect(checkTrap).not.toHaveBeenCalled();
    prisma.missionTrap.findFirst.mockResolvedValue({ id: 'trap-1' });
    expect((await post({ action: 'CHECK_TRAP', trapId: 'trap-1', status: 'SET' })).status).toBe(200);
    expect(checkTrap).toHaveBeenCalledWith('trap-1', expect.any(Object), 'u-avery');
  });

  test('an action nobody knows, or a body that is not an object: 400 before anything is read', async () => {
    as('u-avery');
    expect((await post({ action: 'LAUNCH' })).status).toBe(400);
    expect((await post('[]')).status).toBe(400);
    expect(prisma.missionControl.findUnique).not.toHaveBeenCalled();
  });
});
