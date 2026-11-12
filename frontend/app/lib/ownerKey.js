/**
 * The owner's key: how someone who reported a lost pet without signing in
 * runs their own search.
 *
 * A report made without an account signs nobody in. Before this, the
 * person whose pet had just gone missing opened Mission Control as a
 * visitor: nothing to mark an area searched, widen the search or write to
 * a helper, until they had set a password from an email. The key closes
 * that. When the report is made, a long random key is minted for that one
 * report. The browser that sent the report keeps it in a cookie no script
 * can read, and the same key is in the link emailed to the address they
 * gave. Whoever holds it is the owner of that one search.
 *
 * What it is, and is not:
 *
 *  - It is for one report. It opens nothing else of the account: not its
 *    other pets, its profile or its password.
 *  - Only its hash is stored (SHA-256), so the database cannot be used to
 *    make one. It is compared in constant time.
 *  - It lasts sixty days from the report, like the cookie that carries it.
 *  - The cookie is HttpOnly, Secure in production and SameSite=Lax, so
 *    another site cannot make the browser act with it.
 *
 * It is also how the site knows a browser already has an open search,
 * which is one of the checks that keep reports from being made in bulk
 * (app/api/reports/create/route.js).
 */
import crypto from 'crypto';
import prisma from '@/app/lib/prisma';

/** How long a key is good for, from the moment the report is made. */
export const OWNER_KEY_DAYS = 60;
const OWNER_KEY_MS = OWNER_KEY_DAYS * 24 * 60 * 60 * 1000;
const PREFIX = 'rp_owner_';
/** How many keys one request is read for: a browser holds one per report it sent. */
const MAX_KEYS_READ = 12;

export const ownerCookieName = (caseId) => `${PREFIX}${caseId}`;
/**
 * A second cookie, set only by the request that makes the report: this browser made it. The owner's link sets the
 * key and never this, so a link someone was sent cannot make their browser count as having a search of its own
 * open (which would stop them reporting their own pet).
 */
const MADE = 'rp_made_';
export const madeCookieName = (caseId) => `${MADE}${caseId}`;

export function hashOwnerKey(key) {
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

/** A new key, and the hash that is kept. The key itself is never stored. */
export function mintOwnerKey() {
  const key = crypto.randomBytes(32).toString('base64url');
  return { key, hash: hashOwnerKey(key) };
}

/** Whether a key is the one a hash was made from, compared in constant time. */
export function keyMatches(key, hash) {
  if (typeof key !== 'string' || key.length < 20 || key.length > 200 || typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) return false;
  const a = Buffer.from(hashOwnerKey(key), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Whether a key minted at `mintedAt` is still good. */
export function keyIsFresh(mintedAt, now = Date.now()) {
  if (!mintedAt) return false;
  const age = now - new Date(mintedAt).getTime();
  return age >= 0 && age < OWNER_KEY_MS;
}

/** A request's cookies as a Map. Works on a Request or a NextRequest. */
export function cookiesOf(request) {
  const out = new Map();
  const header = request?.headers?.get?.('cookie') || '';
  for (const part of header.split(';')) {
    const at = part.indexOf('=');
    if (at < 1) continue;
    const name = part.slice(0, at).trim();
    if (!name || out.has(name)) continue;
    try {
      out.set(name, decodeURIComponent(part.slice(at + 1).trim()));
    } catch {
      // A value that is not valid is nobody's key.
    }
  }
  return out;
}

/** The key this request carries for one case, or null. */
export function ownerKeyFrom(request, caseId) {
  if (!caseId) return null;
  return cookiesOf(request).get(ownerCookieName(caseId)) || null;
}

/** The cookie that carries a key: name, value and how it is set. */
export function ownerCookie(caseId, key) {
  return {
    name: ownerCookieName(caseId),
    value: key,
    options: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: OWNER_KEY_DAYS * 24 * 60 * 60 },
  };
}

/** The cookie that says this browser made the report: set beside the key when the report is made, and by nothing else. */
export function madeCookie(caseId) {
  return { name: madeCookieName(caseId), value: '1', options: ownerCookie(caseId, '').options };
}

/** Whether this request holds the good key for a case row ({ id, ownerKeyHash, ownerKeyAt }). */
export function holdsOwnerKey(request, pet, now = Date.now()) {
  if (!pet?.ownerKeyHash || !keyIsFresh(pet.ownerKeyAt, now)) return false;
  return keyMatches(ownerKeyFrom(request, pet.id), pet.ownerKeyHash);
}

/**
 * The owner of a case, where the request holds its key: { userId } (the
 * account the report was filed to), or null. For the routes that ask for a
 * session and act for the owner: with the key, the owner is who is asking.
 */
export async function ownerByKey(request, caseId, now = Date.now()) {
  // Nothing is looked up for a request that carries no key for this case.
  if (!ownerKeyFrom(request, caseId)) return null;
  const pet = await prisma.case.findUnique({ where: { id: String(caseId) }, select: { id: true, reporterId: true, ownerKeyHash: true, ownerKeyAt: true } }).catch(() => null);
  if (!pet || !pet.reporterId || !holdsOwnerKey(request, pet, now)) return null;
  return { userId: pet.reporterId };
}

/**
 * The cases this browser holds a good key for: [{ id, caseNumber, petName,
 * status, reportType, expiresAt }]. It is how the site knows a browser
 * already has a search open, without asking who is using it. With
 * `madeHere`, only the ones this browser itself reported (see MADE).
 */
export async function casesHeldBy(request, { madeHere = false, now = Date.now() } = {}) {
  const jar = cookiesOf(request);
  const held = [...jar.entries()].filter(([name]) => name.startsWith(PREFIX) && (!madeHere || jar.get(madeCookieName(name.slice(PREFIX.length))) === '1')).slice(0, MAX_KEYS_READ);
  if (!held.length) return [];
  const keyOf = new Map(held.map(([name, value]) => [name.slice(PREFIX.length), value]));
  const rows = await prisma.case
    .findMany({ where: { id: { in: [...keyOf.keys()] } }, select: { id: true, caseNumber: true, petName: true, status: true, reportType: true, expiresAt: true, ownerKeyHash: true, ownerKeyAt: true } })
    .catch(() => []);
  return (rows || [])
    .filter((row) => keyIsFresh(row.ownerKeyAt, now) && keyMatches(keyOf.get(row.id), row.ownerKeyHash))
    .map(({ id, caseNumber, petName, status, reportType, expiresAt }) => ({ id, caseNumber, petName, status, reportType, expiresAt: expiresAt || null }));
}
