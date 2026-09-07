/**
 * Game settings: every input becomes a valid config, links round-trip,
 * and the daily challenge cannot be tampered with through the URL.
 */

const {
  normalizeConfig,
  configToParams,
  configFromParams,
  dailySeed,
  describeConfig,
  DEFAULT_CONFIG,
  MODES,
  MODE_ORDER,
  PROVIDERS,
} = require('@/app/lib/geo/modes');

describe('normalizeConfig', () => {
  test('empty input gives the defaults', () => {
    expect(normalizeConfig({})).toEqual({ ...DEFAULT_CONFIG });
  });

  test('junk falls back field by field', () => {
    const c = normalizeConfig({ provider: 'bing', mode: 'moon', rounds: 7, time: 45, move: 'maybe', radius: 'huge', seed: 'a b/c!' });
    expect(c.provider).toBe('google');
    expect(c.mode).toBe('world');
    expect(c.rounds).toBe(5);
    expect(c.time).toBe(0);
    expect(c.move).toBe(true);
    expect(c.radius).toBe('standard');
    expect(c.seed).toBe('abc');
  });

  test('a mode the provider does not support is swapped for one it does', () => {
    const c = normalizeConfig({ provider: 'apple', mode: 'world' });
    expect(c.provider).toBe('apple');
    expect(MODES[c.mode].providers).toContain('apple');
  });

  test('country and continent modes carry a region, with sane defaults', () => {
    expect(normalizeConfig({ mode: 'country', region: 'jp' }).region).toBe('JP');
    expect(normalizeConfig({ mode: 'country', region: 'japan' }).region).toBe('US');
    expect(normalizeConfig({ mode: 'continent', region: 'asia' }).region).toBe('asia');
    expect(normalizeConfig({ mode: 'continent', region: 'atlantis' }).region).toBe('europe');
    expect(normalizeConfig({ mode: 'world', region: 'JP' }).region).toBe('');
  });

  test('the daily challenge forces its settings and today\'s seed', () => {
    const now = new Date('2026-09-07T15:00:00Z');
    const c = normalizeConfig({ mode: 'daily', rounds: 10, time: 30, move: '0', seed: 'cheat' }, { now });
    expect(c).toMatchObject({ mode: 'daily', rounds: 5, time: 0, move: true, pan: true, zoom: true, radius: 'standard' });
    expect(c.seed).toBe('daily-2026-09-07');
    expect(dailySeed(now)).toBe('daily-2026-09-07');
    // a past daily can be replayed by its own seed
    expect(normalizeConfig({ mode: 'daily', seed: 'daily-2026-09-01' }, { now }).seed).toBe('daily-2026-09-01');
  });

  test('streak has no round count', () => {
    expect(normalizeConfig({ mode: 'streak', rounds: 10 }).rounds).toBe(0);
  });

  test('booleans accept the usual spellings', () => {
    expect(normalizeConfig({ move: '0', pan: 'false', zoom: 'off' })).toMatchObject({ move: false, pan: false, zoom: false });
    expect(normalizeConfig({ move: '1', pan: 'true', zoom: 'yes' })).toMatchObject({ move: true, pan: true, zoom: true });
  });
});

describe('links', () => {
  test('config to params and back is lossless', () => {
    const original = normalizeConfig({ provider: 'google', mode: 'country', region: 'BR', rounds: 10, time: 120, move: false, pan: true, zoom: false, radius: 'pure', seed: 'friends-42' });
    const params = configToParams(original);
    expect(configFromParams(params)).toEqual(original);
    expect(configFromParams(new URLSearchParams(params.toString()))).toEqual(original);
  });

  test('plain objects work as params too', () => {
    expect(configFromParams({ mode: 'balanced', rounds: '3' })).toMatchObject({ mode: 'balanced', rounds: 3 });
  });
});

describe('describeConfig', () => {
  test('says what the game was in one line', () => {
    expect(describeConfig({ mode: 'country', region: 'JP' }, { regionLabel: 'Japan' })).toBe('Country: Japan. 5 rounds. No timer.');
    expect(describeConfig({ mode: 'streak', time: 60, move: false, pan: false, zoom: false })).toBe(
      'Country streak. Until the first miss. 1 minute. No move, pan or zoom.'
    );
    expect(describeConfig({ provider: 'apple', mode: 'cities', rounds: 3 })).toContain('Apple Look Around');
  });

  test('every mode lists a supported provider', () => {
    for (const id of MODE_ORDER) {
      expect(MODES[id].providers.every((p) => PROVIDERS[p])).toBe(true);
    }
  });
});
