/**
 * The play meter: what a player may start today, decided before any
 * imagery is fetched. Pure rules; app/lib/geo/server/meter.js reads the
 * usage rows and applies them.
 *
 * A Google Street View round costs money once the month's free calls
 * are used (docs/GEO.md, "What it costs"). Apple Look Around costs
 * nothing per view but the whole site shares a daily quota. So:
 *
 *   - Google rounds: a free allowance per player per day (five games
 *     of five), the daily challenge and the weekly cup on top of it,
 *     then prepaid rounds (quota packs, bought once, never a
 *     subscription), then a refusal.
 *   - Google rooms: one free game a day per player, its rounds outside
 *     the allowance; after that a room costs prepaid rounds.
 *   - Apple rounds and rooms: no allowance.
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
  freeChallengeRounds: 10, // the daily (5) and the cup (5), on top of the allowance
  freeChallengeRoundsPerIp: 50, // backstop per address for anonymous players
  freeGoogleRoomGames: 1, // free multiplayer games per player per day on Google
  freeGoogleRoomGamesPerIp: 5, // backstop per address for anonymous players
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
    freeChallengeRounds: num(env.GEO_FREE_CHALLENGE_ROUNDS, DEFAULT_LIMITS.freeChallengeRounds),
    freeChallengeRoundsPerIp: num(env.GEO_FREE_CHALLENGE_ROUNDS_PER_IP, DEFAULT_LIMITS.freeChallengeRoundsPerIp),
    freeGoogleRoomGames: num(env.GEO_FREE_GOOGLE_ROOM_GAMES, DEFAULT_LIMITS.freeGoogleRoomGames),
    freeGoogleRoomGamesPerIp: num(env.GEO_FREE_GOOGLE_ROOM_GAMES_PER_IP, DEFAULT_LIMITS.freeGoogleRoomGamesPerIp),
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

export const METER_CODES = ['allowance', 'rooms', 'ceiling', 'budget', 'speed'];

/**
 * Panorama loads one round of a mode buys. Every mode shows one
 * panorama; Kidnapped then drives itself, and each hop is another
 * billed load (app/geo/lib/drive.js, MAX_DRIVE_HOPS). The site's daily
 * budget is the one limit denominated in loads rather than rounds,
 * because it is the limit that exists to bound the bill.
 */
export const KIDNAPPED_LOADS = 73;

export function roundLoads(mode) {
  return mode === 'kidnapped' ? KIDNAPPED_LOADS : 1;
}

const PROVIDERS = ['google', 'apple'];
const roundsOf = (bucket) => PROVIDERS.reduce((sum, p) => sum + (bucket?.[p]?.rounds || 0), 0);

/** The refusal, in our words. `provider` is the imagery that was asked for. */
export function refusalMessage(code, provider) {
  switch (code) {
    case 'allowance':
      return "You have used today's free Google Street View rounds. Apple Look Around rounds have no limit, and the free rounds come back tomorrow.";
    case 'rooms':
      return "You have used today's free multiplayer game on Google Street View. Rooms on Apple Look Around have no limit, and the free game comes back tomorrow.";
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
    case 'rooms':
      return 'Free Google room used up for today';
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
 * 'cup' | 'apple' | 'room', or { ok: false, code }.
 */
export function decideRound({ provider, mode, signedIn = false, hasProfile = false, paidRounds = 0, usage = {}, limits = DEFAULT_LIMITS, allowance = true }) {
  const p = provider === 'apple' ? 'apple' : 'google';
  const loads = roundLoads(mode);
  // Rows written before loads existed carry only rounds; one round was
  // one load then, so reading across is exact.
  const siteLoads = usage.site?.[p]?.loads || usage.site?.[p]?.rounds || 0;
  if (siteLoads + loads > limits.siteBudget[p]) return { ok: false, code: 'budget' };

  const ceiling = signedIn ? limits.ceilingSignedIn : limits.ceilingAnonymous;
  if (hasProfile && roundsOf(usage.profile) >= ceiling) return { ok: false, code: 'ceiling' };
  if (roundsOf(usage.ip) >= (hasProfile ? limits.ceilingPerIp : ceiling)) return { ok: false, code: 'ceiling' };

  if (p === 'apple') return { ok: true, source: 'apple' };
  if (!allowance) return { ok: true, source: 'room' };
  // The shared challenges are the front door, so they sit on top of the
  // allowance. On top of, not instead of: this used to return on the
  // mode string alone, which made "daily" an unlimited free-Google
  // switch that skipped the per-address backstop too. A challenge round
  // past the challenge allowance falls through and competes for the
  // ordinary free rounds like any other.
  if (mode === 'daily' || mode === 'cup') {
    const byProfile = !hasProfile || (usage.profile?.google?.challenge || 0) < limits.freeChallengeRounds;
    const ipChallengeLimit = hasProfile ? limits.freeChallengeRoundsPerIp : limits.freeChallengeRounds;
    const byIp = signedIn || (usage.ip?.google?.challenge || 0) < ipChallengeLimit;
    if (byProfile && byIp) return { ok: true, source: mode };
  }

  const freeByProfile = !hasProfile || (usage.profile?.google?.free || 0) < limits.freeGoogleRounds;
  const ipFreeLimit = hasProfile ? limits.freeGoogleRoundsPerIp : limits.freeGoogleRounds;
  const freeByIp = signedIn || (usage.ip?.google?.free || 0) < ipFreeLimit;
  if (freeByProfile && freeByIp) return { ok: true, source: 'free' };
  if (hasProfile && paidRounds > 0) return { ok: true, source: 'paid' };
  return { ok: false, code: 'allowance' };
}

/**
 * Decide a seat in a Google or Apple room, at the door (opening, joining,
 * a rematch) and again when the first round starts, when the seat is
 * actually charged. `usage` is as for decideRound, with `games` in the
 * Google bucket counting free room games used today.
 *
 * Returns { ok: true, source } with source 'free' (today's free game),
 * 'paid' (rounds drawn from the prepaid balance) or 'apple', or
 * { ok: false, code }. The ceiling and the site budget hold first.
 */
export function decideRoomEntry({ provider, signedIn = false, hasProfile = false, paidRounds = 0, usage = {}, limits = DEFAULT_LIMITS }) {
  const gate = decideRound({ provider, mode: 'balanced', signedIn, hasProfile, paidRounds, usage, limits, allowance: false });
  if (!gate.ok) return gate;
  if (gate.source === 'apple') return gate;
  const freeByProfile = !hasProfile || (usage.profile?.google?.games || 0) < limits.freeGoogleRoomGames;
  const ipLimit = hasProfile ? limits.freeGoogleRoomGamesPerIp : limits.freeGoogleRoomGames;
  const freeByIp = signedIn || (usage.ip?.google?.games || 0) < ipLimit;
  if (freeByProfile && freeByIp) return { ok: true, source: 'free' };
  if (hasProfile && paidRounds > 0) return { ok: true, source: 'paid' };
  return { ok: false, code: 'rooms' };
}

/** What a round that started adds to the usage rows. */
export function usageIncrement(source, mode = '') {
  return {
    rounds: 1,
    free: source === 'free' ? 1 : 0,
    paid: source === 'paid' ? 1 : 0,
    games: 0,
    challenge: source === 'daily' || source === 'cup' ? 1 : 0,
    loads: roundLoads(mode),
  };
}

/** What taking a seat in a room adds: a free game used, or nothing. */
export function seatIncrement(source) {
  return { rounds: 0, free: 0, paid: 0, games: source === 'free' ? 1 : 0, challenge: 0, loads: 0 };
}

/**
 * The free Google allowance in the lobby's words: "5 free Google Street
 * View games a day (25 rounds) and 1 free room". Games are five rounds;
 * an allowance that is not a multiple of five is said in rounds.
 */
export function allowanceText(limits = DEFAULT_LIMITS) {
  const rounds = limits.freeGoogleRounds;
  const games = limits.freeGoogleRoomGames;
  const solo = rounds % 5 === 0 && rounds >= 5 ? `${rounds / 5} free Google Street View ${rounds === 5 ? 'game' : 'games'} a day (${rounds} rounds)` : `${rounds} free Google Street View rounds a day`;
  const room = games > 0 ? ` and ${games} free ${games === 1 ? 'room' : 'rooms'}` : '';
  return `${solo}${room}, the daily challenge and the weekly cup on top. Apple Look Around: no limit.`;
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
  const gamePools = [];
  if (hasProfile) gamePools.push(limits.freeGoogleRoomGames - (usage.profile?.google?.games || 0));
  if (!signedIn) gamePools.push((hasProfile ? limits.freeGoogleRoomGamesPerIp : limits.freeGoogleRoomGames) - (usage.ip?.google?.games || 0));
  const gamesLeft = Math.max(0, Math.min(limits.freeGoogleRoomGames, ...gamePools));
  const challengePools = [];
  if (hasProfile) challengePools.push(limits.freeChallengeRounds - (usage.profile?.google?.challenge || 0));
  if (!signedIn) challengePools.push((hasProfile ? limits.freeChallengeRoundsPerIp : limits.freeChallengeRounds) - (usage.ip?.google?.challenge || 0));
  const challengeLeft = Math.max(0, Math.min(limits.freeChallengeRounds, ...challengePools));
  return {
    day: dayKey(now),
    resetAt: nextDayMs(now),
    google: {
      rounds: bucket?.google?.rounds || 0,
      freeUsed,
      freeLimit: limits.freeGoogleRounds,
      freeLeft,
      paidLeft: Math.max(0, Number(paidRounds) || 0),
      roomGames: { used: limits.freeGoogleRoomGames - gamesLeft, limit: limits.freeGoogleRoomGames, left: gamesLeft },
      challenge: { used: limits.freeChallengeRounds - challengeLeft, limit: limits.freeChallengeRounds, left: challengeLeft },
    },
    apple: { rounds: bucket?.apple?.rounds || 0 },
    rounds: roundsOf(bucket),
    ceiling: signedIn ? limits.ceilingSignedIn : limits.ceilingAnonymous,
  };
}

/** "Free Google room today: not used yet." or "1 of 2 free Google rooms used today." */
export function roomGamesText(roomGames) {
  if (!roomGames) return 'One room a day on Google Street View is free.';
  if (roomGames.limit === 1) return `Free Google room today: ${roomGames.left ? 'not used yet' : 'used'}.`;
  return `${roomGames.used} of ${roomGames.limit} free Google rooms used today.`;
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
