/**
 * The "your device has no font for this" warning, which had no test and
 * accused a device that was rendering the sentence perfectly well.
 *
 * The old check compared glyph WIDTHS against the width of the .notdef
 * box. A .notdef box is usually one em wide, and so is every glyph in
 * Chinese, Japanese and Korean, so a correctly rendered CJK sentence
 * measured as 100% boxes and got the warning. It now compares pixels,
 * and the fake canvas below is built to tell those two cases apart: a
 * glyph can be exactly as wide as the box and look nothing like it.
 */

import { measureTofu } from '@/app/geo/components/script/ScriptSample';

const CELL = 48;
const SIZE = CELL * CELL * 4;

/**
 * A canvas whose glyphs are whatever the test says they are.
 *
 * `glyphs` maps a character to `{ width, ink }`. `ink` is the number
 * painted into every pixel, so two characters look identical exactly
 * when their ink matches. A character with no entry is drawn as the
 * box, which is what a font without the glyph does.
 */
function fakeCanvas(glyphs, { box = { width: 32, ink: 1 }, noPixels = false } = {}) {
  let current = box;
  return () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      set font(value) {
        this._font = value;
      },
      get font() {
        return this._font;
      },
      textBaseline: '',
      measureText: (ch) => ({ width: (glyphs[ch] || box).width }),
      clearRect: () => {},
      fillText: (ch) => {
        current = glyphs[ch] || box;
      },
      getImageData: () => {
        if (noPixels) throw new Error('tainted canvas');
        return { data: new Uint8ClampedArray(SIZE).fill(current.ink) };
      },
    }),
  });
}

const BOX = { width: 32, ink: 1 };

describe('spotting a device with no font for the script', () => {
  test('a sentence drawn entirely as boxes is reported', () => {
    // Nothing in `glyphs`, so every character falls through to the box.
    expect(measureTofu('ꯅꯨꯃꯤꯠ ꯈꯨꯗꯤꯡ', 'X', fakeCanvas({}))).toBe(true);
  });

  test('CJK renders at exactly box width and must NOT be reported', () => {
    // The bug. Every one of these is one em wide, the same as the box,
    // and every one of them is a real glyph.
    const text = '今天早上很冷所以我喝了热茶';
    const glyphs = {};
    for (const ch of text) glyphs[ch] = { width: 32, ink: 200 };
    expect(measureTofu(text, 'X', fakeCanvas(glyphs))).toBe(false);
  });

  test('one missing glyph in a rendered sentence is not a missing font', () => {
    const text = 'abcdefghij';
    const glyphs = {};
    for (const ch of text) glyphs[ch] = { width: 18, ink: 90 };
    delete glyphs.j;
    expect(measureTofu(text, 'X', fakeCanvas(glyphs))).toBe(false);
  });

  test('a sentence too short to judge is left alone', () => {
    expect(measureTofu('ab', 'X', fakeCanvas({}))).toBe(false);
    expect(measureTofu('', 'X', fakeCanvas({}))).toBe(false);
  });

  test('spaces and zero width marks are not counted either way', () => {
    // Four real glyphs and a lot of whitespace: still judged on the four.
    const glyphs = { a: { width: 18, ink: 90 }, b: { width: 18, ink: 90 }, c: { width: 18, ink: 90 }, d: { width: 18, ink: 90 } };
    expect(measureTofu('a b c d', 'X', fakeCanvas(glyphs))).toBe(false);
  });

  test('a canvas that will not give up its pixels says nothing', () => {
    // Cannot tell is not the same as broken, and a wrong warning is
    // worse than no warning.
    expect(measureTofu('ꯅꯨꯃꯤꯠ ꯈꯨꯗꯤꯡ', 'X', fakeCanvas({}, { noPixels: true }))).toBe(false);
  });

  test('no canvas at all says nothing', () => {
    expect(measureTofu('ꯅꯨꯃꯤꯠ', 'X', () => null)).toBe(false);
    expect(measureTofu('ꯅꯨꯃꯤꯠ', 'X', () => ({ getContext: () => null }))).toBe(false);
  });

  test('a box with no width means the measurement is not working', () => {
    expect(measureTofu('ꯅꯨꯃꯤꯠ ꯈꯨꯗꯤꯡ', 'X', fakeCanvas({}, { box: { width: 0, ink: 1 } }))).toBe(false);
  });
});
