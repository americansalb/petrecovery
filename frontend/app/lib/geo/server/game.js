/**
 * Rounds and guesses.
 *
 * createRound: draw candidates for the mode, find imagery (Google: probe
 * server-side; Apple: hand the browser a short list to try), and seal
 * the answer in a token. The response never carries the answer.
 *
 * evaluateGuess: open the token, score the guess, return the answer.
 *
 * Server only.
 */

import { createRng, randomHeading, roundSeed } from '../random';
import { haversineKm, MAX_ROUND_SCORE, scoreForDistance } from '../distance';
import { normalizeConfig } from '../modes';
import { getGeoServerConfig } from './config';
import { countryAt, publicCountry } from './countries';
import { createCandidateSource } from './sampler';
import { findPanorama } from './streetview';
import { openToken, sealToken } from './tokens';
import { roundCacheKey } from './roundCache';

export const APPLE_CANDIDATES_PER_ROUND = 12;
/** Probes per attempt for Google rounds. */
export const MAX_PROBES = 96;

export class GeoGameError extends Error {
  constructor(code, message, extra = {}) {
    super(message || code);
    this.name = 'GeoGameError';
    this.code = code;
    Object.assign(this, extra);
  }
}

const round6 = (n) => Math.round(Number(n) * 1e6) / 1e6;

function answerPayload({ provider, config, roundIndex, lat, lng, country, sizeKm, panoId, city, date }) {
  return {
    v: 1,
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
 * Create round `roundIndex` for a config.
 * Google: { provider, roundIndex, panoId, heading, token, stats }
 * Apple:  { provider, roundIndex, candidates: [{ lat, lng, token }] }
 */
export async function createRound({ config: rawConfig, roundIndex = 0, attempt = 0, fetchImpl, now = Date.now(), env, cache } = {}) {
  const config = normalizeConfig(rawConfig);
  const { googleServerKey, tokenSecret } = getGeoServerConfig(env);
  if (!tokenSecret) {
    throw new GeoGameError('no_secret', 'Set NEXTAUTH_SECRET or GEO_TOKEN_SECRET before starting a game');
  }
  const source = createCandidateSource(config, roundIndex);

  // A retry of a seeded round must not replay the same failed points:
  // skip ahead in the deterministic sequence instead.
  const skip = Math.max(0, Math.min(20, Math.floor(Number(attempt) || 0))) * (config.provider === 'apple' ? APPLE_CANDIDATES_PER_ROUND : MAX_PROBES);
  for (let i = 0; i < skip; i++) if (!source.next()) break;

  if (config.provider === 'apple') {
    const candidates = [];
    for (let i = 0; i < APPLE_CANDIDATES_PER_ROUND; i++) {
      const c = source.next();
      if (!c) break;
      candidates.push({
        lat: round6(c.lat),
        lng: round6(c.lng),
        token: sealToken(
          answerPayload({ provider: 'apple', config, roundIndex, lat: c.lat, lng: c.lng, country: c.country, sizeKm: source.sizeKm, city: c.city }),
          { secret: tokenSecret, now }
        ),
      });
    }
    if (!candidates.length) throw new GeoGameError('no_candidates', 'No places to try for this mode');
    return { provider: 'apple', roundIndex, candidates, sizeKm: source.sizeKm };
  }

  const found = await resolveImagery({ source, config, roundIndex, attempt, googleServerKey, fetchImpl, cache, now });
  const token = sealToken(
    answerPayload({
      provider: 'google',
      config,
      roundIndex,
      lat: found.lat,
      lng: found.lng,
      country: found.country,
      sizeKm: found.sizeKm,
      panoId: found.panoId,
      city: found.city,
      date: found.date,
    }),
    { secret: tokenSecret, now }
  );
  return { provider: 'google', roundIndex, panoId: found.panoId, heading: found.heading, token, stats: found.stats, sizeKm: found.sizeKm };
}

/**
 * Cached imagery for seeded games, probing on a miss. Retries (attempt > 0)
 * skip the cache: they exist because the cached sequence had nothing.
 */
async function resolveImagery({ source, config, roundIndex, attempt, googleServerKey, fetchImpl, cache, now }) {
  const key = cache && attempt === 0 ? roundCacheKey(config, roundIndex) : null;
  if (key) {
    const hit = await cache.get(key, now);
    if (hit) return { ...hit, stats: { ...(hit.stats || {}), cached: true } };
  }
  const found = await probeForImagery({ source, config, roundIndex, googleServerKey, fetchImpl });
  if (key) await cache.set(key, found, now);
  return found;
}

/** Shared by solo rounds (sealed token) and room rounds (stored server-side). */
async function probeForImagery({ source, config, roundIndex, googleServerKey, fetchImpl }) {
  if (!googleServerKey) {
    throw new GeoGameError('google_not_configured', 'Google Street View is not configured on this server');
  }
  const found = await findPanorama({ source, key: googleServerKey, fetchImpl, maxProbes: MAX_PROBES });
  if (!found.hit) {
    const upstream = found.error || {};
    const code = upstream.code === 'no_imagery' ? 'no_imagery' : 'probe_failed';
    const message =
      code === 'no_imagery'
        ? 'No Street View imagery turned up near the random points. Try again or widen the search radius.'
        : `Street View lookup failed: ${upstream.message || upstream.code || 'unknown error'}`;
    throw new GeoGameError(code, message, { stats: found.stats, upstream: { code: upstream.code, message: upstream.message } });
  }
  const hit = found.hit;
  const country = countryAt(hit.lat, hit.lng) || found.candidate?.country || null;
  const headingRng = createRng(config.seed ? `${roundSeed(config.seed, roundIndex)}:heading` : undefined);
  return {
    panoId: hit.panoId,
    heading: randomHeading(headingRng),
    lat: hit.lat,
    lng: hit.lng,
    country,
    city: found.candidate?.city || '',
    date: hit.date || '',
    sizeKm: source.sizeKm,
    stats: found.stats,
  };
}

/**
 * Imagery for a room round: same sampling and probing as a solo round,
 * but the answer is returned to the caller (the room store keeps it)
 * instead of being sealed into a token.
 */
export async function findRoundImagery({ config: rawConfig, roundIndex = 0, attempt = 0, fetchImpl, env, cache, now = Date.now() } = {}) {
  const config = normalizeConfig(rawConfig);
  const { googleServerKey } = getGeoServerConfig(env);
  const source = createCandidateSource(config, roundIndex);
  const skip = Math.max(0, Math.min(20, Math.floor(Number(attempt) || 0))) * MAX_PROBES;
  for (let i = 0; i < skip; i++) if (!source.next()) break;
  return resolveImagery({ source, config, roundIndex, attempt, googleServerKey, fetchImpl, cache, now });
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
  const answer = {
    lat: payload.lat,
    lng: payload.lng,
    panoId: payload.pano || '',
    city: payload.city || '',
    date: payload.date || '',
    country: payload.cc || payload.cn ? { code: payload.cc, name: payload.cn, flag: payload.cf } : null,
  };
  const base = { provider: payload.p, mode: payload.mode, seed: payload.seed || '', roundIndex: payload.i, sizeKm: payload.size, answer };

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
