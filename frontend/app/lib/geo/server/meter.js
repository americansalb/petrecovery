/**
 * The play meter on the store (app/lib/geo/meter.js has the rules).
 * Server only, no request objects here: the routes resolve who is
 * asking (meterRequest.js) and pass `subjects`:
 *
 *   { profile, profileId, signedIn, ipHash }
 *
 * Usage rows are per subject ("profile:<id>", "ip:<hash>", or "site"),
 * per UTC day, per imagery provider. Accounting never stops a game: a
 * store failure while recording is logged and the round goes on.
 */

import { createHash } from 'crypto';
import { MeterError, dayKey, decideRoomEntry, decideRound, limitsFromEnv, meterView, nextDayMs, refusalMessage, usageIncrement } from '../meter';

export const SITE_SUBJECT = 'site';

/** One imagery, so the usage rows have one bucket. */
const PROVIDER = 'apple';

/** IPs are stored hashed with the token secret; never the address itself. */
export function hashIp(ip, secret = '') {
  if (!ip || ip === 'unknown') return null;
  return `ip:${createHash('sha256').update(`${secret}|${ip}`).digest('hex').slice(0, 24)}`;
}

export const profileSubject = (profileId) => (profileId ? `profile:${profileId}` : null);

function subjectKeys(subjects) {
  return [profileSubject(subjects.profileId), subjects.ipHash, SITE_SUBJECT].filter(Boolean);
}

async function readUsage(store, subjects, day) {
  const rows = await store.listUsage(subjectKeys(subjects), day);
  const bucket = (subject) => {
    const out = {};
    for (const r of rows) if (r.subject === subject) out[r.provider] = { rounds: r.rounds, free: r.free, paid: r.paid, games: r.games || 0, challenge: r.challenge || 0, loads: r.loads || 0 };
    return out;
  };
  return {
    profile: subjects.profileId ? bucket(profileSubject(subjects.profileId)) : undefined,
    ip: subjects.ipHash ? bucket(subjects.ipHash) : undefined,
    site: bucket(SITE_SUBJECT),
  };
}

function refuse(code, now, extra = {}) {
  return new MeterError(code, refusalMessage(code), { resetAt: nextDayMs(now), ...extra });
}

/**
 * May this player start a solo round on this imagery right now? Throws
 * a MeterError. Returns the decision, which the caller records with
 * recordRound once the round is actually found: a round that finds no
 * imagery costs nothing.
 *
 * `limiter(key, { windowMs, maxRequests, blockDurationMs })` is the
 * per-minute speed check; the routes pass the site's rate limiter.
 */
export async function checkRound(store, { subjects, now = Date.now(), limits = limitsFromEnv(), limiter = null }) {
  // The address stands in when there is no profile: the speed limit is
  // the defence against a script, and a script is exactly the caller
  // that sends no profile token.
  const speedKey = subjects.profileId ? `geo-speed:${subjects.profileId}` : subjects.ipHash ? `geo-speed:${subjects.ipHash}` : null;
  if (limiter && speedKey && limits.roundsPerMinute > 0) {
    const speed = await limiter(speedKey, { windowMs: 60000, maxRequests: limits.roundsPerMinute, blockDurationMs: 60000 });
    if (speed && speed.success === false) {
      throw new MeterError('speed', refusalMessage('speed'), { resetAt: speed.resetAt || now + 60000 });
    }
  }
  const usage = await readUsage(store, subjects, dayKey(now));
  const decision = decideRound({
    signedIn: subjects.signedIn,
    hasProfile: Boolean(subjects.profileId),
    usage,
    limits,
  });
  if (!decision.ok) throw refuse(decision.code, now);
  return decision;
}

/** Record a solo round that started. Never throws. */
export async function recordRound(store, { subjects, now = Date.now() }) {
  try {
    const day = dayKey(now);
    const inc = usageIncrement();
    await Promise.all(subjectKeys(subjects).map((subject) => store.bumpUsage(subject, day, PROVIDER, inc)));
  } catch (error) {
    console.error('[geo/meter] record', error?.message || error);
  }
}

/**
 * Opening or joining a room, or a rematch: only the ceiling and the
 * site's day apply. Rooms are not rationed, because a room is how the
 * game spreads. Throws a MeterError; returns the decision.
 */
export async function checkRoomEntry(store, { subjects, now = Date.now(), limits = limitsFromEnv() }) {
  const usage = await readUsage(store, subjects, dayKey(now));
  const decision = decideRoomEntry({
    signedIn: subjects.signedIn,
    hasProfile: Boolean(subjects.profileId),
    usage,
    limits,
  });
  if (!decision.ok) throw refuse(decision.code, now);
  return decision;
}

/**
 * The subjects behind a player already in a room, for the rematch: the
 * profile row (fresh, for the prepaid balance) and the hashed address
 * kept on the player. No request here.
 */
export async function subjectsForPlayer(store, player) {
  const profile = player?.profileId && store.getProfileById ? await store.getProfileById(player.profileId) : null;
  return { profile, profileId: profile?.id || null, signedIn: Boolean(profile?.accountId), ipHash: player?.ipHash || null };
}

/**
 * A room round started. The first round a player is present for takes
 * their seat: on Google the day's free game (its rounds are then outside
 * Every round in a room is counted toward the day's ceiling for each
 * player and for the site, and nothing else. Never throws.
 */
export async function recordRoomRound(store, room, now = Date.now()) {
  try {
    const day = dayKey(now);
    const players = (room.players || []).filter((p) => !p.leftAt);
    if (!players.length) return;
    // Seats are not charged and rooms are not rationed, so a room round
    // is only counted: once for the site's day, once for each player.
    await store.bumpUsage(SITE_SUBJECT, day, PROVIDER, { rounds: players.length, loads: players.length });
    for (const player of players) {
      const subjects = [profileSubject(player.profileId), player.ipHash].filter(Boolean);
      if (!subjects.length) continue;
      await Promise.all(subjects.map((subject) => store.bumpUsage(subject, day, PROVIDER, usageIncrement())));
    }
  } catch (error) {
    console.error('[geo/meter] room round', error?.message || error);
  }
}

/** Today's meter for one player, as the lobby shows it. */
export async function usageToday(store, subjects, { now = Date.now(), limits = limitsFromEnv() } = {}) {
  const usage = await readUsage(store, subjects, dayKey(now));
  return meterView({
    usage,
    hasProfile: Boolean(subjects.profileId),
    signedIn: subjects.signedIn,
    limits,
    now,
  });
}
