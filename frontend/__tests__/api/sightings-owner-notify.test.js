/**
 * CRIT-C regression: a sighting must only claim "the owner has been notified"
 * when it actually delivered (no false hope), and must actually deliver when the
 * case has an owner. EA found /api/sightings returned "the owner has been
 * notified" while the send was a TODO (a false confirmation on a sighting of a
 * missing pet — the worst cruelty-class failure). Fixed: real in-app + email
 * delivery, honest copy gated on ownerNotified.
 *
 * Completes the cruelty-gate family lock: found-match (CRIT-A), sightings
 * (CRIT-C). Asserts behavior, not just status.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    sighting: { create: jest.fn() },
    caseSighting: { create: jest.fn() },
    case: { findUnique: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/rateLimit', () => ({
  __esModule: true,
  withRateLimit: jest.fn().mockReturnValue({ success: true }),
  RateLimitPresets: { PUBLIC_WRITE: {} },
  rateLimitResponse: jest.fn(),
}));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/notifications-inapp', () => ({ __esModule: true, createInAppNotification: jest.fn() }));
jest.mock('@/app/lib/email', () => ({ __esModule: true, sendEmail: jest.fn() }));
jest.mock('@/app/lib/config', () => ({ __esModule: true, getEmailBaseUrl: () => 'http://localhost:5757' }));

import { POST } from '@/app/api/sightings/route';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { sendEmail } from '@/app/lib/email';

function report() {
  return POST(new NextRequest('http://localhost:5757/api/sightings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alertId: 'case-1', location: '123 Main St', details: 'Saw the dog', timeOfSighting: 'just_now' }),
  }));
}

describe('CRIT-C: sighting owner-notify is honest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: 'reporter-u', email: 'r@x.com', name: 'R' } });
    prisma.sighting.create.mockResolvedValue({ id: 'sight-1' });
    prisma.caseSighting.create.mockResolvedValue({});
    createInAppNotification.mockResolvedValue(undefined);
    sendEmail.mockResolvedValue(undefined);
  });

  test('case WITH an owner: actually notifies + copy says "owner has been notified"', async () => {
    prisma.case.findUnique.mockResolvedValue({
      caseNumber: 'CASE-2026-000001', petName: 'Rex', reporterId: 'owner-1', reporter: { email: 'owner@example.com' },
    });
    const res = await report();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain('owner has been notified');
    expect(createInAppNotification).toHaveBeenCalledTimes(1);
    expect(createInAppNotification.mock.calls[0][0].userId).toBe('owner-1');
    expect(sendEmail.mock.calls[0][0].to).toBe('owner@example.com');
  });

  test('case with NO owner: does NOT claim notified (honest copy), no notify sent', async () => {
    prisma.case.findUnique.mockResolvedValue({ caseNumber: 'CASE-2', petName: 'Rex', reporterId: null, reporter: null });
    const res = await report();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).not.toContain('owner has been notified');
    expect(createInAppNotification).not.toHaveBeenCalled();
  });

  test('owner-notify failure is isolated: sighting still succeeds, copy stays honest', async () => {
    prisma.case.findUnique.mockResolvedValue({
      caseNumber: 'CASE-3', petName: 'Rex', reporterId: 'owner-2', reporter: { email: 'o2@example.com' },
    });
    createInAppNotification.mockRejectedValue(new Error('notify down'));
    const res = await report();
    expect(res.status).toBe(200); // sighting not failed by the notify error
    const body = await res.json();
    expect(body.message).not.toContain('owner has been notified'); // didn't deliver -> don't claim it
  });
});
