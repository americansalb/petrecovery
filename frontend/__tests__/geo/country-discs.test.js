/**
 * No country may produce a radius that is not a number.
 *
 * Natural Earth records Svalbard and Jan Mayen with `area: -1`. The
 * radius was `Math.max(4, Math.sqrt(area / Math.PI) * 1.2)`, which
 * looks floored and is not: Math.max returns NaN if ANY argument is
 * NaN, and sqrt of a negative is NaN.
 *
 * Nothing threw. Every comparison against NaN is false, so the country
 * quietly stopped being playable and its scale quietly stopped
 * counting toward anything that aggregates countries. A bug that
 * announces itself is cheap; this one cost nothing to make and could
 * have sat there forever.
 *
 * So the test is over the WHOLE dataset rather than over Svalbard: the
 * next bad row should fail here rather than in a player's round.
 */

const { countryOptions } = require('@/app/lib/geo/server/countries');
const META = require('@/app/lib/geo/data/countries-meta.json');

describe('every country produces usable geometry', () => {
  const countries = countryOptions();

  test('there are countries to check', () => {
    expect(countries.length).toBeGreaterThan(150);
  });

  test('no country has a non-finite disc radius', () => {
    const broken = countries
      .filter((c) => c.disk)
      .filter((c) => !Number.isFinite(c.disk.radiusKm) || c.disk.radiusKm <= 0)
      .map((c) => `${c.name}: ${c.disk.radiusKm}`);
    expect(broken).toEqual([]);
  });

  test('no country has a non-finite centre', () => {
    const broken = countries
      .filter((c) => c.disk)
      .filter((c) => !Number.isFinite(c.disk.center?.lat) || !Number.isFinite(c.disk.center?.lng))
      .map((c) => c.name);
    expect(broken).toEqual([]);
  });

  test('the row that caused this is still in the data, and still handled', () => {
    // If Natural Earth ever fixes it, this test should be the thing
    // that says so rather than silently passing for a new reason.
    const svalbard = META.find((m) => /Svalbard/.test(m.name));
    expect(svalbard).toBeTruthy();
    expect(svalbard.area).toBeLessThanOrEqual(0);
    const entry = countries.find((c) => /Svalbard/.test(c.name));
    if (entry?.disk) expect(Number.isFinite(entry.disk.radiusKm)).toBe(true);
  });

  test('Math.max does not floor a NaN, which is why the guard moved', () => {
    // Written down because it is the whole mechanism, and because it
    // is the kind of thing that gets "simplified" back.
    expect(Math.max(4, NaN)).toBeNaN();
    expect(Math.max(4, Math.sqrt(-1 / Math.PI) * 1.2)).toBeNaN();
  });
});
