/**
 * Ranked solo: the hourly set, and what finishing one does to a rating.
 *
 * Solo play was unrated, so one person on their own had nothing to
 * climb. A ranked set is the daily challenge's machinery on an hourly
 * turn: everyone playing this hour gets the same five places, so their
 * scores can be compared to each other rather than to nothing, and the
 * comparison is the rating.
 *
 * The things worth pinning are the ones a player would notice if they
 * broke: the set has to be the same for everyone in the hour and
 * different next hour, a set cannot be rated twice, beating the field
 * has to go up and losing to it has to go down, and a rank must not
 * appear before it means anything.
 */

const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');
const { resolveProfile, applyRankedSolo } = require('@/app/lib/geo/server/profiles');
const { recordChallengeRound, rankedKey, rankedKeyFor, challengeFor, challengeIsOpen, RANKED_ROUNDS } = require('@/app/lib/geo/server/challenges');
const { rankedSeed, isRankedSeed, normalizeConfig, MODES } = require('@/app/lib/geo/modes');
const { PROVISIONAL_GAMES, RATING_DEFAULT } = require('@/app/lib/geo/rating');
const { MAX_ROUND_SCORE } = require('@/app/lib/geo/distance');

const HOUR = '2026-09-15T21';
const KEY = `ranked:${HOUR}`;
const AT = Date.UTC(2026, 8, 15, 21, 30);

async function player(store, name) {
  const { profile } = await resolveProfile(store, { token: `token-${name}` });
  return profile.id;
}

/** Play a whole ranked set at `total` points, spread over the rounds. */
async function playSet(store, profileId, total, { key = KEY, at = AT } = {}) {
  const each = Math.round(total / RANKED_ROUNDS);
  let last = null;
  for (let index = 0; index < RANKED_ROUNDS; index++) {
    last = await recordChallengeRound(store, { profileId, key, index, score: each, rounds: RANKED_ROUNDS, now: at });
  }
  return last;
}

describe('the hourly set', () => {
  test('everyone playing the same hour gets the same seed, and the next hour is a different one', () => {
    const at = new Date(Date.UTC(2026, 8, 15, 21, 5));
    const later = new Date(Date.UTC(2026, 8, 15, 21, 55));
    const next = new Date(Date.UTC(2026, 8, 15, 22, 0));
    expect(rankedSeed(at)).toBe(rankedSeed(later));
    expect(rankedSeed(at)).not.toBe(rankedSeed(next));
    expect(rankedSeed(at)).toBe(`ranked-${HOUR}`);
  });

  test('an old seed is thrown away, so a set cannot be replayed for a better score', () => {
    const config = normalizeConfig({ mode: 'ranked', seed: 'ranked-1999-01-01T00', rounds: 20, time: 0, move: true }, { now: AT });
    expect(config.seed).toBe(rankedSeed(new Date(AT)));
    // And the shape of the game is fixed, so two ratings are comparable.
    expect(config.rounds).toBe(MODES.ranked.fixed.rounds);
    expect(config.time).toBe(MODES.ranked.fixed.time);
    expect(config.move).toBe(false);
  });

  test('a set started before the hour turned over is still the same set', () => {
    // Started at 20:58, finishing at 21:30. Change the seed underneath
    // it and the five rounds never add up to one entry.
    const started = `ranked-${new Date(Date.UTC(2026, 8, 15, 20)).toISOString().slice(0, 13)}`;
    expect(normalizeConfig({ mode: 'ranked', seed: started }, { now: AT }).seed).toBe(started);
    // Two hours on it is somebody handing back a set they have seen.
    const later = Date.UTC(2026, 8, 15, 23, 30);
    expect(normalizeConfig({ mode: 'ranked', seed: started }, { now: later }).seed).toBe(rankedSeed(new Date(later)));
  });

  test('a seed from the future is refused too', () => {
    const ahead = `ranked-${new Date(Date.UTC(2026, 8, 16, 5)).toISOString().slice(0, 13)}`;
    expect(normalizeConfig({ mode: 'ranked', seed: ahead }, { now: AT }).seed).toBe(rankedSeed(new Date(AT)));
  });

  test('an hour is open for its own hour and shut afterwards', () => {
    expect(isRankedSeed(`ranked-${HOUR}`)).toBe(true);
    expect(rankedKey(`ranked-${HOUR}`)).toBe(KEY);
    expect(rankedKey('daily-2026-09-15')).toBe(null);
    expect(rankedKeyFor(new Date(AT))).toBe(KEY);
    expect(challengeIsOpen(KEY, AT)).toBe(true);
    // Long past its window and past the grace period.
    expect(challengeIsOpen(KEY, AT + 6 * 3600000)).toBe(false);
    // And a future hour cannot be filled in early.
    expect(challengeIsOpen(KEY, AT - 6 * 3600000)).toBe(false);
  });

  test('a ranked result routes to the ranked board', () => {
    const shared = challengeFor({ mode: 'ranked', seed: `ranked-${HOUR}` }, AT);
    expect(shared).toEqual({ key: KEY, rounds: RANKED_ROUNDS, kind: 'ranked' });
  });
});

describe('what finishing a set does', () => {
  test('beating the field goes up, losing to it goes down', async () => {
    const store = createMemoryRoomStore();
    const field = await player(store, 'field');
    const strong = await player(store, 'strong');
    const weak = await player(store, 'weak');

    await playSet(store, field, 12000);
    await applyRankedSolo(store, { profileId: field, key: KEY, rounds: RANKED_ROUNDS, now: AT });

    await playSet(store, strong, 20000);
    const up = await applyRankedSolo(store, { profileId: strong, key: KEY, rounds: RANKED_ROUNDS, now: AT });

    await playSet(store, weak, 3000);
    const down = await applyRankedSolo(store, { profileId: weak, key: KEY, rounds: RANKED_ROUNDS, now: AT });

    expect(up.delta).toBeGreaterThan(0);
    expect(down.delta).toBeLessThan(0);
    expect(up.field.players).toBeGreaterThan(0);
  });

  test('a bigger margin moves the rating further', async () => {
    const make = async (total) => {
      const store = createMemoryRoomStore();
      const field = await player(store, 'field');
      await playSet(store, field, 10000);
      await applyRankedSolo(store, { profileId: field, key: KEY, rounds: RANKED_ROUNDS, now: AT });
      const me = await player(store, 'me');
      await playSet(store, me, total);
      return applyRankedSolo(store, { profileId: me, key: KEY, rounds: RANKED_ROUNDS, now: AT });
    };
    const squeak = await make(10200);
    const rout = await make(24000);
    expect(rout.delta).toBeGreaterThan(squeak.delta);
  });

  test('an unfinished set is not rated', async () => {
    const store = createMemoryRoomStore();
    const me = await player(store, 'me');
    for (let index = 0; index < RANKED_ROUNDS - 1; index++) {
      await recordChallengeRound(store, { profileId: me, key: KEY, index, score: 4000, rounds: RANKED_ROUNDS, now: AT });
    }
    expect(await applyRankedSolo(store, { profileId: me, key: KEY, rounds: RANKED_ROUNDS, now: AT })).toBe(null);
  });

  test('the first player of an hour is still rated, against a newcomer at par', async () => {
    const store = createMemoryRoomStore();
    const me = await player(store, 'first');
    await playSet(store, me, MAX_ROUND_SCORE * RANKED_ROUNDS);
    const rated = await applyRankedSolo(store, { profileId: me, key: KEY, rounds: RANKED_ROUNDS, now: AT });
    expect(rated.field.players).toBe(0);
    expect(rated.field.rating).toBe(RATING_DEFAULT);
    // A perfect set against par is a win, but the opponent's deviation
    // is the widest there is, so it is a small one.
    // A perfect set against par is a win, but the opponent's deviation
    // is the widest there is, so the swing stays modest.
    expect(rated.delta).toBeGreaterThan(0);
    expect(rated.delta).toBeLessThan(250);
  });

  test('a rank is withheld until it means something', async () => {
    const store = createMemoryRoomStore();
    const me = await player(store, 'me');
    let rated = null;
    for (let game = 1; game <= PROVISIONAL_GAMES; game++) {
      const key = `ranked:2026-09-15T${String(8 + game).padStart(2, '0')}`;
      const at = Date.UTC(2026, 8, 15, 8 + game, 30);
      await playSet(store, me, 12000, { key, at });
      rated = await applyRankedSolo(store, { profileId: me, key, rounds: RANKED_ROUNDS, now: at });
      expect({ game, games: rated.games }).toEqual({ game, games: game });
      if (game < PROVISIONAL_GAMES) {
        expect({ game, provisional: rated.provisional }).toEqual({ game, provisional: true });
        expect(rated.placements).toBe(PROVISIONAL_GAMES - game);
      }
    }
    expect(rated.provisional).toBe(false);
    expect(rated.placements).toBe(0);
  });

  test('a repeated round does not count twice, so a set cannot be re-rated', async () => {
    const store = createMemoryRoomStore();
    const me = await player(store, 'me');
    await playSet(store, me, 15000);
    const first = await recordChallengeRound(store, { profileId: me, key: KEY, index: RANKED_ROUNDS - 1, score: 5000, rounds: RANKED_ROUNDS, now: AT });
    // The guess route only rates when `recorded` is true, and a round
    // already on the board is never recorded again.
    expect(first.recorded).toBe(false);
    expect(first.finished).toBe(true);
  });
});
