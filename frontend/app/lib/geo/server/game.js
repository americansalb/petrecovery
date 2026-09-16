/**
 * Rounds and guesses.
 *
 * createRound: draw candidates for the mode, hand the browser a short
 * list of places to try Look Around at, and seal the answer for each one
 * in its own token. The response never carries the answer. About one
 * casual round in two hundred is a Not Earth round instead, which is a
 * NASA panorama and one token (app/lib/geo/notEarth.js).
 *
 * evaluateGuess: open the token, score the guess, return the answer.
 *
 * Server only.
 */

import { haversineKm, MAX_ROUND_SCORE, scoreForDistance } from '../distance';
import { normalizeConfig } from '../modes';
import { bodyOf, notEarthFor, notEarthPlace, playablePlace, revealPlace } from '../notEarth';
import { getGeoServerConfig } from './config';
import { publicCountry } from './countries';
import { createCandidateSource } from './sampler';
import { randomBytes } from 'node:crypto';
import { openToken, sealToken } from './tokens';

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

function answerPayload({ provider, config, roundIndex, lat, lng, country, sizeKm, panoId, city, date, subject, roundId, notEarth }) {
  return {
    v: 1,
    // The NASA panorama this round is, when it is one. Its presence is
    // what makes the round a Not Earth round: everything below it
    // describes a place on the planet and means nothing here.
    ne: notEarth || '',
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
 * Create round `roundIndex` for a config.
 * Ordinary:  { provider: 'apple', roundIndex, candidates: [{ lat, lng, token }] }
 * Not Earth: { provider: 'photo', roundIndex, place, token }
 *
 * A Not Earth round goes out as 'photo', which is what the browser has
 * to do with it: draw a still picture instead of opening Look Around.
 * It is not called 'not-earth' on the wire for the same reason the
 * files are numbered (app/lib/geo/notEarth.js): the round is a surprise,
 * and a response that announces it hands the answer to anyone with the
 * network tab open.
 */
export async function createRound({ config: rawConfig, roundIndex = 0, attempt = 0, subject = '', fetchImpl, now = Date.now(), env, cache } = {}) {
  const config = normalizeConfig(rawConfig);
  const { tokenSecret } = getGeoServerConfig(env);
  if (!tokenSecret) {
    throw new GeoGameError('no_secret', 'Set NEXTAUTH_SECRET or GEO_TOKEN_SECRET before starting a game');
  }
  const roundId = randomBytes(9).toString('base64url');

  // One casual round in two hundred is not on this planet. Drawn before
  // the sampler runs, because there is no point on Earth to draw: the
  // round is a NASA panorama and a single token.
  const place = notEarthFor({ config, roundIndex });
  if (place) {
    const body = bodyOf(place);
    return {
      provider: 'photo',
      roundIndex,
      place: playablePlace(place),
      token: sealToken(
        answerPayload({
          provider: 'photo',
          config,
          roundIndex,
          lat: 0,
          lng: 0,
          country: { cca2: body.code, name: body.name, flag: body.flag },
          sizeKm: 0,
          subject,
          roundId,
          notEarth: place.id,
        }),
        { secret: tokenSecret, now }
      ),
    };
  }

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
 * Not Earth: { kind: 'not-earth', correct, score, place, answer }
 * A missing guess (timer ran out) scores 0 and still reveals the answer.
 *
 * `guess.notEarth` is the Not Earth button, and it is on every round.
 * On a Not Earth round it is the right answer and pays full marks. On
 * any other round it forfeits: no pin, no distance, no score, and in a
 * streak it is the miss that ends the run. That cost is the point. A
 * button that were free would be pressed on every round.
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
  const base = { provider: payload.p, mode: payload.mode, seed: payload.seed || '', roundIndex: payload.i, sizeKm: payload.size, subject: payload.sub || '', roundId: payload.rid || '', answer };
  const calledNotEarth = Boolean(guess?.notEarth);

  if (payload.ne) {
    const place = notEarthPlace(payload.ne);
    return {
      ...base,
      kind: 'not-earth',
      notEarth: true,
      calledNotEarth,
      correct: calledNotEarth,
      score: calledNotEarth ? MAX_ROUND_SCORE : 0,
      maxScore: MAX_ROUND_SCORE,
      distanceKm: null,
      guess: null,
      timedOut: !calledNotEarth && !guess,
      place: revealPlace(place),
      // The lat/lng in the token is 0,0, which is a place in the Gulf of
      // Guinea. The summary map draws whatever answer it is handed, so
      // this round hands it none.
      answer: { ...answer, lat: null, lng: null },
    };
  }

  if (calledNotEarth) {
    return {
      ...base,
      kind: payload.mode === 'streak' ? 'streak' : 'pin',
      notEarth: false,
      calledNotEarth,
      correct: false,
      score: 0,
      maxScore: MAX_ROUND_SCORE,
      distanceKm: null,
      guess: null,
      guessCountry: '',
      timedOut: false,
    };
  }

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
