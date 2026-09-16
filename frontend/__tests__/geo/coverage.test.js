/**
 * The curated coverage list: every country Apple has driven has a plain
 * name, so the lobby can say where the game plays.
 */

const { APPLE_COVERAGE, APPLE_COVERAGE_NAMES, appleCoverageSentence, hasAppleCoverage } = require('@/app/lib/geo/coverage');

describe('coverage lists', () => {
  test('every Apple country has a name and the sentence reads as one', () => {
    for (const cc of APPLE_COVERAGE) expect(APPLE_COVERAGE_NAMES[cc]).toBeTruthy();
    expect(Object.keys(APPLE_COVERAGE_NAMES).sort()).toEqual([...APPLE_COVERAGE].sort());
    const sentence = appleCoverageSentence();
    expect(sentence.startsWith('the United States, Canada, the UK')).toBe(true);
    expect(sentence.endsWith(' and Israel')).toBe(true);
    expect(sentence.split(', ')).toHaveLength(APPLE_COVERAGE.size - 1);
  });

  test('membership is by ISO code, case-insensitive', () => {
    expect(hasAppleCoverage('us')).toBe(true);
    expect(hasAppleCoverage('BR')).toBe(false);
    expect(hasAppleCoverage('Gb')).toBe(true);
  });
});
