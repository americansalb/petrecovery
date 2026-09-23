/**
 * Where an Apple round lands, and why it is not the textbook answer.
 *
 * Measured on the live site before this: a Street round took a median of
 * 11.7 seconds to start, and one run in four had not started after 45.
 * The cause was not the network and not Apple being slow. It was the
 * draw: randomPointInDisk was uniform over the disk's AREA, which puts
 * three points in four beyond half the radius. For a city with a median
 * 8km radius that is 4-8km out, which is suburbs, countryside and water,
 * where Look Around stops. Each miss cost a four-second browser timeout
 * then (PER_CANDIDATE_MS, since found to be the bigger problem and
 * replaced: lib/lookAround.js, STALL_MS), and the whole search gives up
 * at FIND_BUDGET_MS.
 *
 * So the spot is drawn toward the middle of the city now. The edge is
 * still reachable - a round in an outer suburb is still possible - it is
 * just no longer the common case.
 */
const { randomPointInDisk } = require('@/app/lib/geo/random');
const { APPLE_SPREAD } = require('@/app/lib/geo/server/sampler');

const CENTRE = { lat: 48.8566, lng: 2.3522 };
const RADIUS = 8;

/** Fraction of draws landing beyond half the radius, by the km it moved. */
function beyondHalf(spread, n = 20000) {
  let far = 0;
  for (let i = 0; i < n; i++) {
    const p = randomPointInDisk(Math.random, CENTRE, RADIUS, spread === null ? undefined : { spread });
    const dLat = (p.lat - CENTRE.lat) * 110.574;
    const dLng = (p.lng - CENTRE.lng) * 111.32 * Math.cos((CENTRE.lat * Math.PI) / 180);
    if (Math.sqrt(dLat * dLat + dLng * dLng) > RADIUS / 2) far++;
  }
  return far / n;
}

test('the default is still uniform over the area, for callers that want that', () => {
  // countries.js draws a country point with it and must not move.
  expect(beyondHalf(null)).toBeGreaterThan(0.72);
  expect(beyondHalf(null)).toBeLessThan(0.78);
});

test('an Apple city spot lands well inside the covered part of the city', () => {
  const far = beyondHalf(APPLE_SPREAD);
  // Uniform-over-area was 75%. Anything near that is the old behaviour back.
  expect(far).toBeLessThan(0.45);
  // And not so tight that every round is the same few streets downtown.
  expect(far).toBeGreaterThan(0.25);
});

test('the edge of the city is still reachable', () => {
  let maxFraction = 0;
  for (let i = 0; i < 20000; i++) {
    const p = randomPointInDisk(Math.random, CENTRE, RADIUS, { spread: APPLE_SPREAD });
    const dLat = (p.lat - CENTRE.lat) * 110.574;
    const dLng = (p.lng - CENTRE.lng) * 111.32 * Math.cos((CENTRE.lat * Math.PI) / 180);
    maxFraction = Math.max(maxFraction, Math.sqrt(dLat * dLat + dLng * dLng) / RADIUS);
  }
  expect(maxFraction).toBeGreaterThan(0.9);
});

test('every draw is still inside the disk', () => {
  for (let i = 0; i < 5000; i++) {
    const p = randomPointInDisk(Math.random, CENTRE, RADIUS, { spread: APPLE_SPREAD });
    const dLat = (p.lat - CENTRE.lat) * 110.574;
    const dLng = (p.lng - CENTRE.lng) * 111.32 * Math.cos((CENTRE.lat * Math.PI) / 180);
    expect(Math.sqrt(dLat * dLat + dLng * dLng)).toBeLessThanOrEqual(RADIUS + 1e-6);
  }
});

test('the loading label does not promise spots the budget will not buy', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.resolve(__dirname, '../..', 'app/geo/components/LoadingSpot.js'), 'utf8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
  // The search stops at FIND_BUDGET_MS, or at the first spot that never
  // answers, well before the twelve the candidate list holds.
  expect(code).not.toMatch(/of \$\{appleTotal\}/);
});
