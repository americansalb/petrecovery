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

/** The Canadian slice: postal code, the found MP, or a hand-entered one. */
export const EMPTY_CANADA = { postal: '', mp: null, manualName: '', manualRiding: '', manualEmail: '' };

/** The finish boxes on the last step; restoring must never re-count them. */
export const EMPTY_DONE = { letters: false, entry: false, signed: false };

export const WHERE_VALUES = ['us', 'ca', 'intl'];

const text = (v) => (typeof v === 'string' ? v : '');

/** The saved shape: what the person typed or chose, plus where they are in the wizard. */
export function snapshotDraft({ person, writer, lookup, manualRep, overrides, step, where, canada, done, savedLetterHash, pendingTally }) {
  return {
    v: 2,
    step: text(step),
    where: WHERE_VALUES.includes(where) ? where : '',
    person,
    writer,
    canada: canada && typeof canada === 'object' ? canada : EMPTY_CANADA,
    done: done && typeof done === 'object' ? done : EMPTY_DONE,
    savedLetterHash: text(savedLetterHash),
    pendingTally: Array.isArray(pendingTally) ? pendingTally.filter((a) => typeof a === 'string').slice(0, 6) : [],
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
  const c = d.canada || {};
  const typed = [
    p.pick, p.name, p.home, p.lastSeenPlace, p.lastSeenWhen, p.operator, p.details,
    w.name, w.relationship, w.phone, w.email, w.street, w.city, w.state, w.zip,
    c.postal, c.manualName, c.manualRiding, c.manualEmail,
    d.manualRep,
  ].some((v) => text(v).trim() !== '');
  const edited = d.overrides && typeof d.overrides === 'object' && Object.keys(d.overrides).length > 0;
  const looked = Boolean(d.lookup && d.lookup.status === 'done') || Boolean(c.mp && c.mp.name);
  const placed = WHERE_VALUES.includes(d.where);
  return typed || edited || looked || placed;
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
  const rawCanada = src.canada && typeof src.canada === 'object' ? src.canada : {};
  // The MP object is normalized to its full shape: a draft that stored
  // one without offices (older or mangled) must restore to something
  // the members step can render, never crash it.
  const rawMp = rawCanada.mp && typeof rawCanada.mp === 'object' && text(rawCanada.mp.name) ? rawCanada.mp : null;
  const mp = rawMp
    ? {
        name: text(rawMp.name),
        party: text(rawMp.party),
        riding: text(rawMp.riding),
        email: text(rawMp.email),
        url: text(rawMp.url),
        offices: Array.isArray(rawMp.offices)
          ? rawMp.offices
              .filter((o) => o && typeof o === 'object' && text(o.phone))
              .map((o) => ({ type: text(o.type), phone: text(o.phone) }))
          : [],
      }
    : null;
  const canada = { ...EMPTY_CANADA, ...rawCanada, mp };
  let where = WHERE_VALUES.includes(src.where) ? src.where : '';
  // Drafts from before the wizard stored only writer.inUS; map the old
  // non-US path so nobody re-answers a question they already answered.
  if (!where && src.writer && typeof src.writer === 'object' && src.writer.inUS === false) {
    where = src.writer.country === 'Canada' ? 'ca' : 'intl';
  }
  const rawDone = src.done && typeof src.done === 'object' ? src.done : {};
  return {
    step: text(src.step),
    where,
    person: { ...EMPTY_PERSON, ...(src.person && typeof src.person === 'object' ? src.person : {}) },
    writer: { ...EMPTY_WRITER, ...(src.writer && typeof src.writer === 'object' ? src.writer : {}) },
    canada,
    lookup,
    manualRep: text(src.manualRep),
    overrides: src.overrides && typeof src.overrides === 'object' ? src.overrides : {},
    done: {
      letters: Boolean(rawDone.letters),
      entry: Boolean(rawDone.entry),
      signed: Boolean(rawDone.signed),
    },
    // Which letters were already saved to the families' record, so a
    // restored draft does not record the same letters twice.
    savedLetterHash: text(src.savedLetterHash),
    // Checked finish boxes whose +1 has not reached the server yet; the
    // wizard retries these so a failed request never loses a count.
    pendingTally: Array.isArray(src.pendingTally)
      ? src.pendingTally.filter((a) => typeof a === 'string').slice(0, 6)
      : [],
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
