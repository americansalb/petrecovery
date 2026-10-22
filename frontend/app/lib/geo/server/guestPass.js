/**
 * The guest pass: what a player without an account may play in a day.
 *
 * Founder, 2026-10-09: guests get a free trial that cannot be abused,
 * and saving or competing needs an account. So a guest gets a number of
 * games a day (three by default), Street and Script together, and an
 * account has no daily game limit. Competing (Ranked, the weekly cup,
 * a place on the daily board) needs an account on its own terms: that
 * lives in the routes and in server/challenges.js, not here.
 *
 * What counts is a GAME, and a game is held together by a sealed ticket
 * rather than by trusting the round index. The first round a guest asks
 * for without a ticket starts a game: it is counted and a ticket comes
 * back, bound to the game (Street or Script), its seed and the player.
 * Every later round of that game carries the ticket. A round without
 * one is another game, so skipping round one, or asking for round three
 * of a hundred different seeds, spends the allowance a game at a time
 * instead of getting round it. A refresh sends the same ticket, so
 * reloading the page is not a new game.
 *
 * Counted where clearing the browser cannot reset it: per play profile
 * AND per hashed address, in GeoUsage under a provider bucket of its
 * own. The address limit is looser than the profile's, because an
 * address is a household, an office or a phone network; it is the
 * backstop for a browser that keeps clearing itself, not the limit a
 * person meets. A request with no profile (the play pages always make
 * one first; a script may not) is counted by its address alone. A rounds-per-day ceiling sits under both, for the one
 * mode with no end (Country streak) and anything that slips past.
 *
 * Signed-in players are not counted here at all. Server only.
 */

import { dayKey, nextDayMs } from '../meter';
import { openToken, sealToken } from './tokens';
import { profileSubject } from './meter';

/** The usage bucket the guest counts live in, beside 'apple'. */
export const GUEST_BUCKET = 'guest';

export const DEFAULT_GUEST_LIMITS = Object.freeze({
  games: 3, // per guest profile per UTC day
  gamesPerIp: 20, // per address per day: a backstop, never the number a person meets
  rounds: 60, // per guest profile per day, for streak and anything that slips past
  roundsPerIp: 240,
});

/** How long a game's ticket lasts. Long enough to finish, not to keep. */
export const TICKET_TTL_MS = 6 * 60 * 60 * 1000;

const KINDS = ['street', 'script'];

function num(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/** The limits with the environment's overrides (frontend/.env.example). */
export function guestLimitsFromEnv(env = process.env) {
  return Object.freeze({
    games: num(env.GEO_GUEST_GAMES, DEFAULT_GUEST_LIMITS.games),
    gamesPerIp: num(env.GEO_GUEST_GAMES_PER_IP, DEFAULT_GUEST_LIMITS.gamesPerIp),
    rounds: num(env.GEO_GUEST_ROUNDS, DEFAULT_GUEST_LIMITS.rounds),
    roundsPerIp: num(env.GEO_GUEST_ROUNDS_PER_IP, DEFAULT_GUEST_LIMITS.roundsPerIp),
  });
}

export class GuestPassError extends Error {
  constructor(code, message, extra = {}) {
    super(message || code);
    this.name = 'GuestPassError';
    this.code = code;
    Object.assign(this, extra);
  }
}

/** Tickets are sealed under their own key, so a round token is never a ticket and a ticket never opens as a round. */
const ticketSecret = (secret) => `${secret}:guest-game`;

/** Who a ticket belongs to: the profile when there is one, else the address. */
function holderOf(subjects) {
  return subjects.profileId ? profileSubject(subjects.profileId) : subjects.ipHash || '';
}

export function sealTicket({ kind, seed, subjects, secret, now = Date.now() }) {
  return sealToken({ v: 1, t: 'guest-game', g: kind, seed: String(seed || ''), h: holderOf(subjects) }, { secret: ticketSecret(secret), ttlMs: TICKET_TTL_MS, now });
}

/** Is this ticket a live one for this game and this player? Never throws. */
export function ticketFits(ticket, { kind, seed, subjects, secret, now = Date.now() }) {
  // A game with no seed draws fresh places on every request, so a ticket
  // for it would be a ticket for every place there is. Each such round
  // is a game of its own. Both play pages always send a seed.
  if (!ticket || typeof ticket !== 'string' || !seed) return false;
  try {
    const payload = openToken(ticket, { secret: ticketSecret(secret), now });
    return payload.t === 'guest-game' && payload.g === kind && payload.seed === String(seed) && Boolean(payload.h) && payload.h === holderOf(subjects);
  } catch {
    return false;
  }
}

function keys(subjects) {
  return { profile: subjects.profileId ? profileSubject(subjects.profileId) : null, ip: subjects.ipHash || null };
}

async function readCounts(store, subjects, day) {
  const { profile, ip } = keys(subjects);
  const wanted = [profile, ip].filter(Boolean);
  const rows = wanted.length ? await store.listUsage(wanted, day) : [];
  const of = (subject) => {
    const row = rows.find((r) => r.subject === subject && r.provider === GUEST_BUCKET);
    return { games: row?.games || 0, rounds: row?.rounds || 0 };
  };
  return { profile: profile ? of(profile) : null, ip: ip ? of(ip) : null };
}

/**
 * The day so far for a guest, as the header, the menu and the end of a
 * game show it: { guest, limit, used, left, resetAt, network }.
 * `network` is true when the address backstop is what has run out, so
 * the screen can say "on this network" rather than accuse the person of
 * having played three games they never played. Signed-in players get
 * { guest: false }.
 */
export async function guestAllowance(store, subjects, { now = Date.now(), limits = guestLimitsFromEnv() } = {}) {
  if (subjects.signedIn) return { guest: false };
  const counts = await readCounts(store, subjects, dayKey(now));
  // A browser with no profile yet has played nothing itself, whatever
  // the rest of its network has done; the address only ever shows here
  // as the backstop running out.
  const used = counts.profile ? counts.profile.games : 0;
  const ipLeft = counts.ip ? Math.max(0, limits.gamesPerIp - counts.ip.games) : Infinity;
  const profileLeft = Math.max(0, limits.games - used);
  const network = ipLeft <= 0 && profileLeft > 0;
  return {
    guest: true,
    limit: limits.games,
    used: Math.min(used, limits.games),
    left: network ? 0 : Math.min(profileLeft, ipLeft),
    resetAt: nextDayMs(now),
    network,
  };
}

/**
 * Admit one round for a guest, before the round is made. Returns
 * { guest: false } for a signed-in player, otherwise
 * { guest: true, newGame, record(), ticket?, allowance }.
 *
 * Nothing is written here: the caller makes the round and only then
 * calls record(), so a round that fails to build costs nothing.
 * Throws GuestPassError('guest_limit') when the day is spent.
 */
export async function admitGuestRound(store, { subjects, kind, seed, ticket, secret, now = Date.now(), limits = guestLimitsFromEnv() }) {
  if (!KINDS.includes(kind)) throw new Error(`Unknown game kind: ${kind}`);
  if (subjects.signedIn) return { guest: false };
  const day = dayKey(now);
  const counts = await readCounts(store, subjects, day);
  const continuing = ticketFits(ticket, { kind, seed, subjects, secret, now });

  const refuse = (network) => {
    throw new GuestPassError('guest_limit', network ? 'Guest games on this network are used up for today.' : `You've played your ${limits.games} guest games today.`, {
      resetAt: nextDayMs(now),
      network,
      limit: limits.games,
    });
  };

  // The rounds ceiling first: it holds whether or not a game is starting.
  if (counts.profile && counts.profile.rounds >= limits.rounds) refuse(false);
  if (counts.ip && counts.ip.rounds >= limits.roundsPerIp) refuse(true);

  if (!continuing) {
    // The play pages make a profile before the first round, so the
    // per-person count is the one that bites; the address is the
    // backstop behind it, and all there is for a request with none.
    if (counts.profile && counts.profile.games >= limits.games) refuse(false);
    if (counts.ip && counts.ip.games >= limits.gamesPerIp) refuse(true);
  }

  const newGame = !continuing;
  const issued = newGame && seed ? sealTicket({ kind, seed, subjects, secret, now }) : ticket || null;
  const record = async () => {
    try {
      const inc = { rounds: 1, games: newGame ? 1 : 0 };
      const { profile, ip } = keys(subjects);
      await Promise.all([profile, ip].filter(Boolean).map((subject) => store.bumpUsage(subject, day, GUEST_BUCKET, inc)));
    } catch (error) {
      console.error('[geo/guest-pass] record', error?.message || error);
    }
    return guestAllowance(store, subjects, { now, limits }).catch(() => null);
  };
  return { guest: true, newGame, ticket: issued, record };
}
