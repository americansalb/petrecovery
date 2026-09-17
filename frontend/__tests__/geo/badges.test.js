/**
 * Badge progress, with the two cases that were wrong in the profile's
 * JSX and that no browser scenario could reach: a player holding Mars
 * or the Moon.
 *
 * A Not Earth round is a 0.5% chance, so earning one in a harness run
 * is not a test, it is a wait. The counting is a pure function for
 * exactly that reason.
 */

const { countryBadgeProgress, playableCountries } = require('@/app/lib/geo/badges');

const country = (code) => ({ countryCode: code, notEarth: false });
const mars = { countryCode: 'XM', notEarth: true };
const moon = { countryCode: 'XL', notEarth: true };

test('the denominator is the countries a round can drop you in', () => {
  const total = playableCountries('apple');
  expect(total).toBeGreaterThan(10);
  expect(total).toBeLessThan(200);
});

test('Mars and the Moon are not countries', () => {
  // The bug: badges.length against a street-pool denominator, so a
  // player holding both could be shown 24 of 23.
  const progress = countryBadgeProgress([country('FR'), country('JP'), mars, moon], 23);
  expect(progress).toEqual({ earned: 2, total: 23, show: true });
  expect(progress.earned).toBeLessThanOrEqual(progress.total);
});

test('a player whose only badge is Mars is shown zero countries, not nothing', () => {
  // The second bug: hiding the line when the country count is zero
  // blanks it for the one player the country/space split exists for.
  expect(countryBadgeProgress([mars], 23)).toEqual({ earned: 0, total: 23, show: true });
});

test('a player with no badges at all is shown no progress line', () => {
  expect(countryBadgeProgress([], 23).show).toBe(false);
  expect(countryBadgeProgress(undefined, 23).show).toBe(false);
  expect(countryBadgeProgress(null, 23).show).toBe(false);
});

test('every country badge counts, and no badge counts twice', () => {
  const badges = ['FR', 'JP', 'US', 'IT'].map(country);
  expect(countryBadgeProgress(badges, 23).earned).toBe(4);
});

test('the numerator can never exceed the denominator for real badge sets', () => {
  // Every code the street pool can award, plus both worlds.
  const total = playableCountries('apple');
  const { citiesFor } = require('@/app/lib/geo/coverage');
  const everyCountry = [...new Set(citiesFor('apple').map((c) => c.country))].map(country);
  const progress = countryBadgeProgress([...everyCountry, mars, moon], total);
  expect(progress.earned).toBe(total);
});
