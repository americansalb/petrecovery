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
 * the same sentences in the same order. The secret is what stops anyone
 * doing the same arithmetic: the seed is in the address bar and the
 * draw is one weighted pick per round, so without it the whole answer
 * sequence is computable from the language list before the first
 * sentence is read. The list stays on the server now
 * (app/lib/geo/script.js says why), but the secret does not rely on
 * that: a list is a small thing to leak.
 *
 * Nothing here costs money. There is no imagery provider, no metadata
 * probe and no key, so script rounds do not touch the play meter
 * (docs/GEO.md, "The play meter"). That is not generosity, it is
 * arithmetic: a text round has no marginal cost to meter.
 */

import { createHash } from 'crypto';
import { createRng, roundSeed, weightedIndex } from '../random';
import { normalizeScriptConfig } from '../script';
import { regionsForReveal, scoreScriptGuess, scriptScaleKm } from './regions';
import { LANGUAGES, SCRIPTS, languageByCode } from '../languages';
import { samplesFor } from './samples';
import { markersIn } from './markers';
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
 * A seed nobody outside the server can reproduce. Everything else the
 * draw reads - the language rows, the speaker counts, the generator -
 * is code, so the secret is the only part that cannot leak with it.
 */
function saltedSeed(seed, purpose, secret) {
  if (!secret) return `${seed}#${purpose}`;
  // The literal is the game's old name on purpose. This salt decides
  // which language a seed draws, so changing it rerolls every seeded
  // round ever played: today's daily becomes a different five, and
  // every board recorded against the old ones stops meaning anything.
  // A name on a screen is worth renaming; a name inside a hash is not.
  return createHash('sha256').update(`wanderguesser-script:${purpose}:${secret}:${seed}`).digest('hex').slice(0, 32);
}

/**
 * The languages for a whole game, in order, drawn without replacement
 * from every language there is, so a five-round game is five different
 * answers. A pool smaller than the round count would refill and may
 * then repeat, which beats refusing to start.
 *
 * The order of LANGUAGES is part of every seed: the world pool was
 * always this array, so a seeded game from before the other pools were
 * removed draws the same languages it did.
 */
export function drawLanguages(config, secret = '') {
  const { rounds, seed } = normalizeScriptConfig(config);
  const source = LANGUAGES;
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

  const text = passageFor(language, config.seed, index, tokenSecret);
  if (!text) throw new ScriptGameError('no_samples', `No sample text for ${language.name}`);

  return {
    roundIndex: index,
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
    // cannot be removed while the browser chooses the font. It does not
    // matter much, because the script is on screen anyway.
    script: language.script,
    text,
    token: sealToken({ c: language.code, i: index, seed: config.seed || '' }, { secret: tokenSecret, now }),
  };
}

/**
 * How much a round shows before it is enough to read a language from.
 *
 * A round used to be one sentence, and half the corpus is under forty
 * characters: "Dit was baie mooi." is four words, and nobody can be
 * expected to place Afrikaans from four words (founder, 2026-09-25). So
 * a round is a short passage now: sentences of the same language, taken
 * in a seeded order, until the passage is long enough. A sentence from
 * the Universal Declaration usually is on its own; a Tatoeba line
 * usually takes two or three. Han and Japanese carry a word in one or
 * two characters, so they need fewer.
 *
 * The cap was four at first, and a language whose lines are all short
 * came out under ninety characters: Limburgish every round, Kashubian
 * and Karachay-Balkar one round in three. Six lets those reach it; a
 * language with long sentences stops well before the cap either way.
 */
const PASSAGE_MIN_CHARS = 90;
const DENSE_PASSAGE_MIN_CHARS = 30;
const DENSE_SCRIPTS = new Set(['hans', 'jpan']);
const PASSAGE_MAX_SENTENCES = 6;

/**
 * The text a round shows. Drawn from the seed, the round index and the
 * server's secret, so it is the same text every time that round is
 * built: the guess endpoint recomputes it rather than carrying it in the
 * token, which keeps the token small and keeps the text out of anything
 * the browser could tamper with.
 */
function passageFor(language, seed, index, tokenSecret) {
  const samples = samplesFor(language.code);
  if (!samples.length) return '';
  const rng = createRng(saltedSeed(roundSeed(seed || 'script', index), 'text', tokenSecret));
  const order = [...samples];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const dense = DENSE_SCRIPTS.has(language.script);
  const enough = dense ? DENSE_PASSAGE_MIN_CHARS : PASSAGE_MIN_CHARS;
  const picked = [];
  let length = 0;
  for (const sentence of order) {
    picked.push(sentence);
    length += [...sentence].length;
    if (length >= enough || picked.length >= PASSAGE_MAX_SENTENCES) break;
  }
  // Han and Japanese sentences end in their own full stop and run on
  // without a space; everything else is separated by one.
  return picked.join(dense ? '' : ' ');
}

/**
 * The round a token was sealed for: its language and the text it
 * showed. For a report about a round (server/reports.js), which has to
 * name what the server dealt rather than what the browser says.
 */
export function scriptRoundFromToken({ token, now = Date.now(), env } = {}) {
  const { tokenSecret } = getGeoServerConfig(env);
  const payload = openToken(token, { secret: tokenSecret, now });
  const language = languageByCode(payload.c);
  if (!language) throw new ScriptGameError('unknown_language', 'That round names a language the corpus no longer has');
  return { language, roundIndex: payload.i, text: passageFor(language, payload.seed, payload.i, tokenSecret) };
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

  // Tokens sealed before the one pool also name the set they were drawn
  // from (payload.l). Every guess is scored on the one scale now.
  const sizeKm = scriptScaleKm();
  const pin = guess && Number.isFinite(Number(guess.lat)) && Number.isFinite(Number(guess.lng))
    ? { lat: Number(guess.lat), lng: Number(guess.lng) }
    : null;
  const scored = pin ? scoreScriptGuess({ guess: pin, language, sizeKm }) : null;
  // The sentence that was on screen, so the reveal can point at the
  // things in it that gave the language away.
  const text = passageFor(language, payload.seed, payload.i, tokenSecret);

  return {
    kind: 'script',
    roundIndex: payload.i,
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
      // What a player who knew the answer would have known it from,
      // narrowed to the features actually present in the sentence they
      // read (server/markers.js). Sent here and nowhere else: a marker
      // is a string that identifies a language, so shipping the table
      // to the browser would hand over every round before the guess.
      markers: markersIn(language.code, text),
    },
  };
}
