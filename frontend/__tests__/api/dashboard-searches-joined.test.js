/**
 * GET /api/dashboard: "Searches you joined" includes the searches a person
 * took part in on the search screen (Mission Control), not only those
 * joined through a Rescue Force's assignment.
 *
 * Testing found David had searched four of Pip's five areas and his
 * dashboard had no Pip: the list read only force-assignment participation,
 * and most helpers never join a force.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    caseSighting: { groupBy: jest.fn().mockResolvedValue([]) },
    missionControl: { findMany: jest.fn().mockResolvedValue([]) },
    caseAssignment: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
    pet: { findMany: jest.fn().mockResolvedValue([]) },
    searchSession: { updateMany: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
    case: { findMany: jest.fn().mockResolvedValue([]) },
    searchZoneVisit: { findMany: jest.fn().mockResolvedValue([]) },
    missionVolunteer: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

import { GET } from '@/app/api/dashboard/route';
import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';

const PIP = { id: 'case-pip', caseNumber: 'AUS-2026-0042', petName: 'Pip', petSpecies: 'DOG', petPhotoUrl: '/uploads/pip.jpg', lastSeenAt: new Date(Date.now() - 50 * 3600000), status: 'IN_PROGRESS' };
const REX = { id: 'case-rex', caseNumber: 'AUS-2026-0050', petName: 'Rex', petSpecies: 'DOG', petPhotoUrl: null, lastSeenAt: new Date(Date.now() - 5 * 3600000), status: 'ACTIVE' };

const david = (over = {}) => ({
  id: 'u-david', email: 'david@example.com', firstName: 'David', role: 'USER',
  patrolProfile: null, profile: null, cases: [], rescueSquadMemberships: [], caseParticipations: [], ...over,
});

const load = async () => (await GET(new Request('http://localhost/api/dashboard'))).json();

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: 'u-david', email: 'david@example.com' } });
  prisma.user.findUnique.mockResolvedValue(david());
  // David searched four of Pip's five areas (one of them twice) and is on a fifth.
  prisma.searchZoneVisit.findMany.mockResolvedValue([
    { caseId: 'case-pip', zoneId: 'z-west', outcome: null },
    { caseId: 'case-pip', zoneId: 'z-south', outcome: 'SEARCHED' },
    { caseId: 'case-pip', zoneId: 'z-east', outcome: 'SEARCHED' },
    { caseId: 'case-pip', zoneId: 'z-north', outcome: 'SEARCHED' },
    { caseId: 'case-pip', zoneId: 'z-middle', outcome: 'SEARCHED' },
    { caseId: 'case-pip', zoneId: 'z-middle', outcome: 'SEARCHED' },
  ]);
  prisma.missionVolunteer.findMany.mockResolvedValue([]);
  prisma.case.findMany.mockImplementation(async ({ where }) => [PIP, REX].filter((c) => where.id.in.includes(c.id)));
});

test('a search David took part in on the search screen is one of his searches, with the areas he searched', async () => {
  const body = await load();
  const pip = body.missions.find((m) => m.id === 'case-pip');
  expect(pip).toMatchObject({ missionNumber: 'AUS-2026-0042', petName: 'Pip', isOwner: false, myAreas: 4, hoursMissing: 50, mySquad: null });
  // Read for his account, only where he went out on an area.
  expect(prisma.searchZoneVisit.findMany.mock.calls[0][0].where).toEqual({ searcherId: 'u-david', startedAt: { not: null } });
});

test('a search joined from the pet\'s link while signed in counts too', async () => {
  prisma.searchZoneVisit.findMany.mockResolvedValue([]);
  prisma.missionVolunteer.findMany.mockResolvedValue([{ mission: { caseId: 'case-rex' } }]);
  const body = await load();
  expect(body.missions.map((m) => m.id)).toEqual(['case-rex']);
  expect(body.missions[0]).toMatchObject({ isOwner: false, myAreas: 0 });
  expect(prisma.missionVolunteer.findMany.mock.calls[0][0].where).toEqual({ userId: 'u-david' });
});

test('only pets still missing, never the person\'s own, and never twice', async () => {
  prisma.user.findUnique.mockResolvedValue(david({
    cases: [{ id: 'case-rex', caseNumber: 'AUS-2026-0050', petName: 'Rex', status: 'ACTIVE', lastSeenAt: REX.lastSeenAt, pet: null }],
  }));
  prisma.searchZoneVisit.findMany.mockResolvedValue([
    { caseId: 'case-pip', zoneId: 'z-north', outcome: 'SEARCHED' },
    { caseId: 'case-rex', zoneId: 'z-x', outcome: 'SEARCHED' },
  ]);
  prisma.missionVolunteer.findMany.mockResolvedValue([{ mission: { caseId: 'case-pip' } }]);
  const body = await load();
  expect(body.missions.map((m) => [m.id, m.isOwner])).toEqual([['case-rex', true], ['case-pip', false]]);
  const { where } = prisma.case.findMany.mock.calls[0][0];
  expect(where).toEqual({ id: { in: ['case-pip'] }, reportType: 'LOST', status: { in: ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'] } });
});

test('a pet of his force that he already searched for is not listed again under the force', async () => {
  prisma.user.findUnique.mockResolvedValue(david({
    rescueSquadMemberships: [{ role: 'MEMBER', joinedAt: new Date(), division: null, rescueSquad: { id: 'force-1', name: 'Austin Rescue Force', city: 'Austin', state: 'TX', isActive: true, _count: { members: 3 } } }],
  }));
  prisma.caseAssignment.findMany.mockImplementation(async ({ where }) => (where.rescueSquadId
    ? [{ rescueSquad: { id: 'force-1', name: 'Austin Rescue Force' }, case: { ...PIP, _count: { sightings: 2 } } }, { rescueSquad: { id: 'force-1', name: 'Austin Rescue Force' }, case: { ...REX, _count: { sightings: 0 } } }]
    : []));
  const body = await load();
  expect(body.missions.map((m) => m.id)).toEqual(['case-pip']);
  expect(body.forcePets.map((p) => p.id)).toEqual(['case-rex']);
});

test('a table that cannot be read leaves the rest of the dashboard standing', async () => {
  prisma.searchZoneVisit.findMany.mockRejectedValue(new Error('db down'));
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const res = await GET(new Request('http://localhost/api/dashboard'));
  expect(res.status).toBe(200);
  expect((await res.json()).missions).toEqual([]);
  console.error.mockRestore();
});
