/**
 * The sign-in routes on the in-memory store.
 *
 * Found in the deep audit: /api/geo/auth/me, /request, /verify and
 * /signout had zero coverage, and the one thing the unit tests did
 * assert - that signing in keeps the browser's profile - was exercised
 * through an argument the verify route cannot supply. A mail link is a
 * plain navigation: no localStorage, no headers. So the promise that
 * held in the unit test was false in production, and every first
 * sign-in orphaned the player's rating, points and badges for good.
 *
 * These drive the real route handlers.
 */

const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');

const memoryStore = createMemoryRoomStore();
jest.mock('@/app/lib/geo/server/roomStore', () => ({ prismaRoomStore: memoryStore }));

const SECRET = 'a-long-enough-test-secret-for-auth';
const savedSecret = process.env.GEO_TOKEN_SECRET;
const savedResend = process.env.RESEND_API_KEY;
process.env.GEO_TOKEN_SECRET = SECRET;

const { GET: getMe } = require('@/app/api/geo/auth/me/route');
const { POST: postRequest } = require('@/app/api/geo/auth/request/route');
const { GET: getVerify } = require('@/app/api/geo/auth/verify/route');
const { POST: postSignOut } = require('@/app/api/geo/auth/signout/route');
const { POST: postDelete } = require('@/app/api/geo/auth/delete/route');
const { POST: postProfile } = require('@/app/api/geo/profile/route');
const { SESSION_COOKIE } = require('@/app/lib/geo/server/identity');

afterAll(() => {
  if (savedSecret === undefined) delete process.env.GEO_TOKEN_SECRET;
  else process.env.GEO_TOKEN_SECRET = savedSecret;
  if (savedResend === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = savedResend;
});

function request(body, headers = {}, url = 'http://localhost/api/geo/auth/x') {
  return { json: async () => body, headers: new Map(Object.entries(headers)), url };
}

/** The sign-in link this run wrote to the log, by address. */
function linkFromLog(spy, email) {
  const line = spy.mock.calls.map((c) => c.join(' ')).find((c) => c.includes(email));
  return line ? line.slice(line.indexOf('http')).trim() : '';
}

/** The Set-Cookie value a route handed back, as a request header. */
function cookieFrom(response) {
  const raw = response.headers.get('set-cookie') || '';
  const session = raw.split(/,(?=\s*\w+=)/).find((part) => part.trim().startsWith(`${SESSION_COOKIE}=`)) || '';
  return session.split(';')[0].trim();
}

describe('the sign-in routes', () => {
  test('me says nobody when there is no cookie', async () => {
    const body = await (await getMe(request(null))).json();
    expect(body).toMatchObject({ signedIn: false, email: null });
  });

  test('a link binds the browser profile, signs in, and signs out again', async () => {
    delete process.env.RESEND_API_KEY;
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

    // The browser registers a play profile first, as the play page does.
    const registered = await (await postProfile(request({ name: 'Ada' }, { 'x-test-ip': '198.51.100.70' }))).json();
    const mine = { 'x-geo-profile': registered.token };

    const asked = await postRequest(request({ email: 'ada@example.com' }, mine));
    expect(asked.status).toBe(200);
    expect((await asked.json()).code).toBe('logged_not_sent');
    const url = linkFromLog(spy, 'ada@example.com');
    spy.mockRestore();
    expect(url).toContain('/api/geo/auth/verify?token=');

    // Following it is a plain navigation: no headers at all.
    const done = await getVerify({ url, headers: new Map() });
    expect(done.status).toBe(307);
    expect(done.headers.get('location')).toContain('/geo/me?signed-in=1');
    const cookie = cookieFrom(done);
    expect(cookie).toContain(SESSION_COOKIE);

    const me = await (await getMe(request(null, { cookie }))).json();
    expect(me).toMatchObject({ signedIn: true, email: 'ada@example.com' });

    // The profile the browser was already playing as is the one bound.
    const after = await (await postProfile(request({}, { ...mine, cookie }))).json();
    expect(after.profile.id).toBe(registered.profile.id);

    const out = await postSignOut();
    expect((await out.json()).ok).toBe(true);
    expect(out.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=`);
  });

  test('a spent link is refused, and says which way it failed', async () => {
    delete process.env.RESEND_API_KEY;
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await postRequest(request({ email: 'grace@example.com' }));
    const url = linkFromLog(spy, 'grace@example.com');
    spy.mockRestore();

    await getVerify({ url, headers: new Map() });
    const again = await getVerify({ url, headers: new Map() });
    expect(again.headers.get('location')).toContain('sign-in-failed=that-link-was-already-used');

    const madeUp = await getVerify({ url: 'http://localhost/api/geo/auth/verify?token=nope', headers: new Map() });
    expect(madeUp.headers.get('location')).toContain('sign-in-failed=that-link-is-not-valid');
  });

  test('a bad address is refused before anything is written', async () => {
    const res = await postRequest(request({ email: 'not-an-address' }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('bad_email');
  });

  test('the answer does not say whether an address has an account', async () => {
    // This endpoint must not be usable to find out who has one.
    delete process.env.RESEND_API_KEY;
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const known = await postRequest(request({ email: 'ada@example.com' }));
    const unknown = await postRequest(request({ email: 'nobody@example.com' }));
    spy.mockRestore();
    expect(known.status).toBe(unknown.status);
    expect(await known.json()).toEqual(await unknown.json());
  });

  test('deleting needs a session, and takes the account with it', async () => {
    delete process.env.RESEND_API_KEY;
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    await postRequest(request({ email: 'linus@example.com' }));
    const url = linkFromLog(spy, 'linus@example.com');
    spy.mockRestore();
    const done = await getVerify({ url, headers: new Map() });
    const cookie = cookieFrom(done);

    expect((await postDelete(request(null))).status).toBe(401);

    const removed = await postDelete(request(null, { cookie }));
    expect(removed.status).toBe(200);
    expect(await memoryStore.getAccountByEmail('linus@example.com')).toBeFalsy();
    const me = await (await getMe(request(null, { cookie: cookieFrom(removed) }))).json();
    expect(me.signedIn).toBe(false);
  });
});
