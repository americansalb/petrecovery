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

test('no utility on a ui-btn or ui-input sets what the component already sets', () => {
  // `.geo-surface .ui-btn` carries two classes of weight and a utility
  // carries one, so a utility for anything the component sets is dead on
  // arrival: `pl-10` never moved the text off the country picker's search
  // glass, and `sm:hidden` never hid a button. A class that does nothing
  // reads as if it does something. Change the component (a modifier in
  // theme.css) instead, or drop the class.
  const theme = fs.readFileSync(path.join(GEO, 'theme.css'), 'utf8');
  const setBy = (selector) => {
    const props = new Set();
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const m of theme.matchAll(new RegExp(`\\.geo-surface ${escaped} \\{([^}]*)\\}`, 'g'))) {
      for (const decl of m[1].split(';')) {
        const prop = decl.split(':')[0].replace(/\/\*[\s\S]*?\*\//g, '').trim();
        if (prop) props.add(prop);
      }
    }
    return props;
  };
  // What each utility sets, for the properties the components use.
  const UTILITY = [
    [/^-?p[xylrtb]?-[0-9[]/, ['padding']],
    [/^(hidden|block|inline|inline-block|flex|inline-flex|grid|inline-grid|contents)$/, ['display']],
    [/^min-h-/, ['min-height']],
    [/^text-(xs|sm|base|lg|[2-9]?xl|\[\d)/, ['font-size', 'font']],
    [/^text-(?!(xs|sm|base|lg|[2-9]?xl|left|center|right|justify|start|end|\[\d))/, ['color']],
    [/^rounded(-|$)/, ['border-radius']],
    [/^w-/, ['width']],
    [/^gap-/, ['gap']],
    [/^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/, ['font-weight', 'font']],
    [/^whitespace-/, ['white-space']],
    [/^leading-/, ['line-height', 'font']],
    [/^items-/, ['align-items']],
    [/^justify-/, ['justify-content']],
    [/^bg-/, ['background', 'background-color']],
    [/^border(-|$)/, ['border', 'border-color', 'border-width']],
  ];
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  };
  walk(GEO);
  const dead = [];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|'([^']*)')/g)) {
      const tokens = (m[1] ?? m[2] ?? m[3]).replace(/['"]/g, ' ').split(/\s+/).filter(Boolean);
      for (const base of ['ui-btn', 'ui-input']) {
        if (!tokens.includes(base)) continue;
        const props = setBy(`.${base}`);
        for (const modifier of tokens.filter((t) => t.startsWith(`${base}--`))) {
          for (const prop of setBy(`.${modifier}`)) props.add(prop);
        }
        for (const token of tokens) {
          const utility = token.split(':').pop().replace(/^!/, '');
          for (const [pattern, sets] of UTILITY) {
            if (pattern.test(utility) && sets.some((prop) => props.has(prop))) {
              dead.push(`${path.relative(GEO, file)}: ${token} on ${base}`);
            }
          }
        }
      }
    }
  }
  expect(dead).toEqual([]);
});
