/**
 * The geo game's API surface.
 *
 * /api/geo/config never leaks a server key, /api/geo/round never leaks
 * the answer, /api/geo/guess scores from the sealed token, and a missing
 * key comes back as a 503 with the variable names, not a stack trace.
 */

const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');

// The round route runs the play meter on the store and asks who is
// playing; here the store is in memory, nobody is signed in, and the
// speed limiter always says yes.
const memoryStore = createMemoryRoomStore();
jest.mock('@/app/lib/geo/server/roomStore', () => ({ prismaRoomStore: memoryStore }));
jest.mock('next-auth', () => ({ getServerSession: jest.fn().mockResolvedValue(null) }));
jest.mock('@/app/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/app/lib/rateLimit', () => ({
  checkRateLimitForKeyAsync: jest.fn().mockResolvedValue({ success: true }),
  getClientIP: (request) => request.headers.get('x-test-ip') || '203.0.113.9',
  withRateLimitAsync: jest.fn().mockResolvedValue({ success: true }),
  RateLimitPresets: { PUBLIC_WRITE: {}, PUBLIC_READ: {} },
  rateLimitResponse: jest.fn(),
}));

const { GET: getConfig } = require('@/app/api/geo/config/route');
const { POST: postRound } = require('@/app/api/geo/round/route');
const { POST: postGuess } = require('@/app/api/geo/guess/route');
const { POST: postProfile } = require('@/app/api/geo/profile/route');
const { GET: getDaily } = require('@/app/api/geo/daily/route');
const { GET: getShop, POST: postShop } = require('@/app/api/geo/shop/route');
const { openToken } = require('@/app/lib/geo/server/tokens');

function request(body, headers = {}) {
  return { json: async () => body, headers: new Map(Object.entries(headers)), url: 'http://localhost/api/geo/x' };
}

const hitFetch = jest.fn(async (url) => {
  const [lat, lng] = new URL(url).searchParams.get('location').split(',').map(Number);
  return {
    status: 200,
    json: async () => ({ status: 'OK', pano_id: `pano-${lat.toFixed(2)}`, location: { lat, lng }, copyright: '© Google', date: '2022-08' }),
  };
});

const ENV_KEYS = ['GOOGLE_STREET_VIEW_API_KEY', 'GOOGLE_MAPS_BROWSER_KEY', 'GOOGLE_PLACES_API_KEY', 'GOOGLE_MAPS_SERVER_KEY', 'NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY'];
const saved = {};

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.GOOGLE_STREET_VIEW_API_KEY = 'sv-key';
  process.env.GOOGLE_MAPS_BROWSER_KEY = 'browser-key';
  global.fetch = hitFetch;
  hitFetch.mockClear();
});

afterEach(() => {
  console.error.mockRestore?.();
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('GET /api/geo/config', () => {
  test('reports configured providers with the browser key only', async () => {
    const res = await getConfig();
    const body = await res.json();
    expect(body.providers.google).toMatchObject({ configured: true, browserKey: 'browser-key', missing: [] });
    expect(JSON.stringify(body)).not.toContain('sv-key');
    expect(body.daily.seed).toMatch(/^daily-\d{4}-\d{2}-\d{2}$/);
    expect(body.countries.length).toBeGreaterThan(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  test('names what is missing, and withholds the browser key until both keys exist', async () => {
    delete process.env.GOOGLE_STREET_VIEW_API_KEY;
    const body = await (await getConfig()).json();
    expect(body.providers.google.configured).toBe(false);
    expect(body.providers.google.browserKey).toBe('');
    expect(body.providers.google.missing).toEqual(['GOOGLE_STREET_VIEW_API_KEY']);
  });
});

describe('POST /api/geo/round', () => {
  test('returns a panorama and token, never the location', async () => {
    const res = await postRound(request({ config: { mode: 'balanced', seed: 'api-1' }, roundIndex: 2 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.config.mode).toBe('balanced');
    expect(body.round).toMatchObject({ provider: 'google', roundIndex: 2 });
    expect(body.round.panoId).toMatch(/^pano-/);
    expect(body.round.token).toMatch(/^g1\./);
    expect(JSON.stringify(body.round)).not.toMatch(/"lat"/);
    const answer = openToken(body.round.token, { secret: process.env.NEXTAUTH_SECRET });
    expect(answer.pano).toBe(body.round.panoId);
  });

  test('the same seed gives the same panorama on a second call', async () => {
    const a = await (await postRound(request({ config: { mode: 'world', seed: 'twice' } }))).json();
    const b = await (await postRound(request({ config: { mode: 'world', seed: 'twice' } }))).json();
    expect(a.round.panoId).toBe(b.round.panoId);
  });

  test('Apple rounds are candidate lists', async () => {
    const body = await (await postRound(request({ config: { provider: 'apple', mode: 'cities' } }))).json();
    expect(body.round.provider).toBe('apple');
    expect(body.round.candidates.length).toBeGreaterThan(5);
    expect(body.round.candidates[0].token).toMatch(/^g1\./);
    expect(hitFetch).not.toHaveBeenCalled();
  });

  test('the play meter: free Google rounds run out per address, the daily and Apple do not count, and a profile can be refused too', async () => {
    process.env.GEO_FREE_GOOGLE_ROUNDS = '2';
    try {
      const ip = { 'x-test-ip': '198.51.100.7' };
      expect((await postRound(request({ config: { mode: 'world', seed: 'm-1' } }, ip))).status).toBe(200);
      expect((await postRound(request({ config: { mode: 'world', seed: 'm-2' } }, ip))).status).toBe(200);
      const refused = await postRound(request({ config: { mode: 'world', seed: 'm-3' } }, ip));
      expect(refused.status).toBe(429);
      const body = await refused.json();
      expect(body.code).toBe('allowance');
      expect(body.error).toMatch(/free Google Street View rounds/);
      expect(typeof body.resetAt).toBe('number');
      expect(refused.headers.get('Retry-After')).toBeTruthy();
      // the daily challenge is on top of the allowance; Apple has none
      expect((await postRound(request({ config: { mode: 'daily' } }, ip))).status).toBe(200);
      expect((await postRound(request({ config: { provider: 'apple', mode: 'cities' } }, ip))).status).toBe(200);
      // a different address starts fresh
      expect((await postRound(request({ config: { mode: 'world', seed: 'm-4' } }, { 'x-test-ip': '198.51.100.8' }))).status).toBe(200);

      // a browser with a profile is metered by that profile
      const registered = await (await postProfile(request({ name: 'Ada' }, { 'x-test-ip': '198.51.100.9' }))).json();
      const mine = { 'x-test-ip': '198.51.100.9', 'x-geo-profile': registered.token };
      expect((await postRound(request({ config: { mode: 'world', seed: 'p-1' } }, mine))).status).toBe(200);
      expect((await postRound(request({ config: { mode: 'world', seed: 'p-2' } }, mine))).status).toBe(200);
      expect((await postRound(request({ config: { mode: 'world', seed: 'p-3' } }, mine))).status).toBe(429);
      const me = await (await postProfile(request({}, mine))).json();
      expect(me.profile.usage.google).toMatchObject({ freeUsed: 2, freeLimit: 2, freeLeft: 0 });
    } finally {
      delete process.env.GEO_FREE_GOOGLE_ROUNDS;
    }
  });

  test('a missing Google key is a 503 that says so', async () => {
    delete process.env.GOOGLE_STREET_VIEW_API_KEY;
    const res = await postRound(request({ config: { mode: 'world' } }));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('google_not_configured');
  });

  test('bad input is a 400, a dead key is a 502, no imagery is a 422', async () => {
    expect((await postRound({ json: async () => { throw new Error('nope'); } })).status).toBe(400);
    expect((await postRound(request({ config: { mode: 'country', region: 'ZZ' } }))).status).toBe(400);
    global.fetch = jest.fn(async () => ({ status: 200, json: async () => ({ status: 'REQUEST_DENIED', error_message: 'Street View Static API has not been used' }) }));
    const denied = await postRound(request({ config: { mode: 'world' } }));
    expect(denied.status).toBe(502);
    expect((await denied.json()).error).toContain('has not been used');
    global.fetch = jest.fn(async () => ({ status: 200, json: async () => ({ status: 'ZERO_RESULTS' }) }));
    const none = await postRound(request({ config: { mode: 'world', radius: 'pure' } }));
    expect(none.status).toBe(422);
    expect((await none.json()).stats.probes).toBeGreaterThan(0);
  });
});

describe('POST /api/geo/guess', () => {
  test('scores a guess from the sealed token and reveals the answer', async () => {
    const round = (await (await postRound(request({ config: { mode: 'country', region: 'FR', seed: 'g' } }))).json()).round;
    const answer = openToken(round.token, { secret: process.env.NEXTAUTH_SECRET });
    const res = await postGuess(request({ token: round.token, guess: { lat: answer.lat + 0.5, lng: answer.lng } }));
    expect(res.status).toBe(200);
    const { result } = await res.json();
    expect(result.kind).toBe('pin');
    expect(result.distanceKm).toBeGreaterThan(50);
    expect(result.distanceKm).toBeLessThan(60);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(5000);
    expect(result.answer).toMatchObject({ lat: answer.lat, lng: answer.lng, country: { code: 'FR' } });
  });

  test('rejects missing and invalid tokens', async () => {
    expect((await postGuess(request({}))).status).toBe(400);
    const res = await postGuess(request({ token: 'g1.garbage', guess: null }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('invalid');
  });

  test("a daily round lands on today's board for the profile, first guess only, and the board answers with your rank", async () => {
    const registered = await (await postProfile(request({ name: 'Ada' }, { 'x-test-ip': '198.51.100.20' }))).json();
    const mine = { 'x-test-ip': '198.51.100.20', 'x-geo-profile': registered.token };
    const today = new Date().toISOString().slice(0, 10);
    const totals = [];
    for (let i = 0; i < 5; i++) {
      const round = (await (await postRound(request({ config: { mode: 'daily' }, roundIndex: i }, mine))).json()).round;
      const answer = openToken(round.token, { secret: process.env.NEXTAUTH_SECRET });
      const { challenge } = await (await postGuess(request({ token: round.token, guess: { lat: answer.lat, lng: answer.lng } }, mine))).json();
      expect(challenge).toMatchObject({ key: `daily:${today}`, recorded: true, rounds: i + 1, finished: i === 4 });
      totals.push(challenge.total);
      if (i === 0) {
        // a second guess on the same round changes nothing
        const repeat = await (await postGuess(request({ token: round.token, guess: null }, mine))).json();
        expect(repeat.challenge).toMatchObject({ recorded: false, rounds: 1, total: challenge.total });
      }
    }
    expect(totals[4]).toBe(5 * 5000);
    // without a profile the guess is scored and nothing is recorded
    const round = (await (await postRound(request({ config: { mode: 'daily' }, roundIndex: 0 }, { 'x-test-ip': '198.51.100.21' }))).json()).round;
    const anon = await (await postGuess(request({ token: round.token, guess: null }, { 'x-test-ip': '198.51.100.21' }))).json();
    expect(anon.result.score).toBe(0);
    expect(anon.challenge).toBeNull();

    const board = await (await getDaily({ ...request(null, mine), url: 'http://localhost/api/geo/daily' })).json();
    expect(board).toMatchObject({ date: today, rounds: 5, finished: 1 });
    expect(board.board[0]).toMatchObject({ rank: 1, name: 'Ada', total: 25000 });
    expect(board.you).toMatchObject({ rank: 1, total: 25000, finished: true });
    const past = await (await getDaily({ ...request(null, {}), url: 'http://localhost/api/geo/daily?date=2020-01-01' })).json();
    expect(past).toMatchObject({ date: '2020-01-01', players: 0, board: [], you: null });
    const junk = await (await getDaily({ ...request(null, {}), url: 'http://localhost/api/geo/daily?date=nope' })).json();
    expect(junk.date).toBe(today);
  });

  test('a scored round earns points and a badge for the profile, and the shop sells what they buy', async () => {
    const registered = await (await postProfile(request({ name: 'Grace' }, { 'x-test-ip': '198.51.100.30' }))).json();
    const mine = { 'x-test-ip': '198.51.100.30', 'x-geo-profile': registered.token };
    const round = (await (await postRound(request({ config: { mode: 'country', region: 'JP', seed: 'pts' } }, mine))).json()).round;
    const answer = openToken(round.token, { secret: process.env.NEXTAUTH_SECRET });
    const { points } = await (await postGuess(request({ token: round.token, guess: { lat: answer.lat, lng: answer.lng } }, mine))).json();
    expect(points.earned).toBeGreaterThan(0);
    expect(points.badge).toMatchObject({ countryCode: 'JP' });
    expect(points.balance).toBe(points.earned);
    const me = await (await postProfile(request({}, mine))).json();
    expect(me.profile.points).toBe(points.earned);
    expect(me.profile.badges[0].countryCode).toBe('JP');
    expect(me.profile.ledger.length).toBeGreaterThan(0);
    expect(me.profile.equipped.pin.id).toBe('pin-classic');

    expect((await getShop(request(null, { 'x-test-ip': '198.51.100.31' }))).status).toBe(401);
    const shop = await (await getShop(request(null, mine))).json();
    expect(shop.shop.points).toBe(points.earned);
    // a season of play later
    await memoryStore.addPoints(me.profile.id, 1000);
    const cheap = shop.shop.items.find((i) => i.price > 0 && i.price <= 1000);
    const bought = await (await postShop(request({ action: 'buy', itemId: cheap.id }, mine))).json();
    expect(bought.shop.owned).toContain(cheap.id);
    expect(bought.shop.points).toBe(points.earned + 1000 - cheap.price);
    const refused = await postShop(request({ action: 'buy', itemId: 'pin-star' }, mine));
    expect(refused.status).toBe(402);
    expect((await postShop(request({ action: 'dance', itemId: 'x' }, mine))).status).toBe(400);
  });
});
