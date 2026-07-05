/**
 * Global-chrome policy — the single source of truth for where the universal
 * navigation renders. Both Navigation (top bar) and GlobalBottomNav (mobile
 * tab bar) read from here; pages never hide chrome ad hoc.
 *
 * House rule (docs/APP_MAP.md §8.2): the top bar is identical on every
 * route — same height, same links, same CTA — and steps aside only inside
 * intentional full-screen immersive experiences. The mobile tab bar
 * additionally yields to focused wizard flows whose own fixed action bars
 * would collide with it. Enforced by __tests__/global-chrome.test.js.
 *
 * The top bar is h-16 (4rem) and the mobile tab bar is h-16: a screen that
 * must fill the viewport exactly sizes itself with
 * `h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-4rem)]`.
 */

/** Full-screen takeovers that ship their own chrome (MissionHeader etc.). */
export const IMMERSIVE_ROUTES = ['/mission-control'];

/** True inside an immersive takeover: no global chrome at all. */
export function isImmersiveRoute(pathname) {
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
