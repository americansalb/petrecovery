/**
 * Timezone and daylight-saving behaviour of the dose schedule engine.
 *
 * These are the cases that silently produce a WRONG NUMBER OF DOSES, which
 * for medication is the failure that matters: a day that renders two slots
 * instead of one (or none instead of one) either double-doses a pet or
 * hides a dose the caregiver then never gives.
 *
 * Run under a DST-observing zone; jest.config sets TZ=America/New_York so
 * these dates are the real US transitions:
 *   2026-03-08  spring forward, 02:00 -> 03:00 (02:30 never happens)
 *   2026-11-01  fall back,      02:00 -> 01:00 (01:30 happens twice)
 */

import {
  slotKeyFor, slotDate, startOfDay, sameDay, isDueOn, slotsForDate,
  slotsWithStatus, adherenceForDay, canonicalInstantForSlot,
} from '@/lib/medications';

const SPRING_FORWARD = new Date(2026, 2, 8);  // Mar 8 2026, local
const FALL_BACK = new Date(2026, 10, 1);      // Nov 1 2026, local

const daily = (times, extra = {}) => ({
  isActive: true, scheduleType: 'DAILY', timesOfDay: times,
  startDate: new Date(2026, 0, 1).toISOString(), ...extra,
});

describe('the test environment really is a DST zone', () => {
  test('offset differs either side of the spring transition', () => {
    const before = new Date(2026, 2, 1).getTimezoneOffset();
    const after = new Date(2026, 2, 15).getTimezoneOffset();
    expect(before).not.toBe(after);
  });
});

describe('slotKey is a wall-clock identity, so it survives DST and travel', () => {
  test('the key for 08:00 is the same string on both DST days', () => {
    expect(slotKeyFor(SPRING_FORWARD, '08:00')).toBe('2026-03-08T08:00');
    expect(slotKeyFor(FALL_BACK, '08:00')).toBe('2026-11-01T08:00');
  });

  test('a nonexistent wall-clock time still yields its own stable key', () => {
    // 02:30 does not exist on the spring-forward day. The key must still be
    // the time the owner scheduled, or the two caregivers looking at the same
    // row would compute different identities for it.
    expect(slotKeyFor(SPRING_FORWARD, '02:30')).toBe('2026-03-08T02:30');
  });
});

describe('DST days produce exactly one slot per scheduled time', () => {
  test('spring forward: a 02:30 dose is not lost even though 02:30 does not exist', () => {
    const slots = slotsForDate(daily(['02:30']), SPRING_FORWARD);
    expect(slots).toHaveLength(1);
    expect(slots[0].time).toBe('02:30');
    expect(slots[0].slotKey).toBe('2026-03-08T02:30');
    // The raw instant is whatever the platform picks for a skipped hour; what
    // must hold is that it lands on the same calendar day, so the dose shows
    // up on the right day's list.
    expect(sameDay(slots[0].scheduledFor, SPRING_FORWARD)).toBe(true);
  });

  test('fall back: a 01:30 dose appears once, not twice', () => {
    const slots = slotsForDate(daily(['01:30']), FALL_BACK);
    expect(slots).toHaveLength(1);
    expect(slots[0].slotKey).toBe('2026-11-01T01:30');
  });

  test('a twice-daily med still has two slots on each DST day', () => {
    expect(slotsForDate(daily(['08:00', '20:00']), SPRING_FORWARD)).toHaveLength(2);
    expect(slotsForDate(daily(['08:00', '20:00']), FALL_BACK)).toHaveLength(2);
  });
});

describe('EVERY_N_DAYS cadence does not drift across a DST boundary', () => {
  // A 23-hour and a 25-hour day must both count as exactly one day, or an
  // every-other-day medication slips a day every time the clocks change.
  const everyOther = {
    isActive: true, scheduleType: 'EVERY_N_DAYS', intervalDays: 2,
    timesOfDay: ['09:00'], startDate: new Date(2026, 2, 6).toISOString(), // Fri Mar 6
  };

  test('spring forward: due days stay on the even offsets from the anchor', () => {
    expect(isDueOn(everyOther, new Date(2026, 2, 6))).toBe(true);   // +0
    expect(isDueOn(everyOther, new Date(2026, 2, 7))).toBe(false);  // +1
    expect(isDueOn(everyOther, new Date(2026, 2, 8))).toBe(true);   // +2, the 23h day
    expect(isDueOn(everyOther, new Date(2026, 2, 9))).toBe(false);  // +3
    expect(isDueOn(everyOther, new Date(2026, 2, 10))).toBe(true);  // +4
  });

  test('fall back: same, across the 25-hour day', () => {
    const med = { ...everyOther, startDate: new Date(2026, 9, 30).toISOString() }; // Fri Oct 30
    expect(isDueOn(med, new Date(2026, 9, 30))).toBe(true);
    expect(isDueOn(med, new Date(2026, 10, 1))).toBe(true);  // +2, the 25h day
    expect(isDueOn(med, new Date(2026, 10, 3))).toBe(true);  // +4
    expect(isDueOn(med, new Date(2026, 10, 2))).toBe(false);
  });

  test('a year of every-other-day dosing never slips, either side of both transitions', () => {
    const anchor = new Date(2026, 0, 1);
    const med = { ...everyOther, startDate: anchor.toISOString() };
    let due = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(2026, 0, 1 + i);
      if (isDueOn(med, d)) {
        // every due day must be an even number of days from the anchor
        expect(Math.round((startOfDay(d) - startOfDay(anchor)) / 86400000) % 2).toBe(0);
        due++;
      }
    }
    expect(due).toBe(183); // 365 days, every other day, inclusive of day 0
  });
});

describe('canonicalInstantForSlot: one slot, one row, in every timezone', () => {
  // This is what stops two caregivers in different zones from each inserting a
  // GIVEN row for the same 8am dose. It must be a pure function of the key.
  test('the same key always yields the same instant', () => {
    expect(canonicalInstantForSlot('2026-03-08T08:00').toISOString()).toBe('2026-03-08T08:00:00.000Z');
    expect(canonicalInstantForSlot('2026-11-01T01:30').toISOString()).toBe('2026-11-01T01:30:00.000Z');
  });

  test('it does not depend on the ambient timezone', () => {
    const here = canonicalInstantForSlot('2026-07-04T09:15').getTime();
    const saved = process.env.TZ;
    try {
      process.env.TZ = 'Asia/Tokyo';
      expect(canonicalInstantForSlot('2026-07-04T09:15').getTime()).toBe(here);
      process.env.TZ = 'Pacific/Auckland';
      expect(canonicalInstantForSlot('2026-07-04T09:15').getTime()).toBe(here);
    } finally { process.env.TZ = saved; }
  });

  test('distinct slots never collide, including the two DST-day edges', () => {
    const keys = ['2026-03-08T01:30', '2026-03-08T02:30', '2026-03-08T03:30', '2026-11-01T01:30'];
    const instants = new Set(keys.map((k) => canonicalInstantForSlot(k).getTime()));
    expect(instants.size).toBe(keys.length);
  });

  test('a malformed key returns null so the caller falls back rather than throwing', () => {
    for (const bad of [null, '', 'not-a-slot', '2026-3-8T08:00', '2026-03-08 08:00', '2026-03-08T08:00:00']) {
      expect(canonicalInstantForSlot(bad)).toBeNull();
    }
  });
});

describe('a dose logged in one timezone is recognised in another', () => {
  test('matching is by slotKey, so a differing raw instant still resolves', () => {
    const med = daily(['08:00']);
    // Logged by a caregiver whose device wrote a London instant for the slot
    const doses = [{
      slotKey: '2026-03-08T08:00',
      scheduledFor: '2026-03-08T08:00:00.000Z', // not the local 08:00 instant here
      status: 'GIVEN',
    }];
    const slots = slotsWithStatus(med, doses, SPRING_FORWARD);
    expect(slots).toHaveLength(1);
    expect(slots[0].status).toBe('GIVEN');
    // and it counts once, not as one due plus one orphan
    expect(adherenceForDay(med, doses, SPRING_FORWARD)).toEqual({ due: 1, given: 1, skipped: 0 });
  });

  test('a legacy dose with no slotKey still matches on its instant', () => {
    const med = daily(['08:00']);
    const localInstant = slotDate(SPRING_FORWARD, '08:00');
    const doses = [{ scheduledFor: localInstant.toISOString(), status: 'GIVEN' }];
    expect(adherenceForDay(med, doses, SPRING_FORWARD)).toEqual({ due: 1, given: 1, skipped: 0 });
  });
});
