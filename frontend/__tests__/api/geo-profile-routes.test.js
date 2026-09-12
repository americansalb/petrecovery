/**
 * /api/geo/profile and /api/geo/leaderboard on the in-memory store: a
 * token on first call, the account binding when signed in, and a board
 * with your own row.
 *
 * Signed in here means a WanderGuesser account, which is a sealed
 * cookie the game issues itself (app/lib/geo/server/identity.js). It
 * used to mean a mocked ReunitePets session; phase 1.7 of the split cut
 * that, so the test seals a real cookie rather than mocking anything.
 */

const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');

const memoryStore = createMemoryRoomStore();
jest.mock('@/app/lib/geo/server/roomStore', () => ({ prismaRoomStore: memoryStore }));

const SECRET = 'a-long-enough-test-secret';
// process.env is shared by every test file a Jest worker runs, so a
// module-scope write here used to leak into whatever ran next in the
// same worker. Set it for this file and put it back.
const savedSecret = process.env.GEO_TOKEN_SECRET;
process.env.GEO_TOKEN_SECRET = SECRET;
afterAll(() => {
  if (savedSecret === undefined) delete process.env.GEO_TOKEN_SECRET;
  else process.env.GEO_TOKEN_SECRET = savedSecret;
});

const { POST: postProfile } = require('@/app/api/geo/profile/route');
const { GET: getLeaderboard } = require('@/app/api/geo/leaderboard/route');
const { SESSION_COOKIE, sealSession } = require('@/app/lib/geo/server/identity');

function request(body, headers = {}, url = 'http://localhost/api/geo/profile') {
  const map = new Map(Object.entries(headers));
  return { json: async () => body, headers: map, url };
}

/** Headers carrying a real signed-in session for one account. */
function signedIn(accountId, extra = {}) {
  const sealed = sealSession({ accountId, email: `${accountId}@example.com` }, { env: { GEO_TOKEN_SECRET: SECRET } });
  return { ...extra, cookie: `${SESSION_COOKIE}=${encodeURIComponent(sealed)}` };
}

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
  // Same browser, now signed in: the anonymous profile becomes the
  // account's rather than a second profile appearing.
  const bound = await (await postProfile(request({}, signedIn('acct_42', { 'x-geo-profile': anon.token })))).json();
  expect(bound.profile.id).toBe(anon.profile.id);
  expect(bound.profile.signedIn).toBe(true);
  // A different browser with no play token at all, same account: same profile.
  const elsewhere = await (await postProfile(request({}, signedIn('acct_42')))).json();
  expect(elsewhere.profile.id).toBe(anon.profile.id);
  expect(elsewhere.token).toBeUndefined();
});

test('a garbled session cookie is anonymous, not an error and not someone else', async () => {
  const body = await (await postProfile(request({ name: 'Ada' }, { cookie: `${SESSION_COOKIE}=garbage` }))).json();
  expect(body.profile.signedIn).toBe(false);
  expect(body.token).toBeTruthy();
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
