/**
 * /rasuwa live signer count (rosterCount.js): the parsing that guards
 * the landing pages from a misconfigured source, the sentence they
 * show, and the rule that the generated letters keep citing the letter
 * as sent on August 29 while the pages show the growing roster.
 */

const { parseRosterCount, signerCountSentence } = require('@/app/rasuwa/rosterCount');
const { SIGNERS_AUG29, buildLetterBody } = require('@/app/rasuwa/letterData');
const directory = require('@/app/rasuwa/congress-directory.json');
const missingPeople = require('@/app/rasuwa/missing-people.json');

describe('parseRosterCount', () => {
  test('accepts a bare number and JSON count, number or numeric string', () => {
    expect(parseRosterCount('2345')).toBe(2345);
    expect(parseRosterCount(' {"count": 2345} ')).toBe(2345);
    expect(parseRosterCount('{"count": "2345"}')).toBe(2345);
    expect(parseRosterCount(String(SIGNERS_AUG29))).toBe(SIGNERS_AUG29);
  });

  test('rejects what a misconfigured source answers', () => {
    expect(parseRosterCount('<html><body>the form</body></html>')).toBeNull(); // Apps Script without the handler
    expect(parseRosterCount('{"count": 12}')).toBeNull(); // below the letter as sent
    expect(parseRosterCount('{"count": 999999999}')).toBeNull(); // absurd
    expect(parseRosterCount('{"rows": 2345}')).toBeNull();
    expect(parseRosterCount('12.5')).toBeNull();
    expect(parseRosterCount('-2345')).toBeNull();
    expect(parseRosterCount('')).toBeNull();
    expect(parseRosterCount(null)).toBeNull();
  });
});

describe('signerCountSentence', () => {
  test('the floor reads as a floor, a live count reads as the count', () => {
    expect(signerCountSentence({ count: null, live: false })).toBe(
      "More than 1,189 family members and friends have signed the families' letter so far."
    );
    expect(signerCountSentence({ count: 2345, live: true })).toBe(
      "2,345 family members and friends have signed the families' letter so far."
    );
  });
});

describe('the letters still cite the letter as sent', () => {
  test('generated letters carry the August 29 figure, not a live number', () => {
    const writer = {
      name: 'Test Writer', relationship: 'sister', phone: '555-000-0000',
      email: '', inUS: true, street: '1 Main St', city: 'Bartlett', state: 'IL', zip: '60103',
    };
    const senator = directory.members.find((m) => m.chamber === 'sen' && m.state === 'IL');
    const body = buildLetterBody({ recipient: senator, writer, person: missingPeople.people[0] });
    expect(body).toContain('On August 29, 1,189 family members and friends of 57 missing people');
  });
});
