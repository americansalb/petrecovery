'use client';

/**
 * The /rasuwa letter wizard: one focused question per screen, in the
 * same shape as the ReunitePets report wizards (StepScreen,
 * OptionCardGrid, DraftPrompt, tab-scoped drafts with explicit
 * restore), carrying the family campaign's own identity.
 *
 * Three paths after "Where do you live?":
 *  - United States: address -> district lookup -> two senators + House
 *    representative -> one letter each -> webform, call, fax delivery.
 *  - Canada: postal code -> Member of Parliament (Represent API via
 *    api/rasuwa/mp, hand entry as fallback) -> constituent letter ->
 *    email (MPs have public addresses), constituency call, free post,
 *    and the Global Affairs consular line.
 *  - Another country: consular and parliament links, one adaptable
 *    letter.
 *
 * Client-side on purpose: what a family types stays in the browser and
 * persists only as a tab draft (letterDraft.js). The network calls are
 * the two lookups and the signer count, all documented in their routes.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Globe2, Landmark, Leaf } from 'lucide-react';
import DraftPrompt from '@/app/components/report/DraftPrompt';
import OptionCardGrid from '@/app/components/report/OptionCardGrid';
import StepScreen from '@/app/components/report/StepScreen';
import { isValidPhone } from '@/app/components/report/wizardTheme';
import { US_STATES } from '@/app/lib/states';
import directory from './congress-directory.json';
import missingPeople from './missing-people.json';
import RasuwaWizardShell from './RasuwaWizardShell';
import SignerCount from './SignerCount';
import { findUnprintableChars } from './pdfText';
import { normalizePostalCode } from './mpLookup';
import {
  EMPTY_CANADA,
  EMPTY_DONE,
  EMPTY_LOOKUP,
  EMPTY_PERSON,
  EMPTY_WRITER,
  clearRasuwaDraft,
  describeDraft,
  draftHasContent,
  loadRasuwaDraft,
  restoreDraft,
  saveRasuwaDraft,
} from './letterDraft';
import {
  CANADA_LINKS,
  COORDINATOR_NAME,
  COUNTRY_GUIDES,
  FACTS_DATE,
  US_LINKS,
  buildLetterBody,
  buildPhoneScript,
  buildRosterShare,
  buildSubject,
  coordinatorEmail,
  coordinatorPhone,
  recipientLastName,
  recipientTitle,
} from './letterData';

const MEMBERS = directory.members;
const PEOPLE = missingPeople.people;

// The House also seats delegates for these; any area US_STATES already
// carries (it includes DC) is deduped or the picker lists it twice.
const EXTRA_AREAS = [
  { code: 'DC', name: 'District of Columbia' },
  { code: 'AS', name: 'American Samoa' },
  { code: 'GU', name: 'Guam' },
  { code: 'MP', name: 'Northern Mariana Islands' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'VI', name: 'U.S. Virgin Islands' },
];
const STATE_OPTIONS = [
  ...US_STATES,
  ...EXTRA_AREAS.filter((a) => !US_STATES.some((s) => s.code === a.code)),
];

const NATIONALITIES = [
  'United States', 'Canada', 'Australia', 'United Kingdom', 'Singapore',
  'France', 'South Africa', 'India', 'Nepal', 'Other',
];

const WHERE_OPTIONS = [
  { value: 'us', label: 'United States', sublabel: 'Your two senators and your House representative', icon: Landmark },
  { value: 'ca', label: 'Canada', sublabel: 'Your Member of Parliament and Global Affairs', icon: Leaf },
  { value: 'intl', label: 'Another country', sublabel: 'Your parliament member or consulate', icon: Globe2 },
];

const inputCls =
  'w-full px-4 py-3.5 bg-white border-2 border-midnight-100 rounded-2xl outline-none transition-colors focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-base text-midnight-900 placeholder-midnight-300';
const labelCls = 'block text-sm font-semibold text-midnight-700 mb-1.5';
const linkBtnCls = 'text-sm font-semibold text-blue-800 underline';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

/** Step metadata: checklist label + the sidebar's contextual copy. */
const STEP_META = {
  person: {
    label: 'Who is missing',
    sidebarTitle: 'Start with your loved one.',
    sidebarCopy: 'Pick them from the letter\'s list, or add someone who is not on it yet. Their details go into every letter.',
  },
  details: {
    label: 'Their details',
    sidebarTitle: 'What the search should know.',
    sidebarCopy: 'Where they were last seen and who they were traveling with helps offices ask the right questions. Everything here is optional.',
  },
  where: {
    label: 'Where you live',
    sidebarTitle: 'Your government, your letter.',
    sidebarCopy: 'Where you live decides who your letter goes to and how it gets delivered.',
  },
  you: {
    label: 'About you',
    sidebarTitle: 'Offices reply to people.',
    sidebarCopy: 'Your name, relationship, and phone number go into the letter so a caseworker can reach you.',
  },
  usAddress: {
    label: 'Your address',
    sidebarTitle: 'Offices check for constituents.',
    sidebarCopy: 'Your address finds your congressional district and shows the office you live there. It goes into the letter and nowhere else.',
  },
  caPostal: {
    label: 'Your postal code',
    sidebarTitle: 'Your MP works for your riding.',
    sidebarCopy: 'Your postal code finds your Member of Parliament. It is used for the lookup and nothing else.',
  },
  members: {
    label: 'Your representatives',
    sidebarTitle: 'The people who can move this.',
    sidebarCopy: 'These offices do casework for constituents: they can press for action and open a file for your family member.',
  },
  country: {
    label: 'Your country',
    sidebarTitle: 'Every government has a door.',
    sidebarCopy: 'The letter is written for a Member of Parliament or consular officer; these links find yours.',
  },
  letters: {
    label: 'Your letters',
    sidebarTitle: 'Ready to send.',
    sidebarCopy: 'One letter per office, built from what you entered. Edit anything; the brackets mark what is still blank.',
  },
  deliver: {
    label: 'Get it to them',
    sidebarTitle: 'Delivered beats drafted.',
    sidebarCopy: 'Calls are logged the same day. Then the letter, by the channel each office actually reads.',
  },
  roster: {
    label: 'Finish and be counted',
    sidebarTitle: 'Every family counts here.',
    sidebarCopy: 'Check off what you finished and watch the shared count move. The families\' letter is the one document coordinators and consular officers work from.',
  },
};

const BASE_STEPS = ['person', 'details', 'where', 'you'];
const TAIL_STEPS = {
  us: ['usAddress', 'members', 'letters', 'deliver', 'roster'],
  ca: ['caPostal', 'members', 'letters', 'deliver', 'roster'],
  intl: ['country', 'letters', 'deliver', 'roster'],
  '': ['letters', 'deliver', 'roster'],
};
const stepIdsFor = (where) => [...BASE_STEPS, ...TAIL_STEPS[where] ?? TAIL_STEPS['']];

export default function RasuwaWizard() {
  const [step, setStep] = useState('person');
  const [where, setWhere] = useState('');
  const [person, setPerson] = useState(EMPTY_PERSON);
  const [writer, setWriter] = useState(EMPTY_WRITER);
  const [canada, setCanada] = useState(EMPTY_CANADA);
  const [lookup, setLookup] = useState(EMPTY_LOOKUP);
  const [manualRep, setManualRep] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [overrides, setOverrides] = useState({});
  const [copied, setCopied] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [mpStatus, setMpStatus] = useState({ busy: false, error: '' });
  const [caManual, setCaManual] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // ── The collective count: finish boxes and the shared tally ────────
  // Checking a box adds one, anonymously, and the number on screen
  // moves; restoring a draft restores the checkmarks without counting
  // them again.
  const [done, setDone] = useState(EMPTY_DONE);
  const [tally, setTally] = useState(null); // { letters_done, entry_sent, letter_signed }

  useEffect(() => {
    if (step !== 'roster') return;
    let stop = false;
    fetch('/api/rasuwa/tally')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!stop && data && data.counts) setTally(data.counts);
      })
      .catch(() => {
        // the boxes still work; the numbers just stay hidden
      });
    return () => {
      stop = true;
    };
  }, [step]);

  const DONE_ACTIONS = { letters: 'letters_done', entry: 'entry_sent', signed: 'letter_signed' };
  function markDone(key) {
    if (done[key]) return;
    setDone((d) => ({ ...d, [key]: true }));
    const action = DONE_ACTIONS[key];
    setTally((t) => (t ? { ...t, [action]: (t[action] || 0) + 1 } : t));
    fetch('/api/rasuwa/tally', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.counts) setTally(data.counts);
      })
      .catch(() => {
        // the optimistic number stands; the server catches up next load
      });
  }

  // ── Drafts: save on every meaningful change; explicit restore ──────
  useEffect(() => {
    const d = loadRasuwaDraft();
    if (draftHasContent(d)) setPendingDraft(d);
  }, []);

  useEffect(() => {
    const state = { person, writer, canada, lookup, manualRep, overrides, step, where, done };
    if (!draftHasContent(state)) return;
    if (pendingDraft) {
      setPendingDraft(null);
      return;
    }
    saveRasuwaDraft(state);
  }, [person, writer, canada, lookup, manualRep, overrides, step, where, done, pendingDraft]);

  function resumeDraft() {
    const d = restoreDraft(pendingDraft);
    setPerson(d.person);
    setWriter(d.writer);
    setCanada(d.canada);
    setLookup(d.lookup);
    setManualRep(d.manualRep);
    setOverrides(d.overrides);
    setWhere(d.where);
    setDone(d.done);
    setStep(stepIdsFor(d.where).includes(d.step) ? d.step : 'person');
    setEditsCleared(false);
    setPendingDraft(null);
  }

  function startFresh() {
    clearRasuwaDraft();
    setPendingDraft(null);
  }

  function clearEverything() {
    if (!window.confirm('Clear everything you typed and start over?')) return;
    setPerson(EMPTY_PERSON);
    setWriter(EMPTY_WRITER);
    setCanada(EMPTY_CANADA);
    setLookup(EMPTY_LOOKUP);
    setManualRep('');
    setOverrides({});
    setActiveIdx(0);
    setWhere('');
    setDone(EMPTY_DONE);
    setEditsCleared(false);
    setCaManual(false);
    setMpStatus({ busy: false, error: '' });
    setPendingDraft(null);
    clearRasuwaDraft();
    setStep('person');
  }

  // ── Field setters: any detail change invalidates hand-edited letters,
  // never silently (editsCleared puts a notice above the letter). ─────
  const [editsCleared, setEditsCleared] = useState(false);
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  const clearOverrides = () => {
    if (!Object.keys(overridesRef.current).length) return;
    setOverrides({});
    setEditsCleared(true);
  };
  const setP = (patch) => {
    setPerson((p) => ({ ...p, ...patch }));
    clearOverrides();
  };
  const setW = (patch) => {
    setWriter((w) => ({ ...w, ...patch }));
    clearOverrides();
  };
  const setC = (patch) => {
    setCanada((c) => ({ ...c, ...patch }));
    clearOverrides();
  };

  // Street, city, and ZIP feed the district lookup; editing them after
  // a successful lookup invalidates the representative it found, and
  // editing them mid-lookup invalidates the response still in flight.
  const lookupSeq = useRef(0);
  const setAddressField = (patch) => {
    setW(patch);
    lookupSeq.current++;
    setLookup((l) => (l.status === 'idle' ? l : EMPTY_LOOKUP));
  };

  function pickPerson(value) {
    if (value === '' || value === 'other') {
      setP({ ...EMPTY_PERSON, pick: value });
      return;
    }
    const entry = PEOPLE[Number(value)];
    if (entry) {
      setP({
        pick: value, name: entry.name, country: entry.country, home: entry.home,
        lastSeenPlace: entry.lastSeenPlace, lastSeenWhen: entry.lastSeenWhen,
        operator: entry.operator, details: '',
      });
    }
  }

  // ── Step flow ──────────────────────────────────────────────────────
  const stepIds = stepIdsFor(where);
  const steps = stepIds.map((id) => ({ id, ...STEP_META[id] }));
  const stepIndex = Math.max(0, stepIds.indexOf(step));
  const goTo = (id) => setStep(id);
  const goNext = () => goTo(stepIds[Math.min(stepIndex + 1, stepIds.length - 1)]);
  const goBack = stepIndex > 0 ? () => goTo(stepIds[stepIndex - 1]) : undefined;

  function pickWhere(value) {
    if (value !== where) {
      setWhere(value);
      setWriter((w) => ({ ...w, inUS: value === 'us' }));
      clearOverrides();
    }
    goTo('you');
  }

  // ── United States: district lookup ─────────────────────────────────
  const [usBusy, setUsBusy] = useState(false);
  async function findDistrict() {
    const seq = ++lookupSeq.current;
    const applyLookup = (next) => {
      if (lookupSeq.current === seq) setLookup(next);
    };
    const address = [writer.street, writer.city, [writer.state, writer.zip].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ');
    setLookup({ ...EMPTY_LOOKUP, status: 'busy' });
    setManualRep('');
    try {
      // POST body, not a query string: the address must not ride in
      // request URLs that edge and access logs keep.
      const res = await fetch('/api/rasuwa/district', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      if (res.status === 429) {
        applyLookup({
          ...EMPTY_LOOKUP,
          status: 'error',
          error: 'A lot of people are using this right now. Wait a minute and try again, or pick your district by hand below.',
        });
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        applyLookup({ ...EMPTY_LOOKUP, status: 'error', error: data.error || 'The lookup failed. Pick your district by hand below.' });
        return;
      }
      applyLookup({ status: 'done', error: '', state: data.state, district: data.district, matchedAddress: data.matchedAddress });
      // The letter says which state the writer lives in; it must match
      // the members the lookup found.
      if (lookupSeq.current === seq && writer.state !== data.state) setW({ state: data.state });
    } catch {
      applyLookup({ ...EMPTY_LOOKUP, status: 'error', error: 'The lookup failed. Pick your district by hand below.' });
    }
  }

  async function findDistrictAndAdvance() {
    setUsBusy(true);
    try {
      await findDistrict();
    } finally {
      setUsBusy(false);
    }
    goTo('members');
  }

  // ── Canada: MP lookup ──────────────────────────────────────────────
  const mpSeq = useRef(0);
  async function findMpAndAdvance() {
    const seq = ++mpSeq.current;
    setMpStatus({ busy: true, error: '' });
    try {
      const res = await fetch('/api/rasuwa/mp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postalCode: canada.postal }),
      });
      if (res.status === 429) {
        if (mpSeq.current === seq) {
          setMpStatus({ busy: false, error: 'A lot of people are using this right now. Wait a minute and try again, or enter your MP by hand.' });
        }
        return;
      }
      const data = await res.json();
      if (mpSeq.current !== seq) return;
      if (!res.ok || !data.mp) {
        setMpStatus({ busy: false, error: data.error || 'The MP lookup failed. Enter your MP by hand.' });
        return;
      }
      setMpStatus({ busy: false, error: '' });
      setCaManual(false);
      setC({ mp: data.mp });
      goTo('members');
    } catch {
      if (mpSeq.current === seq) {
        setMpStatus({ busy: false, error: 'The MP lookup did not respond. Enter your MP by hand.' });
      }
    }
  }

  function enterMpByHand() {
    mpSeq.current++;
    setMpStatus({ busy: false, error: '' });
    setCaManual(true);
    setC({ mp: null });
    goTo('members');
  }

  // ── Recipients and letters ─────────────────────────────────────────
  const stateInUse = lookup.status === 'done' ? lookup.state : writer.state;
  const senators = useMemo(
    () => MEMBERS.filter((m) => m.chamber === 'sen' && m.state === stateInUse),
    [stateInUse]
  );
  const stateReps = useMemo(
    () => MEMBERS.filter((m) => m.chamber === 'rep' && m.state === stateInUse),
    [stateInUse]
  );
  const districtRep = useMemo(() => {
    if (lookup.status === 'done') {
      return MEMBERS.find((m) => m.chamber === 'rep' && m.state === lookup.state && m.district === lookup.district) || null;
    }
    if (manualRep) return MEMBERS.find((m) => m.bioguide === manualRep) || null;
    return null;
  }, [lookup, manualRep]);

  const caRecipient = {
    chamber: 'mp',
    bioguide: 'mp',
    name: canada.mp ? canada.mp.name : canada.manualName,
    riding: canada.mp ? canada.mp.riding : canada.manualRiding,
    party: canada.mp ? canada.mp.party : '',
    email: canada.mp ? canada.mp.email : canada.manualEmail,
    url: canada.mp ? canada.mp.url : '',
    offices: canada.mp ? canada.mp.offices || [] : [],
  };

  const recipients =
    where === 'us'
      ? [...senators, ...(districtRep ? [districtRep] : [])]
      : where === 'ca'
        ? [caRecipient]
        : where === 'intl'
          ? [{ chamber: 'intl', bioguide: 'intl', name: '' }]
          : [];

  const letters = recipients.map((recipient) => ({
    recipient,
    key: recipient.bioguide,
    body: buildLetterBody({ recipient, writer, person }),
  }));
  const active = letters[Math.min(activeIdx, Math.max(letters.length - 1, 0))] || null;
  const activeBody = active ? overrides[active.key] ?? active.body : '';
  const activeEdited = active ? overrides[active.key] != null && overrides[active.key] !== active.body : false;
  const subject = buildSubject({ writer, person, recipient: active ? active.recipient : recipients[0] });
  const unprintable = findUnprintableChars(letters.map((l) => overrides[l.key] ?? l.body).join('\n'));
  const guide = COUNTRY_GUIDES.find((g) => g.country === writer.country) || COUNTRY_GUIDES[COUNTRY_GUIDES.length - 1];

  // The letter writes itself in the sidebar as fields fill in; before a
  // real recipient exists a generic consular letter carries the preview,
  // so the person sees their words landing from the first step.
  const previewBody = active
    ? activeBody
    : buildLetterBody({ recipient: { chamber: 'intl', bioguide: 'intl', name: '' }, writer, person });
  const sidebarPreview =
    step !== 'letters' && (person.name.trim() || writer.name.trim()) ? previewBody : undefined;

  const stillBlank = [];
  if (!person.lastSeenPlace.trim()) stillBlank.push('their last known location');
  if (where === 'ca' && !caRecipient.name.trim()) stillBlank.push("your MP's name");

  // ── Copy, share, PDF, roster ───────────────────────────────────────
  async function copyText(key, text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* nothing else to try */ }
      document.body.removeChild(ta);
    }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? '' : c)), 2000);
  }

  async function downloadPdf() {
    setPdfBusy(true);
    setPdfError('');
    try {
      const { buildLetterPdfBlob } = await import('./LetterPdf');
      const blob = await buildLetterPdfBlob({
        letters: letters.map((l) => ({ body: overrides[l.key] ?? l.body })),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slug = (person.name || 'family').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'family';
      a.href = url;
      a.download = `rasuwa-letters-${slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      setPdfError('The PDF could not be built in this browser. Use "Copy letter" and paste into a document instead.');
    } finally {
      setPdfBusy(false);
    }
  }

  async function shareActiveLetter() {
    try {
      await navigator.share({ title: subject, text: `${subject}\n\n${activeBody}` });
    } catch {
      // the person closed the share sheet; nothing to do
    }
  }

  function shareWithCoordinator() {
    const { subject: shareSubject, body } = buildRosterShare({ writer, person });
    window.location.href = `mailto:${coordinatorEmail()}?subject=${encodeURIComponent(shareSubject)}&body=${encodeURIComponent(body)}`;
  }

  const phoneScript = buildPhoneScript({
    recipient: where === 'ca' ? caRecipient : null,
    writer,
    person,
  });

  // ── Sidebar summary ────────────────────────────────────────────────
  const summary = [];
  if (person.name.trim()) summary.push({ text: person.name.trim() });
  if (where) summary.push({ text: WHERE_OPTIONS.find((o) => o.value === where)?.label || '' });
  if (where === 'us' && recipients.length) {
    summary.push({ text: recipients.map((m) => `${recipientTitle(m)} ${recipientLastName(m)}`).join(', ') });
  }
  if (where === 'ca' && caRecipient.name.trim()) summary.push({ text: `MP ${caRecipient.name.trim()}` });

  // ── Restore prompt gate ────────────────────────────────────────────
  if (pendingDraft) {
    return (
      <RasuwaWizardShell steps={steps} activeStepId={step} summary={[]}>
        <DraftPrompt
          variant="rasuwa"
          summary={`This tab still has ${describeDraft(pendingDraft)}.`}
          onResume={resumeDraft}
          onStartFresh={startFresh}
          resumeLabel="Continue where I left off"
        />
      </RasuwaWizardShell>
    );
  }

  // ── Steps ──────────────────────────────────────────────────────────
  let screen = null;

  if (step === 'person') {
    screen = (
      <StepScreen
        stepKey="person"
        variant="rasuwa"
        eyebrow="Missing in the Rasuwa flood"
        question="Who are you writing for?"
        hint={<span><SignerCount /> This wizard turns that letter into your own, for your missing family member. It takes about ten minutes.</span>}
        primary={{ label: 'Continue', onClick: goNext, disabled: !person.name.trim() }}
      >
        <div className="space-y-5">
          <Field label="Pick from the letter's list, or add someone">
            <select className={inputCls} value={person.pick} onChange={(e) => pickPerson(e.target.value)}>
              <option value="">Choose a name...</option>
              <optgroup label="United States">
                {PEOPLE.map((p, i) =>
                  p.country === 'United States' ? (
                    <option key={p.num} value={i}>{p.name} ({p.lastSeenPlace})</option>
                  ) : null
                )}
              </optgroup>
              <optgroup label="Other nationalities">
                {PEOPLE.map((p, i) =>
                  p.country !== 'United States' ? (
                    <option key={p.num} value={i}>{p.name}, {p.country} ({p.lastSeenPlace})</option>
                  ) : null
                )}
              </optgroup>
              <option value="other">Someone not on the list</option>
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Their full name">
              <input className={inputCls} value={person.name} onChange={(e) => setP({ name: e.target.value })} placeholder="Name of your missing family member" />
            </Field>
            <Field label="Nationality">
              <select className={inputCls} value={person.country} onChange={(e) => setP({ country: e.target.value })}>
                {NATIONALITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <p className="text-sm text-midnight-400">
            What you type stays on your device, kept only in this browser tab so a phone call
            or a reload does not wipe it. Close the tab and it is gone. The lookups send only
            your address or postal code to find your representatives, and the finish boxes at
            the end add one to a shared count. Nothing you type is stored by this site.
          </p>
        </div>
      </StepScreen>
    );
  } else if (step === 'details') {
    screen = (
      <StepScreen
        stepKey="details"
        variant="rasuwa"
        eyebrow={person.name.trim() || 'Their details'}
        question="What should the search know?"
        hint="Everything here is optional; anything you skip shows as a [bracket] in the letter, and you can keep going."
        primary={{ label: 'Continue', onClick: goNext }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Home city (as you want it in the letter)">
            <input className={inputCls} value={person.home} onChange={(e) => setP({ home: e.target.value })} placeholder="Bartlett, Illinois" />
          </Field>
          <Field label="Traveling with (tour operator)">
            <input className={inputCls} value={person.operator} onChange={(e) => setP({ operator: e.target.value })} placeholder="Tour operator or group" />
          </Field>
          <Field label="Last known location">
            <input className={inputCls} value={person.lastSeenPlace} onChange={(e) => setP({ lastSeenPlace: e.target.value })} placeholder="Hotel Kailash, Timure" />
          </Field>
          <Field label="Last seen (date and time, Nepal time)">
            <input className={inputCls} value={person.lastSeenWhen} onChange={(e) => setP({ lastSeenWhen: e.target.value })} placeholder="August 26, 8:20 AM" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Anything else (optional)">
              <textarea
                className={`${inputCls} min-h-[90px]`}
                value={person.details}
                onChange={(e) => setP({ details: e.target.value })}
                placeholder="Last phone contact, medical needs, who they were with"
              />
            </Field>
          </div>
        </div>
      </StepScreen>
    );
  } else if (step === 'where') {
    screen = (
      <StepScreen
        stepKey="where"
        variant="rasuwa"
        question="Where do you live?"
        hint="Where you live decides who your letter goes to."
      >
        <OptionCardGrid options={WHERE_OPTIONS} value={where} onSelect={pickWhere} columns={1} variant="rasuwa" />
      </StepScreen>
    );
  } else if (step === 'you') {
    const youOk = writer.name.trim() && writer.relationship.trim() && isValidPhone(writer.phone);
    screen = (
      <StepScreen
        stepKey="you"
        variant="rasuwa"
        question="How can a caseworker reach you?"
        hint="Your name, relationship, and phone go into the letter; offices call back."
        primary={{ label: 'Continue', onClick: goNext, disabled: !youOk }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name">
            <input className={inputCls} value={writer.name} onChange={(e) => setW({ name: e.target.value })} autoComplete="name" />
          </Field>
          <Field label="Your relationship to them">
            <input className={inputCls} value={writer.relationship} onChange={(e) => setW({ relationship: e.target.value })} placeholder="mother, brother, cousin, friend" />
          </Field>
          <Field label="Your phone">
            <input className={inputCls} value={writer.phone} onChange={(e) => setW({ phone: e.target.value })} autoComplete="tel" inputMode="tel" />
          </Field>
          <Field label="Your email (optional)">
            <input className={inputCls} value={writer.email} onChange={(e) => setW({ email: e.target.value })} autoComplete="email" inputMode="email" />
          </Field>
        </div>
      </StepScreen>
    );
  } else if (step === 'usAddress') {
    const addressOk = writer.street.trim() && writer.city.trim() && writer.state && writer.zip.trim();
    screen = (
      <StepScreen
        stepKey="usAddress"
        variant="rasuwa"
        question="What is your U.S. address?"
        hint="Offices check that writers are constituents; the address also finds your congressional district. It goes into the letter and nowhere else."
        primary={{
          label: 'Find my members of Congress',
          onClick: findDistrictAndAdvance,
          disabled: !addressOk,
          loading: usBusy,
          loadingLabel: 'Looking up your district…',
        }}
        skip={{ label: 'Skip the lookup and pick my district by hand', onClick: () => goTo('members') }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Street address">
              <input className={inputCls} value={writer.street} onChange={(e) => setAddressField({ street: e.target.value })} autoComplete="street-address" placeholder="Street address" />
            </Field>
          </div>
          <Field label="City">
            <input className={inputCls} value={writer.city} onChange={(e) => setAddressField({ city: e.target.value })} autoComplete="address-level2" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="State">
              <select className={inputCls} value={writer.state} onChange={(e) => { setAddressField({ state: e.target.value }); setManualRep(''); }}>
                <option value="">Choose...</option>
                {STATE_OPTIONS.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
              </select>
            </Field>
            <Field label="ZIP">
              <input className={inputCls} value={writer.zip} onChange={(e) => setAddressField({ zip: e.target.value })} autoComplete="postal-code" inputMode="numeric" />
            </Field>
          </div>
        </div>
      </StepScreen>
    );
  } else if (step === 'caPostal') {
    const postalOk = Boolean(normalizePostalCode(canada.postal));
    screen = (
      <StepScreen
        stepKey="caPostal"
        variant="rasuwa"
        question="What is your postal code?"
        hint="It finds your Member of Parliament. MPs do consular casework for their constituents through Global Affairs Canada."
        error={mpStatus.error}
        primary={{
          label: 'Find my MP',
          onClick: findMpAndAdvance,
          disabled: !postalOk,
          loading: mpStatus.busy,
          loadingLabel: 'Finding your MP…',
        }}
        skip={{ label: 'Enter my MP by hand instead', onClick: enterMpByHand }}
      >
        <div className="max-w-xs">
          <Field label="Postal code">
            <input
              className={inputCls}
              value={canada.postal}
              onChange={(e) => setC({ postal: e.target.value, mp: null })}
              autoComplete="postal-code"
              placeholder="K1A 0A6"
            />
          </Field>
        </div>
      </StepScreen>
    );
  } else if (step === 'members' && where === 'us') {
    screen = (
      <StepScreen
        stepKey="members-us"
        variant="rasuwa"
        question="Your members of Congress"
        hint={
          lookup.status === 'done'
            ? `${lookup.matchedAddress}: district ${lookup.district === 0 ? 'at large' : lookup.district}, ${lookup.state}.`
            : 'Your two senators appear from your state; pick your House district by hand if the lookup could not find it.'
        }
        error={lookup.status === 'error' ? lookup.error : undefined}
        primary={{ label: 'Continue to your letters', onClick: goNext, disabled: recipients.length === 0 }}
        wide
      >
        <div className="space-y-4">
          {lookup.status !== 'done' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your representative (by district)">
                <select className={inputCls} value={manualRep} onChange={(e) => setManualRep(e.target.value)} disabled={!stateInUse}>
                  <option value="">{stateInUse ? 'Pick your district...' : 'Pick your state first'}</option>
                  {stateReps.map((m) => (
                    <option key={m.bioguide} value={m.bioguide}>
                      {m.district === 0 ? 'At large' : `District ${m.district}`}: {m.name} ({m.party})
                    </option>
                  ))}
                </select>
              </Field>
              <p className="self-end text-sm text-midnight-400">
                Not sure of your district?{' '}
                <a className="underline" href={US_LINKS.houseFinder} target="_blank" rel="noopener noreferrer">
                  Look it up on house.gov
                </a>
              </p>
            </div>
          )}

          {recipients.length > 0 ? (
            <ul className="space-y-2">
              {recipients.map((m) => (
                <li key={m.bioguide} className="rounded-2xl border-2 border-midnight-100 bg-white p-4">
                  <p className="font-bold text-midnight-900">
                    {recipientTitle(m)} {m.name} ({m.party}, {m.state}
                    {m.chamber === 'rep' ? `-${m.district === 0 ? 'AL' : m.district}` : ''})
                  </p>
                  <p className="text-sm text-midnight-500 mt-1">
                    DC office: <a className="underline" href={`tel:${m.phone}`}>{m.phone}</a>
                    {m.offices.map((o) => (
                      <span key={`${m.bioguide}-${o.city}-${o.phone}`}>
                        {' '}| {o.city}: <a className="underline" href={`tel:${o.phone}`}>{o.phone}</a>
                      </span>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-midnight-500">
              Pick your state and district and your two senators and representative appear here.
              Territories seat a House delegate and no senators.
            </p>
          )}
          {senators.length === 0 && stateInUse && (
            <p className="text-sm text-midnight-500">
              {stateInUse} has no senators; your House {stateReps.length ? 'delegate' : 'seat'} is listed above once picked.
            </p>
          )}
        </div>
      </StepScreen>
    );
  } else if (step === 'members' && where === 'ca') {
    const showManual = caManual || !canada.mp;
    screen = (
      <StepScreen
        stepKey="members-ca"
        variant="rasuwa"
        question="Your Member of Parliament"
        hint="Your MP's office opens consular cases with Global Affairs Canada for constituents."
        primary={{ label: 'Continue to your letter', onClick: goNext }}
        wide
      >
        <div className="space-y-4">
          {canada.mp && (
            <div className="rounded-2xl border-2 border-midnight-100 bg-white p-4">
              <p className="font-bold text-midnight-900">
                {canada.mp.name}
                {canada.mp.party ? ` (${canada.mp.party})` : ''}
              </p>
              {canada.mp.riding && <p className="text-sm text-midnight-500 mt-0.5">Member of Parliament for {canada.mp.riding}</p>}
              <p className="text-sm text-midnight-500 mt-1">
                {canada.mp.email && <>Email: <span className="font-medium text-midnight-700">{canada.mp.email}</span></>}
                {canada.mp.offices.map((o) => (
                  <span key={`${o.type}-${o.phone}`}>
                    {' '}| {o.type || 'office'}: <a className="underline" href={`tel:${o.phone}`}>{o.phone}</a>
                  </span>
                ))}
              </p>
              <button type="button" className={`mt-2 ${linkBtnCls}`} onClick={() => setCaManual(true)}>
                Not your MP? Enter one by hand
              </button>
            </div>
          )}

          {showManual && (
            <div className="space-y-4">
              <p className="text-sm text-midnight-500">
                Enter your MP (find them with the{' '}
                <a className="underline" href={CANADA_LINKS.findMp.url} target="_blank" rel="noopener noreferrer">
                  official finder on ourcommons.ca
                </a>
                ). You can also continue and fill the name into the letter later.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="MP's name">
                  <input className={inputCls} value={canada.manualName} onChange={(e) => setC({ manualName: e.target.value, mp: null })} />
                </Field>
                <Field label="Riding (electoral district)">
                  <input className={inputCls} value={canada.manualRiding} onChange={(e) => setC({ manualRiding: e.target.value, mp: null })} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="MP's email (from their ourcommons.ca page)">
                    <input className={inputCls} value={canada.manualEmail} onChange={(e) => setC({ manualEmail: e.target.value, mp: null })} inputMode="email" />
                  </Field>
                </div>
              </div>
            </div>
          )}
        </div>
      </StepScreen>
    );
  } else if (step === 'country') {
    screen = (
      <StepScreen
        stepKey="country"
        variant="rasuwa"
        question="Which country do you live in?"
        hint="The letter below is written for a Member of Parliament or consular officer; these links find yours."
        primary={{ label: 'Continue to your letter', onClick: goNext }}
      >
        <div className="space-y-4">
          <Field label="Your country">
            <select className={inputCls} value={writer.country} onChange={(e) => setW({ country: e.target.value })}>
              {COUNTRY_GUIDES.map((g) => <option key={g.country} value={g.country}>{g.country}</option>)}
            </select>
          </Field>
          <ul className="space-y-2 text-midnight-700">
            {guide.findRep && (
              <li>
                <a className="underline" href={guide.findRep.url} target="_blank" rel="noopener noreferrer">{guide.findRep.label}</a>
              </li>
            )}
            {guide.consular && (
              <li>
                <a className="underline" href={guide.consular.url} target="_blank" rel="noopener noreferrer">{guide.consular.label}</a>
              </li>
            )}
            {guide.note && <li className="text-sm text-midnight-500">{guide.note}</li>}
          </ul>
        </div>
      </StepScreen>
    );
  } else if (step === 'letters') {
    screen = (
      <StepScreen
        stepKey="letters"
        variant="rasuwa"
        question={letters.length > 1 ? 'Your letters are ready' : 'Your letter is ready'}
        hint="Edit anything; whatever is in [brackets] still needs filling in. Hand edits are kept unless you change a detail in an earlier step."
        primary={{ label: 'Continue: get it to them', onClick: goNext, disabled: letters.length === 0 }}
        wide
      >
        <div className="space-y-4">
          {editsCleared && (
            <div className="flex items-start justify-between gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>You changed a detail, so the letters were rebuilt to match. Your hand edits to the letter text were replaced.</p>
              <button type="button" className="shrink-0 font-semibold underline" onClick={() => setEditsCleared(false)}>
                OK
              </button>
            </div>
          )}

          {letters.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {letters.map((l, i) => (
                <button
                  key={l.key}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  className={`rounded-full border-2 px-3 py-1 text-sm font-semibold ${
                    i === (active ? letters.indexOf(active) : 0)
                      ? 'border-blue-800 bg-blue-800 text-white'
                      : 'border-midnight-200 bg-white text-midnight-700 hover:bg-midnight-100'
                  }`}
                >
                  {recipientTitle(l.recipient)} {recipientLastName(l.recipient)}
                </button>
              ))}
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className={labelCls}>Subject line (use it on every form, email, and fax)</span>
              <button type="button" className={linkBtnCls} onClick={() => copyText('subject', subject)}>
                {copied === 'subject' ? 'Copied' : 'Copy subject'}
              </button>
            </div>
            <p className="rounded-2xl border-2 border-midnight-100 bg-midnight-100/40 p-3 text-sm text-midnight-800">{subject}</p>
          </div>

          {active && (
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className={labelCls}>
                  Letter{active.recipient.chamber !== 'intl' && active.recipient.name ? ` to ${recipientTitle(active.recipient)} ${recipientLastName(active.recipient)}` : ''}
                </span>
                <span className="flex gap-3">
                  {activeEdited && (
                    <button
                      type="button"
                      className="text-sm text-midnight-500 underline"
                      onClick={() => setOverrides((o) => { const n = { ...o }; delete n[active.key]; return n; })}
                    >
                      Reset to generated text
                    </button>
                  )}
                  <button type="button" className={linkBtnCls} onClick={() => copyText(`letter-${active.key}`, activeBody)}>
                    {copied === `letter-${active.key}` ? 'Copied' : 'Copy letter'}
                  </button>
                </span>
              </div>
              <textarea
                className={`${inputCls} min-h-[340px] font-mono text-sm leading-relaxed`}
                value={activeBody}
                onChange={(e) => {
                  setEditsCleared(false);
                  setOverrides((o) => ({ ...o, [active.key]: e.target.value }));
                }}
              />
            </div>
          )}

          {stillBlank.length > 0 && (
            <p className="text-sm text-amber-800">
              Still blank: {stillBlank.join(', ')}. The letter marks each gap in [brackets].
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-2xl bg-blue-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50"
              onClick={downloadPdf}
              disabled={pdfBusy}
            >
              {pdfBusy ? 'Building PDF...' : `Download PDF (${letters.length === 1 ? '1 letter' : `all ${letters.length} letters`})`}
            </button>
            {canShare && active && (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-2xl border-2 border-midnight-200 bg-white px-4 py-2.5 text-sm font-bold text-midnight-700 hover:bg-midnight-100"
                onClick={shareActiveLetter}
              >
                Share this letter
              </button>
            )}
            <span className="text-sm text-midnight-500">For printing, faxing, and office visits.</span>
          </div>
          <p className="text-sm text-midnight-400">
            Nothing downloaded? Open this page in Safari or Chrome, or use &quot;Copy letter&quot; above.
          </p>
          {unprintable.length > 0 && (
            <p className="text-sm text-amber-800">
              The PDF cannot print these characters: {unprintable.join(' ')}. They will look wrong
              on paper. The letter on this page and &quot;Copy letter&quot; are not affected.
            </p>
          )}
          {pdfError && <p className="text-sm text-red-700">{pdfError}</p>}
        </div>
      </StepScreen>
    );
  } else if (step === 'deliver') {
    screen = (
      <StepScreen
        stepKey="deliver"
        variant="rasuwa"
        question="Get it to them"
        hint="Calls are logged the same day; the letter follows by the channel each office actually reads."
        primary={{ label: 'One last step: finish and be counted', onClick: goNext }}
        wide
      >
        {where === 'us' && (
          <ol className="list-decimal space-y-4 pl-5 text-midnight-700">
            <li>
              <span className="font-semibold">Call first.</span> Call the DC number and one
              district office for each member (numbers on the previous step). The same script
              works on every call:
              <div className="mt-2 rounded-2xl border-2 border-midnight-100 bg-midnight-100/40 p-3 text-sm">
                {phoneScript}
                <div className="mt-2">
                  <button type="button" className={linkBtnCls} onClick={() => copyText('script', phoneScript)}>
                    {copied === 'script' ? 'Copied' : 'Copy script'}
                  </button>
                </div>
              </div>
            </li>
            <li>
              <span className="font-semibold">Submit the letter through each contact form.</span>{' '}
              Congressional offices take constituent mail through webforms, not public email
              addresses. Paste the subject line and the letter.
              <ul className="mt-2 space-y-1 text-sm">
                {recipients.map((m) => (
                  <li key={`form-${m.bioguide}`}>
                    {m.contactForm ? (
                      <a className="underline" href={m.contactForm} target="_blank" rel="noopener noreferrer">
                        Contact form: {recipientTitle(m)} {recipientLastName(m)}
                      </a>
                    ) : m.url ? (
                      <a className="underline" href={m.url} target="_blank" rel="noopener noreferrer">
                        Official site of {recipientTitle(m)} {recipientLastName(m)} (use its Contact page)
                      </a>
                    ) : (
                      <a className="underline" href={US_LINKS.houseFinder} target="_blank" rel="noopener noreferrer">
                        Find the contact page via house.gov
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              {recipients.some((m) => !m.contactForm) && (
                <p className="mt-2 text-sm text-midnight-500">
                  On a member&apos;s site, look for a button that says Contact, Email, or Share Your Opinion.
                </p>
              )}
            </li>
            <li>
              <span className="font-semibold">Ask for the privacy release form.</span> An office
              cannot ask the State Department about a specific person until you sign its
              Privacy Act release. Ask for it on the call, return it the same day.
            </li>
            <li>
              <span className="font-semibold">Print or fax the PDF.</span> Offices still process fax.
              {recipients.some((m) => m.offices && m.offices.some((o) => o.fax)) && (
                <ul className="mt-2 space-y-1 text-sm">
                  {recipients.map((m) =>
                    (m.offices || []).filter((o) => o.fax).slice(0, 2).map((o) => (
                      <li key={`fax-${m.bioguide}-${o.fax}`}>
                        {recipientTitle(m)} {recipientLastName(m)}, {o.city} office fax: {o.fax}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </li>
            <li>
              <span className="font-semibold">If a staffer gives you a direct email address,</span>{' '}
              send the letter there too: same subject line, letter in the body, PDF attached.
            </li>
          </ol>
        )}

        {where === 'ca' && (
          <ol className="list-decimal space-y-4 pl-5 text-midnight-700">
            <li>
              <span className="font-semibold">Email your MP.</span> Canadian MPs take constituent
              email directly{caRecipient.email ? <>: <span className="font-medium">{caRecipient.email}</span></> : ' (the address is on their ourcommons.ca page)'}.
              Press &quot;Copy letter&quot; on the previous step, open a new email, paste the letter,
              and use the subject line above it.
              {caRecipient.email && (
                <div className="mt-2">
                  <a
                    className={linkBtnCls}
                    href={`mailto:${caRecipient.email}?subject=${encodeURIComponent(subject)}`}
                  >
                    Open an email to {caRecipient.name || 'your MP'}
                  </a>
                </div>
              )}
            </li>
            <li>
              <span className="font-semibold">Call the constituency office.</span> Numbers are on
              the MP step. The script:
              <div className="mt-2 rounded-2xl border-2 border-midnight-100 bg-midnight-100/40 p-3 text-sm">
                {phoneScript}
                <div className="mt-2">
                  <button type="button" className={linkBtnCls} onClick={() => copyText('script', phoneScript)}>
                    {copied === 'script' ? 'Copied' : 'Copy script'}
                  </button>
                </div>
              </div>
            </li>
            <li>
              <span className="font-semibold">Mail the printed letter, postage-free.</span>{' '}
              Print the PDF and post it to {CANADA_LINKS.freePost}.
            </li>
            <li>
              <span className="font-semibold">Call Global Affairs Canada yourself too.</span>{' '}
              The Emergency Watch and Response Centre takes family calls any hour:{' '}
              <a className="underline" href={`tel:${CANADA_LINKS.globalAffairsPhone}`}>{CANADA_LINKS.globalAffairsPhone}</a>{' '}
              (collect calls accepted) or {CANADA_LINKS.globalAffairsEmail}. Ask for a case
              file and a named contact for {person.name.trim() || 'your family member'}.
            </li>
          </ol>
        )}

        {where === 'intl' && (
          <ol className="list-decimal space-y-3 pl-5 text-midnight-700">
            <li>Call your foreign ministry&apos;s consular emergency line and ask for a case file and a named contact (links on the country step).</li>
            <li>Send the letter to your Member of Parliament through the official finder, with the subject line above it.</li>
            <li>Download the PDF and attach it wherever attachments are accepted.</li>
            <li>Ask your country&apos;s embassy responsible for Nepal to add your family member to its list of the missing.</li>
          </ol>
        )}
      </StepScreen>
    );
  } else if (step === 'roster') {
    const doneItems = [
      {
        key: 'letters',
        action: 'letters_done',
        label: 'My letters are on their way',
        sub: 'Submitted through the contact forms, emailed, or in the mail.',
        extra: null,
      },
      {
        key: 'entry',
        action: 'entry_sent',
        label: `I sent our entry to ${COORDINATOR_NAME}`,
        sub: 'So the families\' letter and the list of the missing stay complete.',
        extra: (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl bg-blue-800 px-3 py-2 text-sm font-bold text-white hover:bg-blue-900"
              onClick={shareWithCoordinator}
            >
              Email my entry
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border-2 border-midnight-200 bg-white px-3 py-2 text-sm font-bold text-midnight-700 hover:bg-midnight-100"
              onClick={() => {
                const { subject: shareSubject, body } = buildRosterShare({ writer, person });
                copyText('entry', `Subject: ${shareSubject}\n\n${body}`);
              }}
            >
              {copied === 'entry' ? 'Copied' : 'Copy my entry'}
            </button>
            <span className="text-xs text-midnight-400">
              To {coordinatorEmail()}, or call{' '}
              <a className="underline" href={`tel:${coordinatorPhone()}`}>{coordinatorPhone()}</a> (any hour).
            </span>
          </div>
        ),
      },
      {
        key: 'signed',
        action: 'letter_signed',
        label: 'We signed the families\' letter',
        sub: (
          <>
            Not signed yet?{' '}
            <Link className="underline" href="/rasuwa/form">Sign it here</Link>, then check the box.
          </>
        ),
        extra: null,
      },
    ];
    screen = (
      <StepScreen
        stepKey="roster"
        variant="rasuwa"
        question="Check off what you finished"
        hint="Each box adds one to the shared count, so every family can see this working. Nothing about you or your family member is stored; the count is the only thing that moves."
        primary={{ label: 'Finish: start over for the next family', onClick: clearEverything, tone: 'post' }}
      >
        <div className="space-y-5">
          <div className="space-y-3">
            {doneItems.map((item) => (
              <div
                key={item.key}
                className={`rounded-2xl border-2 p-4 transition-colors ${
                  done[item.key] ? 'border-blue-700 bg-blue-50' : 'border-midnight-100 bg-white'
                }`}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={done[item.key]}
                    onChange={() => markDone(item.key)}
                    disabled={done[item.key]}
                    className="mt-1 h-5 w-5 accent-blue-800"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-midnight-900">{item.label}</span>
                    <span className="block text-sm text-midnight-500">{item.sub}</span>
                  </span>
                  {tally && (
                    <span className="shrink-0 text-right">
                      <span className="block text-xl font-extrabold tabular-nums text-blue-800">
                        {(tally[item.action] || 0).toLocaleString('en-US')}
                      </span>
                      <span className="block text-[0.65rem] font-semibold uppercase tracking-wide text-midnight-400">
                        families
                      </span>
                    </span>
                  )}
                </label>
                {item.extra}
              </div>
            ))}
          </div>

          <p className="text-sm text-midnight-500">
            <SignerCount />{' '}
            <Link className="underline" href="/rasuwa/letter">
              Read the live letter and the list of the missing
            </Link>
            ; it updates as the coordinating family adds entries.
          </p>

          <p className="text-xs text-midnight-400 leading-relaxed">
            Facts in the letters are as of {FACTS_DATE}, from the families&apos; letter to the
            Secretary of State. Member data comes from public-domain datasets (Congress updated{' '}
            {directory.updated}). Also useful:{' '}
            <a className="underline" href={US_LINKS.embassyKathmandu} target="_blank" rel="noopener noreferrer">the U.S. Embassy in Kathmandu</a>{' '}
            and <a className="underline" href={US_LINKS.stateDept} target="_blank" rel="noopener noreferrer">travel.state.gov</a>.
            Corrections: email {COORDINATOR_NAME} at{' '}
            <a className="underline" href={`mailto:${coordinatorEmail()}`}>{coordinatorEmail()}</a>.
            Hosted by <Link href="/" className="underline">ReunitePets</Link>.
          </p>
        </div>
      </StepScreen>
    );
  }

  return (
    <RasuwaWizardShell steps={steps} activeStepId={step} summary={summary} preview={sidebarPreview} onBack={goBack}>
      {screen}
    </RasuwaWizardShell>
  );
}
