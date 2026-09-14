/**
 * The markers have to be true, or the reveal teaches the wrong thing.
 *
 * Two rules do the work. A marker has to be IN the language, or the
 * reveal has nothing to point at; and it has to be OUT of every other
 * language written in the same script, or it is not a marker at all, it
 * is a feature shared with exactly the language you would have confused
 * it with. Across scripts there is nothing to check, because the script
 * has already answered the round.
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
