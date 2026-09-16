/**
 * A shared board cannot be played early.
 *
 * The daily challenge and the weekly cup are the only things in the
 * game where everybody plays the SAME places, which is the whole reason
 * their scores are worth comparing. A seed is what selects those
 * places, and it is supplied by the caller.
 *
 * `isDailySeed` is only a shape test, a regex. Before this, the server
 * honoured any date that matched it, so asking for `daily-2027-01-01`
 * handed back next year's five places: note them down, come back on the
 * day, post 25,000. `cup-2099-W01` the same. Every board in the game
 * was readable in advance by anyone who guessed the seed format, which
 * is written in the share links.
 *
 * `ranked` already got this right, with a window rather than a pattern.
 * These tests hold the other two to it.
 */

const {
  normalizeConfig,
  dailySeed,
  cupSeed,
  dailySeedAt,
  cupSeedAt,
  isoWeek,
} = require('@/app/lib/geo/modes');

const NOW = new Date('2026-09-16T12:00:00Z');
const seedFor = (raw, mode = 'daily', now = NOW) => normalizeConfig({ mode, seed: raw }, { now }).seed;

describe('the daily challenge cannot be played ahead of time', () => {
  test('tomorrow is refused, and today is served instead', () => {
    expect(seedFor('daily-2026-09-17')).toBe(dailySeed(NOW));
  });

  test('next year is refused', () => {
    expect(seedFor('daily-2027-01-01')).toBe(dailySeed(NOW));
  });

  test("today's own seed is still honoured", () => {
    expect(seedFor(dailySeed(NOW))).toBe(dailySeed(NOW));
  });

  test('a game begun before midnight can still finish its rounds', () => {
    // Started 23:58, asking for round four at 00:03. Rejecting this
    // would split one game across two boards.
    const justAfterMidnight = new Date('2026-09-16T00:03:00Z');
    const yesterday = 'daily-2026-09-15';
    expect(seedFor(yesterday, 'daily', justAfterMidnight)).toBe(yesterday);
  });

  test('a seed for later today is still the future, and still refused', () => {
    // The boundary that matters: midnight UTC, not "some time today".
    const earlyToday = new Date('2026-09-16T00:30:00Z');
    expect(seedFor('daily-2026-09-17', 'daily', earlyToday)).toBe(dailySeed(earlyToday));
  });

  test('the past stays open, because that is what a share link is', () => {
    // Replaying an old daily changes no board: an entry is recorded
    // from the first attempt only, and that day's board is closed.
    // Refusing the past would break every shared link to fix a bug that
    // only ever pointed forward.
    for (const old of ['daily-2026-09-15', 'daily-2026-09-01', 'daily-2025-01-01']) {
      expect({ old, seed: seedFor(old) }).toEqual({ old, seed: old });
    }
  });

  test('a malformed seed falls back rather than throwing', () => {
    for (const bad of ['daily-not-a-date', 'daily-9999-99-99', '', null, 'daily-2026-9-1']) {
      expect({ bad, seed: seedFor(bad) }).toEqual({ bad, seed: dailySeed(NOW) });
    }
  });
});

describe('the weekly cup cannot be played ahead of time', () => {
  test('a future week is refused', () => {
    expect(seedFor('cup-2099-W01', 'cup')).toBe(cupSeed(NOW));
  });

  test("this week's own seed is honoured", () => {
    expect(seedFor(cupSeed(NOW), 'cup')).toBe(cupSeed(NOW));
  });

  test('a game begun before the week rolled over can finish', () => {
    const justAfterRollover = new Date('2026-09-14T00:30:00Z');
    const lastWeek = `cup-${isoWeek(new Date('2026-09-10T00:00:00Z'))}`;
    expect(seedFor(lastWeek, 'cup', justAfterRollover)).toBe(lastWeek);
  });
});

describe('the seed clocks themselves', () => {
  test('dailySeedAt reads midnight UTC of the day named', () => {
    expect(dailySeedAt('daily-2026-09-16')).toBe(Date.UTC(2026, 8, 16));
    expect(dailySeedAt('nonsense')).toBeNull();
  });

  test('cupSeedAt reads the Monday the week began', () => {
    const at = cupSeedAt(cupSeed(NOW));
    expect(at).not.toBeNull();
    expect(new Date(at).getUTCDay()).toBe(1);
    expect(at).toBeLessThanOrEqual(NOW.getTime());
    expect(cupSeedAt('cup-oops')).toBeNull();
  });
});
