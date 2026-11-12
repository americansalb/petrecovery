/**
 * What a helper does as themselves on the older volunteer route
 * (POST /api/mission/[missionId]/volunteer: CHECK_IN, CHECK_OUT, SIGNAL,
 * FLAG_RESOURCES; PATCH: where they are).
 *
 * These acted on whatever volunteer id the request named, for any pet,
 * with no proof and no count: anyone who learned an id could check that
 * helper out, move them on the map, or raise "needs backup" in their name,
 * which pushes to other helpers' phones. Each now takes the helper the
 * request proves (the volunteer headers, or the signed-in person's own row
 * on this search), and an id written in the request is not used.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: { case: { findFirst: jest.fn(), findUnique: jest.fn() }, missionVolunteer: { findFirst: jest.fn() }, user: { findUnique: jest.fn() } } }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn(async () => null) }));
jest.mock('@/app/lib/missionControl/ensure', () => ({ __esModule: true, ensureMissionControl: jest.fn(async () => ({ id: 'mc-1' })) }));
jest.mock('@/app/lib/missionControl/volunteerOps', () => ({
  __esModule: true,
  quickJoin: jest.fn(async () => ({ success: true, volunteerId: 'vol-new' })),
  updateLocation: jest.fn(async () => ({ success: true, inAssignedZone: false })),
  flagResources: jest.fn(async () => ({ success: true })),
  sendSignal: jest.fn(async () => ({ success: true, signalId: 'sig-1' })),
  checkIn: jest.fn(async () => ({ success: true })),
  checkOut: jest.fn(async () => ({ success: true, summary: { minutesSearched: 12 } })),
}));
jest.mock('@/app/lib/rateLimit', () => ({ __esModule: true, withRateLimitAsync: jest.fn(async () => ({ success: true })) }));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn(async () => null) }));

import prisma from '@/app/lib/prisma';
import { searcherFor } from '@/app/lib/searcher';
import { updateLocation, flagResources, sendSignal, checkIn, checkOut } from '@/app/lib/missionControl/volunteerOps';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import { POST, PATCH } from '@/app/api/mission/[missionId]/volunteer/route';
import { ownVolunteerId, ownsPet, isStaff, cleanPlace } from '@/app/lib/missionControl/guard';

const URL = 'http://localhost/api/mission/AUS-2026-0001/volunteer';
const ctx = { params: { missionId: 'AUS-2026-0001' } };
const send = (handler, method, body, headers = {}) => handler(new NextRequest(URL, { method, headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }), ctx);
const post = (body, headers) => send(POST, 'POST', body, headers);
const patch = (body, headers) => send(PATCH, 'PATCH', body, headers);

const DANA = { id: 'v:vol-dana', kind: 'volunteer', userId: null, volunteerId: 'vol-dana', firstName: 'Dana' };
const SARAH = { id: 'u-sarah', kind: 'user', userId: 'u-sarah', volunteerId: null, firstName: 'Sarah' };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findFirst.mockResolvedValue({ id: 'case-max' });
  prisma.missionVolunteer.findFirst.mockResolvedValue(null);
  searcherFor.mockResolvedValue(null);
  withRateLimitAsync.mockResolvedValue({ success: true });
});

describe('with nobody proven, nothing is done in anyone\'s name', () => {
  test.each([
    ['CHECK_IN', { estimatedMinutes: 30 }, checkIn],
    ['CHECK_OUT', {}, checkOut],
    ['SIGNAL', { signalType: 'NEED_BACKUP', location: { lat: 30.3, lng: -97.7 } }, sendSignal],
    ['FLAG_RESOURCES', { resources: ['CAR'] }, flagResources],
  ])('%s with only an id in the request is refused', async (action, extra, op) => {
    const res = await post({ action, volunteerId: 'vol-dana', ...extra });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Join the search first.', code: 'NOT_JOINED' });
    expect(op).not.toHaveBeenCalled();
  });

  test('a place for someone else is refused too', async () => {
    const res = await patch({ volunteerId: 'vol-dana', location: { lat: 30.3, lng: -97.7 } });
    expect(res.status).toBe(401);
    expect(updateLocation).not.toHaveBeenCalled();
  });
});

describe('the helper the request proves is the one acted on', () => {
  test('by the volunteer headers: the id in the request is not used, even when it names someone else', async () => {
    searcherFor.mockResolvedValue(DANA);
    const res = await post({ action: 'CHECK_OUT', volunteerId: 'vol-someone-else' });
    expect(res.status).toBe(200);
    expect(checkOut).toHaveBeenCalledWith('vol-dana');
    // Proven for this pet: the search the address names is the one asked about.
    expect(searcherFor).toHaveBeenCalledWith(expect.anything(), 'case-max');
  });

  test('signed in: their own row on this search', async () => {
    searcherFor.mockResolvedValue(SARAH);
    prisma.missionVolunteer.findFirst.mockResolvedValue({ id: 'vol-sarah' });
    const res = await post({ action: 'CHECK_IN', volunteerId: 'vol-dana', estimatedMinutes: 45 });
    expect(res.status).toBe(200);
    expect(checkIn).toHaveBeenCalledWith('vol-sarah', 45);
    expect(prisma.missionVolunteer.findFirst).toHaveBeenCalledWith({ where: { userId: 'u-sarah', mission: { caseId: 'case-max' } }, select: { id: true } });
  });

  test('signed in but never joined this search: refused', async () => {
    searcherFor.mockResolvedValue(SARAH);
    const res = await post({ action: 'CHECK_OUT', volunteerId: 'vol-dana' });
    expect(res.status).toBe(401);
    expect(checkOut).not.toHaveBeenCalled();
  });

  test('a place moves only the helper who sent it', async () => {
    searcherFor.mockResolvedValue(DANA);
    const res = await patch({ volunteerId: 'vol-someone-else', location: { lat: 30.31, lng: -97.74, accuracy: 12 } });
    expect(res.status).toBe(200);
    expect(updateLocation).toHaveBeenCalledWith('vol-dana', { lat: 30.31, lng: -97.74, accuracy: 12 });
  });
});

describe('what is sent is held to what it can be', () => {
  beforeEach(() => searcherFor.mockResolvedValue(DANA));

  test('a signal is one of the four, and its place is a real one or none', async () => {
    expect((await post({ action: 'SIGNAL', signalType: 'EVERYONE_GO_HOME' })).status).toBe(400);
    expect(sendSignal).not.toHaveBeenCalled();
    await post({ action: 'SIGNAL', signalType: 'AREA_CLEAR', location: { lat: 'north', lng: 5 } });
    expect(sendSignal).toHaveBeenCalledWith('vol-dana', 'AREA_CLEAR', null);
    await post({ action: 'SIGNAL', signalType: 'NEED_BACKUP', location: { lat: 30.3, lng: -97.7 } });
    expect(sendSignal).toHaveBeenLastCalledWith('vol-dana', 'NEED_BACKUP', { lat: 30.3, lng: -97.7 });
  });

  test('what a helper carries is from the list, each once', async () => {
    await post({ action: 'FLAG_RESOURCES', resources: ['CAR', 'CAR', 'A TANK', { type: 'TRAP' }, 'TREATS'] });
    expect(flagResources).toHaveBeenCalledWith('vol-dana', ['CAR', 'TREATS']);
    await post({ action: 'FLAG_RESOURCES', resources: 'CAR' });
    expect(flagResources).toHaveBeenLastCalledWith('vol-dana', []);
  });

  test('how long they expect to be out is a number of minutes, a day at most, or not said', async () => {
    await post({ action: 'CHECK_IN', estimatedMinutes: 999999 });
    expect(checkIn).toHaveBeenLastCalledWith('vol-dana', 1440);
    await post({ action: 'CHECK_IN', estimatedMinutes: 'soon' });
    expect(checkIn).toHaveBeenLastCalledWith('vol-dana', undefined);
    await post({ action: 'CHECK_IN', estimatedMinutes: -5 });
    expect(checkIn).toHaveBeenLastCalledWith('vol-dana', undefined);
  });

  test('a place that is not on the globe is refused before anyone is looked up', async () => {
    for (const location of [null, {}, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: 'x', lng: 'y' }, 'here']) {
      const res = await patch({ location });
      expect({ location, status: res.status }).toEqual({ location, status: 400 });
    }
    expect(updateLocation).not.toHaveBeenCalled();
    expect(searcherFor).not.toHaveBeenCalled();
  });

  test('a body that is not an object is an action nobody knows', async () => {
    expect((await post('[1,2]')).status).toBe(400);
    expect((await post('not json')).status).toBe(400);
  });
});

describe('each has a count per connection', () => {
  test('a signal reaches other phones, so it has the smallest: six in ten minutes', async () => {
    searcherFor.mockResolvedValue(DANA);
    await post({ action: 'SIGNAL', signalType: 'AREA_CLEAR' });
    const [, limit, key] = withRateLimitAsync.mock.calls[0];
    expect(key).toBe('search:signal');
    expect(limit).toEqual({ windowMs: 10 * 60 * 1000, maxRequests: 6, blockDurationMs: 10 * 60 * 1000 });
  });

  test('past the count nothing is done, and nobody is looked up', async () => {
    withRateLimitAsync.mockResolvedValue({ success: false });
    expect((await post({ action: 'CHECK_OUT' })).status).toBe(429);
    expect((await patch({ location: { lat: 30.3, lng: -97.7 } })).status).toBe(429);
    expect(searcherFor).not.toHaveBeenCalled();
    expect(checkOut).not.toHaveBeenCalled();
    expect(updateLocation).not.toHaveBeenCalled();
  });
});

describe('the guard itself', () => {
  test('nobody proven is nobody', async () => {
    searcherFor.mockResolvedValue(null);
    expect(await ownVolunteerId({}, 'case-max')).toBeNull();
    expect(prisma.missionVolunteer.findFirst).not.toHaveBeenCalled();
  });

  test('who reported the pet, and who is staff', async () => {
    prisma.case.findUnique.mockResolvedValue({ reporterId: 'u-avery' });
    expect(await ownsPet('u-avery', 'case-max')).toBe(true);
    expect(await ownsPet('u-sarah', 'case-max')).toBe(false);
    expect(await ownsPet(null, 'case-max')).toBe(false);
    prisma.case.findUnique.mockResolvedValue(null);
    expect(await ownsPet('u-avery', 'case-gone')).toBe(false);
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    expect(await isStaff('u-admin')).toBe(true);
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
    expect(await isStaff('u-sarah')).toBe(false);
    expect(await isStaff(null)).toBe(false);
  });

  test('a place is two real numbers on the globe', () => {
    expect(cleanPlace({ lat: 30.3, lng: -97.7 })).toEqual({ lat: 30.3, lng: -97.7 });
    expect(cleanPlace({ lat: '30.3', lng: '-97.7', accuracy: 9 })).toEqual({ lat: 30.3, lng: -97.7, accuracy: 9 });
    expect(cleanPlace({ lat: 30.3, lng: -97.7, accuracy: -1 })).toEqual({ lat: 30.3, lng: -97.7 });
    expect(cleanPlace({ lat: 30.3, lng: -97.7, note: 'x'.repeat(5000) })).toEqual({ lat: 30.3, lng: -97.7 });
    expect(cleanPlace(null)).toBeNull();
    expect(cleanPlace({ lat: NaN, lng: 0 })).toBeNull();
    // An empty field is not zero degrees: nobody is put in the sea off Africa by leaving a value out.
    expect(cleanPlace({ lat: null, lng: null })).toBeNull();
    expect(cleanPlace({ lat: '', lng: ' ' })).toBeNull();
    expect(cleanPlace({ lat: true, lng: false })).toBeNull();
    expect(cleanPlace({ lat: 0, lng: 0 })).toEqual({ lat: 0, lng: 0 });
  });
});
