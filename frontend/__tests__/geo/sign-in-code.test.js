/**
 * Signing in with the code from the email.
 *
 * Founder, 2026-09-23, looking at the sign-in page: "Very unclear. Why
 * not just have normal sign in process?" The normal process is an
 * address, then a code typed into the same page. The link alone was
 * not that: opened from a mail app on a phone it usually lands in the
 * mail app's own browser, which signed THAT browser in and left the
 * game's tab exactly as it was. To the player the game had forgotten
 * them, or made them a new player.
 *
 * What is pinned here is what could quietly be wrong about a code:
 * it is stored keyed and hashed; only the newest email's code counts;
 * five wrong guesses kill it; it expires with the link and is burned on
 * use; and it binds the same account and profile the link would.
 */

const {
  CODE_ATTEMPTS,
  GeoAuthError,
  LINK_TTL_MS,
  hashLoginCode,
  requestSignIn,
  verifySignIn,
  verifySignInCode,
} = require('@/app/lib/geo/server/accounts');
const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');
const { resolveProfile } = require('@/app/lib/geo/server/profiles');

const SECRET = 'a-long-enough-test-secret';
const T0 = Date.UTC(2026, 8, 23, 12, 0, 0);

function mailbox() {
  const sent = [];
  return { sent, send: async (message) => sent.push(message) };
}

async function ask(store, email, { now = T0, profileId = null, box = mailbox() } = {}) {
  const result = await requestSignIn(store, { email, profileId, baseUrl: 'https://example.test', now, sendImpl: box.send, env: { RESEND_API_KEY: 'k' }, secret: SECRET });
  return { ...result, box };
}

const wrong = (code) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

async function failure(promise) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected a refusal');
}

describe('the email', () => {
  test('carries a six-digit code, in the subject, the text and the page, beside the link', async () => {
    const store = createMemoryRoomStore();
    const { code, url, box } = await ask(store, 'ada@example.com');
    expect(code).toMatch(/^\d{6}$/);
    const [mail] = box.sent;
    expect(mail.subject).toContain(code);
    expect(mail.text).toContain(code);
    expect(mail.text).toContain(url);
    expect(mail.html).toContain(code);
  });

  test('the table keeps a keyed hash of the code, never the code', async () => {
    const store = createMemoryRoomStore();
    const { code } = await ask(store, 'ada@example.com');
    const row = await store.getLatestLoginTokenForEmail('ada@example.com');
    expect(row.codeHash).toBe(hashLoginCode('ada@example.com', code, SECRET));
    expect(JSON.stringify(row)).not.toContain(`"${code}"`);
    // Keyed: the same code under another secret is another hash, so a
    // copy of the table cannot be searched for it offline.
    expect(hashLoginCode('ada@example.com', code, 'another-secret')).not.toBe(row.codeHash);
  });
});

describe('typing the code', () => {
  test('the right code signs in, as the account and the profile the link would have', async () => {
    const store = createMemoryRoomStore();
    const guest = await resolveProfile(store, { name: 'Ada', now: T0 });
    const { code } = await ask(store, 'Ada@Example.com', { profileId: guest.profile.id });
    const { account, profile } = await verifySignInCode(store, { email: ' ADA@example.com', code, now: T0 + 1000, secret: SECRET });
    expect(account.email).toBe('ada@example.com');
    // The browser's own profile is carried into the account, rating and all.
    expect(profile.id).toBe(guest.profile.id);
    expect(profile.accountId).toBe(account.id);
  });

  test('spaces or dashes a phone keyboard adds are not a wrong code', async () => {
    const store = createMemoryRoomStore();
    const { code } = await ask(store, 'ada@example.com');
    const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
    await expect(verifySignInCode(store, { email: 'ada@example.com', code: spaced, now: T0 + 1000, secret: SECRET })).resolves.toHaveProperty('account');
  });

  test('a code works once', async () => {
    const store = createMemoryRoomStore();
    const { code } = await ask(store, 'ada@example.com');
    await verifySignInCode(store, { email: 'ada@example.com', code, now: T0 + 1000, secret: SECRET });
    const error = await failure(verifySignInCode(store, { email: 'ada@example.com', code, now: T0 + 2000, secret: SECRET }));
    expect(error).toBeInstanceOf(GeoAuthError);
    expect(error.code).toBe('used');
  });

  test('and not after fifteen minutes', async () => {
    const store = createMemoryRoomStore();
    const { code } = await ask(store, 'ada@example.com');
    const error = await failure(verifySignInCode(store, { email: 'ada@example.com', code, now: T0 + LINK_TTL_MS + 1, secret: SECRET }));
    expect(error.code).toBe('expired');
  });

  test('only the newest email counts', async () => {
    const store = createMemoryRoomStore();
    const first = await ask(store, 'ada@example.com', { now: T0 });
    const second = await ask(store, 'ada@example.com', { now: T0 + 60_000 });
    if (first.code !== second.code) {
      const error = await failure(verifySignInCode(store, { email: 'ada@example.com', code: first.code, now: T0 + 61_000, secret: SECRET }));
      expect(error.code).toBe('bad_code');
    }
    await expect(verifySignInCode(store, { email: 'ada@example.com', code: second.code, now: T0 + 62_000, secret: SECRET })).resolves.toHaveProperty('account');
  });

  test(`${CODE_ATTEMPTS} wrong codes kill it, even for somebody who then types the right one`, async () => {
    const store = createMemoryRoomStore();
    const { code } = await ask(store, 'ada@example.com');
    for (let i = 1; i < CODE_ATTEMPTS; i++) {
      const error = await failure(verifySignInCode(store, { email: 'ada@example.com', code: wrong(code), now: T0 + i, secret: SECRET }));
      expect(error.code).toBe('bad_code');
    }
    const last = await failure(verifySignInCode(store, { email: 'ada@example.com', code: wrong(code), now: T0 + 99, secret: SECRET }));
    expect(last.code).toBe('too_many');
    const after = await failure(verifySignInCode(store, { email: 'ada@example.com', code, now: T0 + 100, secret: SECRET }));
    expect(['too_many', 'used']).toContain(after.code);
  });

  test('a code for one address is nothing for another', async () => {
    const store = createMemoryRoomStore();
    const { code } = await ask(store, 'ada@example.com');
    await ask(store, 'grace@example.com');
    const error = await failure(verifySignInCode(store, { email: 'grace@example.com', code, now: T0 + 1000, secret: SECRET }));
    expect(error.code).toBe('bad_code');
  });

  test('an address nobody asked for says the same as a wrong code', async () => {
    const store = createMemoryRoomStore();
    const error = await failure(verifySignInCode(store, { email: 'nobody@example.com', code: '123456', now: T0, secret: SECRET }));
    expect(error.code).toBe('bad_code');
  });

  test('the link in the same email still works, and then the code does not', async () => {
    const store = createMemoryRoomStore();
    const { code, url } = await ask(store, 'ada@example.com');
    const token = new URL(url).searchParams.get('token');
    await verifySignIn(store, { token, now: T0 + 1000 });
    const error = await failure(verifySignInCode(store, { email: 'ada@example.com', code, now: T0 + 2000, secret: SECRET }));
    expect(error.code).toBe('used');
  });
});
