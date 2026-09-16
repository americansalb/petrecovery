/**
 * Game settings: every input becomes a valid config, links round-trip,
 * and the daily challenge cannot be tampered with through the URL.
 */

const {
  normalizeConfig,
  configToParams,
  configFromParams,
  dailySeed,
  cupSeed,
  isoWeek,
  isoWeekEnd,
  describeConfig,
  movementLabel,
  formatOf,
  formatSettings,
  formatLabel,
  FORMAT_ORDER,
  DEFAULT_CONFIG,
  MODES,
  MODE_ORDER,
  PROVIDERS,
  TIME_OPTIONS,
  PRIMARY_PROVIDER,
  modeDescription,
} = require('@/app/lib/geo/modes');

describe('normalizeConfig', () => {
  test('empty input gives the defaults', () => {
    expect(normalizeConfig({})).toEqual({ ...DEFAULT_CONFIG });
  });

  test('junk falls back field by field', () => {
    const c = normalizeConfig({ provider: 'bing', mode: 'moon', rounds: 7, time: 45, move: 'maybe', radius: 'huge', seed: 'a b/c!' });
    expect(c.provider).toBe(PRIMARY_PROVIDER);
    expect(c.mode).toBe('world');
    expect(c.rounds).toBe(5);
    expect(c.time).toBe(0);
    expect(c.move).toBe(true);
    expect(c.radius).toBe('standard');
    expect(c.seed).toBe('abc');
  });

  test('a mode the provider does not support is swapped for one it does', () => {
    // City streets is a Google mode now: on Apple, World is city streets.
    const c = normalizeConfig({ provider: 'apple', mode: 'cities' });
    expect(c.provider).toBe('apple');
    expect(c.mode).toBe('world');
    expect(MODES[c.mode].providers).toContain('apple');
  });

  test('country and continent modes carry a region, with sane defaults', () => {
    expect(normalizeConfig({ mode: 'country', region: 'jp' }).region).toBe('JP');
    expect(normalizeConfig({ mode: 'country', region: 'japan' }).region).toBe('US');
    expect(normalizeConfig({ mode: 'continent', region: 'asia' }).region).toBe('asia');
    expect(normalizeConfig({ mode: 'continent', region: 'atlantis' }).region).toBe('europe');
    expect(normalizeConfig({ mode: 'world', region: 'JP' }).region).toBe('');
  });

  test('the weekly cup forces its settings and this week\'s seed', () => {
    const now = new Date('2026-09-07T12:00:00Z');
    const c = normalizeConfig({ mode: 'cup', rounds: 3, time: 0, move: '0', seed: 'cheat' }, { now });
    expect(c).toMatchObject({ mode: 'cup', rounds: 10, time: 60, move: false, pan: true, zoom: true, radius: 'standard' });
    expect(c.seed).toBe(`cup-${isoWeek(now)}`);
    expect(cupSeed(now)).toBe('cup-2026-W37');
    expect(normalizeConfig({ mode: 'cup', seed: 'cup-2026-W36' }, { now }).seed).toBe('cup-2026-W36');
    // ISO weeks run Monday to Sunday; week 1 holds 4 January
    expect(isoWeek(new Date('2026-01-01T00:00:00Z'))).toBe('2026-W01');
    expect(isoWeek(new Date('2026-01-04T23:59:59Z'))).toBe('2026-W01');
    expect(isoWeek(new Date('2026-01-05T00:00:00Z'))).toBe('2026-W02');
    expect(isoWeekEnd('2026-W01')).toBe(Date.UTC(2026, 0, 5));
    expect(isoWeekEnd('2026-W37')).toBe(Date.UTC(2026, 8, 14));
    expect(isoWeekEnd('nope')).toBeNull();
  });

  test('kidnapped fixes the clock and the drive; rounds and the radius stay yours', () => {
    const c = normalizeConfig({ mode: 'kidnapped', rounds: 3, time: 30, move: '1', zoom: '1', radius: 'pure' });
    expect(c).toMatchObject({ provider: 'google', mode: 'kidnapped', rounds: 3, time: 180, move: false, pan: true, zoom: false, radius: 'pure' });
    expect(TIME_OPTIONS).toContain(180);
    expect(describeConfig({ mode: 'kidnapped', rounds: 3 })).toBe('Kidnapped. 3 rounds. 3 minutes. Google Street View.');
    expect(normalizeConfig({ provider: 'apple', mode: 'kidnapped' }).mode).not.toBe('kidnapped');
    expect(configFromParams(configToParams(c))).toEqual(c);
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

describe('formats', () => {
  test('a format is one choice that sets move, pan and zoom together', () => {
    expect(FORMAT_ORDER).toEqual(['moving', 'nm', 'nmpz']);
    expect(formatSettings('moving')).toEqual({ move: true, pan: true, zoom: true });
    expect(formatSettings('nm')).toEqual({ move: false, pan: true, zoom: true });
    expect(formatSettings('nmpz')).toEqual({ move: false, pan: false, zoom: false });
    expect(formatSettings('what')).toEqual(formatSettings('moving'));
    for (const id of FORMAT_ORDER) expect(formatOf(formatSettings(id))).toBe(id);
  });

  test('the format of a config reads back from its settings, odd mixes fall to the nearest', () => {
    expect(formatOf({ move: true, pan: false, zoom: false })).toBe('moving');
    expect(formatOf({ move: false, pan: true, zoom: false })).toBe('nm');
    expect(formatOf({})).toBe('nmpz');
    expect(formatLabel({ move: false, pan: true, zoom: true })).toBe('No Move');
    expect(formatLabel(DEFAULT_CONFIG)).toBe('Moving');
  });

  test('the movement label names the format, or spells out an odd mix', () => {
    expect(movementLabel({ move: false, pan: false, zoom: false })).toBe('NMPZ');
    expect(movementLabel({ move: false, pan: true, zoom: true })).toBe('No Move');
    expect(movementLabel({ move: true, pan: true, zoom: true })).toBe('Moving');
    expect(movementLabel({ move: false, pan: true, zoom: false })).toBe('No move, pan, no zoom');
    expect(movementLabel({ move: true, pan: false, zoom: true })).toBe('Move, no pan, zoom');
  });
});

describe('describeConfig', () => {
  test('says what the game was in one line', () => {
    expect(describeConfig({ mode: 'country', region: 'JP' }, { regionLabel: 'Japan' })).toBe('Country: Japan. 5 rounds. No timer.');
    expect(describeConfig({ mode: 'streak', time: 60, move: false, pan: false, zoom: false })).toBe('Country streak. Until the first miss. 1 minute. NMPZ.');
    expect(describeConfig({ mode: 'balanced', time: 60, move: false, pan: true, zoom: true })).toBe('World, balanced. 5 rounds. 1 minute. No Move.');
    // The default imagery goes without saying; the other one is named.
    expect(describeConfig({ provider: 'apple', mode: 'world', rounds: 3 })).not.toContain('Apple Look Around');
    expect(describeConfig({ provider: 'google', mode: 'world', rounds: 3 })).toContain('Google Street View');
  });

  test('Apple first: the default imagery, the boards, and what each mode says on it', () => {
    // Founder direction, 2026-09-12. The lobby opens on Apple, the daily
    // and the cup are played on it whatever a link asks for (one board,
    // one set of places), and every mode that is a draw of city streets
    // plays on it. Everywhere and Kidnapped need Google's imagery and
    // stay there.
    expect(PRIMARY_PROVIDER).toBe('apple');
    expect(Object.keys(PROVIDERS)[0]).toBe('apple');
    expect(normalizeConfig({}).provider).toBe('apple');
    expect(normalizeConfig({ provider: 'google', mode: 'daily' }).provider).toBe('apple');
    expect(normalizeConfig({ provider: 'google', mode: 'cup' }).provider).toBe('apple');
    for (const id of ['world', 'balanced', 'daily', 'cup', 'continent', 'country', 'streak']) {
      expect(MODES[id].providers).toContain('apple');
    }
    for (const id of ['everywhere', 'kidnapped', 'cities']) {
      expect(MODES[id].providers).not.toContain('apple');
    }
    // Apple modes are city streets, and the copy says so instead of
    // reusing Google's "a random point on land".
    expect(modeDescription('world', 'apple')).toMatch(/city/i);
    expect(modeDescription('world', 'google')).toMatch(/random point on land/);
    // A mode with fixed imagery says so when looked at from the other.
    expect(modeDescription('daily', 'google')).toContain('Played on Apple Look Around');
    expect(modeDescription('daily', 'apple')).not.toContain('Played on');
  });

  test('every mode lists a supported provider', () => {
    for (const id of MODE_ORDER) {
      expect(MODES[id].providers.every((p) => PROVIDERS[p])).toBe(true);
    }
  });
});
