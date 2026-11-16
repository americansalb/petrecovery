/**
 * The reminders and the recovery email reach the owner the way they gave,
 * and a send that did not go is never written down as sent
 * (app/lib/cascade/followups.js, actions/followups.js, actions/recoveryEmail.js).
 *
 * A phone-only lost report stores "Not provided" as its owner email. The
 * cascade knew only placeholder addresses, so the day 1, 3 and 7 reminders
 * were queued as email to "Not provided" and the recovery email was logged
 * as sent.
 */

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: {
    caseFollowUp: { findMany: jest.fn(), updateMany: jest.fn(), update: jest.fn(), upsert: jest.fn() },
    caseAsset: { findUnique: jest.fn(async () => null) },
    user: { findUnique: jest.fn(async () => ({ firstName: 'Avery' })) },
  },
}));
jest.mock('@/app/lib/email', () => ({
  __esModule: true,
  sendEmail: jest.fn(),
  renderBrandedEmail: jest.fn(() => '<p>mail</p>'),
  escapeHtml: (v) => String(v ?? ''),
}));
jest.mock('@/app/lib/sms', () => ({
  __esModule: true,
  sendSms: jest.fn(),
  formatPhoneNumber: jest.requireActual('@/app/lib/sms').formatPhoneNumber,
}));
jest.mock('@/app/lib/config', () => ({ __esModule: true, getEmailBaseUrl: () => 'https://reunitepets.test' }));

import prisma from '@/app/lib/prisma';
import { sendEmail } from '@/app/lib/email';
import { sendSms } from '@/app/lib/sms';
import { followUpChannel, drainDueFollowUps } from '@/app/lib/cascade/followups';
import { runFollowups } from '@/app/lib/cascade/actions/followups';
import { runRecoveryEmail } from '@/app/lib/cascade/actions/recoveryEmail';
import { isDeliverableEmail } from '@/app/lib/placeholderEmail';

const PHONE_ONLY = { id: 'case-1', caseNumber: 'AUS-1', petName: 'Max', status: 'ACTIVE', reporterId: 'u-1', ownerEmail: 'Not provided', ownerPhone: '(512) 555-0142', createdAt: new Date() };
const BY_EMAIL = { ...PHONE_ONLY, ownerEmail: 'avery@example.com', ownerPhone: 'Not provided' };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.caseFollowUp.updateMany.mockResolvedValue({ count: 1 });
  prisma.caseFollowUp.update.mockResolvedValue({});
  prisma.caseFollowUp.upsert.mockResolvedValue({});
});

test('"Not provided" and placeholders are not addresses', () => {
  expect(isDeliverableEmail('Not provided')).toBe(false);
  expect(isDeliverableEmail('p5125550142@phone-only.invalid')).toBe(false);
  expect(isDeliverableEmail('avery@example.com')).toBe(true);
});

test('a phone-only report is reminded by text, an email report by email, and one with neither not at all', async () => {
  expect(followUpChannel(PHONE_ONLY)).toBe('sms');
  expect(followUpChannel(BY_EMAIL)).toBe('email');
  expect(followUpChannel({ ...PHONE_ONLY, ownerPhone: 'Not provided' })).toBeNull();

  await runFollowups({ case: PHONE_ONLY });
  expect(prisma.caseFollowUp.upsert.mock.calls.map((c) => c[0].create.channel)).toEqual(['sms', 'sms', 'sms']);

  await expect(runFollowups({ case: { ...PHONE_ONLY, ownerPhone: 'Not provided' } })).rejects.toMatchObject({ skip: true });
});

test('a reminder queued as email to "Not provided" before the fix goes by text', async () => {
  prisma.caseFollowUp.findMany.mockResolvedValue([{ id: 'fu-1', day: 1, channel: 'email', case: PHONE_ONLY }]);
  sendSms.mockResolvedValue({ success: true });
  expect(await drainDueFollowUps()).toMatchObject({ sent: 1, failed: 0 });
  expect(sendSms).toHaveBeenCalledTimes(1);
  expect(sendSms.mock.calls[0][0]).toBe('(512) 555-0142');
  expect(sendEmail).not.toHaveBeenCalled();
});

test('a reminder that did not go is recorded as failed, not sent', async () => {
  prisma.caseFollowUp.findMany.mockResolvedValue([{ id: 'fu-1', day: 3, channel: 'sms', case: PHONE_ONLY }]);
  sendSms.mockResolvedValue({ success: false, error: 'SMS service not configured' });
  expect(await drainDueFollowUps()).toMatchObject({ sent: 0, failed: 1 });
  expect(prisma.caseFollowUp.update.mock.calls[0][0].data).toMatchObject({ status: 'FAILED' });

  prisma.caseFollowUp.findMany.mockResolvedValue([{ id: 'fu-2', day: 3, channel: 'email', case: BY_EMAIL }]);
  sendEmail.mockResolvedValue({ success: false, error: 'bounced' });
  expect(await drainDueFollowUps()).toMatchObject({ sent: 0, failed: 1 });
});

test('the recovery email is skipped for a phone-only report, and is never logged as sent when it did not go', async () => {
  await expect(runRecoveryEmail({ case: PHONE_ONLY, results: {} })).rejects.toMatchObject({ skip: true });
  expect(sendEmail).not.toHaveBeenCalled();

  sendEmail.mockResolvedValue({ success: false, error: 'bounced' });
  await expect(runRecoveryEmail({ case: BY_EMAIL, results: {} })).rejects.toThrow(/not sent/);

  sendEmail.mockResolvedValue({ success: false, skipped: true, error: 'EMAIL_NOT_CONFIGURED' });
  await expect(runRecoveryEmail({ case: BY_EMAIL, results: {} })).rejects.toMatchObject({ skip: true });

  sendEmail.mockResolvedValue({ success: true });
  await expect(runRecoveryEmail({ case: BY_EMAIL, results: {} })).resolves.toMatchObject({ result: { sent: true } });
});
