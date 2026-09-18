/**
 * Accounts have three independent layers, and each one has to hold on
 * its own (founder direction, 2026-09-16):
 *
 *   guest or signed in   what survives a new device
 *   role                 what the account may DO
 *   tier                 what the account has PAID for
 *
 * The failures worth guarding against are the ones where two of those
 * leak into each other: a supporter who can suddenly moderate, an admin
 * who loses the screen when their card expires, a suspended account
 * that still holds its powers, and a lapsed tier that keeps working
 * because nothing has swept the table yet.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

describe('roles and tiers', () => {
  const load = (env = {}) => {
    const saved = process.env.GEO_ADMIN_EMAILS;
    if ('GEO_ADMIN_EMAILS' in env) process.env.GEO_ADMIN_EMAILS = env.GEO_ADMIN_EMAILS;
    let mod;
    jest.isolateModules(() => {
      mod = require('@/app/lib/geo/server/roles');
    });
    if ('GEO_ADMIN_EMAILS' in env) {
      if (saved === undefined) delete process.env.GEO_ADMIN_EMAILS;
      else process.env.GEO_ADMIN_EMAILS = saved;
    }
    return mod;
  };

  test('a new account is an ordinary player on the free tier', () => {
    const { roleOf, tierOf, can, isAdmin } = load();
    const account = { email: 'someone@example.com', role: 'player', tier: 'free' };
    expect({ role: roleOf(account), tier: tierOf(account) }).toEqual({ role: 'player', tier: 'free' });
    expect(can(account, 'play')).toBe(true);
    expect(can(account, 'host_rooms')).toBe(false);
    expect(isAdmin(account)).toBe(false);
  });

  test('paying does not grant power, and power does not require paying', () => {
    const { can, isAdmin } = load();
    const supporter = { email: 'a@example.com', role: 'player', tier: 'supporter' };
    const freeAdmin = { email: 'b@example.com', role: 'admin', tier: 'free' };
    // The whole point of keeping the two apart.
    expect(isAdmin(supporter)).toBe(false);
    expect(can(supporter, 'host_rooms')).toBe(false);
    expect(isAdmin(freeAdmin)).toBe(true);
    expect(can(freeAdmin, 'admin_write')).toBe(true);
  });

  test('a supporter whose tier has lapsed is free again, with nothing having to run', () => {
    const { tierOf, benefitsOf } = load();
    const lapsed = { email: 'a@example.com', tier: 'supporter', tierUntil: '2020-01-01T00:00:00.000Z' };
    const current = { email: 'b@example.com', tier: 'supporter', tierUntil: '2999-01-01T00:00:00.000Z' };
    const endless = { email: 'c@example.com', tier: 'supporter', tierUntil: null };
    expect(tierOf(lapsed)).toBe('free');
    expect(tierOf(current)).toBe('supporter');
    expect(tierOf(endless)).toBe('supporter');
    expect(benefitsOf(lapsed).googleRoundsMultiplier).toBe(1);
    expect(benefitsOf(current).privateRooms).toBe(true);
  });

  test('a suspended account can do nothing, whatever its role says', () => {
    const { can, isAdmin, isSuspended } = load();
    const account = { email: 'a@example.com', role: 'admin', tier: 'supporter', suspendedAt: new Date() };
    expect(isSuspended(account)).toBe(true);
    expect(isAdmin(account)).toBe(false);
    for (const capability of ['play', 'host_rooms', 'admin_read', 'admin_write']) {
      expect({ capability, allowed: can(account, capability) }).toEqual({ capability, allowed: false });
    }
  });

  test('the first admin comes from the environment, and leaving it removes the access', () => {
    // The bootstrap problem: only an admin can promote an admin.
    const withVar = load({ GEO_ADMIN_EMAILS: 'boss@example.com, other@example.com' });
    expect(withVar.roleOf({ email: 'BOSS@example.com', role: 'player' })).toBe('admin');
    expect(withVar.roleOf({ email: 'someone@example.com', role: 'player' })).toBe('player');
    const without = load({ GEO_ADMIN_EMAILS: '' });
    // Read live rather than copied into the row, so removing the
    // address removes the access instead of leaving a promotion behind.
    expect(without.roleOf({ email: 'boss@example.com', role: 'player' })).toBe('player');
  });

  test('an unknown role or tier falls back rather than throwing or passing', () => {
    const { roleOf, tierOf } = load();
    expect(roleOf({ email: 'a@example.com', role: 'superuser' })).toBe('player');
    expect(tierOf({ email: 'a@example.com', tier: 'platinum' })).toBe('free');
  });

  test('what the browser is told about itself carries no secrets', () => {
    const { accountView } = load();
    const view = accountView({ id: 'acc_1', email: 'a@example.com', role: 'admin', tier: 'supporter', tierUntil: null });
    expect(Object.keys(view).sort()).toEqual(['benefits', 'email', 'phone', 'role', 'suspended', 'tier', 'tierUntil']);
    expect(JSON.stringify(view)).not.toMatch(/acc_1|tokenHash|secret/i);
  });
});

describe('the admin backend is closed by default', () => {
  const admin = fs.readFileSync(path.join(ROOT, 'app/lib/geo/server/admin.js'), 'utf8');
  const routes = ['overview', 'accounts', 'rooms'].map((name) => ({
    name,
    source: fs.readFileSync(path.join(ROOT, `app/api/geo/admin/${name}/route.js`), 'utf8'),
  }));

  test('every admin route calls the guard before it reads anything', () => {
    for (const route of routes) {
      expect({ route: route.name, guarded: route.source.includes('requireAdmin(request)') }).toEqual({ route: route.name, guarded: true });
      // And the guard runs first: no data call above it.
      const guard = route.source.indexOf('requireAdmin(request)');
      const read = route.source.search(/await (siteOverview|listAccounts|listRooms|updateAccount)\(/);
      expect({ route: route.name, guardFirst: read === -1 || guard < read }).toEqual({ route: route.name, guardFirst: true });
    }
  });

  test('the guard asks the database, not the cookie, what the role is', () => {
    // A role sealed into a session is a role somebody keeps after it is
    // revoked, so the row is read on every request.
    expect(admin).toContain('prisma.geoAccount.findUnique');
    expect(admin).toContain('isAdmin(account)');
    expect(admin).toContain("throw new AdminDenied('not_admin')");
  });

  test('a suspended admin is refused before the role is even considered', () => {
    const suspended = admin.indexOf('isSuspended(account)');
    const role = admin.indexOf('isAdmin(account)');
    expect(suspended).toBeGreaterThan(-1);
    expect(suspended).toBeLessThan(role);
  });

  test('an admin cannot suspend themselves out of their own backend', () => {
    expect(admin).toContain('cannot_suspend_self');
  });

  test('the reads name their columns rather than returning whole rows', () => {
    // An admin screen that dumps tables is a leak waiting for one
    // stolen laptop.
    expect(admin).toContain('select: {');
    expect(admin).not.toMatch(/tokenHash:\s*true/);
    expect(admin).not.toContain('sealSession');
  });

  test('sign-in refuses a suspended account', () => {
    const accounts = fs.readFileSync(path.join(ROOT, 'app/lib/geo/server/accounts.js'), 'utf8');
    expect(accounts).toContain('account.suspendedAt');
    expect(accounts).toMatch(/GeoAuthError\('suspended'/);
  });
});
