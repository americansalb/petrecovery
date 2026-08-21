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

step('Sync database schema', 'npx', ['prisma', 'db', 'push', '--skip-generate']);
step('Sync legal documents', 'node', ['prisma/sync-legal-docs.js']);

const port = process.env.PORT || '3000';
process.stdout.write(`[boot] Starting Next.js on port ${port}\n`);

const server = spawn('npx', ['next', 'start', '-p', port], { stdio: 'inherit', env: process.env });
server.on('exit', (code) => process.exit(code ?? 1));
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.kill(signal));
}
