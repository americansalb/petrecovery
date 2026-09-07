/**
 * Distance, bearing and scoring for the geo game.
 *
 * Scoring follows the shape players already know: 5,000 points for a
 * perfect guess, decaying exponentially with distance. The decay is set
 * by the size of the area you are playing, so a 200 km miss in a small
 * country costs more than a 200 km miss on the whole world.
 *
 * Pure JavaScript, safe to import from client and server code.
 */

export const EARTH_RADIUS_KM = 6371.0088;

/** The scale used for whole-world play. */
export const WORLD_SIZE_KM = 14916.862;

export const MAX_ROUND_SCORE = 5000;

/** A guess within this distance counts as perfect. */
export const PERFECT_DISTANCE_KM = 0.025;

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/** Great-circle distance in kilometres between two {lat, lng} points. */
export function haversineKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b in degrees, 0 = north, clockwise. */
export function initialBearing(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Points for a miss of `distanceKm` in an area of `sizeKm`.
 * 5000 * e^(-10 d / size), rounded, floored at 0.
 */
export function scoreForDistance(distanceKm, sizeKm = WORLD_SIZE_KM) {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return 0;
  if (distanceKm <= PERFECT_DISTANCE_KM) return MAX_ROUND_SCORE;
  const size = Number.isFinite(sizeKm) && sizeKm > 0 ? sizeKm : WORLD_SIZE_KM;
  const score = MAX_ROUND_SCORE * Math.exp((-10 * distanceKm) / size);
  return Math.max(0, Math.round(score));
}

/** Diagonal of a {minLat, minLng, maxLat, maxLng} box, in kilometres. */
export function boxDiagonalKm(box) {
  return haversineKm(
    { lat: box.minLat, lng: box.minLng },
    { lat: box.maxLat, lng: box.maxLng }
  );
}

/**
 * Scoring scale for a bounded area: its diagonal, never smaller than
 * 100 km so a tiny country still leaves room for partial credit.
 */
export function sizeForBox(box) {
  if (!box) return WORLD_SIZE_KM;
  return Math.min(WORLD_SIZE_KM, Math.max(100, boxDiagonalKm(box)));
}

/** "12 m", "850 m", "3.4 km", "1,234 km" */
export function formatDistance(km) {
  if (!Number.isFinite(km)) return '';
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

export function formatScore(points) {
  return Number(points || 0).toLocaleString('en-US');
}
