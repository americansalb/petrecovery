/**
 * Sightings API Tests
 * Tests for POST /api/sightings (the older route)
 *
 * This file used to test what the route did with a stand-in for the
 * database that accepts any field: who could send, what was required, what
 * was written. On the real database none of it happened. The route's first
 * write named a field the Sighting table does not have, so every report
 * failed, the person was told so, and the owner heard nothing.
 *
 * The route is switched off. A sighting is sent from the pet's own page or
 * the search screen (/api/public/missions/[caseNumber]/sighting; its tests
 * are __tests__/api/witness-sighting.test.js), and /sightings/report opens
 * that form. What is tested here is that the older route does nothing at
 * all, whatever it is sent and whoever sends it.
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
jest.mock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue(null) }));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('@/app/lib/rateLimit', () => ({
  withRateLimit: jest.fn().mockReturnValue({ success: true }),
  RateLimitPresets: { PUBLIC_WRITE: {} },
  rateLimitResponse: jest.fn(),
}));
jest.mock('@/lib/logging', () => ({ logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/notifications-inapp', () => ({ __esModule: true, createInAppNotification: jest.fn() }));
jest.mock('@/app/lib/email', () => ({ __esModule: true, sendEmail: jest.fn() }));

import { POST } from '@/app/api/sightings/route';
import * as route from '@/app/api/sightings/route';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { logEvent } from '@/lib/logging';
import { withRateLimit } from '@/app/lib/rateLimit';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { sendEmail } from '@/app/lib/email';

const SESSION = { user: { id: 'user-123', email: 'test@example.com', name: 'Test User' } };
const VALID = { alertId: 'case-1', location: 'Central Park', details: 'Saw a golden retriever', timeOfSighting: 'just_now', behavior: 'running', direction: 'north', latitude: 40.78, longitude: -73.96 };

function createRequest(body) {
  return new NextRequest('http://localhost:3000/api/sightings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/sightings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue(SESSION);
    prisma.sighting.create.mockResolvedValue({ id: 'sighting-1' });
    prisma.case.findUnique.mockResolvedValue({ id: 'case-1', caseNumber: 'CASE-1', petName: 'Rex', reporterId: 'owner-1', reporter: { email: 'owner@example.com' } });
  });

  const nothingHappened = () => {
    expect(prisma.sighting.create).not.toHaveBeenCalled();
    expect(prisma.caseSighting.create).not.toHaveBeenCalled();
    expect(prisma.case.findUnique).not.toHaveBeenCalled();
    expect(createInAppNotification).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(logEvent).not.toHaveBeenCalled();
  };

  test('a complete report from someone signed in: 410, with where a sighting is sent from', async () => {
    const res = await POST(createRequest(VALID));
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({ error: "Send a sighting from the pet's own page.", code: 'NOT_AVAILABLE' });
    nothingHappened();
  });

  test('nobody signed in: the same answer, and the session is not even read', async () => {
    getServerSession.mockResolvedValue(null);
    expect((await POST(createRequest(VALID))).status).toBe(410);
    expect(getServerSession).not.toHaveBeenCalled();
    nothingHappened();
  });

  test.each([
    ['no location', { ...VALID, location: undefined }],
    ['no details', { ...VALID, details: undefined }],
    ['no time', { ...VALID, timeOfSighting: undefined }],
    ['no pet named', { ...VALID, alertId: undefined }],
    ['a pet named by missionId', { ...VALID, alertId: undefined, missionId: 'case-2' }],
    ['no coordinates', { ...VALID, latitude: undefined, longitude: undefined }],
    ['an empty body', {}],
    ['a body that is not an object', 'junk'],
  ])('%s: the same answer, and nothing is written', async (_what, body) => {
    expect((await POST(createRequest(body))).status).toBe(410);
    nothingHappened();
  });

  test('it never says the owner was told', async () => {
    const body = JSON.stringify(await (await POST(createRequest(VALID))).json());
    expect(body).not.toMatch(/notified|success/i);
  });

  test('it does not count against anyone\'s limit: there is nothing to limit', async () => {
    await POST(createRequest(VALID));
    expect(withRateLimit).not.toHaveBeenCalled();
  });

  test('the route still has one way in, and it is this one', () => {
    expect(Object.keys(route).filter((name) => /^(GET|POST|PUT|PATCH|DELETE)$/.test(name))).toEqual(['POST']);
  });
});
