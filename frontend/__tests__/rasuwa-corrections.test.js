/**
 * Public correction requests (corrections.js): what gets stored from
 * an anonymous "please review this" note, and nothing else.
 */

const { CORRECTION_ACTIONS, CORRECTION_CAPS, cleanCorrection } = require('@/app/rasuwa/corrections');

describe('cleanCorrection', () => {
  test('keeps a real request, folds whitespace, preserves message lines', () => {
    const c = cleanCorrection({
      personName: '  Poonam   Thakkar ',
      message: 'Wrong hotel.\r\nIt is Hotel Kailash.',
      contact: ' 555-0100 ',
    });
    expect(c).toEqual({
      personName: 'Poonam Thakkar',
      message: 'Wrong hotel.\nIt is Hotel Kailash.',
      contact: '555-0100',
    });
  });

  test('the message is required; person and contact are not', () => {
    expect(cleanCorrection({ message: 'The operator is wrong.' })).toEqual({
      personName: '',
      message: 'The operator is wrong.',
      contact: '',
    });
    expect(cleanCorrection({ personName: 'X', message: '   ' })).toBeNull();
    expect(cleanCorrection({})).toBeNull();
    expect(cleanCorrection()).toBeNull();
  });

  test('clips instead of rejecting length', () => {
    const c = cleanCorrection({
      personName: 'P'.repeat(999),
      message: 'M'.repeat(99999),
      contact: 'C'.repeat(999),
    });
    expect(c.personName).toHaveLength(CORRECTION_CAPS.personName);
    expect(c.message).toHaveLength(CORRECTION_CAPS.message);
    expect(c.contact).toHaveLength(CORRECTION_CAPS.contact);
  });

  test('the board knows exactly two transitions', () => {
    expect(CORRECTION_ACTIONS).toEqual(['done', 'reopen']);
  });
});
