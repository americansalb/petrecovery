#!/usr/bin/env node
/**
 * Play Probably Earth with nothing configured.
 *
 *   npm run geo:demo
 *
 * Starts the dev server with a throwaway token secret and prints what
 * does and does not work without keys. No account with anybody, no
 * database, no mail sender, no domain.
 *
 * What you get:
 *
 *   Script          fully playable. Its map needs no key at all.
 *   Rooms, ratings, points, the shop, sign-in
 *                   all work against an in-memory store that forgets
 *                   everything when this stops.
 *   Look Around     NOT playable off a host the MapKit token covers,
 *                   and the token in the repository covers
 *                   reunitepets.org. The imagery is streamed by MapKit
 *                   itself, so there is no server response a mock could
 *                   stand in for. Set NEXT_PUBLIC_APPLE_MAPKIT_TOKEN to
 *                   one minted for localhost and every mode works.
 *
 * So: Script is the mode to try, and it is the one that needs nobody's
 * permission.
 */

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);

const env = {
  ...process.env,
  NODE_ENV: 'development',
  // A real secret, thrown away when this process stops. Rounds are
  // sealed properly; nothing survives a restart, which is the point.
  GEO_TOKEN_SECRET: process.env.GEO_TOKEN_SECRET || crypto.randomBytes(32).toString('base64url'),
};

const children = [];
function run(label, command, args, options = {}) {
  const child = spawn(command, args, { stdio: 'inherit', env, ...options });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) console.error(`[geo:demo] ${label} exited with ${code}`);
    stop();
  });
  children.push(child);
  return child;
}

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      child.kill('SIGTERM');
    } catch {
      /* already gone */
    }
  }
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

console.log(`
  Probably Earth demo
  ------------------
  Play:        http://localhost:${PORT}/geo/script      <- start here, works with no keys
  Everything:  http://localhost:${PORT}/geo

  Works now:   Script mode, rooms, ratings, points, the shop, sign-in
               (sign-in links are printed in this log rather than emailed)
  Needs a token for this origin: Look Around. MapKit streams the
               imagery itself, so no mock can stand in for it.

  Nothing is being stored. Without DATABASE_URL the game keeps everything
  in memory, so it is forgotten when you stop this AND when the dev
  server reloads after a file change. If a room disappears mid-game,
  that is why. Set DATABASE_URL to keep anything.
`);

run('next', process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'dev', '-p', String(PORT)]);
