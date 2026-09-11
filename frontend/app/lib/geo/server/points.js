/**
 * Points on the store (app/lib/geo/points.js has the rules, items.js
 * the catalog). Every earn and spend is a GeoLedger row with a `ref`
 * that names the event, unique per profile, so a replayed guess, a
 * repeated reveal or a double click never pays twice; the balance on
 * the profile follows the ledger. Server only, no request objects.
 */

import { createHash } from 'node:crypto';
import { countryByCode } from './countries';
import { profileSubject } from './meter';
import { dayKey } from '../meter';
import { POINTS, badgeEarned, earningAllowed, roomFinishPoints, roomRoundPoints, roundPoints } from '../points';
import { ITEMS, canBuy, canUse, equippedView, itemById, normalizeEquipped, reactionsFor, SLOTS } from '../items';
import { REACTION_EMOJI, sortStandings } from '../rooms';
import { LADDERS, placementsFrom, tierFor, TIERS } from '../rating';

/** Add points for an event. Returns the ledger row, or null when the event was already paid. */
export async function grant(store, { profileId, amount, reason, ref, now = Date.now() }) {
  const value = Math.round(Number(amount) || 0);
  if (!profileId || value <= 0 || !ref) return null;
  const row = await store.createLedger({ profileId, kind: 'earn', amount: value, reason, ref, day: dayKey(now), createdAt: new Date(now) });
  if (!row) return null;
  await store.addPoints(profileId, value);
  return row;
}

/** Take points for an event. False when the balance is short or the event was already paid. */
export async function spend(store, { profileId, amount, reason, ref, now = Date.now() }) {
  const value = Math.round(Number(amount) || 0);
  if (!profileId || value < 0 || !ref) return false;
  if (value === 0) return true;
  const taken = await store.addPoints(profileId, -value, { requireBalance: true });
  if (!taken) return false;
  const row = await store.createLedger({ profileId, kind: 'spend', amount: value, reason, ref, day: dayKey(now), createdAt: new Date(now) });
  if (!row) {
    await store.addPoints(profileId, value);
    return false;
  }
  return true;
}

/** Rounds this profile started today, from the play meter. */
export async function roundsPlayedToday(store, profileId, now = Date.now()) {
  const rows = await store.listUsage([profileSubject(profileId)], dayKey(now));
  return rows.reduce((sum, r) => sum + (r.rounds || 0), 0);
}

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][((n % 100) - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th'}`;

/**
 * Points and the country badge for one scored solo round. Returns what
 * the round earned, the balance, and the badge if it is new.
 */
/**
 * The ledger key for one solo round.
 *
 * It has to be the same every time that round is scored and different
 * for every other round, because the ledger's unique index on
 * (profileId, ref) is the only thing stopping a replayed guess from
 * paying twice.
 *
 * A seeded game gives that for free: seed plus round index names the
 * round exactly. Without a seed this used to fall back to the clock,
 * which is not an identity at all, and replaying one twelve-hour token
 * in a loop minted points without limit. The play meter did not catch
 * it either, because it counts rounds created rather than guesses
 * scored, so the daily earning cap never moved. (Found in the
 * pre-launch audit, 2026-09-11.)
 *
 * So a seedless round is keyed by the sealed token itself, hashed. Same
 * token, same key, paid once. Failing that, by where the answer was,
 * which is stable for the round and unguessable before the guess.
 */
function soloRef(result, token) {
  if (result.seed) return `solo:${result.seed}:${result.roundIndex}`;
  if (token) return `solo:t:${createHash('sha256').update(String(token)).digest('base64url').slice(0, 24)}`;
  const where = `${result.answer?.lat ?? ''},${result.answer?.lng ?? ''}`;
  return `solo:a:${createHash('sha256').update(`${where}|${result.mode}|${result.roundIndex}`).digest('base64url').slice(0, 24)}`;
}

export async function awardSoloRound(store, { profileId, result, token = '', now = Date.now() }) {
  const roundsToday = await roundsPlayedToday(store, profileId, now);
  const allowed = earningAllowed(Math.max(1, roundsToday));
  const lines = [];
  let earned = 0;
  const add = (row) => {
    if (!row) return;
    earned += row.amount;
    lines.push({ reason: row.reason, amount: row.amount });
  };

  if (allowed) {
    const ref = soloRef(result, token);
    const value = roundPoints({ score: result.score, mode: result.mode, kind: result.kind, correct: result.correct });
    add(await grant(store, { profileId, amount: value, reason: result.mode === 'daily' ? 'Daily round' : 'Round', ref, now }));
  }
  if (roundsToday <= 1) {
    add(await grant(store, { profileId, amount: POINTS.firstOfDay, reason: 'First round of the day', ref: `day:${dayKey(now)}`, now }));
  }

  let badge = null;
  const code = result.answer?.country?.code;
  if (result.kind === 'pin' && code && badgeEarned(result.distanceKm)) {
    const { created } = await store.upsertBadge(profileId, code, result.distanceKm, now);
    if (created) {
      const country = countryByCode(code);
      badge = { countryCode: code, name: country?.name || result.answer.country.name || code, flag: country?.flag || result.answer.country.flag || '' };
      add(await grant(store, { profileId, amount: POINTS.badge, reason: `Badge: ${badge.name}`, ref: `badge:${code}`, now }));
    }
  }

  const profile = await store.getProfileById(profileId);
  return { earned, lines, balance: profile?.points || 0, badge, allowed };
}

/** Points for a room round, per player with a profile. Returns { [playerId]: points }. */
export async function awardRoomRound(store, room, round, guesses, now = Date.now()) {
  const out = {};
  for (const g of guesses) {
    const player = g.player || room.players.find((p) => p.id === g.playerId);
    if (!player?.profileId || g.timedOut || !(g.score > 0)) continue;
    const roundsToday = await roundsPlayedToday(store, player.profileId, now);
    if (!earningAllowed(Math.max(1, roundsToday))) continue;
    const row = await grant(store, {
      profileId: player.profileId,
      amount: roomRoundPoints(g.score),
      reason: 'Room round',
      ref: `room:${room.id}:${round.index}:${player.profileId}`,
      now,
    });
    if (row) out[player.id] = row.amount;
  }
  return out;
}

/** Points for finishing a room, by placement among those who stayed. Returns { [playerId]: points }. */
export async function awardRoomFinish(store, room, now = Date.now()) {
  const isDuel = room.variant === 'duel';
  const stayed = sortStandings(room.players.filter((p) => !p.leftAt), room.variant);
  const placements = placementsFrom(stayed, (p) => (isDuel ? (p.eliminated ? 0 : p.hp || 0) : p.score || 0));
  const out = {};
  for (let i = 0; i < stayed.length; i++) {
    const p = stayed[i];
    if (!p.profileId) continue;
    const placement = placements[i];
    const row = await grant(store, {
      profileId: p.profileId,
      amount: roomFinishPoints({ placement, isDuel, left: false }),
      reason: isDuel && placement === 1 ? 'Duel won' : `Finished ${ordinal(placement)}`,
      ref: `roomfinish:${room.id}:${p.profileId}`,
      now,
    });
    if (row) out[p.id] = row.amount;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cosmetics
// ---------------------------------------------------------------------------

/** The best rating tier across ladders, for tier-only titles. */
export async function bestTier(store, profileId) {
  let best = TIERS[0].name;
  let bestIndex = 0;
  for (const ladder of LADDERS) {
    const [row] = await store.getRatings([profileId], ladder);
    if (!row) continue;
    const tier = tierFor(row.rating);
    const index = TIERS.findIndex((t) => t.name === tier);
    if (index > bestIndex) {
      bestIndex = index;
      best = tier;
    }
  }
  return best;
}

/** What each profile wears, keyed by profile id. */
export async function cosmeticsFor(store, profileIds) {
  const ids = [...new Set(profileIds.filter(Boolean))];
  if (!ids.length) return {};
  const profiles = await store.getProfilesByIds(ids);
  const out = {};
  for (const p of profiles) out[p.id] = equippedView(p.equipped);
  return out;
}

/** The reactions a room player may send. */
export async function reactionsForProfile(store, profileId) {
  if (!profileId) return [...REACTION_EMOJI];
  const owned = (await store.listUnlocks(profileId)).map((u) => u.itemId);
  return reactionsFor(REACTION_EMOJI, owned);
}

/** The shop as one profile sees it. */
export async function shopView(store, profile) {
  const [unlocks, tier, fresh] = await Promise.all([store.listUnlocks(profile.id), bestTier(store, profile.id), store.getProfileById(profile.id)]);
  const owned = unlocks.map((u) => u.itemId);
  const points = fresh?.points || 0;
  const equipped = normalizeEquipped(fresh?.equipped, { owned, tier });
  return {
    points,
    tier,
    owned,
    equipped,
    view: equippedView(equipped),
    items: ITEMS.map((item) => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      description: item.description,
      price: item.price,
      free: Boolean(item.free),
      requires: item.requires || null,
      style: item.style,
      fill: item.fill,
      value: item.value,
      emoji: item.emoji,
      owned: owned.includes(item.id),
      usable: canUse(item, { owned, tier }),
      affordable: canBuy(item, { owned, points }),
    })),
  };
}

export class ShopError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ShopError';
    this.code = code;
    this.status = status;
  }
}

/** Buy an item with points. Slot items are worn at once. */
export async function buyItem(store, profile, itemId, now = Date.now()) {
  const item = itemById(itemId);
  if (!item) throw new ShopError('unknown_item', 'No such item', 404);
  if (item.free || item.requires?.tier) throw new ShopError('not_for_sale', 'That one is not for sale', 400);
  const owned = (await store.listUnlocks(profile.id)).map((u) => u.itemId);
  if (owned.includes(item.id)) throw new ShopError('owned', 'You already have it', 409);
  const paid = await spend(store, { profileId: profile.id, amount: item.price, reason: `Bought ${item.name}`, ref: `buy:${item.id}`, now });
  if (!paid) throw new ShopError('short', 'Not enough points yet', 402);
  await store.createUnlock(profile.id, item.id, now);
  if (SLOTS.includes(item.kind)) await equipItem(store, profile, item.id);
  return shopView(store, profile);
}

/** Wear an item you may use. */
export async function equipItem(store, profile, itemId) {
  const item = itemById(itemId);
  if (!item || !SLOTS.includes(item.kind)) throw new ShopError('unknown_item', 'No such item', 404);
  const [unlocks, tier, fresh] = await Promise.all([store.listUnlocks(profile.id), bestTier(store, profile.id), store.getProfileById(profile.id)]);
  const owned = unlocks.map((u) => u.itemId);
  if (!canUse(item, { owned, tier })) throw new ShopError('not_owned', 'You do not have that one yet', 403);
  const equipped = normalizeEquipped({ ...(fresh?.equipped || {}), [item.kind]: item.id }, { owned, tier });
  await store.updateProfile(profile.id, { equipped });
  return shopView(store, profile);
}
