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
  buildPhoneScript,
  buildRosterShare,
  buildSubject,
  coordinatorEmail,
  coordinatorPhone,
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

describe('missing people (from the Aug 29 letter)', () => {
  const people = missingPeople.people;

  test('all 57 entries are present, 31 American', () => {
    expect(people).toHaveLength(57);
    expect(people.filter((p) => p.country === 'United States')).toHaveLength(31);
    expect(people.map((p) => p.num)).toEqual([...Array(57)].map((_, i) => i + 1));
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

  test('coordinator contact assembles', () => {
    expect(coordinatorEmail()).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
    expect(coordinatorPhone()).toMatch(/^\d{3}-\d{3}-\d{4}$/);
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
