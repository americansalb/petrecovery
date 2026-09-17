/** A room created in one Next dev route must survive loading another route. */
jest.mock('@/app/lib/geo/server/db', () => ({ __esModule: true, default: {} }));
const savedEnv = { DATABASE_URL: process.env.DATABASE_URL, GEO_DATABASE_URL: process.env.GEO_DATABASE_URL, NODE_ENV: process.env.NODE_ENV };
afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  delete globalThis.__probablyEarthDevStore;
  jest.restoreAllMocks();
});
test('development route bundles share the same memory store; production does not reuse it', () => {
  delete process.env.DATABASE_URL;
  delete process.env.GEO_DATABASE_URL;
  process.env.NODE_ENV = 'development';
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  let first, second, production;
  jest.isolateModules(() => { first = require('@/app/lib/geo/server/roomStore').prismaRoomStore; });
  jest.isolateModules(() => { second = require('@/app/lib/geo/server/roomStore').prismaRoomStore; });
  expect(second).toBe(first);
  process.env.NODE_ENV = 'production';
  jest.isolateModules(() => { production = require('@/app/lib/geo/server/roomStore').prismaRoomStore; });
  expect(production).not.toBe(first);
});
