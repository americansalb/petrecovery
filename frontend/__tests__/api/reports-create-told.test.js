/**
 * What a lost report sets off, and what the page after posting is told
 * about it (POST /api/reports/create, its `told` and `assignedSquad`).
 *
 * Found in testing before publishing:
 *  - the same pet could be reported lost twice, and its force alerted twice;
 *  - a phone-only report said "We texted this link" when the text had failed;
 *  - a second report from the same phone was told to look in an email inbox;
 *  - a town with no force got one whose only member is the reporter, written
 *    down as in the US (Mexico City), and the page said it "covers the spot";
 *  - "Longer than a week" was stored as fifteen days.
 */

import { NextRequest } from 'next/server';

const mockTx = {
  user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  pet: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  case: { create: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
};

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(async (fn) => fn(mockTx)),
    case: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    rescueForce: { create: jest.fn() },
    rescueForceMember: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    caseAssignment: { create: jest.fn().mockResolvedValue({ id: 'a-1' }) },
    squadPost: { create: jest.fn() },
    alert: { createMany: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/email', () => ({
  __esModule: true,
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
  renderBrandedEmail: jest.fn(() => '<p>mail</p>'),
  escapeHtml: (v) => String(v ?? ''),
}));
jest.mock('@/app/lib/sms', () => ({ __esModule: true, sendSms: jest.fn() }));
jest.mock('@/app/lib/searchBoard', () => ({ __esModule: true, ensureStreets: jest.fn(async () => null) }));
jest.mock('@/app/lib/cascade/runCascade', () => ({
  __esModule: true,
  seedActivation: jest.fn().mockResolvedValue({ status: 'PENDING' }),
  enqueueCascade: jest.fn(),
}));
jest.mock('@/app/lib/forceCoverage', () => ({
  __esModule: true,
  forcesCovering: jest.fn().mockResolvedValue([]),
  alertForceMembers: jest.fn().mockResolvedValue({ bell: 0, pushed: 0 }),
  countryOfPlace: jest.requireActual('@/app/lib/forceCoverage').countryOfPlace,
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

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { sendSms } from '@/app/lib/sms';
import { forcesCovering, alertForceMembers } from '@/app/lib/forceCoverage';
import { lastSeenWords } from '@/app/lib/lastSeenAnswer';
import { POST } from '@/app/api/reports/create/route';

const BODY = {
  email: 'avery@example.com',
  firstName: 'Avery',
  petName: 'Max',
  color: 'Golden',
  lastSeenAddress: '2100 Barton Springs Rd, Austin, TX 78704, United States',
  center: [30.2638, -97.7716],
  petType: 'DOG',
  timeElapsed: '1_to_3_days',
};
const PHONE = '(512) 555-0142';

const post = (body) =>
  POST(new NextRequest('http://localhost:3000/api/reports/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...BODY, ...body }) }));

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXTAUTH_SECRET = 'test-secret';
  getServerSession.mockResolvedValue(null);
  mockTx.user.findUnique.mockResolvedValue(null);
  mockTx.user.findFirst.mockResolvedValue(null);
  mockTx.user.create.mockImplementation(async ({ data }) => ({ id: 'user-1', ...data }));
  mockTx.pet.create.mockImplementation(async ({ data }) => ({ id: 'pet-1', ...data }));
  mockTx.case.create.mockImplementation(async ({ data }) => ({ id: 'case-1', ...data }));
  mockTx.case.count.mockResolvedValue(0);
  mockTx.case.findFirst.mockResolvedValue(null);
  forcesCovering.mockResolvedValue([]);
  alertForceMembers.mockResolvedValue({ bell: 0, pushed: 0 });
});

describe('a pet already missing', () => {
  test('is refused and pointed to its open search; nothing is written and no force is alerted again', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u-admin', email: 'admin@example.com', name: 'Admin' } });
    mockTx.user.findUnique.mockResolvedValue({ id: 'u-admin', email: 'admin@example.com', emailVerified: new Date() });
    mockTx.pet.findFirst.mockResolvedValue({ id: 'pet-max', name: 'Max', ownerId: 'u-admin' });
    mockTx.case.findFirst.mockResolvedValue({ caseNumber: 'AUS-2026-MAX001', petName: 'Max' });

    const res = await post({ selectedPetId: 'pet-max' });
    const body = await res.json();
    expect(res.status).toBe(409);
    // The wizard shows openUrl as "Open that search" for this code.
    expect(body).toMatchObject({ code: 'OPEN_REPORT_EXISTS', reason: 'PET_ALREADY_MISSING', caseNumber: 'AUS-2026-MAX001', openUrl: '/mission-control?mission=AUS-2026-MAX001' });
    expect(body.error).toBe('Max already has a search open. Add anything new to that search instead of starting a second one.');
    expect(mockTx.case.findFirst.mock.calls[0][0].where).toMatchObject({ petId: 'pet-max', reportType: 'LOST', status: { in: ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'] } });
    expect(mockTx.pet.update).not.toHaveBeenCalled();
    expect(mockTx.case.create).not.toHaveBeenCalled();
    expect(alertForceMembers).not.toHaveBeenCalled();
  });

  test('a pet whose last search is closed can be reported again', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u-admin', email: 'admin@example.com', name: 'Admin' } });
    mockTx.user.findUnique.mockResolvedValue({ id: 'u-admin', email: 'admin@example.com', emailVerified: new Date() });
    mockTx.pet.findFirst.mockResolvedValue({ id: 'pet-max', name: 'Max', ownerId: 'u-admin' });
    mockTx.pet.update.mockResolvedValue({ id: 'pet-max', name: 'Max' });
    const res = await post({ selectedPetId: 'pet-max' });
    expect(res.status).toBe(200);
    expect(mockTx.case.create).toHaveBeenCalledTimes(1);
  });
});

describe('a report made with only a phone', () => {
  const phoneOnly = { email: '', phone: PHONE };

  test('the text carries the link that runs the search, and the page is told it failed when it failed', async () => {
    sendSms.mockResolvedValue({ success: false, error: 'Twilio down' });
    const res = await post(phoneOnly);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.told).toMatchObject({ text: 'failed', email: null });
    const [to, words] = sendSms.mock.calls[0];
    expect(to).toBe(PHONE);
    expect(words).toMatch(new RegExp(`/api/mission/${body.caseNumber}/own\\?k=`));
    expect(words).toContain('We text you here when someone reports seeing Max.');
    // Stored as before: the cascade now knows "Not provided" is not an address.
    expect(mockTx.case.create.mock.calls[0][0].data.ownerEmail).toBe('Not provided');
  });

  test('and that it went when it went', async () => {
    sendSms.mockResolvedValue({ success: true, sid: 'SM1' });
    const body = await (await post(phoneOnly)).json();
    expect(body.told.text).toBe('sent');
  });

  test('a second report from the same phone is told about the phone number, not an inbox or a password', async () => {
    mockTx.user.findUnique.mockResolvedValue({ id: 'shell', email: 'p5125550142@phone-only.invalid', phone: PHONE, emailVerified: null });
    mockTx.case.count.mockResolvedValue(1);
    const res = await post(phoneOnly);
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe('OPEN_REPORT_EXISTS');
    expect(body.error).toBe('There is already a search open under this phone number. Mark that pet found or close its search before reporting another pet.');
    expect(body).not.toHaveProperty('signInUrl');
    expect(JSON.stringify(body)).not.toMatch(/email|inbox|sign in/i);
  });
});

describe('who was told, as the page after posting reads it', () => {
  test('a town with no force: one is set up in the country of the address, and the page is told it was set up now', async () => {
    prisma.rescueForce.create.mockImplementation(async ({ data }) => ({ id: 'f-new', radiusMiles: 5, ...data }));
    sendSms.mockResolvedValue({ success: true });
    const res = await post({
      lastSeenAddress: 'Calle Madero 1, Centro, Ciudad de México, CDMX, México',
      center: [19.4326, -99.1332],
      cityName: 'Mexico City',
    });
    const body = await res.json();
    expect(prisma.rescueForce.create.mock.calls[0][0].data).toMatchObject({ name: 'Mexico City Pet Rescue', country: 'MX', state: null });
    expect(body.assignedSquad).toMatchObject({ id: 'f-new', name: 'Mexico City Pet Rescue', setUpNow: true, membersAlerted: 0, membersPushed: 0 });
    expect(body.told.forces).toEqual([{ id: 'f-new', name: 'Mexico City Pet Rescue', setUpNow: true, nearby: false }]);
  });

  test('a force that covers the spot: the page is told how many members were alerted, and how many on their phone', async () => {
    forcesCovering.mockResolvedValue([{ id: 'f-austin', name: 'Austin Pet Rescue', city: 'Austin', distance: 2, covers: true, radiusMiles: 5, effectiveRadius: 6 }]);
    alertForceMembers.mockResolvedValue({ bell: 12, pushed: 3 });
    const body = await (await post({ cityName: 'Austin' })).json();
    expect(body.assignedSquad).toMatchObject({ id: 'f-austin', setUpNow: false, membersAlerted: 12, membersPushed: 3 });
    expect(body.told).toMatchObject({ forceMembers: 12, forceMembersPushed: 3, email: 'sent' });
    expect(prisma.rescueForce.create).not.toHaveBeenCalled();
  });
});

test('"Longer than a week" is stored as a week before the report, and reads back as what was answered', async () => {
  await post({ timeElapsed: 'more_than_2_weeks' });
  const { data } = mockTx.case.create.mock.calls[0][0];
  expect(data.createdAt.getTime() - data.lastSeenAt.getTime()).toBe(7 * 24 * 3600e3);
  expect(lastSeenWords(data)).toBe('more than a week');
});
