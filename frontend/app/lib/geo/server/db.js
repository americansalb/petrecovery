/**
 * The game's database client.
 *
 * The game owns its own Prisma client so that nothing under app/lib/geo
 * imports the pet site's singleton (docs/WANDERGUESSER_SPLIT.md, phase
 * 1.1). Until phase 3 gives the game its own schema and its own
 * database, this points at the same Postgres as the pet app, which means
 * a second connection pool on the same server. GEO_DB_POOL caps that
 * pool when the server's connection limit is tight; unset, Prisma's
 * default applies and nothing about today's behaviour changes.
 *
 *   GEO_DATABASE_URL   the game's own database. Falls back to
 *                      DATABASE_URL, which is where the sixteen Geo
 *                      tables live today.
 *   GEO_DB_POOL        connection_limit for the game's pool. On the
 *                      shared database it defaults to SHARED_POOL_DEFAULT
 *                      rather than to Prisma's default, because the
 *                      other thing on that database is a lost-pet
 *                      service and a game spike must not starve it.
 *
 * Server only.
 */

import { PrismaClient } from '@prisma/client';

/**
 * Connections the game's pool may open when it shares the pet site's
 * database. Small on purpose: the game is a game and the database is
 * also serving lost-pet reports.
 */
export const SHARED_POOL_DEFAULT = 5;

/**
 * The connection string to hand Prisma, or '' to let Prisma read the
 * environment itself.
 *
 * The cap has to apply to the fallback too. The whole reason GEO_DB_POOL
 * exists is the phase 1 arrangement where GEO_DATABASE_URL is unset and
 * both pools point at DATABASE_URL, so reading only GEO_DATABASE_URL
 * would leave the cap dead in exactly the deployment it is for.
 *
 * A URL that will not parse is passed through untouched: a bad
 * connection string should fail in Prisma's words, not ours.
 */
export function connectionUrl(env = process.env) {
  const raw = env.GEO_DATABASE_URL || env.DATABASE_URL || '';
  // Sharing the pet site's database means a second pool on the same
  // Postgres, and the thing on the other side of it is a lost-pet
  // service. An uncapped second pool turns a launch spike, or any of
  // the abuse the play meter is there to bound, into connection
  // starvation for pet reports. So the shared arrangement has a cap
  // whether or not the operator set one; the game's own database does
  // not, because there is nothing else on it to protect.
  const shared = !env.GEO_DATABASE_URL && Boolean(env.DATABASE_URL);
  const pool = env.GEO_DB_POOL || (shared ? String(SHARED_POOL_DEFAULT) : '');
  if (!raw) return '';
  if (!pool) return raw;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', pool);
    return url.toString();
  } catch {
    return raw;
  }
}

function createClient() {
  const url = connectionUrl();
  return new PrismaClient({
    // Quieter than the pet client on purpose: a round logs several
    // queries and the game is chatty in development.
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    ...(url ? { datasources: { db: { url } } } : {}),
  });
}

// One client per process. Next's hot reload re-imports this module, so
// the instance is parked on globalThis under the game's own key rather
// than the pet app's.
const globalForGeo = globalThis;

export const prisma = globalForGeo.__geoPrisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForGeo.__geoPrisma = prisma;

export default prisma;
