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

/**
 * A secret for a machine that has none.
 *
 * Outside production, a missing token secret used to mean every round
 * endpoint answered 503 and the game could not be played at all by
 * someone who had just cloned the repository. That is a bad first five
 * minutes for no security benefit: the thing a token secret protects is
 * the answer to a round, and there is nothing to protect on a laptop
 * nobody else can reach.
 *
 * So one is generated, once per process, and said out loud. It is
 * random rather than a fixed string, so a deployment that reaches this
 * by accident gets tokens that stop working on restart and a log line
 * explaining why, instead of a predictable secret that quietly signs
 * real ones.
 *
 * Only `next dev` reaches this. Production must refuse without a secret,
 * and the test suite asserts that it refuses, so neither gets one it did
 * not set. To try a production build locally, `npm run geo:demo` mints a
 * secret and passes it in rather than weakening the server's default.
 */
let devSecret = '';
function developmentSecret(env) {
  // Development only. Production must refuse, and the test suite asserts
  // that it refuses, so neither may be handed a secret it did not set.
  if (env.NODE_ENV !== 'development') return '';
  if (!devSecret) {
    // eslint-disable-next-line global-require
    devSecret = require('node:crypto').randomBytes(32).toString('base64url');
    console.warn(
      '[geo] No GEO_TOKEN_SECRET or NEXTAUTH_SECRET, so a throwaway one was generated for this process.\n' +
        '      Rounds work; every token stops working when the server restarts.\n' +
        '      Set GEO_TOKEN_SECRET before deploying anything.'
    );
  }
  return devSecret;
}

export function getGeoServerConfig(env = process.env) {
  const googleServerKey =
    env.GOOGLE_STREET_VIEW_API_KEY || env.GOOGLE_MAPS_SERVER_KEY || env.GOOGLE_PLACES_API_KEY || '';
  const googleBrowserKey = env.GOOGLE_MAPS_BROWSER_KEY || env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY || '';
  const tokenSecret = env.GEO_TOKEN_SECRET || env.NEXTAUTH_SECRET || developmentSecret(env);
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
