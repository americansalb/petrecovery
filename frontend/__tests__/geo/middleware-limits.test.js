/**
 * What the game asks of middleware.js, which had no test of its own.
 *
 * Found in the deep audit: the rate-limit table, the CSP hosts and the
 * short paths all ride into middleware.js from app/lib/geo/site.js and
 * nothing checked any of it. The table is order-sensitive in two ways
 * that are easy to break and silent when broken, and a new /api/geo
 * route with no bucket falls to the default limit without anybody
 * noticing.
 */

const fs = require('fs');
const path = require('path');
const { GAME_RATE_LIMITS, GAME_CSP_HOSTS, GAME_SHORT_PATHS } = require('@/app/lib/geo/site');

const ROOT = path.resolve(__dirname, '../..');
const middleware = fs.readFileSync(path.join(ROOT, 'middleware.js'), 'utf8');

/** The table middleware builds, in its order. */
const TABLE = {
  '/api/auth/register': {},
  '/api/contact': {},
  '/api/geocode': { windowMs: 60000, maxRequests: 10 },
  ...GAME_RATE_LIMITS,
};

/** middleware.js's own matcher: first key the path starts with. */
const bucketFor = (pathname) => Object.keys(TABLE).find((key) => pathname.startsWith(key)) || 'default';

/** Every /api/geo/** route on disk, as a request path. */
function geoApiPaths() {
  const base = path.join(ROOT, 'app', 'api', 'geo');
  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}/${entry.name}`);
      else if (entry.name === 'route.js') out.push(prefix);
    }
  };
  walk(base, '/api/geo');
  return out;
}

describe('the game s rate limits reach middleware in one piece', () => {
  test('/api/geocode is a pet route that starts with /api/geo, and it keeps its own bucket', () => {
    // The trap this whole ordering exists for. A bare '/api/geo' key
    // anywhere in the game's table, or the spread moving above
    // /api/geocode, would swallow it.
    expect(bucketFor('/api/geocode')).toBe('/api/geocode');
    expect(Object.keys(GAME_RATE_LIMITS)).not.toContain('/api/geo');
    expect(middleware.indexOf("'/api/geocode'")).toBeLessThan(middleware.indexOf('...GAME_RATE_LIMITS'));
  });

  test('the strict mail bucket is not swallowed by the loose auth one', () => {
    expect(bucketFor('/api/geo/auth/request')).toBe('/api/geo/auth/request');
    expect(bucketFor('/api/geo/auth/delete')).toBe('/api/geo/auth/delete');
    expect(bucketFor('/api/geo/auth/verify')).toBe('/api/geo/auth/verify');
    expect(bucketFor('/api/geo/auth/me')).toBe('/api/geo/auth');
    expect(GAME_RATE_LIMITS['/api/geo/auth/request'].maxRequests).toBeLessThan(GAME_RATE_LIMITS['/api/geo/auth'].maxRequests);
  });

  test('every route the game serves has a bucket of its own', () => {
    const paths = geoApiPaths();
    expect(paths.length).toBeGreaterThan(10);
    const unlimited = paths.filter((p) => bucketFor(p) === 'default');
    expect(unlimited).toEqual([]);
  });

  test('a room poll gets the room bucket, a round the round bucket', () => {
    expect(bucketFor('/api/geo/rooms/ABC123')).toBe('/api/geo/rooms');
    expect(bucketFor('/api/geo/round')).toBe('/api/geo/round');
    expect(bucketFor('/api/geo/script/round')).toBe('/api/geo/script/round');
  });

  test('every limit is a real window and a real count', () => {
    for (const [key, limit] of Object.entries(GAME_RATE_LIMITS)) {
      expect(key.startsWith('/api/geo/')).toBe(true);
      expect(limit.windowMs).toBeGreaterThan(0);
      expect(limit.maxRequests).toBeGreaterThan(0);
    }
  });
});

describe('the map hosts and the short paths', () => {
  test('middleware spreads the game s CSP hosts rather than listing them', () => {
    expect(middleware).toContain('GAME_CSP_HOSTS');
    for (const directive of ['script', 'connect', 'frame']) {
      expect(GAME_CSP_HOSTS[directive].length).toBeGreaterThan(0);
      for (const host of GAME_CSP_HOSTS[directive]) expect(host.startsWith('https://')).toBe(true);
    }
  });

  test('every short path points at a route that exists', () => {
    for (const [from, to] of Object.entries(GAME_SHORT_PATHS)) {
      expect(from.startsWith('/')).toBe(true);
      const [routePath] = to.split('?');
      const dir = path.join(ROOT, 'app', routePath.replace(/^\//, ''));
      expect(fs.existsSync(path.join(dir, 'page.js'))).toBe(true);
    }
  });

  test('the short paths are only used on the game s own site', () => {
    // They must not shadow pet-site routes on reunitepets.org: /rooms
    // and /share are the game's, /daily is not a pet route at all.
    expect(middleware).toContain('GAME_SHORT_PATHS[pathname]');
    expect(middleware).toMatch(/gameSite[\s\S]{0,200}GAME_SHORT_PATHS/);
  });
});
