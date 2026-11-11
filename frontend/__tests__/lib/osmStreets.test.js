/**
 * Fetching the streets (app/lib/osmStreets.js).
 *
 * Two sources. Overpass answers with exactly the named roads, but it is a
 * free public service: on the day the board went live none of its four
 * servers answered the site's host. OpenStreetMap's own map call answers
 * in a second or two with everything in the box, and the roads are picked
 * out of it. So: every Overpass server at once, first good answer wins,
 * then the map call, and only when all of that fails an error that says
 * what each server did.
 */

import { fetchNamedWays, streetQuery, boxAround, waysFromMap, STREET_FETCH_MARGIN_METERS } from '@/app/lib/osmStreets';

const way = { type: 'way', id: 1, nodes: [1, 2], geometry: [{ lat: 30, lon: -97 }, { lat: 30.001, lon: -97 }], tags: { name: 'Main Street', highway: 'residential' } };
const ok = (elements, extra = {}) => ({ ok: true, status: 200, json: async () => ({ elements, ...extra }) });
const bad = (status) => ({ ok: false, status, json: async () => ({}) });
const at = { lat: 30.3148, lng: -97.7459, radiusMeters: 400 };
const hostOf = (url) => new URL(url).hostname;
const OVERPASS_HOSTS = ['overpass-api.de', 'overpass.private.coffee', 'overpass.kumi.systems', 'maps.mail.ru'];
const MAP_HOST = 'api.openstreetmap.org';

/** What the map call sends: nodes and ways apart, with everything else in the box. */
const MAP_ELEMENTS = [
  { type: 'node', id: 1, lat: 30, lon: -97 },
  { type: 'node', id: 2, lat: 30.001, lon: -97 },
  { type: 'node', id: 3, lat: 30.002, lon: -97 },
  { type: 'node', id: 7, lat: 30.0005, lon: -97.001 },
  { type: 'way', id: 10, nodes: [1, 2, 3], tags: { highway: 'residential', name: 'Main Street', surface: 'asphalt' } },
  { type: 'way', id: 11, nodes: [2, 7], tags: { highway: 'footway', name: 'Creek Path' } },
  { type: 'way', id: 12, nodes: [1, 7, 2, 1], tags: { building: 'house' } },
  { type: 'way', id: 13, nodes: [1, 2], tags: { highway: 'service' } },
  { type: 'relation', id: 99, members: [] },
];

/** A fetch that answers by host, and records who was asked. */
function byHost(answers) {
  return jest.fn(async (url, init) => {
    const answer = answers[hostOf(url)];
    const value = typeof answer === 'function' ? await answer(url, init) : answer;
    if (value instanceof Error) throw value;
    return value;
  });
}
const never = (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
const allOverpass = (answer) => Object.fromEntries(OVERPASS_HOSTS.map((h) => [h, answer]));

test('the Overpass query asks for every named road a little past the board\'s edge', () => {
  const q = streetQuery({ lat: 30.3148, lng: -97.7459, radiusMeters: 650 });
  expect(q).toBe('[out:json][timeout:6];way["highway"]["name"](around:650,30.314800,-97.745900);out geom;');
});

test('the box for the map call holds the same circle', () => {
  const box = boxAround({ lat: 30.3148, lng: -97.7459, radiusMeters: 650 });
  expect((box.north - box.south) * 111320).toBeCloseTo(1300, 0);
  expect((box.east - box.west) * 111320 * Math.cos((30.3148 * Math.PI) / 180)).toBeCloseTo(1300, 0);
  expect((box.north + box.south) / 2).toBeCloseTo(30.3148, 6);
  expect((box.east + box.west) / 2).toBeCloseTo(-97.7459, 6);
});

describe('Overpass: every server at once, the first good answer wins', () => {
  test('all four are asked together, and the map call is not asked when one answers', async () => {
    const fetchImpl = byHost({ ...allOverpass(never), 'overpass.kumi.systems': ok([way, { type: 'node', id: 9 }]) });
    const ways = await fetchNamedWays({ ...at, fetchImpl });
    expect(ways).toEqual([way]);
    expect(fetchImpl.mock.calls.map(([url]) => hostOf(url)).sort()).toEqual([...OVERPASS_HOSTS].sort());
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers['User-Agent']).toMatch(/ReunitePets/);
    expect(decodeURIComponent(init.body)).toContain(`(around:${400 + STREET_FETCH_MARGIN_METERS},`);
  });

  test('the servers still working are let go once one has answered', async () => {
    const signals = [];
    const slow = (url, init) => {
      signals.push(init.signal);
      return never(url, init);
    };
    const fetchImpl = byHost({ ...allOverpass(slow), 'overpass-api.de': ok([way]) });
    await fetchNamedWays({ ...at, fetchImpl });
    expect(signals).toHaveLength(3);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  test('a server over its limit, down, or unreachable does not hold up one that works', async () => {
    const fetchImpl = byHost({
      'overpass-api.de': bad(429),
      'overpass.private.coffee': new Error('getaddrinfo ENOTFOUND'),
      'overpass.kumi.systems': bad(504),
      'maps.mail.ru': ok([way]),
    });
    expect(await fetchNamedWays({ ...at, fetchImpl })).toEqual([way]);
    expect(fetchImpl.mock.calls.some(([url]) => hostOf(url) === MAP_HOST)).toBe(false);
  });

  test('an empty answer from a mirror is not the last word: the board takes "no streets" as final, so the map call decides', async () => {
    // One mirror is behind and says "nothing here". Another has the streets.
    const some = byHost({ ...allOverpass(ok([])), 'overpass.kumi.systems': ok([way]) });
    expect(await fetchNamedWays({ ...at, fetchImpl: some })).toEqual([way]);

    // Every mirror says "nothing here": the map call is asked, and it has streets.
    const mapHas = byHost({ ...allOverpass(ok([])), [MAP_HOST]: ok(MAP_ELEMENTS) });
    expect((await fetchNamedWays({ ...at, fetchImpl: mapHas })).map((w) => w.tags.name)).toEqual(['Main Street', 'Creek Path']);

    // The map call agrees there is nothing: that is a place with no named streets.
    const none = byHost({ ...allOverpass(ok([])), [MAP_HOST]: ok([]) });
    expect(await fetchNamedWays({ ...at, fetchImpl: none })).toEqual([]);

    // The map call cannot be asked: nobody has said the place is empty, so it is a failure to try again, not "no streets".
    const unknown = byHost({ ...allOverpass(ok([])), [MAP_HOST]: bad(509) });
    await expect(fetchNamedWays({ ...at, fetchImpl: unknown })).rejects.toMatchObject({
      note: 'overpass-api.de: no streets in the answer; overpass.private.coffee: no streets in the answer; overpass.kumi.systems: no streets in the answer; maps.mail.ru: no streets in the answer; api.openstreetmap.org: HTTP 509',
    });
  });

  test('a query that ran out of time on the server is a failure, not an empty town', async () => {
    // Overpass says so with a 200, a remark, and no elements.
    const timedOut = ok([], { remark: 'runtime error: Query timed out in "query" at line 1 after 7 seconds.' });
    const fetchImpl = byHost({ ...allOverpass(timedOut), [MAP_HOST]: ok(MAP_ELEMENTS) });
    const ways = await fetchNamedWays({ ...at, fetchImpl });
    expect(ways.map((w) => w.tags.name)).toEqual(['Main Street', 'Creek Path']);
  });
});

describe('the map call: asked when Overpass gave nothing', () => {
  test('the named roads are picked out of everything in the box, with their lines', async () => {
    const fetchImpl = byHost({ ...allOverpass(never), [MAP_HOST]: ok(MAP_ELEMENTS) });
    const ways = await fetchNamedWays({ ...at, fetchImpl, timeoutMs: 20 });
    expect(ways).toEqual([
      { type: 'way', id: 10, nodes: [1, 2, 3], geometry: [{ lat: 30, lon: -97 }, { lat: 30.001, lon: -97 }, { lat: 30.002, lon: -97 }], tags: { highway: 'residential', name: 'Main Street', surface: 'asphalt' } },
      { type: 'way', id: 11, nodes: [2, 7], geometry: [{ lat: 30.001, lon: -97 }, { lat: 30.0005, lon: -97.001 }], tags: { highway: 'footway', name: 'Creek Path' } },
    ]);
    const [url, init] = fetchImpl.mock.calls.find(([u]) => hostOf(u) === MAP_HOST);
    expect(init.method).toBe('GET');
    expect(init.headers['User-Agent']).toMatch(/ReunitePets/);
    // west,south,east,north: the box of the board plus its margin.
    const [west, south, east, north] = new URL(url).searchParams.get('bbox').split(',').map(Number);
    const box = boxAround({ lat: at.lat, lng: at.lng, radiusMeters: 400 + STREET_FETCH_MARGIN_METERS });
    expect([west, south, east, north]).toEqual([box.west, box.south, box.east, box.north].map((n) => Number(n.toFixed(5))));
  });

  test('it is asked once, and only after every Overpass server has failed', async () => {
    const order = [];
    const note = (answer) => async (url) => {
      order.push(hostOf(url));
      return answer;
    };
    const fetchImpl = byHost({ ...allOverpass(note(bad(429))), [MAP_HOST]: note(ok(MAP_ELEMENTS)) });
    await fetchNamedWays({ ...at, fetchImpl });
    expect(order.slice(0, 4).sort()).toEqual([...OVERPASS_HOSTS].sort());
    expect(order.slice(4)).toEqual([MAP_HOST]);
  });

  test('a way keeps only the points the answer gave it, and one point is not a line', () => {
    const ways = waysFromMap([
      { type: 'node', id: 1, lat: 1, lon: 1 },
      { type: 'node', id: 2, lat: 2, lon: 2 },
      { type: 'way', id: 20, nodes: [1, 404, 2], tags: { highway: 'residential', name: 'Gap Road' } },
      { type: 'way', id: 21, nodes: [1, 404], tags: { highway: 'residential', name: 'Stub Road' } },
      { type: 'way', id: 20, nodes: [1, 2], tags: { highway: 'residential', name: 'Gap Road' } },
    ]);
    expect(ways).toEqual([{ type: 'way', id: 20, nodes: [1, 2], geometry: [{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }], tags: { highway: 'residential', name: 'Gap Road' } }]);
    expect(waysFromMap()).toEqual([]);
  });

  test('a box with too many points is asked for in quarters, and a street that crosses them is one street', async () => {
    const boxes = [];
    const fetchImpl = byHost({
      ...allOverpass(bad(504)),
      [MAP_HOST]: async (url) => {
        boxes.push(new URL(url).searchParams.get('bbox'));
        return boxes.length === 1 ? bad(400) : ok(MAP_ELEMENTS);
      },
    });
    const ways = await fetchNamedWays({ ...at, fetchImpl });
    expect(boxes).toHaveLength(5);
    expect(new Set(boxes).size).toBe(5);
    expect(ways.map((w) => w.id)).toEqual([10, 11]);
  });

  test('a place with no named streets is an empty answer here too', async () => {
    const fetchImpl = byHost({ ...allOverpass(bad(504)), [MAP_HOST]: ok([{ type: 'node', id: 1, lat: 1, lon: 1 }]) });
    expect(await fetchNamedWays({ ...at, fetchImpl })).toEqual([]);
  });
});

describe('when nothing answers', () => {
  test('the error says what each server did, Overpass first and the map call last', async () => {
    const fetchImpl = byHost({
      'overpass-api.de': bad(429),
      'overpass.private.coffee': bad(504),
      'overpass.kumi.systems': { ok: true, status: 200, json: async () => ({ remark: 'runtime error' }) },
      'maps.mail.ru': new Error('fetch failed'),
      [MAP_HOST]: bad(509),
    });
    await expect(fetchNamedWays({ ...at, fetchImpl })).rejects.toMatchObject({
      message: 'Street data is not available right now',
      note: 'overpass-api.de: HTTP 429; overpass.private.coffee: HTTP 504; overpass.kumi.systems: no elements in the answer; maps.mail.ru: fetch failed; api.openstreetmap.org: HTTP 509',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
  });

  test('servers that never answer are given up on, each with its own deadline', async () => {
    const fetchImpl = byHost({ ...allOverpass(never), [MAP_HOST]: never });
    const started = Date.now();
    await expect(fetchNamedWays({ ...at, fetchImpl, timeoutMs: 30, mapTimeoutMs: 40 })).rejects.toMatchObject({
      note: 'overpass-api.de: no answer in 0s; overpass.private.coffee: no answer in 0s; overpass.kumi.systems: no answer in 0s; maps.mail.ru: no answer in 0s; api.openstreetmap.org: no answer in 0s',
    });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  test('the note fits the column it is kept in', async () => {
    const long = new Error('x'.repeat(500));
    const fetchImpl = byHost({ ...allOverpass(long), [MAP_HOST]: long });
    const error = await fetchNamedWays({ ...at, fetchImpl }).catch((e) => e);
    expect(error.note.length).toBeLessThanOrEqual(300);
  });
});
