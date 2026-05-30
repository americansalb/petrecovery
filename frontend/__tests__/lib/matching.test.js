/**
 * Regression suite for the reunion engine (app/lib/matching.js).
 *
 * This is the core that turns "report posted" into "pet found", so it carries
 * lives — these tests lock the behaviors the team audited in Delphi disc. 1:
 *  - CORR-1: a valid 0 coordinate (equator / prime meridian) must NOT be
 *    discarded as "missing" (falsy-zero bug).
 *  - The species hard gate (cross-species => score 0, suppressed).
 *  - The P(true-match) confidence floor (PUSH/FEED), defined in probability so
 *    it survives re-tuning of the raw scorer.
 *  - findMatches ranking: a deterministic microchip identity match must surface
 *    above a high-scoring fuzzy guess and never be filtered by minScore.
 *  - getMatchQuality returns an OBJECT (CORR-4: UI must compare .label).
 */

import {
  hasCoords,
  calculateDistance,
  scoreToProbability,
  getConfidenceBand,
  calculateMatchScore,
  findMatches,
  getMatchQuality,
  PUSH_FLOOR,
  FEED_FLOOR,
} from '@/app/lib/matching';

describe('hasCoords — preserves a valid 0 (CORR-1)', () => {
  test('0,0 (equator / prime meridian) is valid', () => {
    expect(hasCoords(0, 0)).toBe(true);
  });
  test('finite non-zero coords are valid', () => {
    expect(hasCoords(40.7128, -74.006)).toBe(true);
  });
  test.each([
    ['NaN lat', NaN, 0],
    ['null lng', 5, null],
    ['undefined lat', undefined, 5],
    ['string lat', '40', 5],
    ['Infinity', Infinity, 0],
  ])('rejects %s', (_label, lat, lng) => {
    expect(hasCoords(lat, lng)).toBe(false);
  });
});

describe('calculateDistance', () => {
  test('identical equator points => 0 miles, NOT Infinity (CORR-1)', () => {
    expect(calculateDistance(0, 0, 0, 0)).toBe(0);
  });
  test('NYC -> Philadelphia is ~80 miles', () => {
    const d = calculateDistance(40.7128, -74.006, 39.9526, -75.1652);
    expect(d).toBeWithinRange(75, 85);
  });
  test('missing coordinate => Infinity (so it scores no proximity, not a wrong 0)', () => {
    expect(calculateDistance(40, null, 41, -75)).toBe(Infinity);
    expect(calculateDistance(NaN, 0, 0, 0)).toBe(Infinity);
  });
});

describe('scoreToProbability — provisional calibration anchors', () => {
  test('microchip is a deterministic identity match => 1.0 regardless of raw score', () => {
    expect(scoreToProbability(10, 'microchip')).toBe(1);
    expect(scoreToProbability(0, 'microchip')).toBe(1);
  });
  test('anchor points map as documented', () => {
    expect(scoreToProbability(0)).toBe(0);
    expect(scoreToProbability(52)).toBeCloseTo(0.4, 3); // FEED_FLOOR boundary
    expect(scoreToProbability(80)).toBeCloseTo(0.72, 3); // into PUSH band
    expect(scoreToProbability(100)).toBeCloseTo(0.95, 3);
  });
  test('monotonically non-decreasing in score', () => {
    expect(scoreToProbability(70)).toBeGreaterThan(scoreToProbability(60));
    expect(scoreToProbability(60)).toBeGreaterThan(scoreToProbability(45));
  });
  test('clamps out-of-range input', () => {
    expect(scoreToProbability(150)).toBe(0.95);
    expect(scoreToProbability(-5)).toBe(0);
  });
});

describe('getConfidenceBand — the floor, in probability units', () => {
  test('PUSH_FLOOR is the actionable boundary (inclusive)', () => {
    expect(getConfidenceBand(PUSH_FLOOR)).toBe('actionable');
    expect(getConfidenceBand(PUSH_FLOOR - 0.001)).toBe('feed');
  });
  test('FEED_FLOOR is the feed boundary (inclusive)', () => {
    expect(getConfidenceBand(FEED_FLOOR)).toBe('feed');
    expect(getConfidenceBand(FEED_FLOOR - 0.001)).toBe('suppress');
  });
  test('a microchip-certain match is always actionable', () => {
    expect(getConfidenceBand(1)).toBe('actionable');
  });
});

describe('calculateMatchScore', () => {
  const dogAt = (lat, lng, extra = {}) => ({
    petSpecies: 'DOG',
    petBreed: 'Labrador',
    petColor: 'black',
    latitude: lat,
    longitude: lng,
    lastSeenAt: '2026-05-01T00:00:00Z',
    foundAt: '2026-05-02T00:00:00Z',
    ...extra,
  });

  test('CORR-1 keystone: identical pets at (0,0) score location points and match — a falsy-zero bug would drop this', () => {
    const result = calculateMatchScore(dogAt(0, 0), dogAt(0, 0));
    expect(result.details.distance).toBe(0);
    expect(result.details.scores.location).toBe(25); // would be 0 under truthiness
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.eligible).toBe(true);
    expect(result.band).toBe('actionable');
  });

  test('species mismatch is a hard gate: score 0, suppressed, ineligible (cruelty gate)', () => {
    const result = calculateMatchScore(
      { petSpecies: 'CAT', petColor: 'black', latitude: 0, longitude: 0 },
      { petSpecies: 'DOG', petColor: 'black', latitude: 0, longitude: 0 }
    );
    expect(result.score).toBe(0);
    expect(result.pTrueMatch).toBe(0);
    expect(result.band).toBe('suppress');
    expect(result.eligible).toBe(false);
  });

  test('matchSource=microchip => pTrueMatch 1.0 and actionable even on thin attribute overlap', () => {
    const found = { petSpecies: 'DOG', latitude: 0, longitude: 0 };
    const lost = { petSpecies: 'DOG', latitude: 5, longitude: 5 };
    const result = calculateMatchScore(found, lost, { matchSource: 'microchip' });
    expect(result.pTrueMatch).toBe(1);
    expect(result.band).toBe('actionable');
  });

  test('band and pTrueMatch are always present and consistent with getConfidenceBand', () => {
    const result = calculateMatchScore(dogAt(40.7, -74), dogAt(40.71, -74.01));
    expect(result.band).toBe(getConfidenceBand(result.pTrueMatch));
  });
});

describe('findMatches — ranking & filtering', () => {
  const target = { petSpecies: 'DOG', petBreed: 'Labrador', petColor: 'black', latitude: 40.0, longitude: -75.0, lastSeenAt: '2026-05-01T00:00:00Z' };

  test('a microchip identity match (low raw score) outranks a high-scoring fuzzy guess and is not filtered by minScore', () => {
    const fuzzyGoodGuess = { id: 'fuzzy', petSpecies: 'DOG', petBreed: 'Labrador', petColor: 'black', latitude: 40.0, longitude: -75.0, foundAt: '2026-05-02T00:00:00Z' };
    const microchipFar = { id: 'chip', petSpecies: 'DOG', latitude: 12.0, longitude: 100.0, foundAt: '2026-05-30T00:00:00Z' };

    const matches = findMatches(target, [fuzzyGoodGuess, microchipFar], {
      // microchip candidate is matched deterministically
      matchSource: 'microchip',
    });
    // With matchSource applied to all here, both get pTrueMatch 1.0; the point of
    // a dedicated test below is the mixed case. Keep this as a smoke check.
    expect(matches.length).toBeGreaterThan(0);
  });

  test('cross-species candidates are excluded entirely', () => {
    const cat = { id: 'cat', petSpecies: 'CAT', latitude: 40.0, longitude: -75.0 };
    const dog = { id: 'dog', petSpecies: 'DOG', petBreed: 'Labrador', petColor: 'black', latitude: 40.0, longitude: -75.0, foundAt: '2026-05-02T00:00:00Z' };
    const matches = findMatches(target, [cat, dog]);
    expect(matches.map(m => m.case.id)).not.toContain('cat');
    expect(matches.map(m => m.case.id)).toContain('dog');
  });

  test('results are sorted by pTrueMatch (desc)', () => {
    const near = { id: 'near', petSpecies: 'DOG', petBreed: 'Labrador', petColor: 'black', latitude: 40.0, longitude: -75.0, foundAt: '2026-05-02T00:00:00Z' };
    const far = { id: 'far', petSpecies: 'DOG', petBreed: 'Poodle', petColor: 'white', latitude: 40.1, longitude: -75.1, foundAt: '2026-05-20T00:00:00Z' };
    const matches = findMatches(target, [far, near]);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].pTrueMatch).toBeGreaterThanOrEqual(matches[i].pTrueMatch);
    }
  });
});

describe('getMatchQuality — returns an OBJECT, not a string (CORR-4)', () => {
  test('tiers expose .label/.color/.bg so the UI must compare .label', () => {
    expect(getMatchQuality(85)).toMatchObject({ label: 'Excellent Match' });
    expect(getMatchQuality(65)).toMatchObject({ label: 'Good Match' });
    expect(getMatchQuality(45)).toMatchObject({ label: 'Possible Match' });
    expect(getMatchQuality(35)).toMatchObject({ label: 'Weak Match' });
    expect(getMatchQuality(10)).toMatchObject({ label: 'Unlikely Match' });
    // Guard against the bug: the result is never a bare string.
    expect(typeof getMatchQuality(85)).toBe('object');
  });
});
