/**
 * Case numbers.
 *
 * Both intake routes used to build one inline as:
 *
 *   `CASE-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`
 *
 * The last six digits of epoch milliseconds repeat every 1000 seconds, so two
 * reports filed in the same ~16.7 minute window could collide - and Case.caseNumber
 * is @unique, so the second one 500s. That is not theoretical: eight concurrent
 * reports against a local server produced
 * "Unique constraint failed on the fields: (`caseNumber`)" and lost two of them.
 * It also ignored the documented {CITY}-{YEAR}-{SEQ} shape, so live reports got
 * CASE-2026-910612 while seeded demo data got the tidy AUS-2026-0001.
 *
 * This generator keeps the documented shape, derives the city prefix where one
 * can be read, and uses a high-entropy suffix instead of a guessable counter.
 * Callers still need to handle a unique violation - see withCaseNumberRetry -
 * because nothing short of a database sequence makes generate-then-insert
 * atomic, but a collision is now rare enough to be a retry rather than a bug.
 */

import crypto from 'crypto';

// Crockford-ish: no 0/O, 1/I/L, or U. These end up read aloud down a phone line
// to a shelter, so the characters have to survive that.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const SUFFIX_LENGTH = 6;

/** Cryptographically random suffix; ~7.3e8 per city-year. */
function randomSuffix(length = SUFFIX_LENGTH) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/**
 * "Austin, TX 78704" / "Austin" -> "AUS". Falls back to CASE when there is no
 * usable city, which is the same prefix the old code always used.
 */
export function cityPrefix(cityName, lastSeenAddress) {
  const source = (cityName || '').trim() ||
    // "123 Main St, Austin, TX 78704" -> the second-to-last comma part
    (String(lastSeenAddress || '').split(',').slice(-2, -1)[0] || '').trim();

  const letters = source.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return letters.length >= 3 ? letters.slice(0, 3) : 'CASE';
}

/**
 * Build a case number. `kind` lets the found-pet intake keep its FOUND- prefix.
 */
export function buildCaseNumber({ cityName, lastSeenAddress, kind } = {}) {
  const prefix = kind === 'FOUND' ? 'FOUND' : cityPrefix(cityName, lastSeenAddress);
  return `${prefix}-${new Date().getFullYear()}-${randomSuffix()}`;
}

/**
 * Run `attempt` with a fresh case number, retrying only when the database
 * rejects that number as taken. Any other failure propagates immediately - a
 * retry loop that swallows real errors is worse than the bug it replaces.
 */
export async function withCaseNumberRetry(attempt, options = {}, maxAttempts = 4) {
  let lastError;
  for (let i = 0; i < maxAttempts; i += 1) {
    const caseNumber = buildCaseNumber(options);
    try {
      return await attempt(caseNumber);
    } catch (error) {
      if (!isCaseNumberCollision(error)) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

/** Prisma P2002 (unique violation) naming caseNumber. */
export function isCaseNumberCollision(error) {
  if (!error) return false;
  const target = error?.meta?.target;
  const targets = Array.isArray(target) ? target : [target];
  return error.code === 'P2002' && targets.some((t) => String(t).includes('caseNumber'));
}
