/**
 * The link that sets an account's password, sent to the account's own
 * address. It is the reset link of /forgot-password: a random token whose
 * hash is kept on the account (resetToken), good for an hour, opened at
 * /reset-password, where POST /api/auth/reset-password sets the password
 * and, since opening it proves the address, confirms the email too.
 *
 * Two things send it:
 *  - /api/auth/forgot-password, when someone asks for it;
 *  - /api/auth/register, when someone signs up with an address that already
 *    has an account. A report made without signing in makes an account with
 *    no password the person knows, so signing up afterwards with the same
 *    email used to end at "Unable to create account". The link is the way
 *    on, and it goes only to the address: nobody gets into an account by
 *    typing its email.
 *
 * Sign-up sends it to one address at most once in ACCOUNT_EXISTS_LINK_MINUTES,
 * however often the address is typed into the form and from however many
 * places: the route's own limit is per network address, so without this
 * anyone could fill a stranger's inbox. The count is kept by the site's
 * rate limiter (app/lib/rateLimit.js) under a hash of the address, never the
 * address itself. The window is shorter than the link is good for, so a
 * link sent in it still works.
 */

import crypto from 'crypto';
import prisma from '@/app/lib/prisma';
import { getEmailBaseUrl } from '@/app/lib/config';
import { sendEmail, renderBrandedEmail, escapeHtml } from '@/app/lib/email';
import { checkRateLimitForKeyAsync } from '@/app/lib/rateLimit';

/** How long a link is good for. */
export const PASSWORD_LINK_MINUTES = 60;

/** Sign-up sends the link to one address at most once in this many minutes. */
export const ACCOUNT_EXISTS_LINK_MINUTES = 15;
const ONE_LINK_PER_WINDOW = {
  windowMs: ACCOUNT_EXISTS_LINK_MINUTES * 60 * 1000,
  maxRequests: 1,
  blockDurationMs: ACCOUNT_EXISTS_LINK_MINUTES * 60 * 1000,
};

/** What sign-up answers for an address that already has an account, once the link has gone to it. */
export const EMAIL_HAS_ACCOUNT_MESSAGE =
  'This email already has an account. We sent a link to it to set your password. Open the link, then sign in.';

/**
 * Mints a new link for an account and keeps the hash of its token (the
 * token itself is only in the link). An older link for the account stops
 * working. Returns { url, expiresAt }.
 */
export async function mintPasswordLink(userId, { now = Date.now() } = {}) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const resetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(now + PASSWORD_LINK_MINUTES * 60 * 1000);
  await prisma.user.update({ where: { id: userId }, data: { resetToken, resetTokenExpiry: expiresAt } });
  return { url: `${getEmailBaseUrl()}/reset-password?token=${rawToken}`, expiresAt };
}

/**
 * Sends a set-password link to an address that already has an account, for
 * someone who tried to sign up with it. Returns sendEmail's answer.
 */
export async function sendAccountExistsLink(user) {
  const { url } = await mintPasswordLink(user.id);
  const html = renderBrandedEmail({
    preheader: 'Set a password for the account this email already has.',
    heading: `Hi ${user.firstName || 'there'}`,
    bodyHtml: `
      <p style="margin:0 0 12px;">Someone asked to create a ReunitePets account with <strong>${escapeHtml(user.email)}</strong>. This email already has an account, for example from a lost pet report made without signing in.</p>
      <p style="margin:0 0 12px;">To use it, set a password with the button below, then sign in. Your reports stay on the account.</p>
      <p style="margin:0 0 4px;">The link works for <strong>${PASSWORD_LINK_MINUTES} minutes</strong>.</p>
    `,
    ctaLabel: 'Set my password',
    ctaUrl: url,
    footnote: "If you didn't ask for this, ignore this email. Nothing changes until the link is used.",
  });
  return sendEmail({ to: user.email, subject: 'Set your ReunitePets password', html });
}

/** The rate limiter's key for an address: a hash, so the counter never holds the address. */
export function accountExistsLinkKey(email) {
  const address = String(email || '').trim().toLowerCase();
  return `auth:account-exists-link:${crypto.createHash('sha256').update(address).digest('hex')}`;
}

/**
 * sendAccountExistsLink, at most once per address in ACCOUNT_EXISTS_LINK_MINUTES. Inside the window
 * nothing is minted or sent, so the link sent first keeps working, and the answer is
 * { success: false, skipped: true, error: 'SENT_RECENTLY' }.
 */
export async function sendAccountExistsLinkOnce(user) {
  const limit = await checkRateLimitForKeyAsync(accountExistsLinkKey(user?.email), ONE_LINK_PER_WINDOW);
  if (!limit?.success) return { success: false, skipped: true, error: 'SENT_RECENTLY' };
  return sendAccountExistsLink(user);
}
