/**
 * Who is searching (app/lib/searcher.js): the one place a request becomes
 * a person on a pet's search.
 *
 * Three things ride on it. `seesNames`: the owner and the forces looking
 * for the pet see who is on each street, and nobody else does. `leads`:
 * the owner, and nobody else, runs the search from the desk: steers it,
 * asks a named helper to walk a street, writes to them. A command role in
 * a Rescue Force does not, because nobody has to agree to one: a force
 * with no leader gives the role to any member who asks, and anyone can
 * found a force. Joining a force takes one tap, so membership opens first
 * names and nothing more. `isOwner` is the pet's
 * reporter alone, and it is what answering a sighting asks for. And a
 * helper without an account is the pair of an id and the device key they
 * joined with: the id alone is nobody.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    case: { findUnique: jest.fn() },
    caseAssignment: { findMany: jest.fn() },
    rescueForceMember: { findMany: jest.fn() },
    missionVolunteer: { findFirst: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { searcherFor } from '@/app/lib/searcher';
import { FORCE_COMMAND_ROLES } from '@/app/lib/forceRoles';

const CASE = 'case-max';
const request = (headers = {}) => new Request('http://localhost/api/mission/case-max/board', { headers });

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue(null);
  prisma.user.findUnique.mockResolvedValue({ firstName: 'Sarah Jane', waiverAcceptedAt: new Date() });
  prisma.case.findUnique.mockResolvedValue({ reporterId: 'user-avery' });
  prisma.caseAssignment.findMany.mockResolvedValue([{ rescueSquadId: 'force-1' }]);
  prisma.rescueForceMember.findMany.mockResolvedValue([]);
  prisma.missionVolunteer.findFirst.mockResolvedValue(null);
});

test('someone only looking is nobody', async () => {
  expect(await searcherFor(request(), CASE)).toBeNull();
});

test('the owner sees names, leads, and needs no waiver for their own pet', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'user-avery' } });
  prisma.user.findUnique.mockResolvedValue({ firstName: 'Avery', waiverAcceptedAt: null });
  expect(await searcherFor(request(), CASE)).toEqual({ id: 'user-avery', kind: 'user', userId: 'user-avery', volunteerId: null, firstName: 'Avery', isOwner: true, waiver: true, seesNames: true, leads: true });
  // No force is consulted for the owner.
  expect(prisma.rescueForceMember.findMany).not.toHaveBeenCalled();
});

test('a member of a force looking for the pet sees names, and neither leads nor is the owner', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'user-mike' } });
  prisma.rescueForceMember.findMany.mockResolvedValue([{ role: 'MEMBER' }]);
  const who = await searcherFor(request(), CASE);
  expect(who).toMatchObject({ firstName: 'Sarah', isOwner: false, seesNames: true, leads: false });
  expect(prisma.rescueForceMember.findMany).toHaveBeenCalledWith({ where: { userId: 'user-mike', isActive: true, rescueSquadId: { in: ['force-1'] } }, select: { role: true } });
});

test.each(FORCE_COMMAND_ROLES)('a %s of such a force sees names like any member, and does not run the search', async (role) => {
  // A stranger reaches this role in two taps where a force has no leader (join, then claim leadership), and by
  // founding a force for a town. None of that is the owner's doing, so none of it runs the owner's search.
  getServerSession.mockResolvedValue({ user: { id: 'user-sarah' } });
  prisma.rescueForceMember.findMany.mockResolvedValue([{ role: 'MEMBER' }, { role }]);
  expect(await searcherFor(request(), CASE)).toMatchObject({ seesNames: true, leads: false, isOwner: false });
});

test('running a search is not read from a force role anywhere in the file', () => {
  const source = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'app', 'lib', 'searcher.js'), 'utf8');
  expect(source).toMatch(/leads: isOwner,/);
  expect(source).not.toMatch(/FORCE_COMMAND_ROLES/);
});

test('leading a force that is not looking for this pet counts for nothing here', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'user-sarah' } });
  prisma.caseAssignment.findMany.mockResolvedValue([]);
  expect(await searcherFor(request(), CASE)).toMatchObject({ isOwner: false, seesNames: false, leads: false });
  expect(prisma.rescueForceMember.findMany).not.toHaveBeenCalled();
});

test('a helper without an account is the pair of their id and the device key, for this pet', async () => {
  prisma.missionVolunteer.findFirst.mockResolvedValue({ id: 'vol-1', displayName: 'Dana Smith', waiverAcceptedAt: new Date() });
  const who = await searcherFor(request({ 'x-volunteer-id': 'vol-1', 'x-volunteer-key': 'dev_abc' }), CASE);
  expect(who).toEqual({ id: 'v:vol-1', kind: 'volunteer', userId: null, volunteerId: 'vol-1', firstName: 'Dana', isOwner: false, waiver: true, seesNames: false, leads: false });
  expect(prisma.missionVolunteer.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'vol-1', odId: 'dev_abc', mission: { caseId: CASE } } }));
});

test('the id alone, or the key alone, is nobody', async () => {
  prisma.missionVolunteer.findFirst.mockResolvedValue({ id: 'vol-1', displayName: 'Dana', waiverAcceptedAt: new Date() });
  expect(await searcherFor(request({ 'x-volunteer-id': 'vol-1' }), CASE)).toBeNull();
  expect(await searcherFor(request({ 'x-volunteer-key': 'dev_abc' }), CASE)).toBeNull();
  expect(prisma.missionVolunteer.findFirst).not.toHaveBeenCalled();
});
