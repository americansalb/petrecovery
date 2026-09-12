/**
 * The "Everywhere" mode: the third of the world Street View never drove.
 *
 * Official coverage stops at a border for reasons of law and business,
 * not geography, and knowing where that line runs is a large part of
 * expert play in every game in this genre. This mode exists to make that
 * knowledge worth nothing (docs/GEO.md, "Everywhere").
 *
 * The important test here is the second one. The city list was written by
 * hand, and a coordinate typed into the wrong country would put a round
 * in Mongolia while calling it Beijing. Every entry is checked against
 * the same Natural Earth polygons that name the answer, so a wrong digit
 * fails the build rather than shipping.
 */

const { CITIES, GOOGLE_COVERAGE, citiesFor, citiesOffCoverage } = require('@/app/lib/geo/coverage');
const { countryAt, countryByCode } = require('@/app/lib/geo/server/countries');
const { createCandidateSource } = require('@/app/lib/geo/server/sampler');
const { normalizeConfig, MODES } = require('@/app/lib/geo/modes');
const { probeStreetView } = require('@/app/lib/geo/server/streetview');
const { createRound } = require('@/app/lib/geo/server/game');
const { openToken } = require('@/app/lib/geo/server/tokens');

describe('the off-coverage city pool', () => {
  const off = citiesOffCoverage();

  test('is a real pool, in countries the covered modes can never reach', () => {
    expect(off.length).toBeGreaterThan(50);
    const countries = new Set(off.map((c) => c.country));
    expect(countries.size).toBeGreaterThan(25);
    for (const city of off) {
      expect(GOOGLE_COVERAGE.has(city.country)).toBe(false);
    }
    // The places the complaint was actually about.
    for (const cc of ['CN', 'IR', 'EG', 'DZ', 'SD', 'LY', 'SA']) {
      expect(countries.has(cc)).toBe(true);
    }
  });

  test('every coordinate lands in the country it claims', () => {
    const wrong = [];
    for (const city of off) {
      const found = countryAt(city.lat, city.lng);
      if (!found) wrong.push(`${city.name}: no country at ${city.lat},${city.lng}`);
      else if (found.cca2 !== city.country) wrong.push(`${city.name}: claims ${city.country}, polygons say ${found.cca2}`);
    }
    expect(wrong).toEqual([]);
  });

  test('the pool stays out of every other mode', () => {
    // citiesFor filters by the coverage set, so City streets cannot serve
    // a place with no imagery and no mode changes behaviour by accident.
    const googleCities = citiesFor('google');
    const appleCities = citiesFor('apple');
    const offNames = new Set(off.map((c) => c.name));
    for (const city of [...googleCities, ...appleCities]) {
      expect(offNames.has(city.name)).toBe(false);
    }
    expect(googleCities.length + off.length).toBeLessThanOrEqual(CITIES.length);
  });
});

describe('the Everywhere mode', () => {
  test('is Google, fixed to no movement, because photo spheres have no links to walk', () => {
    const c = normalizeConfig({ mode: 'everywhere', move: '1' });
    expect(c).toMatchObject({ provider: 'google', mode: 'everywhere', move: false, pan: true, zoom: true });
    expect(MODES.everywhere.providers).toEqual(['google']);
    // Asking for Apple drops the mode rather than the provider, as every
    // Google-only mode already does.
    expect(normalizeConfig({ mode: 'everywhere', provider: 'apple' }).mode).not.toBe('everywhere');
  });

  test('samples only from the off-coverage pool, and seeds reproduce', () => {
    const config = normalizeConfig({ mode: 'everywhere', seed: 'ev-1' });
    const source = createCandidateSource(config, 0);
    const offCountries = new Set(citiesOffCoverage().map((c) => c.country));

    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      const candidate = source.next();
      expect(candidate).toBeTruthy();
      expect(offCountries.has(candidate.country.cca2)).toBe(true);
      // Never a country the ordinary modes already cover.
      expect(GOOGLE_COVERAGE.has(candidate.country.cca2)).toBe(false);
      seen.add(candidate.country.cca2);
    }
    // Forty draws should not all be the same place.
    expect(seen.size).toBeGreaterThan(3);

    const again = createCandidateSource(normalizeConfig({ mode: 'everywhere', seed: 'ev-1' }), 0).next();
    const first = createCandidateSource(normalizeConfig({ mode: 'everywhere', seed: 'ev-1' }), 0).next();
    expect(again.lat).toBe(first.lat);
    expect(again.lng).toBe(first.lng);
  });

  test('probes a wider radius than City streets, because spheres are sparse', () => {
    const everywhere = createCandidateSource(normalizeConfig({ mode: 'everywhere', seed: 'r' }), 0).next();
    const cities = createCandidateSource(normalizeConfig({ mode: 'cities', seed: 'r' }), 0).next();
    expect(everywhere.radiusKm).toBeGreaterThan(cities.radiusKm);
  });
});

describe('the probe', () => {
  const sphere = async () => ({
    status: 200,
    json: async () => ({
      status: 'OK',
      pano_id: 'sphere-1',
      location: { lat: 39.9, lng: 116.4 },
      // What a user-uploaded panorama actually returns: a person, not Google.
      copyright: '© Ada Lovelace',
      date: '2023-05',
    }),
  });

  test('skips a photo sphere by default, and takes one when the mode allows it', async () => {
    const args = { lat: 39.9, lng: 116.4, key: 'k', fetchImpl: sphere };
    expect(await probeStreetView(args)).toMatchObject({ status: 'miss', reason: 'unofficial' });
    expect(await probeStreetView({ ...args, allowUnofficial: true })).toMatchObject({
      status: 'hit',
      panoId: 'sphere-1',
    });
  });

  test('an Everywhere round is built from a sphere, and named by the polygons', async () => {
    const secret = 'a-long-enough-test-secret';
    const round = await createRound({
      config: { mode: 'everywhere', seed: 'ev-round' },
      roundIndex: 0,
      fetchImpl: async (url) => {
        const [lat, lng] = new URL(url).searchParams.get('location').split(',').map(Number);
        return {
          status: 200,
          json: async () => ({
            status: 'OK',
            pano_id: `sphere-${lat.toFixed(2)}`,
            location: { lat, lng },
            copyright: '© Someone',
          }),
        };
      },
      env: { GOOGLE_STREET_VIEW_API_KEY: 'k', NEXTAUTH_SECRET: secret },
    });
    expect(round.panoId).toMatch(/^sphere-/);
    // The answer never leaves the server before the guess, so read it the
    // way the guess route does.
    const answer = openToken(round.token, { secret });
    // The country comes from the polygons, so a sphere cannot mislabel a
    // round, and it is always somewhere the covered modes cannot reach.
    expect(answer.cc).toBeTruthy();
    expect(GOOGLE_COVERAGE.has(answer.cc)).toBe(false);
    expect(answer.mode).toBe('everywhere');
  });
});

/**
 * The covered half of the same hand-written list. Only the off-coverage
 * half was ever checked against the polygons, and this half is the one
 * the game reveals country names from: nine rows disagreed with the
 * 1:110m outlines and four of them named the wrong country outright.
 */
describe('the covered city list', () => {
  // Rows the coarse polygons cannot confirm, each for a known reason.
  // A city not on this list that the polygons disagree with is either a
  // typo in the row or a new hole; either way it should be looked at,
  // which is what this enumeration is for.
  const KNOWN = {
    // No polygon at 1:110m at all, so the point lands in a neighbour.
    Singapore: 'MY',
    'Hong Kong': 'CN',
    // A border city: the simplified outline puts the centre over the line.
    Geneva: 'FR',
    Jerusalem: 'PS',
    // Islands and coasts simplified away entirely.
    Victoria: null,
    Palermo: null,
    Palma: null,
    Odense: null,
  };

  test('every covered row names a country the game knows', () => {
    const offNames = new Set(citiesOffCoverage().map((c) => c.name));
    for (const city of CITIES) {
      if (offNames.has(city.name)) continue;
      expect(countryByCode(city.country)).toBeTruthy();
    }
  });

  test('the rows the polygons disagree with are exactly the ones we know about', () => {
    const offNames = new Set(citiesOffCoverage().map((c) => c.name));
    const disagree = {};
    for (const city of CITIES) {
      if (offNames.has(city.name)) continue;
      const found = countryAt(city.lat, city.lng);
      const code = found?.cca2 || null;
      if (code !== city.country) disagree[city.name] = code;
    }
    expect(disagree).toEqual(KNOWN);
  });

  test('a curated city row is what the reveal names, not the polygon under the pin', () => {
    // Singapore, Hong Kong and Monaco have no polygon at this scale, so
    // countryAt returns a truthy neighbour and the old fallback never
    // fired: a Singapore round revealed Malaysia.
    const singapore = CITIES.find((c) => c.name === 'Singapore');
    expect(countryAt(singapore.lat, singapore.lng)?.cca2).toBe('MY');
    expect(countryByCode(singapore.country).name).toBe('Singapore');
  });
});
