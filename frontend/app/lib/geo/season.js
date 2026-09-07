/**
 * Seasons (docs/GEO.md, "Seasons"): three months each from 1 September
 * 2026. Ratings live per season; when a player is first seen in a new
 * season, last season's rating is carried in softly (halfway back to
 * 1500, the uncertainty widened) and last season's final tier pays a
 * points reward. Pure; app/lib/geo/server/profiles.js applies it.
 */

export const SEASON_EPOCH = Date.UTC(2026, 8, 1);
export const SEASON_MONTHS = 3;
export const SEASON_MIN_GAMES = 3; // rated games needed for a season reward

/** Points for last season's final tier on a ladder. */
export const SEASON_REWARDS = Object.freeze({
  Bronze: 0,
  Silver: 50,
  Gold: 100,
  Platinum: 200,
  Diamond: 350,
  Master: 500,
  Grandmaster: 800,
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthsSinceEpoch(now) {
  const d = new Date(now);
  const epoch = new Date(SEASON_EPOCH);
  return (d.getUTCFullYear() - epoch.getUTCFullYear()) * 12 + (d.getUTCMonth() - epoch.getUTCMonth());
}

/** The season a moment falls in. Before the epoch is season 0. */
export function seasonFor(now = Date.now()) {
  const months = monthsSinceEpoch(now);
  const number = months < 0 ? 0 : Math.floor(months / SEASON_MONTHS) + 1;
  return seasonByNumber(number);
}

export function seasonByNumber(number) {
  const n = Math.max(0, Math.floor(Number(number) || 0));
  const epoch = new Date(SEASON_EPOCH);
  const startMonth = epoch.getUTCMonth() + (n - 1) * SEASON_MONTHS;
  const startsAt = n === 0 ? -Infinity : Date.UTC(epoch.getUTCFullYear(), startMonth, 1);
  const endsAt = n === 0 ? SEASON_EPOCH : Date.UTC(epoch.getUTCFullYear(), startMonth + SEASON_MONTHS, 1);
  const first = new Date(n === 0 ? SEASON_EPOCH : startsAt);
  const last = new Date(endsAt - 1);
  const label = n === 0 ? 'Before season 1' : `Season ${n}: ${MONTHS[first.getUTCMonth()]} to ${MONTHS[last.getUTCMonth()]} ${last.getUTCFullYear()}`;
  return { number: n, key: `s${n}`, startsAt, endsAt, label };
}

export function seasonByKey(key) {
  const m = /^s(\d+)$/.exec(String(key || ''));
  return m ? seasonByNumber(Number(m[1])) : null;
}

/** The key of the season before this one, or null before the first. */
export function previousSeasonKey(key) {
  const season = seasonByKey(key);
  return season && season.number > 0 ? `s${season.number - 1}` : null;
}

export function daysLeft(season, now = Date.now()) {
  return Math.max(0, Math.ceil((season.endsAt - now) / 86400000));
}

/** Last season's rating, carried in softly: halfway back to 1500, uncertainty widened. */
export function carryRating(rating, rd) {
  return { rating: 1500 + ((Number(rating) || 1500) - 1500) * 0.5, rd: Math.max(Number(rd) || 350, 200) };
}

/** The points reward for finishing a season at a tier, given the games played. */
export function seasonReward(tier, games) {
  if ((Number(games) || 0) < SEASON_MIN_GAMES) return 0;
  return SEASON_REWARDS[tier] || 0;
}
