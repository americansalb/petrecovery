/**
 * Motion the game adds is motion somebody can turn off.
 *
 * Every animated class in the game's stylesheets has to be named in a
 * prefers-reduced-motion block in the same file. A player who has asked
 * their system for less motion gets the end state, not a compromise and
 * not the animation anyway.
 *
 * Modelled on palette.test.js, which has kept the colours honest.
 */

const fs = require('fs');
const path = require('path');

const GEO = path.resolve(__dirname, '../../app/geo');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.css')) out.push(full);
  }
  return out;
}

const sheets = walk(GEO).map((file) => ({ file, rel: path.relative(GEO, file), css: fs.readFileSync(file, 'utf8') }));

test('the game has stylesheets to check', () => {
  expect(sheets.length).toBeGreaterThan(0);
});

test('every stylesheet that animates has a reduced-motion block', () => {
  const missing = sheets
    .filter((s) => /@keyframes/.test(s.css) && !/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(s.css))
    .map((s) => s.rel);
  expect(missing).toEqual([]);
});

test('every class that carries an animation is named in that block', () => {
  const offenders = [];
  for (const { rel, css } of sheets) {
    if (!/@keyframes/.test(css)) continue;
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    // Classes whose rule body sets `animation:` to a keyframe rather
    // than to none. A selector that only appears inside the reduced
    // block is the switch-off itself, not an animation.
    const before = css.slice(0, css.indexOf('@media (prefers-reduced-motion: reduce)'));
    for (const match of before.matchAll(/([.\w-]*\.[\w-]+)\s*\{[^}]*animation:\s*(?!none)[^};]+;/g)) {
      const selector = match[1];
      const bare = selector.slice(selector.lastIndexOf('.'));
      if (!reduced.includes(bare)) offenders.push(`${rel}: ${selector} animates and reduced motion never mentions it`);
    }
  }
  expect(offenders).toEqual([]);
});

test('the reveal moves at all', () => {
  // The screen the founder called 1980s was a panel that appeared over
  // a frame that snapped, with both numbers already final. If this file
  // stops animating, that is what it is back to.
  const round = sheets.find((s) => s.rel.endsWith('round.css'));
  expect(round).toBeTruthy();
  for (const name of ['geo-map-frame', 'geo-reveal-panel', 'geo-award']) {
    expect({ name, there: round.css.includes(name) }).toEqual({ name, there: true });
  }
});
