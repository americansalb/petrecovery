/**
 * Profiles and ratings on the room store.
 *
 * A profile is who you are across rooms. Anonymous players hold a
 * token (stored hashed); a signed-in player's profile is bound to their
 * account, so it follows them to other devices. Ratings are computed
 * per ladder from finished rooms by app/lib/geo/rating.js.
 *
 * Server only.
 */

import { hashToken, newPlayerToken } from './rooms';
import { sanitizeName, sortStandings } from '../rooms';
import { LADDERS, PROVISIONAL_GAMES, RATING_DEFAULT, RD_DEFAULT, displayRating, isProvisional, placementsFrom, rateGame, tierFor } from '../rating';
import { MAX_ROUND_SCORE } from '../distance';
import { equippedView } from '../items';
import { countryByCode } from './countries';

export const LEADERBOARD_MIN_GAMES = 3;

const toMs = (v) => (v instanceof Date ? v.getTime() : typeof v === 'number' ? v : v ? Date.parse(v) : null);

/**
 * Find or create the profile for a request.
 * Prefers the signed-in account; binds an anonymous token to it the
 * first time they meet. Returns { profile, token, created }; `token` is
 * set only when a new anonymous token was minted.
 */
export async function resolveProfile(store, { token, userId, name, now = Date.now(), createIfMissing = true } = {}) {
  const hash = token ? hashToken(token) : null;
  const byUser = userId ? await store.getProfileByUserId(userId) : null;
  const byToken = hash ? await store.getProfileByTokenHash(hash) : null;
  let profile = null;

  if (byUser) {
    profile = byUser;
  } else if (byToken) {
    profile = userId && !byToken.userId ? await store.updateProfile(byToken.id, { userId }) : byToken;
  }

  if (!profile) {
    if (!createIfMissing) return { profile: null, token: null, created: false };
    const fresh = newPlayerToken();
    profile = await store.createProfile({
      tokenHash: hashToken(fresh),
      userId: userId || null,
      name: sanitizeName(name),
      createdAt: new Date(now),
      lastSeenAt: new Date(now),
    });
    return { profile, token: fresh, created: true };
  }

  const cleanName = name ? sanitizeName(name) : profile.name;
  const patch = { lastSeenAt: new Date(now) };
  if (cleanName && cleanName !== profile.name) patch.name = cleanName;
  profile = await store.updateProfile(profile.id, patch);
  return { profile, token: null, created: false };
}

function ratingView(row) {
  const rating = row?.rating ?? RATING_DEFAULT;
  const rd = row?.rd ?? RD_DEFAULT;
  const games = row?.games || 0;
  return {
    ...displayRating(rating, rd),
    rating,
    rd,
    games,
    wins: row?.wins || 0,
    podiums: row?.podiums || 0,
    peak: Math.round(row?.peak ?? rating),
    streak: row?.streak || 0,
    provisional: isProvisional(games),
    tier: tierFor(rating),
    lastPlayedAt: toMs(row?.lastPlayedAt),
  };
}

/** What the browser shows for a profile: ratings per ladder and recent games. */
export async function profileSummary(store, profile) {
  const ratings = {};
  for (const ladder of LADDERS) {
    const [row] = await store.getRatings([profile.id], ladder);
    ratings[ladder] = ratingView(row);
  }
  const recent = (await store.getRecentResults(profile.id, 10)).map((r) => ({
    roomId: r.roomId,
    ladder: r.ladder,
    placement: r.placement,
    players: r.players,
    score: r.score,
    delta: Math.round(r.ratingAfter - r.ratingBefore),
    after: Math.round(r.ratingAfter),
    at: toMs(r.createdAt),
  }));
  // Points and cosmetics (docs/GEO.md, "Points and cosmetics").
  const [fresh, badgeRows, ledgerRows] = await Promise.all([
    store.getProfileById(profile.id),
    store.listBadges ? store.listBadges(profile.id) : [],
    store.listLedger ? store.listLedger(profile.id, 12) : [],
  ]);
  const badges = badgeRows.map((b) => {
    const country = countryByCode(b.countryCode);
    return { countryCode: b.countryCode, name: country?.name || b.countryCode, flag: country?.flag || '', bestKm: b.bestKm, at: toMs(b.createdAt) };
  });
  const ledger = ledgerRows.map((r) => ({ kind: r.kind, amount: r.amount, reason: r.reason, at: toMs(r.createdAt) }));
  return {
    id: profile.id,
    name: profile.name,
    signedIn: Boolean(profile.userId),
    ratings,
    recent,
    provisionalGames: PROVISIONAL_GAMES,
    points: fresh?.points || 0,
    // What is worn was checked against ownership when it was put on (server/points.js).
    equipped: equippedView(fresh?.equipped),
    badges,
    ledger,
  };
}

/** Ratings for the players of a room, keyed by profile id. */
export async function ratingsForRoom(store, room) {
  const ladder = room.variant === 'duel' ? 'duel' : 'classic';
  const ids = [...new Set(room.players.map((p) => p.profileId).filter(Boolean))];
  if (!ids.length) return {};
  const [rows, profiles] = await Promise.all([store.getRatings(ids, ladder), store.getProfilesByIds ? store.getProfilesByIds(ids) : []]);
  const out = {};
  for (const id of ids) {
    out[id] = { ...ratingView(rows.find((r) => r.profileId === id)), cosmetics: equippedView(profiles.find((p) => p.id === id)?.equipped) };
  }
  return out;
}

/**
 * Rate a finished room once. Players without a profile are unrated and
 * do not affect anyone. Players who left count as a loss to everyone
 * who stayed. Returns the per-player results, or null when already done.
 */
export async function applyRoomRatings(store, room, now = Date.now()) {
  if (room.status !== 'finished') return null;
  const claimed = await store.claimRoomRating(room.id, now);
  if (!claimed) return null;

  const ladder = room.variant === 'duel' ? 'duel' : 'classic';
  const isDuel = room.variant === 'duel';
  const rated = room.players.filter((p) => p.profileId);
  if (rated.length < 2) return [];

  const stayed = sortStandings(rated.filter((p) => !p.leftAt), room.variant);
  const measureOf = (p) => (isDuel ? (p.eliminated ? 0 : p.hp || 0) : p.score || 0);
  const placements = placementsFrom(stayed, measureOf);
  const rows = await store.getRatings(rated.map((p) => p.profileId), ladder);
  const byProfile = Object.fromEntries(rows.map((r) => [r.profileId, r]));

  const entries = rated.map((p) => {
    const row = byProfile[p.profileId];
    const idx = stayed.findIndex((s) => s.id === p.id);
    return {
      id: p.profileId,
      playerId: p.id,
      rating: row?.rating,
      rd: row?.rd,
      lastPlayedAt: row?.lastPlayedAt || null,
      placement: idx >= 0 ? placements[idx] : stayed.length + 1,
      measure: measureOf(p),
      left: Boolean(p.leftAt),
    };
  });
  const scale = isDuel ? 3000 : 0.2 * MAX_ROUND_SCORE * (room.config?.rounds || 5);
  const results = rateGame(entries, { scale, now });

  for (const result of results) {
    const entry = entries.find((e) => e.id === result.id);
    const row = byProfile[result.id];
    const won = result.placement === 1 && !entry.left;
    await store.upsertRating(result.id, ladder, {
      rating: result.after,
      rd: result.rdAfter,
      games: (row?.games || 0) + 1,
      wins: (row?.wins || 0) + (won ? 1 : 0),
      podiums: (row?.podiums || 0) + (result.placement <= 3 && !entry.left ? 1 : 0),
      peak: Math.max(row?.peak ?? RATING_DEFAULT, result.after),
      streak: won ? (row?.streak || 0) + 1 : 0,
      lastPlayedAt: new Date(now),
    });
    await store.createMatchResult({
      roomId: room.id,
      profileId: result.id,
      ladder,
      placement: result.placement,
      players: rated.length,
      score: Math.round(entry.measure),
      ratingBefore: result.before,
      ratingAfter: result.after,
      rdBefore: result.rdBefore,
      rdAfter: result.rdAfter,
      createdAt: new Date(now),
    });
    await store.updatePlayer(entry.playerId, { ratingBefore: result.before, ratingAfter: result.after, placement: result.placement });
  }
  return results;
}

/** The ladder table, with the asker's own row even when unranked. */
export async function leaderboard(store, { ladder = 'classic', limit = 50, profileId = null } = {}) {
  const which = LADDERS.includes(ladder) ? ladder : 'classic';
  const rows = await store.listLeaderboard(which, { limit, minGames: LEADERBOARD_MIN_GAMES });
  const table = rows.map((r, i) => ({ rank: i + 1, profileId: r.profileId, name: r.profile?.name || 'Player', cosmetics: equippedView(r.profile?.equipped), ...ratingView(r) }));
  let you = null;
  if (profileId) {
    const inTable = table.find((r) => r.profileId === profileId);
    if (inTable) you = inTable;
    else {
      const [row] = await store.getRatings([profileId], which);
      const profile = await store.getProfileById?.(profileId);
      you = { rank: null, profileId, name: profile?.name || 'You', ...ratingView(row) };
    }
  }
  return { ladder: which, minGames: LEADERBOARD_MIN_GAMES, rows: table, you };
}
