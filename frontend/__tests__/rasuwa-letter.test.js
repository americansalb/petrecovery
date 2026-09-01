/**
 * /rasuwa letter tool: the bundled data and the letter builders.
 *
 * The congress directory is a generated file (scripts/
 * build-congress-directory.js); these tests keep a bad refresh from
 * shipping a short or malformed directory, and keep the letter builders
 * honest about placeholders and house copy rules (no em dashes).
 */

const directory = require('@/app/rasuwa/congress-directory.json');
const missingPeople = require('@/app/rasuwa/missing-people.json');
const {
  FACTS_DATE,
  buildLetterBody,
  findCountryGuide,
  jointLetterSentence,
  nationalsOnList,
  onFamiliesList,
  buildPhoneScript,
  buildRosterShare,
  buildSubject,
  recipientLastName,
} = require('@/app/rasuwa/letterData');

describe('congress directory (generated data)', () => {
  const members = directory.members;
  const sens = members.filter((m) => m.chamber === 'sen');
  const reps = members.filter((m) => m.chamber === 'rep');

  test('holds a full congress', () => {
    expect(sens).toHaveLength(100);
    expect(reps.length).toBeGreaterThanOrEqual(435);
  });

  test('every state seats exactly two senators', () => {
    const perState = {};
    for (const s of sens) perState[s.state] = (perState[s.state] || 0) + 1;
    expect(Object.keys(perState)).toHaveLength(50);
    expect(Object.values(perState).every((n) => n === 2)).toBe(true);
  });

  test('every member has a DC phone and a chamber-correct district', () => {
    for (const m of members) {
      expect(m.phone).toMatch(/^\d{3}-\d{3}-\d{4}$/);
      if (m.chamber === 'sen') expect(m.district).toBeNull();
      else expect(m.district).toBeGreaterThanOrEqual(0);
    }
  });

  test('links are https where present', () => {
    for (const m of members) {
      if (m.url) expect(m.url).toMatch(/^https:\/\//);
      if (m.contactForm) expect(m.contactForm).toMatch(/^https:\/\//);
    }
  });
});

describe('missing people (from the live letter)', () => {
  const people = missingPeople.people;

  test('all 81 entries are present, 43 American', () => {
    expect(people).toHaveLength(81);
    expect(people.filter((p) => p.country === 'United States')).toHaveLength(43);
    expect(people.map((p) => p.num).sort((a, b) => a - b)).toEqual(
      [...Array(81)].map((_, i) => i + 1)
    );
  });

  test('num is a stable link id: published numbers survive regeneration', () => {
    // ?for= links already shared in the group chats carry these
    // numbers; a regeneration must never hand them to someone else
    // (review finding on PR #228). Anchors from the August 29 list:
    const byName = (n) => people.find((p) => p.name === n);
    expect(byName('Poonam Dilipkumar Thakkar').num).toBe(1); // via aka "Poonam Thakkar"
    expect(byName('Akanksha Patel').num).toBe(2);
    expect(byName('Vyshnavy Culan').num).toBe(57);
    // People added after August 29 number from 58 up.
    expect(byName('Acharna Sudesh').num).toBeGreaterThanOrEqual(58);
  });

  test('every entry names the person, a location, and a tour group', () => {
    for (const p of people) {
      expect(p.name.trim()).toBeTruthy();
      expect(p.lastSeenPlace.trim()).toBeTruthy();
      expect(p.operator.trim()).toBeTruthy();
    }
  });
});

describe('letter builders', () => {
  const writer = {
    name: 'Test Writer', relationship: 'sister', phone: '555-000-0000',
    email: 'writer@example.org', inUS: true,
    street: '1 Main St', city: 'Bartlett', state: 'IL', zip: '60103',
  };
  const person = missingPeople.people[0]; // Poonam Thakkar
  const senator = directory.members.find((m) => m.chamber === 'sen' && m.state === 'IL');
  const rep = directory.members.find((m) => m.chamber === 'rep' && m.state === 'IL');

  test('subject names the city, state, and the missing person', () => {
    const subject = buildSubject({ writer, person });
    expect(subject).toContain('Bartlett, IL');
    expect(subject).toContain(person.name);
  });

  test('US letter carries the constituent address, the person, and the asks', () => {
    for (const recipient of [senator, rep]) {
      const body = buildLetterBody({ recipient, writer, person });
      expect(body).toContain('The Honorable');
      expect(body).toContain(recipientLastName(recipient));
      expect(body).toContain('1 Main St');
      expect(body).toContain(person.name);
      expect(body).toContain(person.lastSeenPlace);
      expect(body).toContain('privacy release form');
      expect(body).toContain(FACTS_DATE);
      expect(body).not.toContain('undefined');
      expect(body).not.toContain('[');
    }
  });

  test('every letter points at the live families\' letter on the family domain', () => {
    for (const recipient of [senator, rep, { chamber: 'intl' }]) {
      expect(buildLetterBody({ recipient, writer, person })).toContain('rescueourfamily.org/letter');
    }
  });

  test('salutation matches the chamber', () => {
    expect(buildLetterBody({ recipient: senator, writer, person })).toContain(`Dear Senator ${recipientLastName(senator)}:`);
    expect(buildLetterBody({ recipient: rep, writer, person })).toContain(`Dear Representative ${recipientLastName(rep)}:`);
  });

  test('empty fields become visible bracket placeholders, never undefined', () => {
    const blank = { name: '', country: 'United States', home: '', lastSeenPlace: '', lastSeenWhen: '', operator: '', details: '' };
    const emptyWriter = { name: '', relationship: '', phone: '', email: '', inUS: true, street: '', city: '', state: '', zip: '' };
    const body = buildLetterBody({ recipient: senator, writer: emptyWriter, person: blank });
    expect(body).toContain('[your street address]');
    expect(body).not.toContain('undefined');
  });

  test('international letter works without a US address', () => {
    const intlWriter = { ...writer, inUS: false, country: 'Australia' };
    const intlPerson = missingPeople.people.find((p) => p.country === 'Australia');
    const body = buildLetterBody({ recipient: { chamber: 'intl' }, writer: intlWriter, person: intlPerson });
    expect(body).toContain(intlPerson.name);
    expect(body).toContain('Australia');
    expect(body).not.toContain('undefined');
    expect(body).not.toContain('I am your constituent');
  });

  test('phone script and roster share stay null-safe', () => {
    expect(buildPhoneScript({ recipient: null, writer, person })).toContain(person.name);
    const share = buildRosterShare({ writer, person });
    expect(share.subject).toContain(person.name);
    expect(share.body).toContain('consent');
  });

  test('every letter asks for Nepal\'s consent to be obtained and answered on the record', () => {
    const writer = { name: 'W', relationship: 'cousin', phone: '555', email: '', inUS: true, street: '1 Main St', city: 'Bartlett', state: 'IL', zip: '60103', country: '' };
    const person = { name: 'P', country: 'United States', home: '', lastSeenPlace: '', lastSeenWhen: '', operator: '', details: '' };
    const sen = { chamber: 'sen', bioguide: 'X1', name: 'Test Senator', party: 'I', state: 'IL', phone: '202-555-0000', offices: [] };
    const mp = { chamber: 'mp', bioguide: 'mp', name: 'Test MP', riding: 'Testing', party: '', email: '', url: '', offices: [] };
    for (const recipient of [sen, mp, { chamber: 'intl', bioguide: 'intl', name: '' }]) {
      const body = buildLetterBody({ recipient, writer, person });
      expect(body).toContain('Government of Nepal');
      expect(body).toContain('on the record');
      expect(body).toContain('2015 earthquake');
    }
  });

  test('typed countries find their guide, any case; unknown ones get the generic door', () => {
    expect(findCountryGuide('france').country).toBe('France');
    expect(findCountryGuide('  AUSTRALIA ').country).toBe('Australia');
    expect(findCountryGuide('Germany').country).toBe('Another country');
    expect(findCountryGuide('').country).toBe('Another country');
    expect(findCountryGuide(null).country).toBe('Another country');
  });

  test('every nationality on the families\' list has its own guide with a named ministry', () => {
    const listCountries = [...new Set(missingPeople.people.map((p) => p.country))];
    for (const country of listCountries) {
      const guide = findCountryGuide(country);
      if (country === 'United States' || country === 'Canada') continue; // first-class paths
      expect(guide.country).toBe(country);
      expect(guide.ministry).toBeTruthy();
      expect(guide.findRep.url).toMatch(/^https:\/\//);
      expect(guide.consular.url).toMatch(/^https:\/\//);
    }
    expect(findCountryGuide('nepal').home).toBe(true);
  });

  test('nationalsOnList counts the list, any case, zero for strangers', () => {
    expect(nationalsOnList(' AUSTRALIA ')).toBe(16);
    expect(nationalsOnList('United States')).toBe(43);
    expect(nationalsOnList('Germany')).toBe(0);
    expect(nationalsOnList(null)).toBe(0);
  });

  test('onFamiliesList knows current names, earlier printed names, and strangers', () => {
    expect(onFamiliesList('Poonam Dilipkumar Thakkar')).toBe(true);
    expect(onFamiliesList('  poonam thakkar ')).toBe(true); // aka, folded
    expect(onFamiliesList('Test Person')).toBe(false);
    expect(onFamiliesList('')).toBe(false);
  });

  test('international letters name the writer country\'s ministry and its stake on the list', () => {
    const writer = { name: 'A Writer', relationship: 'brother', phone: '555', email: '', inUS: false, country: 'Australia' };
    const listed = missingPeople.people.find((p) => p.country === 'Australia');
    const onList = buildLetterBody({ recipient: { chamber: 'intl', bioguide: 'intl', name: '' }, writer, person: { ...listed, details: '' } });
    expect(onList).toContain('Ask the Department of Foreign Affairs and Trade what our government has done');
    expect(onList).toContain('the other 15 nationals of Australia on the families\' list');
    // A hand-added person is real but not on the list: no "other",
    // no membership claim, the full count stands (review finding on
    // PR #229).
    const person = { name: 'Test Person', country: 'Australia', home: '', lastSeenPlace: 'Timure', lastSeenWhen: '', operator: '', details: '' };
    const added = buildLetterBody({ recipient: { chamber: 'intl', bioguide: 'intl', name: '' }, writer, person });
    expect(added).toContain('and for the 16 nationals of Australia on the families\' list');
    expect(added).not.toContain('the other 15');
    // A country with nobody on the list falls back and drops the clause.
    const de = buildLetterBody({
      recipient: { chamber: 'intl', bioguide: 'intl', name: '' },
      writer: { ...writer, country: 'Germany' },
      person: { ...person, country: 'Germany' },
    });
    expect(de).toContain('Ask our foreign ministry what our government has done');
    expect(de).not.toContain('on the families\' list');
  });

  test('MP letters claim the list only for people on it', () => {
    const writer = { name: 'A Writer', relationship: 'sister', phone: '555', email: '', inUS: false, country: 'Canada' };
    const mp = { chamber: 'mp', bioguide: 'mp', name: 'Test MP', riding: 'Testing', party: '', email: '', url: '', offices: [] };
    const listed = missingPeople.people.find((p) => p.country === 'Canada');
    const onList = buildLetterBody({ recipient: mp, writer, person: { ...listed, details: '' } });
    expect(onList).toContain('one of the 8 Canadians on the families\' list');
    const added = buildLetterBody({
      recipient: mp,
      writer,
      person: { name: 'Test Person', country: 'Canada', home: '', lastSeenPlace: 'Timure', lastSeenWhen: '', operator: '', details: '' },
    });
    expect(added).toContain('one of the Canadians unaccounted for');
    expect(added).not.toContain('on the families\' list');
  });

  test('a writer in Nepal asks their own government to accept the offers', () => {
    const writer = { name: 'A Writer', relationship: 'brother', phone: '555', email: '', inUS: false, country: 'Nepal' };
    const person = { name: 'Test Person', country: 'Nepal', home: '', lastSeenPlace: 'Timure', lastSeenWhen: '', operator: '', details: '' };
    const body = buildLetterBody({ recipient: { chamber: 'intl', bioguide: 'intl', name: '' }, writer, person });
    expect(body).toContain('to be accepted and put to work in the valley');
    expect(body).toContain('what was offered, what was accepted, and when it will arrive');
    // The consent-pressing frame makes no sense addressed to Nepal itself.
    expect(body).not.toContain('If any of this is said to be waiting');
    expect(body).not.toContain('Open a case file');
    expect(body).toContain('rescueourfamily.org/letter');
    expect(body).not.toMatch(/—|–/);
  });

  test('a hand-typed nationality lands in the letter as written, never as "Other"', () => {
    const writer = { name: 'A Writer', relationship: 'brother', phone: '555', email: '', inUS: false, country: 'Germany' };
    const person = { name: 'Test Person', country: 'Germany', home: 'Berlin', lastSeenPlace: 'Timure', lastSeenWhen: '', operator: '', details: '' };
    const body = buildLetterBody({ recipient: { chamber: 'intl', bioguide: 'intl', name: '' }, writer, person });
    // Germany has nobody on the list, so no count clause renders, and
    // the typed country never collapses to "Other" or a placeholder.
    expect(body).not.toContain('Other');
    expect(body).not.toContain('[country]');
  });

  test('the letter sentence leads with the living letter and takes a larger live count', () => {
    // The floor is the letter's own printed totals, never a frozen
    // delivery-day snapshot (founder feedback, 2026-09-01).
    for (const stale of [null, undefined, 0, 1189, 3160, 'junk']) {
      const sentence = jointLetterSentence(stale);
      expect(sentence).toContain('More than 3,160 family members and friends of 81 missing people');
      expect(sentence).toContain('first delivered on August 29');
      expect(sentence).not.toContain('On August 29, 1,189');
    }
    expect(jointLetterSentence(4200)).toContain('More than 4,200 family members and friends of 81 missing people');
    expect(jointLetterSentence(4200)).not.toContain('3,160');
    const writer = { name: 'W', relationship: 'cousin', phone: '555', email: '', inUS: true, street: '1 Main St', city: 'B', state: 'IL', zip: '60103', country: '' };
    const person = { name: 'P', country: 'United States', home: '', lastSeenPlace: '', lastSeenWhen: '', operator: '', details: '' };
    const body = buildLetterBody({ recipient: { chamber: 'intl', bioguide: 'intl', name: '' }, writer, person, signers: 4200 });
    expect(body).toContain('More than 4,200');
  });

  test('letters carry the live letter\'s figures, not the superseded ones', () => {
    const writer = { name: 'W', relationship: 'cousin', phone: '555', email: '', inUS: true, street: '1 Main St', city: 'B', state: 'IL', zip: '60103', country: '' };
    const person = { name: 'P', country: 'United States', home: '', lastSeenPlace: '', lastSeenWhen: '', operator: '', details: '' };
    const sen = { chamber: 'sen', bioguide: 'X1', name: 'Test Senator', party: 'I', state: 'IL', phone: '202-555-0000', offices: [] };
    const body = buildLetterBody({ recipient: sen, writer, person });
    expect(body).toContain('90 Americans remain unaccounted for');
    expect(body).toContain('579 deaths');
    expect(body).toContain('1,924 people missing');
    expect(body).toContain('open to targeted technical support');
    expect(body).toContain('August 31, 2026');
    expect(body).not.toContain('approximately 85');
    expect(body).not.toContain('above 900');
    expect(body).not.toContain('August 29 letter');
    const intl = buildLetterBody({ recipient: { chamber: 'intl', bioguide: 'intl', name: '' }, writer, person });
    expect(intl).toContain('579 deaths');
    expect(intl).toContain('1,924 people missing');
    expect(intl).toContain('open to targeted technical support');
  });

  test('no personal contact details anywhere in the module', () => {
    const source = require('fs').readFileSync(require.resolve('@/app/rasuwa/letterData'), 'utf8');
    expect(source).not.toMatch(/bhumika|306-1983|gmail\.com/i);
  });

  test('surnames keep their particles, compounds, and suffix handling', () => {
    expect(recipientLastName({ name: 'Richard J. Durbin' })).toBe('Durbin');
    expect(recipientLastName({ name: 'Chris Van Hollen' })).toBe('Van Hollen');
    expect(recipientLastName({ name: 'Monica De La Cruz' })).toBe('De La Cruz');
    expect(recipientLastName({ name: 'Sanford D. Bishop, Jr.' })).toBe('Bishop');
    expect(recipientLastName({ bioguide: 'B001303', name: 'Lisa Blunt Rochester' })).toBe('Blunt Rochester');
    expect(recipientLastName({ bioguide: 'W000797', name: 'Debbie Wasserman Schultz' })).toBe('Wasserman Schultz');
  });

  test('no em dashes anywhere in generated text (house copy rule)', () => {
    const body = buildLetterBody({ recipient: senator, writer, person });
    const script = buildPhoneScript({ recipient: senator, writer, person });
    expect(`${body}${script}${buildSubject({ writer, person })}`).not.toMatch(/—|–/);
  });
});
