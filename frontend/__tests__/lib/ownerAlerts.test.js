/**
 * Owner alerts for a new FOUND report (docs/OWNER_ENGAGEMENT_PLAN.md, Part 1).
 *
 * Founder direction 2026-08-08: owners hear about EVERY nearby found pet of
 * their species, not only high-confidence matches. The cruelty gate survives
 * as copy: the nearby tier claims nothing, and the in-app bell stays
 * match-only. These tests pin the robustness rules:
 *   - match tier wins; one alert per owner per found report
 *   - nearby tier requires coords on both sides and <= NEARBY_RADIUS_MILES
 *   - EmailPreference respected (unsubscribed / sightingAlerts off)
 *   - placeholder emails skipped
 *   - unsubscribe link included when the owner has a token
 *   - EmailLog written per send
 *   - one failing recipient never blocks the others
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    emailPreference: { findMany: jest.fn() },
    emailLog: { create: jest.fn() },
    alert: { create: jest.fn() },
  },
}));
jest.mock('@/app/lib/email', () => ({
  __esModule: true,
  sendEmail: jest.fn(),
  renderBrandedEmail: ({ heading = '', bodyHtml = '', footnote = '' }) => `${heading} ${bodyHtml} ${footnote}`,
  escapeHtml: (s) => String(s ?? ''),
}));
jest.mock('@/app/lib/config', () => ({ __esModule: true, getEmailBaseUrl: () => 'http://localhost:5757' }));
jest.mock('@/app/lib/notifications-inapp', () => ({ __esModule: true, createInAppNotification: jest.fn() }));

import prisma from '@/app/lib/prisma';
import { sendEmail } from '@/app/lib/email';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import {
  planOwnerAlerts,
  alertOwnersOfFoundReport,
  NEARBY_RADIUS_MILES,
  MAX_OWNER_ALERTS_PER_REPORT,
} from '@/app/lib/ownerAlerts';

// Found report at a fixed point; ~1 mile is ~0.0145 degrees of latitude.
const FOUND = {
  id: 'found-1',
  caseNumber: 'FOUND-2026-000042',
  lastSeenLatitude: 40.0,
  lastSeenLongitude: -75.0,
};

function lost({ id, ownerId, email, lat = 40.0, lng = -75.0, petName = 'Rex' }) {
  return {
    id,
    reporterId: ownerId,
    petName,
    lastSeenLatitude: lat,
    lastSeenLongitude: lng,
    pet: { name: petName },
    reporter: { id: ownerId, email },
  };
}

function actionableMatch(lostCase, distance = 0.1) {
  return { band: 'actionable', case: lostCase, details: { distance } };
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.emailPreference.findMany.mockResolvedValue([]);
  prisma.emailLog.create.mockResolvedValue({});
  prisma.alert.create.mockResolvedValue({});
  sendEmail.mockResolvedValue({ success: true });
  createInAppNotification.mockResolvedValue(undefined);
});

describe('planOwnerAlerts (pure tiering)', () => {
  const FOUND_PT = { latitude: 40.0, longitude: -75.0 };

  test('match tier wins over nearby for the same owner - one alert per owner', () => {
    const c = lost({ id: 'l1', ownerId: 'o1', email: 'o1@x.com' });
    const { plan } = planOwnerAlerts({ matches: [actionableMatch(c)], lostCases: [c], found: FOUND_PT });
    expect(plan.size).toBe(1);
    expect(plan.get('o1').tier).toBe('match');
  });

  test('a non-match owner inside the radius gets the nearby tier; outside gets nothing', () => {
    const near = lost({ id: 'l1', ownerId: 'near', email: 'n@x.com', lat: 40.0 + 2 / 69 }); // ~2 mi
    const far = lost({ id: 'l2', ownerId: 'far', email: 'f@x.com', lat: 40.0 + (NEARBY_RADIUS_MILES + 15) / 69 });
    const { plan } = planOwnerAlerts({ matches: [], lostCases: [near, far], found: FOUND_PT });
    expect(plan.get('near')?.tier).toBe('nearby');
    expect(plan.has('far')).toBe(false);
  });

  test('no coords on the found report means no nearby tier at all (cannot honestly say "near you")', () => {
    const c = lost({ id: 'l1', ownerId: 'o1', email: 'o1@x.com' });
    const { plan } = planOwnerAlerts({ matches: [], lostCases: [c], found: { latitude: null, longitude: null } });
    expect(plan.size).toBe(0);
  });

  test('a lost case without coords is skipped for nearby (but still reachable via match tier)', () => {
    const noCoords = lost({ id: 'l1', ownerId: 'o1', email: 'o1@x.com', lat: null, lng: null });
    const { plan: nearbyPlan } = planOwnerAlerts({ matches: [], lostCases: [noCoords], found: FOUND_PT });
    expect(nearbyPlan.size).toBe(0);
    const { plan: matchPlan } = planOwnerAlerts({ matches: [actionableMatch(noCoords)], lostCases: [noCoords], found: FOUND_PT });
    expect(matchPlan.get('o1')?.tier).toBe('match');
  });

  describe('per-report blast cap (abuse ceiling)', () => {
    // One owner per case, all inside the radius, spread over increasing distance.
    function manyNearby(n) {
      return Array.from({ length: n }, (_, i) =>
        lost({ id: `l${i}`, ownerId: `o${i}`, email: `o${i}@x.com`, lat: 40.0 + (i + 1) * 0.0002 })
      );
    }

    test('never plans more than MAX_OWNER_ALERTS_PER_REPORT, and reports the overflow', () => {
      const over = MAX_OWNER_ALERTS_PER_REPORT + 25;
      const { plan, truncated } = planOwnerAlerts({ matches: [], lostCases: manyNearby(over), found: FOUND_PT });
      expect(plan.size).toBe(MAX_OWNER_ALERTS_PER_REPORT);
      expect(truncated).toBe(25);
    });

    test('the cap keeps the NEAREST owners, not arbitrary ones', () => {
      const cases = manyNearby(MAX_OWNER_ALERTS_PER_REPORT + 10); // o0 nearest ... last farthest
      const { plan } = planOwnerAlerts({ matches: [], lostCases: cases, found: FOUND_PT });
      expect(plan.has('o0')).toBe(true); // nearest kept
      expect(plan.has(`o${MAX_OWNER_ALERTS_PER_REPORT + 9}`)).toBe(false); // farthest dropped
    });

    test('match-tier owners are never dropped to make room for nearby ones', () => {
      const matchCase = lost({ id: 'match', ownerId: 'vip', email: 'vip@x.com', lat: 40.0 + 5 / 69 });
      const { plan } = planOwnerAlerts({
        matches: [actionableMatch(matchCase)],
        lostCases: [matchCase, ...manyNearby(MAX_OWNER_ALERTS_PER_REPORT + 50)],
        found: FOUND_PT,
      });
      expect(plan.get('vip')?.tier).toBe('match');
      expect(plan.size).toBe(MAX_OWNER_ALERTS_PER_REPORT);
    });
  });
});

describe('alertOwnersOfFoundReport (delivery rules)', () => {
  test('match tier: in-app + email + Alert row, deep-linked to the FOUND case', async () => {
    const c = lost({ id: 'l1', ownerId: 'o1', email: 'o1@x.com', petName: 'Max' });
    const res = await alertOwnersOfFoundReport({
      report: FOUND, matches: [actionableMatch(c)], lostCases: [c], petType: 'dog',
    });
    expect(res).toEqual({ matchesNotified: 1, nearbyNotified: 0 });
    expect(createInAppNotification.mock.calls[0][0].actionUrl).toBe('/cases/FOUND-2026-000042');
    expect(sendEmail.mock.calls[0][0].subject).toMatch(/possible match for max/i);
    expect(prisma.alert.create.mock.calls[0][0].data.caseId).toBe('l1');
  });

  test('nearby tier: email only, honest copy, no push, no Alert row', async () => {
    const c = lost({ id: 'l1', ownerId: 'o1', email: 'o1@x.com', petName: 'Bella', lat: 40.0 + 3 / 69 });
    const res = await alertOwnersOfFoundReport({ report: FOUND, matches: [], lostCases: [c], petType: 'dog' });
    expect(res).toEqual({ matchesNotified: 0, nearbyNotified: 1 });
    expect(createInAppNotification).not.toHaveBeenCalled();
    expect(prisma.alert.create).not.toHaveBeenCalled();
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.subject).toMatch(/near where Bella went missing/);
    expect(mail.subject).not.toMatch(/match/i);
    expect(mail.html).toMatch(/may not be Bella/i);
  });

  test('an unsubscribed owner gets no email; a match-tier unsubscribed owner still gets the in-app + Alert', async () => {
    const c = lost({ id: 'l1', ownerId: 'o1', email: 'o1@x.com' });
    prisma.emailPreference.findMany.mockResolvedValue([
      { userId: 'o1', unsubscribedAt: new Date(), sightingAlerts: true, unsubscribeToken: 't1' },
    ]);
    const res = await alertOwnersOfFoundReport({
      report: FOUND, matches: [actionableMatch(c)], lostCases: [c], petType: 'dog',
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(createInAppNotification).toHaveBeenCalledTimes(1); // unsubscribe governs email, not the product
    expect(res.matchesNotified).toBe(1);
  });

  test('sightingAlerts=false suppresses the nearby email entirely', async () => {
    const c = lost({ id: 'l1', ownerId: 'o1', email: 'o1@x.com' });
    prisma.emailPreference.findMany.mockResolvedValue([
      { userId: 'o1', unsubscribedAt: null, sightingAlerts: false, unsubscribeToken: 't1' },
    ]);
    const res = await alertOwnersOfFoundReport({ report: FOUND, matches: [], lostCases: [c], petType: 'dog' });
    expect(sendEmail).not.toHaveBeenCalled();
    // Honest count: email is the nearby tier's only channel, so a suppressed
    // email means this owner was NOT notified.
    expect(res.nearbyNotified).toBe(0);
  });

  test('placeholder emails (phone-only reporters) are never emailed', async () => {
    const c = lost({ id: 'l1', ownerId: 'o1', email: 'p15551234567@phone-only.invalid' });
    await alertOwnersOfFoundReport({ report: FOUND, matches: [], lostCases: [c], petType: 'dog' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('the one-click unsubscribe link rides along when the owner has a token', async () => {
    const c = lost({ id: 'l1', ownerId: 'o1', email: 'o1@x.com' });
    prisma.emailPreference.findMany.mockResolvedValue([
      { userId: 'o1', unsubscribedAt: null, sightingAlerts: true, unsubscribeToken: 'tok-123' },
    ]);
    await alertOwnersOfFoundReport({ report: FOUND, matches: [], lostCases: [c], petType: 'dog' });
    expect(sendEmail.mock.calls[0][0].html).toContain('/api/unsubscribe/tok-123?type=sighting_alerts');
  });

  test('every send is written to EmailLog with the right type', async () => {
    const m = lost({ id: 'l1', ownerId: 'o1', email: 'o1@x.com' });
    const n = lost({ id: 'l2', ownerId: 'o2', email: 'o2@x.com', lat: 40.0 + 2 / 69 });
    await alertOwnersOfFoundReport({ report: FOUND, matches: [actionableMatch(m)], lostCases: [m, n], petType: 'dog' });
    const types = prisma.emailLog.create.mock.calls.map((c) => c[0].data.emailType).sort();
    expect(types).toEqual(['FOUND_MATCH', 'NEARBY_FOUND_ALERT']);
  });

  test('an unconfigured/skipped email counts nobody as notified and writes no EmailLog', async () => {
    const c = lost({ id: 'l1', ownerId: 'o1', email: 'o1@x.com' });
    sendEmail.mockResolvedValue({ success: false, skipped: true, error: 'EMAIL_NOT_CONFIGURED' });
    const res = await alertOwnersOfFoundReport({ report: FOUND, matches: [], lostCases: [c], petType: 'dog' });
    expect(res.nearbyNotified).toBe(0);
    expect(prisma.emailLog.create).not.toHaveBeenCalled();
  });

  test('one failing recipient does not block the others', async () => {
    const a = lost({ id: 'l1', ownerId: 'oa', email: 'a@x.com' });
    const b = lost({ id: 'l2', ownerId: 'ob', email: 'b@x.com', lat: 40.0 + 1 / 69 });
    sendEmail.mockImplementation(({ to }) =>
      to === 'a@x.com' ? Promise.reject(new Error('smtp down')) : Promise.resolve({ success: true })
    );
    const res = await alertOwnersOfFoundReport({ report: FOUND, matches: [], lostCases: [a, b], petType: 'dog' });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(res.nearbyNotified).toBeGreaterThanOrEqual(1);
  });
});
