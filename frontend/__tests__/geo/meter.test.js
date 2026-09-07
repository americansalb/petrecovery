/**
 * The play meter (app/lib/geo/meter.js, app/lib/geo/server/meter.js).
 *
 * Pinned: the free Google allowance per day with the daily on top,
 * prepaid rounds after it, no allowance on Apple, the ceilings per
 * person and per address, the site's budget, the speed limit, rooms
 * counted per player without ever refusing an invitation for the
 * allowance, and two to start.
 */

const { DEFAULT_LIMITS, decideRound, limitsFromEnv, meterView, dayKey, nextDayMs, untilText, MeterError } = require('@/app/lib/geo/meter');
const { checkRound, recordRound, checkRoomEntry, recordRoomRound, usageToday, hashIp, SITE_SUBJECT } = require('@/app/lib/geo/server/meter');
const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');
const { createRoom, joinRoom, roomAction } = require('@/app/lib/geo/server/rooms');
const { resolveProfile } = require('@/app/lib/geo/server/profiles');

const T0 = Date.parse('2026-09-07T12:00:00Z');
const hitFetch = async (url) => {
  const [lat, lng] = new URL(url).searchParams.get('location').split(',').map(Number);
  return { status: 200, json: async () => ({ status: 'OK', pano_id: `pano-${lat.toFixed(3)}-${lng.toFixed(3)}`, location: { lat, lng }, copyright: '© Google' }) };
};

const ENV_KEYS = { GOOGLE_STREET_VIEW_API_KEY: 'sv', GOOGLE_MAPS_BROWSER_KEY: 'browser' };
const savedEnv = {};
beforeAll(() => {
  for (const [k, v] of Object.entries(ENV_KEYS)) {
    savedEnv[k] = process.env[k];
    process.env[k] = v;
  }
});
afterAll(() => {
  for (const k of Object.keys(ENV_KEYS)) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

const limits = { ...DEFAULT_LIMITS, freeGoogleRounds: 3, freeGoogleRoundsPerIp: 5, ceilingAnonymous: 8, ceilingSignedIn: 12, ceilingPerIp: 20, siteBudget: { google: 50, apple: 60 } };
const bucket = (google = {}, apple = {}) => ({ google: { rounds: 0, free: 0, paid: 0, ...google }, apple: { rounds: 0, ...apple } });

describe('decideRound', () => {
  test('free rounds, then prepaid, then a refusal; the daily and Apple never draw on the allowance', () => {
    const fresh = { profile: bucket(), ip: bucket(), site: bucket() };
    expect(decideRound({ provider: 'google', mode: 'world', hasProfile: true, usage: fresh, limits })).toEqual({ ok: true, source: 'free' });
    const spent = { profile: bucket({ rounds: 3, free: 3 }), ip: bucket({ rounds: 3, free: 3 }), site: bucket() };
    expect(decideRound({ provider: 'google', mode: 'world', hasProfile: true, usage: spent, limits })).toEqual({ ok: false, code: 'allowance' });
    expect(decideRound({ provider: 'google', mode: 'world', hasProfile: true, paidRounds: 2, usage: spent, limits })).toEqual({ ok: true, source: 'paid' });
    expect(decideRound({ provider: 'google', mode: 'daily', hasProfile: true, usage: spent, limits })).toEqual({ ok: true, source: 'daily' });
    expect(decideRound({ provider: 'apple', mode: 'cities', hasProfile: true, usage: spent, limits })).toEqual({ ok: true, source: 'apple' });
    expect(decideRound({ provider: 'google', mode: 'world', hasProfile: true, usage: spent, limits, allowance: false })).toEqual({ ok: true, source: 'room' });
  });

  test('anonymous players are held by the address too; signed-in players by the profile only', () => {
    const ipSpent = { profile: bucket(), ip: bucket({ rounds: 5, free: 5 }), site: bucket() };
    expect(decideRound({ provider: 'google', mode: 'world', hasProfile: true, usage: ipSpent, limits }).code).toBe('allowance');
    expect(decideRound({ provider: 'google', mode: 'world', hasProfile: true, signedIn: true, usage: ipSpent, limits }).ok).toBe(true);
    // no profile at all: the address is the player, at the player's allowance
    const noProfile = { ip: bucket({ rounds: 3, free: 3 }), site: bucket() };
    expect(decideRound({ provider: 'google', mode: 'world', hasProfile: false, usage: noProfile, limits }).code).toBe('allowance');
  });

  test('ceilings shaped like a person, the site budget above everything', () => {
    const tired = { profile: bucket({ rounds: 4 }, { rounds: 4 }), ip: bucket(), site: bucket() };
    expect(decideRound({ provider: 'apple', mode: 'cities', hasProfile: true, usage: tired, limits }).code).toBe('ceiling');
    expect(decideRound({ provider: 'apple', mode: 'cities', hasProfile: true, signedIn: true, usage: tired, limits }).ok).toBe(true);
    const busyAddress = { profile: bucket(), ip: bucket({ rounds: 20 }), site: bucket() };
    expect(decideRound({ provider: 'apple', mode: 'cities', hasProfile: true, signedIn: true, usage: busyAddress, limits }).code).toBe('ceiling');
    const busySite = { profile: bucket(), ip: bucket(), site: bucket({ rounds: 50 }) };
    expect(decideRound({ provider: 'google', mode: 'daily', hasProfile: true, usage: busySite, limits }).code).toBe('budget');
    expect(decideRound({ provider: 'apple', mode: 'cities', hasProfile: true, usage: busySite, limits }).ok).toBe(true);
  });

  test('limits come from the environment with the defaults behind them', () => {
    expect(limitsFromEnv({})).toEqual(DEFAULT_LIMITS);
    const custom = limitsFromEnv({ GEO_FREE_GOOGLE_ROUNDS: '40', GEO_APPLE_DAILY_BUDGET: '1000', GEO_ROUNDS_PER_MINUTE: 'nope' });
    expect(custom.freeGoogleRounds).toBe(40);
    expect(custom.siteBudget.apple).toBe(1000);
    expect(custom.roundsPerMinute).toBe(DEFAULT_LIMITS.roundsPerMinute);
  });

  test('days are UTC and the view says what is left', () => {
    expect(dayKey(T0)).toBe('2026-09-07');
    expect(nextDayMs(T0)).toBe(Date.parse('2026-09-08T00:00:00Z'));
    expect(untilText(nextDayMs(T0), T0)).toBe('in 12 h');
    expect(untilText(T0 + 5 * 60000, T0)).toBe('in 5 min');
    const view = meterView({ usage: { profile: bucket({ rounds: 2, free: 2 }, { rounds: 7 }) }, hasProfile: true, paidRounds: 4, limits, now: T0 });
    expect(view).toMatchObject({ day: '2026-09-07', google: { rounds: 2, freeUsed: 2, freeLimit: 3, freeLeft: 1, paidLeft: 4 }, apple: { rounds: 7 }, rounds: 9, ceiling: 8 });
  });
});

describe('the meter on the store', () => {
  async function subjectsFor(store, name, extra = {}) {
    const { profile } = await resolveProfile(store, { name, now: T0 });
    return { profile, profileId: profile.id, signedIn: false, ipHash: hashIp('203.0.113.5', 'secret'), ...extra };
  }
  const google = (subjects, mode = 'world') => ({ subjects, provider: 'google', mode, now: T0, limits });

  test('checkRound refuses after the free rounds are recorded, counts prepaid rounds down, and reads the paid balance fresh', async () => {
    const store = createMemoryRoomStore();
    const me = await subjectsFor(store, 'Ada');
    for (let i = 0; i < 3; i++) {
      const decision = await checkRound(store, google(me));
      expect(decision.source).toBe('free');
      await recordRound(store, { subjects: me, provider: 'google', source: decision.source, now: T0 });
    }
    await expect(checkRound(store, google(me))).rejects.toMatchObject({ code: 'allowance', status: 429, provider: 'google', resetAt: nextDayMs(T0) });
    await expect(checkRound(store, google(me))).rejects.toBeInstanceOf(MeterError);
    expect((await checkRound(store, google(me, 'daily'))).source).toBe('daily');

    await store.updateProfile(me.profileId, { paidRounds: 1 });
    const paidMe = { ...me, profile: await store.getProfileById(me.profileId) };
    const paid = await checkRound(store, google(paidMe));
    expect(paid.source).toBe('paid');
    await recordRound(store, { subjects: paidMe, provider: 'google', source: 'paid', now: T0 });
    expect((await store.getProfileById(me.profileId)).paidRounds).toBe(0);
    const view = await usageToday(store, { ...paidMe, profile: await store.getProfileById(me.profileId) }, { now: T0, limits });
    expect(view.google).toMatchObject({ rounds: 4, freeUsed: 3, freeLeft: 0, paidLeft: 0 });

    // every subject was charged, the site included
    const rows = await store.listUsage([`profile:${me.profileId}`, me.ipHash, SITE_SUBJECT], '2026-09-07');
    expect(rows.map((r) => [r.subject.split(':')[0], r.rounds, r.free, r.paid]).sort()).toEqual([
      ['ip', 4, 3, 1],
      ['profile', 4, 3, 1],
      ['site', 4, 3, 1],
    ]);
  });

  test('the speed limit uses the limiter it is given, per profile', async () => {
    const store = createMemoryRoomStore();
    const me = await subjectsFor(store, 'Ada');
    const calls = [];
    const limiter = async (key, options) => {
      calls.push([key, options.maxRequests]);
      return { success: calls.length < 3, resetAt: T0 + 30000 };
    };
    await checkRound(store, { ...google(me), limiter });
    await checkRound(store, { ...google(me), limiter });
    await expect(checkRound(store, { ...google(me), limiter })).rejects.toMatchObject({ code: 'speed', resetAt: T0 + 30000 });
    expect(calls[0]).toEqual([`geo-speed:${me.profileId}`, limits.roundsPerMinute]);
  });

  test('a new day starts the allowance over', async () => {
    const store = createMemoryRoomStore();
    const me = await subjectsFor(store, 'Ada');
    for (let i = 0; i < 3; i++) await recordRound(store, { subjects: me, provider: 'google', source: 'free', now: T0 });
    await expect(checkRound(store, google(me))).rejects.toMatchObject({ code: 'allowance' });
    expect((await checkRound(store, { ...google(me), now: nextDayMs(T0) + 1000 })).source).toBe('free');
  });

  test('rooms: an invitation is never refused for the allowance, the ceiling and the budget still hold, two to start, and every present player is charged per round', async () => {
    // The engine reads its limits from the environment.
    process.env.GEO_FREE_GOOGLE_ROUNDS = '3';
    process.env.GEO_DAILY_CEILING_ANONYMOUS = '8';
    process.env.GEO_GOOGLE_DAILY_BUDGET = '50';
    try {
      await roomsScenario();
    } finally {
      delete process.env.GEO_FREE_GOOGLE_ROUNDS;
      delete process.env.GEO_DAILY_CEILING_ANONYMOUS;
      delete process.env.GEO_GOOGLE_DAILY_BUDGET;
    }
  });

  async function roomsScenario() {
    const store = createMemoryRoomStore();
    const ada = await subjectsFor(store, 'Ada');
    const grace = await subjectsFor(store, 'Grace', { ipHash: hashIp('203.0.113.6', 'secret') });
    for (let i = 0; i < 3; i++) await recordRound(store, { subjects: ada, provider: 'google', source: 'free', now: T0 });
    await expect(checkRound(store, google(ada))).rejects.toMatchObject({ code: 'allowance' });

    // out of free rounds, still welcome in a room
    const host = await createRoom(store, { name: 'Ranked', hostName: 'Ada', settings: { rounds: 3, time: 30 }, profileId: ada.profileId, subjects: ada, now: T0 });
    await expect(roomAction(store, { code: host.room.code, token: host.token, action: 'start', now: T0, fetchImpl: hitFetch })).rejects.toMatchObject({ code: 'need_players', status: 409 });
    const joined = await joinRoom(store, { code: host.room.code, name: 'Grace', profileId: grace.profileId, subjects: grace, now: T0 });
    await roomAction(store, { code: host.room.code, token: host.token, action: 'start', now: T0, fetchImpl: hitFetch });

    // round one charged both: Ada beyond her free rounds (counted, not free), Grace on hers
    const rows = store._dump().usage;
    const adaRow = rows.find((r) => r.subject === `profile:${ada.profileId}` && r.provider === 'google');
    const graceRow = rows.find((r) => r.subject === `profile:${grace.profileId}` && r.provider === 'google');
    const siteRow = rows.find((r) => r.subject === SITE_SUBJECT && r.provider === 'google');
    expect(adaRow).toMatchObject({ rounds: 4, free: 3, paid: 0 });
    expect(graceRow).toMatchObject({ rounds: 1, free: 1 });
    expect(siteRow.rounds).toBe(5);

    // someone at the day's ceiling cannot open or join a room
    const tired = await subjectsFor(store, 'Tired', { ipHash: hashIp('203.0.113.7', 'secret') });
    for (let i = 0; i < 8; i++) await recordRound(store, { subjects: tired, provider: 'apple', source: 'apple', now: T0 });
    await expect(joinRoom(store, { code: host.room.code, name: 'Tired', profileId: tired.profileId, subjects: tired, now: T0 })).rejects.toMatchObject({ code: 'ceiling', status: 429 });
    await expect(createRoom(store, { name: 'Mine', hostName: 'Tired', settings: {}, profileId: tired.profileId, subjects: tired, now: T0 })).rejects.toMatchObject({ code: 'ceiling' });
    await expect(checkRoomEntry(store, { subjects: tired, now: T0, limits })).rejects.toMatchObject({ code: 'ceiling' });
    expect(joined.player.name).toBe('Grace');
  }

  test('the site budget closes the door on that imagery only', async () => {
    const store = createMemoryRoomStore();
    const me = await subjectsFor(store, 'Ada');
    await store.bumpUsage(SITE_SUBJECT, '2026-09-07', 'google', { rounds: 50, free: 0, paid: 0 });
    await expect(checkRound(store, google(me, 'daily'))).rejects.toMatchObject({ code: 'budget', provider: 'google' });
    expect((await checkRound(store, { ...google(me), provider: 'apple', mode: 'cities' })).source).toBe('apple');
    await expect(checkRoomEntry(store, { subjects: me, now: T0, limits })).rejects.toMatchObject({ code: 'budget' });
    // accounting that fails never stops a round
    const broken = { ...store, bumpUsage: async () => { throw new Error('db gone'); } };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(recordRound(broken, { subjects: me, provider: 'google', source: 'free', now: T0 })).resolves.toBeUndefined();
    await recordRoomRound(broken, { config: { provider: 'google' }, players: [{ profileId: me.profileId }] }, T0, limits);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
