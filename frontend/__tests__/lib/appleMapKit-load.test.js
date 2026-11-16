/**
 * Loading Apple MapKit (app/lib/maps/appleMapKit.js): a failed load never
 * leaves a later call waiting.
 *
 * Found by the reporting test, 2026-11-16: after the script failed to load
 * it stayed in the page, and the next call found it and waited for its
 * load and error events, which had already fired and never fire again.
 * The address search spun for ever from the second search on.
 *
 * A page is stood in for: a head to add the script to, and scripts that
 * fire their events when the test says.
 */

let scripts;

function fakePage() {
  scripts = [];
  global.window = {};
  global.document = {
    head: {
      appendChild(script) {
        script.inPage = true;
        scripts.push(script);
      },
    },
    querySelector(selector) {
      const src = selector.match(/script\[src="([^"]+)"\]/)?.[1];
      return scripts.find((s) => s.inPage && s.src === src) || null;
    },
    createElement() {
      const script = new EventTarget();
      script.inPage = false;
      script.remove = () => {
        script.inPage = false;
      };
      return script;
    },
  };
}

/** A fresh copy of the module, with nothing remembered from another test. */
function freshMapKit() {
  let mod;
  jest.isolateModules(() => {
    mod = require('@/app/lib/maps/appleMapKit');
  });
  return mod;
}

const inPage = () => scripts.filter((s) => s.inPage);

beforeEach(() => {
  fakePage();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  delete global.window;
  delete global.document;
});

describe('a failed load', () => {
  test('is taken out of the page, and the next call is answered at once instead of waiting on it', async () => {
    const { initializeMapKit } = freshMapKit();
    const first = initializeMapKit();
    expect(inPage()).toHaveLength(1);
    inPage()[0].dispatchEvent(new Event('error'));
    await expect(first).rejects.toThrow(/Failed to load MapKit JS/);
    expect(inPage()).toHaveLength(0);

    // The second search: no new wait, and nothing added to the page.
    await expect(initializeMapKit()).rejects.toThrow(/not available right now/);
    expect(scripts).toHaveLength(1);
  });

  test('an address search after it fails at once, so the picker shows what the other geocoders found', async () => {
    const { initializeMapKit, searchAutocomplete } = freshMapKit();
    const first = initializeMapKit();
    inPage()[0].dispatchEvent(new Event('error'));
    await expect(first).rejects.toThrow();
    await expect(searchAutocomplete('Ramsey Ave')).rejects.toThrow();
  });

  test('after a while it is tried again, with a new script', async () => {
    const { initializeMapKit, MAPKIT_RETRY_AFTER_MS } = freshMapKit();
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const first = initializeMapKit();
    inPage()[0].dispatchEvent(new Event('error'));
    await expect(first).rejects.toThrow();

    now.mockReturnValue(1_000_000 + MAPKIT_RETRY_AFTER_MS + 1);
    const again = initializeMapKit();
    expect(scripts).toHaveLength(2);
    expect(inPage()).toEqual([scripts[1]]);
    global.window.mapkit = { init: jest.fn() };
    scripts[1].dispatchEvent(new Event('load'));
    await expect(again).resolves.toBe(global.window.mapkit);
    expect(global.window.mapkit.init).toHaveBeenCalledTimes(1);
  });
});

describe('a load that never answers', () => {
  test('counts as failed after its time, and the script is taken out', async () => {
    jest.useFakeTimers();
    const { initializeMapKit, MAPKIT_LOAD_TIMEOUT_MS } = freshMapKit();
    expect(MAPKIT_LOAD_TIMEOUT_MS).toBeLessThanOrEqual(15000);
    const first = initializeMapKit();
    const settled = expect(first).rejects.toThrow(/did not load in time/);
    await jest.advanceTimersByTimeAsync(MAPKIT_LOAD_TIMEOUT_MS);
    await settled;
    expect(inPage()).toHaveLength(0);
  });

  test('a script already in the page is waited for no longer than that either', async () => {
    jest.useFakeTimers();
    const { initializeMapKit, MAPKIT_LOAD_TIMEOUT_MS } = freshMapKit();
    // Left by something else, its events long since fired.
    const stale = document.createElement('script');
    stale.src = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js';
    document.head.appendChild(stale);
    const first = initializeMapKit();
    const settled = expect(first).rejects.toThrow(/did not load in time/);
    await jest.advanceTimersByTimeAsync(MAPKIT_LOAD_TIMEOUT_MS);
    await settled;
    expect(inPage()).toHaveLength(0);
  });
});

describe('a good load', () => {
  test('loads once, and every later call has it at once', async () => {
    const { initializeMapKit } = freshMapKit();
    const first = initializeMapKit();
    global.window.mapkit = { init: jest.fn() };
    inPage()[0].dispatchEvent(new Event('load'));
    await expect(first).resolves.toBe(global.window.mapkit);
    await expect(initializeMapKit()).resolves.toBe(global.window.mapkit);
    expect(scripts).toHaveLength(1);
  });
});
