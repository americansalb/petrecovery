/**
 * THE keystone functional test (architect msg 515 / EA msg 513-516):
 * a FOUND report with an ACTIONABLE match must (a) save (not 500) AND (b)
 * actually notify the owner — and a non-actionable match must NOT notify
 * (cruelty gate, CORR-3). If this is red, the product doesn't do its one job.
 *
 * Covers the fixes:
 *  - CRIT-B: alert.create uses caseId (the old `missionId` field doesn't exist
 *    and 500'd the whole report on the exact high-confidence match).
 *  - CRIT-A: owner gets a real in-app Notification + email (not a dead Alert row).
 *  - CORR-3: only band==='actionable' owners are notified; honest notifiedCount.
 *
 * Uses the REAL matching engine (pure) so bands are genuine. Logged-in finder
 * path keeps the mock tractable (no guest-account branch). NOTE: mocked prisma
 * can't catch the caseId-vs-missionId DRIFT itself (that needs the ephemeral-DB
 * smoke test) — here we assert the contract (alert data carries caseId).
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    patrolProfile: { findUnique: jest.fn(), create: jest.fn() },
    userProfile: { findUnique: jest.fn(), create: jest.fn() },
    pet: { create: jest.fn() },
    case: { create: jest.fn(), findMany: jest.fn() },
    alert: { create: jest.fn() },
  },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn() }));
jest.mock('@/app/lib/email', () => ({ __esModule: true, sendEmail: jest.fn() }));
jest.mock('@/app/lib/config', () => ({ __esModule: true, getEmailBaseUrl: () => 'http://localhost:5757' }));
jest.mock('@/app/lib/notifications-inapp', () => ({ __esModule: true, createInAppNotification: jest.fn() }));
jest.mock('bcryptjs', () => ({ __esModule: true, default: { hash: jest.fn().mockResolvedValue('hash') } }));

import { POST } from '@/app/api/reports/found-pet/route';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { sendEmail } from '@/app/lib/email';
import { createInAppNotification } from '@/app/lib/notifications-inapp';

const OWNER_ID = 'lost-owner-1';
const OWNER_EMAIL = 'owner@example.com';

// A LOST case (candidate) carrying the owner's id/email, as found-pet's
// case.findMany returns (include: pet, reporter).
function lostCandidate({ breed, color, lat, lng }) {
  return {
    id: 'lost-case-1',
    caseNumber: 'CASE-2026-000123',
    petSpecies: 'DOG',
    petBreed: breed,
    petColor: color,
    lastSeenAddress: '123 Owner Home St, Springfield, IL',
    lastSeenLatitude: lat,
    lastSeenLongitude: lng,
    lastSeenAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    pet: { name: 'Buddy', primaryPhotoUrl: 'https://cdn.example.com/buddy.jpg' },
    reporter: { id: OWNER_ID, email: OWNER_EMAIL },
    reporterId: OWNER_ID,
  };
}

function foundBody() {
  return {
    color: 'black',
    breed: 'Labrador',
    size: 'LARGE',
    petType: 'dog',
    foundAddress: '5 Found Ave, Springfield, IL',
    center: [40.0, -75.0],
    timeElapsed: 'less_than_hour',
    photos: [],
    firstName: 'Finder',
    email: 'finder@example.com',
  };
}

function post() {
  return POST(
    new NextRequest('http://localhost:5757/api/reports/found-pet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(foundBody()),
    })
  );
}

describe('Reunion loop: FOUND report -> owner notification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Logged-in finder (skips guest-account creation).
    getServerSession.mockResolvedValue({ user: { email: 'finder@example.com', name: 'Finder' } });
    prisma.user.findUnique.mockResolvedValue({ id: 'finder-1', email: 'finder@example.com', phone: '555' });
    prisma.patrolProfile.findUnique.mockResolvedValue({ id: 'pp-1' }); // exists -> skip profile setup
    prisma.pet.create.mockResolvedValue({ id: 'pet-1' });
    prisma.case.create.mockResolvedValue({ id: 'found-case-1', caseNumber: 'FOUND-2026-000001' });
    prisma.alert.create.mockResolvedValue({});
    sendEmail.mockResolvedValue(undefined);
    createInAppNotification.mockResolvedValue(undefined);
  });

  test('KEYSTONE: an ACTIONABLE match saves the report (no 500) AND notifies the owner', async () => {
    // near + same breed/color + recent => high score => actionable band
    prisma.case.findMany.mockResolvedValue([
      lostCandidate({ breed: 'Labrador', color: 'black', lat: 40.0, lng: -75.0 }),
    ]);

    const res = await post();
    expect(res.status).toBeLessThan(300); // saved, did NOT 500
    expect(res.status).not.toBe(500);

    // Owner actually notified, in-app + email (CRIT-A):
    expect(createInAppNotification).toHaveBeenCalledTimes(1);
    expect(createInAppNotification.mock.calls[0][0].userId).toBe(OWNER_ID);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe(OWNER_EMAIL);

    // The "last inch": the notification must be CLICKABLE to the match — the
    // actionUrl resolves to the case by caseNumber (the missionNumber alias bug
    // would have made this null/undefined / a broken link).
    expect(createInAppNotification.mock.calls[0][0].actionUrl).toBe('/cases/CASE-2026-000123');

    // Alert persisted with caseId, NOT the non-existent missionId (CRIT-B contract):
    expect(prisma.alert.create).toHaveBeenCalledTimes(1);
    const alertData = prisma.alert.create.mock.calls[0][0].data;
    expect(alertData.caseId).toBe('lost-case-1');
    expect(alertData).not.toHaveProperty('missionId');
    expect(alertData.deliveredAt).toBeInstanceOf(Date);
  });

  test('CORR-3 cruelty gate: a NON-actionable (feed-band) match does NOT notify the owner', async () => {
    // same species + same area (location pts) but different breed/color => mid
    // score => feed band (shown, but below the PUSH floor) => must NOT notify.
    prisma.case.findMany.mockResolvedValue([
      lostCandidate({ breed: 'Poodle', color: 'white', lat: 40.0, lng: -75.0 }),
    ]);

    const res = await post();
    expect(res.status).toBeLessThan(300);
    expect(createInAppNotification).not.toHaveBeenCalled();
    // no owner email (finder is logged in, so no welcome email either)
    const ownerEmails = sendEmail.mock.calls.filter(c => c[0]?.to === OWNER_EMAIL);
    expect(ownerEmails).toHaveLength(0);
  });

  test('a recipient-notify failure is isolated and does NOT fail the report save (BR-1)', async () => {
    prisma.case.findMany.mockResolvedValue([
      lostCandidate({ breed: 'Labrador', color: 'black', lat: 40.0, lng: -75.0 }),
    ]);
    createInAppNotification.mockRejectedValue(new Error('notify backend down'));

    const res = await post();
    // The report must still save despite the notify failure.
    expect(res.status).toBeLessThan(300);
    expect(res.status).not.toBe(500);
  });
});
