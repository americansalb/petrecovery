/**
 * /api/geo/profile and /api/geo/leaderboard on the in-memory store, with
 * the session mocked: a token on first call, the account binding when
 * signed in, and a board with your own row.
 */

const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');

const memoryStore = createMemoryRoomStore();
jest.mock('@/app/lib/geo/server/roomStore', () => ({ prismaRoomStore: memoryStore }));
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/app/lib/rateLimit', () => ({
  withRateLimitAsync: jest.fn().mockResolvedValue({ success: true }),
  RateLimitPresets: { PUBLIC_WRITE: {}, PUBLIC_READ: {} },
  rateLimitResponse: jest.fn(),
}));

const { getServerSession } = require('next-auth');
const { POST: postProfile } = require('@/app/api/geo/profile/route');
const { GET: getLeaderboard } = require('@/app/api/geo/leaderboard/route');

function request(body, headers = {}, url = 'http://localhost/api/geo/profile') {
  const map = new Map(Object.entries(headers));
  return { json: async () => body, headers: map, url };
}

beforeEach(() => {
  getServerSession.mockResolvedValue(null);
});

test('an anonymous browser gets a token once, then keeps its profile', async () => {
  const first = await (await postProfile(request({ name: 'Ada' }))).json();
  expect(first.token).toBeTruthy();
  expect(first.profile).toMatchObject({ name: 'Ada', signedIn: false });
  expect(first.profile.ratings.classic.value).toBe(1500);
  const second = await (await postProfile(request({ name: 'Ada' }, { 'x-geo-profile': first.token }))).json();
  expect(second.token).toBeUndefined();
  expect(second.profile.id).toBe(first.profile.id);
});

test('a signed-in player is matched by account and the anonymous token binds to it', async () => {
  const anon = await (await postProfile(request({ name: 'Guest' }))).json();
  getServerSession.mockResolvedValue({ user: { id: 'user_42', name: 'Grace H' } });
  const bound = await (await postProfile(request({}, { 'x-geo-profile': anon.token }))).json();
  expect(bound.profile.id).toBe(anon.profile.id);
  expect(bound.profile.signedIn).toBe(true);
  const elsewhere = await (await postProfile(request({}))).json();
  expect(elsewhere.profile.id).toBe(anon.profile.id);
  expect(elsewhere.token).toBeUndefined();
});

test('the leaderboard answers with a board and your own row', async () => {
  const me = await (await postProfile(request({ name: 'Linus' }))).json();
  const res = await getLeaderboard(request(null, { 'x-geo-profile': me.token }, 'http://localhost/api/geo/leaderboard?ladder=duel'));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.ladder).toBe('duel');
  expect(Array.isArray(body.rows)).toBe(true);
  expect(body.you).toMatchObject({ name: 'Linus', rank: null });
  const unknown = await (await getLeaderboard(request(null, {}, 'http://localhost/api/geo/leaderboard?ladder=nope'))).json();
  expect(unknown.ladder).toBe('classic');
  expect(unknown.you).toBeNull();
});
