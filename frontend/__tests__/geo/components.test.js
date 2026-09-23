/**
 * The game is built from a small set of components.
 *
 * docs/PROBABLY_EARTH_UI.md phase 1: "Colour tokens, type scale,
 * spacing, and the small set of components every screen is built from.
 * First, because anything built before it gets built twice." It was
 * marked Done with only the colour tokens finished, and everything
 * after it was built twice: 24 hand-written spellings of
 * `rounded-2xl border ...` across the screens, each reasonable on the
 * day, adding up to a product that looks like six products.
 *
 * So: a card is app/geo/components/ui/Card.js. The exceptions below are
 * the things that are not cards - the map frame, the sheet a phone
 * opens, the toasts over the imagery, the tinted notices - and each one
 * is named. Anything else fails here.
 *
 * Modelled on palette.test.js, which has kept the colours honest.
 */

const fs = require('fs');
const path = require('path');

const GEO = path.resolve(__dirname, '../../app/geo');
const UI = path.join(GEO, 'components/ui');

/**
 * Not cards. Each is a surface with a job the card does not do, and the
 * reason is here so the next person can tell a real exception from an
 * unconverted one.
 */
const NOT_CARDS = {
  'components/PlayClient.js': 'the map frame, and the sheet a phone slides the map up in',
  'components/RoomClient.js': 'the same map frame, plus the two toasts over the imagery',
  'components/SetupNotice.js': 'a tinted notice, not a surface things sit on',
};

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = walk(GEO).filter((f) => !f.startsWith(UI));

test('a card is Card, not another spelling of rounded-2xl border', () => {
  const offenders = [];
  for (const file of files) {
    const rel = path.relative(GEO, file);
    if (NOT_CARDS[rel]) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/rounded-2xl[^'"`]*\bborder\b/.test(line)) offenders.push(`${rel}:${i + 1}`);
    });
  }
  expect(offenders).toEqual([]);
});

test('the exception list stays honest: every file on it still has one', () => {
  // An exception that no longer applies is an exception somebody can
  // hide behind. If a file is converted, take it off the list.
  const stale = [];
  for (const rel of Object.keys(NOT_CARDS)) {
    const full = path.join(GEO, rel);
    if (!fs.existsSync(full)) {
      stale.push(`${rel} (gone)`);
      continue;
    }
    if (!/rounded-2xl[^'"`]*\bborder\b/.test(fs.readFileSync(full, 'utf8'))) stale.push(`${rel} (converted)`);
  }
  expect(stale).toEqual([]);
});

test('the primitives exist and say what they are for', () => {
  for (const name of ['Card.js', 'Button.js', 'Tabs.js', 'Stat.js']) {
    const full = path.join(UI, name);
    expect({ name, there: fs.existsSync(full) }).toEqual({ name, there: true });
    // Every one of them carries the reason it exists, because the next
    // person's question is "why not just write the classes".
    expect(fs.readFileSync(full, 'utf8')).toMatch(/\/\*\*[\s\S]*?\*\//);
  }
});

test('the primary button clears AA on its own surface', () => {
  // Ocean blue with white text (theme.css). The old primary was rust
  // with a painted 3D edge (founder, 2026-09-23: "ugly"); before that,
  // white on clay-500 was 3.68:1 and shipped on every screen.
  const theme = fs.readFileSync(path.join(GEO, 'theme.css'), 'utf8');
  const rgb = theme.match(/--pe-accent:\s*(\d+) (\d+) (\d+);/).slice(1).map(Number);
  const lum = ([r, g, b]) => {
    const f = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const contrast = (1.05) / (lum(rgb) + 0.05);
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  expect(theme).toMatch(/\.ui-btn--primary \{\s*background: rgb\(var\(--pe-accent\)\);\s*color: #fff;/);
  const button = fs.readFileSync(path.join(UI, 'Button.js'), 'utf8');
  expect(button).toContain('`ui-btn--${kind}`');
});

test('every button is thumb-sized', () => {
  // 44px everywhere a finger is the pointer; the small size is small
  // only under a mouse.
  const theme = fs.readFileSync(path.join(GEO, 'theme.css'), 'utf8');
  expect(theme).toMatch(/\.geo-surface \.ui-btn \{[^}]*min-height: 44px;/);
  const coarse = theme.slice(theme.indexOf('@media (pointer: coarse)'));
  const block = coarse.slice(0, coarse.indexOf('}\n}') + 3);
  for (const control of ['.ui-btn--sm', '.ui-seg > button', '.ui-nav a', '.ui-account']) {
    expect({ control, thumb: block.includes(control) }).toEqual({ control, thumb: true });
  }
  expect(block).toMatch(/min-height: 44px;/);
});
