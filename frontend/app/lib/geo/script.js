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
 * One pool, and it is never shown. Every game draws from every language
 * the game has, and nothing tells the player what those are: no list,
 * no count, no sets to choose between (founder decision, 2026-09-23:
 * players should not know what could come up). The lobby used to offer
 * seven sets with a count beside each, and because this module listed
 * them, the whole corpus with its regions shipped to every browser that
 * opened the front page. So the corpus is server only now, and this
 * file, which the browser shares with the server, must not import
 * ./languages (__tests__/geo/coverage-secret.test.js).
 */

import { MAX_ROUND_SCORE } from './distance';

/** How long a round may last. 0 means no clock. */
export const SCRIPT_TIME_OPTIONS = [0, 30, 60, 120];
export const SCRIPT_ROUND_OPTIONS = [3, 5, 10];

/**
 * Scoring lives in `app/lib/geo/server/regions.js`, with the polygons.
 *
 * A language's regions are real administrative units now, not discs, so
 * scoring a pin means point-in-polygon against 129 KB of Natural Earth
 * boundaries. That belongs on the server: the browser has no use for
 * them (the reveal is sent the answer's rings and nothing else), and a
 * round payload must never carry anything the answer can be read from.
 * `scriptScaleKm`, `distanceToLanguage`, `languagesAt` and
 * `scoreScriptGuess` are all there.
 */

/** The most that can be lost on one round, for the HUD. */
export const SCRIPT_MAX_SCORE = MAX_ROUND_SCORE;

/**
 * Settings a link can carry, clamped to what the game supports.
 *
 * Links from before the one pool carry `ladder=`, naming the set they
 * were played on. It is ignored: they play the one pool like any other.
 */
export function normalizeScriptConfig(raw = {}) {
  const rounds = SCRIPT_ROUND_OPTIONS.includes(Number(raw.rounds)) ? Number(raw.rounds) : 5;
  const timer = SCRIPT_TIME_OPTIONS.includes(Number(raw.timer)) ? Number(raw.timer) : 0;
  const seed = typeof raw.seed === 'string' && raw.seed.trim() ? raw.seed.trim().slice(0, 40) : '';
  return { rounds, timer, seed };
}

/** Settings to a query string, so a link is a whole game. */
export function scriptConfigToQuery(config) {
  const params = new URLSearchParams();
  const normal = normalizeScriptConfig(config);
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
