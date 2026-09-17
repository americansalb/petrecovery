/**
 * Game modes and settings: the one definition the lobby, the play page,
 * the API and the share page all read. Pure data and pure functions.
 */

import { APPLE_COVERAGE } from './coverage';

/**
 * The imagery the game plays on.
 *
 * Apple only (founder direction, 2026-09-16). Look Around covers city
 * streets in the countries Apple has driven and is not billed per view:
 * it runs under Apple's daily account quota, so a round costs nothing to
 * serve and nothing needs metering. Google Street View was the other
 * option and is gone, along with the play meter, the site budget, the
 * bought rounds, and the three modes only its imagery could do
 * (City streets, Everywhere, Kidnapped). What Apple's cars never reached
 * is covered by Script mode, which needs no imagery at all.
 */
export const PROVIDERS = {
  apple: {
    id: 'apple',
    label: 'Apple Look Around',
    short: 'Apple',
    description: `City streets in ${APPLE_COVERAGE.size} countries.`,
  },
};

/**
 * The imagery the daily challenge and the weekly cup are played on, and
 * what the lobby and the room form start on. Everyone on a board has to
 * be on the same places, so this is one value for the whole deployment,
 * set at build (NEXT_PUBLIC_GEO_PRIMARY_PROVIDER), never a choice a
 * player makes.
 */
export const PRIMARY_PROVIDER = 'apple';

export const MODES = {
  balanced: {
    id: 'balanced',
    label: 'World',
    short: 'World',
    providers: ['apple'],
    description:
      'A random country first, weighted so small countries still come up, then a random spot inside it.',
    apple: { description: 'A random covered country first, weighted so small ones still come up, then a random street in one of its cities.' },
  },
  daily: {
    id: 'daily',
    label: 'Daily challenge',
    short: 'Daily',
    providers: ['apple'],
    description: 'Five balanced rounds. Everyone gets the same five places today.',
    // The board is one board, so the imagery is fixed for everyone.
    fixed: { provider: PRIMARY_PROVIDER, rounds: 5, time: 0, move: true, pan: true, zoom: true, radius: 'standard' },
  },
  ranked: {
    id: 'ranked',
    label: 'Ranked',
    short: 'Ranked',
    providers: ['apple'],
    description:
      'Five balanced rounds on a clock. Everyone playing this hour gets the same five places, and the result moves your rating. Five games to be placed.',
    // A rating compares people, so it can only compare them on the same
    // places under the same rules: the set, the clock and the imagery
    // are all fixed, and the seed comes from the hour rather than from
    // the player.
    fixed: { provider: PRIMARY_PROVIDER, rounds: 5, time: 60, move: false, pan: true, zoom: true, radius: 'standard' },
  },
  cup: {
    id: 'cup',
    label: 'Weekly cup',
    short: 'Cup',
    providers: ['apple'],
    description: 'Ten balanced rounds, No Move, 60 seconds each. Everyone gets the same ten places this week, and the week ends with prizes.',
    fixed: { provider: PRIMARY_PROVIDER, rounds: 10, time: 60, move: false, pan: true, zoom: true, radius: 'standard' },
  },
  continent: {
    id: 'continent',
    label: 'Continent',
    short: 'Continent',
    providers: ['apple'],
    needs: 'continent',
    description: 'Random countries within one continent.',
    apple: { description: 'Random covered countries within one continent. Apple has no city streets in Africa or South America yet.' },
  },
  country: {
    id: 'country',
    label: 'Country',
    short: 'Country',
    providers: ['apple'],
    needs: 'country',
    description: 'Random spots inside one country.',
    apple: { description: 'Random streets in the cities of one covered country.' },
  },
  streak: {
    id: 'streak',
    label: 'Country streak',
    short: 'Streak',
    providers: ['apple'],
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

/**
 * The modes played against a board: everyone gets the same places, and
 * the server hands a round to ONE profile and reveals its answer to
 * nobody else (app/api/geo/guess/route.js). Two things follow from
 * that, and both have to agree about this list:
 *
 *  - the browser must have a profile BEFORE it asks for the round, or
 *    it is handed a round it will then be refused a score on;
 *  - the guess route must refuse a round whose subject is somebody
 *    else, or a round token becomes a way to read the answer and
 *    replay the set for a perfect score.
 *
 * The list was written out separately in both places and in
 * challengeFor(), and they disagreed: `ranked` was in the server's two
 * and missing from the browser's. So Ranked worked from the old lobby,
 * which happened to create the profile before navigating, and was
 * refused from anywhere else - including any link straight to
 * /geo/play?mode=ranked. It is one list now.
 */
export const CHALLENGE_MODES = Object.freeze(['daily', 'ranked', 'cup']);

/** Is this mode played against a board, as one profile? */
export function isChallengeMode(mode) {
  return CHALLENGE_MODES.includes(String(mode || ''));
}

export const MODE_ORDER = ['balanced', 'daily', 'ranked', 'cup', 'continent', 'country', 'streak'];

/**
 * Modes that no longer exist, and what a link to one opens instead.
 *
 * `world` drew uniformly from the typed city list, so the United States
 * came up 45 times as often as Zambia and the meta was "learn the list"
 * rather than anything about the world. It is gone; `balanced` weights
 * the country by the square root of its area first, which is the same
 * game with an honest distribution, and now wears the name World.
 * The other three needed Google.
 */
const RETIRED_MODES = { world: 'balanced', cities: 'balanced', everywhere: 'balanced', kidnapped: 'balanced' };

/**
 * The three formats competitive play knows (docs/GEO.md, "Formats"):
 * one choice that sets move, pan and zoom together. The settings stay
 * separate underneath, so an old link with an odd mix still works.
 */
export const FORMATS = {
  moving: { id: 'moving', label: 'Moving', short: 'Moving', description: 'Walk, look around and zoom.', move: true, pan: true, zoom: true },
  nm: { id: 'nm', label: 'No Move', short: 'NM', description: 'Look around and zoom from one spot. No walking.', move: false, pan: true, zoom: true },
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
  mode: 'balanced',
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

/** Midnight UTC of the day a daily seed names, in ms, or null. */
export function dailySeedAt(seed) {
  const m = /^daily-(\d{4})-(\d{2})-(\d{2})$/.exec(String(seed || ''));
  if (!m) return null;
  const at = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(at) ? at : null;
}

/**
 * Is a challenge seed one the caller is allowed to play?
 *
 * Only the FUTURE is refused, and only the future needs to be.
 *
 * `isDailySeed` is a shape test, a regex, so the server used to honour
 * any date matching the pattern. Asking for `daily-2027-01-01` handed
 * back next year's five places, and `cup-2099-W01` next century's ten:
 * read the answers, write them down, come back on the day and post
 * 25,000. The seed format is visible in every share link, so this
 * needed no cleverness at all. A shared board that can be played early
 * is not a board.
 *
 * The past stays open on purpose. A share link for yesterday's daily is
 * the feature that makes the daily worth sharing, and replaying an old
 * one changes no board: an entry is recorded from the first attempt
 * only (server/challenges.js), and that day's board is closed anyway.
 * Refusing the past would have broken every shared link to fix a bug
 * that only ever pointed forward.
 */
function seedIsPlayable(at, now) {
  if (at === null) return false;
  return at <= new Date(now).getTime();
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

/** When the week a cup seed names began, in ms, or null. */
export function cupSeedAt(seed) {
  const m = /^cup-(\d{4})-W(\d{2})$/.exec(String(seed || ''));
  if (!m) return null;
  const end = isoWeekEnd(`${m[1]}-W${m[2]}`);
  return end === null ? null : end - 7 * 86400000;
}

/**
 * "ranked-2026-09-15T21": the ranked set for an hour, in UTC.
 *
 * An hour rather than a day because a rating wants games, and a day
 * would cap a player at one rated result. An hour rather than a
 * minute because the set has to be shared: the whole point is that
 * everyone playing now is on the same five places, so their scores can
 * be compared to each other rather than to nothing.
 */
export function rankedSeed(date = new Date()) {
  return `ranked-${new Date(date).toISOString().slice(0, 13)}`;
}

export function isRankedSeed(seed) {
  return /^ranked-\d{4}-\d{2}-\d{2}T\d{2}$/.test(String(seed || ''));
}

/** When a ranked seed's hour starts, in ms, or null. */
export function rankedSeedAt(seed) {
  const m = /^ranked-(\d{4})-(\d{2})-(\d{2})T(\d{2})$/.exec(String(seed || ''));
  if (!m) return null;
  const at = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]));
  return Number.isFinite(at) ? at : null;
}

/**
 * How far back a ranked seed the caller supplies is still accepted: the
 * hour it belongs to, and the one before it.
 *
 * A game that starts at 20:58 asks for its later rounds after 21:00,
 * and it has to stay the same set or the five rounds never add up to
 * one entry. Anything older is a player handing back a set they have
 * already seen, which is a rating built on a second attempt.
 */
const RANKED_SEED_GRACE_MS = 2 * 3600000;

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
  const asked = String(input.mode || '');
  let mode = MODES[asked] ? asked : RETIRED_MODES[asked] || DEFAULT_CONFIG.mode;
  // One imagery, so nothing to reconcile: every mode is Apple.
  const provider = 'apple';

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

  // The shape of a seed is not permission to play it. A caller may hand
  // back today's seed, or one that has only just rolled over; anything
  // in the future is somebody reading a board's answers before it opens.
  if (mode === 'daily') {
    Object.assign(config, MODES.daily.fixed);
    const at = isDailySeed(seed) ? dailySeedAt(seed) : null;
    config.seed = seedIsPlayable(at, now) ? seed : dailySeed(now);
  }
  if (mode === 'cup') {
    Object.assign(config, MODES.cup.fixed);
    const at = isCupSeed(seed) ? cupSeedAt(seed) : null;
    config.seed = seedIsPlayable(at, now) ? seed : cupSeed(now);
  }
  // Ranked: the seed is the hour, never the player's. A chosen seed
  // would let someone replay a set they had already seen and submit the
  // second attempt, which is the whole rating gone.
  if (mode === 'ranked') {
    Object.assign(config, MODES.ranked.fixed);
    const at = rankedSeedAt(seed);
    const fresh = at !== null && now - at < RANKED_SEED_GRACE_MS && at <= now;
    config.seed = fresh ? seed : rankedSeed(now);
  }
  // Kidnapped and Everywhere had a branch here for months after they
  // were retired. RETIRED_MODES maps both to balanced before this runs,
  // so neither could ever be reached - and if one had been, MODES has
  // no such entry and reading .fixed off undefined would have thrown.

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
  if (!(c.move && c.pan && c.zoom)) parts.push(movementLabel(c));
  // The default imagery goes without saying; the other one is named.
  if (c.provider !== PRIMARY_PROVIDER) parts.push(PROVIDERS[c.provider].label);
  return parts.join('. ') + '.';
}
