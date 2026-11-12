/**
 * The owner's link (GET /api/mission/[missionId]/own?k=...): the link in
 * the email sent when a report is made without an account. It swaps the
 * key for the cookie that carries it and goes to Mission Control.
 *
 * A wrong or old key changes nothing and is answered the same way, so
 * nothing is learned by trying keys. The way on is always the site's own
 * address, never one read from the request.
 */

jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: { case: { findFirst: jest.fn() } } }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/rateLimit', () => {
  const { NextResponse } = require('next/server');
  return {
    __esModule: true,
    withRateLimitAsync: jest.fn(async () => ({ success: true })),
    rateLimitResponse: jest.fn(() => NextResponse.json({ error: 'Too many requests' }, { status: 429 })),
  };
});

import { NextRequest } from 'next/server';
import prisma from '@/app/lib/prisma';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import { mintOwnerKey } from '@/app/lib/ownerKey';
import { getBaseUrl } from '@/app/lib/config';
import { GET } from '@/app/api/mission/[missionId]/own/route';

const mine = mintOwnerKey();
const PET = { id: 'case-1', caseNumber: 'AUS-2026-AAAAAA', ownerKeyHash: mine.hash, ownerKeyAt: new Date() };
const open = (k, host = 'evil.example') => GET(new NextRequest(`https://${host}/api/mission/AUS-2026-AAAAAA/own${k == null ? '' : `?k=${k}`}`), { params: Promise.resolve({ missionId: 'AUS-2026-AAAAAA' }) });

beforeEach(() => {
  jest.clearAllMocks();
  withRateLimitAsync.mockResolvedValue({ success: true });
  prisma.case.findFirst.mockResolvedValue(PET);
});

test('the right key is swapped for the cookie, and the way on is Mission Control at the site\'s own address', async () => {
  const res = await open(mine.key);
  expect(res.status).toBe(303);
  // Never the host the request came in on.
  expect(res.headers.get('location')).toBe(`${getBaseUrl()}/mission-control?mission=AUS-2026-AAAAAA`);
  const cookie = res.headers.get('set-cookie');
  expect(cookie).toMatch(new RegExp(`^rp_owner_case-1=${mine.key};`));
  expect(cookie).toMatch(/HttpOnly/i);
  expect(cookie).toMatch(/SameSite=lax/i);
  expect(cookie).toMatch(/Max-Age=5184000/);
  expect(cookie).toMatch(/Path=\//);
  // The link gives the key and nothing else: it never marks this browser as the one that made the report, which is
  // what the one-search-at-a-time limit counts.
  expect(cookie).not.toMatch(/rp_made_/);
});

test('the key is not left behind: no referrer carries it on, and no cache keeps the answer', async () => {
  const res = await open(mine.key);
  expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  expect(res.headers.get('cache-control')).toBe('no-store');
  expect(res.headers.get('location')).not.toContain(mine.key);
});

test('a wrong key, no key or an old key sets nothing, and is answered exactly as the right one is', async () => {
  const right = await open(mine.key);
  for (const k of [mintOwnerKey().key, 'short', '', null]) {
    const res = await open(k);
    expect(res.status).toBe(right.status);
    expect(res.headers.get('location')).toBe(right.headers.get('location'));
    expect(res.headers.get('set-cookie')).toBeNull();
  }
  prisma.case.findFirst.mockResolvedValue({ ...PET, ownerKeyAt: new Date(Date.now() - 61 * 24 * 60 * 60 * 1000) });
  expect((await open(mine.key)).headers.get('set-cookie')).toBeNull();
  // A search that never had a key.
  prisma.case.findFirst.mockResolvedValue({ ...PET, ownerKeyHash: null, ownerKeyAt: null });
  expect((await open(mine.key)).headers.get('set-cookie')).toBeNull();
});

test('a search that is not there goes to the same page, which says so', async () => {
  prisma.case.findFirst.mockResolvedValue(null);
  const res = await open(mine.key);
  expect(res.status).toBe(303);
  expect(res.headers.get('set-cookie')).toBeNull();
  expect(res.headers.get('location')).toBe(`${getBaseUrl()}/mission-control?mission=AUS-2026-AAAAAA`);
});

test('it is rate limited, and past the limit nothing is looked up', async () => {
  await open(mine.key);
  expect(withRateLimitAsync.mock.calls[0][1]).toEqual({ windowMs: 60 * 1000, maxRequests: 10, blockDurationMs: 10 * 60 * 1000 });
  expect(withRateLimitAsync.mock.calls[0][2]).toBe('mission:own');
  jest.clearAllMocks();
  withRateLimitAsync.mockResolvedValue({ success: false });
  expect((await open(mine.key)).status).toBe(429);
  expect(prisma.case.findFirst).not.toHaveBeenCalled();
});

describe('what the owner does from the search screen, with the key and no session', () => {
  const fs = require('fs');
  const path = require('path');
  const read = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

  test.each([
    ['telling everyone something', 'app/api/missions/[missionId]/notes/route.js'],
    ['marking the pet home', 'app/api/missions/[missionId]/status/route.js'],
  ])('%s: with no session, the owner\'s key is who is asking', (_what, file) => {
    const source = read(file);
    expect(source).toMatch(/import \{ ownerByKey \} from '@\/app\/lib\/ownerKey';/);
    // Only when nobody is signed in, and only for the search in the address: the key of one search opens no other.
    expect(source).toMatch(/session = await getServerSession\(authOptions\);\s*if \(!session\?\.user\?\.id\) \{\s*\/\/[^\n]*\n\s*const owner = await ownerByKey\(request, params\.missionId\);\s*if \(owner\) session = \{ user: \{ id: owner\.userId, role: 'USER' \} \};\s*\}/);
    // Never an admin or a moderator by key.
    expect(source).not.toMatch(/owner\.userId, role: '(ADMIN|MODERATOR)'/);
  });
});
