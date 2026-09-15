#!/usr/bin/env node
/**
 * Put the schema on the database at deploy time.
 *
 * The build ran `prisma generate` and nothing else, which builds a
 * client that knows the schema and a database that does not have it.
 * Everything that reads a table created before the last hand-run of
 * `db push` worked, and everything newer answered with a Prisma P2021,
 * "the table does not exist". That is how sign-in came to 500 on a live
 * site while working perfectly in development: `GeoLoginToken` had
 * never been created. Pointing the app at a brand new database makes it
 * total rather than partial, because then no table exists at all.
 *
 * So the deploy syncs the schema. Three rules keep that safe:
 *
 * 1. **Only on Vercel**, or when FORCE_DB_PUSH is set. A local
 *    `npm run build` and CI both have a DATABASE_URL pointed at
 *    something that is not the production database (CI deliberately
 *    aims at a dummy), and neither should have a schema pushed at it.
 * 2. **Never --accept-data-loss.** Prisma refuses a change that would
 *    drop data unless you ask for it, and this never asks. Adding
 *    tables and columns goes through; anything that would destroy
 *    something is refused.
 * 3. **A failure does not fail the build.** A deploy that cannot sync
 *    is worse than one that can, but it is far better than no deploy at
 *    all: the site keeps serving, and the endpoints whose tables are
 *    missing say so in as many words rather than answering "internal".
 *    The banner below is what to look for in the deploy log.
 */

const { spawnSync } = require('node:child_process');

const skip = (why) => {
  console.log(`[db-sync] skipped: ${why}`);
  process.exit(0);
};

if (process.env.SKIP_DB_PUSH) skip('SKIP_DB_PUSH is set');
if (!process.env.DATABASE_URL) skip('no DATABASE_URL, so there is nothing to sync');
if (!process.env.VERCEL && !process.env.FORCE_DB_PUSH) {
  skip('not a Vercel build (set FORCE_DB_PUSH=1 to sync from somewhere else)');
}

console.log('[db-sync] applying prisma/schema.prisma to the database');
const result = spawnSync('npx', ['prisma', 'db', 'push', '--skip-generate'], {
  stdio: 'inherit',
  env: process.env,
});

if (result.status === 0) {
  console.log('[db-sync] schema is on the database');
  process.exit(0);
}

console.error('');
console.error('==========================================================');
console.error('[db-sync] THE SCHEMA WAS NOT APPLIED.');
console.error('');
console.error('The build carries on and the site will deploy, but any');
console.error('table this schema adds is missing, and the routes that');
console.error('need one will answer schema_missing until it is there.');
console.error('');
console.error('Prisma refuses a change that would lose data unless it is');
console.error('asked to, and this never asks. If that is what happened,');
console.error('the diff above says which column or table it is about.');
console.error('==========================================================');
console.error('');
process.exit(0);
