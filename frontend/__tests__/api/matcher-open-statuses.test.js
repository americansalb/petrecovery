/**
 * REGRESSION LOCK: the matchers must consider every OPEN case, not just ACTIVE.
 *
 * The bug this pins: all three matchers filtered candidates on
 * `status: 'ACTIVE'`. But CaseStatus has THREE open states - a case flips to
 * IN_PROGRESS the moment a rescue force accepts it, and to SIGHTING_REPORTED on
 * the first sighting. So the instant a case got attention, it silently stopped
 * being matched: the cases closest to a reunion were exactly the ones dropped.
 *
 * Measured against a live seeded DB before the fix - one identical found-pet
 * report, one seeded lost case, only the status changed:
 *     status IN_PROGRESS -> matchesNotified: 0, potentialMatches: []
 *     status ACTIVE      -> pTrueMatch 0.95, band 'actionable', owner notified
 *
 * A 0.95 match on a dog found 100m from where it went missing, discarded
 * because someone had started looking for it.
 *
 * These tests assert the WHERE CLAUSE, which is where the defect lived. A
 * mocked Prisma returns whatever the test says, so it cannot prove the query is
 * valid against the schema - that needs the ephemeral-DB suite. It CAN prove we
 * never narrow the candidate set back to a single status, which is the whole
 * regression.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    patrolProfile: { findUnique: jest.fn(), create: jest.fn() },
    userProfile: { findUnique: jest.fn(), create: jest.fn() },
    pet: { create: jest.fn() },
    case: { create: jest.fn(), findMany: jest.fn() },
    alert: { create: jest.fn() },
    emailPreference: { findMany: jest.fn().mockResolvedValue([]) },
    emailLog: { create: jest.fn().mockResolvedValue({}) },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimitAsync: jest.fn().mockResolvedValue({ success: true }),
  RateLimitPresets: { PUBLIC_WRITE: {} },
  rateLimitResponse: jest.fn(),
}));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/email', () => ({ __esModule: true, sendEmail: jest.fn() }));
jest.mock('@/app/lib/config', () => ({ __esModule: true, getEmailBaseUrl: () => 'http://localhost:5757' }));
jest.mock('@/app/lib/notifications-inapp', () => ({ __esModule: true, createInAppNotification: jest.fn() }));
jest.mock('bcryptjs', () => ({ __esModule: true, default: { hash: jest.fn().mockResolvedValue('hash') } }));

import { NextRequest } from 'next/server';
import { POST as foundPetPOST } from '@/app/api/reports/found-pet/route';
import { OPEN_CASE_STATUS } from '@/app/lib/matching';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';

const OPEN = ['ACTIVE', 'IN_PROGRESS', 'SIGHTING_REPORTED'];
const CLOSED = ['REUNITED', 'CLOSED_OTHER'];

/** Does this Prisma status filter admit `status`? */
function admits(filter, status) {
  if (typeof filter === 'string') return filter === status;
  if (filter && Array.isArray(filter.notIn)) return !filter.notIn.includes(status);
  if (filter && Array.isArray(filter.in)) return filter.in.includes(status);
  throw new Error(`unrecognised status filter: ${JSON.stringify(filter)}`);
}

describe('OPEN_CASE_STATUS admits every open case and no closed one', () => {
  test.each(OPEN)('keeps matching a %s case', (status) => {
    expect(admits(OPEN_CASE_STATUS, status)).toBe(true);
  });

  test.each(CLOSED)('stops matching a %s case', (status) => {
    expect(admits(OPEN_CASE_STATUS, status)).toBe(false);
  });
});

describe('found-pet matcher queries every open LOST case', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { email: 'finder@example.com', name: 'Finder' } });
    prisma.user.findUnique.mockResolvedValue({ id: 'finder-1', email: 'finder@example.com', phone: '555' });
    prisma.patrolProfile.findUnique.mockResolvedValue({ id: 'pp-1' });
    prisma.pet.create.mockResolvedValue({ id: 'pet-1' });
    prisma.case.create.mockResolvedValue({ id: 'found-1', caseNumber: 'FOUND-2026-000001' });
    prisma.case.findMany.mockResolvedValue([]);
  });

  async function post() {
    return foundPetPOST(
      new NextRequest('http://localhost:5757/api/reports/found-pet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          color: 'black', breed: 'Labrador', size: 'LARGE', petType: 'dog',
          foundAddress: '5 Found Ave, Springfield, IL', center: [40.0, -75.0],
          timeElapsed: 'less_than_hour', photos: [],
          firstName: 'Finder', email: 'finder@example.com',
        }),
      })
    );
  }

  test('the candidate query is not narrowed to a single status', async () => {
    await post();
    const where = prisma.case.findMany.mock.calls[0][0].where;
    // The original bug, stated exactly: `status: 'ACTIVE'`.
    expect(where.status).not.toBe('ACTIVE');
  });

  test.each(OPEN)('a %s lost case is still a match candidate', async (status) => {
    await post();
    const where = prisma.case.findMany.mock.calls[0][0].where;
    expect(admits(where.status, status)).toBe(true);
  });

  test.each(CLOSED)('a %s lost case is excluded', async (status) => {
    await post();
    const where = prisma.case.findMany.mock.calls[0][0].where;
    expect(admits(where.status, status)).toBe(false);
  });

  test('still scoped to LOST reports of the same species', async () => {
    await post();
    const where = prisma.case.findMany.mock.calls[0][0].where;
    expect(where.reportType).toBe('LOST');
    expect(where.petSpecies).toBe('DOG');
  });
});
