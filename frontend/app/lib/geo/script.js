/**
 * The script game: read a sentence, pin where that language is used.
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
/**
 * The pools.
 *
 * A description says what a pool IS and never how many languages are in
 * it. Every one of these used to carry a count or a list of names, and
 * every one had drifted: Devanagari said "five answers" while the pool
 * had grown to nine, Arabic named seven of thirteen, Cyrillic promised
 * "two that are not Slavic" out of nine. The screen renders the real
 * number from languagesForLadder(), which cannot drift.
 */
export const LADDERS = {
  world: {
    id: 'world',
    label: 'World',
    short: 'World',
    description: 'Every language, weighted by how many people speak it.',
    pick: () => LANGUAGES,
  },
  alphabets: {
    id: 'alphabets',
    label: 'Alphabets',
    short: 'Alphabets',
    description: 'A different writing system every round.',
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
    description: 'Languages and scripts of the subcontinent.',
    pick: () => LANGUAGES.filter((language) => SOUTH_ASIA.has(language.code)),
  },
  deva: {
    id: 'deva',
    label: 'Devanagari',
    short: 'Devanagari',
    description: 'Same alphabet, different languages. The script tells you nothing.',
    pick: () => languagesInScript('deva'),
  },
  arab: {
    id: 'arab',
    label: 'Arabic script',
    short: 'Arabic script',
    description: 'Many language families, a shared alphabet.',
    pick: () => languagesInScript('arab'),
  },
  cyrl: {
    id: 'cyrl',
    label: 'Cyrillic',
    short: 'Cyrillic',
    description: 'Slavic and not, sharing an alphabet.',
    pick: () => languagesInScript('cyrl'),
  },
  latn: {
    id: 'latn',
    label: 'Latin script',
    short: 'Latin script',
    description: 'The alphabet you are reading now, so every clue is in the words.',
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

/**
 * Split a sentence into runs so the reveal can highlight what gave the
 * language away.
 *
 * Returns `[{ text, marker }]` in order, `marker` being null for the
 * ordinary stretches. Overlapping markers are resolved by taking the
 * earliest and, where two start together, the longer: a player reading
 * the reveal wants one mark per feature, not marks inside marks.
 *
 * The markers are passed in rather than looked up, because the table
 * they come from is server only (app/lib/geo/server/markers.js) and
 * reaches the browser once, in the guess response, after the answer is
 * already out.
 */
export function highlightMarkers(text, markers = []) {
  if (!text) return [];
  const found = [];
  for (const marker of markers) {
    if (!marker?.text) continue;
    let from = 0;
    for (;;) {
      const at = text.indexOf(marker.text, from);
      if (at === -1) break;
      found.push({ start: at, end: at + marker.text.length, marker });
      from = at + marker.text.length;
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - a.end);

  const runs = [];
  let at = 0;
  for (const hit of found) {
    if (hit.start < at) continue;
    if (hit.start > at) runs.push({ text: text.slice(at, hit.start), marker: null });
    runs.push({ text: text.slice(hit.start, hit.end), marker: hit.marker });
    at = hit.end;
  }
  if (at < text.length) runs.push({ text: text.slice(at), marker: null });
  return runs;
}
