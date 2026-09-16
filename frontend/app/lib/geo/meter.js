/**
 * The play meter: what stops one browser, or one bad day, from taking
 * the game down.
 *
 * It used to be a billing guard. Google Street View is billed per
 * panorama load, so the meter counted free rounds, bought rounds, room
 * games and a site budget denominated in loads, all to bound an invoice.
 * Apple Look Around is not billed per view, so with Google gone
 * (2026-09-16) none of that has anything to bound.
 *
 * What is left are the two limits that were never about money:
 *
 *   ceiling  per player per day. An abuse limit, not pricing: set high
 *            enough that nobody honest meets it. A heavy evening is
 *            about a hundred rounds.
 *   speed    per player per minute. This is the one that actually stops
 *            a script.
 *
 * And one that is about a shared resource rather than a bill:
 *
 *   budget   views per day for the whole site. Apple's quota is 250,000
 *            a day PER DEVELOPER ACCOUNT, and the same account serves
 *            ReunitePets' shelter maps. Burning the day's quota here
 *            would blank the maps there, so the site stops first.
 *
 * `usage` rows are { profile, ip, site }, each { apple: { rounds } },
 * per UTC day (app/lib/geo/server/meter.js writes them).
 */

export const DEFAULT_LIMITS = Object.freeze({
  ceilingAnonymous: 600, // rounds per day per anonymous player
  ceilingSignedIn: 2000,
  ceilingPerIp: 5000,
  roundsPerMinute: 15, // per player
  siteBudget: 200000, // views per day, whole site, under Apple's 250,000
});

function num(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/** The limits with the environment's overrides (frontend/.env.example). */
export function limitsFromEnv(env = process.env) {
  return Object.freeze({
    ceilingAnonymous: num(env.GEO_CEILING_ANONYMOUS, DEFAULT_LIMITS.ceilingAnonymous),
    ceilingSignedIn: num(env.GEO_CEILING_SIGNED_IN, DEFAULT_LIMITS.ceilingSignedIn),
    ceilingPerIp: num(env.GEO_CEILING_PER_IP, DEFAULT_LIMITS.ceilingPerIp),
    roundsPerMinute: num(env.GEO_ROUNDS_PER_MINUTE, DEFAULT_LIMITS.roundsPerMinute),
    siteBudget: num(env.GEO_SITE_BUDGET, DEFAULT_LIMITS.siteBudget),
  });
}

/** The UTC day a moment falls in, as "2026-09-16". */
export function dayKey(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

/** Midnight UTC after `now`, in ms: when the day's counts reset. */
export function nextDayMs(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

export class MeterError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

export const METER_CODES = ['ceiling', 'budget', 'speed'];

const roundsOf = (bucket) => bucket?.apple?.rounds || 0;

/** The refusal, in our words. */
export function refusalMessage(code) {
  switch (code) {
    case 'ceiling':
      return "You've played a lot today. Back tomorrow.";
    case 'budget':
      return 'The game has had a busy day here. Back tomorrow.';
    case 'speed':
      return 'That is faster than the game allows. Try again in a minute.';
    default:
      return 'Not right now.';
  }
}

/** The refusal's heading on the play page. */
export function refusalTitle(code) {
  switch (code) {
    case 'ceiling':
      return "That's a lot of rounds for one day";
    case 'budget':
      return 'Busy day';
    case 'speed':
      return 'Slow down';
    default:
      return 'Not right now';
  }
}

/**
 * Can this round start? The site's day comes first, then the player's.
 *
 * Every round is one view now. Kidnapped was the only mode that was
 * ever more, because the car drove itself and each hop was another
 * billed load; it went with Google.
 */
export function decideRound({ signedIn = false, hasProfile = false, usage = {}, limits = DEFAULT_LIMITS } = {}) {
  const site = usage.site?.apple || {};
  const siteViews = Math.max(site.loads || 0, site.rounds || 0);
  if (siteViews + 1 > limits.siteBudget) return { ok: false, code: 'budget' };

  const ceiling = signedIn ? limits.ceilingSignedIn : limits.ceilingAnonymous;
  if (hasProfile && roundsOf(usage.profile) >= ceiling) return { ok: false, code: 'ceiling' };
  if (roundsOf(usage.ip) >= (hasProfile ? limits.ceilingPerIp : ceiling)) return { ok: false, code: 'ceiling' };

  return { ok: true, source: 'apple' };
}

/**
 * A seat in a room, at the door and again when the first round starts.
 *
 * Rooms are not rationed. They are how the game spreads: a room holds
 * twelve, so metering them would tax the one thing that brings players
 * in. Only the ceiling and the site's day apply, exactly as for a solo
 * round.
 */
export function decideRoomEntry({ signedIn = false, hasProfile = false, usage = {}, limits = DEFAULT_LIMITS } = {}) {
  return decideRound({ signedIn, hasProfile, usage, limits });
}

/** What a round that started adds to the usage rows. */
export function usageIncrement() {
  return { rounds: 1, loads: 1 };
}

/** What taking a seat in a room adds. Nothing: seats are not counted. */
export function seatIncrement() {
  return { rounds: 0, loads: 0 };
}

/** The day so far, for the profile endpoint and the play page. */
export function meterView({ usage = {}, hasProfile = false, signedIn = false, limits = DEFAULT_LIMITS, now = Date.now() } = {}) {
  const bucket = hasProfile ? usage.profile : usage.ip;
  return {
    day: dayKey(now),
    resetAt: nextDayMs(now),
    apple: { rounds: roundsOf(bucket) },
    rounds: roundsOf(bucket),
    ceiling: signedIn ? limits.ceilingSignedIn : limits.ceilingAnonymous,
  };
}

/** "in 5 h", "in 20 min", "in 6 days": time until something comes back or ends. */
export function untilText(resetAt, now = Date.now()) {
  const ms = Math.max(0, (Number(resetAt) || 0) - now);
  const min = Math.round(ms / 60000);
  if (min < 1) return 'any moment now';
  if (min < 60) return `in ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `in ${h} h`;
  const days = Math.round(h / 24);
  return `in ${days} days`;
}
