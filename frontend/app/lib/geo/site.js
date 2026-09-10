/**
 * Which site this build serves, and which routes belong to the game.
 *
 * The game owns this file so that nothing under app/geo, app/lib/geo or
 * app/api/geo has to import the pet site's navigation policy
 * (docs/WANDERGUESSER_SPLIT.md, phase 1.6). The pet site keeps its own
 * copy of the flag in app/lib/navChrome.js for its own chrome; phase 2
 * has it read the route lists below instead of hard-coding them.
 *
 * Read at build time, so the server and the browser agree on the first
 * paint.
 */

/** 'geo' on the game's own site, 'pet' inside reunitepets.org. */
export const SITE = process.env.NEXT_PUBLIC_SITE === 'geo' ? 'geo' : 'pet';

/**
 * True when this build is the game's own site: no pet chrome anywhere,
 * the game's header in its place (docs/GEO.md, "Hosting on another
 * domain").
 */
export function isGameSite() {
  return SITE === 'geo';
}

/** Where the game is mounted inside the pet site. Becomes '/' when it moves out. */
export const GAME_ROOT = '/geo';

/** The game's API prefix inside the pet site. */
export const GAME_API_ROOT = '/api/geo';

/**
 * The game's routes that cover the screen: a round and a room in
 * progress. Each carries an X back to the game's lobby. Everything else
 * the game serves is an ordinary page.
 */
export const IMMERSIVE_GAME_ROUTES = ['/geo/play', '/geo/room'];
