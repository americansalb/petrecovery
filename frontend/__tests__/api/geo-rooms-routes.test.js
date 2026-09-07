/**
 * The room API on top of the in-memory store: create, list, join with a
 * token, spectate without one, start, guess, and the error shapes the
 * pages rely on.
 */

const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');

const memoryStore = createMemoryRoomStore();
jest.mock('@/app/lib/geo/server/roomStore', () => ({ prismaRoomStore: memoryStore }));
jest.mock('@/app/lib/rateLimit', () => ({
  withRateLimitAsync: jest.fn().mockResolvedValue({ success: true }),
  RateLimitPresets: { PUBLIC_WRITE: {} },
  rateLimitResponse: jest.fn(),
}));

const { GET: listRooms, POST: createRoom } = require('@/app/api/geo/rooms/route');
const { GET: getRoom, POST: postRoom } = require('@/app/api/geo/rooms/[code]/route');

const hitFetch = jest.fn(async (url) => {
  const [lat, lng] = new URL(url).searchParams.get('location').split(',').map(Number);
  return { status: 200, json: async () => ({ status: 'OK', pano_id: `pano-${lat.toFixed(2)}`, location: { lat, lng }, copyright: '© Google' }) };
});

const ENV_KEYS = ['GOOGLE_STREET_VIEW_API_KEY', 'GOOGLE_MAPS_BROWSER_KEY'];
const saved = {};

function request(body, token) {
  const headers = new Map();
  if (token) headers.set('x-geo-player', token);
  return { json: async () => body, headers, url: 'http://localhost/api/geo/rooms' };
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    process.env[k] = 'set';
  }
  global.fetch = hitFetch;
});

afterEach(() => {
  console.error.mockRestore?.();
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('rooms API', () => {
  test('a whole game over the routes', async () => {
    const created = await createRoom(request({ name: 'Office', hostName: 'Ada', settings: { rounds: 3, time: 60, variant: 'classic' } }));
    expect(created.status).toBe(200);
    const host = await created.json();
    expect(host.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(host.token).toBeTruthy();
    expect(host.state.me.isHost).toBe(true);

    const list = await (await listRooms()).json();
    expect(list.rooms.map((r) => r.code)).toContain(host.code);

    const joined = await (await postRoom(request({ action: 'join', name: 'Grace' }), { params: { code: host.code.toLowerCase() } })).json();
    expect(joined.token).toBeTruthy();
    expect(joined.state.players).toHaveLength(2);

    const spectator = await (await getRoom(request(null), { params: { code: host.code } })).json();
    expect(spectator.state.me).toBeNull();
    expect(spectator.state.players).toHaveLength(2);

    const notHost = await postRoom(request({ action: 'start' }, joined.token), { params: { code: host.code } });
    expect(notHost.status).toBe(403);

    const started = await (await postRoom(request({ action: 'start' }, host.token), { params: { code: host.code } })).json();
    expect(started.state.room.phase).toBe('guessing');
    expect(started.state.round.panoId).toMatch(/^pano-/);
    expect(JSON.stringify(started.state.round)).not.toMatch(/"lat"/);

    const guessed = await (await postRoom(request({ action: 'guess', lat: 10, lng: 10 }, joined.token), { params: { code: host.code } })).json();
    expect(guessed.state.players.find((p) => p.name === 'Grace').guessed).toBe(true);
    expect(guessed.state.room.phase).toBe('guessing');

    const revealed = await (await postRoom(request({ action: 'next' }, host.token), { params: { code: host.code } })).json();
    expect(revealed.state.room.phase).toBe('reveal');
    expect(revealed.state.reveal.guesses).toHaveLength(2);
    expect(revealed.state.reveal.answer.lat).toEqual(expect.any(Number));

    const reacted = await (await postRoom(request({ action: 'react', emoji: '🔥' }, joined.token), { params: { code: host.code } })).json();
    expect(reacted.state.reactions[0].e).toBe('🔥');
  });

  test('bad codes, unknown actions, missing tokens and missing keys have plain answers', async () => {
    expect((await getRoom(request(null), { params: { code: 'nope' } })).status).toBe(404);
    expect((await getRoom(request(null), { params: { code: 'ZZZZZZ' } })).status).toBe(404);
    const created = await (await createRoom(request({ name: 'X', hostName: 'H' }))).json();
    const unknown = await postRoom(request({ action: 'dance' }, created.token), { params: { code: created.code } });
    expect(unknown.status).toBe(400);
    const anonymous = await postRoom(request({ action: 'guess', lat: 1, lng: 1 }), { params: { code: created.code } });
    expect(anonymous.status).toBe(401);
    expect((await postRoom({ json: async () => { throw new Error('bad'); }, headers: new Map() }, { params: { code: created.code } })).status).toBe(400);
    delete process.env.GOOGLE_STREET_VIEW_API_KEY;
    expect((await createRoom(request({ name: 'X', hostName: 'H' }))).status).toBe(503);
    expect((await postRoom(request({ action: 'start' }, created.token), { params: { code: created.code } })).status).toBe(503);
  });
});
