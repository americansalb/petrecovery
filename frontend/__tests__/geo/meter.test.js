/**
 * The play meter (app/lib/geo/meter.js, app/lib/geo/server/meter.js).
 *
 * It used to guard an invoice: a free Google allowance, prepaid rounds,
 * free room games and a budget denominated in panorama loads. Apple is
 * not billed per view, so with Google gone none of that survives.
 *
 * Pinned here is what is left, and why each one exists:
 *
 *   ceiling  an abuse limit shaped like a person, per profile and per
 *            address, set high enough nobody honest meets it
 *   speed    the one that actually stops a script
 *   budget   the whole site's day, because Apple's quota is per
 *            DEVELOPER ACCOUNT and ReunitePets' maps share it
 *
 * And one thing that must never come back: rooms are not rationed.
 */

const { DEFAULT_LIMITS, decideRound, decideRoomEntry, limitsFromEnv, meterView, dayKey, nextDayMs, untilText, refusalMessage, refusalTitle, usageIncrement, seatIncrement, METER_CODES, MeterError } = require('@/app/lib/geo/meter');
const { checkRound, recordRound, checkRoomEntry, usageToday, hashIp, SITE_SUBJECT } = require('@/app/lib/geo/server/meter');
const { createMemoryRoomStore } = require('@/app/lib/geo/server/memoryRoomStore');

const T0 = Date.parse('2026-09-07T12:00:00Z');

const limits = { ...DEFAULT_LIMITS, ceilingAnonymous: 8, ceilingSignedIn: 12, ceilingPerIp: 20, siteBudget: 60 };
const bucket = (apple = {}) => ({ apple: { rounds: 0, loads: 0, ...apple } });

describe('decideRound', () => {
  test('an ordinary round is allowed, and costs one view', () => {
    const d = decideRound({ hasProfile: true, usage: {}, limits });
    expect(d).toEqual({ ok: true, source: 'apple' });
    expect(usageIncrement()).toEqual({ rounds: 1, loads: 1 });
  });

  test('the ceiling is shaped like a person: higher when signed in', () => {
    const at = (n) => ({ profile: bucket({ rounds: n }) });
    expect(decideRound({ hasProfile: true, usage: at(7), limits }).ok).toBe(true);
    expect(decideRound({ hasProfile: true, usage: at(8), limits })).toEqual({ ok: false, code: 'ceiling' });
    // the same day, signed in, still has room
    expect(decideRound({ hasProfile: true, signedIn: true, usage: at(8), limits }).ok).toBe(true);
    expect(decideRound({ hasProfile: true, signedIn: true, usage: at(12), limits })).toEqual({ ok: false, code: 'ceiling' });
  });

  test('an address with no profile is held at the anonymous ceiling, with a profile at the wider one', () => {
    const ip = (n) => ({ ip: bucket({ rounds: n }) });
    expect(decideRound({ hasProfile: false, usage: ip(8), limits })).toEqual({ ok: false, code: 'ceiling' });
    expect(decideRound({ hasProfile: true, usage: ip(8), limits }).ok).toBe(true);
    expect(decideRound({ hasProfile: true, usage: ip(20), limits })).toEqual({ ok: false, code: 'ceiling' });
  });

  test("the site's day closes before anybody's, because Apple's quota is shared with the pet site", () => {
    const site = (n) => ({ site: bucket({ rounds: n }) });
    expect(decideRound({ hasProfile: true, usage: site(59), limits }).ok).toBe(true);
    expect(decideRound({ hasProfile: true, usage: site(60), limits })).toEqual({ ok: false, code: 'budget' });
    // even for a signed-in player who has played nothing
    expect(decideRound({ hasProfile: true, signedIn: true, usage: site(60), limits })).toEqual({ ok: false, code: 'budget' });
  });

  test('a row written before loads existed still counts: the larger of the two is the day', () => {
    expect(decideRound({ usage: { site: { apple: { rounds: 60, loads: 0 } } }, limits })).toEqual({ ok: false, code: 'budget' });
    expect(decideRound({ usage: { site: { apple: { rounds: 0, loads: 60 } } }, limits })).toEqual({ ok: false, code: 'budget' });
  });
});

describe('rooms are not rationed', () => {
  test('a seat is the same gate as a solo round, and costs nothing extra', () => {
    expect(decideRoomEntry({ hasProfile: true, usage: {}, limits })).toEqual({ ok: true, source: 'apple' });
    expect(seatIncrement()).toEqual({ rounds: 0, loads: 0 });
  });

  test('a tenth room in a day is as free as the first', () => {
    // A room holds twelve, so metering rooms taxes the one thing that
    // brings players in. Only the ceiling and the site's day apply.
    const usage = { profile: bucket({ rounds: 3 }) };
    for (let i = 0; i < 10; i++) expect(decideRoomEntry({ hasProfile: true, usage, limits }).ok).toBe(true);
  });

  test('the ceiling still holds at the door', () => {
    expect(decideRoomEntry({ hasProfile: true, usage: { profile: bucket({ rounds: 8 }) }, limits })).toEqual({ ok: false, code: 'ceiling' });
  });
});

describe('limits, days and words', () => {
  test('limits come from the environment with the defaults behind them', () => {
    expect(limitsFromEnv({})).toEqual(DEFAULT_LIMITS);
    const l = limitsFromEnv({ GEO_CEILING_ANONYMOUS: '40', GEO_SITE_BUDGET: '900', GEO_ROUNDS_PER_MINUTE: 'junk' });
    expect(l.ceilingAnonymous).toBe(40);
    expect(l.siteBudget).toBe(900);
    expect(l.roundsPerMinute).toBe(DEFAULT_LIMITS.roundsPerMinute);
  });

  test('the site budget sits under Apple’s daily account quota', () => {
    // Apple allows 250,000 views a day per developer account, and that
    // account also serves the pet site's shelter maps.
    expect(DEFAULT_LIMITS.siteBudget).toBeLessThan(250000);
  });

  test('days are UTC, and the view says the day and the ceiling', () => {
    expect(dayKey(T0)).toBe('2026-09-07');
    expect(nextDayMs(T0)).toBe(Date.parse('2026-09-08T00:00:00Z'));
    const view = meterView({ usage: { profile: bucket({ rounds: 4 }) }, hasProfile: true, limits, now: T0 });
    expect(view).toMatchObject({ day: '2026-09-07', rounds: 4, ceiling: limits.ceilingAnonymous });
    expect(view.apple.rounds).toBe(4);
    expect(meterView({ usage: {}, hasProfile: true, signedIn: true, limits, now: T0 }).ceiling).toBe(limits.ceilingSignedIn);
  });

  test('every refusal has words, and there are only three of them', () => {
    expect(METER_CODES).toEqual(['ceiling', 'budget', 'speed']);
    for (const code of METER_CODES) {
      expect(refusalMessage(code).length).toBeGreaterThan(8);
      expect(refusalTitle(code).length).toBeGreaterThan(3);
    }
    // nothing left that mentions the imagery nobody plays on
    for (const code of METER_CODES) expect(refusalMessage(code)).not.toMatch(/Google/i);
  });

  test('untilText counts down in the units a person would use', () => {
    expect(untilText(T0 + 20 * 60000, T0)).toBe('in 20 min');
    expect(untilText(T0 + 5 * 3600000, T0)).toBe('in 5 h');
    expect(untilText(T0 - 1000, T0)).toBe('any moment now');
  });
});

describe('on the store', () => {
  test('checkRound refuses once the ceiling is reached, and recording is what gets it there', async () => {
    const store = createMemoryRoomStore();
    const subjects = { profileId: 'p1', signedIn: false, ipHash: hashIp('1.2.3.4', 's') };
    const small = { ...limits, ceilingAnonymous: 2 };
    for (let i = 0; i < 2; i++) {
      await expect(checkRound(store, { subjects, now: T0, limits: small })).resolves.toMatchObject({ ok: true });
      await recordRound(store, { subjects, source: 'apple', now: T0 });
    }
    await expect(checkRound(store, { subjects, now: T0, limits: small })).rejects.toThrow(MeterError);
  });

  test('a new day starts over', async () => {
    const store = createMemoryRoomStore();
    const subjects = { profileId: 'p2', signedIn: false, ipHash: hashIp('5.6.7.8', 's') };
    const small = { ...limits, ceilingAnonymous: 1 };
    await recordRound(store, { subjects, source: 'apple', now: T0 });
    await expect(checkRound(store, { subjects, now: T0, limits: small })).rejects.toThrow(MeterError);
    const tomorrow = T0 + 24 * 3600000;
    await expect(checkRound(store, { subjects, now: tomorrow, limits: small })).resolves.toMatchObject({ ok: true });
  });

  test('the speed limit uses the limiter it is given, per profile', async () => {
    const store = createMemoryRoomStore();
    const seen = [];
    const limiter = async (key) => {
      seen.push(key);
      return { success: seen.length <= 1 };
    };
    const subjects = { profileId: 'p3', signedIn: false, ipHash: hashIp('9.9.9.9', 's') };
    await expect(checkRound(store, { subjects, now: T0, limits, limiter })).resolves.toMatchObject({ ok: true });
    await expect(checkRound(store, { subjects, now: T0, limits, limiter })).rejects.toMatchObject({ code: 'speed' });
    expect(seen[0]).toBe('geo-speed:p3');
  });

  test('a round is counted against the player, the address and the site', async () => {
    const store = createMemoryRoomStore();
    const subjects = { profileId: 'p4', signedIn: false, ipHash: hashIp('4.4.4.4', 's') };
    await recordRound(store, { subjects, source: 'apple', now: T0 });
    const mine = await usageToday(store, subjects, { now: T0 });
    expect(mine.rounds).toBe(1);
    const [site] = await store.listUsage([SITE_SUBJECT], dayKey(T0));
    expect(Math.max(site?.rounds || 0, site?.loads || 0)).toBe(1);
    expect(site.provider).toBe('apple');
  });

  test('a room seat goes through the same door', async () => {
    const store = createMemoryRoomStore();
    const subjects = { profileId: 'p5', signedIn: false, ipHash: hashIp('7.7.7.7', 's') };
    await expect(checkRoomEntry(store, { subjects, now: T0, limits })).resolves.toMatchObject({ ok: true });
  });
});
