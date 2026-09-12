/**
 * Profiles and ratings on top of rooms, on the in-memory store.
 *
 * Pinned: an anonymous token becomes a profile and binds to an account
 * the first time they meet; a finished room rates its registered
 * players once and only once; the winner goes up and the loser down;
 * a player who quit loses; unregistered players are ignored; the
 * leaderboard hides players with too few games but still shows you
 * your own row.
 */

const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');
const { createRoom, joinRoom, roomAction, getRoomView, hashToken } = require('@/app/lib/geo/server/rooms');
const { seasonFor } = require('@/app/lib/geo/season');
const { resolveProfile, applyRoomRatings, leaderboard, profileSummary, LEADERBOARD_MIN_GAMES } = require('@/app/lib/geo/server/profiles');
const { RATING_DEFAULT } = require('@/app/lib/geo/rating');

const ENV_KEYS = { GOOGLE_STREET_VIEW_API_KEY: 'sv', GOOGLE_MAPS_BROWSER_KEY: 'browser' };
const savedEnv = {};
beforeAll(() => {
  for (const [k, v] of Object.entries(ENV_KEYS)) {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  }
});
afterAll(() => {
  for (const k of Object.keys(ENV_KEYS)) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

const hitFetch = async (url) => {
  const [lat, lng] = new URL(url).searchParams.get('location').split(',').map(Number);
  return { status: 200, json: async () => ({ status: 'OK', pano_id: `pano-${lat.toFixed(3)}-${lng.toFixed(3)}`, location: { lat, lng }, copyright: '© Google' }) };
};
const T0 = Date.parse('2026-09-07T12:00:00Z');
// Every fixture here is written at T0, and ratings are per season. Read
// them back through the wall clock and they vanish on 1 December 2026,
// when the season the rows were written in stops being the current one
// (found in the deep audit: four tests were set to go red on a date).
const SEASON = seasonFor(T0).key;
const sec = (n) => n * 1000;

async function profileFor(store, name, extra = {}) {
  return resolveProfile(store, { name, now: T0, ...extra });
}

/** Play a whole classic game: `winner` guesses exactly, the others guess far away. */
async function playGame(store, { players, winnerIndex = 0, rounds = 3, now = T0, leaveIndex = null }) {
  const host = await createRoom(store, { name: 'Ranked', hostName: players[0].name, settings: { rounds, time: 30 }, profileId: players[0].profileId, now });
  const tokens = [host.token];
  for (const p of players.slice(1)) {
    const joined = await joinRoom(store, { code: host.room.code, name: p.name, profileId: p.profileId, now });
    tokens.push(joined.token);
  }
  await roomAction(store, { code: host.room.code, token: tokens[0], action: 'start', now, fetchImpl: hitFetch });
  let t = now;
  for (let r = 0; r < rounds; r++) {
    const room = await store.getRoomByCode(host.room.code);
    const round = room.rounds.find((x) => x.index === room.roundIndex);
    for (let i = 0; i < players.length; i++) {
      if (leaveIndex === i && r === 1) {
        await roomAction(store, { code: host.room.code, token: tokens[i], action: 'leave', now: t, fetchImpl: hitFetch });
        continue;
      }
      if (leaveIndex === i && r > 1) continue;
      t += sec(1);
      const guess = i === winnerIndex ? { lat: round.lat, lng: round.lng } : { lat: round.lat, lng: ((round.lng + 360) % 360) - 180 };
      await roomAction(store, { code: host.room.code, token: tokens[i], action: 'guess', body: guess, now: t, fetchImpl: hitFetch }).catch(() => {});
    }
    t += sec(31);
    await getRoomView(store, { code: host.room.code, now: t, fetchImpl: hitFetch });
    t += sec(13);
    await getRoomView(store, { code: host.room.code, now: t, fetchImpl: hitFetch });
  }
  const final = await getRoomView(store, { code: host.room.code, token: tokens[0], now: t, fetchImpl: hitFetch });
  return { code: host.room.code, tokens, final, now: t };
}

describe('profiles', () => {
  test('a new browser gets a token; the same token finds the same profile; a name change sticks', async () => {
    const store = createMemoryRoomStore();
    const first = await profileFor(store, 'Ada');
    expect(first.created).toBe(true);
    expect(first.token).toBeTruthy();
    expect(first.profile.tokenHash).toBe(hashToken(first.token));
    const again = await resolveProfile(store, { token: first.token, name: 'Ada L', now: T0 + sec(5) });
    expect(again.created).toBe(false);
    expect(again.token).toBeNull();
    expect(again.profile.id).toBe(first.profile.id);
    expect(again.profile.name).toBe('Ada L');
    expect((await resolveProfile(store, { token: 'unknown', createIfMissing: false })).profile).toBeNull();
  });

  test('signing in binds the anonymous profile to the account, and the account wins from then on', async () => {
    // The account is the game's own (server/accounts.js), never a
    // ReunitePets user: docs/WANDERGUESSER_SPLIT.md, D1.
    const store = createMemoryRoomStore();
    const anon = await profileFor(store, 'Guest');
    const bound = await resolveProfile(store, { token: anon.token, accountId: 'acct_1', name: 'Guest', now: T0 });
    expect(bound.profile.id).toBe(anon.profile.id);
    expect(bound.profile.accountId).toBe('acct_1');
    // another device, signed in, no token: same profile
    const other = await resolveProfile(store, { accountId: 'acct_1', now: T0 });
    expect(other.profile.id).toBe(anon.profile.id);
    // a second anonymous token from that device does not replace the
    // account's profile, and is not folded into it either: merging two
    // rating histories has no right answer.
    const stray = await profileFor(store, 'Stray');
    const merged = await resolveProfile(store, { token: stray.token, accountId: 'acct_1', now: T0 });
    expect(merged.profile.id).toBe(anon.profile.id);
    expect((await store.getProfileByTokenHash(hashToken(stray.token))).id).toBe(stray.profile.id);
  });

  test('the summary carries a default rating per ladder before any game', async () => {
    const store = createMemoryRoomStore();
    const { profile } = await profileFor(store, 'Ada');
    const summary = await profileSummary(store, profile, { now: T0 });
    expect(summary.ratings.classic).toMatchObject({ value: RATING_DEFAULT, games: 0, provisional: true, tier: 'Silver' });
    expect(summary.ratings.duel.value).toBe(RATING_DEFAULT);
    expect(summary.recent).toEqual([]);
  });
});

describe('rating a finished room', () => {
  test('winner up, loser down, applied once, visible in the final standings', async () => {
    const store = createMemoryRoomStore();
    const ada = (await profileFor(store, 'Ada')).profile;
    const grace = (await profileFor(store, 'Grace')).profile;
    const { code, final } = await playGame(store, { players: [{ name: 'Ada', profileId: ada.id }, { name: 'Grace', profileId: grace.id }] });
    expect(final.room.status).toBe('finished');
    const adaRow = final.players.find((p) => p.name === 'Ada');
    const graceRow = final.players.find((p) => p.name === 'Grace');
    expect(adaRow.placement).toBe(1);
    expect(adaRow.ratingDelta).toBeGreaterThan(0);
    expect(graceRow.ratingDelta).toBeLessThan(0);
    expect(adaRow.ratingAfter).toBe(RATING_DEFAULT + adaRow.ratingDelta);

    const [adaRating] = await store.getRatings([ada.id], 'classic', SEASON);
    expect(adaRating).toMatchObject({ games: 1, wins: 1, podiums: 1, streak: 1 });
    expect(adaRating.rating).toBeGreaterThan(RATING_DEFAULT);
    expect(adaRating.rd).toBeLessThan(350);

    // a second application is a no-op
    const room = await store.getRoomByCode(code);
    expect(await applyRoomRatings(store, room, T0)).toBeNull();
    expect(store._dump().results).toHaveLength(2);
  });

  test('a player who quits loses to those who stayed; an unregistered player is not rated', async () => {
    const store = createMemoryRoomStore();
    const ada = (await profileFor(store, 'Ada')).profile;
    const grace = (await profileFor(store, 'Grace')).profile;
    const { final } = await playGame(store, {
      players: [{ name: 'Ada', profileId: ada.id }, { name: 'Grace', profileId: grace.id }, { name: 'Anon', profileId: null }],
      winnerIndex: 2,
      leaveIndex: 1,
    });
    expect(final.room.status).toBe('finished');
    const results = store._dump().results;
    expect(results.map((r) => r.profileId).sort()).toEqual([ada.id, grace.id].sort());
    const graceResult = results.find((r) => r.profileId === grace.id);
    const adaResult = results.find((r) => r.profileId === ada.id);
    expect(graceResult.ratingAfter).toBeLessThan(graceResult.ratingBefore);
    expect(adaResult.ratingAfter).toBeGreaterThan(adaResult.ratingBefore);
    expect(graceResult.placement).toBeGreaterThan(adaResult.placement);
    expect(final.players.find((p) => p.name === 'Anon').ratingDelta).toBeNull();
  });

  test('duels rate on their own ladder', async () => {
    const store = createMemoryRoomStore();
    const ada = (await profileFor(store, 'Ada')).profile;
    const grace = (await profileFor(store, 'Grace')).profile;
    const host = await createRoom(store, { name: 'Duel', hostName: 'Ada', settings: { variant: 'duel', rounds: 3, time: 30 }, profileId: ada.id, now: T0 });
    const joined = await joinRoom(store, { code: host.room.code, name: 'Grace', profileId: grace.id, now: T0 });
    await roomAction(store, { code: host.room.code, token: host.token, action: 'start', now: T0, fetchImpl: hitFetch });
    let t = T0;
    for (let r = 0; r < 3; r++) {
      const room = await store.getRoomByCode(host.room.code);
      if (room.status === 'finished') break;
      const round = room.rounds.find((x) => x.index === room.roundIndex);
      t += sec(1);
      await roomAction(store, { code: host.room.code, token: host.token, action: 'guess', body: { lat: round.lat, lng: round.lng }, now: t, fetchImpl: hitFetch });
      await roomAction(store, { code: host.room.code, token: joined.token, action: 'guess', body: { lat: round.lat, lng: ((round.lng + 360) % 360) - 180 }, now: t, fetchImpl: hitFetch });
      t += sec(14);
      await getRoomView(store, { code: host.room.code, now: t, fetchImpl: hitFetch });
    }
    const final = await getRoomView(store, { code: host.room.code, token: host.token, now: t, fetchImpl: hitFetch });
    expect(final.room.status).toBe('finished');
    expect((await store.getRatings([ada.id], 'duel', SEASON))[0].games).toBe(1);
    expect(await store.getRatings([ada.id], 'classic', SEASON)).toEqual([]);
  });

  test('the leaderboard shows settled players, ranks them, and still shows you when you are new', async () => {
    const store = createMemoryRoomStore();
    const ada = (await profileFor(store, 'Ada')).profile;
    const grace = (await profileFor(store, 'Grace')).profile;
    const linus = (await profileFor(store, 'Linus')).profile;
    let now = T0;
    for (let i = 0; i < LEADERBOARD_MIN_GAMES; i++) {
      const played = await playGame(store, { players: [{ name: 'Ada', profileId: ada.id }, { name: 'Grace', profileId: grace.id }], now });
      now = played.now + sec(60);
    }
    const board = await leaderboard(store, { ladder: 'classic', profileId: linus.id, now: T0 });
    expect(board.rows.map((r) => r.name)).toEqual(['Ada', 'Grace']);
    expect(board.rows[0].rank).toBe(1);
    expect(board.rows[0].value).toBeGreaterThan(board.rows[1].value);
    expect(board.rows[0].games).toBe(LEADERBOARD_MIN_GAMES);
    expect(board.you).toMatchObject({ rank: null, name: 'Linus', games: 0, provisional: true });
    const adaSummary = await profileSummary(store, ada, { now: T0 });
    expect(adaSummary.recent).toHaveLength(LEADERBOARD_MIN_GAMES);
    expect(adaSummary.recent[0].delta).toBeGreaterThan(0);
    expect(adaSummary.ratings.classic.streak).toBe(LEADERBOARD_MIN_GAMES);
  });
});
