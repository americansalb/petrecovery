/**
 * shelterMatching pure-function behavior: normalization of a roster Pet
 * into the matcher's "found" shape, coordinate fallback to the shelter,
 * the argument-order subtlety (stray FIRST so timing points count), and
 * microchip forcing. Uses the REAL calibrated engine in lib/matching.
 */

jest.mock('@/app/lib/prisma', () => ({ __esModule: true, default: {} }));
jest.mock('@/app/lib/ai/comparePetPhotos', () => ({ comparePetPhotos: jest.fn() }));
jest.mock('@/app/lib/notifications-inapp', () => ({ createInAppNotification: jest.fn() }));
jest.mock('@/app/lib/push', () => ({ sendPushToUser: jest.fn() }));
jest.mock('@/lib/logging', () => ({ logEvent: jest.fn().mockResolvedValue(undefined) }));

import { strayAsFound, scoreStrayAgainstCases } from '@/app/lib/shelterMatching';

const SHELTER = { latitude: 42.05, longitude: -88.3 };

const STRAY = {
  id: 'pet-1',
  species: 'DOG',
  breed: 'Beagle',
  color: 'Brown and white',
  microchipId: null,
  intakeDate: new Date('2026-07-15'),
  createdAt: new Date('2026-07-15'),
  intakeFoundLatitude: 42.04,
  intakeFoundLongitude: -88.28,
};

const LOST_CASE = {
  id: 'case-1',
  petSpecies: 'DOG',
  petBreed: 'Beagle',
  petColor: 'Brown and white',
  lastSeenLatitude: 42.041,
  lastSeenLongitude: -88.281,
  lastSeenAt: new Date('2026-07-10'), // lost BEFORE the stray was taken in
  createdAt: new Date('2026-07-10'),
  pet: { microchipId: null },
};

describe('strayAsFound', () => {
  test('prefers the actual found spot and the intake date', () => {
    const found = strayAsFound(STRAY, SHELTER);
    expect(found.latitude).toBe(42.04);
    expect(found.longitude).toBe(-88.28);
    expect(found.foundAt).toEqual(new Date('2026-07-15'));
    expect(found.petSpecies).toBe('DOG');
    expect(found.petColor).toBe('Brown and white');
  });

  test('falls back to the shelter location when no found spot was recorded', () => {
    const found = strayAsFound(
      { ...STRAY, intakeFoundLatitude: null, intakeFoundLongitude: null },
      SHELTER
    );
    expect(found.latitude).toBe(42.05);
    expect(found.longitude).toBe(-88.3);
  });

  test('leaves coords undefined when neither side has them', () => {
    const found = strayAsFound(
      { ...STRAY, intakeFoundLatitude: null, intakeFoundLongitude: null },
      { latitude: null, longitude: null }
    );
    expect(found.latitude).toBeUndefined();
    expect(found.longitude).toBeUndefined();
  });
});

describe('scoreStrayAgainstCases', () => {
  test('a same-species same-color nearby stray taken in AFTER the loss scores a candidate', () => {
    const scored = scoreStrayAgainstCases(STRAY, SHELTER, [LOST_CASE]);
    expect(scored).toHaveLength(1);
    expect(scored[0].case.id).toBe('case-1');
    expect(scored[0].score).toBeGreaterThan(35);
    expect(scored[0].matchSource).toBe('attribute');
    // The stray sat in the FIRST argument, so the intake-after-loss
    // ordering awards timing points instead of silently zeroing them.
    expect(scored[0].details).toBeDefined();
  });

  test('a matching microchip forces the microchip match source', () => {
    const chipStray = { ...STRAY, microchipId: '985-1122-3344' };
    const chipCase = { ...LOST_CASE, pet: { microchipId: '985112233 44' } };
    const scored = scoreStrayAgainstCases(chipStray, SHELTER, [chipCase]);
    expect(scored).toHaveLength(1);
    expect(scored[0].matchSource).toBe('microchip');
  });

  test('a different species never surfaces', () => {
    const scored = scoreStrayAgainstCases(STRAY, SHELTER, [
      { ...LOST_CASE, petSpecies: 'CAT' },
    ]);
    expect(scored).toHaveLength(0);
  });

  test('results are capped and sorted best first', () => {
    const cases = Array.from({ length: 12 }, (_, i) => ({
      ...LOST_CASE,
      id: `case-${i}`,
      // push some further away so ordering is observable
      lastSeenLatitude: 42.041 + i * 0.02,
    }));
    const scored = scoreStrayAgainstCases(STRAY, SHELTER, cases);
    expect(scored.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < scored.length; i += 1) {
      expect(scored[i - 1].pTrueMatch).toBeGreaterThanOrEqual(scored[i].pTrueMatch);
    }
  });
});
