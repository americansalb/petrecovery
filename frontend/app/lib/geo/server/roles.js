/**
 * Who an account is, and what that lets it do.
 *
 * Three layers, decided by the founder on 2026-09-16, and deliberately
 * independent of each other:
 *
 * - **Guest or signed in.** A browser plays without an account at all
 *   (app/lib/geo/server/profiles.js). Signing in binds that browser's
 *   play profile to an email so the history, the rating and the badges
 *   survive a new device. Nothing about the game is withheld from a
 *   guest; the account is for keeping, not for unlocking.
 * - **Role**: player, host, admin. What the account may DO.
 * - **Tier**: free, supporter. What the account has PAID for.
 *
 * Role and tier are separate because they answer different questions
 * and change for different reasons. A teacher running a class is a host
 * on the free tier; somebody who plays every day and pays for it is a
 * supporter who is still an ordinary player. Collapsing them into one
 * ladder is how "paid for it" quietly turns into "allowed to moderate".
 *
 * Every check here is server side. The browser is told its own role and
 * tier so it can render the right screen, and is never believed about
 * either.
 */

export const ROLES = ['player', 'host', 'admin'];
export const TIERS = ['free', 'supporter'];

/**
 * Admins by email, from the environment.
 *
 * The bootstrap problem: only an admin can promote an admin, so the
 * first one cannot exist. This is the answer, and it is checked live
 * rather than copied into the row at sign-up, so removing an address
 * from the variable removes the access on the next request rather than
 * leaving a promotion nobody remembers granting.
 */
const BOOTSTRAP = String(process.env.GEO_ADMIN_EMAILS || '')
  .split(/[\s,;]+/)
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

/** Is this address an admin by configuration, whatever the row says? */
export function isBootstrapAdmin(email) {
  const address = String(email || '').trim().toLowerCase();
  return Boolean(address) && BOOTSTRAP.includes(address);
}

/** The role an account effectively has, configuration included. */
export function roleOf(account) {
  if (!account) return 'player';
  if (isBootstrapAdmin(account.email)) return 'admin';
  return ROLES.includes(account.role) ? account.role : 'player';
}

/**
 * The tier an account effectively has.
 *
 * A supporter whose `tierUntil` has passed is a free account again.
 * Expiry is read here rather than swept by a job, so a lapsed tier
 * stops working at the moment it lapses even if nothing has run.
 */
export function tierOf(account, { now = new Date() } = {}) {
  if (!account) return 'free';
  const tier = TIERS.includes(account.tier) ? account.tier : 'free';
  if (tier === 'free') return 'free';
  if (account.tierUntil && new Date(account.tierUntil).getTime() <= new Date(now).getTime()) return 'free';
  return tier;
}

export function isSuspended(account) {
  return Boolean(account?.suspendedAt);
}

/**
 * What each role may do. Named capabilities rather than role checks at
 * the call sites, so adding a role later is one edit here instead of a
 * search for every `=== 'admin'` in the codebase.
 */
const CAPABILITIES = {
  player: ['play'],
  host: ['play', 'host_rooms'],
  admin: ['play', 'host_rooms', 'admin_read', 'admin_write'],
};

export function can(account, capability) {
  if (isSuspended(account)) return false;
  return (CAPABILITIES[roleOf(account)] || CAPABILITIES.player).includes(capability);
}

export function isAdmin(account) {
  return can(account, 'admin_read');
}

/**
 * What the tier is worth. One table, so the answer to "what does paying
 * get me" is readable in one place rather than inferred from scattered
 * conditionals.
 *
 * These are limits and conveniences. No mode, no map and no ladder is
 * behind the tier: a free account and a supporter play the same game.
 */
export const TIER_BENEFITS = {
  free: {
    label: 'Free',
    googleRoundsMultiplier: 1,
    roomGamesMultiplier: 1,
    privateRooms: false,
    historyDays: 90,
  },
  supporter: {
    label: 'Supporter',
    googleRoundsMultiplier: 4,
    roomGamesMultiplier: 5,
    privateRooms: true,
    historyDays: 3650,
  },
};

export function benefitsOf(account, options) {
  return TIER_BENEFITS[tierOf(account, options)] || TIER_BENEFITS.free;
}

/** What the browser is allowed to know about itself. */
export function accountView(account, options) {
  if (!account) return null;
  return {
    email: account.email,
    role: roleOf(account),
    tier: tierOf(account, options),
    tierUntil: account.tierUntil ? new Date(account.tierUntil).toISOString() : null,
    suspended: isSuspended(account),
    benefits: benefitsOf(account, options),
  };
}
