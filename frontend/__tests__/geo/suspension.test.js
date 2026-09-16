/**
 * Suspension has to stop the person playing, not just signing in.
 *
 * As shipped, `suspendedAt` did exactly one thing: refuse a NEW
 * sign-in. Sessions last ninety days (SESSION_TTL_MS), so anybody
 * already signed in when an admin suspended them carried on: playing,
 * scoring, earning points and badges, and holding their place on the
 * boards. The admin screen said suspended and nothing in the game
 * agreed.
 *
 * That is the worst shape a moderation control can have, because it
 * looks like it worked. An operator suspends somebody, watches the row
 * turn, and assumes it is done.
 *
 * Play hangs off the PROFILE rather than the session, so the refusal
 * belongs in resolveProfile, which is what every rated surface goes
 * through. Refusing there removes the rating, the points, the badges
 * and the boards in one move, and leaves the person able to play as a
 * guest, which is the intent: this suspends an account, not a human.
 */

const fs = require('fs');
const path = require('path');
const { resolveProfile, GeoSuspended } = require('@/app/lib/geo/server/profiles');

const ROOT = path.resolve(__dirname, '../..');

/** The smallest store resolveProfile needs, with one account in it. */
function storeWith(account) {
  return {
    getAccountById: async (id) => (account && account.id === id ? account : null),
    getProfileByAccountId: async () => ({ id: 'prof_1', accountId: account?.id, name: 'Ada', tokenHash: 'h' }),
    getProfileByTokenHash: async () => null,
    createProfile: async (data) => ({ id: 'prof_new', ...data }),
    updateProfile: async (id, patch) => ({ id, accountId: account?.id, name: 'Ada', ...patch }),
  };
}

describe('a suspended account cannot play', () => {
  test('resolveProfile refuses it', async () => {
    const store = storeWith({ id: 'acc_1', email: 'a@example.com', suspendedAt: new Date() });
    await expect(resolveProfile(store, { accountId: 'acc_1' })).rejects.toBeInstanceOf(GeoSuspended);
  });

  test('and refuses before it touches a single row', async () => {
    // Not even lastSeenAt. A suspended account leaves no trace of
    // having tried.
    const touched = [];
    const store = storeWith({ id: 'acc_1', suspendedAt: new Date() });
    for (const method of ['getProfileByAccountId', 'getProfileByTokenHash', 'createProfile', 'updateProfile']) {
      const original = store[method];
      store[method] = async (...args) => {
        touched.push(method);
        return original(...args);
      };
    }
    await expect(resolveProfile(store, { accountId: 'acc_1' })).rejects.toBeInstanceOf(GeoSuspended);
    expect(touched).toEqual([]);
  });

  test('an ordinary account is untouched', async () => {
    const store = storeWith({ id: 'acc_1', email: 'a@example.com', suspendedAt: null });
    const { profile } = await resolveProfile(store, { accountId: 'acc_1' });
    expect(profile.id).toBe('prof_1');
  });

  test('a guest is untouched, because this suspends an account not a person', async () => {
    const store = storeWith(null);
    store.getProfileByAccountId = async () => null;
    store.getProfileByTokenHash = async () => null;
    const { profile } = await resolveProfile(store, { name: 'Guest' });
    expect(profile.id).toBe('prof_new');
  });

  test('a store with no account lookup still works', async () => {
    // The in-memory store used by the demo and some tests.
    const store = storeWith({ id: 'acc_1' });
    delete store.getAccountById;
    await expect(resolveProfile(store, { accountId: 'acc_1' })).resolves.toBeTruthy();
  });
});

describe('the refusal reaches the player as a refusal', () => {
  const route = fs.readFileSync(path.join(ROOT, 'app/api/geo/profile/route.js'), 'utf8');

  test('403 with a reason, not a 500 that reads as our fault', () => {
    expect(route).toContain('GeoSuspended');
    expect(route).toContain("code: 'suspended'");
    expect(route).toContain('status: 403');
  });
});

describe('sign-in stays closed too', () => {
  const accounts = fs.readFileSync(path.join(ROOT, 'app/lib/geo/server/accounts.js'), 'utf8');

  test('a suspended account gets no new session', () => {
    expect(accounts).toContain('account.suspendedAt');
    expect(accounts).toMatch(/GeoAuthError\('suspended'/);
  });
});
