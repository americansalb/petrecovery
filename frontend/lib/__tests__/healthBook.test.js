/**
 * Vaccination status math — the single source of truth the Today glance,
 * the Health overview band, the Vaccines tab, and the public clinical page
 * all render from. A shot with no expiry is "on file", not falsely current;
 * a lapsed shot is EXPIRED, not merely due.
 */

import { vaccinationStatus, healthBookStatus, DUE_SOON_DAYS } from '@/lib/healthBook';

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

describe('healthBookStatus (worst state first)', () => {
  test('empty record invites the first vaccine', () => {
    expect(healthBookStatus([], 'Reggie', now).tone).toBe('empty');
  });

  test('an expired shot dominates a current one', () => {
    const vax = [
      { name: 'Rabies', expiresAt: new Date(+now + 400 * day) },
      { name: 'Bordetella', expiresAt: new Date(+now - 40 * day) },
    ];
    const s = healthBookStatus(vax, 'Reggie', now);
    expect(s.tone).toBe('bad');
    expect(s.sentence).toContain('Bordetella');
  });

  test('tombstoned rows are ignored', () => {
    const s = healthBookStatus([{ name: 'X', expiresAt: new Date(+now - day), deletedAt: new Date() }], 'Reggie', now);
    expect(s.tone).toBe('empty');
  });
});
