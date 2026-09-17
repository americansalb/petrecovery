#!/usr/bin/env node
/**
 * Production boot sequence.
 *
 * The start script used to be:
 *
 *   prisma db push --skip-generate && node prisma/sync-legal-docs.js && next start
 *
 * `prisma db push` exits non-zero when it detects a change it will not apply
 * without --accept-data-loss. Because the chain was `&&`, next start never ran:
 * a schema delta the tool considered destructive took the entire site down
 * instead of deploying. A lost-pet service going dark is far worse than one
 * running briefly against the previous schema, where at most the queries that
 * touch the changed table fail.
 *
 * So: try each preparation step, report clearly, and always start the server.
 * A failed step is loud - it prints a banner and, once ERROR_WEBHOOK_URL is
 * set, boot failures are visible there too via the normal error path.
 */

const { spawnSync, spawn } = require('child_process');

function step(label, command, args) {
  process.stdout.write(`[boot] ${label}...\n`);
  const res = spawnSync(command, args, { stdio: 'inherit', env: process.env });

  if (res.status === 0) {
    process.stdout.write(`[boot] ${label}: ok\n`);
    return true;
  }

  process.stderr.write(
    `\n[boot] ${'='.repeat(66)}\n` +
    `[boot] ${label} FAILED (exit ${res.status}).\n` +
    `[boot] Starting the server anyway so the site stays up. Queries that\n` +
    `[boot] depend on this step may fail until it is resolved.\n` +
    `[boot] ${'='.repeat(66)}\n\n`
  );
  return false;
}

if (!step('Sync database schema', 'npx', ['prisma', 'db', 'push', '--skip-generate'])) {
  /**
   * A refused push is about ONE change, but it leaves the WHOLE push
   * unapplied, because Prisma applies a schema whole or not at all. So
   * one column that cannot be dropped safely keeps every new table and
   * every new column behind it missing, on this boot and on every boot
   * after it, and the only symptom is one endpoint answering 500 while
   * the rest of the site looks fine. `GeoProfile.accountId` went
   * missing that way and stayed missing across every deploy since.
   *
   * The build does this too (scripts/db-sync.js), but the build does
   * not always have the database the server will actually talk to.
   * This does, by definition: it is the URL the app is about to query.
   *
   * ADD COLUMN, CREATE TABLE, CREATE INDEX and ADD CONSTRAINT cannot
   * destroy anything, so they are applied one at a time. DROP, RENAME,
   * a type change and SET NOT NULL are never run here, whatever the
   * schema says; they are named in the log for a person to decide on.
   * Nothing here ever passes --accept-data-loss. This database is
   * shared with the rest of the site, so "additive only" is the whole
   * safety argument, and it is enforced in code, not by convention.
   */
  try {
    const { repair } = require('./db-additive');
    const fixed = repair(process.env);
    if (fixed.applied.length) {
      process.stdout.write(`[boot] Applied ${fixed.applied.length} safe schema change(s) one at a time:\n`);
      for (const statement of fixed.applied) process.stdout.write(`[boot]   ${statement};\n`);
    }
    for (const { statement, error } of fixed.failed) {
      process.stderr.write(`[boot] still missing: ${statement};\n`);
      process.stderr.write(`[boot]   ${String(error).split('\n')[0]}\n`);
    }
    for (const statement of fixed.skipped) {
      process.stderr.write(`[boot] NOT run, it could destroy something: ${statement};\n`);
    }
    if (!fixed.applied.length && !fixed.failed.length && !fixed.skipped.length) {
      process.stderr.write('[boot] Could not read the database to say what it is missing.\n');
    }
  } catch (error) {
    process.stderr.write(`[boot] Could not repair the schema: ${error?.message || error}\n`);
  }
}
step('Sync legal documents', 'node', ['prisma/sync-legal-docs.js']);

const port = process.env.PORT || '3000';
process.stdout.write(`[boot] Starting Next.js on port ${port}\n`);

const server = spawn('npx', ['next', 'start', '-p', port], { stdio: 'inherit', env: process.env });
server.on('exit', (code) => process.exit(code ?? 1));
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.kill(signal));
}
