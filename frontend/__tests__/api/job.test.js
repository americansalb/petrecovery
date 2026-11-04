/**
 * GET /api/public/missions/[caseNumber]/job: one job for the person
 * asking. Signed in only; needs and the party for members of the force
 * looking for the pet; a closed or found pet has no jobs.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findUnique: jest.fn() },
    rescueForceMember: { findMany: jest.fn() },
  },
}));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => {}) }));
jest.mock('@/app/lib/jobs', () => {
  const actual = jest.requireActual('@/app/lib/jobs');
  return { __esModule: true, ...actual, pickJob: jest.fn() };
});

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { pickJob } from '@/app/lib/jobs';
import { GET } from '@/app/api/public/missions/[caseNumber]/job/route';

const MAX = {
  id: 'case-max',
  status: 'ACTIVE',
  reportType: 'LOST',
  petName: 'Max',
  petSpecies: 'DOG',
  petBreed: 'Golden Retriever',
  petColor: 'Golden',
  assignments: [{ rescueSquad: { id: 'force-austin', name: 'Austin Rescue Force' } }],
};

const call = (query = '') =>
  GET(new Request(`http://localhost/api/public/missions/AUS-2026-0001/job${query}`), { params: Promise.resolve({ caseNumber: 'AUS-2026-0001' }) });

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findUnique.mockResolvedValue(MAX);
  prisma.rescueForceMember.findMany.mockResolvedValue([]);
  pickJob.mockResolvedValue({ job: { kind: 'block', title: 'Walk C4' }, alternatives: [], brief: [], way: 'On foot', when: 'Now, 30 minutes' });
});

test('a visitor is asked to sign in', async () => {
  getServerSession.mockResolvedValue(null);
  const res = await call();
  expect(res.status).toBe(401);
  expect(pickJob).not.toHaveBeenCalled();
});

test('a member gets a job with needs on the table', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'sarah' } });
  prisma.rescueForceMember.findMany.mockResolvedValue([{ rescueSquadId: 'force-austin' }]);
  const res = await call('?way=foot&when=now60&lat=30.26&lng=-97.75');
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.job.title).toBe('Walk C4');
  expect(body.member).toBe(true);
  expect(body.force).toEqual({ id: 'force-austin', name: 'Austin Rescue Force' });
  expect(pickJob).toHaveBeenCalledWith(
    expect.objectContaining({ forceId: 'force-austin', userId: 'sarah', member: true, way: 'foot', when: 'now60', near: { lat: 30.26, lng: -97.75 } })
  );
});

test('someone signed in but not in the force asks as a non-member, and is told the force', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'jess' } });
  const res = await call('?way=home');
  const body = await res.json();
  expect(body.member).toBe(false);
  expect(body.force.name).toBe('Austin Rescue Force');
  expect(pickJob).toHaveBeenCalledWith(expect.objectContaining({ member: false, way: 'home', near: null }));
});

test('an unknown way or time falls back to on foot, now', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'sarah' } });
  await call('?way=boat&when=someday');
  expect(pickJob).toHaveBeenCalledWith(expect.objectContaining({ way: 'foot', when: 'now30' }));
});

test('a pet that is home, or a found pet, has no jobs', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'sarah' } });
  prisma.case.findUnique.mockResolvedValue({ ...MAX, status: 'REUNITED' });
  expect((await call()).status).toBe(409);
  prisma.case.findUnique.mockResolvedValue({ ...MAX, reportType: 'FOUND' });
  expect((await call()).status).toBe(409);
  prisma.case.findUnique.mockResolvedValue(null);
  expect((await call()).status).toBe(404);
});
