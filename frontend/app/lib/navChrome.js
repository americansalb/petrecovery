/**
 * Global-chrome policy - the single source of truth for where the universal
 * navigation renders. Both Navigation (top bar) and GlobalBottomNav (mobile
 * tab bar) read from here; pages never hide chrome ad hoc.
 *
 * House rule (docs/APP_MAP.md §8.2): the top bar is identical on every
 * route - same height, same links, same CTA - and steps aside only inside
 * intentional full-screen immersive experiences. The mobile tab bar
 * additionally yields to focused wizard flows whose own fixed action bars
 * would collide with it. Enforced by __tests__/global-chrome.test.js.
 *
 * The top bar is h-16 (4rem) and the mobile tab bar is h-16: a screen that
 * must fill the viewport exactly sizes itself with
 * `h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-4rem)]`.
 */

/**
 * Full-screen takeovers that ship their own chrome (MissionHeader, the
 * shelter portal's sidebar shell). /my-shelter is the hat-gated shelter
 * workspace: same account system, its own world (docs/PERMISSIONS.md).
 * /rasuwa is the letter tool for families of people missing in the 2026
 * Rasuwa (Nepal) flood: a crisis page for a non-pet audience, so it
 * carries none of the pet-site chrome; its footer links back to /.
 * /geo/play and /geo/room are Where on Earth, the street-level guessing
 * game (docs/GEO.md), while a round or a room is in progress: they cover
 * the screen and carry an X back to the game's lobby. The rest of the
 * game (/geo, /geo/rooms, /geo/leaderboard, /geo/share) is ordinary
 * pages under the universal bar, with the game's own subtabs below it
 * (app/geo/components/GeoHeader.js).
 */
export const IMMERSIVE_ROUTES = ['/mission-control', '/my-shelter', '/rasuwa', '/geo/play', '/geo/room'];

/**
 * Which site this build is. 'pet' is reunitepets.org, where the game
 * lives under /geo beneath the universal chrome. A deployment built with
 * NEXT_PUBLIC_SITE=geo is the game's own site (docs/GEO.md, "Hosting on
 * another domain"): no pet chrome anywhere, the game's header in its
 * place, and the middleware sends every non-game path to the pet site.
 * Read at build time, so the server and the browser agree on the first
 * paint.
 */
export const SITE = process.env.NEXT_PUBLIC_SITE === 'geo' ? 'geo' : 'pet';

export function isGameSite() {
  return SITE === 'geo';
}

/** True inside an immersive takeover: no global chrome at all. */
export function isImmersiveRoute(pathname) {
  if (SITE === 'geo') return true;
  return IMMERSIVE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Focused flows where the mobile tab bar would fight the flow's own fixed
 * controls. The top bar stays put on all of these.
 */
export function hidesBottomNav(pathname) {
  if (isImmersiveRoute(pathname)) return true;
  // The report wizard overlays the whole viewport (app/report/layout.js);
  // the join flow is a zero-friction landing that owns the screen.
  if (pathname.startsWith('/report/') || pathname.startsWith('/join/')) return true;
  // Pet edit + medication wizards render fixed save bars in the same spot.
  if (/^\/pets\/[^/]+\/(edit|medications\/new)/.test(pathname)) return true;
  return false;
}
