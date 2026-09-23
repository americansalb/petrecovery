/** @jest-environment jsdom */
/**
 * A minted MapKit token lasts an hour, and MapKit asks for a new one
 * through the authorization callback when it runs out. The page used to
 * ask the server once and keep that answer for good, so an hour into one
 * tab MapKit was handed the token that had just expired, Apple refused
 * it, and Street stopped with "Apple refused this site's MapKit token".
 */

let mintedToken;
let TOKEN_REFRESH_MARGIN_MS;
let served;

beforeEach(() => {
  jest.resetModules();
  ({ mintedToken, TOKEN_REFRESH_MARGIN_MS } = require('@/app/geo/lib/appleMapKit'));
  served = 0;
  global.fetch = jest.fn(async () => {
    served += 1;
    return { ok: true, json: async () => ({ token: `token-${served}`, expiresAt: Date.now() + 60 * 60 * 1000 }) };
  });
});

test('a token is reused while it has time left, and asked for again before it runs out', async () => {
  const start = Date.now();
  expect(await mintedToken(start)).toBe('token-1');
  expect(await mintedToken(start + 10 * 60 * 1000)).toBe('token-1');
  expect(fetch).toHaveBeenCalledTimes(1);
  // Fifty-six minutes in, inside the refresh margin: a new one.
  expect(await mintedToken(start + 60 * 60 * 1000 - TOKEN_REFRESH_MARGIN_MS + 1000)).toBe('token-2');
  expect(fetch).toHaveBeenCalledTimes(2);
  // Around the browser's cache on the second ask, which could hold the old one.
  expect(fetch.mock.calls[1][1]).toEqual({ cache: 'no-store' });
});

test('asks that arrive together share one request', async () => {
  const [a, b] = await Promise.all([mintedToken(), mintedToken()]);
  expect([a, b]).toEqual(['token-1', 'token-1']);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('a failed request is tried again on the next ask', async () => {
  global.fetch = jest.fn()
    .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'late', expiresAt: Date.now() + 3600000 }) });
  expect(await mintedToken()).toBe('');
  expect(await mintedToken()).toBe('late');
});

test('no signing key is a final answer: the built-in token is used and nobody asks again', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ token: '', reason: 'no signing key' }) }));
  const info = jest.spyOn(console, 'info').mockImplementation(() => {});
  expect(await mintedToken()).toBe('');
  expect(await mintedToken(Date.now() + 5 * 60 * 60 * 1000)).toBe('');
  expect(fetch).toHaveBeenCalledTimes(1);
  info.mockRestore();
});
