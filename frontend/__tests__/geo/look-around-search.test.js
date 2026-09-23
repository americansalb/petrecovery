/** @jest-environment jsdom */

/**
 * Finding a spot with Look Around, without wedging the page.
 *
 * This file used to pin the premise that Apple fires nothing on a spot
 * with no imagery, measured 2026-09-19 and 2026-09-22. The premise was
 * wrong, and the measurement was the bug. Measured again 2026-09-23, on
 * a page with no other view open:
 *
 *   - no imagery: `error`, in 0.6 to 2.4 seconds, every time
 *   - imagery: `load`, in 1.5 to 6 seconds
 *   - a view destroyed (or taken out of the page) before it answers
 *     leaves every later view on that page silent, for good
 *
 * The search used to destroy any spot that had not answered in four
 * seconds. Every slow load was destroyed mid-answer, the page went
 * silent, every spot after it "timed out", and the silence was read as
 * Apple saying nothing on a miss. One round start in five ended on No
 * imagery found about a minute later, on a page where one reload would
 * have played.
 *
 * So the rule these tests hold: a view is never destroyed before it has
 * answered. Misses move on as fast as Apple says so; a slow load is
 * waited for as long as Apple keeps sending it data (on a slow
 * connection, 26 to 41 seconds); a service that sends nothing for
 * STALL_MS stops the search as unresponsive, and its silent view is
 * left to answer.
 */
import {
  findLookAround,
  openLookAround,
  CAP_MS,
  FIND_BUDGET_MS,
  STALL_MS,
} from '@/app/geo/lib/lookAround';

/**
 * A MapKit whose Look Around views answer as scripted. Each entry is
 * 'load' or 'error' (answering after 10ms), 'silent' (never), or
 * { answer, after } for a view that takes its time.
 */
function fakeMapKit(script) {
  const made = [];
  let next = 0;
  return {
    made,
    Coordinate: function Coordinate(lat, lng) { this.lat = lat; this.lng = lng; },
    LookAround: function LookAround() {
      const entry = script[next++] ?? 'silent';
      const { answer, after } = typeof entry === 'string' ? { answer: entry, after: 10 } : entry;
      const listeners = {};
      const view = {
        answered: false,
        destroyed: false,
        destroyedUnanswered: false,
        destroy() {
          this.destroyed = true;
          if (!this.answered) this.destroyedUnanswered = true;
        },
        addEventListener(type, fn) { listeners[type] = fn; },
      };
      made.push(view);
      if (answer !== 'silent') {
        // Apple answers on its own turn, never inside the constructor.
        setTimeout(() => {
          if (view.destroyed) return;
          view.answered = true;
          listeners[answer]?.({ message: 'no imagery' });
        }, after);
      }
      return view;
    },
  };
}

const container = () => ({ replaceChildren: jest.fn(), children: [] });
const spots = (n) => Array.from({ length: n }, (_, i) => ({ lat: i, lng: i }));

/** Run the search to settle, driving the fake clock as it waits. */
async function settle(promise, ms = STALL_MS * 3) {
  const outcome = promise.then((view) => ({ ok: true, view }), (error) => ({ ok: false, error }));
  for (let t = 0; t < ms; t += 250) {
    await jest.advanceTimersByTimeAsync(250);
  }
  return outcome;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('a spot that answers is the round, and nothing else is tried', async () => {
  const mapkit = fakeMapKit(['load']);
  const result = await settle(findLookAround(mapkit, container(), spots(5)));
  expect(result.ok).toBe(true);
  expect(result.view.index).toBe(0);
  expect(mapkit.made).toHaveLength(1);
});

test('a miss says so, and the next spot is tried at once', async () => {
  const mapkit = fakeMapKit([{ answer: 'error', after: 1500 }, { answer: 'error', after: 1500 }, 'load']);
  const started = Date.now();
  const result = await settle(findLookAround(mapkit, container(), spots(5)));
  expect(result.ok).toBe(true);
  expect(result.view.index).toBe(2);
  // Two misses at Apple's pace, not two four-second timeouts.
  expect(mapkit.made).toHaveLength(3);
  expect(Date.now() - started).toBeGreaterThanOrEqual(3000);
});

test('a slow spot is waited for, not thrown away', async () => {
  // Measured: Berlin loaded in 5.7s, Rome in 4.7s. The four-second
  // timeout destroyed both, and wedged the page doing it.
  const mapkit = fakeMapKit([{ answer: 'load', after: 6000 }]);
  const result = await settle(findLookAround(mapkit, container(), spots(5)));
  expect(result.ok).toBe(true);
  expect(result.view.index).toBe(0);
  expect(mapkit.made).toHaveLength(1);
  expect(mapkit.made[0].destroyed).toBe(false);
});

test('no view is ever destroyed before it has answered', async () => {
  const mapkit = fakeMapKit([
    { answer: 'error', after: 900 },
    { answer: 'error', after: 3900 },
    { answer: 'load', after: 5000 },
  ]);
  await settle(findLookAround(mapkit, container(), spots(3)));
  expect(mapkit.made.some((v) => v.destroyedUnanswered)).toBe(false);
});

test('a service that answers nothing stops the search, and its view is left to answer', async () => {
  const mapkit = fakeMapKit(['silent', 'load']);
  const result = await settle(findLookAround(mapkit, container(), spots(5)));
  expect(result.ok).toBe(false);
  expect(result.error.kind).toBe('unresponsive');
  expect(result.error.message).toMatch(/not responding/i);
  // The next view would only have waited behind the silent one.
  expect(mapkit.made).toHaveLength(1);
  // Destroying it would have wedged the page for good.
  expect(mapkit.made[0].destroyed).toBe(false);
});

test('a view that answers after the search gave up on it is destroyed then', async () => {
  const mapkit = fakeMapKit([{ answer: 'load', after: STALL_MS + 4000 }]);
  const outcome = openLookAround(mapkit, container(), { lat: 1, lng: 1 }).then(
    () => 'resolved',
    (error) => error.kind,
  );
  await jest.advanceTimersByTimeAsync(STALL_MS + 1000);
  expect(await outcome).toBe('hang');
  expect(mapkit.made[0].destroyed).toBe(false);
  await jest.advanceTimersByTimeAsync(5000);
  // It answered, so it can go without taking the page with it.
  expect(mapkit.made[0].destroyed).toBe(true);
  expect(mapkit.made[0].destroyedUnanswered).toBe(false);
});

test('the whole search is bounded, however many spots it was handed', async () => {
  const mapkit = fakeMapKit(Array(50).fill({ answer: 'error', after: 1500 }));
  const result = await settle(findLookAround(mapkit, container(), spots(50)));
  expect(result.ok).toBe(false);
  expect(result.error.kind).toBe('no_imagery');
  // The budget, not the list, decides when to stop.
  expect(mapkit.made.length).toBeLessThanOrEqual(Math.ceil(FIND_BUDGET_MS / 1500) + 1);
  expect(result.error.elapsedMs).toBeGreaterThanOrEqual(FIND_BUDGET_MS);
});

test('every view that did not win is destroyed, once it has answered', async () => {
  // WebGL contexts are scarce; a search that leaks them breaks the
  // round it eventually finds.
  const mapkit = fakeMapKit(['error', 'error', 'load']);
  await settle(findLookAround(mapkit, container(), spots(3)));
  expect(mapkit.made.slice(0, 2).every((v) => v.destroyed && !v.destroyedUnanswered)).toBe(true);
  expect(mapkit.made[2].destroyed).toBe(false);
});

test('a search that is called off stops before its next spot', async () => {
  let stop = false;
  const mapkit = fakeMapKit([{ answer: 'error', after: 1000 }, 'load']);
  const outcome = findLookAround(mapkit, container(), spots(3), { shouldStop: () => stop })
    .then(() => 'found', (error) => error.message);
  stop = true;
  await jest.advanceTimersByTimeAsync(2000);
  expect(await outcome).toBe('cancelled');
  // The spot in flight was allowed to answer first.
  expect(mapkit.made).toHaveLength(1);
  expect(mapkit.made[0].destroyedUnanswered).toBe(false);
});

/*
 * Slow is not stuck. Measured on a slow connection (300ms, 1.6 Mbit/s):
 * a panorama took 26 to 41 seconds, with Apple's responses arriving the
 * whole time, never more than 6.2 seconds apart. A fixed timeout either
 * kills those loads or keeps a player waiting on a dead service; the
 * wait ends on Apple's silence instead.
 */
describe('a slow connection', () => {
  /** Apple delivering something every `every` ms, from the start. */
  const steadyTraffic = (every) => {
    const began = Date.now();
    return () => began + Math.floor((Date.now() - began) / every) * every;
  };

  test('a load that takes forty seconds is waited for while Apple keeps sending it data', async () => {
    const mapkit = fakeMapKit([{ answer: 'load', after: 41000 }]);
    const result = await settle(
      findLookAround(mapkit, container(), spots(5), { delivered: steadyTraffic(6000) }),
      60000,
    );
    expect(result.ok).toBe(true);
    expect(result.view.index).toBe(0);
    expect(mapkit.made[0].destroyed).toBe(false);
  });

  test('the same wait on a silent service ends after STALL_MS', async () => {
    const mapkit = fakeMapKit([{ answer: 'load', after: 41000 }]);
    const started = Date.now();
    const result = await settle(findLookAround(mapkit, container(), spots(5), { delivered: () => 0 }), 60000);
    expect(result.ok).toBe(false);
    expect(result.error.kind).toBe('unresponsive');
    expect(result.error.elapsedMs).toBeGreaterThanOrEqual(STALL_MS);
    expect(result.error.elapsedMs).toBeLessThan(STALL_MS + 2000);
    expect(Date.now() - started).toBeGreaterThanOrEqual(STALL_MS);
  });

  test('a trickle that never finishes still ends, at CAP_MS', async () => {
    const mapkit = fakeMapKit(['silent']);
    const result = await settle(
      findLookAround(mapkit, container(), spots(5), { delivered: steadyTraffic(2000) }),
      CAP_MS + 5000,
    );
    expect(result.ok).toBe(false);
    expect(result.error.kind).toBe('unresponsive');
    expect(result.error.elapsedMs).toBeGreaterThanOrEqual(CAP_MS);
    expect(mapkit.made[0].destroyed).toBe(false);
  });
});
