/**
 * The guest pass through the routes: a trial nobody can abuse, and an
 * account to save or compete (founder, 2026-10-09).
 *
 * guest-pass.test.js pins the rules; this pins that the rounds people
 * actually ask for go through them, on both games, and that the boards
 * hold a guest's score until there is an account to post it to.
 */

const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');

const memoryStore = createMemoryRoomStore();
jest.mock('@/app/lib/geo/server/roomStore', () => ({ prismaRoomStore: memoryStore }));
jest.mock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue(null) }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/app/lib/geo/server/sweep', () => ({ maybeSweep: () => {} }));
jest.mock('@/app/lib/geo/server/limiter', () => ({
  checkRateLimitForKeyAsync: jest.fn().mockResolvedValue({ success: true }),
  getClientIP: (request) => request.headers.get('x-test-ip') || '203.0.113.9',
  withRateLimitAsync: jest.fn().mockResolvedValue({ success: true }),
  RateLimitPresets: { PUBLIC_WRITE: {}, PUBLIC_READ: {} },
  rateLimitResponse: jest.fn(),
}));

const TOKEN_SECRET = 'geo-guest-pass-route-secret-long-enough';
const savedSecret = process.env.GEO_TOKEN_SECRET;
process.env.GEO_TOKEN_SECRET = TOKEN_SECRET;

const { POST: postScriptRound } = require('@/app/api/geo/script/round/route');
const { POST: postRound } = require('@/app/api/geo/round/route');
const { POST: postGuess } = require('@/app/api/geo/guess/route');
const { POST: postProfile } = require('@/app/api/geo/profile/route');
const { GET: getDaily } = require('@/app/api/geo/daily/route');
const { GET: getGuest } = require('@/app/api/geo/guest/route');
const { openToken } = require('@/app/lib/geo/server/tokens');
const { sealSession } = require('@/app/lib/geo/server/identity');

afterAll(() => {
  if (savedSecret === undefined) delete process.env.GEO_TOKEN_SECRET;
  else process.env.GEO_TOKEN_SECRET = savedSecret;
});

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => console.error.mockRestore?.());

function request(body, headers = {}, url = 'http://localhost/api/geo/x') {
  return { json: async () => body, headers: new Map(Object.entries(headers)), url };
}

async function guestOn(ip, name = 'Guest') {
  const profile = await (await postProfile(request({ name }, { 'x-test-ip': ip }))).json();
  return { 'x-test-ip': ip, 'x-geo-profile': profile.token };
}

test("a guest's first Script round starts a game and hands back its ticket; the rest of the game is free", async () => {
  const me = await guestOn('198.51.100.60');
  const config = { rounds: 5, seed: 'guest-script-1' };
  const first = await (await postScriptRound(request({ config, roundIndex: 0 }, me))).json();
  expect(first.guest.ticket).toEqual(expect.any(String));
  expect(first.guest.allowance).toMatchObject({ guest: true, limit: 3, used: 1, left: 2 });
  for (let i = 1; i < 5; i++) {
    const next = await (await postScriptRound(request({ config, roundIndex: i, ticket: first.guest.ticket }, me))).json();
    expect(next.guest.allowance.used).toBe(1);
  }
  const guest = await (await getGuest(request(null, me))).json();
  expect(guest).toMatchObject({ guest: true, used: 1, left: 2 });
});

test('Street and Script share the three games, and the fourth is a 429 that says when they come back', async () => {
  const me = await guestOn('198.51.100.61');
  expect((await postScriptRound(request({ config: { rounds: 5, seed: 's-a' }, roundIndex: 0 }, me))).status).toBe(200);
  expect((await postRound(request({ config: { mode: 'balanced', seed: 'st-b' }, roundIndex: 0 }, me))).status).toBe(200);
  expect((await postScriptRound(request({ config: { rounds: 5, seed: 's-c' }, roundIndex: 0 }, me))).status).toBe(200);
  const refused = await postRound(request({ config: { mode: 'balanced', seed: 'st-d' }, roundIndex: 0 }, me));
  expect(refused.status).toBe(429);
  const body = await refused.json();
  expect(body).toMatchObject({ code: 'guest_limit', network: false, limit: 3 });
  expect(body.resetAt).toBeGreaterThan(Date.now());
  // Asking for round three of a new game is still a new game.
  expect((await postScriptRound(request({ config: { rounds: 5, seed: 's-e' }, roundIndex: 2 }, me))).status).toBe(429);
});

test('a request with no profile is counted by its address, and no profile is made for it', async () => {
  // Making one per request would write a row for every headerless call,
  // which is what a scraper sends. The play pages make a profile first.
  const before = await memoryStore.listProfiles?.();
  const headers = { 'x-test-ip': '198.51.100.65' };
  const first = await (await postScriptRound(request({ config: { rounds: 5, seed: 'headless-1' }, roundIndex: 0 }, headers))).json();
  expect(first.profileToken).toBeUndefined();
  expect(first.guest.ticket).toEqual(expect.any(String));
  // Its own ticket still holds its game together.
  const next = await (await postScriptRound(request({ config: { rounds: 5, seed: 'headless-1' }, roundIndex: 1, ticket: first.guest.ticket }, headers))).json();
  expect(next.guest.allowance).toMatchObject({ guest: true, used: 0 });
  if (before) expect((await memoryStore.listProfiles()).length).toBe(before.length);
});

test('a signed-in player is never counted', async () => {
  const account = await memoryStore.createAccount({ email: 'counted-never@example.test' });
  const cookie = `geo_session=${sealSession({ accountId: account.id, email: account.email })}`;
  const headers = { 'x-test-ip': '198.51.100.62', cookie };
  for (let i = 0; i < 5; i++) {
    const res = await postScriptRound(request({ config: { rounds: 5, seed: `acct-${i}` }, roundIndex: 0 }, headers));
    expect(res.status).toBe(200);
    expect((await res.json()).guest).toEqual({ allowance: { guest: false } });
  }
  expect(await (await getGuest(request(null, headers))).json()).toMatchObject({ guest: false });
});

test('Ranked and the weekly cup ask a guest for an account; a signed-in player plays', async () => {
  const me = await guestOn('198.51.100.63');
  for (const mode of ['ranked', 'cup']) {
    const res = await postRound(request({ config: { mode }, roundIndex: 0 }, me));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('account_required');
  }
  const account = await memoryStore.createAccount({ email: 'ranked@example.test' });
  const cookie = `geo_session=${sealSession({ accountId: account.id, email: account.email })}`;
  expect((await postRound(request({ config: { mode: 'ranked' }, roundIndex: 0 }, { 'x-test-ip': '198.51.100.63', cookie }))).status).toBe(200);
});

test("a guest's daily is held off the board, with the place it would take, and goes up when they make an account", async () => {
  const ip = '198.51.100.64';
  const me = await guestOn(ip, 'Hopeful');
  let ticket;
  for (let i = 0; i < 5; i++) {
    const res = await (await postRound(request({ config: { mode: 'daily' }, roundIndex: i, ticket }, me))).json();
    ticket = ticket || res.guest.ticket;
    const token = res.round.candidates[0].token;
    const answer = openToken(token, { secret: TOKEN_SECRET });
    await postGuess(request({ token, guess: { lat: answer.lat, lng: answer.lng } }, me));
  }
  const dailyUrl = 'http://localhost/api/geo/daily';
  const held = await (await getDaily(request(null, me, dailyUrl))).json();
  expect(held.board.find((row) => row.name === 'Hopeful')).toBeUndefined();
  expect(held.you).toMatchObject({ finished: true, held: true, rank: 1, total: 25000 });

  // Making an account binds this browser's profile to it; nothing is copied.
  const account = await memoryStore.createAccount({ email: 'hopeful@example.test' });
  const cookie = `geo_session=${sealSession({ accountId: account.id, email: account.email })}`;
  await postProfile(request({}, { ...me, cookie }));
  const posted = await (await getDaily(request(null, { ...me, cookie }, dailyUrl))).json();
  expect(posted.board[0]).toMatchObject({ rank: 1, name: 'Hopeful', total: 25000 });
  expect(posted.you).toMatchObject({ held: false, rank: 1 });
});
