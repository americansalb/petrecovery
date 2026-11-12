/**
 * Asking a named person to walk a street, through the board's route
 * (PATCH /api/mission/[missionId]/board: "ask", "unask", "cannot"), and
 * the roster the route sends (GET: `people`).
 *
 * Who may do what is the point of these: an ask is made by whoever runs
 * the search and by nobody else, the person asked is the only one who can
 * turn it down, and who is on the search is told to the owner and the
 * forces looking for the pet, never to anyone else and never by an id.
 * What an ask does to a street is followed state by state in
 * __tests__/lib/searchBoardStates.test.js.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findFirst: jest.fn(), findUnique: jest.fn() },
    searchGrid: { findUnique: jest.fn(), update: jest.fn(async () => ({})), updateMany: jest.fn(async () => ({ count: 0 })), create: jest.fn() },
    searchStreet: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null), updateMany: jest.fn(async () => ({ count: 0 })) },
    gridCell: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null), updateMany: jest.fn(async () => ({ count: 0 })) },
    caseSighting: { findMany: jest.fn(async () => []) },
    notification: { create: jest.fn(async () => ({})) },
  },
}));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn(async () => null) }));
jest.mock('@/app/lib/searchAsk', () => ({
  __esModule: true,
  ...jest.requireActual('@/app/lib/searchAsk'),
  askStreet: jest.fn(),
  unaskPerson: jest.fn(async () => ({ count: 1 })),
  cannotWalk: jest.fn(),
  markAskSeen: jest.fn(async () => 1),
}));
jest.mock('@/app/lib/searchTeam', () => ({
  __esModule: true,
  ...jest.requireActual('@/app/lib/searchTeam'),
  teamOf: jest.fn(async () => []),
  personByHandle: jest.fn(async () => null),
}));
jest.mock('@/app/lib/push', () => ({ __esModule: true, isPushConfigured: jest.fn(() => true), sendPushToUser: jest.fn(async () => ({ sent: 1 })) }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => {}) }));
jest.mock('@/app/lib/sse/missionStream', () => ({ __esModule: true, broadcast: jest.fn() }));
jest.mock('@/app/lib/wake', () => ({ __esModule: true, wakeForces: jest.fn(async () => ({})), WAKE_KINDS: { BLOCK_FREE: 'FORCE_BLOCK_FREE' } }));
jest.mock('@/app/lib/forceFeed', () => ({ __esModule: true, forcesOf: jest.fn(async () => []) }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: jest.fn(async () => ({ success: true })),
  rateLimitResponse: jest.fn(),
  RateLimitPresets: { SEARCH_READ: {} },
}));
jest.mock('@/app/lib/osmStreets', () => ({ __esModule: true, fetchNamedWays: jest.fn(), STREET_FETCH_MARGIN_METERS: 400 }));

import prisma from '@/app/lib/prisma';
import { searcherFor } from '@/app/lib/searcher';
import { askStreet, unaskPerson, cannotWalk, markAskSeen } from '@/app/lib/searchAsk';
import { forDesk as realForDesk } from '@/app/lib/searchTeam';
import { teamOf, personByHandle, handleFor } from '@/app/lib/searchTeam';
import { sendPushToUser } from '@/app/lib/push';
import { broadcast } from '@/app/lib/sse/missionStream';
import { GET, PATCH } from '@/app/api/mission/[missionId]/board/route';

const CASE = 'case-max';
const PET = { id: CASE, caseNumber: 'AUS-2026-0001', status: 'ACTIVE', reportType: 'LOST', petName: 'Max', reporterId: 'u-avery', lastSeenLatitude: 30.3148, lastSeenLongitude: -97.7459 };
const OWNER = { id: 'u-avery', kind: 'user', userId: 'u-avery', firstName: 'Avery', isOwner: true, waiver: true, seesNames: true, leads: true };
// In a force looking for the pet, in any role: sees names, runs nothing.
const MEMBER = { id: 'u-sarah', kind: 'user', userId: 'u-sarah', firstName: 'Sarah', isOwner: false, waiver: true, seesNames: true, leads: false };
const STRANGER = { id: 'u-pat', kind: 'user', userId: 'u-pat', firstName: 'Pat', isOwner: false, waiver: true, seesNames: false, leads: false };
const DANA = { id: 'v:vol-1', kind: 'volunteer', userId: null, volunteerId: 'vol-1', firstName: 'Dana', isOwner: false, waiver: true, seesNames: false, leads: false };
const H_DANA = handleFor(CASE, 'v:vol-1');
const H_MIKE = handleFor(CASE, 'u-mike');
const row = (over = {}) => ({
  id: 'st-1', caseId: CASE, context: false, name: 'W 42nd St', fromName: 'Rosedale Ave', toName: 'Shoalwood Ave', path: '[[30.31,-97.74],[30.312,-97.74]]', meters: 300,
  centerLatitude: 30.311, centerLongitude: -97.74, priority: 9, status: 'UNSEARCHED', claimedById: null, claimedByName: null, claimedAt: null,
  searchedById: null, searchedByName: null, searchedAt: null, searchCount: 0,
  askedOfId: null, askedOfName: null, askedById: null, askedByName: null, askedAt: null, askedSeenAt: null, askedNote: null,
  ...over,
});
const asked = (over = {}) => row({ askedOfId: 'v:vol-1', askedOfName: 'Dana', askedById: 'u-avery', askedByName: 'Avery', askedAt: new Date(), askedNote: 'Check the alley.', ...over });

const req = (method, body, headers = {}) =>
  new NextRequest(`http://localhost/api/mission/${CASE}/board`, { method, headers: { 'content-type': 'application/json', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
const ctx = { params: { missionId: CASE } };
const patch = (body) => PATCH(req('PATCH', body), ctx);

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findFirst.mockResolvedValue(PET);
  prisma.case.findUnique.mockResolvedValue({ ...PET, searchRadius: 0.3, sightings: [] });
  prisma.searchGrid.findUnique.mockResolvedValue({ id: 'grid-1', caseId: CASE, streetsStatus: 'READY' });
  prisma.searchStreet.findFirst = jest.fn(async () => null);
  prisma.searchStreet.findMany.mockImplementation(async ({ where } = {}) => (where?.context === true ? [] : [asked(), row({ id: 'st-2', name: 'W 43rd St', priority: 8 })]));
  prisma.caseSighting.findMany.mockResolvedValue([]);
  searcherFor.mockResolvedValue(null);
  teamOf.mockResolvedValue([]);
  personByHandle.mockResolvedValue(null);
});

describe('asking a person', () => {
  test('whoever runs the search asks one person, by the handle the roster gave, with a note', async () => {
    searcherFor.mockResolvedValue(OWNER);
    personByHandle.mockResolvedValue({ id: 'v:vol-1', handle: H_DANA, name: 'Dana' });
    askStreet.mockResolvedValue({ street: asked(), title: 'W 42nd St from Rosedale Ave to Shoalwood Ave' });
    const res = await patch({ unit: 'street', id: 'st-1', action: 'ask', person: H_DANA, note: 'Check the alley.' });
    expect(res.status).toBe(200);
    expect(personByHandle).toHaveBeenCalledWith(CASE, H_DANA, { ownerId: 'u-avery' });
    expect(askStreet).toHaveBeenCalledWith({ caseId: CASE, streetId: 'st-1', person: expect.objectContaining({ id: 'v:vol-1', name: 'Dana' }), searcher: OWNER, note: 'Check the alley.' });
    const out = await res.json();
    // The owner is told whose it is by name and handle. No id of anyone is in the answer.
    expect(out.item).toMatchObject({ id: 'st-1', askedOfName: 'Dana', askedOfHandle: H_DANA, reserved: true });
    expect(JSON.stringify(out)).not.toMatch(/vol-1|u-avery/);
    // Every screen with the board open reads it again; the event says only that a street changed.
    expect(broadcast).toHaveBeenCalledWith(CASE, { type: 'STREET_UPDATED', unit: 'street' });
    // A helper with no account has no bell: the ask is on their search screen.
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  test('someone with an account also hears it in their bell and on their phone, from the owner by name', async () => {
    searcherFor.mockResolvedValue(OWNER);
    personByHandle.mockResolvedValue({ id: 'u-mike', handle: H_MIKE, name: 'Mike' });
    askStreet.mockResolvedValue({ street: asked({ askedOfId: 'u-mike', askedOfName: 'Mike' }), title: 'W 42nd St from Rosedale Ave to Shoalwood Ave' });
    expect((await patch({ unit: 'street', id: 'st-1', action: 'ask', person: H_MIKE })).status).toBe(200);
    expect(prisma.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'u-mike', type: 'SEARCH_ASK', title: 'Avery asked you to walk W 42nd St', actionUrl: '/mission-control?mission=AUS-2026-0001' });
    expect(sendPushToUser).toHaveBeenCalledWith(prisma, 'u-mike', expect.objectContaining({ title: 'Avery asked you to walk W 42nd St' }));
  });

  test.each([
    ['a member of a force that is looking, whatever their role', MEMBER],
    ['a signed-in stranger', STRANGER],
    ['a helper from the link', DANA],
  ])('%s cannot ask or take an ask back, and is not told whether the person is on the search', async (_who, searcher) => {
    searcherFor.mockResolvedValue(searcher);
    for (const body of [{ unit: 'street', id: 'st-1', action: 'ask', person: H_DANA }, { action: 'unask', person: H_DANA }, { unit: 'street', id: 'st-1', action: 'ask', person: 'no-such-handle' }]) {
      const res = await patch(body);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'Only the owner can do that.', code: 'NOT_ALLOWED' });
    }
    // Refused before anyone is looked for, so the answer is the same whether or not the handle is real.
    expect(personByHandle).not.toHaveBeenCalled();
    expect(askStreet).not.toHaveBeenCalled();
    expect(unaskPerson).not.toHaveBeenCalled();
  });

  test('nobody at all is asked to join first', async () => {
    expect((await patch({ unit: 'street', id: 'st-1', action: 'ask', person: H_DANA })).status).toBe(401);
    expect((await patch({ action: 'cannot' })).status).toBe(401);
  });

  test('a handle that is nobody on this search, a missing street, and a street that cannot be asked for are each said in words', async () => {
    searcherFor.mockResolvedValue(OWNER);
    const gone = await patch({ unit: 'street', id: 'st-1', action: 'ask', person: 'no-such-handle' });
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ error: 'That person is not on this search.', code: 'NO_PERSON' });

    personByHandle.mockResolvedValue({ id: 'v:vol-1', handle: H_DANA, name: 'Dana' });
    expect((await patch({ action: 'ask', person: H_DANA })).status).toBe(400);

    askStreet.mockResolvedValue({ error: 'NOT_OPEN', title: 'W 42nd St from Rosedale Ave to Shoalwood Ave' });
    const busy = await patch({ unit: 'street', id: 'st-1', action: 'ask', person: H_DANA });
    expect(busy.status).toBe(409);
    expect(await busy.json()).toEqual({ error: 'W 42nd St from Rosedale Ave to Shoalwood Ave has someone on it or has been walked. Pick one that is still to walk.', code: 'NOT_OPEN' });

    askStreet.mockResolvedValue({ error: 'ASKED_ALREADY', title: 'W 42nd St from Rosedale Ave to Shoalwood Ave' });
    expect(await (await patch({ unit: 'street', id: 'st-1', action: 'ask', person: H_DANA })).json()).toMatchObject({ code: 'ASKED_ALREADY', error: 'Someone else was just asked to walk W 42nd St from Rosedale Ave to Shoalwood Ave.' });

    askStreet.mockResolvedValue({ error: 'NOT_FOUND', title: null });
    expect((await patch({ unit: 'street', id: 'st-9', action: 'ask', person: H_DANA })).status).toBe(404);
  });

  test('taking it back is the same person\'s to do', async () => {
    searcherFor.mockResolvedValue(OWNER);
    personByHandle.mockResolvedValue({ id: 'v:vol-1', handle: H_DANA, name: 'Dana' });
    const res = await patch({ action: 'unask', person: H_DANA });
    expect(res.status).toBe(200);
    expect(unaskPerson).toHaveBeenCalledWith({ caseId: CASE, person: expect.objectContaining({ id: 'v:vol-1' }), searcher: OWNER });
    expect(broadcast).toHaveBeenCalledWith(CASE, { type: 'STREET_UPDATED', unit: 'street' });
  });

  test('a search that has ended is not asked of anyone', async () => {
    searcherFor.mockResolvedValue(OWNER);
    prisma.case.findFirst.mockResolvedValue({ ...PET, status: 'REUNITED' });
    for (const body of [{ unit: 'street', id: 'st-1', action: 'ask', person: H_DANA }, { action: 'unask', person: H_DANA }, { action: 'cannot' }]) {
      const res = await patch(body);
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ code: 'CLOSED' });
    }
    expect(askStreet).not.toHaveBeenCalled();
    expect(cannotWalk).not.toHaveBeenCalled();
  });
});

describe('"I can\'t right now"', () => {
  test('is the asked person\'s own: it needs no waiver and no role, only that something was asked of them', async () => {
    searcherFor.mockResolvedValue({ ...DANA, waiver: false });
    cannotWalk.mockResolvedValue({ title: 'W 42nd St from Rosedale Ave to Shoalwood Ave' });
    const res = await patch({ action: 'cannot' });
    expect(res.status).toBe(200);
    expect(cannotWalk).toHaveBeenCalledWith({ caseId: CASE, searcher: expect.objectContaining({ id: 'v:vol-1' }) });
    expect(broadcast).toHaveBeenCalledWith(CASE, { type: 'STREET_UPDATED', unit: 'street' });
  });

  test('someone who was asked nothing has nothing to turn down, and can turn down nobody else\'s', async () => {
    searcherFor.mockResolvedValue(STRANGER);
    cannotWalk.mockResolvedValue({ error: 'NO_ASK' });
    const res = await patch({ action: 'cannot' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Nothing was asked of you.', code: 'NO_ASK' });
    // It acts on the caller's own ask only: there is no id or handle in the request to point it at someone else.
    expect(cannotWalk).toHaveBeenCalledWith({ caseId: CASE, searcher: STRANGER });
  });
});

describe('the roster, and what a street says about its ask', () => {
  const team = [{ id: 'v:vol-1', handle: H_DANA, name: 'Dana', kind: 'helper', joinedAt: new Date(), state: 'asked', on: null, since: null, asked: { id: 'st-1', title: 'W 42nd St from Rosedale Ave to Shoalwood Ave', at: new Date(), seenAt: null, note: 'Check the alley.', byName: 'Avery', holds: true }, walked: 0, lastWalkedAt: null, lastOn: null }];

  test('the owner and a force looking for the pet are sent who is on the search, by handle and never by id', async () => {
    teamOf.mockResolvedValue(team);
    for (const searcher of [OWNER, MEMBER]) {
      searcherFor.mockResolvedValue(searcher);
      const out = await (await GET(req('GET'), ctx)).json();
      expect(out.people).toHaveLength(1);
      expect(out.people[0]).toMatchObject({ handle: H_DANA, name: 'Dana', state: 'asked' });
      expect(out.people[0]).not.toHaveProperty('id');
      expect(JSON.stringify(out)).not.toContain('vol-1');
      // And each street says whose it is kept for.
      expect(out.streets.find((s) => s.id === 'st-1')).toMatchObject({ reserved: true, askedOfName: 'Dana', askedOfHandle: H_DANA });
    }
    expect(teamOf).toHaveBeenCalledWith(CASE, { ownerId: 'u-avery' });
  });

  test('the note on an ask is the owner\'s word to one person: it goes to the owner, and to no force member', async () => {
    teamOf.mockResolvedValue(team);
    searcherFor.mockResolvedValue(OWNER);
    const forOwner = await (await GET(req('GET'), ctx)).json();
    expect(forOwner.people[0].asked).toMatchObject({ note: 'Check the alley.', byName: 'Avery' });
    // In a force, whatever the role: that Dana was asked, for which street and when, and not what was said.
    searcherFor.mockResolvedValue(MEMBER);
    const forMember = await (await GET(req('GET'), ctx)).json();
    expect(forMember.people[0].asked).toMatchObject({ title: 'W 42nd St from Rosedale Ave to Shoalwood Ave', seenAt: null });
    expect(forMember.people[0].asked).not.toHaveProperty('note');
    expect(forMember.people[0].asked).not.toHaveProperty('byName');
    expect(JSON.stringify(forMember)).not.toMatch(/alley/);
    expect(realForDesk).toBeDefined();
  });

  test('nobody else is: someone only looking, a signed-in stranger, another helper', async () => {
    teamOf.mockResolvedValue(team);
    for (const searcher of [null, STRANGER, { ...DANA, id: 'v:vol-2', volunteerId: 'vol-2', firstName: 'Jo' }]) {
      searcherFor.mockResolvedValue(searcher);
      const out = await (await GET(req('GET'), ctx)).json();
      expect(out).not.toHaveProperty('people');
      const street = out.streets.find((s) => s.id === 'st-1');
      // Only that it is kept, so their own ask for a street passes over it.
      expect(street.reserved).toBe(true);
      expect(street).not.toHaveProperty('askedOfName');
      expect(street).not.toHaveProperty('askedOfHandle');
      expect(street).not.toHaveProperty('askedNote');
      expect(JSON.stringify(out)).not.toMatch(/Dana|alley|vol-1/);
    }
    expect(teamOf).not.toHaveBeenCalled();
    // Reading the board marks nothing seen for someone who was asked nothing.
    expect(markAskSeen).not.toHaveBeenCalled();
  });

  test('the person asked reads that it is theirs, with the owner\'s note and name; reading it marks nothing as seen', async () => {
    searcherFor.mockResolvedValue(DANA);
    const out = await (await GET(req('GET'), ctx)).json();
    const street = out.streets.find((s) => s.id === 'st-1');
    // `askedSeen` false: their screen has not yet said it showed the card.
    expect(street).toMatchObject({ askedOfMe: true, askedNote: 'Check the alley.', askedBy: 'Avery', askedSeen: false, reserved: false });
    // A phone that fetched the board has not shown the ask, and a computer never shows it: "seen" is said by the
    // screen that showed it (PATCH .../message), not by this read.
    expect(markAskSeen).not.toHaveBeenCalled();
    expect(out).not.toHaveProperty('people');
  });

  test('a request that is not what it should be is refused in words, and nothing is read as an id', async () => {
    searcherFor.mockResolvedValue(OWNER);
    personByHandle.mockResolvedValue({ id: 'v:vol-1', handle: H_DANA, name: 'Dana' });
    const send = (raw) => PATCH(new NextRequest(`http://localhost/api/mission/${CASE}/board`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: raw }), ctx);
    // No body, a bare null, a list, text that is not JSON.
    for (const raw of ['null', '[]', '"ask"', 'not json', '7']) expect((await send(raw)).status).toBe(400);
    // An id or a handle that is an object, a list or a number is not text.
    for (const body of [{ unit: 'street', id: { toString: 1 }, action: 'claim' }, { unit: 'street', id: ['st-1'], action: 'first' }, { unit: 'street', id: 7, action: 'walked' }]) {
      expect((await patch(body)).status).toBe(400);
    }
    for (const person of [{ toString: 1 }, ['x'], 7, null, '']) {
      const res = await patch({ unit: 'street', id: 'st-1', action: 'ask', person });
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ code: 'NO_PERSON' });
    }
    expect((await patch({ unit: 'street', id: { toString: 1 }, action: 'ask', person: H_DANA })).status).toBe(400);
    // A note that is not text is no note.
    askStreet.mockResolvedValue({ street: asked(), title: 'W 42nd St from Rosedale Ave to Shoalwood Ave' });
    await patch({ unit: 'street', id: 'st-1', action: 'ask', person: H_DANA, note: { toString: 1 } });
    expect(askStreet.mock.calls.at(-1)[0].note).toBe('');
  });
});

describe('a street kept for someone else, to a helper who asks for it', () => {
  test('reads as taken, so their screen goes on to the next one', async () => {
    // The real board code, with the street kept for Dana and Jo asking for it.
    searcherFor.mockResolvedValue({ ...DANA, id: 'v:vol-2', volunteerId: 'vol-2', firstName: 'Jo' });
    prisma.searchStreet.findFirst = jest.fn(async () => asked());
    const res = await patch({ unit: 'street', id: 'st-1', action: 'claim' });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'W 42nd St from Rosedale Ave to Shoalwood Ave is being kept for someone who was asked to walk it. Pick another.', code: 'TAKEN', kept: true });
    // Nothing of theirs was given up for a street they could not have.
    expect(prisma.searchStreet.updateMany).not.toHaveBeenCalled();
  });
});
