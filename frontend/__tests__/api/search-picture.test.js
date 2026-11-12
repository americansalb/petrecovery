/**
 * The picture of a pet's search (app/lib/searchPicture.js, GET
 * /api/mission/[missionId]/picture) and the owner's answer to a sighting
 * (POST /api/mission/[missionId]/answer).
 *
 * The picture is open to anyone holding the pet's link, so what it must
 * never carry matters as much as what it carries: no helper's name, no
 * reporter's name, no house number. The answer says two things, that the
 * owner has seen a sighting and that the owner is going to it, and only
 * the owner can say them. Nothing in either asks a helper to hold back
 * (founder rule, 2026-11-11: the product never tells a helper to stop).
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findFirst: jest.fn() },
    caseSighting: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    caseAssignment: { findMany: jest.fn(async () => []) },
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
  RateLimitPresets: { PUBLIC_READ: {}, SEARCH_READ: {}, API: {} },
}));

import prisma from '@/app/lib/prisma';
import { searcherFor } from '@/app/lib/searcher';
import { broadcast } from '@/app/lib/sse/missionStream';
import { logEvent } from '@/lib/logging';
import { withRateLimitAsync } from '@/app/lib/rateLimit';
import * as pictureLib from '@/app/lib/searchPicture';
import { GET } from '@/app/api/mission/[missionId]/picture/route';
import { POST } from '@/app/api/mission/[missionId]/answer/route';

const { searchPicture } = pictureLib;

const NOW = new Date('2026-11-03T18:00:00Z').getTime();
const ago = (minutes) => new Date(NOW - minutes * 60000);

const sighting = (over = {}) => ({
  id: 'sight-1',
  sightedAt: ago(4),
  createdAt: ago(3),
  latitude: 30.3105,
  longitude: -97.747,
  address: 'Ramsey Ave and W 40th St',
  description: 'Blue collar, heading for the creek.',
  certaintyLevel: 'PROBABLE',
  reporterName: 'Dana Whitfield',
  reportedBy: null,
  ownerSeenAt: null,
  ownerGoingAt: null,
  ownerEtaMinutes: null,
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
// Someone in a force looking for the pet, which takes one tap to join: they see first names and are not the owner.
const MEMBER = { id: 'user-mike', kind: 'user', userId: 'user-mike', volunteerId: null, firstName: 'Mike', isOwner: false, waiver: true, seesNames: true };
const HELPER = { id: 'v:vol-1', kind: 'volunteer', userId: null, volunteerId: 'vol-1', firstName: 'Jo', isOwner: false, waiver: true, seesNames: false };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findFirst.mockResolvedValue(pet());
  prisma.searchStreet.findMany.mockResolvedValue([]);
  prisma.searchGrid.findUnique.mockResolvedValue(null);
  prisma.alert.count.mockResolvedValue(0);
  prisma.caseAssignment.findMany.mockResolvedValue([]);
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
    });
    // The street, never the house number.
    expect(out.lastSeen.place).toBe('Sinclair Ave');
    expect(JSON.stringify(out)).not.toContain('4407');
    // A sighting is where, when, and what the owner has done about it. Nothing else.
    expect(out.sightings[0]).toEqual({ id: 'sight-1', at: ago(4), lat: 30.3105, lng: -97.747, place: 'Ramsey Ave and W 40th St', sure: 'PROBABLE', ownerSeenAt: null, ownerGoingAt: null, etaMinutes: null });
    expect(out.forces).toBe(0);
  });

  test('it carries no ask of anyone: a fresh sighting changes what the screen says, and holds nobody back', async () => {
    const out = await searchPicture('case-max', { searcher: HELPER, now: NOW });
    expect(Object.keys(out).sort()).toEqual(['approach', 'caseNumber', 'forces', 'id', 'lastSeen', 'looking', 'neighbors', 'open', 'owner', 'pet', 'reportType', 'resolvedAt', 'reunited', 'searched', 'sightings', 'timeZone', 'viewer']);
    expect(JSON.stringify(out)).not.toMatch(/stay back|hold/i);
    expect(Object.keys(pictureLib)).toEqual(['searchPicture']);
  });

  test('a sighting taken back on the day the screen allowed it is not read, and every other one is', async () => {
    await searchPicture('case-max', { now: NOW });
    const asked = prisma.case.findFirst.mock.calls[0][0].select.sightings;
    // Written as "no state, or a different one". A plain NOT would drop every sighting whose state is empty, which is all the others.
    expect(asked.where).toEqual({ OR: [{ witnessState: null }, { witnessState: { not: 'NOT_THE_PET' } }] });
    expect(asked.orderBy).toEqual({ sightedAt: 'desc' });
    // The columns the older screen wrote are not read at all.
    expect(Object.keys(asked.select).sort()).toEqual(['address', 'certaintyLevel', 'createdAt', 'description', 'id', 'latitude', 'longitude', 'ownerEtaMinutes', 'ownerGoingAt', 'ownerSeenAt', 'reportedBy', 'reporterName', 'sightedAt']);
  });

  test('what the owner did about a sighting is there for the person who sent it', async () => {
    prisma.case.findFirst.mockResolvedValue(pet({ sightings: [sighting({ ownerSeenAt: ago(3), ownerGoingAt: ago(2), ownerEtaMinutes: 7 })] }));
    const out = await searchPicture('case-max', { now: NOW });
    expect(out.sightings[0]).toMatchObject({ ownerSeenAt: ago(3), ownerGoingAt: ago(2), etaMinutes: 7 });
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
    expect(text).not.toMatch(/witnessKey/);
    expect(helper.neighbors).toBeNull();
  });

  test('the owner sees who reported it, what they wrote, and how many neighbors were alerted', async () => {
    prisma.alert.count.mockResolvedValueOnce(41).mockResolvedValueOnce(6);
    const out = await searchPicture('case-max', { searcher: OWNER, now: NOW });
    expect(out.sightings[0]).toMatchObject({ by: 'Dana Whitfield', note: 'Blue collar, heading for the creek.' });
    expect(out.neighbors).toEqual({ told: 41, answered: 6 });
    expect(out.viewer).toMatchObject({ isOwner: true, seesNames: true, signedIn: true });
    // And when it reached them, which can be long after the pet was seen: their screen leads with news that is new to them.
    expect(out.sightings[0].sentAt).toEqual(ago(3));
  });

  test('a force looking for the pet sees names, and the neighbor counts stay with the owner', async () => {
    const out = await searchPicture('case-max', { searcher: MEMBER, now: NOW });
    expect(out.sightings[0].by).toBe('Dana Whitfield');
    expect(out.sightings[0]).not.toHaveProperty('sentAt');
    expect(out.neighbors).toBeNull();
    expect(prisma.alert.count).not.toHaveBeenCalled();
  });

  test('a sighting whose address will not give up its house number is shown without a place', async () => {
    prisma.case.findFirst.mockResolvedValue(pet({ sightings: [sighting({ address: '4001 1/2 Ramsey Ave, Austin, TX' })] }));
    const out = await searchPicture('case-max', { now: NOW });
    // The town, where the address names one, and never the number.
    expect(out.sightings[0].place).toBe('Austin, TX');
    expect(JSON.stringify(out.sightings)).not.toMatch(/4001|1\/2/);
    prisma.case.findFirst.mockResolvedValue(pet({ sightings: [sighting({ address: '4001 1/2 Ramsey Ave' })] }));
    expect((await searchPicture('case-max', { now: NOW })).sightings[0].place).toBeNull();
    prisma.case.findFirst.mockResolvedValue(pet({ sightings: [sighting({ address: '4001 Ramsey Ave, Austin, TX' })] }));
    expect((await searchPicture('case-max', { now: NOW })).sightings[0].place).toBe('Ramsey Ave');
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

describe('searchPicture: who else sees a helper\'s first name', () => {
  test('a force looking for the pet is counted, so the join card can say who sees it', async () => {
    prisma.caseAssignment.findMany.mockResolvedValue([{ rescueSquadId: 'force-1' }, { rescueSquadId: 'force-1' }, { rescueSquadId: 'force-2' }]);
    expect((await searchPicture('case-max', { now: NOW })).forces).toBe(2);
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
  const ROW = { id: 'sight-1', ownerSeenAt: null, ownerGoingAt: null, ownerEtaMinutes: null };

  beforeEach(() => {
    prisma.case.findFirst.mockResolvedValue({ id: 'case-max' });
    prisma.caseSighting.findFirst.mockResolvedValue({ id: 'sight-1', ownerSeenAt: null });
    prisma.caseSighting.update.mockImplementation(async ({ data }) => ({ ...ROW, ...data }));
    prisma.caseSighting.findUnique.mockResolvedValue({ ...ROW, ownerSeenAt: ago(5) });
    searcherFor.mockResolvedValue(OWNER);
  });

  test('"seen" and "going" are the owner\'s alone: nobody else can make a witness\'s screen say the owner is coming', async () => {
    for (const who of [null, HELPER, MEMBER]) {
      searcherFor.mockResolvedValue(who);
      for (const action of ['seen', 'going']) {
        const res = await call({ sightingId: 'sight-1', action, etaMinutes: 3 });
        expect(res.status).toBe(403);
        expect((await res.json()).error).toBe('Only the owner can answer a sighting.');
      }
    }
    expect(prisma.caseSighting.update).not.toHaveBeenCalled();
  });

  test('there is nothing else to say with it: asking helpers to hold back is not an answer', async () => {
    for (const action of ['hold', 'release', 'stop_everyone', '']) {
      const res = await call({ sightingId: 'sight-1', action });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe('Send a sightingId and one of: seen, going.');
    }
    expect((await call({ action: 'seen' })).status).toBe(400);
    expect(prisma.caseSighting.update).not.toHaveBeenCalled();
  });

  test('404 for no pet, or a sighting from another search', async () => {
    prisma.caseSighting.findFirst.mockResolvedValue(null);
    const other = await call({ sightingId: 'sight-9', action: 'seen' });
    expect(other.status).toBe(404);
    expect(prisma.caseSighting.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'sight-9', missionId: 'case-max' } }));
    prisma.case.findFirst.mockResolvedValue(null);
    expect((await call({ sightingId: 'sight-1', action: 'seen' })).status).toBe(404);
  });

  test('seen is recorded the first time only', async () => {
    const res = await call({ sightingId: 'sight-1', action: 'seen' });
    const data = prisma.caseSighting.update.mock.calls[0][0].data;
    expect(Object.keys(data)).toEqual(['ownerSeenAt']);
    expect(Object.keys((await res.json()).sighting).sort()).toEqual(['etaMinutes', 'id', 'ownerGoingAt', 'ownerSeenAt']);
    expect(logEvent).not.toHaveBeenCalled();

    prisma.caseSighting.findFirst.mockResolvedValue({ id: 'sight-1', ownerSeenAt: ago(5) });
    prisma.caseSighting.update.mockClear();
    expect((await call({ sightingId: 'sight-1', action: 'seen' })).status).toBe(200);
    expect(prisma.caseSighting.update).not.toHaveBeenCalled();
  });

  test('going says so, with the minutes when they make sense, and every screen hears it', async () => {
    const res = await call({ sightingId: 'sight-1', action: 'going', etaMinutes: 6 });
    const data = prisma.caseSighting.update.mock.calls[0][0].data;
    expect(Object.keys(data).sort()).toEqual(['ownerEtaMinutes', 'ownerGoingAt', 'ownerSeenAt']);
    expect(data.ownerGoingAt).toBeInstanceOf(Date);
    expect(data.ownerEtaMinutes).toBe(6);
    expect((await res.json()).sighting).toMatchObject({ id: 'sight-1', etaMinutes: 6 });
    expect(broadcast).toHaveBeenCalledWith('case-max', { type: 'SIGHTING_UPDATED', sighting: { id: 'sight-1', ownerGoing: true } });
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'sighting.owner_going', actor_user_id: 'user-avery' }));

    await call({ sightingId: 'sight-1', action: 'going', etaMinutes: 5000 });
    expect(prisma.caseSighting.update.mock.calls[1][0].data.ownerEtaMinutes).toBeNull();
    await call({ sightingId: 'sight-1', action: 'going' });
    expect(prisma.caseSighting.update.mock.calls[2][0].data.ownerEtaMinutes).toBeNull();
  });

  test('429 when hammered', async () => {
    withRateLimitAsync.mockResolvedValueOnce({ success: false });
    expect((await call({ sightingId: 'sight-1', action: 'seen' })).status).toBe(429);
  });
});
