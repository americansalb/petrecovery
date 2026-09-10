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
