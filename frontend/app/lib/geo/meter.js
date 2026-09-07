/**
 * The play meter: what a player may start today, decided before any
 * imagery is fetched. Pure rules; app/lib/geo/server/meter.js reads the
 * usage rows and applies them.
 *
 * A Google Street View round costs money once the month's free calls
 * are used (docs/GEO.md, "What it costs"). Apple Look Around costs
 * nothing per view but the whole site shares a daily quota. So:
 *
 *   - Google rounds: a free allowance per player per day, the daily
 *     challenge on top of it, then prepaid rounds (quota packs, bought
 *     once, never a subscription), then a refusal.
 *   - Apple rounds: no allowance.
 *   - Everyone: a daily ceiling shaped like a person rather than a
 *     script, a speed limit per minute, and a daily budget for the
 *     whole site on each provider.
 *
 * Days are UTC. Anonymous players are tracked by profile and by IP
 * address, so clearing the browser does not reset the allowance.
 * Signed-in players are tracked by profile, with the IP only as a
 * ceiling, so a household or an office is not one player.
 */

export const DEFAULT_LIMITS = Object.freeze({
  freeGoogleRounds: 25, // per player per day; the daily challenge is on top
  freeGoogleRoundsPerIp: 125, // backstop for anonymous players who clear the browser
  ceilingAnonymous: 600, // rounds per day, any imagery, per anonymous player
  ceilingSignedIn: 2000,
  ceilingPerIp: 5000,
  roundsPerMinute: 15, // per player
  siteBudget: Object.freeze({ google: 20000, apple: 200000 }), // rounds per day, whole site
});

function num(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/** The limits with the environment's overrides (frontend/.env.example). */
export function limitsFromEnv(env = process.env) {
  return {
    freeGoogleRounds: num(env.GEO_FREE_GOOGLE_ROUNDS, DEFAULT_LIMITS.freeGoogleRounds),
    freeGoogleRoundsPerIp: num(env.GEO_FREE_GOOGLE_ROUNDS_PER_IP, DEFAULT_LIMITS.freeGoogleRoundsPerIp),
    ceilingAnonymous: num(env.GEO_DAILY_CEILING_ANONYMOUS, DEFAULT_LIMITS.ceilingAnonymous),
    ceilingSignedIn: num(env.GEO_DAILY_CEILING, DEFAULT_LIMITS.ceilingSignedIn),
    ceilingPerIp: num(env.GEO_DAILY_CEILING_PER_IP, DEFAULT_LIMITS.ceilingPerIp),
    roundsPerMinute: num(env.GEO_ROUNDS_PER_MINUTE, DEFAULT_LIMITS.roundsPerMinute),
    siteBudget: {
      google: num(env.GEO_GOOGLE_DAILY_BUDGET, DEFAULT_LIMITS.siteBudget.google),
      apple: num(env.GEO_APPLE_DAILY_BUDGET, DEFAULT_LIMITS.siteBudget.apple),
    },
  };
}

/** "2026-09-07": the UTC day a moment falls in. */
export function dayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

/** The next UTC midnight after a moment, in ms. */
export function nextDayMs(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

export class MeterError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'MeterError';
    this.code = code;
    this.status = 429;
    Object.assign(this, extra);
  }
}

export const METER_CODES = ['allowance', 'ceiling', 'budget', 'speed'];

const PROVIDERS = ['google', 'apple'];
const roundsOf = (bucket) => PROVIDERS.reduce((sum, p) => sum + (bucket?.[p]?.rounds || 0), 0);

/** The refusal, in our words. `provider` is the imagery that was asked for. */
export function refusalMessage(code, provider) {
  switch (code) {
    case 'allowance':
      return "You have used today's free Google Street View rounds. Apple Look Around rounds have no limit, and the free rounds come back tomorrow.";
    case 'ceiling':
      return "You've played a lot today. Back tomorrow.";
    case 'budget':
      return provider === 'apple'
        ? 'Apple Look Around has had a busy day here. Back tomorrow.'
        : 'Google Street View has had a busy day here. Apple Look Around is open, or come back tomorrow.';
    case 'speed':
      return 'That is faster than the game allows. Try again in a minute.';
    default:
      return 'Not right now.';
  }
}

/** The refusal's heading on the play page. */
export function refusalTitle(code) {
  switch (code) {
    case 'allowance':
      return 'Free Google rounds used up for today';
    case 'ceiling':
      return "You've played a lot today";
    case 'budget':
      return 'A busy day here';
    case 'speed':
      return 'Slow down a little';
    default:
      return 'Not right now';
  }
}

/**
 * Decide one round.
 *
 * `usage` is { profile, ip, site }; each is undefined or an object with
 * { google: { rounds, free, paid }, apple: { rounds } } for the day.
 * `allowance: false` skips the Google allowance (joining a room: a
 * friend's invitation is never refused for it).
 *
 * Returns { ok: true, source } with source 'free' | 'paid' | 'daily' |
 * 'apple' | 'room', or { ok: false, code }.
 */
export function decideRound({ provider, mode, signedIn = false, hasProfile = false, paidRounds = 0, usage = {}, limits = DEFAULT_LIMITS, allowance = true }) {
  const p = provider === 'apple' ? 'apple' : 'google';
  if ((usage.site?.[p]?.rounds || 0) >= limits.siteBudget[p]) return { ok: false, code: 'budget' };

  const ceiling = signedIn ? limits.ceilingSignedIn : limits.ceilingAnonymous;
  if (hasProfile && roundsOf(usage.profile) >= ceiling) return { ok: false, code: 'ceiling' };
  if (roundsOf(usage.ip) >= (hasProfile ? limits.ceilingPerIp : ceiling)) return { ok: false, code: 'ceiling' };

  if (p === 'apple') return { ok: true, source: 'apple' };
  if (!allowance) return { ok: true, source: 'room' };
  if (mode === 'daily') return { ok: true, source: 'daily' };

  const freeByProfile = !hasProfile || (usage.profile?.google?.free || 0) < limits.freeGoogleRounds;
  const ipFreeLimit = hasProfile ? limits.freeGoogleRoundsPerIp : limits.freeGoogleRounds;
  const freeByIp = signedIn || (usage.ip?.google?.free || 0) < ipFreeLimit;
  if (freeByProfile && freeByIp) return { ok: true, source: 'free' };
  if (hasProfile && paidRounds > 0) return { ok: true, source: 'paid' };
  return { ok: false, code: 'allowance' };
}

/** What a round that started adds to the usage rows. */
export function usageIncrement(source) {
  return { rounds: 1, free: source === 'free' ? 1 : 0, paid: source === 'paid' ? 1 : 0 };
}

/**
 * The meter as the lobby shows it for one player. Free rounds left is
 * the tightest of the pools that hold this player (the profile's, and
 * the address's for anonymous players), so what the lobby says matches
 * what the round route will do.
 */
export function meterView({ usage = {}, hasProfile = false, signedIn = false, paidRounds = 0, limits = DEFAULT_LIMITS, now = Date.now() }) {
  const bucket = hasProfile ? usage.profile : usage.ip;
  const pools = [];
  if (hasProfile) pools.push(limits.freeGoogleRounds - (usage.profile?.google?.free || 0));
  if (!signedIn) pools.push((hasProfile ? limits.freeGoogleRoundsPerIp : limits.freeGoogleRounds) - (usage.ip?.google?.free || 0));
  const freeLeft = Math.max(0, Math.min(limits.freeGoogleRounds, ...pools));
  const freeUsed = limits.freeGoogleRounds - freeLeft;
  return {
    day: dayKey(now),
    resetAt: nextDayMs(now),
    google: {
      rounds: bucket?.google?.rounds || 0,
      freeUsed,
      freeLimit: limits.freeGoogleRounds,
      freeLeft,
      paidLeft: Math.max(0, Number(paidRounds) || 0),
    },
    apple: { rounds: bucket?.apple?.rounds || 0 },
    rounds: roundsOf(bucket),
    ceiling: signedIn ? limits.ceilingSignedIn : limits.ceilingAnonymous,
  };
}

/** "in 5 h", "in 20 min", "soon": time until the free rounds come back. */
export function untilText(resetAt, now = Date.now()) {
  const ms = Math.max(0, (Number(resetAt) || 0) - now);
  const min = Math.round(ms / 60000);
  if (min < 1) return 'any moment now';
  if (min < 60) return `in ${min} min`;
  const h = Math.round(min / 60);
  return `in ${h} h`;
}
