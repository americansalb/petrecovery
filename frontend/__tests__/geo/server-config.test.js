/**
 * /api/geo/config is fetched by every screen, and one failed fetch used
 * to be the end of the screen.
 *
 * The lobby greys its start buttons until the config arrives, so a
 * single blip left every button dead with no way forward but a reload
 * the player had no reason to think of. A first request to a sleeping
 * instance is exactly that case, so it is not a rare one: the harness
 * hit it twice in one afternoon just by running a browser hard.
 */

const { loadGeoConfig, forgetGeoConfig, configErrorMessage, CONFIG_ERROR, RATE_LIMITED_ERROR } = require('@/app/geo/lib/serverConfig');

const ok = (body = { providers: { apple: { configured: true } } }) => ({ ok: true, status: 200, json: async () => body });
const bad = (status = 500) => ({ ok: false, status, json: async () => ({}) });

// jsdom is not the environment here, so the cache has nowhere to live
// unless one is provided. Given one, the caching is real and testable.
beforeEach(() => {
  const store = new Map();
  global.window = {
    sessionStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
  };
});
afterEach(() => {
  delete global.window;
});

describe('loading the game settings', () => {
  test('one good answer is one request', async () => {
    const fetchImpl = jest.fn(async () => ok());
    await expect(loadGeoConfig({ fetchImpl })).resolves.toMatchObject({ providers: { apple: { configured: true } } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/geo/config');
    // Never a cached one: a deploy changes what this says.
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ cache: 'no-store' });
  });

  test('a blip is retried rather than shown to the player', async () => {
    const fetchImpl = jest
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(ok());
    await expect(loadGeoConfig({ fetchImpl })).resolves.toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('a 500 is a failure worth retrying too', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(bad(503)).mockResolvedValueOnce(ok());
    await expect(loadGeoConfig({ fetchImpl })).resolves.toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  test('it gives up after three, and says so', async () => {
    const fetchImpl = jest.fn(async () => bad(500));
    await expect(loadGeoConfig({ fetchImpl })).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(CONFIG_ERROR).toMatch(/game settings/i);
  });

  test('a screen that went away stops trying, and resolves to nothing', async () => {
    // Without this a component unmounted mid-retry would keep a timer
    // alive and then call setState on a corpse.
    let gone = false;
    const fetchImpl = jest.fn(async () => {
      gone = true;
      throw new Error('ECONNRESET');
    });
    await expect(loadGeoConfig({ fetchImpl, shouldStop: () => gone })).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('every screen loads it the same way', () => {
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.resolve(__dirname, '../..');
  const SCREENS = [
    'app/geo/components/PlayClient.js',
    'app/geo/components/RoomClient.js',
    'app/geo/components/rooms/RoomBrowser.js',
    'app/geo/components/home/ColdOpen.js',
  ];

  test('nothing fetches the config by hand any more', () => {
    for (const rel of SCREENS) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      expect(`${rel}: ${src.includes("fetch('/api/geo/config'")}`).toBe(`${rel}: false`);
      expect(`${rel}: ${src.includes('loadGeoConfig(')}`).toBe(`${rel}: true`);
    }
  });

});

describe('it is asked for once a session, not once a screen', () => {
  test('the second screen reads the copy', async () => {
    const fetchImpl = jest.fn(async () => ok());
    await loadGeoConfig({ fetchImpl });
    await loadGeoConfig({ fetchImpl });
    await loadGeoConfig({ fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('forgetting it, or forcing it, asks again', async () => {
    const fetchImpl = jest.fn(async () => ok());
    await loadGeoConfig({ fetchImpl });
    forgetGeoConfig();
    await loadGeoConfig({ fetchImpl });
    await loadGeoConfig({ fetchImpl, force: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  test('a browser with no session storage still plays', async () => {
    delete global.window;
    const fetchImpl = jest.fn(async () => ok());
    await expect(loadGeoConfig({ fetchImpl })).resolves.toBeTruthy();
    await expect(loadGeoConfig({ fetchImpl })).resolves.toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('too fast is not a failure to retry', () => {
  test('a 429 stops at once, because asking again cannot help', async () => {
    // The bucket is 30 a minute per address (app/lib/geo/site.js), and
    // an address is a household. Retrying spends what is left of it.
    const fetchImpl = jest.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    await expect(loadGeoConfig({ fetchImpl })).rejects.toMatchObject({ code: 'rate_limited' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('and it is said in different words, because it is a different problem', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    const error = await loadGeoConfig({ fetchImpl }).catch((e) => e);
    expect(configErrorMessage(error)).toBe(RATE_LIMITED_ERROR);
    expect(configErrorMessage(new Error('boom'))).toBe(CONFIG_ERROR);
    expect(RATE_LIMITED_ERROR).not.toBe(CONFIG_ERROR);
  });
});
