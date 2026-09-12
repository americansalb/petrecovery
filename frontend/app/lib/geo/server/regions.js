/**
 * Where a language is spoken, as a shape rather than a circle.
 *
 * The script game used to hold each language's heartlands as discs: a
 * centre and a radius. A disc is wrong in a way you can see on the map.
 * The Maithili disc covered half of Nepal and a corner of Bangladesh,
 * the Marathi one reached into Telangana, and every coastal language
 * had most of its area out at sea. It also taught the wrong thing: a
 * player pinning the right state could be scored as a miss because the
 * circle drawn over that state happened to be centred elsewhere.
 *
 * So a region is a union of real places: a whole country for a language
 * that is one, subdivisions where a language covers part of a country
 * or crosses several, and either of those clipped to a box where the
 * line runs through a unit rather than round it. The source is Natural
 * Earth's 10m admin-0 and admin-1 sets (public domain), built into
 * `app/lib/geo/data/language-regions.json` by
 * `scripts/build-language-regions.js`.
 *
 * Four things that follow, and all four are the point of the mode:
 *
 * - **A state is a boundary players think in.** "Kerala" is how someone
 *   who knows Malayalam knows where Malayalam is. Pinning Kerala should
 *   score full marks, and now it does, anywhere in Kerala.
 * - **Regions overlap, because languages do.** Hindi and Urdu share the
 *   Doab, French and Dutch share Brussels, Kurdish and Arabic share
 *   Erbil, Pashto and Dari share Kabul. Nothing here is exclusive; a
 *   pin can be inside several languages at once and the reveal says
 *   which.
 * - **Not every language is state-shaped.** Bhojpuri is western Bihar
 *   and eastern Uttar Pradesh, not either state whole; Basque is the
 *   western third of one French department. Those regions carry a
 *   `clip` box: the polygon cut down to the part where the language is
 *   spoken. The coast, the state border and the international border
 *   stay real; the one straight edge is the inland isogloss, which is
 *   fuzzy on the ground and contested on paper, so a straight line is
 *   the honest way to draw it.
 * - **The map does not take sides.** A region says where a language is
 *   spoken, never who a place belongs to.
 *
 * Server only, because the polygons are 1.2 MB and the browser has no
 * use for them: the reveal is sent the answer's own rings, thinned for
 * drawing, and nothing else. Keeping them here also keeps them off the
 * round payload, which must never carry the answer.
 */

import { haversineKm } from '../distance';
import { LANGUAGES } from '../languages';
import { MAX_ROUND_SCORE, scoreForDistance, sizeForBox } from '../distance';
import { languagesForLadder } from '../script';
import DATA from '../data/language-regions.json';

/** The admin-1 units, by ISO 3166-2 code: `IN-TN`, `LK-41`, `PK-SD`. */
export const UNITS = DATA.units;
/** Whole countries, by ISO 3166-1 alpha-2: `IS`, `BR`, `TH`. */
export const COUNTRIES = DATA.countries;

export function adminUnit(id) {
  return UNITS[id] || null;
}

export function countryShape(code) {
  return COUNTRIES[code] || null;
}

/** Ray casting on [lng, lat] rings. No antimeridian in South Asia. */
function pointInRing({ lat, lng }, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInRings(point, rings) {
  return rings.some((ring) => pointInRing(point, ring));
}

/**
 * How far outside a region still counts as inside it.
 *
 * The polygons are simplified to about two kilometres, so a coastline
 * is only known to about two kilometres, and a city on one can fall the
 * wrong side of its own country: Reykjavik, Montreal and Copenhagen all
 * did. Three kilometres is the error bar on the map, not a favour to
 * the player: at this scale the boundary genuinely is not known better
 * than that, and the score at 3 km is 4,990 out of 5,000 anyway. What
 * it buys is that the game does not tell somebody who pinned Copenhagen
 * that they were not in Denmark.
 */
export const EDGE_GRACE_KM = 3;

function boxOfRings(rings) {
  const box = { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 };
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lat < box.minLat) box.minLat = lat;
      if (lat > box.maxLat) box.maxLat = lat;
      if (lng < box.minLng) box.minLng = lng;
      if (lng > box.maxLng) box.maxLng = lng;
    }
  }
  return box;
}

/**
 * Distance from a pin to the nearest point on a region's edge, in
 * kilometres, and where on the edge that is. Zero inside.
 *
 * Far away the nearest vertex is the answer to within a rounding error
 * and the score is nearly zero either way, so it stops there. Close in,
 * where the number is the difference between a good guess and a great
 * one, it measures to the segment, on a plane laid flat at the pin.
 */
export function distanceToRingsKm(point, rings) {
  if (pointInRings(point, rings)) return { km: 0, at: point };
  const measured = measureToRingsKm(point, rings);
  return measured.km <= EDGE_GRACE_KM ? { km: 0, at: point } : measured;
}

function measureToRingsKm(point, rings) {

  let nearest = null;
  let nearestKm = Infinity;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      const km = haversineKm(point, { lat, lng });
      if (km < nearestKm) {
        nearestKm = km;
        nearest = { lat, lng };
      }
    }
  }
  if (!nearest) return { km: Infinity, at: null };
  if (nearestKm > 200) return { km: nearestKm, at: nearest };

  // Flat-earth is exact enough over a couple of hundred kilometres, and
  // this is the only part of the round where a kilometre shows.
  const kx = 111.32 * Math.cos((point.lat * Math.PI) / 180);
  const ky = 110.574;
  const px = 0;
  const py = 0;
  let bestKm = nearestKm;
  let bestAt = nearest;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = (ring[j][0] - point.lng) * kx;
      const ay = (ring[j][1] - point.lat) * ky;
      const bx = (ring[i][0] - point.lng) * kx;
      const by = (ring[i][1] - point.lat) * ky;
      const dx = bx - ax;
      const dy = by - ay;
      const span = dx * dx + dy * dy;
      const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / span));
      const cx = ax + t * dx;
      const cy = ay + t * dy;
      const km = Math.hypot(cx - px, cy - py);
      if (km < bestKm) {
        bestKm = km;
        bestAt = { lat: point.lat + cy / ky, lng: point.lng + cx / kx };
      }
    }
  }
  return { km: bestKm, at: bestAt };
}

/**
 * A cheap lower bound on how far a point is from a region: the distance
 * to its bounding box. Zero inside the box.
 *
 * Every guess is measured against every region of every language in the
 * pool, and most of those are on other continents. Ruling those out on
 * two subtractions rather than on ten thousand vertices took the
 * corpus-wide test from eighteen seconds to under one.
 */
export function boxDistanceKm(point, box) {
  const dLat = Math.max(box.minLat - point.lat, 0, point.lat - box.maxLat);
  const dLng = Math.max(box.minLng - point.lng, 0, point.lng - box.maxLng);
  const kx = 111.32 * Math.cos((point.lat * Math.PI) / 180);
  return Math.hypot(dLat * 110.574, dLng * kx);
}

/** Sutherland-Hodgman against one edge of the clip box. */
function clipRingToEdge(ring, inside, intersect) {
  const out = [];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const current = ring[i];
    const previous = ring[j];
    const currentIn = inside(current);
    const previousIn = inside(previous);
    if (currentIn) {
      if (!previousIn) out.push(intersect(previous, current));
      out.push(current);
    } else if (previousIn) {
      out.push(intersect(previous, current));
    }
  }
  return out;
}

/**
 * A ring cut down to a box. Used where a language covers part of a
 * state: the state's own outline is kept wherever it is inside the box,
 * and the cut itself is a straight line, which is what an isogloss
 * across a plain looks like on any honest map.
 */
export function clipRingsToBox(rings, box) {
  const planes = [];
  if (Number.isFinite(box.minLng)) {
    planes.push([(p) => p[0] >= box.minLng, (a, b) => lerpAtLng(a, b, box.minLng)]);
  }
  if (Number.isFinite(box.maxLng)) {
    planes.push([(p) => p[0] <= box.maxLng, (a, b) => lerpAtLng(a, b, box.maxLng)]);
  }
  if (Number.isFinite(box.minLat)) {
    planes.push([(p) => p[1] >= box.minLat, (a, b) => lerpAtLat(a, b, box.minLat)]);
  }
  if (Number.isFinite(box.maxLat)) {
    planes.push([(p) => p[1] <= box.maxLat, (a, b) => lerpAtLat(a, b, box.maxLat)]);
  }

  const out = [];
  for (const ring of rings) {
    let clipped = ring;
    for (const [inside, intersect] of planes) {
      clipped = clipRingToEdge(clipped, inside, intersect);
      if (clipped.length < 3) break;
    }
    if (clipped.length >= 3) {
      const closed = clipped.slice();
      const [first] = closed;
      const last = closed[closed.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) closed.push([first[0], first[1]]);
      out.push(closed);
    }
  }
  return out;
}

function lerpAtLng(a, b, lng) {
  const t = (lng - a[0]) / (b[0] - a[0]);
  return [lng, a[1] + t * (b[1] - a[1])];
}

function lerpAtLat(a, b, lat) {
  const t = (lat - a[1]) / (b[1] - a[1]);
  return [a[0] + t * (b[0] - a[0]), lat];
}

/**
 * A region's geometry, built once and kept. A region is either a list
 * of admin-1 units (optionally clipped to a box) or, outside South
 * Asia, still a disc.
 */
const RESOLVED = new WeakMap();

export function resolveRegion(region) {
  if (!region) return null;
  const cached = RESOLVED.get(region);
  if (cached) return cached;

  let rings = [];
  for (const code of region.countries || []) {
    const country = countryShape(code);
    if (!country) throw new Error(`No country ${code} for region ${region.name}`);
    rings = rings.concat(country.rings);
  }
  for (const id of region.units || []) {
    const unit = adminUnit(id);
    if (!unit) throw new Error(`No admin-1 unit ${id} for region ${region.name}`);
    rings = rings.concat(unit.rings);
  }
  if (!rings.length) throw new Error(`Region ${region.name} names no country and no unit`);
  if (region.clip) rings = clipRingsToBox(rings, region.clip);
  if (!rings.length) throw new Error(`Region ${region.name} clipped away to nothing`);
  const box = boxOfRings(rings);
  const resolved = {
    name: region.name,
    cca2: region.cca2 || region.countries?.[0] || adminUnit(region.units?.[0])?.cca2 || '',
    units: region.units,
    countries: region.countries,
    rings,
    box,
    lat: (box.minLat + box.maxLat) / 2,
    lng: (box.minLng + box.maxLng) / 2,
  };

  RESOLVED.set(region, resolved);
  return resolved;
}

export function resolveRegions(language) {
  return language.regions.map(resolveRegion);
}

/**
 * How far a pin is from a language: to the edge of its nearest region,
 * not its centre. Anywhere inside is a hit, because a language is an
 * area, and punishing a player for pinning the wrong end of a state
 * they correctly named would be teaching them nothing.
 */
export function distanceToLanguage(guess, language) {
  let best = null;
  for (const region of resolveRegions(language)) {
    // The box is a lower bound: if it is further than the best so far,
    // no vertex inside it can be nearer.
    if (best && boxDistanceKm(guess, region.box) >= best.distanceKm) continue;
    const nearest = distanceToRingsKm(guess, region.rings);
    if (!best || nearest.km < best.distanceKm) best = { region, distanceKm: nearest.km, at: nearest.at };
  }
  return best || { region: null, distanceKm: Number.POSITIVE_INFINITY, at: null };
}

/** Languages in the pool whose region actually contains the pin. */
export function languagesAt(guess, pool = LANGUAGES) {
  return pool.filter((language) =>
    resolveRegions(language).some(
      (region) =>
        boxDistanceKm(guess, region.box) <= EDGE_GRACE_KM &&
        (pointInRings(guess, region.rings) || distanceToRingsKm(guess, region.rings).km === 0)
    )
  );
}

/**
 * The scoring scale for a ladder: the diagonal of the box its answers
 * live in. This is what makes the South Asia ladder hard. In the world
 * ladder, pinning the right continent for Tamil is worth real points;
 * inside South Asia, where every answer is already in that box, the
 * same pin is worth almost nothing.
 */
const LADDER_SIZE = new Map();

export function ladderSizeKm(id) {
  if (LADDER_SIZE.has(id)) return LADDER_SIZE.get(id);
  const box = { minLat: 90, minLng: 180, maxLat: -90, maxLng: -180 };
  for (const language of languagesForLadder(id)) {
    for (const region of resolveRegions(language)) {
      box.minLat = Math.min(box.minLat, region.box.minLat);
      box.maxLat = Math.max(box.maxLat, region.box.maxLat);
      box.minLng = Math.min(box.minLng, region.box.minLng);
      box.maxLng = Math.max(box.maxLng, region.box.maxLng);
    }
  }
  const size = sizeForBox(box);
  LADDER_SIZE.set(id, size);
  return size;
}

/**
 * Score one guess.
 *
 * Returns the points, how far off the pin was, which region it was
 * measured against, and what else is spoken where the player pinned:
 * "you put Marathi in Punjabi country" teaches more than a number.
 */
export function scoreScriptGuess({ guess, language, ladder = 'world', sizeKm }) {
  if (!guess || !language) return null;
  const scale = Number.isFinite(sizeKm) && sizeKm > 0 ? sizeKm : ladderSizeKm(ladder);
  const nearest = distanceToLanguage(guess, language);
  const points = scoreForDistance(nearest.distanceKm, scale);
  const here = languagesAt(guess, languagesForLadder(ladder))
    .filter((other) => other.code !== language.code)
    .slice(0, 3)
    .map((other) => ({ code: other.code, name: other.name }));
  return {
    points,
    distanceKm: nearest.distanceKm,
    region: nearest.region ? { name: nearest.region.name, lat: nearest.region.lat, lng: nearest.region.lng } : null,
    nearestPoint: nearest.at,
    inRegion: nearest.distanceKm === 0,
    alsoSpokenHere: here,
    sizeKm: scale,
  };
}

/**
 * Ramer-Douglas-Peucker on a ring, in degrees. Used only for drawing.
 */
function thin(ring, tolerance) {
  if (ring.length < 5) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;
  const stack = [[0, ring.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const [x1, y1] = ring[first];
    const [x2, y2] = ring[last];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const span = dx * dx + dy * dy;
    let worst = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const [x, y] = ring[i];
      const t = span === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / span));
      const distance = Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
      if (distance > worst) {
        worst = distance;
        index = i;
      }
    }
    if (worst > tolerance && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  const out = ring.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : ring;
}

/**
 * What the reveal draws, and only what it needs to draw it.
 *
 * Scoring wants the coastline as exact as the data gets; a reveal wants
 * a shape the player recognises, on a map a few hundred pixels wide,
 * over a wire that might be a phone's. Spanish is five regions across
 * twenty countries and 186 KB of vertices at scoring precision, which
 * is a ridiculous thing to send to draw a shape that size. Thinned to
 * the region's own scale it is a tenth of that and looks the same.
 *
 * Sent only with the reveal, never with the round.
 */
const REVEAL = new WeakMap();

export function regionsForReveal(language) {
  const cached = REVEAL.get(language);
  if (cached) return cached;
  const out = resolveRegions(language).map((region) => {
    const span = Math.max(region.box.maxLat - region.box.minLat, region.box.maxLng - region.box.minLng);
    // About a four-hundredth of the region's own width: the error is
    // under a pixel at the zoom the reveal flies to.
    const tolerance = Math.min(0.25, Math.max(0.01, span / 400));
    const rings = region.rings.map((ring) => thin(ring, tolerance)).filter((ring) => ring.length >= 4);
    return {
      name: region.name,
      cca2: region.cca2,
      lat: region.lat,
      lng: region.lng,
      rings: rings.length ? rings : region.rings,
    };
  });
  REVEAL.set(language, out);
  return out;
}

export const SCRIPT_MAX_SCORE = MAX_ROUND_SCORE;
