/**
 * The search board's route (app/api/mission/[missionId]/board).
 *
 * Anyone holding a pet's link may read the board: streets and whether
 * each is free, being walked or searched. Streets, not people: who holds
 * a street goes only to the owner and the forces looking for the pet.
 * Taking a street needs a person (signed in, or joined from the share
 * link without an account) and the safety waiver. The streets are fetched
 * from the map once per search, by exactly one request.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findFirst: jest.fn(), findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    rescueForceMember: { findMany: jest.fn(async () => []) },
    caseAssignment: { findMany: jest.fn() },
    missionVolunteer: { findFirst: jest.fn() },
    caseSighting: { findMany: jest.fn() },
    searchGrid: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
    searchStreet: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(async () => ({})), updateMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    gridCell: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(async () => ({})), updateMany: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => {}) }));
jest.mock('@/app/lib/sse/missionStream', () => ({ __esModule: true, broadcast: jest.fn() }));
jest.mock('@/app/lib/wake', () => ({ __esModule: true, wakeForces: jest.fn(async () => ({ bell: 0, pushed: 0 })), WAKE_KINDS: { BLOCK_FREE: 'FORCE_BLOCK_FREE' } }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: jest.fn(async () => ({ success: true })),
  rateLimitResponse: jest.fn(),
  RateLimitPresets: { PUBLIC_READ: {}, SEARCH_READ: {}, PUBLIC_WRITE: {} },
}));
jest.mock('@/app/lib/osmStreets', () => ({ __esModule: true, ...jest.requireActual('@/app/lib/osmStreets'), fetchNamedWays: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { broadcast } from '@/app/lib/sse/missionStream';
import { fetchNamedWays } from '@/app/lib/osmStreets';
import { GET, PATCH } from '@/app/api/mission/[missionId]/board/route';
import { ensureStreets, openBlocks, livePriority, FIRST_PRIORITY, isMark, BOARD_ACTIONS, STEER_ACTIONS } from '@/app/lib/searchBoard';
import { WAIVER_CODE } from '@/app/lib/waiver';

const rosedale = require('../fixtures/rosedale-streets.json');

const CASE = 'cmuh8qki0000d3zr9v5n1kdjy';
const PET = { id: CASE, caseNumber: 'AUS-2026-TEST01', status: 'ACTIVE', reportType: 'LOST', petName: 'Max', lastSeenLatitude: 30.3148, lastSeenLongitude: -97.7459 };
const GRID = { id: 'grid-1', caseId: CASE, centerLatitude: 30.3148, centerLongitude: -97.7459, radiusMiles: 0.31, streetsStatus: 'READY', streetsAt: new Date() };
const street = (over = {}) => ({
  id: 'st-1',
  caseId: CASE,
  name: 'Sinclair Ave',
  fromName: 'W 40th St',
  toName: 'W 44th St',
  path: '[[30.31,-97.74],[30.315,-97.741]]',
  meters: 552,
  centerLatitude: 30.3125,
  centerLongitude: -97.7405,
  priority: 8,
  status: 'UNSEARCHED',
  claimedById: null,
  claimedByName: null,
  claimedAt: null,
  searchedById: null,
  searchedByName: null,
  searchedAt: null,
  searchCount: 0,
  ...over,
});

const req = (method = 'GET', { body, headers } = {}) =>
  new NextRequest(`http://localhost/api/mission/${CASE}/board`, {
    method,
    headers: { 'content-type': 'application/json', ...(headers || {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const ctx = { params: { missionId: CASE } };
const RING = [{ name: 'Rosedale Ave', fromName: 'W 38th St', toName: 'W 39th St', path: '[[30.3088,-97.7449],[30.3079,-97.7452]]' }];
const VOLUNTEER = { 'x-volunteer-id': 'vol-1', 'x-volunteer-key': 'dev_abc' };

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue(null);
  prisma.case.findFirst.mockResolvedValue(PET);
  prisma.case.findUnique.mockResolvedValue({ ...PET, reporterId: 'u-avery', searchRadius: 0.3, sightings: [] });
  prisma.searchGrid.findUnique.mockResolvedValue(GRID);
  prisma.searchGrid.update.mockResolvedValue(GRID);
  prisma.searchGrid.updateMany.mockResolvedValue({ count: 1 });
  prisma.searchStreet.updateMany.mockResolvedValue({ count: 0 });
  // The board's own streets and the ring outside it are two reads of one table.
  prisma.searchStreet.findMany.mockImplementation(async ({ where } = {}) =>
    where?.context === true
      ? RING
      : [street({ id: 'st-1', priority: 9, status: 'IN_PROGRESS', claimedById: 'v:vol-1', claimedByName: 'Dana', claimedAt: new Date() }), street({ id: 'st-2', name: 'Ramsey Ave' })]
  );
  prisma.gridCell.updateMany.mockResolvedValue({ count: 0 });
  prisma.gridCell.findMany.mockResolvedValue([]);
  prisma.caseAssignment.findMany.mockResolvedValue([]);
  prisma.rescueForceMember.findMany.mockResolvedValue([]);
  prisma.caseSighting.findMany.mockResolvedValue([]);
  prisma.missionVolunteer.findFirst.mockResolvedValue(null);
});

describe('GET: streets for anyone, people for the few', () => {
  test('someone with only the link sees every street and nobody on it', async () => {
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.unit).toBe('street');
    expect(data.viewer).toBeNull();
    expect(data.streets).toHaveLength(2);
    expect(data.streets[0]).toMatchObject({ title: 'Sinclair Ave from W 40th St to W 44th St', status: 'IN_PROGRESS', mine: false, minutes: 20 });
    expect(data.counts).toEqual({ total: 2, searched: 0, inProgress: 1 });
    // Not a name, not an id of whoever holds it.
    expect(JSON.stringify(data)).not.toContain('Dana');
    expect(JSON.stringify(data)).not.toContain('vol-1');
    expect(data.streets[0]).not.toHaveProperty('claimedByName');
    expect(data.streets[0]).not.toHaveProperty('claimedById');
  });

  test('the owner is told who is on each street', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u-avery' } });
    prisma.user.findUnique.mockResolvedValue({ firstName: 'Avery', waiverAcceptedAt: null });
    const data = await (await GET(req(), ctx)).json();
    expect(data.viewer).toMatchObject({ kind: 'user', isOwner: true, seesNames: true, waiver: true });
    expect(data.streets[0].claimedByName).toBe('Dana');
    expect(data.streets[1].claimedByName).toBeNull();
  });

  test('a signed-in stranger is not', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u-mike' } });
    prisma.user.findUnique.mockResolvedValue({ firstName: 'Mike', waiverAcceptedAt: new Date() });
    const data = await (await GET(req(), ctx)).json();
    expect(data.viewer).toMatchObject({ kind: 'user', isOwner: false, seesNames: false });
    expect(JSON.stringify(data.streets)).not.toContain('Dana');
  });

  test('a member of a force looking for the pet is', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u-kim' } });
    prisma.user.findUnique.mockResolvedValue({ firstName: 'Kim', waiverAcceptedAt: new Date() });
    prisma.caseAssignment.findMany.mockResolvedValue([{ rescueSquadId: 'force-1' }]);
    prisma.rescueForceMember.findMany.mockResolvedValue([{ role: 'MEMBER' }]);
    const data = await (await GET(req(), ctx)).json();
    expect(data.viewer.seesNames).toBe(true);
    expect(data.streets[0].claimedByName).toBe('Dana');
  });

  test('the order follows the sightings: a street next to a fresh one moves up, with nothing rewritten', async () => {
    // Seen ten minutes ago, right on Ramsey Ave (st-2), which the board stored at 8.
    prisma.caseSighting.findMany.mockResolvedValue([{ latitude: 30.3125, longitude: -97.7405, sightedAt: new Date(Date.now() - 10 * 60000) }]);
    prisma.searchStreet.findMany.mockImplementation(async ({ where } = {}) =>
      where?.context === true ? RING : [street({ id: 'st-1', priority: 9, centerLatitude: 30.32, centerLongitude: -97.75 }), street({ id: 'st-2', name: 'Ramsey Ave', priority: 5 })]
    );
    const data = await (await GET(req(), ctx)).json();
    expect(data.streets.map((x) => [x.id, x.priority])).toEqual([['st-2', 10], ['st-1', 9]]);
    // Only sightings of the last three days are read, and one a witness took back is not.
    const asked = prisma.caseSighting.findMany.mock.calls[0][0].where;
    expect(asked.missionId).toBe(CASE);
    expect(Date.now() - asked.sightedAt.gte.getTime()).toBeLessThan(72 * 3600 * 1000 + 5000);
    expect(asked.OR).toEqual([{ witnessState: null }, { witnessState: { not: 'NOT_THE_PET' } }]);
    expect(prisma.searchStreet.update).not.toHaveBeenCalled();
    expect(prisma.searchStreet.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ priority: expect.anything() }) }));
  });

  test('an old sighting, or one far off, moves nothing', () => {
    const row = street({ priority: 5 });
    const here = { lat: row.centerLatitude, lng: row.centerLongitude };
    expect(livePriority(row, [{ ...here, at: new Date() }])).toBe(10);
    expect(livePriority(row, [{ ...here, at: new Date(Date.now() - 4 * 24 * 3600 * 1000) }])).toBe(5);
    expect(livePriority(row, [{ lat: here.lat + 0.01, lng: here.lng, at: new Date() }])).toBe(5);
    expect(livePriority(row, [])).toBe(5);
    // It only ever raises: a street the owner asked for first stays first.
    expect(livePriority(street({ priority: FIRST_PRIORITY }), [{ ...here, at: new Date() }])).toBe(FIRST_PRIORITY);
  });

  test('a helper without an account sees which street is theirs, by the pair of keys only', async () => {
    prisma.missionVolunteer.findFirst.mockResolvedValue({ id: 'vol-1', displayName: 'Dana Smith', waiverAcceptedAt: new Date() });
    const data = await (await GET(req('GET', { headers: VOLUNTEER }), ctx)).json();
    expect(prisma.missionVolunteer.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'vol-1', odId: 'dev_abc', mission: { caseId: CASE } } }));
    expect(data.viewer).toMatchObject({ kind: 'volunteer', firstName: 'Dana', seesNames: false, holding: 'st-1' });
    expect(data.streets[0].mine).toBe(true);
    expect(data.streets[0]).not.toHaveProperty('claimedByName');
  });

  test('the streets just past the edge come along for naming places: lines and names, nothing to take', async () => {
    const data = await (await GET(req(), ctx)).json();
    expect(data.around).toEqual([{ name: 'Rosedale Ave', fromName: 'W 38th St', toName: 'W 39th St', path: [[30.3088, -97.7449], [30.3079, -97.7452]] }]);
    // They are not on the board and not in its count.
    expect(data.streets.map((s) => s.name)).not.toContain('Rosedale Ave');
    expect(data.counts.total).toBe(2);
    const reads = prisma.searchStreet.findMany.mock.calls.map((c) => c[0].where);
    expect(reads).toEqual(expect.arrayContaining([expect.objectContaining({ caseId: CASE, context: false }), { caseId: CASE, context: true }]));
  });

  test('before the streets have come, the board is the squares', async () => {
    prisma.searchGrid.findUnique.mockResolvedValue({ ...GRID, streetsStatus: 'FAILED' });
    prisma.gridCell.findMany.mockResolvedValue([
      { id: 'c-1', row: 0, col: 2, centerLatitude: 30.3, centerLongitude: -97.7, northLat: 30.31, southLat: 30.29, eastLng: -97.69, westLng: -97.71, status: 'UNSEARCHED', priority: 9, claimedById: null, claimedAt: null, searchedAt: null, searchCount: 0 },
    ]);
    prisma.searchGrid.findUnique.mockResolvedValue({ ...GRID, streetsStatus: 'FAILED', streetsNote: 'overpass-api.de: HTTP 429' });
    const data = await (await GET(req(), ctx)).json();
    expect(data.unit).toBe('block');
    expect(data.streetsStatus).toBe('FAILED');
    expect(data.streetsNote).toBe('overpass-api.de: HTTP 429');
    expect(data.cells[0]).toMatchObject({ label: 'C1', title: 'Block C1', mine: false });
    expect(data.cells[0]).not.toHaveProperty('claimedById');
    expect(fetchNamedWays).not.toHaveBeenCalled(); // asked again only after a while
  });

  test('a found pet has no search to map', async () => {
    prisma.case.findFirst.mockResolvedValue({ ...PET, reportType: 'FOUND' });
    const data = await (await GET(req(), ctx)).json();
    expect(data.unit).toBe('none');
    expect(data.streets).toEqual([]);
  });

  test('a link that matches no pet is a 404 in words', async () => {
    prisma.case.findFirst.mockResolvedValue(null);
    const res = await GET(req(), ctx);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/does not match a pet/);
  });
});

describe('PATCH: taking a street', () => {
  const claim = { unit: 'street', id: 'st-2', action: 'claim' };

  test('needs a person', async () => {
    const res = await PATCH(req('PATCH', { body: claim }), ctx);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: 'NOT_JOINED' });
    expect(prisma.searchStreet.updateMany).not.toHaveBeenCalled();
  });

  test('needs the safety waiver, for a claim and for searched, not for giving one back', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u-mike' } });
    prisma.user.findUnique.mockResolvedValue({ firstName: 'Mike', waiverAcceptedAt: null });
    for (const action of ['claim', 'searched']) {
      const res = await PATCH(req('PATCH', { body: { ...claim, action } }), ctx);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: WAIVER_CODE });
    }
    prisma.searchStreet.findFirst.mockResolvedValue(street({ id: 'st-2', claimedById: 'u-mike', status: 'IN_PROGRESS' }));
    prisma.searchStreet.updateMany.mockResolvedValue({ count: 1 });
    const res = await PATCH(req('PATCH', { body: { ...claim, action: 'release' } }), ctx);
    expect(res.status).toBe(200);
  });

  test('is refused once the search has ended', async () => {
    prisma.case.findFirst.mockResolvedValue({ ...PET, status: 'REUNITED' });
    prisma.missionVolunteer.findFirst.mockResolvedValue({ id: 'vol-1', displayName: 'Dana', waiverAcceptedAt: new Date() });
    const res = await PATCH(req('PATCH', { body: claim, headers: VOLUNTEER }), ctx);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'CLOSED' });
  });

  test('a helper without an account takes one: stored under their own key, with their first name', async () => {
    prisma.missionVolunteer.findFirst.mockResolvedValue({ id: 'vol-1', displayName: 'Dana', waiverAcceptedAt: new Date() });
    prisma.searchStreet.findFirst
      .mockResolvedValueOnce(street({ id: 'st-2', name: 'Ramsey Ave' }))
      .mockResolvedValueOnce(street({ id: 'st-2', name: 'Ramsey Ave', status: 'IN_PROGRESS', claimedById: 'v:vol-1', claimedByName: 'Dana', claimedAt: new Date() }));
    prisma.searchStreet.updateMany.mockResolvedValue({ count: 1 });
    const res = await PATCH(req('PATCH', { body: claim, headers: VOLUNTEER }), ctx);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ success: true, unit: 'street', item: { id: 'st-2', status: 'IN_PROGRESS', mine: true, title: 'Ramsey Ave from W 40th St to W 44th St' } });
    expect(data.item).not.toHaveProperty('claimedByName');

    // The claim itself: only if free, mine already, or abandoned.
    const won = prisma.searchStreet.updateMany.mock.calls.find(([arg]) => arg.data.status === 'IN_PROGRESS')[0];
    expect(won.where).toMatchObject({ id: 'st-2', caseId: CASE });
    expect(won.where.OR).toEqual(expect.arrayContaining([{ claimedById: null }, { claimedById: 'v:vol-1' }]));
    expect(won.data).toMatchObject({ claimedById: 'v:vol-1', claimedByName: 'Dana' });
    // One street per person: whatever else they held went back first.
    expect(prisma.searchStreet.updateMany.mock.calls.some(([arg]) => arg.where.claimedById === 'v:vol-1' && arg.where.NOT?.id === 'st-2')).toBe(true);
    // Everyone watching hears a street changed, never who took it.
    expect(broadcast).toHaveBeenCalledWith(CASE, { type: 'STREET_CLAIMED', unit: 'street', item: { id: 'st-2', status: 'IN_PROGRESS' } });
  });

  test('two people tap the same street: the second is told in words', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u-mike' } });
    prisma.user.findUnique.mockResolvedValue({ firstName: 'Mike', waiverAcceptedAt: new Date() });
    prisma.searchStreet.findFirst.mockResolvedValue(street({ id: 'st-2', name: 'Ramsey Ave', status: 'IN_PROGRESS', claimedById: 'v:vol-1', claimedAt: new Date() }));
    prisma.searchStreet.updateMany.mockResolvedValue({ count: 0 });
    const res = await PATCH(req('PATCH', { body: claim }), ctx);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.code).toBe('TAKEN');
    expect(data.error).toBe('Someone just took Ramsey Ave from W 40th St to W 44th St. Pick another nearby.');
    expect(broadcast).not.toHaveBeenCalled();
  });

  test('only the person walking a street can mark it searched', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u-mike' } });
    prisma.user.findUnique.mockResolvedValue({ firstName: 'Mike', waiverAcceptedAt: new Date() });
    prisma.searchStreet.findFirst.mockResolvedValue(street({ id: 'st-2', status: 'IN_PROGRESS', claimedById: 'u-sam' }));
    prisma.searchStreet.updateMany.mockResolvedValue({ count: 0 });
    const res = await PATCH(req('PATCH', { body: { ...claim, action: 'searched' } }), ctx);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'NOT_CLAIMED' });
  });

  test('a helper without an account marks a square searched: credited by the board\'s key, since an account id cannot name them', async () => {
    prisma.missionVolunteer.findFirst.mockResolvedValue({ id: 'vol-1', displayName: 'Dana', waiverAcceptedAt: new Date() });
    const cell = { id: 'c-1', gridId: 'grid-1', row: 0, col: 2, status: 'IN_PROGRESS', claimedById: 'v:vol-1', claimedAt: new Date(), searchedAt: null, searchCount: 0 };
    prisma.gridCell.findFirst.mockResolvedValueOnce(cell).mockResolvedValueOnce({ ...cell, status: 'SEARCHED', claimedById: null, claimedAt: null, searchedAt: new Date(), searchCount: 1 });
    prisma.gridCell.updateMany.mockResolvedValue({ count: 1 });
    const res = await PATCH(req('PATCH', { headers: VOLUNTEER, body: { unit: 'block', id: 'c-1', action: 'searched' } }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, unit: 'block', item: { id: 'c-1', label: 'C1', title: 'Block C1', status: 'SEARCHED', searchCount: 1 } });
    const marked = prisma.gridCell.updateMany.mock.calls.find(([arg]) => arg.data.status === 'SEARCHED')[0];
    expect(marked.where).toMatchObject({ id: 'c-1', gridId: 'grid-1', claimedById: 'v:vol-1', status: 'IN_PROGRESS' });
    expect(marked.data).toMatchObject({ searchedById: null, searchedByKey: 'v:vol-1', searchCount: { increment: 1 } });
  });

  test('a street from another search is not found', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'u-mike' } });
    prisma.user.findUnique.mockResolvedValue({ firstName: 'Mike', waiverAcceptedAt: new Date() });
    prisma.searchStreet.findFirst.mockResolvedValue(null);
    const res = await PATCH(req('PATCH', { body: claim }), ctx);
    expect(res.status).toBe(404);
  });

  test('a street of the ring outside the board cannot be taken', async () => {
    prisma.missionVolunteer.findFirst.mockResolvedValue({ id: 'vol-1', displayName: 'Dana', waiverAcceptedAt: new Date() });
    prisma.searchStreet.findFirst.mockResolvedValue(null);
    const res = await PATCH(req('PATCH', { headers: VOLUNTEER, body: { unit: 'street', id: 'st-ring', action: 'claim' } }), ctx);
    expect(res.status).toBe(404);
    expect(prisma.searchStreet.findFirst).toHaveBeenCalledWith({ where: { id: 'st-ring', caseId: CASE, context: false } });
    expect(prisma.searchStreet.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'IN_PROGRESS' }) }));
  });

  test('a body with no action is a 400', async () => {
    const res = await PATCH(req('PATCH', { body: { id: 'st-2' } }), ctx);
    expect(res.status).toBe(400);
  });
});

describe('PATCH: steering from the desk', () => {
  const asOwner = () => {
    getServerSession.mockResolvedValue({ user: { id: 'u-avery' } });
    prisma.user.findUnique.mockResolvedValue({ firstName: 'Avery', waiverAcceptedAt: null });
  };
  const asForce = (role) => {
    getServerSession.mockResolvedValue({ user: { id: 'u-kim' } });
    prisma.user.findUnique.mockResolvedValue({ firstName: 'Kim', waiverAcceptedAt: null });
    prisma.caseAssignment.findMany.mockResolvedValue([{ rescueSquadId: 'force-1' }]);
    prisma.rescueForceMember.findMany.mockResolvedValue([{ role }]);
  };
  const steer = (action, id = 'st-2', unit = 'street') => PATCH(req('PATCH', { body: { unit, id, action } }), ctx);

  test('the four verbs are steering, apart from the three of walking a street', () => {
    expect(BOARD_ACTIONS).toEqual(['claim', 'release', 'searched']);
    expect(STEER_ACTIONS).toEqual(['first', 'normal', 'walked', 'again']);
  });

  test('"first" puts a street above everything the search ranks by itself, and needs no waiver', async () => {
    asOwner();
    prisma.searchStreet.findFirst.mockResolvedValueOnce(street({ id: 'st-2', priority: 4 })).mockResolvedValueOnce(street({ id: 'st-2', priority: FIRST_PRIORITY }));
    const res = await steer('first');
    expect(res.status).toBe(200);
    expect(prisma.searchStreet.update).toHaveBeenCalledWith({ where: { id: 'st-2' }, data: { priority: FIRST_PRIORITY } });
    expect((await res.json()).item).toMatchObject({ id: 'st-2', first: true, priority: 11, status: 'UNSEARCHED' });
    expect(FIRST_PRIORITY).toBeGreaterThan(10);
    expect(broadcast).toHaveBeenCalledWith(CASE, { type: 'STREET_UPDATED', unit: 'street', item: { id: 'st-2', status: 'UNSEARCHED' } });
  });

  test('a walked street that is asked for first is due another look, so it is handed out again', async () => {
    asOwner();
    prisma.searchStreet.findFirst.mockResolvedValue(street({ id: 'st-2', status: 'SEARCHED', searchCount: 1 }));
    await steer('first');
    expect(prisma.searchStreet.update).toHaveBeenCalledWith({ where: { id: 'st-2' }, data: { priority: FIRST_PRIORITY, status: 'NEEDS_REVISIT' } });
  });

  test('"normal" gives it back the place the search worked out for it', async () => {
    asOwner();
    prisma.searchStreet.findFirst.mockResolvedValue(street({ id: 'st-2', priority: FIRST_PRIORITY }));
    const res = await steer('normal');
    expect(res.status).toBe(200);
    const natural = prisma.searchStreet.update.mock.calls[0][0].data.priority;
    expect(natural).toBeGreaterThanOrEqual(1);
    expect(natural).toBeLessThanOrEqual(10);
  });

  test('"walked" records ground covered off the site: by whom it was put down, and not as a person out searching', async () => {
    asOwner();
    prisma.searchStreet.findFirst
      .mockResolvedValueOnce(street({ id: 'st-2' }))
      .mockResolvedValueOnce(street({ id: 'st-2', status: 'SEARCHED', searchedById: 'm:u-avery', searchedByName: 'Avery', searchedAt: new Date(), searchCount: 1 }));
    prisma.searchStreet.updateMany.mockResolvedValue({ count: 1 });
    const res = await steer('walked');
    expect(res.status).toBe(200);
    const marked = prisma.searchStreet.updateMany.mock.calls.find(([arg]) => arg.data.status === 'SEARCHED')[0];
    // Only a street nobody on the site is on.
    expect(marked.where).toMatchObject({ id: 'st-2', caseId: CASE, status: { in: ['UNSEARCHED', 'NEEDS_REVISIT'] } });
    expect(marked.data).toMatchObject({ status: 'SEARCHED', searchedById: 'm:u-avery', searchedByName: 'Avery', searchCount: { increment: 1 } });
    expect((await res.json()).item).toMatchObject({ status: 'SEARCHED', marked: true });
    expect(isMark('m:u-avery')).toBe(true);
    expect(isMark('u-avery')).toBe(false);
    expect(isMark('v:vol-1')).toBe(false);
    expect(isMark(null)).toBe(false);
  });

  test('a street someone is on is theirs to mark, and a walked one cannot be walked again from the desk', async () => {
    asOwner();
    prisma.searchStreet.updateMany.mockResolvedValue({ count: 0 });
    prisma.searchStreet.findFirst.mockResolvedValue(street({ id: 'st-2', status: 'IN_PROGRESS', claimedById: 'v:vol-1' }));
    const busy = await steer('walked');
    expect(busy.status).toBe(409);
    expect(await busy.json()).toMatchObject({ code: 'SOMEONE_ON_IT', error: 'Someone is on Sinclair Ave from W 40th St to W 44th St right now. They mark it when they have walked it.' });
    prisma.searchStreet.findFirst.mockResolvedValue(street({ id: 'st-2', status: 'SEARCHED' }));
    expect(await (await steer('walked')).json()).toMatchObject({ code: 'ALREADY_WALKED' });
  });

  test('"again" sends a walked street back out, and only a walked one', async () => {
    asOwner();
    prisma.searchStreet.findFirst.mockResolvedValue(street({ id: 'st-2', status: 'SEARCHED', searchCount: 1 }));
    prisma.searchStreet.updateMany.mockResolvedValue({ count: 1 });
    expect((await steer('again')).status).toBe(200);
    expect(prisma.searchStreet.updateMany).toHaveBeenCalledWith({ where: { id: 'st-2', caseId: CASE, context: false, status: 'SEARCHED' }, data: { status: 'NEEDS_REVISIT' } });
    prisma.searchStreet.updateMany.mockResolvedValue({ count: 0 });
    prisma.searchStreet.findFirst.mockResolvedValue(street({ id: 'st-2' }));
    const not = await steer('again');
    expect(not.status).toBe(409);
    expect(await not.json()).toMatchObject({ code: 'NOT_WALKED' });
  });

  test('someone leading a force that is looking can steer, with no waiver', async () => {
    for (const role of ['FOUNDER', 'LEADER', 'COORDINATOR']) {
      asForce(role);
      prisma.searchStreet.findFirst.mockResolvedValue(street({ id: 'st-2' }));
      expect((await steer('first')).status).toBe(200);
    }
  });

  test('nobody else can: joining a force takes one tap, and a search is not redirected by it', async () => {
    prisma.searchStreet.findFirst.mockResolvedValue(street({ id: 'st-2' }));
    // A member of the force, a signed-in stranger, a helper with no account, and nobody at all.
    asForce('MEMBER');
    for (const action of STEER_ACTIONS) {
      const res = await steer(action);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: 'Only the owner and the people leading the search can do that.', code: 'NOT_ALLOWED' });
    }
    prisma.caseAssignment.findMany.mockResolvedValue([]);
    prisma.rescueForceMember.findMany.mockResolvedValue([]);
    expect((await steer('first')).status).toBe(403);
    getServerSession.mockResolvedValue(null);
    prisma.missionVolunteer.findFirst.mockResolvedValue({ id: 'vol-1', displayName: 'Dana', waiverAcceptedAt: new Date() });
    expect((await PATCH(req('PATCH', { headers: VOLUNTEER, body: { unit: 'street', id: 'st-2', action: 'walked' } }), ctx)).status).toBe(403);
    prisma.missionVolunteer.findFirst.mockResolvedValue(null);
    expect((await steer('first')).status).toBe(401);
    expect(prisma.searchStreet.update).not.toHaveBeenCalled();
    expect(prisma.searchStreet.updateMany).not.toHaveBeenCalled();
  });

  test('a street asked for first goes back to its place once it has been walked, by a helper or from the desk', async () => {
    // A helper on a phone walks it: the ask is met, so the next people are not sent to it ahead of everything again.
    prisma.missionVolunteer.findFirst.mockResolvedValue({ id: 'vol-1', displayName: 'Dana', waiverAcceptedAt: new Date() });
    const held = street({ id: 'st-2', priority: FIRST_PRIORITY, status: 'IN_PROGRESS', claimedById: 'v:vol-1', claimedByName: 'Dana', claimedAt: new Date() });
    prisma.searchStreet.findFirst.mockResolvedValue(held);
    prisma.searchStreet.updateMany.mockResolvedValue({ count: 1 });
    expect((await PATCH(req('PATCH', { headers: VOLUNTEER, body: { unit: 'street', id: 'st-2', action: 'searched' } }), ctx)).status).toBe(200);
    expect(prisma.searchStreet.update).toHaveBeenCalledTimes(1);
    const back = prisma.searchStreet.update.mock.calls[0][0];
    expect(back.where).toEqual({ id: 'st-2' });
    expect(back.data.priority).toBeGreaterThanOrEqual(1);
    expect(back.data.priority).toBeLessThanOrEqual(10);

    // Put down as walked from the desk: the same.
    prisma.searchStreet.update.mockClear();
    prisma.missionVolunteer.findFirst.mockResolvedValue(null);
    asOwner();
    prisma.searchStreet.findFirst.mockResolvedValue(street({ id: 'st-2', priority: FIRST_PRIORITY }));
    expect((await steer('walked')).status).toBe(200);
    expect(prisma.searchStreet.update).toHaveBeenCalledTimes(1);
    expect(prisma.searchStreet.update.mock.calls[0][0].data.priority).toBeLessThanOrEqual(10);

    // A street nobody asked for is left exactly as it was.
    prisma.searchStreet.update.mockClear();
    prisma.searchStreet.findFirst.mockResolvedValue(street({ id: 'st-2', priority: 6 }));
    expect((await steer('walked')).status).toBe(200);
    expect(prisma.searchStreet.update).not.toHaveBeenCalled();
  });

  test('a search that has ended is not steered', async () => {
    asOwner();
    prisma.case.findFirst.mockResolvedValue({ ...PET, status: 'REUNITED' });
    const res = await steer('first');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'CLOSED' });
  });

  test('squares are steered the same way, with the mark kept in the board\'s own key', async () => {
    asOwner();
    const cell = { id: 'c-1', gridId: 'grid-1', row: 0, col: 2, centerLatitude: 30.3, centerLongitude: -97.7, status: 'UNSEARCHED', priority: 6, claimedById: null, claimedAt: null, searchedAt: null, searchCount: 0, searchedByKey: null };
    prisma.gridCell.findFirst.mockResolvedValueOnce(cell).mockResolvedValueOnce({ ...cell, status: 'SEARCHED', searchedAt: new Date(), searchCount: 1, searchedByKey: 'm:u-avery' });
    prisma.gridCell.updateMany.mockResolvedValue({ count: 1 });
    const res = await steer('walked', 'c-1', 'block');
    expect(res.status).toBe(200);
    const marked = prisma.gridCell.updateMany.mock.calls.find(([arg]) => arg.data.status === 'SEARCHED')[0];
    expect(marked.data).toMatchObject({ searchedById: null, searchedByKey: 'm:u-avery' });
    expect((await res.json()).item).toMatchObject({ id: 'c-1', status: 'SEARCHED', marked: true, first: false });
  });
});

describe('ensureStreets: fetched once, by one request', () => {
  const fresh = { ...GRID, streetsStatus: null, streetsAt: null, radiusMiles: 500 / 1609.344 };

  test('the first request fetches the streets and stores the walks', async () => {
    prisma.searchGrid.findUnique.mockResolvedValue(fresh);
    fetchNamedWays.mockResolvedValue(rosedale.elements);
    const status = await ensureStreets(CASE);
    expect(status).toBe('READY');
    expect(fetchNamedWays).toHaveBeenCalledTimes(1);
    const rows = prisma.searchStreet.createMany.mock.calls[0][0].data;
    expect(rows.length).toBeGreaterThan(15);
    expect(rows.every((r) => r.caseId === CASE && typeof r.path === 'string')).toBe(true);
    expect(rows.map((r) => `${r.name} from ${r.fromName} to ${r.toName}`)).toContain('Sinclair Ave from W 40th St to W 44th St');
    expect(prisma.searchGrid.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ streetsStatus: 'READY' }) }));
  });

  test('the ring just outside the board is stored for naming, marked so it is never handed out or counted', async () => {
    prisma.searchGrid.findUnique.mockResolvedValue(fresh);
    fetchNamedWays.mockResolvedValue(rosedale.elements);
    await ensureStreets(CASE);
    const rows = prisma.searchStreet.createMany.mock.calls[0][0].data;
    const ring = rows.filter((r) => r.context);
    const board = rows.filter((r) => !r.context);
    expect(ring.length).toBeGreaterThan(5);
    expect(board.length).toBeGreaterThan(15);
    expect(rows.every((r) => typeof r.context === 'boolean')).toBe(true);
    // The board's streets come first, and the ring is farther out than any of them needs to be.
    expect(rows.findIndex((r) => r.context)).toBe(board.length);
  });

  test('a board with too few streets of its own stays on squares, however many lie outside it', async () => {
    // Twenty metres of board: every named street is in the ring.
    prisma.searchGrid.findUnique.mockResolvedValue({ ...fresh, radiusMiles: 20 / 1609.344 });
    fetchNamedWays.mockResolvedValue(rosedale.elements);
    expect(await ensureStreets(CASE)).toBe('NONE');
    expect(prisma.searchStreet.createMany).not.toHaveBeenCalled();
  });

  test('a second request arriving meanwhile does not fetch', async () => {
    prisma.searchGrid.findUnique.mockResolvedValue(fresh);
    prisma.searchGrid.updateMany.mockResolvedValue({ count: 0 });
    expect(await ensureStreets(CASE)).toBe('PENDING');
    expect(fetchNamedWays).not.toHaveBeenCalled();
    expect(prisma.searchStreet.createMany).not.toHaveBeenCalled();
  });

  test('a map server that does not answer leaves the squares in place, and is asked again later', async () => {
    prisma.searchGrid.findUnique.mockResolvedValue(fresh);
    fetchNamedWays.mockRejectedValue(Object.assign(new Error('Street data is not available right now'), { note: 'overpass-api.de: HTTP 429; overpass.kumi.systems: no answer in 12s' }));
    expect(await ensureStreets(CASE)).toBe('FAILED');
    expect(prisma.searchStreet.createMany).not.toHaveBeenCalled();
    // What each server did is kept, so the failure can be read from outside the host.
    expect(prisma.searchGrid.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ streetsStatus: 'FAILED', streetsNote: 'overpass-api.de: HTTP 429; overpass.kumi.systems: no answer in 12s' }) })
    );

    // Within the wait, nothing is asked.
    jest.clearAllMocks();
    prisma.case.findUnique.mockResolvedValue({ ...PET, searchRadius: 0.3, sightings: [] });
    prisma.searchGrid.findUnique.mockResolvedValue({ ...fresh, streetsStatus: 'FAILED', streetsAt: new Date() });
    expect(await ensureStreets(CASE)).toBe('FAILED');
    expect(prisma.searchGrid.updateMany).not.toHaveBeenCalled();

    // After it, the job is offered again, and a fetch that works clears the note.
    prisma.searchGrid.findUnique.mockResolvedValue({ ...fresh, streetsStatus: 'FAILED', streetsAt: new Date(Date.now() - 4 * 60 * 1000) });
    prisma.searchGrid.updateMany.mockResolvedValue({ count: 1 });
    fetchNamedWays.mockResolvedValue(rosedale.elements);
    expect(await ensureStreets(CASE)).toBe('READY');
    expect(prisma.searchGrid.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ streetsStatus: 'READY', streetsNote: null }) }));
  });

  test('a place with no named streets stays on squares for good', async () => {
    prisma.searchGrid.findUnique.mockResolvedValue(fresh);
    fetchNamedWays.mockResolvedValue([]);
    expect(await ensureStreets(CASE)).toBe('NONE');
    expect(prisma.searchStreet.createMany).not.toHaveBeenCalled();
  });

  test('a pet with no last-seen point has no board', async () => {
    prisma.case.findUnique.mockResolvedValue({ id: CASE, lastSeenLatitude: null, lastSeenLongitude: null });
    prisma.searchGrid.findUnique.mockResolvedValue(null);
    expect(await ensureStreets(CASE)).toBeNull();
  });
});

describe('openBlocks: what the job picker hands out is what the map shows', () => {
  test('streets where the board has them: the name, the minutes, most urgent first, and never the ring', async () => {
    prisma.searchStreet.findMany.mockResolvedValue([street({ id: 'st-9', priority: 9, meters: 552 }), street({ id: 'st-3', name: 'Ramsey Ave', toName: 'W 42nd St', priority: 6, meters: 240, status: 'NEEDS_REVISIT' })]);
    const open = await openBlocks(CASE);
    expect(open).toEqual([
      { id: 'st-9', unit: 'street', label: 'Sinclair Ave from W 40th St to W 44th St', status: 'UNSEARCHED', priority: 9, centerLatitude: 30.3125, centerLongitude: -97.7405, minutes: 20 },
      { id: 'st-3', unit: 'street', label: 'Ramsey Ave from W 40th St to W 42nd St', status: 'NEEDS_REVISIT', priority: 6, centerLatitude: 30.3125, centerLongitude: -97.7405, minutes: 10 },
    ]);
    expect(prisma.searchStreet.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { caseId: CASE, context: false, status: { in: ['UNSEARCHED', 'NEEDS_REVISIT'] } } }));
    expect(prisma.gridCell.findMany).not.toHaveBeenCalled();
  });

  test('the job on the pet\'s page follows the sightings too, and is cut to size after it is put in order', async () => {
    const many = Array.from({ length: 15 }, (_, i) => street({ id: `st-${i}`, name: `Street ${String.fromCharCode(65 + i)}`, priority: 9, centerLatitude: 30.33, centerLongitude: -97.76 }));
    // The one next to the sighting is stored last, at the lowest priority.
    prisma.searchStreet.findMany.mockResolvedValue([...many, street({ id: 'st-seen', name: 'Ramsey Ave', priority: 3 })]);
    prisma.caseSighting.findMany.mockResolvedValue([{ latitude: 30.3125, longitude: -97.7405, sightedAt: new Date(Date.now() - 5 * 60000) }]);
    const open = await openBlocks(CASE, { take: 3 });
    expect(open.map((o) => o.id)).toEqual(['st-seen', 'st-0', 'st-1']);
    expect(open[0].priority).toBe(10);
  });

  test('squares where the streets did not come, without asking the map again inside the wait', async () => {
    prisma.searchGrid.findUnique.mockResolvedValue({ ...GRID, streetsStatus: 'FAILED' });
    prisma.gridCell.findMany.mockResolvedValue([{ id: 'c-1', row: 0, col: 2, status: 'UNSEARCHED', priority: 9, centerLatitude: 30.3, centerLongitude: -97.7 }]);
    const open = await openBlocks(CASE);
    expect(open).toEqual([{ id: 'c-1', row: 0, col: 2, status: 'UNSEARCHED', priority: 9, centerLatitude: 30.3, centerLongitude: -97.7, unit: 'block', label: 'C1' }]);
    expect(fetchNamedWays).not.toHaveBeenCalled();
  });

  test('a search whose streets were never asked for asks now, and hands out squares meanwhile', async () => {
    prisma.searchGrid.findUnique.mockResolvedValue({ ...GRID, streetsStatus: null, streetsAt: null });
    prisma.gridCell.findMany.mockResolvedValue([{ id: 'c-1', row: 0, col: 2, status: 'UNSEARCHED', priority: 9, centerLatitude: 30.3, centerLongitude: -97.7 }]);
    fetchNamedWays.mockResolvedValue(rosedale.elements);
    const open = await openBlocks(CASE);
    expect(open[0].unit).toBe('block');
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetchNamedWays).toHaveBeenCalledTimes(1);
  });
});
