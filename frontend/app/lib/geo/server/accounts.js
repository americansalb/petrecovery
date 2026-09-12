/**
 * Signing in, which for this game is an email address and a link.
 *
 * No password, so there is nothing to leak, nothing to reset and
 * nothing to reuse from another site's breach. The link is a random 32
 * bytes; only its SHA-256 is stored, so this table being read does not
 * let anyone sign in as anyone. It expires in fifteen minutes and it is
 * burned on first use.
 *
 * What signing in actually does is bind the browser's existing profile
 * to an account, so the same player picks up on a second device. It
 * never merges two profiles: if the account already has one, that
 * profile becomes the player's and the anonymous one is left alone
 * rather than folded in. Merging ratings and points is a decision with
 * a wrong answer (whose rating survives?), and quietly picking one
 * would be the worst of them.
 *
 * Server only.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { sendSignInEmail } from './email';
import { resolveProfile } from './profiles';

/** Fifteen minutes. Long enough to switch to a mail app and back. */
export const LINK_TTL_MS = 15 * 60 * 1000;

export class GeoAuthError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'GeoAuthError';
    this.code = code;
  }
}

export function hashLoginToken(token) {
  return createHash('sha256').update(`reunitepets-geo-login:${token}`).digest('hex');
}

/**
 * Addresses are compared and stored lowercased and trimmed, so one
 * person cannot end up with two accounts through capitalisation.
 */
export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

/** Deliberately loose. The confirming link is the real check. */
export function looksLikeEmail(value) {
  const email = normalizeEmail(value);
  return email.length >= 6 && email.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Ask for a link.
 *
 * Always reports the same thing whether or not an account exists, so
 * this endpoint cannot be used to find out who has one.
 */
export async function requestSignIn(store, { email: raw, baseUrl, profileId = null, now = Date.now(), sendImpl, env } = {}) {
  const email = normalizeEmail(raw);
  if (!looksLikeEmail(email)) throw new GeoAuthError('bad_email', 'That does not look like an email address');

  const token = randomBytes(32).toString('base64url');
  await store.createLoginToken({
    tokenHash: hashLoginToken(token),
    email,
    // Whose profile this browser is playing as, captured now. The link
    // arrives as a plain navigation from a mail client, with no
    // localStorage and no headers, so by the time it is followed there
    // is nothing left to say who asked.
    profileId: profileId || null,
    expiresAt: new Date(now + LINK_TTL_MS),
    createdAt: new Date(now),
  });

  const url = `${String(baseUrl || '').replace(/\/$/, '')}/api/geo/auth/verify?token=${encodeURIComponent(token)}`;
  const result = await sendSignInEmail({ to: email, url, sendImpl, env });
  return { email, sent: result.sent, delivered: Boolean(result.delivered), url };
}

/**
 * Follow a link.
 *
 * Returns the account and the profile now bound to it. Throws
 * GeoAuthError('invalid' | 'expired' | 'used') and nothing else, so the
 * route can say which without leaking whether the address exists.
 */
export async function verifySignIn(store, { token, profileToken = '', now = Date.now() } = {}) {
  if (!token || typeof token !== 'string') throw new GeoAuthError('invalid', 'That link is not valid');

  const row = await store.getLoginTokenByHash(hashLoginToken(token));
  if (!row) throw new GeoAuthError('invalid', 'That link is not valid');
  if (row.usedAt) throw new GeoAuthError('used', 'That link has already been used');
  if (new Date(row.expiresAt).getTime() <= now) throw new GeoAuthError('expired', 'That link has expired');

  // Burn it first. A double click on the link in a mail client should
  // not be able to run this twice.
  const burned = await store.useLoginToken(row.id, new Date(now));
  if (!burned) throw new GeoAuthError('used', 'That link has already been used');

  let account = await store.getAccountByEmail(row.email);
  if (!account) {
    account = await store.createAccount({ email: row.email, createdAt: new Date(now), lastSeenAt: new Date(now) });
  } else {
    await store.updateAccount(account.id, { lastSeenAt: new Date(now) });
  }

  // The browser's profile, from the header if a caller had one, else
  // the one recorded when the link was asked for. Without this the
  // player's rating, points and badges were severed from the account on
  // the very first sign-in: resolveProfile found nothing, made a fresh
  // empty profile, and from then on always preferred that one.
  let profile = null;
  if (profileToken) ({ profile } = await resolveProfile(store, { token: profileToken, accountId: account.id, now, createIfMissing: false }));
  if (!profile && row.profileId && store.getProfileById) {
    const existing = await store.getProfileById(row.profileId);
    if (existing && !existing.accountId) profile = await store.updateProfile(existing.id, { accountId: account.id, lastSeenAt: new Date(now) });
    else if (existing?.accountId === account.id) profile = existing;
  }
  if (!profile) ({ profile } = await resolveProfile(store, { token: profileToken, accountId: account.id, now, createIfMissing: true }));
  return { account, profile };
}

/**
 * Constant-time compare for anywhere a caller holds two tokens. Not
 * used by the flow above, which compares hashes through a unique index,
 * but exported so nobody writing the next endpoint reaches for `===`.
 */
export function sameToken(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
