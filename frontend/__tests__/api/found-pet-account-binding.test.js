/**
 * A found-pet report must not be filed against somebody else's account.
 *
 * /api/reports/found-pet looked the submitted email up and, if a user
 * existed, used that account: one unauthenticated POST filed a report under a
 * member's name, copied their stored phone onto the public report as its
 * contact number, and switched on patrol alerts for them. The lost-pet
 * intake closed the same hole in the 2026-08 audit (B7); this is its twin.
 *
 * Also here: a new finder's account used a Math.random() password that was
 * emailed in plain text; the response had no caseNumber, so the success
 * screen could not link to the report; and the route had no rate limit.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    patrolProfile: { findUnique: jest.fn(), create: jest.fn() },
    userProfile: { findUnique: jest.fn(), create: jest.fn() },
    pet: { create: jest.fn() },
    case: { create: jest.fn(), findMany: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/email', () => ({
  __esModule: true,
  sendEmail: jest.fn().mockResolvedValue({ ok: true }),
  renderBrandedEmail: jest.fn((parts) => JSON.stringify(parts)),
  escapeHtml: (v) => String(v ?? ''),
}));
jest.mock('@/app/lib/matching', () => ({ __esModule: true, findMatches: jest.fn(() => []) }));
jest.mock('@/app/lib/notifications-inapp', () => ({ __esModule: true, createInAppNotification: jest.fn() }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: jest.fn(async () => ({ success: true })),
  rateLimitResponse: jest.fn(() => new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })),
  RateLimitPresets: { PUBLIC_WRITE: {} },
}));
jest.mock('@/app/lib/caseNumber', () => ({ __esModule: true, withCaseNumberRetry: (fn) => fn('AUS-2026-FND123') }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { sendEmail, renderBrandedEmail } from '@/app/lib/email';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import { POST } from '@/app/api/reports/found-pet/route';

const BODY = {
  email: 'finder@example.com',
  firstName: 'Finder',
  color: 'Black, White',
  size: 'MEDIUM',
  foundAddress: '600 Congress Ave, Austin, TX 78701',
  center: [30.2686, -97.7427],
  timeElapsed: 'less_than_hour',
  petType: 'dog',
};

const req = (body = BODY) =>
  new Request('http://localhost/api/reports/found-pet', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  getServerSession.mockResolvedValue(null);
  prisma.patrolProfile.findUnique.mockResolvedValue(null);
  prisma.userProfile.findUnique.mockResolvedValue(null);
  prisma.pet.create.mockImplementation(async ({ data }) => ({ id: 'pet-1', ...data }));
  prisma.case.create.mockImplementation(async ({ data }) => ({ id: 'case-1', ...data }));
  prisma.case.findMany.mockResolvedValue([]);
  prisma.user.create.mockImplementation(async ({ data }) => ({ id: 'user-new', ...data }));
});
afterEach(() => {
  console.error.mockRestore();
  console.log.mockRestore();
});

test("signed out, a verified member's email is refused and nothing is written", async () => {
  prisma.user.findUnique.mockResolvedValue({ id: 'victim', email: 'finder@example.com', phone: '555-0147', emailVerified: new Date() });
  const res = await POST(req());
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ code: 'ACCOUNT_EXISTS', signInUrl: '/login?callbackUrl=%2Freport%2Ffound' });
  expect(prisma.case.create).not.toHaveBeenCalled();
  expect(prisma.pet.create).not.toHaveBeenCalled();
  expect(prisma.patrolProfile.create).not.toHaveBeenCalled();
});

test('signed in as that member, the report is filed to their account', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'victim', email: 'finder@example.com', name: 'Dana' } });
  prisma.user.findUnique.mockResolvedValue({ id: 'victim', email: 'finder@example.com', emailVerified: new Date() });
  const res = await POST(req());
  expect(res.status).toBe(200);
  expect(prisma.case.create.mock.calls[0][0].data.reporterId).toBe('victim');
});

test('a repeat guest (unverified account from an earlier report) still gets through', async () => {
  prisma.user.findUnique.mockResolvedValue({ id: 'guest-1', email: 'finder@example.com', emailVerified: null });
  const res = await POST(req());
  expect(res.status).toBe(200);
  expect(prisma.user.create).not.toHaveBeenCalled();
});

test('a new finder gets a report link and a set-password link, never a password', async () => {
  prisma.user.findUnique.mockResolvedValue(null);
  const res = await POST(req());
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ success: true, caseNumber: 'AUS-2026-FND123', accountCreated: true });

  expect(prisma.user.create.mock.calls[0][0].data.passwordHash).toMatch(/^\$2[aby]\$/);
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const parts = renderBrandedEmail.mock.calls[0][0];
  expect(parts.ctaUrl).toMatch(/\/cases\/AUS-2026-FND123$/);
  expect(parts.bodyHtml).toMatch(/forgot-password\?email=finder%40example\.com/);
  expect(JSON.stringify(parts)).not.toMatch(/Temporary Password/i);
});

test('the fallback name reads like words, not the size enum', async () => {
  prisma.user.findUnique.mockResolvedValue(null);
  await POST(req());
  expect(prisma.case.create.mock.calls[0][0].data.petName).toBe('Black, White dog');
});

test("the finder's profile gets the town, not the street", async () => {
  prisma.user.findUnique.mockResolvedValue(null);
  await POST(req());
  expect(prisma.userProfile.create.mock.calls[0][0].data.city).toBe('Austin');
});

test('the route is rate limited', async () => {
  withRateLimitAsync.mockResolvedValueOnce({ success: false });
  const res = await POST(req());
  expect(res.status).toBe(429);
  expect(prisma.user.findUnique).not.toHaveBeenCalled();
});
