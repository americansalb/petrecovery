/**
 * Deterministic randomness for the geo game.
 *
 * Every round draws from a small seeded generator so a seed string
 * reproduces the same sequence of candidate points: that is what makes
 * the daily challenge and challenge links work without a database.
 * With no seed the generator is seeded from crypto/Math randomness.
 *
 * Pure JavaScript, safe to import from client and server code.
 */

const TWO_PI = Math.PI * 2;

/** FNV-1a 32-bit hash of a string, as an unsigned integer. */
export function hashSeed(input) {
  const str = String(input ?? '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: small, fast, good enough for sampling points. */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh unpredictable seed for unseeded games. */
export function randomSeedString() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Build a generator from a seed. Strings are hashed; numbers are used as
 * is; undefined/null gives an unseeded generator.
 */
export function createRng(seed) {
  if (seed === undefined || seed === null || seed === '') {
    return mulberry32(hashSeed(randomSeedString() + Date.now()));
  }
  const numeric = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return mulberry32(numeric);
}

/** Seed for round `index` of a game seeded with `seed`. */
export function roundSeed(seed, index) {
  return `${seed}#${index}`;
}

const toDeg = (rad) => (rad * 180) / Math.PI;
const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * A point uniformly distributed over the surface of the sphere. Picking
 * latitude uniformly would pile points up at the poles; picking the sine
 * of the latitude uniformly does not.
 */
export function randomPointOnSphere(rng) {
  const z = rng() * 2 - 1;
  const lng = rng() * 360 - 180;
  return { lat: toDeg(Math.asin(z)), lng };
}

/**
 * A point uniformly distributed (by area) inside a latitude/longitude box.
 */
export function randomPointInBox(rng, box) {
  const sinMin = Math.sin(toRad(box.minLat));
  const sinMax = Math.sin(toRad(box.maxLat));
  const lat = toDeg(Math.asin(sinMin + rng() * (sinMax - sinMin)));
  const lng = box.minLng + rng() * (box.maxLng - box.minLng);
  return { lat, lng };
}

/**
 * A point uniformly distributed inside a disk of `radiusKm` around a
 * centre, on a locally flat approximation (fine below a few hundred km).
 */
export function randomPointInDisk(rng, center, radiusKm) {
  const r = radiusKm * Math.sqrt(rng());
  const theta = rng() * TWO_PI;
  const dLat = (r * Math.cos(theta)) / 110.574;
  const cosLat = Math.cos(toRad(center.lat)) || 1e-9;
  const dLng = (r * Math.sin(theta)) / (111.32 * cosLat);
  let lng = center.lng + dLng;
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;
  return { lat: clampLat(center.lat + dLat), lng };
}

/** Pick an index with probability proportional to weights[i]. */
export function weightedIndex(rng, weights) {
  let total = 0;
  for (const w of weights) total += w > 0 ? w : 0;
  if (total <= 0) return Math.floor(rng() * weights.length);
  let target = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i] > 0 ? weights[i] : 0;
    if (target < w) return i;
    target -= w;
  }
  return weights.length - 1;
}

export function clampLat(lat) {
  return Math.max(-89.999, Math.min(89.999, lat));
}

/** A random compass heading in degrees. */
export function randomHeading(rng) {
  return Math.floor(rng() * 360);
}
