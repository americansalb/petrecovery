/**
 * The families' record of generated letters (letterRecord.js): the
 * payload the wizard posts when a pass finishes composing, the caps
 * that keep a record from being abused into bulk storage, and the hash
 * that keeps reloads from recording the same letters twice.
 */

const { LETTER_RECORD_CAPS, buildLetterRecordPayload, hashLetters } = require('@/app/rasuwa/letterRecord');

const letters = [
  { key: 'S1', recipient: { chamber: 'sen', name: 'Richard J. Durbin' }, body: 'Dear Senator Durbin: ...' },
  { key: 'R1', recipient: { chamber: 'rep', name: 'Jonathan L. Jackson' }, body: 'Dear Representative Jackson: ...' },
];

describe('hashLetters', () => {
  test('same letters, same hash; an edit changes it', () => {
    const bodies = letters.map((l) => l.body);
    expect(hashLetters(bodies)).toBe(hashLetters([...bodies]));
    expect(hashLetters(bodies)).not.toBe(hashLetters([bodies[0], `${bodies[1]} edited`]));
    expect(typeof hashLetters([])).toBe('string');
  });
});

describe('buildLetterRecordPayload', () => {
  const person = { name: 'Poonam Thakkar' };

  test('records the person, the recipients, and the bodies with hand edits', () => {
    const payload = buildLetterRecordPayload({
      person, where: 'us', subject: 'Subject line', letters,
      overrides: { R1: 'Hand-edited body.' },
    });
    expect(payload.personName).toBe('Poonam Thakkar');
    expect(payload.where).toBe('us');
    expect(payload.recipients).toContain('Durbin');
    expect(payload.letters).toHaveLength(2);
    expect(payload.letters[1].body).toBe('Hand-edited body.');
  });

  test('caps letters, body length, and field length', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      key: `K${i}`, recipient: { chamber: 'sen', name: 'X'.repeat(999) }, body: 'B'.repeat(99999),
    }));
    const payload = buildLetterRecordPayload({ person: { name: 'N'.repeat(999) }, where: 'somewhere-long', subject: 'S', letters: many, overrides: {} });
    expect(payload.letters).toHaveLength(LETTER_RECORD_CAPS.letters);
    expect(payload.letters[0].body).toHaveLength(LETTER_RECORD_CAPS.bodyChars);
    expect(payload.personName).toHaveLength(LETTER_RECORD_CAPS.fieldChars);
    expect(payload.where).toBe('somewher');
  });

  test('nothing to record is null, and an unnamed intl recipient gets a readable label', () => {
    expect(buildLetterRecordPayload({ person, where: 'us', subject: 'S', letters: [], overrides: {} })).toBeNull();
    const intl = buildLetterRecordPayload({
      person, where: 'intl', subject: 'S',
      letters: [{ key: 'intl', recipient: { chamber: 'intl', name: '' }, body: 'Dear ...' }],
      overrides: {},
    });
    expect(intl.letters[0].recipient).toBe('parliament or consular officer');
  });
});

describe('general letters in the record', () => {
  const letters = [{ recipient: { chamber: 'sen', name: 'Test Senator' }, key: 'X1', body: 'B' }];

  test('a general pass files under the shared name; a blank person still cannot', () => {
    const { GENERAL_RECORD_NAME } = require('@/app/rasuwa/letterData');
    const general = buildLetterRecordPayload({ person: null, where: 'us', subject: 'S', letters, overrides: {} });
    expect(general.personName).toBe(GENERAL_RECORD_NAME);
    const blank = buildLetterRecordPayload({ person: { name: '' }, where: 'us', subject: 'S', letters, overrides: {} });
    expect(blank.personName).toBe('');
  });
});
