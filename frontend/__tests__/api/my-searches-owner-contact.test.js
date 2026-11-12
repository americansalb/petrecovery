/**
 * The two lists of a person's searches (GET /api/missions/my-missions and
 * GET /api/missions/my-feed) and what they say about an owner.
 *
 * my-missions sent the owner's account email, account phone and full name
 * for every pet the asker was helping with. Starting a walk makes anyone a
 * helper, so any account could read any owner's sign-in address. my-feed
 * sent the owner's full name to every member of a force, and joining a
 * force is one tap.
 *
 * An owner's contact details go to the owner. Anyone else gets a first
 * name. The number to call is the one the owner put on the pet's page.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findMany: jest.fn() },
    rescueForceMember: { findMany: jest.fn() },
    caseAssignment: { findMany: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { GET as myMissions } from '@/app/api/missions/my-missions/route';
import { GET as myFeed } from '@/app/api/missions/my-feed/route';

const pet = (over = {}) => ({
  id: 'case-max',
  caseNumber: 'AUS-1',
  petName: 'Max',
  petSpecies: 'DOG',
  status: 'ACTIVE',
  lastSeenAt: new Date(),
  lastSeenAddress: 'Sinclair Ave, Austin, TX',
  assignments: [],
  ...over,
});
const keysDeep = (value, into = new Set()) => {
  if (Array.isArray(value)) value.forEach((v) => keysDeep(v, into));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => { into.add(k); keysDeep(v, into); });
  return into;
};

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: 'u-mike' } });
});

describe('my-missions', () => {
  const ask = () => myMissions(new Request('http://localhost/api/missions/my-missions'));

  test('for a pet someone is helping with, the owner is a first name and nothing else', async () => {
    prisma.case.findMany
      .mockResolvedValueOnce([]) // their own
      .mockResolvedValueOnce([pet({ reporter: { firstName: 'Avery Jo' } })]); // helping with
    const res = await ask();
    expect(res.status).toBe(200);
    const [mission] = (await res.json()).missions;
    expect(mission).toMatchObject({ id: 'case-max', ownerName: 'Avery', ownerPhone: null, ownerEmail: null });
  });

  test('the question asked about someone else\'s pet does not name the owner\'s email, phone or last name', async () => {
    prisma.case.findMany.mockResolvedValue([]);
    await ask();
    expect(prisma.case.findMany).toHaveBeenCalledTimes(2);
    const helping = prisma.case.findMany.mock.calls.find(([q]) => !q.where.reporterId)[0];
    expect(helping.select.reporter).toEqual({ select: { firstName: true } });
    // The select is a whitelist: nothing about the owner comes back except through `reporter`.
    expect([...keysDeep(helping.select)].filter((k) => /email|phone|lastName|ownerName|ownerPhone|ownerEmail/i.test(k))).toEqual([]);
  });

  test('even if the database handed more back, a helper is not sent it', async () => {
    prisma.case.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([pet({ reporter: { firstName: 'Avery', lastName: 'Lindqvist', email: 'avery@example.com', phone: '5125550100' } })]);
    const body = JSON.stringify(await (await ask()).json());
    expect(body).not.toMatch(/Lindqvist|avery@example\.com|5125550100/);
  });

  test('an owner still gets their own contact details', async () => {
    prisma.case.findMany
      .mockResolvedValueOnce([pet({ reporter: { firstName: 'Mike', lastName: 'Okafor', email: 'mike@example.com', phone: '5125550101' } })])
      .mockResolvedValueOnce([]);
    const [mission] = (await (await ask()).json()).missions;
    expect(mission).toMatchObject({ ownerName: 'Mike Okafor', ownerPhone: '5125550101', ownerEmail: 'mike@example.com' });
  });

  test('a pet that is both theirs and one they help with counts as theirs', async () => {
    const mine = pet({ reporter: { firstName: 'Mike', lastName: 'Okafor', email: 'mike@example.com', phone: '5125550101' } });
    prisma.case.findMany.mockResolvedValueOnce([mine]).mockResolvedValueOnce([pet({ reporter: { firstName: 'Mike' } })]);
    const { missions } = await (await ask()).json();
    expect(missions).toHaveLength(1);
    expect(missions[0].ownerEmail).toBe('mike@example.com');
  });

  test('nobody signed in: 401, and nothing is read', async () => {
    getServerSession.mockResolvedValue(null);
    expect((await ask()).status).toBe(401);
    expect(prisma.case.findMany).not.toHaveBeenCalled();
  });

  test('a failure says only that it failed', async () => {
    prisma.case.findMany.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await ask();
    quiet.mockRestore();
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toMatch(/ECONNREFUSED|10\.0\.0\.5/);
  });
});

describe('my-feed', () => {
  const ask = () => myFeed(new Request('http://localhost/api/missions/my-feed'));

  test('a member of a force is told the owner\'s first name, not the last', async () => {
    prisma.rescueForceMember.findMany.mockResolvedValue([{ rescueSquadId: 'force-1', divisionId: null, rescueSquad: { id: 'force-1', name: 'Austin' }, division: null }]);
    prisma.caseAssignment.findMany.mockResolvedValue([
      { id: 'a-1', rescueSquadId: 'force-1', status: 'ACCEPTED', activeMembers: 0, participants: [], rescueSquad: { id: 'force-1', name: 'Austin' }, case: pet({ reporter: { firstName: 'Avery' } }) },
    ]);
    const res = await ask();
    expect(res.status).toBe(200);
    const [first] = (await res.json()).cases;
    expect(first.reporter).toEqual({ firstName: 'Avery' });
    const asked = prisma.caseAssignment.findMany.mock.calls[0][0];
    expect(asked.include.case.include.reporter).toEqual({ select: { firstName: true } });
  });
});
