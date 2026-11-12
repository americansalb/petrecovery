/**
 * The older sighting route (/api/mission/[missionId]/sighting).
 *
 * Nothing on the site calls it now, and it was open in four ways: its list
 * (exact places, notes, reporters' names) went to anyone; a report and a
 * perimeter place took a volunteer's id on trust; any signed-in account
 * could verify a sighting of any search; and standing down took no sign-in
 * at all and pushed whatever reason it was given to every helper's phone.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findFirst: jest.fn(), findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    missionControl: { findUnique: jest.fn() },
    missionSighting: { findMany: jest.fn(async () => []), findFirst: jest.fn() },
    missionVolunteer: { findFirst: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn(async () => null) }));
jest.mock('@/app/lib/missionControl/ensure', () => ({ __esModule: true, ensureMissionControl: jest.fn(async () => ({ id: 'mc-max' })) }));
jest.mock('@/app/lib/missionControl/sightingResponse', () => ({
  __esModule: true,
  reportSighting: jest.fn(async () => ({ success: true, sightingId: 's-new' })),
  confirmPerimeterPosition: jest.fn(async () => ({ success: true })),
  verifySighting: jest.fn(async () => ({ success: true, verified: true })),
  standDownContainment: jest.fn(async () => ({ success: true })),
  handleConflictingSightings: jest.fn(async () => ({ hasConflict: false })),
}));
jest.mock('@/app/lib/rateLimit', () => ({ __esModule: true, withRateLimitAsync: jest.fn(async () => ({ success: true })), rateLimitResponse: () => new Response('{}', { status: 429 }), RateLimitPresets: { SEARCH_READ: {} } }));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn(async () => null) }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { searcherFor } from '@/app/lib/searcher';
import { reportSighting, confirmPerimeterPosition, verifySighting, standDownContainment } from '@/app/lib/missionControl/sightingResponse';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import { GET, POST } from '@/app/api/mission/[missionId]/sighting/route';

const URL = 'http://localhost/api/mission/AUS-2026-0001/sighting';
const ctx = { params: { missionId: 'AUS-2026-0001' } };
const get = () => GET(new NextRequest(URL), ctx);
const post = (body) => POST(new NextRequest(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }), ctx);
const as = (id) => getServerSession.mockResolvedValue(id ? { user: { id } } : null);
const DANA = { id: 'v:vol-dana', kind: 'volunteer', userId: null, volunteerId: 'vol-dana', seesNames: false };
const OWNER = { id: 'u-avery', kind: 'user', userId: 'u-avery', volunteerId: null, isOwner: true, seesNames: true };
const MEMBER = { id: 'u-sarah', kind: 'user', userId: 'u-sarah', volunteerId: null, isOwner: false, seesNames: true };
const STRANGER = { id: 'u-x', kind: 'user', userId: 'u-x', volunteerId: null, isOwner: false, seesNames: false };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findFirst.mockResolvedValue({ id: 'case-max' });
  prisma.case.findUnique.mockResolvedValue({ reporterId: 'u-avery' });
  prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
  prisma.missionControl.findUnique.mockResolvedValue({ id: 'mc-max' });
  prisma.missionSighting.findMany.mockResolvedValue([{ id: 's1', createdAt: new Date(0), latitude: 30.3, longitude: -97.7, priority: 2, confidence: 'MEDIUM', verified: false, status: 'PENDING', photoUrl: null, notes: 'By the creek', reporterName: 'Dana Reyes' }]);
  prisma.missionSighting.findFirst.mockResolvedValue(null);
  prisma.missionVolunteer.findFirst.mockResolvedValue(null);
  searcherFor.mockResolvedValue(null);
  withRateLimitAsync.mockResolvedValue({ success: true });
  as(null);
});

describe('the list: exact places, what was written, and who wrote it', () => {
  test('nobody signed in and no helper proven: 401, and nothing is read', async () => {
    const res = await get();
    expect(res.status).toBe(401);
    expect(prisma.missionSighting.findMany).not.toHaveBeenCalled();
  });

  test.each([['a helper from the link', DANA], ['a signed-in stranger', STRANGER]])('%s: 403', async (_who, searcher) => {
    searcherFor.mockResolvedValue(searcher);
    const res = await get();
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toMatch(/Dana|creek|30\.3/);
    expect(prisma.missionSighting.findMany).not.toHaveBeenCalled();
  });

  test.each([['the owner', OWNER], ['a member of a force looking for the pet', MEMBER]])('%s reads it', async (_who, searcher) => {
    searcherFor.mockResolvedValue(searcher);
    const res = await get();
    expect(res.status).toBe(200);
    expect((await res.json()).sightings).toHaveLength(1);
    // The pet the address names, by its number as well as its id.
    expect(prisma.missionControl.findUnique).toHaveBeenCalledWith({ where: { caseId: 'case-max' }, select: { id: true } });
  });
});

describe('what a helper does as themselves', () => {
  test.each(['REPORT', 'CONFIRM_PERIMETER'])('%s with only an id in the request is refused', async (action) => {
    const res = await post({ action, volunteerId: 'vol-dana', location: { lat: 30.3, lng: -97.7 }, confidence: 'CONFIRMED' });
    expect(res.status).toBe(401);
    expect(reportSighting).not.toHaveBeenCalled();
    expect(confirmPerimeterPosition).not.toHaveBeenCalled();
  });

  test('a proven helper reports as themselves, whatever id the request names', async () => {
    searcherFor.mockResolvedValue(DANA);
    const res = await post({ action: 'REPORT', volunteerId: 'vol-someone-else', location: { lat: 30.3, lng: -97.7 }, confidence: 'LOW', notes: '  by the\n creek  ', direction: 'north' });
    expect(res.status).toBe(200);
    expect(reportSighting).toHaveBeenCalledWith('vol-dana', { location: { lat: 30.3, lng: -97.7 }, confidence: 'LOW', photoUrl: undefined, notes: 'by the creek', direction: 'north' });
  });

  test('a report through this route starts no containment: "confirmed" is recorded as no more than medium', async () => {
    searcherFor.mockResolvedValue(DANA);
    for (const confidence of ['CONFIRMED', 'HIGH', 'MEDIUM']) {
      await post({ action: 'REPORT', location: { lat: 30.3, lng: -97.7 }, confidence });
      expect(reportSighting.mock.calls.at(-1)[1].confidence).toBe('MEDIUM');
    }
    await post({ action: 'REPORT', location: { lat: 30.3, lng: -97.7 }, confidence: { $gt: '' } });
    expect(reportSighting.mock.calls.at(-1)[1].confidence).toBeUndefined();
  });

  test('a report needs a real place, and what is written is held to a length', async () => {
    searcherFor.mockResolvedValue(DANA);
    expect((await post({ action: 'REPORT', location: { lat: 'x' } })).status).toBe(400);
    expect(reportSighting).not.toHaveBeenCalled();
    await post({ action: 'REPORT', location: { lat: 30.3, lng: -97.7 }, notes: 'n'.repeat(5000), photoUrl: 'javascript:alert(1)' });
    const sent = reportSighting.mock.calls[0][1];
    expect(sent.notes).toHaveLength(500);
    expect(sent.photoUrl).toBeUndefined();
  });
});

describe('what changes the search for everyone is the owner\'s', () => {
  test('standing down with nobody signed in: 401, and nothing is pushed', async () => {
    const res = await post({ action: 'STAND_DOWN', reason: 'Everyone go home.' });
    expect(res.status).toBe(401);
    expect(standDownContainment).not.toHaveBeenCalled();
  });

  test.each(['STAND_DOWN', 'VERIFY'])('%s by a signed-in account that is not the owner: 403', async (action) => {
    as('u-stranger');
    const res = await post({ action, sightingId: 's1', verified: false, reason: 'x' });
    expect(res.status).toBe(403);
    expect(standDownContainment).not.toHaveBeenCalled();
    expect(verifySighting).not.toHaveBeenCalled();
  });

  test('the owner stands down, with a reason that is one line of text', async () => {
    as('u-avery');
    const res = await post({ action: 'STAND_DOWN', reason: `  Not him.\n It was a fox.  ${'x'.repeat(900)}` });
    expect(res.status).toBe(200);
    const [mission, reason] = standDownContainment.mock.calls[0];
    expect(mission).toBe('mc-max');
    expect(reason.startsWith('Not him. It was a fox.')).toBe(true);
    expect(reason).toHaveLength(200);
  });

  test('the owner verifies a sighting of this pet\'s own, and not one from another search', async () => {
    as('u-avery');
    expect((await post({ action: 'VERIFY', sightingId: 's-of-another-pet', verified: true })).status).toBe(404);
    expect(verifySighting).not.toHaveBeenCalled();
    expect(prisma.missionSighting.findFirst).toHaveBeenCalledWith({ where: { id: 's-of-another-pet', missionId: 'mc-max' }, select: { id: true } });
    prisma.missionSighting.findFirst.mockResolvedValue({ id: 's1' });
    expect((await post({ action: 'VERIFY', sightingId: 's1', verified: 'yes' })).status).toBe(200);
    // Only a plain true verifies.
    expect(verifySighting).toHaveBeenCalledWith('s1', false, 'u-avery');
    expect((await post({ action: 'VERIFY', sightingId: { $ne: null }, verified: true })).status).toBe(404);
  });

  test('staff may too', async () => {
    as('u-staff');
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    expect((await post({ action: 'STAND_DOWN' })).status).toBe(200);
    expect(standDownContainment).toHaveBeenCalledWith('mc-max', undefined);
  });
});

describe('the edges', () => {
  test('an action nobody knows, or a body that is not an object: 400', async () => {
    expect((await post({ action: 'ERASE' })).status).toBe(400);
    expect((await post('[]')).status).toBe(400);
    expect((await post('junk')).status).toBe(400);
    expect(prisma.case.findFirst).not.toHaveBeenCalled();
  });

  test('counted per connection', async () => {
    withRateLimitAsync.mockResolvedValue({ success: false });
    expect((await post({ action: 'STAND_DOWN' })).status).toBe(429);
    expect((await get()).status).toBe(429);
  });
});
