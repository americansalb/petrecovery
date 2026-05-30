/**
 * CRIT-D regression: on a TERMINAL status change (REUNITED / CLOSED_OTHER), the
 * active searchers must be told so they can stand down; on a non-terminal change,
 * nobody is spuriously notified. EA found no notify happened at all on resolution
 * (volunteers kept searching a found pet). Fixed. Completes the owner/searcher
 * notification family in the hard gate alongside CRIT-A/CRIT-C.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findUnique: jest.fn() },
    missionControl: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/notifications-inapp', () => ({ __esModule: true, createInAppNotification: jest.fn() }));

import { POST } from '@/app/api/missions/[missionId]/status/route';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { createInAppNotification } from '@/app/lib/notifications-inapp';

const PARAMS = { params: { missionId: 'case-1' } };

function post(body) {
  return POST(new NextRequest('http://localhost:5757/api/missions/case-1/status', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), PARAMS);
}

describe('CRIT-D: terminal status change notifies active searchers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: 'owner-1' } }); // owner
    prisma.case.findUnique.mockResolvedValue({
      id: 'case-1', caseNumber: 'CASE-1', status: 'ACTIVE', reporterId: 'owner-1',
      petName: 'Rex', ownerName: 'O', ownerEmail: 'o@x.com',
    });
    prisma.$transaction.mockImplementation(async (cb) => cb({
      case: { update: jest.fn().mockResolvedValue({ id: 'case-1', caseNumber: 'CASE-1', petName: 'Rex', status: 'REUNITED' }) },
      caseUpdate: { create: jest.fn().mockResolvedValue({}) },
    }));
    prisma.missionControl.findUnique.mockResolvedValue({
      activeVolunteers: [{ userId: 'v1' }, { userId: 'v2' }],
    });
    createInAppNotification.mockResolvedValue(undefined);
  });

  test('KEYSTONE: REUNITED notifies every active volunteer to stand down', async () => {
    const res = await post({ status: 'REUNITED', resolution: 'REUNITED' });
    expect(res.status).toBeLessThan(300);
    expect(createInAppNotification).toHaveBeenCalledTimes(2);
    const notifiedIds = createInAppNotification.mock.calls.map(c => c[0].userId).sort();
    expect(notifiedIds).toEqual(['v1', 'v2']);
  });

  test('a NON-terminal status change does NOT notify volunteers', async () => {
    const res = await post({ status: 'SIGHTING_REPORTED' });
    expect(res.status).toBeLessThan(300);
    expect(createInAppNotification).not.toHaveBeenCalled();
  });

  test('a non-owner / non-admin cannot change status (403)', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'stranger' } });
    const res = await post({ status: 'REUNITED' });
    expect(res.status).toBe(403);
    expect(createInAppNotification).not.toHaveBeenCalled();
  });
});
