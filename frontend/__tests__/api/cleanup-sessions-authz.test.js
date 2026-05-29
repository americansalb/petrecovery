/**
 * SEC-15 regression: GET /api/admin/cleanup-sessions is admin-only.
 *
 * EA's admin audit found it session-only gated — any logged-in user could force
 * ALL active/ready search sessions to COMPLETED (kill everyone's in-progress
 * searches). Fixed with isAdmin(). Keystone: non-admin => 403 AND no updateMany.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { searchSession: { updateMany: jest.fn() } },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/authz', () => ({ __esModule: true, isAdmin: jest.fn() }));

import { GET } from '@/app/api/admin/cleanup-sessions/route';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { isAdmin } from '@/app/lib/authz';

const call = () => GET(new NextRequest('http://localhost:3000/api/admin/cleanup-sessions'));

describe('SEC-15: cleanup-sessions is admin-only', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: 'u1' } });
    isAdmin.mockResolvedValue(false);
    prisma.searchSession.updateMany.mockResolvedValue({ count: 0 });
  });

  test('no session => 401, no sessions touched', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(401);
    expect(prisma.searchSession.updateMany).not.toHaveBeenCalled();
  });

  test('KEYSTONE: a non-admin is 403 AND cannot kill active searches', async () => {
    const res = await call();
    expect(res.status).toBe(403);
    expect(prisma.searchSession.updateMany).not.toHaveBeenCalled();
  });

  test('an admin may run the cleanup', async () => {
    isAdmin.mockResolvedValue(true);
    const res = await call();
    expect(res.status).toBeLessThan(400);
    expect(prisma.searchSession.updateMany).toHaveBeenCalled();
  });
});
