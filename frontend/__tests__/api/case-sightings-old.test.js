/**
 * The older sightings route (/api/missions/[missionId]/sightings).
 *
 * Nothing on the site calls it. Its list went to anyone with no sign-in:
 * every sighting whole, with what the witness wrote, the name they gave,
 * and the sending account's id and last name. Its POST wrote whatever it
 * was sent into a letter to the owner.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { case: { findFirst: jest.fn() }, caseSighting: { findMany: jest.fn(), create: jest.fn() }, user: { findUnique: jest.fn() } },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn(async () => ({ user: { id: 'u-x' } })) }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => ({})) }));
jest.mock('@/app/lib/email', () => ({ __esModule: true, sendEmail: jest.fn(async () => ({})) }));
jest.mock('@/app/lib/push', () => ({ __esModule: true, sendPushToUser: jest.fn(), isPushConfigured: () => false }));
jest.mock('@/app/lib/forceFeed', () => ({ __esModule: true, feedPost: jest.fn(), forcesOf: jest.fn(async () => []), postToForces: jest.fn() }));
jest.mock('@/app/lib/wake', () => ({ __esModule: true, wakeForces: jest.fn(), WAKE_KINDS: {} }));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn(async () => null) }));
jest.mock('@/app/lib/rateLimit', () => ({ __esModule: true, withRateLimitAsync: jest.fn(async () => ({ success: true })), rateLimitResponse: () => new Response('{}', { status: 429 }), RateLimitPresets: { SEARCH_READ: {} } }));

import prisma from '@/app/lib/prisma';
import { searcherFor } from '@/app/lib/searcher';
import { sendEmail } from '@/app/lib/email';
import { GET, POST } from '@/app/api/missions/[missionId]/sightings/route';

const URL = 'http://localhost/api/missions/AUS-2026-0001/sightings';
const ctx = { params: { missionId: 'AUS-2026-0001' } };
const get = () => GET(new NextRequest(URL), ctx);
const post = (body) => POST(new NextRequest(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), ctx);
const ROW = { id: 's1', missionId: 'case-max', address: '4001 Ramsey Ave', description: 'By the creek', reporterName: 'Dana Reyes', reportedById: 'u-dana', witnessKeyHash: 'hash', sightedAt: new Date(0), reportedBy: { firstName: 'Dana' } };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findFirst.mockResolvedValue({ id: 'case-max', caseNumber: 'AUS-2026-0001' });
  prisma.caseSighting.findMany.mockResolvedValue([ROW]);
  prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
  searcherFor.mockResolvedValue(null);
});

describe('the list', () => {
  test('with no sign-in it is refused, and nothing is read', async () => {
    const res = await get();
    expect(res.status).toBe(401);
    expect(JSON.stringify(await res.json())).not.toMatch(/Dana|Ramsey|creek/);
    expect(prisma.caseSighting.findMany).not.toHaveBeenCalled();
  });

  test('a signed-in stranger is refused', async () => {
    searcherFor.mockResolvedValue({ userId: 'u-x', seesNames: false });
    expect((await get()).status).toBe(403);
    expect(prisma.caseSighting.findMany).not.toHaveBeenCalled();
  });

  test('the owner and the forces looking read it, with no account id and no key', async () => {
    searcherFor.mockResolvedValue({ userId: 'u-avery', seesNames: true, isOwner: true });
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(1);
    expect(body.sightings[0]).toMatchObject({ id: 's1', description: 'By the creek', reportedBy: { firstName: 'Dana' } });
    expect(Object.keys(body.sightings[0])).not.toEqual(expect.arrayContaining(['reportedById']));
    expect(Object.keys(body.sightings[0])).not.toEqual(expect.arrayContaining(['witnessKeyHash']));
    // The account that sent it is asked for by first name only.
    expect(prisma.caseSighting.findMany.mock.calls[0][0].include.reportedBy.select).toEqual({ firstName: true });
  });
});

describe('reporting through it is switched off', () => {
  test('nothing is written and no letter is sent, whoever asks', async () => {
    const res = await post({ latitude: 30.3, longitude: -97.7, address: '<a href="https://example.com">Click here</a>', description: '<img src=x onerror=alert(1)>' });
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: "Send a sighting from the pet's own page.", code: 'NOT_AVAILABLE' });
    expect(prisma.caseSighting.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
