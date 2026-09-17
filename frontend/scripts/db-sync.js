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
 * 1. **Only on a host that deploys this**, or when FORCE_DB_PUSH is
 *    set. A local `npm run build` and CI both have a DATABASE_URL
 *    pointed at something that is not the production database (CI
 *    deliberately aims at a dummy), and neither should have a schema
 *    pushed at it. The host is recognised by the variable it sets for
 *    itself: VERCEL on Vercel, RENDER on Render. Naming only one of
 *    them is how this came to skip every deploy on the other, which
 *    looks identical to working until a query hits a missing table.
 * 2. **Never --accept-data-loss.** Prisma refuses a change that would
 *    drop data unless you ask for it, and this never asks. Adding
 *    tables and columns goes through; anything that would destroy
 *    something is refused.
 * 3. **A failure does not fail the build.** A deploy that cannot sync
 *    is worse than one that can, but it is far better than no deploy at
 *    all: the site keeps serving, and the endpoints whose tables are
 *    missing say so in as many words rather than answering "internal".
 *    The banner below is what to look for in the deploy log, and it now
 *    prints the SQL the database is still missing rather than only the
 *    one change that was refused. Those are not the same list: Prisma
 *    applies a push whole or not at all, so one refusable change leaves
 *    every safe addition behind it unapplied as well, quietly, on every
 *    deploy from then on. So the additions are then applied one at a
 *    time (scripts/db-additive.js), which cannot destroy anything, and
 *    the destructive change is left named in the log for a person.
 */

const { spawnSync } = require('node:child_process');

const skip = (why) => {
  console.log(`[db-sync] skipped: ${why}`);
  process.exit(0);
};

if (process.env.SKIP_DB_PUSH) skip('SKIP_DB_PUSH is set');
if (!process.env.DATABASE_URL) skip('no DATABASE_URL, so there is nothing to sync');
const HOSTS = [
  ['VERCEL', 'Vercel'],
  ['RENDER', 'Render'],
];
const platform = HOSTS.find(([variable]) => process.env[variable])?.[1] || '';
if (!platform && !process.env.FORCE_DB_PUSH) {
  skip('not a hosted deploy (set FORCE_DB_PUSH=1 to sync from somewhere else)');
}
console.log(`[db-sync] ${platform || 'FORCE_DB_PUSH'} deploy`);

console.log('[db-sync] applying prisma/schema.prisma to the database');
const result = spawnSync('npx', ['prisma', 'db', 'push', '--skip-generate'], {
  stdio: 'inherit',
  env: process.env,
});

if (result.status === 0) {
  console.log('[db-sync] schema is on the database');
  process.exit(0);
}

/**
 * What the database is still missing, and as much of it as can be added
 * without destroying anything (scripts/db-additive.js).
 *
 * The refusal above is about ONE change. It says nothing about the rest
 * of the same push, which is also now unapplied, because Prisma applies
 * a push whole or not at all. So one column that cannot be dropped
 * safely leaves every new table and every new column behind it missing
 * too, on this deploy and on every deploy after, and the only visible
 * symptom is one endpoint answering 500 while the rest of the site
 * looks fine.
 *
 * That is not a thing to leave for somebody to notice. ADD COLUMN,
 * CREATE TABLE, CREATE INDEX and ADD CONSTRAINT cannot destroy
 * anything, so they are applied here. DROP, RENAME, a type change and
 * SET NOT NULL are not, and never will be: they stay for a person to
 * decide on, named below.
 */
const { repair } = require('./db-additive');
let fixed = { pending: '', applied: [], failed: [], skipped: [] };
try {
  fixed = repair(process.env);
} catch (error) {
  console.error('[db-sync] could not read the database to repair it:', error?.message || error);
}

console.error('');
console.error('==========================================================');
console.error('[db-sync] THE SCHEMA WAS NOT APPLIED IN ONE PIECE.');
console.error('');
console.error('Prisma refuses a change that would lose data unless it is');
console.error('asked to, and this never asks. It refuses the WHOLE push');
console.error('when it does, so one refusable change blocks all the safe');
console.error('ones with it. The refusal above names that one change.');

if (fixed.applied.length) {
  console.error('');
  console.error(`[db-sync] APPLIED ${fixed.applied.length} safe change(s), so the database is not left behind:`);
  for (const statement of fixed.applied) console.error(`  ${statement};`);
}
if (fixed.failed.length) {
  console.error('');
  console.error(`[db-sync] ${fixed.failed.length} safe change(s) would not apply. Nothing was lost; they are still missing:`);
  for (const { statement, error } of fixed.failed) {
    console.error(`  ${statement};`);
    console.error(`    ${String(error).split('\n')[0]}`);
  }
}
if (fixed.skipped.length) {
  console.error('');
  console.error('[db-sync] NOT run, because it could destroy something. Yours to decide on:');
  for (const statement of fixed.skipped) console.error(`  ${statement};`);
}
if (!fixed.pending) {
  console.error('');
  console.error('`prisma migrate diff` could not read the database to say');
  console.error('what is missing, so run it by hand:');
  console.error('');
  console.error('  npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \\');
  console.error('    --to-schema-datamodel prisma/schema.prisma --script');
}
console.error('==========================================================');
console.error('');
process.exit(0);
