/**
 * Signing in, which for this game is an email address and a code.
 *
 * The email carries a six-digit code and a link, and either one signs
 * you in. The code is the one that is asked for: it is typed into the
 * tab that asked for it. A link opened from a mail app on a phone often
 * lands in the mail app's own browser, which signed that browser in and
 * left the game's tab signed out, so to the player the game had simply
 * forgotten them.
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

import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { getGeoServerConfig } from './config';
import { sendSignInEmail } from './email';
import { resolveProfile } from './profiles';

/** Fifteen minutes. Long enough to switch to a mail app and back. */
export const LINK_TTL_MS = 15 * 60 * 1000;

/**
 * Wrong codes an email survives. A million codes and five guesses at
 * each, behind the route's own rate limit, is nothing a script can
 * search; a person who mistypes five times asks for a new one.
 */
export const CODE_ATTEMPTS = 5;

/** Six digits, uniformly, with its leading zeros. */
export function newLoginCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Keyed with the server secret, so a copy of the table cannot be
 * searched offline for the one-in-a-million code that matches.
 */
export function hashLoginCode(email, code, secret = getGeoServerConfig().tokenSecret) {
  // Production without a secret refuses rounds too (config.js); a code
  // keyed with nothing would be searchable offline, so it refuses here.
  if (!secret && process.env.NODE_ENV === 'production') throw new GeoAuthError('not_configured', 'Sign-in is not set up on this server yet.');
  return createHmac('sha256', String(secret || '')).update(`geo-login-code:${normalizeEmail(email)}:${code}`).digest('hex');
}

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
export async function requestSignIn(store, { email: raw, baseUrl, profileId = null, returnTo = '', now = Date.now(), sendImpl, env, secret } = {}) {
  const email = normalizeEmail(raw);
  if (!looksLikeEmail(email)) throw new GeoAuthError('bad_email', 'That does not look like an email address');

  const token = randomBytes(32).toString('base64url');
  const code = newLoginCode();
  await store.createLoginToken({
    tokenHash: hashLoginToken(token),
    codeHash: hashLoginCode(email, code, secret),
    email,
    // Whose profile this browser is playing as, captured now. The link
    // arrives as a plain navigation from a mail client, with no
    // localStorage and no headers, so by the time it is followed there
    // is nothing left to say who asked.
    profileId: profileId || null,
    expiresAt: new Date(now + LINK_TTL_MS),
    createdAt: new Date(now),
  });

  // `returnTo` has already been restricted to an internal game path by
  // the route. Keeping it on the link lets a player come back to the room
  // or screen that asked them to sign in, rather than dropping them on a
  // profile page and making them find their way back.
  const next = returnTo ? `&next=${encodeURIComponent(returnTo)}` : '';
  const url = `${String(baseUrl || '').replace(/\/$/, '')}/api/geo/auth/verify?token=${encodeURIComponent(token)}${next}`;
  const result = await sendSignInEmail({ to: email, url, code, sendImpl, env });
  return { email, sent: result.sent, delivered: Boolean(result.delivered), reason: result.reason || '', url, code };
}

/**
 * Follow a link.
 *
 * Returns the account and the profile now bound to it. Throws
 * GeoAuthError('invalid' | 'expired' | 'used') and nothing else, so the
 * route can say which without leaking whether the address exists.
 */
export async function verifySignIn(store, options = {}) {
  return store.withAccountLock
    ? store.withAccountLock((locked) => completeSignIn(locked, options))
    : completeSignIn(store, options);
}

async function completeSignIn(store, { token, profileToken = '', now = Date.now() } = {}) {
  if (!token || typeof token !== 'string') throw new GeoAuthError('invalid', 'That link is not valid');

  const row = await store.getLoginTokenByHash(hashLoginToken(token));
  if (!row) throw new GeoAuthError('invalid', 'That link is not valid');
  if (row.usedAt) throw new GeoAuthError('used', 'That link has already been used');
  if (new Date(row.expiresAt).getTime() <= now) throw new GeoAuthError('expired', 'That link has expired');

  // Burn it first. A double click on the link in a mail client should
  // not be able to run this twice.
  const burned = await store.useLoginToken(row.id, new Date(now));
  if (!burned) throw new GeoAuthError('used', 'That link has already been used');
  return bindAccount(store, row, { profileToken, now });
}

/**
 * Type the code.
 *
 * Only the newest email for the address counts, so asking for a second
 * email retires the first one's code. Throws GeoAuthError with
 * 'bad_code', 'expired', 'used' or 'too_many', and says nothing about
 * whether an account exists.
 */
export async function verifySignInCode(store, options = {}) {
  // A wrong code is returned out of the lock rather than thrown inside
  // it. The lock is a database transaction, and a throw rolls it back -
  // including the count of wrong guesses, which on PostgreSQL meant the
  // count never moved and the five-guess limit was never reached
  // (caught by __tests__/geo/postgres-release.test.js). Returned, the
  // count commits, and the refusal is thrown after it has.
  const outcome = store.withAccountLock
    ? await store.withAccountLock((locked) => completeCodeSignIn(locked, options))
    : await completeCodeSignIn(store, options);
  if (outcome.refused) throw outcome.refused;
  return outcome;
}

async function completeCodeSignIn(store, { email: raw, code: rawCode, profileToken = '', now = Date.now(), secret } = {}) {
  const email = normalizeEmail(raw);
  const code = String(rawCode || '').replace(/\D/g, '');
  if (!looksLikeEmail(email) || code.length !== 6) throw new GeoAuthError('bad_code', 'Enter the six-digit code from the email.');

  const row = await store.getLatestLoginTokenForEmail(email);
  if (!row || !row.codeHash) throw new GeoAuthError('bad_code', 'That code is not right. Check the newest email, or send a new code.');
  if (row.usedAt) throw new GeoAuthError('used', 'That code has already been used. Send a new one.');
  if (new Date(row.expiresAt).getTime() <= now) throw new GeoAuthError('expired', 'That code has expired. Send a new one.');
  if ((row.codeAttempts || 0) >= CODE_ATTEMPTS) throw new GeoAuthError('too_many', 'Too many wrong codes. Send a new one.');

  if (!sameToken(row.codeHash, hashLoginCode(email, code, secret))) {
    const attempts = await store.countLoginCodeAttempt(row.id);
    if (attempts >= CODE_ATTEMPTS) {
      await store.useLoginToken(row.id, new Date(now));
      return { refused: new GeoAuthError('too_many', 'Too many wrong codes. Send a new one.') };
    }
    return { refused: new GeoAuthError('bad_code', 'That code is not right. Check the newest email, or send a new code.') };
  }

  const burned = await store.useLoginToken(row.id, new Date(now));
  if (!burned) throw new GeoAuthError('used', 'That code has already been used. Send a new one.');
  return bindAccount(store, row, { profileToken, now });
}

/** The account for a redeemed sign-in email, and the profile it plays as. */
async function bindAccount(store, row, { profileToken = '', now = Date.now() } = {}) {
  let account = await store.getAccountByEmail(row.email);
  if (!account) {
    account = await store.createAccount({ email: row.email, createdAt: new Date(now), lastSeenAt: new Date(now) });
  } else {
    // A suspended account does not get a session. The link was real and
    // has now been burned, which is right: a suspended person clicking
    // an old link should not be able to keep clicking it.
    if (account.suspendedAt) throw new GeoAuthError('suspended', 'This account has been suspended');
    await store.updateAccount(account.id, { lastSeenAt: new Date(now) });
  }

  // The account's own profile wins, on every device. An account that
  // already has one is signing in from another browser, and that
  // browser's anonymous profile is left alone rather than bound: a
  // profile's accountId is unique, so binding it was a constraint error,
  // and the sign-in meant to carry the account across devices failed as
  // "unknown". Merging two histories has no right answer (profiles.js).
  let profile = await store.getProfileByAccountId(account.id);
  if (profile) profile = (await store.updateProfile(profile.id, { lastSeenAt: new Date(now) })) || profile;

  // First sign-in: the browser's profile, from the header if a caller
  // had one, else the one recorded when the link was asked for. Without
  // this the player's rating, points and badges were severed from the
  // account on the very first sign-in: resolveProfile found nothing,
  // made a fresh empty profile, and from then on always preferred that one.
  if (!profile && profileToken) ({ profile } = await resolveProfile(store, { token: profileToken, accountId: account.id, now, createIfMissing: false }));
  if (!profile && row.profileId && store.getProfileById) {
    const existing = await store.getProfileById(row.profileId);
    if (existing && !existing.accountId) profile = await store.updateProfile(existing.id, { accountId: account.id, lastSeenAt: new Date(now) });
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

/**
 * Delete an account and the profile bound to it.
 *
 * Everything the game knows about a player hangs off the profile
 * (ratings, points, badges, unlocks, results, room seats, and the rows
 * on the daily and cup boards), and the schema cascades from it, so
 * removing the profile removes them: a deleted player's name and score
 * leave the boards, and the people below move up. The account row and
 * any unspent sign-in links for its address go with it.
 */
export async function deleteAccount(store, { accountId } = {}) {
  if (!accountId) throw new GeoAuthError('invalid', 'No account to delete');
  const account = await store.getAccountById?.(accountId);
  const profile = await store.getProfileByAccountId(accountId);
  if (profile) await store.deleteProfile(profile.id);
  await store.deleteAccount(accountId);
  if (account?.email) await store.deleteLoginTokensForEmail?.(account.email);
  return { deletedProfile: Boolean(profile) };
}
