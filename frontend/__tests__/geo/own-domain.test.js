/**
 * probablyearth.com is the game's address, and it has to behave like one.
 *
 * The game lives under /geo on the pet site, which is fine while it is a
 * section of that site and wrong once it has a name of its own: nobody
 * types probablyearth.com/geo/play. The middleware turns the short paths
 * into the real ones on the game's hosts.
 *
 * The domain is built in rather than read from GEO_DOMAINS, because a
 * domain that needs an environment variable set before it works is a
 * domain that is broken on the day it is pointed, and the person
 * pointing it has no way to tell.
 */

const fs = require('fs');
const path = require('path');
const { GAME_HOSTNAMES, GAME_SHORT_PATHS, isGameHost } = require('@/app/lib/geo/site');

const middleware = fs.readFileSync(path.resolve(__dirname, '../../middleware.js'), 'utf8');

describe('the game answers on its own domain', () => {
  test('probablyearth.com is built in, not configured', () => {
    // One list (app/lib/geo/site.js), asked by the middleware, robots.txt
    // and the sitemap alike, so they cannot disagree about which host is
    // the game's.
    expect(GAME_HOSTNAMES).toEqual(expect.arrayContaining(['probablyearth.com', 'www.probablyearth.com']));
    expect(isGameHost('probablyearth.com', '')).toBe(true);
    expect(middleware).toContain('isGameHost(host)');
    // And more can still be added without a deploy.
    expect(isGameHost('staging.example', 'staging.example')).toBe(true);
    expect(isGameHost('staging.example', '')).toBe(false);
  });

  test('the short paths cover everything a player would type', () => {
    // These are the addresses that go on a card, in a message, or in
    // somebody's head. Each one has to land somewhere real.
    for (const short of ['/', '/play', '/rooms', '/script', '/leaderboard', '/daily']) {
      expect({ short, to: GAME_SHORT_PATHS[short] }).toEqual({ short, to: expect.stringMatching(/^\/geo/) });
    }
  });

  test('a room code is a path of its own, because it is what gets shared', () => {
    // Not in the table: it carries a code, so the middleware rewrites
    // the prefix instead of looking it up.
    expect(middleware).toContain("pathname.startsWith('/room/')");
  });

  test('the game keeps its own assets and API, and everything else leaves', () => {
    const block = middleware.slice(middleware.indexOf('const isGame ='), middleware.indexOf('const isGame =') + 600);
    for (const kept of ['/geo', '/api/geo', '/api/auth', '/_next']) {
      expect({ kept, held: block.includes(`'${kept}'`) }).toEqual({ kept, held: true });
    }
  });
});
