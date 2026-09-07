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

import { initializeMapKit } from '@/app/lib/maps/appleMapKit';

let lookAroundReady = null;

export async function ensureLookAround() {
  const mapkit = await initializeMapKit();
  if (mapkit.LookAround) return mapkit;
  if (!lookAroundReady) {
    if (typeof mapkit.load !== 'function') {
      throw new Error('This MapKit JS build has no Look Around library. Load mapkit.core.js with the look-around library.');
    }
    lookAroundReady = Promise.resolve(mapkit.load('look-around')).then(() => mapkit);
  }
  await lookAroundReady;
  if (!mapkit.LookAround) throw new Error('MapKit JS loaded but Look Around is unavailable in this browser.');
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
