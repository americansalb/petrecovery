/**
 * Points and cosmetics (app/lib/geo/points.js, items.js, server/points.js).
 *
 * Pinned: the earning rules; the ledger pays each event once and keeps
 * the balance; the first round of the day, the country badge once per
 * country, the daily cap; room rounds and finishes through the engine;
 * the shop refuses what you cannot afford or may not wear, and wears
 * what you buy.
 */

const { POINTS, roundPoints, roomRoundPoints, roomFinishPoints, badgeEarned, earningAllowed } = require('@/app/lib/geo/points');
const { ITEMS, itemById, canUse, canBuy, normalizeEquipped, equippedView, reactionsFor, allReactionEmoji, defaultEquipped } = require('@/app/lib/geo/items');
const { grant, spend, awardSoloRound, awardRoomRound, awardRoomFinish, shopView, buyItem, equipItem, bestTier, ShopError } = require('@/app/lib/geo/server/points');
const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');
const { resolveProfile } = require('@/app/lib/geo/server/profiles');
const { createRoom, joinRoom, roomAction, getRoomView } = require('@/app/lib/geo/server/rooms');
const { recordRound } = require('@/app/lib/geo/server/meter');
const { REACTION_EMOJI } = require('@/app/lib/geo/rooms');

const T0 = Date.parse('2026-09-07T12:00:00Z');
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

async function player(store, name) {
  return (await resolveProfile(store, { name, now: T0 })).profile;
}
const pinResult = (over = {}) => ({ kind: 'pin', mode: 'world', seed: 'seed-1', roundIndex: 0, score: 5000, distanceKm: 0.5, answer: { country: { code: 'FR', name: 'France', flag: '🇫🇷' } }, ...over });

describe('the rules', () => {
  test('rounds pay a base plus accuracy, the daily double, streaks per country', () => {
    expect(roundPoints({ score: 0 })).toBe(POINTS.roundBase);
    expect(roundPoints({ score: 5000 })).toBe(POINTS.roundBase + POINTS.roundBonusMax);
    expect(roundPoints({ score: 2500 })).toBe(POINTS.roundBase + 4);
    expect(roundPoints({ score: 5000, mode: 'daily' })).toBe((POINTS.roundBase + POINTS.roundBonusMax) * POINTS.dailyMultiplier);
    expect(roundPoints({ kind: 'streak', correct: true })).toBe(POINTS.streakCorrect);
    expect(roundPoints({ kind: 'streak', correct: false })).toBe(0);
    expect(roomRoundPoints(5000)).toBe(POINTS.roomRoundBase + POINTS.roomRoundBonusMax);
    expect(roomFinishPoints({ placement: 1 })).toBe(30);
    expect(roomFinishPoints({ placement: 2 })).toBe(20);
    expect(roomFinishPoints({ placement: 4 })).toBe(POINTS.roomOther);
    expect(roomFinishPoints({ placement: 1, isDuel: true })).toBe(30 + POINTS.duelWin);
    expect(roomFinishPoints({ placement: 1, left: true })).toBe(0);
    expect(badgeEarned(99.9)).toBe(true);
    expect(badgeEarned(100.1)).toBe(false);
    expect(badgeEarned(null)).toBe(false);
    expect(earningAllowed(50)).toBe(true);
    expect(earningAllowed(51)).toBe(false);
  });

  test('the catalog: free, bought, or tier-unlocked; slots normalize to what you may wear', () => {
    expect(ITEMS.every((i) => i.id && i.kind && typeof i.price === 'number')).toBe(true);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    expect(canUse(itemById('pin-classic'), {})).toBe(true);
    expect(canUse(itemById('pin-star'), {})).toBe(false);
    expect(canUse(itemById('pin-star'), { owned: ['pin-star'] })).toBe(true);
    expect(canUse(itemById('title-gold'), { tier: 'Silver' })).toBe(false);
    expect(canUse(itemById('title-gold'), { tier: 'Platinum' })).toBe(true);
    expect(canBuy(itemById('pin-star'), { points: 1499 })).toBe(false);
    expect(canBuy(itemById('pin-star'), { points: 1500 })).toBe(true);
    expect(canBuy(itemById('title-gold'), { points: 99999 })).toBe(false);
    expect(canBuy(itemById('pin-star'), { points: 99999, owned: ['pin-star'] })).toBe(false);
    expect(normalizeEquipped({ pin: 'pin-star', color: 'color-sky', title: 'title-gold', frame: 'nope' }, { owned: ['color-sky'], tier: 'Gold' })).toEqual({
      ...defaultEquipped(),
      color: 'color-sky',
      title: 'title-gold',
    });
    expect(normalizeEquipped({ pin: 'color-sky' }, { owned: ['color-sky'] }).pin).toBe('pin-classic');
    expect(equippedView({ pin: 'pin-diamond', color: 'color-rose', title: 'title-wanderer', frame: 'frame-gold' })).toEqual({
      pin: { id: 'pin-diamond', style: 'diamond', fill: '#38bdf8' },
      color: '#f472b6',
      title: 'Wanderer',
      frame: '#facc15',
    });
    expect(equippedView(null).pin.id).toBe('pin-classic');
    expect(reactionsFor(REACTION_EMOJI, [])).toEqual(REACTION_EMOJI);
    expect(reactionsFor(REACTION_EMOJI, ['reactions-party'])).toEqual([...REACTION_EMOJI, '🎉', '🍕', '🚀', '🐢']);
    expect(allReactionEmoji(REACTION_EMOJI)).toContain('🧭');
  });
});

describe('the ledger', () => {
  test('pays each event once, keeps the balance, and spends only what is there', async () => {
    const store = createMemoryRoomStore();
    const ada = await player(store, 'Ada');
    expect((await grant(store, { profileId: ada.id, amount: 40, reason: 'Test', ref: 'a', now: T0 })).amount).toBe(40);
    expect(await grant(store, { profileId: ada.id, amount: 40, reason: 'Test', ref: 'a', now: T0 })).toBeNull();
    expect(await grant(store, { profileId: ada.id, amount: 0, reason: 'Nothing', ref: 'b', now: T0 })).toBeNull();
    expect((await store.getProfileById(ada.id)).points).toBe(40);
    expect(await spend(store, { profileId: ada.id, amount: 50, reason: 'Too much', ref: 'c', now: T0 })).toBe(false);
    expect(await spend(store, { profileId: ada.id, amount: 30, reason: 'Fine', ref: 'd', now: T0 })).toBe(true);
    expect(await spend(store, { profileId: ada.id, amount: 5, reason: 'Again', ref: 'd', now: T0 })).toBe(false);
    expect((await store.getProfileById(ada.id)).points).toBe(10);
    expect(store._dump().ledger.map((r) => [r.kind, r.amount])).toEqual([['earn', 40], ['spend', 30]]);
  });

  test('a round without a seed cannot be replayed for points', async () => {
    // Found in the pre-launch audit. The ledger's idempotency key used
    // to be built from the wall clock when a round carried no seed, so
    // replaying one guess token minted a fresh key every time. The play
    // meter did not stop it either: it counts rounds created, not
    // guesses, so the daily earning cap never moved. One round, a
    // twelve-hour token and a loop was unlimited points.
    //
    // The lobby always sends a seed, so nobody playing normally could
    // hit this; it took a hand-made request. That is not a reason to
    // leave it.
    const store = createMemoryRoomStore();
    const ada = await player(store, 'Ada');
    const subjects = { profileId: ada.id, signedIn: false, ipHash: null };
    await recordRound(store, { subjects, provider: 'google', source: 'free', now: T0 });

    const seedless = pinResult({ seed: '' });
    const token = 'g1.the-same-sealed-token-every-time';
    const first = await awardSoloRound(store, { profileId: ada.id, result: seedless, token, now: T0 });
    expect(first.earned).toBeGreaterThan(0);

    // Same round, same token, later clock: nothing.
    for (const later of [T0 + 1000, T0 + 60000, T0 + 3600000]) {
      const replay = await awardSoloRound(store, { profileId: ada.id, result: seedless, token, now: later });
      expect(replay.earned).toBe(0);
    }
    expect((await store.getProfileById(ada.id)).points).toBe(first.earned);

    // A genuinely different round still pays.
    await recordRound(store, { subjects, provider: 'google', source: 'free', now: T0 });
    const other = await awardSoloRound(store, {
      profileId: ada.id,
      result: pinResult({ seed: '', roundIndex: 1, score: 3000 }),
      token: 'g1.a-different-round-entirely',
      now: T0 + 2000,
    });
    expect(other.earned).toBeGreaterThan(0);
  });

  test('an Apple round pays once, though it hands out twelve tokens', async () => {
    // Found in the deep audit. An Apple round issues one sealed token
    // per candidate place, all for the same round, and the ledger was
    // keyed by the token: twelve grants for one round, while the play
    // meter, which counts rounds created, moved by one. Every candidate
    // carries its own plaintext coordinate, so all twelve scored 5,000.
    const store = createMemoryRoomStore();
    const ada = await player(store, 'Ada');
    const subjects = { profileId: ada.id, signedIn: false, ipHash: null };
    await recordRound(store, { subjects, provider: 'apple', source: 'apple', now: T0 });

    const roundId = 'one-round';
    let paid = 0;
    for (let candidate = 0; candidate < 12; candidate++) {
      const result = pinResult({ seed: '', roundId, answer: { lat: 48 + candidate, lng: 2 + candidate, country: { code: 'FR', name: 'France', flag: '🇫🇷' } } });
      const row = await awardSoloRound(store, { profileId: ada.id, result, token: `g1.candidate-${candidate}`, now: T0 + candidate });
      paid += row.earned;
    }
    // the round once, the first of the day once, the badge once
    expect(paid).toBe(POINTS.roundBase + POINTS.roundBonusMax + POINTS.firstOfDay + POINTS.badge);
  });

  test('a solo round: the round, the first of the day, a badge once per country, and the cap after 50 rounds', async () => {
    const store = createMemoryRoomStore();
    const ada = await player(store, 'Ada');
    const subjects = { profileId: ada.id, signedIn: false, ipHash: null };
    await recordRound(store, { subjects, provider: 'google', source: 'free', now: T0 });
    const first = await awardSoloRound(store, { profileId: ada.id, result: pinResult(), now: T0 });
    expect(first.earned).toBe(POINTS.roundBase + POINTS.roundBonusMax + POINTS.firstOfDay + POINTS.badge);
    expect(first.badge).toMatchObject({ countryCode: 'FR', name: 'France' });
    expect(first.balance).toBe(first.earned);
    expect(first.lines.map((l) => l.reason)).toEqual(['Round', 'First round of the day', 'Badge: France']);

    // the same round again pays nothing; another French guess earns no second badge but keeps the best distance
    const again = await awardSoloRound(store, { profileId: ada.id, result: pinResult(), now: T0 + 1000 });
    expect(again.earned).toBe(0);
    await recordRound(store, { subjects, provider: 'google', source: 'free', now: T0 });
    const second = await awardSoloRound(store, { profileId: ada.id, result: pinResult({ roundIndex: 1, score: 3000, distanceKm: 40 }), now: T0 + 2000 });
    expect(second.badge).toBeNull();
    expect(second.earned).toBe(roundPoints({ score: 3000 }));
    expect((await store.listBadges(ada.id))[0].bestKm).toBe(0.5);

    // past 50 rounds today, rounds stop earning; badges still count
    await store.bumpUsage(`profile:${ada.id}`, '2026-09-07', 'google', { rounds: 60, free: 0, paid: 0 });
    const capped = await awardSoloRound(store, { profileId: ada.id, result: pinResult({ roundIndex: 2, answer: { country: { code: 'JP', name: 'Japan', flag: '🇯🇵' } } }), now: T0 + 3000 });
    expect(capped.allowed).toBe(false);
    expect(capped.earned).toBe(POINTS.badge);
    expect(capped.badge.countryCode).toBe('JP');
    // a timed-out round far away earns the base only, never a badge
    const store2 = createMemoryRoomStore();
    const grace = await player(store2, 'Grace');
    const miss = await awardSoloRound(store2, { profileId: grace.id, result: pinResult({ score: 0, distanceKm: 900, seed: 's2' }), now: T0 });
    expect(miss.badge).toBeNull();
    expect(miss.earned).toBe(POINTS.roundBase + POINTS.firstOfDay);
  });

  test('a room pays each round to those who guessed, and the finish by placement, once', async () => {
    const store = createMemoryRoomStore();
    const ada = await player(store, 'Ada');
    const grace = await player(store, 'Grace');
    const host = await createRoom(store, { name: 'Pts', hostName: 'Ada', settings: { rounds: 3, time: 30 }, profileId: ada.id, now: T0 });
    const joined = await joinRoom(store, { code: host.room.code, name: 'Grace', profileId: grace.id, now: T0 });
    await roomAction(store, { code: host.room.code, token: host.token, action: 'start', now: T0, fetchImpl: hitFetch });
    let t = T0;
    for (let r = 0; r < 3; r++) {
      // both browsers poll, so nobody counts as away when the other guesses
      for (const token of [host.token, joined.token]) await getRoomView(store, { code: host.room.code, token, now: t, fetchImpl: hitFetch });
      const room = await store.getRoomByCode(host.room.code);
      const round = room.rounds.find((x) => x.index === room.roundIndex);
      t += 1000;
      await roomAction(store, { code: host.room.code, token: host.token, action: 'guess', body: { lat: round.lat, lng: round.lng }, now: t, fetchImpl: hitFetch });
      if (r < 2) await roomAction(store, { code: host.room.code, token: joined.token, action: 'guess', body: { lat: round.lat, lng: ((round.lng + 360) % 360) - 180 }, now: t, fetchImpl: hitFetch });
      t += 31000;
      await getRoomView(store, { code: host.room.code, now: t, fetchImpl: hitFetch });
      t += 13000;
      await getRoomView(store, { code: host.room.code, now: t, fetchImpl: hitFetch });
    }
    const final = await getRoomView(store, { code: host.room.code, token: host.token, now: t, fetchImpl: hitFetch });
    expect(final.room.status).toBe('finished');
    const adaRow = final.players.find((p) => p.name === 'Ada');
    const graceRow = final.players.find((p) => p.name === 'Grace');
    expect(adaRow.pointsEarned).toBe(3 * roomRoundPoints(5000) + 30);
    expect(graceRow.pointsEarned).toBeGreaterThanOrEqual(20); // two far guesses plus second place; the third round timed out
    expect((await store.getProfileById(ada.id)).points).toBe(adaRow.pointsEarned);
    const refs = store._dump().ledger.map((r) => r.ref);
    expect(new Set(refs).size).toBe(refs.length);
    expect(refs.filter((r) => r.startsWith('roomfinish:'))).toHaveLength(2);
    // reactions from a pack are allowed once owned; unknown emoji never
    await expect(roomAction(store, { code: host.room.code, token: host.token, action: 'react', body: { emoji: '💩' }, now: t })).rejects.toMatchObject({ code: 'bad_reaction' });
    expect(final.me.reactions).toEqual(REACTION_EMOJI);
    expect(adaRow.cosmetics.pin.id).toBe('pin-classic');
  });

  test('the daily earning cap holds for finishing a room, not only for its rounds', async () => {
    // Placement and the duel win are the biggest single awards in the
    // economy and were the only ones outside the cap. Apple rooms have
    // no allowance at all, so two profiles could finish short duels all
    // night and take 70 uncapped points a room.
    const store = createMemoryRoomStore();
    const ada = await player(store, 'Ada');
    const grace = await player(store, 'Grace');
    await store.bumpUsage(`profile:${ada.id}`, '2026-09-07', 'apple', { rounds: 60, free: 0, paid: 0 });
    const room = {
      id: 'room-capped',
      variant: 'classic',
      players: [
        { id: 'p1', profileId: ada.id, score: 9000, leftAt: null },
        { id: 'p2', profileId: grace.id, score: 4000, leftAt: null },
      ],
    };
    const paid = await awardRoomFinish(store, room, T0);
    expect(paid.p1).toBeUndefined();
    expect(paid.p2).toBe(roomFinishPoints({ placement: 2 }));
  });
});

describe('the shop', () => {
  test('buying takes points and wears the item; equipping needs ownership or the tier; the view says what is affordable', async () => {
    const store = createMemoryRoomStore();
    const ada = await player(store, 'Ada');
    await grant(store, { profileId: ada.id, amount: 600, reason: 'Seed', ref: 'seed', now: T0 });
    let shop = await shopView(store, ada);
    expect(shop.points).toBe(600);
    expect(shop.equipped).toEqual(defaultEquipped());
    expect(shop.items.find((i) => i.id === 'pin-ring')).toMatchObject({ owned: false, usable: false, affordable: true });
    expect(shop.items.find((i) => i.id === 'pin-star').affordable).toBe(false);

    shop = await buyItem(store, ada, 'pin-ring', T0);
    expect(shop.points).toBe(300);
    expect(shop.owned).toEqual(['pin-ring']);
    expect(shop.equipped.pin).toBe('pin-ring');
    expect(shop.view.pin.style).toBe('ring');
    await expect(buyItem(store, ada, 'pin-ring', T0)).rejects.toMatchObject({ code: 'owned' });
    await expect(buyItem(store, ada, 'pin-star', T0)).rejects.toMatchObject({ code: 'short', status: 402 });
    await expect(buyItem(store, ada, 'title-gold', T0)).rejects.toMatchObject({ code: 'not_for_sale' });
    await expect(buyItem(store, ada, 'nope', T0)).rejects.toBeInstanceOf(ShopError);
    expect((await store.getProfileById(ada.id)).points).toBe(300);

    shop = await equipItem(store, ada, 'pin-classic');
    expect(shop.equipped.pin).toBe('pin-classic');
    await expect(equipItem(store, ada, 'pin-star')).rejects.toMatchObject({ code: 'not_owned', status: 403 });
    await expect(equipItem(store, ada, 'title-gold')).rejects.toMatchObject({ code: 'not_owned' });
    await store.upsertRating(ada.id, 'duel', { rating: 1600, rd: 60, games: 10 });
    expect(await bestTier(store, ada.id)).toBe('Gold');
    shop = await equipItem(store, ada, 'title-gold');
    expect(shop.view.title).toBe('Gold');
    shop = await buyItem(store, ada, 'reactions-party', T0);
    expect(shop.points).toBe(50);
    expect(shop.equipped).toMatchObject({ pin: 'pin-classic', title: 'title-gold' });
    expect(shop.items.find((i) => i.id === 'reactions-party').owned).toBe(true);
  });
});
