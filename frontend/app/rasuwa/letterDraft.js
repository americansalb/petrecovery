/**
 * Tab-scoped draft for the /rasuwa letter tool.
 *
 * The tool's flow forces app switches (calling offices, opening contact
 * forms, viewing the PDF), and phones discard backgrounded tabs; without a
 * draft, coming back reloads the page empty and ten minutes of typing is
 * gone. Storage is sessionStorage via the report wizards' helper: it
 * survives reloads and tab restores, and it is gone when the tab closes,
 * which keeps the page's privacy promise for families entering home
 * addresses on sometimes-shared devices.
 *
 * Restoring is an explicit choice, never a silent prefill (same rule as
 * DraftPrompt in the report wizard): on a volunteer's shared phone, the
 * next family must not quietly inherit the previous family's entries.
 */

import { clearDraft, loadDraft, saveDraft } from '@/app/components/report/wizardDraft';

export const DRAFT_KEY = 'rasuwaLetterDraft';

export const EMPTY_PERSON = {
  pick: '', name: '', country: 'United States', home: '',
  lastSeenPlace: '', lastSeenWhen: '', operator: '', details: '',
};

export const EMPTY_WRITER = {
  name: '', relationship: '', phone: '', email: '',
  inUS: true, street: '', city: '', state: '', zip: '',
  country: 'Australia',
};

export const EMPTY_LOOKUP = { status: 'idle', error: '', state: '', district: null, matchedAddress: '' };

const text = (v) => (typeof v === 'string' ? v : '');

/** The saved shape: only what the person typed or chose, never UI state. */
export function snapshotDraft({ person, writer, lookup, manualRep, overrides }) {
  return {
    v: 1,
    person,
    writer,
    // Only a completed lookup is worth restoring; busy and error states
    // would come back stale and confusing.
    lookup: lookup && lookup.status === 'done' ? lookup : null,
    manualRep: text(manualRep),
    overrides: overrides && typeof overrides === 'object' ? overrides : {},
  };
}

/** True when the draft (or a snapshot of live state) holds real typing. */
export function draftHasContent(d) {
  if (!d || typeof d !== 'object') return false;
  const p = d.person || {};
  const w = d.writer || {};
  const typed = [
    p.pick, p.name, p.home, p.lastSeenPlace, p.lastSeenWhen, p.operator, p.details,
    w.name, w.relationship, w.phone, w.email, w.street, w.city, w.state, w.zip,
    d.manualRep,
  ].some((v) => text(v).trim() !== '');
  const edited = d.overrides && typeof d.overrides === 'object' && Object.keys(d.overrides).length > 0;
  const looked = Boolean(d.lookup && d.lookup.status === 'done');
  return typed || edited || looked;
}

/**
 * A stored draft back into safe component state. Merges over the empty
 * shapes so a draft from an older page version, or a mangled one, can
 * never crash the tool: missing keys get defaults, junk lookups reset.
 */
export function restoreDraft(d) {
  const src = d && typeof d === 'object' ? d : {};
  const lookup =
    src.lookup && src.lookup.status === 'done' && text(src.lookup.state)
      ? { ...EMPTY_LOOKUP, ...src.lookup }
      : EMPTY_LOOKUP;
  return {
    person: { ...EMPTY_PERSON, ...(src.person && typeof src.person === 'object' ? src.person : {}) },
    writer: { ...EMPTY_WRITER, ...(src.writer && typeof src.writer === 'object' ? src.writer : {}) },
    lookup,
    manualRep: text(src.manualRep),
    overrides: src.overrides && typeof src.overrides === 'object' ? src.overrides : {},
  };
}

/** One short phrase for the restore banner. */
export function describeDraft(d) {
  const person = text(d?.person?.name).trim();
  if (person) return `your letter about ${person}`;
  const writer = text(d?.writer?.name).trim();
  if (writer) return `the entries ${writer} started`;
  return 'what you typed earlier';
}

export function loadRasuwaDraft() {
  return loadDraft(DRAFT_KEY);
}

export function saveRasuwaDraft(state) {
  saveDraft(DRAFT_KEY, snapshotDraft(state));
}

export function clearRasuwaDraft() {
  clearDraft(DRAFT_KEY);
}
