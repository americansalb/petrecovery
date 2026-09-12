/**
 * Game modes and settings: the one definition the lobby, the play page,
 * the API and the share page all read. Pure data and pure functions.
 */

import { APPLE_COVERAGE } from './coverage';

/**
 * The imagery the game plays on, in the order the lobby offers it.
 *
 * Apple first (founder direction, 2026-09-12). Look Around covers city
 * streets in the countries Apple has driven, costs nothing per view
 * under Apple's daily quota, and needs no probe budget, so it is the
 * default game and the imagery the shared boards are played on. Google
 * Street View is the option for the countryside, the hundred-odd other
 * countries, and the two modes only its imagery can do (Everywhere,
 * Kidnapped); it is metered (docs/GEO.md, "The play meter").
 */
export const PROVIDERS = {
  apple: {
    id: 'apple',
    label: 'Apple Look Around',
    short: 'Apple',
    description: `City streets in ${APPLE_COVERAGE.size} countries. No limit on rounds.`,
  },
  google: {
    id: 'google',
    label: 'Google Street View',
    short: 'Google',
    description: 'Most of the world, countryside included. A free allowance of rounds a day, then bought rounds.',
  },
};

/**
 * The imagery the daily challenge and the weekly cup are played on, and
 * what the lobby and the room form start on. Everyone on a board has to
 * be on the same places, so this is one value for the whole deployment,
 * set at build (NEXT_PUBLIC_GEO_PRIMARY_PROVIDER), never a choice a
 * player makes.
 */
export const PRIMARY_PROVIDER = process.env.NEXT_PUBLIC_GEO_PRIMARY_PROVIDER === 'google' ? 'google' : 'apple';

export const MODES = {
  world: {
    id: 'world',
    label: 'World, pure random',
    short: 'World',
    providers: ['apple', 'google'],
    description:
      'A random point on land, kept only if it has imagery nearby. Most of the world is countryside, so expect a lot of roads.',
    apple: { description: 'A random street in any city Apple covers, every city as likely as the next.' },
  },
  balanced: {
    id: 'balanced',
    label: 'World, balanced',
    short: 'Balanced',
    providers: ['apple', 'google'],
    description:
      'A random country first, weighted so small countries still come up, then a random spot inside it.',
    apple: { description: 'A random covered country first, weighted so small ones still come up, then a random street in one of its cities.' },
  },
  daily: {
    id: 'daily',
    label: 'Daily challenge',
    short: 'Daily',
    providers: ['apple', 'google'],
    description: 'Five balanced rounds. Everyone gets the same five places today.',
    // The board is one board, so the imagery is fixed for everyone.
    fixed: { provider: PRIMARY_PROVIDER, rounds: 5, time: 0, move: true, pan: true, zoom: true, radius: 'standard' },
  },
  cup: {
    id: 'cup',
    label: 'Weekly cup',
    short: 'Cup',
    providers: ['apple', 'google'],
    description: 'Ten balanced rounds, No Move, 60 seconds each. Everyone gets the same ten places this week, and the week ends with prizes.',
    fixed: { provider: PRIMARY_PROVIDER, rounds: 10, time: 60, move: false, pan: true, zoom: true, radius: 'standard' },
  },
  continent: {
    id: 'continent',
    label: 'Continent',
    short: 'Continent',
    providers: ['apple', 'google'],
    needs: 'continent',
    description: 'Random countries within one continent.',
    apple: { description: 'Random covered countries within one continent. Apple has no city streets in Africa or South America yet.' },
  },
  country: {
    id: 'country',
    label: 'Country',
    short: 'Country',
    providers: ['apple', 'google'],
    needs: 'country',
    description: 'Random spots inside one country.',
    apple: { description: 'Random streets in the cities of one covered country.' },
  },
  cities: {
    id: 'cities',
    label: 'City streets',
    short: 'Cities',
    // On Apple every mode is city streets, so World is this mode there.
    providers: ['google'],
    description: 'A random spot in one of 185 large cities with Street View coverage.',
  },
  everywhere: {
    id: 'everywhere',
    label: 'Everywhere',
    short: 'Everywhere',
    providers: ['google'],
    description:
      'The third of the world Street View never drove. China, Iran, Egypt, the Sahara. Photo spheres instead of official coverage, so knowing where the car went is worth nothing.',
    fixed: { provider: 'google', move: false, pan: true, zoom: true },
  },
  kidnapped: {
    id: 'kidnapped',
    label: 'Kidnapped',
    short: 'Kidnapped',
    providers: ['google'],
    description: 'You are driven down the road for up to three minutes. Look out of the window, then guess where you are. No steering, no zoom.',
    fixed: { provider: 'google', time: 180, move: false, pan: true, zoom: false },
  },
  streak: {
    id: 'streak',
    label: 'Country streak',
    short: 'Streak',
    providers: ['apple', 'google'],
    description: 'Name the country instead of placing a pin. The game ends at your first miss.',
  },
};

/**
 * What a mode does on this imagery, in the lobby's words. Apple modes
 * are all city streets, so a mode's Google description ("a random point
 * on land") would be wrong there; and a mode whose imagery is fixed (the
 * daily, the cup) says so when it is not the imagery being looked at.
 */
export function modeDescription(id, provider = PRIMARY_PROVIDER) {
  const mode = MODES[id];
  if (!mode) return '';
  const fixed = mode.fixed?.provider;
  const base = (provider === 'apple' && mode.apple?.description) || mode.description;
  if (fixed && fixed !== provider) return `${base} Played on ${PROVIDERS[fixed].label}.`;
  return base;
}

export const MODE_ORDER = ['world', 'balanced', 'daily', 'cup', 'continent', 'country', 'cities', 'everywhere', 'kidnapped', 'streak'];

/**
 * The three formats competitive play knows (docs/GEO.md, "Formats"):
 * one choice that sets move, pan and zoom together. The settings stay
 * separate underneath, so an old link with an odd mix still works.
 */
export const FORMATS = {
  moving: { id: 'moving', label: 'Moving', short: 'Moving', description: 'Walk, look around and zoom.', move: true, pan: true, zoom: true },
  nm: { id: 'nm', label: 'No Move', short: 'NM', description: 'Look around and zoom from one spot. The format the pros play.', move: false, pan: true, zoom: true },
  nmpz: { id: 'nmpz', label: 'NMPZ', short: 'NMPZ', description: 'No move, pan or zoom. One view, that is all you get.', move: false, pan: false, zoom: false },
};
export const FORMAT_ORDER = ['moving', 'nm', 'nmpz'];

/** The format a config plays as. Odd mixes count as the nearest one. */
export function formatOf(config = {}) {
  if (config.move) return 'moving';
  if (!config.pan && !config.zoom) return 'nmpz';
  return 'nm';
}

/** The move, pan and zoom settings of a format. */
export function formatSettings(id) {
  const f = FORMATS[id] || FORMATS.moving;
  return { move: f.move, pan: f.pan, zoom: f.zoom };
}

export function formatLabel(config = {}) {
  return FORMATS[formatOf(config)].label;
}

export const CONTINENTS = {
  europe: { id: 'europe', label: 'Europe', regions: ['Europe'] },
  asia: { id: 'asia', label: 'Asia', regions: ['Asia'] },
  africa: { id: 'africa', label: 'Africa', regions: ['Africa'] },
  'north-america': {
    id: 'north-america',
    label: 'North America',
    subregions: ['North America', 'Central America', 'Caribbean'],
  },
  'south-america': { id: 'south-america', label: 'South America', subregions: ['South America'] },
  oceania: { id: 'oceania', label: 'Oceania', regions: ['Oceania'] },
};

export const CONTINENT_ORDER = ['europe', 'asia', 'africa', 'north-america', 'south-america', 'oceania'];

/**
 * How far from the random point the probe may look for imagery. Small
 * radius = closer to uniform, more misses. Large = faster, but rounds
 * drift toward the edges of covered areas.
 */
export const RADIUS_PRESETS = {
  pure: { id: 'pure', label: 'Pure', km: 2, description: 'Imagery within 2 km of the random point. Slowest, most random.' },
  standard: { id: 'standard', label: 'Standard', km: 10, description: 'Imagery within 10 km.' },
  fast: { id: 'fast', label: 'Fast', km: 50, description: 'Imagery within 50 km. Quickest rounds.' },
};

export const ROUND_OPTIONS = [3, 5, 10];
export const TIME_OPTIONS = [0, 30, 60, 120, 180, 300];

export const DEFAULT_CONFIG = Object.freeze({
  provider: PRIMARY_PROVIDER,
  mode: 'world',
  region: '',
  rounds: 5,
  time: 0,
  move: true,
  pan: true,
  zoom: true,
  radius: 'standard',
  seed: '',
});

/** "daily-2026-09-07" for the given date, in UTC. */
export function dailySeed(date = new Date()) {
  return `daily-${date.toISOString().slice(0, 10)}`;
}

export function isDailySeed(seed) {
  return /^daily-\d{4}-\d{2}-\d{2}$/.test(String(seed || ''));
}

/** The ISO week a moment falls in, as "2026-W37" (weeks run Monday to Sunday, UTC). */
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** "cup-2026-W37": the weekly cup's seed for a moment. */
export function cupSeed(date = new Date()) {
  return `cup-${isoWeek(date)}`;
}

export function isCupSeed(seed) {
  return /^cup-\d{4}-W\d{2}$/.test(String(seed || ''));
}

/** When an ISO week ends (the following Monday, 00:00 UTC), from "2026-W37". */
export function isoWeekEnd(week) {
  const m = /^(\d{4})-W(\d{2})$/.exec(String(week || ''));
  if (!m) return null;
  const year = Number(m[1]);
  const w = Number(m[2]);
  // ISO week 1 contains 4 January; find that week's Monday, then step.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday1 = jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * 86400000;
  return monday1 + w * 7 * 86400000;
}

function toBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const text = String(value).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'off'].includes(text)) return false;
  return fallback;
}

function pick(value, options, fallback) {
  const num = Number(value);
  return options.includes(num) ? num : fallback;
}

/**
 * Turn anything (query params, JSON, partial objects) into a valid
 * config. Unknown values fall back to defaults; the daily challenge
 * forces its fixed settings so scores stay comparable.
 */
export function normalizeConfig(raw = {}, { now = new Date() } = {}) {
  const input = raw || {};
  let mode = MODES[input.mode] ? input.mode : DEFAULT_CONFIG.mode;
  // A named imagery wins over the mode: asking for Apple and a Google-only
  // mode drops the mode. With no imagery named, the mode picks it, so a
  // link to Kidnapped or Everywhere still opens on Google when the default
  // imagery is Apple.
  let provider = PROVIDERS[input.provider] ? input.provider : DEFAULT_CONFIG.provider;
  if (!MODES[mode].providers.includes(provider)) {
    if (PROVIDERS[input.provider]) mode = MODE_ORDER.find((id) => MODES[id].providers.includes(provider)) || 'world';
    else provider = MODES[mode].providers[0];
  }

  let region = '';
  if (MODES[mode].needs === 'continent') {
    region = CONTINENTS[input.region] ? input.region : 'europe';
  } else if (MODES[mode].needs === 'country') {
    const code = String(input.region || '').toUpperCase();
    region = /^[A-Z]{2}$/.test(code) ? code : 'US';
  }

  let seed = String(input.seed || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 48);

  const config = {
    provider,
    mode,
    region,
    rounds: mode === 'streak' ? 0 : pick(input.rounds, ROUND_OPTIONS, DEFAULT_CONFIG.rounds),
    time: pick(input.time, TIME_OPTIONS, DEFAULT_CONFIG.time),
    move: toBool(input.move, DEFAULT_CONFIG.move),
    pan: toBool(input.pan, DEFAULT_CONFIG.pan),
    zoom: toBool(input.zoom, DEFAULT_CONFIG.zoom),
    radius: RADIUS_PRESETS[input.radius] ? input.radius : DEFAULT_CONFIG.radius,
    seed,
  };

  if (mode === 'daily') {
    Object.assign(config, MODES.daily.fixed);
    config.seed = isDailySeed(seed) ? seed : dailySeed(now);
  }
  if (mode === 'cup') {
    Object.assign(config, MODES.cup.fixed);
    config.seed = isCupSeed(seed) ? seed : cupSeed(now);
  }
  // Kidnapped: the clock and the drive are the mode; rounds and the
  // probe radius stay yours.
  if (mode === 'kidnapped') Object.assign(config, MODES.kidnapped.fixed);
  // Everywhere: a photo sphere is one viewpoint with no links, so there
  // is nothing to walk to. Rounds, timer and radius stay yours.
  if (mode === 'everywhere') Object.assign(config, MODES.everywhere.fixed);

  return config;
}

/** Config as URL query params, for /geo/play links. */
export function configToParams(config) {
  const c = normalizeConfig(config);
  const params = new URLSearchParams();
  params.set('provider', c.provider);
  params.set('mode', c.mode);
  if (c.region) params.set('region', c.region);
  if (c.mode !== 'streak') params.set('rounds', String(c.rounds));
  params.set('time', String(c.time));
  params.set('move', c.move ? '1' : '0');
  params.set('pan', c.pan ? '1' : '0');
  params.set('zoom', c.zoom ? '1' : '0');
  params.set('radius', c.radius);
  if (c.seed) params.set('seed', c.seed);
  return params;
}

/** Config from URLSearchParams (or any object with get()). */
export function configFromParams(params, options) {
  const get = (key) => (params && typeof params.get === 'function' ? params.get(key) : params?.[key]);
  return normalizeConfig(
    {
      provider: get('provider'),
      mode: get('mode'),
      region: get('region'),
      rounds: get('rounds'),
      time: get('time'),
      move: get('move'),
      pan: get('pan'),
      zoom: get('zoom'),
      radius: get('radius'),
      seed: get('seed'),
    },
    options
  );
}

export function movementLabel(config) {
  const f = FORMATS[formatOf(config)];
  if (f.move === Boolean(config.move) && f.pan === Boolean(config.pan) && f.zoom === Boolean(config.zoom)) return f.label;
  const parts = [];
  parts.push(config.move ? 'Move' : 'No move');
  parts.push(config.pan ? 'pan' : 'no pan');
  parts.push(config.zoom ? 'zoom' : 'no zoom');
  return parts.join(', ');
}

export function timeLabel(seconds) {
  if (!seconds) return 'No timer';
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = seconds / 60;
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/** One line that says what a game was: "Country: Japan. 5 rounds. No timer." */
export function describeConfig(config, { regionLabel } = {}) {
  const c = normalizeConfig(config);
  const mode = MODES[c.mode];
  let name = mode.label;
  if (mode.needs === 'continent') name = `Continent: ${CONTINENTS[c.region]?.label || c.region}`;
  if (mode.needs === 'country') name = `Country: ${regionLabel || c.region}`;
  const parts = [name];
  if (c.mode === 'streak') parts.push('Until the first miss');
  else parts.push(`${c.rounds} rounds`);
  parts.push(timeLabel(c.time));
  // Kidnapped says it all: the car drives, you look.
  if (c.mode !== 'kidnapped' && !(c.move && c.pan && c.zoom)) parts.push(movementLabel(c));
  // The default imagery goes without saying; the other one is named.
  if (c.provider !== PRIMARY_PROVIDER) parts.push(PROVIDERS[c.provider].label);
  return parts.join('. ') + '.';
}
