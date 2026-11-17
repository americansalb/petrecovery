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

jest.mock('@/app/lib/prisma', () => {
  const db = {
    case: { findUnique: jest.fn() },
    caseSighting: { findMany: jest.fn(async () => []) },
    searchGrid: { findUnique: jest.fn(async () => null), updateMany: jest.fn(async () => ({ count: 1 })) },
    searchStreet: { findMany: jest.fn(async () => []) },
    searchZone: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null), createMany: jest.fn(async () => ({ count: 0 })), updateMany: jest.fn(async () => ({ count: 1 })), update: jest.fn(async () => ({})), count: jest.fn(async () => 0) },
    searchZoneVisit: { findMany: jest.fn(async () => []), findFirst: jest.fn(async () => null), create: jest.fn(async () => ({ id: 'visit-new' })), updateMany: jest.fn(async () => ({ count: 1 })) },
    searchMessage: { create: jest.fn(async () => ({})) },
    // The lock a sighting's circle is decided under.
    $executeRaw: jest.fn(async () => 1),
  };
  // A transaction reads and writes through the same tables.
  db.$transaction = jest.fn(async (work) => work(db));
  return { __esModule: true, default: db };
});
jest.mock('@/app/lib/searchBoard', () => ({ __esModule: true, ensureGrid: jest.fn(async () => ({ id: 'grid-1' })) }));
jest.mock('@/app/lib/push', () => ({ __esModule: true, isPushConfigured: jest.fn(() => false), sendPushToUser: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { ensureGrid } from '@/app/lib/searchBoard';
import {
  ensureZones, sweepStaleVisits, zoneForBoard, readZones, openAreas, actOnZone, widenCircle, askZone, unaskZonePerson, cannotSearch,
  zoneAskWaitingFor, markZoneAskSeen, zoneSearchersSince, zoneGroundCovered, freshSightings, streetNames,
  ZONE_ACTIONS, ZONE_STEER_ACTIONS, SEEN_CIRCLES_MAX, ASK_STALE_MS, ASK_NOTE_MAX, CANNOT_WORDS, LATE_MS, rankAreas,
} from '@/app/lib/searchZones';
import { RING, CIRCLES, SEEN_CIRCLE_REACH_METERS, areasOf, seenArea, heartOf, minutesFor } from '@/app/lib/searchCircle';
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
      // Austin: a search in the US says its distances in feet and miles.
      id: 'z-west', key: 'west', ring: 1, name: 'West side', title: 'West side', reach: '500 to 1,300 ft west of where Max was lost', landmarks: ['Jefferson St', 'Shoal Creek Blvd'],
      from: 150, to: 400, a: 225, b: 315, minutes: 45, priority: 6, first: false, status: 'UNSEARCHED', on: 0, coming: 0, full: false, searchCount: 0, marked: false, mine: false,
    });
    expect(out.outline[0]).toEqual(out.outline[out.outline.length - 1]);
    expect(out.center.lng).toBeLessThan(LOST.lng);
  });

  test('a search outside the US says its distances in metres', () => {
    // Coyoacán, Mexico City.
    const coyoacan = { lat: 19.3467, lng: -99.1617 };
    expect(zoneForBoard(row('west', { center: coyoacan }), ctx()).reach).toBe('150 m to 400 m west of where Max was lost');
    expect(zoneForBoard(row('middle', { center: coyoacan }), ctx()).reach).toBe('Within 150 m of where Max was lost');
    expect(zoneForBoard(row('middle'), ctx()).reach).toBe('Within 500 ft of where Max was lost');
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

  test('the record keeps how long each search took, to the tenth of a minute: a search of fourteen seconds is not a search of unknown length', () => {
    const history = new Map([
      [
        'z-west',
        [
          { zoneId: 'z-west', searcherId: 'v:vol-1', searcherName: 'Dana', startedAt: new Date(NOW - 14000), endedAt: new Date(NOW), outcome: 'SEARCHED', covered: 'MOST' },
          { zoneId: 'z-west', searcherId: 'u-mike', searcherName: 'Mike', startedAt: ago(200), endedAt: ago(160), outcome: 'SEARCHED', covered: null },
          // Said after the site had stopped counting Jo there: dated when it stopped, and how long is not known.
          { zoneId: 'z-west', searcherId: 'u-jo', searcherName: 'Jo', startedAt: ago(600), endedAt: ago(465), outcome: 'SEARCHED', covered: null },
          { zoneId: 'z-west', searcherId: 'm:u-avery', searcherName: 'Avery', startedAt: null, endedAt: ago(700), outcome: 'MARKED', covered: null },
        ],
      ],
    ]);
    expect(zoneForBoard(row('west'), ctx({ history })).history).toEqual([
      { at: new Date(NOW), marked: false, minutes: 0.2, covered: 'MOST' },
      { at: ago(160), marked: false, minutes: 40, covered: null },
      { at: ago(465), marked: false, minutes: null, covered: null, late: true },
      { at: ago(700), marked: true, minutes: null, covered: null },
    ]);
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

  test('up for another look stays so while someone is on it: the state says who is there, `again` says it still needs the search', () => {
    expect(zoneForBoard(row('west', { searchCount: 1, searchedAt: ago(30), againAt: ago(5) }), ctx())).toMatchObject({ status: 'NEEDS_REVISIT', again: true });
    expect(zoneForBoard(row('west', { searchCount: 1, searchedAt: ago(30), againAt: ago(5), visits: [on()] }), ctx())).toMatchObject({ status: 'IN_PROGRESS', again: true });
    expect(zoneForBoard(row('west', { searchCount: 1, searchedAt: ago(30) }), ctx()).again).toBe(false);
    expect(zoneForBoard(row('west'), ctx()).again).toBe(false);
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
      expect(zoneForBoard(circle(), ctx({ sightings: seen }))).toMatchObject({ ring: RING.SEEN, name: 'Where Max was seen', reach: 'Within 500 ft of where Max was seen', minutes: 30, priority: 10, full: false, sightingId: 's1', sightingAt: ago(12) });
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

  test('a sighting far from the search gets no circle: nobody is sent across a city or a country to it', async () => {
    // Chicago, for a dog lost in Austin; and one 3 km north, which a helper on foot can still reach.
    const chicago = sighting({ id: 's-chicago', latitude: 41.8781, longitude: -87.6298, sightedAt: ago(2) });
    const near = sighting({ id: 's-near', latitude: LOST.lat + 3000 / 111320, sightedAt: ago(5) });
    const across = sighting({ id: 's-across', latitude: LOST.lat + 6000 / 111320, sightedAt: ago(3) });
    prisma.searchZone.findMany.mockResolvedValue(['middle', 'north', 'east', 'south', 'west'].map((key) => row(key)));
    prisma.caseSighting.findMany.mockResolvedValue([chicago, across, near]);
    const made = await ensureZones(CASE, { now: NOW });
    expect(SEEN_CIRCLE_REACH_METERS).toBe(5000);
    expect(prisma.searchZone.createMany.mock.calls[0][0].data.map((d) => d.key)).toEqual(['seen-s-near']);
    // The far ones stay sightings (on the map, and on the owner's screen); they are not ground.
    expect(made.sightings.map((x) => x.id)).toEqual(['s-chicago', 's-across', 's-near']);
    expect(made.seenNear.map((x) => x.id)).toEqual(['s-near']);
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
  test('someone not heard from in two hours, or half an hour past when the desk is told, is no longer counted as on it', async () => {
    prisma.searchZoneVisit.findMany.mockResolvedValue([
      // 45 minutes of ground: the desk is told at 105 minutes, and the site stops counting at 135.
      { id: 'gone', startedAt: ago(140), zone: { minutes: 45 } },
      // 75 minutes of ground is counted until 195.
      { id: 'careful', startedAt: ago(140), zone: { minutes: 75 } },
      // A small area: two hours, never less.
      { id: 'short', startedAt: ago(125), zone: { minutes: 15 } },
      { id: 'in-time', startedAt: ago(130), zone: { minutes: 45 } },
      { id: 'old-ask', startedAt: null, askedAt: ago(13 * 60), zone: { minutes: 45 } },
    ]);
    expect(await sweepStaleVisits(CASE, NOW)).toBe(3);
    // Each is ended when it went stale, and only if it is still open.
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledTimes(3);
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { id: 'gone', endedAt: null }, data: { endedAt: ago(5), outcome: 'LAPSED' } });
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { id: 'short', endedAt: null }, data: { endedAt: ago(5), outcome: 'LAPSED' } });
    // An ask is over half a day after it was made.
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { id: 'old-ask', endedAt: null }, data: { endedAt: ago(60), outcome: 'LAPSED' } });
    const { where } = prisma.searchZoneVisit.findMany.mock.calls[0][0];
    // Nothing started in the last two hours is looked at.
    expect(where.OR[0]).toEqual({ startedAt: { lt: new Date(NOW - 120 * 60000) } });
    // An ask nobody started in half a day is over.
    expect(where.OR[1]).toEqual({ startedAt: null, askedAt: { lt: new Date(NOW - ASK_STALE_MS) } });
  });

  test('with nobody stale, nothing is written', async () => {
    expect(await sweepStaleVisits(CASE, NOW)).toBe(0);
    expect(prisma.searchZoneVisit.updateMany).not.toHaveBeenCalled();
  });

  test('an area taken on Friday and swept on Sunday was let go on Friday: the release is dated when it went stale, not when someone next looked', async () => {
    const friday = new Date('2026-11-06T20:12:00-06:00');
    const sunday = new Date('2026-11-08T14:00:00-06:00').getTime();
    prisma.searchZoneVisit.findMany.mockResolvedValue([{ id: 'abandoned', startedAt: friday, askedAt: null, zone: { minutes: 45 } }]);
    expect(await sweepStaleVisits(CASE, sunday)).toBe(1);
    // 45 minutes of ground is counted for 135: until 10:27 pm on Friday.
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { id: 'abandoned', endedAt: null }, data: { endedAt: new Date('2026-11-06T22:27:00-06:00'), outcome: 'LAPSED' } });
  });

  test('a visit someone ended in the same moment keeps its own end, and is not counted', async () => {
    prisma.searchZoneVisit.findMany.mockResolvedValue([{ id: 'gone', startedAt: ago(140), zone: { minutes: 45 } }]);
    prisma.searchZoneVisit.updateMany.mockResolvedValue({ count: 0 });
    expect(await sweepStaleVisits(CASE, NOW)).toBe(0);
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

  test('a circle made for a far sighting before the board left them out drops off it, unless someone is there', async () => {
    const chicago = sighting({ id: 's-chicago', latitude: 41.8781, longitude: -87.6298, sightedAt: ago(2) });
    prisma.caseSighting.findMany.mockResolvedValue([chicago]);
    const far = row('seen-s-chicago', { center: { lat: chicago.latitude, lng: chicago.longitude } });
    prisma.searchZone.findMany.mockResolvedValue(stored([far]));
    const out = await readZones(CASE, { now: NOW });
    expect(out.areas.map((a) => a.key)).toEqual(['middle', 'north', 'east', 'south', 'west']);
    expect(rankAreas(out.areas)[0].key).toBe('middle');
    prisma.searchZone.findMany.mockResolvedValue(stored([{ ...far, visits: [on({ zoneId: far.id })] }]));
    expect((await readZones(CASE, { now: NOW })).areas.map((a) => a.key)).toContain('seen-s-chicago');
  });

  test('the circle round a sighting says how far it is from where the pet was lost', async () => {
    prisma.caseSighting.findMany.mockResolvedValue([sighting()]);
    prisma.searchZone.findMany.mockResolvedValue(stored([row('seen-s1', { center: { lat: sighting().latitude, lng: sighting().longitude } })]));
    const seen = (await readZones(CASE, { now: NOW })).areas.find((a) => a.key === 'seen-s1');
    expect(seen.reach).toBe('Within 500 ft of where Max was seen, 1,000 ft south of where Max was lost');
  });

  test('a circle whose sighting is old leaves the board, unless someone is still there', async () => {
    const old = row('seen-s0', { center: LOST });
    prisma.searchZone.findMany.mockResolvedValue(stored([old]));
    expect((await readZones(CASE, { now: NOW })).areas.map((a) => a.key)).not.toContain('seen-s0');
    prisma.searchZone.findMany.mockResolvedValue(stored([{ ...old, visits: [on({ zoneId: old.id })] }]));
    expect((await readZones(CASE, { now: NOW })).areas.map((a) => a.key)).toContain('seen-s0');
  });

  test('an ask to go to a circle that has left the board is over: the phone and the desk stop saying the person is asked', async () => {
    const old = row('seen-s0', { center: LOST, visits: [asked({ id: 'v-ask', zoneId: 'z-seen-s0', searcherId: 'u-jo' })] });
    prisma.searchZone.findMany.mockResolvedValue(stored([old]));
    const out = await readZones(CASE, { viewer: 'u-jo', now: NOW });
    expect(out.areas.map((a) => a.key)).not.toContain('seen-s0');
    expect(out.areas.some((a) => a.askedOfMe)).toBe(false);
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['v-ask'] }, endedAt: null, startedAt: null }, data: { endedAt: new Date(NOW), outcome: 'LAPSED' } });
    // While the sighting is fresh the ask stands, and nothing is ended.
    prisma.searchZoneVisit.updateMany.mockClear();
    prisma.caseSighting.findMany.mockResolvedValue([sighting({ id: 's0' })]);
    expect((await readZones(CASE, { viewer: 'u-jo', now: NOW })).areas.find((a) => a.key === 'seen-s0')).toMatchObject({ askedOfMe: true });
    expect(prisma.searchZoneVisit.updateMany).not.toHaveBeenCalled();
  });

  test('out longer than the site allowed for: to everyone else they are no longer on it, and their own card stays', async () => {
    prisma.searchZone.findMany.mockResolvedValue(stored());
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'v-late', zoneId: 'z-west', outcome: 'LAPSED', endedAt: ago(30) });
    const theirs = (await readZones(CASE, { viewer: 'v:vol-1', now: NOW })).areas.find((a) => a.key === 'west');
    // Theirs to finish, and nobody is counted as on it.
    expect(theirs).toMatchObject({ mine: true, on: 0, status: 'UNSEARCHED' });
    expect(prisma.searchZoneVisit.findFirst).toHaveBeenCalledWith({
      where: { caseId: CASE, searcherId: 'v:vol-1', startedAt: { not: null } },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      select: { id: true, zoneId: true, outcome: true, startedAt: true, endedAt: true, zone: { select: { minutes: true } } },
    });
    // Whatever they started last decides: an area they gave back, stopped, searched or are on is not this.
    for (const outcome of ['GAVE_BACK', 'STOPPED', 'SEARCHED', null]) {
      prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'v-late', zoneId: 'z-west', outcome, endedAt: outcome ? ago(30) : null });
      expect((await readZones(CASE, { viewer: 'v:vol-1', now: NOW })).areas.some((a) => a.mine)).toBe(false);
    }
    // And only for half a day.
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'v-late', zoneId: 'z-west', outcome: 'LAPSED', endedAt: new Date(NOW - LATE_MS - 60000) });
    expect((await readZones(CASE, { viewer: 'v:vol-1', now: NOW })).areas.some((a) => a.mine)).toBe(false);
  });

  test('half a day from when it went stale, not from when it was swept: an area taken two days ago is off their phone, as the desk says', async () => {
    prisma.searchZone.findMany.mockResolvedValue(stored());
    // Swept a few minutes ago by an older sweep that stamped its own moment, though it was taken two days ago.
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'v-late', zoneId: 'z-west', outcome: 'LAPSED', startedAt: ago(48 * 60), endedAt: ago(5), zone: { minutes: 45 } });
    expect((await readZones(CASE, { viewer: 'v:vol-1', now: NOW })).areas.some((a) => a.mine)).toBe(false);
    // Taken three hours ago, it went stale 45 minutes ago: still theirs to say.
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'v-late', zoneId: 'z-west', outcome: 'LAPSED', startedAt: ago(180), endedAt: ago(45), zone: { minutes: 45 } });
    expect((await readZones(CASE, { viewer: 'v:vol-1', now: NOW })).areas.find((a) => a.key === 'west').mine).toBe(true);
  });

  test('asked since to search the same area, they see the ask: it is the newer word', async () => {
    prisma.searchZone.findMany.mockResolvedValue(stored().map((z) => (z.key === 'west' ? { ...z, visits: [asked({ id: 'v-ask', zoneId: 'z-west' })] } : z)));
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'v-late', zoneId: 'z-west', outcome: 'LAPSED', endedAt: ago(30) });
    const west = (await readZones(CASE, { viewer: 'v:vol-1', ownerId: 'u-avery', ownerName: 'Avery', now: NOW })).areas.find((a) => a.key === 'west');
    expect(west).toMatchObject({ askedOfMe: true, mine: false });
  });

  test('that is asked only for the person reading, and not while they are on an area', async () => {
    prisma.searchZone.findMany.mockResolvedValue(stored());
    await readZones(CASE, { now: NOW });
    expect(prisma.searchZoneVisit.findFirst).not.toHaveBeenCalled();
    prisma.searchZone.findMany.mockResolvedValue(stored().map((z) => (z.key === 'north' ? { ...z, visits: [on({ zoneId: 'z-north' })] } : z)));
    await readZones(CASE, { viewer: 'v:vol-1', now: NOW });
    expect(prisma.searchZoneVisit.findFirst).not.toHaveBeenCalled();
  });

  test('a sighting\'s circle someone else has since gone to is theirs, not the person the site stopped counting', async () => {
    prisma.caseSighting.findMany.mockResolvedValue([sighting()]);
    prisma.searchZone.findMany.mockResolvedValue(stored([row('seen-s1', { center: { lat: sighting().latitude, lng: sighting().longitude }, visits: [on({ zoneId: 'z-seen-s1', searcherId: 'u-sarah' })] })]));
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'v-late', zoneId: 'z-seen-s1', outcome: 'LAPSED', endedAt: ago(30) });
    expect((await readZones(CASE, { viewer: 'v:vol-1', now: NOW })).areas.find((a) => a.key === 'seen-s1')).toMatchObject({ mine: false, full: true });
  });

  test('the paw prints leave out a search far shorter than its area takes, and the debrief on it', async () => {
    prisma.searchZone.findMany.mockResolvedValue(stored());
    // The sweep reads first and finds nothing; then every finished search.
    prisma.searchZoneVisit.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      // "I searched it" fourteen seconds after taking the west side, which takes 45 minutes, and "All of it".
      { zoneId: 'z-west', searcherId: 'v:vol-1', startedAt: new Date(NOW - 14000), endedAt: new Date(NOW), outcome: 'SEARCHED', covered: 'ALL' },
      // 38 minutes on the north side.
      { zoneId: 'z-north', searcherId: 'v:vol-1', startedAt: ago(40), endedAt: ago(2), outcome: 'SEARCHED', covered: 'PART' },
    ]);
    const out = await readZones(CASE, { viewer: 'v:vol-1', now: NOW });
    expect(out.trail).toEqual({ paws: 4, helpers: 1, mine: { searches: 1, debriefs: 1, paws: 4, rank: 'Scout' } });
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
    // With what the order is worked out from, so the page that ranks them again for the nearest gets the same order.
    expect(jobs[0]).toMatchObject({ id: 'z-south', unit: 'area', ring: 1, status: 'UNSEARCHED', priority: 10, first: false, again: false, minutes: 45, reach: '500 to 1,300 ft south of where Max was lost', on: 0, askedOfMe: false });
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
    expect(prisma.searchZoneVisit.create).toHaveBeenCalledWith({ data: { zoneId: 'z-west', caseId: CASE, searcherId: 'v:vol-1', searcherName: 'Dana', startedAt: new Date(NOW) } });
    expect(out).toMatchObject({ title: 'the west side', item: { id: 'z-west', status: 'IN_PROGRESS', mine: true, on: 1 } });
    // They have the new one before the old one is given back, and plain ground needs no lock.
    expect(prisma.searchZoneVisit.create.mock.invocationCallOrder[0]).toBeLessThan(prisma.searchZoneVisit.updateMany.mock.invocationCallOrder[0]);
    expect(prisma.$transaction).not.toHaveBeenCalled();
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

  test('an ask taken back in the same moment starts the area all the same: they pressed Start', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('west', { visits: [asked({ id: 'v-ask' })] }));
    prisma.searchZoneVisit.updateMany.mockResolvedValueOnce({ count: 0 });
    await act('claim', DANA);
    expect(prisma.searchZoneVisit.create).toHaveBeenCalledTimes(1);
  });

  test('a sighting\'s circle with someone there answers TAKEN, and nothing of theirs is given back', async () => {
    prisma.caseSighting.findMany.mockResolvedValue([sighting()]);
    const there = [on({ zoneId: 'z-seen-s1', searcherId: 'u-sarah' })];
    prisma.searchZone.findFirst.mockResolvedValue(row('seen-s1', { visits: there }));
    prisma.searchZoneVisit.findMany.mockResolvedValue(there);
    expect(await act('claim', DANA, 'z-seen-s1')).toEqual({ error: 'TAKEN', title: 'where Max was seen' });
    expect(prisma.searchZoneVisit.updateMany).not.toHaveBeenCalled();
    expect(prisma.searchZoneVisit.create).not.toHaveBeenCalled();
  });

  test('two people ask for the same sighting in the same moment: who goes is decided one request at a time', async () => {
    prisma.caseSighting.findMany.mockResolvedValue([sighting()]);
    // Nobody was there when this request first looked.
    prisma.searchZone.findFirst.mockResolvedValue(row('seen-s1'));
    // By the time it holds the lock, the other request has written its person down.
    prisma.searchZoneVisit.findMany.mockResolvedValue([on({ zoneId: 'z-seen-s1', searcherId: 'u-sarah' })]);
    expect(await act('claim', DANA, 'z-seen-s1')).toEqual({ error: 'TAKEN', title: 'where Max was seen' });
    expect(prisma.searchZoneVisit.create).not.toHaveBeenCalled();
    expect(prisma.searchZoneVisit.updateMany).not.toHaveBeenCalled();
    // The lock is taken first, then who is there is read, inside one transaction.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // Read committed: the read after the lock sees what the other request wrote before letting go of it.
    expect(prisma.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'ReadCommitted' });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$executeRaw.mock.calls[0][0].join('?')).toMatch(/pg_advisory_xact_lock\(7304, hashtext\(\?\)\)/);
    expect(prisma.$executeRaw.mock.calls[0][1]).toBe('z-seen-s1');
    expect(prisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.searchZoneVisit.findMany.mock.invocationCallOrder[0]);
    expect(prisma.searchZoneVisit.findMany).toHaveBeenCalledWith({ where: { zoneId: 'z-seen-s1', endedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  });

  test('with nobody there, the one who holds the lock goes: written under it, and anyone asked long ago is no longer asked', async () => {
    prisma.caseSighting.findMany.mockResolvedValue([sighting()]);
    prisma.searchZone.findFirst.mockResolvedValue(row('seen-s1'));
    // Someone was asked 45 minutes ago, which no longer keeps it for them.
    prisma.searchZoneVisit.findMany.mockResolvedValue([asked({ id: 'v-old-ask', zoneId: 'z-seen-s1', searcherId: 'u-jo', askedAt: ago(45) })]);
    expect((await act('claim', DANA, 'z-seen-s1')).error).toBeUndefined();
    expect(prisma.searchZoneVisit.create).toHaveBeenCalledWith({ data: { zoneId: 'z-seen-s1', caseId: CASE, searcherId: 'v:vol-1', searcherName: 'Dana', startedAt: new Date(NOW) } });
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { zoneId: 'z-seen-s1', endedAt: null, startedAt: null, NOT: { searcherId: 'v:vol-1' } }, data: { endedAt: new Date(NOW), outcome: 'LAPSED' } });
    expect(prisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.searchZoneVisit.create.mock.invocationCallOrder[0]);
    // A fresh ask of someone else keeps it for them.
    prisma.searchZoneVisit.create.mockClear();
    prisma.searchZoneVisit.findMany.mockResolvedValue([asked({ id: 'v-ask', zoneId: 'z-seen-s1', searcherId: 'u-jo', askedAt: ago(5) })]);
    expect((await act('claim', DANA, 'z-seen-s1')).error).toBe('TAKEN');
    expect(prisma.searchZoneVisit.create).not.toHaveBeenCalled();
  });

  test('the owner having set off keeps it from everyone but the person the owner asked to go', async () => {
    prisma.caseSighting.findMany.mockResolvedValue([sighting({ ownerGoingAt: ago(10) })]);
    prisma.searchZone.findFirst.mockResolvedValue(row('seen-s1'));
    prisma.searchZoneVisit.findMany.mockResolvedValue([]);
    expect((await act('claim', MIKE, 'z-seen-s1')).error).toBe('TAKEN');
    // Asked by the owner, after or before the owner set off: the ask is the owner's own word.
    const mine = asked({ id: 'v-ask', zoneId: 'z-seen-s1', searcherId: 'u-mike', searcherName: 'Mike' });
    prisma.searchZoneVisit.findMany.mockResolvedValue([mine]);
    expect((await act('claim', MIKE, 'z-seen-s1')).error).toBeUndefined();
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { id: 'v-ask', endedAt: null }, data: { startedAt: new Date(NOW), searcherName: 'Mike', askedSeenAt: new Date(NOW) } });
    // And the board says the same to each of them.
    const ring = row('seen-s1', { visits: [mine] });
    const going = [{ id: 's1', lat: LOST.lat, lng: LOST.lng, at: ago(12), ownerGoingAt: ago(10) }];
    expect(zoneForBoard(ring, { viewer: 'u-mike', ownerId: 'u-avery', sightings: going, now: NOW })).toMatchObject({ askedOfMe: true, full: false });
    expect(zoneForBoard(ring, { viewer: 'v:vol-1', ownerId: 'u-avery', sightings: going, now: NOW })).toMatchObject({ full: true });
    expect(zoneForBoard(ring, { viewer: 'u-avery', ownerId: 'u-avery', sightings: going, now: NOW })).toMatchObject({ full: true, going: { at: ago(10) } });
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

  test('"I searched it" fourteen seconds after taking an area is kept as the search it was, and leaves no paw prints', async () => {
    prisma.searchZone.findFirst.mockResolvedValueOnce(row('west', { visits: [on({ startedAt: new Date(NOW - 14000) })] })).mockResolvedValue(row('west', { searchCount: 1, searchedAt: new Date(NOW) }));
    const quick = await act('searched', DANA);
    expect(quick.paws).toBe(0);
    // It is still written as a search, with its own time: the record and the map say what it was worth.
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { zoneId: 'z-west', searcherId: 'v:vol-1', endedAt: null, startedAt: { not: null } }, data: { endedAt: new Date(NOW), outcome: 'SEARCHED' } });
    expect(prisma.searchZone.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ searchCount: { increment: 1 } }) }));
    // The west side takes 45 minutes. Under a third of that is far shorter than it takes; twenty minutes covered real ground.
    prisma.searchZone.findFirst.mockReset();
    prisma.searchZone.findFirst.mockResolvedValueOnce(row('west', { visits: [on({ startedAt: ago(14) })] })).mockResolvedValue(row('west'));
    expect((await act('searched', DANA)).paws).toBe(0);
    prisma.searchZone.findFirst.mockResolvedValueOnce(row('west', { visits: [on({ startedAt: ago(20) })] })).mockResolvedValue(row('west'));
    expect((await act('searched', DANA)).paws).toBe(3);
    // Stopping leaves none, and says none.
    prisma.searchZone.findFirst.mockResolvedValue(row('west', { visits: [on()] }));
    expect(await act('release', DANA)).not.toHaveProperty('paws');
  });

  test('"I searched it" from a phone that has not read the board since the site stopped counting them is said late: dated when it went stale, never now', async () => {
    // Taken three hours ago on a 45-minute area: the site stopped counting at 135 minutes, 45 minutes ago, and nothing has swept since.
    prisma.searchZone.findFirst.mockResolvedValue(row('west', { visits: [on({ id: 'v-old', startedAt: ago(180) })], updatedAt: ago(300) }));
    // Ended as the sweep would end it; then nothing of theirs is open to end, and it is answered as a late word.
    prisma.searchZoneVisit.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'v-old', zoneId: 'z-west', outcome: 'LAPSED', startedAt: ago(180), endedAt: ago(45), zone: { minutes: 45 } });
    const out = await act('searched', DANA);
    expect(out.error).toBeUndefined();
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenNthCalledWith(1, { where: { id: 'v-old', endedAt: null }, data: { endedAt: ago(45), outcome: 'LAPSED' } });
    expect(prisma.searchZone.update).toHaveBeenCalledWith({ where: { id: 'z-west' }, data: { searchCount: { increment: 1 }, searchedAt: ago(45), searchedById: 'v:vol-1', searchedByName: 'Dana', againAt: null } });
    // How long they were on the ground is not known, so it is not called short.
    expect(out.paws).toBe(3);
  });

  test('taken on Friday and said on Sunday, it is too late to count, and nothing is written as a search', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('west', { visits: [on({ id: 'v-old', startedAt: ago(48 * 60) })] }));
    prisma.searchZoneVisit.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'v-old', zoneId: 'z-west', outcome: 'LAPSED', startedAt: ago(48 * 60), endedAt: ago(48 * 60 - 135), zone: { minutes: 45 } });
    expect(await act('searched', DANA)).toEqual({ error: 'NOT_CLAIMED', title: 'the west side' });
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenNthCalledWith(1, { where: { id: 'v-old', endedAt: null }, data: { endedAt: ago(48 * 60 - 135), outcome: 'LAPSED' } });
    expect(prisma.searchZone.update).not.toHaveBeenCalled();
  });

  test('out longer than the site allowed for, "I searched it" still counts, once, and is dated when they were last counted there', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('west', { updatedAt: ago(300) }));
    // No open visit of theirs: the site stopped counting them 40 minutes ago. The last area they started is this one.
    prisma.searchZoneVisit.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'v-late', zoneId: 'z-west', outcome: 'LAPSED', endedAt: ago(40) });
    expect((await act('searched', DANA)).error).toBeUndefined();
    // The visit keeps the time the site stopped counting them: only what it ended as changes.
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenLastCalledWith({ where: { id: 'v-late', outcome: 'LAPSED' }, data: { outcome: 'SEARCHED', endedAt: ago(40) } });
    // The search is not dated now: nobody was there in the last 40 minutes.
    expect(prisma.searchZone.update).toHaveBeenCalledWith({ where: { id: 'z-west' }, data: { searchCount: { increment: 1 }, searchedAt: ago(40), searchedById: 'v:vol-1', searchedByName: 'Dana', againAt: null } });

    // Pressed twice: the second request finds the visit already counted, and counts nothing.
    prisma.searchZone.update.mockClear();
    prisma.searchZoneVisit.updateMany.mockReset();
    prisma.searchZoneVisit.updateMany.mockResolvedValue({ count: 0 });
    expect(await act('searched', DANA)).toEqual({ error: 'NOT_CLAIMED', title: 'the west side' });
    expect(prisma.searchZone.update).not.toHaveBeenCalled();

    // The last area they started was another one, or they gave it back: this is not theirs to count.
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'v-late', zoneId: 'z-north', outcome: 'LAPSED', endedAt: ago(40) });
    expect(await act('searched', DANA)).toEqual({ error: 'NOT_CLAIMED', title: 'the west side' });
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'v-late', zoneId: 'z-west', outcome: 'GAVE_BACK', endedAt: ago(40) });
    expect(await act('searched', DANA)).toEqual({ error: 'NOT_CLAIMED', title: 'the west side' });
    // The owner put the area down as searched since, which settled it.
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'v-late', zoneId: 'z-west', outcome: 'PUT_DOWN', endedAt: ago(40) });
    expect(await act('searched', DANA)).toEqual({ error: 'NOT_CLAIMED', title: 'the west side' });
    // And after half a day it is not.
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'v-late', zoneId: 'z-west', outcome: 'LAPSED', endedAt: new Date(NOW - LATE_MS - 60000) });
    expect(await act('searched', DANA)).toEqual({ error: 'NOT_CLAIMED', title: 'the west side' });
    expect(prisma.searchZone.update).not.toHaveBeenCalled();
  });

  describe('a late "I searched it" undoes nothing done on the area since they were last counted there', () => {
    const late = (zone) => {
      prisma.searchZone.findFirst.mockResolvedValue(zone);
      prisma.searchZoneVisit.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
      prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'v-late', zoneId: 'z-west', outcome: 'LAPSED', endedAt: ago(40) });
      return act('searched', DANA);
    };
    const written = () => prisma.searchZone.update.mock.calls[0][0].data;

    test('someone searched it after them: that search stays the last one, and theirs is counted', async () => {
      await late(row('west', { searchCount: 1, searchedAt: ago(10), searchedById: 'u-mike', searchedByName: 'Mike', updatedAt: ago(10) }));
      expect(written()).toEqual({ searchCount: { increment: 1 }, againAt: null });
    });

    test('searched before them: theirs becomes the last one, dated when they were last counted', async () => {
      await late(row('west', { searchCount: 1, searchedAt: ago(300), searchedById: 'u-mike', searchedByName: 'Mike', updatedAt: ago(300) }));
      expect(written()).toEqual({ searchCount: { increment: 1 }, searchedAt: ago(40), searchedById: 'v:vol-1', searchedByName: 'Dana', againAt: null });
    });

    test('the owner asked for another look since: it still stands', async () => {
      await late(row('west', { searchCount: 1, searchedAt: ago(300), againAt: ago(20), updatedAt: ago(20) }));
      expect(written()).not.toHaveProperty('againAt');
      expect(written()).toMatchObject({ searchCount: { increment: 1 }, searchedAt: ago(40) });
    });

    test('another look asked for before they went out is answered by their search', async () => {
      await late(row('west', { searchCount: 1, searchedAt: ago(300), againAt: ago(200), updatedAt: ago(200) }));
      expect(written()).toMatchObject({ againAt: null });
    });

    test('"send people here first" from before they went out is met; one made since is not taken back', async () => {
      await late(row('west', { priority: FIRST_PRIORITY, updatedAt: ago(200) }));
      expect(prisma.searchZone.updateMany).toHaveBeenCalledWith({ where: { id: 'z-west', priority: { gte: FIRST_PRIORITY } }, data: { priority: 5 } });
      jest.clearAllMocks();
      await late(row('west', { priority: FIRST_PRIORITY, updatedAt: ago(15) }));
      expect(prisma.searchZone.updateMany).not.toHaveBeenCalled();
      expect(prisma.searchZone.update).toHaveBeenCalledTimes(1);
    });
  });

  test('and "I am stopping" takes the card off their screen without counting a search', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('west'));
    prisma.searchZoneVisit.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    prisma.searchZoneVisit.findFirst.mockResolvedValue({ id: 'v-late', zoneId: 'z-west', outcome: 'LAPSED', endedAt: ago(40) });
    expect((await act('release', DANA)).error).toBeUndefined();
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenLastCalledWith({ where: { id: 'v-late', outcome: 'LAPSED' }, data: { outcome: 'STOPPED', endedAt: ago(40) } });
    expect(prisma.searchZone.update).not.toHaveBeenCalled();
  });

  test('"I am stopping" is leaving, kept apart from an area given back to take another, and only your own', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('west', { visits: [on()] }));
    await act('release', DANA);
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { zoneId: 'z-west', searcherId: 'v:vol-1', endedAt: null, startedAt: { not: null } }, data: { endedAt: new Date(NOW), outcome: 'STOPPED' } });
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
    // Kept as a search of its own, with no start: a record of the search, and nobody counted as out on the area.
    expect(prisma.searchZoneVisit.create).toHaveBeenCalledTimes(1);
    const kept = prisma.searchZoneVisit.create.mock.calls[0][0].data;
    expect(kept).toMatchObject({ zoneId: 'z-east', outcome: 'MARKED', endedAt: expect.any(Date) });
    expect(kept.searcherId).toMatch(/^m:/);
    expect(kept).not.toHaveProperty('startedAt');
  });

  test('and it settles whoever the site had stopped counting there: their card comes off, so one search is not counted twice', async () => {
    prisma.searchZone.findFirst.mockResolvedValue(row('east'));
    expect((await act('walked', OWNER, 'z-east')).error).toBeUndefined();
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { zoneId: 'z-east', outcome: 'LAPSED', startedAt: { not: null } }, data: { outcome: 'PUT_DOWN' } });
    // Refused, it settles nobody.
    prisma.searchZoneVisit.updateMany.mockClear();
    prisma.searchZone.updateMany.mockResolvedValue({ count: 0 });
    expect((await act('walked', OWNER, 'z-east')).error).toBe('ALREADY_WALKED');
    expect(prisma.searchZoneVisit.updateMany).not.toHaveBeenCalled();
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
    const there = [on({ zoneId: 'z-seen-s1', searcherId: 'u-sarah' })];
    prisma.searchZone.findFirst.mockResolvedValue(row('seen-s1', { visits: there }));
    prisma.searchZoneVisit.findMany.mockResolvedValue(there);
    expect(await ask({ zoneId: 'z-seen-s1' })).toEqual({ error: 'ASKED_ALREADY', title: 'where Max was seen' });
    const freshAsk = [asked({ zoneId: 'z-seen-s1', searcherId: 'u-sarah' })];
    prisma.searchZone.findFirst.mockResolvedValue(row('seen-s1', { visits: freshAsk }));
    prisma.searchZoneVisit.findMany.mockResolvedValue(freshAsk);
    expect(await ask({ zoneId: 'z-seen-s1' })).toEqual({ error: 'ASKED_ALREADY', title: 'where Max was seen' });
    expect(prisma.searchZoneVisit.create).not.toHaveBeenCalled();
  });

  test('once the first ask no longer keeps it, asking someone else takes the first one back: one person is asked to go', async () => {
    const oldAsk = [asked({ zoneId: 'z-seen-s1', searcherId: 'u-sarah', askedAt: ago(45) })];
    prisma.searchZone.findFirst.mockResolvedValue(row('seen-s1', { visits: oldAsk }));
    prisma.searchZoneVisit.findMany.mockResolvedValue(oldAsk);
    expect((await ask({ zoneId: 'z-seen-s1' })).error).toBeUndefined();
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledWith({ where: { zoneId: 'z-seen-s1', endedAt: null, startedAt: null, NOT: { searcherId: 'u-jo' } }, data: { endedAt: new Date(NOW), outcome: 'TAKEN_BACK' } });
    expect(prisma.searchZoneVisit.create).toHaveBeenCalledTimes(1);
    // On plain ground an ask keeps nothing from anyone, so nobody else's ask is touched.
    prisma.searchZoneVisit.updateMany.mockClear();
    prisma.searchZone.findFirst.mockResolvedValue(row('west', { visits: [asked({ searcherId: 'u-sarah', askedAt: ago(45) })] }));
    await ask();
    expect(prisma.searchZoneVisit.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.searchZoneVisit.updateMany.mock.calls[0][0].where).toMatchObject({ searcherId: 'u-jo' });
  });

  test('an ask to go to a sighting and someone setting off for it cannot both stand: they are decided under the same lock', async () => {
    // Nobody was there when the ask first looked.
    prisma.searchZone.findFirst.mockResolvedValue(row('seen-s1'));
    // By the time it holds the lock, someone has set off.
    prisma.searchZoneVisit.findMany.mockResolvedValue([on({ zoneId: 'z-seen-s1', searcherId: 'u-sarah' })]);
    expect(await ask({ zoneId: 'z-seen-s1' })).toEqual({ error: 'ASKED_ALREADY', title: 'where Max was seen' });
    expect(prisma.searchZoneVisit.create).not.toHaveBeenCalled();
    expect(prisma.$executeRaw.mock.calls[0][1]).toBe('z-seen-s1');
    expect(prisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.searchZoneVisit.findMany.mock.invocationCallOrder[0]);
    // Plain ground takes no lock.
    prisma.$transaction.mockClear();
    prisma.searchZone.findFirst.mockResolvedValue(row('west'));
    await ask();
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
    expect(prisma.searchZoneVisit.findMany.mock.calls[0][0].where).toEqual({ caseId: CASE, OR: [{ endedAt: null, startedAt: { not: null } }, { outcome: { in: ['SEARCHED', 'STOPPED'] }, endedAt: { gte: ago(30) } }] });
  });

  test('"I am stopping" after a search is going home: the search before it no longer counts them as out', async () => {
    prisma.searchZoneVisit.findMany.mockResolvedValue([
      { searcherId: 'v:vol-1', outcome: 'SEARCHED', endedAt: ago(12) },
      { searcherId: 'v:vol-1', outcome: 'STOPPED', endedAt: ago(3) },
      // Stopped, then searched again: out.
      { searcherId: 'u-mike', outcome: 'STOPPED', endedAt: ago(20) },
      { searcherId: 'u-mike', outcome: 'SEARCHED', endedAt: ago(2) },
      // Stopped, and on an area now: out.
      { searcherId: 'u-sarah', outcome: 'STOPPED', endedAt: ago(15) },
      { searcherId: 'u-sarah', outcome: null, endedAt: null },
    ]);
    expect(await zoneSearchersSince(CASE, ago(30))).toEqual(['u-mike', 'u-sarah']);
  });

  test('the ground that was covered, and by whom: a visit counts when it holds a search', async () => {
    // 2026-11-16: "9 people helped you search 12 areas" for a record of 2 searches. Every area anyone had started
    // was counted, some handed back after five seconds.
    prisma.searchZoneVisit.findMany.mockResolvedValue([
      { searcherId: 'v:vol-1', zoneId: 'z-west', outcome: 'SEARCHED', startedAt: ago(60), endedAt: ago(20) },
      { searcherId: 'u-mike', zoneId: 'z-west', outcome: 'SEARCHED', startedAt: ago(30), endedAt: ago(29) },
      // Out on it when the pet came home, for 40 minutes: searched as far as they got.
      { searcherId: 'u-sarah', zoneId: 'z-east', outcome: 'ENDED', startedAt: ago(45), endedAt: ago(5) },
      // Stopped after 2 minutes, handed back for another, let lapse, out of reach: not searches.
      { searcherId: 'u-ben', zoneId: 'z-south', outcome: 'STOPPED', startedAt: ago(10), endedAt: ago(8) },
      { searcherId: 'u-carl', zoneId: 'z-middle', outcome: 'GAVE_BACK', startedAt: ago(10), endedAt: ago(10) },
      { searcherId: 'u-dora', zoneId: 'z-far', outcome: 'LAPSED', startedAt: ago(300), endedAt: ago(100) },
      { searcherId: 'u-eve', zoneId: 'z-far2', outcome: 'CANNOT', startedAt: ago(20), endedAt: ago(19) },
    ]);
    // The areas with a search on their record (west, and north put down as searched from the desk), and east.
    prisma.searchZone.findMany.mockResolvedValueOnce([{ id: 'z-west' }, { id: 'z-north' }]);
    expect(await zoneGroundCovered(CASE)).toEqual({ areas: 3, people: ['v:vol-1', 'u-mike', 'u-sarah'] });
    expect(prisma.searchZoneVisit.findMany.mock.calls[0][0].where).toEqual({ caseId: CASE, startedAt: { not: null } });
    expect(prisma.searchZone.findMany.mock.calls[0][0]).toEqual({ where: { caseId: CASE, searchCount: { gt: 0 } }, select: { id: true } });
  });

  test('a table that cannot be read counts nobody, and never fails the picture', async () => {
    prisma.searchZoneVisit.findMany.mockRejectedValue(new Error('down'));
    prisma.searchZone.count.mockRejectedValue(new Error('down'));
    prisma.searchZone.findMany.mockRejectedValue(new Error('down'));
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
