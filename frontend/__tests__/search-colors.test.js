/**
 * The search screen is easy to read, and stays that way (founder,
 * 2026-11-12: "Make sure that the color scheme allows for easily
 * readiliblity").
 *
 * Its two palettes live in app/globals.css (.mc-light for the desk by
 * day, .mc-dark for the desk at night and every phone). Every text colour
 * is held to WCAG AA, 4.5 to 1, on every surface it is set on, and no
 * text on the screen is smaller than 13px. Each colour means one thing,
 * and the map says rank by weight, never by colour.
 */

const fs = require('fs');
const path = require('path');

const { FRONTEND, read, reachable } = require('./helpers/searchScreenFiles');
const css = read('app/globals.css');

function palette(name) {
  const start = css.indexOf(`.${name} {`);
  const block = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...block.matchAll(/--mc-([a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

function rgb(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  return null;
}
function luminance([r, g, b]) {
  const f = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const [hi, lo] = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;
// A text colour, and the surfaces it is set on. `pick` is the row that is picked in a list; `ink` as a surface is
// the dark chip and the desk's own side of a conversation, which carry the surface colour as their text.
const TEXT_ON = [
  ['ink', ['surface', 'ground', 'raised', 'seen-bg', 'pick']],
  ['soft', ['surface', 'ground', 'raised', 'seen-bg']],
  ['muted', ['surface', 'ground', 'raised', 'pick']],
  ['seen-ink', ['surface', 'ground', 'raised', 'seen-bg']],
  ['teal-ink', ['surface', 'ground', 'raised', 'pick']],
  ['done-ink', ['surface', 'ground', 'raised', 'pick']],
  ['danger', ['surface', 'ground', 'raised']],
  ['on-teal', ['teal']],
  ['on-seen', ['seen']],
  ['check-ink', ['check']],
  ['surface', ['ink']],
];

describe.each(['mc-light', 'mc-dark'])('%s: every text colour reads on every surface it is set on', (name) => {
  const p = palette(name);

  test('the palette has every colour the screen uses', () => {
    for (const key of ['ground', 'surface', 'raised', 'ink', 'soft', 'muted', 'line', 'line-strong', 'seen', 'seen-ink', 'seen-bg', 'on-seen', 'on-flash', 'home', 'check', 'check-ink', 'teal', 'teal-ink', 'on-teal', 'done', 'done-ink', 'danger', 'pick', 'shadow']) {
      expect({ key, set: Boolean(p[key]) }).toEqual({ key, set: true });
    }
  });

  test.each(TEXT_ON.flatMap(([fg, surfaces]) => surfaces.map((bg) => [fg, bg])))('%s on %s is at least 4.5 to 1', (fg, bg) => {
    expect(rgb(p[fg])).not.toBeNull();
    expect(rgb(p[bg])).not.toBeNull();
    expect(contrast(p[fg], p[bg])).toBeGreaterThanOrEqual(AA);
  });

  test('what people read most is well past the floor: 7 to 1 for the main, the second and the third text colour', () => {
    for (const fg of ['ink', 'soft', 'muted']) expect(contrast(p[fg], p.surface)).toBeGreaterThanOrEqual(7);
  });
});

describe('the two palettes are the same set, so no component can read a colour one of them lacks', () => {
  test('same names in both', () => {
    expect(Object.keys(palette('mc-light')).sort()).toEqual(Object.keys(palette('mc-dark')).sort());
  });

  test('ink on the yellow button, and white on the red of "lost", read too', () => {
    expect(contrast('#0f172a', '#facc15')).toBeGreaterThanOrEqual(7);
    // The text on a yellow button is the palette's own, the same in both, and reads on the yellow and on its hover.
    for (const name of ['mc-light', 'mc-dark']) {
      expect(contrast(palette(name)['on-flash'], '#facc15')).toBeGreaterThanOrEqual(7);
      expect(contrast(palette(name)['on-flash'], '#fde047')).toBeGreaterThanOrEqual(7);
    }
    expect(contrast('#ffffff', '#dc2626')).toBeGreaterThanOrEqual(AA);
    // The number in a sighting's mark is white on the deeper orange.
    expect(read('app/mission-control/components/SearchMap.js')).toMatch(/disc\(numbered \? '#c2410c' : PET_COLOR\.seen/);
    expect(contrast('#ffffff', '#c2410c')).toBeGreaterThanOrEqual(AA);
  });
});

describe('no text on the search screen is smaller than 13px', () => {
  const SCREEN = path.join(FRONTEND, 'app', 'mission-control');
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.(js|jsx)$/.test(entry.name) ? [full] : [];
    });
  // The files the screen loads, found by following its imports (helpers/searchScreenFiles.js), so a file added to
  // the screen is held to this without being added to a list. (The folder also keeps older pieces nothing
  // imports: they are not on the screen.)
  const LOADED = reachable().map((file) => file.replace('app/mission-control/', ''));

  test('the screen\'s own pieces are all among them', () => {
    const all = walk(SCREEN).map((f) => path.relative(SCREEN, f).split(path.sep).join('/'));
    for (const file of LOADED) expect(all).toContain(file);
    for (const file of ['SearchScreen.js', 'components/TopBar.js', 'components/kit.js', 'components/SearchMap.js', 'components/Word.js', 'components/overlays/MarkReunitedModal.js', 'steps/Helper.js', 'steps/Owner.js', 'steps/Witness.js', 'desktop/Command.js', 'desktop/Board.js', 'desktop/Know.js', 'desktop/People.js', 'desktop/Messages.js', 'desktop/Needs.js']) {
      expect(LOADED).toContain(file);
    }
  });

  test.each(LOADED)('%s', (file) => {
    const source = read(`app/mission-control/${file}`);
    const small = [...source.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)].map((m) => Number(m[1])).filter((px) => px < 13);
    expect(small).toEqual([]);
    // Tailwind's text-xs is 12px.
    expect(source).not.toMatch(/\btext-xs\b/);
    // Words set straight onto the map (labels, the number in a mark) are 13px too.
    const drawn = [...source.matchAll(/font:\s*\d+ (\d+)px/g)].map((m) => Number(m[1])).filter((px) => px < 13);
    expect(drawn).toEqual([]);
  });
});

describe('the desk is light by day and dark by its own switch, and the map says rank by weight', () => {
  const desk = read('app/mission-control/desktop/Command.js');
  const map = read('app/mission-control/components/SearchMap.js');

  test('day unless this person chose night, and the choice is kept on this computer', () => {
    expect(desk).toMatch(/const \[night, setNight\] = useState\(false\);/);
    expect(desk).toMatch(/window\.localStorage\.getItem\(NIGHT_KEY\) === '1'/);
    expect(desk).toMatch(/className=\{`\$\{night \? 'mc-dark' : 'mc-light'\} /);
    expect(desk).toMatch(/theme=\{night \? 'dark' : 'light'\}/);
    // A browser that will not keep anything still gets a working switch.
    expect(desk.match(/\} catch \{/g).length).toBeGreaterThanOrEqual(2);
  });

  test('no colour of its own on the desk: every one comes from the palette or the map\'s own values', () => {
    // Every file of the desk, and the pieces it shares with a phone that were made for both palettes.
    const files = [...fs.readdirSync(path.join(FRONTEND, 'app', 'mission-control', 'desktop')).map((name) => `desktop/${name}`), 'components/Word.js', 'components/overlays/MarkReunitedModal.js'];
    expect(files).toEqual(expect.arrayContaining(['desktop/Command.js', 'desktop/Board.js', 'desktop/Know.js', 'desktop/People.js', 'desktop/Messages.js', 'desktop/Needs.js']));
    for (const file of files) {
      const source = read(`app/mission-control/${file}`);
      expect({ file, colour: (source.match(/(text|bg|border|ring)-(slate|teal|emerald|orange|amber|midnight|red|green|blue)-\d+/) || [null])[0] }).toEqual({ file, colour: file.endsWith('MarkReunitedModal.js') ? 'bg-slate-950' : null });
      expect({ file, hex: /#[0-9a-fA-F]{6}/.test(source) }).toEqual({ file, hex: false });
      expect({ file, uppercase: /\buppercase\b/.test(source) }).toEqual({ file, uppercase: false });
    }
  });

  test('the map marks what is given out next by weight, and keeps colour for meaning', () => {
    expect(map).toMatch(/export const DESK_MAP = \{\s*light: \{ ink: '#0f172a', later: '#64748b', walked: '#3f9f79', walking: '#0d9488', casing: '#ffffff' \},\s*dark: \{ ink: '#f8fafc', later: '#8493a8', walked: '#34916d', walking: '#2dd4bf', casing: '#020617' \},/);
    expect(map).not.toMatch(/HEAT|heatOf/);
    expect(map).toMatch(/\} else if \(street\.next\) \{/);
    // Yellow is the street in hand: the one picked, and one kept for a person who was asked. It is not also rank.
    expect(map).not.toMatch(/street\.first/);
    expect(map).toMatch(/\} else if \(street\.keptFor\) \{/);
    expect(map).toMatch(/L\.polyline\(street\.path, \{ color: look\.ink, weight: 6,/);
    expect(map).toMatch(/L\.polyline\(street\.path, \{ color: look\.later, weight: 2\.5,/);
    // Which streets are "next" is every street as urgent as the most urgent (lib/insight.js, givenNext): a phone
    // gives the nearest of them, so no few of them can be picked out here.
    expect(desk).toMatch(/const next = useMemo\(\(\) => new Set\(givenNext\(items\)\.map\(\(i\) => i\.id\)\), \[items\]\);/);
    expect(desk).not.toMatch(/NEXT_SHOWN/);
  });
});
