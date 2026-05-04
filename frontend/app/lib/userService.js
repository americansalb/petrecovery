/**
 * userService — single entry point for creating User records.
 *
 * All user creation in the app should funnel through `createUser`. Each call
 * site supplies a `source` that determines policy:
 *
 *   register  — credentials sign-up; password required, email verification
 *               token issued and verification email sent.
 *   foundPet  — implicit account from a Found Pet report; password is a
 *               random temp value (so they can use Forgot Password later)
 *               and an email-verification token is issued. The caller is
 *               responsible for gating any privileged action (claim
 *               ownership, message owners) until emailVerified is set.
 *   lostPet   — implicit account from a Lost Pet report; same shape as
 *               foundPet.
 *   oauth     — created during NextAuth OAuth sign-in; emailVerified is
 *               set immediately because the IdP has verified the address.
 *
 * Centralizing here ensures consistent bcrypt cost, consistent verification
 * policy, consistent audit logging, and consistent normalization.
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from './prisma';
import { sendVerificationEmail } from './email';
import { getEmailBaseUrl } from './config';
import { logEvent } from '@/lib/logging';

const BCRYPT_COST = 12;
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const SOURCES = new Set(['register', 'foundPet', 'lostPet', 'oauth']);

/**
 * @param {Object} input
 * @param {string} input.email
 * @param {string} input.firstName
 * @param {string} [input.lastName]
 * @param {string} [input.phone]
 * @param {('register'|'foundPet'|'lostPet'|'oauth')} input.source
 * @param {string} [input.password]      Required for source='register'.
 * @param {string} [input.profileImage]  OAuth-only.
 * @param {boolean} [input.acceptedTerms]
 * @param {string} [input.correlationId] For audit log correlation.
 * @param {object} [input.tx]            Optional Prisma transaction client.
 *   When supplied, the User row is created via `tx` so the caller can keep
 *   user creation atomic with downstream pet/case writes. Side effects
 *   (verification email, audit log) are deferred — caller must invoke the
 *   returned `commitSideEffects()` after the transaction commits, otherwise
 *   they would be observable even if the tx rolled back.
 *
 * @returns {Promise<{
 *   user: object,
 *   requiresVerification: boolean,
 *   tempPassword: string | null,
 *   rawVerifyToken: string | null,
 *   commitSideEffects: () => Promise<void>
 * }>}
 *
 * Throws on duplicate email — caller is responsible for the user-facing
 * generic message (we don't want to leak enumeration here, but the route
 * sometimes legitimately needs to detect existing users for upsert paths).
 */
export async function createUser(input) {
  const {
    email,
    firstName,
    lastName,
    phone,
    source,
    password,
    profileImage,
    acceptedTerms,
    correlationId,
    tx,
  } = input;

  if (!SOURCES.has(source)) {
    throw new Error(`createUser: unknown source "${source}"`);
  }
  if (!email || !firstName) {
    throw new Error('createUser: email and firstName are required');
  }
  if (source === 'register' && !password) {
    throw new Error('createUser: password is required for source=register');
  }

  const db = tx ?? prisma;
  const normalizedEmail = email.toLowerCase().trim();

  // Password rules:
  //   - OAuth: no password (account recovers via the OAuth provider).
  //   - Caller supplied one: use it.
  //   - Otherwise (e.g. guest foundPet/lostPet report): generate a random
  //     temp password so the user can recover via Forgot Password later.
  let tempPassword = null;
  let passwordToHash = password;
  if (!passwordToHash && source !== 'oauth') {
    tempPassword =
      crypto.randomBytes(16).toString('base64url') +
      crypto.randomBytes(16).toString('base64url');
    passwordToHash = tempPassword;
  }
  const passwordHash = passwordToHash
    ? await bcrypt.hash(passwordToHash, BCRYPT_COST)
    : null;

  // Verification policy: OAuth providers attest to the email; everyone else
  // must click a verify link.
  const isOAuth = source === 'oauth';
  let rawVerifyToken = null;
  let emailVerifyToken = null;
  let emailVerifyExpiry = null;
  if (!isOAuth) {
    rawVerifyToken = crypto.randomBytes(32).toString('hex');
    emailVerifyToken = crypto
      .createHash('sha256')
      .update(rawVerifyToken)
      .digest('hex');
    emailVerifyExpiry = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
  }

  const user = await db.user.create({
    data: {
      email: normalizedEmail,
      firstName: firstName.trim().substring(0, 100),
      lastName: lastName ? lastName.trim().substring(0, 100) : null,
      phone: phone ? phone.trim() : null,
      passwordHash,
      profileImage: profileImage || null,
      role: 'USER',
      emailVerified: isOAuth ? new Date() : null,
      emailVerifyToken,
      emailVerifyExpiry,
      ...(acceptedTerms && {
        waiverAcceptedAt: new Date(),
        waiverVersionAccepted: '1.0',
      }),
    },
  });

  // Side effects are wrapped in a callback so transactional callers can defer
  // them until after commit. Non-transactional callers can invoke immediately.
  const commitSideEffects = async () => {
    if (rawVerifyToken) {
      const verifyUrl = `${getEmailBaseUrl()}/verify-email?token=${rawVerifyToken}`;
      sendVerificationEmail(normalizedEmail, user.firstName, verifyUrl).catch(
        (err) => console.error('[userService] verification email failed:', err)
      );
    }
    logEvent({
      event_type: `auth.user_created.${source}`,
      correlation_id: correlationId,
      resource_type: 'user',
      resource_id: user.id,
      action: 'create',
      result: 'success',
      metadata: {
        source,
        email_prefix: normalizedEmail.substring(0, 3),
        requires_verification: !isOAuth,
      },
    }).catch(() => {});
  };

  // No transaction: fire side effects eagerly, return a no-op callback.
  if (!tx) {
    await commitSideEffects();
    return {
      user,
      requiresVerification: !isOAuth,
      tempPassword,
      rawVerifyToken,
      commitSideEffects: async () => {},
    };
  }

  return {
    user,
    requiresVerification: !isOAuth,
    tempPassword,
    rawVerifyToken,
    commitSideEffects,
  };
}

/**
 * Issue a fresh verification token for an existing user and (re)send the
 * verification email. Used by the Resend Verification endpoint and by
 * implicit-creation flows that want to nudge the user.
 *
 * Idempotent: safe to call multiple times. Always returns void (caller
 * should respond with a generic "if that email exists, a link was sent"
 * to avoid enumeration).
 */
export async function issueVerificationEmail(email) {
  const normalized = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user || user.emailVerified) return;

  const rawVerifyToken = crypto.randomBytes(32).toString('hex');
  const emailVerifyToken = crypto
    .createHash('sha256')
    .update(rawVerifyToken)
    .digest('hex');
  const emailVerifyExpiry = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifyToken, emailVerifyExpiry },
  });

  const verifyUrl = `${getEmailBaseUrl()}/verify-email?token=${rawVerifyToken}`;
  await sendVerificationEmail(normalized, user.firstName, verifyUrl);
}
