/**
 * GET /api/rescue-forces/[id]: the force page's own data.
 *
 * It answered an empty 500 to everyone. It asked Prisma for a division
 * column that does not exist (activeMissions; the column is activeCases),
 * and it logged signed-out visitors with actor_role 'anonymous', which
 * logEvent rejects by throwing, including from inside the catch block.
 *
 * Fixing that would have switched on a leak the crash was hiding: the
 * route selected every member's email and full name for anyone who asked.
 * These tests hold both halves: the route answers, and it shows names the
 * way /api/rescue-forces/[id]/members does (first names to the public, a
 * last initial to members, full names to the force's leaders) and never
 * an email.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { rescueForce: { findUnique: jest.fn() } },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
// Same rule as the real logEvent (ACTOR_ROLES in lib/logging.js): any other
// actor_role throws. That throw is what turned every public view into a 500.
jest.mock('@/lib/logging', () => ({
  __esModule: true,
  logEvent: jest.fn(async (event) => {
    const roles = ['OWNER', 'VOLUNTEER', 'SHELTER_ADMIN', 'ADMIN', 'SYSTEM', 'USER'];
    if (event.actor_role != null && !roles.includes(event.actor_role)) {
      throw new Error(`logEvent: actor_role must be one of: ${roles.join(', ')}, or null`);
    }
  }),
}));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { GET } from '@/app/api/rescue-forces/[id]/route';

const FORCE = {
  id: 'force-1',
  name: 'Austin Rescue Force',
  city: 'Austin',
  state: 'TX',
  members: [
    { id: 'm1', userId: 'u-founder', role: 'FOUNDER', isActive: true, user: { id: 'u-founder', firstName: 'Avery', lastName: 'Admin' } },
    { id: 'm2', userId: 'u-member', role: 'MEMBER', isActive: true, user: { id: 'u-member', firstName: 'Sarah', lastName: 'Lopez' } },
  ],
  divisions: [{ id: 'd1', name: 'South', description: null, totalMembers: 2, activeCases: 3 }],
  _count: { members: 2, caseAssignments: 4 },
};

async function view(session) {
  getServerSession.mockResolvedValue(session);
  const res = await GET(new Request('http://localhost/api/rescue-forces/force-1'), { params: { id: 'force-1' } });
  return { res, body: await res.json() };
}

beforeEach(() => {
  prisma.rescueForce.findUnique.mockReset().mockResolvedValue(structuredClone(FORCE));
});

test('a signed-out visitor gets the force, not a 500', async () => {
  const { res, body } = await view(null);
  expect(res.status).toBe(200);
  expect(body.squad.name).toBe('Austin Rescue Force');
});

test('the query asks for columns that exist and never for an email', async () => {
  await view(null);
  const { include } = prisma.rescueForce.findUnique.mock.calls[0][0];
  expect(include.divisions.select.activeCases).toBe(true);
  expect(include.divisions.select.activeMissions).toBeUndefined();
  expect(include.members.include.user.select.email).toBeUndefined();
});

test('the public sees first names only', async () => {
  const { body } = await view(null);
  expect(body.squad.members.map((m) => m.user)).toEqual([
    { id: 'u-founder', firstName: 'Avery', lastName: '' },
    { id: 'u-member', firstName: 'Sarah', lastName: '' },
  ]);
  expect(JSON.stringify(body)).not.toMatch(/Lopez|Admin"|@/);
});

test('a member sees last initials; a founder or leader sees full names', async () => {
  const member = await view({ user: { id: 'u-member', role: 'USER' } });
  expect(member.body.squad.members.map((m) => m.user.lastName)).toEqual(['A.', 'L.']);

  const founder = await view({ user: { id: 'u-founder', role: 'USER' } });
  expect(founder.body.squad.members.map((m) => m.user.lastName)).toEqual(['Admin', 'Lopez']);
});

test('divisions still carry activeMissions for pages written against the old name', async () => {
  const { body } = await view(null);
  expect(body.squad.divisions[0]).toMatchObject({ activeCases: 3, activeMissions: 3 });
});

test('an unknown force is a 404, also for a signed-out visitor', async () => {
  prisma.rescueForce.findUnique.mockResolvedValue(null);
  const { res } = await view(null);
  expect(res.status).toBe(404);
});
