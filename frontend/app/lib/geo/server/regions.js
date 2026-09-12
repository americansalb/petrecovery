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
 * So a region is now a union of real administrative units, from
 * Natural Earth's 10m admin-1 set (public domain, built into
 * `app/lib/geo/data/admin1-south-asia.json` by
 * `scripts/build-language-regions.js`). India is states and union
 * territories, Sri Lanka districts, Pakistan provinces, Bangladesh
 * divisions, Nepal zones.
 *
 * Three things that follow from real boundaries, and all three are the
 * point of the mode:
 *
 * - **A state is a boundary players think in.** "Kerala" is how someone
 *   who knows Malayalam knows where Malayalam is. Pinning Kerala should
 *   score full marks, and now it does, anywhere in Kerala.
 * - **Regions overlap, because languages do.** Hindi and Urdu share the
 *   Doab, Marathi and Konkani share the Konkan coast, Nepali and
 *   Bengali share Darjeeling. Nothing here is exclusive; a pin can be
 *   inside several languages at once and the reveal says which.
 * - **Not every language is state-shaped.** Bhojpuri is western Bihar
 *   and eastern Uttar Pradesh, not either state whole. Those regions
 *   carry a `clip` box: the state polygon cut down to the part where
 *   the language is spoken. The coast, the state border and the
 *   international border stay real; the one straight edge is the inland
 *   isogloss, which is fuzzy on the ground and contested on paper, so a
 *   straight line is the honest way to draw it.
 *
 * The rest of the world is still discs (`app/lib/geo/languages.js`).
 * They are wrong in the same way, and admin-1 for every country is a
 * bigger file and a bigger research job; South Asia came first because
 * that is the ladder the mode exists for.
 *
 * Server only, because the polygons are 129 KB and the browser has no
 * use for them: the reveal is sent the answer's rings, and nothing
 * else. Keeping them here also keeps them off the round payload, which
 * must never carry the answer.
 */

import { haversineKm } from '../distance';
import { LANGUAGES } from '../languages';
import { MAX_ROUND_SCORE, scoreForDistance, sizeForBox } from '../distance';
import { languagesForLadder } from '../script';
import ADMIN1 from '../data/admin1-south-asia.json';

/** The admin-1 units, by ISO 3166-2 code: `IN-TN`, `LK-41`, `PK-SD`. */
export const UNITS = ADMIN1.units;

export function adminUnit(id) {
  return UNITS[id] || null;
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

  let resolved;
  if (region.units?.length) {
    let rings = [];
    for (const id of region.units) {
      const unit = adminUnit(id);
      if (!unit) throw new Error(`No admin-1 unit ${id} for region ${region.name}`);
      rings = rings.concat(unit.rings);
    }
    if (region.clip) rings = clipRingsToBox(rings, region.clip);
    if (!rings.length) throw new Error(`Region ${region.name} clipped away to nothing`);
    const box = boxOfRings(rings);
    resolved = {
      name: region.name,
      cca2: region.cca2 || adminUnit(region.units[0])?.cca2 || '',
      units: region.units,
      rings,
      box,
      lat: (box.minLat + box.maxLat) / 2,
      lng: (box.minLng + box.maxLng) / 2,
    };
  } else {
    const half = region.radiusKm / Math.SQRT2;
    const dLat = half / 110.574;
    const dLng = half / (111.32 * Math.max(0.1, Math.cos((region.lat * Math.PI) / 180)));
    resolved = {
      name: region.name,
      cca2: region.cca2,
      rings: null,
      radiusKm: region.radiusKm,
      lat: region.lat,
      lng: region.lng,
      box: {
        minLat: region.lat - dLat,
        maxLat: region.lat + dLat,
        minLng: region.lng - dLng,
        maxLng: region.lng + dLng,
      },
    };
  }

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
    let distanceKm;
    let at;
    if (region.rings) {
      const nearest = distanceToRingsKm(guess, region.rings);
      distanceKm = nearest.km;
      at = nearest.at;
    } else {
      const toCentre = haversineKm(guess, region);
      distanceKm = Math.max(0, toCentre - region.radiusKm);
      at = { lat: region.lat, lng: region.lng };
    }
    if (!best || distanceKm < best.distanceKm) best = { region, distanceKm, at };
  }
  return best || { region: null, distanceKm: Number.POSITIVE_INFINITY, at: null };
}

/** Languages in the pool whose region actually contains the pin. */
export function languagesAt(guess, pool = LANGUAGES) {
  return pool.filter((language) =>
    resolveRegions(language).some((region) =>
      region.rings ? pointInRings(guess, region.rings) : haversineKm(guess, region) <= region.radiusKm
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
 * What the reveal draws: every region the language is spoken in, as
 * rings where we have them and a disc where we do not. Sent only with
 * the reveal, never with the round.
 */
export function regionsForReveal(language) {
  return resolveRegions(language).map((region) => ({
    name: region.name,
    cca2: region.cca2,
    lat: region.lat,
    lng: region.lng,
    ...(region.rings ? { rings: region.rings } : { radiusKm: region.radiusKm }),
  }));
}

export const SCRIPT_MAX_SCORE = MAX_ROUND_SCORE;
