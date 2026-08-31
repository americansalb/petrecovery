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

  test('wizard position and the Canadian slice round trip', () => {
    const state = typedState();
    state.step = 'letters';
    state.where = 'ca';
    state.canada = {
      postal: 'K1A 0A6',
      mp: { name: 'Anita Vandenbeld', riding: 'Ottawa West--Nepean', email: 'a@parl.gc.ca', party: 'Liberal', url: '', offices: [] },
      manualName: '', manualRiding: '', manualEmail: '',
    };
    const back = restoreDraft(snapshotDraft(state));
    expect(back.step).toBe('letters');
    expect(back.where).toBe('ca');
    expect(back.canada.postal).toBe('K1A 0A6');
    expect(back.canada.mp.name).toBe('Anita Vandenbeld');
  });

  test('a junk canada slice and unknown where restore to safe defaults', () => {
    const back = restoreDraft({ where: 'moon', step: 42, canada: { mp: 'oops', postal: 9 } });
    expect(back.where).toBe('');
    expect(back.canada.mp).toBeNull();
    expect(typeof back.step).toBe('string');
  });

  test('an MP saved without offices restores to the full shape, never a crash', () => {
    const back = restoreDraft({ canada: { mp: { name: 'Example MP' } } });
    expect(back.canada.mp.name).toBe('Example MP');
    expect(back.canada.mp.offices).toEqual([]);
    expect(back.canada.mp.riding).toBe('');
    const junkOffices = restoreDraft({
      canada: { mp: { name: 'X', offices: [null, 'str', { type: 'constituency' }, { type: 'legislature', phone: '1 613 555' }] } },
    });
    expect(junkOffices.canada.mp.offices).toEqual([{ type: 'legislature', phone: '1 613 555' }]);
  });

  test('hand edits from an older letter template restore rebuilt, and say so', () => {
    const state = typedState();
    // A snapshot taken today carries the current template version, so
    // edits round trip untouched.
    const fresh = restoreDraft(snapshotDraft(state));
    expect(fresh.overrides).toEqual(state.overrides);
    expect(fresh.templateOutdated).toBe(false);
    // A stored draft from before versioning (or an older version) with
    // hand edits restores with the edits dropped and the flag up.
    const old = { ...snapshotDraft(state), templateVersion: undefined };
    const back = restoreDraft(old);
    expect(back.overrides).toEqual({});
    expect(back.templateOutdated).toBe(true);
    const older = { ...snapshotDraft(state), templateVersion: 1 };
    expect(restoreDraft(older).overrides).toEqual({});
    // No hand edits means nothing was lost and no notice is owed.
    const clean = { ...snapshotDraft(emptyState()), templateVersion: 1 };
    expect(restoreDraft(clean).templateOutdated).toBe(false);
  });

  test('drafts saved on the old nine-step layout land on the merged screens', () => {
    expect(restoreDraft({ step: 'details' }).step).toBe('person');
    expect(restoreDraft({ step: 'where' }).step).toBe('you');
    expect(restoreDraft({ step: 'usAddress' }).step).toBe('reps');
    expect(restoreDraft({ step: 'caPostal' }).step).toBe('reps');
    expect(restoreDraft({ step: 'members' }).step).toBe('reps');
    expect(restoreDraft({ step: 'letters' }).step).toBe('letters');
  });

  test('pre-wizard drafts map their old inUS answer onto where', () => {
    expect(restoreDraft({ writer: { inUS: false, country: 'Canada' } }).where).toBe('ca');
    expect(restoreDraft({ writer: { inUS: false, country: 'Australia' } }).where).toBe('intl');
    expect(restoreDraft({ writer: { inUS: true } }).where).toBe('');
  });

  test('choosing where alone counts as a draft worth restoring', () => {
    const s = emptyState();
    s.where = 'ca';
    expect(draftHasContent(s)).toBe(true);
  });

  test('finish boxes round trip as booleans and default off', () => {
    const state = typedState();
    state.done = { letters: true, entry: 'yes', signed: 0 };
    const back = restoreDraft(snapshotDraft(state));
    expect(back.done).toEqual({ letters: true, entry: true, signed: false });
    expect(restoreDraft({}).done).toEqual({ letters: false, entry: false, signed: false });
  });

  test('the saved-letters hash rides the draft so restores never re-record', () => {
    const state = typedState();
    state.savedLetterHash = 'abc123';
    expect(restoreDraft(snapshotDraft(state)).savedLetterHash).toBe('abc123');
    expect(restoreDraft({}).savedLetterHash).toBe('');
  });

  test('unsent tally increments ride the draft, sanitized and capped', () => {
    const state = typedState();
    state.pendingTally = ['letters_done', 'entry_sent'];
    expect(restoreDraft(snapshotDraft(state)).pendingTally).toEqual(['letters_done', 'entry_sent']);
    expect(restoreDraft({ pendingTally: [42, null, 'a', 'b', 'c', 'd', 'e', 'f', 'g'] }).pendingTally)
      .toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(restoreDraft({}).pendingTally).toEqual([]);
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
