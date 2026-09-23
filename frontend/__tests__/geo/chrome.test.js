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
    // /geo was a takeover when it was one button on a full-bleed globe.
    // It is the game menu now and carries the same navigation as every
    // other page outside a match.
    ['/geo', false],
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

describe('the game menu shows the whole product', () => {
  const menu = read('app/geo/components/home/GameMenu.js');

  test('the quick start is still one button', () => {
    expect(menu).toContain('data-cold-open-play');
  });

  test('both game families and Friends are on it, not behind it', () => {
    // Script and Rooms used to be two words in a row of four links, and
    // the competitions were reachable only by reading a standings page.
    for (const marker of ['data-menu-script', 'data-menu-friends', 'data-menu-daily', 'data-menu-ranked', 'data-menu-cup']) {
      expect({ marker, present: menu.includes(marker) }).toEqual({ marker, present: true });
    }
  });

  test('the casual modes are in Play rather than in Rankings', () => {
    expect(menu).toContain('data-menu-streak');
    // One continent and One country are retired: the country list was a
    // list of what the game covers, which is kept secret.
    for (const marker of ['data-menu-continent', 'data-menu-country']) {
      expect({ marker, present: menu.includes(marker) }).toEqual({ marker, present: false });
    }
    expect(read('app/geo/leaderboard/page.js')).not.toContain('OtherModes');
  });

  test('every status on it comes from the server or is not shown', () => {
    // Never a fabricated player count, rank or streak for atmosphere.
    // One status per line the menu prints: today's daily, the weekly
    // cup's clock, and your own standing on the solo ladder.
    for (const endpoint of ['/api/geo/daily', '/api/geo/cup', '/api/geo/leaderboard?ladder=solo']) {
      expect({ endpoint, fetched: menu.includes(endpoint) }).toEqual({ endpoint, fetched: true });
    }
  });

  test('it does not ask the server for a status it no longer shows', () => {
    // The open-room count was the label under a Solo/Multiplayer toggle
    // that put the word Multiplayer on the front door twice. The toggle
    // is gone, so the count has nowhere to appear, and a request whose
    // answer is never rendered is a request the front door should not
    // make.
    expect(menu).not.toContain('/api/geo/rooms');
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
  const menu = read('app/geo/components/home/GameMenu.js');
  const rankings = read('app/geo/leaderboard/page.js');

  test('the menu carries ranked, the daily and the cup', () => {
    // These lived on /geo/setup, which was deleted for being a settings
    // form; three whole modes went with it. They then lived on the
    // Rankings page, which is a standings page, so finding a casual
    // mode meant reading a leaderboard. They are in Play now.
    for (const mode of ['ranked', 'daily', 'cup']) {
      expect({ mode, started: menu.includes(`/geo/play?mode=${mode}`) }).toEqual({ mode, started: true });
    }
    expect(rankings).not.toContain('<Contests');
  });

  test('and shows where you came in each, which is the reason to press the button', () => {
    for (const marker of ['data-menu-daily', 'data-menu-ranked', 'data-menu-cup']) {
      expect({ marker, present: menu.includes(marker) }).toEqual({ marker, present: true });
    }
    // And Rankings keeps a way into the ladder on screen.
    expect(rankings).toContain('data-ladder-play');
  });

  test('no page in the game links to the deleted setup form', () => {
    // It is gone, and a link to it is a 404 wearing a button. Matched
    // on the path in a string or a template rather than anywhere in the
    // file, because the comment explaining where these moved FROM names
    // it, and prose is not navigation.
    const LINK = /['"`}]\/geo\/setup/;
    for (const file of ['app/geo/components/home/GameMenu.js', 'app/geo/leaderboard/page.js', 'app/geo/components/GeoHeader.js', 'app/geo/components/PlayClient.js', 'scripts/geo-e2e/run.js']) {
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
    const starters = menu;
    for (const mode of MODE_ORDER) {
      // The default is the Play button itself, which takes no mode.
      if (mode === 'balanced') continue;
      expect({ mode, startable: starters.includes(`mode=${mode}`) }).toEqual({ mode, startable: true });
    }
  });

  test('no mode asks where to play: every one draws from everywhere', () => {
    const other = read('app/geo/components/home/GameMenu.js');
    expect(other).not.toContain('mode=continent');
    expect(other).not.toContain('mode=country');
    // A streak needs nothing, so it is a link and not a form.
    expect(other).toContain("href=\"/geo/play?mode=streak\"");
  });

  test('the menu still leads to every one of them', () => {
    const menu = read('app/geo/components/home/GameMenu.js');
    for (const href of ['/geo/rooms', '/geo/play?mode=daily', '/geo/script', '/geo/play?mode=ranked', '/geo/play?mode=cup']) {
      expect({ href, linked: menu.includes(href) }).toEqual({ href, linked: true });
    }
  });

  test('the top-level navigation is the same four places everywhere', () => {
    // GAME_LINKS only: the admin link is added at render time for one
    // account and is not a top-level place.
    const header = read('app/geo/components/GeoHeader.js');
    const block = header.slice(header.indexOf('export const GAME_LINKS'), header.indexOf('];', header.indexOf('export const GAME_LINKS')));
    const labels = [...block.matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
    expect(labels).toEqual(['Play', 'Multiplayer', 'Rankings', 'Profile']);
  });
});
