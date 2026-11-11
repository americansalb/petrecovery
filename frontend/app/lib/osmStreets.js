/**
 * The named streets around a point, from OpenStreetMap: the raw material
 * app/lib/streetWalks.js cuts into walks.
 *
 * Two sources, because the first is not dependable.
 *
 *  1. Overpass, a free public query service that answers with exactly the
 *     named roads. Four independent servers are asked at once and the
 *     first good answer is the answer. On the day the street board went
 *     live (2026-11-11) none of the four answered the site's host within
 *     12 seconds, for either search that was open.
 *  2. OpenStreetMap's own map call, which answers in two or three seconds
 *     with everything in the box, buildings included. The named roads are
 *     picked out of it here and given the shape Overpass would have sent.
 *     It is asked once per search and only when Overpass gave nothing: its
 *     operators ask that reading go to Overpass where it can.
 *
 * It throws only when neither source answers. The error says what each
 * server did (`note`), because "it failed" on a host whose logs nobody is
 * reading is not a thing anyone can fix. The caller (app/lib/searchBoard.js)
 * then keeps the board on squares and tries again in a few minutes; a
 * search never waits on a map server.
 */
import { USER_AGENT } from './brand';

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const OSM_MAP = 'https://api.openstreetmap.org/api/0.6/map.json';

/**
 * Streets are fetched a little past the board's edge, so a walk that ends
 * near the edge still knows the name of the street it ends at.
 */
export const STREET_FETCH_MARGIN_METERS = 250;

/** Every named road and path within `radiusMeters`, with its geometry. */
export function streetQuery({ lat, lng, radiusMeters }) {
  const around = `(around:${Math.round(radiusMeters)},${Number(lat).toFixed(6)},${Number(lng).toFixed(6)})`;
  return `[out:json][timeout:6];way["highway"]["name"]${around};out geom;`;
}

/** The box that holds a circle: { south, west, north, east }. */
export function boxAround({ lat, lng, radiusMeters }) {
  const dLat = radiusMeters / 111320;
  const dLng = radiusMeters / (111320 * Math.cos((Number(lat) * Math.PI) / 180));
  return { south: Number(lat) - dLat, west: Number(lng) - dLng, north: Number(lat) + dLat, east: Number(lng) + dLng };
}

const hostOf = (url) => new URL(url).hostname;
const short = (error) => String(error?.message || 'failed').slice(0, 60);

/** A request that gives up at `timeoutMs`, or when `signal` says to. Resolves to the parsed JSON. */
async function getJson(url, init, { timeoutMs, fetchImpl, signal }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const stop = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', stop, { once: true });
  }
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
    return await response.json();
  } catch (error) {
    if (error?.name === 'AbortError' || controller.signal.aborted) throw new Error(`no answer in ${Math.round(timeoutMs / 1000)}s`);
    throw error;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', stop);
  }
}

async function askOverpass(endpoint, query, options) {
  const data = await getJson(
    endpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
      body: `data=${encodeURIComponent(query)}`,
    },
    options
  );
  if (!data || !Array.isArray(data.elements)) throw new Error('no elements in the answer');
  // Overpass answers 200 with a remark, and few or no elements, when the
  // query ran out of time or memory. That is a failure, not an empty town.
  if (data.remark) throw new Error(String(data.remark).replace(/^runtime error:\s*/i, ''));
  const ways = data.elements.filter((e) => e && e.type === 'way');
  // An empty answer from one mirror is not proof of an empty town: a
  // mirror that is behind, or holds one region, answers the same way. The
  // board takes "no streets" as final, so it is left to the map call.
  if (!ways.length) throw new Error('no streets in the answer');
  return ways;
}

/** The first promise to resolve wins; rejects with every error, in order, only when all have failed. */
function firstGood(promises) {
  return new Promise((resolve, reject) => {
    const errors = new Array(promises.length);
    let left = promises.length;
    if (!left) reject(errors);
    promises.forEach((promise, i) => {
      promise.then(resolve, (error) => {
        errors[i] = error;
        left -= 1;
        if (left === 0) reject(errors);
      });
    });
  });
}

/**
 * The named roads out of a map-call answer, in the shape Overpass sends
 * with `out geom`: each way with its node ids and their coordinates. The
 * map call lists nodes and ways apart; a way's line is its nodes looked up.
 */
export function waysFromMap(elements = []) {
  const at = new Map();
  for (const el of elements) {
    if (el && el.type === 'node' && Number.isFinite(el.lat) && Number.isFinite(el.lon)) at.set(el.id, el);
  }
  const ways = new Map();
  for (const el of elements) {
    if (!el || el.type !== 'way' || !el.tags?.highway || !el.tags?.name || !Array.isArray(el.nodes) || ways.has(el.id)) continue;
    const known = el.nodes.filter((id) => at.has(id));
    if (known.length < 2) continue;
    ways.set(el.id, {
      type: 'way',
      id: el.id,
      nodes: known,
      geometry: known.map((id) => ({ lat: at.get(id).lat, lon: at.get(id).lon })),
      tags: el.tags,
    });
  }
  return [...ways.values()];
}

const boxParam = (box) => [box.west, box.south, box.east, box.north].map((n) => n.toFixed(5)).join(',');

/**
 * Everything OpenStreetMap has in a box. The call refuses a box holding
 * more than 50,000 points (HTTP 400), which a dense city centre can; the
 * box is then asked for in quarters. A way comes back whole from every
 * quarter it touches, so the quarters are simply added up.
 */
async function askMap(endpoint, box, options) {
  const get = (b) => getJson(`${endpoint}?bbox=${boxParam(b)}`, { method: 'GET', headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } }, options);
  let data;
  try {
    data = await get(box);
  } catch (error) {
    if (error?.status !== 400) throw error;
    const midLat = (box.south + box.north) / 2;
    const midLng = (box.west + box.east) / 2;
    const quarters = [
      { south: midLat, west: box.west, north: box.north, east: midLng },
      { south: midLat, west: midLng, north: box.north, east: box.east },
      { south: box.south, west: box.west, north: midLat, east: midLng },
      { south: box.south, west: midLng, north: midLat, east: box.east },
    ];
    const elements = [];
    // One after another: four requests at once is not how a guest behaves.
    for (const quarter of quarters) {
      const part = await get(quarter);
      if (Array.isArray(part?.elements)) elements.push(...part.elements);
    }
    return elements;
  }
  if (!data || !Array.isArray(data.elements)) throw new Error('no elements in the answer');
  return data.elements;
}

/**
 * The ways for a board centred on (lat, lng). Resolves to an array, empty
 * only where OpenStreetMap's own map call says the box has no named
 * streets, and rejects when no server gave an answer that can be trusted.
 * The rejection's `note` lists what each server did, shortest form:
 * "overpass-api.de: HTTP 429; maps.mail.ru: no answer in 6s; api.openstreetmap.org: HTTP 509".
 */
export async function fetchNamedWays({
  lat,
  lng,
  radiusMeters,
  // A healthy Overpass answers this in a second or two. Past six, the map call is asked instead.
  timeoutMs = 6000,
  mapTimeoutMs = 25000,
  fetchImpl = fetch,
  endpoints = OVERPASS,
  mapEndpoint = OSM_MAP,
}) {
  const reach = radiusMeters + STREET_FETCH_MARGIN_METERS;
  const tried = [];

  if (endpoints.length) {
    const query = streetQuery({ lat, lng, radiusMeters: reach });
    // Once one server has answered, the others are let go.
    const done = new AbortController();
    try {
      return await firstGood(endpoints.map((endpoint) => askOverpass(endpoint, query, { timeoutMs, fetchImpl, signal: done.signal })));
    } catch (errors) {
      endpoints.forEach((endpoint, i) => tried.push(`${hostOf(endpoint)}: ${short(errors[i])}`));
    } finally {
      done.abort();
    }
  }

  if (mapEndpoint) {
    // One deadline for the whole of it, quarters included.
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), mapTimeoutMs);
    try {
      return waysFromMap(await askMap(mapEndpoint, boxAround({ lat, lng, radiusMeters: reach }), { timeoutMs: mapTimeoutMs, fetchImpl, signal: deadline.signal }));
    } catch (error) {
      tried.push(`${hostOf(mapEndpoint)}: ${short(error)}`);
    } finally {
      clearTimeout(timer);
    }
  }

  const failure = new Error('Street data is not available right now');
  failure.note = tried.join('; ').slice(0, 300);
  throw failure;
}
