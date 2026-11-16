/**
 * THE keystone functional test (architect msg 515 / EA msg 513-516):
 * a FOUND report with an ACTIONABLE match must (a) save (not 500) AND (b)
 * actually notify the owner - and a non-actionable match must NOT notify
 * (cruelty gate, CORR-3). If this is red, the product doesn't do its one job.
 *
 * Covers the fixes:
 *  - CRIT-B: alert.create uses caseId (the old `missionId` field doesn't exist
 *    and 500'd the whole report on the exact high-confidence match).
 *  - CRIT-A: owner gets a real in-app Notification + email (not a dead Alert row).
 *  - CORR-3: only band==='actionable' owners are notified; honest notifiedCount.
 *  - 2026-11-16: an owner counts as told only when the provider took the email
 *    or the text. With email not set up the finder read "We sent the owners of
 *    2 lost cats that look like this one a link" when nothing had gone.
 *
 * Uses the REAL matching engine (pure) so bands are genuine. Logged-in finder
 * path keeps the mock tractable (no guest-account branch). NOTE: mocked prisma
 * can't catch the caseId-vs-missionId DRIFT itself (that needs the ephemeral-DB
 * smoke test) - here we assert the contract (alert data carries caseId).
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
jest.mock('@/app/lib/email', () => ({
  __esModule: true,
  sendEmail: jest.fn(),
  renderBrandedEmail: jest.fn((parts) => `<h1>${parts.heading}</h1>${parts.bodyHtml}<a href="${parts.ctaUrl}">${parts.ctaLabel}</a>`),
  escapeHtml: jest.requireActual('@/app/lib/email').escapeHtml,
}));
jest.mock('@/app/lib/sms', () => ({ __esModule: true, sendSms: jest.fn(async () => ({ success: true })), textCaseOwner: jest.fn(async () => ({ sent: false, reason: 'NOT_ASKED' })) }));
jest.mock('@/app/lib/config', () => ({ __esModule: true, getEmailBaseUrl: () => 'http://localhost:5757' }));
jest.mock('@/app/lib/notifications-inapp', () => ({ __esModule: true, createInAppNotification: jest.fn() }));
jest.mock('bcryptjs', () => ({ __esModule: true, default: { hash: jest.fn().mockResolvedValue('hash') } }));

import { POST } from '@/app/api/reports/found-pet/route';
import { getServerSession } from 'next-auth';
import prisma from '@/app/lib/prisma';
import { sendEmail } from '@/app/lib/email';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { textCaseOwner } from '@/app/lib/sms';
import { foundLines } from '@/app/components/report/successWords';

const screen = (body) => foundLines({ told: body.told, matchesNotified: body.matchesNotified, word: 'dog' }).map((parts) => parts.join(''));

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
    // The provider took the email.
    sendEmail.mockResolvedValue({ success: true, id: 'mail-1' });
    textCaseOwner.mockResolvedValue({ sent: false, reason: 'NOT_ASKED' });
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

    // The "last inch": the notification must be CLICKABLE to the match, and it
    // opens the FOUND pet's page, where its photo and place are. It used to
    // open the owner's own page, which does not mention the found animal.
    expect(createInAppNotification.mock.calls[0][0].actionUrl).toBe('/cases/FOUND-2026-000001');
    // The email's button opens the found pet too, and it links to writing to the finder.
    const mail = sendEmail.mock.calls[0][0].html;
    expect(mail).toContain('http://localhost:5757/cases/FOUND-2026-000001');
    expect(mail).toContain('http://localhost:5757/report/found/message?case=FOUND-2026-000001');
    expect(mail).not.toContain('/cases/CASE-2026-000123');

    // Alert persisted with caseId (CRIT-B). NOTE: this is the ALERT model
    // specifically - its schema field is caseId and it has NO missionId. This is
    // NOT a blanket "missionId is always wrong" rule: @map'd models
    // (CaseAssignment) and MissionControl children DO use missionId. Per-model
    // schema-match, not a sweep (architect msg 587).
    expect(prisma.alert.create).toHaveBeenCalledTimes(1);
    const alertData = prisma.alert.create.mock.calls[0][0].data;
    expect(alertData.caseId).toBe('lost-case-1');
    expect(alertData).not.toHaveProperty('missionId');
    expect(alertData.deliveredAt).toBeInstanceOf(Date);
    expect(alertData.method).toBe('EMAIL');
    const body = await res.json();
    expect(body.matchesNotified).toBe(1);
    expect(body.potentialMatches[0].ownerTold).toBe(true);
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
    sendEmail.mockRejectedValue(new Error('mail backend down'));

    const res = await post();
    // The report must still save despite the notify failure.
    expect(res.status).toBeLessThan(300);
    expect(res.status).not.toBe(500);
    // And the finder's card for that match does not say the owner was told.
    const body = await res.json();
    expect(body.matchesNotified).toBe(0);
    expect(body.potentialMatches[0].ownerTold).toBe(false);
  });

  test('a bell that fails does not stop the email, and the owner the email reached is counted', async () => {
    prisma.case.findMany.mockResolvedValue([
      lostCandidate({ breed: 'Labrador', color: 'black', lat: 40.0, lng: -75.0 }),
    ]);
    createInAppNotification.mockRejectedValue(new Error('notify backend down'));
    const body = await (await post()).json();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(body.matchesNotified).toBe(1);
  });

  test('with email not set up and no text, nobody is counted as told, and the record says nothing went', async () => {
    prisma.case.findMany.mockResolvedValue([
      lostCandidate({ breed: 'Labrador', color: 'black', lat: 40.0, lng: -75.0 }),
    ]);
    // What sendEmail answers with no provider configured (app/lib/email.js).
    sendEmail.mockResolvedValue({ success: false, skipped: true, error: 'EMAIL_NOT_CONFIGURED' });
    textCaseOwner.mockResolvedValue({ sent: false, reason: 'SMS_NOT_CONFIGURED' });

    const res = await post();
    expect(res.status).toBeLessThan(300);
    const body = await res.json();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(body.matchesNotified).toBe(0);
    expect(body.told.owners).toBe(0);
    expect(body.potentialMatches[0]).toMatchObject({ band: 'actionable', ownerTold: false });
    // The try is kept, with no delivery on it.
    expect(prisma.alert.create).toHaveBeenCalledTimes(1);
    expect(prisma.alert.create.mock.calls[0][0].data).toMatchObject({ caseId: 'lost-case-1', userId: OWNER_ID, deliveredAt: null });
    // The success screen says nothing was sent to an owner.
    expect(screen(body).join(' ')).not.toMatch(/owner/);
  });

  test('of two owners, the screen counts only the one the email reached', async () => {
    const other = { ...lostCandidate({ breed: 'Labrador', color: 'black', lat: 40.0, lng: -75.0 }), id: 'lost-case-2', reporterId: 'lost-owner-2', reporter: { id: 'lost-owner-2', email: 'other@example.com' } };
    prisma.case.findMany.mockResolvedValue([lostCandidate({ breed: 'Labrador', color: 'black', lat: 40.0, lng: -75.0 }), other]);
    sendEmail.mockImplementation(async ({ to }) => (to === OWNER_EMAIL ? { success: true } : { success: false, error: 'rejected by the provider' }));
    const body = await (await post()).json();
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(body.matchesNotified).toBe(1);
    expect(Object.fromEntries(body.potentialMatches.map((m) => [m.reportId, m.ownerTold]))).toEqual({ 'lost-case-1': true, 'lost-case-2': false });
    expect(screen(body)).toEqual(['We sent the owner of a lost dog that looks like this one a link to your report.']);
    const delivered = Object.fromEntries(prisma.alert.create.mock.calls.map(([{ data }]) => [data.caseId, data.deliveredAt]));
    expect(delivered['lost-case-1']).toBeInstanceOf(Date);
    expect(delivered['lost-case-2']).toBeNull();
  });

  test('an owner who reported with "Text me" is texted about the found pet, with the link to it, and the finder is told whom it reached', async () => {
    prisma.case.findMany.mockResolvedValue([
      lostCandidate({ breed: 'Labrador', color: 'black', lat: 40.0, lng: -75.0 }),
    ]);
    // The email did not go; the text did, and that is enough to say the owner was sent the link.
    sendEmail.mockResolvedValue({ success: false, skipped: true, error: 'EMAIL_NOT_CONFIGURED' });
    textCaseOwner.mockResolvedValue({ sent: true });
    const res = await post();
    const body = await res.json();
    expect(textCaseOwner).toHaveBeenCalledTimes(1);
    expect(textCaseOwner.mock.calls[0][0]).toMatchObject({ caseId: 'lost-case-1', kind: 'FOUND_MATCH' });
    expect(textCaseOwner.mock.calls[0][0].body).toContain('http://localhost:5757/cases/FOUND-2026-000001');
    expect(body.told).toMatchObject({ owners: 1 });
    expect(body.potentialMatches[0]).toMatchObject({ band: 'actionable', ownerTold: true });
    expect(prisma.alert.create.mock.calls[0][0].data).toMatchObject({ method: 'SMS', deliveredAt: expect.any(Date) });
  });
});
