'use client';

/**
 * MapKit JS, loaded for the game.
 *
 * The game owns this so that app/geo does not import the pet site's map
 * helpers (docs/WANDERGUESSER_SPLIT.md, phase 1.4). The game needs the
 * loader and nothing else: the pet module's annotation, overlay and
 * place-search wrappers are for the shelter maps.
 *
 * The Look Around library is not in the core bundle, so lookAround.js
 * asks for it separately once this resolves.
 */

const MAPKIT_JS_URL = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js';

/**
 * The JWT MapKit authorizes with. The literal is the one the pet site
 * has shipped to every browser since Apple mode was added, and it is
 * locked to the reunitepets.org origin, so it will not work on a domain
 * of the game's own. Setting NEXT_PUBLIC_APPLE_MAPKIT_TOKEN to a token
 * issued for the game's origin is decision D5 in
 * docs/WANDERGUESSER_SPLIT.md, and it has to happen before the game
 * serves its own domain. Kept here unchanged for now so that phase 1
 * changes no behaviour.
 */
const MAPKIT_TOKEN =
  process.env.NEXT_PUBLIC_APPLE_MAPKIT_TOKEN ||
  'eyJraWQiOiI3ODg3N1dWNlo3IiwidHlwIjoiSldUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJCRjIzTjRINjdWIiwiaWF0IjoxNzY3MzA5NTY4LCJvcmlnaW4iOiJyZXVuaXRlcGV0cy5vcmcifQ.zqtlPpm1wfmlfq-BmdxWgsBS9xhAoMQNWFg-ZMzJroyINHPML609QTfjTKAOyX_GrtWoy444YjRt6MnkhUXC5A';

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
          authorizationCallback: (done) => done(MAPKIT_TOKEN),
          language: 'en',
        });
        window[INIT_FLAG] = true;
      }
      return mapkit;
    } catch (error) {
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}
