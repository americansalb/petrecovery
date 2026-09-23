/**
 * The markers have to be true, or the reveal teaches the wrong thing.
 *
 * Four rules do the work.
 *
 * A marker has to be IN the language, or the reveal has nothing to
 * point at. It has to be OUT of every other language written in the
 * same script, or it is not a marker at all, it is a feature shared
 * with exactly the language you would have confused it with. Across
 * scripts there is nothing to check, because the script has already
 * answered the round.
 *
 * Those two are not enough on their own, and a live round proved it.
 * Wolof came up, the sentence shown was `Dafay dem liggeey ci tank bes
 * bu nekk`, and the one marker in it was `tank`, noted as "foot, with a
 * grave accent marking an open vowel". Both rules passed: the word is
 * Wolof, and no rival's three sentences happened to contain it. It
 * still told the player nothing, because a grave accent on a vowel is
 * in French, Italian, Portuguese, Catalan and Vietnamese, and knowing
 * that one is there gets you no closer to Senegal. It was a description
 * of a glyph wearing a marker's clothes.
 *
 * So a note must DISCRIMINATE: name the language it rules out, or claim
 * outright that nothing else does this. "Tea. Marathi chaha, Nepali
 * chiya" is a marker. "A word with an accent in it" is not, however
 * true. And at least one marker in every sentence has to clear that bar
 * on its own, because the reveal can only point at what is on screen,
 * and the round that goes wrong is the one where the only thing on
 * screen is the weak one.
 */

import { LANGUAGES } from '@/app/lib/geo/languages';
import { SAMPLES } from '@/app/lib/geo/server/samples';
import { MARKERS, markersFor, markersIn } from '@/app/lib/geo/server/markers';
import { highlightMarkers } from '@/app/lib/geo/script';

const byCode = new Map(LANGUAGES.map((language) => [language.code, language]));

describe('the markers', () => {
  test('every language has some, and every marker carries a note', () => {
    const missing = LANGUAGES.filter((language) => markersFor(language.code).length === 0);
    expect(missing.map((l) => l.code)).toEqual([]);
    for (const [code, markers] of Object.entries(MARKERS)) {
      expect(byCode.has(code)).toBe(true);
      for (const marker of markers) {
        expect(typeof marker.text).toBe('string');
        expect(marker.text.length).toBeGreaterThan(0);
        expect(marker.note.length).toBeGreaterThan(20);
        // House style, and it applies to anything a player reads.
        expect(marker.note).not.toMatch(/—/);
      }
    }
  });

  test('every marker really occurs in the language it marks', () => {
    const absent = [];
    for (const [code, markers] of Object.entries(MARKERS)) {
      const samples = SAMPLES[code] || [];
      for (const marker of markers) {
        if (!samples.some((sample) => sample.includes(marker.text))) absent.push(`${code}: ${marker.text}`);
      }
    }
    expect(absent).toEqual([]);
  });

  test('every sample carries at least one marker, so no round reveals with nothing to teach', () => {
    const bare = [];
    for (const [code, samples] of Object.entries(SAMPLES)) {
      samples.forEach((sample, index) => {
        if (!markersIn(code, sample).length) bare.push(`${code}[${index}] ${sample}`);
      });
    }
    expect(bare).toEqual([]);
  });

  // Everything a note may point at. The pool's own languages, plus the
  // real-world confusables that are not in it: Inuktitut's tell is that
  // Cree does not do the same thing, and Cree is not a round here.
  const OUTSIDE = [
    'Arabic', 'Persian', 'Spanish', 'French', 'Greek', 'Latin', 'English', 'Portuguese', 'Italian',
    'German', 'Dutch', 'Russian', 'Turkish', 'Chinese', 'Japanese', 'Korean', 'Romance', 'Slavic',
    'Bantu', 'Turkic', 'Cyrillic', 'Devanagari', 'Cree', 'Ewe', 'Ga', 'Aymara', 'Pulaar', 'Kirundi',
    'Igbo', 'Xhosa', 'Welsh', 'Gaelic', 'Malay', 'Vietnamese', 'Adlam', 'Mayek', 'Shahmukhi',
  ];
  const NAMES = new Set(OUTSIDE);
  for (const language of LANGUAGES) for (const word of language.name.split(' ')) if (/^[A-Z]/.test(word)) NAMES.add(word);

  // Or, failing a name, a comparison: standing alone, or standing
  // against the field. Both tell a player what the feature buys them.
  const ALONE =
    /\bno other\b|\bonly\b|\bnothing else\b|\bnever\b|\bnot in\b|\bunlike\b|\bimpossible\b|\bunique\b|\brelated to nothing\b|\bthe others\b|\bthan any other\b|\balmost no\b|\bthe fewest\b|\bthe longest\b|\bthe shortest\b|\belsewhere\b|\bno \w+(?:,| or)[^.]*\bat all\b|\bhas no\b/i;

  // Naming yourself is not ruling anything out. "Wolof doubles vowels
  // for length" reads like a fact about Wolof and is one, but Finnish,
  // Estonian, Somali and Dutch double vowels too, and the player is
  // trying to choose between them. So a language's own name does not
  // count towards its notes.
  const discriminates = (note, own = '') => {
    if (ALONE.test(note)) return true;
    // Only the language's OWN name is struck out. For a two word name
    // the head noun belongs to somebody else: Egyptian Arabic earns its
    // markers by saying what Standard Arabic writes instead, and Arabic
    // is a round of its own here.
    const mine = new Set([own, ...(own.includes(' ') ? [] : [own])]);
    return [...NAMES].some((name) => !mine.has(name) && new RegExp(`\\b${name}\\b`).test(note));
  };

  // Where a language is the only one in its script, the alphabet has
  // already answered the round, and those notes are free to be about
  // the writing system. Everywhere else there is a rival on screen and
  // the note has to beat it.
  const contested = (code) => {
    const script = byCode.get(code)?.script;
    return LANGUAGES.some((l) => l.script === script && l.code !== code);
  };

  test('every note rules something out, instead of describing a letter', () => {
    const limp = [];
    for (const [code, markers] of Object.entries(MARKERS)) {
      if (!contested(code)) continue;
      for (const marker of markers) {
        const own = byCode.get(code)?.name || '';
        if (!discriminates(marker.note, own)) limp.push(`${code}: ${marker.text} :: ${marker.note}`);
      }
    }
    expect(limp).toEqual([]);
  });

  test('every sample carries a marker that rules something out on its own', () => {
    const thin = [];
    for (const [code, samples] of Object.entries(SAMPLES)) {
      if (!contested(code)) continue;
      samples.forEach((sample, index) => {
        const found = markersIn(code, sample);
        const own = byCode.get(code)?.name || '';
        if (!found.some((marker) => discriminates(marker.note, own))) thin.push(`${code}[${index}] ${sample}`);
      });
    }
    expect(thin).toEqual([]);
  });

  test('no marker appears in another language written in the same script', () => {
    const shared = [];
    for (const [code, markers] of Object.entries(MARKERS)) {
      const script = byCode.get(code)?.script;
      const rivals = LANGUAGES.filter((l) => l.script === script && l.code !== code);
      for (const marker of markers) {
        for (const rival of rivals) {
          const hit = (SAMPLES[rival.code] || []).find((sample) => sample.includes(marker.text));
          if (hit) shared.push(`${code}'s "${marker.text}" also in ${rival.code}: ${hit}`);
        }
      }
    }
    expect(shared).toEqual([]);
  });
});

describe('reading the markers out of a sentence', () => {
  test('returns the ones on screen, in the order they appear', () => {
    const sample = SAMPLES.mar[0];
    const found = markersIn('mar', sample);
    expect(found.length).toBeGreaterThan(0);
    for (const marker of found) expect(sample).toContain(marker.text);
    const positions = found.map((marker) => sample.indexOf(marker.text));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  test('a sentence from another language matches nothing', () => {
    expect(markersIn('mar', SAMPLES.hin[0])).toEqual([]);
  });
});

describe('marking the sentence up', () => {
  test('splits it into the marked runs and the rest, in order', () => {
    const runs = highlightMarkers('abcXYdefXY', [{ text: 'XY', note: 'n' }]);
    expect(runs.map((run) => run.text)).toEqual(['abc', 'XY', 'def', 'XY']);
    expect(runs.map((run) => Boolean(run.marker))).toEqual([false, true, false, true]);
    expect(runs.map((run) => run.text).join('')).toBe('abcXYdefXY');
  });

  test('never marks inside a mark: the longer feature wins where two start together', () => {
    const runs = highlightMarkers('xaby', [{ text: 'a', note: 'n' }, { text: 'ab', note: 'n' }]);
    expect(runs.map((run) => run.text)).toEqual(['x', 'ab', 'y']);
  });

  test('puts the sentence back together whatever it is given', () => {
    for (const [code, samples] of Object.entries(SAMPLES)) {
      for (const sample of samples) {
        expect(highlightMarkers(sample, markersFor(code)).map((run) => run.text).join('')).toBe(sample);
      }
    }
  });

  test('a sentence with nothing to mark is one plain run', () => {
    expect(highlightMarkers('nothing here', [{ text: 'zz', note: 'n' }])).toEqual([{ text: 'nothing here', marker: null }]);
    expect(highlightMarkers('', [])).toEqual([]);
  });
});
