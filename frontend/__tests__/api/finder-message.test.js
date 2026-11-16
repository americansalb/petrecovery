/**
 * Writing to the finder of a found pet (GET and POST /api/reports/[id]/message,
 * app/lib/finderMessage.js).
 *
 * Found in testing: when the finder picked "Email me", the owner told about
 * the found cat had no way to reach them. The found page said "The finder
 * didn't leave a phone number". Now the site sends the owner's message on,
 * by email or text, and neither side sees the other's address unless they
 * chose to give it.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => ({
  __esModule: true,
  default: { case: { findFirst: jest.fn(), findMany: jest.fn(async () => []) } },
}));
jest.mock('@/app/lib/auth', () => ({ __esModule: true, authOptions: {} }));
jest.mock('next-auth', () => ({ __esModule: true, getServerSession: jest.fn(async () => null) }));
jest.mock('@/lib/logging', () => ({ __esModule: true, logEvent: jest.fn(async () => {}) }));
jest.mock('@/app/lib/email', () => ({
  __esModule: true,
  sendEmail: jest.fn(),
  renderBrandedEmail: jest.fn((parts) => `<h1>${parts.heading}</h1>${parts.bodyHtml}`),
}));
jest.mock('@/app/lib/sms', () => ({ __esModule: true, sendSms: jest.fn() }));
jest.mock('@/app/lib/config', () => ({ __esModule: true, getEmailBaseUrl: () => 'https://reunitepets.test' }));
jest.mock('@/app/lib/notifications-inapp', () => ({ __esModule: true, createInAppNotification: jest.fn(async () => ({ success: true })) }));
jest.mock('@/app/lib/rateLimit', () => {
  const { NextResponse } = require('next/server');
  return {
    __esModule: true,
    RateLimitPresets: { PUBLIC_WRITE: {}, PUBLIC_READ: {} },
    withRateLimitAsync: jest.fn(async () => ({ success: true })),
    checkRateLimitForKeyAsync: jest.fn(async () => ({ success: true })),
    rateLimitResponse: jest.fn(() => NextResponse.json({ error: 'Too many requests' }, { status: 429 })),
  };
});

import prisma from '@/app/lib/prisma';
import { getServerSession } from 'next-auth';
import { sendEmail } from '@/app/lib/email';
import { sendSms } from '@/app/lib/sms';
import { checkRateLimitForKeyAsync } from '@/app/lib/rateLimit';
import { GET, POST } from '@/app/api/reports/[id]/message/route';

const FOUND = {
  id: 'found-1',
  caseNumber: 'AUS-2026-FOUND1',
  status: 'ACTIVE',
  petName: 'Gray cat',
  petSpecies: 'CAT',
  petPhotoUrl: 'https://cdn.example.com/cat.jpg',
  reporterId: 'u-finder',
  ownerEmail: 'finder@example.com',
  ownerPhone: 'Not provided',
  reporter: { email: 'finder@example.com', phone: null },
};
const ctx = { params: { id: 'AUS-2026-FOUND1' } };
const send = (body) =>
  POST(new NextRequest('http://localhost:3000/api/reports/AUS-2026-FOUND1/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), ctx);

beforeEach(() => {
  jest.clearAllMocks();
  prisma.case.findFirst.mockResolvedValue(FOUND);
  sendEmail.mockResolvedValue({ success: true });
  sendSms.mockResolvedValue({ success: true });
  getServerSession.mockResolvedValue(null);
});

test('the page learns the found pet and how a message will go, never the finder\'s address', async () => {
  const res = await GET(new NextRequest('http://localhost:3000/api/reports/AUS-2026-FOUND1/message'), ctx);
  const body = await res.json();
  expect(body).toEqual({ caseNumber: 'AUS-2026-FOUND1', petName: 'Gray cat', kind: 'cat', photo: 'https://cdn.example.com/cat.jpg', open: true, reachBy: 'email' });
  expect(JSON.stringify(body)).not.toContain('finder@example.com');
  // Found reports only: a lost pet's page has its own ways to reach the owner.
  expect(prisma.case.findFirst.mock.calls[0][0].where).toMatchObject({ caseNumber: 'AUS-2026-FOUND1', reportType: 'FOUND' });
});

test('a message to a finder who chose "Email me" is emailed to them, with the address the owner chose to share', async () => {
  const res = await send({ message: 'She has a white spot on her chin and answers to Mia.', name: 'Dana', replyTo: 'dana@example.com' });
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ sent: true, via: 'email' });
  const mail = sendEmail.mock.calls[0][0];
  expect(mail.to).toBe('finder@example.com');
  expect(mail.subject).toBe('A message about the cat you found');
  expect(mail.html).toContain('She has a white spot on her chin and answers to Mia.');
  expect(mail.html).toContain('mailto:dana@example.com');
  expect(mail.html).toContain('ask them to show it is theirs');
  expect(sendSms).not.toHaveBeenCalled();
});

test('a finder who gave only a phone gets it by text', async () => {
  prisma.case.findFirst.mockResolvedValue({ ...FOUND, ownerEmail: 'p5125550142@phone-only.invalid', ownerPhone: '(512) 555-0142', reporter: { email: 'p5125550142@phone-only.invalid', phone: '(512) 555-0142' } });
  const body = await (await send({ message: 'Is she gray with a white chin?', replyTo: '512 555 0199' })).json();
  expect(body).toEqual({ sent: true, via: 'text' });
  expect(sendSms.mock.calls[0][0]).toBe('(512) 555-0142');
  expect(sendSms.mock.calls[0][1]).toContain('Call or text 512 555 0199.');
  expect(sendEmail).not.toHaveBeenCalled();
});

test('with no way back to the person writing, nothing is sent', async () => {
  const res = await send({ message: 'That is my cat.' });
  expect(res.status).toBe(400);
  expect((await res.json()).code).toBe('NO_REPLY');
  expect(sendEmail).not.toHaveBeenCalled();
});

test('an owner signed in with an open lost report may write without sharing an address: the finder gets the link to that report', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'u-owner' } });
  prisma.case.findFirst.mockImplementation(async ({ where }) => (where.reportType === 'FOUND' ? FOUND : { caseNumber: 'AUS-2026-MIA001', petName: 'Mia' }));
  const body = await (await send({ message: 'I think this is Mia.' })).json();
  expect(body.sent).toBe(true);
  expect(sendEmail.mock.calls[0][0].html).toContain('https://reunitepets.test/cases/AUS-2026-MIA001');
});

test('a message that did not go is not said to have gone', async () => {
  sendEmail.mockResolvedValue({ success: false, skipped: true, error: 'EMAIL_NOT_CONFIGURED' });
  const res = await send({ message: 'That is my cat.', replyTo: 'dana@example.com' });
  expect(res.status).toBe(502);
  expect(await res.json()).toMatchObject({ code: 'NOT_SENT' });
});

test('a closed report, a lost report, a bad reply address and a crowded finder are each refused', async () => {
  prisma.case.findFirst.mockResolvedValueOnce({ ...FOUND, status: 'REUNITED' });
  expect((await send({ message: 'Mine?', replyTo: 'dana@example.com' })).status).toBe(409);

  prisma.case.findFirst.mockResolvedValueOnce(null);
  expect((await send({ message: 'Mine?', replyTo: 'dana@example.com' })).status).toBe(404);

  expect((await send({ message: 'Mine?', replyTo: 'not an address' })).status).toBe(400);
  expect((await send({ message: '   ', replyTo: 'dana@example.com' })).status).toBe(400);

  checkRateLimitForKeyAsync.mockResolvedValueOnce({ success: false });
  expect((await send({ message: 'Mine?', replyTo: 'dana@example.com' })).status).toBe(429);
  expect(checkRateLimitForKeyAsync.mock.calls[0][0]).toBe('reports:message:finder:found-1');
  expect(sendEmail).not.toHaveBeenCalled();
});

test('the finder cannot write to their own report', async () => {
  getServerSession.mockResolvedValue({ user: { id: 'u-finder' } });
  expect((await send({ message: 'Test', replyTo: 'dana@example.com' })).status).toBe(400);
});
