/**
 * Text handling for the /rasuwa letter PDF.
 *
 * The PDF embeds two vendored fonts (public/rasuwa/fonts): Noto Serif
 * for Latin (including the transliteration marks in Indic and Nepali
 * names: Ś, ṇ, ā) and Noto Serif Devanagari for Devanagari script.
 * react-pdf has no automatic font fallback, so paragraphs are split into
 * runs per script and each run gets the right family.
 *
 * pdf-font-coverage.json is generated FROM the vendored font files (see
 * the note in that file's sibling fonts directory), so the "this cannot
 * print" warning can never disagree with what the fonts actually hold.
 * Before these fonts, the built-in Times-Roman silently mangled anything
 * outside Latin-1: "Śrestha" printed as "Zrestha" and Devanagari printed
 * as garbage, with no error raised.
 */

import coverage from './pdf-font-coverage.json';

const RANGES = coverage.ranges;

// Devanagari block plus its extensions; a run may span internal spaces
// and danda punctuation so a name stays one shaped run.
const DEVA_RUN = /([ऀ-ॿ꣠-ꣿ][ऀ-ॿ꣠-ꣿ\s]*[ऀ-ॿ꣠-ꣿ]|[ऀ-ॿ꣠-ꣿ])/;

export function isPrintable(codePoint) {
  for (const [start, end] of RANGES) {
    if (codePoint < start) return false;
    if (codePoint <= end) return true;
  }
  return false;
}

/**
 * Unique characters in text the embedded fonts cannot render, in first
 * appearance order, capped for display.
 */
export function findUnprintableChars(text, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const ch of String(text || '')) {
    const cp = ch.codePointAt(0);
    if (isPrintable(cp) || seen.has(cp)) continue;
    seen.add(cp);
    if (out.length < limit) out.push(ch);
  }
  return out;
}

/**
 * One paragraph into font runs: [{ text, deva }] where deva marks
 * Devanagari segments that need the Devanagari family.
 */
export function splitScriptRuns(text) {
  const parts = String(text || '').split(DEVA_RUN);
  const runs = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;
    runs.push({ text: part, deva: i % 2 === 1 });
  }
  return runs;
}
