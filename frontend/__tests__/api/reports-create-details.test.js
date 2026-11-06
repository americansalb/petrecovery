/**
 * POST /api/reports/create stores the questionnaire (docs/REPORT_QUESTIONNAIRE.md):
 * the answers, the medication flag and the priority it sets, the reward with
 * the owner's tick on the scam note, and the details token the success screen
 * uses to add more.
 *
 * The route fans out to email, SMS, forces and the cascade; all of that is
 * mocked away here, and the assertions are on what reaches the database.
 */

import { NextRequest } from 'next/server';

const mockTx = {
  user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  pet: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  case: { create: jest.fn() },
};

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(async (fn) => fn(mockTx)),
    case: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    user: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    rescueForce: { findMany: jest.fn().mockResolvedValue([]) },
    squadPost: { create: jest.fn() },
    alert: { create: jest.fn(), createMany: jest.fn() },
    caseActivation: { upsert: jest.fn() },
    caseFollowUp: { createMany: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/email', () => ({
  __esModule: true,
  sendEmail: jest.fn().mockResolvedValue({ ok: true }),
  sendVerificationEmail: jest.fn().mockResolvedValue({ ok: true }),
  renderBrandedEmail: jest.fn(() => '<p>mail</p>'),
  escapeHtml: (v) => String(v ?? ''),
}));
jest.mock('@/app/lib/sms', () => ({ __esModule: true, sendSms: jest.fn().mockResolvedValue({ ok: true }) }));
jest.mock('@/app/lib/cascade/runCascade', () => ({
  __esModule: true,
  seedActivation: jest.fn().mockResolvedValue({ status: 'PENDING' }),
  enqueueCascade: jest.fn(),
}));
jest.mock('@/app/lib/forceCoverage', () => ({
  __esModule: true,
  forcesCovering: jest.fn().mockResolvedValue([]),
  alertForceMembers: jest.fn().mockResolvedValue(0),
}));
jest.mock('@/app/lib/forceFeed', () => ({ __esModule: true, feedPost: jest.fn(() => ({ title: 't', content: 'c' })) }));
jest.mock('@/app/lib/forceOutlines', () => ({ __esModule: true, fillForceOutlineSoon: jest.fn() }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: jest.fn().mockResolvedValue({ success: true }),
  rateLimitResponse: jest.fn(),
  RateLimitPresets: {},
}));
jest.mock('@/app/lib/maps/reverseLabel', () => ({ __esModule: true, looksLikeCoordinates: () => false, reverseGeocodeLabel: jest.fn() }));
jest.mock('bcryptjs', () => ({ __esModule: true, default: { hash: jest.fn().mockResolvedValue('hash') }, hash: jest.fn().mockResolvedValue('hash') }));

import { POST } from '@/app/api/reports/create/route';

const BODY = {
  email: 'avery@example.com',
  firstName: 'Avery',
  petName: 'Max',
  color: 'Golden',
  lastSeenAddress: '2100 Barton Springs Rd, Austin, TX 78704, United States',
  center: [30.2638, -97.7716],
  petType: 'DOG',
  petSize: 'LARGE',
  timeElapsed: '1_to_3_days',
};

const post = (body) =>
  POST(
    new NextRequest('http://localhost:3000/api/reports/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...BODY, ...body }),
    })
  );

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXTAUTH_SECRET = 'test-secret';
  mockTx.user.findUnique.mockResolvedValue(null);
  mockTx.user.findFirst.mockResolvedValue(null);
  mockTx.user.create.mockImplementation(async ({ data }) => ({ id: 'user-1', ...data }));
  mockTx.pet.create.mockImplementation(async ({ data }) => ({ id: 'pet-1', ...data }));
  mockTx.case.create.mockImplementation(async ({ data }) => ({ id: 'case-1', ...data }));
});

test('a reward without the scam note ticked is refused before anything is written', async () => {
  const res = await post({ hasReward: true, rewardAmount: 500 });
  expect(res.status).toBe(400);
  expect((await res.json()).code).toBe('REWARD_SCAM_ACK_REQUIRED');
  expect(mockTx.case.create).not.toHaveBeenCalled();
});

test('the answers are stored in shape, medication makes the case urgent, and the pet row gets its columns', async () => {
  const res = await post({
    details: {
      temperament: 'SCARED',
      health: ['DIABETIC'],
      healthNote: 'insulin twice a day',
      collar: 'COLLAR',
      collarColor: 'red',
      tag: 'PHONE',
      microchip: 'YES',
      microchipNumber: '985141000123456',
      marks: ['white_chest'],
      howOut: 'spooked',
      nonsense: true,
    },
    hasReward: true,
    rewardAmount: '250',
    rewardScamAcknowledged: true,
  });
  expect(mockTx.case.create).toHaveBeenCalledTimes(1);
  const { data } = mockTx.case.create.mock.calls[0][0];
  expect(data.details).toMatchObject({ v: 1, temperament: 'SCARED', health: ['DIABETIC'], collar: 'COLLAR', howOut: 'spooked' });
  expect(data.details.nonsense).toBeUndefined();
  expect(data.needsMedication).toBe(true);
  expect(data.priority).toBe('URGENT');
  expect(data.escapeScenario).toBe('spooked');
  expect(data.hasReward).toBe(true);
  expect(data.rewardAmount).toBe(250);
  expect(data.rewardScamAcknowledgedAt).toBeInstanceOf(Date);
  expect(data.detailsUpdatedAt).toBeInstanceOf(Date);
  expect(mockTx.pet.create.mock.calls[0][0].data).toMatchObject({
    collarInfo: 'Red collar, a tag with our number.',
    microchipId: '985141000123456',
    distinctiveMarks: 'White chest.',
  });
  const body = await res.json();
  expect(res.status).toBeLessThan(300);
  expect(body.detailsToken).toMatch(/^\d+\.[A-Za-z0-9_-]+$/);
  expect(body.details.temperament).toBe('SCARED');
  expect(body.hasReward).toBe(true);
});

test('no answers and no reward: nothing invented, priority as before', async () => {
  await post({});
  const { data } = mockTx.case.create.mock.calls[0][0];
  expect(data.details).toBeUndefined();
  expect(data.needsMedication).toBe(false);
  expect(data.hasReward).toBe(false);
  expect(data.rewardAmount).toBeNull();
  expect(data.rewardScamAcknowledgedAt).toBeNull();
  expect(data.priority).toBe('NORMAL');
  await post({ details: { health: ['BLIND'] } });
  expect(mockTx.case.create.mock.calls[1][0].data.priority).toBe('HIGH');
  await post({ timeElapsed: 'less_than_hour' });
  expect(mockTx.case.create.mock.calls[2][0].data.priority).toBe('URGENT');
});
