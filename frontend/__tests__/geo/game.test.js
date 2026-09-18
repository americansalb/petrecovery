/**
 * Rounds and guesses end to end, on Apple Look Around.
 *
 * The rules under test: the round response never carries the answer, a
 * seed replays the same round, and the guess endpoint scores from the
 * sealed token.
 */

const { createCandidateSource, radiusForCountry } = require('@/app/lib/geo/server/sampler');
const { createRound, evaluateGuess, GeoGameError, APPLE_CANDIDATES_PER_ROUND } = require('@/app/lib/geo/server/game');
const { openToken } = require('@/app/lib/geo/server/tokens');
const { normalizeConfig } = require('@/app/lib/geo/modes');
const { countryAt } = require('@/app/lib/geo/server/countries');
const { hasAppleCoverage } = require('@/app/lib/geo/coverage');

const ENV = { NEXTAUTH_SECRET: 'jest-secret-long-enough' };

describe('createCandidateSource', () => {
  test('world mode draws land points with the preset radius and counts water', () => {
    const source = createCandidateSource(normalizeConfig({ provider: 'apple', mode: 'balanced', radius: 'pure', seed: 's1' }), 0);
    const c = source.next();
    expect(countryAt(c.lat, c.lng)).not.toBeNull();
    expect(c.radiusKm).toBe(2);
    expect(source.stats.skippedWater).toBeGreaterThanOrEqual(0);
  });

  test('a seed replays the same candidates; no seed does not', () => {
    const cfg = normalizeConfig({ provider: 'apple', mode: 'balanced', seed: 'replay-me' });
    const a = createCandidateSource(cfg, 2);
    const b = createCandidateSource(cfg, 2);
    const seqA = Array.from({ length: 4 }, () => a.next()).map((c) => [c.lat, c.lng, c.country.cca2]);
    const seqB = Array.from({ length: 4 }, () => b.next()).map((c) => [c.lat, c.lng, c.country.cca2]);
    expect(seqA).toEqual(seqB);
    const other = createCandidateSource(cfg, 3).next();
    expect([other.lat, other.lng]).not.toEqual(seqA[0].slice(0, 2));
    const unseeded1 = createCandidateSource(normalizeConfig({ provider: 'apple', mode: 'balanced' }), 0).next();
    const unseeded2 = createCandidateSource(normalizeConfig({ provider: 'apple', mode: 'balanced' }), 0).next();
    expect([unseeded1.lat, unseeded1.lng]).not.toEqual([unseeded2.lat, unseeded2.lng]);
  });

  test('country mode stays inside the country and scales its radius and scoring', () => {
    const source = createCandidateSource(normalizeConfig({ provider: 'apple', mode: 'country', region: 'JP', seed: 'ch' }), 0);
    for (let i = 0; i < 50; i++) {
      const c = source.next();
      expect(countryAt(c.lat, c.lng)?.cca2).toBe('JP');
      expect(c.radiusKm).toBeLessThanOrEqual(10);
    }
    // Japan is long and thin: the scoring scale is its real diagonal.
    expect(source.sizeKm).toBeGreaterThan(1000);
    expect(source.sizeKm).toBeLessThan(3000);
    expect(radiusForCountry({ areaKm2: 100 }, 10)).toBe(2.5);
    expect(radiusForCountry({ areaKm2: 9000000 }, 10)).toBe(10);
  });

  test('continent mode only draws covered countries in that continent', () => {
    const source = createCandidateSource(normalizeConfig({ provider: 'apple', mode: 'continent', region: 'europe', seed: 'sa' }), 0);
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      const c = source.next();
      expect(c.country.region).toBe('Europe');
      seen.add(c.country.cca2);
    }
    expect(seen.size).toBeGreaterThan(1);
    expect(seen.has('VE')).toBe(false);
  });

  test('balanced mode spreads across many countries', () => {
    const source = createCandidateSource(normalizeConfig({ provider: 'apple', mode: 'balanced', seed: 'spread' }), 0);
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(source.next().country.cca2);
    // Apple covers 23 countries, so the spread is bounded by that and
    // not by the sampler: what matters is that one country does not own
    // the draw the way the typed city list used to let the US own it.
    expect(seen.size).toBeGreaterThan(15);
    expect(seen.has('CN')).toBe(false);
  });

  test('city mode draws inside a listed city for the provider', () => {
    const apple = createCandidateSource(normalizeConfig({ provider: 'apple', mode: 'balanced', seed: 'c' }), 0);
    const c = apple.next();
    expect(c.city).toBeTruthy();
    expect(c.country).not.toBeNull();
    expect(c.radiusKm).toBeLessThanOrEqual(2);
    expect(() => createCandidateSource(normalizeConfig({ provider: 'apple', mode: 'country', region: 'ZZ' }), 0)).toThrow(/Unknown country/);
    // Kidnapped draws from the covered pool like balanced: same seed, same road.
    const driven = createCandidateSource(normalizeConfig({ provider: 'apple', mode: 'balanced', seed: 'kid' }), 0).next();
    const balanced = createCandidateSource(normalizeConfig({ provider: 'apple', mode: 'balanced', seed: 'kid' }), 0).next();
    expect(driven.country.cca2).toBe(balanced.country.cca2);
    expect(driven.lat).toBe(balanced.lat);
  });
});

describe('the Apple samplers', () => {
  // Apple Look Around is city streets in the countries Apple has driven,
  // with no server-side probe: every mode on it is a draw from the city
  // list, and the browser tries the drawn spots in order.
  const draw = (config, n = 150) => {
    const source = createCandidateSource(normalizeConfig({ provider: 'apple', ...config }), 0);
    return Array.from({ length: n }, () => source.next());
  };

  test('every Apple candidate is a street in a covered city, whatever the mode', () => {
    for (const config of [{ mode: 'balanced', seed: 'a' }, { mode: 'balanced', seed: 'b' }, { mode: 'streak', seed: 'c' }, { mode: 'daily' }, { mode: 'cup' }]) {
      for (const c of draw(config, 40)) {
        expect(c.city).toBeTruthy();
        expect(hasAppleCoverage(c.country.cca2)).toBe(true);
        expect(c.radiusKm).toBeLessThanOrEqual(2);
      }
    }
  });

  test('balanced spreads across covered countries; world spreads across cities', () => {
    const countries = new Set(draw({ mode: 'balanced', seed: 'spread' }).map((c) => c.country.cca2));
    expect(countries.size).toBeGreaterThan(10);
    const cities = new Set(draw({ mode: 'balanced', seed: 'spread' }).map((c) => c.city));
    expect(cities.size).toBeGreaterThan(60);
  });

  test('a continent is its covered countries, and one Apple has not reached says so', () => {
    for (const c of draw({ mode: 'continent', region: 'europe', seed: 'eu' }, 60)) expect(c.country.region).toBe('Europe');
    expect(() => draw({ mode: 'continent', region: 'africa' })).toThrow(/no city streets in Africa/);
    expect(() => draw({ mode: 'continent', region: 'south-america' })).toThrow(/South America/);
  });

  test('a country is its cities, and one with none is refused plainly', () => {
    for (const c of draw({ mode: 'country', region: 'JP', seed: 'jp' }, 40)) expect(c.country.cca2).toBe('JP');
    expect(() => draw({ mode: 'country', region: 'BR' })).toThrow(/Brazil/);
    expect(() => draw({ mode: 'country', region: 'ZZ' })).toThrow(/Unknown country/);
  });

  test('a seeded Apple draw replays, so a daily is the same places for everyone', () => {
    const a = draw({ mode: 'daily', seed: 'daily-2026-09-12' }, 12);
    const b = draw({ mode: 'daily', seed: 'daily-2026-09-12' }, 12);
    expect(b.map((c) => [c.lat, c.lng])).toEqual(a.map((c) => [c.lat, c.lng]));
    expect(normalizeConfig({ mode: 'daily' }).provider).toBe('apple');
  });

  test('a continent or country on Apple is scored at its own size', () => {
    const eu = createCandidateSource(normalizeConfig({ provider: 'apple', mode: 'continent', region: 'europe', seed: 'x' }), 0);
    const jp = createCandidateSource(normalizeConfig({ provider: 'apple', mode: 'country', region: 'JP', seed: 'x' }), 0);
    const world = createCandidateSource(normalizeConfig({ provider: 'apple', mode: 'balanced', seed: 'x' }), 0);
    expect(jp.sizeKm).toBeLessThan(eu.sizeKm);
    expect(eu.sizeKm).toBeLessThan(world.sizeKm);
  });
});

describe('createRound and evaluateGuess', () => {
  /**
   * An Apple round has no server-side probe: Apple has no metadata
   * endpoint, so the server seals a handful of candidate places and the
   * browser tries them until Look Around loads one. Every candidate
   * carries its own sealed answer, so whichever one wins can be scored.
   */
  const first = async (config, extra = {}) => {
    const round = await createRound({ config: { provider: 'apple', ...config }, roundIndex: 0, env: ENV, ...extra });
    return { round, c: round.candidates[0], answer: openToken(round.candidates[0].token, { secret: ENV.NEXTAUTH_SECRET }) };
  };

  test('a round hands the browser candidates, each with its own sealed answer', async () => {
    const { round, c, answer } = await first({ mode: 'balanced', seed: 'game-1' });
    expect(round.provider).toBe('apple');
    expect(round.candidates).toHaveLength(APPLE_CANDIDATES_PER_ROUND);
    expect(answer.p).toBe('apple');
    expect(answer.cc).toMatch(/^[A-Z]{2}$/);
    // The coordinate is not a secret here: the browser has to open the
    // imagery itself, so it is given the place and the answer is the
    // sealed country and city rather than the point.
    for (const cand of round.candidates) {
      const opened = openToken(cand.token, { secret: ENV.NEXTAUTH_SECRET });
      expect(opened.lat).toBe(cand.lat);
      expect(opened.city).toBeTruthy();
    }

    const exact = evaluateGuess({ token: c.token, guess: { lat: answer.lat, lng: answer.lng }, env: ENV });
    expect(exact).toMatchObject({ kind: 'pin', score: 5000, roundIndex: 0 });
    expect(exact.answer.country.code).toBe(answer.cc);

    const far = evaluateGuess({ token: c.token, guess: { lat: answer.lat, lng: ((answer.lng + 180 + 180) % 360) - 180 }, env: ENV });
    expect(far.score).toBeLessThan(exact.score);
    expect(far.distanceKm).toBeGreaterThan(1000);

    const timedOut = evaluateGuess({ token: c.token, guess: null, env: ENV });
    expect(timedOut).toMatchObject({ score: 0, timedOut: true });
    expect(timedOut.answer.lat).toBe(answer.lat);
  });

  test("a city round is revealed as the city's own country, not the polygon under the pin", async () => {
    // Singapore has no polygon at 1:110m, so countryAt returns Malaysia
    // for a point in it: truthy, so the row's own country never got a
    // look in, and the reveal named the neighbour. Hong Kong, Geneva
    // and Jerusalem failed the same way.
    const { answer } = await first({ mode: 'country', region: 'SG', seed: 'sg' });
    expect(answer.city).toBe('Singapore');
    expect(answer.cc).toBe('SG');
    expect(countryAt(answer.lat, answer.lng)?.cca2).toBe('MY');
  });

  test('a country round measures a seam-crossing country by its real width', async () => {
    // A country cut by the antimeridian has a bounding box from -180 to
    // +180, and its diagonal collapses to the latitude span because the
    // longitude term is sin(180deg) = 0. The United States was scored on
    // that, roughly twice as harshly as intended.
    const { round: us } = await first({ mode: 'country', region: 'US', seed: 'us-1' });
    expect(us.sizeKm).toBeGreaterThan(4000);
  });

  test('a seeded round replays the same places', async () => {
    const a = await first({ mode: 'balanced', seed: 'same' });
    const b = await first({ mode: 'balanced', seed: 'same' });
    expect(a.c.lat).toBe(b.c.lat);
    expect(a.c.lng).toBe(b.c.lng);
    expect(a.c.token).not.toBe(b.c.token); // fresh IV each time
  });

  test('a retry of a seeded round moves on to new places instead of repeating the failure', async () => {
    const again = await createRound({ config: { provider: 'apple', mode: 'balanced', seed: 'retry' }, roundIndex: 0, attempt: 0, env: ENV });
    const moved = await createRound({ config: { provider: 'apple', mode: 'balanced', seed: 'retry' }, roundIndex: 0, attempt: 1, env: ENV });
    expect(moved.candidates[0].lat).not.toBe(again.candidates[0].lat);
  });

  test('streak rounds are judged by country', async () => {
    const { c, answer } = await first({ mode: 'streak', seed: 'streak-1' });
    expect(evaluateGuess({ token: c.token, guess: { countryCode: answer.cc.toLowerCase() }, env: ENV })).toMatchObject({ kind: 'streak', correct: true });
    expect(evaluateGuess({ token: c.token, guess: { countryCode: 'ZZ' }, env: ENV })).toMatchObject({ kind: 'streak', correct: false });
    expect(evaluateGuess({ token: c.token, guess: null, env: ENV }).correct).toBe(false);
  });

  test('missing configuration is reported, not thrown as a crash', async () => {
    // Apple needs no key, so the only thing that can be missing is the
    // secret the answers are sealed with.
    await expect(createRound({ config: { provider: 'apple', mode: 'balanced' }, env: {} })).rejects.toMatchObject({ code: 'no_secret' });
    // A mode with no city streets in it says so rather than crashing.
    // Keep the rare Not Earth surprise deterministic: an unseeded test
    // occasionally receives a valid NASA round instead of city streets.
    await expect(createRound({ config: { provider: 'apple', mode: 'country', region: 'CN', seed: 'no-coverage' }, env: ENV })).rejects.toThrow(/no city streets/);
  });

  test('a tampered or expired token cannot be scored', async () => {
    const { c } = await first({ mode: 'balanced', seed: 't' });
    expect(() => evaluateGuess({ token: c.token + 'x', guess: { lat: 0, lng: 0 }, env: ENV })).toThrow(/open/);
  });
});
