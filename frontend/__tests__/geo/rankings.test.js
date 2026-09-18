import { createMemoryRoomStore } from '@/app/lib/geo/server/memoryRoomStore';
import { leaderboard, profileSummary, applyRoomRatings, resolveProfile } from '@/app/lib/geo/server/profiles';
import { seasonFor } from '@/app/lib/geo/season';

const now = Date.parse('2026-09-18T12:00:00Z');
const season = seasonFor(now).key;

test('tiers use the whole pool; off-page personal rank and profile agree', async () => {
  const store = createMemoryRoomStore();
  let last;
  for (let index = 1; index <= 100; index++) {
    last = (await resolveProfile(store, { name: `Player ${index}`, now })).profile;
    await store.upsertRating(last.id, 'script', { rating: 3000 - index, games: 20, rd: 40, scoredRounds: 100, scoredPoints: 400000 }, season);
  }
  const board = await leaderboard(store, { ladder: 'script', limit: 10, profileId: last.id, now });
  expect(board.population).toBe(100);
  expect(board.rows.filter((r) => r.tier === 'Meteorite')).toHaveLength(5);
  expect(board.rows[9]).toMatchObject({ rank: 10, tier: 'Sapphire', accuracy: 0.8 });
  expect(board.you).toMatchObject({ rank: 100, tier: 'Wood' });
  const summary = await profileSummary(store, last, { now });
  expect(summary.ratings.script).toMatchObject({ rank: 100, tier: 'Wood' });
  expect(summary.ratings.duel).toMatchObject({ rank: null, tier: null });
});

test('a lone low-accuracy player cannot get Meteorite; unknown accuracy is not a pass', async () => {
  const store = createMemoryRoomStore();
  const { profile } = await resolveProfile(store, { name: 'Launch player', now });
  await store.upsertRating(profile.id, 'script', { rating: 2200, games: 100, scoredRounds: 100, scoredPoints: 500 }, season);
  let board = await leaderboard(store, { ladder: 'script', now });
  expect(board.rows[0].tier).toBe('Sapphire');
  await store.upsertRating(profile.id, 'script', { scoredRounds: 0, scoredPoints: 0 }, season);
  board = await leaderboard(store, { ladder: 'script', now });
  expect(board.rows[0]).toMatchObject({ accuracy: null, tier: 'Sapphire' });
});

test('rating ties have stable positions and never create a sixth Meteorite', async () => {
  const store = createMemoryRoomStore();
  for (let index = 0; index < 6; index++) {
    const { profile } = await resolveProfile(store, { name: `Tie ${index}`, now });
    await store.upsertRating(profile.id, 'script', { rating: 2000, games: 20, scoredRounds: 100, scoredPoints: 500000 }, season);
  }
  const first = await leaderboard(store, { ladder: 'script', now });
  const second = await leaderboard(store, { ladder: 'script', now });
  expect(first.rows.map((r) => r.profileId)).toEqual(second.rows.map((r) => r.profileId));
  expect(first.rows.filter((r) => r.tier === 'Meteorite')).toHaveLength(5);
});

test('Script results rate independently, record scored rounds not health, and cannot be applied twice', async () => {
  const store = createMemoryRoomStore();
  const a = (await resolveProfile(store, { name: 'A', now })).profile;
  const b = (await resolveProfile(store, { name: 'B', now })).profile;
  const stored = await store.createRoom({ code: 'RANKQA', status: 'finished', variant: 'duel', config: { game: 'script', rounds: 3 } });
  const room = { ...stored, players: [
    { id: 'a-seat', profileId: a.id, hp: 5000, score: 7500 },
    { id: 'b-seat', profileId: b.id, hp: 1000, score: 3000 },
  ], rounds: [
    { revealedAt: new Date(now), guesses: [{ playerId: 'a-seat', score: 5000 }, { playerId: 'b-seat', score: 3000 }] },
    { revealedAt: new Date(now), guesses: [{ playerId: 'a-seat', score: 2500 }] },
    { revealedAt: null, guesses: [] },
  ] };
  await applyRoomRatings(store, room, now);
  expect(await store.getRatings([a.id], 'duel', season)).toEqual([]);
  expect((await store.getRatings([a.id], 'script', season))[0]).toMatchObject({ games: 1, scoredRounds: 2, scoredPoints: 7500 });
  expect((await store.getRatings([b.id], 'script', season))[0]).toMatchObject({ games: 1, scoredRounds: 2, scoredPoints: 3000 });
  expect(await applyRoomRatings(store, room, now)).toBeNull();
});
