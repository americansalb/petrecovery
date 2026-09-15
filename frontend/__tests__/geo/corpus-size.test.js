/**
 * The corpus has to stay big enough that playing twice is not reading
 * all of it.
 *
 * It was 415 sentences: two or three per language, saying the same few
 * things in all 159, which meant a regular player had seen every one of
 * them by their second game. Tatoeba took it past 800
 * (scripts/build-script-corpus.js). This pins that, because a corpus is
 * exactly the kind of thing that shrinks quietly when somebody deletes a
 * line that broke a test.
 */

import { LANGUAGES } from '@/app/lib/geo/languages';
import { SAMPLES } from '@/app/lib/geo/server/samples';
import { markersIn } from '@/app/lib/geo/server/markers';

const counts = LANGUAGES.map((language) => (SAMPLES[language.code] || []).length);

describe('how much there is to read', () => {
  test('every language has at least two sentences and the pool is over eight hundred', () => {
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(2);
    expect(counts.reduce((a, b) => a + b, 0)).toBeGreaterThan(800);
  });

  test('most of the pool has more than the three it started with', () => {
    const roomy = counts.filter((n) => n > 3).length;
    expect(roomy).toBeGreaterThan(60);
  });

  test('no language repeats a sentence', () => {
    const repeats = [];
    for (const language of LANGUAGES) {
      const list = SAMPLES[language.code] || [];
      if (new Set(list).size !== list.length) repeats.push(language.code);
    }
    expect(repeats).toEqual([]);
  });

  test('no sentence is shared between two languages', () => {
    // Two languages with the same sentence is either a copied line or a
    // pair close enough that the round has no answer.
    const seen = new Map();
    const shared = [];
    for (const language of LANGUAGES) {
      for (const text of SAMPLES[language.code] || []) {
        if (seen.has(text) && seen.get(text) !== language.code) shared.push(`${seen.get(text)} and ${language.code}: ${text}`);
        seen.set(text, language.code);
      }
    }
    expect(shared).toEqual([]);
  });

  test('every sentence still teaches something, however it got here', () => {
    // The Tatoeba sentences were selected for carrying a marker. This
    // checks the ones on disk rather than the selection that made them.
    const bare = [];
    for (const language of LANGUAGES) {
      for (const text of SAMPLES[language.code] || []) {
        if (!markersIn(language.code, text).length) bare.push(`${language.code}: ${text}`);
      }
    }
    expect(bare).toEqual([]);
  });
});
