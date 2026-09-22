/** @jest-environment jsdom */

/**
 * Telling "there is no imagery here" apart from "the service is dead".
 *
 * findLookAround had no test, and that is how its central premise
 * rotted without anybody noticing. The premise was: Apple fires `error`
 * on a spot with no imagery, so a candidate that fires NEITHER event
 * can only be the service going silent. On that reading, every attempt
 * timing out meant a dead provider, which earns a different message and
 * is deliberately never auto-retried (PlayClient: an unresponsive
 * provider is not bad luck).
 *
 * Apple does not fire `error` on a miss. Measured against production
 * 2026-09-19 and again 2026-09-22: an ordinary miss fires nothing and
 * burns the whole per-candidate timeout. So five ordinary misses in a
 * row satisfied "every attempt timed out", and a player who had simply
 * been unlucky was told "Apple Look Around is not responding" - about a
 * service that was answering every request - and then denied the retry
 * that would have started their round. One run in eight from the live
 * lobby ended there, while a fresh page seconds later played fine.
 *
 * MapKit's own health is the signal now. appleMapKit.js records Apple's
 * `configuration-change` and `error` events as 'ok' or 'failed', so
 * silence is only silence when MapKit is not healthy.
 */
import {
  findLookAround,
  FIND_BUDGET_MS,
  PER_CANDIDATE_MS,
} from '@/app/geo/lib/lookAround';

/**
 * A MapKit whose Look Around views behave as told: 'load' plays, 'error'
 * is Apple saying no imagery, and 'silent' fires nothing at all, which
 * is both a dead service and - since 2026-09 - an ordinary miss.
 */
function fakeMapKit(script) {
  const made = [];
  let next = 0;
  return {
    made,
    Coordinate: function Coordinate(lat, lng) { this.lat = lat; this.lng = lng; },
    LookAround: function LookAround() {
      const behaviour = script[next++] ?? 'silent';
      const listeners = {};
      const view = {
        destroyed: false,
        destroy() { this.destroyed = true; },
        addEventListener(type, fn) { listeners[type] = fn; },
      };
      made.push(view);
      if (behaviour !== 'silent') {
        // Apple answers on its own turn, not inside the constructor.
        setTimeout(() => listeners[behaviour]?.({ message: 'no imagery' }), 10);
      }
      return view;
    },
  };
}

const container = () => ({ replaceChildren: jest.fn(), children: [] });
const spots = (n) => Array.from({ length: n }, (_, i) => ({ lat: i, lng: i }));

/** Run the search to settle, driving the fake clock as it waits. */
async function settle(promise) {
  const outcome = promise.then((view) => ({ ok: true, view }), (error) => ({ ok: false, error }));
  for (let i = 0; i < 40; i++) {
    await jest.advanceTimersByTimeAsync(PER_CANDIDATE_MS);
  }
  return outcome;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('a spot that answers is the round, and nothing else is tried', async () => {
  const mapkit = fakeMapKit(['load']);
  const result = await settle(
    findLookAround(mapkit, container(), spots(5), { auth: () => 'ok' }),
  );
  expect(result.ok).toBe(true);
  expect(result.view.index).toBe(0);
  expect(mapkit.made).toHaveLength(1);
});

test('misses that say nothing are misses, while MapKit is healthy', async () => {
  // This is the live case: Apple answers every request and simply has
  // no imagery at the spots picked, firing neither event.
  const mapkit = fakeMapKit(['silent', 'silent', 'silent', 'silent', 'silent']);
  const result = await settle(
    findLookAround(mapkit, container(), spots(5), { auth: () => 'ok' }),
  );
  expect(result.ok).toBe(false);
  // no_imagery is the retryable one. imagery_unresponsive is the dead
  // end, and it is what this used to be.
  expect(result.error.kind).toBe('no_imagery');
  expect(result.error.message).not.toMatch(/not responding/i);
});

test('the same silence with MapKit unhealthy is still a dead service', async () => {
  const mapkit = fakeMapKit(['silent', 'silent', 'silent', 'silent', 'silent']);
  const result = await settle(
    findLookAround(mapkit, container(), spots(5), { auth: () => 'failed' }),
  );
  expect(result.ok).toBe(false);
  expect(result.error.kind).toBe('unresponsive');
  expect(result.error.message).toMatch(/not responding/i);
});

test('an unanswered MapKit is not treated as healthy either', async () => {
  const mapkit = fakeMapKit(['silent', 'silent']);
  const result = await settle(
    findLookAround(mapkit, container(), spots(2), { auth: () => 'pending' }),
  );
  expect(result.error.kind).toBe('unresponsive');
});

test('a spot Apple refuses outright is a miss whatever MapKit says', async () => {
  const mapkit = fakeMapKit(['error', 'error', 'load']);
  const result = await settle(
    findLookAround(mapkit, container(), spots(3), { auth: () => 'failed' }),
  );
  expect(result.ok).toBe(true);
  expect(result.view.index).toBe(2);
});

test('the whole search is bounded, however many spots it was handed', async () => {
  const mapkit = fakeMapKit(Array(50).fill('silent'));
  const result = await settle(
    findLookAround(mapkit, container(), spots(50), { auth: () => 'ok' }),
  );
  expect(result.ok).toBe(false);
  // The budget, not the list, decides when to stop.
  expect(mapkit.made.length).toBeLessThanOrEqual(Math.ceil(FIND_BUDGET_MS / PER_CANDIDATE_MS) + 1);
  expect(result.error.elapsedMs).toBeGreaterThanOrEqual(FIND_BUDGET_MS);
});

test('every view that did not win is destroyed', async () => {
  // WebGL contexts are scarce; a search that leaks them breaks the
  // round it eventually finds.
  const mapkit = fakeMapKit(['error', 'error', 'load']);
  await settle(findLookAround(mapkit, container(), spots(3), { auth: () => 'ok' }));
  expect(mapkit.made.slice(0, 2).every((v) => v.destroyed)).toBe(true);
  expect(mapkit.made[2].destroyed).toBe(false);
});
