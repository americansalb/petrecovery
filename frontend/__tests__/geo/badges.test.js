/**
 * Badge progress, with the three cases that were wrong in the profile's
 * JSX and that no browser scenario can reach: a player holding Mars,
 * and a player holding badges from the coverage the game used to have.
 *
 * A Not Earth round is a 0.5% chance and the Google era is over, so
 * building those profiles in a harness run is not a test, it is a wait.
 * The counting is a pure function for exactly that reason.
 */

const { countryBadgeProgress, playableCountryCodes } = require('@/app/lib/geo/badges');
const { APPLE_COVERAGE } = require('@/app/lib/geo/coverage');

const country = (code) => ({ countryCode: code, notEarth: false });
const mars = { countryCode: 'XM', notEarth: true };
const moon = { countryCode: 'XL', notEarth: true };
const POOL = playableCountryCodes('apple');

test('the denominator is the countries a round can drop you in', () => {
  expect(POOL.size).toBeGreaterThan(10);
  // Every playable country is one Apple has coverage for.
  for (const code of POOL) expect({ code, covered: APPLE_COVERAGE.has(code) }).toEqual({ code, covered: true });
});

test('Mars and the Moon are not countries', () => {
  const progress = countryBadgeProgress([country('FR'), country('JP'), mars, moon], POOL);
  expect(progress).toEqual({ earned: 2, total: POOL.size, elsewhere: 0, show: true });
});

test('a badge for a country the game no longer visits is not counted in', () => {
  // The city list holds 56 countries; 23 are playable on Apple. A
  // player who earned Cairo or Havana while the game ran on Google
  // still holds those rows, and counting them printed "40 of 23".
  const gone = ['EG', 'CU', 'CN', 'BR', 'MX'].filter((code) => !POOL.has(code));
  expect(gone.length).toBeGreaterThan(0);
  const progress = countryBadgeProgress([country('FR'), ...gone.map(country)], POOL);
  expect(progress.earned).toBe(1);
  expect(progress.elsewhere).toBe(gone.length);
  expect(progress.earned).toBeLessThanOrEqual(progress.total);
});

test('those badges are reported, not silently dropped', () => {
  // They are real badges for real places. Counting them in lies about
  // the pool; dropping them lies about the player.
  const gone = ['EG', 'CU'].filter((code) => !POOL.has(code));
  expect(countryBadgeProgress(gone.map(country), POOL)).toEqual({
    earned: 0,
    total: POOL.size,
    elsewhere: gone.length,
    show: true,
  });
});

test('a player whose only badge is Mars is shown zero countries, not nothing', () => {
  expect(countryBadgeProgress([mars], POOL)).toEqual({ earned: 0, total: POOL.size, elsewhere: 0, show: true });
});

test('a player with no badges at all is shown no progress line', () => {
  for (const empty of [[], undefined, null]) expect(countryBadgeProgress(empty, POOL).show).toBe(false);
});

test('the numerator can never exceed the denominator, whatever the profile holds', () => {
  // Every code the city list has ever awarded, both worlds, and a
  // duplicate run of the playable ones for good measure.
  const { CITIES } = require('@/app/lib/geo/coverage');
  const everyCode = [...new Set(CITIES.map((c) => c.country))];
  const progress = countryBadgeProgress([...everyCode.map(country), mars, moon], POOL);
  expect(progress.earned).toBe(POOL.size);
  expect(progress.earned).toBeLessThanOrEqual(progress.total);
  expect(progress.elsewhere).toBe(everyCode.length - POOL.size);
});
