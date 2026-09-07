/**
 * Points: the earned currency (docs/GEO.md, "Points and cosmetics").
 * Pure rules; app/lib/geo/server/points.js applies them on the store.
 *
 * Points come from playing and from skill, and they buy only things
 * that cost nothing to serve (app/lib/geo/items.js). They never buy
 * Google rounds: the moment earned points turned into imagery, heavy
 * players would farm them on free Apple play and spend them on rounds
 * we pay for. Points earn on the first rounds of the day only, so there
 * is nothing to gain from running a script all night.
 */

import { MAX_ROUND_SCORE } from './distance';

export const POINTS = Object.freeze({
  roundBase: 2, // a finished solo round
  roundBonusMax: 8, // on top, by accuracy
  dailyMultiplier: 2, // the daily challenge pays double
  streakCorrect: 3, // a country named right in a streak
  roomRoundBase: 3, // a room round
  roomRoundBonusMax: 8,
  roomPlacement: Object.freeze([30, 20, 10]), // finishing first, second, third
  roomOther: 5, // finishing anywhere else, having stayed
  duelWin: 40, // last one standing
  badge: 25, // a country badge, once per country
  firstOfDay: 10, // the first round of the day
  earningRoundsPerDay: 50, // rounds that earn, per player per day
});

/** Within this distance of the answer, inside a country, earns its badge. */
export const BADGE_KM = 100;

const clampScore = (score) => Math.max(0, Math.min(MAX_ROUND_SCORE, Number(score) || 0));

/** Points for one finished solo round. */
export function roundPoints({ score = 0, mode = 'world', kind = 'pin', correct = false } = {}) {
  if (kind === 'streak') return correct ? POINTS.streakCorrect : 0;
  const base = POINTS.roundBase + Math.round((clampScore(score) / MAX_ROUND_SCORE) * POINTS.roundBonusMax);
  return mode === 'daily' ? base * POINTS.dailyMultiplier : base;
}

/** Points for one room round, from the round's score. */
export function roomRoundPoints(score = 0) {
  return POINTS.roomRoundBase + Math.round((clampScore(score) / MAX_ROUND_SCORE) * POINTS.roomRoundBonusMax);
}

/** Points for finishing a room. Leaving earns nothing. */
export function roomFinishPoints({ placement = 0, isDuel = false, left = false } = {}) {
  if (left || !placement) return 0;
  const place = POINTS.roomPlacement[placement - 1] ?? POINTS.roomOther;
  return place + (isDuel && placement === 1 ? POINTS.duelWin : 0);
}

/** A pin within BADGE_KM of the answer earns the answer's country badge. */
export function badgeEarned(distanceKm) {
  return Number.isFinite(distanceKm) && distanceKm <= BADGE_KM;
}

/** Whether this round of the day (1-based count including it) still earns. */
export function earningAllowed(roundsToday) {
  return (Number(roundsToday) || 0) <= POINTS.earningRoundsPerDay;
}
