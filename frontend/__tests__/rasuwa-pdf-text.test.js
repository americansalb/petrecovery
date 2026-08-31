/**
 * /rasuwa PDF text handling (pdfText.js): script-run splitting for the
 * two embedded fonts, and the cannot-print warning. The coverage table
 * is generated from the vendored font files, so these tests also catch a
 * font swap that quietly drops the characters this tool exists for.
 */

const { findUnprintableChars, isPrintable, splitScriptRuns } = require('@/app/rasuwa/pdfText');

describe('coverage (generated from the vendored fonts)', () => {
  test('the names this tool is for are printable', () => {
    // Latin with Indic transliteration marks, and Devanagari.
    for (const ch of 'Poonam Thakkar Śrestha ṇā ī Renée Muñoz पूनम ठक्कर ।') {
      expect(isPrintable(ch.codePointAt(0))).toBe(true);
    }
  });

  test('letter punctuation is printable', () => {
    for (const ch of '"\'()[]:;,.$0189-\n') {
      expect(isPrintable(ch.codePointAt(0))).toBe(true);
    }
  });

  test('scripts the fonts do not hold are flagged', () => {
    expect(isPrintable('அ'.codePointAt(0))).toBe(false); // Tamil
    expect(isPrintable('中'.codePointAt(0))).toBe(false); // CJK
  });
});

describe('findUnprintableChars', () => {
  test('clean letters produce no warning', () => {
    expect(findUnprintableChars('Dear Senator: my sister Śrestha, of Kathmandu (पूनम), is missing.')).toEqual([]);
    expect(findUnprintableChars('')).toEqual([]);
    expect(findUnprintableChars(null)).toEqual([]);
  });

  test('unsupported characters are listed once each, in order, capped', () => {
    expect(findUnprintableChars('name அ and 中 and அ again')).toEqual(['அ', '中']);
    expect(findUnprintableChars('阿阿一二三四五六七八九十', 8)).toHaveLength(8);
  });
});

describe('splitScriptRuns', () => {
  test('pure Latin is one base run', () => {
    expect(splitScriptRuns('Dear Senator Durbin:')).toEqual([
      { text: 'Dear Senator Durbin:', deva: false },
    ]);
  });

  test('a Devanagari name inline becomes its own run', () => {
    expect(splitScriptRuns('my sister पूनम ठक्कर is missing')).toEqual([
      { text: 'my sister ', deva: false },
      { text: 'पूनम ठक्कर', deva: true },
      { text: ' is missing', deva: false },
    ]);
  });

  test('pure Devanagari is one run and empty input is none', () => {
    expect(splitScriptRuns('पूनम')).toEqual([{ text: 'पूनम', deva: true }]);
    expect(splitScriptRuns('')).toEqual([]);
  });

  test('runs reassemble to the original text', () => {
    const text = 'A (अ) then पूनम ठक्कर। end.';
    expect(splitScriptRuns(text).map((r) => r.text).join('')).toBe(text);
  });
});
