const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');
const store = createMemoryRoomStore();
jest.mock('@/app/lib/geo/server/roomStore', () => ({ prismaRoomStore: store }));
jest.mock('@/app/lib/geo/server/limiter', () => ({
  withRateLimitAsync: jest.fn().mockResolvedValue({ success: true }),
  rateLimitResponse: () => new Response('{}', { status: 429 }),
  getClientIP: () => '203.0.113.40',
}));
const { POST } = require('@/app/api/geo/matchmaking/route');
const { sealSession } = require('@/app/lib/geo/server/identity');
const { withRateLimitAsync } = require('@/app/lib/geo/server/limiter');
let cookie;
beforeAll(async () => {
  const account = await store.createAccount({ email: 'queue@example.test' });
  cookie = `geo_session=${sealSession({ accountId: account.id })}`;
});
const req = (data, session = cookie) => ({ headers: new Map([['cookie', session]]), text: async () => JSON.stringify(data) });
test('requires verified account; ignores forged JSON identity', async () => {
  expect((await POST(req({ game: 'script' }, ''))).status).toBe(401);
  const response = await POST(req({ game: 'script', profileId: 'stolen-profile' }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: 'waiting' });
  expect(await store.getMatchmakingTicket('stolen-profile')).toBeNull();
});
test('poll and cancellation responses are private and uncached', async () => {
  const response = await POST(req({ game: 'script', action: 'poll' }));
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toMatchObject({ status: 'waiting' });
  expect(await (await POST(req({ game: 'script', action: 'cancel' }))).json()).toEqual({ status: 'idle' });
});
test('rejects invalid bodies and rate limits polling', async () => {
  expect((await POST({ ...req(), text: async () => '{' })).status).toBe(400);
  expect((await POST({ ...req(), text: async () => 'x'.repeat(2001) })).status).toBe(413);
  expect((await POST(req({ game: 'bad' }))).status).toBe(400);
  withRateLimitAsync.mockResolvedValueOnce({ success: false });
  expect((await POST(req({ game: 'script' }))).status).toBe(429);
});
