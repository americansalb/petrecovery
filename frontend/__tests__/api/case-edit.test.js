/**
 * PATCH /api/missions/[id]: the owner changes the photo, the description
 * or the phone on their report; nobody else does, and nothing else moves.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findUnique: jest.fn(), update: jest.fn(async ({ data }) => ({ id: 'case-max', caseNumber: 'AUS-2026-0001', ...data })) },
    pet: { update: jest.fn(async () => ({})) },
  },
}));
jest.mock('@/app/lib/cascade/redrawLater', () => ({ __esModule: true, scheduleKitRedraw: jest.fn() }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => {}) }));
jest.mock('@/app/lib/utils', () => ({ __esModule: true, normalizePhotoUrl: (u) => u }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { PATCH } from '@/app/api/missions/[missionId]/route';
import { scheduleKitRedraw } from '@/app/lib/cascade/redrawLater';
import { signDetailsToken, DETAILS_TOKEN_HEADER } from '@/app/lib/detailsToken';

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

describe('the questionnaire (docs/REPORT_QUESTIONNAIRE.md)', () => {
  const withToken = (body, token, missionId = 'case-max') => {
    getServerSession.mockResolvedValue(null);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers[DETAILS_TOKEN_HEADER] = token;
    return PATCH(new Request(`http://localhost/api/missions/${missionId}`, { method: 'PATCH', headers, body: JSON.stringify(body) }), { params: { missionId } });
  };

  test('answers merge over what is stored, medication makes the case urgent, the pet row follows, and the kit is redrawn', async () => {
    prisma.case.findUnique.mockResolvedValue({ id: 'case-max', reporterId: 'avery', caseNumber: 'AUS-2026-0001', petId: 'pet-max', priority: 'NORMAL', details: { v: 1, collar: 'NONE' } });
    const res = await call({ details: { health: ['DIABETIC'], healthNote: 'insulin twice a day', bogus: 1 } });
    expect(res.status).toBe(200);
    const { data } = prisma.case.update.mock.calls[0][0];
    expect(data.details.collar).toBe('NONE');
    expect(data.details.health).toEqual(['DIABETIC']);
    expect(data.details.bogus).toBeUndefined();
    expect(data.needsMedication).toBe(true);
    expect(data.priority).toBe('URGENT');
    expect(data.detailsUpdatedAt).toBeInstanceOf(Date);
    expect(prisma.pet.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'pet-max' }, data: { collarInfo: 'No collar.' } }));
    expect(scheduleKitRedraw).toHaveBeenCalledWith('case-max');
  });

  test('health never lowers a priority, and how they got out follows the answer', async () => {
    prisma.case.findUnique.mockResolvedValue({ id: 'case-max', reporterId: 'avery', caseNumber: 'AUS-2026-0001', priority: 'URGENT', details: null });
    await call({ details: { health: ['BLIND'], howOut: 'spooked' } });
    const { data } = prisma.case.update.mock.calls[0][0];
    expect(data.priority).toBeUndefined();
    expect(data.escapeScenario).toBe('spooked');
    expect(data.needsMedication).toBe(false);
  });

  test('a reward needs the scam note ticked; no reward needs nothing', async () => {
    const refused = await call({ hasReward: true, rewardAmount: 500 });
    expect(refused.status).toBe(400);
    expect((await refused.json()).code).toBe('REWARD_SCAM_ACK_REQUIRED');
    expect(prisma.case.update).not.toHaveBeenCalled();
    expect((await call({ hasReward: true, rewardAmount: '500', rewardScamAcknowledged: true })).status).toBe(200);
    let { data } = prisma.case.update.mock.calls[0][0];
    expect(data).toMatchObject({ hasReward: true, rewardAmount: 500 });
    expect(data.rewardScamAcknowledgedAt).toBeInstanceOf(Date);
    expect((await call({ hasReward: false })).status).toBe(200);
    ({ data } = prisma.case.update.mock.calls[1][0]);
    expect(data).toEqual({ hasReward: false, rewardAmount: null });
  });

  test('the breed and how they got out, with bad values refused in words', async () => {
    expect((await call({ petBreed: ' Beagle ', escapeScenario: 'away_from_home' })).status).toBe(200);
    expect(prisma.case.update.mock.calls[0][0].data).toEqual({ petBreed: 'Beagle', escapeScenario: 'away_from_home' });
    expect((await call({ escapeScenario: 'teleported' })).status).toBe(400);
    expect((await call({ details: 'yes' })).status).toBe(400);
  });

  test('the details token works for the questionnaire of its one case, and for nothing else', async () => {
    const old = process.env.NEXTAUTH_SECRET;
    process.env.NEXTAUTH_SECRET = 'test-secret';
    try {
      const token = signDetailsToken('case-max');
      expect((await withToken({ details: { microchip: 'YES' } }, token)).status).toBe(200);
      expect(prisma.case.update.mock.calls[0][0].data.details.microchip).toBe('YES');
      // Not the phone, not the photo: those take the owner's session.
      expect((await withToken({ ownerPhone: '(512) 555 0100' }, token)).status).toBe(403);
      expect((await withToken({ details: { microchip: 'YES' }, petPhotoUrl: 'https://x/y.jpg' }, token)).status).toBe(403);
      // Another case, a bad token, no token.
      prisma.case.findUnique.mockResolvedValue({ id: 'case-other', reporterId: 'sam', caseNumber: 'AUS-2026-0002' });
      expect((await withToken({ details: { microchip: 'YES' } }, token, 'case-other')).status).toBe(401);
      expect((await withToken({ details: { microchip: 'YES' } }, 'nope.nope')).status).toBe(401);
      expect((await withToken({ details: { microchip: 'YES' } }, null)).status).toBe(401);
    } finally {
      process.env.NEXTAUTH_SECRET = old;
    }
  });
});
