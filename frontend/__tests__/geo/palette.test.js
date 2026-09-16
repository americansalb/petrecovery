/**
 * The game has its own colours.
 *
 * It used to render in `midnight` and `flash`, which are the pet site's
 * rescue palette: slate and a high-visibility yellow, chosen for lost
 * dog posters. On a geography game they were never a decision, just
 * what was already in the config.
 *
 * Founder direction, 2026-09-16: ocean blue, forest green, clay brown.
 * This test is what stops them being quietly replaced by whatever is
 * nearest to hand next time, the way they were the first time.
 *
 * The rule that the game uses NOTHING ELSE arrives with the rebuild
 * (docs/PROBABLY_EARTH_UI.md, phase 7): the old screens still carry the
 * old tokens until they are replaced, and a test that failed on those
 * would only be describing work already planned.
 */

/**
 * Read rather than required, deliberately.
 *
 * `__tests__/geo` counts as the game for isolation.test.js, and that
 * test's allowance list is empty on purpose: the game imports nothing
 * outside its own tree, so it stays one file move from its own
 * repository. Reading the config as text keeps that true while still
 * checking the thing that matters, which is what is actually declared.
 */
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, '../../tailwind.config.js'), 'utf8');

/** The steps of one ramp, pulled out of the config's text. */
function ramp(name) {
  const start = source.indexOf(`${name}: {`);
  if (start === -1) return null;
  const body = source.slice(start, source.indexOf('}', start));
  const steps = {};
  for (const [, step, hex] of body.matchAll(/(\d{2,3}):\s*'(#[0-9a-fA-F]{6})'/g)) steps[step] = hex.toLowerCase();
  return Object.keys(steps).length ? steps : null;
}

const colors = Object.fromEntries(['ocean', 'forest', 'clay', 'sand', 'midnight', 'flash'].map((name) => [name, ramp(name)]));
const RAMP = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

describe('the game has a palette of its own', () => {
  test('ocean, forest, clay and sand all exist', () => {
    for (const name of ['ocean', 'forest', 'clay', 'sand']) {
      expect({ name, present: Boolean(colors[name]) }).toEqual({ name, present: true });
    }
  });

  test('each is a full ramp, so a screen never runs out of a shade', () => {
    for (const name of ['ocean', 'forest', 'clay', 'sand']) {
      const missing = RAMP.filter((step) => !colors[name][step]);
      expect({ name, missing }).toEqual({ name, missing: [] });
    }
  });

  test('every step is a hex colour and the ramp actually gets darker', () => {
    const luminance = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      // Rough, and rough is enough: this is asking whether the ramp is
      // ordered, not measuring contrast.
      return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    };
    for (const name of ['ocean', 'forest', 'clay', 'sand']) {
      const ramp = RAMP.map((step) => colors[name][step]);
      for (const value of ramp) expect({ name, value }).toEqual({ name, value: expect.stringMatching(/^#[0-9a-f]{6}$/) });
      const light = ramp.map(luminance);
      const descending = light.every((value, i) => i === 0 || value < light[i - 1]);
      expect({ name, descending }).toEqual({ name, descending: true });
    }
  });

  test('they are distinguishable from each other, not three tints of one hue', () => {
    // The 500 of each is what a button uses. If two of those are close,
    // nothing on screen reads as a different kind of thing.
    const mid = ['ocean', 'forest', 'clay'].map((name) => colors[name][500]);
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    for (let a = 0; a < mid.length; a++) {
      for (let b = a + 1; b < mid.length; b++) {
        const [x, y] = [rgb(mid[a]), rgb(mid[b])];
        const apart = Math.sqrt(x.reduce((sum, value, i) => sum + (value - y[i]) ** 2, 0));
        expect({ pair: [mid[a], mid[b]], apart: apart > 60 }).toEqual({ pair: [mid[a], mid[b]], apart: true });
      }
    }
  });

  test('the pet site keeps its own, untouched', () => {
    // The game moving off them is not the same as deleting them: every
    // rescue page still renders in midnight and flash.
    expect(colors.midnight[900]).toBe('#0f172a');
    expect(colors.flash[400]).toBe('#facc15');
  });
});
