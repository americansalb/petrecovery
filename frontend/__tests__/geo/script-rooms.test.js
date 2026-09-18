const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');
const { createRoom, joinRoom, roomAction, getRoomView } = require('@/app/lib/geo/server/rooms');
const { evaluateScriptGuess } = require('@/app/lib/geo/server/scriptGame');
const { sendSignInEmail } = require('@/app/lib/geo/server/email');

const now = Date.parse('2026-09-17T12:00:00Z');
let saved;
beforeAll(() => { saved = process.env.GEO_TOKEN_SECRET; process.env.GEO_TOKEN_SECRET = 'script-room-test-secret'; });
afterAll(() => { if (saved === undefined) delete process.env.GEO_TOKEN_SECRET; else process.env.GEO_TOKEN_SECRET = saved; });

test('Script duel shares a clue, hides the answer, scores regions, finishes and rematches', async () => {
  const store = createMemoryRoomStore();
  const host = await createRoom(store, { hostName: 'Host', settings: { game: 'script', variant: 'duel', rounds: 3, time: 30 }, now });
  const code = host.room.code;
  const other = await joinRoom(store, { code, name: 'Guest', now });
  let { state } = await roomAction(store, { code, token: host.token, action: 'start', now });
  expect(state.room.phase).toBe('guessing');
  expect(state.round.text).toBeTruthy();
  expect(state.round.stats).toBeNull();
  expect(state.round.token).toBeUndefined();
  expect(state.reveal).toBeNull();
  const visitor = await getRoomView(store, { code, now });
  expect(visitor.round.text).toBeNull();
  const peer = await getRoomView(store, { code, token: other.token, now });
  expect(peer.round.text).toBe(state.round.text);
  await expect(roomAction(store, { code, token: host.token, action: 'guess', body: { lat: null, lng: null }, now: now + 500 })).rejects.toMatchObject({ code: 'bad_guess' });
  for (let i = 0; i < 3; i++) {
    const at = now + i * 10000;
    const row = (await store.getRoomByCode(code)).rounds.find((r) => r.index === i);
    const guess = { lat: 35, lng: 139 };
    const expected = evaluateScriptGuess({ token: row.stats.script.token, guess, now: at });
    await roomAction(store, { code, token: host.token, action: 'guess', body: guess, now: at + 1000 });
    ({ state } = await roomAction(store, { code, token: other.token, action: 'guess', body: guess, now: at + 1000 }));
    expect(state.room.phase).toBe('reveal');
    expect(state.reveal.scriptAnswer.code).toBe(expected.answer.code);
    expect(state.reveal.guesses.every((g) => g.score === expected.score)).toBe(true);
    expect(state.reveal.guesses.every((g) => g.damage === 0)).toBe(true);
    ({ state } = await roomAction(store, { code, token: host.token, action: 'next', body: { phase: 'reveal', roundIndex: i }, now: at + 2000 }));
  }
  expect(state.room.status).toBe('finished');
  ({ state } = await roomAction(store, { code, token: host.token, action: 'rematch', now: now + 30000 }));
  const rematch = await store.getRoomByCode(state.room.rematchCode);
  expect(rematch.config.game).toBe('script');
  expect(rematch.variant).toBe('duel');
});

test('mail provider error responses are not reported as delivered', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  const result = await sendSignInEmail({ to: 'player@example.test', url: 'https://example.test/link', env: { RESEND_API_KEY: 'test' }, sendImpl: async () => ({ error: { message: 'Rejected' } }) });
  expect(result.sent).toBe(false);
  log.mockRestore();
});

test('verified player can recover a duel seat without resetting health or guesses', async () => {
  const store = createMemoryRoomStore();
  const host = await createRoom(store, { hostName: 'Host', profileId: 'host-profile', settings: { game: 'script', variant: 'duel', rounds: 3, time: 180 }, now });
  const code = host.room.code;
  await joinRoom(store, { code, name: 'Peer', now });
  await roomAction(store, { code, token: host.token, action: 'start', now });
  await roomAction(store, { code, token: host.token, action: 'guess', body: { lat: 35, lng: 139 }, now: now + 1000 });
  await store.updatePlayer(host.player.id, { hp: 2345 });
  const recovered = await joinRoom(store, { code, profileId: 'host-profile', subjects: { signedIn: true }, now: now + 2000 });
  expect(recovered.player.id).toBe(host.player.id);
  expect(recovered.player.hp).toBe(2345);
  expect(recovered.player.isHost).toBe(true);
  expect(recovered.state.players).toHaveLength(2);
  expect(recovered.state.players.find((player) => player.id === host.player.id).guessed).toBe(true);
  expect(recovered.token).not.toBe(host.token);
  expect((await getRoomView(store, { code, token: host.token, now: now + 2000 })).me).toBeNull();
  await expect(joinRoom(store, { code, profileId: 'new-profile', subjects: { signedIn: true }, now: now + 2000 })).rejects.toMatchObject({ code: 'duel_in_progress' });
});
