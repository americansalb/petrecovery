/**
 * A new lost report that looks like a pet someone already found: the finder
 * is told, and lands on the LOST pet's page (app/lib/cascade/actions/reverseMatch.js).
 *
 * The bell and push used to open the finder's own found report, which does
 * not mention the lost pet, and a finder who reported with "Email me" was
 * never emailed at all.
 */

jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: { case: { findMany: jest.fn(async () => []) } } }));
jest.mock('@/app/lib/cascade/reverseMatch', () => ({ __esModule: true, reverseMatch: jest.fn(), formatMatch: jest.fn((m) => ({ reportId: m.case.id })) }));
jest.mock('@/app/lib/notifications-inapp', () => ({ __esModule: true, createInAppNotification: jest.fn(async () => ({ success: true })) }));
jest.mock('@/app/lib/push', () => ({ __esModule: true, sendPushToUser: jest.fn(async () => ({ sent: 0 })) }));
jest.mock('@/app/lib/email', () => ({
  __esModule: true,
  sendEmail: jest.fn(async () => ({ success: true })),
  renderBrandedEmail: jest.fn((parts) => `${parts.bodyHtml}<a href="${parts.ctaUrl}">${parts.ctaLabel}</a>`),
  escapeHtml: (v) => String(v ?? ''),
}));
jest.mock('@/app/lib/config', () => ({ __esModule: true, getEmailBaseUrl: () => 'https://reunitepets.test' }));

import { reverseMatch } from '@/app/lib/cascade/reverseMatch';
import { createInAppNotification } from '@/app/lib/notifications-inapp';
import { sendEmail } from '@/app/lib/email';
import { runReverseMatch } from '@/app/lib/cascade/actions/reverseMatch';

const LOST = { id: 'lost-1', caseNumber: 'AUS-2026-MIA001', petName: 'Mia', petSpecies: 'CAT', lastSeenLatitude: 30.26, lastSeenLongitude: -97.77 };
const found = (over) => ({ id: 'found-1', caseNumber: 'AUS-2026-FOUND1', reporterId: 'u-finder', ownerEmail: 'finder@example.com', ...over });

beforeEach(() => jest.clearAllMocks());

test('the finder of a strong match is sent to the lost pet\'s page, by bell and by the email they gave', async () => {
  reverseMatch.mockReturnValue([{ band: 'actionable', case: found() }]);
  const out = await runReverseMatch({ case: LOST });
  expect(out.result.notified).toBe(1);
  expect(createInAppNotification.mock.calls[0][0]).toMatchObject({ userId: 'u-finder', actionUrl: '/cases/AUS-2026-MIA001', title: 'Is the cat you found Mia?' });
  const mail = sendEmail.mock.calls[0][0];
  expect(mail.to).toBe('finder@example.com');
  expect(mail.html).toContain('https://reunitepets.test/cases/AUS-2026-MIA001');
});

test('a finder who gave only a phone is not emailed at a placeholder, and nobody is told about a weak match', async () => {
  reverseMatch.mockReturnValue([
    { band: 'actionable', case: found({ ownerEmail: 'p5125550142@phone-only.invalid' }) },
    { band: 'feed', case: found({ id: 'found-2', reporterId: 'u-other' }) },
  ]);
  await runReverseMatch({ case: LOST });
  expect(createInAppNotification).toHaveBeenCalledTimes(1);
  expect(sendEmail).not.toHaveBeenCalled();
});
