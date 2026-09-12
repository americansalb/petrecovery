/**
 * Which site this build serves, and which routes belong to the game.
 *
 * The game owns this file so that nothing under app/geo, app/lib/geo or
 * app/api/geo has to import the pet site's navigation policy
 * (docs/WANDERGUESSER_SPLIT.md, phase 1.6). It is also where the pet
 * site reads the game's routes, rate limits and map hosts from, so the
 * wires that point INWARD are one named import rather than fourteen
 * lines scattered through middleware.js and navChrome.js (phase 2).
 * When the game leaves, deleting those imports is the whole job.
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
export const IMMERSIVE_GAME_ROUTES = ['/geo/play', '/geo/room', '/geo/script/play'];

/**
 * The game's rate limits, by path prefix. `middleware.js` spreads these
 * into its own table; the numbers and the reasoning live here because
 * they are facts about the game, not about the pet site.
 *
 * Order matters where one prefix is a prefix of another: the matcher
 * takes the first hit. Two traps, both deliberate rather than lucky.
 * `/api/geocode` is a PET route that starts with `/api/geo`, so there
 * must never be a bare `/api/geo` key here; and `/api/geo/auth/request`
 * sits above `/api/geo/auth` so the strict mail limit is not swallowed
 * by the loose one.
 */
export const GAME_RATE_LIMITS = {
  // Rooms poll their state every couple of seconds while a game is on,
  // plus guesses and reactions; one bucket for the whole prefix.
  '/api/geo/rooms': { windowMs: 60000, maxRequests: 180 },
  '/api/geo/profile': { windowMs: 60000, maxRequests: 30 },
  '/api/geo/leaderboard': { windowMs: 60000, maxRequests: 30 },
  // Sign-in sends mail, so it gets the strictest bucket in the game:
  // five a minute per address is more than a person needs and far less
  // than a script needs to be a nuisance. Verify is a link click.
  '/api/geo/auth/request': { windowMs: 60000, maxRequests: 5 },
  '/api/geo/auth/verify': { windowMs: 60000, maxRequests: 20 },
  // Deleting an account is not something a person does twice.
  '/api/geo/auth/delete': { windowMs: 60000, maxRequests: 5 },
  '/api/geo/auth': { windowMs: 60000, maxRequests: 60 },
  // Script rounds are text out of a file: no upstream call, no key, no
  // cost, so they get a looser bucket than a panorama round. The limit
  // is here to slow a scraper walking the corpus, not to ration play.
  '/api/geo/script/round': { windowMs: 60000, maxRequests: 90 },
  '/api/geo/script/guess': { windowMs: 60000, maxRequests: 120 },
  // A round is a burst of free metadata probes on the server; one
  // person plays a handful a minute, and a retry after "no imagery"
  // must not lock them out.
  '/api/geo/round': { windowMs: 60000, maxRequests: 40 },
  '/api/geo/guess': { windowMs: 60000, maxRequests: 60 },
  '/api/geo/config': { windowMs: 60000, maxRequests: 30 },
  // The share card is rendered on demand and cached by the browser.
  '/api/geo/og': { windowMs: 60000, maxRequests: 30 },
  '/api/geo/daily': { windowMs: 60000, maxRequests: 30 },
  '/api/geo/shop': { windowMs: 60000, maxRequests: 60 },
  '/api/geo/cup': { windowMs: 60000, maxRequests: 30 },
};

/**
 * The hosts the game's two map providers need, by CSP directive. The
 * pet site's policy spreads these in; nothing else on reunitepets.org
 * asks for them.
 *
 * maps.googleapis.com and maps.gstatic.com are the Maps JavaScript API,
 * which serves both Street View and the guess map. cdn.apple-mapkit.com
 * is MapKit JS; Look Around streams its imagery from *.ls.apple.com.
 */
export const GAME_CSP_HOSTS = {
  script: ['https://cdn.apple-mapkit.com', 'https://maps.googleapis.com', 'https://maps.gstatic.com'],
  connect: ['https://*.apple-mapkit.com', 'https://*.ls.apple.com'],
  frame: ['https://*.apple.com', 'https://*.apple-mapkit.com', 'https://maps.apple.com'],
};

/**
 * Short paths on the game's own domain, so the visible URL is
 * wanderguesser.example/play rather than /geo/play. Only used when this
 * build or this host is the game's site (docs/GEO.md, "Hosting on
 * another domain"); they become plain routes once the game moves out.
 */
export const GAME_SHORT_PATHS = {
  '/': '/geo',
  '/play': '/geo/play',
  '/script': '/geo/script',
  '/rooms': '/geo/rooms',
  '/share': '/geo/share',
  '/leaderboard': '/geo/leaderboard',
  '/daily': '/geo/play?mode=daily',
};
