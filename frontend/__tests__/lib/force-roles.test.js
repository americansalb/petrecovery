/**
 * Force leader checks ask for roles a force member can actually have.
 *
 * app/lib/authz.js asked for role in ['MODERATOR', 'ADMIN'], and the
 * announcements API for 'DIVISION_LEAD', 'SQUAD_LEAD' or 'ADMIN'. None of
 * those but MODERATOR is a RescueForceMemberRole, so Prisma rejected the
 * leader query (a 500 from the mission command center, the live search and
 * "notify my force" for every leader who was not a platform admin or the
 * pet's owner), and no one could post an announcement. A mocked Prisma
 * doesn't validate enums, so the first test reads the schema itself.
 */

import fs from 'fs';
import path from 'path';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn() },
    case: { findUnique: jest.fn() },
    caseAssignment: { findMany: jest.fn() },
    rescueForceMember: { findFirst: jest.fn() },
    squadActivity: { create: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { FORCE_COMMAND_ROLES } from '@/app/lib/forceRoles';
import { userIsSquadLeader, userHasCaseAuthority } from '@/app/lib/authz';
import { POST as announce } from '@/app/api/rescue-forces/[id]/announcements/route';

function schemaEnum(name) {
  const schema = fs.readFileSync(path.join(__dirname, '../../prisma/schema.prisma'), 'utf8');
  const block = schema.match(new RegExp(`enum ${name} \\{([\\s\\S]*?)\\}`))[1];
  return block
    .split('\n')
    .map((line) => line.replace(/\/\/.*/, '').trim())
    .filter(Boolean);
}

test('every command role is a real RescueForceMemberRole', () => {
  const roles = schemaEnum('RescueForceMemberRole');
  expect(roles).toEqual(expect.arrayContaining(['FOUNDER', 'LEADER', 'COORDINATOR', 'MEMBER']));
  expect(FORCE_COMMAND_ROLES.filter((r) => !roles.includes(r))).toEqual([]);
  expect(FORCE_COMMAND_ROLES).not.toContain('MEMBER');
});

beforeEach(() => jest.clearAllMocks());

describe('authz leader checks', () => {
  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
  });

  test('userIsSquadLeader asks for command roles and accepts a leader', async () => {
    prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'm-1' });
    await expect(userIsSquadLeader('user-1', 'force-1')).resolves.toBe(true);
    const { where } = prisma.rescueForceMember.findFirst.mock.calls[0][0];
    expect(where).toMatchObject({ userId: 'user-1', rescueSquadId: 'force-1', isActive: true, role: { in: FORCE_COMMAND_ROLES } });
  });

  test('userHasCaseAuthority: a leader of the assigned force has it', async () => {
    prisma.case.findUnique.mockResolvedValue({ reporterId: 'someone-else' });
    prisma.caseAssignment.findMany.mockResolvedValue([{ rescueSquadId: 'force-1' }]);
    prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'm-1' });
    await expect(userHasCaseAuthority('user-1', 'case-1')).resolves.toBe(true);
    expect(prisma.rescueForceMember.findFirst.mock.calls[0][0].where.role).toEqual({ in: FORCE_COMMAND_ROLES });
  });
});

describe('posting an announcement', () => {
  const post = () =>
    announce(
      new Request('http://localhost/api/rescue-forces/force-1/announcements', {
        method: 'POST',
        body: JSON.stringify({ title: 'Search Saturday', content: 'Meet at the library at 9.' }),
      }),
      { params: { id: 'force-1' } }
    );

  beforeEach(() => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    prisma.squadActivity.create.mockImplementation(async ({ data }) => ({
      id: 'a-1',
      createdAt: new Date(),
      actor: { firstName: 'Kim', lastName: 'Lee' },
      ...data,
    }));
  });

  test.each(['FOUNDER', 'LEADER', 'COORDINATOR'])('a %s can post one', async (role) => {
    prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'm-1', role, divisionId: null });
    const res = await post();
    expect(res.status).toBe(200);
    expect((await res.json()).announcement).toMatchObject({ title: 'Search Saturday' });
  });

  test('a member cannot', async () => {
    prisma.rescueForceMember.findFirst.mockResolvedValue({ id: 'm-1', role: 'MEMBER', divisionId: null });
    const res = await post();
    expect(res.status).toBe(403);
    expect(prisma.squadActivity.create).not.toHaveBeenCalled();
  });
});
