/**
 * Universal navbar consistency - the rule lives in docs/APP_MAP.md §8.2.
 *
 * The global chrome (top bar + mobile tab bar) must be IDENTICAL for
 * every person on every route - same height, same CTA, same links. It
 * does not vary by route, by sign-in state, by whether you help run a
 * shelter, or by anything else; the only session-dependent slot is Sign
 * in/Join vs the account menu. Anything person-specific goes in the
 * account menu.
 *
 * Two permitted exceptions, both deliberate:
 *   1. SUBTABS: a page may add secondary navigation BELOW the bar
 *      (`sticky top-16`), never its own top bar.
 *   2. Whole-bar removal inside the immersive routes listed in ONE
 *      place, app/lib/navChrome.js, each shipping its own visible way
 *      back out.
 *
 * Like link-previews.test.js this is a static source check: fast, no DOM,
 * runs in CI. Adding a full-screen takeover? Register it in navChrome.js.
 * Need a page-local sticky element? Anchor it BELOW the bar (`sticky
 * top-16`), or add a justified entry to KNOWN_EXCEPTIONS.
 */

const fs = require('fs');
const path = require('path');

const {
  IMMERSIVE_ROUTES,
  isImmersiveRoute,
  hidesBottomNav,
} = require('@/app/lib/navChrome');

const APP_DIR = path.join(__dirname, '..', 'app');

const read = (rel) => fs.readFileSync(path.join(APP_DIR, rel), 'utf8');

/**
 * `sticky top-0` / `fixed top-0` in a page or layout means a bar competing
 * with the universal navbar for the top edge. These usages are inside
 * scroll containers of their own (not the viewport) and are fine.
 */
const KNOWN_EXCEPTIONS = [
  'messages/[id]/page.js', // sticky header inside the Compare Pets modal
];

/** Segments that ARE the immersive experiences - they own their chrome. */
const IMMERSIVE_DIRS = ['mission-control', 'my-shelter'];

function walkChromeFiles(dir, rel = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (relPath === 'api') continue; // routes, not UI
      if (IMMERSIVE_DIRS.includes(relPath)) continue;
      out.push(...walkChromeFiles(abs, relPath));
    } else if (/^(page|layout)\.(js|jsx|tsx)$/.test(entry.name)) {
      out.push(relPath);
    }
  }
  return out;
}

describe('route-chrome policy (app/lib/navChrome.js)', () => {
  test('mission control is an immersive takeover', () => {
    expect(isImmersiveRoute('/mission-control')).toBe(true);
    expect(isImmersiveRoute('/mission-control/anything')).toBe(true);
  });

  test('the shelter portal is an immersive takeover; its onboarding is not', () => {
    expect(isImmersiveRoute('/my-shelter')).toBe(true);
    expect(isImmersiveRoute('/my-shelter/animals')).toBe(true);
    // pre-hat shelter surfaces keep the universal chrome
    expect(isImmersiveRoute('/shelter/start')).toBe(false);
    expect(isImmersiveRoute('/shelter/dashboard')).toBe(false);
    expect(isImmersiveRoute('/shelter/claim')).toBe(false);
    expect(isImmersiveRoute('/shelters')).toBe(false);
  });

  test('regular routes always get the top bar - auth pages included', () => {
    for (const route of [
      '/', '/login', '/register', '/forgot-password', '/reset-password',
      '/verify-email', '/lost-and-found', '/pets', '/hub', '/dashboard',
      '/alerts', '/messages', '/simulate', '/report/new', '/join/abc123',
    ]) {
      expect(isImmersiveRoute(route)).toBe(false);
    }
  });

  test('immersive prefixes match whole segments only', () => {
    // '/mission-control' must not swallow a hypothetical sibling route
    expect(isImmersiveRoute('/mission-controller')).toBe(false);
  });

  test('bottom bar yields only to immersive takeovers and wizard flows', () => {
    expect(hidesBottomNav('/mission-control')).toBe(true);
    expect(hidesBottomNav('/report/new')).toBe(true);
    expect(hidesBottomNav('/join/abc123')).toBe(true);
    expect(hidesBottomNav('/pets/ck123/edit')).toBe(true);
    expect(hidesBottomNav('/pets/ck123/medications/new')).toBe(true);
    // ...and nowhere else - auth pages keep the tab bar too
    for (const route of [
      '/', '/login', '/register', '/lost-and-found', '/pets', '/pets/ck123',
      '/hub', '/dashboard', '/alerts', '/messages', '/messages/abc',
    ]) {
      expect(hidesBottomNav(route)).toBe(false);
    }
  });
});

describe('no page ships its own top bar', () => {
  const files = walkChromeFiles(APP_DIR);

  test('found a sane number of page/layout files', () => {
    expect(files.length).toBeGreaterThan(80);
  });

  test.each(files)('%s does not pin a bar to the top edge', (rel) => {
    if (KNOWN_EXCEPTIONS.includes(rel)) return;
    const src = read(rel);
    expect(src).not.toMatch(/sticky top-0/);
    expect(src).not.toMatch(/fixed top-0/);

    // Inline styles count too. /my-alerts shipped a full-width blue bar at
    // position:'sticky', top: 0 for months and this test never saw it,
    // because it only looked for the Tailwind spelling.
    //
    // Sticky only. position:'fixed' with top: 0 is how every modal overlay
    // in this codebase covers the screen, and an overlay is not a bar.
    const inlineStickyTopBar = /position:\s*['"]sticky['"][^}]*?\btop:\s*0\b/s;
    expect(src).not.toMatch(inlineStickyTopBar);
  });

  test('KNOWN_EXCEPTIONS entries still exist and still need the exception', () => {
    for (const rel of KNOWN_EXCEPTIONS) {
      const src = read(rel);
      expect(src).toMatch(/sticky top-0|fixed top-0/);
    }
  });
});

describe('nav components defer to the shared policy', () => {
  const navigation = read('components/Navigation.js');
  const bottomNav = read('components/GlobalBottomNav.js');

  test('the link set is a constant, not a conditional', () => {
    // The bar is UNIVERSAL: one link set for every person on every
    // route. A bar that rearranges itself as you move around reads as
    // broken, so anything person-specific belongs in the account menu.
    // The old hat system (owner/searcher chrome) is deleted; do not
    // reintroduce it or any equivalent.
    expect(navigation).not.toMatch(/useHat/);
    expect(bottomNav).not.toMatch(/useHat/);
    expect(fs.existsSync(path.join(APP_DIR, 'contexts', 'HatContext.js'))).toBe(false);

    // Center links come from one frozen array, rendered by map().
    expect(navigation).toMatch(/const CENTER_LINKS = \[/);
    expect(navigation).toMatch(/CENTER_LINKS\.map\(/);
  });

  test('no center link is gated on session or membership', () => {
    // Grab the desktop link block and assert it holds no conditionals.
    const block = navigation.match(
      /hidden lg:flex items-center gap-1 flex-1 justify-center[\s\S]*?\n            <\/div>/
    );
    expect(block).not.toBeNull();
    expect(block[0]).not.toMatch(/session &&/);
    expect(block[0]).not.toMatch(/!session/);
    expect(block[0]).not.toMatch(/shelterHome/);
    expect(block[0]).not.toMatch(/\?\s*\(/); // no ternary-rendered links
  });

  test('Navigation.js hides only via isImmersiveRoute', () => {
    expect(navigation).toMatch(/isImmersiveRoute\(pathname\)/);
    // No hardcoded hide lists: route literals for hiding are banned
    expect(navigation).not.toMatch(/startsWith\(\s*['"]\/mission-control/);
    expect(navigation).not.toMatch(/startsWith\(\s*['"]\/login/);
    expect(navigation).not.toMatch(/isAuthPage/);
    // The bar renders the same everywhere: exactly one early return
    expect(navigation.match(/return null/g)).toHaveLength(1);
  });

  test('GlobalBottomNav.js hides only via hidesBottomNav', () => {
    expect(bottomNav).toMatch(/hidesBottomNav\(pathname\)/);
    expect(bottomNav).not.toMatch(/startsWith\(\s*['"]\/mission-control/);
    expect(bottomNav).not.toMatch(/isAuthPage/);
    expect(bottomNav.match(/return null/g)).toHaveLength(1);
  });

  test('the Report CTA has no per-route exceptions', () => {
    expect(navigation).not.toMatch(/pathname\s*!==\s*['"]\/['"]/);
  });

  test('root layout mounts both chrome components', () => {
    const layout = read('layout.js');
    expect(layout).toMatch(/<Navigation \/>/);
    expect(layout).toMatch(/<GlobalBottomNav \/>/);
  });

  test('the immersive list stays deliberate - additions need a docs update', () => {
    // If this fails you added a takeover: update docs/APP_MAP.md §8.2 and
    // the IMMERSIVE_DIRS list above, then extend this expectation.
    expect(IMMERSIVE_ROUTES).toEqual(['/mission-control', '/my-shelter']);
  });
});
