'use client';

/**
 * MapKit JS, loaded for the game.
 *
 * The game owns this so that app/geo does not import the pet site's map
 * helpers (docs/PROBABLY_EARTH_SPLIT.md, phase 1.4). The game needs the
 * loader and nothing else: the pet module's annotation, overlay and
 * place-search wrappers are for the shelter maps.
 *
 * WHICH BUNDLE, and why it is not the obvious one.
 *
 * Apple publishes two. `mapkit.js` is the legacy full bundle and is the
 * one this game used to load. It does NOT contain Look Around. That is
 * not a race or a missing call: read the file and `LookAround` appears
 * only as a getter that throws and as a string in a list of names.
 * There is no implementation in it, `mapkit.load` is deleted, and
 * `loadLibraries` is a stub that logs a warning. So on that bundle the
 * getter throws forever and any amount of waiting times out. Three
 * separate fixes (#264, #277, #278) each mistook the symptom for the
 * cause and left every Apple round on the live site dead.
 *
 * `mapkit.core.js` is the one that ships it: a real `load()`, a real
 * `loadedLibraries`, and a registry containing map, annotations,
 * overlays, services, geojson, user-location, look-around and full-map.
 * Nothing is on the namespace until the library carrying it is loaded,
 * so LIBRARIES below must name every group this game touches.
 */

const MAPKIT_JS_URL = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js';

/**
 * The libraries the game uses, and nothing more.
 *
 *   map          Map, Coordinate, CoordinateRegion, CoordinateSpan,
 *                Padding, Style, FeatureVisibility
 *   annotations  Annotation, MarkerAnnotation
 *   overlays     PolylineOverlay, PolygonOverlay, CircleOverlay
 *   look-around  LookAround
 *
 * Every name here is checked by __tests__/geo/mapkit-libraries.test.js
 * against the mapkit.* members app/geo actually reads, so a new call
 * site that needs `services` fails the suite rather than the player.
 */
const LIBRARIES = ['map', 'annotations', 'overlays', 'look-around'];

/** How long the libraries get before we call it a failure. */
const LIBRARY_TIMEOUT_MS = 15000;
const PROBE_MS = 100;

/**
 * Ask for the libraries and wait for them to land.
 *
 * `loadedLibraries` is the honest signal and on THIS bundle it is a
 * real array, which is the detail #277 got wrong: it read the same
 * property on the full bundle, where it is an empty getter returning
 * undefined, and concluded the build could not load libraries at all.
 */
function loadLibraries(mapkit) {
  const loaded = () => {
    const have = mapkit.loadedLibraries;
    return Array.isArray(have) && LIBRARIES.every((name) => have.includes(name));
  };
  if (loaded()) return Promise.resolve(mapkit);

  return new Promise((resolve, reject) => {
    if (typeof mapkit.load !== 'function') {
      // The legacy full bundle deletes `load`. Say so plainly instead
      // of waiting fifteen seconds for something that cannot arrive.
      reject(new Error('This MapKit build has no load(), so it is the legacy full bundle, which does not ship Look Around.'));
      return;
    }
    const deadline = Date.now() + LIBRARY_TIMEOUT_MS;
    try {
      mapkit.load(LIBRARIES);
    } catch (error) {
      reject(error);
      return;
    }
    const tick = () => {
      if (loaded()) {
        resolve(mapkit);
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error('Apple Maps did not finish loading. Try again in a moment.'));
        return;
      }
      setTimeout(tick, PROBE_MS);
    };
    tick();
  });
}

/**
 * The JWTs MapKit may authorize with.
 *
 * A MapKit token carries ONE origin, and Apple matches it exactly: a
 * token for reunitepets.org is refused with a 401 on
 * www.reunitepets.org. That is not a footnote, it is how Apple Maps
 * went dark on this site, because the apex redirects to www and every
 * player lands there. Verified against Apple's own bootstrap endpoint
 * on 2026-09-14: apex 200, www 401.
 *
 * So NEXT_PUBLIC_APPLE_MAPKIT_TOKEN takes a LIST, separated by commas
 * or whitespace, and the one whose origin claim matches the host the
 * page is actually being served from is the one used. Mint one per host
 * the site answers on and paste them all in; the alternative is a token
 * with no origin claim at all, which works anywhere and protects
 * nothing.
 *
 * The literal below is the one the pet site has shipped to every
 * browser since Apple mode was added. It covers the apex and nothing
 * else. Replacing it for the game's own domain is decision D5 in
 * docs/PROBABLY_EARTH_SPLIT.md.
 *
 * `scripts/check-mapkit-token.js` asks Apple which hosts these actually
 * work on, which is the only answer that counts.
 */
const FALLBACK_TOKEN =
  'eyJraWQiOiI3ODg3N1dWNlo3IiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJCRjIzTjRINjdWIiwiaWF0IjoxNzY3MzA5NTY4LCJvcmlnaW4iOiJyZXVuaXRlcGV0cy5vcmcifQ.zqtlPpm1wfmlfq-BmdxWgsBS9xhAoMQNWFg-ZMzJroyINHPML609QTfjTKAOyX_GrtWoy444YjRt6MnkhUXC5A';

const TOKENS = (process.env.NEXT_PUBLIC_APPLE_MAPKIT_TOKEN || FALLBACK_TOKEN)
  .split(/[\s,]+/)
  .filter(Boolean);

/** The origin a token was minted for, or '' if it was minted for any. */
function originOf(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '='))).origin || '';
  } catch {
    return '';
  }
}

/** Every host the tokens on hand cover. Empty means "any host". */
export function mapKitOrigins() {
  return TOKENS.map(originOf).filter(Boolean);
}

/**
 * The token to authorize with here. An exact origin match first, then a
 * token minted for no particular origin, then whatever is first: a
 * token Apple will refuse still beats sending none and getting a
 * different error.
 */
function tokenForHost() {
  const host = typeof window === 'undefined' ? '' : window.location.hostname;
  return (
    TOKENS.find((token) => originOf(token) === host) ||
    TOKENS.find((token) => !originOf(token)) ||
    TOKENS[0]
  );
}

/**
 * What to tell a player when Apple has refused. The origin case is
 * worth naming: it is a one line fix for whoever runs the site, and it
 * is invisible otherwise, because MapKit answers a refused token by
 * drawing nothing at all.
 */
export function mapKitRefusalMessage() {
  const host = typeof window === 'undefined' ? '' : window.location.hostname;
  const origins = mapKitOrigins();
  if (host && origins.length && !origins.includes(host)) {
    return `Apple refused this site's MapKit token on ${host}. The token covers ${origins.join(', ')}, and Apple matches the host exactly.`;
  }
  return "Apple refused this site's MapKit token. That is usually the day's map quota or a token that has expired.";
}

/**
 * The server will mint a token for whatever host this page is on, if it
 * has the signing key (app/api/geo/mapkit-token/route.js). That is the
 * only arrangement that survives a new hostname, and a new hostname is
 * what broke this: the token below covers the apex, the site redirects
 * the apex to www, and Apple answers 401 on www.
 *
 * A minted token lasts an hour (app/lib/geo/server/mapKitToken.js), and
 * MapKit asks for a new one through the same callback when it runs out.
 * It used to be asked for once per page and that answer kept for good,
 * so an hour into one tab MapKit was handed the token that had just
 * expired, Apple refused it, and Street stopped with "Apple refused this
 * site's MapKit token". A minted token is reused until a few minutes
 * before it expires, then asked for again. An empty answer (no signing
 * key configured, so the literal above is used) is final; a failed
 * request is not, and the next ask tries again.
 */
export const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
let minted = null;

export function mintedToken(now = Date.now()) {
  if (minted && now < minted.freshUntil) return minted.promise;
  const again = Boolean(minted);
  const entry = { freshUntil: Infinity, promise: null };
  // Past the first ask, around the browser's cache: the route allows
  // ten minutes of caching, and an old copy is exactly what is not wanted.
  entry.promise = fetch('/api/geo/mapkit-token', again ? { cache: 'no-store' } : undefined)
    .then((response) => (response.ok ? response.json() : null))
    .then((body) => {
      if (body && !body.token && body.reason) {
        // Said once, where whoever runs the site will see it. A blank
        // map with no explanation is how this went unnoticed.
        console.info(`[MapKit] serving the built in token: ${body.reason}`);
      }
      const token = body?.token || '';
      if (!body) entry.freshUntil = 0;
      else if (token && Number.isFinite(body.expiresAt)) entry.freshUntil = body.expiresAt - TOKEN_REFRESH_MARGIN_MS;
      return token;
    })
    .catch(() => {
      entry.freshUntil = 0;
      return '';
    });
  minted = entry;
  return entry.promise;
}

let initPromise = null;

/**
 * Set once MapKit has been authorized on this page. It lives on the
 * window rather than in this module so that a remount, or a second
 * import after a hot reload, does not authorize twice.
 */
const INIT_FLAG = '__geoMapKitReady';

/**
 * What Apple said about the token, once it has said anything.
 *
 * MapKit does not reject `init()` when a token is refused. The script
 * loads, the map object is built, the tiles never arrive, and the
 * player is left tapping a blank rectangle. That is the normal case on
 * localhost and on a preview deployment, because the token this
 * repository ships is locked to the reunitepets.org origin, and it is
 * also what a spent daily quota looks like.
 *
 * Callers that have somewhere else to go need to know. MapKit answers
 * on the namespace: `configuration-change` with a status of Initialized
 * once it has authorized, `error` with Unauthorized, Too Many Requests
 * or Initialization Failed when it has not. Both are recorded here as
 * 'ok' or 'failed', starting from 'pending'.
 *
 * Kept on the window for the same reason as INIT_FLAG: a hot reload
 * gives this module fresh state but not the page a fresh MapKit.
 */
const AUTH_FLAG = '__geoMapKitAuth';

const authWatchers = new Set();
let watchingAuth = false;

function setAuth(state) {
  if (typeof window === 'undefined' || window[AUTH_FLAG] === state) return;
  window[AUTH_FLAG] = state;
  for (const watcher of [...authWatchers]) {
    try {
      watcher(state);
    } catch {
      /* one bad subscriber does not stop the others */
    }
  }
}

/** 'pending' until Apple answers, then 'ok' or 'failed'. */
export function mapKitAuth() {
  if (typeof window === 'undefined') return 'pending';
  return window[AUTH_FLAG] || 'pending';
}

/** Call `fn` whenever that changes. Returns an unsubscribe. */
export function onMapKitAuth(fn) {
  authWatchers.add(fn);
  return () => authWatchers.delete(fn);
}

function watchAuth(mapkit) {
  if (watchingAuth) return;
  watchingAuth = true;
  if (typeof mapkit.addEventListener !== 'function') {
    // A build with no way to ask. Say yes: Apple is what every other
    // round in the game assumes, and a caller waiting for an answer
    // that cannot come would leave Apple on the shelf for everyone.
    setAuth('ok');
    return;
  }
  mapkit.addEventListener('configuration-change', (event) => {
    if (event?.status === 'Initialized' || event?.status === 'Refreshed') setAuth('ok');
  });
  // Every error status means Apple has stopped drawing: Unauthorized is
  // the wrong origin or a dead token, Too Many Requests is the day's
  // quota, and Timeout and Network Error are a token that never
  // arrived. None of them leave a map on the screen.
  mapkit.addEventListener('error', () => setAuth('failed'));
}

/** Put the script on the page once, however many callers ask at once. */
function loadMapKitScript() {
  return new Promise((resolve, reject) => {
    if (window.mapkit) {
      resolve(window.mapkit);
      return;
    }

    const existing = document.querySelector(`script[src="${MAPKIT_JS_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.mapkit));
      existing.addEventListener('error', () => reject(new Error('Failed to load MapKit JS')));
      return;
    }

    const script = document.createElement('script');
    script.src = MAPKIT_JS_URL;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => {
      if (window.mapkit) resolve(window.mapkit);
      else reject(new Error('MapKit JS loaded but the mapkit object is missing'));
    };
    script.onerror = () => reject(new Error('Failed to load MapKit JS'));
    document.head.appendChild(script);
  });
}

/**
 * Load MapKit and authorize it. Resolves the mapkit global. A failed
 * attempt clears the cached promise so the next caller retries rather
 * than inheriting the failure forever.
 */
export async function initializeMapKit() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const mapkit = await loadMapKitScript();
      // Listening before init, because the Initialized event is fired
      // from inside it and a listener attached afterwards misses it.
      watchAuth(mapkit);
      if (!window[INIT_FLAG]) {
        mapkit.init({
          // Async on purpose: MapKit waits for `done`, and a token cut
          // to this host beats one that merely exists.
          authorizationCallback: (done) => {
            mintedToken()
              .then((token) => done(token || tokenForHost()))
              .catch(() => done(tokenForHost()));
          },
          language: 'en',
        });
        window[INIT_FLAG] = true;
      }
      // Not before this point: on core.js the namespace is bare until
      // the libraries land, so a caller resolving early would read
      // mapkit.Map and get the same throwing getter in a new place.
      await loadLibraries(mapkit);
      return mapkit;
    } catch (error) {
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}
