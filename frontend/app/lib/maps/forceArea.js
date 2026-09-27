/**
 * A Rescue Force's area, for drawing and for "is this place inside it".
 *
 * A force made from the Start a Rescue Force page stores its town's outline
 * from OpenStreetMap (`customBoundary`, GeoJSON). A big town's outline runs
 * to thousands of points and hundreds of kilobytes, far more than a map of
 * every force needs, so `simplifyArea` thins each outer ring
 * (Douglas-Peucker) and rounds to 4 decimals, about 11 meters. Holes are
 * dropped: at directory scale they are invisible.
 *
 * The result is a list of rings of [lat, lng] pairs, the order Leaflet
 * takes. A force without an outline is its center and `radiusMiles`
 * instead. Forces set up automatically from a report get their town's
 * outline looked up after the fact (app/lib/forceOutlines.js).
 *
 * `areaCovers` is the matching rule: a pet belongs to a force's area when
 * it is inside the outline or within a mile of its edge, so a pet lost
 * just over the town line still reaches the town's force.
 *
 * No imports: the server page and the browser both use this file.
 */

const EARTH_RADIUS_MILES = 3958.8;

/** Straight-line miles between two { lat, lng } points. */
export function milesBetween(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function isLngLat(p) {
  return (
    Array.isArray(p) &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) &&
    Math.abs(p[0]) <= 180 &&
    Math.abs(p[1]) <= 90
  );
}

function segmentDistanceSq(p, a, b) {
  let x = a[0];
  let y = a[1];
  let dx = b[0] - x;
  let dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = b[0];
      y = b[1];
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = p[0] - x;
  dy = p[1] - y;
  return dx * dx + dy * dy;
}

/** Douglas-Peucker without recursion, so a 20,000-point ring cannot overflow the stack. */
function thin(ring, tolerance) {
  const n = ring.length;
  if (n <= 4) return ring;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const tolSq = tolerance * tolerance;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxSq = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistanceSq(ring[i], ring[first], ring[last]);
      if (d > maxSq) {
        maxSq = d;
        index = i;
      }
    }
    if (index !== -1 && maxSq > tolSq) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

const round4 = (v) => Math.round(v * 1e4) / 1e4;

/** [lng, lat] ring -> closed [lat, lng] ring, rounded, without repeats; null if it collapses. */
function finish(ring) {
  const out = [];
  for (const [lng, lat] of ring) {
    const p = [round4(lat), round4(lng)];
    const prev = out[out.length - 1];
    if (!prev || prev[0] !== p[0] || prev[1] !== p[1]) out.push(p);
  }
  if (out.length < 3) return null;
  const [first, last] = [out[0], out[out.length - 1]];
  if (first[0] !== last[0] || first[1] !== last[1]) out.push([first[0], first[1]]);
  return out.length >= 4 ? out : null;
}

const MAX_RINGS = 12;

/** Bounding-box area of a [lng, lat] ring, in square degrees: enough to rank rings. */
function boxSize(ring) {
  let west = 180;
  let east = -180;
  let south = 90;
  let north = -90;
  for (const [lng, lat] of ring) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return (east - west) * (north - south);
}

/** The outer rings of a Polygon or MultiPolygon (or a Feature holding one). */
function outerRings(geo) {
  const g = geo?.type === 'Feature' ? geo.geometry : geo;
  if (!g) return [];
  if (g.type === 'Polygon') return [g.coordinates?.[0]];
  if (g.type === 'MultiPolygon') return (g.coordinates || []).map((poly) => poly?.[0]);
  return [];
}

/**
 * The stored outline, thinned for drawing: rings of [lat, lng], at most
 * `maxPoints` points in all, or null when there is no usable outline.
 */
export function simplifyArea(raw, { tolerance = 0.0005, maxPoints = 160 } = {}) {
  let geo = raw;
  if (typeof raw === 'string') {
    try {
      geo = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  // A coastal town can come as dozens of islands; the largest dozen are
  // plenty to recognise it, and every kept ring costs at least 4 points.
  const rings = outerRings(geo)
    .filter((r) => Array.isArray(r) && r.length >= 4 && r.every(isLngLat))
    .map((r) => r.map((p) => [p[0], p[1]]))
    .map((r) => ({ r, size: boxSize(r) }))
    .sort((a, b) => b.size - a.size)
    .slice(0, MAX_RINGS)
    .map(({ r }) => r);
  if (rings.length === 0) return null;

  // Coarser until it fits. Each pass drops rings too small to survive.
  for (let tol = tolerance; tol < 1; tol *= 2) {
    const thinned = rings.map((r) => finish(thin(r, tol))).filter(Boolean);
    const count = thinned.reduce((sum, r) => sum + r.length, 0);
    if (thinned.length === 0) return null;
    if (count <= maxPoints) return thinned;
  }
  return null;
}

function inRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Every outer ring of a stored outline as [lat, lng], unthinned: for
 * checking a point against the town line rather than drawing it.
 */
export function outlineRings(raw) {
  let geo = raw;
  if (typeof raw === 'string') {
    try {
      geo = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return outerRings(geo)
    .filter((r) => Array.isArray(r) && r.length >= 4 && r.every(isLngLat))
    .map((r) => r.map(([lng, lat]) => [lat, lng]));
}

/** Miles from a point to the segment a-b, flat-earth: fine at town scale. */
function milesToSegment(point, a, b) {
  const kx = 69.172 * Math.cos((point.lat * Math.PI) / 180);
  const ky = 69.0;
  const ax = (a[1] - point.lng) * kx;
  const ay = (a[0] - point.lat) * ky;
  const bx = (b[1] - point.lng) * kx;
  const by = (b[0] - point.lat) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.sqrt(x * x + y * y);
}

/**
 * How far a point is outside an outline (rings of [lat, lng]), in miles:
 * 0 inside it, otherwise the distance to its nearest edge.
 */
export function milesOutside(rings, point) {
  if (!Array.isArray(rings) || rings.length === 0 || !point) return Infinity;
  if (rings.some((ring) => inRing(point.lat, point.lng, ring))) return 0;
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i++) best = Math.min(best, milesToSegment(point, ring[i - 1], ring[i]));
  }
  return best;
}

/** How far outside a town's line a pet can be and still be the town's force's pet. */
export const EDGE_MILES = 1;

/**
 * Whether a pet at { lat, lng } is the force's to look for: inside its
 * outline or within `edgeMiles` of it; for a force with no outline, within
 * its circle plus the same margin. `force` has `area` (rings of [lat, lng])
 * or `lat`, `lng` and `radiusMiles`.
 */
export function areaCovers(force, point, edgeMiles = EDGE_MILES) {
  if (!point) return false;
  if (Array.isArray(force.area) && force.area.length > 0) return milesOutside(force.area, point) <= edgeMiles;
  if (force.lat == null || force.lng == null) return false;
  return milesBetween(point, { lat: force.lat, lng: force.lng }) <= (force.radiusMiles || 5) + edgeMiles;
}

/**
 * Whether { lat, lng } is inside the force's area: its outline when it has
 * one, otherwise the circle of `radiusMiles` around its center.
 */
export function areaContains(force, point) {
  if (!point) return false;
  if (Array.isArray(force.area) && force.area.length > 0) {
    return force.area.some((ring) => inRing(point.lat, point.lng, ring));
  }
  if (force.lat == null || force.lng == null) return false;
  return milesBetween(point, { lat: force.lat, lng: force.lng }) <= (force.radiusMiles || 5);
}

/** The middle of an outline's bounding box, for a force stored without a center. */
export function areaCenter(area) {
  if (!Array.isArray(area) || area.length === 0) return null;
  let south = 90;
  let north = -90;
  let west = 180;
  let east = -180;
  for (const ring of area) {
    for (const [lat, lng] of ring) {
      south = Math.min(south, lat);
      north = Math.max(north, lat);
      west = Math.min(west, lng);
      east = Math.max(east, lng);
    }
  }
  return { lat: round4((south + north) / 2), lng: round4((west + east) / 2) };
}
