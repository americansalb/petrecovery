/**
 * /rasuwa tab-scoped draft (letterDraft.js): the pure logic that decides
 * what gets saved, what counts as real typing, and how a stored draft
 * comes back as safe component state. The storage itself is the report
 * wizards' sessionStorage helper; here it only needs to not crash where
 * sessionStorage does not exist.
 */

const {
  EMPTY_LOOKUP,
  EMPTY_PERSON,
  EMPTY_WRITER,
  clearRasuwaDraft,
  describeDraft,
  draftHasContent,
  loadRasuwaDraft,
  restoreDraft,
  saveRasuwaDraft,
  snapshotDraft,
} = require('@/app/rasuwa/letterDraft');

const emptyState = () => ({
  person: { ...EMPTY_PERSON },
  writer: { ...EMPTY_WRITER },
  lookup: { ...EMPTY_LOOKUP },
  manualRep: '',
  overrides: {},
});

const typedState = () => ({
  person: { ...EMPTY_PERSON, name: 'Poonam Thakkar', home: 'Bartlett, Illinois' },
  writer: { ...EMPTY_WRITER, name: 'Test Writer', street: '1 Main St', city: 'Bartlett', state: 'IL', zip: '60103' },
  lookup: { status: 'done', error: '', state: 'IL', district: 8, matchedAddress: '1 MAIN ST' },
  manualRep: '',
  overrides: { S000000: 'Dear Senator, edited by hand.' },
});

describe('draftHasContent', () => {
  test('pristine state is not a draft', () => {
    expect(draftHasContent(emptyState())).toBe(false);
  });

  test('nothing at all is not a draft', () => {
    expect(draftHasContent(null)).toBe(false);
    expect(draftHasContent(undefined)).toBe(false);
    expect(draftHasContent('junk')).toBe(false);
    expect(draftHasContent({})).toBe(false);
  });

  test('any typed field counts', () => {
    const a = emptyState();
    a.person.name = 'Someone';
    expect(draftHasContent(a)).toBe(true);
    const b = emptyState();
    b.writer.street = '1 Main St';
    expect(draftHasContent(b)).toBe(true);
    const c = emptyState();
    c.writer.state = 'IL';
    expect(draftHasContent(c)).toBe(true);
  });

  test('a hand-edited letter counts even with blank fields', () => {
    const s = emptyState();
    s.overrides = { X: 'edited' };
    expect(draftHasContent(s)).toBe(true);
  });

  test('a completed lookup counts; busy and error do not', () => {
    const s = emptyState();
    s.lookup = { ...EMPTY_LOOKUP, status: 'done', state: 'IL', district: 8 };
    expect(draftHasContent(s)).toBe(true);
    s.lookup = { ...EMPTY_LOOKUP, status: 'error', error: 'nope' };
    expect(draftHasContent(s)).toBe(false);
  });

  test('whitespace-only typing does not count', () => {
    const s = emptyState();
    s.person.name = '   ';
    expect(draftHasContent(s)).toBe(false);
  });
});

describe('snapshot and restore round trip', () => {
  test('typed state survives intact', () => {
    const state = typedState();
    const back = restoreDraft(snapshotDraft(state));
    expect(back.person).toEqual(state.person);
    expect(back.writer).toEqual(state.writer);
    expect(back.lookup).toEqual(state.lookup);
    expect(back.overrides).toEqual(state.overrides);
    expect(back.manualRep).toBe('');
  });

  test('busy and error lookups are not persisted', () => {
    const state = typedState();
    state.lookup = { status: 'busy', error: '', state: '', district: null, matchedAddress: '' };
    expect(restoreDraft(snapshotDraft(state)).lookup).toEqual(EMPTY_LOOKUP);
  });

  test('a mangled or outdated draft restores to safe defaults', () => {
    for (const junk of [null, undefined, 42, 'text', {}, { person: 'oops', writer: 9, lookup: { status: 'done' }, overrides: 'x' }]) {
      const back = restoreDraft(junk);
      expect(back.person).toEqual(EMPTY_PERSON);
      expect(back.writer).toEqual(EMPTY_WRITER);
      expect(back.lookup).toEqual(EMPTY_LOOKUP);
      expect(back.manualRep).toBe('');
      expect(back.overrides).toEqual({});
    }
  });

  test('a draft missing newer keys merges over the empty shapes', () => {
    const back = restoreDraft({ person: { name: 'Only A Name' } });
    expect(back.person.name).toBe('Only A Name');
    expect(back.person.country).toBe(EMPTY_PERSON.country);
    expect(back.writer).toEqual(EMPTY_WRITER);
  });
});

describe('describeDraft (restore banner phrase)', () => {
  test('names the missing person first', () => {
    expect(describeDraft(snapshotDraft(typedState()))).toBe('your letter about Poonam Thakkar');
  });

  test('falls back to the writer, then to a generic phrase', () => {
    const s = typedState();
    s.person.name = '';
    expect(describeDraft(snapshotDraft(s))).toBe('the entries Test Writer started');
    s.writer.name = '';
    expect(describeDraft(snapshotDraft(s))).toBe('what you typed earlier');
    expect(describeDraft(null)).toBe('what you typed earlier');
  });
});

describe('storage wrappers where sessionStorage does not exist', () => {
  test('load, save, and clear are safe no-ops', () => {
    expect(loadRasuwaDraft()).toBeNull();
    expect(() => saveRasuwaDraft(typedState())).not.toThrow();
    expect(() => clearRasuwaDraft()).not.toThrow();
  });
});
