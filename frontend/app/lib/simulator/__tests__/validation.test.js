/**
 * Validation Test Suite for Lost Pet Simulator
 *
 * These tests verify that simulation outputs match peer-reviewed research benchmarks.
 * Tests use seeded random for reproducibility.
 *
 * Run with: npm test -- --testPathPattern=validation
 */

import {
  runValidationSuite,
  runDisplacementValidation,
  runRecoveryValidation,
  runTimelineValidation,
  runMicrochipValidation,
  createSeededRandom,
  formatValidationReport
} from '../validation.js';

import {
  validateDistribution,
  sampleDisplacement,
  getLogNormalParams,
  getProbabilityZones
} from '../displacement.js';

import {
  determineRecoveryMode,
  generateRecoveryOutcome,
  RecoveryMode
} from '../recovery.js';

import {
  processShelterIntake,
  processMicrochip
} from '../shelter.js';

import {
  CAT_DISPLACEMENT,
  DOG_DISPLACEMENT,
  RECOVERY_RATES,
  MICROCHIP
} from '../researchConfig.js';

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const SEED = 42;
const SAMPLE_SIZE = 1000;
const TOLERANCE = 0.20;

// Create seeded random for all tests
let random;

beforeEach(() => {
  random = createSeededRandom(SEED);
});

// =============================================================================
// DISPLACEMENT TESTS
// =============================================================================

describe('Displacement Distribution', () => {
  describe('Indoor-only cats (Huang 2018)', () => {
    test('median should be approximately 39m', () => {
      const result = validateDistribution('cat', 'indoorOnly', SAMPLE_SIZE, random, TOLERANCE);
      expect(result.passed).toBe(true);

      const medianTest = result.tests.find(t => t.name.includes('median'));
      expect(medianTest.actual).toBeGreaterThan(39 * 0.8);
      expect(medianTest.actual).toBeLessThan(39 * 1.2);
    });

    test('log-normal parameters should produce correct distribution shape', () => {
      const params = getLogNormalParams('cat', 'indoorOnly');
      expect(params.median).toBe(39);
      expect(params.q75).toBe(137);
      expect(params.status).toBe('VERIFIED');
    });
  });

  describe('Indoor-outdoor cats (Huang 2018)', () => {
    test('median should be approximately 300m', () => {
      const result = validateDistribution('cat', 'indoorOutdoor', SAMPLE_SIZE, random, TOLERANCE);
      expect(result.passed).toBe(true);

      const medianTest = result.tests.find(t => t.name.includes('median'));
      expect(medianTest.actual).toBeGreaterThan(300 * 0.8);
      expect(medianTest.actual).toBeLessThan(300 * 1.2);
    });

    test('indoor-outdoor median should be ~8x indoor-only', () => {
      const indoorParams = getLogNormalParams('cat', 'indoorOnly');
      const outdoorParams = getLogNormalParams('cat', 'indoorOutdoor');

      const ratio = outdoorParams.median / indoorParams.median;
      expect(ratio).toBeCloseTo(300 / 39, 1);
    });
  });

  describe('Dogs (Kremer 2021)', () => {
    test('42% should be found within 400ft (122m)', () => {
      const result = validateDistribution('dog', null, SAMPLE_SIZE, random, TOLERANCE);

      const p42Test = result.tests.find(t => t.name.includes('42%'));
      expect(p42Test.passed).toBe(true);
      expect(p42Test.actual).toBeGreaterThan(0.42 - TOLERANCE);
      expect(p42Test.actual).toBeLessThan(0.42 + TOLERANCE);
    });

    test('70% should be found within 1 mile (1609m)', () => {
      const result = validateDistribution('dog', null, SAMPLE_SIZE, random, TOLERANCE);

      const p70Test = result.tests.find(t => t.name.includes('70%'));
      expect(p70Test.passed).toBe(true);
      expect(p70Test.actual).toBeGreaterThan(0.70 - TOLERANCE);
      expect(p70Test.actual).toBeLessThan(0.70 + TOLERANCE);
    });

    test('dog parameters should be flagged as DERIVED', () => {
      expect(DOG_DISPLACEMENT.status).toBe('DERIVED');
      expect(DOG_DISPLACEMENT.derivation).toBeDefined();
    });
  });

  describe('Probability Zones', () => {
    test('should generate correct zone radii for cats', () => {
      const zones = getProbabilityZones('cat', 'indoorOnly');

      expect(zones.p50).toBeCloseTo(39, 0); // Median
      expect(zones.p75).toBeCloseTo(137, 0); // 75th percentile
      expect(zones.p25).toBeLessThan(zones.p50);
      expect(zones.p90).toBeGreaterThan(zones.p75);
    });
  });
});

// =============================================================================
// RECOVERY RATE TESTS
// =============================================================================

describe('Recovery Rates (Weiss 2012)', () => {
  describe('Overall Recovery', () => {
    test('dog overall recovery should be approximately 93%', () => {
      let recovered = 0;
      for (let i = 0; i < SAMPLE_SIZE; i++) {
        const outcome = determineRecoveryMode('dog', random);
        if (outcome.recovered) recovered++;
      }

      const rate = recovered / SAMPLE_SIZE;
      expect(rate).toBeGreaterThan(0.93 - TOLERANCE);
      expect(rate).toBeLessThan(0.93 + TOLERANCE);
    });

    test('cat overall recovery should be approximately 75%', () => {
      let recovered = 0;
      for (let i = 0; i < SAMPLE_SIZE; i++) {
        const outcome = determineRecoveryMode('cat', random);
        if (outcome.recovered) recovered++;
      }

      const rate = recovered / SAMPLE_SIZE;
      expect(rate).toBeGreaterThan(0.75 - TOLERANCE);
      expect(rate).toBeLessThan(0.75 + TOLERANCE);
    });
  });

  describe('Cat Recovery Modes', () => {
    test('cat self-return should be approximately 59% of recoveries', () => {
      let selfReturn = 0;
      let totalRecovered = 0;

      for (let i = 0; i < SAMPLE_SIZE; i++) {
        const outcome = determineRecoveryMode('cat', random);
        if (outcome.recovered) {
          totalRecovered++;
          if (outcome.mode === RecoveryMode.CAT_SELF_RETURN) {
            selfReturn++;
          }
        }
      }

      const rate = selfReturn / totalRecovered;
      expect(rate).toBeGreaterThan(0.59 - TOLERANCE);
      expect(rate).toBeLessThan(0.59 + TOLERANCE);
    });

    test('cat shelter intake should be approximately 2% of recoveries', () => {
      let shelter = 0;
      let totalRecovered = 0;

      for (let i = 0; i < SAMPLE_SIZE; i++) {
        const outcome = determineRecoveryMode('cat', random);
        if (outcome.recovered) {
          totalRecovered++;
          if (outcome.mode === RecoveryMode.CAT_SHELTER) {
            shelter++;
          }
        }
      }

      const rate = shelter / totalRecovered;
      // Looser tolerance for low-probability events
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThan(0.10); // Upper CI bound
    });
  });

  describe('Dog Recovery Modes', () => {
    test('dog active search should be approximately 49% of recoveries', () => {
      let activeSearch = 0;
      let totalRecovered = 0;

      for (let i = 0; i < SAMPLE_SIZE; i++) {
        const outcome = determineRecoveryMode('dog', random);
        if (outcome.recovered) {
          totalRecovered++;
          if (outcome.mode === RecoveryMode.DOG_ACTIVE_SEARCH) {
            activeSearch++;
          }
        }
      }

      const rate = activeSearch / totalRecovered;
      expect(rate).toBeGreaterThan(0.49 - TOLERANCE);
      expect(rate).toBeLessThan(0.49 + TOLERANCE);
    });

    test('dog shelter intake should be approximately 6% of recoveries', () => {
      let shelter = 0;
      let totalRecovered = 0;

      for (let i = 0; i < SAMPLE_SIZE; i++) {
        const outcome = determineRecoveryMode('dog', random);
        if (outcome.recovered) {
          totalRecovered++;
          if (outcome.mode === RecoveryMode.DOG_SHELTER) {
            shelter++;
          }
        }
      }

      const rate = shelter / totalRecovered;
      // Within CI bounds (2-12%)
      expect(rate).toBeGreaterThan(0.02);
      expect(rate).toBeLessThan(0.12);
    });
  });
});

// =============================================================================
// TIMELINE TESTS
// =============================================================================

describe('Recovery Timeline (Huang 2018)', () => {
  test('approximately 34% of cats should be recovered by day 7', () => {
    const result = runTimelineValidation(random, SAMPLE_SIZE, TOLERANCE);
    const day7Test = result.tests.find(t => t.name.includes('day 7'));

    expect(day7Test.passed).toBe(true);
    expect(day7Test.actual).toBeGreaterThan(0.34 - TOLERANCE);
    expect(day7Test.actual).toBeLessThan(0.34 + TOLERANCE);
  });

  test('approximately 50% of cats should be recovered by day 30', () => {
    const result = runTimelineValidation(random, SAMPLE_SIZE, TOLERANCE);
    const day30Test = result.tests.find(t => t.name.includes('day 30'));

    expect(day30Test.passed).toBe(true);
    expect(day30Test.actual).toBeGreaterThan(0.50 - TOLERANCE);
    expect(day30Test.actual).toBeLessThan(0.50 + TOLERANCE);
  });
});

// =============================================================================
// MICROCHIP TESTS
// =============================================================================

describe('Microchip Parameters (Lord 2009)', () => {
  test('microchip registration rate should be approximately 58.1%', () => {
    const result = runMicrochipValidation(random, SAMPLE_SIZE, TOLERANCE);
    const regTest = result.tests.find(t => t.name.includes('registration'));

    expect(regTest.passed).toBe(true);
    expect(regTest.actual).toBeGreaterThan(0.581 - TOLERANCE);
    expect(regTest.actual).toBeLessThan(0.581 + TOLERANCE);
  });

  test('dog shelter RTO should be approximately 52.2% (among registered)', () => {
    const result = runMicrochipValidation(random, SAMPLE_SIZE, TOLERANCE);
    const dogRTOTest = result.tests.find(t => t.name.includes('dog shelter RTO'));

    expect(dogRTOTest.passed).toBe(true);
    expect(dogRTOTest.actual).toBeGreaterThan(0.522 - TOLERANCE);
    expect(dogRTOTest.actual).toBeLessThan(0.522 + TOLERANCE);
  });

  test('cat shelter RTO should be approximately 38.5% (among registered)', () => {
    const result = runMicrochipValidation(random, SAMPLE_SIZE, TOLERANCE);
    const catRTOTest = result.tests.find(t => t.name.includes('cat shelter RTO'));

    expect(catRTOTest.passed).toBe(true);
    expect(catRTOTest.actual).toBeGreaterThan(0.385 - TOLERANCE);
    expect(catRTOTest.actual).toBeLessThan(0.385 + TOLERANCE);
  });

  describe('Shelter Intake Processing', () => {
    test('unregistered chip should not lead to RTO', () => {
      // Force unregistered by using a random that always returns > 0.581
      const alwaysHigh = () => 0.99;
      const pet = { species: 'dog', microchipped: true, hasCollar: false };
      const result = processMicrochip(pet, alwaysHigh);

      expect(result.registered).toBe(false);
      expect(result.identified).toBe(false);
    });

    test('registered chip should have species-appropriate RTO rate', () => {
      // Force registered by using a random that always returns < 0.581
      const alwaysLow = () => 0.1;
      const pet = { species: 'dog', microchipped: true, hasCollar: false };
      const result = processMicrochip(pet, alwaysLow);

      expect(result.registered).toBe(true);
      expect(result.rtoRate).toBe(MICROCHIP.shelterRTO.dog);
    });
  });
});

// =============================================================================
// FULL SUITE TESTS
// =============================================================================

describe('Full Validation Suite', () => {
  test('should run all validation categories', () => {
    const results = runValidationSuite(random, {
      sampleSize: 500,
      tolerance: 0.25
    });

    expect(results.categories.displacement).toBeDefined();
    expect(results.categories.recovery).toBeDefined();
    expect(results.categories.timeline).toBeDefined();
    expect(results.categories.microchip).toBeDefined();
  });

  test('should count total and passed tests correctly', () => {
    const results = runValidationSuite(random, {
      sampleSize: 500,
      tolerance: 0.25
    });

    expect(results.totalTests).toBeGreaterThan(0);
    expect(results.passedTests).toBeLessThanOrEqual(results.totalTests);
  });

  test('should generate formatted report', () => {
    const results = runValidationSuite(random, {
      sampleSize: 500,
      tolerance: 0.25
    });

    const report = formatValidationReport(results);

    expect(report).toContain('VALIDATION REPORT');
    expect(report).toContain('Displacement');
    expect(report).toContain('Recovery');
    expect(report).toContain('OVERALL');
  });
});

// =============================================================================
// SEEDED RANDOM TESTS
// =============================================================================

describe('Seeded Random Generator', () => {
  test('should produce reproducible results', () => {
    const random1 = createSeededRandom(12345);
    const random2 = createSeededRandom(12345);

    const values1 = [random1(), random1(), random1()];
    const values2 = [random2(), random2(), random2()];

    expect(values1).toEqual(values2);
  });

  test('different seeds should produce different results', () => {
    const random1 = createSeededRandom(12345);
    const random2 = createSeededRandom(54321);

    expect(random1()).not.toBe(random2());
  });

  test('values should be in [0, 1) range', () => {
    const random = createSeededRandom(42);

    for (let i = 0; i < 100; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

// =============================================================================
// RESEARCH CONFIG VERIFICATION
// =============================================================================

describe('Research Configuration', () => {
  test('all verified parameters should have citations', () => {
    expect(CAT_DISPLACEMENT.indoorOnly.citation).toBe('HUANG_2018');
    expect(CAT_DISPLACEMENT.indoorOutdoor.citation).toBe('HUANG_2018');
    expect(DOG_DISPLACEMENT.citation).toBe('KREMER_2021');
    expect(RECOVERY_RATES.dog.citation).toBe('WEISS_2012');
    expect(RECOVERY_RATES.cat.citation).toBe('WEISS_2012');
    expect(MICROCHIP.citation).toBe('LORD_2009');
  });

  test('all parameters should have status field', () => {
    expect(CAT_DISPLACEMENT.indoorOnly.status).toBe('VERIFIED');
    expect(CAT_DISPLACEMENT.indoorOutdoor.status).toBe('VERIFIED');
    expect(DOG_DISPLACEMENT.status).toBe('DERIVED');
    expect(MICROCHIP.status).toBe('VERIFIED');
  });
});
