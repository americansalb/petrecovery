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
import { MeterError, dayKey, decideRoomEntry, decideRound, limitsFromEnv, meterView, nextDayMs, refusalMessage, seatIncrement, usageIncrement } from '../meter';

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
    for (const r of rows) if (r.subject === subject) out[r.provider] = { rounds: r.rounds, free: r.free, paid: r.paid, games: r.games || 0 };
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
 * Opening or joining a room, or a rematch: the ceiling and the site
 * budget apply, then on Google the day's free room game or a prepaid
 * balance. The solo allowance never counts here: a friend's invitation
 * is not refused for it. Throws a MeterError; returns the decision.
 */
export async function checkRoomEntry(store, { subjects, provider = 'google', now = Date.now(), limits = limitsFromEnv() }) {
  const usage = await readUsage(store, subjects, dayKey(now));
  const decision = decideRoomEntry({
    provider,
    signedIn: subjects.signedIn,
    hasProfile: Boolean(subjects.profileId),
    paidRounds: subjects.profile?.paidRounds || 0,
    usage,
    limits,
  });
  if (!decision.ok) throw refuse(decision.code, provider, now);
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
 * the solo allowance) or the prepaid balance, on Apple nothing; a player
 * whose free game went to another room meanwhile and who has no balance
 * is simply counted, never sent away mid-game. Every round is counted
 * toward the day's ceiling for the player and the site. Never throws.
 */
export async function recordRoomRound(store, room, now = Date.now(), limits = limitsFromEnv()) {
  try {
    const day = dayKey(now);
    const provider = room.config?.provider === 'apple' ? 'apple' : 'google';
    const players = (room.players || []).filter((p) => !p.leftAt);
    if (!players.length) return;
    await store.bumpUsage(SITE_SUBJECT, day, provider, { rounds: players.length, free: 0, paid: 0 });
    for (const player of players) {
      const subjects = [profileSubject(player.profileId), player.ipHash].filter(Boolean);
      if (!subjects.length) continue;
      let entry = player.entry || null;
      if (!entry) {
        entry = await takeSeat(store, player, subjects, provider, day, limits);
        if (store.updatePlayer) await store.updatePlayer(player.id, { entry });
      }
      let source = 'over';
      if (entry === 'apple') source = 'apple';
      else if (entry === 'paid' && player.profileId && (await store.consumePaidRound(player.profileId))) source = 'paid';
      // A free seat's rounds are counted, not drawn from the allowance.
      await Promise.all(subjects.map((subject) => store.bumpUsage(subject, day, provider, usageIncrement(source))));
    }
  } catch (error) {
    console.error('[geo/meter] room round', error?.message || error);
  }
}

async function takeSeat(store, player, subjects, provider, day, limits) {
  if (provider === 'apple') return 'apple';
  const rows = await store.listUsage(subjects, day);
  const gamesOf = (subject) => rows.find((r) => r.subject === subject && r.provider === 'google')?.games || 0;
  const profileSubj = profileSubject(player.profileId);
  const profile = player.profileId && store.getProfileById ? await store.getProfileById(player.profileId) : null;
  const decision = decideRoomEntry({
    provider,
    signedIn: Boolean(profile?.accountId),
    hasProfile: Boolean(player.profileId),
    paidRounds: profile?.paidRounds || 0,
    usage: {
      profile: profileSubj ? { google: { games: gamesOf(profileSubj) } } : undefined,
      ip: player.ipHash ? { google: { games: gamesOf(player.ipHash) } } : undefined,
    },
    limits,
  });
  const entry = decision.ok ? decision.source : 'over';
  if (entry === 'free') await Promise.all(subjects.map((subject) => store.bumpUsage(subject, day, provider, seatIncrement('free'))));
  return entry;
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
