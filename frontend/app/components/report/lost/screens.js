/**
 * The lost report's seven screens, in order (app/report/new/page.js). The
 * order is fixed before the first screen shows, so "2 of 7" never turns
 * into "2 of 8" after an answer. A signed-in owner with saved pets picks
 * the pet first; everyone else starts from the photo.
 */
export function lostScreenOrder({ isLoggedIn = false, hasPets = false } = {}) {
  return hasPets
    ? ['pet', 'photo', 'color', 'place', 'behaviour', 'phone', 'review']
    : ['photo', 'pet', 'color', 'place', 'behaviour', isLoggedIn ? 'phone' : 'contact', 'review'];
}
