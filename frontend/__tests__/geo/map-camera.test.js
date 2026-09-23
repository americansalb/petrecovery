/**
 * MapKit drops any region set while an animated one is still running
 * (app/geo/lib/mapCamera.js). The fake below does the same, so each
 * test here is a move that the real map would have lost.
 */

import { FLIGHT_MS, cameraFor } from '@/app/geo/lib/mapCamera';

const region = (lat, lng, latSpan, lngSpan) => ({
  center: { latitude: lat, longitude: lng },
  span: { latitudeDelta: latSpan, longitudeDelta: lngSpan },
});

function fakeMap({ clamp = null } = {}) {
  const listeners = new Set();
  let current = region(0, 0, 150, 360);
  const map = {
    get region() { return current; },
    set region(next) {
      map.calls.push([next.span.longitudeDelta, 'set']);
      if (!map.flying) current = next;
    },
    flying: null,
    calls: [],
    setRegionAnimated(next, animate) {
      map.calls.push([next.span.longitudeDelta, animate]);
      // What MapKit does with a move made mid-flight: nothing.
      if (map.flying) return;
      const landed = clamp ? clamp(next) : next;
      if (animate) map.flying = landed;
      else current = landed;
    },
    land() {
      map.landQuietly();
      listeners.forEach((fn) => fn());
    },
    landQuietly() {
      current = map.flying;
      map.flying = null;
    },
    addEventListener: (type, fn) => type === 'region-change-end' && listeners.add(fn),
    removeEventListener: (type, fn) => listeners.delete(fn),
  };
  return map;
}

test('a move while nothing is moving goes straight through', () => {
  const map = fakeMap();
  cameraFor(map).move(region(10, 20, 30, 40), true);
  map.land();
  expect(map.region.span.longitudeDelta).toBe(40);
  expect(map.calls).toEqual([[40, true]]);
});

test('a refit asked for mid-flight is made when the flight ends, not lost', () => {
  // The summary: framed for the wide reveal box, then refitted for the
  // half-width one while the first framing was still moving.
  const map = fakeMap();
  const camera = cameraFor(map);
  camera.move(region(20, 60, 100, 180), true);
  camera.move(region(20, 60, 110, 207), true);
  map.land();
  expect(map.flying.span.longitudeDelta).toBe(207);
  map.land();
  expect(map.region.span.longitudeDelta).toBe(207);
});

test("the next round's world view is not lost behind the reveal's framing", () => {
  const map = fakeMap();
  const camera = cameraFor(map);
  camera.move(region(48, 2, 4, 6), true);
  camera.move(region(20, 0, 150, 360), false);
  expect(map.calls).toEqual([[6, true]]);
  map.land();
  expect(map.region.span.longitudeDelta).toBe(360);
});

test('a region the map cannot show is tried twice at most', () => {
  const map = fakeMap({ clamp: (next) => region(next.center.latitude, next.center.longitude, 80, 200) });
  cameraFor(map).move(region(0, 0, 170, 300), true);
  map.land();
  map.land();
  expect(map.calls).toEqual([[300, true], [300, true]]);
});

test('a flight that never reports its end is over after FLIGHT_MS', () => {
  jest.useFakeTimers();
  try {
    const map = fakeMap();
    const camera = cameraFor(map);
    camera.move(region(0, 0, 10, 10), true);
    camera.move(region(0, 0, 20, 20), true);
    // The first flight never says it has ended.
    map.landQuietly();
    jest.advanceTimersByTime(FLIGHT_MS);
    expect(map.calls.at(-1)).toEqual([20, true]);
  } finally {
    jest.useRealTimers();
  }
});
