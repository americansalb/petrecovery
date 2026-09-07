/**
 * Seasons (app/lib/geo/season.js, app/lib/geo/server/profiles.js).
 *
 * Pinned: three-month seasons from 1 September 2026; a rating carried
 * into a new season goes halfway back to 1500 with a wider uncertainty;
 * last season's tier pays points once; the leaderboard is per season.
 */

const { seasonFor, seasonByKey, previousSeasonKey, carryRating, seasonReward, daysLeft, SEASON_REWARDS } = require('@/app/lib/geo/season');
const { ensureSeasonRows, leaderboard, profileSummary, resolveProfile } = require('@/app/lib/geo/server/profiles');
const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');

const T0 = Date.parse('2026-09-07T12:00:00Z');

test('seasons run three months from September 2026, with a season 0 before', () => {
  expect(seasonFor(T0)).toMatchObject({ number: 1, key: 's1', startsAt: Date.UTC(2026, 8, 1), endsAt: Date.UTC(2026, 11, 1), label: 'Season 1: Sep to Nov 2026' });
  expect(seasonFor(Date.UTC(2026, 11, 1)).key).toBe('s2');
  expect(seasonFor(Date.UTC(2027, 2, 15))).toMatchObject({ key: 's3', label: 'Season 3: Mar to May 2027' });
  expect(seasonFor(Date.UTC(2026, 7, 31)).key).toBe('s0');
  expect(previousSeasonKey('s1')).toBe('s0');
  expect(previousSeasonKey('s0')).toBeNull();
  expect(seasonByKey('nope')).toBeNull();
  expect(daysLeft(seasonFor(T0), T0)).toBe(85);
});

test('a carried rating goes halfway back to 1500 with the uncertainty widened; rewards need three games', () => {
  expect(carryRating(1700, 60)).toEqual({ rating: 1600, rd: 200 });
  expect(carryRating(1300, 300)).toEqual({ rating: 1400, rd: 300 });
  expect(seasonReward('Platinum', 3)).toBe(SEASON_REWARDS.Platinum);
  expect(seasonReward('Platinum', 2)).toBe(0);
  expect(seasonReward('Bronze', 20)).toBe(0);
  expect(seasonReward('Grandmaster', 50)).toBe(800);
});

test('first sight in a new season carries last season in and pays its reward once; the board is per season', async () => {
  const store = createMemoryRoomStore();
  const ada = (await resolveProfile(store, { name: 'Ada', now: T0 })).profile;
  const grace = (await resolveProfile(store, { name: 'Grace', now: T0 })).profile;
  await store.upsertRating(ada.id, 'classic', { rating: 1720, rd: 55, games: 12, wins: 7, podiums: 9, peak: 1750, streak: 2, lastPlayedAt: new Date(T0 - 86400000) }, 's0');
  await store.upsertRating(grace.id, 'classic', { rating: 1650, rd: 90, games: 2, wins: 1, podiums: 1, peak: 1650, streak: 1 }, 's0');

  const rows = await ensureSeasonRows(store, [ada.id, grace.id], 'classic', T0);
  expect(rows).toHaveLength(2);
  const adaRow = rows.find((r) => r.profileId === ada.id);
  expect(adaRow).toMatchObject({ season: 's1', rating: 1610, rd: 200, games: 0, wins: 0, streak: 0 });
  expect(rows.find((r) => r.profileId === grace.id)).toMatchObject({ season: 's1', rating: 1575, rd: 200, games: 0 });
  // Ada was Platinum with enough games: 200 points; Grace played two games: nothing
  expect((await store.getProfileById(ada.id)).points).toBe(SEASON_REWARDS.Platinum);
  expect((await store.getProfileById(grace.id)).points).toBe(0);
  const ledger = store._dump().ledger;
  expect(ledger).toHaveLength(1);
  expect(ledger[0]).toMatchObject({ profileId: ada.id, amount: 200, ref: 'season:s0:classic', reason: 'Season 0 classic: Platinum' });

  // seen again: nothing changes, nothing is paid twice
  const again = await ensureSeasonRows(store, [ada.id], 'classic', T0 + 1000);
  expect(again[0].rating).toBe(1610);
  expect(store._dump().ledger).toHaveLength(1);
  // a ladder never played carries nothing
  expect(await ensureSeasonRows(store, [ada.id], 'duel', T0)).toEqual([]);

  // the board lists this season's rows only, and knows the season
  await store.upsertRating(ada.id, 'classic', { games: 5 }, 's1');
  const board = await leaderboard(store, { ladder: 'classic', profileId: grace.id, now: T0 });
  expect(board.season).toMatchObject({ key: 's1', label: 'Season 1: Sep to Nov 2026', daysLeft: 85 });
  expect(board.rows.map((r) => r.name)).toEqual(['Ada']);
  expect(board.you).toMatchObject({ name: 'Grace', rank: null, rating: 1575 });
  const summary = await profileSummary(store, grace);
  expect(summary.ratings.classic.rating).toBe(1575);
  expect(summary.season.key).toBe('s1');
});
