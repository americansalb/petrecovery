/**
 * SEC-20 regression: GET /api/reports/dashboard must be ADMIN-only.
 *
 * Found via the functional sweep: a non-admin (tester@test.com, role USER) got
 * 200 + platform business-intelligence. The report-create flow auto-creates a
 * User for any guest reporter, so "any authenticated user" ≈ anyone who ever
 * filed a report → wide-open BI. Fixed with a session check + a fresh-DB role
 * check (user.role !== 'ADMIN' => 403). This locks it.
 *
 * Assertions focus on the AUTHZ GATE (the SEC-20 fix) and avoid depending on the
 * BI lib internals: non-admin => 403, no-session => 401, admin is NOT 403'd.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { user: { findUnique: jest.fn() } },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
// authz helper may or may not be used by the route; harmless to provide.
jest.mock('@/app/lib/authz', () => ({ __esModule: true, isAdmin: jest.fn() }));

import { GET } from '@/app/api/reports/dashboard/route';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { isAdmin } from '@/app/lib/authz';

const call = () => GET(new NextRequest('http://localhost:3000/api/reports/dashboard'));

describe('SEC-20: GET /api/reports/dashboard is admin-only', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: 'u1', email: 'u@x.com' } });
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
    // The route gates on isAdmin() (fresh-DB role lookup, lives in authz.js).
    // Mock it to honor the per-test role so the prisma role mock above still
    // drives the gate - otherwise a bare jest.fn() returns undefined (falsy)
    // and EVERY case 403s, including the admin one (false green/red).
    isAdmin.mockImplementation(async () => {
      const u = await prisma.user.findUnique();
      return u?.role === 'ADMIN';
    });
  });

  test('no session => 401', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(401);
  });

  test('KEYSTONE: a non-admin (role USER) is 403 - no BI leak', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
    const res = await call();
    expect(res.status).toBe(403);
  });

  test('a non-admin PATROL/MODERATOR-but-not-ADMIN is also 403', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'PATROL' });
    const res = await call();
    expect(res.status).toBe(403);
  });

  test('an admin is NOT 403/401 (gate lets admins through, not over-locked)', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    const res = await call();
    // May be 200 (BI runs) or 500 (BI internals unmocked) - the point is the
    // authz gate does NOT block an admin.
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });
});
