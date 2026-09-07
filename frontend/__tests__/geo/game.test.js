/**
 * Rounds and guesses end to end, with Google mocked.
 *
 * The rules under test: the round response never carries the answer,
 * only official outdoor imagery counts, a seed replays the same round,
 * the guess endpoint scores from the sealed token, and a missing key is
 * reported as configuration, not as a crash.
 */

const { probeStreetView, findPanorama, isOfficialCopyright } = require('@/app/lib/geo/server/streetview');
const { createCandidateSource, coveredPool, radiusForCountry } = require('@/app/lib/geo/server/sampler');
const { createRound, evaluateGuess, GeoGameError, APPLE_CANDIDATES_PER_ROUND } = require('@/app/lib/geo/server/game');
const { openToken } = require('@/app/lib/geo/server/tokens');
const { normalizeConfig } = require('@/app/lib/geo/modes');
const { countryAt } = require('@/app/lib/geo/server/countries');

const KEY = 'server-key';
const ENV = { GOOGLE_STREET_VIEW_API_KEY: KEY, GOOGLE_MAPS_BROWSER_KEY: 'browser-key', NEXTAUTH_SECRET: 'jest-secret-long-enough' };

/** A fake metadata endpoint: every point has official imagery 300 m away. */
function fetchAlwaysHit(overrides = {}) {
  return jest.fn(async (url) => {
    const u = new URL(url);
    const [lat, lng] = u.searchParams.get('location').split(',').map(Number);
    return {
      status: 200,
      json: async () => ({
        status: 'OK',
        pano_id: `pano-${lat.toFixed(3)}-${lng.toFixed(3)}`,
        location: { lat: lat + 0.002, lng: lng + 0.002 },
        date: '2023-05',
        copyright: '© Google',
        ...overrides,
      }),
    };
  });
}

function fetchStatus(status, extra = {}) {
  return jest.fn(async () => ({ status: 200, json: async () => ({ status, ...extra }) }));
}

describe('probeStreetView', () => {
  test('sends the right query and recognises official imagery', async () => {
    const fetchImpl = fetchAlwaysHit();
    const r = await probeStreetView({ lat: 48.8566, lng: 2.3522, radiusKm: 10, key: KEY, fetchImpl });
    expect(r.status).toBe('hit');
    expect(r.panoId).toMatch(/^pano-/);
    const url = new URL(fetchImpl.mock.calls[0][0]);
    expect(url.searchParams.get('radius')).toBe('10000');
    expect(url.searchParams.get('source')).toBe('outdoor');
    expect(url.searchParams.get('key')).toBe(KEY);
  });

  test('skips user photo spheres', async () => {
    const r = await probeStreetView({ lat: 1, lng: 1, key: KEY, fetchImpl: fetchAlwaysHit({ copyright: '© Jane Doe' }) });
    expect(r).toEqual({ status: 'miss', reason: 'unofficial' });
    expect(isOfficialCopyright('© 2024 Google')).toBe(true);
    expect(isOfficialCopyright('© Someone')).toBe(false);
  });

  test('no imagery is a miss, a bad key is a fatal error, a dead network is a soft error', async () => {
    expect((await probeStreetView({ lat: 1, lng: 1, key: KEY, fetchImpl: fetchStatus('ZERO_RESULTS') })).status).toBe('miss');
    const denied = await probeStreetView({ lat: 1, lng: 1, key: KEY, fetchImpl: fetchStatus('REQUEST_DENIED', { error_message: 'API not enabled' }) });
    expect(denied).toMatchObject({ status: 'error', code: 'REQUEST_DENIED', fatal: true, message: 'API not enabled' });
    const dead = await probeStreetView({ lat: 1, lng: 1, key: KEY, fetchImpl: jest.fn(async () => { throw new Error('ECONNRESET'); }) });
    expect(dead).toMatchObject({ status: 'error', code: 'network', fatal: false });
    expect((await probeStreetView({ lat: 1, lng: 1, key: '', fetchImpl: fetchAlwaysHit() })).code).toBe('no_key');
  });
});

describe('findPanorama', () => {
  function sourceOf(points) {
    let i = 0;
    return { next: () => (i < points.length ? points[i++] : null), stats: { skippedWater: 7 } };
  }

  test('returns the first hit in candidate order and honest stats', async () => {
    const points = Array.from({ length: 5 }, (_, i) => ({ lat: 10 + i, lng: 20, radiusKm: 10 }));
    const fetchImpl = jest.fn(async (url) => {
      const lat = Number(new URL(url).searchParams.get('location').split(',')[0]);
      return { status: 200, json: async () => (lat === 12 ? { status: 'OK', pano_id: 'p12', location: { lat: 12, lng: 20 }, copyright: '© Google' } : { status: 'ZERO_RESULTS' }) };
    });
    const found = await findPanorama({ source: sourceOf(points), key: KEY, fetchImpl, batchSize: 4 });
    expect(found.hit.panoId).toBe('p12');
    expect(found.candidate.lat).toBe(12);
    expect(found.stats).toMatchObject({ probes: 3, misses: 2, water: 7 });
  });

  test('gives up cleanly when nothing hits', async () => {
    const points = Array.from({ length: 30 }, (_, i) => ({ lat: i, lng: 0, radiusKm: 2 }));
    const found = await findPanorama({ source: sourceOf(points), key: KEY, fetchImpl: fetchStatus('ZERO_RESULTS'), maxProbes: 8, batchSize: 4 });
    expect(found.hit).toBeNull();
    expect(found.error.code).toBe('no_imagery');
    expect(found.stats.probes).toBe(8);
  });

  test('stops at the first fatal error', async () => {
    const points = Array.from({ length: 30 }, (_, i) => ({ lat: i, lng: 0, radiusKm: 2 }));
    const fetchImpl = fetchStatus('REQUEST_DENIED');
    const found = await findPanorama({ source: sourceOf(points), key: KEY, fetchImpl, batchSize: 4 });
    expect(found.error.code).toBe('REQUEST_DENIED');
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });
});

describe('createCandidateSource', () => {
  test('world mode draws land points with the preset radius and counts water', () => {
    const source = createCandidateSource(normalizeConfig({ mode: 'world', radius: 'pure', seed: 's1' }), 0);
    const c = source.next();
    expect(countryAt(c.lat, c.lng)).not.toBeNull();
    expect(c.radiusKm).toBe(2);
    expect(source.stats.skippedWater).toBeGreaterThanOrEqual(0);
  });

  test('a seed replays the same candidates; no seed does not', () => {
    const cfg = normalizeConfig({ mode: 'balanced', seed: 'replay-me' });
    const a = createCandidateSource(cfg, 2);
    const b = createCandidateSource(cfg, 2);
    const seqA = Array.from({ length: 4 }, () => a.next()).map((c) => [c.lat, c.lng, c.country.cca2]);
    const seqB = Array.from({ length: 4 }, () => b.next()).map((c) => [c.lat, c.lng, c.country.cca2]);
    expect(seqA).toEqual(seqB);
    const other = createCandidateSource(cfg, 3).next();
    expect([other.lat, other.lng]).not.toEqual(seqA[0].slice(0, 2));
    const unseeded1 = createCandidateSource(normalizeConfig({ mode: 'balanced' }), 0).next();
    const unseeded2 = createCandidateSource(normalizeConfig({ mode: 'balanced' }), 0).next();
    expect([unseeded1.lat, unseeded1.lng]).not.toEqual([unseeded2.lat, unseeded2.lng]);
  });

  test('country mode stays inside the country and scales its radius and scoring', () => {
    const source = createCandidateSource(normalizeConfig({ mode: 'country', region: 'CH', seed: 'ch' }), 0);
    for (let i = 0; i < 50; i++) {
      const c = source.next();
      expect(countryAt(c.lat, c.lng)?.cca2).toBe('CH');
      expect(c.radiusKm).toBeLessThanOrEqual(10);
    }
    expect(source.sizeKm).toBeGreaterThan(100);
    expect(source.sizeKm).toBeLessThan(600);
    expect(radiusForCountry({ areaKm2: 100 }, 10)).toBe(2.5);
    expect(radiusForCountry({ areaKm2: 9000000 }, 10)).toBe(10);
  });

  test('continent mode only draws covered countries in that continent', () => {
    const source = createCandidateSource(normalizeConfig({ mode: 'continent', region: 'south-america', seed: 'sa' }), 0);
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      const c = source.next();
      expect(c.country.subregion).toBe('South America');
      seen.add(c.country.cca2);
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(seen.has('VE')).toBe(false);
  });

  test('balanced mode spreads across many countries', () => {
    const source = createCandidateSource(normalizeConfig({ mode: 'balanced', seed: 'spread' }), 0);
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(source.next().country.cca2);
    expect(seen.size).toBeGreaterThan(40);
    expect(coveredPool().every((c) => c.cca2 !== 'CN')).toBe(true);
  });

  test('city mode draws inside a listed city for the provider', () => {
    const apple = createCandidateSource(normalizeConfig({ provider: 'apple', mode: 'cities', seed: 'c' }), 0);
    const c = apple.next();
    expect(c.city).toBeTruthy();
    expect(c.country).not.toBeNull();
    expect(c.radiusKm).toBeLessThanOrEqual(2);
    expect(() => createCandidateSource(normalizeConfig({ mode: 'country', region: 'ZZ' }), 0)).toThrow(/Unknown country/);
  });
});

describe('createRound and evaluateGuess', () => {
  test('a Google round hides the answer and the guess reveals it', async () => {
    const fetchImpl = fetchAlwaysHit();
    const round = await createRound({ config: { mode: 'balanced', seed: 'game-1' }, roundIndex: 0, fetchImpl, env: ENV });
    expect(round.provider).toBe('google');
    expect(round.panoId).toMatch(/^pano-/);
    expect(round.heading).toBeGreaterThanOrEqual(0);
    expect(round.heading).toBeLessThan(360);
    expect(round.stats.probes).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(round)).not.toMatch(/"lat"/);

    const answer = openToken(round.token, { secret: ENV.NEXTAUTH_SECRET });
    expect(answer.p).toBe('google');
    expect(answer.cc).toMatch(/^[A-Z]{2}$/);

    const exact = evaluateGuess({ token: round.token, guess: { lat: answer.lat, lng: answer.lng }, env: ENV });
    expect(exact).toMatchObject({ kind: 'pin', score: 5000, roundIndex: 0 });
    expect(exact.answer.country.code).toBe(answer.cc);
    expect(exact.answer.panoId).toBe(round.panoId);

    const far = evaluateGuess({ token: round.token, guess: { lat: answer.lat, lng: ((answer.lng + 180 + 180) % 360) - 180 }, env: ENV });
    expect(far.score).toBeLessThan(exact.score);
    expect(far.distanceKm).toBeGreaterThan(1000);

    const timedOut = evaluateGuess({ token: round.token, guess: null, env: ENV });
    expect(timedOut).toMatchObject({ score: 0, timedOut: true });
    expect(timedOut.answer.lat).toBe(answer.lat);
  });

  test('a seeded round replays the same panorama and heading', async () => {
    const a = await createRound({ config: { mode: 'world', seed: 'same' }, roundIndex: 1, fetchImpl: fetchAlwaysHit(), env: ENV });
    const b = await createRound({ config: { mode: 'world', seed: 'same' }, roundIndex: 1, fetchImpl: fetchAlwaysHit(), env: ENV });
    expect(a.panoId).toBe(b.panoId);
    expect(a.heading).toBe(b.heading);
    expect(a.token).not.toBe(b.token); // fresh IV each time
  });

  test('a retry of a seeded round moves on to new points instead of repeating the failure', async () => {
    const first = await createRound({ config: { mode: 'world', seed: 'retry' }, roundIndex: 0, fetchImpl: fetchAlwaysHit(), env: ENV });
    const again = await createRound({ config: { mode: 'world', seed: 'retry' }, roundIndex: 0, attempt: 0, fetchImpl: fetchAlwaysHit(), env: ENV });
    const moved = await createRound({ config: { mode: 'world', seed: 'retry' }, roundIndex: 0, attempt: 1, fetchImpl: fetchAlwaysHit(), env: ENV });
    expect(again.panoId).toBe(first.panoId);
    expect(moved.panoId).not.toBe(first.panoId);
  });

  test('streak rounds are judged by country', async () => {
    const round = await createRound({ config: { mode: 'streak', seed: 'streak-1' }, roundIndex: 0, fetchImpl: fetchAlwaysHit(), env: ENV });
    const answer = openToken(round.token, { secret: ENV.NEXTAUTH_SECRET });
    expect(evaluateGuess({ token: round.token, guess: { countryCode: answer.cc.toLowerCase() }, env: ENV })).toMatchObject({ kind: 'streak', correct: true });
    expect(evaluateGuess({ token: round.token, guess: { countryCode: 'ZZ' }, env: ENV })).toMatchObject({ kind: 'streak', correct: false });
    expect(evaluateGuess({ token: round.token, guess: null, env: ENV }).correct).toBe(false);
  });

  test('an Apple round hands the browser candidates, each with its own sealed answer', async () => {
    const round = await createRound({ config: { provider: 'apple', mode: 'cities', seed: 'apple-1' }, roundIndex: 0, env: ENV });
    expect(round.provider).toBe('apple');
    expect(round.candidates).toHaveLength(APPLE_CANDIDATES_PER_ROUND);
    for (const c of round.candidates) {
      const opened = openToken(c.token, { secret: ENV.NEXTAUTH_SECRET });
      expect(opened.lat).toBe(c.lat);
      expect(opened.p).toBe('apple');
      expect(opened.city).toBeTruthy();
    }
  });

  test('missing configuration is reported, not thrown as a crash', async () => {
    await expect(createRound({ config: { mode: 'world' }, env: { NEXTAUTH_SECRET: ENV.NEXTAUTH_SECRET } })).rejects.toMatchObject({ code: 'google_not_configured' });
    await expect(createRound({ config: { mode: 'world' }, env: { GOOGLE_STREET_VIEW_API_KEY: KEY } })).rejects.toMatchObject({ code: 'no_secret' });
    await expect(createRound({ config: { mode: 'world', seed: 'x' }, fetchImpl: fetchStatus('REQUEST_DENIED', { error_message: 'not enabled' }), env: ENV })).rejects.toMatchObject({ code: 'probe_failed', message: expect.stringContaining('not enabled') });
    const noImagery = createRound({ config: { mode: 'world', seed: 'x' }, fetchImpl: fetchStatus('ZERO_RESULTS'), env: ENV });
    await expect(noImagery).rejects.toBeInstanceOf(GeoGameError);
    await expect(noImagery).rejects.toMatchObject({ code: 'no_imagery' });
  });

  test('a tampered or expired token cannot be scored', async () => {
    const round = await createRound({ config: { mode: 'world', seed: 't' }, roundIndex: 0, fetchImpl: fetchAlwaysHit(), env: ENV });
    expect(() => evaluateGuess({ token: round.token + 'x', guess: { lat: 0, lng: 0 }, env: ENV })).toThrow(/open/);
    expect(() => evaluateGuess({ token: round.token, guess: { lat: 0, lng: 0 }, env: ENV, now: Date.now() + 13 * 3600 * 1000 })).toThrow(/expired/);
  });
});
