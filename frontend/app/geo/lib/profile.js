'use client';

/**
 * Your rating profile from the browser's side. The token from the first
 * /api/geo/profile call is kept here and sent with room joins so the
 * finished game rates the right person. Signed-in players are matched
 * by account on the server, so the token is a convenience for them.
 */

const KEY = 'geo:profile:v1';

export function loadProfileToken() {
  try {
    return window.localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function saveProfileToken(token) {
  try {
    if (token) window.localStorage.setItem(KEY, token);
  } catch {
    /* storage unavailable */
  }
}

/** Headers that identify this browser's profile, if it has one. */
export function profileHeaders() {
  const token = typeof window !== 'undefined' ? loadProfileToken() : '';
  return token ? { 'x-geo-profile': token } : {};
}

/**
 * Register or refresh the profile and return its summary
 * ({ id, name, ratings, recent }). Never throws on a missing storage;
 * throws on a server error so callers can decide to play unrated.
 */
export async function ensureProfile(name) {
  const res = await fetch('/api/geo/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...profileHeaders() },
    body: JSON.stringify({ name: name || '' }),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Could not load your profile');
  if (json.token) saveProfileToken(json.token);
  return json.profile;
}
