/**
 * Regression: GET /api/missions/[missionId] must not leak owner contact PII to
 * non-owner viewers.
 *
 * The endpoint returns the full Case row (incl. ownerPhone/ownerEmail) plus
 * reporter.email, gated ONLY by "authenticated + waiver-accepted". That handed
 * every waiver-accepting volunteer the owner's phone/email + the reporter's
 * email for any case they could name — directly contradicting the brokered
 * relay model (lib/relay.js) that hides raw contact until mutual opt-in.
 *
 * Fix: only the case owner (reporter) and admins see contact info; everyone else
 * gets the operational case (pet, location, sightings) with contact PII stripped.
 *
 * Golden rule: assert on the raw API payload, not the rendered UI — the cruelest
 * leaks are fields the screen hides but the JSON still ships.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    case: { findFirst: jest.fn() },
    user: { findUnique: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn() }));
jest.mock('@/app/lib/utils', () => ({ __esModule: true, normalizePhotoUrl: (u) => u }));

import { GET } from '@/app/api/missions/[missionId]/route';
import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';

const OWNER_ID = 'owner-user-1';

const CASE_WITH_PII = {
  id: 'case-1',
  caseNumber: 'CASE-2026-000123',
  reportType: 'LOST',
  status: 'ACTIVE',
  petName: 'Buddy',
  petSpecies: 'DOG',
  petBreed: 'Labrador',
  petColor: 'black',
  petPhotoUrl: 'https://cdn.example.com/buddy.jpg',
  lastSeenAddress: '123 Private Home St, Springfield, IL',
  lastSeenLatitude: 40.01,
  lastSeenLongitude: -75.01,
  reporterId: OWNER_ID,
  ownerName: 'Distressed Owner',
  ownerPhone: '555-1234',
  ownerEmail: 'owner@example.com',
  reporter: { id: OWNER_ID, firstName: 'Distressed', lastName: 'Owner', email: 'owner@example.com' },
  assignments: [],
  updates: [],
  sightings: [],
  _count: { updates: 0, sightings: 0 },
};

function call() {
  return GET(new NextRequest('http://localhost:3000/api/missions/case-1'), {
    params: { missionId: 'case-1' },
  });
}

describe('GET /api/missions/[missionId] owner-contact PII gating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.case.findFirst.mockResolvedValue(CASE_WITH_PII);
  });

  test('a waiver-accepted NON-owner gets the case but NO owner/reporter contact', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'some-volunteer', role: 'USER' } });
    prisma.user.findUnique.mockResolvedValue({ waiverAcceptedAt: new Date() });

    const res = await call();
    const body = await res.json();

    expect(res.status).toBe(200);
    // Operational fields a searcher legitimately needs stay present:
    expect(body.petName).toBe('Buddy');
    expect(body.lastSeenLatitude).toBe(40.01);

    // Contact PII is stripped:
    expect(body.ownerPhone).toBeNull();
    expect(body.ownerEmail).toBeNull();
    expect(body.reporter.email).toBeUndefined();
    expect(body.reporter.lastName).toBeUndefined();

    // And no contact string leaks anywhere in the serialized payload:
    const blob = JSON.stringify(body);
    expect(blob).not.toContain('owner@example.com');
    expect(blob).not.toContain('555-1234');
  });

  test('the case OWNER sees their own contact info', async () => {
    getServerSession.mockResolvedValue({ user: { id: OWNER_ID, role: 'USER' } });
    // Owner bypasses the waiver gate even when not accepted:
    prisma.user.findUnique.mockResolvedValue({ waiverAcceptedAt: null });

    const res = await call();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ownerEmail).toBe('owner@example.com');
    expect(body.ownerPhone).toBe('555-1234');
    expect(body.reporter.email).toBe('owner@example.com');
  });

  test('an ADMIN (non-owner) sees contact info for support/moderation', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    prisma.user.findUnique.mockResolvedValue({ waiverAcceptedAt: new Date() });

    const res = await call();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ownerEmail).toBe('owner@example.com');
    expect(body.ownerPhone).toBe('555-1234');
  });
});
