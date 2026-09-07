/**
 * Environment for the geo game, read at call time so tests and hot
 * reloads see changes. Server only.
 *
 *   GOOGLE_STREET_VIEW_API_KEY   server key with the Street View Static API
 *                                enabled (the free metadata probe). Falls
 *                                back to GOOGLE_PLACES_API_KEY if that key
 *                                has the API enabled too.
 *   GOOGLE_MAPS_BROWSER_KEY      referrer-restricted key with the Maps
 *                                JavaScript API enabled; sent to the browser
 *                                by /api/geo/config. NEXT_PUBLIC_ variant
 *                                accepted for hosts that inline at build.
 *   GEO_TOKEN_SECRET             optional; NEXTAUTH_SECRET is used otherwise.
 */

export function getGeoServerConfig(env = process.env) {
  const googleServerKey =
    env.GOOGLE_STREET_VIEW_API_KEY || env.GOOGLE_MAPS_SERVER_KEY || env.GOOGLE_PLACES_API_KEY || '';
  const googleBrowserKey = env.GOOGLE_MAPS_BROWSER_KEY || env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY || '';
  const tokenSecret = env.GEO_TOKEN_SECRET || env.NEXTAUTH_SECRET || '';
  return {
    googleServerKey,
    googleBrowserKey,
    tokenSecret,
    googleConfigured: Boolean(googleServerKey && googleBrowserKey),
    // The MapKit loader always has a token (env or the origin-locked
    // default), so Apple is "configured"; Look Around itself may still
    // refuse on an origin the token does not cover.
    appleConfigured: true,
  };
}
