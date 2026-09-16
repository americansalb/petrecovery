/**
 * A MapKit JS token for the host the page is actually being served on.
 *
 * A MapKit token carries ONE origin and Apple matches it exactly. The
 * token this repository ships is minted for `reunitepets.org`, the site
 * redirects the apex to `www.reunitepets.org`, and Apple answers 401
 * there. Verified against Apple's own bootstrap endpoint, with the
 * token pulled out of the live JS bundle on 2026-09-15:
 *
 *     www.reunitepets.org    401 REFUSED
 *     reunitepets.org        200 AUTHORIZED
 *
 * So every visitor lands on the one host Apple will not draw for, and
 * every Apple surface in the game goes quietly blank. Minting a second
 * token by hand fixes it until the next hostname, and a preview
 * deployment has a new hostname every time.
 *
 * The signing key is already here. `app/lib/shelters/appleMapKit.js`
 * signs ES256 tokens for the Apple Maps Server API out of
 * APPLE_MAPKIT_TEAM_ID, APPLE_MAPKIT_KEY_ID and
 * APPLE_MAPKIT_PRIVATE_KEY. A MapKit JS token is the same signature
 * with an `origin` claim on it, so the server can mint one per host on
 * demand and no hostname ever needs a trip to the developer portal
 * again.
 *
 * **This cannot make anything worse.** With no signing key configured
 * it mints nothing and says so, and the browser falls back to the
 * literal token it uses today.
 */

import jwt from 'jsonwebtoken';

const TEAM_ID = process.env.APPLE_MAPKIT_TEAM_ID || process.env.APPLE_MAPS_TEAM_ID || '';
const KEY_ID = process.env.APPLE_MAPKIT_KEY_ID || process.env.APPLE_MAPS_KEY_ID || '';
const PRIVATE_KEY = process.env.APPLE_MAPKIT_PRIVATE_KEY || process.env.APPLE_MAPS_PRIVATE_KEY || '';

/** An hour, which is what Apple's own examples use. */
const TTL_SECONDS = 3600;

/**
 * Hosts this will sign for.
 *
 * The Host header is attacker controlled, and a token minted for
 * somebody else's origin would let them spend this account's Apple
 * quota on their own site. So the host has to be one we recognise:
 * the site's own domains, anything under a suffix named in
 * GEO_MAPKIT_ORIGINS, preview deployments, and localhost.
 */
const EXTRA = (process.env.GEO_MAPKIT_ORIGINS || '')
  .split(/[\s,]+/)
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

// The legacy domain is deliberately absent: middleware redirects it to
// www.reunitepets.org before any map is drawn, so nothing there ever
// needs a token.
const KNOWN = ['reunitepets.org', 'rescueourfamily.org', 'probablyearth.com', ...EXTRA];

export function mayMintFor(host) {
  const name = String(host || '')
    .toLowerCase()
    .split(':')[0]
    .replace(/\.$/, '');
  if (!name) return false;
  if (name === 'localhost' || name === '127.0.0.1' || name.endsWith('.local')) return true;
  // Preview deployments get a fresh hostname per push, which is exactly
  // the case a hand minted token can never keep up with.
  if (name.endsWith('.vercel.app')) return true;
  return KNOWN.some((known) => name === known || name.endsWith(`.${known}`));
}

/** The private key, whether it was stored as PEM or base64 of PEM. */
function readKey() {
  const raw = PRIVATE_KEY.trim();
  if (!raw) return '';
  if (raw.includes('BEGIN')) return raw.replace(/\\n/g, '\n');
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    return decoded.includes('BEGIN') ? decoded : '';
  } catch {
    return '';
  }
}

export function canMint() {
  return Boolean(TEAM_ID && KEY_ID && readKey());
}

/**
 * Mint for `host`, or return a reason it did not.
 *
 * `{ token, origin, expiresAt }` on success, `{ reason }` otherwise.
 * The reason is for whoever is running the site, and the route hands it
 * back verbatim: a surface that fails silently is how this cost the
 * game every Apple round for weeks without anybody being told.
 */
export function mintMapKitToken(host) {
  const key = readKey();
  if (!TEAM_ID || !KEY_ID || !key) {
    const missing = [
      TEAM_ID ? '' : 'APPLE_MAPKIT_TEAM_ID',
      KEY_ID ? '' : 'APPLE_MAPKIT_KEY_ID',
      key ? '' : 'APPLE_MAPKIT_PRIVATE_KEY',
    ].filter(Boolean);
    return { reason: `no signing key: set ${missing.join(', ')}` };
  }
  const origin = String(host || '')
    .toLowerCase()
    .split(':')[0]
    .replace(/\.$/, '');
  if (!mayMintFor(origin)) return { reason: `not minting for ${origin || 'an unnamed host'}` };

  const now = Math.floor(Date.now() / 1000);
  const expires = now + TTL_SECONDS;
  try {
    const token = jwt.sign(
      { iss: TEAM_ID, iat: now, exp: expires, origin },
      key,
      { algorithm: 'ES256', header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' } }
    );
    return { token, origin, expiresAt: expires * 1000 };
  } catch (error) {
    return { reason: `the signing key was refused: ${error.message}` };
  }
}
