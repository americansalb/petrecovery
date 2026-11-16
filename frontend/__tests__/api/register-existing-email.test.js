/**
 * Signing up with an email that already has an account (POST /api/auth/register).
 *
 * A lost pet report sent without signing in makes an account for the email it
 * gives, with no password the person knows. Signing up afterwards with the same
 * email ended at "Unable to create account. Please try again or use a different
 * email.", a dead end for the person whose pet is missing.
 *
 * Now the answer sends the set-password link of /forgot-password to the address
 * (app/lib/passwordLink.js) and says so. What is held here: the link goes only to
 * the address on the account, never to the person asking; nobody is signed in and
 * no password, name or phone from the form is saved; nothing riding along is made;
 * every existing account is answered the same way; and opening the link is the
 * existing reset, which confirms the email.
 */

import { NextRequest } from 'next/server';

jest.mock('@/app/lib/prisma', () => {
  const mock = {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    pet: { create: jest.fn() },
    petMedication: { create: jest.fn() },
    rescueForce: { findFirst: jest.fn() },
    rescueForceMember: { create: jest.fn() },
    shelter: { findFirst: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
    shelterClaim: { create: jest.fn() },
    $transaction: jest.fn(async (fn) => fn(mock)),
  };
  return { __esModule: true, default: mock };
});
jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('$2b$12$mockedHashValue') }));
jest.mock('@/app/lib/rateLimit', () => ({
  withRateLimit: jest.fn().mockReturnValue({ success: true }),
  withRateLimitAsync: jest.fn().mockResolvedValue({ success: true }),
  RateLimitPresets: { AUTH: {} },
  rateLimitResponse: jest.fn(),
}));
jest.mock('@/lib/logging', () => ({ logEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/app/lib/email', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  renderBrandedEmail: jest.fn(({ heading, bodyHtml, ctaUrl }) => `<h1>${heading}</h1>${bodyHtml}<a href="${ctaUrl}">x</a>`),
  escapeHtml: (s) => String(s),
}));

import crypto from 'crypto';
import prisma from '@/app/lib/prisma';
import { sendEmail, sendVerificationEmail } from '@/app/lib/email';
import { getBaseUrl } from '@/app/lib/config';
import { POST } from '@/app/api/auth/register/route';
import { mintPasswordLink, PASSWORD_LINK_MINUTES } from '@/app/lib/passwordLink';

const GUEST = { id: 'guest-1', email: 'sam@example.com', firstName: 'Sam', passwordHash: '$2b$12$temp', emailVerified: null };

const signup = (extra = {}) =>
  POST(
    new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Sammy', email: 'Sam@Example.com', password: 'a-new-password', phone: '512-555-0100', acceptedTerms: true, ...extra }),
    })
  );

beforeEach(() => {
  jest.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue(GUEST);
  prisma.user.update.mockResolvedValue({});
});

describe('signing up with an email a guest report already used', () => {
  test('says a link to set the password went to the address, instead of a dead end', async () => {
    const res = await signup();
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body).toEqual({
      error: 'This email already has an account. We sent a link to it to set your password. Open the link, then sign in.',
      code: 'EMAIL_HAS_ACCOUNT',
    });
    expect(body.error).not.toMatch(/Unable to create account|different email/);
  });

  test('the link goes to the address on the account, and only there', async () => {
    await signup();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = sendEmail.mock.calls[0][0];
    expect(mail.to).toBe('sam@example.com');
    expect(mail.subject).toBe('Set your ReunitePets password');
    const link = mail.html.match(/href="([^"]+)"/)[1];
    expect(link).toMatch(new RegExp(`^${getBaseUrl()}/reset-password\\?token=[0-9a-f]{64}$`));
    // The token is in the email and nowhere else: not in the answer to the person asking.
    const token = link.split('token=')[1];
    const res = await signup();
    expect(JSON.stringify(await res.json())).not.toContain(token);
  });

  test('only the hash of the token is kept on the account, good for an hour, the same as a reset', async () => {
    const before = Date.now();
    await signup();
    const link = sendEmail.mock.calls[0][0].html.match(/href="([^"]+)"/)[1];
    const token = link.split('token=')[1];
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const { where, data } = prisma.user.update.mock.calls[0][0];
    expect(where).toEqual({ id: 'guest-1' });
    expect(Object.keys(data).sort()).toEqual(['resetToken', 'resetTokenExpiry']);
    expect(data.resetToken).toBe(crypto.createHash('sha256').update(token).digest('hex'));
    const ms = data.resetTokenExpiry.getTime() - before;
    expect(ms).toBeGreaterThan(PASSWORD_LINK_MINUTES * 60 * 1000 - 5000);
    expect(ms).toBeLessThanOrEqual(PASSWORD_LINK_MINUTES * 60 * 1000 + 5000);
  });

  test('nobody is signed in by email alone: no password, name or phone from the form is saved, and no account is made', async () => {
    const res = await signup();
    expect(prisma.user.create).not.toHaveBeenCalled();
    for (const [{ data }] of prisma.user.update.mock.calls) {
      expect(data).not.toHaveProperty('passwordHash');
      expect(data).not.toHaveProperty('emailVerified');
      expect(data).not.toHaveProperty('firstName');
      expect(data).not.toHaveProperty('phone');
    }
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });

  test('nothing riding along is made: no pet, no shelter claim, no force membership', async () => {
    const pet = { name: 'Rex', species: 'DOG', color: 'Brown', size: 'LARGE' };
    for (const extra of [{ pet }, { joinForceId: 'force-1' }, { shelterRequest: { shelterName: 'Paws', city: 'Austin', state: 'TX' } }]) {
      const res = await signup(extra);
      expect(res.status).toBe(409);
    }
    expect(prisma.pet.create).not.toHaveBeenCalled();
    expect(prisma.rescueForceMember.create).not.toHaveBeenCalled();
    expect(prisma.shelterClaim.create).not.toHaveBeenCalled();
  });

  test('an account someone already confirmed is answered the same way, so the answer says nothing about the account', async () => {
    const a = await (await signup()).json();
    prisma.user.findUnique.mockResolvedValue({ ...GUEST, emailVerified: new Date(), passwordHash: '$2b$12$real' });
    const b = await (await signup()).json();
    expect(b).toEqual(a);
  });

  test('if the email cannot be sent, the answer is the same and nothing breaks', async () => {
    sendEmail.mockRejectedValueOnce(new Error('mail is down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await signup();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('EMAIL_HAS_ACCOUNT');
    console.error.mockRestore();
  });

  test('a new email still makes an account and sends the verification email, as before', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }) => ({ id: 'new-1', ...data }));
    const res = await signup({ email: 'new@example.com' });
    expect(res.status).toBe(200);
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe('the set-password link is the reset link', () => {
  test('forgot-password and sign-up mint it the same way', async () => {
    const { url, expiresAt } = await mintPasswordLink('user-9', { now: 1_000_000 });
    expect(url).toMatch(/\/reset-password\?token=[0-9a-f]{64}$/);
    expect(expiresAt.getTime()).toBe(1_000_000 + 60 * 60 * 1000);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-9' }, data: { resetToken: expect.stringMatching(/^[0-9a-f]{64}$/), resetTokenExpiry: expiresAt } });
    const forgot = require('fs').readFileSync(require('path').join(__dirname, '../../app/api/auth/forgot-password/route.js'), 'utf8');
    expect(forgot).toMatch(/mintPasswordLink\(user\.id\)/);
  });
});
