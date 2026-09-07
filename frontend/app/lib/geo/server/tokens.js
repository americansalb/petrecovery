/**
 * Sealed round tokens.
 *
 * The answer to a round (where the panorama really is) must never reach
 * the browser before the guess is in. So the round endpoint hands the
 * client an opaque token instead: the answer encrypted with AES-256-GCM
 * under a key derived from the server secret. The guess endpoint opens
 * it, scores the guess, and only then returns the location.
 *
 * Stateless by design: no table, no cleanup, works across instances as
 * long as they share the secret. Server only (node:crypto).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 'g1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class GeoTokenError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'GeoTokenError';
    this.code = code;
  }
}

function deriveKey(secret) {
  if (!secret || typeof secret !== 'string' || secret.length < 8) {
    throw new GeoTokenError('no_secret', 'A token secret of at least 8 characters is required');
  }
  return createHash('sha256').update(`reunitepets-geo:${secret}`).digest();
}

function toBase64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded + '='.repeat((4 - (padded.length % 4)) % 4), 'base64');
}

/**
 * Seal a JSON payload. `ttlMs` sets the expiry (default 12 hours: a
 * round nobody finishes in half a day is not worth scoring).
 */
export function sealToken(payload, { secret, ttlMs = 12 * 60 * 60 * 1000, now = Date.now() } = {}) {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_BYTES);
  const body = Buffer.from(JSON.stringify({ ...payload, exp: now + ttlMs }), 'utf8');
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}.${toBase64Url(Buffer.concat([iv, tag, encrypted]))}`;
}

/** Open a sealed token. Throws GeoTokenError('invalid' | 'expired'). */
export function openToken(token, { secret, now = Date.now() } = {}) {
  const key = deriveKey(secret);
  if (typeof token !== 'string' || !token.startsWith(`${VERSION}.`)) {
    throw new GeoTokenError('invalid', 'Malformed token');
  }
  let payload;
  try {
    const raw = fromBase64Url(token.slice(VERSION.length + 1));
    if (raw.length < IV_BYTES + TAG_BYTES + 1) throw new Error('short');
    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const encrypted = raw.subarray(IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const body = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    payload = JSON.parse(body.toString('utf8'));
  } catch {
    throw new GeoTokenError('invalid', 'Token failed to open');
  }
  if (!payload || typeof payload.exp !== 'number' || payload.exp < now) {
    throw new GeoTokenError('expired', 'Token has expired');
  }
  return payload;
}
