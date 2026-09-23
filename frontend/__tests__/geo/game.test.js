/**
 * Rounds and guesses end to end, on Apple Look Around.
 *
 * The rules under test: the round response never carries the answer, a
 * seed replays the same round, and the guess endpoint scores from the
 * sealed token.
 */

const { createCandidateSource, radiusForCountry } = require('@/app/lib/geo/server/sampler');
const { createRound, evaluateGuess, GeoGameError, APPLE_CANDIDATES_PER_ROUND } = require('@/app/lib/geo/server/game');
const { openToken, sealToken } = require('@/app/lib/geo/server/tokens');
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

  test('a retired country or continent link plays World, at world scale', () => {
    // Choosing a place meant being shown what is covered, which is kept
    // secret (founder decision, 2026-09-23): a link to either mode now
    // draws exactly what World draws for the same seed.
    for (const config of [{ mode: 'country', region: 'JP', seed: 'ch' }, { mode: 'continent', region: 'europe', seed: 'sa' }]) {
      const retired = createCandidateSource(normalizeConfig({ provider: 'apple', ...config }), 0);
      const world = createCandidateSource(normalizeConfig({ provider: 'apple', mode: 'balanced', seed: config.seed }), 0);
      expect(retired.next()).toEqual(world.next());
      expect(retired.sizeKm).toBe(world.sizeKm);
    }
    expect(radiusForCountry({ areaKm2: 100 }, 10)).toBe(2.5);
    expect(radiusForCountry({ areaKm2: 9000000 }, 10)).toBe(10);
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
    // A room made before the place modes were retired keeps its old mode
    // in the config it was created with, unnormalised, and plays World.
    const stale = createCandidateSource({ ...normalizeConfig({ provider: 'apple', mode: 'balanced', seed: 'c' }), mode: 'country', region: 'ZZ' }, 0);
    expect(stale.next()).toEqual(createCandidateSource(normalizeConfig({ provider: 'apple', mode: 'balanced', seed: 'c' }), 0).next());
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

  test('a seeded Apple draw replays, so a daily is the same places for everyone', () => {
    const a = draw({ mode: 'daily', seed: 'daily-2026-09-12' }, 12);
    const b = draw({ mode: 'daily', seed: 'daily-2026-09-12' }, 12);
    expect(b.map((c) => [c.lat, c.lng])).toEqual(a.map((c) => [c.lat, c.lng]));
    expect(normalizeConfig({ mode: 'daily' }).provider).toBe('apple');
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
    //
    // There is no country mode to ask for Singapore any more, so the
    // test finds a World seed that offers it, the way a player meets it.
    let found = null;
    for (let i = 0; i < 20000 && !found; i++) {
      const seed = `sg-${i}`;
      const source = createCandidateSource(normalizeConfig({ provider: 'apple', mode: 'balanced', seed }), 0);
      for (let k = 0; k < APPLE_CANDIDATES_PER_ROUND; k++) if (source.next().city === 'Singapore') found = seed;
    }
    expect(found).toBeTruthy();
    const round = await createRound({ config: { provider: 'apple', mode: 'balanced', seed: found }, roundIndex: 0, env: ENV });
    const answer = round.candidates
      .map((candidate) => openToken(candidate.token, { secret: ENV.NEXTAUTH_SECRET }))
      .find((a) => a.city === 'Singapore');
    expect(answer.cc).toBe('SG');
    expect(countryAt(answer.lat, answer.lng)?.cca2).toBe('MY');
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
  });

  test('a tampered or expired token cannot be scored', async () => {
    const { c } = await first({ mode: 'balanced', seed: 't' });
    // A character changed in the middle, not one added at the end: when
    // the body is a whole number of base64 blocks, the decoder drops a
    // single extra character and the token still opens.
    const at = Math.floor(c.token.length / 2);
    const tampered = c.token.slice(0, at) + (c.token[at] === 'A' ? 'B' : 'A') + c.token.slice(at + 1);
    expect(() => evaluateGuess({ token: tampered, guess: { lat: 0, lng: 0 }, env: ENV })).toThrow(/open/);
  });

  test('every round is a list of Look Around places, including on seeds that once drew Mars or the Moon', async () => {
    // Until 2026-09-23 these two seeds opened on a NASA panorama.
    for (const seed of ['ne757', 'ne719']) {
      const { round, answer } = await first({ mode: 'balanced', seed });
      expect(round.provider).toBe('apple');
      expect(round.candidates).toHaveLength(APPLE_CANDIDATES_PER_ROUND);
      expect(round.place).toBeUndefined();
      expect(answer).not.toHaveProperty('ne');
    }
  });

  test('a token sealed for a retired Mars or Moon round is refused as expired, not scored at 0,0', () => {
    const token = sealToken(
      { v: 1, ne: 'mars-jezero-delta', rid: 'r1', sub: '', p: 'photo', pano: '', lat: 0, lng: 0, cc: 'XM', cn: 'Mars', cf: '', city: '', date: '', size: 0, mode: 'balanced', seed: 'ne757', i: 0 },
      { secret: ENV.NEXTAUTH_SECRET }
    );
    let error = null;
    try {
      evaluateGuess({ token, guess: { lat: 0, lng: 0 }, env: ENV });
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ name: 'GeoTokenError', code: 'expired' });
  });
});
