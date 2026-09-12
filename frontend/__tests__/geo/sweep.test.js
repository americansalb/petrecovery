/**
 * Housekeeping (app/lib/geo/server/sweep.js).
 *
 * Found in the deep audit: the only delete anywhere in the game was
 * expired sign-in links. Cached rounds were filtered by expiry on read
 * and then kept forever, usage rows grew by one per player per day per
 * provider, and finished rooms kept their players, rounds and every
 * guess indefinitely, on a database shared with a lost-pet service.
 */

const { sweepGeo, maybeSweep, _resetSweep, RETENTION } = require('@/app/lib/geo/server/sweep');
const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');
const { createRoom, joinRoom } = require('@/app/lib/geo/server/rooms');

const T0 = Date.parse('2026-09-07T12:00:00Z');
const DAY = 86400000;

beforeEach(() => _resetSweep());

test('old usage rows, old rooms and spent links go; today stays', async () => {
  const store = createMemoryRoomStore();
  await store.bumpUsage('profile:old', '2026-01-01', 'google', { rounds: 3 });
  await store.bumpUsage('profile:new', '2026-09-07', 'google', { rounds: 3 });
  await store.createLoginToken({ tokenHash: 'spent', email: 'a@b.test', expiresAt: new Date(T0 - DAY) });
  await store.createLoginToken({ tokenHash: 'live', email: 'c@d.test', expiresAt: new Date(T0 + DAY) });

  const old = await createRoom(store, { name: 'Last month', hostName: 'Ada', now: T0 - 40 * DAY });
  await joinRoom(store, { code: old.room.code, name: 'Grace', now: T0 - 40 * DAY });
  await store.updateRoom(old.room.id, { status: 'finished', phase: 'finished', lastActiveAt: new Date(T0 - 40 * DAY) });
  const live = await createRoom(store, { name: 'Tonight', hostName: 'Linus', now: T0 });

  const swept = await sweepGeo(store, { now: T0 });
  expect(swept.usage).toBe(1);
  expect(swept.loginTokens).toBe(1);
  expect(swept.rooms).toBe(1);

  expect(await store.listUsage(['profile:old'], '2026-01-01')).toEqual([]);
  expect((await store.listUsage(['profile:new'], '2026-09-07')).length).toBe(1);
  expect(await store.getLoginTokenByHash('spent')).toBeNull();
  expect(await store.getLoginTokenByHash('live')).toBeTruthy();
  expect(await store.getRoomByCode(old.room.code)).toBeNull();
  expect(await store.getRoomByCode(live.room.code)).toBeTruthy();
});

test('a room abandoned mid-game goes sooner than a finished one', async () => {
  const store = createMemoryRoomStore();
  const stale = await createRoom(store, { name: 'Left open', hostName: 'Ada', now: T0 - 5 * DAY });
  const recent = await createRoom(store, { name: 'Yesterday', hostName: 'Grace', now: T0 - DAY });
  await store.updateRoom(recent.room.id, { status: 'finished', lastActiveAt: new Date(T0 - DAY) });

  await sweepGeo(store, { now: T0 });
  expect(await store.getRoomByCode(stale.room.code)).toBeNull();
  expect(await store.getRoomByCode(recent.room.code)).toBeTruthy();
  expect(RETENTION.staleRoomDays).toBeLessThan(RETENTION.finishedRoomDays);
});

test('a sweep that throws is a log line, not a failed request', async () => {
  const store = { deleteUsageBefore: async () => { throw new Error('db down'); } };
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  await expect(sweepGeo(store, { now: T0 })).resolves.toMatchObject({ usage: 0 });
  spy.mockRestore();
});

test('the opportunistic sweep runs at most once an interval', async () => {
  const store = createMemoryRoomStore();
  expect(maybeSweep(store, { now: T0 })).toBe(true);
  expect(maybeSweep(store, { now: T0 + 60000 })).toBe(false);
  expect(maybeSweep(store, { now: T0 + 3600001 })).toBe(true);
});
