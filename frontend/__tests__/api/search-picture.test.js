/**
 * The picture of a pet's search (app/lib/searchPicture.js, GET
 * /api/mission/[missionId]/picture) and the owner's answer to a sighting
 * (POST /api/mission/[missionId]/answer).
 *
 * The picture is open to anyone holding the pet's link, so what it must
 * never carry matters as much as what it carries: no helper's name, no
 * reporter's name, no house number. The answer is the one place a helper
 * can be asked to stay back, and only the owner or the people running the
 * search can send it (founder rule, 2026-11-11: the product never tells a
 * helper to stop on its own).
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findFirst: jest.fn() },
    caseSighting: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    searchStreet: { findMany: jest.fn(async () => []) },
    searchGrid: { findUnique: jest.fn(async () => null) },
    alert: { count: jest.fn(async () => 0) },
  },
}));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn(async () => null) }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => {}) }));
jest.mock('@/app/lib/sse/missionStream', () => ({ __esModule: true, broadcast: jest.fn() }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: jest.fn(async () => ({ success: true })),
  rateLimitResponse: jest.fn(() => new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 })),
  RateLimitPresets: { PUBLIC_READ: {}, API: {} },
}));

import prisma from '@/app/lib/prisma';
import { searcherFor } from '@/app/lib/searcher';
import { broadcast } from '@/app/lib/sse/missionStream';
import { logEvent } from '@/lib/logging';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import { searchPicture, holdAskText, HOT_SIGHTING_MS } from '@/app/lib/searchPicture';
import { GET } from '@/app/api/mission/[missionId]/picture/route';
import { POST } from '@/app/api/mission/[missionId]/answer/route';

const NOW = new Date('2026-11-03T18:00:00Z').getTime();
const ago = (minutes) => new Date(NOW - minutes * 60000);

const sighting = (over = {}) => ({
  id: 'sight-1',
  sightedAt: ago(4),
  latitude: 30.3105,
  longitude: -97.747,
  address: 'Ramsey Ave and W 40th St',
  description: 'Blue collar, heading for the creek.',
  certaintyLevel: 'PROBABLE',
  reporterName: 'Dana Whitfield',
  reportedBy: null,
  direction: 'SOUTHEAST',
  towardName: 'Rosedale Ave',
  witnessState: 'WATCHING',
  witnessStateAt: ago(3),
  ownerSeenAt: null,
  ownerGoingAt: null,
  ownerEtaMinutes: null,
  holdAskedAt: null,
  holdEndedAt: null,
  ...over,
});

const pet = (over = {}) => ({
  id: 'case-max',
  caseNumber: 'AUS-2026-0001',
  status: 'ACTIVE',
  reportType: 'LOST',
  resolvedAt: null,
  petName: 'Max',
  petSpecies: 'DOG',
  petBreed: 'Labrador mix',
  petColor: 'Yellow',
  petPhotoUrl: '/seed/max.svg',
  petDescription: 'Blue collar.',
  details: null,
  escapeScenario: 'door_dashed',
  lastSeenLatitude: 30.3148,
  lastSeenLongitude: -97.7459,
  lastSeenAddress: '4407 Sinclair Ave, Austin, TX 78756',
  lastSeenAt: ago(190),
  reporterId: 'user-avery',
  ownerName: 'Avery Lindqvist',
  ownerPhone: '(512) 555-0100',
  sightings: [sighting()],
  ...over,
});

const OWNER = { id: 'user-avery', kind: 'user', userId: 'user-avery', volunteerId: null, firstName: 'Avery', isOwner: true, waiver: true, seesNames: true };
const LEAD = { id: 'user-sarah', kind: 'user', userId: 'user-sarah', volunteerId: null, firstName: 'Sarah', isOwner: false, waiver: true, seesNames: true };
const HELPER = { id: 'v:vol-1', kind: 'volunteer', userId: null, volunteerId: 'vol-1', firstName: 'Jo', isOwner: false, waiver: true, seesNames: false };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findFirst.mockResolvedValue(pet());
  prisma.searchStreet.findMany.mockResolvedValue([]);
  prisma.searchGrid.findUnique.mockResolvedValue(null);
  prisma.alert.count.mockResolvedValue(0);
  searcherFor.mockResolvedValue(null);
  withRateLimitAsync.mockResolvedValue({ success: true });
});

describe('searchPicture: what anyone with the link sees', () => {
  test('the pet, where it was lost by street, the owner to call, and each sighting by place', async () => {
    const out = await searchPicture('AUS-2026-0001', { now: NOW });
    expect(out).toMatchObject({
      id: 'case-max',
      caseNumber: 'AUS-2026-0001',
      open: true,
      reunited: false,
      timeZone: 'America/Chicago',
      pet: { name: 'Max', species: 'DOG', breed: 'Labrador mix', howOut: 'door_dashed' },
      owner: { firstName: 'Avery', phone: '(512) 555-0100' },
      viewer: null,
      neighbors: null,
      searched: null,
      ask: null,
    });
    // The street, never the house number.
    expect(out.lastSeen.place).toBe('Sinclair Ave');
    expect(JSON.stringify(out)).not.toContain('4407');
    expect(out.sightings[0]).toMatchObject({ id: 'sight-1', place: 'Ramsey Ave and W 40th St', direction: 'SOUTHEAST', toward: 'Rosedale Ave', state: 'WATCHING', hold: false });
  });

  test('it never carries who reported a sighting, or what they wrote, to someone only looking', async () => {
    const out = await searchPicture('case-max', { now: NOW });
    expect(out.sightings[0]).not.toHaveProperty('by');
    expect(out.sightings[0]).not.toHaveProperty('note');
    const text = JSON.stringify(out);
    expect(text).not.toContain('Dana');
    expect(text).not.toContain('heading for the creek');
    // Nor to a helper who joined from the link.
    const helper = await searchPicture('case-max', { searcher: HELPER, now: NOW });
    expect(JSON.stringify(helper)).not.toContain('Dana');
    expect(helper.viewer).toEqual({ kind: 'volunteer', firstName: 'Jo', isOwner: false, seesNames: false, waiver: true, signedIn: false });
    expect(helper.neighbors).toBeNull();
  });

  test('the owner sees who reported it, what they wrote, and how many neighbors were alerted', async () => {
    prisma.alert.count.mockResolvedValueOnce(41).mockResolvedValueOnce(6);
    const out = await searchPicture('case-max', { searcher: OWNER, now: NOW });
    expect(out.sightings[0]).toMatchObject({ by: 'Dana Whitfield', note: 'Blue collar, heading for the creek.' });
    expect(out.neighbors).toEqual({ told: 41, answered: 6 });
    expect(out.viewer).toMatchObject({ isOwner: true, seesNames: true, signedIn: true });
  });

  test('the people running the search see names, and the neighbor counts stay with the owner', async () => {
    const out = await searchPicture('case-max', { searcher: LEAD, now: NOW });
    expect(out.sightings[0].by).toBe('Dana Whitfield');
    expect(out.neighbors).toBeNull();
    expect(prisma.alert.count).not.toHaveBeenCalled();
  });

  test('a sighting marked on the map with no street has no place, and a deleted account is not named', async () => {
    prisma.case.findFirst.mockResolvedValue(pet({ sightings: [sighting({ address: 'Marked on the map', reporterName: null, reportedBy: { firstName: 'Deleted' } })] }));
    const out = await searchPicture('case-max', { searcher: OWNER, now: NOW });
    expect(out.sightings[0].place).toBeNull();
    expect(out.sightings[0].by).toBeNull();
  });

  test('a number that is not a phone number is not offered to call', async () => {
    prisma.case.findFirst.mockResolvedValue(pet({ ownerPhone: 'ask me' }));
    expect((await searchPicture('case-max', { now: NOW })).owner.phone).toBeNull();
  });

  test('no pet for that link', async () => {
    prisma.case.findFirst.mockResolvedValue(null);
    expect(await searchPicture('nope', { now: NOW })).toBeNull();
  });
});

describe('searchPicture: the ask to stay back is the owner\'s, and only while it stands', () => {
  const held = (over = {}) => pet({ sightings: [sighting({ holdAskedAt: ago(2), ...over })] });

  test('the words that go out, in the owner\'s name', async () => {
    expect(holdAskText('Max')).toBe('Please stay back while I go to Max.');
    expect(holdAskText('')).toBe('Please stay back while I go to the pet.');
    prisma.case.findFirst.mockResolvedValue(held());
    const out = await searchPicture('case-max', { searcher: HELPER, now: NOW });
    expect(out.ask).toEqual({ sightingId: 'sight-1', from: 'Avery', text: 'Please stay back while I go to Max.' });
    expect(out.sightings[0].hold).toBe(true);
  });

  test('an ask sent by someone running the search goes out under their own name, not the owner\'s', async () => {
    prisma.case.findFirst.mockResolvedValue(held({ holdAskedByName: 'Sarah' }));
    const out = await searchPicture('case-max', { searcher: HELPER, now: NOW });
    expect(out.ask).toEqual({ sightingId: 'sight-1', from: 'Sarah', text: 'Please stay back while I go to Max.' });
  });

  test('with no ask from the owner there is none: a fresh sighting alone never holds anyone back', async () => {
    const out = await searchPicture('case-max', { searcher: HELPER, now: NOW });
    expect(out.ask).toBeNull();
  });

  test('it ends when the owner ends it, when the sighting is an hour old, and when the search closes', async () => {
    prisma.case.findFirst.mockResolvedValue(held({ holdEndedAt: ago(1) }));
    expect((await searchPicture('case-max', { now: NOW })).ask).toBeNull();

    prisma.case.findFirst.mockResolvedValue(held({ sightedAt: new Date(NOW - HOT_SIGHTING_MS - 1000) }));
    expect((await searchPicture('case-max', { now: NOW })).ask).toBeNull();

    prisma.case.findFirst.mockResolvedValue({ ...held(), status: 'REUNITED' });
    expect((await searchPicture('case-max', { now: NOW })).ask).toBeNull();
  });

  test('a sighting the witness took back is passed over for the one before it', async () => {
    prisma.case.findFirst.mockResolvedValue(
      pet({
        sightings: [
          sighting({ id: 'sight-2', witnessState: 'NOT_THE_PET', holdAskedAt: ago(1) }),
          sighting({ id: 'sight-1', sightedAt: ago(20), holdAskedAt: ago(10) }),
        ],
      })
    );
    const out = await searchPicture('case-max', { now: NOW });
    expect(out.ask.sightingId).toBe('sight-1');
  });
});

describe('searchPicture: how many people are out', () => {
  test('everyone on a street now or done within two hours, once each, and not the owner', async () => {
    prisma.searchStreet.findMany.mockResolvedValue([
      { status: 'IN_PROGRESS', claimedById: 'v:vol-1', searchedById: null },
      { status: 'SEARCHED', claimedById: null, searchedById: 'v:vol-1' },
      { status: 'SEARCHED', claimedById: null, searchedById: 'user-sarah' },
      { status: 'IN_PROGRESS', claimedById: 'user-avery', searchedById: null },
    ]);
    prisma.searchGrid.findUnique.mockResolvedValue({
      cells: [
        { status: 'IN_PROGRESS', claimedById: 'user-mike', searchedById: null, searchedByKey: null },
        // A helper with no account who finished a square: an account id cannot name them, the board's key does.
        { status: 'SEARCHED', claimedById: null, searchedById: null, searchedByKey: 'v:vol-2' },
        // The same person twice is one person.
        { status: 'SEARCHED', claimedById: null, searchedById: 'user-mike', searchedByKey: 'user-mike' },
      ],
    });
    const out = await searchPicture('case-max', { now: NOW });
    expect(out.looking).toEqual({ helpers: 4 });
    // The window is the last two hours.
    const where = prisma.searchStreet.findMany.mock.calls[0][0].where;
    expect(where.OR[1].searchedAt.gte).toEqual(new Date(NOW - 2 * 60 * 60 * 1000));
    // Numbers only: nobody's id or name leaves with it.
    expect(JSON.stringify(out)).not.toContain('vol-1');
    expect(JSON.stringify(out)).not.toContain('user-sarah');
  });

  test('a found pet has no search to count', async () => {
    prisma.case.findFirst.mockResolvedValue(pet({ reportType: 'FOUND' }));
    const out = await searchPicture('case-max', { now: NOW });
    expect(out.looking).toEqual({ helpers: 0 });
    expect(prisma.searchStreet.findMany).not.toHaveBeenCalled();
  });
});

describe('searchPicture: after the pet is home', () => {
  test('the ground that was covered, and whether some of it was this person\'s', async () => {
    prisma.case.findFirst.mockResolvedValue(pet({ status: 'REUNITED', resolvedAt: ago(1) }));
    const done = [{ searchedById: 'v:vol-1' }, { searchedById: 'v:vol-1' }, { searchedById: 'user-sarah' }, { searchedById: null }];
    prisma.searchStreet.findMany.mockImplementation(async ({ where }) => (where.searchCount ? done : []));
    const mine = await searchPicture('case-max', { searcher: HELPER, now: NOW });
    expect(mine).toMatchObject({ open: false, reunited: true, searched: { streets: 4, blocks: 0, people: 2, mine: true } });
    const stranger = await searchPicture('case-max', { now: NOW });
    expect(stranger.searched).toEqual({ streets: 4, blocks: 0, people: 2, mine: false });
  });

  test('where the board was squares, the squares are the ground, and a helper with no account is still one of the people', async () => {
    prisma.case.findFirst.mockResolvedValue(pet({ status: 'REUNITED', resolvedAt: ago(1) }));
    prisma.searchGrid.findUnique.mockResolvedValue({ cells: [{ searchedById: null, searchedByKey: 'v:vol-1' }, { searchedById: 'user-sarah', searchedByKey: 'user-sarah' }, { searchedById: 'user-old', searchedByKey: null }] });
    const out = await searchPicture('case-max', { searcher: HELPER, now: NOW });
    expect(out.searched).toEqual({ streets: 0, blocks: 3, people: 3, mine: true });
  });
});

describe('GET /api/mission/[missionId]/picture', () => {
  const call = () => GET(new Request('http://localhost/api/mission/AUS-2026-0001/picture'), { params: { missionId: 'AUS-2026-0001' } });

  test('200 with the picture, as this person may see it', async () => {
    searcherFor.mockResolvedValue(HELPER);
    const res = await call();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pet.name).toBe('Max');
    expect(body.viewer.kind).toBe('volunteer');
    expect(searcherFor).toHaveBeenCalledWith(expect.anything(), 'case-max');
  });

  test('404 in words when the link matches no pet, 429 when hammered', async () => {
    prisma.case.findFirst.mockResolvedValue(null);
    const gone = await call();
    expect(gone.status).toBe(404);
    expect((await gone.json()).error).toBe('This link does not match a pet.');
    withRateLimitAsync.mockResolvedValueOnce({ success: false });
    expect((await call()).status).toBe(429);
  });
});

describe('POST /api/mission/[missionId]/answer', () => {
  const call = (body) =>
    POST(new Request('http://localhost/api/mission/case-max/answer', { method: 'POST', body: JSON.stringify(body) }), { params: { missionId: 'case-max' } });
  const ROW = { id: 'sight-1', ownerSeenAt: null, ownerGoingAt: null, ownerEtaMinutes: null, holdAskedAt: null, holdEndedAt: null };

  beforeEach(() => {
    prisma.case.findFirst.mockResolvedValue({ id: 'case-max' });
    prisma.caseSighting.findFirst.mockResolvedValue({ id: 'sight-1', ownerSeenAt: null });
    prisma.caseSighting.update.mockImplementation(async ({ data }) => ({ ...ROW, ...data }));
    prisma.caseSighting.findUnique.mockResolvedValue({ ...ROW, ownerSeenAt: ago(5) });
    searcherFor.mockResolvedValue(OWNER);
  });

  test('only the owner and the people running the search can answer', async () => {
    searcherFor.mockResolvedValue(null);
    const stranger = await call({ sightingId: 'sight-1', action: 'hold' });
    expect(stranger.status).toBe(403);
    expect((await stranger.json()).error).toMatch(/Only the owner and the people running the search/);

    searcherFor.mockResolvedValue(HELPER);
    expect((await call({ sightingId: 'sight-1', action: 'hold' })).status).toBe(403);
    expect(prisma.caseSighting.update).not.toHaveBeenCalled();

    searcherFor.mockResolvedValue(LEAD);
    expect((await call({ sightingId: 'sight-1', action: 'hold' })).status).toBe(200);
    // Sent in the lead's own name.
    expect(prisma.caseSighting.update.mock.calls[0][0].data.holdAskedByName).toBe('Sarah');
  });

  test('400 for anything else asked of it, 404 for no pet or a sighting from another search', async () => {
    expect((await call({ sightingId: 'sight-1', action: 'stop_everyone' })).status).toBe(400);
    expect((await call({ action: 'hold' })).status).toBe(400);
    prisma.caseSighting.findFirst.mockResolvedValue(null);
    const other = await call({ sightingId: 'sight-9', action: 'seen' });
    expect(other.status).toBe(404);
    expect(prisma.caseSighting.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'sight-9', missionId: 'case-max' } }));
    prisma.case.findFirst.mockResolvedValue(null);
    expect((await call({ sightingId: 'sight-1', action: 'seen' })).status).toBe(404);
  });

  test('seen is recorded the first time, and holds nobody back', async () => {
    const res = await call({ sightingId: 'sight-1', action: 'seen' });
    const data = prisma.caseSighting.update.mock.calls[0][0].data;
    expect(Object.keys(data)).toEqual(['ownerSeenAt']);
    expect((await res.json()).sighting.hold).toBe(false);
    expect(logEvent).not.toHaveBeenCalled();

    prisma.caseSighting.findFirst.mockResolvedValue({ id: 'sight-1', ownerSeenAt: ago(5) });
    prisma.caseSighting.update.mockClear();
    expect((await call({ sightingId: 'sight-1', action: 'seen' })).status).toBe(200);
    expect(prisma.caseSighting.update).not.toHaveBeenCalled();
  });

  test('going says so with the minutes when they make sense, and does not ask anyone to stay back', async () => {
    const res = await call({ sightingId: 'sight-1', action: 'going', etaMinutes: 6 });
    const data = prisma.caseSighting.update.mock.calls[0][0].data;
    expect(data.ownerGoingAt).toBeInstanceOf(Date);
    expect(data.ownerEtaMinutes).toBe(6);
    expect(data).not.toHaveProperty('holdAskedAt');
    expect((await res.json()).sighting).toMatchObject({ etaMinutes: 6, hold: false });

    await call({ sightingId: 'sight-1', action: 'going', etaMinutes: 5000 });
    expect(prisma.caseSighting.update.mock.calls[1][0].data.ownerEtaMinutes).toBeNull();
    await call({ sightingId: 'sight-1', action: 'going' });
    expect(prisma.caseSighting.update.mock.calls[2][0].data.ownerEtaMinutes).toBeNull();
  });

  test('hold starts the ask, release ends it, and every screen hears both', async () => {
    const held = await call({ sightingId: 'sight-1', action: 'hold' });
    expect(prisma.caseSighting.update.mock.calls[0][0].data).toMatchObject({ holdEndedAt: null, holdAskedByName: null });
    expect(prisma.caseSighting.update.mock.calls[0][0].data.holdAskedAt).toBeInstanceOf(Date);
    expect((await held.json()).sighting.hold).toBe(true);
    expect(broadcast).toHaveBeenCalledWith('case-max', { type: 'SIGHTING_UPDATED', sighting: { id: 'sight-1', ownerGoing: false, hold: true } });
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'sighting.owner_hold', actor_user_id: 'user-avery' }));

    prisma.caseSighting.update.mockImplementation(async ({ data }) => ({ ...ROW, holdAskedAt: ago(2), ...data }));
    const freed = await call({ sightingId: 'sight-1', action: 'release' });
    expect(prisma.caseSighting.update.mock.calls[1][0].data.holdEndedAt).toBeInstanceOf(Date);
    expect((await freed.json()).sighting.hold).toBe(false);
  });

  test('429 when hammered', async () => {
    withRateLimitAsync.mockResolvedValueOnce({ success: false });
    expect((await call({ sightingId: 'sight-1', action: 'seen' })).status).toBe(429);
  });
});
