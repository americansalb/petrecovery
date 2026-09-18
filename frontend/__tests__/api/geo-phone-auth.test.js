const store = { getAccountById: jest.fn() };
jest.mock('@/app/lib/geo/server/roomStore', () => ({ prismaRoomStore: store }));
const requestPhone = jest.fn();
const verifyPhone = jest.fn();
jest.mock('@/app/lib/geo/server/phoneAuth', () => ({ requestPhoneSignIn: (...args) => requestPhone(...args), verifyPhoneSignIn: (...args) => verifyPhone(...args) }));
jest.mock('@/app/lib/geo/server/meterRequest', () => ({ subjectsFor: async () => ({ profileId: 'current-guest' }) }));
const limit = jest.fn(async () => ({ success: true }));
jest.mock('@/app/lib/geo/server/limiter', () => ({ withRateLimitAsync: (...args) => limit(...args), rateLimitResponse: () => new Response('{}', { status: 429 }) }));
const { POST: requestCode } = require('@/app/api/geo/auth/phone/request/route');
const { POST: verifyCode } = require('@/app/api/geo/auth/phone/verify/route');
const { GeoAuthError } = require('@/app/lib/geo/server/accounts');
const { accountFromRequest } = require('@/app/lib/geo/server/identity');
const savedSecret = process.env.GEO_TOKEN_SECRET;
beforeAll(() => { process.env.GEO_TOKEN_SECRET = 'phone-route-test-secret'; });
afterAll(() => { if (savedSecret === undefined) delete process.env.GEO_TOKEN_SECRET; else process.env.GEO_TOKEN_SECRET = savedSecret; });
beforeEach(() => { jest.clearAllMocks(); limit.mockResolvedValue({ success: true }); });
const request = (body) => ({ text: async () => JSON.stringify(body), headers: new Map() });

test('request binds the current guest, not a profile ID supplied in the body', async () => {
  requestPhone.mockResolvedValue({ challenge: 'sealed', expiresIn: 600 });
  const response = await requestCode(request({ phone: '+12025550123', profileId: 'someone-else' }));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(requestPhone).toHaveBeenCalledWith({ phone: '+12025550123', profileId: 'current-guest' });
});
test('successful verification sets a long-lived HTTP-only session without navigation', async () => {
  verifyPhone.mockResolvedValue({ account: { id: 'phone-owner', phone: '+12025550123' }, profile: { id: 'mine' } });
  const response = await verifyCode(request({ challenge: 'sealed', code: '123456', phone: '+12025550999' }));
  const cookies = response.headers.get('set-cookie');
  expect(response.status).toBe(200);
  expect(response.headers.get('location')).toBeNull();
  expect(cookies).toContain('HttpOnly');
  expect(cookies).toContain('Max-Age=7776000');
  const cookie = cookies.split(';')[0];
  expect(accountFromRequest({ headers: new Map([['cookie', cookie]]) }).accountId).toBe('phone-owner');
  expect(await response.json()).toMatchObject({ signedIn: true, account: { phone: '+12025550123' } });
  expect(verifyPhone).toHaveBeenCalledWith(store, { challenge: 'sealed', code: '123456' });
});
test('failed verification never issues a session', async () => {
  verifyPhone.mockRejectedValue(new GeoAuthError('bad_code', 'That code did not match.'));
  const response = await verifyCode(request({ challenge: 'sealed', code: '000000' }));
  expect(response.status).toBe(400);
  expect(response.headers.get('set-cookie')).toBeNull();
});
test('disabled SMS reports unavailable and no false success', async () => {
  requestPhone.mockRejectedValue(new GeoAuthError('phone_not_configured', 'Use email instead.'));
  const response = await requestCode(request({ phone: '+12025550123' }));
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ code: 'phone_not_configured' });
});
test('route limits refuse sending and verification before the provider', async () => {
  limit.mockResolvedValue({ success: false });
  expect((await requestCode(request({}))).status).toBe(429);
  expect((await verifyCode(request({}))).status).toBe(429);
  expect(requestPhone).not.toHaveBeenCalled();
  expect(verifyPhone).not.toHaveBeenCalled();
});
test('bad JSON and oversized bodies are rejected', async () => {
  for (const handler of [requestCode, verifyCode]) {
    expect((await handler({ ...request({}), text: async () => '{broken' })).status).toBe(400);
    expect((await handler({ ...request({}), text: async () => 'x'.repeat(8001) })).status).toBe(400);
  }
});
