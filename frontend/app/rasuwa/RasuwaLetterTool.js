'use client';

/**
 * The /rasuwa letter tool. Client-side on purpose: what a family types
 * about a missing person and about themselves stays in the browser. The
 * only network call is the district lookup (api/rasuwa/district), which
 * forwards the entered address to the Census geocoder and stores nothing.
 *
 * Entries are kept as a draft in this browser tab (letterDraft.js): the
 * flow tells people to switch apps to call offices, phones discard
 * backgrounded tabs, and without a draft they come back to an empty
 * form. The draft dies with the tab; restoring it is an explicit choice.
 *
 * Flow: pick or enter the missing person, enter your own details, find
 * your members of Congress (or your country's contacts), then copy the
 * letter into each office's contact form, call with the script, and
 * download the PDF for printing and faxing.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { US_STATES } from '@/app/lib/states';
import directory from './congress-directory.json';
import missingPeople from './missing-people.json';
import { findUnprintableChars } from './pdfText';
import SignerCount from './SignerCount';
import {
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
  COORDINATOR_NAME,
  COUNTRY_GUIDES,
  FACTS_DATE,
  ROSTER_FORM_URL,
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
  'United States', 'Australia', 'Canada', 'United Kingdom', 'Singapore',
  'France', 'South Africa', 'India', 'Nepal', 'Other',
];

const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none';
const labelCls = 'mb-1 block text-sm font-medium text-slate-700';
const buttonCls =
  'inline-flex items-center justify-center rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50';
const buttonLightCls =
  'inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

function StepCard({ number, title, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-slate-900">
        <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function RasuwaLetterTool() {
  const [person, setPerson] = useState(EMPTY_PERSON);
  const [writer, setWriter] = useState(EMPTY_WRITER);
  const [lookup, setLookup] = useState(EMPTY_LOOKUP);
  const [manualRep, setManualRep] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [overrides, setOverrides] = useState({});
  const [copied, setCopied] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  // The native share sheet (send the letter to yourself over WhatsApp,
  // mail, notes) exists mostly on phones; detected after mount so the
  // server render stays stable.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);
  // A draft found at mount, waiting on the person's continue-or-fresh
  // choice. While it waits, autosave pauses so the empty form cannot
  // overwrite it.
  const [pendingDraft, setPendingDraft] = useState(null);

  useEffect(() => {
    const d = loadRasuwaDraft();
    if (draftHasContent(d)) setPendingDraft(d);
  }, []);

  // Save on every meaningful change. Typing while the restore banner is
  // up counts as choosing to start fresh: the banner goes away and the
  // new entries take over the draft slot.
  useEffect(() => {
    const state = { person, writer, lookup, manualRep, overrides };
    if (!draftHasContent(state)) return;
    if (pendingDraft) {
      setPendingDraft(null);
      return;
    }
    saveRasuwaDraft(state);
  }, [person, writer, lookup, manualRep, overrides, pendingDraft]);

  function resumeDraft() {
    const d = restoreDraft(pendingDraft);
    setPerson(d.person);
    setWriter(d.writer);
    setLookup(d.lookup);
    setManualRep(d.manualRep);
    setOverrides(d.overrides);
    setEditsCleared(false);
    setPendingDraft(null);
  }

  function startFresh() {
    clearRasuwaDraft();
    setPendingDraft(null);
  }

  function clearEverything() {
    if (!window.confirm('Clear everything you typed on this page?')) return;
    setPerson(EMPTY_PERSON);
    setWriter(EMPTY_WRITER);
    setLookup(EMPTY_LOOKUP);
    setManualRep('');
    setOverrides({});
    setActiveIdx(0);
    setEditsCleared(false);
    setPendingDraft(null);
    clearRasuwaDraft();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const dirty = draftHasContent({ person, writer, lookup, manualRep, overrides });

  // Any change to the person or writer invalidates hand-edited letter
  // text: a kept override would freeze the previous person's details
  // into the letter and the PDF. Never silently: editsCleared puts a
  // notice above the letter saying the hand edits were replaced.
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
  // Street, city, and ZIP feed the district lookup; editing them after
  // a successful lookup invalidates the representative it found, and
  // editing them mid-lookup invalidates the response still in flight.
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

  // Editing the address mid-lookup resets the state; a response landing
  // after that must not resurrect itself. Each lookup takes a sequence
  // number and only the latest one may apply its result.
  const lookupSeq = useRef(0);

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
          error: 'A lot of people are using this right now. Wait a minute and press "Find my district" again, or pick your state and district by hand below.',
        });
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        applyLookup({ ...EMPTY_LOOKUP, status: 'error', error: data.error || 'The lookup failed. Pick your state by hand below.' });
        return;
      }
      applyLookup({ status: 'done', error: '', state: data.state, district: data.district, matchedAddress: data.matchedAddress });
      // The letter and its subject line say which state the writer lives
      // in; they must match the members the lookup found (a hand-picked
      // state can disagree with where the address really is).
      if (lookupSeq.current === seq && writer.state !== data.state) setW({ state: data.state });
    } catch {
      applyLookup({ ...EMPTY_LOOKUP, status: 'error', error: 'The lookup failed. Pick your state by hand below.' });
    }
  }

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

  const recipients = writer.inUS
    ? [...senators, ...(districtRep ? [districtRep] : [])]
    : [{ chamber: 'intl', bioguide: 'intl', name: '' }];

  const subject = buildSubject({ writer, person });
  const letters = recipients.map((recipient) => ({
    recipient,
    key: recipient.bioguide,
    body: buildLetterBody({ recipient, writer, person }),
  }));
  const active = letters[Math.min(activeIdx, Math.max(letters.length - 1, 0))] || null;
  const activeBody = active ? overrides[active.key] ?? active.body : '';
  const activeEdited = active ? overrides[active.key] != null && overrides[active.key] !== active.body : false;
  const unprintable = findUnprintableChars(letters.map((l) => overrides[l.key] ?? l.body).join('\n'));

  // The letter marks gaps in [brackets], but a person pasting into a
  // webform may not scan for them; name what is still blank out loud.
  const stillBlank = [];
  if (!person.name.trim()) stillBlank.push("the missing person's name");
  if (!person.lastSeenPlace.trim()) stillBlank.push('their last known location');
  if (!writer.name.trim()) stillBlank.push('your name');
  if (!writer.relationship.trim()) stillBlank.push('your relationship to them');
  if (!writer.phone.trim()) stillBlank.push('your phone number');
  if (writer.inUS && !(writer.street.trim() && writer.city.trim() && writer.state && writer.zip.trim())) {
    stillBlank.push('your address');
  }

  // One script works on every call, so it never names the wrong office
  // while the person dials down the list in step 3.
  const phoneScript = buildPhoneScript({ recipient: null, writer, person });

  async function shareActiveLetter() {
    try {
      await navigator.share({ title: subject, text: `${subject}\n\n${activeBody}` });
    } catch {
      // the person closed the share sheet; nothing to do
    }
  }

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

  function shareWithCoordinator() {
    const { subject: shareSubject, body } = buildRosterShare({ writer, person });
    window.location.href = `mailto:${coordinatorEmail()}?subject=${encodeURIComponent(shareSubject)}&body=${encodeURIComponent(body)}`;
  }

  const guide = COUNTRY_GUIDES.find((g) => g.country === writer.country) || COUNTRY_GUIDES[COUNTRY_GUIDES.length - 1];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-800">Rasuwa flood, Nepal</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            Missing in the Rasuwa flood: write to your representatives
          </h1>
          <p className="mt-3 text-slate-700">
            On August 29, the family members and friends of 57 missing people wrote to the
            U.S. Secretary of State asking for seven rescue actions. <SignerCount /> This page
            turns that letter into your own: one letter to each of your members of Congress
            with your loved one&apos;s details, the phone numbers to call, and the forms to
            submit it through. It takes about ten minutes.
          </p>
          <div className="mt-3 rounded-md bg-slate-100 p-3 text-sm text-slate-700">
            <p>
              What you type here stays on your device. This page has no database. Your entries
              are kept in this browser tab so a phone call or an accidental reload does not wipe
              them; close the tab and they are gone. The one exception: when you press &quot;Find my
              district&quot;, the address you entered goes to the U.S. Census geocoder to identify
              your congressional district.
            </p>
            {dirty && (
              <button type="button" className="mt-2 font-medium underline" onClick={clearEverything}>
                Clear everything I typed
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        {pendingDraft && (
          <section className="rounded-lg border border-blue-300 bg-blue-50 p-5 shadow-sm">
            <p className="font-bold text-slate-900">Pick up where you left off?</p>
            <p className="mt-1 text-sm text-slate-700">
              This tab still has {describeDraft(pendingDraft)}. Continue with it, or start fresh.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" className={buttonCls} onClick={resumeDraft}>
                Continue where I left off
              </button>
              <button type="button" className={buttonLightCls} onClick={startFresh}>
                Start fresh
              </button>
            </div>
          </section>
        )}
        <StepCard number={1} title="Who is missing">
          <div className="space-y-4">
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
              <Field label="Full name">
                <input className={inputCls} value={person.name} onChange={(e) => setP({ name: e.target.value })} placeholder="Name of your missing family member" />
              </Field>
              <Field label="Nationality">
                <select className={inputCls} value={person.country} onChange={(e) => setP({ country: e.target.value })}>
                  {NATIONALITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
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
            </div>
            <Field label="Anything else the search should know (optional)">
              <textarea
                className={`${inputCls} min-h-[70px]`}
                value={person.details}
                onChange={(e) => setP({ details: e.target.value })}
                placeholder="Last phone contact, medical needs, who they were with"
              />
            </Field>
          </div>
        </StepCard>

        <StepCard number={2} title="About you">
          <div className="space-y-4">
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
              <Field label="Your email">
                <input className={inputCls} value={writer.email} onChange={(e) => setW({ email: e.target.value })} autoComplete="email" inputMode="email" />
              </Field>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-slate-800">
              <label className="flex items-center gap-2">
                <input type="radio" name="inUS" checked={writer.inUS} onChange={() => setW({ inUS: true })} />
                I live in the United States
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="inUS" checked={!writer.inUS} onChange={() => setW({ inUS: false })} />
                I live in another country
              </label>
            </div>
            {writer.inUS ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Street address (offices check that writers are constituents; it also finds your district)">
                    <input className={inputCls} value={writer.street} onChange={(e) => setAddressField({ street: e.target.value })} autoComplete="street-address" placeholder="Street address" />
                  </Field>
                </div>
                <Field label="City">
                  <input className={inputCls} value={writer.city} onChange={(e) => setAddressField({ city: e.target.value })} autoComplete="address-level2" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="State">
                    <select className={inputCls} value={writer.state} onChange={(e) => { setAddressField({ state: e.target.value }); setManualRep(''); }}>
                      <option value="">Choose your state...</option>
                      {STATE_OPTIONS.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
                    </select>
                  </Field>
                  <Field label="ZIP">
                    <input className={inputCls} value={writer.zip} onChange={(e) => setAddressField({ zip: e.target.value })} autoComplete="postal-code" inputMode="numeric" />
                  </Field>
                </div>
              </div>
            ) : (
              <Field label="Your country">
                <select className={inputCls} value={writer.country} onChange={(e) => setW({ country: e.target.value })}>
                  {COUNTRY_GUIDES.map((g) => <option key={g.country} value={g.country}>{g.country}</option>)}
                </select>
              </Field>
            )}
          </div>
        </StepCard>

        {writer.inUS ? (
          <StepCard number={3} title="Your members of Congress">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={buttonCls}
                  onClick={findDistrict}
                  disabled={lookup.status === 'busy' || !writer.street.trim() || !writer.city.trim()}
                >
                  {lookup.status === 'busy' ? 'Looking up your district...' : 'Find my district'}
                </button>
                {lookup.status === 'done' && (
                  <span className="text-sm text-slate-600">
                    {lookup.matchedAddress}: district {lookup.district === 0 ? 'at large' : lookup.district}, {lookup.state}.{' '}
                    <button type="button" className="underline" onClick={() => setLookup(EMPTY_LOOKUP)}>
                      Wrong? Pick by hand
                    </button>
                  </span>
                )}
              </div>
              {lookup.status === 'error' && <p className="text-sm text-red-700">{lookup.error}</p>}

              {lookup.status !== 'done' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Or pick your representative by hand">
                    <select className={inputCls} value={manualRep} onChange={(e) => setManualRep(e.target.value)} disabled={!stateInUse}>
                      <option value="">{stateInUse ? 'Pick your district...' : 'Pick your state first'}</option>
                      {stateReps.map((m) => (
                        <option key={m.bioguide} value={m.bioguide}>
                          {m.district === 0 ? 'At large' : `District ${m.district}`}: {m.name} ({m.party})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <p className="self-end text-sm text-slate-600">
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
                    <li key={m.bioguide} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                      <p className="font-semibold">
                        {recipientTitle(m)} {m.name} ({m.party}, {m.state}
                        {m.chamber === 'rep' ? `-${m.district === 0 ? 'AL' : m.district}` : ''})
                      </p>
                      <p className="text-sm text-slate-700">
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
                <p className="text-sm text-slate-600">
                  Pick your state and district (or use &quot;Find my district&quot;) and your two senators
                  and representative appear here. Territories seat a House delegate and no senators.
                </p>
              )}
              {senators.length === 0 && stateInUse && (
                <p className="text-sm text-slate-600">
                  {stateInUse} has no senators; your House {stateReps.length ? 'delegate' : 'seat'} is listed above once picked.
                </p>
              )}
            </div>
          </StepCard>
        ) : (
          <StepCard number={3} title={`Contacts for ${writer.country}`}>
            <ul className="space-y-2 text-slate-800">
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
              {guide.note && <li>{guide.note}</li>}
              <li className="text-sm text-slate-600">
                The letter below is written for a Member of Parliament or consular officer.
                Add the name and office at the top after you copy it.
              </li>
            </ul>
          </StepCard>
        )}

        <StepCard number={4} title="Your letter">
          {letters.length === 0 ? (
            <p className="text-sm text-slate-600">Pick your members of Congress in step 3 and the letters appear here.</p>
          ) : (
            <div className="space-y-4">
              {editsCleared && (
                <div className="flex items-start justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <p>
                    You changed a detail above, so the letters were rebuilt to match. Your hand
                    edits to the letter text were replaced.
                  </p>
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
                      className={`rounded-full border px-3 py-1 text-sm font-medium ${
                        i === (active ? letters.indexOf(active) : 0)
                          ? 'border-blue-800 bg-blue-800 text-white'
                          : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
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
                  <button type="button" className="text-sm font-semibold text-blue-800 underline" onClick={() => copyText('subject', subject)}>
                    {copied === 'subject' ? 'Copied' : 'Copy subject'}
                  </button>
                </div>
                <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">{subject}</p>
              </div>

              {active && (
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className={labelCls}>
                      Letter{active.recipient.chamber !== 'intl' ? ` to ${recipientTitle(active.recipient)} ${recipientLastName(active.recipient)}` : ''} (edit it freely; anything in [brackets] still needs filling in)
                    </span>
                    <span className="flex gap-3">
                      {activeEdited && (
                        <button
                          type="button"
                          className="text-sm text-slate-600 underline"
                          onClick={() => setOverrides((o) => { const n = { ...o }; delete n[active.key]; return n; })}
                        >
                          Reset to generated text
                        </button>
                      )}
                      <button type="button" className="text-sm font-semibold text-blue-800 underline" onClick={() => copyText(`letter-${active.key}`, activeBody)}>
                        {copied === `letter-${active.key}` ? 'Copied' : 'Copy letter'}
                      </button>
                    </span>
                  </div>
                  <textarea
                    className={`${inputCls} min-h-[380px] font-mono text-sm leading-relaxed`}
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
                <button type="button" className={buttonCls} onClick={downloadPdf} disabled={pdfBusy}>
                  {pdfBusy ? 'Building PDF...' : `Download PDF (${letters.length === 1 ? '1 letter' : `all ${letters.length} letters`})`}
                </button>
                {canShare && active && (
                  <button type="button" className={buttonLightCls} onClick={shareActiveLetter}>
                    Share this letter
                  </button>
                )}
                <span className="text-sm text-slate-600">For printing, faxing, and office visits.</span>
              </div>
              <p className="text-sm text-slate-500">
                Nothing downloaded? Open this page in Safari or Chrome, or use &quot;Copy letter&quot; above.
              </p>
              {unprintable.length > 0 && (
                <p className="text-sm text-amber-800">
                  The PDF cannot print these characters: {unprintable.join(' ')}. They will look
                  wrong on paper. The letter on this page and &quot;Copy letter&quot; are not affected.
                </p>
              )}
              {pdfError && <p className="text-sm text-red-700">{pdfError}</p>}
            </div>
          )}
        </StepCard>

        <StepCard number={5} title="Get it to them">
          {writer.inUS ? (
            <ol className="list-decimal space-y-4 pl-5 text-slate-800">
              <li>
                <span className="font-semibold">Call first.</span> Calls are logged the same day.
                Call the DC number and one district office for each member (numbers in step 3).
                The same script works on every call:
                <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                  {phoneScript}
                  <div className="mt-2">
                    <button
                      type="button"
                      className="text-sm font-semibold text-blue-800 underline"
                      onClick={() => copyText('script', phoneScript)}
                    >
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
                  <p className="mt-2 text-sm text-slate-600">
                    On a member&apos;s site, look for a button that says Contact, Email, or Share
                    Your Opinion.
                  </p>
                )}
              </li>
              <li>
                <span className="font-semibold">Ask for the privacy release form.</span> An office
                cannot ask the State Department about a specific person until you sign its
                Privacy Act release. Ask for it on the call, return it the same day.
              </li>
              <li>
                <span className="font-semibold">Print or fax the PDF.</span> Offices still process
                fax.
                {recipients.some((m) => m.offices.some((o) => o.fax)) && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {recipients.map((m) =>
                      m.offices.filter((o) => o.fax).slice(0, 2).map((o) => (
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
          ) : (
            <ol className="list-decimal space-y-3 pl-5 text-slate-800">
              <li>Call your foreign ministry&apos;s consular emergency line and ask for a case file and a named contact (links in step 3).</li>
              <li>Send the letter to your Member of Parliament through the official finder in step 3, with the subject line above.</li>
              <li>Download the PDF and attach it wherever attachments are accepted.</li>
              <li>Ask your country&apos;s embassy responsible for Nepal to add your family member to its list of the missing.</li>
            </ol>
          )}
        </StepCard>

        <StepCard number={6} title="Send your entry to the coordinating family">
          <p className="text-slate-800">
            One consolidated roster is what search coordinators and consular officers ask for.
            The joint letter is coordinated by {COORDINATOR_NAME}. Send them your entry so the
            roster and the letters stay in step; the email includes a consent line for adding
            the entry to future letters.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" className={buttonLightCls} onClick={shareWithCoordinator}>
              Email my entry to the coordinating family
            </button>
            <button
              type="button"
              className={buttonLightCls}
              onClick={() => {
                const { subject: shareSubject, body } = buildRosterShare({ writer, person });
                copyText('entry', `Subject: ${shareSubject}\n\n${body}`);
              }}
            >
              {copied === 'entry' ? 'Copied' : 'Copy my entry'}
            </button>
            <span className="text-sm text-slate-600">
              Or call <a className="underline" href={`tel:${coordinatorPhone()}`}>{coordinatorPhone()}</a> (any hour).
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            If the email button does nothing in this browser, press &quot;Copy my entry&quot; and paste
            it into a message to {coordinatorEmail()}.
          </p>
          {ROSTER_FORM_URL && (
            <p className="mt-3 text-sm text-slate-600">
              Not counted in the joint letter yet?{' '}
              <Link className="underline" href="/rasuwa/form">
                Sign the families&apos; letter
              </Link>{' '}
              as well.
            </p>
          )}
        </StepCard>

        <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-600">
          <p>
            Facts in the letters are as of {FACTS_DATE}, from the families&apos; letter to the
            Secretary of State. Member data comes from the public-domain
            congress-legislators dataset (updated {directory.updated}). Also useful:{' '}
            <a className="underline" href={US_LINKS.embassyKathmandu} target="_blank" rel="noopener noreferrer">the U.S. Embassy in Kathmandu</a>{' '}
            and <a className="underline" href={US_LINKS.stateDept} target="_blank" rel="noopener noreferrer">travel.state.gov</a>.
          </p>
          <p className="mt-3">
            Corrections and updates: email {COORDINATOR_NAME} at{' '}
            <a className="underline" href={`mailto:${coordinatorEmail()}`}>{coordinatorEmail()}</a>.
            This page is hosted by <Link href="/" className="underline">ReunitePets</Link>.
          </p>
          <div className="mt-4 border-t border-slate-200 pt-4">
            <button type="button" className={buttonLightCls} onClick={clearEverything}>
              Start over for the next family
            </button>
            <span className="ml-3 text-sm text-slate-600">Clears everything typed on this page.</span>
          </div>
        </section>
      </main>
    </div>
  );
}
