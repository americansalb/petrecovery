/**
 * Rounds and guesses.
 *
 * createRound: draw candidates for the mode, hand the browser a short
 * list of places to try Look Around at, and seal the answer for each one
 * in its own token. The response never carries the answer.
 *
 * evaluateGuess: open the token, score the guess, return the answer.
 *
 * Server only.
 */

import { haversineKm, MAX_ROUND_SCORE, scoreForDistance } from '../distance';
import { normalizeConfig } from '../modes';
import { getGeoServerConfig } from './config';
import { publicCountry } from './countries';
import { createCandidateSource } from './sampler';
import { randomBytes } from 'node:crypto';
import { GeoTokenError, openToken, sealToken } from './tokens';

export const APPLE_CANDIDATES_PER_ROUND = 12;

export class GeoGameError extends Error {
  constructor(code, message, extra = {}) {
    super(message || code);
    this.name = 'GeoGameError';
    this.code = code;
    Object.assign(this, extra);
  }
}

const round6 = (n) => Math.round(Number(n) * 1e6) / 1e6;

function answerPayload({ provider, config, roundIndex, lat, lng, country, sizeKm, panoId, city, date, subject, roundId }) {
  return {
    v: 1,
    // This round's identity, the same in every token it issues. An
    // Apple round issues twelve, one per candidate place, and without
    // this the points ledger keyed them by token and paid all twelve
    // for one round.
    rid: roundId || '',
    // Who asked for this round. The guess route refuses a scored
    // challenge token presented by anyone else, which is what stops a
    // round being revealed under one identity and scored under another.
    sub: subject || '',
    p: provider,
    pano: panoId || '',
    lat: round6(lat),
    lng: round6(lng),
    cc: country?.cca2 || '',
    cn: country?.name || '',
    cf: country?.flag || '',
    city: city || '',
    date: date || '',
    size: Math.round(sizeKm),
    mode: config.mode,
    seed: config.seed || '',
    i: roundIndex,
  };
}

/**
 * Create round `roundIndex` for a config:
 * { provider: 'apple', roundIndex, candidates: [{ lat, lng, token }] }
 */
export async function createRound({ config: rawConfig, roundIndex = 0, attempt = 0, subject = '', fetchImpl, now = Date.now(), env, cache } = {}) {
  const config = normalizeConfig(rawConfig);
  const { tokenSecret } = getGeoServerConfig(env);
  if (!tokenSecret) {
    throw new GeoGameError('no_secret', 'Set NEXTAUTH_SECRET or GEO_TOKEN_SECRET before starting a game');
  }
  const roundId = randomBytes(9).toString('base64url');
  const source = createCandidateSource(config, roundIndex);

  // A retry of a seeded round must not replay the same failed points:
  // skip ahead in the deterministic sequence instead.
  const skip = Math.max(0, Math.min(20, Math.floor(Number(attempt) || 0))) * APPLE_CANDIDATES_PER_ROUND;
  for (let i = 0; i < skip; i++) if (!source.next()) break;

  const candidates = [];
  for (let i = 0; i < APPLE_CANDIDATES_PER_ROUND; i++) {
    const c = source.next();
    if (!c) break;
    candidates.push({
      lat: round6(c.lat),
      lng: round6(c.lng),
      token: sealToken(
        answerPayload({ provider: 'apple', config, roundIndex, lat: c.lat, lng: c.lng, country: c.country, sizeKm: source.sizeKm, city: c.city, subject, roundId }),
        { secret: tokenSecret, now }
      ),
    });
  }
  if (!candidates.length) throw new GeoGameError('no_candidates', 'No places to try for this mode');
  return { provider: 'apple', roundIndex, candidates, sizeKm: source.sizeKm };
}

/**
 * Score a guess against a sealed token.
 * Pin modes: { kind: 'pin', distanceKm, score, maxScore, answer, guess }
 * Streak:    { kind: 'streak', correct, answer, guessCountry }
 * A missing guess (timer ran out) scores 0 and still reveals the answer.
 */
export function evaluateGuess({ token, guess, now = Date.now(), env } = {}) {
  const { tokenSecret } = getGeoServerConfig(env);
  const payload = openToken(token, { secret: tokenSecret, now });
  // `ne` marks a Mars or Moon panorama round (retired 2026-09-23), sealed
  // with 0,0 as its answer. A token that still carries one is refused as
  // expired ("This round has expired" on the play page), not scored as a pin.
  if (payload.ne) throw new GeoTokenError('expired', 'Mars and Moon rounds are retired');
  const answer = {
    lat: payload.lat,
    lng: payload.lng,
    panoId: payload.pano || '',
    city: payload.city || '',
    date: payload.date || '',
    country: payload.cc || payload.cn ? { code: payload.cc, name: payload.cn, flag: payload.cf } : null,
  };
  const base = { provider: payload.p, mode: payload.mode, seed: payload.seed || '', roundIndex: payload.i, sizeKm: payload.size, subject: payload.sub || '', roundId: payload.rid || '', answer };

  if (payload.mode === 'streak') {
    const code = String(guess?.countryCode || '').toUpperCase();
    return { ...base, kind: 'streak', correct: Boolean(code) && code === payload.cc, guessCountry: code };
  }

  const hasGuess = guess && Number.isFinite(Number(guess.lat)) && Number.isFinite(Number(guess.lng));
  if (!hasGuess) {
    return { ...base, kind: 'pin', distanceKm: null, score: 0, maxScore: MAX_ROUND_SCORE, guess: null, timedOut: true };
  }
  const point = { lat: Number(guess.lat), lng: Number(guess.lng) };
  const distanceKm = haversineKm(point, answer);
  return {
    ...base,
    kind: 'pin',
    distanceKm,
    score: scoreForDistance(distanceKm, payload.size),
    maxScore: MAX_ROUND_SCORE,
    guess: point,
    timedOut: false,
  };
}

export { publicCountry };
