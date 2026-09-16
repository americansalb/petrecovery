'use client';

/**
 * Apple Look Around for the game.
 *
 * MapKit JS has no "is there imagery here?" call, so the only way to
 * find a playable spot is to create a Look Around view and wait for its
 * load or error event. The server hands us a short ordered list of
 * candidate coordinates; we try them one at a time, destroying each
 * failed view before the next (WebGL contexts are scarce).
 *
 * The site-wide loader pulls the full MapKit bundle, which does not
 * include the Look Around library, so we ask for it explicitly.
 */

import { initializeMapKit } from './appleMapKit';

const LIBRARY = 'look-around';
/** How long loadAll() gets before we call it a failure. */
const LIBRARY_TIMEOUT_MS = 12000;
const PROBE_MS = 100;

let lookAroundReady = null;

/**
 * Is mapkit.LookAround usable yet?
 *
 * It has to be asked in a try/catch, because on MapKit's side it is a
 * GETTER THAT THROWS until its module has loaded:
 *
 *     get FeatureVisibility(){throw gS("FeatureVisibility",["map","look-around"])}
 *
 * so merely reading `mapkit.LookAround` raises
 *
 *     [MapKit] mapkit.LookAround is available after loading the
 *     following library: look-around.
 *
 * That is the whole bug, and it is worth writing down because two
 * plausible readings of it are both wrong:
 *
 *   - It is not a truthy placeholder. `if (mapkit.LookAround)` does not
 *     take the wrong branch, it THROWS, and the throw travels up as
 *     "Apple Look Around did not load".
 *   - It is not a missing load call. This bundle is
 *     cdn.apple-mapkit.com/mk/5.x.x/mapkit.js, the legacy full bundle,
 *     which deletes `mapkit.load`, stubs `loadLibraries` to a console
 *     warning, leaves `loadedLibraries` an empty getter returning
 *     undefined, and calls `loadAll()` itself. Everything is already
 *     being loaded. Asking for it again is impossible and unnecessary.
 *
 * What is actually wrong is timing: loadAll() is asynchronous and the
 * first round asks before it lands. So the only correct thing to do is
 * wait for the getter to stop throwing.
 */
function lookAroundUsable(mapkit) {
  try {
    return typeof mapkit?.LookAround === 'function';
  } catch {
    return false;
  }
}

export async function ensureLookAround() {
  const mapkit = await initializeMapKit();
  if (lookAroundUsable(mapkit)) return mapkit;
  if (!lookAroundReady) {
    lookAroundReady = new Promise((resolve, reject) => {
      const deadline = Date.now() + LIBRARY_TIMEOUT_MS;
      // Some builds do expose a real loader. Use it when it is there,
      // ignore it when it is the legacy bundle's warning stub, and wait
      // either way: this bundle is loading the library regardless.
      try {
        if (typeof mapkit.loadLibraries === 'function') mapkit.loadLibraries([LIBRARY]);
        else if (typeof mapkit.load === 'function') mapkit.load(LIBRARY);
      } catch {
        /* the stub, or a build that does not want to be asked */
      }
      const tick = () => {
        if (lookAroundUsable(mapkit)) {
          resolve(mapkit);
          return;
        }
        if (Date.now() >= deadline) {
          reject(new Error('Apple Look Around did not finish loading. Try again, or play on Google Street View.'));
          return;
        }
        setTimeout(tick, PROBE_MS);
      };
      tick();
    });
    // A timeout must not be remembered as permanent: the next round asks
    // again, by which time loadAll() has almost certainly finished.
    lookAroundReady.catch(() => {
      lookAroundReady = null;
    });
  }
  return lookAroundReady;
}

/**
 * Create one Look Around view and settle on load or error.
 * Resolves the view; rejects after `timeoutMs` or on the error event.
 */
export function openLookAround(mapkit, container, coordinate, { timeoutMs = 9000, options = {} } = {}) {
  return new Promise((resolve, reject) => {
    let view;
    let settled = false;
    const finish = (ok, payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (ok) resolve(payload);
      else {
        try {
          view?.destroy?.();
        } catch {
          /* already gone */
        }
        reject(payload);
      }
    };
    const timer = setTimeout(() => finish(false, new Error('Look Around did not load in time')), timeoutMs);
    try {
      view = new mapkit.LookAround(container, new mapkit.Coordinate(coordinate.lat, coordinate.lng), {
        showsDialogControl: false,
        showsCloseControl: false,
        ...options,
      });
    } catch (error) {
      finish(false, error);
      return;
    }
    view.addEventListener('load', () => finish(true, view));
    view.addEventListener('error', (event) => finish(false, new Error(event?.message || 'No Look Around imagery here')));
  });
}

/**
 * Try candidates in order. Resolves { view, index }; rejects when all
 * fail. `onAttempt(index)` reports progress for the loading screen.
 */
export async function findLookAround(mapkit, container, candidates, { onAttempt, shouldStop } = {}) {
  let lastError = null;
  for (let index = 0; index < candidates.length; index++) {
    if (shouldStop?.()) throw new Error('cancelled');
    onAttempt?.(index);
    try {
      const view = await openLookAround(mapkit, container, candidates[index]);
      return { view, index };
    } catch (error) {
      lastError = error;
      container.replaceChildren();
    }
  }
  throw lastError || new Error('No Look Around imagery at any of the candidate spots');
}
