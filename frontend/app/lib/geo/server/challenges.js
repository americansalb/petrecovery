/**
 * Shared challenges with a board: the daily (docs/GEO.md, "The daily
 * challenge"). Everyone plays the same five places, so scores compare,
 * and the server keeps the score: each round's first guess is recorded
 * against the profile from the sealed token's seed and index, and an
 * entry per profile carries the running total. Ranking is by total,
 * earlier finish first on a tie. Server only.
 */

import { MODES, isDailySeed, isCupSeed, isoWeek, isoWeekEnd } from '../modes';
import { equippedView } from '../items';
import { grant } from './points';

export const DAILY_ROUNDS = MODES.daily.fixed.rounds;
export const CUP_ROUNDS = MODES.cup.fixed.rounds;

/** The weekly cup's prizes in points: the top three, the rest of the top ten, everyone who finished. */
export const CUP_PRIZES = Object.freeze({ podium: Object.freeze([300, 200, 100]), topTen: 50, finished: 20 });

/** "daily-2026-09-07" (the seed) -> "daily:2026-09-07" (the board key), or null. */
export function dailyKey(seed) {
  return isDailySeed(seed) ? `daily:${String(seed).slice('daily-'.length)}` : null;
}

/** The board key for a date (default today, UTC). */
export function dailyKeyFor(date = new Date()) {
  return `daily:${new Date(date).toISOString().slice(0, 10)}`;
}

/** "cup-2026-W37" (the seed) -> "cup:2026-W37" (the board key), or null. */
export function cupKey(seed) {
  return isCupSeed(seed) ? `cup:${String(seed).slice('cup-'.length)}` : null;
}

/** The cup's board key for a moment (default this week). */
export function cupKeyFor(date = new Date()) {
  return `cup:${isoWeek(new Date(date))}`;
}

/** When a cup's week ends, from "cup:2026-W37". */
export function cupEndsAt(key) {
  return isoWeekEnd(String(key || '').replace(/^cup:/, ''));
}

/**
 * How long after a challenge's window closes a round may still land on
 * its board: enough for a game that was in flight over the boundary,
 * not enough to be worth waiting for.
 */
export const CHALLENGE_GRACE_MS = 2 * 60 * 60 * 1000;

/** [start, end) of the window a board key covers, or null. */
export function challengeWindow(key) {
  const daily = /^daily:(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
  if (daily) {
    const start = Date.UTC(Number(daily[1]), Number(daily[2]) - 1, Number(daily[3]));
    if (!Number.isFinite(start)) return null;
    return { start, end: start + 86400000 };
  }
  const cup = /^cup:(\d{4}-W\d{2})$/.exec(String(key || ''));
  if (cup) {
    const end = isoWeekEnd(cup[1]);
    return end ? { start: end - 7 * 86400000, end } : null;
  }
  return null;
}

/** Is this board open for writing right now? */
export function challengeIsOpen(key, now = Date.now()) {
  const window = challengeWindow(key);
  if (!window) return false;
  return now >= window.start && now < window.end + CHALLENGE_GRACE_MS;
}

/**
 * The board a scored round belongs to, from the sealed token's mode and
 * seed, or null when there is none to write to.
 *
 * The seed is chosen by the caller, so the window is checked here: a
 * seed of "daily-2031-01-01" is a perfectly valid shape, and without
 * this a player could fill in every future day's board before those
 * days exist, and top up old ones forever.
 */
export function challengeFor(result, now = Date.now()) {
  if (result?.mode === 'daily') {
    const key = dailyKey(result.seed);
    return key && challengeIsOpen(key, now) ? { key, rounds: DAILY_ROUNDS, kind: 'daily' } : null;
  }
  if (result?.mode === 'cup') {
    const key = cupKey(result.seed);
    return key && challengeIsOpen(key, now) ? { key, rounds: CUP_ROUNDS, kind: 'cup' } : null;
  }
  return null;
}

/** What a placement in the cup pays. */
export function cupPrize(placement) {
  if (placement <= 3) return CUP_PRIZES.podium[placement - 1];
  if (placement <= 10) return CUP_PRIZES.topTen;
  return CUP_PRIZES.finished;
}

/**
 * Pay a finished cup week's prizes, once: every finished entry by
 * placement. Returns how many were paid, or null when the week is still
 * on or was already paid. Safe to call on every view of a past week.
 */
export async function finalizeCup(store, key, now = Date.now()) {
  const endsAt = cupEndsAt(key);
  if (!endsAt || now < endsAt) return null;
  if (await store.getChallengeFinal(key)) return null;
  const rows = await store.listChallengeBoard(key, { rounds: CUP_ROUNDS, limit: 5000 });
  let paid = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const placement = i + 1;
    const amount = cupPrize(placement);
    const paidRow = await grant(store, { profileId: row.profileId, amount, reason: `Cup ${key.slice(4)}: ${placement <= 3 ? ['1st', '2nd', '3rd'][placement - 1] : `${placement}th`} of ${rows.length}`, ref: `${key}:${row.profileId}`, now });
    if (paidRow) paid += 1;
  }
  // The week is marked done only once every prize has landed. This used
  // to be claimed first, so one dropped connection partway through the
  // loop left the row written and the rest of the board unpaid for
  // good: every later call short-circuited on it. Paying first is safe
  // precisely because grant is idempotent per (profile, ref), which is
  // also why the claim was never needed as a guard against paying
  // twice; it only saves re-walking a finished week.
  await store.claimChallengeFinal(key, now, rows.length);
  return paid;
}

const toMs = (v) => (v instanceof Date ? v.getTime() : typeof v === 'number' ? v : v ? Date.parse(v) : null);

function entryView(entry, rounds) {
  if (!entry) return null;
  return {
    total: entry.total,
    rounds: entry.rounds,
    finished: entry.rounds >= rounds,
    finishedAt: toMs(entry.finishedAt),
  };
}

/**
 * Record one round of a challenge for a profile. Only the first guess
 * on a round counts; a repeat returns recorded: false with the entry as
 * it stands. Never rates or refuses: the guess itself was already
 * scored.
 */
export async function recordChallengeRound(store, { profileId, key, index, score, distanceKm = null, rounds = DAILY_ROUNDS, now = Date.now() }) {
  // The round index rides in on the sealed token, and the round route
  // used to accept any index up to 999: a five-round daily could be
  // posted as a thousand-round total. A challenge has exactly `rounds`.
  const i = Math.floor(Number(index));
  if (!Number.isFinite(i) || i < 0 || i >= rounds) {
    const existing = await store.getChallengeEntry(profileId, key);
    return { key, recorded: false, ...entryView(existing, rounds) };
  }
  const created = await store.createChallengeRound({
    profileId,
    key,
    index: i,
    score: Math.max(0, Math.round(Number(score) || 0)),
    distanceKm: Number.isFinite(distanceKm) ? distanceKm : null,
    createdAt: new Date(now),
  });
  if (created) {
    await store.bumpChallengeEntry(profileId, key, { scoreDelta: created.score, roundsDelta: 1, rounds, now });
  }
  const entry = await store.getChallengeEntry(profileId, key);
  return { key, recorded: Boolean(created), ...entryView(entry, rounds) };
}

/**
 * The board for a challenge: finished entries ranked, how many started
 * and finished, and the asking profile's own row with its rank.
 */
export async function challengeBoard(store, { key, rounds = DAILY_ROUNDS, limit = 20, profileId = null }) {
  const [rows, players, finished, mine] = await Promise.all([
    store.listChallengeBoard(key, { rounds, limit }),
    store.countChallengeEntries(key),
    store.countChallengeEntries(key, { rounds }),
    profileId ? store.getChallengeEntry(profileId, key) : null,
  ]);
  const board = rows.map((row, i) => ({
    rank: i + 1,
    profileId: row.profileId,
    name: row.profile?.name || 'Player',
    cosmetics: equippedView(row.profile?.equipped),
    total: row.total,
    finishedAt: toMs(row.finishedAt),
  }));
  let you = entryView(mine, rounds);
  if (you) {
    const rank = you.finished ? 1 + (await store.countChallengeBetter(key, { rounds, total: mine.total, finishedAt: mine.finishedAt })) : null;
    you = { ...you, rank, name: (await store.getProfileById(profileId))?.name || 'Player' };
  }
  const final = store.getChallengeFinal ? await store.getChallengeFinal(key) : null;
  return { key, rounds, players, finished, board, you, finalizedAt: final ? toMs(final.finalizedAt) : null };
}
