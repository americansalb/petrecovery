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

/*
 * The rules the game's one motion vocabulary rests on (app/geo/motion.css).
 * Each one is a mistake that is easy to make again, and each was found
 * on the live site rather than imagined.
 */
describe('the motion vocabulary', () => {
  const motion = sheets.find((s) => s.rel === 'motion.css');

  test('there is one, and the game layout loads it', () => {
    expect(motion).toBeTruthy();
    const layout = fs.readFileSync(path.join(GEO, 'layout.js'), 'utf8');
    expect(layout).toMatch(/import '\.\/motion\.css'/);
  });

  test('arrivals move with `translate`, which composes, never with `transform`, which replaces', () => {
    // The script artwork is tilted three degrees and the world marker
    // scaled for a phone, both with `transform`. An arrival animating
    // `transform` wipes that out for its length and snaps it back after.
    for (const name of ['pe-page-rise', 'pe-swap-in']) {
      const block = motion.css.slice(motion.css.indexOf(`@keyframes ${name}`));
      const body = block.slice(0, block.indexOf('}') + 1);
      expect({ name, usesTranslate: /translate:/.test(body), usesTransform: /transform:/.test(body) })
        .toEqual({ name, usesTranslate: true, usesTransform: false });
    }
  });

  test('nothing that arrives keeps its end state on the element', () => {
    // A held transform on an ancestor of the round (fixed inset-0) would
    // make it the containing block and shrink the game to its wrapper.
    for (const cls of ['.pe-page-enter', '.pe-page-enter--takeover', '.pe-swap', '.pe-fade-in']) {
      const at = motion.css.indexOf(`.geo-surface ${cls} {`);
      expect({ cls, found: at >= 0 }).toEqual({ cls, found: true });
      const rule = motion.css.slice(at, motion.css.indexOf('}', at));
      expect({ cls, fill: /\bbackwards\b/.test(rule), holds: /\b(both|forwards)\b/.test(rule) })
        .toEqual({ cls, fill: true, holds: false });
    }
  });

  test('the round and the room fade in and never move', () => {
    const at = motion.css.indexOf('.geo-surface .pe-page-enter--takeover {');
    const rule = motion.css.slice(at, motion.css.indexOf('}', at));
    expect(rule).toMatch(/pe-page-fade/);
    const fade = motion.css.slice(motion.css.indexOf('@keyframes pe-page-fade'));
    expect(fade.slice(0, fade.indexOf('}') + 1)).not.toMatch(/translate|transform/);
  });

  test('the press squash composes too, and leaves the primary key its own press', () => {
    expect(motion.css).toMatch(/:active \{\s*scale: 0\.97;/);
    expect(motion.css).toMatch(/:not\(\.pe-button--primary\)/);
  });

  test('asking for less motion really does switch the squash off', () => {
    // A shorter selector in the reduced block lost to the press rule's
    // :not() chain on specificity, and the squash played anyway -
    // caught in a browser with reduce-motion on. Same selector, later in
    // the file, wins.
    const press = motion.css.match(/(\.geo-surface :is\([^{]*):active \{\s*scale: 0\.97;/)[1];
    const reduced = motion.css.slice(motion.css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain(`${press}:active {\n    scale: none;`);
  });
});

describe('the reveal map frame', () => {
  const round = sheets.find((s) => s.rel.endsWith('round.css'));

  test('it does not animate layout on the way into a reveal', () => {
    // top/left/width/height laid the page out on every frame over a
    // WebGL panorama, and could not run anyway: `left: auto` does not
    // interpolate. openFromRect needs the box at its final size.
    const at = round.css.indexOf('.geo-map-frame:not(.transition-all) {');
    expect(at).toBeGreaterThanOrEqual(0);
    const rule = round.css.slice(at, round.css.indexOf('}', at));
    expect(rule).toMatch(/transition: none/);
    expect(rule).not.toMatch(/\b(top|left|width|height)\b/);
  });

  test("it leaves the guess card's own resize transition alone", () => {
    // A room's frame carries geo-map-frame while guessing too, and its
    // S/M/L resize is Tailwind's transition-all. A bare `.geo-map-frame
    // { transition: none }` outranked that by source order and made the
    // room's card snap between sizes.
    expect(round.css).not.toMatch(/\.geo-map-frame \{\s*transition: none/);
  });
});

describe('the front door', () => {
  const home = sheets.find((s) => s.rel === 'home.css');
  const experience = sheets.find((s) => s.rel === 'experience.css');

  test('the arrival does not pin the backdrop at full strength', () => {
    // With fill `both` the last keyframe held opacity 1 over Script
    // mode's dimmed backdrop for good: measured, the coastline never
    // dimmed behind the script artwork.
    const at = home.css.indexOf('.pe-home--immersive .pe-world-art {');
    const rule = home.css.slice(at, home.css.indexOf('}', at));
    expect(rule).toMatch(/pe-home-arrive[^;]*backwards/);
    expect(rule).not.toMatch(/pe-home-arrive[^;]*\bboth\b/);
  });

  test("Script's shade fades in over Street's instead of replacing it", () => {
    // A gradient cannot interpolate, so replacing the background snapped
    // the whole scene between the two games.
    expect(experience.css).toMatch(/\.pe-world-shade::after \{[^}]*opacity: 0;[^}]*transition: opacity/);
    expect(experience.css).toMatch(/\.pe-world--script \.pe-world-shade::after \{\s*opacity: 1;/);
  });
});

/*
 * The second pass: what still appeared or vanished in a single frame
 * after the pages and the reveal moved. Found by walking every overlay,
 * disclosure and room screen after #304 shipped.
 */
describe('things that open over the page', () => {
  const motion = sheets.find((s) => s.rel === 'motion.css');
  const rule = (selector) => {
    const at = motion.css.indexOf(`${selector} {`);
    expect({ selector, found: at >= 0 }).toEqual({ selector, found: true });
    return motion.css.slice(at, motion.css.indexOf('}', at));
  };
  const read = (rel) => fs.readFileSync(path.join(GEO, rel), 'utf8');

  test('the sign-in sheet rises in over a backdrop that dims in', () => {
    expect(rule('.geo-surface .pe-account-dialog[open]')).toMatch(/animation: pe-dialog-in [^;]*backwards/);
    expect(rule('.geo-surface .pe-account-dialog[open]::backdrop')).toMatch(/animation: pe-page-fade/);
    // ::backdrop does not inherit the tokens everywhere; a var() there
    // is an animation that silently does nothing in those browsers.
    expect(rule('.geo-surface .pe-account-dialog[open]::backdrop')).not.toMatch(/var\(/);
  });

  test('a disclosure opens instead of snapping', () => {
    expect(rule('.geo-surface details[open] > :not(summary)')).toMatch(/animation: pe-swap-in/);
    // The height only animates where the browser can interpolate to
    // `auto`; everywhere else it must open exactly as it always has.
    expect(motion.css).toMatch(/@supports \(interpolate-size: allow-keywords\) \{\s*\.geo-surface details \{/);
  });

  test("a room's card rises, and its dark stage is there at once", () => {
    // Fading the stage in would show the last round through it for a
    // quarter of a second on every change of screen.
    expect(rule('.geo-surface .pe-room-stage > div')).toMatch(/animation: pe-card-rise [^;]*backwards/);
    expect(motion.css).not.toMatch(/\.pe-room-stage \{[^}]*animation/);
    const panels = read('components/rooms/RoomPanels.js');
    for (const panel of ['LoadingPanel', 'LocatingPanel']) {
      const body = panels.slice(panels.indexOf(`export function ${panel}`));
      const markup = body.slice(0, body.indexOf('\n}\n'));
      // The spinner sits inside the arriving wrapper, never carrying
      // the arrival itself: the arrival's `animation` would replace its
      // spin and stop it.
      expect({ panel, wrapped: /<div className="pe-swap flex flex-col items-center">\s*<RefreshCw className="h-9 w-9 animate-spin/.test(markup) })
        .toEqual({ panel, wrapped: true });
    }
  });

  test('each sign-in step arrives as a new element', () => {
    // Same element type at the same place, so without a key React would
    // rewrite the step in place and the arrival would never replay.
    const card = read('components/SignInCard.js');
    for (const key of ['checking', 'error', 'account', 'sent', 'form']) {
      expect({ key, keyed: card.includes(`key="${key}"`) }).toEqual({ key, keyed: true });
    }
    expect(card).toMatch(/key="sent" className="pe-swap/);
    expect(card).toMatch(/key="form" className=\{`pe-swap /);
  });

  test("the bar's session control fades in, and nothing else in the bar moves", () => {
    const header = read('components/GeoHeader.js');
    expect(header).toMatch(/className="pe-header-cta pe-fade-in"/);
    expect(header).toMatch(/className="pe-header-who pe-fade-in"/);
    expect(header.match(/pe-fade-in|pe-swap|pe-stagger/g)).toHaveLength(2);
  });
});
