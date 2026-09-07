'use client';

/**
 * Loads the Google Maps JavaScript API once per page and hands back the
 * libraries the game uses. This is the official bootstrap, written out
 * so it can be read: it registers google.maps.importLibrary, appends
 * the script with the requested libraries, and resolves when the API
 * calls back.
 *
 * The key is the referrer-restricted browser key from /api/geo/config.
 */

let loadPromise = null;
let loadedKey = '';
const authFailureListeners = new Set();

/**
 * Google calls window.gm_authFailure when the key is rejected after the
 * script has loaded (wrong key, API not enabled, or the page's address
 * missing from the key's website restrictions). Subscribers get a plain
 * sentence that says what to fix. Returns an unsubscribe function.
 */
export function onGoogleMapsAuthFailure(listener) {
  authFailureListeners.add(listener);
  return () => authFailureListeners.delete(listener);
}

function installAuthFailureHook() {
  if (typeof window === 'undefined' || window.__reunitepetsGeoAuthHook) return;
  window.__reunitepetsGeoAuthHook = true;
  window.gm_authFailure = () => {
    const origin = window.location.origin;
    const message =
      `Google rejected the browser key for this address. In the Cloud Console, open the browser key, ` +
      `add ${origin}/* under its website restrictions, make sure the Maps JavaScript API is enabled on it, then reload.`;
    for (const listener of authFailureListeners) listener(message);
  };
}

function bootstrap(key) {
  if (typeof window === 'undefined') return Promise.reject(new Error('Google Maps needs a browser'));
  window.google = window.google || {};
  const maps = (window.google.maps = window.google.maps || {});
  if (maps.importLibrary) return Promise.resolve(maps);

  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({ key, v: 'weekly', loading: 'async', callback: '__reunitepetsGeoMapsReady' });
    window.__reunitepetsGeoMapsReady = () => {
      delete window.__reunitepetsGeoMapsReady;
      resolve(window.google.maps);
    };
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => reject(new Error('The Google Maps script could not be loaded. Check the browser key and its referrer restrictions.'));
    document.head.appendChild(script);
  });
}

/**
 * Resolve to { maps, StreetViewPanorama, Map, Marker, Polyline, LatLngBounds, ... }.
 */
export function loadGoogleMaps(key) {
  if (!key) return Promise.reject(new Error('No Google Maps browser key'));
  if (loadPromise && loadedKey === key) return loadPromise;
  loadedKey = key;
  installAuthFailureHook();
  loadPromise = bootstrap(key)
    .then(async (maps) => {
      const [core, streetView, mapsLib] = await Promise.all([
        maps.importLibrary('core'),
        maps.importLibrary('streetView'),
        maps.importLibrary('maps'),
      ]);
      // Classic markers live on the marker library in newer versions and on
      // the root namespace in older ones.
      let Marker = maps.Marker;
      try {
        const markerLib = await maps.importLibrary('marker');
        Marker = markerLib.Marker || maps.Marker;
      } catch {
        Marker = maps.Marker;
      }
      return {
        maps,
        StreetViewPanorama: streetView.StreetViewPanorama,
        StreetViewSource: streetView.StreetViewSource,
        Map: mapsLib.Map,
        Polyline: mapsLib.Polyline,
        Marker,
        LatLng: core.LatLng,
        LatLngBounds: core.LatLngBounds,
        event: core.event,
      };
    })
    .catch((error) => {
      loadPromise = null;
      throw error;
    });
  return loadPromise;
}
