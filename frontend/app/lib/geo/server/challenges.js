/**
 * Shared challenges with a board: the daily (docs/GEO.md, "The daily
 * challenge"). Everyone plays the same five places, so scores compare,
 * and the server keeps the score: each round's first guess is recorded
 * against the profile from the sealed token's seed and index, and an
 * entry per profile carries the running total. Ranking is by total,
 * earlier finish first on a tie. Server only.
 */

import { MODES, isDailySeed } from '../modes';
import { equippedView } from '../items';

export const DAILY_ROUNDS = MODES.daily.fixed.rounds;

/** "daily-2026-09-07" (the seed) -> "daily:2026-09-07" (the board key), or null. */
export function dailyKey(seed) {
  return isDailySeed(seed) ? `daily:${String(seed).slice('daily-'.length)}` : null;
}

/** The board key for a date (default today, UTC). */
export function dailyKeyFor(date = new Date()) {
  return `daily:${new Date(date).toISOString().slice(0, 10)}`;
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
  const created = await store.createChallengeRound({
    profileId,
    key,
    index,
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
  return { key, rounds, players, finished, board, you };
}
