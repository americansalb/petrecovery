/**
 * The admin backend's own gate, and the reads behind it.
 *
 * Every admin route starts by calling `requireAdmin`. It resolves the
 * session cookie to a real row and asks roles.js what that row may do,
 * rather than trusting anything the browser said about itself: the
 * presence cookie the client reads is a boolean with no signature, and
 * a role in a JWT is a role somebody can keep after it is revoked.
 *
 * Reads are deliberately narrow. An admin screen that dumps whole
 * tables is a data leak waiting for one stolen laptop, so each function
 * here returns the columns its screen renders and no others. Nothing in
 * this file returns a token hash, a sealed session, or a sign-in link.
 */

import prisma from '@/app/lib/geo/server/db';
import { accountFromRequest } from '@/app/lib/geo/server/identity';
import { isAdmin, roleOf, tierOf, isSuspended, ROLES, TIERS } from '@/app/lib/geo/server/roles';

export class AdminDenied extends Error {
  constructor(reason = 'not_admin') {
    super(reason);
    this.reason = reason;
  }
}

/**
 * The account behind this request, if it may administer anything.
 * Throws AdminDenied otherwise, which the routes turn into a 403 that
 * says nothing about whether the account exists.
 */
export async function requireAdmin(request) {
  const { accountId } = accountFromRequest(request);
  if (!accountId) throw new AdminDenied('signed_out');
  const account = await prisma.geoAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new AdminDenied('no_account');
  if (isSuspended(account)) throw new AdminDenied('suspended');
  if (!isAdmin(account)) throw new AdminDenied('not_admin');
  return account;
}

const day = 24 * 60 * 60 * 1000;

/** The numbers the overview screen shows. One round trip each, counted rather than fetched. */
export async function siteOverview({ now = Date.now() } = {}) {
  const since = new Date(now - day);
  const week = new Date(now - 7 * day);
  const [accounts, supporters, suspended, profiles, newProfiles, rooms, liveRooms, roundsToday, entries] = await Promise.all([
    prisma.geoAccount.count(),
    prisma.geoAccount.count({ where: { tier: 'supporter' } }),
    prisma.geoAccount.count({ where: { NOT: { suspendedAt: null } } }),
    prisma.geoProfile.count(),
    prisma.geoProfile.count({ where: { createdAt: { gte: since } } }),
    prisma.geoRoom.count(),
    prisma.geoRoom.count({ where: { status: { in: ['lobby', 'playing'] } } }),
    prisma.geoChallengeRound.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
    prisma.geoChallengeEntry.count({ where: { createdAt: { gte: week } } }).catch(() => 0),
  ]);
  return {
    accounts,
    supporters,
    suspended,
    profiles,
    newProfiles,
    rooms,
    liveRooms,
    roundsToday,
    challengeEntriesThisWeek: entries,
    generatedAt: new Date(now).toISOString(),
  };
}

/**
 * Accounts, newest first, optionally filtered by a substring of the
 * address. Capped, because an admin screen is not an export tool.
 */
export async function listAccounts({ query = '', limit = 50, now = Date.now() } = {}) {
  const where = query
    ? { OR: [{ email: { contains: String(query).trim().toLowerCase(), mode: 'insensitive' } }, { phone: { contains: String(query).trim() } }] }
    : {};
  const rows = await prisma.geoAccount.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(Number(limit) || 50, 1), 200),
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      tier: true,
      tierUntil: true,
      suspendedAt: true,
      suspendedReason: true,
      createdAt: true,
      lastSeenAt: true,
      profiles: { select: { id: true, name: true, points: true, lastSeenAt: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    phone: row.phone || null,
    // The effective values, not the stored ones: a bootstrap admin and
    // a lapsed supporter both read wrong straight off the row.
    role: roleOf(row),
    storedRole: row.role,
    tier: tierOf(row, { now }),
    storedTier: row.tier,
    tierUntil: row.tierUntil ? row.tierUntil.toISOString() : null,
    suspended: isSuspended(row),
    suspendedReason: row.suspendedReason || '',
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt.toISOString(),
    players: row.profiles.map((profile) => ({ id: profile.id, name: profile.name, points: profile.points })),
  }));
}

/**
 * Change one account. Only the four fields an admin screen offers, each
 * validated here rather than trusted from the body.
 *
 * An admin cannot suspend themselves, which is not politeness: it is
 * the difference between a mistake and a site with nobody able to
 * administer it.
 */
export async function updateAccount({ actor, accountId, role, tier, tierUntil, suspended, reason }) {
  if (!accountId) throw new AdminDenied('no_account');
  const data = {};
  if (role !== undefined) {
    if (!ROLES.includes(role)) throw new AdminDenied('bad_role');
    data.role = role;
  }
  if (tier !== undefined) {
    if (!TIERS.includes(tier)) throw new AdminDenied('bad_tier');
    data.tier = tier;
    // A tier with no end is one nobody has to remember to renew; the
    // screen sets a date when it wants one.
    if (tier === 'free') data.tierUntil = null;
  }
  if (tierUntil !== undefined) {
    data.tierUntil = tierUntil ? new Date(tierUntil) : null;
  }
  if (suspended !== undefined) {
    if (suspended && accountId === actor?.id) throw new AdminDenied('cannot_suspend_self');
    data.suspendedAt = suspended ? new Date() : null;
    data.suspendedReason = suspended ? String(reason || '').slice(0, 200) : null;
  }
  if (!Object.keys(data).length) return null;
  const row = await prisma.geoAccount.update({ where: { id: accountId }, data });
  return {
    id: row.id,
    email: row.email,
    phone: row.phone || null,
    role: roleOf(row),
    tier: tierOf(row),
    tierUntil: row.tierUntil ? row.tierUntil.toISOString() : null,
    suspended: isSuspended(row),
    suspendedReason: row.suspendedReason || '',
  };
}

/** Rooms worth looking at: the live ones, then the most recent. */
export async function listRooms({ limit = 25 } = {}) {
  const rows = await prisma.geoRoom.findMany({
    orderBy: [{ lastActiveAt: 'desc' }],
    take: Math.min(Math.max(Number(limit) || 25, 1), 100),
    select: {
      code: true,
      name: true,
      status: true,
      variant: true,
      visibility: true,
      roundIndex: true,
      createdAt: true,
      lastActiveAt: true,
      _count: { select: { players: true } },
    },
  });
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    status: row.status,
    variant: row.variant,
    visibility: row.visibility,
    round: row.roundIndex + 1,
    players: row._count.players,
    createdAt: row.createdAt.toISOString(),
    lastActiveAt: row.lastActiveAt.toISOString(),
  }));
}
