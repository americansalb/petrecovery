/**
 * Who is making this request.
 *
 * The last wire out of the game (docs/WANDERGUESSER_SPLIT.md, phase
 * 1.7). Until now this question was answered by the pet site's NextAuth
 * session, which meant a WanderGuesser player was a ReunitePets user.
 * That is no longer true and will not be again: the founder's answer to
 * D1, on 2026-09-10, was that a standalone account means not connected
 * to ReunitePets. So the game answers the question itself.
 *
 * There are two layers, and most players only ever meet the first.
 *
 * 1. **A browser token.** Sent as `x-geo-profile`, minted on first play,
 *    kept in localStorage. It is the whole identity for anonymous play
 *    and it always has been. Nothing here changes it.
 *
 * 2. **An account**, which is an email address and nothing else. Its
 *    only job is to let one person's profile follow them to a second
 *    device and to survive a cleared browser. There is no password to
 *    leak and no profile to fill in.
 *
 * The session is a sealed cookie rather than a table: the same
 * AES-256-GCM envelope the game already uses for round answers
 * (server/tokens.js), holding an account id and an expiry. No session
 * table to sweep, works across instances that share the secret, and the
 * only cost is that signing out on one device does not sign out the
 * others. For a guessing game that is the right trade; if it ever is
 * not, the fix is a token version column on GeoAccount.
 *
 * Server only.
 */

import { getGeoServerConfig } from './config';
import { GeoTokenError, openToken, sealToken } from './tokens';

export const SESSION_COOKIE = 'geo_session';

/**
 * A readable companion to the sealed cookie, holding nothing but "1".
 *
 * The session itself is httpOnly, which is the point of it, so the
 * browser cannot see whether anyone is signed in. The lobby needs to
 * know that much to decide whether to ask the server for a profile, and
 * a whole extra request to find out would be worse than a cookie that
 * carries no secret. Set and cleared alongside the real one.
 */
export const PRESENCE_COOKIE = 'geo_signed_in';

/** Ninety days. Long enough that a casual player stays signed in. */
export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * The answer to "who is this request", and the only shape the rest of
 * the game should use: `{ accountId, email }`, both null when nobody is
 * signed in. Never throws. A tampered or expired cookie is nobody
 * rather than an error, because every caller can serve an anonymous
 * player and none of them should fail on a bad cookie.
 */
export function accountFromRequest(request, { now = Date.now(), env } = {}) {
  const raw = readCookie(request, SESSION_COOKIE);
  if (!raw) return { accountId: null, email: null };
  const { tokenSecret } = getGeoServerConfig(env);
  if (!tokenSecret) return { accountId: null, email: null };
  try {
    const payload = openToken(raw, { secret: tokenSecret, now });
    if (!payload?.a) return { accountId: null, email: null };
    return { accountId: String(payload.a), email: payload.e ? String(payload.e) : null };
  } catch (error) {
    if (!(error instanceof GeoTokenError)) console.error('[geo/identity]', error?.message || error);
    return { accountId: null, email: null };
  }
}

/** The sealed value for the session cookie. */
export function sealSession({ accountId, email }, { now = Date.now(), env } = {}) {
  const { tokenSecret } = getGeoServerConfig(env);
  if (!tokenSecret) throw new Error('Set NEXTAUTH_SECRET or GEO_TOKEN_SECRET before signing anyone in');
  return sealToken({ a: accountId, e: email || '' }, { secret: tokenSecret, ttlMs: SESSION_TTL_MS, now });
}

/** Cookie options. Secure everywhere but a plain-http local server. */
export function sessionCookieOptions({ env = process.env } = {}) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

/** The readable companion: same lifetime, no secret, not httpOnly. */
export function presenceCookieOptions({ env = process.env } = {}) {
  return { ...sessionCookieOptions({ env }), httpOnly: false };
}

/** Put both cookies on a response. */
export function applySession(response, { accountId, email }, { now = Date.now(), env = process.env } = {}) {
  response.cookies.set(SESSION_COOKIE, sealSession({ accountId, email }, { now, env }), sessionCookieOptions({ env }));
  response.cookies.set(PRESENCE_COOKIE, '1', presenceCookieOptions({ env }));
  return response;
}

/** Take both cookies off a response. */
export function clearSession(response, { env = process.env } = {}) {
  const gone = { ...sessionCookieOptions({ env }), maxAge: 0 };
  response.cookies.set(SESSION_COOKIE, '', gone);
  response.cookies.set(PRESENCE_COOKIE, '', { ...gone, httpOnly: false });
  return response;
}

/** Read one cookie from a Request without pulling in a cookie parser. */
export function readCookie(request, name) {
  const header = request?.headers?.get?.('cookie') || '';
  if (!header) return '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return part.slice(eq + 1).trim();
    }
  }
  return '';
}
