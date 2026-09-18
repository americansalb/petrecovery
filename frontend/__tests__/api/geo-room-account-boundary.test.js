const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');
const store = createMemoryRoomStore();
jest.mock('@/app/lib/geo/server/roomStore', () => ({ prismaRoomStore: store }));
jest.mock('@/app/lib/geo/server/limiter', () => ({
  withRateLimitAsync: async () => ({ success: true }), checkRateLimitForKeyAsync: async () => ({ success: true }),
  getClientIP: () => '203.0.113.1', RateLimitPresets: { PUBLIC_WRITE: {} }, rateLimitResponse: jest.fn(),
}));
const { sealSession, SESSION_COOKIE } = require('@/app/lib/geo/server/identity');
const { POST: create } = require('@/app/api/geo/rooms/route');
const { POST: act, GET: view } = require('@/app/api/geo/rooms/[code]/route');
let host, other, room;
const request = (body, cookie, token) => ({ url: 'http://localhost/api/geo/rooms', json: async () => body,
  headers: new Map(Object.entries({ ...(cookie ? { cookie } : {}), ...(token ? { 'x-geo-player': token } : {}) })) });
beforeAll(async () => {
  for (const name of ['host', 'other']) {
    const account = await store.createAccount({ email: `${name}@example.test` });
    await store.createProfile({ name, accountId: account.id, tokenHash: `profile-${name}` });
    const cookie = `${SESSION_COOKIE}=${sealSession({ accountId: account.id, email: account.email })}`;
    if (name === 'host') host = cookie; else other = cookie;
  }
});
beforeEach(async () => {
  room = await (await create(request({ hostName: 'host', settings: { game: 'script', variant: 'duel' } }, host))).json();
});
test('signing out invalidates a retained seat for actions', async () => {
  const result = await act(request({ action: 'leave' }, null, room.token), { params: { code: room.code } });
  expect(result.status).toBe(401);
});
test('another signed-in account cannot use the previous account seat', async () => {
  const result = await act(request({ action: 'leave' }, other, room.token), { params: { code: room.code } });
  expect(result.status).toBe(403);
  const mine = await view(request(null, host, room.token), { params: { code: room.code } });
  expect((await mine.json()).state.me.id).toBe(room.playerId);
});
test('a retained seat does not expose player-only state after account changes', async () => {
  for (const cookie of [null, other]) {
    const result = await view(request(null, cookie, room.token), { params: { code: room.code } });
    const body = await result.json();
    expect(body.state.me).toBeNull();
    expect(body.identity).toBeNull();
  }
});

test.each(['lobby', 'finished'])('the owning account recovers its %s seat without browser storage', async (status) => {
  const stored = await store.getRoomByCode(room.code);
  await store.updateRoom(stored.id, { status, phase: status });
  const result = await view(request(null, host), { params: { code: room.code } });
  const body = await result.json();
  expect(body.state.me.id).toBe(room.playerId);
  expect(body.identity).toEqual({ token: room.token, playerId: room.playerId, name: 'host' });
  expect(result.headers.get('cache-control')).toContain('no-store');
  expect((await store.getRoomByCode(room.code)).players).toHaveLength(1);
});

test('anonymous and unrelated accounts cannot recover another player seat', async () => {
  for (const cookie of [null, other]) {
    const body = await (await view(request(null, cookie), { params: { code: room.code } })).json();
    expect(body.state.me).toBeNull();
    expect(body.identity).toBeNull();
  }
});

test('an explicitly left seat is not silently recovered', async () => {
  await act(request({ action: 'leave' }, host, room.token), { params: { code: room.code } });
  const body = await (await view(request(null, host), { params: { code: room.code } })).json();
  expect(body.state.me).toBeNull();
  expect(body.identity).toBeNull();
});
