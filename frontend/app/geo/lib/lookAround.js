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

/**
 * Is mapkit.LookAround usable?
 *
 * Read in a try/catch, because until the look-around library is loaded
 * MapKit exposes the name as a GETTER THAT THROWS:
 *
 *     get LookAround(){throw gS("LookAround",["look-around"])}
 *
 * Reading it is therefore never a safe truthiness test. But by the time
 * anything here runs, appleMapKit.js has already loaded the library and
 * waited for it, so this is a check rather than a wait.
 */
function lookAroundUsable(mapkit) {
  try {
    return typeof mapkit?.LookAround === 'function';
  } catch {
    return false;
  }
}

/**
 * The library is requested and awaited by initializeMapKit(), because
 * it is one of several this game needs and they are all asked for
 * together (appleMapKit.js, LIBRARIES).
 *
 * This used to do the asking itself, and could not: the game loaded
 * Apple's legacy full bundle, which has no Look Around in it at all and
 * no way to fetch one. Waiting for the getter to stop throwing, which
 * is what this function did before, was waiting for something that
 * never arrives.
 */
export async function ensureLookAround() {
  const mapkit = await initializeMapKit();
  if (!lookAroundUsable(mapkit)) {
    throw new Error('Apple Look Around is unavailable in this browser.');
  }
  return mapkit;
}

/**
 * Create one Look Around view and settle on load or error.
 * Resolves the view; rejects after `timeoutMs` or on the error event.
 */
export function openLookAround(mapkit, container, coordinate, { timeoutMs = PER_CANDIDATE_MS, options = {} } = {}) {
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
    const timer = setTimeout(() => finish(false, timedOut()), timeoutMs);
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
 * fail or the budget runs out. `onAttempt(index)` reports progress.
 *
 * Two failures look the same from here and are not the same thing.
 *
 * A view that fires `error` is Apple saying there is no imagery at
 * that spot. That is ordinary - the sampler picks points on streets it
 * believes are covered, and it is sometimes wrong - and the answer is
 * to try the next one, which costs milliseconds.
 *
 * A view that fires NEITHER `load` nor `error` is the imagery service
 * not answering. Measured against a hanging provider, the old code
 * spent the full per-candidate timeout on all twelve, then let
 * PlayClient auto-retry twice: 5.4 minutes of a loading label over a
 * dead pane with no way out, because nothing was counting the whole
 * job. So there is a budget for the whole job, and the two kinds are
 * told apart on the way out: `kind: 'unresponsive'` never gets
 * auto-retried, because a provider that did not answer twelve times
 * will not answer the thirteenth.
 */
export const PER_CANDIDATE_MS = 4000;
export const FIND_BUDGET_MS = 20000;
/** Long enough that a healthy load never sees it (§ the 4s above). */
export const SLOW_AFTER_MS = 8000;

function timedOut() {
  return Object.assign(new Error('Look Around did not answer in time'), { kind: 'timeout' });
}

export async function findLookAround(mapkit, container, candidates, { onAttempt, shouldStop, budgetMs = FIND_BUDGET_MS, now = () => Date.now() } = {}) {
  const started = now();
  let lastError = null;
  let tried = 0;
  let timeouts = 0;
  for (let index = 0; index < candidates.length; index++) {
    if (shouldStop?.()) throw new Error('cancelled');
    if (tried && now() - started >= budgetMs) break;
    onAttempt?.(index);
    tried++;
    try {
      const view = await openLookAround(mapkit, container, candidates[index]);
      return { view, index };
    } catch (error) {
      lastError = error;
      if (error?.kind === 'timeout') timeouts++;
      container.replaceChildren();
    }
  }
  // Every failure a timeout means the service is not answering at all,
  // which is a different message and must not be retried.
  const unresponsive = tried > 0 && timeouts === tried;
  throw Object.assign(
    new Error(
      unresponsive
        ? 'Apple Look Around is not responding. This is usually the imagery service or the network, not your guess.'
        : 'No Look Around imagery at any of the spots tried.'
    ),
    { kind: unresponsive ? 'unresponsive' : 'no_imagery', tried, timeouts, elapsedMs: now() - started }
  );
}
