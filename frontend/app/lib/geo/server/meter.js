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
import { MeterError, dayKey, decideRound, limitsFromEnv, meterView, nextDayMs, refusalMessage, usageIncrement } from '../meter';

export const SITE_SUBJECT = 'site';

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
    for (const r of rows) if (r.subject === subject) out[r.provider] = { rounds: r.rounds, free: r.free, paid: r.paid };
    return out;
  };
  return {
    profile: subjects.profileId ? bucket(profileSubject(subjects.profileId)) : undefined,
    ip: subjects.ipHash ? bucket(subjects.ipHash) : undefined,
    site: bucket(SITE_SUBJECT),
  };
}

function refuse(code, provider, now, extra = {}) {
  return new MeterError(code, refusalMessage(code, provider), { provider, resetAt: nextDayMs(now), ...extra });
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
export async function checkRound(store, { subjects, provider, mode, now = Date.now(), limits = limitsFromEnv(), limiter = null }) {
  if (limiter && subjects.profileId && limits.roundsPerMinute > 0) {
    const speed = await limiter(`geo-speed:${subjects.profileId}`, { windowMs: 60000, maxRequests: limits.roundsPerMinute, blockDurationMs: 60000 });
    if (speed && speed.success === false) {
      throw new MeterError('speed', refusalMessage('speed', provider), { provider, resetAt: speed.resetAt || now + 60000 });
    }
  }
  const usage = await readUsage(store, subjects, dayKey(now));
  const decision = decideRound({
    provider,
    mode,
    signedIn: subjects.signedIn,
    hasProfile: Boolean(subjects.profileId),
    paidRounds: subjects.profile?.paidRounds || 0,
    usage,
    limits,
  });
  if (!decision.ok) throw refuse(decision.code, provider, now);
  return decision;
}

/** Record a solo round that started. Never throws. */
export async function recordRound(store, { subjects, provider, source, now = Date.now() }) {
  try {
    const day = dayKey(now);
    let actual = source;
    if (source === 'paid') {
      // The balance may have gone to zero between the check and now.
      actual = subjects.profileId && (await store.consumePaidRound(subjects.profileId)) ? 'paid' : 'over';
    }
    const inc = usageIncrement(actual);
    await Promise.all(subjectKeys(subjects).map((subject) => store.bumpUsage(subject, day, provider, inc)));
  } catch (error) {
    console.error('[geo/meter] record', error?.message || error);
  }
}

/**
 * Opening or joining a room: the ceiling and the site budget apply, the
 * allowance does not. Throws a MeterError.
 */
export async function checkRoomEntry(store, { subjects, provider = 'google', now = Date.now(), limits = limitsFromEnv() }) {
  const usage = await readUsage(store, subjects, dayKey(now));
  const decision = decideRound({
    provider,
    mode: 'balanced',
    signedIn: subjects.signedIn,
    hasProfile: Boolean(subjects.profileId),
    usage,
    limits,
    allowance: false,
  });
  if (!decision.ok) throw refuse(decision.code, provider, now);
}

/**
 * A room round started: every present player with a profile is charged
 * one round on the room's imagery (the free allowance first, then
 * prepaid rounds, then simply counted), and the site is charged one per
 * player. Never throws.
 */
export async function recordRoomRound(store, room, now = Date.now(), limits = limitsFromEnv()) {
  try {
    const day = dayKey(now);
    const provider = room.config?.provider === 'apple' ? 'apple' : 'google';
    const players = (room.players || []).filter((p) => !p.leftAt);
    if (!players.length) return;
    await store.bumpUsage(SITE_SUBJECT, day, provider, { rounds: players.length, free: 0, paid: 0 });
    for (const player of players) {
      if (!player.profileId) continue;
      const subject = profileSubject(player.profileId);
      let source = 'over';
      if (provider === 'apple') source = 'apple';
      else {
        const rows = await store.listUsage([subject], day);
        const freeUsed = rows.find((r) => r.provider === 'google')?.free || 0;
        if (freeUsed < limits.freeGoogleRounds) source = 'free';
        else if (await store.consumePaidRound(player.profileId)) source = 'paid';
      }
      await store.bumpUsage(subject, day, provider, usageIncrement(source));
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
    paidRounds: subjects.profile?.paidRounds || 0,
    limits,
    now,
  });
}
