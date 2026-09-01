/**
 * /rasuwa live signer count (rosterCount.js): the parsing that guards
 * the landing pages from a misconfigured source, the sentence they
 * show, and the rule that the letter's own printed total is the floor
 * everywhere while the pages upgrade to the growing roster.
 */

const { parseRosterCount, signerCountSentence } = require('@/app/rasuwa/rosterCount');
const { LETTER_SIGNERS, buildLetterBody } = require('@/app/rasuwa/letterData');
const directory = require('@/app/rasuwa/congress-directory.json');
const missingPeople = require('@/app/rasuwa/missing-people.json');

describe('parseRosterCount', () => {
  test('accepts a bare number and JSON count, number or numeric string', () => {
    expect(parseRosterCount('3345')).toBe(3345);
    expect(parseRosterCount(' {"count": 3345} ')).toBe(3345);
    expect(parseRosterCount('{"count": "3345"}')).toBe(3345);
    expect(parseRosterCount(String(LETTER_SIGNERS))).toBe(LETTER_SIGNERS);
  });

  test('rejects what a misconfigured source answers', () => {
    expect(parseRosterCount('<html><body>the form</body></html>')).toBeNull(); // Apps Script without the handler
    expect(parseRosterCount('{"count": 12}')).toBeNull(); // below the letter's own total
    expect(parseRosterCount('{"count": 1189}')).toBeNull(); // an older printing's figure
    expect(parseRosterCount('{"count": 999999999}')).toBeNull(); // absurd
    expect(parseRosterCount('{"rows": 3345}')).toBeNull();
    expect(parseRosterCount('12.5')).toBeNull();
    expect(parseRosterCount('-3345')).toBeNull();
    expect(parseRosterCount('')).toBeNull();
    expect(parseRosterCount(null)).toBeNull();
  });
});

describe('signerCountSentence', () => {
  test('the floor reads as a floor, a live count reads as the count', () => {
    expect(signerCountSentence({ count: null, live: false })).toBe(
      "More than 3,160 family members and friends of the people missing in the Rasuwa flood have signed the families' letter to the U.S. Secretary of State."
    );
    expect(signerCountSentence({ count: 3345, live: true })).toBe(
      "3,345 family members and friends of the people missing in the Rasuwa flood have signed the families' letter to the U.S. Secretary of State."
    );
  });
});

describe('the letters cite the living letter', () => {
  test('generated letters carry the letter\'s current totals as a floor', () => {
    const writer = {
      name: 'Test Writer', relationship: 'sister', phone: '555-000-0000',
      email: '', inUS: true, street: '1 Main St', city: 'Bartlett', state: 'IL', zip: '60103',
    };
    const senator = directory.members.find((m) => m.chamber === 'sen' && m.state === 'IL');
    const body = buildLetterBody({ recipient: senator, writer, person: missingPeople.people[0] });
    expect(body).toContain('More than 3,160 family members and friends of 81 missing people');
  });
});
