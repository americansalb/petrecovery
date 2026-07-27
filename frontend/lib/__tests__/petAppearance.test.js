/**
 * Coat color composition and parsing, including custom labels.
 *
 * The contract that matters: whatever an owner saves, parseColor must
 * give back - custom colors and patterns included. Dropping unknown
 * tokens silently erases pet data on the next edit.
 */

const {
  composeColor,
  parseColor,
  normalizeCoatLabel,
  COAT_COLORS,
} = require('../petAppearance');

describe('composeColor / parseColor round trip', () => {
  test('known swatches round-trip', () => {
    const value = composeColor(['Black', 'White'], 'Tuxedo');
    expect(value).toBe('Black & White · Tuxedo');
    expect(parseColor(value)).toEqual({ colors: ['Black', 'White'], pattern: 'Tuxedo' });
  });

  test('custom colors round-trip instead of being dropped', () => {
    const value = composeColor(['Chocolate', 'White'], null);
    expect(parseColor(value)).toEqual({ colors: ['Chocolate', 'White'], pattern: null });
  });

  test('custom pattern round-trips', () => {
    const value = composeColor(['Black'], 'Ticked');
    expect(parseColor(value)).toEqual({ colors: ['Black'], pattern: 'Ticked' });
  });

  test('known swatch names normalize case to the canonical value', () => {
    expect(parseColor('black & WHITE').colors).toEqual(['Black', 'White']);
  });

  test('legacy free text survives as a custom color', () => {
    expect(parseColor('golden brown').colors).toEqual(['Golden Brown']);
  });

  test('pattern shorthand still matches the known list', () => {
    // composeColor stores "Tabby / striped" as "Tabby"
    expect(parseColor('Orange · Tabby').pattern).toBe('Tabby / striped');
  });
});

describe('normalizeCoatLabel', () => {
  test('accepts plain words and title-cases them', () => {
    expect(normalizeCoatLabel('  blue  ')).toBe('Blue');
    expect(normalizeCoatLabel('blue gray')).toBe('Blue Gray');
    expect(normalizeCoatLabel('blue-gray')).toBe('Blue-gray');
  });

  test('rejects junk', () => {
    expect(normalizeCoatLabel('')).toBeNull();
    expect(normalizeCoatLabel('a')).toBeNull();
    expect(normalizeCoatLabel('x'.repeat(20))).toBeNull();
    expect(normalizeCoatLabel('1blue')).toBeNull();
    expect(normalizeCoatLabel('blue!')).toBeNull();
  });

  test('does not collide with swatch rendering expectations', () => {
    // Every built-in swatch passes its own validation
    for (const { value } of COAT_COLORS) {
      expect(normalizeCoatLabel(value)).toBe(value);
    }
  });
});
