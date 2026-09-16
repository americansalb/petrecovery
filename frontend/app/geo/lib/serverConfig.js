'use client';

/**
 * /api/geo/config: what every screen needs before it can do anything.
 *
 * It says whether the imagery is set up, what today's daily seed is,
 * and the country list the pickers are built from. The lobby greys its
 * start buttons until it arrives, so a screen without it is a screen
 * that does nothing.
 *
 * Two things were wrong with fetching it directly.
 *
 * **It was one fetch with a catch.** One blip, one cold start, one
 * request that lost a race with a deploy, and the screen sat with every
 * button dead and no way forward but a reload the player had no reason
 * to think of. A first request to a sleeping instance is exactly that
 * case, so it is not a rare one.
 *
 * **Every screen asked again.** The answer changes when the site is
 * deployed and at no other time, but moving lobby to play to summary to
 * lobby asked for it four times. That is per person, per navigation,
 * against a bucket of 30 a minute per address (app/lib/geo/site.js) -
 * and a household or an office behind one address shares that bucket.
 * The end-to-end harness, which is one address opening twenty pages,
 * hit the limit every run; a family would too.
 *
 * So: cached for the session, retried when it fails, and never retried
 * when the answer was "too fast", which is the one failure another
 * request cannot help.
 */

const KEY = 'geo:config:v1';
const FRESH_MS = 5 * 60 * 1000;
const TRIES = 3;
const BACKOFF_MS = [400, 1200];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Session storage is absent in a private window and throws in some. */
function readCache() {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (!data || !Number.isFinite(at) || Date.now() - at > FRESH_MS) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* a browser that will not store it still plays */
  }
}

/** After a deploy, or when a screen wants the truth rather than the copy. */
export function forgetGeoConfig() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to forget */
  }
}

export class GeoConfigError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

/**
 * The config, from the session's copy or from the server. Returns null
 * if `shouldStop` says the screen went away. Throws GeoConfigError
 * after the last try.
 */
export async function loadGeoConfig({ shouldStop = () => false, fetchImpl = fetch, force = false } = {}) {
  if (!force) {
    const cached = readCache();
    if (cached) return cached;
  }
  let last = null;
  for (let attempt = 0; attempt < TRIES; attempt++) {
    if (attempt > 0) {
      await wait(BACKOFF_MS[attempt - 1] ?? 1200);
      if (shouldStop()) return null;
    }
    try {
      const res = await fetchImpl('/api/geo/config', { cache: 'no-store' });
      if (shouldStop()) return null;
      if (res.status === 429) {
        // Asking again is the one thing that cannot help, and it takes
        // the bucket further from recovering.
        throw new GeoConfigError('rate_limited', RATE_LIMITED_ERROR);
      }
      if (!res.ok) throw new GeoConfigError('http', `config ${res.status}`);
      const data = await res.json();
      writeCache(data);
      return data;
    } catch (error) {
      last = error;
      if (shouldStop()) return null;
      if (error instanceof GeoConfigError && error.code === 'rate_limited') throw error;
    }
  }
  throw last instanceof GeoConfigError ? last : new GeoConfigError('unreachable', CONFIG_ERROR);
}

/** What a screen says when it could not be loaded. */
export const CONFIG_ERROR = 'Could not load the game settings from the server.';
export const RATE_LIMITED_ERROR = 'That is a lot of requests from this connection. Give it a minute and try again.';

/** The words for a failure, whichever kind it was. */
export function configErrorMessage(error) {
  return error?.code === 'rate_limited' ? RATE_LIMITED_ERROR : CONFIG_ERROR;
}
