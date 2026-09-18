const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');
const store = createMemoryRoomStore();
jest.mock('@/app/lib/geo/server/roomStore', () => ({ prismaRoomStore: store }));
jest.mock('@/app/lib/geo/server/limiter', () => ({ RateLimitPresets: { PUBLIC_WRITE: {} }, withRateLimitAsync: async () => ({ success: true }) }));
const { GET, POST } = require('@/app/api/geo/save/route');
const { sealSession } = require('@/app/lib/geo/server/identity');
let cookie;
const savedSecret = process.env.GEO_TOKEN_SECRET;
beforeAll(async () => {
  process.env.GEO_TOKEN_SECRET = 'saved-game-test-secret';
  const account = await store.createAccount({ email: 'save@example.test' });
  cookie = `geo_session=${sealSession({ accountId: account.id })}`;
});
afterAll(() => { if (savedSecret === undefined) delete process.env.GEO_TOKEN_SECRET; else process.env.GEO_TOKEN_SECRET = savedSecret; });
const req = (data, session = cookie) => ({ headers: new Map([['cookie', session]]), text: async () => JSON.stringify(data) });

test('guests cannot save or read an account checkpoint', async () => {
  expect((await GET(req(null, ''))).status).toBe(401);
  expect((await POST(req({}, ''))).status).toBe(401);
});
test('account checkpoint survives requests and never creates ranked results', async () => {
  const saved = { kind: 'script', url: '/geo/script/play?seed=test&resume=1', snapshot: { history: [{ score: 100 }], roundIndex: 1 } };
  expect((await POST(req(saved))).status).toBe(200);
  expect((await (await GET(req())).json()).savedGame.snapshot).toEqual(saved.snapshot);
  const other = await store.createAccount({ email: 'other@example.test' });
  expect((await (await GET(req(null, `geo_session=${sealSession({ accountId: other.id })}`))).json()).savedGame).toBeNull();
});
test('rejects external links and non-game return routes', async () => {
  for (const url of ['https://evil.test', '/geo/me', '//evil.test', '/geo/../api/auth']) {
    expect((await POST(req({ kind: 'street', url, snapshot: { rounds: [] } }))).status).toBe(400);
  }
});

test('malformed and oversized requests are rejected without a server error', async () => {
  expect((await POST({ ...req(), text: async () => '{broken' })).status).toBe(400);
  expect((await POST({ ...req(), text: async () => 'x'.repeat(512001) })).status).toBe(413);
});
