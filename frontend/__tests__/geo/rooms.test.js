/**
 * Multiplayer rooms, end to end on the in-memory store.
 *
 * What is pinned here: the answer never leaves the server before the
 * reveal, everyone is scored on one clock, a duel ends at the last
 * player standing, two polls racing to reveal a round apply it once,
 * a stalled round build recovers, and seeded rounds come from the
 * cache the second time.
 */

const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');
const { createMemoryRoundCache } = require('@/app/lib/geo/server/roundCache');
const { createRoom, joinRoom, roomAction, getRoomView, listRooms, tick, RoomError, hashToken, LOCATING_TIMEOUT_MS } = require('@/app/lib/geo/server/rooms');
const { createRound, APPLE_CANDIDATES_PER_ROUND } = require('@/app/lib/geo/server/game');
const rules = require('@/app/lib/geo/rooms');

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

/** Every point has official imagery; the panorama id encodes the point. */
const hitFetch = jest.fn(async (url) => {
  const [lat, lng] = new URL(url).searchParams.get('location').split(',').map(Number);
  return { status: 200, json: async () => ({ status: 'OK', pano_id: `pano-${lat.toFixed(3)}-${lng.toFixed(3)}`, location: { lat, lng }, copyright: '© Google', date: '2024-01' }) };
});
const noFetch = jest.fn(async () => ({ status: 200, json: async () => ({ status: 'ZERO_RESULTS' }) }));

const T0 = Date.parse('2026-09-07T12:00:00Z');
const sec = (n) => n * 1000;

async function setupRoom({ settings = {}, players = ['Ada', 'Grace'], now = T0 } = {}) {
  const store = createMemoryRoomStore();
  // Google unless a test says Apple: the fake fetch is a Street View probe.
  const host = await createRoom(store, { name: 'Friday night', hostName: players[0], settings: { provider: 'google', rounds: 3, time: 60, ...settings }, now });
  const others = [];
  for (const name of players.slice(1)) others.push(await joinRoom(store, { code: host.room.code, name, now }));
  return { store, code: host.room.code, host, others, tokens: [host.token, ...others.map((o) => o.token)] };
}

async function answerOf(store, code) {
  const room = await store.getRoomByCode(code);
  const round = room.rounds.find((r) => r.index === room.roundIndex);
  return round ? { lat: round.lat, lng: round.lng } : null;
}

describe('rules', () => {
  test('room codes avoid look-alikes and normalize from sloppy input', () => {
    const code = rules.roomCode();
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(rules.normalizeRoomCode(' ab-cd 23 ')).toBe('ABCD23');
    expect(rules.normalizeRoomCode('abc')).toBe('');
  });

  test('names are printable, short, and never empty', () => {
    expect(rules.sanitizeName('  Ada   Lovelace  ')).toBe('Ada Lovelace');
    expect(rules.sanitizeName('x'.repeat(50))).toHaveLength(20);
    expect(rules.sanitizeName('')).toBe('Player');
    expect(rules.sanitizeName('tab\there')).toBe('tabhere');
    expect(rules.initials('Ada Lovelace')).toBe('AL');
    expect(rules.initials('grace')).toBe('GR');
  });

  test('room settings force a timer and a mode the imagery supports', () => {
    const { config, variant, visibility } = rules.normalizeRoomConfig({ provider: 'bing', mode: 'streak', time: 7, rounds: 4, variant: 'duel', visibility: 'private' });
    expect(config).toMatchObject({ provider: 'apple', mode: 'balanced', time: 60, rounds: 5 });
    expect(variant).toBe('duel');
    expect(visibility).toBe('private');
    expect(rules.normalizeRoomConfig({ mode: 'country', region: 'jp', time: 90, rounds: 10 }).config).toMatchObject({ mode: 'country', region: 'JP', time: 90, rounds: 10 });
    // Apple Look Around rooms play the modes Apple imagery covers; City
    // streets is Google's name for what every Apple mode already is.
    expect(rules.normalizeRoomConfig({ provider: 'apple', mode: 'world', time: 90 }).config).toMatchObject({ provider: 'apple', mode: 'world', time: 90 });
    expect(rules.normalizeRoomConfig({ provider: 'apple', mode: 'cities' }).config).toMatchObject({ provider: 'apple', mode: 'balanced' });
    expect(rules.normalizeRoomConfig({ provider: 'google', mode: 'cities' }).config).toMatchObject({ provider: 'google', mode: 'cities' });
  });

  test('the rules line names the places, the format when it is not moving, and Apple imagery', () => {
    expect(rules.describeRoomRules({ mode: 'balanced', move: true, pan: true, zoom: true })).toBe('World, balanced');
    expect(rules.describeRoomRules({ mode: 'country', region: 'JP', move: false, pan: true, zoom: true }, { regionLabel: 'Japan' })).toBe('Country: Japan, No Move');
    expect(rules.describeRoomRules({ provider: 'apple', mode: 'world', move: false, pan: false, zoom: false })).toBe('World, pure random, NMPZ');
    expect(rules.describeRoomRules({ provider: 'google', mode: 'cities', move: false, pan: false, zoom: false })).toBe('City streets, NMPZ, on Google Street View');
  });

  test('duel damage is the gap to the best guess, scaled every three rounds', () => {
    expect(rules.roundMultiplier(0)).toBe(1);
    expect(rules.roundMultiplier(2)).toBe(1);
    expect(rules.roundMultiplier(3)).toBe(1.5);
    expect(rules.roundMultiplier(6)).toBe(2);
    const { damages, best } = rules.duelDamages({ a: 4000, b: 1000, c: 0 }, 3);
    expect(best).toBe(4000);
    expect(damages).toEqual({ a: 0, b: 4500, c: 6000 });
  });

  test('rankings share a rank on ties and standings sort by variant', () => {
    const ranked = rules.rankGuesses([{ playerId: 'a', score: 100 }, { playerId: 'b', score: 300 }, { playerId: 'c', score: 300 }]);
    expect(ranked.map((g) => [g.playerId, g.rank])).toEqual([['b', 1], ['c', 1], ['a', 3]]);
    expect(rules.medal(1)).toBe('🥇');
    const players = [{ name: 'x', score: 10, hp: 100, eliminated: true }, { name: 'y', score: 5, hp: 2000 }, { name: 'z', score: 20, hp: 500 }];
    expect(rules.sortStandings(players, 'classic').map((p) => p.name)).toEqual(['z', 'x', 'y']);
    expect(rules.sortStandings(players, 'duel').map((p) => p.name)).toEqual(['y', 'z', 'x']);
  });

  test('a duel is over at the last player standing, classic at the last round', () => {
    const players = [{ eliminated: false }, { eliminated: true }];
    expect(rules.isGameOver({ variant: 'duel', roundIndex: 0, roundsTotal: 5, players })).toBe(true);
    expect(rules.isGameOver({ variant: 'classic', roundIndex: 0, roundsTotal: 5, players })).toBe(false);
    expect(rules.isGameOver({ variant: 'classic', roundIndex: 4, roundsTotal: 5, players })).toBe(true);
  });
});

describe('a classic game', () => {
  test('lobby: the host creates, a friend joins, everyone sees the same room', async () => {
    const { store, code, host, others } = await setupRoom();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(host.player.isHost).toBe(true);
    expect(others[0].player.isHost).toBe(false);
    expect(others[0].player.color).not.toBe(host.player.color);
    const view = await getRoomView(store, { code, token: others[0].token, now: T0 + sec(1) });
    expect(view.room).toMatchObject({ status: 'lobby', phase: 'lobby', variant: 'classic', roundsTotal: 3 });
    expect(view.players.map((p) => p.name)).toEqual(['Ada', 'Grace']);
    expect(view.players.find((p) => p.you).name).toBe('Grace');
    expect(view.me.isHost).toBe(false);
    expect(view.round).toBeNull();
    expect(JSON.stringify(view)).not.toContain('tokenHash');
    const anonymous = await getRoomView(store, { code, now: T0 });
    expect(anonymous.me).toBeNull();
  });

  test('a spectator gets the room but never the imagery', async () => {
    // A Street View panorama is a billed load, and recordRoomRound only
    // charges the players in the room. Anyone who opened the link
    // without joining used to be handed the panorama id and mount a
    // pane with it, costing money that nothing counted.
    const { store, code, tokens } = await setupRoom();
    await roomAction(store, { code, token: tokens[0], action: 'start', now: T0, fetchImpl: hitFetch });
    const player = await getRoomView(store, { code, token: tokens[0], now: T0 + sec(2), fetchImpl: hitFetch });
    expect(player.round.panoId).toBeTruthy();

    const spectator = await getRoomView(store, { code, now: T0 + sec(2), fetchImpl: hitFetch });
    expect(spectator.me).toBeNull();
    expect(spectator.round).not.toBeNull();
    expect(spectator.round.panoId).toBeNull();
    expect(spectator.round.coordinate).toBeNull();
    expect(spectator.players.map((p) => p.name)).toEqual(['Ada', 'Grace']);
  });

  test('an Apple spectator gets neither the coordinate nor the candidates', async () => {
    const { store, code, tokens } = await setupRoom({ settings: { provider: 'apple' } });
    await roomAction(store, { code, token: tokens[0], action: 'start', now: T0, fetchImpl: hitFetch });
    const locating = await getRoomView(store, { code, token: tokens[0], now: T0 + sec(1), fetchImpl: hitFetch });
    expect(locating.locating.candidates.length).toBeGreaterThan(0);
    const spectator = await getRoomView(store, { code, now: T0 + sec(1), fetchImpl: hitFetch });
    expect(spectator.locating.candidates).toEqual([]);
  });

  test('a room needs two players to start', async () => {
    const { store, code, tokens } = await setupRoom({ players: ['Solo'] });
    await expect(roomAction(store, { code, token: tokens[0], action: 'start', now: T0, fetchImpl: hitFetch })).rejects.toMatchObject({ code: 'need_players', status: 409 });
    await joinRoom(store, { code, name: 'Friend', now: T0 });
    const started = await roomAction(store, { code, token: tokens[0], action: 'start', now: T0, fetchImpl: hitFetch });
    expect(started.state.room.status).toBe('playing');
  });

  test('duplicate names get a number, and only the host can start', async () => {
    const { store, code, others } = await setupRoom({ players: ['Ada', 'ada'] });
    expect(others[0].player.name).toBe('ada 2');
    await expect(roomAction(store, { code, token: others[0].token, action: 'start', now: T0 })).rejects.toMatchObject({ code: 'not_host', status: 403 });
    await expect(roomAction(store, { code, token: 'nope', action: 'start', now: T0 })).rejects.toMatchObject({ code: 'not_a_player', status: 401 });
  });

  test('start, guess, reveal when everyone has guessed, advance, finish', async () => {
    const { store, code, tokens } = await setupRoom();
    const [ada, grace] = tokens;

    const started = await roomAction(store, { code, token: ada, action: 'start', now: T0, fetchImpl: hitFetch });
    expect(started.state.room).toMatchObject({ status: 'playing', phase: 'guessing', roundIndex: 0 });
    expect(started.state.round.panoId).toMatch(/^pano-/);
    expect(started.state.round.deadline).toBe(T0 + sec(60));
    expect(JSON.stringify(started.state.round)).not.toMatch(/"lat"/);

    const answer = await answerOf(store, code);
    const first = await roomAction(store, { code, token: ada, action: 'guess', body: answer, now: T0 + sec(5), fetchImpl: hitFetch });
    expect(first.state.room.phase).toBe('guessing');
    expect(first.state.players.find((p) => p.name === 'Ada').guessed).toBe(true);
    expect(first.state.players.find((p) => p.name === 'Grace').guessed).toBe(false);
    await expect(roomAction(store, { code, token: ada, action: 'guess', body: answer, now: T0 + sec(6) })).rejects.toMatchObject({ code: 'already_guessed' });

    const second = await roomAction(store, { code, token: grace, action: 'guess', body: { lat: answer.lat, lng: ((answer.lng + 360) % 360) - 180 }, now: T0 + sec(9), fetchImpl: hitFetch });
    expect(second.state.room.phase).toBe('reveal');
    expect(second.state.reveal.answer).toMatchObject({ lat: answer.lat, lng: answer.lng });
    const ranked = second.state.reveal.guesses;
    expect(ranked[0]).toMatchObject({ rank: 1, score: 5000 });
    expect(ranked[1].rank).toBe(2);
    expect(second.state.players[0]).toMatchObject({ name: 'Ada', score: 5000, roundWins: 1 });
    expect(second.state.room.phaseEndsAt).toBe(T0 + sec(9) + rules.REVEAL_SECONDS * 1000);

    // Nobody moves on until the reveal has been on screen long enough.
    const early = await getRoomView(store, { code, token: grace, now: T0 + sec(12), fetchImpl: hitFetch });
    expect(early.room.phase).toBe('reveal');
    const later = await getRoomView(store, { code, token: grace, now: T0 + sec(22), fetchImpl: hitFetch });
    expect(later.room).toMatchObject({ phase: 'guessing', roundIndex: 1 });
    expect(later.round.panoId).not.toBe(started.state.round.panoId);
    expect(later.history).toHaveLength(1);

    // The host can cut a round short; round two ends with one timeout.
    const t2 = T0 + sec(30);
    const a2 = await answerOf(store, code);
    await roomAction(store, { code, token: ada, action: 'guess', body: a2, now: t2, fetchImpl: hitFetch });
    const forced = await roomAction(store, { code, token: ada, action: 'next', now: t2 + sec(1), fetchImpl: hitFetch });
    expect(forced.state.room.phase).toBe('reveal');
    const graceGuess = forced.state.reveal.guesses.find((g) => g.playerId === forced.state.players.find((p) => p.name === 'Grace').id);
    expect(graceGuess).toMatchObject({ timedOut: true, score: 0 });

    // Skip the reveal, play the last round out by the deadline, finish.
    const skipped = await roomAction(store, { code, token: ada, action: 'next', now: t2 + sec(2), fetchImpl: hitFetch });
    expect(skipped.state.room).toMatchObject({ phase: 'guessing', roundIndex: 2 });
    const expired = await getRoomView(store, { code, token: grace, now: t2 + sec(2) + sec(61), fetchImpl: hitFetch });
    expect(expired.room.phase).toBe('reveal');
    expect(expired.room.phaseEndsAt).toBe(t2 + sec(63) + rules.FINAL_REVEAL_SECONDS * 1000);
    const done = await getRoomView(store, { code, token: grace, now: t2 + sec(80), fetchImpl: hitFetch });
    expect(done.room).toMatchObject({ status: 'finished', phase: 'finished' });
    expect(done.history).toHaveLength(3);
    expect(done.players[0].name).toBe('Ada');
    expect(done.players[0].score).toBe(10000);
  });

  test('guesses are refused after the deadline plus grace, and with bad coordinates', async () => {
    const { store, code, tokens } = await setupRoom({ players: ['Solo', 'Other'] });
    await roomAction(store, { code, token: tokens[0], action: 'start', now: T0, fetchImpl: hitFetch });
    await expect(roomAction(store, { code, token: tokens[0], action: 'guess', body: { lat: 'x', lng: 1 }, now: T0 + sec(1) })).rejects.toMatchObject({ code: 'bad_guess' });
    // Past the deadline the tick reveals first, so the guess meets a closed round.
    await expect(roomAction(store, { code, token: tokens[0], action: 'guess', body: { lat: 1, lng: 1 }, now: T0 + sec(70), fetchImpl: hitFetch })).rejects.toMatchObject({ code: 'not_guessing' });
  });

  test('late joiners are allowed in classic, refused in a duel, and full or finished rooms refuse', async () => {
    const { store, code, tokens } = await setupRoom();
    await roomAction(store, { code, token: tokens[0], action: 'start', now: T0, fetchImpl: hitFetch });
    const late = await joinRoom(store, { code, name: 'Late', now: T0 + sec(10) });
    expect(late.state.players).toHaveLength(3);
    expect(late.state.round.panoId).toBeTruthy();

    const duel = await setupRoom({ settings: { variant: 'duel' } });
    await roomAction(duel.store, { code: duel.code, token: duel.tokens[0], action: 'start', now: T0, fetchImpl: hitFetch });
    await expect(joinRoom(duel.store, { code: duel.code, name: 'Late', now: T0 + sec(1) })).rejects.toMatchObject({ code: 'duel_in_progress' });

    const full = await setupRoom({ players: Array.from({ length: rules.MAX_PLAYERS }, (_, i) => `P${i}`) });
    await expect(joinRoom(full.store, { code: full.code, name: 'One more', now: T0 })).rejects.toMatchObject({ code: 'room_full' });
    await expect(joinRoom(full.store, { code: 'ZZZZZZ', name: 'x', now: T0 })).rejects.toMatchObject({ code: 'not_found', status: 404 });
  });

  test('the host leaving hands the room to the next player; reactions are kept in order', async () => {
    const { store, code, tokens } = await setupRoom({ players: ['Ada', 'Grace', 'Linus'] });
    const reacted = await roomAction(store, { code, token: tokens[1], action: 'react', body: { emoji: '🔥' }, now: T0 });
    expect(reacted.state.reactions).toEqual([{ p: expect.any(String), n: 'Grace', e: '🔥', at: T0 }]);
    await expect(roomAction(store, { code, token: tokens[1], action: 'react', body: { emoji: 'nope' }, now: T0 })).rejects.toMatchObject({ code: 'bad_reaction' });
    const left = await roomAction(store, { code, token: tokens[0], action: 'leave', now: T0 + sec(1) });
    expect(left.state.players.map((p) => p.name)).toEqual(['Grace', 'Linus']);
    expect(left.state.room.hostId).toBe(left.state.players.find((p) => p.name === 'Grace').id);
    await expect(getRoomView(store, { code, token: tokens[0], now: T0 + sec(2) })).resolves.toMatchObject({ me: null });
  });

  test('a public room shows in the browser list while active, a private one never does', async () => {
    const pub = await setupRoom();
    await createRoom(pub.store, { name: 'Secret', hostName: 'H', settings: { visibility: 'private' }, now: T0 });
    const list = await listRooms(pub.store, { now: T0 + sec(5) });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ code: pub.code, name: 'Friday night', players: 2, status: 'lobby', mode: 'World, balanced', provider: 'google', rules: 'World, balanced, on Google Street View' });
    const nm = await setupRoom({ settings: { move: false, pan: true, zoom: true } });
    expect((await listRooms(nm.store, { now: T0 }))[0].rules).toBe('World, balanced, No Move, on Google Street View');
    expect(await listRooms(pub.store, { now: T0 + rules.ROOM_LISTING_WINDOW_MS + sec(1) })).toHaveLength(0);
  });

  test('a rematch opens a new room with the same settings and links it from the old one', async () => {
    const { store, code, tokens } = await setupRoom({ settings: { rounds: 3, time: 30, mode: 'world' } });
    await expect(roomAction(store, { code, token: tokens[0], action: 'rematch', now: T0 })).rejects.toMatchObject({ code: 'not_finished' });
    await roomAction(store, { code, token: tokens[0], action: 'start', now: T0, fetchImpl: hitFetch });
    let now = T0;
    for (let i = 0; i < 3; i++) {
      now += sec(31);
      await getRoomView(store, { code, now, fetchImpl: hitFetch });
      now += sec(13);
      await getRoomView(store, { code, now, fetchImpl: hitFetch });
    }
    const finished = await getRoomView(store, { code, token: tokens[0], now, fetchImpl: hitFetch });
    expect(finished.room.status).toBe('finished');
    const again = await roomAction(store, { code, token: tokens[0], action: 'rematch', now });
    expect(again.rematch.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(again.rematch.token).toBeTruthy();
    expect(again.state.room.rematchCode).toBe(again.rematch.code);
    const next = await getRoomView(store, { code: again.rematch.code, token: again.rematch.token, now });
    expect(next.room).toMatchObject({ name: 'Friday night', status: 'lobby', config: { mode: 'world', time: 30, rounds: 3 } });
    expect(next.me.isHost).toBe(true);
    const twice = await roomAction(store, { code, token: tokens[1], action: 'rematch', now }).catch((e) => e);
    expect(twice).toBeInstanceOf(RoomError); // only the host
  });
});

describe('an Apple Look Around room', () => {
  const apple = { provider: 'apple', mode: 'world', rounds: 2, time: 60 };

  test('a round offers places, the first browser to find imagery places it for everyone, then the clock runs', async () => {
    const { store, code, tokens } = await setupRoom({ settings: apple });
    const [ada, grace] = tokens;

    const started = await roomAction(store, { code, token: ada, action: 'start', now: T0 });
    expect(started.state.room).toMatchObject({ status: 'playing', phase: 'locating', roundIndex: 0, config: { provider: 'apple', mode: 'world' } });
    expect(started.state.room.phaseEndsAt).toBe(T0 + LOCATING_TIMEOUT_MS);
    expect(started.state.round).toBeNull();
    const offered = started.state.locating;
    expect(offered.index).toBe(0);
    expect(offered.candidates).toHaveLength(APPLE_CANDIDATES_PER_ROUND);
    // The browser sees coordinates to try, never the country behind them.
    expect(Object.keys(offered.candidates[0]).sort()).toEqual(['lat', 'lng']);
    expect(JSON.stringify(offered)).not.toMatch(/"cc"|"cn"|country/);

    await expect(roomAction(store, { code, token: grace, action: 'guess', body: offered.candidates[0], now: T0 + sec(1) })).rejects.toMatchObject({ code: 'not_guessing' });
    await expect(roomAction(store, { code, token: grace, action: 'locate', body: { index: 99 }, now: T0 + sec(2) })).rejects.toMatchObject({ code: 'bad_candidate', status: 400 });
    await expect(roomAction(store, { code, token: grace, action: 'locate', body: { index: 'x' }, now: T0 + sec(2) })).rejects.toMatchObject({ code: 'bad_candidate' });

    const placed = await roomAction(store, { code, token: grace, action: 'locate', body: { index: 3 }, now: T0 + sec(3) });
    expect(placed.state.room.phase).toBe('guessing');
    expect(placed.state.locating).toBeNull();
    expect(placed.state.round).toMatchObject({ index: 0, provider: 'apple', panoId: '', coordinate: offered.candidates[3], deadline: T0 + sec(63) });
    expect(await answerOf(store, code)).toEqual(offered.candidates[3]);
    await expect(roomAction(store, { code, token: ada, action: 'locate', body: { index: 4 }, now: T0 + sec(4) })).rejects.toMatchObject({ code: 'not_locating', status: 409 });

    const answer = offered.candidates[3];
    await roomAction(store, { code, token: ada, action: 'guess', body: answer, now: T0 + sec(5) });
    const revealed = await roomAction(store, { code, token: grace, action: 'guess', body: { lat: answer.lat, lng: ((answer.lng + 360) % 360) - 180 }, now: T0 + sec(8) });
    expect(revealed.state.room.phase).toBe('reveal');
    expect(revealed.state.reveal.answer).toMatchObject(answer);
    expect(revealed.state.reveal.answer.country?.code).toBeTruthy();
    expect(revealed.state.reveal.guesses[0]).toMatchObject({ rank: 1, score: 5000 });

    // The next round offers new places; the meter counted the round for the site under Apple.
    const next = await getRoomView(store, { code, token: ada, now: T0 + sec(8) + rules.REVEAL_SECONDS * 1000 + sec(1) });
    expect(next.room).toMatchObject({ phase: 'locating', roundIndex: 1 });
    expect(next.locating.index).toBe(1);
    expect(next.locating.candidates[0]).not.toEqual(offered.candidates[0]);
    const usage = store._dump().usage;
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({ subject: 'site', provider: 'apple', rounds: 2 });
  });

  test('when nobody finds imagery in time the room offers the next places for the same round', async () => {
    const { store, code, tokens } = await setupRoom({ settings: apple });
    const started = await roomAction(store, { code, token: tokens[0], action: 'start', now: T0 });
    const first = started.state.locating.candidates;
    const stale = await store.getRoomByCode(code);
    const late = T0 + LOCATING_TIMEOUT_MS + sec(1);
    const [a, b] = await Promise.all([tick(store, stale, late), tick(store, stale, late)]);
    expect(a.phase).toBe('locating');
    expect(b.phase).toBe('locating');
    expect(a.retries).toBe(1);
    expect(a.lastError).toMatch(/No Look Around imagery/);
    const view = await getRoomView(store, { code, token: tokens[1], now: late + sec(1) });
    expect(view.room).toMatchObject({ phase: 'locating', roundIndex: 0 });
    expect(view.room.phaseEndsAt).toBe(late + LOCATING_TIMEOUT_MS);
    expect(view.locating.candidates).toHaveLength(APPLE_CANDIDATES_PER_ROUND);
    expect(view.locating.candidates).not.toEqual(first);
    // The place that finally loads is one of the new offers.
    const placed = await roomAction(store, { code, token: tokens[1], action: 'locate', body: { index: 0 }, now: late + sec(2) });
    expect(placed.state.round.coordinate).toEqual(view.locating.candidates[0]);
    expect(placed.state.round.deadline).toBe(late + sec(62));
  });
});

describe('a duel', () => {
  test('damage, elimination, and the end at the last player standing', async () => {
    const { store, code, tokens } = await setupRoom({ settings: { variant: 'duel', rounds: 10, time: 30 } });
    const [ada, grace] = tokens;
    await roomAction(store, { code, token: ada, action: 'start', now: T0, fetchImpl: hitFetch });
    let now = T0;
    let view;
    for (let round = 0; round < 10; round++) {
      const answer = await answerOf(store, code);
      now += sec(2);
      await roomAction(store, { code, token: ada, action: 'guess', body: answer, now, fetchImpl: hitFetch });
      now += sec(1);
      view = (await roomAction(store, { code, token: grace, action: 'guess', body: { lat: answer.lat, lng: ((answer.lng + 360) % 360) - 180 }, now, fetchImpl: hitFetch })).state;
      expect(view.room.phase).toBe('reveal');
      const graceView = view.players.find((p) => p.name === 'Grace');
      const graceGuess = view.reveal.guesses.find((g) => g.playerId === graceView.id);
      expect(graceGuess.damage).toBe(Math.round((5000 - graceGuess.score) * rules.roundMultiplier(round)));
      expect(view.players.find((p) => p.name === 'Ada').hp).toBe(rules.DUEL_START_HP);
      if (view.room.status === 'finished') break;
      now += sec(rules.REVEAL_SECONDS + 1);
      view = await getRoomView(store, { code, token: ada, now, fetchImpl: hitFetch });
      if (view.room.status === 'finished') break;
    }
    expect(view.room.status).toBe('finished');
    expect(view.players.find((p) => p.name === 'Grace')).toMatchObject({ hp: 0, eliminated: true });
    expect(view.players[0].name).toBe('Ada');
    expect(view.room.roundIndex).toBeLessThan(9);
  });
});

describe('robustness', () => {
  test('two polls racing at the deadline reveal the round exactly once', async () => {
    const { store, code, tokens } = await setupRoom();
    await roomAction(store, { code, token: tokens[0], action: 'start', now: T0, fetchImpl: hitFetch });
    const stale = await store.getRoomByCode(code);
    const late = T0 + sec(61);
    const [a, b] = await Promise.all([tick(store, stale, late, hitFetch), tick(store, stale, late, hitFetch)]);
    expect(a.phase).toBe('reveal');
    expect(b.phase).toBe('reveal');
    const dump = store._dump();
    expect(dump.guesses).toHaveLength(2); // one timed-out row per player, not two
    expect(dump.rooms[0].version).toBe(stale.version + 1);
  });

  test('a guess that lands while the reveal is being computed is kept, not overwritten with a timeout', async () => {
    // revealRound snapshots the guesses, claims the phase, then writes a
    // timed-out row for everyone it believed had not guessed. A guess
    // written in that window used to be upserted over with nulls: the
    // coordinates were destroyed in the database, the player scored
    // zero for a guess their browser had been told was accepted, and in
    // a duel they took full damage for it.
    const { store, code, tokens } = await setupRoom();
    await roomAction(store, { code, token: tokens[0], action: 'start', now: T0, fetchImpl: hitFetch });
    const room = await store.getRoomByCode(code);
    const round = room.rounds.find((r) => r.index === room.roundIndex);
    const grace = room.players.find((p) => p.name === 'Grace');

    // Slip Grace's guess in the moment the reveal claims the phase.
    const realUpdateRoom = store.updateRoom.bind(store);
    let slipped = false;
    store.updateRoom = async (...args) => {
      const result = await realUpdateRoom(...args);
      if (!slipped && result && args[1]?.phase === 'reveal') {
        slipped = true;
        await store.upsertGuess({ roundId: round.id, playerId: grace.id, lat: round.lat, lng: round.lng, distanceKm: 0, score: 5000, damage: 0, timedOut: false, submittedAt: new Date(T0 + sec(5)) });
      }
      return result;
    };
    await roomAction(store, { code, token: tokens[0], action: 'guess', body: { lat: round.lat, lng: round.lng }, now: T0 + sec(2), fetchImpl: hitFetch });
    // Ada guessed, Grace has not, so the host skips to the reveal.
    await roomAction(store, { code, token: tokens[0], action: 'next', now: T0 + sec(3), fetchImpl: hitFetch });
    store.updateRoom = realUpdateRoom;
    expect(slipped).toBe(true);

    const after = await store.getRoomByCode(code);
    const kept = after.rounds.find((r) => r.index === round.index).guesses.find((g) => g.playerId === grace.id);
    expect(kept.timedOut).toBe(false);
    expect(kept.lat).toBe(round.lat);
    expect(kept.score).toBe(5000);
    // and it counts: the reveal recomputes from the rows as they stand
    expect(after.players.find((p) => p.id === grace.id).score).toBe(5000);
  });

  test('Skip acts on the phase the host was looking at, never on the one the clock just made', async () => {
    // roomAction ticks first, so a reveal countdown expiring inside the
    // same request used to advance to the next round and then be
    // skipped straight past it: a brand-new round revealed with nobody
    // having seen the panorama and everyone written down as timed out.
    const { store, code, tokens } = await setupRoom();
    await roomAction(store, { code, token: tokens[0], action: 'start', now: T0, fetchImpl: hitFetch });
    expect((await store.getRoomByCode(code)).phase).toBe('guessing');

    // Skipping the round the host is looking at works, whatever the
    // version has done meanwhile: another player's guess moves it, and
    // pinning to the version refused ordinary clicks.
    await roomAction(store, { code, token: tokens[1], action: 'guess', body: { lat: 0, lng: 0 }, now: T0 + sec(1), fetchImpl: hitFetch });
    await roomAction(store, { code, token: tokens[0], action: 'next', body: { phase: 'guessing', roundIndex: 0 }, now: T0 + sec(2), fetchImpl: hitFetch });
    expect((await store.getRoomByCode(code)).phase).toBe('reveal');

    // The host's browser is still showing the round it already skipped.
    await expect(
      roomAction(store, { code, token: tokens[0], action: 'next', body: { phase: 'guessing', roundIndex: 0 }, now: T0 + sec(3), fetchImpl: hitFetch })
    ).rejects.toMatchObject({ code: 'moved_on', status: 409 });
    expect((await store.getRoomByCode(code)).phase).toBe('reveal');

    // And a click on a round the clock has already carried past.
    await expect(
      roomAction(store, { code, token: tokens[0], action: 'next', body: { phase: 'reveal', roundIndex: 9 }, now: T0 + sec(4), fetchImpl: hitFetch })
    ).rejects.toMatchObject({ code: 'moved_on', status: 409 });
  });

  test('joins racing for the last seats do not overfill the room or share a colour', async () => {
    const { store, code } = await setupRoom({ players: ['Ada'] });
    const results = await Promise.allSettled(
      Array.from({ length: rules.MAX_PLAYERS + 4 }, (_, i) => joinRoom(store, { code, name: `P${i}`, now: T0 }))
    );
    const joined = results.filter((r) => r.status === 'fulfilled');
    expect(joined.length).toBeGreaterThan(0);
    const room = await store.getRoomByCode(code);
    const present = room.players.filter((p) => !p.leftAt);
    expect(present.length).toBeLessThanOrEqual(rules.MAX_PLAYERS);
    expect(new Set(present.map((p) => p.color)).size).toBe(present.length);
    expect(new Set(present.map((p) => p.name.toLowerCase())).size).toBe(present.length);
  });

  test('two rematch clicks open one room, and everyone follows the same code', async () => {
    // Both used to see rematchCode null, both open a room, and the
    // second overwrite the first: the host went to her room and the
    // rest of the table to the other, where her host record sat with a
    // token nobody held. The orphan also burned a room game from her
    // daily allowance.
    const { store, code, tokens } = await setupRoom({ settings: { rounds: 3, time: 30 } });
    await roomAction(store, { code, token: tokens[0], action: 'start', now: T0, fetchImpl: hitFetch });
    let now = T0;
    for (let i = 0; i < 3; i++) {
      now += sec(31);
      await getRoomView(store, { code, now, fetchImpl: hitFetch });
      now += sec(13);
      await getRoomView(store, { code, now, fetchImpl: hitFetch });
    }
    expect((await store.getRoomByCode(code)).status).toBe('finished');

    const [a, b] = await Promise.all([
      roomAction(store, { code, token: tokens[0], action: 'rematch', now, fetchImpl: hitFetch }).catch((e) => e),
      roomAction(store, { code, token: tokens[0], action: 'rematch', now, fetchImpl: hitFetch }).catch((e) => e),
    ]);
    const codes = [a, b].map((r) => r?.rematch?.code).filter(Boolean);
    const followed = (await store.getRoomByCode(code)).rematchCode;
    expect(followed).toBeTruthy();
    for (const c of codes) expect(c).toBe(followed);
    const opened = await Promise.all([...new Set(codes)].map((c) => store.getRoomByCode(c)));
    expect(opened.filter(Boolean).length).toBe(1);
  });

  test('a round build that finds no imagery sends the lobby back with a reason, and retries move on', async () => {
    const { store, code, tokens } = await setupRoom();
    const failed = await roomAction(store, { code, token: tokens[0], action: 'start', now: T0, fetchImpl: noFetch });
    expect(failed.state.room).toMatchObject({ status: 'lobby', phase: 'lobby' });
    expect(failed.state.room.lastError).toMatch(/No Street View imagery/);
    const dump = store._dump();
    expect(dump.rooms[0].retries).toBe(1);
    const ok = await roomAction(store, { code, token: tokens[0], action: 'start', now: T0 + sec(5), fetchImpl: hitFetch });
    expect(ok.state.room.phase).toBe('guessing');
  });

  test('a build that never finished is handed back after the loading timeout', async () => {
    const { store, code } = await setupRoom();
    const room = await store.getRoomByCode(code);
    await store.updateRoom(room.id, { status: 'playing', phase: 'loading', phaseEndsAt: new Date(T0), version: room.version + 1 });
    const stuck = await store.getRoomByCode(code);
    const recovered = await tick(store, stuck, T0 + rules.LOADING_TIMEOUT_MS + sec(1), hitFetch);
    expect(recovered.phase).toBe('lobby');
    expect(recovered.lastError).toMatch(/took too long/);
  });

  test('player tokens are stored hashed', async () => {
    const { store, host } = await setupRoom({ players: ['Ada'] });
    const dump = store._dump();
    expect(dump.players[0].tokenHash).toBe(hashToken(host.token));
    expect(dump.players[0].tokenHash).not.toBe(host.token);
  });
});

describe('the seeded round cache', () => {
  const ENV = { ...ENV_KEYS, NEXTAUTH_SECRET: 'jest-secret-long-enough' };

  test('a seeded round is probed once and served from the cache after that', async () => {
    const cache = createMemoryRoundCache();
    const fetchImpl = jest.fn(hitFetch);
    const first = await createRound({ config: { provider: 'google', mode: 'balanced', seed: 'cache-1' }, roundIndex: 0, fetchImpl, env: ENV, cache, now: T0 });
    const calls = fetchImpl.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    const second = await createRound({ config: { provider: 'google', mode: 'balanced', seed: 'cache-1' }, roundIndex: 0, fetchImpl, env: ENV, cache, now: T0 + sec(60) });
    expect(fetchImpl.mock.calls.length).toBe(calls);
    expect(second.panoId).toBe(first.panoId);
    expect(second.heading).toBe(first.heading);
    expect(second.stats.cached).toBe(true);
    expect(cache.size()).toBe(1);
  });

  test('retries skip the cache and expired entries are ignored', async () => {
    const cache = createMemoryRoundCache();
    const fetchImpl = jest.fn(hitFetch);
    await createRound({ config: { provider: 'google', mode: 'world', seed: 'link-1' }, roundIndex: 0, fetchImpl, env: ENV, cache, now: T0 });
    const before = fetchImpl.mock.calls.length;
    await createRound({ config: { provider: 'google', mode: 'world', seed: 'link-1' }, roundIndex: 0, attempt: 1, fetchImpl, env: ENV, cache, now: T0 });
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(before);
    const afterRetry = fetchImpl.mock.calls.length;
    await createRound({ config: { provider: 'google', mode: 'world', seed: 'link-1' }, roundIndex: 0, fetchImpl, env: ENV, cache, now: T0 + 25 * 3600 * 1000 });
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(afterRetry);
    const unseeded = await createRound({ config: { provider: 'google', mode: 'world' }, roundIndex: 0, fetchImpl, env: ENV, cache, now: T0 });
    expect(unseeded.stats.cached).toBeUndefined();
  });
});
