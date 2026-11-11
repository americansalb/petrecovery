/**
 * Fetching the streets (app/lib/osmStreets.js).
 *
 * Overpass is a free public service whose main server limits how often
 * one address may ask, and a host's shared address is often over the
 * limit already. The first live fetch failed on every search and nothing
 * outside the host's logs said why. So the fetch tries independent
 * servers in turn, and when all of them fail it says what each one did.
 */

import { fetchNamedWays, streetQuery, STREET_FETCH_MARGIN_METERS } from '@/app/lib/osmStreets';

const way = { type: 'way', id: 1, nodes: [1, 2], geometry: [{ lat: 30, lon: -97 }, { lat: 30.001, lon: -97 }], tags: { name: 'Main Street', highway: 'residential' } };
const ok = (elements) => ({ ok: true, status: 200, json: async () => ({ elements }) });
const at = { lat: 30.3148, lng: -97.7459, radiusMeters: 400 };

test('the query asks for every named road a little past the board\'s edge', () => {
  const q = streetQuery({ lat: 30.3148, lng: -97.7459, radiusMeters: 650 });
  expect(q).toBe('[out:json][timeout:15];way["highway"]["name"](around:650,30.314800,-97.745900);out geom;');
});

test('the first server that answers is the answer, and only ways come back', async () => {
  const fetchImpl = jest.fn(async () => ok([way, { type: 'node', id: 9 }]));
  const ways = await fetchNamedWays({ ...at, fetchImpl });
  expect(ways).toEqual([way]);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  const [url, init] = fetchImpl.mock.calls[0];
  expect(url).toBe('https://overpass-api.de/api/interpreter');
  expect(init.method).toBe('POST');
  expect(init.headers['User-Agent']).toMatch(/ReunitePets/);
  expect(decodeURIComponent(init.body)).toContain(`(around:${400 + STREET_FETCH_MARGIN_METERS},`);
});

test('a server that is over its limit is passed over for the next one', async () => {
  const fetchImpl = jest
    .fn()
    .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
    .mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND'))
    .mockResolvedValueOnce(ok([way]));
  expect(await fetchNamedWays({ ...at, fetchImpl })).toEqual([way]);
  expect(fetchImpl).toHaveBeenCalledTimes(3);
  expect(new Set(fetchImpl.mock.calls.map(([url]) => new URL(url).hostname)).size).toBe(3);
});

test('a server that never answers is given up on, not waited for', async () => {
  const hang = (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
  const fetchImpl = jest.fn().mockImplementationOnce(hang).mockResolvedValueOnce(ok([way]));
  expect(await fetchNamedWays({ ...at, fetchImpl, timeoutMs: 30 })).toEqual([way]);
});

test('when none answers, the error says what each server did', async () => {
  const fetchImpl = jest
    .fn()
    .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: false, status: 504, json: async () => ({}) })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ remark: 'runtime error' }) })
    .mockRejectedValueOnce(new Error('fetch failed'));
  await expect(fetchNamedWays({ ...at, fetchImpl })).rejects.toMatchObject({
    message: 'Street data is not available right now',
    note: 'overpass-api.de: HTTP 429; overpass.private.coffee: HTTP 504; overpass.kumi.systems: no elements in the answer; maps.mail.ru: fetch failed',
  });
  expect(fetchImpl).toHaveBeenCalledTimes(4);
});

test('a place with no named streets is an empty answer, not a failure', async () => {
  expect(await fetchNamedWays({ ...at, fetchImpl: jest.fn(async () => ok([])) })).toEqual([]);
});
