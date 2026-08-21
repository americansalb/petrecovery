/**
 * The notification prompt stays off the screens where someone is busy.
 *
 * It used to exclude /login and /register and fire everywhere else, three
 * seconds after any authenticated page load, rendered fixed to the bottom
 * of the viewport. On a 390px phone that covered the tab bar and landed on
 * top of step one of the lost-pet report wizard, on Mission Control while
 * a search was running, and on the message composer.
 *
 * Asking someone whose dog is missing to consider notification permissions,
 * over the form they are filling in, is both the wrong moment and a bad
 * answer for us: they dismiss it, and the dismissal sticks for a week.
 *
 * The rule is an allowlist, so a route added later is quiet until someone
 * decides otherwise. This test pins that, and pins the bottom offset that
 * keeps the banner clear of the mobile tab bar.
 */

const fs = require('fs');
const path = require('path');

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'app', 'components', 'PushNotificationProvider.js'),
  'utf8'
);

function promptableRoutes() {
  const match = SOURCE.match(/const PROMPTABLE_ROUTES = \[([^\]]*)\]/);
  if (!match) throw new Error('PROMPTABLE_ROUTES not found');
  return match[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

describe('push prompt route policy', () => {
  const routes = promptableRoutes();

  it('is an allowlist, not a blocklist', () => {
    // A blocklist means every route added later is loud by default, which
    // is how this reached the report wizard in the first place.
    expect(SOURCE).toMatch(/PROMPTABLE_ROUTES\.some/);
    expect(routes.length).toBeGreaterThan(0);
  });

  it.each([
    ['/report/new', 'someone is filing a lost-pet report'],
    ['/mission-control', 'a search is being run'],
    ['/join/abc123', 'a volunteer is joining a search'],
    ['/messages/abc', 'someone is writing a message'],
    ['/sightings/report', 'someone is reporting a sighting'],
    ['/admin', 'hands full'],
    ['/login', 'not signed in yet'],
  ])('stays quiet on %s (%s)', (route) => {
    const allowed = routes.some((r) => route === r || route.startsWith(`${r}/`));
    expect(allowed).toBe(false);
  });

  it.each(['/dashboard', '/pets', '/settings'])('may prompt on %s', (route) => {
    const allowed = routes.some((r) => route === r || route.startsWith(`${r}/`));
    expect(allowed).toBe(true);
  });

  it('sits above the mobile tab bar', () => {
    // bottom-4 put it underneath the fixed tab bar on a phone.
    expect(SOURCE).toMatch(/fixed bottom-20 md:bottom-4/);
  });
});

describe('/admin/auto-migrate does not run DDL on navigation', () => {
  const MIGRATE = fs.readFileSync(
    path.join(__dirname, '..', '..', 'app', 'admin', 'auto-migrate', 'page.js'),
    'utf8'
  );

  it('never calls runMigration from an effect', () => {
    // It used to run raw DDL against the live database as soon as a
    // session resolved, so browser-back onto the URL was enough to fire
    // it. Every statement is additive today; one careless edit is not.
    const effects = MIGRATE.match(/useEffect\([\s\S]*?\}, \[[^\]]*\]\);/g) || [];
    for (const effect of effects) {
      expect(effect).not.toMatch(/runMigration\(\)/);
    }
  });

  it('exposes a button instead', () => {
    expect(MIGRATE).toMatch(/onClick=\{runMigration\}/);
  });
});
