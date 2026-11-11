/**
 * The named streets around a point, from OpenStreetMap through Overpass:
 * the raw material app/lib/streetWalks.js cuts into walks.
 *
 * Overpass is a free public service. The main server limits how often
 * one address may ask, and a hosting company's shared address is often
 * over that limit before this site has asked for anything. So this asks
 * the main server and then three independent mirrors, each with its own
 * deadline, and throws only when none answers. The error says what each
 * server did (`note`), because "it failed" on a host whose logs nobody is
 * reading is not a thing anyone can fix. The caller
 * (app/lib/searchBoard.js) then keeps the board on squares and tries
 * again in a few minutes; a search never waits on a map server.
 */
import { USER_AGENT } from './brand';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

/**
 * Streets are fetched a little past the board's edge, so a walk that ends
 * near the edge still knows the name of the street it ends at.
 */
export const STREET_FETCH_MARGIN_METERS = 250;

/** Every named road and path within `radiusMeters`, with its geometry. */
export function streetQuery({ lat, lng, radiusMeters }) {
  const around = `(around:${Math.round(radiusMeters)},${Number(lat).toFixed(6)},${Number(lng).toFixed(6)})`;
  return `[out:json][timeout:15];way["highway"]["name"]${around};out geom;`;
}

async function ask(endpoint, query, timeoutMs, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data || !Array.isArray(data.elements)) throw new Error('no elements in the answer');
    return data.elements.filter((e) => e && e.type === 'way');
  } catch (error) {
    throw new Error(error?.name === 'AbortError' ? `no answer in ${Math.round(timeoutMs / 1000)}s` : error?.message || 'failed');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The ways for a board centred on (lat, lng). Resolves to an array, empty
 * where the map has no named streets, and rejects when no server answered.
 * The rejection's `note` lists what each server did, shortest form:
 * "overpass-api.de: HTTP 429; overpass.kumi.systems: no answer in 12s".
 */
export async function fetchNamedWays({ lat, lng, radiusMeters, timeoutMs = 12000, fetchImpl = fetch, endpoints = ENDPOINTS }) {
  const query = streetQuery({ lat, lng, radiusMeters: radiusMeters + STREET_FETCH_MARGIN_METERS });
  const tried = [];
  for (const endpoint of endpoints) {
    try {
      return await ask(endpoint, query, timeoutMs, fetchImpl);
    } catch (error) {
      tried.push(`${new URL(endpoint).hostname}: ${String(error?.message || 'failed').slice(0, 60)}`);
    }
  }
  const failure = new Error('Street data is not available right now');
  failure.note = tried.join('; ').slice(0, 300);
  throw failure;
}
