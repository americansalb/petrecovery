/**
 * The script game: read a sentence, pin where that language is spoken.
 *
 * Why a pin rather than a dropdown of language names. A dropdown makes
 * the game a vocabulary test, and it makes every wrong answer equally
 * wrong: mistaking Marathi for Hindi scores the same zero as mistaking
 * it for Finnish, which is nonsense, because one of those is a
 * neighbouring Indo-Aryan language and the other is a different family
 * on a different continent. A pin scores what the player actually knew.
 *
 * It also fixes the flaw this mode was built to fix. Scoring against
 * country borders makes South Asia one tile: Tamil, Marathi, Bhojpuri
 * and Maithili all collapse into "India" and the round stops being
 * about language. Scoring against the regions a language is spoken in
 * keeps them apart (docs/GEO.md, "Script").
 *
 * The scale comes from the ladder. In the world ladder a pin on the
 * right continent is worth something; inside the India ladder, where
 * every answer is within one subcontinent, the same pin is worth almost
 * nothing and only the right state scores. Same scoring curve as a
 * geography round, so the two games' numbers mean the same thing.
 */

import { MAX_ROUND_SCORE } from './distance';
import { LANGUAGES, SCRIPTS, languagesInScript } from './languages';

/** How long a round may last. 0 means no clock. */
export const SCRIPT_TIME_OPTIONS = [0, 30, 60, 120];
export const SCRIPT_ROUND_OPTIONS = [3, 5, 10];

const SOUTH_ASIA = new Set(['hin', 'mar', 'npi', 'bho', 'mai', 'ben', 'asm', 'pan', 'guj', 'ory', 'urd', 'snd', 'tam', 'tel', 'kan', 'mal', 'sin']);

/**
 * The ladders, easiest first. `pick` returns the pool a round draws
 * from; anything that returns fewer than two languages is dropped from
 * the lobby rather than shipped as a round with one possible answer.
 */
export const LADDERS = {
  world: {
    id: 'world',
    label: 'World',
    short: 'World',
    description: 'Every language in the corpus, drawn by how many people speak it.',
    pick: () => LANGUAGES,
  },
  alphabets: {
    id: 'alphabets',
    label: 'Alphabets',
    short: 'Alphabets',
    description: 'One language per writing system. Learn to tell Devanagari from Bengali from Tamil before the rest of the game asks you to.',
    pick: () => {
      const seen = new Set();
      return LANGUAGES.filter((language) => {
        if (seen.has(language.script)) return false;
        seen.add(language.script);
        return true;
      });
    },
  },
  india: {
    id: 'india',
    label: 'South Asia',
    short: 'South Asia',
    description: 'Seventeen languages and eleven scripts inside one subcontinent. Every other game in this genre calls all of it India.',
    pick: () => LANGUAGES.filter((language) => SOUTH_ASIA.has(language.code)),
  },
  deva: {
    id: 'deva',
    label: 'Devanagari',
    short: 'Devanagari',
    description: 'Hindi, Marathi, Nepali, Bhojpuri, Maithili. Same alphabet, five answers, and the script tells you nothing.',
    pick: () => languagesInScript('deva'),
  },
  arab: {
    id: 'arab',
    label: 'Arabic script',
    short: 'Arabic script',
    description: 'Arabic, Persian, Urdu, Pashto, Kurdish, Sindhi, Uyghur. Four families, one alphabet.',
    pick: () => languagesInScript('arab'),
  },
  cyrl: {
    id: 'cyrl',
    label: 'Cyrillic',
    short: 'Cyrillic',
    description: 'Russian, Ukrainian, Bulgarian, Serbian, and two that are not Slavic at all.',
    pick: () => languagesInScript('cyrl'),
  },
  latn: {
    id: 'latn',
    label: 'Latin script',
    short: 'Latin script',
    description: 'The hardest pool. The alphabet is the one you are reading now, so every clue is in the words.',
    pick: () => languagesInScript('latn'),
  },
};

export const LADDER_ORDER = ['world', 'alphabets', 'india', 'deva', 'arab', 'cyrl', 'latn'];

export function ladderById(id) {
  return LADDERS[id] || LADDERS.world;
}

/** The pool a ladder draws from, always at least two languages. */
export function languagesForLadder(id) {
  const pool = ladderById(id).pick();
  return pool.length >= 2 ? pool : LANGUAGES;
}

/**
 * Scoring lives in `app/lib/geo/server/regions.js`, with the polygons.
 *
 * A language's regions are real administrative units now, not discs, so
 * scoring a pin means point-in-polygon against 129 KB of Natural Earth
 * boundaries. That belongs on the server: the browser has no use for
 * them (the reveal is sent the answer's rings and nothing else), and a
 * round payload must never carry anything the answer can be read from.
 * `ladderSizeKm`, `distanceToLanguage`, `languagesAt` and
 * `scoreScriptGuess` are all there.
 */

/** The most that can be lost on one round, for the HUD. */
export const SCRIPT_MAX_SCORE = MAX_ROUND_SCORE;

export function scriptName(id) {
  return SCRIPTS[id]?.name || id;
}

/** Settings a link can carry, clamped to what the game supports. */
export function normalizeScriptConfig(raw = {}) {
  const ladder = LADDERS[raw.ladder] ? raw.ladder : 'world';
  const rounds = SCRIPT_ROUND_OPTIONS.includes(Number(raw.rounds)) ? Number(raw.rounds) : 5;
  const timer = SCRIPT_TIME_OPTIONS.includes(Number(raw.timer)) ? Number(raw.timer) : 0;
  const seed = typeof raw.seed === 'string' && raw.seed.trim() ? raw.seed.trim().slice(0, 40) : '';
  return { ladder, rounds, timer, seed };
}

/** Settings to a query string, so a link is a whole game. */
export function scriptConfigToQuery(config) {
  const params = new URLSearchParams();
  const normal = normalizeScriptConfig(config);
  params.set('ladder', normal.ladder);
  params.set('rounds', String(normal.rounds));
  if (normal.timer) params.set('timer', String(normal.timer));
  if (normal.seed) params.set('seed', normal.seed);
  return params.toString();
}
