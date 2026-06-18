/**
 * Tests for the medication schedule engine + free-text parser (lib/medications.js).
 */

import {
  parseMedicationText,
  isDueOn,
  slotsForDate,
  slotsWithStatus,
  adherenceForDay,
  formatSchedule,
  formatTime,
  timeOfDayBucket,
  isLowSupply,
  slotDate,
  slotKeyFor,
  hasValidSchedule,
} from '@/lib/medications';

const day = (offset, hhmm = '00:00') => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(h, m, 0, 0);
  return d;
};

const baseMed = (overrides = {}) => ({
  isActive: true,
  scheduleType: 'DAILY',
  timesOfDay: ['08:00', '20:00'],
  daysOfWeek: null,
  intervalDays: null,
  startDate: day(-10).toISOString(),
  endDate: null,
  ...overrides,
});

describe('schedule engine', () => {
  test('DAILY med is due every day with one slot per time', () => {
    const med = baseMed();
    expect(isDueOn(med, day(0))).toBe(true);
    const slots = slotsForDate(med, day(0));
    expect(slots).toHaveLength(2);
    expect(slots.map((s) => s.time)).toEqual(['08:00', '20:00']);
  });

  test('not due before startDate or after endDate', () => {
    const med = baseMed({ startDate: day(2).toISOString() });
    expect(isDueOn(med, day(0))).toBe(false);
    expect(isDueOn(med, day(2))).toBe(true);

    const ended = baseMed({ endDate: day(-1).toISOString() });
    expect(isDueOn(ended, day(0))).toBe(false);
  });

  test('paused med has no slots', () => {
    const med = baseMed({ isActive: false });
    expect(slotsForDate(med, day(0))).toHaveLength(0);
  });

  test('SPECIFIC_DAYS only fires on listed weekdays', () => {
    const target = day(0);
    const med = baseMed({
      scheduleType: 'SPECIFIC_DAYS',
      daysOfWeek: JSON.stringify([target.getDay()]),
      timesOfDay: ['09:00'],
    });
    expect(isDueOn(med, target)).toBe(true);
    expect(isDueOn(med, day(1))).toBe(false); // next weekday differs
  });

  test('EVERY_N_DAYS anchors on startDate', () => {
    const med = baseMed({
      scheduleType: 'EVERY_N_DAYS',
      intervalDays: 3,
      startDate: day(-6).toISOString(),
      timesOfDay: ['09:00'],
    });
    expect(isDueOn(med, day(0))).toBe(true);  // -6, -3, 0
    expect(isDueOn(med, day(-1))).toBe(false);
    expect(isDueOn(med, day(3))).toBe(true);
  });

  test('AS_NEEDED has no scheduled slots', () => {
    const med = baseMed({ scheduleType: 'AS_NEEDED', timesOfDay: [] });
    expect(slotsForDate(med, day(0))).toHaveLength(0);
  });

  test('slotsWithStatus joins dose logs by exact slot time', () => {
    const med = baseMed();
    const doses = [
      { scheduledFor: slotDate(day(0), '08:00').toISOString(), status: 'GIVEN' },
    ];
    const slots = slotsWithStatus(med, doses, day(0));
    expect(slots.find((s) => s.time === '08:00').status).toBe('GIVEN');
    expect(slots.find((s) => s.time === '20:00').status).toBeNull();
  });

  test('adherenceForDay counts due/given/skipped', () => {
    const med = baseMed();
    const doses = [
      { scheduledFor: slotDate(day(0), '08:00').toISOString(), status: 'GIVEN' },
      { scheduledFor: slotDate(day(0), '20:00').toISOString(), status: 'SKIPPED' },
    ];
    expect(adherenceForDay(med, doses, day(0))).toEqual({ due: 2, given: 1, skipped: 1 });
  });
});

describe('schedule integrity: fail-safe, never silently hide a med', () => {
  test('EVERY_N_DAYS with a MISSING start date is shown, not silently hidden', () => {
    const med = baseMed({ scheduleType: 'EVERY_N_DAYS', intervalDays: 3, startDate: null, timesOfDay: ['09:00'] });
    expect(isDueOn(med, day(0))).toBe(true);          // visible, recoverable
    expect(slotsForDate(med, day(0))).toHaveLength(1);
  });

  test('EVERY_N_DAYS with an INVALID start date does not NaN into hiding', () => {
    const med = baseMed({ scheduleType: 'EVERY_N_DAYS', intervalDays: 2, startDate: 'not-a-date', timesOfDay: ['09:00'] });
    expect(isDueOn(med, day(0))).toBe(true);
  });

  test('a valid anchor still computes the real cadence (no over-showing)', () => {
    const med = baseMed({ scheduleType: 'EVERY_N_DAYS', intervalDays: 3, startDate: day(-6).toISOString(), timesOfDay: ['09:00'] });
    expect(isDueOn(med, day(0))).toBe(true);   // -6, -3, 0
    expect(isDueOn(med, day(-1))).toBe(false); // not every day
  });

  test('hasValidSchedule flags broken schedules so the UI can surface them', () => {
    expect(hasValidSchedule(baseMed())).toBe(true);
    expect(hasValidSchedule(baseMed({ scheduleType: 'EVERY_N_DAYS', intervalDays: 3 }))).toBe(true);
    expect(hasValidSchedule(baseMed({ scheduleType: 'EVERY_N_DAYS', intervalDays: 3, startDate: null }))).toBe(false);
    expect(hasValidSchedule(baseMed({ scheduleType: 'SPECIFIC_DAYS', daysOfWeek: JSON.stringify([]) }))).toBe(false);
    expect(hasValidSchedule(baseMed({ scheduleType: 'AS_NEEDED' }))).toBe(true);
  });

  // FIXED (finding #1): dose identity is the timezone-independent slotKey.
  test('slotKeyFor is a stable wall-clock key, independent of timezone', () => {
    expect(slotKeyFor(new Date(2026, 5, 15), '08:00')).toBe('2026-06-15T08:00');
  });

  test('a slot matches by slotKey even when the logged instant differs (cross-timezone)', () => {
    const med = baseMed();
    const d = day(0);
    // Another caregiver logged the SAME 8 AM slot from a different timezone:
    // identical slotKey, but a raw instant 3 hours off. It must still resolve,
    // so the second caregiver does not see it as un-given and re-dose.
    const foreignInstant = new Date(slotDate(d, '08:00').getTime() + 3 * 3600 * 1000).toISOString();
    const doses = [{ scheduledFor: foreignInstant, slotKey: slotKeyFor(d, '08:00'), status: 'GIVEN' }];
    const slots = slotsWithStatus(med, doses, d);
    expect(slots.find((s) => s.time === '08:00').status).toBe('GIVEN');
    expect(slots.find((s) => s.time === '20:00').status).toBeNull();
  });

  test('legacy doses without a slotKey still match by raw instant', () => {
    const med = baseMed();
    const doses = [{ scheduledFor: slotDate(day(0), '08:00').toISOString(), status: 'GIVEN' }];
    expect(slotsWithStatus(med, doses, day(0)).find((s) => s.time === '08:00').status).toBe('GIVEN');
  });
});

describe('display helpers', () => {
  test('formatTime renders 12h clock', () => {
    expect(formatTime('08:00')).toBe('8:00 AM');
    expect(formatTime('20:30')).toBe('8:30 PM');
    expect(formatTime('00:15')).toBe('12:15 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
  });

  test('formatSchedule summarizes each schedule type', () => {
    expect(formatSchedule(baseMed())).toBe('Twice daily · 8:00 AM & 8:00 PM');
    expect(formatSchedule(baseMed({ scheduleType: 'EVERY_N_DAYS', intervalDays: 2, timesOfDay: ['09:00'] })))
      .toBe('Every other day · 9:00 AM');
    expect(formatSchedule(baseMed({ scheduleType: 'AS_NEEDED', timesOfDay: [] }))).toBe('As needed');
  });

  test('timeOfDayBucket groups by morning/afternoon/evening', () => {
    expect(timeOfDayBucket('08:00')).toBe('Morning');
    expect(timeOfDayBucket('14:00')).toBe('Afternoon');
    expect(timeOfDayBucket('20:00')).toBe('Evening');
  });

  test('isLowSupply triggers at or below the alert threshold', () => {
    expect(isLowSupply({ quantityRemaining: 4, refillAlertAt: 5 })).toBe(true);
    expect(isLowSupply({ quantityRemaining: 6, refillAlertAt: 5 })).toBe(false);
    expect(isLowSupply({ quantityRemaining: null, refillAlertAt: 5 })).toBe(false);
  });
});

describe('parseMedicationText (heuristic wizard brain)', () => {
  test('classic twice-daily sentence', () => {
    const r = parseMedicationText('Apoquel 16mg twice a day with food for allergies');
    expect(r.name).toBe('Apoquel');
    expect(r.strength).toBe('16 mg');
    expect(r.scheduleType).toBe('DAILY');
    expect(r.timesOfDay).toEqual(['08:00', '20:00']);
    expect(r.instructions).toMatch(/with food/i);
    expect(r.purpose?.toLowerCase()).toBe('allergies');
  });

  test('every other day', () => {
    const r = parseMedicationText('Gabapentin 100 mg capsule every other day');
    expect(r.strength).toBe('100 mg');
    expect(r.form).toBe('CAPSULE');
    expect(r.scheduleType).toBe('EVERY_N_DAYS');
    expect(r.intervalDays).toBe(2);
  });

  test('monthly preventative', () => {
    const r = parseMedicationText('Heartgard chewable once a month');
    expect(r.form).toBe('CHEWABLE');
    expect(r.scheduleType).toBe('EVERY_N_DAYS');
    expect(r.intervalDays).toBe(30);
  });

  test('every 12 hours maps to twice daily', () => {
    const r = parseMedicationText('Insulin injection 2 units every 12 hours');
    expect(r.form).toBe('INJECTION');
    expect(r.scheduleType).toBe('DAILY');
    expect(r.timesOfDay).toHaveLength(2);
  });

  test('as needed / PRN', () => {
    const r = parseMedicationText('Zymox ear drops as needed');
    expect(r.form).toBe('DROPS');
    expect(r.scheduleType).toBe('AS_NEEDED');
  });

  test('three times a day', () => {
    const r = parseMedicationText('Amoxicillin 250mg 3 times a day');
    expect(r.scheduleType).toBe('DAILY');
    expect(r.timesOfDay).toEqual(['08:00', '14:00', '20:00']);
  });

  test('morning and evening words become times', () => {
    const r = parseMedicationText('Prednisone 5 mg in the morning and evening');
    expect(r.scheduleType).toBe('DAILY');
    expect(r.timesOfDay).toEqual(['08:00', '20:00']);
  });

  test('empty input is safe', () => {
    const r = parseMedicationText('');
    expect(r.name).toBe('');
    expect(r.confidence).toBe('low');
  });
});
