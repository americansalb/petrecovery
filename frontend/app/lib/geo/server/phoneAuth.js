import { createHash } from 'node:crypto';
import { GeoAuthError } from './accounts';
import { getGeoServerConfig } from './config';
import { openToken, sealToken } from './tokens';
import { resolveProfile } from './profiles';
import { checkRateLimitForKeyAsync } from './limiter';

const TTL_MS = 10 * 60 * 1000;
const SEND_LIMIT = { windowMs: 10 * 60 * 1000, maxRequests: 3, blockDurationMs: 10 * 60 * 1000 };
const CHECK_LIMIT = { windowMs: TTL_MS, maxRequests: 5, blockDurationMs: TTL_MS };

export function phoneSignInConfigured(env = process.env) {
  // Explicit opt-in: the pet site's SMS credentials alone must not enable
  // a new billable public endpoint. Use a dedicated Verify service.
  return env.GEO_PHONE_SIGNIN_ENABLED === 'true' && Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.GEO_TWILIO_VERIFY_SERVICE_SID && getGeoServerConfig(env).tokenSecret) && (env.NODE_ENV !== 'production' || Boolean(env.REDIS_URL));
}

export function normalizePhone(value) {
  if (typeof value !== 'string' || value.length > 40) throw new GeoAuthError('bad_phone', 'Enter a phone number with its country code, such as +1 202 555 0123.');
  const phone = value.trim().replace(/[\s().-]/g, '');
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new GeoAuthError('bad_phone', 'Enter a phone number with its country code, such as +1 202 555 0123.');
  return phone;
}

function configured(env) {
  if (!phoneSignInConfigured(env)) throw new GeoAuthError('phone_not_configured', 'Phone sign-in is not available yet. Use email instead.');
}

async function provider(env) {
  const { default: twilio } = await import('twilio');
  return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, { timeout: 10000 }).verify.v2.services(env.GEO_TWILIO_VERIFY_SERVICE_SID);
}

async function limited(value, action, policy, limitImpl) {
  // Neither phone numbers nor codes belong in limiter keys/logs.
  const hash = createHash('sha256').update(value).digest('hex');
  const result = await limitImpl(`geo-phone-${action}:${hash}`, policy);
  if (!result.success) throw new GeoAuthError('phone_rate_limited', 'Too many attempts. Wait ten minutes before trying again.');
}

export async function requestPhoneSignIn({ phone: raw, profileId = null, env = process.env, now = Date.now(), service, limitImpl = checkRateLimitForKeyAsync } = {}) {
  configured(env);
  const phone = normalizePhone(raw);
  const sendLimit = { ...SEND_LIMIT, requireShared: env.NODE_ENV === 'production' };
  await limited(phone, 'send', sendLimit, limitImpl);
  // A conservative site-wide ceiling also bounds a distributed SMS flood.
  await limited('site', 'send-budget', { ...sendLimit, maxRequests: 30 }, limitImpl);
  let result;
  try {
    result = await (service || await provider(env)).verifications.create({ to: phone, channel: 'sms' });
  } catch {
    throw new GeoAuthError('phone_send_failed', 'We could not send a code. Check the number or use email instead.');
  }
  if (result?.status !== 'pending' || !/^VE[\da-f]{32}$/i.test(result.sid || '')) throw new GeoAuthError('phone_send_failed', 'We could not send a code. Use email instead.');
  return {
    challenge: sealToken({ purpose: 'phone-signin', phone, profileId, sid: result.sid }, { secret: getGeoServerConfig(env).tokenSecret, now, ttlMs: TTL_MS }),
    expiresIn: TTL_MS / 1000,
  };
}

export async function verifyPhoneSignIn(store, { challenge, code, env = process.env, now = Date.now(), service, limitImpl = checkRateLimitForKeyAsync } = {}) {
  configured(env);
  let payload;
  try { payload = openToken(challenge, { secret: getGeoServerConfig(env).tokenSecret, now }); } catch {
    throw new GeoAuthError('phone_expired', 'That code has expired. Ask for a new one.');
  }
  if (payload.purpose !== 'phone-signin' || !payload.phone || !payload.sid) throw new GeoAuthError('phone_expired', 'Ask for a new code.');
  if (typeof code !== 'string' || !/^\d{4,10}$/.test(code)) throw new GeoAuthError('bad_code', 'Enter the code from your text message.');
  await limited(payload.sid, 'check', { ...CHECK_LIMIT, requireShared: env.NODE_ENV === 'production' }, limitImpl);
  let result;
  try {
    // The SID is sealed at send time. The browser cannot substitute a
    // different phone number, verification or guest profile on this step.
    result = await (service || await provider(env)).verificationChecks.create({ verificationSid: payload.sid, code });
  } catch {
    throw new GeoAuthError('phone_expired', 'That code has expired or has already been used. Ask for a new one.');
  }
  if (result?.status !== 'approved' || result.to !== payload.phone) throw new GeoAuthError('bad_code', 'That code did not match. Try again.');
  return store.withAccountLock
    ? store.withAccountLock((locked) => completePhoneSignIn(locked, payload, now))
    : completePhoneSignIn(store, payload, now);
}

async function completePhoneSignIn(store, payload, now) {
  let account = await store.getAccountByPhone(payload.phone);
  if (!account) {
    try { account = await store.createAccount({ phone: payload.phone, createdAt: new Date(now), lastSeenAt: new Date(now) }); } catch (error) {
      // A second verified login can race account creation on another device.
      account = await store.getAccountByPhone(payload.phone);
      if (!account) throw error;
    }
  }
  if (account.suspendedAt) throw new GeoAuthError('suspended', 'This account has been suspended.');
  await store.updateAccount(account.id, { lastSeenAt: new Date(now) });
  let profile = await store.getProfileByAccountId(account.id);
  if (!profile && payload.profileId) {
    const guest = await store.getProfileById(payload.profileId);
    if (guest && !guest.accountId) profile = await store.updateProfile(guest.id, { accountId: account.id });
  }
  if (!profile) ({ profile } = await resolveProfile(store, { accountId: account.id, now }));
  return { account, profile };
}
