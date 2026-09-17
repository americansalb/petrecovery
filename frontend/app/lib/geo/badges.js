/**
 * Badge progress: how many of the countries you can be dropped in you
 * have earned a badge for.
 *
 * Its own file because it was three expressions inline in the profile's
 * JSX and each one got it wrong in a different way. Mars and the Moon
 * are badge rows like any other (XM and XL, from a Not Earth round
 * called right), so:
 *
 *   - counting them in the numerator against a denominator that is only
 *     the street pool prints "24 of 23";
 *   - hiding the line when the country count is zero means a player
 *     whose first badge is Mars sees no country progress at all,
 *     which is exactly the case the split was made for.
 *
 * A pure function can be tested with a profile nobody has to play
 * hundreds of rounds to reach.
 */

import { citiesFor } from './coverage';

/** The countries a street round can actually drop you in. */
export function playableCountries(provider = 'apple') {
  return new Set(citiesFor(provider).map((city) => city.country)).size;
}

/**
 * { earned, total, show } for a badge list. `show` is false only when
 * the profile has no badges at all - a player with one Mars badge and
 * no countries is shown "0 of 23 countries", because the zero is the
 * information.
 */
export function countryBadgeProgress(badges, total = playableCountries()) {
  const list = Array.isArray(badges) ? badges : [];
  return {
    earned: list.filter((badge) => !badge.notEarth).length,
    total,
    show: list.length > 0,
  };
}
