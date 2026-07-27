/**
 * Regression tests for GET /api/admin/report-log.
 *
 * Locks the fixes the team landed (architect msg 328):
 *  - admin-only authz, re-checked against the DB (not the session claim)
 *  - falsy-zero coordinate fix: a reporter at lat/lng exactly 0 must still get a
 *    computed distance, not be dropped (same bug class as reports/create CORR-2)
 *  - NaN/negative query-param guard: ?offset=abc must not reach Prisma as skip:NaN
 *
 * Mock note: we mock '@/app/lib/auth' directly so auth.js never module-loads
 * (and never touches prisma during import) - that both keeps the test hermetic
 * and avoids the "mockPrisma before initialization" TDZ that the legacy suites
 * trip on. The prisma mock is defined INSIDE the factory and read back via import.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findMany: jest.fn(), count: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));

import { GET } from '@/app/api/admin/report-log/route';
import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';

function req(query = '') {
  return new NextRequest(`http://localhost:3000/api/admin/report-log${query}`);
}

const adminSession = { user: { id: 'admin-1' } };

function caseRow(overrides = {}) {
  return {
    id: 'c1',
    caseNumber: 'CASE-2026-000001',
    petName: 'Rex',
    petSpecies: 'DOG',
    petColor: 'black',
    ownerName: 'Jane Doe',
    ownerEmail: 'jane@example.com',
    status: 'ACTIVE',
    priority: 'NORMAL',
    lastSeenLatitude: 0.1,
    lastSeenLongitude: 0.1,
    lastSeenAddress: '1 Equator Rd',
    reporterLatitude: 0,
    reporterLongitude: 0,
    createdAt: new Date('2026-05-01T00:00:00Z'),
    ...overrides,
  };
}

describe('GET /api/admin/report-log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue(adminSession);
    prisma.user.findUnique.mockResolvedValue({ role: 'ADMIN' });
    prisma.case.findMany.mockResolvedValue([caseRow()]);
    prisma.case.count.mockResolvedValue(1);
  });

  describe('authorization (re-checked against the DB)', () => {
    test('no session => 401', async () => {
      getServerSession.mockResolvedValue(null);
      const res = await GET(req());
      expect(res.status).toBe(401);
    });

    test('authenticated but non-admin => 403', async () => {
      prisma.user.findUnique.mockResolvedValue({ role: 'USER' });
      const res = await GET(req());
      expect(res.status).toBe(403);
    });

    test('admin => 200', async () => {
      const res = await GET(req());
      expect(res.status).toBe(200);
    });
  });

  describe('falsy-zero coordinate fix', () => {
    test('a reporter at exactly (0,0) still gets a computed distance and reporter block (not dropped)', async () => {
      const res = await GET(req());
      const body = await res.json();
      const entry = body.entries[0];
      // Under the old truthiness guard, reporterLatitude:0 => treated as missing.
      expect(entry.reporter).toEqual({ lat: 0, lng: 0 });
      expect(typeof entry.distanceMiles).toBe('number');
      expect(entry.distanceMiles).toBeGreaterThan(0);
    });

    test('genuinely missing reporter coords => reporter null, distance null (not a crash)', async () => {
      prisma.case.findMany.mockResolvedValue([caseRow({ reporterLatitude: null, reporterLongitude: null })]);
      const res = await GET(req());
      const body = await res.json();
      expect(body.entries[0].reporter).toBeNull();
      expect(body.entries[0].distanceMiles).toBeNull();
    });
  });

  describe('query-param guards', () => {
    test('?offset=abc does not reach Prisma as skip:NaN (clamped to 0)', async () => {
      const res = await GET(req('?offset=abc'));
      expect(res.status).toBe(200);
      const skipArg = prisma.case.findMany.mock.calls[0][0].skip;
      expect(Number.isNaN(skipArg)).toBe(false);
      expect(skipArg).toBe(0);
    });

    test('oversize ?limit is capped (take never exceeds 500)', async () => {
      await GET(req('?limit=99999'));
      const takeArg = prisma.case.findMany.mock.calls[0][0].take;
      expect(takeArg).toBeLessThanOrEqual(500);
    });

    test('negative ?offset is clamped to 0', async () => {
      await GET(req('?offset=-50'));
      const skipArg = prisma.case.findMany.mock.calls[0][0].skip;
      expect(skipArg).toBe(0);
    });
  });
});
