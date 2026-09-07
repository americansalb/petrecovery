/**
 * Country polygons: the land mask, in-country sampling and the reveal.
 * Uses the real Natural Earth data, so these are slow-ish but honest.
 */

const {
  countryAt,
  countryByCode,
  countriesInContinent,
  sampleInCountry,
  sampleOnLand,
  countryOptions,
  getCountries,
  pointInRing,
} = require('@/app/lib/geo/server/countries');
const { createRng } = require('@/app/lib/geo/random');
const { haversineKm } = require('@/app/lib/geo/distance');

describe('countryAt', () => {
  test.each([
    ['Kansas', 39.0, -98.0, 'US'],
    ['Paris', 48.8566, 2.3522, 'FR'],
    ['Tokyo', 35.6762, 139.6503, 'JP'],
    ['Sydney', -33.8688, 151.2093, 'AU'],
    ['Nairobi', -1.2921, 36.8219, 'KE'],
    ['Sao Paulo', -23.5505, -46.6333, 'BR'],
    ['Moscow', 55.7558, 37.6173, 'RU'],
    ['Chukotka, east of the antimeridian', 65.0, -172.0, 'RU'],
  ])('%s is in %s', (_, lat, lng, code) => {
    expect(countryAt(lat, lng)?.cca2).toBe(code);
  });

  test('the open ocean is nobody', () => {
    expect(countryAt(0, -30)).toBeNull();
    expect(countryAt(-40, -120)).toBeNull();
  });

  test('Antarctica is recognised so it can be excluded', () => {
    expect(countryAt(-80, 20)?.cca2).toBe('AQ');
  });

  test('Lesotho is a hole in South Africa', () => {
    expect(countryAt(-29.6, 28.2)?.cca2).toBe('LS');
    expect(countryAt(-30.5, 25.0)?.cca2).toBe('ZA');
  });

  test('pointInRing handles a simple square', () => {
    const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
    expect(pointInRing(5, 5, square)).toBe(true);
    expect(pointInRing(15, 5, square)).toBe(false);
  });
});

describe('sampling', () => {
  test('points drawn inside Japan are in Japan', () => {
    const rng = createRng('japan');
    const japan = countryByCode('JP');
    expect(japan.parts.length).toBeGreaterThan(1);
    for (let i = 0; i < 300; i++) {
      const p = sampleInCountry(rng, japan);
      expect(countryAt(p.lat, p.lng)?.cca2).toBe('JP');
    }
  });

  test('points drawn inside the United States spread beyond one state', () => {
    const rng = createRng('usa');
    const us = countryByCode('US');
    const lngs = [];
    for (let i = 0; i < 200; i++) {
      const p = sampleInCountry(rng, us);
      expect(countryAt(p.lat, p.lng)?.cca2).toBe('US');
      lngs.push(p.lng);
    }
    expect(Math.max(...lngs) - Math.min(...lngs)).toBeGreaterThan(30);
  });

  test('countries with no polygon at this scale sample a disk around their centre', () => {
    const singapore = countryByCode('SG');
    expect(singapore).not.toBeNull();
    expect(singapore.parts).toHaveLength(0);
    expect(singapore.disk).not.toBeNull();
    const rng = createRng('sg');
    for (let i = 0; i < 100; i++) {
      const p = sampleInCountry(rng, singapore);
      expect(haversineKm(p, singapore.disk.center)).toBeLessThanOrEqual(singapore.disk.radiusKm + 0.5);
    }
  });

  test('sampleOnLand only returns land, never Antarctica, and counts the water it skipped', () => {
    const rng = createRng('land');
    let skippedTotal = 0;
    for (let i = 0; i < 200; i++) {
      const s = sampleOnLand(rng);
      expect(s).not.toBeNull();
      expect(s.country.cca2).not.toBe('AQ');
      expect(countryAt(s.point.lat, s.point.lng)?.cca2).toBe(s.country.cca2);
      skippedTotal += s.skipped;
    }
    // About 70% of the sphere is water, so more points are thrown away than kept
    expect(skippedTotal).toBeGreaterThan(200);
  });

  test('a seeded draw replays exactly', () => {
    const a = sampleOnLand(createRng('replay'));
    const b = sampleOnLand(createRng('replay'));
    expect(a.point).toEqual(b.point);
  });
});

describe('lists', () => {
  test('continents group the right countries', () => {
    const europe = countriesInContinent('europe').map((c) => c.cca2);
    expect(europe).toEqual(expect.arrayContaining(['FR', 'DE', 'PL']));
    expect(europe).not.toContain('US');
    const northAmerica = countriesInContinent('north-america').map((c) => c.cca2);
    expect(northAmerica).toEqual(expect.arrayContaining(['US', 'CA', 'MX', 'CR']));
    expect(northAmerica).not.toContain('BR');
    expect(countriesInContinent('nowhere')).toEqual([]);
  });

  test('the picker lists every country with a code, flag and coverage flags', () => {
    const options = countryOptions();
    expect(options.length).toBeGreaterThan(200);
    const us = options.find((o) => o.code === 'US');
    expect(us).toMatchObject({ name: 'United States', google: true, apple: true });
    expect(us.flag.length).toBeGreaterThan(0);
    expect(options.find((o) => o.code === 'SG')).toBeTruthy();
    expect(options.find((o) => o.code === 'AQ')).toBeUndefined();
    expect(options.find((o) => o.code === 'CN').google).toBe(false);
  });

  test('every polygon country has a bounding box and area weights', () => {
    for (const c of getCountries().filter((x) => x.parts.length)) {
      expect(c.box.minLat).toBeLessThanOrEqual(c.box.maxLat);
      expect(c.parts.every((p) => p.weight >= 0)).toBe(true);
    }
  });
});
