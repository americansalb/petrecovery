/**
 * Utility functions for the simulator
 */

/**
 * Create a seeded random number generator
 * Uses a simple LCG (Linear Congruential Generator) for reproducibility
 *
 * @param {number} seed - The seed value
 * @returns {Function} A function that returns random numbers between 0 and 1
 */
export function seededRandom(seed) {
  // Ensure seed is a positive integer
  let currentSeed = Math.abs(Math.floor(seed)) || 1;

  // LCG parameters (Numerical Recipes)
  const a = 1664525;
  const c = 1013904223;
  const m = 2 ** 32;

  return function() {
    currentSeed = (a * currentSeed + c) % m;
    return currentSeed / m;
  };
}

/**
 * Convert miles to meters
 */
export function milesToMeters(miles) {
  return miles * 1609.34;
}

/**
 * Convert meters to miles
 */
export function metersToMiles(meters) {
  return meters / 1609.34;
}

/**
 * Calculate haversine distance between two points
 *
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Distance in miles
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3959; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Convert degrees to radians
 */
export function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians) {
  return radians * (180 / Math.PI);
}

/**
 * Calculate bearing between two points
 *
 * @param {number} lat1 - Latitude of first point
 * @param {number} lng1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lng2 - Longitude of second point
 * @returns {number} Bearing in degrees (0-360)
 */
export function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = toRadians(lng2 - lng1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

  let bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * Move a point by a distance and bearing
 *
 * @param {number} lat - Starting latitude
 * @param {number} lng - Starting longitude
 * @param {number} distanceMiles - Distance to move in miles
 * @param {number} bearingDegrees - Direction to move in degrees
 * @returns {Object} New position { lat, lng }
 */
export function movePoint(lat, lng, distanceMiles, bearingDegrees) {
  const R = 3959; // Earth's radius in miles
  const d = distanceMiles;
  const brng = toRadians(bearingDegrees);

  const lat1 = toRadians(lat);
  const lng1 = toRadians(lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d / R) +
    Math.cos(lat1) * Math.sin(d / R) * Math.cos(brng)
  );

  const lng2 = lng1 + Math.atan2(
    Math.sin(brng) * Math.sin(d / R) * Math.cos(lat1),
    Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2)
  );

  return {
    lat: toDegrees(lat2),
    lng: toDegrees(lng2),
  };
}

/**
 * Linear interpolation
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Format minutes as human-readable duration
 */
export function formatDuration(minutes) {
  if (minutes < 60) return `${Math.round(minutes)}m`;

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours < 24) return `${hours}h ${mins}m`;

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}

/**
 * Generate a unique ID
 */
export function generateId() {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}
