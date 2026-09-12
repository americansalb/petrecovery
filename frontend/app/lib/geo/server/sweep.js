/**
 * Housekeeping for the game's tables.
 *
 * Found in the deep audit: nothing in WanderGuesser ever deleted
 * anything except expired sign-in links. Round-cache rows were filtered
 * by their expiry on read and then left in place forever, usage rows
 * (one per subject per day per provider, and a subject can be a hashed
 * address) accumulated a row per player per day, and finished rooms
 * kept their players, rounds and every guess indefinitely. The game
 * shares a database with a lost-pet service, so that growth is not the
 * game's problem alone.
 *
 * Everything here is a delete of rows whose usefulness has expired, and
 * every window is generous. What is deliberately kept: profiles,
 * accounts, ratings, the points ledger, badges, challenge boards and
 * GeoMatchResult, which is a player's own record of games played and
 * carries no foreign key to the rooms it names, so a swept room does
 * not take a player's history with it.
 *
 * Server only. Safe to run repeatedly and safe to run while people play.
 */

export const RETENTION = Object.freeze({
  /** Usage rows older than this, in days. A day is the unit of the meter. */
  usageDays: 120,
  /** Finished rooms untouched for this long, in days. */
  finishedRoomDays: 14,
  /** Rooms abandoned in a lobby or mid-game, in days. */
  staleRoomDays: 3,
});

const DAY_MS = 86400000;
const dayKeyOf = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * Delete what has expired. Returns a count per table, and never throws:
 * a failed sweep is a log line, not a failed request.
 */
export async function sweepGeo(store, { now = Date.now(), retention = RETENTION } = {}) {
  const swept = { roundCache: 0, loginTokens: 0, usage: 0, rooms: 0 };
  const run = async (name, fn) => {
    try {
      const result = await fn();
      swept[name] = typeof result === 'number' ? result : result?.count || 0;
    } catch (error) {
      console.error(`[geo/sweep] ${name}`, error?.message || error);
    }
  };

  await run('roundCache', () => store.deleteExpiredRoundCache?.(new Date(now)));
  await run('loginTokens', () => store.deleteExpiredLoginTokens?.(new Date(now)));
  await run('usage', () => store.deleteUsageBefore?.(dayKeyOf(now - retention.usageDays * DAY_MS)));
  await run('rooms', () =>
    store.deleteOldRooms?.({
      finishedBefore: new Date(now - retention.finishedRoomDays * DAY_MS),
      staleBefore: new Date(now - retention.staleRoomDays * DAY_MS),
    })
  );
  return swept;
}

/**
 * Sweep at most once an hour per process, in the background, from
 * whatever request happens to be first. The game has no scheduler of
 * its own and `npm run geo:sweep` needs somebody to run it; this makes
 * the default deployment keep itself tidy without one.
 */
let nextSweepAt = 0;

export function maybeSweep(store, { now = Date.now(), everyMs = 3600000 } = {}) {
  if (now < nextSweepAt) return false;
  nextSweepAt = now + everyMs;
  Promise.resolve()
    .then(() => sweepGeo(store, { now }))
    .then((swept) => {
      const total = Object.values(swept).reduce((sum, n) => sum + n, 0);
      if (total > 0) console.log('[geo/sweep]', JSON.stringify(swept));
    })
    .catch((error) => console.error('[geo/sweep]', error?.message || error));
  return true;
}

/** Tests only: forget when the last sweep ran. */
export function _resetSweep() {
  nextSweepAt = 0;
}
