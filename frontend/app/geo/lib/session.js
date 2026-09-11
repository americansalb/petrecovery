'use client';

/**
 * Whether this browser is signed in to the game.
 *
 * The real session cookie is httpOnly, so the browser cannot read it.
 * It is set alongside a readable companion holding nothing but "1"
 * (app/lib/geo/server/identity.js), and that is what this reads. It
 * says "there is a session cookie", not "the session is valid": only
 * the server can know that, and every endpoint checks. This is for
 * deciding what to render, never for deciding what to allow.
 */

export const PRESENCE_COOKIE = 'geo_signed_in';

export function isSignedIn() {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((part) => part.trim().startsWith(`${PRESENCE_COOKIE}=1`));
}
