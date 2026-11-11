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
    rescueForceMember: { findFirst: jest.fn() },
    caseAssignment: { findMany: jest.fn() },
    missionVolunteer: { findFirst: jest.fn() },
    caseSighting: { findMany: jest.fn() },
    searchGrid: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
    searchStreet: { findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    gridCell: { findMany: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
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
  RateLimitPresets: { PUBLIC_READ: {}, PUBLIC_WRITE: {} },
}));
jest.mock('@/app/lib/osmStreets', () => ({ __esModule: true, ...jest.requireActual('@/app/lib/osmStreets'), fetchNamedWays: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { broadcast } from '@/app/lib/sse/missionStream';
import { fetchNamedWays } from '@/app/lib/osmStreets';
import { GET, PATCH } from '@/app/api/mission/[missionId]/board/route';
import { ensureStreets, openBlocks } from '@/app/lib/searchBoard';
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
      : [street({ id: 'st-1', status: 'IN_PROGRESS', claimedById: 'v:vol-1', claimedByName: 'Dana', claimedAt: new Date() }), street({ id: 'st-2', name: 'Ramsey Ave' })]
  );
  prisma.gridCell.updateMany.mockResolvedValue({ count: 0 });
  prisma.gridCell.findMany.mockResolvedValue([]);
  prisma.caseAssignment.findMany.mockResolvedValue([]);
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
    prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'm-1' });
    const data = await (await GET(req(), ctx)).json();
    expect(data.viewer.seesNames).toBe(true);
    expect(data.streets[0].claimedByName).toBe('Dana');
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
    expect(prisma.searchStreet.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { caseId: CASE, context: false, status: { in: ['UNSEARCHED', 'NEEDS_REVISIT'] } }, take: 12 })
    );
    expect(prisma.gridCell.findMany).not.toHaveBeenCalled();
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
