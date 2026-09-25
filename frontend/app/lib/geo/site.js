/**
 * Which site this build serves, and which routes belong to the game.
 *
 * The game owns this file so that nothing under app/geo, app/lib/geo or
 * app/api/geo has to import the pet site's navigation policy
 * (docs/PROBABLY_EARTH_SPLIT.md, phase 1.6). It is also where the pet
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
 * The game's routes that carry no pet chrome, which is all of them.
 *
 * It used to be the screens where a round was in progress, and the rest
 * of the game sat under the pet site's universal bar with its own
 * subtabs below. That was right while the game was a section of
 * reunitepets.org and wrong the day it got a name and an address of its
 * own: nobody arriving at probablyearth.com should be looking at a
 * navigation bar for a lost pet service.
 *
 * The founder rule this answers to (docs/APP_MAP.md, 8.2) allows the
 * bar to be removed inside an immersive takeover, on one condition:
 * every such route ships a visible way back out. The game's own header
 * is that on every page, and its footer carries the link to
 * ReunitePets.
 */
export const IMMERSIVE_GAME_ROUTES = ['/geo'];

/**
 * The screens that cover the whole viewport, where even the game's own
 * header is gone: the front door, a round, and a room in progress.
 *
 * `/geo` is here as an EXACT match rather than a prefix, which is why
 * `isGameTakeover` below exists instead of a plain `startsWith` at each
 * call site: the front door is a full-screen picture of the world with
 * its own small header, and a second bar above it would be the thing
 * the redesign was for. Everything under `/geo/...` that is not listed
 * keeps the game's normal chrome.
 *
 * `/geo/room/` keeps its slash for the same class of reason. Without it
 * the prefix also swallowed `/geo/rooms`, which is the LIST of rooms
 * and not a room: the one page whose whole job is to get you into
 * multiplayer lost its navigation and became a dead end. A room in
 * progress covers the screen; choosing one is an ordinary page.
 */
export const GAME_TAKEOVER_ROUTES = ['/geo/play', '/geo/room/', '/geo/script/play'];
/**
 * Nothing is an exact-match takeover any more. `/geo` was, when it was
 * one button on a full-bleed globe; it is the game menu now and carries
 * the same navigation as every other page outside a match, because a
 * menu you cannot navigate from is where the product went missing.
 */
export const GAME_TAKEOVER_EXACT = [];

/** Does this path own the whole screen? */
export function isGameTakeover(pathname) {
  const path = String(pathname || '');
  if (GAME_TAKEOVER_EXACT.includes(path)) return true;
  return GAME_TAKEOVER_ROUTES.some((route) => path.startsWith(route));
}

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
  '/api/geo/matchmaking': { windowMs: 60000, maxRequests: 60 },
  '/api/geo/profile': { windowMs: 60000, maxRequests: 30 },
  '/api/geo/save': { windowMs: 60000, maxRequests: 30 },
  '/api/geo/leaderboard': { windowMs: 60000, maxRequests: 30 },
  // Sign-in sends mail, so it gets the strictest bucket in the game:
  // five a minute per address is more than a person needs and far less
  // than a script needs to be a nuisance. Verify is a link click.
  '/api/geo/auth/request': { windowMs: 60000, maxRequests: 5 },
  '/api/geo/auth/verify': { windowMs: 60000, maxRequests: 20 },
  // Typing the emailed code. Each email also dies after five wrong
  // codes (accounts.js); this caps how fast anyone can ask at all.
  '/api/geo/auth/code': { windowMs: 60000, maxRequests: 10 },
  '/api/geo/auth/phone/request': { windowMs: 60000, maxRequests: 3 },
  '/api/geo/auth/phone/verify': { windowMs: 60000, maxRequests: 5 },
  // Deleting an account is not something a person does twice.
  '/api/geo/auth/delete': { windowMs: 60000, maxRequests: 5 },
  '/api/geo/auth': { windowMs: 60000, maxRequests: 60 },
  // The backend. Every request here is refused outright unless the
  // session belongs to an admin, so the bucket is not what protects it;
  // it is here so an unauthenticated flood costs a cheap 403 rather
  // than a database round trip each time.
  '/api/geo/admin': { windowMs: 60000, maxRequests: 120 },
  // Script rounds are text out of a file: no upstream call, no key, no
  // cost, so they get a looser bucket than a panorama round. The limit
  // is here to slow a scraper walking the corpus, not to ration play.
  '/api/geo/script/round': { windowMs: 60000, maxRequests: 90 },
  '/api/geo/script/guess': { windowMs: 60000, maxRequests: 120 },
  // "Something wrong?" on the answer screen. A person reports a round
  // or two, not dozens; repeats are also stored once (server/reports.js).
  '/api/geo/script/report': { windowMs: 60000, maxRequests: 10 },
  // A round is a burst of free metadata probes on the server; one
  // person plays a handful a minute, and a retry after "no imagery"
  // must not lock them out.
  '/api/geo/round': { windowMs: 60000, maxRequests: 40 },
  '/api/geo/guess': { windowMs: 60000, maxRequests: 60 },
  '/api/geo/config': { windowMs: 60000, maxRequests: 30 },
  // A MapKit token, minted per host and cached by the page that asked.
  // One a page, plus whatever MapKit asks for on refresh, so this is
  // sized for someone moving around the game rather than sitting still.
  '/api/geo/mapkit-token': { windowMs: 60000, maxRequests: 30 },
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
 * probablyearth.example/play rather than /geo/play. Only used when this
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

/**
 * The game's own hostnames. Built in rather than configured: it is the
 * game's address, it does not change with the deployment, and a domain
 * that needs an environment variable set before it works is a domain
 * that is broken the day it is pointed. GEO_DOMAINS adds more (a staging
 * host, a second name). One list for everything that asks "is this the
 * game's site?": the middleware, robots.txt and the sitemap.
 */
export const GAME_HOSTNAMES = Object.freeze(['probablyearth.com', 'www.probablyearth.com']);

export function isGameHost(host, domains = process.env.GEO_DOMAINS || '') {
  const name = String(host || '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '');
  if (!name) return false;
  const extra = String(domains)
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return GAME_HOSTNAMES.includes(name) || extra.includes(name);
}
