'use client';

/**
 * Guest-first Health Book onboarding: the pet comes first, the account
 * comes last. A visitor builds their pet's book (name -> looks -> meds),
 * SEES it as a live preview, and only meets a signup form at the moment
 * it exists to serve: "save this". Draft lives in localStorage so nothing
 * is ever lost; logged-in users skip the account step entirely and save
 * straight to /api/pets.
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import {
  ArrowRight, ArrowLeft, Plus, X, Sun, Moon, Clock, CheckCircle2,
  Sparkles, Mail, Lock, User, PawPrint,
} from 'lucide-react';
import { cn } from '@/components/ui';

const DRAFT_KEY = 'rp_healthbook_draft';

const SPECIES = [
  { value: 'DOG', label: 'Dog' },
  { value: 'CAT', label: 'Cat' },
  { value: 'BIRD', label: 'Bird' },
  { value: 'RABBIT', label: 'Rabbit' },
  { value: 'OTHER', label: 'Other' },
];
const SIZES = [
  { value: 'TINY', label: 'Tiny', hint: '< 10 lb' },
  { value: 'SMALL', label: 'Small', hint: '10–25 lb' },
  { value: 'MEDIUM', label: 'Medium', hint: '25–60 lb' },
  { value: 'LARGE', label: 'Large', hint: '60–100 lb' },
  { value: 'GIANT', label: 'Giant', hint: '100+ lb' },
];
const TIME_PRESETS = [
  { value: '08:00', label: 'Morning', icon: Sun },
  { value: '12:00', label: 'Midday', icon: Clock },
  { value: '20:00', label: 'Evening', icon: Moon },
];

const EMPTY_DRAFT = { name: '', species: '', breed: '', age: '', color: '', size: '', meds: [] };

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && typeof d.name === 'string' ? { ...EMPTY_DRAFT, ...d } : null;
  } catch {
    return null;
  }
}

function timeLabel(t) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

/* ------------------------- The live Today preview ------------------------- */

function TodayPreview({ draft }) {
  const doses = draft.meds.flatMap((med) => med.times.map((t) => ({ med: med.name, time: t })));
  doses.sort((a, b) => a.time.localeCompare(b.time));
  const morning = doses.filter((d) => Number(d.time.slice(0, 2)) < 12);
  const evening = doses.filter((d) => Number(d.time.slice(0, 2)) >= 12);

  const Row = ({ dose }) => (
    <div className="flex items-center gap-3 bg-white border border-midnight-100 rounded-xl px-4 py-3">
      <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 text-xs font-extrabold">
        Rx
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-midnight-900 truncate">{dose.med}</span>
        <span className="block text-xs text-midnight-500">Due {timeLabel(dose.time)}</span>
      </span>
      <span className="w-6 h-6 rounded-full border-2 border-midnight-200 shrink-0" />
    </div>
  );

  return (
    <div className="bg-midnight-50 border border-midnight-100 rounded-2xl p-5 text-left">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-11 h-11 rounded-xl bg-flash-100 text-flash-700 flex items-center justify-center">
          <SpeciesIcon species={draft.species || 'OTHER'} size={22} />
        </span>
        <div>
          <p className="font-extrabold text-midnight-900 leading-tight">{draft.name}&rsquo;s Health Book</p>
          <p className="text-xs text-midnight-500">
            {doses.length > 0
              ? `Today · ${doses.length} dose${doses.length !== 1 ? 's' : ''} to log`
              : 'Today · routines appear here'}
          </p>
        </div>
      </div>

      {doses.length === 0 ? (
        <p className="text-sm text-midnight-500 bg-white border border-dashed border-midnight-200 rounded-xl px-4 py-5 text-center">
          No meds yet. Vaccines, weight, and routines will live here too.
        </p>
      ) : (
        <div className="space-y-3">
          {morning.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-midnight-400 mb-1.5">
                <Sun className="w-3.5 h-3.5" /> Morning
              </p>
              <div className="space-y-2">{morning.map((d, i) => <Row key={`m${i}`} dose={d} />)}</div>
            </div>
          )}
          {evening.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-midnight-400 mb-1.5">
                <Moon className="w-3.5 h-3.5" /> Midday &amp; evening
              </p>
              <div className="space-y-2">{evening.map((d, i) => <Row key={`e${i}`} dose={d} />)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Wizard --------------------------------- */

export default function HealthBookStart() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  const [resumed, setResumed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedGuest, setSavedGuest] = useState(false);
  // account mini-form (guests only)
  const [account, setAccount] = useState({ firstName: '', email: '', password: '', terms: false });
  // med entry scratch
  const [medName, setMedName] = useState('');
  const [medTimes, setMedTimes] = useState(['08:00']);
  const [customTime, setCustomTime] = useState('');
  const hydrated = useRef(false);

  useEffect(() => {
    const existing = loadDraft();
    if (existing && existing.name) {
      setDraft(existing);
      setResumed(true);
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
  }, [draft]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const STEPS = ['Your pet', 'Looks', 'Meds', 'Save'];

  const canNext =
    step === 0 ? draft.name.trim() && draft.species :
    step === 1 ? draft.color.trim() && draft.size :
    true;

  const addMed = () => {
    const name = medName.trim();
    if (!name || medTimes.length === 0 || draft.meds.length >= 10) return;
    set({ meds: [...draft.meds, { name, times: [...medTimes].sort() }] });
    setMedName('');
    setMedTimes(['08:00']);
  };

  const toggleTime = (t) =>
    setMedTimes((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t].slice(0, 6)));

  const addCustomTime = () => {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(customTime) && !medTimes.includes(customTime)) {
      setMedTimes((ts) => [...ts, customTime].slice(0, 6));
      setCustomTime('');
    }
  };

  const petPayload = () => ({
    name: draft.name.trim(),
    species: draft.species,
    breed: draft.breed.trim() || null,
    age: draft.age ? Number(draft.age) : null,
    color: draft.color.trim(),
    size: draft.size,
    medications: draft.meds.map((m) => ({ name: m.name, timesOfDay: m.times })),
  });

  // Logged-in save: straight to the real APIs, no account step.
  const saveAsUser = async () => {
    setSaving(true);
    setError('');
    try {
      const { medications, ...pet } = petPayload();
      const res = await fetch('/api/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pet),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save the pet');
      const petId = data.pet?.id || data.id;
      for (const med of medications) {
        await fetch(`/api/pets/${petId}/medications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'MEDICATION',
            name: med.name,
            scheduleType: 'DAILY',
            timesOfDay: med.timesOfDay,
          }),
        });
      }
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      router.push(`/pets/${petId}/today`);
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  };

  // Guest save: register WITH the pet riding along; server creates both.
  const saveAsGuest = async (e) => {
    e.preventDefault();
    if (!account.terms || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: account.firstName.trim(),
          email: account.email.trim(),
          password: account.password,
          acceptedTerms: true,
          pet: petPayload(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create your account');
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      setSavedGuest(true);
    } catch (e2) {
      setError(e2.message);
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------ Save screen ----------------------------- */

  if (savedGuest) {
    return (
      <main className="min-h-screen bg-midnight-50 px-4 py-16">
        <div className="max-w-lg mx-auto bg-white rounded-3xl border border-midnight-100 shadow-xl p-8 text-center">
          <span className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-7 h-7" />
          </span>
          <h1 className="text-2xl font-extrabold text-midnight-900 mb-2">
            {draft.name}&rsquo;s Health Book is saved
          </h1>
          <p className="text-midnight-500 mb-6">
            One tap left: we sent a link to <span className="font-semibold text-midnight-900">{account.email}</span>.
            Verify your email and {draft.name}&rsquo;s book unlocks.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-midnight-900 hover:bg-midnight-800 text-white font-bold px-6 py-3.5 rounded-2xl transition-colors"
          >
            I&rsquo;ve verified, sign in <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    );
  }

  /* --------------------------------- Steps -------------------------------- */

  return (
    <main className="min-h-screen bg-midnight-50 px-4 py-10 md:py-14">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-3xl border border-midnight-100 shadow-xl p-6 md:p-8">
          {/* progress */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-midnight-400">
              {draft.name.trim() ? `${draft.name.trim()}'s Health Book` : 'A free Health Book'}
            </p>
            <p className="text-xs font-semibold text-midnight-400">{step + 1} / {STEPS.length}</p>
          </div>
          <div className="flex gap-1.5 mb-7">
            {STEPS.map((s, i) => (
              <span key={s} className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-flash-400' : 'bg-midnight-100')} />
            ))}
          </div>

          {resumed && step === 0 && (
            <p className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 mb-5">
              <Sparkles className="w-4 h-4 shrink-0" /> Picked up where you left off. Nothing was lost.
            </p>
          )}

          {/* STEP 0: the pet, not the person */}
          {step === 0 && (
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-midnight-900 mb-1.5">
                Who&rsquo;s this Health Book for?
              </h1>
              <p className="text-midnight-500 mb-6">Let&rsquo;s meet your pet.</p>
              <label className="block text-sm font-bold text-midnight-700 mb-1.5" htmlFor="hb-name">Their name</label>
              <input
                id="hb-name"
                value={draft.name}
                onChange={(e) => set({ name: e.target.value.slice(0, 50) })}
                placeholder="Max"
                autoFocus
                className="w-full rounded-2xl border-2 border-midnight-200 px-4 py-3.5 text-lg text-midnight-900 placeholder:text-midnight-300 focus:outline-none focus:border-flash-400 focus:ring-4 focus:ring-flash-100 transition mb-5"
              />
              <p className="text-sm font-bold text-midnight-700 mb-2">They&rsquo;re a…</p>
              <div className="grid grid-cols-5 gap-2">
                {SPECIES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set({ species: value })}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3.5 transition-colors',
                      draft.species === value
                        ? 'border-flash-400 bg-flash-50 text-midnight-900'
                        : 'border-midnight-100 hover:border-midnight-300 text-midnight-500'
                    )}
                  >
                    <SpeciesIcon species={value} size={26} />
                    <span className="text-xs font-bold">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 1: looks — doubles as the rescue profile */}
          {step === 1 && (
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-midnight-900 mb-1.5">
                What does {draft.name} look like?
              </h1>
              <p className="text-midnight-500 mb-6">
                These details double as {draft.name}&rsquo;s rescue profile, ready long
                before you&rsquo;d ever need it.
              </p>
              <label className="block text-sm font-bold text-midnight-700 mb-1.5" htmlFor="hb-color">Color &amp; coat</label>
              <input
                id="hb-color"
                value={draft.color}
                onChange={(e) => set({ color: e.target.value.slice(0, 60) })}
                placeholder="Golden, white patch on chest"
                autoFocus
                className="w-full rounded-2xl border-2 border-midnight-200 px-4 py-3.5 text-lg text-midnight-900 placeholder:text-midnight-300 focus:outline-none focus:border-flash-400 focus:ring-4 focus:ring-flash-100 transition mb-5"
              />
              <p className="text-sm font-bold text-midnight-700 mb-2">Size</p>
              <div className="grid grid-cols-5 gap-2 mb-5">
                {SIZES.map(({ value, label, hint }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set({ size: value })}
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-2xl border-2 px-1 py-3 transition-colors',
                      draft.size === value
                        ? 'border-flash-400 bg-flash-50 text-midnight-900'
                        : 'border-midnight-100 hover:border-midnight-300 text-midnight-500'
                    )}
                  >
                    <span className="text-xs font-bold">{label}</span>
                    <span className="text-[10px] text-midnight-400">{hint}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-midnight-700 mb-1.5" htmlFor="hb-breed">
                    Breed <span className="font-normal text-midnight-400">(optional)</span>
                  </label>
                  <input
                    id="hb-breed"
                    value={draft.breed}
                    onChange={(e) => set({ breed: e.target.value.slice(0, 60) })}
                    placeholder="Golden Retriever"
                    className="w-full rounded-2xl border-2 border-midnight-200 px-4 py-3 text-midnight-900 placeholder:text-midnight-300 focus:outline-none focus:border-flash-400 focus:ring-4 focus:ring-flash-100 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-midnight-700 mb-1.5" htmlFor="hb-age">
                    Age <span className="font-normal text-midnight-400">(optional)</span>
                  </label>
                  <input
                    id="hb-age"
                    type="number"
                    min="0"
                    max="40"
                    value={draft.age}
                    onChange={(e) => set({ age: e.target.value })}
                    placeholder="4"
                    className="w-full rounded-2xl border-2 border-midnight-200 px-4 py-3 text-midnight-900 placeholder:text-midnight-300 focus:outline-none focus:border-flash-400 focus:ring-4 focus:ring-flash-100 transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: meds & routines (fully skippable) */}
          {step === 2 && (
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-midnight-900 mb-1.5">
                Any meds or daily routines?
              </h1>
              <p className="text-midnight-500 mb-6">
                One-tap logging starts today. Skip this if {draft.name} takes nothing.
              </p>

              {draft.meds.length > 0 && (
                <div className="space-y-2 mb-5">
                  {draft.meds.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 bg-midnight-50 border border-midnight-100 rounded-xl px-4 py-2.5">
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-midnight-900 truncate">{m.name}</span>
                        <span className="block text-xs text-midnight-500">{m.times.map(timeLabel).join(' · ')}</span>
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${m.name}`}
                        onClick={() => set({ meds: draft.meds.filter((_, j) => j !== i) })}
                        className="text-midnight-400 hover:text-rose-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-2 border-dashed border-midnight-200 rounded-2xl p-4">
                <input
                  value={medName}
                  onChange={(e) => setMedName(e.target.value.slice(0, 120))}
                  placeholder="Apoquel 16 mg"
                  className="w-full rounded-xl border-2 border-midnight-200 px-4 py-3 text-midnight-900 placeholder:text-midnight-300 focus:outline-none focus:border-flash-400 focus:ring-4 focus:ring-flash-100 transition mb-3"
                />
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {TIME_PRESETS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleTime(value)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-bold transition-colors',
                        medTimes.includes(value)
                          ? 'border-flash-400 bg-flash-50 text-midnight-900'
                          : 'border-midnight-100 text-midnight-500 hover:border-midnight-300'
                      )}
                    >
                      <Icon className="w-4 h-4" /> {label}
                    </button>
                  ))}
                  <span className="inline-flex items-center gap-1">
                    <input
                      value={customTime}
                      onChange={(e) => setCustomTime(e.target.value)}
                      placeholder="15:30"
                      aria-label="Custom time (24h HH:MM)"
                      className="w-20 rounded-xl border-2 border-midnight-100 px-2.5 py-2 text-sm text-midnight-900 placeholder:text-midnight-300 focus:outline-none focus:border-flash-400 transition"
                    />
                    <button
                      type="button"
                      onClick={addCustomTime}
                      aria-label="Add custom time"
                      className="p-2 rounded-xl border-2 border-midnight-100 text-midnight-500 hover:border-midnight-300 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </span>
                </div>
                {medTimes.length > 0 && (
                  <p className="text-xs text-midnight-500 mb-3">
                    {medTimes.map(timeLabel).join(' · ')}
                  </p>
                )}
                <button
                  type="button"
                  onClick={addMed}
                  disabled={!medName.trim() || medTimes.length === 0}
                  className="inline-flex items-center gap-2 bg-midnight-900 hover:bg-midnight-800 disabled:opacity-40 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add to the book
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: the reveal + save */}
          {step === 3 && (
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-midnight-900 mb-1.5">
                Here&rsquo;s {draft.name}&rsquo;s Health Book
              </h1>
              <p className="text-midnight-500 mb-5">
                {status === 'authenticated'
                  ? 'Save it to your account and start logging today.'
                  : 'Save it so it’s never lost.'}
              </p>

              <div className="mb-6">
                <TodayPreview draft={draft} />
              </div>

              {error && <p className="text-rose-600 text-sm font-semibold mb-4">{error}</p>}

              {status === 'authenticated' ? (
                <button
                  type="button"
                  onClick={saveAsUser}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold text-lg px-6 py-4 rounded-2xl shadow-lg shadow-rose-900/20 transition-all"
                >
                  {saving ? 'Saving…' : `Save ${draft.name}'s Health Book`} <ArrowRight className="w-5 h-5" />
                </button>
              ) : (
                <form onSubmit={saveAsGuest} className="space-y-3">
                  <p className="text-sm font-bold text-midnight-700">
                    Create a free account to keep {draft.name}&rsquo;s book safe:
                  </p>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-midnight-400" />
                    <input
                      value={account.firstName}
                      onChange={(e) => setAccount((a) => ({ ...a, firstName: e.target.value.slice(0, 100) }))}
                      placeholder="Your first name"
                      required
                      aria-label="Your first name"
                      className="w-full rounded-2xl border-2 border-midnight-200 pl-11 pr-4 py-3 text-midnight-900 placeholder:text-midnight-300 focus:outline-none focus:border-flash-400 focus:ring-4 focus:ring-flash-100 transition"
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-midnight-400" />
                    <input
                      type="email"
                      value={account.email}
                      onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))}
                      placeholder="you@example.com"
                      required
                      aria-label="Email"
                      className="w-full rounded-2xl border-2 border-midnight-200 pl-11 pr-4 py-3 text-midnight-900 placeholder:text-midnight-300 focus:outline-none focus:border-flash-400 focus:ring-4 focus:ring-flash-100 transition"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-midnight-400" />
                    <input
                      type="password"
                      value={account.password}
                      onChange={(e) => setAccount((a) => ({ ...a, password: e.target.value }))}
                      placeholder="Password (8+ characters)"
                      required
                      minLength={8}
                      aria-label="Password"
                      className="w-full rounded-2xl border-2 border-midnight-200 pl-11 pr-4 py-3 text-midnight-900 placeholder:text-midnight-300 focus:outline-none focus:border-flash-400 focus:ring-4 focus:ring-flash-100 transition"
                    />
                  </div>
                  <label className="flex items-start gap-2.5 text-sm text-midnight-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={account.terms}
                      onChange={(e) => setAccount((a) => ({ ...a, terms: e.target.checked }))}
                      required
                      className="mt-0.5 w-4 h-4 rounded accent-flash-500"
                    />
                    <span>
                      I agree to the{' '}
                      <Link href="/legal/terms" target="_blank" className="font-semibold text-midnight-700 underline">Terms</Link>
                      {' '}and{' '}
                      <Link href="/privacy" target="_blank" className="font-semibold text-midnight-700 underline">Privacy Policy</Link>.
                    </span>
                  </label>
                  <button
                    type="submit"
                    disabled={saving || !account.terms}
                    className="w-full inline-flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold text-lg px-6 py-4 rounded-2xl shadow-lg shadow-rose-900/20 transition-all"
                  >
                    {saving ? 'Saving…' : `Save ${draft.name}'s Health Book`} <ArrowRight className="w-5 h-5" />
                  </button>
                  <p className="text-center text-sm text-midnight-400">
                    Already have an account?{' '}
                    <Link href={`/login?callbackUrl=${encodeURIComponent('/care/start')}`} className="font-semibold text-midnight-700 underline">
                      Sign in
                    </Link>
                    . {draft.name}&rsquo;s draft will be waiting.
                  </p>
                </form>
              )}
            </div>
          )}

          {/* nav row */}
          {step < 3 && (
            <div className="flex items-center justify-between mt-8">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="inline-flex items-center gap-1.5 text-midnight-400 hover:text-midnight-700 font-semibold text-sm transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              ) : <span />}
              <button
                type="button"
                onClick={() => canNext && setStep((s) => s + 1)}
                disabled={!canNext}
                className="inline-flex items-center gap-2 bg-midnight-900 hover:bg-midnight-800 disabled:opacity-40 text-white font-bold px-6 py-3 rounded-2xl transition-colors"
              >
                {step === 2 && draft.meds.length === 0 ? 'Skip for now' : 'Continue'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
          {step === 3 && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 text-midnight-400 hover:text-midnight-700 font-semibold text-sm transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back to meds
              </button>
            </div>
          )}
        </div>

        <p className="flex items-center justify-center gap-1.5 text-midnight-400 text-xs mt-5">
          <PawPrint className="w-3.5 h-3.5" /> Free forever · takes about a minute · yours to delete anytime
        </p>
      </div>
    </main>
  );
}
