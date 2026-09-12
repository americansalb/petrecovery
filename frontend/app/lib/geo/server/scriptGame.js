/**
 * Building and scoring a script round.
 *
 * Same contract as the panorama game (app/lib/geo/server/game.js): the
 * client is handed something to look at and an opaque token, and the
 * answer stays on the server until the guess is in. Here the thing to
 * look at is a sentence, so the corpus itself has to stay server side
 * too, or the browser could match the text against it and read off the
 * answer (app/lib/geo/server/samples.js).
 *
 * The whole game for a seed is decided by the seed AND the server's
 * token secret. The API is stateless: the client asks for round three
 * and gets the same round three every time, and a shared link replays
 * the same sentences in the same order. The secret is what stops the
 * browser doing the same arithmetic: the seed is in the address bar,
 * the language pool and the speaker counts ship in the page bundle, and
 * the draw is one weighted pick per round, so without it the whole
 * answer sequence is computable before the first sentence is read.
 *
 * Nothing here costs money. There is no imagery provider, no metadata
 * probe and no key, so script rounds do not touch the play meter
 * (docs/GEO.md, "The play meter"). That is not generosity, it is
 * arithmetic: a text round has no marginal cost to meter.
 */

import { createHash } from 'crypto';
import { createRng, roundSeed, weightedIndex } from '../random';
import { languagesForLadder, normalizeScriptConfig } from '../script';
import { ladderSizeKm, regionsForReveal, scoreScriptGuess } from './regions';
import { SCRIPTS, languageByCode } from '../languages';
import { samplesFor } from './samples';
import { getGeoServerConfig } from './config';
import { openToken, sealToken } from './tokens';

export class ScriptGameError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ScriptGameError';
    this.code = code;
  }
}

/**
 * How often a language comes up. Raw speaker counts would make the game
 * Mandarin, Spanish, English and nothing else: the spread from Icelandic
 * to Mandarin is a thousand to one. A log flattens that to about ten to
 * one, which still favours languages a player has plausibly met without
 * burying the rest.
 */
function weightFor(language) {
  return Math.log10(Math.max(1, Number(language.speakers) || 1) + 1);
}

/**
 * A seed the browser cannot reproduce. Everything else the draw reads -
 * the ladder, the language rows, the speaker counts, the generator - is
 * in the page bundle, so the secret is the only part that is not.
 */
function saltedSeed(seed, purpose, secret) {
  if (!secret) return `${seed}#${purpose}`;
  return createHash('sha256').update(`wanderguesser-script:${purpose}:${secret}:${seed}`).digest('hex').slice(0, 32);
}

/**
 * The languages for a whole game, in order, drawn without replacement
 * so a five-round game is five different answers. A ladder smaller than
 * the round count (Cyrillic has six languages, a ten-round game wants
 * ten) refills and may then repeat, which beats refusing to start.
 */
export function drawLanguages(config, secret = '') {
  const { ladder, rounds, seed } = normalizeScriptConfig(config);
  const source = languagesForLadder(ladder);
  const rng = createRng(saltedSeed(seed || 'script', 'draw', secret));
  const picked = [];
  let bag = [...source];
  while (picked.length < rounds) {
    if (!bag.length) bag = [...source];
    const index = weightedIndex(rng, bag.map(weightFor));
    picked.push(bag.splice(index, 1)[0]);
  }
  return picked;
}

/**
 * One round: the sentence to read, the script to render it in, and the
 * sealed answer. `script` is not a leak. The player can see the
 * alphabet on screen; the client needs the id only to choose a font.
 */
export function createScriptRound({ config: rawConfig, roundIndex = 0, now = Date.now(), env } = {}) {
  const config = normalizeScriptConfig(rawConfig);
  const { tokenSecret } = getGeoServerConfig(env);
  if (!tokenSecret) {
    throw new ScriptGameError('no_secret', 'Set NEXTAUTH_SECRET or GEO_TOKEN_SECRET before starting a game');
  }
  const index = Math.max(0, Math.min(config.rounds - 1, Math.floor(Number(roundIndex) || 0)));
  const language = drawLanguages(config, tokenSecret)[index];
  if (!language) throw new ScriptGameError('empty_pool', 'No languages in that pool');

  const samples = samplesFor(language.code);
  if (!samples.length) throw new ScriptGameError('no_samples', `No sample text for ${language.name}`);
  const rng = createRng(saltedSeed(roundSeed(config.seed || 'script', index), 'text', tokenSecret));
  const text = samples[Math.floor(rng() * samples.length)];

  return {
    roundIndex: index,
    ladder: config.ladder,
    // The script ID, and only the ID, because the client has to pick a
    // font (app/geo/script/fonts.js). Its human NAME used to be here
    // too, and that was a leak: for a script only one language uses -
    // Odia, Tamil, Telugu, Kannada, Malayalam, Sinhala, Thai, Lao,
    // Khmer, Georgian, Armenian, Hebrew, Greek - the name of the script
    // is the name of the answer, handed over before the guess. Nothing
    // on the client read it; the reveal takes scriptName from the guess
    // response, where it belongs.
    //
    // The ID is still a hint to anyone reading the network tab, and it
    // cannot be removed while the browser chooses the font. That mostly
    // does not matter, because the script is on screen anyway; where it
    // does matter is the Alphabets ladder, whose whole game is naming
    // the writing system. Treat that ladder as unranked-by-design.
    script: language.script,
    text,
    token: sealToken({ c: language.code, l: config.ladder, i: index, seed: config.seed || '' }, { secret: tokenSecret, now }),
  };
}

/**
 * Score a guess and reveal.
 *
 * The reveal carries the language's whole region list, not just the one
 * the pin was measured against, so the result map can draw where the
 * language is actually spoken. That is the teaching half of the mode:
 * seeing Punjabi drawn over both Punjabs, or Bhojpuri over the corner
 * of two states and a strip of Nepal, is the kind of thing a country
 * dropdown can never show.
 *
 * A missing guess (the clock ran out) scores zero and still reveals.
 */
export function evaluateScriptGuess({ token, guess, now = Date.now(), env } = {}) {
  const { tokenSecret } = getGeoServerConfig(env);
  const payload = openToken(token, { secret: tokenSecret, now });
  const language = languageByCode(payload.c);
  if (!language) throw new ScriptGameError('unknown_language', 'That round names a language the corpus no longer has');

  const ladder = payload.l || 'world';
  const sizeKm = ladderSizeKm(ladder);
  const pin = guess && Number.isFinite(Number(guess.lat)) && Number.isFinite(Number(guess.lng))
    ? { lat: Number(guess.lat), lng: Number(guess.lng) }
    : null;
  const scored = pin ? scoreScriptGuess({ guess: pin, language, ladder, sizeKm }) : null;

  return {
    kind: 'script',
    roundIndex: payload.i,
    ladder,
    seed: payload.seed || '',
    sizeKm,
    score: scored ? scored.points : 0,
    distanceKm: scored ? scored.distanceKm : null,
    inRegion: scored ? scored.inRegion : false,
    // Where on the region's edge the distance was measured to, so the
    // reveal can draw the line to where the language starts.
    nearestPoint: scored ? scored.nearestPoint : null,
    alsoSpokenHere: scored ? scored.alsoSpokenHere : [],
    guess: pin,
    answer: {
      code: language.code,
      name: language.name,
      endonym: language.endonym,
      script: language.script,
      scriptName: SCRIPTS[language.script]?.name || language.script,
      family: language.family,
      branch: language.branch,
      speakers: language.speakers,
      // The shapes, not the definitions: unions of states, districts
      // and divisions, clipped where a language covers part of one
      // (server/regions.js). This is the only place they reach a
      // browser, and only once the answer is already out.
      regions: regionsForReveal(language),
    },
  };
}
