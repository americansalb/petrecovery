/**
 * The daily challenge's board (app/lib/geo/server/challenges.js) on the
 * in-memory store: the first guess on a round counts and a repeat does
 * not, the entry finishes at five rounds, the board ranks by total with
 * the earlier finisher ahead on a tie, and your own row knows its rank.
 */

const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');
const { recordChallengeRound, challengeBoard, dailyKey, dailyKeyFor, DAILY_ROUNDS } = require('@/app/lib/geo/server/challenges');
const { resolveProfile } = require('@/app/lib/geo/server/profiles');

const T0 = Date.parse('2026-09-07T12:00:00Z');
const KEY = 'daily:2026-09-07';

async function player(store, name) {
  return (await resolveProfile(store, { name, now: T0 })).profile;
}

async function play(store, profileId, scores, startAt = T0) {
  let last = null;
  for (let i = 0; i < scores.length; i++) {
    last = await recordChallengeRound(store, { profileId, key: KEY, index: i, score: scores[i], distanceKm: 10 * (i + 1), now: startAt + i * 1000 });
  }
  return last;
}

test('keys come from the seed and the date', () => {
  expect(DAILY_ROUNDS).toBe(5);
  expect(dailyKey('daily-2026-09-07')).toBe('daily:2026-09-07');
  expect(dailyKey('friday-night')).toBeNull();
  expect(dailyKey('')).toBeNull();
  expect(dailyKeyFor(new Date(T0))).toBe('daily:2026-09-07');
});

test('the first guess on a round counts, a repeat does not, and five rounds finish the entry', async () => {
  const store = createMemoryRoomStore();
  const ada = await player(store, 'Ada');
  const first = await recordChallengeRound(store, { profileId: ada.id, key: KEY, index: 0, score: 4000, distanceKm: 12, now: T0 });
  expect(first).toMatchObject({ key: KEY, recorded: true, total: 4000, rounds: 1, finished: false, finishedAt: null });
  const again = await recordChallengeRound(store, { profileId: ada.id, key: KEY, index: 0, score: 5000, now: T0 + 500 });
  expect(again).toMatchObject({ recorded: false, total: 4000, rounds: 1 });
  const done = await play(store, ada.id, [0, 3000, 2000, 1000, 500]);
  expect(done).toMatchObject({ recorded: true, total: 4000 + 3000 + 2000 + 1000 + 500, rounds: 5, finished: true });
  expect(done.finishedAt).toBe(T0 + 4000);
  expect(store._dump().challengeRounds).toHaveLength(5);
});

test('the board ranks finished players by total, earlier finish first on a tie, and tells you your rank', async () => {
  const store = createMemoryRoomStore();
  const ada = await player(store, 'Ada');
  const grace = await player(store, 'Grace');
  const linus = await player(store, 'Linus');
  const late = await player(store, 'Late');
  await play(store, ada.id, [5000, 5000, 4000, 3000, 2000], T0); // 19,000
  await play(store, grace.id, [4000, 4000, 4000, 4000, 4000], T0 + 60000); // 20,000
  await play(store, linus.id, [5000, 5000, 4000, 3000, 2000], T0 + 120000); // 19,000, after Ada
  await play(store, late.id, [5000, 5000], T0 + 180000); // still playing

  const board = await challengeBoard(store, { key: KEY, profileId: linus.id });
  expect(board).toMatchObject({ key: KEY, rounds: 5, players: 4, finished: 3 });
  expect(board.board.map((r) => [r.rank, r.name, r.total])).toEqual([
    [1, 'Grace', 20000],
    [2, 'Ada', 19000],
    [3, 'Linus', 19000],
  ]);
  expect(board.you).toMatchObject({ name: 'Linus', total: 19000, rounds: 5, finished: true, rank: 3 });

  const unfinished = await challengeBoard(store, { key: KEY, profileId: late.id });
  expect(unfinished.you).toMatchObject({ total: 10000, rounds: 2, finished: false, rank: null });
  const stranger = await challengeBoard(store, { key: KEY, profileId: null });
  expect(stranger.you).toBeNull();
  const otherDay = await challengeBoard(store, { key: 'daily:2026-09-08', profileId: ada.id });
  expect(otherDay).toMatchObject({ players: 0, finished: 0, board: [], you: null });
});
