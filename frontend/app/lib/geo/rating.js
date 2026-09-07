/**
 * Ratings for multiplayer rooms: Glicko, applied to free-for-all games.
 *
 * Plain Elo has one number per player and moves it the same amount
 * whether you have played two games or two hundred. Glicko adds a
 * rating deviation (RD): how unsure the system is about you. New and
 * long-absent players carry a large RD, so their rating moves fast and
 * they barely dent established players; a regular's RD is small, so
 * one bad night costs little.
 *
 * A finished room is one rating period. Every player is compared with
 * every other player in it, and the result of each pair is graded by
 * margin: a narrow win counts less than a rout. Everyone's update is
 * computed from the pre-game numbers, so order does not matter.
 *
 * Ladders are separate (classic, duel). Pure JavaScript.
 */

export const LADDERS = ['classic', 'duel'];
export const RATING_DEFAULT = 1500;
export const RD_DEFAULT = 350;
export const RD_MIN = 30;
export const RD_MAX = 350;
/** Deviation regrowth per day of inactivity: 50 -> 350 in about 100 days. */
export const RD_GROWTH_PER_DAY = 34.6;
export const PROVISIONAL_GAMES = 5;

const Q = Math.log(10) / 400;
const DAY_MS = 24 * 60 * 60 * 1000;

/** How much an opponent's uncertainty discounts the result. */
export function g(rd) {
  return 1 / Math.sqrt(1 + (3 * Q * Q * rd * rd) / (Math.PI * Math.PI));
}

/** Expected result of `rating` against an opponent, 0..1. */
export function expectedScore(rating, opponentRating, opponentRd = 0) {
  return 1 / (1 + Math.pow(10, (-g(opponentRd) * (rating - opponentRating)) / 400));
}

/** RD grows while you are away, capped at the newcomer level. */
export function inflateRd(rd, daysSince) {
  const days = Math.max(0, Number(daysSince) || 0);
  return Math.min(RD_MAX, Math.sqrt(rd * rd + RD_GROWTH_PER_DAY * RD_GROWTH_PER_DAY * days));
}

/**
 * The graded result of a pair, 0..1, from the margin between them.
 * A win by at least `scale` is a full win (1); the thinnest win is
 * worth 0.75; a tie is 0.5. Losses mirror.
 */
export function gradedOutcome(margin, scale) {
  if (!Number.isFinite(margin) || margin === 0) return 0.5;
  const strength = 0.5 + 0.5 * Math.min(1, Math.abs(margin) / Math.max(1, scale));
  return margin > 0 ? 0.5 + 0.5 * strength : 0.5 - 0.5 * strength;
}

/**
 * One player's Glicko update from a list of opponents
 * [{ rating, rd, outcome }] where outcome is this player's result, 0..1.
 */
export function glickoUpdate({ rating, rd }, opponents) {
  if (!opponents.length) return { rating, rd };
  let dInv = 0;
  let sum = 0;
  for (const o of opponents) {
    const gj = g(o.rd);
    const e = expectedScore(rating, o.rating, o.rd);
    dInv += gj * gj * e * (1 - e);
    sum += gj * (o.outcome - e);
  }
  const d2 = 1 / (Q * Q * dInv);
  const denominator = 1 / (rd * rd) + 1 / d2;
  const newRating = rating + (Q / denominator) * sum;
  const newRd = Math.max(RD_MIN, Math.sqrt(1 / denominator));
  return { rating: newRating, rd: newRd };
}

/**
 * Rate a finished game.
 *
 * entries: [{ id, rating, rd, lastPlayedAt, placement, measure, left }]
 *   placement: 1 = first; ties share a placement
 *   measure: the number the margin is taken from (points, or HP in a duel)
 *   left: quit before the end; counts as a loss to everyone who stayed
 * scale: the margin that counts as a full win
 *
 * Returns [{ id, before, after, delta, rdBefore, rdAfter, placement }].
 */
export function rateGame(entries, { scale, now = Date.now() } = {}) {
  const prepared = entries.map((e) => {
    const days = e.lastPlayedAt ? (now - new Date(e.lastPlayedAt).getTime()) / DAY_MS : 0;
    return {
      ...e,
      rating: Number.isFinite(e.rating) ? e.rating : RATING_DEFAULT,
      rd: inflateRd(Number.isFinite(e.rd) ? e.rd : RD_DEFAULT, e.lastPlayedAt ? days : 0),
    };
  });
  if (prepared.length < 2) {
    return prepared.map((p) => ({ id: p.id, before: p.rating, after: p.rating, delta: 0, rdBefore: p.rd, rdAfter: p.rd, placement: p.placement }));
  }
  const marginScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return prepared.map((me) => {
    const opponents = prepared
      .filter((o) => o.id !== me.id)
      .map((o) => {
        let outcome;
        if (me.left && !o.left) outcome = 0;
        else if (o.left && !me.left) outcome = 1;
        else if (me.placement !== o.placement) outcome = me.placement < o.placement ? gradedOutcome(Math.max(1, (me.measure || 0) - (o.measure || 0)), marginScale) : gradedOutcome(Math.min(-1, (me.measure || 0) - (o.measure || 0)), marginScale);
        else outcome = 0.5;
        return { rating: o.rating, rd: o.rd, outcome };
      });
    const updated = glickoUpdate({ rating: me.rating, rd: me.rd }, opponents);
    return {
      id: me.id,
      before: me.rating,
      after: updated.rating,
      delta: updated.rating - me.rating,
      rdBefore: me.rd,
      rdAfter: updated.rd,
      placement: me.placement,
    };
  });
}

/** Placements from standings order; equal measures share a placement. */
export function placementsFrom(sorted, measureOf) {
  let placement = 0;
  let last = null;
  return sorted.map((entry, i) => {
    const m = measureOf(entry);
    if (m !== last) {
      placement = i + 1;
      last = m;
    }
    return placement;
  });
}

export function isProvisional(games) {
  return (games || 0) < PROVISIONAL_GAMES;
}

/** A rating you can print: rounded, with its 95% band. */
export function displayRating(rating, rd) {
  return { value: Math.round(rating), low: Math.round(rating - 2 * rd), high: Math.round(rating + 2 * rd) };
}

export const TIERS = [
  { name: 'Bronze', min: -Infinity },
  { name: 'Silver', min: 1400 },
  { name: 'Gold', min: 1550 },
  { name: 'Platinum', min: 1700 },
  { name: 'Diamond', min: 1850 },
  { name: 'Master', min: 2000 },
  { name: 'Grandmaster', min: 2200 },
];

export function tierFor(rating) {
  let tier = TIERS[0];
  for (const t of TIERS) if (rating >= t.min) tier = t;
  return tier.name;
}
