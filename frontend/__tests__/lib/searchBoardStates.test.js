/**
 * A street followed through its states (app/lib/searchBoard.js,
 * app/lib/searchAsk.js), against a small table in memory that answers
 * `where` the way the database does. The route tests check each write's
 * shape; these check what a street IS after a run of writes, which is
 * where the steering verbs went wrong before: a helper giving a street
 * back erased the owner's "another look", and a write made on a row as it
 * was read a moment earlier left a street nobody could take.
 */

const rows = { street: [], cell: [], grid: [] };

/** Whether a row answers a Prisma `where`, for the operators the board uses. */
function matches(row, where = {}) {
  return Object.entries(where).every(([key, want]) => {
    if (key === 'OR') return want.some((w) => matches(row, w));
    if (key === 'AND') return want.every((w) => matches(row, w));
    if (key === 'NOT') return !matches(row, want);
    const have = row[key] === undefined ? null : row[key];
    if (want && typeof want === 'object' && !(want instanceof Date)) {
      return Object.entries(want).every(([op, value]) => {
        if (op === 'in') return value.includes(have);
        if (op === 'not') return have !== value;
        if (op === 'gt') return have != null && have > value;
        if (op === 'gte') return have != null && have >= value;
        if (op === 'lt') return have != null && have < value;
        throw new Error(`the table in this test does not know "${op}"`);
      });
    }
    if (want instanceof Date) return have instanceof Date && have.getTime() === want.getTime();
    return have === want;
  });
}
function apply(row, data) {
  for (const [key, value] of Object.entries(data)) row[key] = value && typeof value === 'object' && !(value instanceof Date) && 'increment' in value ? (row[key] || 0) + value.increment : value;
}
const table = (name) => ({
  findFirst: jest.fn(async ({ where } = {}) => {
    const row = rows[name].find((r) => matches(r, where));
    return row ? { ...row } : null;
  }),
  findUnique: jest.fn(async ({ where } = {}) => {
    const row = rows[name].find((r) => matches(r, where));
    return row ? { ...row } : null;
  }),
  findMany: jest.fn(async ({ where } = {}) => rows[name].filter((r) => matches(r, where)).map((r) => ({ ...r }))),
  updateMany: jest.fn(async ({ where, data }) => {
    const hit = rows[name].filter((r) => matches(r, where));
    hit.forEach((r) => apply(r, data));
    return { count: hit.length };
  }),
  update: jest.fn(async ({ where, data }) => {
    const row = rows[name].find((r) => matches(r, where));
    apply(row, data);
    return { ...row };
  }),
});

jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => {}) }));
jest.mock('@/app/lib/osmStreets', () => ({ __esModule: true, fetchNamedWays: jest.fn(), STREET_FETCH_MARGIN_METERS: 400 }));
jest.mock('@/app/lib/push', () => ({ __esModule: true, isPushConfigured: jest.fn(() => false), sendPushToUser: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { actOnBoard, sweepStaleStreetClaims, sweepStaleClaims, streetForBoard, readCells, FIRST_PRIORITY } from '@/app/lib/searchBoard';
import { askStreet, cannotWalk, unaskPerson } from '@/app/lib/searchAsk';
import { ASK_HOLD_MS } from '@/app/lib/searchTeam';
import { CLAIM_TTL_MS } from '@/app/lib/searchGrid';

const CASE = 'case-max';
const OWNER = { id: 'u-avery', kind: 'user', userId: 'u-avery', firstName: 'Avery', isOwner: true, leads: true, seesNames: true };
const DANA = { id: 'v:vol-1', kind: 'volunteer', userId: null, firstName: 'Dana', isOwner: false, leads: false, seesNames: false };
const JO = { id: 'v:vol-2', kind: 'volunteer', userId: null, firstName: 'Jo', isOwner: false, leads: false, seesNames: false };
const T0 = new Date('2026-11-12T22:00:00Z').getTime();
const MINUTE = 60 * 1000;

const street = (over = {}) => ({
  id: 'st-1', caseId: CASE, context: false, name: 'Elm St', fromName: 'A St', toName: 'B St',
  path: '[[30.3160,-97.7459],[30.3170,-97.7459]]', meters: 110, centerLatitude: 30.3165, centerLongitude: -97.7459,
  priority: 6, status: 'UNSEARCHED', claimedById: null, claimedByName: null, claimedAt: null,
  searchedById: null, searchedByName: null, searchedAt: null, searchCount: 0, againAt: null,
  askedOfId: null, askedOfName: null, askedById: null, askedByName: null, askedAt: null, askedSeenAt: null, askedNote: null,
  ...over,
});
const walked = (over = {}) => street({ status: 'SEARCHED', searchedById: 'v:vol-9', searchedByName: 'Sam', searchedAt: new Date(T0 - 3 * 60 * MINUTE), searchCount: 1, ...over });
const cell = (over = {}) => ({
  id: 'c-1', gridId: 'grid-1', row: 0, col: 2, centerLatitude: 30.3165, centerLongitude: -97.7459, northLat: 30.317, southLat: 30.316, eastLng: -97.745, westLng: -97.747,
  priority: 6, status: 'UNSEARCHED', claimedById: null, claimedAt: null, searchedById: null, searchedByKey: null, searchedAt: null, searchCount: 0, againAt: null,
  ...over,
});

const act = (action, searcher, { id = 'st-1', unit = 'street', now = T0 } = {}) => actOnBoard({ caseId: CASE, unit, id, action, searcher, ownerId: 'u-avery', now });
const st = (id = 'st-1') => rows.street.find((r) => r.id === id);
const see = (id = 'st-1') => (({ status, priority, claimedById, searchCount, againAt }) => ({ status, priority, claimedById, searchCount, again: Boolean(againAt) }))(st(id));

beforeEach(() => {
  rows.street = [street()];
  rows.cell = [cell()];
  rows.grid = [{ id: 'grid-1', caseId: CASE, centerLatitude: 30.3148, centerLongitude: -97.7459, radiusMiles: 0.5, cellSizeMeters: 150, streetsStatus: 'READY' }];
  prisma.searchStreet = table('street');
  prisma.gridCell = table('cell');
  prisma.searchGrid = table('grid');
  prisma.caseSighting = { findMany: jest.fn(async () => []) };
  prisma.searchMessage = { create: jest.fn(async () => ({})) };
  prisma.user = { findMany: jest.fn(async () => []) };
  prisma.missionVolunteer = { findMany: jest.fn(async () => []) };
});

describe('a street put up for another look stays up for it until someone walks it', () => {
  test('a helper who takes it and gives it back leaves it "another look", not "walked"', async () => {
    rows.street = [walked()];
    await act('again', OWNER);
    expect(see()).toMatchObject({ status: 'NEEDS_REVISIT', again: true, searchCount: 1 });
    await act('claim', DANA);
    expect(see()).toMatchObject({ status: 'IN_PROGRESS', claimedById: 'v:vol-1', again: true });
    // "I am stopping".
    await act('release', DANA);
    expect(see()).toMatchObject({ status: 'NEEDS_REVISIT', claimedById: null, again: true, searchCount: 1 });
  });

  test('"Different street" gives it back the same way', async () => {
    rows.street = [walked(), street({ id: 'st-2', name: 'Oak St' })];
    await act('again', OWNER);
    await act('claim', DANA);
    await act('claim', DANA, { id: 'st-2' });
    expect(see('st-1')).toMatchObject({ status: 'NEEDS_REVISIT', claimedById: null, again: true });
    expect(see('st-2')).toMatchObject({ status: 'IN_PROGRESS', claimedById: 'v:vol-1' });
  });

  test('and so does a claim that is left for hours', async () => {
    rows.street = [walked()];
    await act('again', OWNER);
    await act('claim', DANA);
    await sweepStaleStreetClaims(CASE, T0 + CLAIM_TTL_MS + MINUTE);
    expect(see()).toMatchObject({ status: 'NEEDS_REVISIT', claimedById: null, again: true });
  });

  test('walking it is what meets the request: then it is walked, twice', async () => {
    rows.street = [walked()];
    await act('again', OWNER);
    await act('claim', DANA);
    await act('searched', DANA);
    expect(see()).toMatchObject({ status: 'SEARCHED', again: false, searchCount: 2, claimedById: null });
    // And a later second pass that is given up goes back to walked, as before.
    await act('claim', JO);
    await act('release', JO);
    expect(see()).toMatchObject({ status: 'SEARCHED', again: false, searchCount: 2 });
  });

  test('a street never walked goes back to not walked, and one put down from the desk is walked', async () => {
    await act('claim', DANA);
    await act('release', DANA);
    expect(see()).toMatchObject({ status: 'UNSEARCHED', searchCount: 0, again: false });
    await act('walked', OWNER);
    expect(see()).toMatchObject({ status: 'SEARCHED', searchCount: 1, again: false });
    expect(st().searchedById).toBe('m:u-avery');
  });
});

describe('reading the board writes nothing when no claim has lapsed', () => {
  test('the sweep looks first, and writes only when there is a claim to give back', async () => {
    rows.street = [street({ status: 'IN_PROGRESS', claimedById: 'v:vol-1', claimedByName: 'Dana', claimedAt: new Date(T0) })];
    // Ten minutes in: nothing has lapsed, so nothing is written, however often the board is read.
    await sweepStaleStreetClaims(CASE, T0 + 10 * MINUTE);
    await sweepStaleStreetClaims(CASE, T0 + 11 * MINUTE);
    expect(prisma.searchStreet.updateMany).not.toHaveBeenCalled();
    expect(see()).toMatchObject({ status: 'IN_PROGRESS', claimedById: 'v:vol-1' });
    await sweepStaleStreetClaims(CASE, T0 + CLAIM_TTL_MS + MINUTE);
    expect(prisma.searchStreet.updateMany).toHaveBeenCalled();
    expect(see()).toMatchObject({ status: 'UNSEARCHED', claimedById: null });

    rows.cell = [cell({ status: 'IN_PROGRESS', claimedById: 'v:vol-1', claimedAt: new Date(T0) })];
    await sweepStaleClaims('grid-1', T0 + 10 * MINUTE);
    expect(prisma.gridCell.updateMany).not.toHaveBeenCalled();
    await sweepStaleClaims('grid-1', T0 + CLAIM_TTL_MS + MINUTE);
    expect(rows.cell[0]).toMatchObject({ status: 'UNSEARCHED', claimedById: null });
  });
});

describe('asked for first', () => {
  test('a walked street asked for first is due another look, and stays first if the helper\'s claim lapses', async () => {
    rows.street = [walked()];
    await act('first', OWNER);
    expect(see()).toMatchObject({ status: 'NEEDS_REVISIT', priority: FIRST_PRIORITY, again: true });
    await act('claim', DANA);
    await sweepStaleStreetClaims(CASE, T0 + CLAIM_TTL_MS + MINUTE);
    // Still to walk and still first: never "Walked" and "asked for first" at once.
    expect(see()).toMatchObject({ status: 'NEEDS_REVISIT', priority: FIRST_PRIORITY, claimedById: null });
    expect(streetForBoard(st(), { withNames: true })).toMatchObject({ status: 'NEEDS_REVISIT', first: true });
  });

  test('once it is walked the ask is met, by a helper or from the desk, and a street nobody asked for keeps its place', async () => {
    await act('first', OWNER);
    await act('claim', DANA);
    await act('searched', DANA);
    expect(see().priority).toBeLessThanOrEqual(10);
    expect(see().priority).toBeGreaterThanOrEqual(1);

    rows.street = [street()];
    await act('first', OWNER);
    await act('walked', OWNER);
    expect(see()).toMatchObject({ status: 'SEARCHED' });
    expect(see().priority).toBeLessThanOrEqual(10);

    rows.street = [street({ priority: 4 })];
    await act('claim', DANA);
    await act('searched', DANA);
    expect(see().priority).toBe(4);
  });

  test('asked for first while someone is walking it: their walk still meets it', async () => {
    await act('claim', DANA);
    await act('first', OWNER);
    expect(see()).toMatchObject({ status: 'IN_PROGRESS', claimedById: 'v:vol-1', priority: FIRST_PRIORITY });
    await act('searched', DANA);
    expect(see()).toMatchObject({ status: 'SEARCHED' });
    expect(see().priority).toBeLessThanOrEqual(10);
  });

  test('"first" on a walked street that a helper takes in the same moment leaves the street theirs', async () => {
    rows.street = [walked()];
    // The desk reads the street as walked. Before its write lands, Dana is given it.
    const read = prisma.searchStreet.findFirst;
    let taken = false;
    prisma.searchStreet.findFirst = jest.fn(async (arg) => {
      const before = await read(arg);
      if (!taken) {
        taken = true;
        apply(st(), { status: 'IN_PROGRESS', claimedById: 'v:vol-1', claimedByName: 'Dana', claimedAt: new Date(T0) });
      }
      return before;
    });
    await act('first', OWNER);
    prisma.searchStreet.findFirst = read;
    // Not "another look" with Dana's claim still on it, which nobody could then take or finish.
    expect(see()).toMatchObject({ status: 'IN_PROGRESS', claimedById: 'v:vol-1', priority: FIRST_PRIORITY });
    expect((await act('searched', DANA)).error).toBeUndefined();
    expect(see()).toMatchObject({ status: 'SEARCHED', claimedById: null, searchCount: 2 });
  });

  test('"put down as walked" that loses to a helper says someone is on it, from the row as it is now', async () => {
    const read = prisma.searchStreet.findFirst;
    let taken = false;
    prisma.searchStreet.findFirst = jest.fn(async (arg) => {
      const before = await read(arg);
      if (!taken) {
        taken = true;
        apply(st(), { status: 'IN_PROGRESS', claimedById: 'v:vol-1', claimedByName: 'Dana', claimedAt: new Date(T0) });
      }
      return before;
    });
    const result = await act('walked', OWNER);
    prisma.searchStreet.findFirst = read;
    expect(result.error).toBe('SOMEONE_ON_IT');
    expect(see()).toMatchObject({ status: 'IN_PROGRESS', claimedById: 'v:vol-1', searchCount: 0 });
  });
});

describe('squares keep their history the same way', () => {
  const actCell = (action, searcher, now = T0) => act(action, searcher, { id: 'c-1', unit: 'block', now });
  const seeCell = () => (({ status, claimedById, searchCount, againAt }) => ({ status, claimedById, searchCount, again: Boolean(againAt) }))(rows.cell[0]);

  test('a second pass that is left for hours goes back to walked, never to "not walked"', async () => {
    rows.cell = [cell({ status: 'SEARCHED', searchedByKey: 'v:vol-9', searchedAt: new Date(T0 - 60 * MINUTE), searchCount: 1 })];
    await actCell('claim', DANA);
    await sweepStaleClaims('grid-1', T0 + CLAIM_TTL_MS + MINUTE);
    expect(seeCell()).toEqual({ status: 'SEARCHED', claimedById: null, searchCount: 1, again: false });
  });

  test('another look survives a give-back, and taking a street gives a held square back to what it was', async () => {
    rows.cell = [cell({ status: 'SEARCHED', searchedByKey: 'v:vol-9', searchedAt: new Date(T0 - 60 * MINUTE), searchCount: 1 })];
    await actCell('again', OWNER);
    await actCell('claim', DANA);
    await actCell('release', DANA);
    expect(seeCell()).toEqual({ status: 'NEEDS_REVISIT', claimedById: null, searchCount: 1, again: true });
    await actCell('claim', DANA);
    await act('claim', DANA);
    expect(seeCell()).toEqual({ status: 'NEEDS_REVISIT', claimedById: null, searchCount: 1, again: true });
  });

  test('squares follow a fresh sighting, as the list beside the map says the order does', async () => {
    rows.cell = [cell({ priority: 3 }), cell({ id: 'c-2', col: 3, centerLatitude: 30.33, priority: 3 })];
    prisma.caseSighting.findMany.mockResolvedValue([{ latitude: 30.3166, longitude: -97.7459, sightedAt: new Date(Date.now() - 10 * MINUTE) }]);
    const out = await readCells(CASE);
    expect(out.find((c) => c.id === 'c-1').priority).toBeGreaterThanOrEqual(7);
    expect(out.find((c) => c.id === 'c-2').priority).toBe(3);
    // Nothing is rewritten: the stored place is the one distance alone gives it.
    expect(rows.cell[0].priority).toBe(3);
  });
});

describe('a street kept for the person who was asked', () => {
  const dana = { id: 'v:vol-1', name: 'Dana' };
  const ask = (now = T0) => askStreet({ caseId: CASE, streetId: 'st-1', person: dana, searcher: OWNER, note: 'Check the alley.', now });

  test('nobody else is given it while it is kept; the person asked takes it, and the desk sees that they have seen it', async () => {
    expect((await ask()).error).toBeUndefined();
    expect(st()).toMatchObject({ askedOfId: 'v:vol-1', askedOfName: 'Dana', askedByName: 'Avery', askedNote: 'Check the alley.', askedSeenAt: null });
    expect(await act('claim', JO, { now: T0 + MINUTE })).toMatchObject({ error: 'ASKED' });
    expect(see()).toMatchObject({ status: 'UNSEARCHED', claimedById: null });
    expect((await act('claim', DANA, { now: T0 + 2 * MINUTE })).error).toBeUndefined();
    expect(st()).toMatchObject({ status: 'IN_PROGRESS', claimedById: 'v:vol-1', askedOfId: 'v:vol-1' });
    expect(st().askedSeenAt).toEqual(new Date(T0 + 2 * MINUTE));
    // Walked: the ask is over.
    await act('searched', DANA, { now: T0 + 12 * MINUTE });
    expect(st()).toMatchObject({ status: 'SEARCHED', askedOfId: null, askedNote: null });
  });

  test('after half an hour it is anyone\'s, and taking it ends the ask', async () => {
    await ask();
    const later = T0 + ASK_HOLD_MS + MINUTE;
    expect((await act('claim', JO, { now: later })).error).toBeUndefined();
    expect(st()).toMatchObject({ status: 'IN_PROGRESS', claimedById: 'v:vol-2', askedOfId: null });
  });

  test('"I can\'t right now" gives it back to the search and tells the desk in those words', async () => {
    await ask();
    expect(await cannotWalk({ caseId: CASE, searcher: DANA })).toEqual({ title: 'Elm St from A St to B St' });
    expect(st()).toMatchObject({ status: 'UNSEARCHED', askedOfId: null });
    expect(prisma.searchMessage.create.mock.calls[0][0].data).toMatchObject({ fromId: 'v:vol-1', fromDesk: false, toId: null, text: "I can't right now. (Elm St from A St to B St)" });
    // Nothing was asked of Jo, so there is nothing for Jo to turn down.
    expect(await cannotWalk({ caseId: CASE, searcher: JO })).toEqual({ error: 'NO_ASK' });
    expect((await act('claim', JO, { now: T0 + MINUTE })).error).toBeUndefined();
  });

  test('taking it back frees it; a street the person has already started is not taken from under them', async () => {
    await ask();
    expect(await unaskPerson({ caseId: CASE, person: dana, searcher: OWNER })).toEqual({ count: 1 });
    expect(st().askedOfId).toBeNull();
    await ask();
    await act('claim', DANA);
    expect(await unaskPerson({ caseId: CASE, person: dana, searcher: OWNER })).toEqual({ count: 0 });
    expect(st()).toMatchObject({ status: 'IN_PROGRESS', claimedById: 'v:vol-1', askedOfId: 'v:vol-1' });
  });

  test('giving it back, or leaving it for hours, ends the ask too', async () => {
    await ask();
    await act('claim', DANA);
    await act('release', DANA);
    expect(st()).toMatchObject({ status: 'UNSEARCHED', askedOfId: null });
    await ask();
    await act('claim', DANA);
    await sweepStaleStreetClaims(CASE, T0 + CLAIM_TTL_MS + MINUTE);
    expect(st()).toMatchObject({ status: 'UNSEARCHED', claimedById: null, askedOfId: null });
  });

  test('one ask to a person: asking for another street takes the first one back, and a street someone is on cannot be asked for', async () => {
    rows.street = [street(), street({ id: 'st-2', name: 'Oak St' }), street({ id: 'st-3', name: 'Ash St', status: 'IN_PROGRESS', claimedById: 'v:vol-2', claimedByName: 'Jo', claimedAt: new Date(T0) })];
    await ask();
    await askStreet({ caseId: CASE, streetId: 'st-2', person: dana, searcher: OWNER, now: T0 + MINUTE });
    expect(st('st-1').askedOfId).toBeNull();
    expect(st('st-2').askedOfId).toBe('v:vol-1');
    expect(await askStreet({ caseId: CASE, streetId: 'st-3', person: dana, searcher: OWNER, now: T0 + MINUTE })).toMatchObject({ error: 'NOT_OPEN' });
    // And only whoever runs the search asks.
    expect(await askStreet({ caseId: CASE, streetId: 'st-1', person: dana, searcher: JO, now: T0 })).toMatchObject({ error: 'NOT_ALLOWED' });
    expect(st('st-1').askedOfId).toBeNull();
  });

  test('a street kept for Dana cannot be asked of Jo until the ask lapses or is taken back', async () => {
    await ask();
    expect(await askStreet({ caseId: CASE, streetId: 'st-1', person: { id: 'v:vol-2', name: 'Jo' }, searcher: OWNER, now: T0 + MINUTE })).toMatchObject({ error: 'ASKED_ALREADY' });
    expect(st().askedOfId).toBe('v:vol-1');
    expect((await askStreet({ caseId: CASE, streetId: 'st-1', person: { id: 'v:vol-2', name: 'Jo' }, searcher: OWNER, now: T0 + ASK_HOLD_MS + MINUTE })).error).toBeUndefined();
    expect(st().askedOfId).toBe('v:vol-2');
  });
});
