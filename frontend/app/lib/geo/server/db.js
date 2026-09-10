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
 *   GEO_DB_POOL        optional connection_limit for the game's pool.
 *
 * Server only.
 */

import { PrismaClient } from '@prisma/client';

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
  const pool = env.GEO_DB_POOL;
  // Nothing to say: no database of the game's own and no cap to apply,
  // so Prisma reads DATABASE_URL as it always has.
  if (!raw || (!env.GEO_DATABASE_URL && !pool)) return '';
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
