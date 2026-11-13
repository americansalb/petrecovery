/**
 * The search board's route on ground (app/api/mission/[missionId]/board).
 *
 * The board is areas of ground: anyone holding the pet's link reads them,
 * and reads ground, not people. Starting an area takes a person and the
 * safety waiver; steering, asking and widening are the owner's alone; and
 * an area is never "taken", except the circle round a sighting, which the
 * route answers TAKEN for so the person's screen gives them other ground.
 *
 * What the areas are and what each verb writes is app/lib/searchZones.js
 * (__tests__/lib/searchZones.test.js). This is the route around it: who
 * may do what, and what is said back.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { case: { findFirst: jest.fn() }, notification: { create: jest.fn(async () => ({})) } },
}));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn(async () => null) }));
jest.mock('@/app/lib/searchZones', () => ({
  __esModule: true,
  ZONE_ACTIONS: ['claim', 'release', 'searched'],
  ZONE_STEER_ACTIONS: ['first', 'normal', 'walked', 'again', 'againAll', 'widen'],
  readZones: jest.fn(),
  // Never answers either: what the map shows on the ground is read beside the board, not before it.
  ensureHazards: jest.fn(() => new Promise(() => {})),
  actOnZone: jest.fn(),
  zoneForBoard: jest.fn((zone) => ({ id: zone.id, name: zone.name, reach: '150 m to 400 m west of where Max was lost', status: 'UNSEARCHED' })),
  askZone: jest.fn(),
  unaskZonePerson: jest.fn(async () => ({ count: 1 })),
  cannotSearch: jest.fn(),
  streetNames: jest.fn(async () => [{ name: 'Ramsey Ave', fromName: null, toName: null, path: [[30.31, -97.74], [30.315, -97.741]] }]),
}));
jest.mock('@/app/lib/searchBoard', () => ({
  __esModule: true,
  // Never answers: the board must not wait for the map server.
  ensureStreets: jest.fn(() => new Promise(() => {})),
  actOnBoard: jest.fn(async () => ({ error: 'NOT_FOUND', title: null })),
  streetForBoard: jest.fn(),
  BOARD_ACTIONS: ['claim', 'release', 'searched'],
  STEER_ACTIONS: ['first', 'normal', 'walked', 'again'],
}));
jest.mock('@/app/lib/searchTeam', () => ({
  __esModule: true,
  teamOf: jest.fn(async () => []),
  personByHandle: jest.fn(async () => null),
  forDesk: jest.fn(({ id, ...person }, { notes = false } = {}) => ({ ...person, sawNotes: notes })),
}));
jest.mock('@/app/lib/push', () => ({ __esModule: true, isPushConfigured: jest.fn(() => true), sendPushToUser: jest.fn(async () => ({ sent: 1 })) }));
jest.mock('@/app/lib/forceFeed', () => ({ __esModule: true, forcesOf: jest.fn(async () => ['force-1']) }));
jest.mock('@/app/lib/wake', () => ({ __esModule: true, wakeForces: jest.fn(async () => ({})), WAKE_KINDS: { BLOCK_FREE: 'FORCE_BLOCK_FREE' } }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => {}) }));
jest.mock('@/app/lib/sse/missionStream', () => ({ __esModule: true, broadcast: jest.fn() }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: jest.fn(async () => ({ success: true })),
  rateLimitResponse: jest.fn(() => new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })),
  RateLimitPresets: { SEARCH_READ: {} },
}));

import prisma from '@/app/lib/prisma';
import { searcherFor } from '@/app/lib/searcher';
import { readZones, actOnZone, askZone, unaskZonePerson, cannotSearch, streetNames } from '@/app/lib/searchZones';
import { ensureStreets, actOnBoard } from '@/app/lib/searchBoard';
import { teamOf, personByHandle } from '@/app/lib/searchTeam';
import { sendPushToUser } from '@/app/lib/push';
import { wakeForces } from '@/app/lib/wake';
import { broadcast } from '@/app/lib/sse/missionStream';
import { logEvent } from '@/lib/logging';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import { WAIVER_CODE } from '@/app/lib/waiver';
import { GET, PATCH } from '@/app/api/mission/[missionId]/board/route';

const CASE = 'case-max';
const PET = { id: CASE, caseNumber: 'AUS-2026-TEST01', status: 'ACTIVE', reportType: 'LOST', petName: 'Max', ownerName: 'Avery Stone', reporterId: 'u-avery', lastSeenLatitude: 30.3148, lastSeenLongitude: -97.7459 };
const OWNER = { id: 'u-avery', kind: 'user', userId: 'u-avery', firstName: 'Avery', isOwner: true, waiver: true, seesNames: true, leads: true };
const MEMBER = { id: 'u-sarah', kind: 'user', userId: 'u-sarah', firstName: 'Sarah', isOwner: false, waiver: true, seesNames: true, leads: false };
const HELPER = { id: 'v:vol-1', kind: 'volunteer', userId: null, firstName: 'Dana', isOwner: false, waiver: true, seesNames: false, leads: false };
const area = (key, over = {}) => ({ id: `z-${key}`, key, ring: key === 'middle' ? 0 : key.startsWith('seen') ? 3 : 1, name: key, status: 'UNSEARCHED', searchCount: 0, on: 0, mine: false, ...over });
const CIRCLE = { center: { lat: 30.3148, lng: -97.7459 }, inner: 150, edge: 400, wide: 800, radius: 400, widened: false };

const req = (method = 'GET', body) =>
  new NextRequest(`http://localhost/api/mission/${CASE}/board`, { method, headers: { 'content-type': 'application/json' }, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
const ctx = { params: { missionId: CASE } };
const patch = async (body) => {
  const res = await PATCH(req('PATCH', body), ctx);
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findFirst.mockResolvedValue(PET);
  searcherFor.mockResolvedValue(null);
  withRateLimitAsync.mockResolvedValue({ success: true });
  readZones.mockResolvedValue({ circle: CIRCLE, streetsStatus: 'READY', areas: [area('seen-s1', { status: 'IN_PROGRESS', on: 1 }), area('middle', { searchCount: 2, status: 'SEARCHED' }), area('north', { searchCount: 1, status: 'SEARCHED' }), area('east', { status: 'IN_PROGRESS', on: 1 }), area('south'), area('west')] });
  actOnZone.mockResolvedValue({ item: { id: 'z-west', status: 'IN_PROGRESS', mine: true, on: 1 }, title: 'the west side' });
  teamOf.mockResolvedValue([{ id: 'v:vol-1', handle: 'h-dana', name: 'Dana', state: 'walking' }]);
  personByHandle.mockResolvedValue(null);
  ensureStreets.mockImplementation(() => new Promise(() => {}));
});

describe('GET: ground for anyone, people for the few', () => {
  test('someone with only the link reads the areas, the circle and the streets as names', async () => {
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ caseId: CASE, open: true, unit: 'area', circle: CIRCLE, streets: [], cells: [], streetsStatus: 'READY', viewer: null });
    expect(body.areas.map((a) => a.key)).toEqual(['seen-s1', 'middle', 'north', 'east', 'south', 'west']);
    expect(body.around).toEqual([{ name: 'Ramsey Ave', fromName: null, toName: null, path: [[30.31, -97.74], [30.315, -97.741]] }]);
    // Ground, not people.
    expect(body).not.toHaveProperty('people');
    expect(teamOf).not.toHaveBeenCalled();
    expect(readZones).toHaveBeenCalledWith(CASE, { viewer: null, withNames: false, ownerId: 'u-avery', ownerName: 'Avery' });
  });

  test('how much has been searched counts the circle\'s own areas, at least once each: a sighting\'s circle is not one', async () => {
    const body = await (await GET(req(), ctx)).json();
    expect(body.counts).toEqual({ total: 5, searched: 2, inProgress: 1 });
  });

  test('it does not wait for the map server: the areas need none', async () => {
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    expect(ensureStreets).toHaveBeenCalledWith(CASE, expect.any(Object));
    // And with the streets not here yet there are none to send.
    readZones.mockResolvedValue({ circle: CIRCLE, streetsStatus: null, areas: [area('middle')] });
    const body = await (await GET(req(), ctx)).json();
    expect(body.around).toEqual([]);
    expect(streetNames).toHaveBeenCalledTimes(1);
  });

  test('the owner and a force looking are sent the roster, by handle and never by id; the note on an ask only to the owner', async () => {
    searcherFor.mockResolvedValue(OWNER);
    const owner = await (await GET(req(), ctx)).json();
    expect(owner.people).toEqual([{ handle: 'h-dana', name: 'Dana', state: 'walking', sawNotes: true }]);
    expect(owner.viewer).toEqual({ kind: 'user', firstName: 'Avery', isOwner: true, waiver: true, seesNames: true, holding: null });
    expect(readZones).toHaveBeenLastCalledWith(CASE, { viewer: 'u-avery', withNames: true, ownerId: 'u-avery', ownerName: 'Avery' });
    searcherFor.mockResolvedValue(MEMBER);
    const member = await (await GET(req(), ctx)).json();
    expect(member.people).toEqual([{ handle: 'h-dana', name: 'Dana', state: 'walking', sawNotes: false }]);
    expect(JSON.stringify(owner) + JSON.stringify(member)).not.toContain('vol-1');
  });

  test('a helper without an account is not sent it, and reads which area is theirs', async () => {
    searcherFor.mockResolvedValue(HELPER);
    readZones.mockResolvedValue({ circle: CIRCLE, streetsStatus: 'READY', areas: [area('middle'), area('west', { mine: true, status: 'IN_PROGRESS', on: 1 })] });
    const body = await (await GET(req(), ctx)).json();
    expect(body).not.toHaveProperty('people');
    expect(body.viewer).toMatchObject({ kind: 'volunteer', seesNames: false, holding: 'z-west' });
  });

  test('a found pet, and a report with no place, have no search to map', async () => {
    for (const pet of [{ ...PET, reportType: 'FOUND' }, { ...PET, lastSeenLatitude: null }]) {
      prisma.case.findFirst.mockResolvedValue(pet);
      const body = await (await GET(req(), ctx)).json();
      expect(body).toEqual({ caseId: CASE, open: true, unit: 'none', areas: [], circle: null, streets: [], around: [], cells: [], counts: { total: 0, searched: 0, inProgress: 0 }, streetsStatus: null, viewer: null });
    }
    expect(readZones).not.toHaveBeenCalled();
    expect(ensureStreets).not.toHaveBeenCalled();
  });

  test('a link that matches no pet is a 404 in words, and too many reads are told to slow down', async () => {
    prisma.case.findFirst.mockResolvedValue(null);
    const res = await GET(req(), ctx);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'This link does not match a pet.' });
    withRateLimitAsync.mockResolvedValue({ success: false });
    expect((await GET(req(), ctx)).status).toBe(429);
  });

  test('a read that fails says so in words, and gives nothing of the error away', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    readZones.mockRejectedValue(new Error('relation "SearchZone" does not exist'));
    const res = await GET(req(), ctx);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'The search map did not load. Try again in a moment.' });
    console.error.mockRestore();
  });
});

describe('PATCH: searching an area', () => {
  test('the board is areas: with no unit said, that is what an action is on', async () => {
    searcherFor.mockResolvedValue(HELPER);
    const out = await patch({ id: 'z-west', action: 'claim' });
    expect(out).toEqual({ status: 200, body: { success: true, unit: 'area', item: { id: 'z-west', status: 'IN_PROGRESS', mine: true, on: 1 } } });
    expect(actOnZone).toHaveBeenCalledWith({ caseId: CASE, id: 'z-west', action: 'claim', searcher: HELPER, ownerId: 'u-avery', ownerName: 'Avery' });
    expect(actOnBoard).not.toHaveBeenCalled();
  });

  test('needs a person', async () => {
    const out = await patch({ unit: 'area', id: 'z-west', action: 'claim' });
    expect(out).toEqual({ status: 401, body: { error: 'Join the search first.', code: 'NOT_JOINED' } });
    expect(actOnZone).not.toHaveBeenCalled();
  });

  test('needs the safety waiver to start and to say it is searched, not to stop', async () => {
    searcherFor.mockResolvedValue({ ...HELPER, waiver: false });
    for (const action of ['claim', 'searched']) {
      const out = await patch({ unit: 'area', id: 'z-west', action });
      expect(out).toEqual({ status: 403, body: { error: 'Accept the safety waiver before you search.', code: WAIVER_CODE } });
    }
    expect(actOnZone).not.toHaveBeenCalled();
    expect((await patch({ unit: 'area', id: 'z-west', action: 'release' })).status).toBe(200);
  });

  test('is refused once the search has ended, except for stopping', async () => {
    searcherFor.mockResolvedValue(HELPER);
    prisma.case.findFirst.mockResolvedValue({ ...PET, status: 'REUNITED' });
    expect(await patch({ unit: 'area', id: 'z-west', action: 'claim' })).toEqual({ status: 409, body: { error: 'This search has ended. Thank you for looking.', code: 'CLOSED' } });
    expect((await patch({ unit: 'area', id: 'z-west', action: 'release' })).status).toBe(200);
  });

  test('what is sent is checked before anything is read: an id is a short piece of text, an action one the board knows', async () => {
    searcherFor.mockResolvedValue(HELPER);
    for (const body of [{}, { unit: 'area', action: 'claim' }, { unit: 'area', id: { not: null }, action: 'claim' }, { unit: 'area', id: 'x'.repeat(201), action: 'claim' }, { unit: 'area', id: 'z-west', action: 'dance' }, { unit: 'area', id: 'z-west' }, 'not json', []]) {
      const out = await patch(body);
      expect(out.status).toBe(400);
      expect(out.body.error).toBe('Send an id and one of: claim, release, searched, first, normal, walked, again, againAll, widen, debrief.');
    }
    expect(prisma.case.findFirst).not.toHaveBeenCalled();
    expect(actOnZone).not.toHaveBeenCalled();
  });

  test('a sighting\'s circle with its one person is said as that, and the screen gives this person other ground', async () => {
    searcherFor.mockResolvedValue(HELPER);
    actOnZone.mockResolvedValue({ error: 'TAKEN', title: 'where Max was seen' });
    expect(await patch({ unit: 'area', id: 'z-seen-s1', action: 'claim' })).toEqual({ status: 409, body: { error: 'Someone is already there. One person goes to a sighting.', code: 'TAKEN' } });
  });

  test('every refusal is words about the area by its own name', async () => {
    searcherFor.mockResolvedValue(OWNER);
    const said = async (error, title = 'the west side') => {
      actOnZone.mockResolvedValue({ error, title });
      return patch({ unit: 'area', id: 'z-west', action: 'walked' });
    };
    expect(await said('NOT_FOUND', null)).toEqual({ status: 404, body: { error: 'That area is not on this search.', code: 'NOT_FOUND' } });
    expect(await said('NOT_ALLOWED', null)).toEqual({ status: 403, body: { error: 'Only the owner can do that.', code: 'NOT_ALLOWED' } });
    expect((await said('NOT_YOURS')).body.error).toBe('You are not on the west side.');
    expect((await said('NOT_CLAIMED')).body.error).toBe('Start the west side first, then say it is searched.');
    expect((await said('SOMEONE_ON_IT')).body.error).toBe('Someone is searching the west side right now. They say so when they have searched it.');
    expect((await said('ALREADY_WALKED')).body.error).toBe('The west side is already down as searched. Ask for another look first.');
    expect((await said('NOT_WALKED')).body.error).toBe('The west side has not been searched yet.');
    expect((await said('ALREADY_AGAIN')).body.error).toBe('The west side is already down for another look.');
    expect(await said('ALREADY_WIDE', null)).toEqual({ status: 409, body: { error: 'The search already reaches that far.', code: 'ALREADY_WIDE' } });
  });

  test('no answer tells a helper to stop, wait or hold back', async () => {
    searcherFor.mockResolvedValue(HELPER);
    const said = [];
    for (const error of ['NOT_FOUND', 'TAKEN', 'NOT_YOURS', 'NOT_CLAIMED', 'SOMEONE_ON_IT', 'ALREADY_WALKED', 'NOT_WALKED', 'ALREADY_AGAIN', 'ALREADY_WIDE']) {
      actOnZone.mockResolvedValue({ error, title: 'the west side' });
      said.push((await patch({ unit: 'area', id: 'z-west', action: 'claim' })).body.error);
    }
    expect(said.join(' ')).not.toMatch(/\b(stop|wait|hold|stay back|do not search|don't search|go home)\b/i);
  });

  test('everyone with the board open hears it changed: an id and a state, never who', async () => {
    searcherFor.mockResolvedValue(HELPER);
    actOnZone.mockResolvedValue({ item: { id: 'z-west', status: 'IN_PROGRESS', mine: true, who: [{ name: 'Dana' }], claimedByName: 'Dana' }, title: 'the west side' });
    await patch({ unit: 'area', id: 'z-west', action: 'claim' });
    expect(broadcast).toHaveBeenCalledWith(CASE, { type: 'AREA_UPDATED', unit: 'area', item: { id: 'z-west', status: 'IN_PROGRESS' } });
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'board.area_claim', resource_type: 'search_zone', resource_id: 'z-west' }));
  });

  test('stopping wakes nobody: an area was never anyone\'s alone, so none "came free"', async () => {
    searcherFor.mockResolvedValue(HELPER);
    await patch({ unit: 'area', id: 'z-west', action: 'release' });
    expect(wakeForces).not.toHaveBeenCalled();
  });

  test('too many changes in a minute are told to slow down', async () => {
    withRateLimitAsync.mockResolvedValue({ success: false });
    expect((await PATCH(req('PATCH', { unit: 'area', id: 'z-west', action: 'claim' }), ctx)).status).toBe(429);
    expect(prisma.case.findFirst).not.toHaveBeenCalled();
  });
});

describe('PATCH: steering from the desk', () => {
  test('nobody but the owner: a helper and a member of a force are refused before anything is done', async () => {
    for (const who of [HELPER, MEMBER]) {
      searcherFor.mockResolvedValue(who);
      for (const body of [{ unit: 'area', id: 'z-west', action: 'first' }, { unit: 'area', id: 'z-west', action: 'normal' }, { unit: 'area', id: 'z-west', action: 'walked' }, { unit: 'area', id: 'z-west', action: 'again' }, { unit: 'area', action: 'againAll' }, { unit: 'area', action: 'widen' }]) {
        expect(await patch(body)).toEqual({ status: 403, body: { error: 'Only the owner can do that.', code: 'NOT_ALLOWED' } });
      }
    }
    expect(actOnZone).not.toHaveBeenCalled();
  });

  test('none of it is going out to search, so none of it takes the waiver', async () => {
    searcherFor.mockResolvedValue({ ...OWNER, waiver: false });
    expect((await patch({ unit: 'area', id: 'z-west', action: 'first' })).status).toBe(200);
  });

  test('widening the search, and another look at every searched area, name no area', async () => {
    searcherFor.mockResolvedValue(OWNER);
    actOnZone.mockResolvedValue({ added: 8, title: null });
    expect(await patch({ unit: 'area', action: 'widen' })).toEqual({ status: 200, body: { success: true, unit: 'area', added: 8 } });
    expect(actOnZone).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'widen', id: undefined, searcher: OWNER }));
    expect(broadcast).toHaveBeenLastCalledWith(CASE, { type: 'AREA_UPDATED', unit: 'area' });
    actOnZone.mockResolvedValue({ count: 4, title: null });
    expect(await patch({ unit: 'area', action: 'againAll' })).toEqual({ status: 200, body: { success: true, unit: 'area', count: 4 } });
  });

  test('a search that has ended is not steered', async () => {
    searcherFor.mockResolvedValue(OWNER);
    prisma.case.findFirst.mockResolvedValue({ ...PET, status: 'REUNITED' });
    expect((await patch({ unit: 'area', action: 'widen' })).status).toBe(409);
    expect(actOnZone).not.toHaveBeenCalled();
  });
});

describe('PATCH: asking a person', () => {
  const JO = { id: 'u-jo', handle: 'h-jo', name: 'Jo' };

  test('asking is the owner\'s alone, checked before the person is looked for: nobody learns who is on the search from the answer', async () => {
    for (const who of [HELPER, MEMBER]) {
      searcherFor.mockResolvedValue(who);
      expect(await patch({ unit: 'area', id: 'z-west', action: 'ask', person: 'h-jo' })).toEqual({ status: 403, body: { error: 'Only the owner can do that.', code: 'NOT_ALLOWED' } });
      expect(await patch({ unit: 'area', action: 'unask', person: 'h-jo' })).toEqual({ status: 403, body: { error: 'Only the owner can do that.', code: 'NOT_ALLOWED' } });
    }
    expect(personByHandle).not.toHaveBeenCalled();
    expect(askZone).not.toHaveBeenCalled();
  });

  test('a person is a handle from the roster: anything else is nobody', async () => {
    searcherFor.mockResolvedValue(OWNER);
    for (const person of ['h-nobody', { id: 'u-jo' }, 42, null]) {
      expect(await patch({ unit: 'area', id: 'z-west', action: 'ask', person })).toEqual({ status: 404, body: { error: 'That person is not on this search.', code: 'NO_PERSON' } });
    }
    expect(personByHandle).toHaveBeenCalledTimes(1);
  });

  test('the owner asks Jo to search the west side: the board says so, and Jo hears it by name in their bell and on their phone', async () => {
    searcherFor.mockResolvedValue(OWNER);
    personByHandle.mockResolvedValue(JO);
    askZone.mockResolvedValue({ zone: { id: 'z-west', name: 'West side' }, title: 'the west side' });
    const out = await patch({ unit: 'area', id: 'z-west', action: 'ask', person: 'h-jo', note: 'Start at the creek path, please.' });
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ success: true, unit: 'area', item: { id: 'z-west' } });
    expect(askZone).toHaveBeenCalledWith({ caseId: CASE, zoneId: 'z-west', person: JO, searcher: OWNER, note: 'Start at the creek path, please.' });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: 'u-jo', type: 'SEARCH_ASK', title: 'Avery asked you to search the west side', message: 'For Max. 150 m to 400 m west of where Max was lost.', actionUrl: '/mission-control?mission=AUS-2026-TEST01', data: JSON.stringify({ caseId: CASE, zoneId: 'z-west' }) },
    });
    expect(sendPushToUser).toHaveBeenCalledWith(prisma, 'u-jo', { title: 'Avery asked you to search the west side', body: 'For Max. 150 m to 400 m west of where Max was lost.', url: '/mission-control?mission=AUS-2026-TEST01' });
    // Everyone with the board open hears that it changed, and not who was asked.
    expect(broadcast).toHaveBeenCalledWith(CASE, { type: 'AREA_UPDATED', unit: 'area' });
  });

  test('a helper without an account has it on their search screen: there is no bell to ring', async () => {
    searcherFor.mockResolvedValue(OWNER);
    personByHandle.mockResolvedValue({ id: 'v:vol-1', handle: 'h-dana', name: 'Dana' });
    askZone.mockResolvedValue({ zone: { id: 'z-west', name: 'West side' }, title: 'the west side' });
    expect((await patch({ unit: 'area', id: 'z-west', action: 'ask', person: 'h-dana' })).status).toBe(200);
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  test('what cannot be asked is said in words', async () => {
    searcherFor.mockResolvedValue(OWNER);
    personByHandle.mockResolvedValue(JO);
    askZone.mockResolvedValue({ error: 'ON_IT', title: 'the west side' });
    expect(await patch({ unit: 'area', id: 'z-west', action: 'ask', person: 'h-jo' })).toEqual({ status: 409, body: { error: 'They are already searching the west side.', code: 'ON_IT' } });
    askZone.mockResolvedValue({ error: 'ASKED_ALREADY', title: 'where Max was seen' });
    expect(await patch({ unit: 'area', id: 'z-seen-s1', action: 'ask', person: 'h-jo' })).toEqual({ status: 409, body: { error: 'Someone is already there, or was just asked to go. One person goes to a sighting.', code: 'ASKED_ALREADY' } });
    askZone.mockResolvedValue({ error: 'NOT_FOUND', title: null });
    expect((await patch({ unit: 'area', id: 'z-gone', action: 'ask', person: 'h-jo' })).status).toBe(404);
    expect((await patch({ unit: 'area', action: 'ask', person: 'h-jo' })).body).toEqual({ error: 'Send the area to ask for.' });
  });

  test('taking it back', async () => {
    searcherFor.mockResolvedValue(OWNER);
    personByHandle.mockResolvedValue(JO);
    expect(await patch({ unit: 'area', action: 'unask', person: 'h-jo' })).toEqual({ status: 200, body: { success: true, unit: 'area' } });
    expect(unaskZonePerson).toHaveBeenCalledWith({ caseId: CASE, person: JO, searcher: OWNER });
  });

  test('"I can\'t right now" is the asked person\'s own: no waiver and no role, only that something was asked of them', async () => {
    searcherFor.mockResolvedValue({ ...HELPER, waiver: false });
    cannotSearch.mockResolvedValue({ title: 'the west side' });
    expect(await patch({ action: 'cannot' })).toEqual({ status: 200, body: { success: true, unit: 'area' } });
    expect(cannotSearch).toHaveBeenCalledWith({ caseId: CASE, searcher: { ...HELPER, waiver: false } });
    cannotSearch.mockResolvedValue({ error: 'NO_ASK' });
    expect(await patch({ action: 'cannot' })).toEqual({ status: 409, body: { error: 'Nothing was asked of you.', code: 'NO_ASK' } });
  });

  test('nothing is asked, taken back or turned down on a search that has ended', async () => {
    prisma.case.findFirst.mockResolvedValue({ ...PET, status: 'REUNITED' });
    searcherFor.mockResolvedValue(OWNER);
    for (const body of [{ unit: 'area', id: 'z-west', action: 'ask', person: 'h-jo' }, { unit: 'area', action: 'unask', person: 'h-jo' }, { action: 'cannot' }]) {
      expect((await patch(body)).body.code).toBe('CLOSED');
    }
    expect(askZone).not.toHaveBeenCalled();
    expect(cannotSearch).not.toHaveBeenCalled();
  });
});

describe('a screen left open from before the search was on areas', () => {
  test('a street or a square it sends is still answered as one, by the board that kept them', async () => {
    searcherFor.mockResolvedValue(HELPER);
    for (const unit of ['street', 'block']) {
      const out = await patch({ unit, id: 'st-1', action: 'claim' });
      expect(out.status).toBe(404);
      expect(out.body.error).toBe('That street is not on this search.');
    }
    expect(actOnBoard).toHaveBeenCalledTimes(2);
    expect(actOnZone).not.toHaveBeenCalled();
    // The newer steering is not something a street knows.
    searcherFor.mockResolvedValue(OWNER);
    expect((await patch({ unit: 'street', action: 'widen' })).status).toBe(400);
  });

  test('nobody is asked to walk a street any more: an ask it sends is an ask for ground, and the route no longer reads the street asks', async () => {
    searcherFor.mockResolvedValue(HELPER);
    cannotSearch.mockResolvedValue({ error: 'NO_ASK' });
    expect(await patch({ unit: 'street', action: 'cannot' })).toEqual({ status: 409, body: { error: 'Nothing was asked of you.', code: 'NO_ASK' } });
    expect(cannotSearch).toHaveBeenCalledTimes(1);
    const route = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'app', 'api', 'mission', '[missionId]', 'board', 'route.js'), 'utf8');
    expect(route).not.toMatch(/searchAsk|askStreet|cannotWalk/);
  });
});
