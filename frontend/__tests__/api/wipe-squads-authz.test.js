/**
 * SEC-14 regression - the highest-stakes test in the app.
 *
 * POST /api/admin/wipe-squads irreversibly deletes ALL squads/members/divisions/
 * assignments. EA's admin audit found it gated on session only (any logged-in
 * user could wipe the entire squad dataset). Fixed with isAdmin() (fresh-DB role)
 * before any delete. Keystone: a non-admin is 403'd AND no destructive deleteMany
 * ever runs (the "squad count unchanged" guarantee).
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    rescueForce: { count: jest.fn(), deleteMany: jest.fn() },
    rescueForceMember: { count: jest.fn(), deleteMany: jest.fn() },
    caseAssignment: { count: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
    division: { count: jest.fn(), deleteMany: jest.fn() },
    caseParticipant: { deleteMany: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/authz', () => ({ __esModule: true, isAdmin: jest.fn() }));

import { POST } from '@/app/api/admin/wipe-squads/route';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { isAdmin } from '@/app/lib/authz';

function call() {
  return POST(new NextRequest('http://localhost:3000/api/admin/wipe-squads', { method: 'POST' }));
}

describe('SEC-14: POST /api/admin/wipe-squads is admin-only', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: 'u1', email: 'u@x.com' } });
    isAdmin.mockResolvedValue(false);
    // Make the admin happy-path complete without throwing.
    for (const model of ['rescueForce', 'rescueForceMember', 'caseAssignment', 'division']) {
      prisma[model].count.mockResolvedValue(0);
    }
    for (const model of ['rescueForce', 'rescueForceMember', 'caseAssignment', 'division', 'caseParticipant']) {
      prisma[model].deleteMany.mockResolvedValue({ count: 0 });
    }
    prisma.caseAssignment.findMany.mockResolvedValue([]);
  });

  test('no session => 401, nothing deleted', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(401);
    expect(prisma.rescueForce.deleteMany).not.toHaveBeenCalled();
  });

  test('KEYSTONE: a non-admin is 403 AND no squads are wiped', async () => {
    const res = await call();
    expect(res.status).toBe(403);
    expect(prisma.rescueForce.deleteMany).not.toHaveBeenCalled();
    expect(prisma.rescueForceMember.deleteMany).not.toHaveBeenCalled();
    expect(prisma.division.deleteMany).not.toHaveBeenCalled();
    expect(prisma.caseAssignment.deleteMany).not.toHaveBeenCalled();
  });

  test('an admin is allowed to run the wipe (gate passes through)', async () => {
    isAdmin.mockResolvedValue(true);
    const res = await call();
    expect(res.status).toBeLessThan(400);
    expect(prisma.rescueForce.deleteMany).toHaveBeenCalled();
  });
});
