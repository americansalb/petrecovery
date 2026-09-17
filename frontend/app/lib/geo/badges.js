/**
 * Badge progress: how many of the countries you can be dropped in you
 * have earned a badge for.
 *
 * Its own file because it was an expression inline in the profile's JSX
 * and got it wrong three different ways. Badges outlive the coverage
 * that awarded them, which is what makes the counting subtle:
 *
 *   - Mars and the Moon are badge rows like any other (XM and XL, from
 *     a Not Earth round called right), so counting them against a
 *     country denominator prints "24 of 23";
 *   - the city list holds 56 countries and only 23 of them are playable
 *     on Apple Look Around, so a player who earned Cairo or Havana
 *     while the game ran on Google still holds those rows and could be
 *     shown "40 of 23";
 *   - hiding the line when the playable count is zero blanks it for a
 *     player whose only badge is Mars, or whose badges are all from the
 *     wider coverage, which are exactly the players this splits apart.
 *
 * So: the numerator is badges inside the pool a round draws from today,
 * the denominator is that pool, and anything else a player holds is
 * reported beside it rather than folded in or dropped.
 *
 * A pure function can be tested with a profile nobody has to play
 * hundreds of rounds to reach.
 */

import { citiesFor } from './coverage';

/** The countries a street round can actually drop you in. */
export function playableCountryCodes(provider = 'apple') {
  return new Set(citiesFor(provider).map((city) => city.country));
}

/**
 * { earned, total, elsewhere, show } for a badge list.
 *
 * `elsewhere` is country badges from outside today's pool: real badges
 * for real places, which is why they are counted and named rather than
 * quietly dropped. `show` is false only when there are no badges at
 * all, because a zero against a denominator is information and an
 * empty card is not.
 */
export function countryBadgeProgress(badges, playable = playableCountryCodes()) {
  const list = Array.isArray(badges) ? badges : [];
  const countries = list.filter((badge) => !badge.notEarth);
  const earned = countries.filter((badge) => playable.has(badge.countryCode)).length;
  return {
    earned,
    total: playable.size,
    elsewhere: countries.length - earned,
    show: list.length > 0,
  };
}
