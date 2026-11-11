/**
 * The named streets around a point, from OpenStreetMap through Overpass:
 * the raw material app/lib/streetWalks.js cuts into walks.
 *
 * Overpass is a free public service and it is sometimes slow or busy, so
 * this asks one server, then a mirror, each with a short deadline, and
 * throws when neither answers. The caller (app/lib/searchBoard.js) then
 * keeps the board on squares and tries again later; a search never waits
 * on a map server.
 */
import { USER_AGENT } from './brand';

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

/**
 * Streets are fetched a little past the board's edge, so a walk that ends
 * near the edge still knows the name of the street it ends at.
 */
export const STREET_FETCH_MARGIN_METERS = 250;

/** Every named road and path within `radiusMeters`, with its geometry. */
export function streetQuery({ lat, lng, radiusMeters }) {
  const around = `(around:${Math.round(radiusMeters)},${Number(lat).toFixed(6)},${Number(lng).toFixed(6)})`;
  return `[out:json][timeout:20];way["highway"]["name"]${around};out geom;`;
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
    if (!response.ok) throw new Error(`Overpass answered ${response.status}`);
    const data = await response.json();
    if (!data || !Array.isArray(data.elements)) throw new Error('Overpass sent no elements');
    return data.elements.filter((e) => e && e.type === 'way');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The ways for a board centred on (lat, lng). Resolves to an array, empty
 * where the map has no named streets, and rejects when no server answered.
 */
export async function fetchNamedWays({ lat, lng, radiusMeters, timeoutMs = 9000, fetchImpl = fetch }) {
  const query = streetQuery({ lat, lng, radiusMeters: radiusMeters + STREET_FETCH_MARGIN_METERS });
  let lastError = null;
  for (const endpoint of ENDPOINTS) {
    try {
      return await ask(endpoint, query, timeoutMs, fetchImpl);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Street data is not available right now (${lastError?.message || 'no answer'})`);
}
