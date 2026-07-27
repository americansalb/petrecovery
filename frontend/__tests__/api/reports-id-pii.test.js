/**
 * SEC-3 regression: GET /api/reports/[id] must not leak owner PII to an
 * unauthenticated viewer via potentialMatches.
 *
 * EA's audit found this live: a FOUND report's potentialMatches surfaced nearby
 * LOST owners' phone/name + exact last-seen location to an unauth GET - a PII
 * harvest of distressed owners. The fix (developer 5f0d09a / §4d) projects only
 * pet fields + a coarse area + the calibrated confidence. This test is the gate
 * that flips SEC-3 to closed (developer msg 472), and locks it against regress.
 *
 * Golden rule (EA): assert on the raw API payload, not the rendered UI - the
 * cruelest leaks are fields the screen hides but the JSON still ships.
 *
 * Uses the REAL matching engine (pure, no DB) so a match actually surfaces.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { case: { findUnique: jest.fn(), findMany: jest.fn() } },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));

import { GET } from '@/app/api/reports/[id]/route';
import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';

const FOUND_REPORT = {
  id: 'found-1',
  caseNumber: 'CASE-2026-000099',
  reportType: 'FOUND',
  status: 'ACTIVE',
  petName: 'Found Dog',
  petSpecies: 'DOG',
  petBreed: 'Labrador',
  petColor: 'black',
  petSize: 'LARGE',
  petDescription: 'friendly',
  petPhotoUrl: null,
  lastSeenAt: new Date('2026-05-10T00:00:00Z'),
  createdAt: new Date('2026-05-10T00:00:00Z'),
  lastSeenAddress: '5 Found Ave, Springfield, IL',
  lastSeenLatitude: 40.0,
  lastSeenLongitude: -75.0,
  searchRadius: 5,
  hasReward: false,
  rewardAmount: null,
  escapeScenario: 'unknown',
  escapeDetails: null,
  ownerName: 'Finder Person',
  ownerEmail: 'finder@example.com',
  ownerPhone: '555-0000',
  pet: null,
  reporter: { id: 'u1', firstName: 'Finder', email: 'finder@example.com', phone: '555-0000' },
  sightings: [],
  missionControl: null,
  assignments: [],
};

// A nearby, same-species LOST case that WILL match - carrying owner PII + exact
// location that must never reach an unauthenticated viewer.
const LOST_WITH_PII = {
  id: 'lost-1',
  reportType: 'LOST',
  status: 'ACTIVE',
  petName: 'Buddy',
  petSpecies: 'DOG',
  petBreed: 'Labrador',
  petColor: 'black',
  petSize: 'LARGE',
  petPhotoUrl: 'https://cdn.example.com/buddy.jpg',
  lastSeenAt: new Date('2026-05-01T00:00:00Z'),
  lastSeenAddress: '123 Private Home St, Springfield, IL',
  lastSeenLatitude: 40.01,
  lastSeenLongitude: -75.01,
  ownerName: 'Distressed Owner',
  ownerEmail: 'owner@example.com',
  ownerPhone: '555-1234',
};

function call(id = 'found-1') {
  return GET(new NextRequest(`http://localhost:3000/api/reports/${id}`), { params: { id } });
}

describe('SEC-3: GET /api/reports/[id] PII brokering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue(null); // unauthenticated viewer
    prisma.case.findUnique.mockResolvedValue(FOUND_REPORT);
    prisma.case.findMany.mockResolvedValue([LOST_WITH_PII]);
  });

  test('a match actually surfaces (otherwise the PII assertions are vacuous)', async () => {
    const res = await call();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.potentialMatches.length).toBeGreaterThan(0);
    expect(body.potentialMatches[0].petName).toBe('Buddy');
  });

  test('potentialMatches entries carry NO owner name/email/phone, exact address, or raw coords', async () => {
    const res = await call();
    const body = await res.json();
    const m = body.potentialMatches[0];

    // Present (safe) fields:
    expect(m).toHaveProperty('pTrueMatch');
    expect(m).toHaveProperty('coarseArea');
    expect(m).toHaveProperty('band');

    // Forbidden PII / precise-location fields:
    for (const forbidden of [
      'ownerName', 'ownerEmail', 'ownerPhone',
      'lastSeenAddress', 'lastSeenLatitude', 'lastSeenLongitude',
      'latitude', 'longitude',
    ]) {
      expect(m).not.toHaveProperty(forbidden);
    }
  });

  test('no owner PII string leaks anywhere in the serialized potentialMatches payload', async () => {
    const res = await call();
    const body = await res.json();
    const blob = JSON.stringify(body.potentialMatches);
    expect(blob).not.toContain('owner@example.com');
    expect(blob).not.toContain('555-1234');
    expect(blob).not.toContain('Distressed Owner');
    // exact street-level address must be coarsened away
    expect(blob).not.toContain('123 Private Home St');
  });

  test('coarseArea drops the street segment (no exact missing-location disclosure)', async () => {
    const res = await call();
    const body = await res.json();
    const area = body.potentialMatches[0].coarseArea || '';
    expect(area).not.toContain('123 Private Home St');
    expect(area).not.toContain('123');
  });

  test('top-level reporter contact is withheld from a non-owner viewer', async () => {
    const res = await call();
    const body = await res.json();
    expect(body.isOwner).toBe(false);
    expect(body.reporter.email).toBeUndefined();
    expect(body.reporter.phone).toBeUndefined();
  });
});

/**
 * SEC-19: a pet's exact last-seen point is usually near the owner's home, so an
 * anonymous viewer of the (public, shareable) case page must get a coarse
 * (~1km / neighborhood) location; authenticated searchers get exact.
 */
describe('SEC-19: primary-case location coarsening', () => {
  const LOST_PRECISE = {
    id: 'lost-precise',
    caseNumber: 'CASE-2026-000777',
    reportType: 'LOST',
    status: 'ACTIVE',
    petName: 'Rex',
    petSpecies: 'DOG',
    petBreed: 'Labrador',
    petColor: 'black',
    petSize: 'LARGE',
    petDescription: 'x',
    petPhotoUrl: null,
    lastSeenAt: new Date('2026-05-20T00:00:00Z'),
    createdAt: new Date('2026-05-20T00:00:00Z'),
    lastSeenAddress: '742 Evergreen Terrace, Springfield, IL',
    lastSeenLatitude: 40.123456,
    lastSeenLongitude: -75.654321,
    searchRadius: 5,
    hasReward: false,
    rewardAmount: null,
    escapeScenario: 'unknown',
    escapeDetails: null,
    ownerName: 'Owner',
    ownerEmail: 'owner@example.com',
    ownerPhone: '555-9999',
    pet: null,
    reporter: { id: 'owner-u', firstName: 'Owner', email: 'owner@example.com', phone: '555-9999' },
    sightings: [],
    missionControl: null,
    assignments: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.case.findUnique.mockResolvedValue(LOST_PRECISE);
    prisma.case.findMany.mockResolvedValue([]); // LOST → no potentialMatches
  });

  test('anonymous viewer gets coarsened coords + street-dropped address + approximate flag', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await GET(new NextRequest('http://localhost:3000/api/reports/lost-precise'), { params: { id: 'lost-precise' } });
    const body = await res.json();
    expect(body.report.locationPrecision).toBe('approximate');
    expect(body.report.lastSeenLatitude).toBe(40.12); // 2-decimal coarsening
    expect(body.report.lastSeenLongitude).toBe(-75.65);
    expect(body.report.lastSeenAddress).not.toContain('742 Evergreen Terrace');
  });

  test('authenticated searcher gets exact location', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'some-searcher', email: 'searcher@example.com' } });
    const res = await GET(new NextRequest('http://localhost:3000/api/reports/lost-precise'), { params: { id: 'lost-precise' } });
    const body = await res.json();
    expect(body.report.locationPrecision).toBe('exact');
    expect(body.report.lastSeenLatitude).toBe(40.123456);
    expect(body.report.lastSeenLongitude).toBe(-75.654321);
    expect(body.report.lastSeenAddress).toBe('742 Evergreen Terrace, Springfield, IL');
  });
});
