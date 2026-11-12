/**
 * The pets a force is looking for (GET /api/rescue-forces/[id]/active-missions).
 *
 * It sent each pet's whole report to any member of the force: the owner's
 * email, phone, full name and account id, the answers to the questionnaire
 * with the microchip number, and every helper's account id and last name.
 * Joining a force is one tap. A member is told what the pet's own page
 * tells anyone, and who else is on it by first name.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    rescueForceMember: { findFirst: jest.fn() },
    caseAssignment: { findMany: jest.fn() },
    rescueForce: { findUnique: jest.fn() },
    case: { findMany: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { GET } from '@/app/api/rescue-forces/[id]/active-missions/route';
import { GET as availableGET } from '@/app/api/rescue-forces/[id]/available-missions/route';
import { GET as nearbyGET } from '@/app/api/rescue-forces/[id]/nearby-missions/route';
import { PUBLIC_CASE_FIELDS, PRIVATE_CASE_FIELDS } from '@/app/lib/casePublicFields';

const ask = (id = 'force-1') => GET(new Request(`http://localhost/api/rescue-forces/${id}/active-missions`), { params: id ? { id } : {} });
const keysDeep = (value, into = new Set()) => {
  if (Array.isArray(value)) value.forEach((v) => keysDeep(v, into));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => { into.add(k); keysDeep(v, into); });
  return into;
};

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: 'u-mike' } });
  prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'm-1' });
  prisma.caseAssignment.findMany.mockResolvedValue([
    {
      id: 'a-1',
      missionId: 'case-max',
      rescueSquadId: 'force-1',
      status: 'ACCEPTED',
      case: { id: 'case-max', caseNumber: 'AUS-1', petName: 'Max', reporter: { firstName: 'Avery' } },
      participants: [
        { id: 'p-1', userId: 'u-mike', optedInAt: new Date(0), user: { firstName: 'Mike', rescueLevel: 'SCOUT' } },
        { id: 'p-2', userId: 'u-dana', optedInAt: new Date(0), user: { firstName: 'Dana Lee', rescueLevel: 'SCOUT' } },
      ],
      _count: { participants: 2, searchAreas: 0, petSpottings: 0 },
    },
  ]);
});

test('the database is asked for the pet\'s public fields and first names, and nothing about how to reach the owner', async () => {
  await ask();
  const query = prisma.caseAssignment.findMany.mock.calls[0][0];
  // A whitelist: `select` everywhere, never a whole row.
  expect(query.include).toBeUndefined();
  expect(query.select.case.include).toBeUndefined();
  const asked = [...keysDeep(query.select)];
  expect(asked.filter((k) => /email|phone|lastName|ownerName|reporterId|details|microchip|password|acceptedById/i.test(k))).toEqual([]);
  expect(query.select.case.select.reporter).toEqual({ select: { firstName: true } });
  expect(query.select.participants.select.user).toEqual({ select: { firstName: true, rescueLevel: true } });
});

test('a member gets the pets, who is on each by first name, and which row is their own', async () => {
  const res = await ask();
  expect(res.status).toBe(200);
  const [first] = (await res.json()).assignments;
  expect(first.case).toEqual({ id: 'case-max', caseNumber: 'AUS-1', petName: 'Max', reporter: { firstName: 'Avery' } });
  expect(first.participants.map((p) => [p.user.firstName, p.mine])).toEqual([['Mike', true], ['Dana', false]]);
  expect(first).toMatchObject({ isUserParticipating: true, userParticipationId: 'p-1' });
  expect(JSON.stringify(first.participants)).not.toMatch(/userId|u-dana|u-mike/);
});

test('someone who is not in the force: 403, and no pets are read', async () => {
  prisma.rescueForceMember.findFirst.mockResolvedValue(null);
  expect((await ask()).status).toBe(403);
  expect(prisma.caseAssignment.findMany).not.toHaveBeenCalled();
});

test('nobody signed in: 401; an address with no force in it: 404', async () => {
  expect((await ask('')).status).toBe(404);
  getServerSession.mockResolvedValue(null);
  expect((await ask()).status).toBe(401);
  getServerSession.mockResolvedValue({ user: {} });
  expect((await ask()).status).toBe(401);
  expect(prisma.caseAssignment.findMany).not.toHaveBeenCalled();
});

describe('the two other lists a force reads', () => {
  const ctx = { params: { id: 'force-1' } };

  beforeEach(() => {
    prisma.rescueForce.findUnique.mockResolvedValue({ id: 'force-1', city: 'Austin', state: 'TX', radiusMiles: 10, centerLatitude: 30.3, centerLongitude: -97.7 });
    prisma.case.findMany.mockResolvedValue([{ id: 'case-pip', caseNumber: 'AUS-2', petName: 'Pip', lastSeenLatitude: 30.31, lastSeenLongitude: -97.71, reporter: { firstName: 'Avery' }, assignments: [], _count: { assignments: 0, sightings: 0 } }]);
  });

  test('the public fields of a report name nothing private', () => {
    const asked = [...keysDeep(PUBLIC_CASE_FIELDS)];
    expect(asked.filter((k) => PRIVATE_CASE_FIELDS.includes(k))).toEqual([]);
    expect(asked.filter((k) => /email|phone|lastName|owner|password|token/i.test(k))).toEqual([]);
    expect(PUBLIC_CASE_FIELDS.reporter).toEqual({ select: { firstName: true } });
  });

  test('pets a force could take: asked for by their public fields, never whole', async () => {
    const res = await availableGET(new Request('http://localhost/api/rescue-forces/force-1/available-missions'), ctx);
    expect(res.status).toBe(200);
    const query = prisma.case.findMany.mock.calls[0][0];
    expect(query.include).toBeUndefined();
    expect(query.select).toMatchObject(PUBLIC_CASE_FIELDS);
    const asked = [...keysDeep(query.select)];
    expect(asked.filter((k) => PRIVATE_CASE_FIELDS.includes(k) || /email|phone|lastName|acceptedById/i.test(k))).toEqual([]);
  });

  test('pets near a force: the owner is a first name, not the name typed on the report', async () => {
    const res = await nearbyGET(new Request('http://localhost/api/rescue-forces/force-1/nearby-missions'), ctx);
    expect(res.status).toBe(200);
    const query = prisma.case.findMany.mock.calls[0][0];
    expect(query.include).toBeUndefined();
    expect(query.select.ownerName).toBeUndefined();
    expect(query.select.reporter).toEqual({ select: { firstName: true } });
    expect([...keysDeep(query.select)].filter((k) => PRIVATE_CASE_FIELDS.includes(k))).toEqual([]);
  });

  test('neither answers someone who is not in the force', async () => {
    prisma.rescueForceMember.findFirst.mockResolvedValue(null);
    expect((await availableGET(new Request('http://localhost/x'), ctx)).status).toBe(403);
    expect((await nearbyGET(new Request('http://localhost/x'), ctx)).status).toBe(403);
    expect(prisma.case.findMany).not.toHaveBeenCalled();
  });
});
