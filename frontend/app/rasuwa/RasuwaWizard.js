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
import { ExternalLink, Globe2, Landmark, Leaf, UserRound, Users } from 'lucide-react';
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
import { buildLetterRecordPayload, hashLetters } from './letterRecord';
import { normalizePostalCode } from './mpLookup';
import {
  EMPTY_CANADA,
  EMPTY_DONE,
  EMPTY_LOOKUP,
  EMPTY_PERSON,
  EMPTY_SENT,
  EMPTY_WRITER,
  clearRasuwaDraft,
  describeDraft,
  draftHasContent,
  loadRasuwaDraft,
  restoreDraft,
  saveRasuwaDraft,
} from './letterDraft';
import {
  ACCESS_COMEBACK,
  HOME_COMEBACK,
  CANADA_LINKS,
  COUNTRY_GUIDES,
  FACTS_DATE,
  findCountryGuide,
  US_LINKS,
  buildLetterBody,
  buildPhoneScript,
  buildRosterShare,
  buildSubject,
  recipientLastName,
  recipientTitle,
} from './letterData';

const MEMBERS = directory.members;
const PEOPLE = missingPeople.people;

// The picker lists every missing person in one flat alphabetical list
// (founder rule, 2026-08-31: no grouping by nationality, nobody first).
// Option values stay the PEOPLE index so picks and ?for= links hold.
const PEOPLE_ALPHA = PEOPLE.map((p, i) => ({ p, i })).sort((a, b) =>
  a.p.name.localeCompare(b.p.name, 'en', { sensitivity: 'base' })
);

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

// Suggestions only: both country fields are free text, because a
// pick-list without your country reads as a form you cannot fill in
// (founder feedback, 2026-08-31), and a literal "Other" was landing in
// letters as the person's nationality.
const NATIONALITY_SUGGESTIONS = [
  'United States', 'Canada', 'Australia', 'United Kingdom', 'Singapore',
  'France', 'South Africa', 'India', 'Nepal',
];

// Person is optional (founder direction, 2026-09-02): some writers
// stand for everyone on the list rather than one family member.
const FOR_OPTIONS = [
  { value: 'one', label: 'One missing person', sublabel: 'Their details go into every letter', icon: UserRound },
  { value: 'all', label: 'All of the missing', sublabel: `Everyone on the families' list of ${PEOPLE.length}, no one person named`, icon: Users },
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
    sidebarCopy: 'Pick them from the letter\'s list and everything about them fills in, or write for all of the missing at once. Anything you leave blank just shows as a bracket.',
  },
  you: {
    label: 'About you',
    sidebarTitle: 'Offices reply to people.',
    sidebarCopy: 'Where you live decides who your letter goes to. Your name, relationship, and phone go into it so a caseworker can reach you.',
  },
  reps: {
    label: 'Your representatives',
    sidebarTitle: 'The people who can move this.',
    sidebarCopy: 'These offices answer to constituents: they can press for action and open files for the families. The lookup uses your address for nothing else.',
  },
  country: {
    label: 'Your country',
    sidebarTitle: 'Every government has a door.',
    sidebarCopy: 'The letter is written for a Member of Parliament or consular officer; these links find yours.',
  },
  letters: {
    label: 'Send your letters',
    sidebarTitle: 'Ready to send.',
    sidebarCopy: 'Each office has its own copy button and send link, right beside the letter. Work down the list; after sending, the call script makes it count.',
  },
  roster: {
    label: 'Finish and be counted',
    sidebarTitle: 'Every family counts here.',
    sidebarCopy: 'Check off what you finished and watch the shared count move. The families\' letter is the one document coordinators and consular officers work from.',
  },
};

// Six screens, not nine (founder feedback, 2026-08-31: too many steps).
// The person's details ride the first screen, where-you-live opens the
// about-you screen, and the address or postal lookup shares a screen
// with the representatives it finds.
const BASE_STEPS = ['person', 'you'];
const TAIL_STEPS = {
  us: ['reps', 'letters', 'roster'],
  ca: ['reps', 'letters', 'roster'],
  intl: ['country', 'letters', 'roster'],
  '': ['letters', 'roster'],
};
const stepIdsFor = (where) => [...BASE_STEPS, ...TAIL_STEPS[where] ?? TAIL_STEPS['']];

export default function RasuwaWizard() {
  const [step, setStep] = useState('person');
  const [where, setWhere] = useState('');
  // Writing for everyone on the list instead of one person; the person
  // fields keep their values so switching back loses nothing.
  const [forAll, setForAll] = useState(false);
  const [person, setPerson] = useState(EMPTY_PERSON);
  const [writer, setWriter] = useState(EMPTY_WRITER);
  const [canada, setCanada] = useState(EMPTY_CANADA);
  const [lookup, setLookup] = useState(EMPTY_LOOKUP);
  const [manualRep, setManualRep] = useState('');
  // Which recipients are marked sent, and which letter is open to edit.
  const [sent, setSent] = useState(EMPTY_SENT);
  const [openLetter, setOpenLetter] = useState('');
  const [showPaper, setShowPaper] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [copied, setCopied] = useState('');
  const [pdfBusy, setPdfBusy] = useState('');
  const [pdfError, setPdfError] = useState('');
  const [mpStatus, setMpStatus] = useState({ busy: false, error: '' });
  const [caManual, setCaManual] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  // The live signature count, so the letters do not read as frozen at
  // a printed figure. One fetch; letters fall back to the letter's own
  // floor whenever the count is unavailable or not yet larger.
  const [liveSigners, setLiveSigners] = useState(null);
  useEffect(() => {
    let stop = false;
    fetch('/api/rasuwa/roster-count')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!stop && data && data.live && Number.isFinite(Number(data.count))) {
          setLiveSigners(Number(data.count));
        }
      })
      .catch(() => {
        // the dated sentence stands
      });
    return () => {
      stop = true;
    };
  }, []);

  // ── The collective count: finish boxes and the shared tally ────────
  // Checking a box adds one, anonymously, and the number on screen
  // moves; restoring a draft restores the checkmarks without counting
  // them again.
  const [done, setDone] = useState(EMPTY_DONE);
  const [tally, setTally] = useState(null); // { letters_done, entry_sent, letter_signed }
  // Checked boxes whose +1 has not reached the server yet. Kept in the
  // tab draft and retried, so a rate limit, an outage, or a dead
  // connection never loses a family's count while the page claims
  // otherwise.
  const [pendingTally, setPendingTally] = useState([]);
  const pendingTallyRef = useRef(pendingTally);
  pendingTallyRef.current = pendingTally;

  const TALLY_ACTIONS = ['letters_done', 'entry_sent', 'letter_signed'];
  async function flushTally(actions) {
    for (const action of actions) {
      if (!TALLY_ACTIONS.includes(action)) {
        setPendingTally((p) => p.filter((a) => a !== action));
        continue;
      }
      try {
        const res = await fetch('/api/rasuwa/tally', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.counts) setTally(data.counts);
          setPendingTally((p) => p.filter((a) => a !== action));
        }
      } catch {
        // still pending; retried on the next visit to the finish step
      }
    }
  }

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
    flushTally(pendingTallyRef.current);
    return () => {
      stop = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── The families' record of generated letters ──────────────────────
  // Founder instruction: every missing person deserves a letter on
  // record. When the person moves from composing to delivering, one
  // copy of the finished letters is saved (the page says so); the
  // content hash keeps reloads and draft restores from recording the
  // same letters twice.
  const [savedLetterHash, setSavedLetterHash] = useState('');
  const recordLettersRef = useRef(null);
  useEffect(() => {
    if (step !== 'roster') return;
    // The checklist lets people jump ahead, so reaching this step no
    // longer proves a finished pass. Only a complete one goes on the
    // record (review finding: a forward jump must never save a generic
    // unreviewed letter into the public counts). These are the same
    // requirements the step gates ask for along the ordinary path;
    // recipients is read here at run time, after the render defined it.
    const passComplete =
      (forAll || (person.name.trim() !== '' && person.country.trim() !== '')) &&
      where !== '' &&
      writer.name.trim() !== '' &&
      (forAll || writer.relationship.trim() !== '') &&
      isValidPhone(writer.phone) &&
      (where !== 'us' || recipients.length > 0) &&
      (where !== 'intl' || writer.country.trim() !== '');
    if (!passComplete) return;
    const record = recordLettersRef.current;
    if (!record) return;
    const { hash, payload } = record;
    if (!payload || hash === savedLetterHash) return;
    fetch('/api/rasuwa/letters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (res.ok) setSavedLetterHash(hash);
      })
      .catch(() => {
        // records are best-effort; the wizard never blocks on them
      });
    // The gate's inputs are read at run time on purpose: recipients is
    // declared below this effect (deps would hit its TDZ during
    // render), and the values only matter at the moment the step
    // changes to roster.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, savedLetterHash]);

  const DONE_ACTIONS = { letters: 'letters_done', entry: 'entry_sent', signed: 'letter_signed' };
  function markDone(key) {
    if (done[key]) return;
    setDone((d) => ({ ...d, [key]: true }));
    const action = DONE_ACTIONS[key];
    setTally((t) => (t ? { ...t, [action]: (t[action] || 0) + 1 } : t));
    setPendingTally((p) => (p.includes(action) ? p : [...p, action]));
    flushTally([action]);
  }

  // ── Drafts: save on every meaningful change; explicit restore ──────
  // The team board's coverage wall links here as /rasuwa?for=<num> so
  // "write for them" starts with that person already picked. A saved
  // draft still comes first: the prompt shows, and the prefill applies
  // only if the person chooses to start fresh.
  const prefillIdxRef = useRef(-1);
  const prefillAllRef = useRef(false);
  const applyPrefill = () => {
    if (prefillAllRef.current) {
      setForAll(true);
      return;
    }
    const entry = PEOPLE[prefillIdxRef.current];
    if (!entry) return;
    setPerson({
      pick: String(prefillIdxRef.current), name: entry.name, country: entry.country,
      home: entry.home, lastSeenPlace: entry.lastSeenPlace, lastSeenWhen: entry.lastSeenWhen,
      operator: entry.operator, details: '',
    });
  };
  useEffect(() => {
    const forParam = new URLSearchParams(window.location.search).get('for');
    prefillAllRef.current = forParam === 'all';
    const forNum = Number(forParam);
    prefillIdxRef.current = Number.isFinite(forNum) ? PEOPLE.findIndex((p) => p.num === forNum) : -1;
    const d = loadRasuwaDraft();
    if (draftHasContent(d)) {
      setPendingDraft(d);
      return;
    }
    applyPrefill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const state = { person, writer, canada, lookup, manualRep, overrides, step, where, done, sent, savedLetterHash, pendingTally, forAll };
    if (!draftHasContent(state)) return;
    if (pendingDraft) {
      setPendingDraft(null);
      return;
    }
    saveRasuwaDraft(state);
  }, [person, writer, canada, lookup, manualRep, overrides, step, where, done, sent, savedLetterHash, pendingTally, forAll, pendingDraft]);

  function resumeDraft() {
    const d = restoreDraft(pendingDraft);
    setPerson(d.person);
    setWriter(d.writer);
    setCanada(d.canada);
    setLookup(d.lookup);
    setManualRep(d.manualRep);
    setOverrides(d.overrides);
    setWhere(d.where);
    setForAll(d.forAll);
    setDone(d.done);
    setSent(d.sent);
    setSavedLetterHash(d.savedLetterHash);
    setPendingTally(d.pendingTally);
    setStep(stepIdsFor(d.where).includes(d.step) ? d.step : 'person');
    setEditsCleared(d.templateOutdated ? 'template' : '');
    setPendingDraft(null);
  }

  function startFresh() {
    clearRasuwaDraft();
    setPendingDraft(null);
    applyPrefill();
  }

  function clearEverything() {
    if (!window.confirm('Clear everything you typed and start over?')) return;
    setPerson(EMPTY_PERSON);
    setWriter(EMPTY_WRITER);
    setCanada(EMPTY_CANADA);
    setLookup(EMPTY_LOOKUP);
    setManualRep('');
    setOverrides({});
    setWhere('');
    setForAll(false);
    setDone(EMPTY_DONE);
    setSent(EMPTY_SENT);
    setOpenLetter('');
    setShowPaper(false);
    setSavedLetterHash('');
    setPendingTally([]);
    setEditsCleared('');
    setCaManual(false);
    setMpStatus({ busy: false, error: '' });
    setPendingDraft(null);
    clearRasuwaDraft();
    setStep('person');
  }

  // ── Field setters: any detail change invalidates hand-edited letters,
  // never silently (editsCleared puts a notice above the letter). ─────
  // '' | 'details' | 'template': why hand edits were replaced, so the
  // notice above the letter tells the truth about what happened.
  const [editsCleared, setEditsCleared] = useState('');
  const overridesRef = useRef(overrides);
  overridesRef.current = overrides;
  const clearOverrides = () => {
    // A detail change rebuilds the letters, so the per-recipient Sent
    // marks stop describing them too (review finding: a new person or
    // a different MP kept the old mark under the same key). Hand edits
    // additionally get the visible notice.
    setSent((sf) => (Object.keys(sf).length ? EMPTY_SENT : sf));
    if (!Object.keys(overridesRef.current).length) return;
    setOverrides({});
    setEditsCleared('details');
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

  async function runDistrictLookup() {
    setUsBusy(true);
    try {
      await findDistrict();
    } finally {
      setUsBusy(false);
    }
  }

  // ── Canada: MP lookup ──────────────────────────────────────────────
  const mpSeq = useRef(0);
  async function runMpLookup() {
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

  // null person = the general letter, for everyone on the list.
  const letterPerson = forAll ? null : person;
  const letters = recipients.map((recipient) => ({
    recipient,
    key: recipient.bioguide,
    body: buildLetterBody({ recipient, writer, person: letterPerson, signers: liveSigners }),
  }));
  const firstLetter = letters[0] || null;
  const firstBody = firstLetter ? overrides[firstLetter.key] ?? firstLetter.body : '';
  const subject = buildSubject({ writer, person: letterPerson, recipient: firstLetter ? firstLetter.recipient : recipients[0] });
  const unprintable = findUnprintableChars(letters.map((l) => overrides[l.key] ?? l.body).join('\n'));
  const guide = findCountryGuide(writer.country);

  // The letter writes itself in the sidebar as fields fill in; before a
  // real recipient exists a generic consular letter carries the preview,
  // so the person sees their words landing from the first step.
  const previewBody = firstLetter
    ? firstBody
    : buildLetterBody({ recipient: { chamber: 'intl', bioguide: 'intl', name: '' }, writer, person: letterPerson, signers: liveSigners });
  const sidebarPreview =
    step !== 'letters' && (forAll || person.name.trim() || writer.name.trim()) ? previewBody : undefined;

  // Kept current every render so the deliver-step effect above records
  // exactly the letters the person finished with, hand edits included.
  recordLettersRef.current = letters.length
    ? {
        hash: hashLetters(letters.map((l) => overrides[l.key] ?? l.body)),
        payload: buildLetterRecordPayload({ person: letterPerson, where, subject, letters, overrides }),
      }
    : null;

  const stillBlank = [];
  if (!forAll && !person.lastSeenPlace.trim()) stillBlank.push('their last known location');
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

  // One PDF per recipient (founder feedback: each office gets its own
  // letter, so each gets its own file, sendable one at a time).
  async function downloadPdf(letter) {
    setPdfBusy(letter.key);
    setPdfError('');
    try {
      const { buildLetterPdfBlob } = await import('./LetterPdf');
      const blob = await buildLetterPdfBlob({
        letters: [{ body: overrides[letter.key] ?? letter.body }],
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const slugOf = (v, fallback) =>
        (v || fallback).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || fallback;
      const personSlug = forAll ? 'all-the-missing' : slugOf(person.name, 'family');
      const whoSlug =
        letter.recipient.chamber === 'intl'
          ? 'parliament'
          : slugOf(recipientLastName(letter.recipient), 'office');
      a.href = url;
      a.download = `rasuwa-letter-${personSlug}-${whoSlug}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      setPdfError('The PDF could not be built in this browser. Use "Copy the letter" and paste into a document instead.');
    } finally {
      setPdfBusy('');
    }
  }

  async function shareLetter(body) {
    try {
      await navigator.share({ title: subject, text: `${subject}\n\n${body}` });
    } catch {
      // the person closed the share sheet; nothing to do
    }
  }

  const phoneScript = buildPhoneScript({
    recipient: where === 'ca' ? caRecipient : null,
    writer,
    person: letterPerson,
  });

  // Writers inside Nepal ask their own government about accepting the
  // offered help; the consent comeback reads backwards for them.
  const comeback = where === 'intl' && guide.home ? HOME_COMEBACK : ACCESS_COMEBACK;

  // ── Sidebar summary ────────────────────────────────────────────────
  const summary = [];
  if (forAll) summary.push({ text: 'All of the missing' });
  else if (person.name.trim()) summary.push({ text: person.name.trim() });
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

  // Every step after the first offers the same big Back button in the
  // footer, next to Continue (founder feedback: the small header back
  // was too easy to miss).
  const backAction = goBack ? { label: 'Back', onClick: goBack } : undefined;

  // ── Steps ──────────────────────────────────────────────────────────
  let screen = null;

  if (step === 'person') {
    const pickFor = (value) => {
      const next = value === 'all';
      if (next !== forAll) {
        setForAll(next);
        clearOverrides();
      }
    };
    screen = (
      <StepScreen
        stepKey="person"
        variant="rasuwa"
        eyebrow="Missing in the Rasuwa flood"
        question="Who are you writing for?"
        hint={<span><SignerCount /> This wizard turns that letter into your own: for your missing family member, or for everyone on the list at once. It takes about ten minutes.</span>}
        primary={{ label: 'Continue', onClick: goNext, disabled: forAll ? false : !person.name.trim() || !person.country.trim() }}
      >
        <div className="space-y-5">
          <OptionCardGrid options={FOR_OPTIONS} value={forAll ? 'all' : 'one'} onSelect={pickFor} columns={1} variant="rasuwa" />
          {forAll && (
            <p className="text-sm text-midnight-600">
              Your letters will speak for all {PEOPLE.length} people on the families&apos; list, with the
              same demands, and no one person named. Press Continue.
            </p>
          )}
          {!forAll && (
          <Field label="Pick from the letter's list, or add someone">
            <select className={inputCls} value={person.pick} onChange={(e) => pickPerson(e.target.value)}>
              <option value="">Choose a name...</option>
              {PEOPLE_ALPHA.map(({ p, i }) => (
                <option key={p.num} value={i}>{p.name}, {p.country}</option>
              ))}
              <option value="other">Someone not on the list</option>
            </select>
          </Field>
          )}
          {!forAll && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Their full name">
              <input className={inputCls} value={person.name} onChange={(e) => setP({ name: e.target.value })} placeholder="Name of your missing family member" />
            </Field>
            <Field label="Nationality (their country)">
              <input
                className={inputCls}
                value={person.country}
                onChange={(e) => setP({ country: e.target.value })}
                list="rasuwa-nationalities"
                placeholder="Type any country"
              />
              <datalist id="rasuwa-nationalities">
                {NATIONALITY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
          </div>
          )}
          {!forAll && person.name.trim() !== '' && (
            <div>
              <p className="font-bold text-midnight-900">What should the search know?</p>
              <p className="mb-3 mt-0.5 text-sm text-midnight-500">
                All optional. Picked names arrive filled in; anything blank shows as a [bracket] in the letter.
              </p>
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
            </div>
          )}
          <p className="text-sm text-midnight-500">
            <Link className="underline" href="/rasuwa/progress">
              See the chart: who has letters and who has nobody yet
            </Link>
            {' · '}
            <Link
              className="underline"
              href={
                person.pick && person.pick !== 'other' && PEOPLE[Number(person.pick)]
                  ? `/rasuwa/correction?for=${PEOPLE[Number(person.pick)].num}`
                  : '/rasuwa/correction'
              }
            >
              See a mistake in these details? Ask for a correction
            </Link>
          </p>
          <p className="text-sm text-midnight-400">
            What you type stays on your device while you work, kept only in this browser tab
            so a phone call or a reload does not wipe it. The lookups send only your address
            or postal code to find your representatives. When your letters are finished, one
            copy is saved for the families&apos; records, so the campaign can show every missing
            person has letters going out.
          </p>
        </div>
      </StepScreen>
    );
  } else if (step === 'you') {
    const youOk = writer.name.trim() && (forAll || writer.relationship.trim()) && isValidPhone(writer.phone);
    screen = (
      <StepScreen
        stepKey="you"
        variant="rasuwa"
        question="Where do you live?"
        hint="Where you live decides who your letter goes to."
        primary={{ label: 'Continue', onClick: goNext, disabled: !where || !youOk }}
        secondary={backAction}
      >
        <div className="space-y-6">
          <OptionCardGrid options={WHERE_OPTIONS} value={where} onSelect={pickWhere} columns={1} variant="rasuwa" />
          {where && (
            <div>
              <p className="font-bold text-midnight-900">{forAll ? 'How can an office reach you?' : 'How can a caseworker reach you?'}</p>
              <p className="mb-3 mt-0.5 text-sm text-midnight-500">
                {forAll
                  ? 'Your name and phone go into the letter; offices call back.'
                  : 'Your name, relationship, and phone go into the letter; offices call back.'}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name">
                  <input className={inputCls} value={writer.name} onChange={(e) => setW({ name: e.target.value })} autoComplete="name" />
                </Field>
                {!forAll && (
                <Field label="Your relationship to them">
                  <input className={inputCls} value={writer.relationship} onChange={(e) => setW({ relationship: e.target.value })} placeholder="mother, brother, cousin, friend" />
                </Field>
                )}
                <Field label="Your phone">
                  <input className={inputCls} value={writer.phone} onChange={(e) => setW({ phone: e.target.value })} autoComplete="tel" inputMode="tel" />
                </Field>
                <Field label="Your email (optional)">
                  <input className={inputCls} value={writer.email} onChange={(e) => setW({ email: e.target.value })} autoComplete="email" inputMode="email" />
                </Field>
              </div>
            </div>
          )}
        </div>
      </StepScreen>
    );
  } else if (step === 'reps' && where === 'us') {
    const addressOk = writer.street.trim() && writer.city.trim() && writer.state && writer.zip.trim();
    screen = (
      <StepScreen
        stepKey="reps-us"
        variant="rasuwa"
        question="Who are your members of Congress?"
        hint="Your address finds your congressional district and shows offices you live there. It goes into the letter and nowhere else."
        error={lookup.status === 'error' ? lookup.error : undefined}
        primary={{ label: 'Continue to your letters', onClick: goNext, disabled: recipients.length === 0 }}
        secondary={backAction}
        wide
      >
        <div className="space-y-5">
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

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-2xl bg-blue-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50"
              onClick={runDistrictLookup}
              disabled={!addressOk || usBusy}
            >
              {usBusy ? 'Looking up your district...' : 'Find my members of Congress'}
            </button>
            {lookup.status === 'done' && (
              <span className="text-sm font-semibold text-green-700">
                {lookup.matchedAddress}: district {lookup.district === 0 ? 'at large' : lookup.district}, {lookup.state}.
              </span>
            )}
          </div>

          {lookup.status !== 'done' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Or pick your district by hand">
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
              Enter your address and press the button, or pick your state and district by hand;
              your two senators and representative appear here. Territories seat a House
              delegate and no senators.
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
  } else if (step === 'reps' && where === 'ca') {
    const postalOk = Boolean(normalizePostalCode(canada.postal));
    const showManual = caManual || Boolean(canada.manualName || canada.manualRiding || canada.manualEmail);
    screen = (
      <StepScreen
        stepKey="reps-ca"
        variant="rasuwa"
        question="Who is your Member of Parliament?"
        hint="Your postal code finds your MP; it is used for the lookup and nothing else. MPs do consular casework for their constituents through Global Affairs Canada."
        error={mpStatus.error}
        primary={{ label: 'Continue to your letter', onClick: goNext }}
        secondary={backAction}
        wide
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-40">
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
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-2xl bg-blue-800 px-4 py-3 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50"
              onClick={runMpLookup}
              disabled={!postalOk || mpStatus.busy}
            >
              {mpStatus.busy ? 'Finding your MP...' : 'Find my MP'}
            </button>
          </div>

          {!showManual && !canada.mp && (
            <button type="button" className={linkBtnCls} onClick={enterMpByHand}>
              Enter my MP by hand instead
            </button>
          )}

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
        primary={{ label: 'Continue to your letter', onClick: goNext, disabled: !writer.country.trim() }}
        secondary={backAction}
      >
        <div className="space-y-4">
          <Field label="Your country">
            <input
              className={inputCls}
              value={writer.country}
              onChange={(e) => setW({ country: e.target.value })}
              list="rasuwa-countries"
              placeholder="Type any country"
              autoComplete="country-name"
            />
            <datalist id="rasuwa-countries">
              {COUNTRY_GUIDES.slice(0, -1).map((g) => <option key={g.country} value={g.country} />)}
            </datalist>
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
    const sentCount = letters.filter((l) => sent[l.key]).length;
    const allSent = letters.length > 0 && sentCount === letters.length;
    // The screen always points at exactly one next action: the first
    // unsent card wears the Next up mark, marking a card sent walks the
    // mark (and the viewport) down the list, and only when every letter
    // is sent does the finish button take the loud tone (founder
    // feedback, 2026-08-31: the navigation must say what to do next).
    const nextKey = letters.find((l) => !sent[l.key])?.key || '';
    const markSent = (key) => {
      setSent((sf) => {
        const nf = { ...sf, [key]: !sf[key] };
        if (nf[key]) {
          const follow = letters.find((l) => l.key !== key && !nf[l.key]);
          if (follow) {
            setTimeout(() => {
              document.getElementById(`send-card-${follow.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 80);
          }
        }
        return nf;
      });
    };
    const guideLinks = [guide.findRep, guide.consular].filter(Boolean);
    screen = (
      <StepScreen
        stepKey="letters"
        variant="rasuwa"
        question={letters.length > 1 ? 'Send your letters' : 'Send your letter'}
        hint={
          letters.length > 1
            ? `One letter per office, with its buttons beside it: copy the letter, open their form, paste, submit, mark it sent. Do all ${letters.length}.`
            : 'Copy the letter, open the channel beside it, paste, send.'
        }
        primary={
          allSent
            ? { label: 'All sent. Finish and be counted', onClick: goNext, tone: 'post' }
            : { label: 'One last step: finish and be counted', onClick: goNext, disabled: letters.length === 0 }
        }
        secondary={backAction}
        wide
      >
        <div className="space-y-4">
          {editsCleared && (
            <div className="flex items-start justify-between gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>
                {editsCleared === 'template'
                  ? 'The campaign updated the letter wording since you last edited, so the letters were rebuilt. Your hand edits to the letter text were replaced.'
                  : 'You changed a detail, so the letters were rebuilt to match. Your hand edits to the letter text were replaced.'}
              </p>
              <button type="button" className="shrink-0 font-semibold underline" onClick={() => setEditsCleared('')}>
                OK
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {letters.length > 1 ? (
              <p className="text-sm font-semibold text-midnight-600 tabular-nums">
                {sentCount} of {letters.length} sent
              </p>
            ) : <span />}
            <p className="text-sm text-midnight-500">
              Fix a detail:{' '}
              <button type="button" className="underline" onClick={() => goTo('person')}>who is missing</button>
              {' | '}
              <button type="button" className="underline" onClick={() => goTo('you')}>about you</button>
              {stepIds.includes('reps') && (
                <>
                  {' | '}
                  <button type="button" className="underline" onClick={() => goTo('reps')}>your representatives</button>
                </>
              )}
              {stepIds.includes('country') && (
                <>
                  {' | '}
                  <button type="button" className="underline" onClick={() => goTo('country')}>your country</button>
                </>
              )}
            </p>
          </div>

          {letters.map((l, i) => {
            const m = l.recipient;
            const body = overrides[l.key] ?? l.body;
            const edited = overrides[l.key] != null && overrides[l.key] !== l.body;
            const isMp = m.chamber === 'mp';
            const isIntl = m.chamber === 'intl';
            const isSent = Boolean(sent[l.key]);
            const formHref = !isMp && !isIntl ? m.contactForm || m.url || US_LINKS.houseFinder : '';
            const formLabel = !isMp && !isIntl
              ? m.contactForm ? 'Open the contact form' : m.url ? 'Open their site (use Contact)' : 'Find their contact page'
              : '';
            const cardName = isIntl
              ? 'Your Member of Parliament or consular officer'
              : `${recipientTitle(m)} ${m.name || "[your MP's name]"}`;
            const cardSub = isIntl
              ? 'Find them with the links below, then paste the letter.'
              : isMp
                ? m.riding ? `Member of Parliament for ${m.riding}` : 'Member of Parliament'
                : `${m.party}, ${m.state}${m.chamber === 'rep' ? `-${m.district === 0 ? 'AL' : m.district}` : ''}`;
            const isNext = !isSent && l.key === nextKey && letters.length > 1;
            return (
              <article
                key={l.key}
                id={`send-card-${l.key}`}
                className={`rounded-2xl border-2 p-4 transition-colors ${
                  isSent
                    ? 'border-green-300 bg-green-50/60'
                    : isNext
                      ? 'border-blue-700 ring-2 ring-blue-200 bg-white'
                      : 'border-midnight-100 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-midnight-900">
                      {isNext && (
                        <span className="mr-2 inline-block rounded-full bg-blue-800 px-2 py-0.5 align-middle text-[0.65rem] font-black uppercase tracking-wide text-white">
                          Next up
                        </span>
                      )}
                      {letters.length > 1 ? `${i + 1}. ` : ''}{cardName}
                    </p>
                    <p className="text-sm text-midnight-500 mt-0.5">{cardSub}</p>
                  </div>
                  <label className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-sm font-semibold ${isSent ? 'border-green-400 bg-green-100 text-green-800' : 'border-midnight-200 text-midnight-600'}`}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-green-700"
                      checked={isSent}
                      onChange={() => markSent(l.key)}
                    />
                    Sent
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-xl bg-blue-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-900"
                    onClick={() => copyText(`letter-${l.key}`, body)}
                  >
                    {copied === `letter-${l.key}` ? 'Copied' : 'Copy the letter'}
                  </button>
                  {formHref && (
                    <a
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-blue-800 bg-white px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50"
                      href={formHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {formLabel}
                      <ExternalLink size={14} />
                    </a>
                  )}
                  {isMp && (
                    m.email ? (
                      <a
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-blue-800 bg-white px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50"
                        href={`mailto:${m.email}?subject=${encodeURIComponent(subject)}`}
                      >
                        Open an email to your MP
                      </a>
                    ) : (
                      <a
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-blue-800 bg-white px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50"
                        href={CANADA_LINKS.findMp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Find your MP and their email
                        <ExternalLink size={14} />
                      </a>
                    )
                  )}
                  {canShare && (
                    <button type="button" className={linkBtnCls} onClick={() => shareLetter(body)}>
                      Share
                    </button>
                  )}
                </div>

                <p className="mt-2.5 text-xs text-midnight-500">
                  {isMp ? 'Email subject' : isIntl ? 'Subject' : 'The form asks for a subject'}:{' '}
                  <button type="button" className="font-semibold text-blue-800 underline" onClick={() => copyText(`subject-${l.key}`, subject)}>
                    {copied === `subject-${l.key}` ? 'Copied' : 'copy the subject line'}
                  </button>
                </p>

                {isIntl && guideLinks.length > 0 && (
                  <p className="mt-2 text-sm text-midnight-600">
                    {guideLinks.map((link, gi) => (
                      <span key={link.url}>
                        {gi > 0 && ' | '}
                        <a className="underline" href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
                      </span>
                    ))}
                  </p>
                )}

                <div className="mt-2.5">
                  <button
                    type="button"
                    className="text-sm font-medium text-midnight-500 underline underline-offset-2"
                    onClick={() => setOpenLetter((k) => (k === l.key ? '' : l.key))}
                  >
                    {openLetter === l.key ? 'Hide the letter' : edited ? 'Read or edit the letter (edited)' : 'Read or edit the letter'}
                  </button>
                  {openLetter === l.key && (
                    <div className="mt-2">
                      {edited && (
                        <button
                          type="button"
                          className="mb-1 text-sm text-midnight-500 underline"
                          onClick={() => setOverrides((o) => { const n = { ...o }; delete n[l.key]; return n; })}
                        >
                          Reset to generated text
                        </button>
                      )}
                      <textarea
                        className={`${inputCls} min-h-[300px] font-mono text-sm leading-relaxed`}
                        value={body}
                        onChange={(e) => {
                          setEditsCleared('');
                          setOverrides((o) => ({ ...o, [l.key]: e.target.value }));
                        }}
                      />
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {stillBlank.length > 0 && (
            <p className="text-sm text-amber-800">
              Still blank: {stillBlank.join(', ')}. The letter marks each gap in [brackets].
            </p>
          )}

          <div className="rounded-2xl border-2 border-midnight-100 bg-white p-4 space-y-3">
            <p className="font-bold text-midnight-900">Sent? A call makes it count.</p>
            {where === 'us' && (
              <>
                <p className="text-sm text-midnight-600">
                  {forAll
                    ? 'Offices log constituent calls the same day. Call the DC number for each member; the same script works on every call, and a staffer can put your support for the families\' requests on the record. If they give you a direct email address, send the letter there too.'
                    : `Offices log constituent calls the same day. Call the DC number for each member; the same script works on every call. On the call, ask for the office's privacy release form: an office cannot ask the State Department about a specific person until you sign it. Return it the same day, and if a staffer gives you a direct email address, send the letter there too. Separately, any police department can act today: ask your local police to open a missing person case for ${person.name.trim() || 'your family member'} and send an emergency disclosure request to Google and their phone carrier for their last known location.`}
                </p>
                <ul className="text-sm text-midnight-600 space-y-0.5">
                  {recipients.map((m) => (
                    <li key={`call-${m.bioguide}`}>
                      {recipientTitle(m)} {recipientLastName(m)}: <a className="underline" href={`tel:${m.phone}`}>{m.phone}</a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {where === 'ca' && (
              <p className="text-sm text-midnight-600">
                Call your MP&apos;s constituency office (numbers on the representatives step), and call Global Affairs Canada yourself too: the Emergency Watch and Response Centre takes family calls any hour at{' '}
                <a className="underline" href={`tel:${CANADA_LINKS.globalAffairsPhone}`}>{CANADA_LINKS.globalAffairsPhone}</a>{' '}
                (collect calls accepted) or {CANADA_LINKS.globalAffairsEmail}.{' '}
                {forAll
                  ? 'Ask what Canada has offered against Nepal\'s public request for technical support and for a named contact for every Canadian family.'
                  : `Ask for a case file and a named contact for ${person.name.trim() || 'your family member'}.`}
              </p>
            )}
            {where === 'intl' && (
              <p className="text-sm text-midnight-600">
                {guide.home
                  ? (forAll
                      ? 'Call your representative\'s office with the same details, and ask when the requested equipment and crews reach the valley.'
                      : `Call your representative's office with the same details, and ask who in the search coordination takes family reports for ${person.name.trim() || 'your family member'}.`)
                  : (forAll
                      ? `Call the consular emergency line at ${guide.ministry || 'your foreign ministry'} and ask what our government has offered against Nepal's public request for technical support, and when it arrives.`
                      : `Call the consular emergency line at ${guide.ministry || 'your foreign ministry'}, ask for a case file and a named contact, and ask your country's embassy responsible for Nepal to add ${person.name.trim() || 'your family member'} to its list of the missing.`)}
              </p>
            )}
            {(where === 'us' || where === 'ca') && (
              <div className="rounded-xl border-2 border-midnight-100 bg-midnight-100/40 p-3 text-sm">
                {phoneScript}
                <div className="mt-2">
                  <button type="button" className={linkBtnCls} onClick={() => copyText('script', phoneScript)}>
                    {copied === 'script' ? 'Copied' : 'Copy script'}
                  </button>
                </div>
              </div>
            )}
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3">
              <p className="text-sm font-bold text-midnight-900">{comeback.title}</p>
              <p className="mt-1.5 rounded-lg bg-white border border-blue-200 p-2.5 text-sm text-midnight-800">
                &quot;{comeback.ask}&quot;
              </p>
              <div className="mt-1.5">
                <button type="button" className={linkBtnCls} onClick={() => copyText('comeback', comeback.ask)}>
                  {copied === 'comeback' ? 'Copied' : 'Copy the question'}
                </button>
              </div>
              <p className="mt-1.5 text-sm text-midnight-600 leading-relaxed">{comeback.note}</p>
            </div>
          </div>

          <div>
            <button
              type="button"
              className="text-sm font-semibold text-midnight-500 underline underline-offset-2"
              onClick={() => setShowPaper((v) => !v)}
            >
              {showPaper ? 'Hide paper, fax, and PDF' : 'Prefer paper, fax, or a PDF?'}
            </button>
            {showPaper && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {letters.map((l) => (
                    <button
                      key={`pdf-${l.key}`}
                      type="button"
                      className="inline-flex items-center justify-center rounded-2xl bg-blue-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-900 disabled:opacity-50"
                      onClick={() => downloadPdf(l)}
                      disabled={Boolean(pdfBusy)}
                    >
                      {pdfBusy === l.key
                        ? 'Building PDF...'
                        : l.recipient.chamber === 'intl'
                          ? 'Download the letter as a PDF'
                          : `PDF: ${recipientTitle(l.recipient)} ${recipientLastName(l.recipient)}`}
                    </button>
                  ))}
                  <span className="text-sm text-midnight-500">One file per office.</span>
                </div>
                <p className="text-sm text-midnight-400">
                  Nothing downloaded? Open this page in Safari or Chrome, or use &quot;Copy the letter&quot; above.
                </p>
                {where === 'us' && recipients.some((m) => m.offices && m.offices.some((o) => o.fax)) && (
                  <ul className="text-sm text-midnight-600 space-y-0.5">
                    {recipients.map((m) =>
                      (m.offices || []).filter((o) => o.fax).slice(0, 2).map((o) => (
                        <li key={`fax-${m.bioguide}-${o.fax}`}>
                          {recipientTitle(m)} {recipientLastName(m)}, {o.city} office fax: {o.fax}
                        </li>
                      ))
                    )}
                  </ul>
                )}
                {where === 'ca' && (
                  <p className="text-sm text-midnight-600">
                    Print the PDF and post it, postage-free, to {CANADA_LINKS.freePost}.
                  </p>
                )}
                {unprintable.length > 0 && (
                  <p className="text-sm text-amber-800">
                    The PDF cannot print these characters: {unprintable.join(' ')}. They will look wrong
                    on paper. The letters on this page and &quot;Copy the letter&quot; are not affected.
                  </p>
                )}
                {pdfError && <p className="text-sm text-red-700">{pdfError}</p>}
              </div>
            )}
          </div>
        </div>
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
      // A general letter has no one person to add to the list, so the
      // entry box only shows when someone was named.
      ...(forAll ? [] : [{
        key: 'entry',
        action: 'entry_sent',
        label: 'Our entry is on the families\' list',
        sub: 'The list of the missing grows through the family form; entries there reach the coordinating families.',
        extra: (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              className="inline-flex items-center justify-center rounded-xl bg-blue-800 px-3 py-2 text-sm font-bold text-white hover:bg-blue-900"
              href="/rasuwa/form"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open the family form
            </a>
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
              The copy button gives your entry as text, ready to paste into the form or the group chat.
            </span>
          </div>
        ),
      }]),
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
        secondary={backAction}
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
            <Link className="underline" href="/rasuwa/progress">
              See the chart: letters for every missing person
            </Link>
            , and{' '}
            <Link className="underline" href="/rasuwa/letter">
              read the live letter and the list of the missing
            </Link>
            ; both update as the campaign moves.
          </p>

          <p className="text-xs text-midnight-400 leading-relaxed">
            Facts in the letters are as of {FACTS_DATE}, from the families&apos; letter to the
            Secretary of State. Member data comes from public-domain datasets (Congress updated{' '}
            {directory.updated}). Also useful:{' '}
            <a className="underline" href={US_LINKS.embassyKathmandu} target="_blank" rel="noopener noreferrer">the U.S. Embassy in Kathmandu</a>{' '}
            and <a className="underline" href={US_LINKS.stateDept} target="_blank" rel="noopener noreferrer">travel.state.gov</a>.
            Corrections to the list go through the{' '}
            <Link className="underline" href="/rasuwa/form">family form</Link>.
            Hosted by <Link href="/" className="underline">ReunitePets</Link>.
          </p>
        </div>
      </StepScreen>
    );
  }

  return (
    <RasuwaWizardShell
      steps={steps}
      activeStepId={step}
      summary={summary}
      preview={sidebarPreview}
      onBack={goBack}
      onStepSelect={goTo}
    >
      {screen}
    </RasuwaWizardShell>
  );
}
