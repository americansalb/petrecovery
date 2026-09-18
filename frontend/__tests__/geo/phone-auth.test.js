const { requestPhoneSignIn, verifyPhoneSignIn, normalizePhone, phoneSignInConfigured } = require('@/app/lib/geo/server/phoneAuth');
const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');
const { resolveProfile } = require('@/app/lib/geo/server/profiles');
const { openToken, sealToken } = require('@/app/lib/geo/server/tokens');
const { accountFromRequest, sealSession, SESSION_TTL_MS } = require('@/app/lib/geo/server/identity');

const env = { GEO_PHONE_SIGNIN_ENABLED: 'true', TWILIO_ACCOUNT_SID: 'test-account', TWILIO_AUTH_TOKEN: 'test-token', GEO_TWILIO_VERIFY_SERVICE_SID: 'test-service', GEO_TOKEN_SECRET: 'phone-auth-test-secret' };
const now = Date.UTC(2026, 8, 17);
const phone = '+12025550123';
const sid = `VE${'a'.repeat(32)}`;
const limitImpl = async () => ({ success: true });
function fixture() {
  let used = false;
  return {
    verifications: { create: jest.fn(async () => ({ sid, status: 'pending' })) },
    verificationChecks: { create: jest.fn(async ({ code }) => {
      if (used) throw new Error('consumed');
      if (code !== '123456') return { status: 'pending', to: phone };
      used = true;
      return { status: 'approved', to: phone };
    }) },
  };
}
const requestCode = (service, extra = {}) => requestPhoneSignIn({ phone, env, service, now, limitImpl, ...extra });
const verifyCode = (store, service, challenge, extra = {}) => verifyPhoneSignIn(store, { challenge, code: '123456', env, service, now, limitImpl, ...extra });

test('requires explicit game SMS opt-in, not just the shared Twilio credentials', () => {
  expect(phoneSignInConfigured(env)).toBe(true);
  expect(phoneSignInConfigured({ ...env, GEO_PHONE_SIGNIN_ENABLED: '' })).toBe(false);
  expect(phoneSignInConfigured({ ...env, GEO_TWILIO_VERIFY_SERVICE_SID: '' })).toBe(false);
  expect(phoneSignInConfigured({ ...env, NODE_ENV: 'production' })).toBe(false);
  expect(phoneSignInConfigured({ ...env, NODE_ENV: 'production', REDIS_URL: 'redis://test' })).toBe(true);
});
test('accepts international formatting but never guesses a country code', () => {
  expect(normalizePhone('+1 (202) 555-0123')).toBe(phone);
  for (const bad of ['2025550123', '+0123456789', '+12025550123 ext 3', {}, '++123456789', '+123']) expect(() => normalizePhone(bad)).toThrow();
});
test('unconfigured SMS, invalid numbers and rate limits send nothing', async () => {
  const service = fixture();
  await expect(requestCode(service, { env: {} })).rejects.toMatchObject({ code: 'phone_not_configured' });
  await expect(requestCode(service, { phone: '123' })).rejects.toMatchObject({ code: 'bad_phone' });
  await expect(requestCode(service, { limitImpl: async () => ({ success: false }) })).rejects.toMatchObject({ code: 'phone_rate_limited' });
  expect(service.verifications.create).not.toHaveBeenCalled();
});
test('sealed challenge hides the phone and binds the exact provider SID and guest profile', async () => {
  const service = fixture();
  const { challenge, expiresIn } = await requestCode(service, { profileId: 'guest-123' });
  expect(challenge).not.toContain(phone);
  expect(expiresIn).toBe(600);
  expect(openToken(challenge, { secret: env.GEO_TOKEN_SECRET, now })).toMatchObject({ phone, sid, profileId: 'guest-123', purpose: 'phone-signin' });
  expect(service.verifications.create).toHaveBeenCalledWith({ to: phone, channel: 'sms' });
});
test('provider failure never reports that a code was sent', async () => {
  const service = fixture();
  service.verifications.create.mockResolvedValue({ status: 'failed' });
  await expect(requestCode(service)).rejects.toMatchObject({ code: 'phone_send_failed' });
});
test('first verified phone login keeps the guest name and profile', async () => {
  const service = fixture();
  const store = createMemoryRoomStore();
  const { profile: guest } = await resolveProfile(store, { name: 'PhonePlayer' });
  const { challenge } = await requestCode(service, { profileId: guest.id });
  const { account, profile } = await verifyCode(store, service, challenge);
  expect(account.phone).toBe(phone);
  expect(account.email).toBeUndefined();
  expect(profile.id).toBe(guest.id);
  expect(profile.name).toBe('PhonePlayer');
  expect(profile.accountId).toBe(account.id);
  expect(service.verificationChecks.create).toHaveBeenCalledWith({ verificationSid: sid, code: '123456' });
  await expect(verifyCode(store, service, challenge)).rejects.toMatchObject({ code: 'phone_expired' });
});
test('existing phone account keeps its own profile on a second device', async () => {
  const service = fixture();
  const store = createMemoryRoomStore();
  const account = await store.createAccount({ phone });
  const { profile: owned } = await resolveProfile(store, { accountId: account.id, name: 'Original' });
  const { profile: guest } = await resolveProfile(store, { name: 'NewBrowser' });
  const { challenge } = await requestCode(service, { profileId: guest.id });
  expect((await verifyCode(store, service, challenge)).profile.id).toBe(owned.id);
  expect((await store.getProfileById(guest.id)).accountId).toBeNull();
});
test('cannot attach a guest token that already belongs to a different account', async () => {
  const store = createMemoryRoomStore();
  const other = await store.createAccount({ email: 'other@example.test' });
  const { profile } = await resolveProfile(store, { accountId: other.id });
  const service = fixture();
  const { challenge } = await requestCode(service, { profileId: profile.id });
  const result = await verifyCode(store, service, challenge);
  expect(result.profile.id).not.toBe(profile.id);
  expect(result.profile.accountId).toBe(result.account.id);
});
test('wrong codes, wrong token purpose, expiry and tampering create no account', async () => {
  const service = fixture();
  const store = createMemoryRoomStore();
  const { challenge } = await requestCode(service);
  await expect(verifyCode(store, service, challenge, { code: '111111' })).rejects.toMatchObject({ code: 'bad_code' });
  await expect(verifyCode(store, service, challenge, { now: now + 600001 })).rejects.toMatchObject({ code: 'phone_expired' });
  await expect(verifyCode(store, service, `${challenge}invalid`)).rejects.toMatchObject({ code: 'phone_expired' });
  const wrong = sealToken({ purpose: 'round', phone, sid }, { secret: env.GEO_TOKEN_SECRET, now });
  await expect(verifyCode(store, service, wrong)).rejects.toMatchObject({ code: 'phone_expired' });
  expect(await store.getAccountByPhone(phone)).toBeNull();
});
test('provider approval for another phone number is not accepted', async () => {
  const service = fixture();
  service.verificationChecks.create.mockResolvedValue({ status: 'approved', to: '+12025550124' });
  const { challenge } = await requestCode(service);
  await expect(verifyCode(createMemoryRoomStore(), service, challenge)).rejects.toMatchObject({ code: 'bad_code' });
});
test('suspended phone account does not get a session', async () => {
  const store = createMemoryRoomStore();
  await store.createAccount({ phone, suspendedAt: new Date(now) });
  const service = fixture();
  const { challenge } = await requestCode(service);
  await expect(verifyCode(store, service, challenge)).rejects.toMatchObject({ code: 'suspended' });
});
test('phone account session does not require an email and lasts ninety days', () => {
  const token = sealSession({ accountId: 'phone-account' }, { now, env });
  const request = { headers: new Map([['cookie', `geo_session=${token}`]]) };
  expect(accountFromRequest(request, { env, now: now + 8 * 86400000 })).toEqual({ accountId: 'phone-account', email: null });
  expect(accountFromRequest(request, { env, now: now + SESSION_TTL_MS + 1 }).accountId).toBeNull();
});
