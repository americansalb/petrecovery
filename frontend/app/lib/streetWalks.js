/**
 * Streets, not squares: the geometry of the search board.
 *
 * The first board cut the area into squares named C4 and D2. People do
 * not walk squares and cannot find one. They walk a street: "Sinclair Ave
 * from W 44th St to W 45th St". This module turns the named streets
 * around a pet's last-seen point (OpenStreetMap ways, as Overpass returns
 * them with `out geom`) into walks a person can be handed:
 *
 * - A walk is ONE street between two cross streets, about a quarter mile,
 *   so one person finishes it in one outing and "searched" means something.
 * - Its name is the street and the two cross streets, the way a neighbor
 *   would say it.
 * - Its priority is the same rule the squares used (app/lib/searchGrid.js):
 *   near where the pet was lost, raised near fresh sightings.
 *
 * Everything here is pure and unit-tested on real Austin streets
 * (__tests__/street-walks.test.js). Fetching is app/lib/osmStreets.js and
 * the rows are app/lib/searchBoard.js.
 */
import { distanceMeters, cellPriority } from './searchGrid';

/** About how long a walk runs before the next cross street closes it. */
export const WALK_TARGET_METERS = 450;
/** A leftover shorter than this joins the walk before it. */
export const WALK_MIN_METERS = 120;
/** Nothing shorter than this is a walk at all. */
const SLIVER_METERS = 40;
/** A board with hundreds of streets reads as despair, the same as the squares did. */
export const MAX_WALKS = 120;
/** How far a sighting reaches when it raises a street's priority. */
const SIGHTING_REACH_METERS = 150;

/** Ways a person on foot can search along. Motorways and trunk roads are not. */
const WALKABLE = new Set([
  'residential', 'living_street', 'unclassified', 'tertiary', 'tertiary_link', 'secondary', 'secondary_link',
  'primary', 'primary_link', 'pedestrian', 'footway', 'path', 'cycleway', 'track', 'service',
]);

const SUFFIX = {
  street: 'St', avenue: 'Ave', boulevard: 'Blvd', road: 'Rd', drive: 'Dr', lane: 'Ln', court: 'Ct', place: 'Pl',
  parkway: 'Pkwy', circle: 'Cir', trail: 'Trl', terrace: 'Ter', highway: 'Hwy', square: 'Sq', cove: 'Cv',
};
const COMPASS = {
  north: 'N', south: 'S', east: 'E', west: 'W', northeast: 'NE', northwest: 'NW', southeast: 'SE', southwest: 'SW',
};

/**
 * A street name the way a sign writes it: "West 45th Street" is "W 45th St".
 * Only the last word and a leading compass word are shortened, so "Avenue A"
 * and "West Avenue" stay whole. Names in other languages pass through.
 */
export function shortStreet(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return words.join(' ');
  const out = [...words];
  const last = out[out.length - 1].toLowerCase();
  if (SUFFIX[last]) out[out.length - 1] = SUFFIX[last];
  if (out.length >= 3 && COMPASS[out[0].toLowerCase()]) out[0] = COMPASS[out[0].toLowerCase()];
  return out.join(' ');
}

/** What a walk is called: the street and where it starts and ends. */
export function walkTitle({ name, fromName = null, toName = null }) {
  if (fromName && toName && fromName !== toName) return `${name} from ${fromName} to ${toName}`;
  if (fromName && toName) return `${name} off ${fromName}`;
  if (fromName || toName) return `${name} from ${fromName || toName} to the end`;
  return name;
}

/** Minutes to walk it there and back while looking, to the nearest five. */
export function walkMinutes(meters) {
  const there = Math.max(0, Number(meters) || 0);
  return Math.max(10, Math.ceil((there * 2) / 65 / 5) * 5);
}

/**
 * The walk as this person would do it: starting from the end nearer to
 * them. Without a position it is returned as stored.
 */
export function orientWalk(walk, near = null) {
  const path = walk?.path || [];
  if (!near || path.length < 2) return walk;
  const first = { lat: path[0][0], lng: path[0][1] };
  const last = { lat: path[path.length - 1][0], lng: path[path.length - 1][1] };
  if (distanceMeters(near, first) <= distanceMeters(near, last)) return walk;
  return { ...walk, path: [...path].reverse(), fromName: walk.toName ?? null, toName: walk.fromName ?? null };
}

function pathMeters(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distanceMeters(points[i - 1], points[i]);
  return total;
}

/** The point halfway along a line, by distance. */
function midpoint(points) {
  const half = pathMeters(points) / 2;
  let run = 0;
  for (let i = 1; i < points.length; i += 1) {
    const step = distanceMeters(points[i - 1], points[i]);
    if (run + step >= half && step > 0) {
      const t = (half - run) / step;
      return {
        lat: points[i - 1].lat + (points[i].lat - points[i - 1].lat) * t,
        lng: points[i - 1].lng + (points[i].lng - points[i - 1].lng) * t,
      };
    }
    run += step;
  }
  return points[Math.floor(points.length / 2)] || points[0];
}

/** Drops points that do not bend the line (within about 3 meters), so a curvy road is not a long row. */
function simplify(points, tolerance = 3) {
  if (points.length <= 2) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let worst = 0;
    let at = -1;
    const base = distanceMeters(points[a], points[b]);
    for (let i = a + 1; i < b; i += 1) {
      // Height of the triangle a-i-b over its base, by Heron's formula.
      const da = distanceMeters(points[a], points[i]);
      const db = distanceMeters(points[i], points[b]);
      let off = da;
      if (base > 0.5) {
        const s = (da + db + base) / 2;
        off = (2 * Math.sqrt(Math.max(0, s * (s - da) * (s - db) * (s - base)))) / base;
      }
      if (off > worst) {
        worst = off;
        at = i;
      }
    }
    if (at !== -1 && worst > tolerance) {
      keep[at] = true;
      stack.push([a, at], [at, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Where every node is, and which named streets pass through it. */
function indexWays(ways) {
  const coord = new Map();
  const namesAt = new Map();
  for (const way of ways) {
    const count = Math.min(way.nodes.length, way.geometry.length);
    for (let i = 0; i < count; i += 1) {
      const point = way.geometry[i];
      if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
      const id = way.nodes[i];
      coord.set(id, { lat: point.lat, lng: point.lon });
      if (!namesAt.has(id)) namesAt.set(id, new Set());
      namesAt.get(id).add(way.tags.name);
    }
  }
  return { coord, namesAt };
}

/**
 * One street's ways joined end to end. OpenStreetMap splits a street into
 * several ways, and a divided road is two lines with one name; each
 * unbroken line comes back as an ordered list of node ids.
 */
function chainsOf(ways, coord) {
  const next = new Map();
  const link = (a, b) => {
    if (a === b || !coord.has(a) || !coord.has(b)) return;
    if (!next.has(a)) next.set(a, new Set());
    if (!next.has(b)) next.set(b, new Set());
    next.get(a).add(b);
    next.get(b).add(a);
  };
  for (const way of ways) {
    for (let i = 1; i < way.nodes.length; i += 1) link(way.nodes[i - 1], way.nodes[i]);
  }
  const used = new Set();
  const edge = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const follow = (start, second) => {
    const chain = [start];
    let prev = start;
    let here = second;
    used.add(edge(prev, here));
    for (;;) {
      chain.push(here);
      const around = next.get(here);
      if (around.size !== 2) break; // a dead end, or the street forks
      const [x, y] = [...around];
      const onward = x === prev ? y : x;
      if (used.has(edge(here, onward))) break; // a loop closed
      used.add(edge(here, onward));
      prev = here;
      here = onward;
    }
    return chain;
  };
  const chains = [];
  for (const [node, around] of next) {
    if (around.size === 2) continue;
    for (const other of around) if (!used.has(edge(node, other))) chains.push(follow(node, other));
  }
  for (const [node, around] of next) {
    for (const other of around) if (!used.has(edge(node, other))) chains.push(follow(node, other));
  }
  return chains;
}

/** Cuts one line of a street at its cross streets and groups the pieces into walks. */
function walksAlong(chain, name, { coord, namesAt }) {
  const crossAt = (i) => [...namesAt.get(chain[i])].filter((n) => n !== name).sort()[0] || null;
  const cuts = new Set([0, chain.length - 1]);
  for (let i = 1; i < chain.length - 1; i += 1) if (crossAt(i)) cuts.add(i);
  const bounds = [...cuts].sort((a, b) => a - b);
  const pieces = [];
  for (let i = 1; i < bounds.length; i += 1) {
    const from = bounds[i - 1];
    const to = bounds[i];
    const points = chain.slice(from, to + 1).map((id) => coord.get(id));
    pieces.push({ from, to, meters: pathMeters(points) });
  }
  const groups = [];
  let open = null;
  for (const piece of pieces) {
    if (!open) open = { from: piece.from, to: piece.to, meters: 0 };
    open.to = piece.to;
    open.meters += piece.meters;
    if (open.meters >= WALK_TARGET_METERS) {
      groups.push(open);
      open = null;
    }
  }
  if (open) {
    const last = groups[groups.length - 1];
    if (last && open.meters < WALK_MIN_METERS) {
      last.to = open.to;
      last.meters += open.meters;
    } else {
      groups.push(open);
    }
  }
  return groups
    .filter((g) => g.meters >= SLIVER_METERS)
    .map((g) => {
      const points = chain.slice(g.from, g.to + 1).map((id) => coord.get(id));
      return { name, fromName: crossAt(g.from), toName: crossAt(g.to), points, meters: g.meters };
    });
}

/**
 * The walks for a search. `ways` are Overpass elements of type "way" with
 * `nodes`, `geometry` and `tags` (name, highway); every named way is read
 * for cross streets, and only walkable ones become walks. Returns up to
 * `maxWalks`, most urgent first: { name, fromName, toName, path, meters,
 * minutes, centerLatitude, centerLongitude, priority }.
 */
export function buildWalks({ ways = [], center, radiusMeters, sightings = [], now = Date.now(), maxWalks = MAX_WALKS }) {
  const named = ways
    .filter((w) => w && w.tags?.name && w.tags?.highway && Array.isArray(w.nodes) && Array.isArray(w.geometry) && w.nodes.length > 1)
    .sort((a, b) => (a.id > b.id ? 1 : a.id < b.id ? -1 : 0));
  if (!named.length || !center) return [];
  const index = indexWays(named);
  const byName = new Map();
  for (const way of named) {
    if (!WALKABLE.has(way.tags.highway)) continue;
    if (!byName.has(way.tags.name)) byName.set(way.tags.name, []);
    byName.get(way.tags.name).push(way);
  }
  const found = [];
  for (const [name, own] of byName) {
    for (const chain of chainsOf(own, index.coord)) {
      for (const walk of walksAlong(chain, name, index)) {
        const mid = midpoint(walk.points);
        if (distanceMeters(mid, center) > radiusMeters) continue;
        found.push({ ...walk, mid });
      }
    }
  }
  // A divided road is two lines with one name and the same cross streets: one walk, the longer line.
  found.sort((a, b) => b.meters - a.meters);
  const kept = [];
  for (const walk of found) {
    const ends = [walk.fromName || '', walk.toName || ''].sort().join('|');
    const twin = kept.some(
      (k) => k.name === walk.name && [k.fromName || '', k.toName || ''].sort().join('|') === ends && distanceMeters(k.mid, walk.mid) < 80
    );
    if (!twin) kept.push(walk);
  }
  const out = kept.map((walk) => {
    const path = simplify(walk.points).map((p) => [Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))]);
    const meters = Math.round(walk.meters);
    return {
      name: shortStreet(walk.name),
      fromName: walk.fromName ? shortStreet(walk.fromName) : null,
      toName: walk.toName ? shortStreet(walk.toName) : null,
      path,
      meters,
      minutes: walkMinutes(meters),
      centerLatitude: Number(walk.mid.lat.toFixed(6)),
      centerLongitude: Number(walk.mid.lng.toFixed(6)),
      away: distanceMeters(walk.mid, center),
      priority: cellPriority({
        center: walk.mid,
        lastSeen: center,
        sightings,
        radiusMeters,
        cellSizeMeters: SIGHTING_REACH_METERS,
        now,
      }),
    };
  });
  out.sort((a, b) => b.priority - a.priority || a.away - b.away || (a.name < b.name ? -1 : 1));
  return out.slice(0, maxWalks).map(({ away, ...walk }) => walk);
}
