/**
 * The details token: lets the person who just posted a report add details
 * to it from the success screen before they have a session.
 *
 * A guest's account is minted by /api/reports/create without a password;
 * they are signed in only once they follow the emailed link. The create
 * response carries this token, an HMAC over the case id and an expiry,
 * and PATCH /api/missions/[id] accepts it for that one case, for the
 * questionnaire fields only (details, reward, breed, how they got out),
 * never the phone, the photo or anything else. It lasts a day.
 */

import crypto from 'crypto';

const TTL_MS = 24 * 60 * 60 * 1000;
export const DETAILS_TOKEN_HEADER = 'x-details-token';

function secret() {
  return process.env.NEXTAUTH_SECRET || '';
}

function sign(caseId, exp) {
  return crypto.createHmac('sha256', secret()).update(`${caseId}.${exp}`).digest('base64url');
}

/** "exp.signature", or null when there is no secret to sign with. */
export function signDetailsToken(caseId, { now = Date.now(), ttlMs = TTL_MS } = {}) {
  if (!secret() || !caseId) return null;
  const exp = now + ttlMs;
  return `${exp}.${sign(caseId, exp)}`;
}

/** True when `token` was signed for `caseId` and has not expired. */
export function verifyDetailsToken(token, caseId, { now = Date.now() } = {}) {
  if (!secret() || !caseId || typeof token !== 'string') return false;
  const [expStr, sig] = token.split('.');
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now || !sig) return false;
  const want = sign(caseId, exp);
  if (sig.length !== want.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}
