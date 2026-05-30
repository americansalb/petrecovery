/**
 * CRIT-E regression: a CONFIDENT (level >= 7) assignment sighting of a missing
 * pet must reach the owner (in-app + email); a low-confidence sighting must not.
 * EA found the high-confidence path only posted to squad chat (owner heard
 * nothing). Fixed. Completes the owner/searcher notification family (A/C/D/E).
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    caseParticipant: { findUnique: jest.fn(), update: jest.fn() },
    petSpotting: { create: jest.fn() },
    caseAssignment: { findUnique: jest.fn() },
    case: { update: jest.fn() },
    squadMessage: { create: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/notifications-inapp', () => ({ __esModule: true, createInAppNotification: jest.fn() }));
jest.mock('@/app/lib/email', () => ({ __esModule: true, sendEmail: jest.fn() }));
jest.mock('@/app/lib/config', () => ({ __esModule: true, getEmailBaseUrl: () => 'http://localhost:5757' }));

import { POST } from '@/app/api/assignments/[id]/sightings/route';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { sendEmail } from '@/app/lib/email';

const PARAMS = { params: { id: 'assignment-1' } };

function report(confidenceLevel) {
  return POST(new NextRequest('http://localhost:5757/api/assignments/assignment-1/sightings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: 40.0, longitude: -75.0, spottedAt: '2026-05-20T00:00:00Z', confidenceLevel, address: '5 Main St' }),
  }), PARAMS);
}

describe('CRIT-E: confident assignment sighting notifies the owner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: 'searcher-1' } });
    prisma.caseParticipant.findUnique.mockResolvedValue({ id: 'p1', isActive: true });
    prisma.petSpotting.create.mockResolvedValue({ id: 'spot-1', reportedBy: { id: 'searcher-1', firstName: 'S', lastName: 'R' } });
    prisma.caseParticipant.update.mockResolvedValue({});
    prisma.caseAssignment.findUnique.mockResolvedValue({ missionId: 'case-1' });
    prisma.case.update.mockResolvedValue({ caseNumber: 'CASE-1', petName: 'Rex', reporterId: 'owner-1', reporter: { email: 'owner@example.com' } });
    prisma.squadMessage.create.mockResolvedValue({});
    createInAppNotification.mockResolvedValue(undefined);
    sendEmail.mockResolvedValue(undefined);
  });

  test('KEYSTONE: confidence 8 notifies the owner in-app + email', async () => {
    const res = await report(8);
    expect(res.status).toBeLessThan(300);
    expect(createInAppNotification).toHaveBeenCalledTimes(1);
    expect(createInAppNotification.mock.calls[0][0].userId).toBe('owner-1');
    expect(sendEmail.mock.calls[0][0].to).toBe('owner@example.com');
  });

  test('confidence 5 (below threshold) does NOT notify the owner', async () => {
    const res = await report(5);
    expect(res.status).toBeLessThan(300);
    expect(createInAppNotification).not.toHaveBeenCalled();
    expect(prisma.case.update).not.toHaveBeenCalled(); // no high-confidence path
  });

  test('a non-participant cannot report (403, no notify)', async () => {
    prisma.caseParticipant.findUnique.mockResolvedValue(null);
    const res = await report(9);
    expect(res.status).toBe(403);
    expect(createInAppNotification).not.toHaveBeenCalled();
  });
});
