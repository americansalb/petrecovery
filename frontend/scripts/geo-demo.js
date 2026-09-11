#!/usr/bin/env node
/**
 * Play WanderGuesser with nothing configured.
 *
 *   npm run geo:demo
 *
 * Starts the mock Street View metadata server and the dev server, mints
 * a throwaway token secret, and prints what does and does not work
 * without keys. No Google project, no database, no mail account, no
 * domain.
 *
 * What you get:
 *
 *   Script          fully playable. Keyless map, no imagery provider.
 *   Rooms, ratings, points, the shop, sign-in
 *                   all work against an in-memory store that forgets
 *                   everything when this stops.
 *   Street View     NOT playable. Rendering a panorama needs a Google
 *                   Maps browser key and no mock can stand in for that:
 *                   the imagery comes from Google's own SDK. The server
 *                   side is mocked, so the probe and the scoring work,
 *                   but the round has nothing to look at.
 *   Look Around     NOT playable off reunitepets.org. The MapKit token
 *                   in the repository is locked to that origin.
 *
 * So: Script is the mode to try, and it is the one that needs nobody's
 * permission.
 */

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const METADATA_PORT = Number(process.env.GEO_DEMO_METADATA_PORT || 3999);
const here = __dirname;

const env = {
  ...process.env,
  NODE_ENV: 'development',
  // A real secret, thrown away when this process stops. Rounds are
  // sealed properly; nothing survives a restart, which is the point.
  GEO_TOKEN_SECRET: process.env.GEO_TOKEN_SECRET || crypto.randomBytes(32).toString('base64url'),
  GEO_STREET_VIEW_METADATA_URL: process.env.GEO_STREET_VIEW_METADATA_URL || `http://localhost:${METADATA_PORT}/metadata`,
  // The meter exists to stop a real Google bill. There is no Google
  // here, so it should not be the thing that stops play.
  GEO_FREE_GOOGLE_ROUNDS: process.env.GEO_FREE_GOOGLE_ROUNDS || '10000',
  GEO_FREE_GOOGLE_ROUNDS_PER_IP: process.env.GEO_FREE_GOOGLE_ROUNDS_PER_IP || '10000',
  GEO_FREE_GOOGLE_ROOM_GAMES: process.env.GEO_FREE_GOOGLE_ROOM_GAMES || '1000',
  GEO_FREE_GOOGLE_ROOM_GAMES_PER_IP: process.env.GEO_FREE_GOOGLE_ROOM_GAMES_PER_IP || '1000',
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

run('metadata', process.execPath, [path.join(here, 'geo-e2e', 'mock-metadata.js')], {
  env: { ...env, PORT: String(METADATA_PORT) },
});

console.log(`
  WanderGuesser demo
  ------------------
  Play:        http://localhost:${PORT}/geo/script      <- start here, works with no keys
  Everything:  http://localhost:${PORT}/geo

  Works now:   Script mode, rooms, ratings, points, the shop, sign-in
               (sign-in links are printed in this log rather than emailed)
  Needs a key: Street View modes. Google's SDK draws the panorama, so no
               mock can stand in for it.
  Needs a token for this origin: Apple Look Around.

  Nothing is being stored. Without DATABASE_URL the game keeps everything
  in memory, so it is forgotten when you stop this AND when the dev
  server reloads after a file change. If a room disappears mid-game,
  that is why. Set DATABASE_URL to keep anything.
`);

run('next', process.platform === 'win32' ? 'npx.cmd' : 'npx', ['next', 'dev', '-p', String(PORT)]);
