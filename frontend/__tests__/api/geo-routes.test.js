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
jest.mock('@/app/lib/geo/server/limiter', () => ({
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
const { GET: getCup } = require('@/app/api/geo/cup/route');
const { openToken } = require('@/app/lib/geo/server/tokens');

/**
 * The token a round can be scored with. A Google round has one; an
 * Apple round is a list of places to try, each sealed on its own, and
 * the daily and the cup are Apple rounds now.
 */
const roundToken = (round) => round.token || round.candidates?.[0]?.token;

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

const ENV_KEYS = [
  'GOOGLE_STREET_VIEW_API_KEY',
  'GOOGLE_MAPS_BROWSER_KEY',
  'GOOGLE_PLACES_API_KEY',
  'GOOGLE_MAPS_SERVER_KEY',
  'NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY',
  // next/jest loads frontend/.env, and GEO_TOKEN_SECRET is a documented
  // variable that takes precedence over NEXTAUTH_SECRET when the server
  // seals a token. A developer or CI box that sets it used to get five
  // red tests here for a reason that had nothing to do with the code.
  // The suite pins the secret instead of hoping nobody set one.
  'GEO_TOKEN_SECRET',
];
const TOKEN_SECRET = 'geo-routes-test-secret-long-enough';
const saved = {};

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.GOOGLE_STREET_VIEW_API_KEY = 'sv-key';
  process.env.GOOGLE_MAPS_BROWSER_KEY = 'browser-key';
  process.env.GEO_TOKEN_SECRET = TOKEN_SECRET;
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
  test('there is one imagery, and it is set up', async () => {
    const res = await getConfig();
    const body = await res.json();
    expect(Object.keys(body.providers)).toEqual(['apple']);
    expect(body.providers.apple).toMatchObject({ configured: true, missing: [] });
    expect(body.primary).toBe('apple');
    expect(body.daily.seed).toMatch(/^daily-\d{4}-\d{2}-\d{2}$/);
    expect(body.countries.length).toBeGreaterThan(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  test('no key of any kind is ever in the reply', async () => {
    // The Google browser key used to be here, public by design and
    // locked to this site's referrers. There is no key to send now, and
    // nothing here should ever carry one again.
    const body = JSON.stringify(await (await getConfig()).json());
    expect(body).not.toContain('sv-key');
    expect(body).not.toContain('browser-key');
    expect(body).not.toMatch(/browserKey|Key|secret/i);
  });
});

describe('POST /api/geo/round', () => {
  test('returns the places to try, each with its own sealed answer', async () => {
    const res = await postRound(request({ config: { mode: 'balanced', seed: 'api-1' }, roundIndex: 2 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.config.mode).toBe('balanced');
    expect(body.round).toMatchObject({ provider: 'apple', roundIndex: 2 });
    // Apple has no metadata endpoint, so the browser gets the places and
    // opens them itself. What stays sealed is the country and the city.
    expect(body.round.candidates.length).toBeGreaterThan(0);
    expect(JSON.stringify(body.round)).not.toMatch(/"countryName"/);
    const answer = openToken(body.round.candidates[0].token, { secret: TOKEN_SECRET });
    expect(answer.p).toBe('apple');
    expect(answer.lat).toBe(body.round.candidates[0].lat);
  });

  test('the same seed gives the same places on a second call', async () => {
    const a = await (await postRound(request({ config: { mode: 'balanced', seed: 'twice' } }))).json();
    const b = await (await postRound(request({ config: { mode: 'balanced', seed: 'twice' } }))).json();
    // The coordinates, not panoId: Apple has no panorama id to compare,
    // and comparing two undefineds passed whatever the sampler did.
    const places = (r) => r.round.candidates.map((c) => `${c.lat},${c.lng}`);
    expect(places(a).length).toBeGreaterThan(0);
    expect(places(a)).toEqual(places(b));
  });

  test('Apple rounds are candidate lists', async () => {
    // Casual play deliberately includes a 1-in-200 NASA photo round. Pin an
    // Earth seed for this contract; the surprise path has its own test suite.
    const body = await (await postRound(request({ config: { provider: 'apple', mode: 'cities', seed: 'twice' } }))).json();
    expect(body.round.provider).toBe('apple');
    expect(body.round.candidates.length).toBeGreaterThan(5);
    expect(body.round.candidates[0].token).toMatch(/^g1\./);
    expect(hitFetch).not.toHaveBeenCalled();
  });

  test('the play meter now only holds a flood back', async () => {
    // The Google allowance, the bought rounds and the free room game are
    // gone with Google. What is left is the ceiling and the speed limit,
    // and neither is reachable in a handful of requests.
    const ip = { 'x-test-ip': '198.51.100.7' };
    for (const seed of ['m-1', 'm-2', 'm-3']) {
      expect((await postRound(request({ config: { mode: 'balanced', seed } }, ip))).status).toBe(200);
    }
    // The daily is scored on a board, so it is still played as somebody.
    const dailyProfile = await (await postProfile(request({ name: 'Daily' }, ip))).json();
    const dailyHeaders = { ...ip, 'x-geo-profile': dailyProfile.token };
    expect((await postRound(request({ config: { mode: 'daily' } }, dailyHeaders))).status).toBe(200);
    expect((await postRound(request({ config: { mode: 'daily' } }, ip))).status).toBe(401);
    // A retired mode opens the one that replaced it rather than 400ing.
    expect((await postRound(request({ config: { mode: 'cities' } }, ip))).status).toBe(200);
  });


  test('bad input is a 400', async () => {
    expect((await postRound({ json: async () => { throw new Error('nope'); } })).status).toBe(400);
    // A link to the retired country mode is not bad input: it plays World.
    expect((await postRound(request({ config: { mode: 'country', region: 'ZZ' } }))).status).toBe(200);
  });
});

describe('POST /api/geo/guess', () => {
  test('scores a guess from the sealed token and reveals the answer', async () => {
    const round = (await (await postRound(request({ config: { provider: 'google', mode: 'balanced', seed: 'g' } }))).json()).round;
    const answer = openToken(roundToken(round), { secret: TOKEN_SECRET });
    const res = await postGuess(request({ token: roundToken(round), guess: { lat: answer.lat + 0.5, lng: answer.lng } }));
    expect(res.status).toBe(200);
    const { result } = await res.json();
    expect(result.kind).toBe('pin');
    expect(result.distanceKm).toBeGreaterThan(50);
    expect(result.distanceKm).toBeLessThan(60);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(5000);
    expect(result.answer).toMatchObject({ lat: answer.lat, lng: answer.lng, country: { code: answer.cc } });
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
      const answer = openToken(roundToken(round), { secret: TOKEN_SECRET });
      const { challenge } = await (await postGuess(request({ token: roundToken(round), guess: { lat: answer.lat, lng: answer.lng } }, mine))).json();
      expect(challenge).toMatchObject({ key: `daily:${today}`, recorded: true, rounds: i + 1, finished: i === 4 });
      totals.push(challenge.total);
      if (i === 0) {
        // a second guess on the same round changes nothing
        const repeat = await (await postGuess(request({ token: roundToken(round), guess: null }, mine))).json();
        expect(repeat.challenge).toMatchObject({ recorded: false, rounds: 1, total: challenge.total });
      }
    }
    expect(totals[4]).toBe(5 * 5000);
    // A challenge round cannot be opened without a profile, and it is
    // revealed only to the profile that opened it. Both halves of the
    // old attack: read the answer with no identity and nothing recorded,
    // then replay the same round under a real profile for a perfect
    // 5,000 that lands as that profile's first guess.
    const anonRound = await postRound(request({ config: { mode: 'daily' }, roundIndex: 0 }, { 'x-test-ip': '198.51.100.21' }));
    expect(anonRound.status).toBe(401);
    expect((await anonRound.json()).code).toBe('no_profile');

    const other = await (await postProfile(request({ name: 'Mallory' }, { 'x-test-ip': '198.51.100.22' }))).json();
    const theirs = { 'x-test-ip': '198.51.100.22', 'x-geo-profile': other.token };
    const theirRound = (await (await postRound(request({ config: { mode: 'daily' }, roundIndex: 0 }, theirs))).json()).round;
    const stolen = await postGuess(request({ token: roundToken(theirRound), guess: null }, mine));
    expect(stolen.status).toBe(403);
    const stolenBody = await stolen.json();
    expect(stolenBody.code).toBe('wrong_player');
    expect(stolenBody.result).toBeUndefined();
    const noProfile = await postGuess(request({ token: roundToken(theirRound), guess: null }, { 'x-test-ip': '198.51.100.23' }));
    expect(noProfile.status).toBe(403);

    const board = await (await getDaily({ ...request(null, mine), url: 'http://localhost/api/geo/daily' })).json();
    expect(board).toMatchObject({ date: today, rounds: 5, finished: 1 });
    expect(board.board[0]).toMatchObject({ rank: 1, name: 'Ada', total: 25000 });
    expect(board.you).toMatchObject({ rank: 1, total: 25000, finished: true });
    const past = await (await getDaily({ ...request(null, {}), url: 'http://localhost/api/geo/daily?date=2020-01-01' })).json();
    expect(past).toMatchObject({ date: '2020-01-01', players: 0, board: [], you: null });
    const junk = await (await getDaily({ ...request(null, {}), url: 'http://localhost/api/geo/daily?date=nope' })).json();
    expect(junk.date).toBe(today);
  });

  test("a cup round lands on this week's board, and the cup route says when the week ends and what it pays", async () => {
    const registered = await (await postProfile(request({ name: 'Cupper' }, { 'x-test-ip': '198.51.100.40' }))).json();
    const mine = { 'x-test-ip': '198.51.100.40', 'x-geo-profile': registered.token };
    const round = (await (await postRound(request({ config: { mode: 'cup' }, roundIndex: 0 }, mine))).json()).round;
    const answer = openToken(roundToken(round), { secret: TOKEN_SECRET });
    const { challenge } = await (await postGuess(request({ token: roundToken(round), guess: { lat: answer.lat, lng: answer.lng } }, mine))).json();
    expect(challenge).toMatchObject({ recorded: true, rounds: 1, finished: false });
    expect(challenge.key).toMatch(/^cup:\d{4}-W\d{2}$/);
    const cup = await (await getCup({ ...request(null, mine), url: 'http://localhost/api/geo/cup' })).json();
    expect(cup).toMatchObject({ rounds: 10, players: 1, finished: 0, prizes: { finished: 20 } });
    expect(cup.week).toBe(challenge.key.slice(4));
    expect(cup.endsAt).toBeGreaterThan(Date.now());
    expect(cup.you).toMatchObject({ rounds: 1, finished: false, rank: null });
    const past = await (await getCup({ ...request(null, {}), url: 'http://localhost/api/geo/cup?week=2020-W01' })).json();
    expect(past).toMatchObject({ week: '2020-W01', players: 0, board: [] });
  });

  test('a scored round earns points and a badge for the profile, and the shop sells what they buy', async () => {
    const registered = await (await postProfile(request({ name: 'Grace' }, { 'x-test-ip': '198.51.100.30' }))).json();
    const mine = { 'x-test-ip': '198.51.100.30', 'x-geo-profile': registered.token };
    const round = (await (await postRound(request({ config: { mode: 'balanced', seed: 'pts' } }, mine))).json()).round;
    const answer = openToken(roundToken(round), { secret: TOKEN_SECRET });
    const { points } = await (await postGuess(request({ token: roundToken(round), guess: { lat: answer.lat, lng: answer.lng } }, mine))).json();
    expect(points.earned).toBeGreaterThan(0);
    expect(points.badge).toMatchObject({ countryCode: answer.cc });
    expect(points.balance).toBe(points.earned);
    const me = await (await postProfile(request({}, mine))).json();
    expect(me.profile.points).toBe(points.earned);
    expect(me.profile.badges[0].countryCode).toBe(answer.cc);
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

/**
 * Last on purpose. This is the only test that takes the token secret
 * out of the environment, and the round route kicks off an unawaited
 * sweep, so anything running inside that window would see a server with
 * no secret and fail for a reason that has nothing to do with it.
 */
describe('GET /api/geo/config with nothing set up', () => {
  test('names the one variable an operator has to set, when it is not set', async () => {
    const saved = { secret: process.env.GEO_TOKEN_SECRET, auth: process.env.NEXTAUTH_SECRET };
    delete process.env.GEO_TOKEN_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    try {
      const body = await (await getConfig()).json();
      expect(body.providers.apple.configured).toBe(false);
      // The game's own variable, not the pet site's: the setup screen
      // renders this list verbatim.
      expect(body.providers.apple.missing).toEqual(['GEO_TOKEN_SECRET']);
    } finally {
      if (saved.secret === undefined) delete process.env.GEO_TOKEN_SECRET;
      else process.env.GEO_TOKEN_SECRET = saved.secret;
      if (saved.auth === undefined) delete process.env.NEXTAUTH_SECRET;
      else process.env.NEXTAUTH_SECRET = saved.auth;
    }
  });
});
