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
  'components/rooms/RoomPanels.js': 'the modal a room shows over the game',
  'components/SetupNotice.js': 'a tinted notice, not a surface things sit on',
  'components/ShareRounds.js': 'the one-line notice above a shared game',
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
  // clay-400 (#c68e6b) on ocean-950 (#132937) is 5.34:1; white on
  // clay-500 was 3.68 and shipped on every screen in the game.
  const button = fs.readFileSync(path.join(UI, 'Button.js'), 'utf8');
  expect(button).toContain('bg-clay-400');
  expect(button).toContain('text-ocean-950');
  expect(button).not.toMatch(/bg-clay-500[^;]*text-white/);
});

test('every button is thumb-sized', () => {
  const button = fs.readFileSync(path.join(UI, 'Button.js'), 'utf8');
  const heights = [...button.matchAll(/min-h-\[(\d+)px\]/g)].map((m) => Number(m[1]));
  expect(heights.length).toBeGreaterThan(0);
  for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
});
