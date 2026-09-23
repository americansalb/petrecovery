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
 * Resolves the view on `load`; rejects on `error`, or with
 * `kind: 'hang'` once Apple has delivered nothing for `stallMs` (or the
 * view has not answered in `capMs`).
 *
 * A view is never destroyed before it has answered (STALL_MS says why).
 * One that errors is destroyed at once, which is safe: it has answered.
 * One that hangs is left alone, and destroyed only if it does answer
 * later, so a service that stalls and recovers leaves the page healthy.
 */
export function openLookAround(
  mapkit,
  container,
  coordinate,
  { stallMs = STALL_MS, capMs = CAP_MS, delivered = lastAppleDelivery, now = () => Date.now(), options = {} } = {}
) {
  return new Promise((resolve, reject) => {
    let view;
    let settled = false;
    let abandoned = false;
    const began = now();
    delivered();
    const release = () => {
      try {
        view?.destroy?.();
      } catch {
        /* already gone */
      }
    };
    const answer = (ok, payload) => {
      // A late answer to a view the search already gave up on: now that
      // it has answered it can go without taking the page with it.
      if (abandoned) {
        release();
        return;
      }
      if (settled) return;
      settled = true;
      clearInterval(watch);
      if (ok) resolve(payload);
      else {
        release();
        reject(payload);
      }
    };
    // Slow is not stuck. On a slow connection a panorama takes half a
    // minute and Apple's responses keep arriving the whole time; a dead
    // service sends nothing. So the clock that ends the wait restarts
    // with every response from Apple, and only silence runs it out.
    const watch = setInterval(() => {
      if (settled) return;
      const t = now();
      if (t - Math.max(began, delivered()) < stallMs && t - began < capMs) return;
      settled = true;
      abandoned = true;
      clearInterval(watch);
      reject(hung());
    }, CHECK_MS);
    try {
      view = new mapkit.LookAround(container, new mapkit.Coordinate(coordinate.lat, coordinate.lng), {
        showsDialogControl: false,
        showsCloseControl: false,
        ...options,
      });
    } catch (error) {
      settled = true;
      clearInterval(watch);
      reject(error);
      return;
    }
    view.addEventListener('load', () => answer(true, view));
    view.addEventListener('error', (event) => answer(false, new Error(event?.message || 'No Look Around imagery here')));
  });
}

/**
 * How long Apple may send this page nothing, while a spot has not
 * answered, before the service is called hung. It is not a time to give
 * up on a spot and try the next.
 *
 * That is what it used to be: PER_CANDIDATE_MS, four seconds per spot,
 * and it was the bug behind nearly every round that never started.
 * Measured on production 2026-09-23:
 *
 *   - A spot with no imagery fires `error` in 0.6 to 2.4 seconds: the
 *     Atlantic, the Sahara, rural Kansas, Lake Michigan, the hills
 *     outside Tokyo. On a slow connection too, about 1.7 seconds.
 *   - A spot with imagery fires `load` in 1.5 to 6 seconds on a fast
 *     connection, and in 26 to 41 seconds on a slow one (300ms, 1.6
 *     Mbit/s), with Apple's responses arriving throughout: 19 to 28 of
 *     them, never more than 6.2 seconds apart.
 *   - A view destroyed before it has fired either wedges MapKit's Look
 *     Around for the rest of the page. Every view after it, on any
 *     element, fires nothing at all: a known-good Rome and a known-empty
 *     Sahara alike, fifteen seconds each, with a pause in between or
 *     without. A view destroyed after it has answered harms nothing.
 *   - MapKit runs one view at a time. A second view made while the
 *     first is alive waits, and answers once the first has answered
 *     and been destroyed.
 *
 * So the four-second timeout destroyed every load slower than four
 * seconds, wedged the page, and every spot after it timed out too. That
 * silence is what was measured on 2026-09-19 and 2026-09-22 and read as
 * "Apple fires nothing on a miss". It is also why the round ended on No
 * imagery found about a minute later (three attempts of five spots at
 * four seconds each), and why a fresh page loaded seconds afterwards
 * played normally: a fresh page has a fresh MapKit. On the slow
 * connection above it ended that way every time: 8 round starts out of
 * 8, each after about 84 seconds.
 */
export const STALL_MS = 15000;
/** A load that is still trickling in after this is not going to play. */
export const CAP_MS = 120000;
const CHECK_MS = 1000;
/** How long the search keeps drawing new spots. A miss costs about 1.5s. */
export const FIND_BUDGET_MS = 20000;
/** Long enough that a healthy fast load never sees it. */
export const SLOW_AFTER_MS = 8000;

/*
 * When Apple last delivered something to this page: the end of the
 * latest response from an apple-mapkit.com host, read from Resource
 * Timing, which sees the imagery and tile requests MapKit makes (measured:
 * the same 19 requests the browser's own network log showed for one
 * load). The analytics beacon is not imagery and does not count.
 */
let lastDelivery = 0;
let watching = false;

function watchDeliveries() {
  if (watching || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        let url;
        try {
          url = new URL(entry.name);
        } catch {
          continue;
        }
        if (!/(^|\.)apple-mapkit\.com$/.test(url.hostname) || url.pathname.includes('reportAnalytics')) continue;
        lastDelivery = Math.max(lastDelivery, Math.round(performance.timeOrigin + entry.responseEnd));
      }
    }).observe({ type: 'resource', buffered: true });
    watching = true;
  } catch {
    /* no Resource Timing here: CAP_MS alone ends a wait */
  }
}

/** When Apple last delivered imagery or tiles to this page (epoch ms, 0 if never). */
export function lastAppleDelivery() {
  watchDeliveries();
  return lastDelivery;
}

function hung() {
  return Object.assign(new Error('Look Around did not answer'), { kind: 'hang' });
}

/**
 * Try candidates in order. Resolves { view, index }; rejects when all
 * fail, the budget runs out, or the service stops answering.
 * `onAttempt(index)` reports progress.
 *
 * A spot with no imagery fires `error`, quickly, and the answer is the
 * next spot. A spot that is still loading is waited for, however long
 * it takes, while Apple keeps sending it data. A spot left waiting on a
 * silent service for STALL_MS is a service that has stopped answering,
 * and the search stops there: the next view would only wait behind the
 * silent one, and destroying the silent one to make room would wedge
 * the page. `kind: 'unresponsive'` is never
 * auto-retried by PlayClient; its Try again reloads the page, which is
 * the one thing that gives MapKit a fresh start.
 */
export async function findLookAround(
  mapkit,
  container,
  candidates,
  { onAttempt, shouldStop, budgetMs = FIND_BUDGET_MS, stallMs = STALL_MS, capMs = CAP_MS, delivered = lastAppleDelivery, now = () => Date.now() } = {}
) {
  const started = now();
  let tried = 0;
  for (let index = 0; index < candidates.length; index++) {
    if (shouldStop?.()) throw new Error('cancelled');
    if (tried && now() - started >= budgetMs) break;
    onAttempt?.(index);
    tried++;
    try {
      const view = await openLookAround(mapkit, container, candidates[index], { stallMs, capMs, delivered, now });
      return { view, index };
    } catch (error) {
      if (error?.kind === 'hang') {
        throw Object.assign(
          new Error('Apple Look Around is not responding. This is usually the imagery service or the network, not your guess.'),
          { kind: 'unresponsive', tried, elapsedMs: now() - started }
        );
      }
      container.replaceChildren();
    }
  }
  throw Object.assign(new Error('No Look Around imagery at any of the spots tried.'), {
    kind: 'no_imagery',
    tried,
    elapsedMs: now() - started,
  });
}
