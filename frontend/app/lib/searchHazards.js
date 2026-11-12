/**
 * What the map shows on a search's ground that someone on foot should know
 * of: main roads, rail lines and water.
 *
 * Founder, 2026-11-12: "Are we inadvertantly telling people to search in
 * ponds, or dangerous neighborhoods, near the highway, distracting them
 * from traffic? We need to be careful about that".
 *
 * The search is cut by distance and direction (searchCircle.js), which
 * knows nothing of what is on the ground. An area could take in a highway,
 * a rail line or a canal and was handed out like any other. This reads
 * those three things from OpenStreetMap, once per search, and says which
 * of them each area holds. The card that gives someone an area then names
 * them, and the person running the search sees the same before they ask
 * anyone to go.
 *
 * What it does not do:
 *
 *  - It never says an area is safe. The map is drawn by volunteers and can
 *    be missing a pond or a road, so an area with nothing listed carries
 *    the same care line as every other.
 *  - It rates no neighbourhood. The site knows nothing of who lives where
 *    and does not guess.
 *  - It takes no ground out of the search. The pet may be there.
 */
import { askOsm, boxAround } from './osmStreets';
import { inArea } from './searchCircle';
import { distanceMeters } from './searchGrid';

export const HAZARD = Object.freeze({ ROAD: 'road', RAIL: 'rail', WATER: 'water' });

/** The list is read a little past the search's edge: a road just outside it is still beside the ground. */
export const HAZARD_MARGIN_METERS = 150;

const MAIN_ROADS = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link']);
const RAILS = new Set(['rail', 'light_rail', 'subway', 'narrow_gauge']);
const WATERWAYS = new Set(['river', 'canal', 'stream']);

const yes = (value) => Boolean(value) && value !== 'no';
const clean = (text, max) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * What a mapped thing is, from its tags: { kind, name, what }, or null for
 * anything else. A road or a line in a tunnel is under the ground, and a
 * rail line on a bridge is over it, so neither is on the ground searched.
 */
export function hazardOf(tags) {
  if (!tags || typeof tags !== 'object') return null;
  const under = yes(tags.tunnel) || tags.covered === 'yes' || tags.location === 'underground';
  if (MAIN_ROADS.has(tags.highway)) return under ? null : { kind: HAZARD.ROAD, name: clean(tags.name, 80) || clean(tags.ref, 24), what: 'road' };
  if (RAILS.has(tags.railway)) return under || yes(tags.bridge) ? null : { kind: HAZARD.RAIL, name: '', what: 'rail' };
  if (WATERWAYS.has(tags.waterway)) return under ? null : { kind: HAZARD.WATER, name: clean(tags.name, 80), what: tags.waterway };
  if (tags.natural === 'water' || tags.landuse === 'reservoir') {
    const what = tags.water === 'river' || tags.water === 'canal' ? tags.water : 'pond';
    return { kind: HAZARD.WATER, name: clean(tags.name, 80), what };
  }
  return null;
}

/**
 * The question put to Overpass. Its second answer is one ordinary named
 * street, ids only: proof that the server asked holds this place, so that
 * "no main road here" from a server that is behind is not taken as true.
 */
export function hazardQuery({ lat, lng, radiusMeters }) {
  const at = `(around:${Math.round(radiusMeters)},${Number(lat).toFixed(6)},${Number(lng).toFixed(6)})`;
  const asked = [
    `way["highway"~"^(motorway|trunk|primary)(_link)?$"]${at};`,
    `way["railway"~"^(rail|light_rail|subway|narrow_gauge)$"]${at};`,
    `way["waterway"~"^(river|canal|stream)$"]${at};`,
    `way["natural"="water"]${at};`,
    `relation["natural"="water"]${at};`,
    `way["landuse"="reservoir"]${at};`,
  ].join('');
  return `[out:json][timeout:8];(${asked});out geom;way["highway"]["name"]${at};out ids 1;`;
}

const point = (lat, lng) => [Number(Number(lat).toFixed(5)), Number(Number(lng).toFixed(5))];

/**
 * The hazards out of an answer, whichever source sent it: [{ kind, name,
 * what, path: [[lat, lng], ...] }]. Overpass sends each way with its line;
 * the map call sends points and ways apart, and a way's line is its points
 * looked up. A lake drawn as a relation is its outer ways.
 */
export function hazardsFrom(elements = []) {
  const at = new Map();
  for (const el of elements) {
    if (el && el.type === 'node' && Number.isFinite(el.lat) && Number.isFinite(el.lon)) at.set(el.id, el);
  }
  const lineOf = (way) => {
    if (Array.isArray(way?.geometry)) return way.geometry.filter((g) => g && Number.isFinite(g.lat) && Number.isFinite(g.lon)).map((g) => point(g.lat, g.lon));
    if (Array.isArray(way?.nodes)) return way.nodes.filter((id) => at.has(id)).map((id) => point(at.get(id).lat, at.get(id).lon));
    return [];
  };
  const ways = new Map();
  for (const el of elements) {
    if (el && el.type === 'way' && !ways.has(el.id)) ways.set(el.id, el);
  }
  const out = [];
  const used = new Set();
  const add = (is, id, path) => {
    if (path.length < 2 || (id != null && used.has(id))) return;
    if (id != null) used.add(id);
    out.push({ ...is, path });
  };
  for (const way of ways.values()) {
    const is = hazardOf(way.tags);
    if (is) add(is, way.id, lineOf(way));
  }
  for (const el of elements) {
    if (!el || el.type !== 'relation' || !Array.isArray(el.members)) continue;
    const is = hazardOf(el.tags);
    if (!is || is.kind !== HAZARD.WATER) continue;
    for (const member of el.members) {
      if (!member || member.type !== 'way' || member.role === 'inner') continue;
      add(is, member.ref, lineOf(Array.isArray(member.geometry) ? member : ways.get(member.ref)));
    }
  }
  return out;
}

const ORDER = [HAZARD.ROAD, HAZARD.RAIL, HAZARD.WATER];
/** Points closer together than this say nothing a search needs. */
const THIN_METERS = 6;
/** How many points one search keeps. A road is kept before water, because a road is where people get hurt first. */
const MAX_POINTS = 5000;

/**
 * The list cut to what a search keeps: only the parts within `reach` of
 * the centre, with points that crowd each other dropped.
 */
export function trimHazards(hazards = [], center, reach) {
  const out = [];
  let points = 0;
  const sorted = [...hazards].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  for (const h of sorted) {
    let run = [];
    const close = () => {
      if (run.length >= 2 && points + run.length <= MAX_POINTS) {
        out.push({ kind: h.kind, name: h.name, what: h.what, path: run });
        points += run.length;
      }
      run = [];
    };
    for (const [lat, lng] of h.path || []) {
      if (distanceMeters(center, { lat, lng }) > reach) {
        close();
        continue;
      }
      const last = run[run.length - 1];
      if (last && distanceMeters({ lat: last[0], lng: last[1] }, { lat, lng }) < THIN_METERS) continue;
      run.push([lat, lng]);
    }
    close();
  }
  return out;
}

/** What the map shows within `radiusMeters` of a point. Rejects when no map server answers. */
export async function fetchHazards({ lat, lng, radiusMeters, ask = askOsm, ...rest }) {
  const center = { lat: Number(lat), lng: Number(lng) };
  const { elements } = await ask({
    query: hazardQuery({ lat, lng, radiusMeters }),
    box: boxAround({ lat, lng, radiusMeters }),
    // Any way at all, the proof street included, says the server holds this place.
    good: (list) => list.some((el) => el && el.type === 'way'),
    ...rest,
  });
  return trimHazards(hazardsFrom(elements), center, radiusMeters);
}

/** A line is measured in steps this long, so a long straight piece is not missed by where its middle falls. */
const STEP_METERS = 20;
/** How much of a thing must lie in an area before the area is said to hold it. */
const LEAST = { [HAZARD.ROAD]: 30, [HAZARD.RAIL]: 30, [HAZARD.WATER]: 40 };
const MOST = { [HAZARD.ROAD]: 2, [HAZARD.RAIL]: 1, [HAZARD.WATER]: 2 };

/**
 * The hazards an area holds: [{ kind, name, what }], roads first, the one
 * with the most length in the area first of its kind. `center` is the
 * centre the area is measured from (the search's, or a sighting's for the
 * circle round it).
 */
export function hazardsIn(area, center, hazards = []) {
  const inside = new Map();
  for (const h of hazards) {
    if (!h || !ORDER.includes(h.kind) || !Array.isArray(h.path)) continue;
    let meters = 0;
    for (let i = 1; i < h.path.length; i += 1) {
      const p = { lat: h.path[i - 1][0], lng: h.path[i - 1][1] };
      const q = { lat: h.path[i][0], lng: h.path[i][1] };
      const length = distanceMeters(p, q);
      if (!(length > 0)) continue;
      const parts = Math.max(1, Math.ceil(length / STEP_METERS));
      for (let k = 0; k < parts; k += 1) {
        const t = (k + 0.5) / parts;
        if (inArea({ lat: p.lat + (q.lat - p.lat) * t, lng: p.lng + (q.lng - p.lng) * t }, center, area)) meters += length / parts;
      }
    }
    if (!meters) continue;
    const key = `${h.kind}|${h.name || `~${h.what}`}`;
    const held = inside.get(key) || { kind: h.kind, name: h.name || '', what: h.what, meters: 0 };
    held.meters += meters;
    inside.set(key, held);
  }
  const out = [];
  for (const kind of ORDER) {
    const all = [...inside.values()].filter((h) => h.kind === kind && h.meters >= LEAST[kind]);
    // A road with a name stands for the slip roads beside it that have none, and a creek with a name for the
    // stretches of its bed the map draws without one. A pond with no name is its own thing.
    const named = all.filter((h) => h.name);
    const kept = !named.length ? all : kind === HAZARD.WATER ? [...named, ...all.filter((h) => !h.name && h.what === 'pond')] : named;
    kept
      .sort((a, b) => Number(Boolean(b.name)) - Number(Boolean(a.name)) || b.meters - a.meters || (a.name < b.name ? -1 : 1))
      .slice(0, MOST[kind])
      .forEach(({ name, what }) => out.push({ kind, name, what }));
  }
  return out;
}

/** A stored list read back: only well-formed entries, so a bad row names nothing. */
export function parseHazards(text) {
  if (!text) return [];
  try {
    const list = JSON.parse(text);
    return Array.isArray(list) ? list.filter((h) => h && ORDER.includes(h.kind)) : [];
  } catch {
    return [];
  }
}
