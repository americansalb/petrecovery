/**
 * The game is one place, and every screen in it looks like the same
 * place.
 *
 * Two failures this pins, both of which shipped and both of which were
 * only visible by opening the page:
 *
 * 1. `/geo/room` was a takeover PREFIX, so `/geo/rooms` matched it. The
 *    list of rooms is the one page whose whole job is getting two
 *    people into the same game, and it lost its navigation and became
 *    a dead end.
 * 2. app/globals.css styles the pet site's fields with
 *    `input[type="text"] { background: white }`. An attribute selector
 *    plus an element beats a Tailwind class, so `bg-ocean-900/60` on a
 *    field under /geo was discarded while the `text-white` beside it
 *    applied: white ink on white paper, on the sign-in box, the room
 *    name and the room code.
 */

const fs = require('fs');
const path = require('path');
const { isGameTakeover, GAME_TAKEOVER_ROUTES } = require('@/app/lib/geo/site');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('a takeover covers the screen; nothing else loses its navigation', () => {
  test.each([
    ['/geo', true],
    ['/geo/play', true],
    ['/geo/play?mode=daily', true],
    ['/geo/room/ABC123', true],
    ['/geo/script/play', true],
    ['/geo/rooms', false],
    ['/geo/me', false],
    ['/geo/leaderboard', false],
    ['/geo/script', false],
    ['/geo/share', false],
    ['/geo/admin', false],
  ])('%s -> takeover: %s', (pathname, expected) => {
    expect({ pathname, takeover: isGameTakeover(pathname) }).toEqual({ pathname, takeover: expected });
  });

  test('a prefix that is also the start of another route keeps its slash', () => {
    // `/geo/room` without one swallowed `/geo/rooms`. Anything listed
    // here that another route starts with has to end in a separator,
    // or this comes back the next time a route is added.
    for (const route of GAME_TAKEOVER_ROUTES) {
      const others = ['/geo/rooms', '/geo/me', '/geo/leaderboard', '/geo/script', '/geo/share', '/geo/admin'];
      for (const other of others) {
        expect({ route, other, swallowed: other.startsWith(route) }).toEqual({ route, other, swallowed: false });
      }
    }
  });
});

describe('the front door leads into the whole game', () => {
  const coldOpen = read('app/geo/components/home/ColdOpen.js');

  test('Play is the one button, and it is still there', () => {
    expect(coldOpen).toContain('data-cold-open-play');
  });

  test('and multiplayer is reachable from the first screen', () => {
    // The row of other ways in was written as a constant and then never
    // rendered, which left Rooms unreachable from the front page of a
    // game whose headline feature is playing it with somebody.
    expect(coldOpen).toContain("href: '/geo/rooms'");
    expect(coldOpen).toContain('WAYS.map');
  });
});

describe('every field in the game is dark, because the pet site forces them white', () => {
  const globals = read('app/globals.css');
  const geo = read('app/geo/geo.css');
  const layout = read('app/geo/layout.js');

  test('the override is scoped to the game and nowhere else', () => {
    // Lowering the pet site's rule instead would change 437 fields
    // across 55 of its pages, whose classes have been ignored long
    // enough that nobody knows which were meant. This is a lost-pet
    // service; the game moves, not it.
    expect(layout).toContain('geo-surface');
    expect(layout).toContain("import './geo.css'");
    for (const line of geo.split('\n')) {
      if (line.trim().startsWith('.') || /^\s*\w+[^{]*\{/.test(line)) {
        if (line.includes('{') || line.trim().endsWith(',')) {
          expect({ line, scoped: line.trim().startsWith('.geo-surface') || !line.trim().startsWith('.') }).toEqual({ line, scoped: true });
        }
      }
    }
  });

  test('it covers every control the pet site paints white', () => {
    // The selector list that carries `background: white` in globals.css.
    // Anything in it without a counterpart here is a field somewhere in
    // the game rendering white text on a white box.
    const block = globals.slice(globals.indexOf('input[type="text"]'));
    const rule = block.slice(0, block.indexOf('}'));
    expect(rule).toContain('background: white');
    const selectors = rule
      .slice(0, rule.indexOf('{'))
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    expect(selectors.length).toBeGreaterThan(5);
    for (const selector of selectors) {
      const normalised = selector.replace(/"/g, "'");
      expect({ selector, covered: geo.includes(`.geo-surface ${normalised}`) }).toEqual({ selector, covered: true });
    }
  });

  test('and the placeholder and the native dropdown come with it', () => {
    // A dark box whose placeholder is still near-black reads as empty
    // and broken, and a <select> opens a list the OS paints white.
    expect(geo).toContain('::placeholder');
    expect(geo).toContain('select:not([data-paper]) option');
  });
});

describe('every mode the game has is reachable from a page in the navigation', () => {
  const contests = read('app/geo/components/Contests.js');
  const rankings = read('app/geo/leaderboard/page.js');
  const coldOpen = read('app/geo/components/home/ColdOpen.js');

  test('Rankings carries ranked, the daily and the cup', () => {
    // These lived on /geo/setup, which was deleted for being a settings
    // form. Three whole modes went with it: the only button in the game
    // that started a ranked round, the only one that started the cup,
    // and both boards. The endpoints kept answering and nothing called
    // them, so the game quietly lost a third of itself.
    expect(rankings).toContain('<Contests');
    for (const mode of ['ranked', 'daily', 'cup']) {
      expect({ mode, started: contests.includes(`/geo/play?mode=${mode}`) }).toEqual({ mode, started: true });
    }
  });

  test('and shows where you came in each, which is the reason to press the button', () => {
    for (const marker of ['data-ranked-standing', 'data-daily-board', 'data-cup-board']) {
      expect({ marker, present: contests.includes(marker) }).toEqual({ marker, present: true });
    }
  });

  test('no page in the game links to the deleted setup form', () => {
    // It is gone, and a link to it is a 404 wearing a button. Matched
    // on the path in a string or a template rather than anywhere in the
    // file, because the comment explaining where these moved FROM names
    // it, and prose is not navigation.
    const LINK = /['"`}]\/geo\/setup/;
    for (const file of ['app/geo/components/Contests.js', 'app/geo/leaderboard/page.js', 'app/geo/components/home/ColdOpen.js', 'app/geo/components/GeoHeader.js', 'app/geo/components/PlayClient.js', 'scripts/geo-e2e/run.js']) {
      expect({ file, links: LINK.test(read(file)) }).toEqual({ file, links: false });
    }
  });

  test('and nothing offers to go "back to the lobby", because there is not one', () => {
    for (const file of ['app/geo/components/PlayClient.js', 'app/geo/components/SetupNotice.js', 'app/geo/components/script/ScriptPlayClient.js']) {
      expect({ file, stale: /Back to the lobby/.test(read(file)) }).toEqual({ file, stale: false });
    }
  });

  test('every mode the game defines can be started from somewhere', () => {
    // MODE_ORDER is what the game says it offers. A mode in it that no
    // page can start is a feature that exists only in the code: streak,
    // continent and country were all three of those after the setup
    // page went, while MODES kept describing them.
    const { MODE_ORDER } = require('@/app/lib/geo/modes');
    const starters = [contests, read('app/geo/components/OtherModes.js'), coldOpen].join('\n');
    for (const mode of MODE_ORDER) {
      // The default is the Play button itself, which takes no mode.
      if (mode === 'balanced') continue;
      expect({ mode, startable: starters.includes(`mode=${mode}`) }).toEqual({ mode, startable: true });
    }
  });

  test('the two modes that need a region ask for one, and the rest do not', () => {
    const other = read('app/geo/components/OtherModes.js');
    // "One country" is not a mode until you say which, so this is the
    // one place in the game where a control is the honest answer.
    expect(other).toContain('mode=continent&region=');
    expect(other).toContain('mode=country&region=');
    // A streak needs nothing, so it is a link and not a form.
    expect(other).toContain("href=\"/geo/play?mode=streak\"");
  });

  test('the front door still leads to every one of them', () => {
    for (const href of ['/geo/rooms', '/geo/play?mode=daily', '/geo/leaderboard', '/geo/script']) {
      expect({ href, linked: coldOpen.includes(`'${href}'`) }).toEqual({ href, linked: true });
    }
  });
});
