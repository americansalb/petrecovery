/**
 * Access control for the family task force board (/rasuwa/team).
 *
 * The board is for a closed group in a crisis, most of them not
 * technical, many on shared phones. Accounts would lose people at the
 * signup screen, so access is one shared code passed around the family
 * group chats, plus the name the person types for themselves. The code
 * is a gate against strangers, not a security boundary: nothing on the
 * board grants access to anything else on the site.
 *
 * The cookie proves "entered the code once": its value is an HMAC over
 * the configured code, so it cannot be minted without knowing the code
 * (or the server secret), and rotating RASUWA_TEAM_CODE invalidates
 * every cookie at once. No name, no identity, nothing readable inside.
 *
 * Server-only: crypto and env access. The client never sees the code
 * after the join screen.
 */

import crypto from 'crypto';

export const TEAM_COOKIE = 'rasuwa_team';
export const TEAM_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** Codes compare case-insensitively with whitespace folded: a person
 *  typing "  Timure " on a phone keyboard must not be turned away. */
export function normalizeTeamCode(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The configured code, or '' when the board is not set up. Production
 * requires RASUWA_TEAM_CODE (there is no default a stranger could
 * guess from the source); development and tests fall back to a fixed
 * code so the board runs locally with no setup.
 */
export function configuredTeamCode() {
  const configured = normalizeTeamCode(process.env.RASUWA_TEAM_CODE);
  if (configured) return configured;
  return process.env.NODE_ENV === 'production' ? '' : 'timure';
}

function hmacSecret() {
  return process.env.NEXTAUTH_SECRET || 'rasuwa-team-local';
}

/** The cookie value for the configured code. */
export function teamCookieValue(code) {
  return crypto.createHmac('sha256', hmacSecret()).update(`rasuwa-team-v1:${code}`).digest('hex');
}

function timingSafeHexEqual(a, b) {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    return bufA.length === bufB.length && bufA.length > 0 && crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/** Does the entered code match the configured one? Constant-time. */
export function codeMatches(entered) {
  const code = configuredTeamCode();
  if (!code) return false;
  const hash = (v) => crypto.createHash('sha256').update(v).digest('hex');
  return timingSafeHexEqual(hash(normalizeTeamCode(entered)), hash(code));
}

/** True when the request carries a valid board cookie. */
export function hasTeamCookie(request) {
  const code = configuredTeamCode();
  if (!code) return false;
  const value = request.cookies?.get?.(TEAM_COOKIE)?.value || '';
  return timingSafeHexEqual(value, teamCookieValue(code));
}

/** Cookie attributes for NextResponse.cookies.set. */
export function teamCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TEAM_COOKIE_MAX_AGE,
    path: '/',
  };
}
