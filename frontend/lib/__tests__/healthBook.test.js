/**
 * Vaccination status math - the single source of truth the Today glance,
 * the Health overview band, the Vaccines tab, and the public clinical page
 * all render from. A shot with no expiry is "on file", not falsely current;
 * a lapsed shot is EXPIRED, not merely due; and the one-sentence verdict
 * must name the worst lapse, count the rest, and date old expiries with a
 * year.
 */

import {
  vaccinationStatus, healthBookStatus, latestPerName, rankVaccinations,
  weightTrendSummary, DUE_SOON_DAYS,
} from '@/lib/healthBook';

const day = 86400000;
const now = new Date('2026-07-27T12:00:00Z');

describe('vaccinationStatus', () => {
  test('no expiry on file is ON_FILE, never a status implying coverage', () => {
    expect(vaccinationStatus({ administeredAt: new Date(now - 60 * day) }, now)).toBe('ON_FILE');
    expect(vaccinationStatus({ expiresAt: null }, now)).toBe('ON_FILE');
  });

  test('a past expiry is EXPIRED', () => {
    expect(vaccinationStatus({ expiresAt: new Date(now - day) }, now)).toBe('EXPIRED');
  });

  test('exactly now counts as expired (boundary)', () => {
    expect(vaccinationStatus({ expiresAt: new Date(now) }, now)).toBe('EXPIRED');
  });

  test('within the due-soon window is DUE_SOON, just past it is PROTECTED', () => {
    expect(vaccinationStatus({ expiresAt: new Date(+now + (DUE_SOON_DAYS - 1) * day) }, now)).toBe('DUE_SOON');
    expect(vaccinationStatus({ expiresAt: new Date(+now + (DUE_SOON_DAYS + 1) * day) }, now)).toBe('PROTECTED');
  });
});

describe('latestPerName (one live stamp per vaccine)', () => {
  test('a backfilled older record collapses behind the current one', () => {
    const current = { id: 'new', name: 'Rabies', administeredAt: new Date(+now - 30 * day), expiresAt: new Date(+now + 1000 * day) };
    const backfill = { id: 'old', name: 'rabies', administeredAt: new Date(+now - 400 * day), expiresAt: new Date(+now - 35 * day) };
    const live = latestPerName([current, backfill]);
    expect(live).toHaveLength(1);
    expect(live[0].id).toBe('new');
  });

  test('tombstoned rows are ignored', () => {
    expect(latestPerName([{ name: 'X', administeredAt: now, deletedAt: new Date() }])).toHaveLength(0);
  });
});

describe('rankVaccinations (attention first)', () => {
  test('expired sorts above due-soon above current above on-file', () => {
    const list = [
      { name: 'A', administeredAt: now, expiresAt: new Date(+now + 400 * day) },
      { name: 'B', administeredAt: now },
      { name: 'C', administeredAt: now, expiresAt: new Date(+now - day) },
      { name: 'D', administeredAt: now, expiresAt: new Date(+now + 10 * day) },
    ];
    expect(rankVaccinations(list, now).map((v) => v.name)).toEqual(['C', 'D', 'A', 'B']);
  });
});

describe('healthBookStatus (worst state first)', () => {
  test('empty record invites the first vaccine', () => {
    expect(healthBookStatus([], 'Reggie', now).tone).toBe('empty');
  });

  test('an expired shot dominates a current one', () => {
    const vax = [
      { name: 'Rabies', administeredAt: new Date(+now - 100 * day), expiresAt: new Date(+now + 400 * day) },
      { name: 'Bordetella', administeredAt: new Date(+now - 300 * day), expiresAt: new Date(+now - 40 * day) },
    ];
    const s = healthBookStatus(vax, 'Reggie', now);
    expect(s.tone).toBe('bad');
    expect(s.sentence).toContain('Bordetella');
  });

  test('names the LONGEST-expired vaccine, not the most recently stamped one', () => {
    const vax = [
      // Lepto stamped recently, expired 10 days ago; Rabies stamped years
      // ago, expired 14 months ago. The sentence must lead with Rabies.
      { name: 'Leptospirosis', administeredAt: new Date(+now - 375 * day), expiresAt: new Date(+now - 10 * day) },
      { name: 'Rabies', administeredAt: new Date(+now - 1533 * day), expiresAt: new Date(+now - 438 * day) },
    ];
    const s = healthBookStatus(vax, 'Biscuit', now);
    expect(s.sentence).toMatch(/^Rabies expired/);
    expect(s.expiredCount).toBe(2);
    expect(s.sentence).toContain('1 more');
  });

  test('an expiry outside the current year carries its year', () => {
    const s = healthBookStatus(
      [{ name: 'Rabies', administeredAt: new Date(+now - 1533 * day), expiresAt: new Date('2025-05-15T12:00:00Z') }],
      'Biscuit', now
    );
    expect(s.sentence).toContain('2025');
  });

  test('multiple due-soon are counted, soonest named', () => {
    const vax = ['A', 'B', 'C'].map((n, i) => ({
      name: n, administeredAt: new Date(+now - 300 * day), expiresAt: new Date(+now + (10 + i) * day),
    }));
    const s = healthBookStatus(vax, 'Atlas', now);
    expect(s.tone).toBe('warn');
    expect(s.dueCount).toBe(3);
    expect(s.sentence).toMatch(/^A due by/);
    expect(s.sentence).toContain('2 more due soon');
  });

  test('a backfilled older duplicate does not drag the standing down', () => {
    const s = healthBookStatus([
      { name: 'Rabies', administeredAt: new Date(+now - 30 * day), expiresAt: new Date(+now + 1000 * day) },
      { name: 'Rabies', administeredAt: new Date(+now - 800 * day), expiresAt: new Date(+now - 435 * day) },
    ], 'Atlas', now);
    expect(s.tone).toBe('good');
  });

  test('records with no expiries are "on file", not "up to date"', () => {
    const s = healthBookStatus([
      { name: 'FVRCP', administeredAt: new Date(+now - 700 * day) },
      { name: 'Rabies', administeredAt: new Date(+now - 500 * day) },
    ], 'Willow', now);
    expect(s.tone).toBe('onfile');
    expect(s.sentence).toContain('2 records on file');
  });

  test('tombstoned rows are ignored', () => {
    const s = healthBookStatus([{ name: 'X', administeredAt: now, expiresAt: new Date(+now - day), deletedAt: new Date() }], 'Reggie', now);
    expect(s.tone).toBe('empty');
  });
});

describe('weightTrendSummary (honest trends)', () => {
  const entry = (lbs, daysAgo) => ({ weightLbs: lbs, recordedAt: new Date(+now - daysAgo * day) });

  test('empty history is null; a single entry has no delta', () => {
    expect(weightTrendSummary([], { now })).toBeNull();
    const one = weightTrendSummary([entry(9.1, 12)], { now });
    expect(one.latest.weightLbs).toBe(9.1);
    expect(one.delta).toBeNull();
  });

  test('delta is measured inside the window, not against a puppy weight years back', () => {
    const t = weightTrendSummary([entry(24, 1000), entry(140, 60), entry(141.5, 2)], { now });
    expect(t.delta).toBe(1.5);
    expect(t.spanLabel).toBe('2 mo');
  });

  test('no baseline inside the window means no delta claim', () => {
    const t = weightTrendSummary([entry(30, 400), entry(29, 200)], { now });
    expect(t.latest.weightLbs).toBe(29);
    expect(t.delta).toBeNull();
  });
});
