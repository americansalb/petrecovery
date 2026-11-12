/**
 * Lost-pet reports cannot be made in bulk (founder, 2026-11-12: "is it
 * possible to ensure that we don't get spammed? Like one lost pet per
 * person & more security").
 *
 * Every report mints an account and sends email, texts and alerts to
 * neighbours. So one person has one search open at a time unless they are
 * signed in, an address that is not signed in can send only a few an hour
 * and a handful a day, and an account is never written down as confirmed
 * by the route that makes it.
 *
 * Like reports-create-account-binding.test.js this covers the refusals,
 * which happen before the route's geocoding and notification work. A
 * report that goes through is checked end to end against a real server
 * and database.
 */

import { NextRequest } from 'next/server';

const mockTx = {
  user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  pet: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  case: { create: jest.fn(), count: jest.fn() },
};

jest.mock('@/app/lib/searchBoard', () => ({ __esModule: true, ensureStreets: jest.fn(async () => null) }));
jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(async (fn) => fn(mockTx)),
    case: { findUnique: jest.fn(), findMany: jest.fn(async () => []), update: jest.fn() },
    rescueForce: { findMany: jest.fn().mockResolvedValue([]) },
    squadPost: { create: jest.fn() },
    alert: { create: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/email', () => ({ __esModule: true, sendEmail: jest.fn().mockResolvedValue({ ok: true }), escapeHtml: (v) => String(v ?? '') }));
jest.mock('@/app/lib/rateLimit', () => {
  const { NextResponse } = require('next/server');
  return {
    __esModule: true,
    RateLimitPresets: { PUBLIC_WRITE: { windowMs: 60000, maxRequests: 10 } },
    withRateLimitAsync: jest.fn(async () => ({ success: true })),
    rateLimitResponse: jest.fn(() => NextResponse.json({ error: 'Too many requests', code: 'RATE_LIMITED' }, { status: 429 })),
  };
});

import fs from 'fs';
import path from 'path';
import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import { mintOwnerKey } from '@/app/lib/ownerKey';
import { POST } from '@/app/api/reports/create/route';

const BODY = { email: 'someone@example.com', firstName: 'Reporter', petName: 'Bo', color: 'Golden', lastSeenAddress: '1 Main St, Austin, TX 78701', center: [30.27, -97.74], petType: 'DOG', timeElapsed: 'less_than_hour' };
const req = (cookie = '') =>
  new NextRequest('http://localhost:3000/api/reports/create', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(BODY) });
const GUEST_SHELL = { id: 'shell', email: 'someone@example.com', phone: null, passwordHash: 'x', emailVerified: null };

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue(null);
  withRateLimitAsync.mockResolvedValue({ success: true });
  prisma.case.findMany.mockResolvedValue([]);
  mockTx.user.findUnique.mockResolvedValue(null);
  mockTx.user.findFirst.mockResolvedValue(null);
  mockTx.case.count.mockResolvedValue(0);
});

describe('one search open to a person', () => {
  test('a browser that already has a search open is told which, sent to it, and nothing is written', async () => {
    const mine = mintOwnerKey();
    prisma.case.findMany.mockResolvedValue([{ id: 'case-1', caseNumber: 'AUS-2026-AAAAAA', petName: 'Max', status: 'ACTIVE', reportType: 'LOST', ownerKeyHash: mine.hash, ownerKeyAt: new Date() }]);
    const res = await POST(req(`rp_owner_case-1=${mine.key}; rp_made_case-1=1`));
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body).toMatchObject({ code: 'OPEN_REPORT_EXISTS', caseNumber: 'AUS-2026-AAAAAA', openUrl: '/mission-control?mission=AUS-2026-AAAAAA' });
    expect(body.error).toMatch(/^You already have a search open for Max\./);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(mockTx.case.create).not.toHaveBeenCalled();
  }, 15000);

  test('a search that is closed, or a found-pet report, does not count against them', async () => {
    const mine = mintOwnerKey();
    // The pet came home: the search is over. And it stops at the next check, an account that is full, so the test
    // does not have to stand up the whole report.
    prisma.case.findMany.mockResolvedValue([
      { id: 'case-1', caseNumber: 'AUS-1', petName: 'Max', status: 'REUNITED', reportType: 'LOST', ownerKeyHash: mine.hash, ownerKeyAt: new Date() },
    ]);
    mockTx.user.findUnique.mockResolvedValue(GUEST_SHELL);
    mockTx.case.count.mockResolvedValue(1);
    const body = await (await POST(req(`rp_owner_case-1=${mine.key}; rp_made_case-1=1`))).json();
    // Refused by the account's own count, not by the browser's closed search.
    expect(body.code).toBe('OPEN_REPORT_EXISTS');
    expect(body).not.toHaveProperty('openUrl');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  }, 15000);

  test('a search whose key arrived in a link, or one that ran past its date, is not this browser\'s own open search', async () => {
    const mine = mintOwnerKey();
    const row = { id: 'case-1', caseNumber: 'AUS-1', petName: 'Max', status: 'ACTIVE', reportType: 'LOST', ownerKeyHash: mine.hash, ownerKeyAt: new Date() };
    mockTx.user.findUnique.mockResolvedValue(GUEST_SHELL);
    mockTx.case.count.mockResolvedValue(1);
    // The key without the mark that this browser made the report: someone was sent the owner's link.
    prisma.case.findMany.mockResolvedValue([row]);
    expect(await (await POST(req(`rp_owner_case-1=${mine.key}`))).json()).not.toHaveProperty('openUrl');
    // Made here, and a month past its date with nobody having closed it.
    prisma.case.findMany.mockResolvedValue([{ ...row, expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) }]);
    expect(await (await POST(req(`rp_owner_case-1=${mine.key}; rp_made_case-1=1`))).json()).not.toHaveProperty('openUrl');
  }, 15000);

  test('a cookie that is not the key is not a search: the report is not refused for it', async () => {
    prisma.case.findMany.mockResolvedValue([{ id: 'case-1', caseNumber: 'AUS-1', petName: 'Max', status: 'ACTIVE', reportType: 'LOST', ownerKeyHash: mintOwnerKey().hash, ownerKeyAt: new Date() }]);
    mockTx.user.findUnique.mockResolvedValue(GUEST_SHELL);
    mockTx.case.count.mockResolvedValue(1);
    const body = await (await POST(req('rp_owner_case-1=a-guess-that-is-long-enough-to-be-read; rp_made_case-1=1'))).json();
    expect(body).not.toHaveProperty('openUrl');
    expect(body).not.toHaveProperty('caseNumber');
  }, 15000);

  test('an email that already has a search open is refused without saying whose pet or which page', async () => {
    mockTx.user.findUnique.mockResolvedValue(GUEST_SHELL);
    mockTx.case.count.mockResolvedValue(1);
    const res = await POST(req());
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe('OPEN_REPORT_EXISTS');
    expect(body.error).toMatch(/^There is already a search open under this email\./);
    // Someone who typed another person's address learns nothing about them.
    expect(body).not.toHaveProperty('caseNumber');
    expect(body).not.toHaveProperty('openUrl');
    expect(JSON.stringify(body)).not.toMatch(/Max|AUS-/);
    expect(mockTx.case.create).not.toHaveBeenCalled();
    // Open searches only, of lost pets, to that account.
    // And not one that ran past its date and was never closed.
    expect(mockTx.case.count).toHaveBeenCalledWith({ where: { reporterId: 'shell', reportType: 'LOST', status: { in: ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'] }, OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }] } });
  }, 15000);

  test('someone signed in has confirmed their email, and two pets do get out of one gate: they may have three', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'me', email: 'someone@example.com', name: 'Reporter' } });
    mockTx.user.findUnique.mockResolvedValue({ ...GUEST_SHELL, id: 'me', emailVerified: new Date() });
    mockTx.case.count.mockResolvedValue(3);
    const res = await POST(req());
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe('OPEN_REPORT_EXISTS');
    expect(body.error).toMatch(/^You have 3 searches open, which is the most one account can have at once\./);
    expect(mockTx.case.create).not.toHaveBeenCalled();
  }, 15000);
});

describe('how many reports one address can send without signing in', () => {
  test('three limits: a minute, an hour and a day', async () => {
    mockTx.user.findUnique.mockResolvedValue(GUEST_SHELL);
    mockTx.case.count.mockResolvedValue(1);
    await POST(req());
    expect(withRateLimitAsync.mock.calls.map((c) => c[2])).toEqual(['reports:create', 'reports:create:hour', 'reports:create:day']);
    expect(withRateLimitAsync.mock.calls[1][1]).toEqual({ windowMs: 60 * 60 * 1000, maxRequests: 6, blockDurationMs: 60 * 60 * 1000 });
    expect(withRateLimitAsync.mock.calls[2][1]).toEqual({ windowMs: 24 * 60 * 60 * 1000, maxRequests: 15, blockDurationMs: 6 * 60 * 60 * 1000 });
  }, 15000);

  test('past the hour\'s limit the report is refused before anything is read or written', async () => {
    withRateLimitAsync.mockImplementation(async (_request, _limit, name) => ({ success: name !== 'reports:create:hour' }));
    const res = await POST(req());
    expect(res.status).toBe(429);
    expect(prisma.case.findMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  }, 15000);

  test('someone signed in is held to their own account\'s limit, not to an address a whole office shares', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'me', email: 'someone@example.com', name: 'Reporter' } });
    mockTx.user.findUnique.mockResolvedValue({ ...GUEST_SHELL, id: 'me', emailVerified: new Date() });
    mockTx.case.count.mockResolvedValue(3);
    await POST(req());
    expect(withRateLimitAsync.mock.calls.map((c) => c[2])).toEqual(['reports:create']);
    // And their browser's keys are not read: the account is what is counted.
    expect(prisma.case.findMany).not.toHaveBeenCalled();
  }, 15000);
});

describe('what the route writes and says', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'api', 'reports', 'create', 'route.js'), 'utf8');

  test('an account is never written down as confirmed by the route that makes it', () => {
    expect(source).toMatch(/emailVerified: null,/);
    expect(source).not.toMatch(/emailVerified: \(password/);
    expect(source).not.toMatch(/emailVerified: new Date\(\)/);
  });

  test('someone not signed in is given the key to the search they just started: in a cookie, and in the link emailed to them', () => {
    expect(source).toMatch(/const ownerKey = session\?\.user \? null : mintOwnerKey\(\);/);
    expect(source).toMatch(/\.\.\.\(ownerKey \? \{ ownerKeyHash: ownerKey\.hash, ownerKeyAt: new Date\(\) \} : \{\}\),/);
    expect(source).toMatch(/const kept = ownerCookie\(report\.id, ownerKey\.key\);\s*answer\.cookies\.set\(kept\.name, kept\.value, kept\.options\);/);
    expect(source).toMatch(/const made = madeCookie\(report\.id\);\s*answer\.cookies\.set\(made\.name, made\.value, made\.options\);/);
    expect(source).toMatch(/\/api\/mission\/\$\{encodeURIComponent\(report\.caseNumber\)\}\/own\?k=\$\{ownerKey\.key\}/);
    // The key itself is never stored and never put in the answer's body.
    expect(source).not.toMatch(/ownerKeyHash: ownerKey\.key/);
    expect(source).not.toMatch(/ownerKey: ownerKey|key: ownerKey\.key/);
  });

  test('a failure does not hand out the server\'s own error text', async () => {
    expect(source).not.toMatch(/details: error\.message/);
    prisma.$transaction.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    const res = await POST(req());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|10\.0\.0\.5/);
    expect(body.error).toBe('Your report did not go through. Try again in a moment.');
  }, 15000);
});

test('found-pet reports from someone not signed in carry the same hourly and daily limits', () => {
  const found = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'app/api/reports/found-pet/route.js'), 'utf8');
  expect(found).toMatch(/const FOUND_AN_HOUR = \{ windowMs: 60 \* 60 \* 1000, maxRequests: 6,/);
  expect(found).toMatch(/const FOUND_A_DAY = \{ windowMs: 24 \* 60 \* 60 \* 1000, maxRequests: 15,/);
  expect(found).toMatch(/if \(!session\?\.user\) \{[\s\S]{0,200}\[FOUND_AN_HOUR, 'reports:found:hour'\], \[FOUND_A_DAY, 'reports:found:day'\]/);
});
