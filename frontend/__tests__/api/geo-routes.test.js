/**
 * The geo game's API surface.
 *
 * /api/geo/config never leaks a server key, /api/geo/round never leaks
 * the answer, /api/geo/guess scores from the sealed token, and a missing
 * key comes back as a 503 with the variable names, not a stack trace.
 */

const { GET: getConfig } = require('@/app/api/geo/config/route');
const { POST: postRound } = require('@/app/api/geo/round/route');
const { POST: postGuess } = require('@/app/api/geo/guess/route');
const { openToken } = require('@/app/lib/geo/server/tokens');

function request(body) {
  return { json: async () => body, headers: new Map(), url: 'http://localhost/api/geo/x' };
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
});
