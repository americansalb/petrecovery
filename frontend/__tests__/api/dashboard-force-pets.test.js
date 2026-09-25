/**
 * GET /api/dashboard: the pets missing in the areas of your Rescue Forces.
 *
 * Joining a force used to change nothing on the member's home page: only
 * searches they had personally joined were listed. forcePets lists the
 * force's live LOST cases, once each, leaving out the member's own pets and
 * searches they are already on; each force also carries its live count
 * (activeMissions), which the page's force rail read before the API sent it.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    caseSighting: { groupBy: jest.fn().mockResolvedValue([]) },
    missionControl: { findMany: jest.fn().mockResolvedValue([]) },
    caseAssignment: { findMany: jest.fn(), groupBy: jest.fn() },
    pet: { findMany: jest.fn().mockResolvedValue([]) },
    searchSession: { updateMany: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
    case: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

import { GET } from '@/app/api/dashboard/route';
import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';

const force = (id, name, isActive = true) => ({
  id, name, city: 'Austin', state: 'TX', logoUrl: null, photoUrl: null, rescueSquadLevel: 'ROOKIE',
  totalCasesCompleted: 0, successfulReunions: 0, isActive, _count: { members: 4 },
});

const lostCase = (id, name, hoursAgo) => ({
  id, caseNumber: `AUS-${id}`, petName: name, petSpecies: 'DOG', petPhotoUrl: '',
  lastSeenAt: new Date(Date.now() - hoursAgo * 3600000), _count: { sightings: 1 },
});

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: 'me', email: 'me@example.com' } });
  prisma.user.findUnique.mockResolvedValue({
    id: 'me', email: 'me@example.com', firstName: 'Me', role: 'USER',
    patrolProfile: null, profile: null,
    cases: [{ id: 'mine', caseNumber: 'AUS-mine', petName: 'Mine', status: 'ACTIVE', lastSeenAt: new Date(), pet: null }],
    rescueSquadMemberships: [
      { role: 'MEMBER', joinedAt: new Date(), division: null, rescueSquad: force('force-1', 'Austin Rescue Force') },
      { role: 'MEMBER', joinedAt: new Date(), division: null, rescueSquad: force('force-3', 'Round Rock Rescue Force') },
      { role: 'MEMBER', joinedAt: new Date(), division: null, rescueSquad: force('force-2', 'Paused Force', false) },
    ],
    caseParticipations: [
      {
        areasMarked: 0, sightingsReported: 0, searchHours: 0,
        assignment: {
          id: 'a-helping', rescueSquad: { id: 'force-1', name: 'Austin Rescue Force' }, _count: { participants: 2 },
          case: { id: 'helping', petName: 'Helping', petSpecies: 'CAT', lastSeenAddress: '', status: 'ACTIVE', lastSeenAt: new Date(), caseNumber: 'AUS-helping' },
        },
      },
    ],
  });
  prisma.caseAssignment.findMany.mockImplementation(async ({ where }) => {
    if (!where.rescueSquadId) return []; // assignments for my own / joined cases
    return [
      { rescueSquad: { id: 'force-1', name: 'Austin Rescue Force' }, case: lostCase('c1', 'Rocket', 3) },
      { rescueSquad: { id: 'force-3', name: 'Round Rock Rescue Force' }, case: lostCase('c1', 'Rocket', 3) },
      { rescueSquad: { id: 'force-1', name: 'Austin Rescue Force' }, case: lostCase('helping', 'Helping', 5) },
      { rescueSquad: { id: 'force-1', name: 'Austin Rescue Force' }, case: lostCase('mine', 'Mine', 6) },
      { rescueSquad: { id: 'force-3', name: 'Round Rock Rescue Force' }, case: lostCase('c4', 'Max', 18) },
    ];
  });
  prisma.caseAssignment.groupBy.mockResolvedValue([
    { rescueSquadId: 'force-1', _count: { _all: 3 } },
    { rescueSquadId: 'force-3', _count: { _all: 2 } },
  ]);
});

test('lists the live pets of my active forces, once each, minus my own and searches I am on', async () => {
  const res = await GET(new Request('http://localhost/api/dashboard'));
  const body = await res.json();
  expect(res.status).toBe(200);

  const forceQuery = prisma.caseAssignment.findMany.mock.calls.find(([arg]) => arg.where.rescueSquadId)[0];
  // Only forces that are active; LOST cases that are still open.
  expect(forceQuery.where.rescueSquadId).toEqual({ in: ['force-1', 'force-3'] });
  expect(forceQuery.where.case).toEqual({
    reportType: 'LOST',
    status: { in: ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'] },
  });

  expect(body.forcePets.map((p) => p.id)).toEqual(['c1', 'c4']);
  expect(body.forcePets[0]).toMatchObject({
    caseNumber: 'AUS-c1',
    petName: 'Rocket',
    hoursMissing: 3,
    sightings: 1,
    force: { id: 'force-1', name: 'Austin Rescue Force' },
  });
});

test('each force carries how many pets are missing in its area', async () => {
  const body = await (await GET(new Request('http://localhost/api/dashboard'))).json();
  const byId = Object.fromEntries(body.squads.map((s) => [s.id, s.activeMissions]));
  expect(byId).toEqual({ 'force-1': 3, 'force-3': 2 });
});

test('a failing force query leaves the rest of the dashboard standing', async () => {
  prisma.caseAssignment.groupBy.mockRejectedValue(new Error('db down'));
  const res = await GET(new Request('http://localhost/api/dashboard'));
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.forcePets).toEqual([]);
  expect(body.squads.every((s) => s.activeMissions === 0)).toBe(true);
});

test('someone in no force gets no force pets and no extra queries', async () => {
  prisma.user.findUnique.mockResolvedValue({
    id: 'me', email: 'me@example.com', firstName: 'Me', role: 'USER',
    patrolProfile: null, profile: null, cases: [], rescueSquadMemberships: [], caseParticipations: [],
  });
  const body = await (await GET(new Request('http://localhost/api/dashboard'))).json();
  expect(body.forcePets).toEqual([]);
  expect(prisma.caseAssignment.groupBy).not.toHaveBeenCalled();
});
