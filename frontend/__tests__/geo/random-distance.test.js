/**
 * The geo game's randomness and scoring.
 *
 * "Truly random" is a claim we can test: a seeded generator must replay
 * exactly, points on the sphere must not pile up at the poles, and the
 * score curve must be the one players expect (5,000 for a perfect guess,
 * decaying with distance at a rate set by the size of the area).
 */

const {
  hashSeed,
  mulberry32,
  createRng,
  roundSeed,
  randomPointOnSphere,
  randomPointInBox,
  randomPointInDisk,
  weightedIndex,
} = require('@/app/lib/geo/random');
const {
  haversineKm,
  initialBearing,
  scoreForDistance,
  sizeForBox,
  formatDistance,
  WORLD_SIZE_KM,
  MAX_ROUND_SCORE,
} = require('@/app/lib/geo/distance');

describe('seeded randomness', () => {
  test('hashSeed is stable and distinguishes seeds', () => {
    expect(hashSeed('daily-2026-09-07')).toBe(hashSeed('daily-2026-09-07'));
    expect(hashSeed('daily-2026-09-07')).not.toBe(hashSeed('daily-2026-09-08'));
  });

  test('the same seed replays the same sequence', () => {
    const a = createRng('challenge-abc');
    const b = createRng('challenge-abc');
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
    expect(new Set(seqA).size).toBeGreaterThan(15);
  });

  test('different rounds of one game get different seeds', () => {
    expect(roundSeed('x', 0)).not.toBe(roundSeed('x', 1));
    const s0 = Array.from({ length: 5 }, createRng(roundSeed('x', 0)));
    const s1 = Array.from({ length: 5 }, createRng(roundSeed('x', 1)));
    expect(s0).not.toEqual(s1);
  });

  test('unseeded generators differ from each other', () => {
    const a = createRng();
    const b = createRng();
    expect(Array.from({ length: 5 }, a)).not.toEqual(Array.from({ length: 5 }, b));
  });

  test('mulberry32 stays within [0, 1)', () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 10000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('points on the sphere', () => {
  test('are area-uniform: half of them lie within 30 degrees of the equator', () => {
    const rng = createRng('sphere');
    let nearEquator = 0;
    let latSum = 0;
    const n = 40000;
    for (let i = 0; i < n; i++) {
      const p = randomPointOnSphere(rng);
      expect(p.lat).toBeGreaterThanOrEqual(-90);
      expect(p.lat).toBeLessThanOrEqual(90);
      expect(p.lng).toBeGreaterThanOrEqual(-180);
      expect(p.lng).toBeLessThan(180);
      if (Math.abs(p.lat) < 30) nearEquator++;
      latSum += p.lat;
    }
    // sin(30 deg) = 0.5, so exactly half the sphere's area is within 30 degrees
    expect(nearEquator / n).toBeGreaterThan(0.48);
    expect(nearEquator / n).toBeLessThan(0.52);
    expect(Math.abs(latSum / n)).toBeLessThan(1);
  });

  test('box samples stay inside the box', () => {
    const rng = createRng('box');
    const box = { minLat: 35, maxLat: 45, minLng: -10, maxLng: 5 };
    for (let i = 0; i < 2000; i++) {
      const p = randomPointInBox(rng, box);
      expect(p.lat).toBeGreaterThanOrEqual(35);
      expect(p.lat).toBeLessThanOrEqual(45);
      expect(p.lng).toBeGreaterThanOrEqual(-10);
      expect(p.lng).toBeLessThanOrEqual(5);
    }
  });

  test('disk samples stay within the radius', () => {
    const rng = createRng('disk');
    const center = { lat: 51.5074, lng: -0.1278 };
    for (let i = 0; i < 2000; i++) {
      const p = randomPointInDisk(rng, center, 12);
      expect(haversineKm(center, p)).toBeLessThanOrEqual(12.2);
    }
  });

  test('weightedIndex never picks a zero-weight entry', () => {
    const rng = createRng('weights');
    for (let i = 0; i < 500; i++) {
      const idx = weightedIndex(rng, [0, 3, 0, 1]);
      expect([1, 3]).toContain(idx);
    }
  });
});

describe('distance and score', () => {
  const newYork = { lat: 40.7128, lng: -74.006 };
  const london = { lat: 51.5074, lng: -0.1278 };

  test('haversine: New York to London is about 5,570 km', () => {
    const d = haversineKm(newYork, london);
    expect(d).toBeGreaterThan(5540);
    expect(d).toBeLessThan(5600);
    expect(haversineKm(newYork, newYork)).toBe(0);
  });

  test('bearing from New York to London points north-east', () => {
    const b = initialBearing(newYork, london);
    expect(b).toBeGreaterThan(45);
    expect(b).toBeLessThan(60);
  });

  test('a perfect guess scores 5,000 and a miss on the far side of the world scores 0', () => {
    expect(scoreForDistance(0)).toBe(MAX_ROUND_SCORE);
    expect(scoreForDistance(0.02)).toBe(MAX_ROUND_SCORE);
    expect(scoreForDistance(20000)).toBe(0);
    expect(scoreForDistance(NaN)).toBe(0);
    expect(scoreForDistance(-5)).toBe(0);
  });

  test('the world curve: 1,000 km off is worth about half', () => {
    const s = scoreForDistance(1000, WORLD_SIZE_KM);
    expect(s).toBeGreaterThan(2540);
    expect(s).toBeLessThan(2570);
    expect(scoreForDistance(100)).toBeGreaterThan(scoreForDistance(200));
  });

  test('a small area punishes the same miss harder', () => {
    expect(scoreForDistance(200, 500)).toBeLessThan(scoreForDistance(200, WORLD_SIZE_KM));
  });

  test('sizeForBox floors at 100 km and caps at the world', () => {
    expect(sizeForBox({ minLat: 0, maxLat: 0.01, minLng: 0, maxLng: 0.01 })).toBe(100);
    expect(sizeForBox({ minLat: -80, maxLat: 80, minLng: -179, maxLng: 179 })).toBe(WORLD_SIZE_KM);
    expect(sizeForBox(null)).toBe(WORLD_SIZE_KM);
  });

  test('formatDistance reads like a person wrote it', () => {
    expect(formatDistance(0.012)).toBe('12 m');
    expect(formatDistance(3.44)).toBe('3.4 km');
    expect(formatDistance(1234.4)).toBe('1,234 km');
  });
});
