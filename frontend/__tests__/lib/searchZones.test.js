/**
 * The areas of a search, kept (app/lib/searchZones.js): the rows a search
 * is made of once it is a circle of ground and not a list of streets.
 *
 * What matters most here is what is different from a street. Ground is
 * not one walk: several people can be on an area, each search of it
 * counts, and nothing is ever "taken", with one exception: the circle
 * round a sighting, which one person goes to. An ask keeps nothing from
 * anyone. And like every part of the board, who is on an area goes only
 * to the owner and the forces looking, and nobody is handed out by id.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findUnique: jest.fn() },
    caseSighting: { findMany: jest.fn(async () => []) },
    searchGrid: { findUnique: jest.fn(async () => null), updateMany: jest.fn(async () => ({ count: 1 })) },
    searchStreet: { findMany: jest.fn(async () => []) },
    searchZone: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null), createMany: jest.fn(async () => ({ count: 0 })), updateMany: jest.fn(async () => ({ count: 1 })), update: jest.fn(async () => ({})), count: jest.fn(async () => 0) },
    searchZoneVisit: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null), create: jest.fn(async () => ({ id: 'visit-new' })), updateMany: jest.fn(async () => ({ count: 1 })) },
    searchMessage: { create: jest.fn(async () => ({})) },
  },
}));
jest.mock('@/app/lib/searchBoard', () => ({ __esModule: true, ensureGrid: jest.fn(async () => ({ id: 'grid-1' })) }));
jest.mock('@/app/lib/push', () => ({ __esModule: true, isPushConfigured: jest.fn(() => false), sendPushToUser: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { ensureGrid } from '@/app/lib/searchBoard';
import {
  ensureZones, sweepStaleVisits, zoneForBoard, readZones, openAreas, actOnZone, widenCircle, askZone, unaskZonePerson, cannotSearch,
  zoneAskWaitingFor, markZoneAskSeen, zoneSearchersSince, zoneGroundCovered, freshSightings, streetNames,
  ZONE_ACTIONS, ZONE_STEER_ACTIONS, SEEN_CIRCLES_MAX, ASK_STALE_MS, ASK_NOTE_MAX, CANNOT_WORDS,
} from '@/app/lib/searchZones';
import { RING, CIRCLES, areasOf, seenArea, heartOf, minutesFor } from '@/app/lib/searchCircle';
import { handleFor } from '@/app/lib/searchTeam';
import { FIRST_PRIORITY } from '@/app/lib/searchGrid';

const CASE = 'case-max';
const NOW = new Date('2026-11-12T22:00:00Z').getTime();
const ago = (minutes) => new Date(NOW - minutes * 60000);
const LOST = { lat: 30.3148, lng: -97.7459 };
const PET = { id: CASE, reportType: 'LOST', petName: 'Max', petSpecies: 'DOG', lastSeenLatitude: LOST.lat, lastSeenLongitude: LOST.lng };

/** A stored row for one of a dog's areas, as ensureZones writes it. */
function row(key, over = {}) {
  const area = key.startsWith('seen-') ? seenArea(key.slice(5), CIRCLES.DOG, 'Max') : areasOf(CIRCLES.DOG, { widened: true }).find((a) => a.key === key);
  const center = over.center || LOST;
  const heart = heartOf(area, center);
  return {
    id: `z-${key}`, caseId: CASE, key, name: area.name, ring: area.ring,
    centerLatitude: center.lat, centerLongitude: center.lng, fromMeters: area.from, toMeters: area.to, bearingFrom: area.a, bearingTo: area.b,
    heartLatitude: heart.lat, heartLongitude: heart.lng, minutes: minutesFor(area, CIRCLES.DOG), landmarks: '[]', sightingId: key.startsWith('seen-') ? key.slice(5) : null,
    priority: 5, searchCount: 0, searchedAt: null, searchedById: null, searchedByName: null, againAt: null, visits: [], ...over,
  };
}
const visit = (over = {}) => ({ id: 'v1', zoneId: 'z-west', caseId: CASE, searcherId: 'v:vol-1', searcherName: 'Dana', askedById: null, askedByName: null, askedAt: null, askedSeenAt: null, askedNote: null, startedAt: null, endedAt: null, outcome: null, ...over });
const on = (over = {}) => visit({ startedAt: ago(10), ...over });
const asked = (over = {}) => visit({ askedById: 'u-avery', askedByName: 'Avery', askedAt: ago(5), ...over });

const OWNER = { id: 'u-avery', kind: 'user', userId: 'u-avery', firstName: 'Avery', isOwner: true, waiver: true, seesNames: true, leads: true };
const DANA = { id: 'v:vol-1', kind: 'volunteer', userId: null, firstName: 'Dana', isOwner: false, waiver: true, seesNames: false, leads: false };
const MIKE = { id: 'u-mike', kind: 'user', userId: 'u-mike', firstName: 'Mike', isOwner: false, waiver: true, seesNames: true, leads: false };
const sighting = (over = {}) => ({ id: 's1', latitude: LOST.lat - 300 / 111320, longitude: LOST.lng, sightedAt: ago(12), ownerGoingAt: null, ...over });

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findUnique.mockResolvedValue(PET);
  prisma.caseSighting.findMany.mockResolvedValue([]);
  prisma.searchGrid.findUnique.mockResolvedValue({ widenedAt: null, streetsStatus: 'READY' });
  prisma.searchGrid.updateMany.mockResolvedValue({ count: 1 });
  prisma.searchStreet.findMany.mockResolvedValue([]);
  prisma.searchZone.findMany.mockResolvedValue([]);
  prisma.searchZone.findFirst.mockResolvedValue(null);
  prisma.searchZone.createMany.mockResolvedValue({ count: 0 });
  prisma.searchZone.updateMany.mockResolvedValue({ count: 1 });
  prisma.searchZone.count.mockResolvedValue(0);
  prisma.searchZoneVisit.findMany.mockResolvedValue([]);
  prisma.searchZoneVisit.findFirst.mockResolvedValue(null);
  prisma.searchZoneVisit.create.mockResolvedValue({ id: 'visit-new' });
  prisma.searchZoneVisit.updateMany.mockResolvedValue({ count: 1 });
  ensureGrid.mockResolvedValue({ id: 'grid-1' });
});

describe('zoneForBoard: one area as the board sends it', () => {
  const ctx = (over = {}) => ({ caseId: CASE, name: 'Max', sightings: [], now: NOW, ...over });

  test('where it is, how long it takes, and its edge for the map', () => {
    const out = zoneForBoard(row('west', { landmarks: '["Jefferson St","Shoal Creek Blvd"]' }), ctx());
    expect(out).toMatchObject({
      id: 'z-west', key: 'west', ring: 1, name: 'West side', title: 'West side', reach: '150 m to 400 m west of where Max was lost', landmarks: ['Jefferson St', 'Shoal Creek Blvd'],
      from: 150, to: 400, a: 225, b: 315, minutes: 45, priority: 6, first: false, status: 'UNSEARCHED', on: 0, coming: 0, full: false, searchCount: 0, marked: false, mine: false,
    });
    expect(out.outline[0]).toEqual(out.outline[out.outline.length - 1]);
    expect(out.center.lng).toBeLessThan(LOST.lng);
  });

  test('its state comes from who is on it and whether it has been searched, never from a claim', () => {
    expect(zoneForBoard(row('west', { visits: [on()] }), ctx()).status).toBe('IN_PROGRESS');
    expect(zoneForBoard(row('west', { searchCount: 2, searchedAt: ago(30) }), ctx()).status).toBe('SEARCHED');
    expect(zoneForBoard(row('west', { searchCount: 1, searchedAt: ago(30), againAt: ago(5) }), ctx()).status).toBe('NEEDS_REVISIT');
    // Someone on a searched area: it is being searched, and still counts its earlier searches.
    expect(zoneForBoard(row('west', { searchCount: 1, visits: [on()] }), ctx())).toMatchObject({ status: 'IN_PROGRESS', searchCount: 1 });
    // An ask alone is not someone on it.
    expect(zoneForBoard(row('west', { visits: [asked()] }), ctx())).toMatchObject({ status: 'UNSEARCHED', on: 0, coming: 1 });
  });

  test('several people on one area: everyone learns how many, and since when', () => {
    const out = zoneForBoard(row('west', { visits: [on({ id: 'v1', startedAt: ago(20) }), on({ id: 'v2', searcherId: 'u-mike', searcherName: 'Mike', startedAt: ago(4) })] }), ctx());
    expect(out).toMatchObject({ on: 2, status: 'IN_PROGRESS', claimedAt: ago(20), full: false, reserved: false });
  });

  test('who they are goes only where names go, by handle and never by id', () => {
    const zone = row('west', { searchCount: 1, searchedAt: ago(50), searchedById: 'u-mike', searchedByName: 'Mike', visits: [on(), asked({ id: 'v2', searcherId: 'u-jo', searcherName: 'Jo', askedSeenAt: ago(2) })] });
    const anyone = zoneForBoard(zone, ctx());
    for (const key of ['who', 'claimedByName', 'searchedByName', 'asked']) expect(anyone).not.toHaveProperty(key);
    expect(JSON.stringify(anyone)).not.toMatch(/vol-1|u-mike|u-jo|Dana|Mike|Jo\b/);
    const owner = zoneForBoard(zone, ctx({ viewer: 'u-avery', withNames: true, ownerId: 'u-avery', ownerName: 'Avery' }));
    expect(owner.who).toEqual([{ name: 'Dana', handle: handleFor(CASE, 'v:vol-1'), since: ago(10) }]);
    expect(owner).toMatchObject({ claimedByName: 'Dana', searchedByName: 'Mike' });
    expect(owner.asked).toEqual([{ name: 'Jo', handle: handleFor(CASE, 'u-jo'), at: ago(5), seenAt: ago(2), holds: true }]);
    expect(JSON.stringify(owner)).not.toMatch(/vol-1|u-mike|u-jo/);
  });

  test('the person on it reads that it is theirs', () => {
    expect(zoneForBoard(row('west', { visits: [on()] }), ctx({ viewer: 'v:vol-1' })).mine).toBe(true);
    expect(zoneForBoard(row('west', { visits: [on()] }), ctx({ viewer: 'u-mike' })).mine).toBe(false);
  });

  test('the person asked reads that it is asked of them, with the note and the owner by name; nobody else does', () => {
    const zone = row('west', { visits: [asked({ askedNote: 'Start at the creek path, please.' })] });
    const theirs = zoneForBoard(zone, ctx({ viewer: 'v:vol-1', ownerId: 'u-avery', ownerName: 'Avery' }));
    expect(theirs).toMatchObject({ askedOfMe: true, askedNote: 'Start at the creek path, please.', askedBy: 'Avery', askedSeen: false, coming: 0 });
    const other = zoneForBoard(zone, ctx({ viewer: 'u-mike' }));
    for (const key of ['askedOfMe', 'askedNote', 'askedBy', 'askedSeen']) expect(other).not.toHaveProperty(key);
    // An ask keeps the area from nobody: someone else can still be given it.
    expect(other).toMatchObject({ full: false, reserved: false, coming: 1 });
    // Asked by someone other than the owner, a helper is not told who.
    expect(zoneForBoard(row('west', { visits: [asked({ askedById: 'u-lead' })] }), ctx({ viewer: 'v:vol-1', ownerId: 'u-avery', ownerName: 'Avery' })).askedBy).toBeNull();
  });

  test('an ask older than half an hour no longer counts as someone on the way', () => {
    expect(zoneForBoard(row('west', { visits: [asked({ askedAt: ago(40) })] }), ctx()).coming).toBe(0);
  });

  test('how urgent it is follows its ring and the fresh sightings, worked out on every read', () => {
    const seen = [{ id: 's1', lat: LOST.lat - 300 / 111320, lng: LOST.lng, at: ago(12) }];
    expect(zoneForBoard(row('middle'), ctx()).priority).toBe(8);
    expect(zoneForBoard(row('south'), ctx()).priority).toBe(6);
    expect(zoneForBoard(row('outer-south'), ctx()).priority).toBe(3);
    // The side the pet was seen in comes up; the others stay.
    expect(zoneForBoard(row('south'), ctx({ sightings: seen })).priority).toBe(10);
    expect(zoneForBoard(row('north'), ctx({ sightings: seen })).priority).toBe(6);
    // Sent to first by the owner is above everything the search orders by itself.
    expect(zoneForBoard(row('north', { priority: FIRST_PRIORITY }), ctx({ sightings: seen }))).toMatchObject({ priority: FIRST_PRIORITY, first: true });
  });

  test('ground put down from the desk is marked as that', () => {
    expect(zoneForBoard(row('east', { searchCount: 1, searchedAt: ago(5), searchedById: 'm:u-avery', searchedByName: 'Avery' }), ctx()).marked).toBe(true);
    expect(zoneForBoard(row('east', { searchCount: 1, searchedAt: ago(5), searchedById: 'u-mike' }), ctx()).marked).toBe(false);
  });

  describe('the circle round a sighting: one person goes, never a group', () => {
    const seen = [{ id: 's1', lat: LOST.lat - 300 / 111320, lng: LOST.lng, at: ago(12), ownerGoingAt: null }];
    const circle = (over = {}) => row('seen-s1', { center: { lat: seen[0].lat, lng: seen[0].lng }, ...over });

    test('it is named for what it is, and comes before everything the search orders', () => {
      expect(zoneForBoard(circle(), ctx({ sightings: seen }))).toMatchObject({ ring: RING.SEEN, name: 'Where Max was seen', reach: 'Within 150 m of where Max was seen', minutes: 30, priority: 10, full: false, sightingId: 's1', sightingAt: ago(12) });
    });

    test('with someone there it is full for everyone else, and not for the person there', () => {
      const zone = circle({ visits: [on({ zoneId: 'z-seen-s1' })] });
      expect(zoneForBoard(zone, ctx({ sightings: seen, viewer: 'u-mike' }))).toMatchObject({ full: true, reserved: true, on: 1 });
      expect(zoneForBoard(zone, ctx({ sightings: seen, viewer: 'v:vol-1' }))).toMatchObject({ full: false, mine: true });
    });

    test('someone freshly asked to go fills it too, until the ask is half an hour old', () => {
      expect(zoneForBoard(circle({ visits: [asked()] }), ctx({ sightings: seen, viewer: 'u-mike' })).full).toBe(true);
      expect(zoneForBoard(circle({ visits: [asked()] }), ctx({ sightings: seen, viewer: 'v:vol-1' })).full).toBe(false);
      expect(zoneForBoard(circle({ visits: [asked({ askedAt: ago(45) })] }), ctx({ sightings: seen, viewer: 'u-mike' })).full).toBe(false);
    });

    test('the owner setting off for it is the one person: helpers are given other ground, and the owner is not', () => {
      const going = [{ ...seen[0], ownerGoingAt: ago(6) }];
      const helper = zoneForBoard(circle(), ctx({ sightings: going, viewer: 'u-mike', ownerId: 'u-avery' }));
      expect(helper).toMatchObject({ full: true, going: { at: ago(6) } });
      expect(zoneForBoard(circle(), ctx({ sightings: going, viewer: 'u-avery', ownerId: 'u-avery' })).full).toBe(false);
      // Set off two hours ago is not the owner being there now.
      expect(zoneForBoard(circle(), ctx({ sightings: [{ ...seen[0], ownerGoingAt: ago(120) }], viewer: 'u-mike', ownerId: 'u-avery' })).full).toBe(false);
    });

    test('once its sighting is old it drops to the bottom of the order', () => {
      expect(zoneForBoard(circle(), ctx({ sightings: [] })).priority).toBe(2);
    });
  });
});

describe('ensureZones: the areas are made on first use, and need no map server', () => {
  test('a dog\'s search starts as five: the middle and four sides, drawn round where it was lost', async () => {
    const made = await ensureZones(CASE, { now: NOW });
    expect(made).toMatchObject({ circle: CIRCLES.DOG, center: LOST, widened: false, name: 'Max' });
    const { data, skipDuplicates } = prisma.searchZone.createMany.mock.calls[0][0];
    // Two first reads at once both try: the key on (caseId, key) keeps one of each.
    expect(skipDuplicates).toBe(true);
    expect(data.map((d) => d.key)).toEqual(['middle', 'north', 'east', 'south', 'west']);
    expect(data[0]).toMatchObject({ caseId: CASE, name: 'The middle', ring: 0, centerLatitude: LOST.lat, centerLongitude: LOST.lng, fromMeters: 0, toMeters: 150, bearingFrom: 0, bearingTo: 360, minutes: 30 });
    expect(data[4]).toMatchObject({ name: 'West side', ring: 1, fromMeters: 150, toMeters: 400, bearingFrom: 225, bearingTo: 315, minutes: 45 });
    expect(data[4].heartLongitude).toBeLessThan(LOST.lng);
  });

  test('a cat\'s is smaller, and takes longer for its size', async () => {
    prisma.case.findUnique.mockResolvedValue({ ...PET, petSpecies: 'CAT' });
    await ensureZones(CASE, { now: NOW });
    const { data } = prisma.searchZone.createMany.mock.calls[0][0];
    expect(data[0]).toMatchObject({ key: 'middle', toMeters: 50, minutes: 15 });
    expect(data[1]).toMatchObject({ key: 'north', fromMeters: 50, toMeters: 150, minutes: 30 });
  });

  test('nothing is made twice', async () => {
    prisma.searchZone.findMany.mockResolvedValue(['middle', 'north', 'east', 'south', 'west'].map((key) => row(key)));
    await ensureZones(CASE, { now: NOW });
    expect(prisma.searchZone.createMany).not.toHaveBeenCalled();
  });

  test('widened, it gains the outer eight, drawn round the same centre even if the report\'s place has moved', async () => {
    prisma.searchGrid.findUnique.mockResolvedValue({ widenedAt: ago(1), streetsStatus: 'READY' });
    prisma.searchZone.findMany.mockResolvedValue(['middle', 'north', 'east', 'south', 'west'].map((key) => row(key)));
    prisma.case.findUnique.mockResolvedValue({ ...PET, lastSeenLatitude: 30.4, lastSeenLongitude: -97.6 });
    const made = await ensureZones(CASE, { now: NOW });
    expect(made).toMatchObject({ widened: true, center: LOST });
    const { data } = prisma.searchZone.createMany.mock.calls[0][0];
    expect(data.map((d) => d.key)).toEqual(['outer-north', 'outer-north-east', 'outer-east', 'outer-south-east', 'outer-south', 'outer-south-west', 'outer-west', 'outer-north-west']);
    expect(data.every((d) => d.ring === 2 && d.fromMeters === 400 && d.toMeters === 800 && d.centerLatitude === LOST.lat && d.minutes === 75)).toBe(true);
    expect(data[0].name).toBe('Far north');
  });

  test('each fresh sighting gets a circle of its own, round the sighting: the newest few', async () => {
    prisma.searchZone.findMany.mockResolvedValue(['middle', 'north', 'east', 'south', 'west'].map((key) => row(key)));
    prisma.caseSighting.findMany.mockResolvedValue([sighting({ id: 's4' }), sighting({ id: 's3' }), sighting({ id: 's2' }), sighting({ id: 's1' }), sighting({ id: 'nowhere', latitude: null })]);
    await ensureZones(CASE, { now: NOW });
    const { data } = prisma.searchZone.createMany.mock.calls[0][0];
    expect(SEEN_CIRCLES_MAX).toBe(3);
    expect(data.map((d) => d.key)).toEqual(['seen-s4', 'seen-s3', 'seen-s2']);
    expect(data[0]).toMatchObject({ ring: RING.SEEN, name: 'Where Max was seen', sightingId: 's4', centerLatitude: sighting().latitude, fromMeters: 0, toMeters: 150, minutes: 30 });
    // Only sightings of the last three days, and never one its witness took back.
    const { where } = prisma.caseSighting.findMany.mock.calls[0][0];
    expect(where.sightedAt.gte).toEqual(new Date(NOW - 72 * 60 * 60 * 1000));
    expect(where.OR).toEqual([{ witnessState: null }, { witnessState: { not: 'NOT_THE_PET' } }]);
  });

  test('a found pet, a report with no place, and a pet that is not there have no search to draw', async () => {
    for (const pet of [{ ...PET, reportType: 'FOUND' }, { ...PET, lastSeenLatitude: null }, null]) {
      prisma.case.findUnique.mockResolvedValue(pet);
      expect(await ensureZones(CASE, { now: NOW })).toBeNull();
    }
    expect(prisma.searchZone.createMany).not.toHaveBeenCalled();
  });

  test('streets are read for one thing, the two names that help find an area, once they are known', async () => {
    const west = (lng) => [LOST.lat, lng];
    prisma.searchZone.findMany.mockImplementation(async ({ where }) => (where.landmarks === null ? [row('west', { landmarks: null })] : [row('middle', { landmarks: null }), row('west', { landmarks: null })]));
    prisma.searchStreet.findMany.mockResolvedValue([
      { name: 'Jefferson St', path: JSON.stringify([west(-97.7480), west(-97.7495)]) },
      { name: 'Broken Rd', path: 'not json' },
    ]);
    await ensureZones(CASE, { now: NOW });
    expect(prisma.searchZone.updateMany).toHaveBeenCalledWith({ where: { id: 'z-west', landmarks: null }, data: { landmarks: '["Jefferson St"]' } });
  });

  test('with the streets not fetched yet, the areas are there all the same and unnamed for now', async () => {
    prisma.searchGrid.findUnique.mockResolvedValue(null);
    const made = await ensureZones(CASE, { now: NOW });
    expect(made.streetsStatus).toBeNull();
    expect(prisma.searchZone.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.searchStreet.findMany).not.toHaveBeenCalled();
    expect(prisma.searchZone.updateMany).not.toHaveBeenCalled();
  });
});

describe('sweepStaleVisits', () => {
  test('someone not heard from in an hour and a half, or twice what the area takes, is no longer on it', async () => {
    prisma.searchZoneVisit.findMany.mockResolvedValue([
      { id: 'gone', startedAt: ago(100), zone: { minutes: 45 } },
      // 75 minutes of ground: 100 minutes in is not yet twice that.
      { id: 'careful', startedAt: ago(100), zone: { minutes: 75 } },
      { id: 'old-ask', startedAt: null, zone: { minutes: 45 } },
    ]);
    expect(await sweepStaleVisits(CASE, NOW)).toBe(1);
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['gone', 'old-ask'] }, endedAt: null }, data: { endedAt: new Date(NOW), outcome: 'LAPSED' } });
    // An ask nobody started in half a day is over.
    const { where } = prisma.searchZoneVisit.findMany.mock.calls[0][0];
    expect(where.OR[1]).toEqual({ startedAt: null, askedAt: { lt: new Date(NOW - ASK_STALE_MS) } });
  });

  test('with nobody stale, nothing is written', async () => {
    expect(await sweepStaleVisits(CASE, NOW)).toBe(0);
    expect(prisma.searchZoneVisit.updateMany).not.toHaveBeenCalled();
  });
});

describe('readZones: the board', () => {
  const stored = (extra = []) => [...['middle', 'north', 'east', 'south', 'west'].map((key) => row(key)), ...extra];

  test('the circle and its areas, most urgent first, then clockwise from north', async () => {
    prisma.searchZone.findMany.mockResolvedValue(stored());
    const out = await readZones(CASE, { now: NOW });
    expect(out.circle).toEqual({ center: LOST, inner: 150, edge: 400, wide: 800, radius: 400, widened: false });
    expect(out.areas.map((a) => a.key)).toEqual(['middle', 'north', 'east', 'south', 'west']);
    expect(out.areas[0]).not.toHaveProperty('bearing');
  });

  test('the outer ring is part of the search once it is widened, and not before', async () => {
    prisma.searchZone.findMany.mockResolvedValue(stored([row('outer-north')]));
    expect((await readZones(CASE, { now: NOW })).areas).toHaveLength(5);
    prisma.searchGrid.findUnique.mockResolvedValue({ widenedAt: ago(2), streetsStatus: 'READY' });
    const wide = await readZones(CASE, { now: NOW });
    expect(wide.circle).toMatchObject({ radius: 800, widened: true });
    expect(wide.areas.map((a) => a.key)).toContain('outer-north');
  });

  test('a fresh sighting\'s circle is first, and the side it was seen in next', async () => {
    prisma.caseSighting.findMany.mockResolvedValue([sighting()]);
    prisma.searchZone.findMany.mockResolvedValue(stored([row('seen-s1', { center: { lat: sighting().latitude, lng: sighting().longitude } })]));
    const out = await readZones(CASE, { now: NOW });
    expect(out.areas.slice(0, 3).map((a) => [a.key, a.priority])).toEqual([['seen-s1', 10], ['south', 10], ['middle', 8]]);
  });

  test('a circle whose sighting is old leaves the board, unless someone is still there', async () => {
    const old = row('seen-s0', { center: LOST });
    prisma.searchZone.findMany.mockResolvedValue(stored([old]));
    expect((await readZones(CASE, { now: NOW })).areas.map((a) => a.key)).not.toContain('seen-s0');
    prisma.searchZone.findMany.mockResolvedValue(stored([{ ...old, visits: [on({ zoneId: old.id })] }]));
    expect((await readZones(CASE, { now: NOW })).areas.map((a) => a.key)).toContain('seen-s0');
  });

  test('no search to draw is null', async () => {
    prisma.case.findUnique.mockResolvedValue({ ...PET, reportType: 'FOUND' });
    expect(await readZones(CASE, { now: NOW })).toBeNull();
  });

  test('the job picker is handed ground in the order it is given out, and never a full sighting\'s circle', async () => {
    prisma.caseSighting.findMany.mockResolvedValue([sighting()]);
    prisma.searchZone.findMany.mockResolvedValue(stored([row('seen-s1', { center: { lat: sighting().latitude, lng: sighting().longitude }, visits: [on({ zoneId: 'z-seen-s1' })] })]).map((z) => (z.key === 'middle' ? { ...z, visits: [on({ id: 'v9', searcherId: 'u-sarah', zoneId: 'z-middle' })] } : z)));
    const jobs = await openAreas(CASE, { viewer: 'u-mike', now: NOW });
    expect(jobs.map((j) => j.label)).toEqual(['South side', 'North side', 'East side', 'West side', 'The middle']);
    expect(jobs[0]).toMatchObject({ id: 'z-south', unit: 'area', status: 'UNSEARCHED', priority: 10, minutes: 45, reach: '150 m to 400 m south of where Max was lost', on: 0, askedOfMe: false });
    expect(jobs[0].centerLatitude).toBeLessThan(LOST.lat);
  });
});

describe('actOnZone: the board\'s verbs on ground', () => {
  const act = (action, searcher, id = 'z-west', extra = {}) => actOnZone({ caseId: CASE, id, action, searcher, ownerId: 'u-avery', ownerName: 'Avery', now: NOW, ...extra });

  test('the verbs', () => {
    expect(ZONE_ACTIONS).toEqual(['claim', 'release', 'searched']);
    expect(ZONE_STEER_ACTIONS).toEqual(['first', 'normal', 'walked', 'again', 'againAll', 'widen']);
  });

  test('an area of another search is not found', async () => {
    expect(await act('claim', DANA)).toEqual({ error: 'NOT_FOUND', title: null });
    expect(prisma.searchZone.findFirst.mock.calls[0][0].where).toEqual({ id: 'z-west', caseId: CASE });
  });

  test('starting an area writes this person on it, and gives back whatever else they were on: one area at a time', async () => {
    prisma.searchZone.findFirst.mockResolvedValueOnce(row('west')).mockResolvedValue(row('west', { visits: [on({ id: 'visit-new' })] }));
    const out = await act('claim', DANA);
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { caseId: CASE, searcherId: 'v:vol-1', endedAt: null, startedAt: { not: null }, NOT: { zoneId: 'z-west' } }, data: { endedAt: new Date(NOW), outcome: 'GAVE_BACK' } });
    expect(prisma.searchZoneVisit.create).toHaveBeenCalledWith({ data: { zoneId: 'z-west', caseId: CASE, searcherId: 'v:vol-1', searcherName: 'Dana', startedAt: new Date(NOW) }, select: { id: true } });
    expect(out).toMatchObject({ title: 'the west side', item: { id: 'z-west', status: 'IN_PROGRESS', mine: true, on: 1 } });
  });

  test('someone else being on it refuses nobody: a second person is written on it too', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('west', { visits: [on({ id: 'v-sarah', searcherId: 'u-sarah', searcherName: 'Sarah' })] }));
    const out = await act('claim', DANA);
    expect(out.error).toBeUndefined();
    expect(prisma.searchZoneVisit.create).toHaveBeenCalledTimes(1);
  });

  test('starting it twice writes nothing twice', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('west', { visits: [on()] }));
    await act('claim', DANA);
    expect(prisma.searchZoneVisit.create).not.toHaveBeenCalled();
  });

  test('starting the area they were asked for turns the ask into the search, and starting it is seeing it', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('west', { visits: [asked({ id: 'v-ask' })] }));
    await act('claim', DANA);
    expect(prisma.searchZoneVisit.create).not.toHaveBeenCalled();
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { id: 'v-ask', endedAt: null }, data: { startedAt: new Date(NOW), searcherName: 'Dana', askedSeenAt: new Date(NOW) } });
  });

  test('a sighting\'s circle with someone there answers TAKEN, before anything of theirs is given back', async () => {
    prisma.caseSighting.findMany.mockResolvedValue([sighting()]);
    prisma.searchZone.findFirst.mockResolvedValue(row('seen-s1', { visits: [on({ zoneId: 'z-seen-s1', searcherId: 'u-sarah' })] }));
    expect(await act('claim', DANA, 'z-seen-s1')).toEqual({ error: 'TAKEN', title: 'where Max was seen' });
    expect(prisma.searchZoneVisit.updateMany).not.toHaveBeenCalled();
    expect(prisma.searchZoneVisit.create).not.toHaveBeenCalled();
  });

  test('two people ask for the same sighting in the same second: the first written is the one who goes', async () => {
    prisma.caseSighting.findMany.mockResolvedValue([sighting()]);
    prisma.searchZone.findFirst.mockResolvedValue(row('seen-s1'));
    prisma.searchZoneVisit.create.mockResolvedValue({ id: 'visit-mine' });
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'visit-theirs' });
    expect(await act('claim', DANA, 'z-seen-s1')).toEqual({ error: 'TAKEN', title: 'where Max was seen' });
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenLastCalledWith({ where: { id: 'visit-mine', endedAt: null }, data: { endedAt: new Date(NOW), outcome: 'GAVE_BACK' } });
    // And the one who was first keeps it.
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'visit-mine' });
    expect((await act('claim', DANA, 'z-seen-s1')).error).toBeUndefined();
  });

  test('"I searched it" is only for someone on it, and counts one more search of the area', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('west'));
    prisma.searchZoneVisit.updateMany.mockResolvedValue({ count: 0 });
    expect(await act('searched', DANA)).toEqual({ error: 'NOT_CLAIMED', title: 'the west side' });
    expect(prisma.searchZone.update).not.toHaveBeenCalled();

    prisma.searchZoneVisit.updateMany.mockResolvedValue({ count: 1 });
    prisma.searchZone.findFirst.mockResolvedValueOnce(row('west', { visits: [on()] })).mockResolvedValue(row('west', { searchCount: 1, searchedAt: new Date(NOW), searchedById: 'v:vol-1', searchedByName: 'Dana' }));
    const out = await act('searched', DANA);
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { zoneId: 'z-west', searcherId: 'v:vol-1', endedAt: null, startedAt: { not: null } }, data: { endedAt: new Date(NOW), outcome: 'SEARCHED' } });
    expect(prisma.searchZone.update).toHaveBeenCalledWith({ where: { id: 'z-west' }, data: { searchCount: { increment: 1 }, searchedAt: new Date(NOW), searchedById: 'v:vol-1', searchedByName: 'Dana', againAt: null } });
    expect(out.item).toMatchObject({ status: 'SEARCHED', searchCount: 1, mine: false });
    // Asked for first and now searched: the ask is met.
    expect(prisma.searchZone.updateMany).toHaveBeenCalledWith({ where: { id: 'z-west', priority: { gte: FIRST_PRIORITY } }, data: { priority: 5 } });
  });

  test('stopping is giving it back, and only your own', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('west', { visits: [on()] }));
    await act('release', DANA);
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { zoneId: 'z-west', searcherId: 'v:vol-1', endedAt: null, startedAt: { not: null } }, data: { endedAt: new Date(NOW), outcome: 'GAVE_BACK' } });
    expect(prisma.searchZone.update).not.toHaveBeenCalled();
    prisma.searchZoneVisit.updateMany.mockResolvedValue({ count: 0 });
    expect(await act('release', MIKE)).toEqual({ error: 'NOT_YOURS', title: 'the west side' });
  });

  test('steering is for whoever runs the search: nobody else, whatever they send, and nothing is read or written', async () => {
    for (const action of ZONE_STEER_ACTIONS) {
      for (const who of [DANA, MIKE]) expect(await act(action, who)).toEqual({ error: 'NOT_ALLOWED', title: null });
    }
    expect(prisma.searchZone.findFirst).not.toHaveBeenCalled();
    expect(prisma.searchZone.updateMany).not.toHaveBeenCalled();
    expect(prisma.searchGrid.updateMany).not.toHaveBeenCalled();
  });

  test('"first" sends the next people there, and a searched area asked for first is due another look', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('west'));
    await act('first', OWNER);
    expect(prisma.searchZone.updateMany).toHaveBeenCalledWith({ where: { id: 'z-west' }, data: { priority: FIRST_PRIORITY } });
    prisma.searchZone.findFirst.mockResolvedValue(row('west', { searchCount: 1, searchedAt: ago(30) }));
    await act('first', OWNER);
    expect(prisma.searchZone.updateMany).toHaveBeenLastCalledWith({ where: { id: 'z-west' }, data: { priority: FIRST_PRIORITY, againAt: new Date(NOW) } });
    await act('normal', OWNER);
    expect(prisma.searchZone.updateMany).toHaveBeenLastCalledWith({ where: { id: 'z-west' }, data: { priority: 5 } });
  });

  test('"walked" puts ground down as searched for someone off the site: by whom, and not as a person out searching', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('east'));
    await act('walked', OWNER, 'z-east');
    expect(prisma.searchZone.updateMany).toHaveBeenCalledWith({
      where: { id: 'z-east', OR: [{ searchCount: 0 }, { againAt: { not: null } }] },
      data: { searchCount: { increment: 1 }, searchedAt: new Date(NOW), searchedById: 'm:u-avery', searchedByName: 'Avery', againAt: null },
    });
    // No visit is written: nobody went out through the site.
    expect(prisma.searchZoneVisit.create).not.toHaveBeenCalled();
  });

  test('ground someone is on is theirs to say, and a searched area is put up for another look before it is counted again', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('east', { visits: [on({ zoneId: 'z-east' })] }));
    expect(await act('walked', OWNER, 'z-east')).toEqual({ error: 'SOMEONE_ON_IT', title: 'the east side' });
    expect(await act('again', OWNER, 'z-east')).toEqual({ error: 'SOMEONE_ON_IT', title: 'the east side' });
    prisma.searchZone.findFirst.mockResolvedValue(row('east', { searchCount: 1, searchedAt: ago(5) }));
    prisma.searchZone.updateMany.mockResolvedValue({ count: 0 });
    expect(await act('walked', OWNER, 'z-east')).toEqual({ error: 'ALREADY_WALKED', title: 'the east side' });
  });

  test('"again" is for ground that has been searched, once', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('south'));
    expect(await act('again', OWNER, 'z-south')).toEqual({ error: 'NOT_WALKED', title: 'the south side' });
    prisma.searchZone.findFirst.mockResolvedValue(row('south', { searchCount: 1, searchedAt: ago(40) }));
    await act('again', OWNER, 'z-south');
    expect(prisma.searchZone.updateMany).toHaveBeenCalledWith({ where: { id: 'z-south', searchCount: { gt: 0 }, againAt: null }, data: { againAt: new Date(NOW) } });
    prisma.searchZone.updateMany.mockResolvedValue({ count: 0 });
    expect(await act('again', OWNER, 'z-south')).toEqual({ error: 'ALREADY_AGAIN', title: 'the south side' });
  });

  test('"againAll" puts up every searched area of the circle that nobody is on, and no sighting\'s circle', async () => {
    prisma.searchZone.updateMany.mockResolvedValue({ count: 4 });
    expect(await act('againAll', OWNER, undefined)).toEqual({ count: 4, title: null });
    expect(prisma.searchZone.updateMany).toHaveBeenCalledWith({
      where: { caseId: CASE, ring: { not: RING.SEEN }, searchCount: { gt: 0 }, againAt: null, visits: { none: { endedAt: null, startedAt: { not: null } } } },
      data: { againAt: new Date(NOW) },
    });
  });
});

describe('widening the search', () => {
  test('the owner adds the outer ring, once, and it is kept on the search with who did it', async () => {
    prisma.searchZone.count.mockResolvedValueOnce(0).mockResolvedValueOnce(8);
    expect(await widenCircle({ caseId: CASE, searcher: OWNER, now: NOW })).toEqual({ added: 8, title: null });
    expect(ensureGrid).toHaveBeenCalledWith(CASE);
    expect(prisma.searchGrid.updateMany).toHaveBeenCalledWith({ where: { id: 'grid-1', widenedAt: null }, data: { widenedAt: new Date(NOW), widenedById: 'u-avery' } });
    prisma.searchGrid.updateMany.mockResolvedValue({ count: 0 });
    expect(await widenCircle({ caseId: CASE, searcher: OWNER, now: NOW })).toEqual({ error: 'ALREADY_WIDE', title: null });
  });

  test('nobody else can, and a pet with no search has nothing to widen', async () => {
    expect(await widenCircle({ caseId: CASE, searcher: MIKE, now: NOW })).toEqual({ error: 'NOT_ALLOWED', title: null });
    expect(prisma.searchGrid.updateMany).not.toHaveBeenCalled();
    ensureGrid.mockResolvedValue(null);
    expect(await widenCircle({ caseId: CASE, searcher: OWNER, now: NOW })).toEqual({ error: 'NOT_FOUND', title: null });
  });
});

describe('asking one named person to search one area', () => {
  const JO = { id: 'u-jo', name: 'Jo' };
  const ask = (over = {}) => askZone({ caseId: CASE, zoneId: 'z-west', person: JO, searcher: OWNER, note: '', now: NOW, ...over });

  test('it is for whoever runs the search', async () => {
    expect(await ask({ searcher: MIKE })).toEqual({ error: 'NOT_ALLOWED', title: null });
    expect(prisma.searchZone.findFirst).not.toHaveBeenCalled();
  });

  test('it is a row for that person, with the asker and a note held to a line: it keeps the area from nobody', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('west', { visits: [on({ searcherId: 'u-sarah' })] }));
    const out = await ask({ note: `  Start at the creek path,\nplease. ${'x'.repeat(300)}` });
    expect(out.title).toBe('the west side');
    const { data } = prisma.searchZoneVisit.create.mock.calls[0][0];
    expect(data).toMatchObject({ zoneId: 'z-west', caseId: CASE, searcherId: 'u-jo', searcherName: 'Jo', askedById: 'u-avery', askedByName: 'Avery', askedAt: new Date(NOW) });
    expect(data.askedNote.length).toBeLessThanOrEqual(ASK_NOTE_MAX);
    // One line, trimmed: it is shown on a phone's card as the asker's own words.
    expect(data.askedNote).toMatch(/^Start at the creek path, please\. x/);
    expect(data.askedNote).not.toMatch(/\n/);
    expect(data).not.toHaveProperty('startedAt');
  });

  test('one ask to a person: asking them for another area takes the earlier one back, and only earlier ones', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('west'));
    await ask();
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { caseId: CASE, searcherId: 'u-jo', endedAt: null, startedAt: null, askedAt: { lt: new Date(NOW) } }, data: { endedAt: new Date(NOW), outcome: 'TAKEN_BACK' } });
  });

  test('someone already searching it is not asked to', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('west', { visits: [on({ searcherId: 'u-jo' })] }));
    expect(await ask()).toEqual({ error: 'ON_IT', title: 'the west side' });
    expect(prisma.searchZoneVisit.create).not.toHaveBeenCalled();
  });

  test('one person goes to a sighting: with someone there or freshly asked, nobody else is asked', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('seen-s1', { visits: [on({ zoneId: 'z-seen-s1', searcherId: 'u-sarah' })] }));
    expect(await ask({ zoneId: 'z-seen-s1' })).toEqual({ error: 'ASKED_ALREADY', title: 'where Max was seen' });
    prisma.searchZone.findFirst.mockResolvedValue(row('seen-s1', { visits: [asked({ zoneId: 'z-seen-s1', searcherId: 'u-sarah' })] }));
    expect(await ask({ zoneId: 'z-seen-s1' })).toEqual({ error: 'ASKED_ALREADY', title: 'where Max was seen' });
    // The same person can be asked again, and a lapsed ask of someone else does not hold it.
    prisma.searchZone.findFirst.mockResolvedValue(row('seen-s1', { visits: [asked({ zoneId: 'z-seen-s1', searcherId: 'u-sarah', askedAt: ago(45) })] }));
    expect((await ask({ zoneId: 'z-seen-s1' })).error).toBeUndefined();
  });

  test('an area that is not on the search is not found', async () => {
    expect(await ask()).toEqual({ error: 'NOT_FOUND', title: null });
  });

  test('taking it back is the same person\'s to do, and never takes an area from under someone who started', async () => {
    expect(await unaskZonePerson({ caseId: CASE, person: JO, searcher: MIKE })).toEqual({ error: 'NOT_ALLOWED' });
    prisma.searchZoneVisit.updateMany.mockResolvedValue({ count: 1 });
    expect(await unaskZonePerson({ caseId: CASE, person: JO, searcher: OWNER, now: NOW })).toEqual({ count: 1 });
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { caseId: CASE, searcherId: 'u-jo', endedAt: null, startedAt: null }, data: { endedAt: new Date(NOW), outcome: 'TAKEN_BACK' } });
  });

  test('"I can\'t right now" is the asked person\'s own: the desk is told in the button\'s words, about which area, once', async () => {
    expect(await cannotSearch({ caseId: CASE, searcher: DANA, now: NOW })).toEqual({ error: 'NO_ASK' });
    expect(prisma.searchMessage.create).not.toHaveBeenCalled();
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'v-ask', zone: { name: 'West side' } });
    expect(await cannotSearch({ caseId: CASE, searcher: DANA, now: NOW })).toEqual({ title: 'the west side' });
    expect(prisma.searchZoneVisit.findFirst.mock.calls[1][0].where).toEqual({ caseId: CASE, searcherId: 'v:vol-1', endedAt: null, startedAt: null, askedAt: { not: null } });
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { id: 'v-ask', endedAt: null, startedAt: null }, data: { endedAt: new Date(NOW), outcome: 'CANNOT' } });
    expect(prisma.searchMessage.create).toHaveBeenCalledWith({ data: { caseId: CASE, fromId: 'v:vol-1', fromName: 'Dana', fromDesk: false, toId: null, toName: null, text: CANNOT_WORDS, about: 'the west side' } });
    // Pressed twice: the second finds it already answered and says nothing.
    prisma.searchZoneVisit.updateMany.mockResolvedValue({ count: 0 });
    expect(await cannotSearch({ caseId: CASE, searcher: DANA, now: NOW })).toEqual({ error: 'NO_ASK' });
    expect(prisma.searchMessage.create).toHaveBeenCalledTimes(1);
  });

  test('what was asked of someone, and their screen saying it showed it', async () => {
    expect(await zoneAskWaitingFor(CASE, null)).toBeNull();
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ zoneId: 'z-west' });
    expect(await zoneAskWaitingFor(CASE, 'v:vol-1')).toBe('z-west');
    expect(await markZoneAskSeen(CASE, null)).toBe(0);
    prisma.searchZoneVisit.updateMany.mockResolvedValue({ count: 1 });
    expect(await markZoneAskSeen(CASE, 'v:vol-1', NOW)).toBe(1);
    // Only this person's own ask, and only one not yet marked.
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { caseId: CASE, searcherId: 'v:vol-1', endedAt: null, askedAt: { not: null }, askedSeenAt: null }, data: { askedSeenAt: new Date(NOW) } });
  });
});

describe('what the picture reads', () => {
  test('who is out: on an area now, or said they searched one lately', async () => {
    prisma.searchZoneVisit.findMany.mockResolvedValue([{ searcherId: 'v:vol-1' }, { searcherId: 'u-mike' }]);
    expect(await zoneSearchersSince(CASE, ago(30))).toEqual(['v:vol-1', 'u-mike']);
    expect(prisma.searchZoneVisit.findMany.mock.calls[0][0].where).toEqual({ caseId: CASE, OR: [{ endedAt: null, startedAt: { not: null } }, { outcome: 'SEARCHED', endedAt: { gte: ago(30) } }] });
  });

  test('the ground that was covered, and by whom', async () => {
    prisma.searchZone.count.mockResolvedValue(4);
    prisma.searchZoneVisit.findMany.mockResolvedValue([{ searcherId: 'v:vol-1' }, { searcherId: 'v:vol-1' }]);
    expect(await zoneGroundCovered(CASE)).toEqual({ areas: 4, people: ['v:vol-1', 'v:vol-1'] });
  });

  test('a table that cannot be read counts nobody, and never fails the picture', async () => {
    prisma.searchZoneVisit.findMany.mockRejectedValue(new Error('down'));
    prisma.searchZone.count.mockRejectedValue(new Error('down'));
    expect(await zoneSearchersSince(CASE, ago(30))).toEqual([]);
    expect(await zoneGroundCovered(CASE)).toEqual({ areas: 0, people: [] });
  });

  test('sightings are read as places and times only, and the streets as names and lines', async () => {
    prisma.caseSighting.findMany.mockResolvedValue([sighting({ ownerGoingAt: ago(3) })]);
    expect(await freshSightings(CASE, NOW)).toEqual([{ id: 's1', lat: sighting().latitude, lng: LOST.lng, at: ago(12), ownerGoingAt: ago(3) }]);
    expect(Object.keys(prisma.caseSighting.findMany.mock.calls[0][0].select).sort()).toEqual(['id', 'latitude', 'longitude', 'ownerGoingAt', 'sightedAt']);
    prisma.searchStreet.findMany.mockResolvedValue([{ name: 'Ramsey Ave', fromName: 'W 40th St', toName: null, path: '[[30.31,-97.74],[30.315,-97.741]]' }, { name: 'Broken', fromName: null, toName: null, path: '{' }]);
    expect(await streetNames(CASE)).toEqual([{ name: 'Ramsey Ave', fromName: 'W 40th St', toName: null, path: [[30.31, -97.74], [30.315, -97.741]] }]);
  });
});
