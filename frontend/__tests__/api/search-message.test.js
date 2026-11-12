/**
 * POST /api/mission/[missionId]/message: a word between people on one
 * pet's search.
 *
 * With `to`, it is the owner's or a lead's word to a named helper.
 * Without, it is a helper's word back to the people running the search,
 * and it takes someone who is on the search. Who may write to whom is the
 * whole of this route, so each kind of person is tried.
 */

jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: { case: { findFirst: jest.fn() } } }));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn(async () => null) }));
jest.mock('@/app/lib/searchTeam', () => ({ __esModule: true, personByHandle: jest.fn(async () => null), teamOf: jest.fn(async () => []) }));
jest.mock('@/app/lib/searchTalk', () => {
  class WordError extends Error {
    constructor(message, status, code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return { __esModule: true, WordError, sendWord: jest.fn(async ({ text }) => ({ id: 'msg-1', createdAt: new Date('2026-11-12T22:00:00Z'), text: String(text).trim() })), markWordsSeen: jest.fn(async () => 1) };
});
jest.mock('@/app/lib/searchZones', () => ({ __esModule: true, markZoneAskSeen: jest.fn(async () => 1) }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => {}) }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: jest.fn(async () => ({ success: true })),
  rateLimitResponse: jest.fn(() => new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })),
}));

import { NextRequest } from 'next/server';
import prisma from '@/app/lib/prisma';
import { searcherFor } from '@/app/lib/searcher';
import { personByHandle, teamOf } from '@/app/lib/searchTeam';
import { sendWord, markWordsSeen, WordError } from '@/app/lib/searchTalk';
import { markZoneAskSeen as markAskSeen } from '@/app/lib/searchZones';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import { POST, PATCH } from '@/app/api/mission/[missionId]/message/route';

const PET = { id: 'case-max', caseNumber: 'AUS-2026-0001', status: 'ACTIVE', petName: 'Max', reporterId: 'u-avery' };
const OWNER = { id: 'u-avery', kind: 'user', userId: 'u-avery', firstName: 'Avery', isOwner: true, seesNames: true, leads: true };
const LEAD = { id: 'u-sarah', kind: 'user', userId: 'u-sarah', firstName: 'Sarah', isOwner: false, seesNames: true, leads: true };
const MEMBER = { id: 'u-mike', kind: 'user', userId: 'u-mike', firstName: 'Mike', isOwner: false, seesNames: true, leads: false };
const HELPER = { id: 'v:vol-1', kind: 'volunteer', userId: null, firstName: 'Dana', isOwner: false, seesNames: false, leads: false };
const STRANGER = { id: 'u-pat', kind: 'user', userId: 'u-pat', firstName: 'Pat', isOwner: false, seesNames: false, leads: false };
const DANA = { id: 'v:vol-1', handle: 'h-dana', name: 'Dana' };

const raw = (method, text) => new NextRequest('http://localhost/api/mission/AUS-2026-0001/message', { method, headers: { 'content-type': 'application/json' }, body: text });
const shown = (body) => PATCH(raw('PATCH', JSON.stringify(body)), { params: { missionId: 'AUS-2026-0001' } });
const post = (body) => POST(new NextRequest('http://localhost/api/mission/AUS-2026-0001/message', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: { missionId: 'AUS-2026-0001' } });

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findFirst.mockResolvedValue(PET);
  searcherFor.mockResolvedValue(null);
  personByHandle.mockResolvedValue(null);
  teamOf.mockResolvedValue([]);
  withRateLimitAsync.mockResolvedValue({ success: true });
});

describe('from the desk, to a named helper', () => {
  test.each([['the owner', OWNER], ['someone leading a force', LEAD]])('%s writes to a helper', async (_, searcher) => {
    searcherFor.mockResolvedValue(searcher);
    personByHandle.mockResolvedValue(DANA);
    const res = await post({ to: 'h-dana', text: 'Check the alley.' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ message: { id: 'msg-1', at: '2026-11-12T22:00:00.000Z', text: 'Check the alley.' } });
    // The person is found by handle on this pet, with the owner known so they are never one of the helpers.
    expect(personByHandle).toHaveBeenCalledWith('case-max', 'h-dana', { ownerId: 'u-avery' });
    expect(sendWord).toHaveBeenCalledWith({ caseId: 'case-max', pet: PET, searcher, to: { id: 'v:vol-1', name: 'Dana' }, text: 'Check the alley.' });
  });

  test.each([['a member of the force', MEMBER], ['a helper', HELPER], ['a signed-in stranger', STRANGER]])('%s cannot, and is not told who is on the search', async (_, searcher) => {
    searcherFor.mockResolvedValue(searcher);
    personByHandle.mockResolvedValue(DANA);
    const res = await post({ to: 'h-dana', text: 'hello' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Only the owner can write to a helper.', code: 'NOT_ALLOWED' });
    // Refused before the handle is looked up.
    expect(personByHandle).not.toHaveBeenCalled();
    expect(sendWord).not.toHaveBeenCalled();
  });

  test('a handle that is nobody on this search is 404', async () => {
    searcherFor.mockResolvedValue(OWNER);
    const res = await post({ to: 'h-nobody', text: 'hello' });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: 'NO_PERSON' });
    expect(sendWord).not.toHaveBeenCalled();
  });
});

describe('from a helper, to the people running the search', () => {
  test('a helper who joined writes back', async () => {
    searcherFor.mockResolvedValue(HELPER);
    teamOf.mockResolvedValue([{ id: 'v:vol-1', name: 'Dana' }]);
    const res = await post({ text: 'Gate open behind the school.' });
    expect(res.status).toBe(201);
    expect(sendWord).toHaveBeenCalledWith({ caseId: 'case-max', pet: PET, searcher: HELPER, to: null, text: 'Gate open behind the school.' });
  });

  test('a member of a force looking for the pet can, without having taken a street', async () => {
    searcherFor.mockResolvedValue(MEMBER);
    const res = await post({ text: 'I can drive the perimeter at 6.' });
    expect(res.status).toBe(201);
    expect(teamOf).not.toHaveBeenCalled();
  });

  test('someone signed in who is not on the search cannot: they call the owner', async () => {
    searcherFor.mockResolvedValue(STRANGER);
    teamOf.mockResolvedValue([{ id: 'v:vol-1', name: 'Dana' }]);
    const res = await post({ text: 'hello' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Take an area first, or call the owner.', code: 'NOT_ON_SEARCH' });
    expect(sendWord).not.toHaveBeenCalled();
  });

  test('nobody at all is asked to join', async () => {
    const res = await post({ text: 'hello' });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'NOT_JOINED' });
  });
});

describe('the rest', () => {
  test('what the library refuses is said in its words', async () => {
    searcherFor.mockResolvedValue(HELPER);
    teamOf.mockResolvedValue([{ id: 'v:vol-1' }]);
    sendWord.mockRejectedValueOnce(new WordError('Write something first.', 400, 'EMPTY'));
    const res = await post({ text: '  ' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Write something first.', code: 'EMPTY' });
  });

  test('no pet for the link, a search that has ended, and a flood', async () => {
    prisma.case.findFirst.mockResolvedValueOnce(null);
    expect((await post({ text: 'x' })).status).toBe(404);
    searcherFor.mockResolvedValue(OWNER);
    prisma.case.findFirst.mockResolvedValueOnce({ ...PET, status: 'REUNITED' });
    const closed = await post({ to: 'h-dana', text: 'x' });
    expect(closed.status).toBe(409);
    expect(await closed.json()).toMatchObject({ code: 'CLOSED' });
    withRateLimitAsync.mockResolvedValueOnce({ success: false });
    expect((await post({ text: 'x' })).status).toBe(429);
    expect(sendWord).not.toHaveBeenCalled();
  });

  test('an error nobody planned for is words, not a stack', async () => {
    searcherFor.mockResolvedValue(HELPER);
    teamOf.mockResolvedValue([{ id: 'v:vol-1' }]);
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
    sendWord.mockRejectedValueOnce(new Error('database is down'));
    const res = await post({ text: 'hello' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'That did not go through. Try again in a moment.' });
    quiet.mockRestore();
  });
});

describe('a found pet has no search, so it has none of this', () => {
  test('nobody can be written to through a report of a found pet, by anyone', async () => {
    prisma.case.findFirst.mockResolvedValue({ ...PET, reportType: 'FOUND' });
    for (const searcher of [HELPER, MEMBER, STRANGER, OWNER]) {
      searcherFor.mockResolvedValue(searcher);
      const res = await post({ text: 'Is this your cat?' });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'This link does not match a search.' });
      expect((await shown({ words: ['m1'], ask: true })).status).toBe(404);
    }
    expect(sendWord).not.toHaveBeenCalled();
    expect(markWordsSeen).not.toHaveBeenCalled();
  });
});

describe('a request that is not what it should be', () => {
  test('words are text: nothing else is read as text, and nothing is sent', async () => {
    searcherFor.mockResolvedValue(HELPER);
    teamOf.mockResolvedValue([{ id: 'v:vol-1' }]);
    for (const text of [{ toString: 1 }, ['a'], 7, null, undefined, true]) {
      const res = await post({ text });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: 'EMPTY' });
    }
    for (const body of ['null', '[]', '"hello"', 'not json']) expect((await POST(raw('POST', body), { params: { missionId: 'AUS-2026-0001' } })).status).toBe(400);
    expect(sendWord).not.toHaveBeenCalled();
  });

  test('a `to` that is not a handle is nobody, for the owner too', async () => {
    searcherFor.mockResolvedValue(OWNER);
    for (const to of [{ toString: 1 }, ['h-dana'], 7]) {
      const res = await post({ text: 'Hello', to });
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ code: 'NO_PERSON' });
    }
    expect(personByHandle).not.toHaveBeenCalled();
    expect(sendWord).not.toHaveBeenCalled();
  });
});

describe('PATCH: this person\'s screen has shown a word, or the street they were asked to walk', () => {
  test('it marks only what is theirs: the caller\'s own id is the only one used, whatever the request holds', async () => {
    searcherFor.mockResolvedValue(HELPER);
    const res = await shown({ words: ['m3', 'm9'], ask: true, toId: 'v:vol-2', searcherId: 'u-avery', person: 'h-jo' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ seen: { words: 1, ask: 1 } });
    // The library is given the caller, and marks a word only where it was written to them.
    expect(markWordsSeen).toHaveBeenCalledWith('case-max', 'v:vol-1', ['m3', 'm9']);
    expect(markAskSeen).toHaveBeenCalledWith('case-max', 'v:vol-1');
  });

  test('a word shown does not mark an ask seen, and the other way round', async () => {
    searcherFor.mockResolvedValue(HELPER);
    await shown({ words: ['m3'] });
    expect(markAskSeen).not.toHaveBeenCalled();
    // `ask` has to be exactly true: a string, a number or an object is not it.
    for (const ask of ['true', 1, {}, []]) await shown({ ask });
    expect(markAskSeen).not.toHaveBeenCalled();
    await shown({ ask: true });
    expect(markAskSeen).toHaveBeenCalledTimes(1);
  });

  test('someone only looking has nothing to mark, and a body that is not an object marks nothing', async () => {
    expect((await shown({ words: ['m3'], ask: true })).status).toBe(401);
    expect(markWordsSeen).not.toHaveBeenCalled();
    searcherFor.mockResolvedValue(HELPER);
    for (const body of ['null', '[]', '7', 'not json']) {
      const res = await PATCH(raw('PATCH', body), { params: { missionId: 'AUS-2026-0001' } });
      expect(res.status).toBe(200);
      expect(markWordsSeen).toHaveBeenLastCalledWith('case-max', 'v:vol-1', undefined);
    }
    expect(markAskSeen).not.toHaveBeenCalled();
  });

  test('it is limited, and a link that matches no pet is 404', async () => {
    withRateLimitAsync.mockResolvedValue({ success: false });
    expect((await shown({ words: ['m3'] })).status).toBe(429);
    withRateLimitAsync.mockResolvedValue({ success: true });
    prisma.case.findFirst.mockResolvedValue(null);
    expect((await shown({ words: ['m3'] })).status).toBe(404);
  });
});
