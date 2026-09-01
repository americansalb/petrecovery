/**
 * The Canadian path of the /rasuwa letter wizard: postal-code
 * normalization, Represent-API parsing (fixtured to the documented
 * shape; the proxy in api/rasuwa/mp stays thin), and the MP letter
 * builders. The live endpoint gets one real postal-code check after
 * deploy; a shape drift degrades to the enter-my-MP-by-hand path, never
 * a dead end.
 */

const { normalizePostalCode, parseMpResponse } = require('@/app/rasuwa/mpLookup');
const {
  buildLetterBody,
  buildPhoneScript,
  buildSubject,
  recipientAddressLines,
  recipientLastName,
  recipientTitle,
} = require('@/app/rasuwa/letterData');

const MP = {
  chamber: 'mp',
  bioguide: 'mp',
  name: 'Anita Vandenbeld',
  riding: 'Ottawa West--Nepean',
  email: 'anita.vandenbeld@parl.gc.ca',
  offices: [],
};

const writer = {
  name: 'Test Writer', relationship: 'sister', phone: '613-555-0000',
  email: 'writer@example.org', inUS: false,
  street: '', city: '', state: '', zip: '', country: 'Canada',
};

const person = {
  pick: '', name: 'Test Missing', country: 'Canada', home: 'Ottawa, Ontario',
  lastSeenPlace: 'Hotel Kailash, Timure', lastSeenWhen: 'August 26', operator: 'Trek group', details: '',
};

describe('normalizePostalCode', () => {
  test('accepts the real formats people type', () => {
    expect(normalizePostalCode('K1A 0A6')).toBe('K1A0A6');
    expect(normalizePostalCode('k1a0a6')).toBe('K1A0A6');
    expect(normalizePostalCode(' k1a-0a6 ')).toBe('K1A0A6');
  });

  test('rejects everything that is not a Canadian postal code', () => {
    for (const bad of ['60103', 'K1A 0A', 'K1A 0A66', '1K1A0A', '', null, undefined]) {
      expect(normalizePostalCode(bad)).toBeNull();
    }
  });

  test('rejects letters Canada Post never uses', () => {
    for (const bad of ['D1A 1A1', 'F1A 1A1', 'W1A 1A1', 'Z1A 1A1', 'K1U 0A6', 'K1A 0O6']) {
      expect(normalizePostalCode(bad)).toBeNull();
    }
    // W and Z are fine after the first position; X leads in the north.
    expect(normalizePostalCode('V6W 1A1')).toBe('V6W1A1');
    expect(normalizePostalCode('X0A 0H0')).toBe('X0A0H0');
    expect(normalizePostalCode('T6Z 1A1')).toBe('T6Z1A1');
  });
});

describe('parseMpResponse', () => {
  const representFixture = {
    representatives_centroid: [
      {
        name: 'Anita Vandenbeld',
        elected_office: 'MP',
        party_name: 'Liberal',
        district_name: 'Ottawa West--Nepean',
        email: 'anita.vandenbeld@parl.gc.ca',
        url: 'https://www.ourcommons.ca/members/en/anita-vandenbeld(89323)',
        offices: [
          { type: 'constituency', tel: '1 613 990-7720' },
          { type: 'legislature', tel: '1 613 992-6062' },
          { type: 'no-phone' },
        ],
      },
      { name: 'Some Councillor', elected_office: 'Councillor', district_name: 'Ward 1' },
    ],
  };

  test('finds the MP and keeps only phoned offices', () => {
    const mp = parseMpResponse(representFixture);
    expect(mp.name).toBe('Anita Vandenbeld');
    expect(mp.riding).toBe('Ottawa West--Nepean');
    expect(mp.email).toContain('@parl.gc.ca');
    expect(mp.offices).toHaveLength(2);
  });

  test('falls back to the concordance pool and rejects junk', () => {
    expect(parseMpResponse({ representatives_concordance: representFixture.representatives_centroid }).name)
      .toBe('Anita Vandenbeld');
    expect(parseMpResponse({ representatives_centroid: [{ elected_office: 'MP' }] })).toBeNull(); // no name
    expect(parseMpResponse({ representatives_centroid: [{ name: 'X', elected_office: 'MLA' }] })).toBeNull();
    expect(parseMpResponse({})).toBeNull();
    expect(parseMpResponse(null)).toBeNull();
    expect(parseMpResponse('html')).toBeNull();
  });
});

describe('the MP letter', () => {
  test('subject and address name the riding and the House of Commons', () => {
    expect(buildSubject({ writer, person, recipient: MP })).toContain('Constituent in Ottawa West--Nepean');
    expect(recipientAddressLines(MP)).toEqual([
      'Anita Vandenbeld, M.P.',
      'Member of Parliament for Ottawa West--Nepean',
      'House of Commons',
      'Ottawa, Ontario K1A 0A6',
    ]);
    expect(recipientTitle(MP)).toBe('MP');
    expect(recipientLastName(MP)).toBe('Vandenbeld');
  });

  test('a Canadian citizen letter routes the asks through Global Affairs', () => {
    const body = buildLetterBody({ recipient: MP, writer, person });
    expect(body).toContain('I am your constituent in Ottawa West--Nepean');
    expect(body).toContain('one of the Canadians unaccounted for');
    // "Test Missing" is hand-typed, not a list entry: no membership claim.
    expect(body).not.toContain("on the families' list");
    expect(body).toContain("Global Affairs Canada's Emergency Watch and Response Centre");
    expect(body).toContain('open a case file for Test Missing');
    expect(body).toContain(person.lastSeenPlace);
    expect(body).not.toContain('undefined');
    expect(body).not.toContain('State Department');
    expect(body).toContain('rescueourfamily.org/letter');
  });

  test('a non-Canadian national letter asks for coordination with their government', () => {
    const body = buildLetterBody({ recipient: MP, writer, person: { ...person, country: 'Nepal' } });
    expect(body).toContain('a national of Nepal');
    expect(body).toContain('coordinate with the government of Nepal');
  });

  test('an MP not yet named stays a visible bracket, never undefined', () => {
    const blankMp = { chamber: 'mp', bioguide: 'mp', name: '', riding: '', email: '', offices: [] };
    const body = buildLetterBody({ recipient: blankMp, writer, person });
    expect(body).toContain("[your MP's name]");
    expect(body).toContain('[your riding]');
    expect(body).not.toContain('undefined');
    expect(buildSubject({ writer, person, recipient: blankMp })).toContain('[your riding]');
  });

  test('the phone script speaks to the constituency office', () => {
    const script = buildPhoneScript({ recipient: MP, writer, person });
    expect(script).toContain('constituent in Ottawa West--Nepean');
    expect(script).toContain('Global Affairs Canada');
    expect(script).not.toContain('privacy release');
  });

  test('no em dashes in the Canadian text (house copy rule)', () => {
    const all = buildLetterBody({ recipient: MP, writer, person }) + buildPhoneScript({ recipient: MP, writer, person });
    expect(all).not.toMatch(/—|–/);
  });
});
