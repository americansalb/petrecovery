/**
 * Two older lists about one pet that took no sign-in at all:
 *
 *   GET /api/missions/[missionId]/tasks         who made each task and who is on it
 *   GET /api/missions/[missionId]/search-areas  who walked where, with their notes
 *
 * Nothing on the site calls either. The second also read the wrong name
 * for its own address, so it answered about the first pet in the table
 * whatever it was asked. Both are for the owner, the forces looking for
 * the pet and staff, and name people by first name only.
 *
 * Saving an area through the second had the same fault: from any account,
 * the area went onto the first search in the table. It is switched off.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { case: { findFirst: jest.fn() }, squadTask: { findMany: jest.fn() }, user: { findUnique: jest.fn() }, searchArea: { create: jest.fn() } },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn(async () => null) }));
jest.mock('@/app/lib/searcher', () => ({ __esModule: true, searcherFor: jest.fn(async () => null) }));

import prisma from '@/app/lib/prisma';
import { searcherFor } from '@/app/lib/searcher';
import { GET as getTasks } from '@/app/api/missions/[missionId]/tasks/route';
import { GET as getAreas, POST as postArea } from '@/app/api/missions/[missionId]/search-areas/route';

const ask = (handler, what, id = 'AUS-2026-0001') => handler(new NextRequest(`http://localhost/api/missions/${id}/${what}`), { params: { missionId: id } });
const OWNER = { userId: 'u-avery', seesNames: true, isOwner: true };
const STRANGER = { userId: 'u-x', seesNames: false };
const AREA = { id: 'sa-1', geometry: '{"type":"LineString","coordinates":[]}', acreage: 1.2, notes: 'Checked the sheds', startAddress: '4001 Ramsey Ave', potentialSpotting: false, markedAt: new Date(0), markedBy: { firstName: 'Dana' } };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findFirst.mockResolvedValue({ id: 'case-max', assignments: [{ rescueSquadId: 'force-1', searchAreas: [AREA] }] });
  prisma.squadTask.findMany.mockResolvedValue([{ id: 't1', title: 'Knock on doors near Ramsey Ave', assignedToId: 'u-dana', createdById: 'u-sarah', completedById: null, assignedTo: { firstName: 'Dana' }, createdBy: { firstName: 'Sarah' }, completedBy: null }]);
  prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
  searcherFor.mockResolvedValue(null);
});

describe.each([['tasks', getTasks], ['search-areas', getAreas]])('%s', (what, handler) => {
  test('with no sign-in it is refused', async () => {
    const res = await ask(handler, what);
    expect(res.status).toBe(401);
    expect(JSON.stringify(await res.json())).not.toMatch(/Dana|Sarah|Ramsey|sheds/);
  });

  test('a signed-in stranger is refused', async () => {
    searcherFor.mockResolvedValue(STRANGER);
    expect((await ask(handler, what)).status).toBe(403);
  });

  test('the owner reads it, with people by first name and no account ids', async () => {
    searcherFor.mockResolvedValue(OWNER);
    const res = await ask(handler, what);
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).toMatch(/Dana/);
    expect(text).not.toMatch(/u-dana|u-sarah|"id":"u-|lastName|assignedToId|createdById/);
  });
});

test('the tasks list asks the database for first names only', async () => {
  searcherFor.mockResolvedValue(OWNER);
  await ask(getTasks, 'tasks');
  const { include } = prisma.squadTask.findMany.mock.calls[0][0];
  expect(include.assignedTo.select).toEqual({ firstName: true });
  expect(include.createdBy.select).toEqual({ firstName: true });
});

test('search areas are read for the pet the address names, never for whichever comes first', async () => {
  searcherFor.mockResolvedValue(OWNER);
  await ask(getAreas, 'search-areas', 'AUS-2026-0001');
  expect(prisma.case.findFirst.mock.calls[0][0].where).toEqual({ caseNumber: 'AUS-2026-0001' });
  // And asks for first names only.
  expect(prisma.case.findFirst.mock.calls[0][0].include.assignments.include.searchAreas.include.markedBy.select).toEqual({ firstName: true });
});

test('a pet named by its id is found by its id (an id here is not a UUID, and it used to match nothing)', async () => {
  searcherFor.mockResolvedValue(OWNER);
  const res = await ask(getAreas, 'search-areas', 'cmw6n56y5005jf3ibf6fr90j2');
  expect(res.status).toBe(200);
  expect(prisma.case.findFirst.mock.calls[0][0].where).toEqual({ id: 'cmw6n56y5005jf3ibf6fr90j2' });
});

test('one area whose shape cannot be read does not take the list down', async () => {
  searcherFor.mockResolvedValue(OWNER);
  prisma.case.findFirst.mockResolvedValue({ id: 'case-max', assignments: [{ rescueSquadId: 'force-1', searchAreas: [{ ...AREA, geometry: 'not json', markedBy: null }] }] });
  const res = await ask(getAreas, 'search-areas');
  expect(res.status).toBe(200);
  const [area] = (await res.json()).searchAreas;
  expect(area.geometry).toBeNull();
  expect(area.markedBy).toEqual({ name: 'A helper' });
});

test('saving an area the older way is switched off, for anyone, and nothing is written', async () => {
  searcherFor.mockResolvedValue(OWNER);
  const res = await postArea(
    new NextRequest('http://localhost/api/missions/case-max/search-areas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: [{ lat: 30.3, lng: -97.7 }, { lat: 30.31, lng: -97.71 }], notes: 'x'.repeat(50000) }) }),
    { params: { missionId: 'case-max' } }
  );
  expect(res.status).toBe(410);
  expect(prisma.case.findFirst).not.toHaveBeenCalled();
  expect(prisma.searchArea.create).not.toHaveBeenCalled();
});
