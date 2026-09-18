const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');
const { matchmaking, QUEUE_LEASE_MS } = require('@/app/lib/geo/server/matchmaking');
const { getRoomView, joinRoom, roomAction } = require('@/app/lib/geo/server/rooms');

const now = Date.parse('2026-09-17T15:00:00Z');
let secret;
beforeAll(() => { secret = process.env.GEO_TOKEN_SECRET; process.env.GEO_TOKEN_SECRET = 'queue-test-secret'; });
afterAll(() => { if (secret === undefined) delete process.env.GEO_TOKEN_SECRET; else process.env.GEO_TOKEN_SECRET = secret; });
async function player(store, name) {
  const account = await store.createAccount({ email: `${name}@example.test` });
  const profile = await store.createProfile({ name, accountId: account.id, tokenHash: name });
  return { signedIn: true, profileId: profile.id, profile, ipHash: `ip:${name}` };
}
const find = (store, subjects, extra = {}) => matchmaking(store, { subjects, game: 'script', now, ...extra });

test('pairs two accounts automatically, starts Script and recovers stable private seats', async () => {
  const store = createMemoryRoomStore();
  const a = await player(store, 'Ada'); const b = await player(store, 'Grace');
  expect(await find(store, a)).toMatchObject({ status: 'waiting' });
  const peer = await find(store, b);
  const host = await find(store, a, { action: 'poll' });
  expect(peer.status).toBe('matched'); expect(host.code).toBe(peer.code);
  expect(host.token).not.toBe(peer.token);
  expect(await find(store, a)).toEqual(host);
  const state = await getRoomView(store, { code: host.code, token: host.token, now });
  expect(state.room.phase).toBe('guessing'); expect(state.round.text).toBeTruthy();
  expect(state.players).toHaveLength(2); expect(state.room.visibility).toBe('private');
  expect(await store.listPublicRooms({ since: now - 1 })).toHaveLength(0);
  const stored = await store.getMatchmakingTicket(a.profileId);
  expect(stored.token).not.toBe(host.token);
  await expect(joinRoom(store, { code: host.code, profileId: 'third', now })).rejects.toMatchObject({ code: 'matched_roster' });
  await expect(roomAction(store, { code: host.code, token: host.token, action: 'next', now })).rejects.toMatchObject({ code: 'automatic_match' });
});

test('parallel joins allocate each profile exactly once and never match someone with themselves', async () => {
  const store = createMemoryRoomStore();
  const people = await Promise.all(Array.from({ length: 10 }, (_, i) => player(store, `P${i}`)));
  await Promise.all(people.flatMap((subjects) => [find(store, subjects), find(store, subjects)]));
  const assignments = await Promise.all(people.map((subjects) => find(store, subjects, { action: 'poll' })));
  expect(assignments.every((result) => result.status === 'matched')).toBe(true);
  const codes = [...new Set(assignments.map((result) => result.code))];
  expect(codes).toHaveLength(5);
  for (const code of codes) {
    const room = await store.getRoomByCode(code);
    expect(room.players).toHaveLength(2);
    expect(new Set(room.players.map((p) => p.profileId)).size).toBe(2);
    expect(room.rounds).toHaveLength(1);
  }
});

test('recovering an unreadable queue credential keeps the active room seat valid', async () => {
  const store = createMemoryRoomStore();
  const a = await player(store, 'Ada'); const b = await player(store, 'Grace');
  await find(store, a); await find(store, b);
  const host = await find(store, a, { action: 'poll' });
  const ticket = await store.getMatchmakingTicket(a.profileId);
  await store.putMatchmakingTicket({ ...ticket, token: 'expired-or-unreadable-envelope' });
  const recovered = await find(store, a, { action: 'poll' });
  expect(recovered.token).toBe(host.token);
  const rejoined = await joinRoom(store, { code: host.code, profileId: a.profileId, subjects: a, now });
  expect(rejoined.token).toBe(host.token);
  expect((await getRoomView(store, { code: host.code, token: host.token, now })).me.id).toBe(host.playerId);
});

test('different games do not match; an active search cannot be switched by another tab', async () => {
  const store = createMemoryRoomStore();
  const a = await player(store, 'Ada'); const b = await player(store, 'Grace');
  await find(store, a);
  expect(await find(store, b, { game: 'street' })).toMatchObject({ status: 'waiting', game: 'street' });
  expect(await find(store, a, { game: 'street' })).toMatchObject({ status: 'waiting', game: 'script' });
});

test('cancelled and stale searches cannot be matched or resurrected by late polls', async () => {
  const store = createMemoryRoomStore();
  const a = await player(store, 'Ada'); const b = await player(store, 'Grace');
  await find(store, a);
  expect(await find(store, a, { action: 'cancel' })).toEqual({ status: 'idle' });
  expect(await find(store, a, { action: 'poll' })).toEqual({ status: 'expired' });
  await find(store, a);
  expect(await find(store, b, { now: now + QUEUE_LEASE_MS + 1 })).toMatchObject({ status: 'waiting' });
  expect(await find(store, a, { action: 'poll', now: now + QUEUE_LEASE_MS + 1 })).toEqual({ status: 'expired' });
});

test('if matching wins a cancel race, cancellation returns the existing match, never abandons the opponent', async () => {
  const store = createMemoryRoomStore();
  const a = await player(store, 'Ada'); const b = await player(store, 'Grace');
  await find(store, a); const match = await find(store, b);
  expect(await find(store, a, { action: 'cancel' })).toMatchObject({ status: 'matched', code: match.code });
});

test('finished or explicitly left matches allow a new search', async () => {
  const store = createMemoryRoomStore();
  const a = await player(store, 'Ada'); const b = await player(store, 'Grace');
  await find(store, a); const match = await find(store, b);
  const room = await store.getRoomByCode(match.code);
  await store.updateRoom(room.id, { status: 'finished' });
  expect(await find(store, a)).toMatchObject({ status: 'waiting' });
});

test('suspended or deleted accounts are not selected as opponents', async () => {
  const store = createMemoryRoomStore();
  const a = await player(store, 'Ada'); const b = await player(store, 'Grace');
  await find(store, a);
  await store.updateAccount(a.profile.accountId, { suspendedAt: new Date(now) });
  expect(await find(store, b)).toMatchObject({ status: 'waiting' });
});

test('guest and malformed requests cannot enter the queue', async () => {
  const store = createMemoryRoomStore();
  await expect(find(store, { profileId: 'guest' })).rejects.toMatchObject({ status: 401 });
  const a = await player(store, 'Ada');
  await expect(find(store, a, { game: 'unknown' })).rejects.toMatchObject({ status: 400 });
  await expect(find(store, a, { action: 'unknown' })).rejects.toMatchObject({ status: 400 });
});
