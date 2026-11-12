/**
 * The search as a circle of ground.
 *
 * A lost pet can be anywhere on the ground: a yard, under a deck, in a
 * shed, on a creek bank. It does not keep to streets. So a search is a
 * circle around where the pet was lost, and the circle is cut into a few
 * areas of ground that one person can search in one outing:
 *
 *   the middle        everything within `inner` metres
 *   four sides        north, east, south and west, from `inner` to `edge`
 *   eight outer areas from `edge` to `wide`, once the circle is widened
 *
 * A fresh sighting is a second, small circle of its own (`seen` metres
 * round it), and one person goes there, never a group.
 *
 * The board this replaces handed out streets (app/lib/streetWalks.js) and
 * counted streets walked. With every street walked it would have read as
 * finished while every yard between them was untouched. Streets are still
 * read here, for one thing: naming the two that run through an area, so a
 * person can find it.
 *
 * The sizes follow the two published findings the site cites
 * (app/mission-control/lib/insight.js): dogs, 42% within 400 feet of home
 * and 70% within a mile; cats, half within 50 m of where they went missing
 * and 3 in 4 within 500 m. A circle is where to look first, never a claim
 * about where this pet is.
 *
 * Everything here is pure and unit-tested (__tests__/lib/searchCircle.test.js).
 */
import { distanceMeters, SIGHTING_PRIORITY_WINDOW_MS } from './searchGrid';
import { bearingDegrees } from './streetWalks';

/** One person going round ground on foot once, looking low. A park with no street in it takes as long as a block of houses. */
export const MINUTES_PER_HECTARE = 4;
/**
 * A cat hides within a few houses and goes quiet (the site's brief,
 * app/lib/brief.js), so close in every hiding place is looked into and the
 * same ground takes five times as long.
 */
export const MINUTES_PER_HECTARE_CLOSE_CAT = 20;

/**
 * Metres: the middle (`inner`), the circle a search starts with (`edge`),
 * the circle after it is widened (`wide`) and the circle round a sighting
 * (`seen`). `rate` is minutes a hectare inside the starting circle and
 * round a sighting; past the edge everything is covered at the plain rate.
 */
export const CIRCLES = Object.freeze({
  DOG: Object.freeze({ inner: 150, edge: 400, wide: 800, seen: 150, rate: MINUTES_PER_HECTARE }),
  CAT: Object.freeze({ inner: 50, edge: 150, wide: 500, seen: 50, rate: MINUTES_PER_HECTARE_CLOSE_CAT }),
});
/** A pet that is neither is searched for like a dog: the wider of the two. */
export const DEFAULT_CIRCLE = CIRCLES.DOG;
/** `ring` of an area: the middle, a side, an outer area, the circle round a sighting. */
export const RING = Object.freeze({ MIDDLE: 0, SIDE: 1, OUTER: 2, SEEN: 3 });

const SIDES = [
  ['north', 'North side', 'north', 315, 45],
  ['east', 'East side', 'east', 45, 135],
  ['south', 'South side', 'south', 135, 225],
  ['west', 'West side', 'west', 225, 315],
];
const OUTER = [
  ['outer-north', 'Far north', 'north', 337.5, 22.5],
  ['outer-north-east', 'Far north-east', 'north-east', 22.5, 67.5],
  ['outer-east', 'Far east', 'east', 67.5, 112.5],
  ['outer-south-east', 'Far south-east', 'south-east', 112.5, 157.5],
  ['outer-south', 'Far south', 'south', 157.5, 202.5],
  ['outer-south-west', 'Far south-west', 'south-west', 202.5, 247.5],
  ['outer-west', 'Far west', 'west', 247.5, 292.5],
  ['outer-north-west', 'Far north-west', 'north-west', 292.5, 337.5],
];

/** The sizes for a species: { inner, edge, wide, seen } in metres, and its `rate`. */
export function circleFor(species) {
  return CIRCLES[String(species || '').toUpperCase()] || DEFAULT_CIRCLE;
}

/**
 * The areas of a circle, most central first. Each is
 * { key, name, way, ring, from, to, a, b }: `from` and `to` are metres from
 * the centre, `a` and `b` bearings in degrees clockwise from north (the
 * middle is the whole turn), `ring` 0 for the middle, 1 for a side and 2
 * for an outer area. `widened` adds the outer eight.
 */
export function areasOf({ inner, edge, wide }, { widened = false } = {}) {
  const areas = [{ key: 'middle', name: 'The middle', way: null, ring: 0, from: 0, to: inner, a: 0, b: 360 }];
  for (const [key, name, way, a, b] of SIDES) areas.push({ key, name, way, ring: 1, from: inner, to: edge, a, b });
  if (widened) for (const [key, name, way, a, b] of OUTER) areas.push({ key, name, way, ring: 2, from: edge, to: wide, a, b });
  return areas;
}

/** Whether a bearing falls in a turn from `a` to `b`, clockwise. The start belongs to the area, the end to the next. */
function inTurn(bearing, a, b) {
  if ((b - a) % 360 === 0) return true;
  return a < b ? bearing >= a && bearing < b : bearing >= a || bearing < b;
}

/** Whether a point ({ lat, lng }) is in an area of the circle around `center`. */
export function inArea(point, center, area) {
  const away = distanceMeters(center, point);
  if (away < area.from || away >= area.to) return false;
  return inTurn(bearingDegrees(center, point) % 360, area.a, area.b);
}

/** The key of the area a point is in, or null where it is outside the circle. */
export function areaAt(point, center, circle, { widened = false } = {}) {
  if (!point || !center || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
  const hit = areasOf(circle, { widened }).find((area) => inArea(point, center, area));
  return hit ? hit.key : null;
}

/** How much ground an area is, in hectares. */
export function hectaresOf(area) {
  const turn = ((((area.b - area.a) % 360) + 360) % 360 || 360) / 360;
  return (Math.PI * (area.to * area.to - area.from * area.from) * turn) / 10000;
}

/**
 * About how long one person takes to go round an area once: from its size,
 * to the nearest five minutes, never under ten. `circle` is the species'
 * own (its `rate` applies inside the starting circle and round a sighting).
 */
export function minutesFor(area, circle = DEFAULT_CIRCLE) {
  const rate = area.ring === RING.OUTER ? MINUTES_PER_HECTARE : circle?.rate || MINUTES_PER_HECTARE;
  return Math.max(10, Math.round((hectaresOf(area) * rate) / 5) * 5);
}

/** The circle round one sighting, as an area: { key, name, way, ring, from, to, a, b }. */
export function seenArea(sightingId, circle = DEFAULT_CIRCLE, name = 'the pet') {
  return { key: `seen-${sightingId}`, name: `Where ${name} was seen`, way: null, ring: RING.SEEN, from: 0, to: circle.seen, a: 0, b: 360 };
}

/**
 * An area's name as a sentence takes it: "the north side", "the middle",
 * "the far north-east", "where Max was seen".
 */
export function inWords(name) {
  const text = String(name || '').trim();
  if (!text) return 'the area';
  const lower = text.charAt(0).toLowerCase() + text.slice(1);
  return /^(The|Where) /.test(text) ? lower : `the ${lower}`;
}

const METERS_PER_DEGREE = 111320;

/** The point `meters` from `center` on a bearing. */
export function pointAt(center, meters, bearing) {
  const turn = (bearing * Math.PI) / 180;
  const lat = center.lat + (meters * Math.cos(turn)) / METERS_PER_DEGREE;
  const lng = center.lng + (meters * Math.sin(turn)) / (METERS_PER_DEGREE * Math.cos((center.lat * Math.PI) / 180));
  return { lat, lng };
}

/**
 * The edge of an area as a closed line a map can draw: [[lat, lng], ...],
 * first point repeated last. The middle is a circle; a side is the outer
 * arc one way and the inner arc back.
 */
export function outlineOf(area, center, { stepDegrees = 6 } = {}) {
  const span = (((area.b - area.a) % 360) + 360) % 360 || 360;
  const steps = Math.max(2, Math.ceil(span / stepDegrees));
  const arc = (meters, backwards) => {
    const out = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = backwards ? steps - i : i;
      const p = pointAt(center, meters, area.a + (span * t) / steps);
      out.push([Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))]);
    }
    return out;
  };
  const line = area.from > 0 ? [...arc(area.to, false), ...arc(area.from, true)] : arc(area.to, false);
  const [first] = line;
  const last = line[line.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) line.push([first[0], first[1]]);
  return line;
}

/** The point in the middle of an area, for a label or for directions to it. */
export function heartOf(area, center) {
  if (area.from === 0) return { lat: center.lat, lng: center.lng };
  const span = (((area.b - area.a) % 360) + 360) % 360 || 360;
  return pointAt(center, (area.from + area.to) / 2, area.a + span / 2);
}

/**
 * How far an area reaches, in words: "Within 150 m of where Max was lost",
 * "150 m to 400 m north of where Max was lost".
 */
export function reachOf(area, name = 'the pet') {
  if (area.ring === RING.SEEN) return `Within ${area.to} m of where ${name} was seen`;
  if (area.from === 0) return `Within ${area.to} m of where ${name} was lost`;
  return `${area.from} m to ${area.to} m ${area.way} of where ${name} was lost`;
}

/**
 * The streets that run through an area, the one with the most length in it
 * first: landmarks for finding the ground, and nothing more. `streets` are
 * { name, path: [[lat, lng], ...] }, the way the board keeps them.
 */
export function landmarksIn(area, center, streets = [], { limit = 2 } = {}) {
  const inside = new Map();
  for (const street of streets) {
    if (!street?.name || !Array.isArray(street.path)) continue;
    for (let i = 1; i < street.path.length; i += 1) {
      const p = { lat: street.path[i - 1][0], lng: street.path[i - 1][1] };
      const q = { lat: street.path[i][0], lng: street.path[i][1] };
      const mid = { lat: (p.lat + q.lat) / 2, lng: (p.lng + q.lng) / 2 };
      if (!inArea(mid, center, area)) continue;
      inside.set(street.name, (inside.get(street.name) || 0) + distanceMeters(p, q));
    }
  }
  return [...inside.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, limit)
    .map(([name]) => name);
}

/**
 * How urgent an area is, 1 to 10, higher first: the middle before the
 * sides before the outer areas, and an area a pet was seen in within the
 * last three days above all of them, the fresher the higher.
 */
export function urgencyOf(area, center, { sightings = [], now = Date.now() } = {}) {
  let urgency = area.ring === RING.MIDDLE ? 8 : area.ring === RING.SIDE ? 6 : 3;
  for (const s of sightings) {
    if (!s || typeof s.lat !== 'number' || typeof s.lng !== 'number') continue;
    const age = s.at ? now - new Date(s.at).getTime() : 0;
    if (age > SIGHTING_PRIORITY_WINDOW_MS) continue;
    if (!inArea({ lat: s.lat, lng: s.lng }, center, area)) continue;
    const freshness = 1 - Math.max(age, 0) / SIGHTING_PRIORITY_WINDOW_MS;
    urgency = Math.max(urgency, Math.round(9 + freshness));
  }
  return Math.max(1, Math.min(10, urgency));
}

/**
 * The areas of a search, ready to keep and to show: each area of the
 * circle with its minutes, its reach in words, its landmarks, its edge and
 * how urgent it is, most urgent first.
 */
export function planCircle({ center, species, name = 'the pet', streets = [], sightings = [], widened = false, now = Date.now() }) {
  if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return { circle: null, areas: [] };
  const circle = circleFor(species);
  const areas = areasOf(circle, { widened }).map((area) => ({
    ...area,
    minutes: minutesFor(area, circle),
    reach: reachOf(area, name),
    landmarks: landmarksIn(area, center, streets),
    outline: outlineOf(area, center),
    heart: heartOf(area, center),
    urgency: urgencyOf(area, center, { sightings, now }),
  }));
  areas.sort((a, b) => b.urgency - a.urgency || a.ring - b.ring || a.a - b.a);
  return { circle, areas };
}

/**
 * Whether an area still needs a search: never searched, put up for another
 * look, or asked for first by the person running the search. Someone
 * being on it changes none of those: it needs a search until one of them
 * says it is searched.
 */
export function needsSearch(area) {
  if (!area) return false;
  return Boolean(area.first || area.again) || area.status === 'UNSEARCHED' || area.status === 'NEEDS_REVISIT' || !(area.searchCount > 0);
}

/**
 * How long someone can be on an area before the desk is told they have
 * been out a long time, in minutes: twice what the area takes and a
 * quarter of an hour, so a careful search is never flagged.
 */
export function outLongAfter(minutes) {
  return 2 * (Number(minutes) || 20) + 15;
}

/**
 * How long someone is taken to be on an area with no word from them, in
 * minutes: half an hour past the moment the desk is told they have been
 * out a long time, and never under two hours. The desk always hears first,
 * so whoever runs the search can write to them before the site stops
 * counting them as there.
 */
export function heldFor(minutes) {
  return Math.max(120, outLongAfter(minutes) + 30);
}

/**
 * The order ground is given out in, for someone who asks for some: the
 * area they were asked to search; then ground the person running the
 * search asked for first, whoever is already on it; then ground that
 * still needs a search with nobody on it and nobody on the way, most
 * urgent first and the nearest on a tie; then such ground with someone
 * already there (a second person in ten hectares is a help), fewest people
 * first; then ground searched longest ago. Never the circle round a
 * sighting that has its one person; and where that circle is as urgent as
 * the side the pet was seen in, the circle comes first however near the
 * side is: one person goes to where the pet was seen before anyone is
 * given the ground round it. `areas` are as the board sends them
 * (app/lib/searchZones.js), `away` gives metres from the person asking to
 * one of them.
 */
export function rankAreas(areas = [], away = () => 0) {
  const can = areas.filter((a) => !a.mine && !a.full);
  const people = (a) => (a.on || 0) + (a.coming || 0);
  const seen = (a) => Number(a.ring === RING.SEEN);
  const urgent = (a, b) => b.priority - a.priority || seen(b) - seen(a) || away(a) - away(b);
  const fewest = (a, b) => people(a) - people(b) || urgent(a, b);
  const asked = can.filter((a) => a.askedOfMe);
  const rest = can.filter((a) => !a.askedOfMe);
  // "Send people here first" holds until the area is searched or the ask is taken back: one person starting it does not end it.
  const first = rest.filter((a) => a.first).sort(fewest);
  const others = rest.filter((a) => !a.first);
  const empty = others.filter((a) => needsSearch(a) && people(a) === 0).sort(urgent);
  const shared = others.filter((a) => needsSearch(a) && people(a) > 0).sort(fewest);
  const again = others.filter((a) => !needsSearch(a)).sort((a, b) => people(a) - people(b) || new Date(a.searchedAt || 0) - new Date(b.searchedAt || 0));
  return [...asked, ...first, ...empty, ...shared, ...again];
}
