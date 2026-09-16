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
let lookAroundReady = null;

/**
 * Is the library actually loaded?
 *
 * NOT `Boolean(mapkit.LookAround)`. MapKit defines that name up front
 * as a placeholder whose constructor throws
 *
 *     [MapKit] mapkit.LookAround is available after loading the
 *     following library: look-around.
 *
 * so the symbol is truthy before the library exists. Checking it was
 * how every Apple round on the live site died: the check passed, the
 * load was skipped, and the throw arrived later from Apple's own code
 * where it read as "Apple Look Around did not load".
 *
 * `mapkit.loadedLibraries` is the honest signal. On a build old enough
 * not to have it, nothing is assumed and the library is requested,
 * which is safe: load() is idempotent.
 */
function libraryLoaded(mapkit) {
  const loaded = mapkit?.loadedLibraries;
  return Array.isArray(loaded) && loaded.includes(LIBRARY);
}

export async function ensureLookAround() {
  const mapkit = await initializeMapKit();
  if (libraryLoaded(mapkit)) return mapkit;
  if (!lookAroundReady) {
    if (typeof mapkit.load !== 'function') {
      throw new Error('This MapKit JS build cannot load libraries, so Look Around is unavailable.');
    }
    lookAroundReady = Promise.resolve(mapkit.load(LIBRARY)).then(() => mapkit);
    // A failed load must not be remembered as a failure forever: the
    // next round asks again.
    lookAroundReady.catch(() => {
      lookAroundReady = null;
    });
  }
  await lookAroundReady;
  // Proof, not hope. If Apple resolved the load and still has no usable
  // constructor, say so here rather than letting the placeholder throw
  // from inside openLookAround where the message loses its cause.
  if (!libraryLoaded(mapkit) && !mapkit.LookAround) {
    throw new Error('MapKit JS loaded but Look Around is unavailable in this browser.');
  }
  return mapkit;
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
