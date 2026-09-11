/**
 * The game's own accounts (docs/GEO.md, "Signing in").
 *
 * A WanderGuesser account is an email address and nothing else, and it
 * is not a ReunitePets account: the two products do not share identity
 * (docs/WANDERGUESSER_SPLIT.md, D1, answered 2026-09-10).
 *
 * Most of what is pinned here is security rather than behaviour, and
 * each one is a way this could quietly be wrong:
 *
 * - the link is stored hashed, so reading the table is not enough to
 *   sign in as anyone;
 * - it expires, and it is burned on first use, so a forwarded mail or a
 *   double click cannot be a second sign-in;
 * - asking for a link answers identically whether or not the address
 *   has an account, so the endpoint cannot be used to enumerate people;
 * - the session cookie is sealed, so an edited one is nobody rather
 *   than somebody else.
 */

const {
  GeoAuthError,
  LINK_TTL_MS,
  hashLoginToken,
  looksLikeEmail,
  normalizeEmail,
  requestSignIn,
  verifySignIn,
} = require('@/app/lib/geo/server/accounts');
const { accountFromRequest, sealSession, readCookie, SESSION_COOKIE } = require('@/app/lib/geo/server/identity');
const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');
const { resolveProfile } = require('@/app/lib/geo/server/profiles');

const SECRET = 'a-long-enough-test-secret';
const env = { NEXTAUTH_SECRET: SECRET };
const T0 = Date.UTC(2026, 8, 10, 12, 0, 0);
const request = (cookie = '') => ({ headers: new Map(cookie ? [['cookie', cookie]] : []) });

/** Collects what would have been emailed instead of sending it. */
function mailbox() {
  const sent = [];
  return { sent, send: async (message) => sent.push(message) };
}

describe('asking for a link', () => {
  test('stores only a hash, and the link itself is what goes in the mail', async () => {
    const store = createMemoryRoomStore();
    const box = mailbox();
    const { url } = await requestSignIn(store, {
      email: 'Ada@Example.com ',
      baseUrl: 'https://example.test/',
      now: T0,
      sendImpl: box.send,
      env: { RESEND_API_KEY: 'k' },
    });

    const token = new URL(url).searchParams.get('token');
    expect(token).toBeTruthy();
    const row = await store.getLoginTokenByHash(hashLoginToken(token));
    expect(row).toBeTruthy();
    // The raw token is nowhere in the row. A dump of this table is not
    // a set of working sign-in links.
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.email).toBe('ada@example.com');
    expect(new Date(row.expiresAt).getTime()).toBe(T0 + LINK_TTL_MS);
    expect(box.sent).toHaveLength(1);
    expect(box.sent[0].to).toBe('ada@example.com');
    expect(box.sent[0].text).toContain(url);
  });

  test('addresses are normalised, so one person cannot end up with two accounts', () => {
    expect(normalizeEmail('  ADA@Example.COM ')).toBe('ada@example.com');
    expect(looksLikeEmail('ada@example.com')).toBe(true);
    for (const bad of ['', 'ada', 'ada@', '@example.com', 'ada example.com', `${'a'.repeat(300)}@b.com`]) {
      expect(looksLikeEmail(bad)).toBe(false);
    }
  });

  test('a bad address is refused before anything is written or sent', async () => {
    const store = createMemoryRoomStore();
    const box = mailbox();
    await expect(requestSignIn(store, { email: 'not-an-address', baseUrl: 'https://example.test', sendImpl: box.send })).rejects.toThrow(GeoAuthError);
    expect(box.sent).toHaveLength(0);
  });
});

describe('following a link', () => {
  const linkFor = async (store, email, now = T0) => {
    const { url } = await requestSignIn(store, { email, baseUrl: 'https://example.test', now, sendImpl: async () => {}, env: { RESEND_API_KEY: 'k' } });
    return new URL(url).searchParams.get('token');
  };

  test('creates the account, binds this browser profile to it, and works once', async () => {
    const store = createMemoryRoomStore();
    const anon = await resolveProfile(store, { name: 'Guest', now: T0 });
    const token = await linkFor(store, 'ada@example.com');

    const { account, profile } = await verifySignIn(store, { token, profileToken: anon.token, now: T0 + 1000 });
    expect(account.email).toBe('ada@example.com');
    expect(profile.id).toBe(anon.profile.id);
    expect(profile.accountId).toBe(account.id);

    // Burned. A forwarded mail, or a mail client that prefetches links,
    // cannot sign anyone in a second time.
    await expect(verifySignIn(store, { token, now: T0 + 2000 })).rejects.toMatchObject({ code: 'used' });
  });

  test('an expired link is refused', async () => {
    const store = createMemoryRoomStore();
    const token = await linkFor(store, 'ada@example.com');
    await expect(verifySignIn(store, { token, now: T0 + LINK_TTL_MS + 1 })).rejects.toMatchObject({ code: 'expired' });
  });

  test('a made-up link is refused, and says nothing about who has an account', async () => {
    const store = createMemoryRoomStore();
    await requestSignIn(store, { email: 'ada@example.com', baseUrl: 'https://example.test', now: T0, sendImpl: async () => {}, env: { RESEND_API_KEY: 'k' } });
    for (const bad of ['', 'nonsense', null, undefined]) {
      await expect(verifySignIn(store, { token: bad, now: T0 })).rejects.toMatchObject({ code: 'invalid' });
    }
  });

  test('signing in on a second device finds the same profile, not a new one', async () => {
    const store = createMemoryRoomStore();
    const anon = await resolveProfile(store, { name: 'Ada', now: T0 });
    await verifySignIn(store, { token: await linkFor(store, 'ada@example.com'), profileToken: anon.token, now: T0 + 1 });

    // A different browser: no play token at all, just the link.
    const second = await verifySignIn(store, { token: await linkFor(store, 'ada@example.com', T0 + 10), now: T0 + 20 });
    expect(second.profile.id).toBe(anon.profile.id);
    expect(second.account.email).toBe('ada@example.com');
  });

  test('two people signing in stay two people', async () => {
    const store = createMemoryRoomStore();
    const ada = await verifySignIn(store, { token: await linkFor(store, 'ada@example.com'), now: T0 + 1 });
    const grace = await verifySignIn(store, { token: await linkFor(store, 'grace@example.com', T0 + 5), now: T0 + 6 });
    expect(grace.account.id).not.toBe(ada.account.id);
    expect(grace.profile.id).not.toBe(ada.profile.id);
  });
});

describe('the session cookie', () => {
  test('reads back the account it was sealed with', () => {
    const sealed = sealSession({ accountId: 'acct_1', email: 'ada@example.com' }, { now: T0, env });
    const who = accountFromRequest(request(`${SESSION_COOKIE}=${encodeURIComponent(sealed)}`), { now: T0 + 1000, env });
    expect(who).toEqual({ accountId: 'acct_1', email: 'ada@example.com' });
  });

  test('a tampered, expired or missing cookie is nobody, not somebody else and not a crash', () => {
    const sealed = sealSession({ accountId: 'acct_1', email: 'ada@example.com' }, { now: T0, env });
    const nobody = { accountId: null, email: null };

    expect(accountFromRequest(request(), { now: T0, env })).toEqual(nobody);
    expect(accountFromRequest(request(`${SESSION_COOKIE}=garbage`), { now: T0, env })).toEqual(nobody);
    // One character changed in the sealed body: the tag will not verify.
    const edited = sealed.slice(0, -2) + (sealed.slice(-2) === 'AA' ? 'BB' : 'AA');
    expect(accountFromRequest(request(`${SESSION_COOKIE}=${encodeURIComponent(edited)}`), { now: T0, env })).toEqual(nobody);
    // Ninety days and a second later.
    expect(accountFromRequest(request(`${SESSION_COOKIE}=${encodeURIComponent(sealed)}`), { now: T0 + 91 * 24 * 3600 * 1000, env })).toEqual(nobody);
    // A server with no secret cannot be tricked into trusting one.
    expect(accountFromRequest(request(`${SESSION_COOKIE}=${encodeURIComponent(sealed)}`), { now: T0, env: {} })).toEqual(nobody);
  });

  test('a cookie sealed with another secret is not accepted', () => {
    const theirs = sealSession({ accountId: 'acct_1', email: 'ada@example.com' }, { now: T0, env: { NEXTAUTH_SECRET: 'a-different-long-secret' } });
    expect(accountFromRequest(request(`${SESSION_COOKIE}=${encodeURIComponent(theirs)}`), { now: T0, env })).toEqual({ accountId: null, email: null });
  });

  test('the cookie is found among others, and a lookalike name is not mistaken for it', () => {
    const sealed = sealSession({ accountId: 'acct_2', email: 'x@y.zz' }, { now: T0, env });
    const header = `theme=dark; ${SESSION_COOKIE}_other=nope; ${SESSION_COOKIE}=${encodeURIComponent(sealed)}; last=1`;
    expect(accountFromRequest(request(header), { now: T0, env }).accountId).toBe('acct_2');
    expect(readCookie(request(header), 'theme')).toBe('dark');
    expect(readCookie(request(header), 'absent')).toBe('');
  });
});
