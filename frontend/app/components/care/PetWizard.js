'use client';

/**
 * The one add-a-pet wizard (/care/start) — guest-first, member-fast.
 *
 * A visitor builds their pet's Health Book (who → looks → meds), SEES
 * it as a live preview, and only meets a signup form at the moment it
 * exists to serve: "save this". The draft lives in localStorage so
 * nothing is ever lost. Signed-in members skip the account step, gain
 * a photo step, and save straight to /api/pets.
 *
 * Looks are structured (coat swatches + pattern via lib/petAppearance)
 * so the color a guest taps here round-trips into the edit page's
 * swatch UI and reads correctly on flyers — the same canonical
 * vocabulary as everywhere else. Everything rarer (sex, microchip,
 * marks, personality, vet) is invited later by Rescue Readiness on the
 * profile, never demanded at the door.
 *
 * Dressed in the Paper Passport language: a perforated sheet on the
 * paper ground, diary-hand headings, ink chips, rubber-stamp buttons.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ArrowRight, ArrowLeft, Plus, X, Sun, Moon, Clock, Check,
  Sparkles, Mail, Lock, User, PawPrint,
} from 'lucide-react';
import { cn } from '@/components/ui';
import { SpeciesIcon, DogIcon, CatIcon, BirdIcon, RabbitIcon, PawIcon } from '@/app/components/icons/SpeciesIcons';
import ImageUpload from '@/app/components/ImageUpload';
import { getBreedsForSpecies } from '@/app/lib/breeds';
import {
  COAT_COLORS, COAT_PATTERNS, MAX_COAT_COLORS, composeColor, parseColor,
} from '@/lib/petAppearance';
import { PaperScaffold, Sheet, StampText } from '@/app/components/care/paper/Paper';

const DRAFT_KEY = 'rp_healthbook_draft';
const NAME_MAX = 40;

const SPECIES_OPTIONS = [
  { value: 'DOG', label: 'Dog', icon: DogIcon },
  { value: 'CAT', label: 'Cat', icon: CatIcon },
  { value: 'BIRD', label: 'Bird', icon: BirdIcon },
  { value: 'RABBIT', label: 'Rabbit', icon: RabbitIcon },
  { value: 'OTHER', label: 'Other', icon: PawIcon },
];

const SIZE_OPTIONS = [
  { value: 'TINY', label: 'Tiny', hint: '< 10 lb', paw: 13 },
  { value: 'SMALL', label: 'Small', hint: '10–25 lb', paw: 16 },
  { value: 'MEDIUM', label: 'Medium', hint: '25–60 lb', paw: 20 },
  { value: 'LARGE', label: 'Large', hint: '60–100 lb', paw: 24 },
  { value: 'GIANT', label: 'Giant', hint: '100+ lb', paw: 28 },
];

const TIME_PRESETS = [
  { value: '08:00', label: 'Morning', icon: Sun },
  { value: '12:00', label: 'Midday', icon: Clock },
  { value: '20:00', label: 'Evening', icon: Moon },
];

const EMPTY_DRAFT = {
  name: '', species: '',
  coatColors: [], coatPattern: null, size: '', breed: '', age: '',
  meds: [],
};

// The hero input: paper stock, pen ink, a red-ink focus line.
const inputClass =
  'w-full rounded-[5px] border border-pen-300 bg-paper-50 px-3.5 py-3.5 text-lg text-pen-900 ' +
  'placeholder:text-pen-300 focus:outline-none focus:border-stampred transition-colors';

const smallInputClass =
  'w-full rounded-[5px] border border-pen-300 bg-paper-50 px-3.5 py-2.5 text-sm text-pen-900 ' +
  'placeholder:text-pen-300 focus:outline-none focus:border-stampred transition-colors';

const labelClass = 'block font-stamp text-[9px] uppercase tracking-[0.16em] text-pen-400 mb-1.5';

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d.name !== 'string') return null;
    const draft = { ...EMPTY_DRAFT, ...d };
    // Older drafts stored free-text color; lift it into the swatch vocabulary
    // (unknown words survive as custom tokens, nothing is dropped).
    if (!draft.coatColors?.length && typeof d.color === 'string' && d.color.trim()) {
      const parsed = parseColor(d.color);
      draft.coatColors = parsed.colors.slice(0, MAX_COAT_COLORS);
      draft.coatPattern = parsed.pattern;
    }
    delete draft.color;
    return draft;
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

function Chip({ active, onClick, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3.5 py-2 rounded-[5px] text-sm border-[1.5px] transition-colors',
        active
          ? 'border-stampred bg-stampred-wash text-pen-900'
          : 'border-paper-400 text-pen-600 hover:border-pen-300',
        className
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------- The live Today preview ------------------------- */

function TodayPreview({ draft }) {
  const doses = draft.meds.flatMap((med) => med.times.map((t) => ({ med: med.name, time: t })));
  doses.sort((a, b) => a.time.localeCompare(b.time));
  const morning = doses.filter((d) => Number(d.time.slice(0, 2)) < 12);
  const evening = doses.filter((d) => Number(d.time.slice(0, 2)) >= 12);

  const Row = ({ dose }) => (
    <div className="flex items-center gap-3 py-2.5 border-b border-pen-900/[0.16] last:border-b-0">
      <span
        className="font-stamp text-[9px] uppercase border border-pen-400 text-pen-600 rounded-[3px] px-1.5 py-0.5 shrink-0"
        style={{ transform: 'rotate(-4deg)' }}
      >
        Rx
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-pen-900 truncate">{dose.med}</span>
        <span className="block font-diary italic text-[11.5px] text-pen-400">due {timeLabel(dose.time)}</span>
      </span>
      <span className="w-5 h-5 border-2 border-pen-900 rounded-[3px] shrink-0" aria-hidden="true" />
    </div>
  );

  const looksLine = [
    composeColor(draft.coatColors, draft.coatPattern),
    draft.breed?.trim(),
  ].filter(Boolean).join(' · ');

  return (
    <div className="bg-paper-100 border border-paper-400 rounded-[5px] p-5 text-left">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-11 h-11 rounded-[5px] bg-paper-50 border border-paper-400 text-pen-600 flex items-center justify-center">
          <SpeciesIcon species={draft.species || 'OTHER'} size={22} />
        </span>
        <div className="min-w-0">
          <p className="font-diary italic text-[18px] text-pen-900 leading-tight truncate">{draft.name}&rsquo;s Health Book</p>
          <p className="font-diary italic text-[12px] text-pen-400 truncate">
            {looksLine || (doses.length > 0
              ? `today · ${doses.length} dose${doses.length !== 1 ? 's' : ''} to log`
              : 'today · routines appear here')}
          </p>
        </div>
      </div>

      {doses.length === 0 ? (
        <p className="font-diary italic text-[13px] text-pen-400 border border-dashed border-paper-400 rounded-[4px] px-4 py-5 text-center">
          no meds yet. vaccines, weight, and routines will live here too.
        </p>
      ) : (
        <div className="space-y-3">
          {morning.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 font-stamp text-[9px] uppercase tracking-[0.18em] text-pen-400 mb-0.5">
                <Sun className="w-3.5 h-3.5" /> Morning
              </p>
              <div>{morning.map((d, i) => <Row key={`m${i}`} dose={d} />)}</div>
            </div>
          )}
          {evening.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 font-stamp text-[9px] uppercase tracking-[0.18em] text-pen-400 mb-0.5">
                <Moon className="w-3.5 h-3.5" /> Midday &amp; evening
              </p>
              <div>{evening.map((d, i) => <Row key={`e${i}`} dose={d} />)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Wizard --------------------------------- */

export default function PetWizard() {
  const router = useRouter();
  const { status } = useSession();
  const isMember = status === 'authenticated';

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
  // photos (members only)
  const [images, setImages] = useState([]);
  const [breedQuery, setBreedQuery] = useState('');
  const hydrated = useRef(false);

  const STEPS = useMemo(() => {
    const base = [
      { key: 'who', label: 'Your pet' },
      { key: 'looks', label: 'Looks' },
      { key: 'meds', label: 'Meds' },
    ];
    if (isMember) base.push({ key: 'photo', label: 'Photo' });
    base.push({ key: 'save', label: 'Save' });
    return base;
  }, [isMember]);
  const stepKey = STEPS[Math.min(step, STEPS.length - 1)].key;

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

  const set = (patch) => { setDraft((d) => ({ ...d, ...patch })); if (error) setError(''); };

  const canNext =
    stepKey === 'who' ? Boolean(draft.name.trim() && draft.species) :
    stepKey === 'looks' ? Boolean(draft.coatColors.length && draft.size) :
    true;

  const toggleCoatColor = (value) => {
    const has = draft.coatColors.includes(value);
    if (!has && draft.coatColors.length >= MAX_COAT_COLORS) {
      setError(`Pick up to ${MAX_COAT_COLORS} main colors, the ones a stranger would name`);
      return;
    }
    set({ coatColors: has ? draft.coatColors.filter((c) => c !== value) : [...draft.coatColors, value] });
  };

  const breedSuggestions = useMemo(() => {
    if (stepKey !== 'looks' || !draft.species || draft.species === 'OTHER') return [];
    const all = getBreedsForSpecies(draft.species) || [];
    const q = breedQuery.trim().toLowerCase();
    if (!q) return [];
    return all.filter((b) => b.toLowerCase().includes(q) && b !== draft.breed).slice(0, 5);
  }, [stepKey, draft.species, draft.breed, breedQuery]);

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
    color: composeColor(draft.coatColors, draft.coatPattern),
    size: draft.size,
    breed: draft.breed.trim() || null,
    age: draft.age !== '' ? Number(draft.age) : null,
    medications: draft.meds.map((m) => ({ name: m.name, timesOfDay: m.times })),
  });

  // Member save: straight to the real APIs, no account step.
  const saveAsMember = async () => {
    setSaving(true);
    setError('');
    try {
      const { medications, ...pet } = petPayload();
      const photoUrls = images.map((img) => img.url);
      const res = await fetch('/api/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...pet,
          photos: photoUrls,
          primaryPhotoUrl: photoUrls[0] || '',
        }),
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
      <PaperScaffold>
        <main className="px-4 py-16">
          <Sheet className="max-w-lg mx-auto text-center">
            <div className="mb-5">
              <StampText tone="green" rotate={-5}>Saved</StampText>
            </div>
            <h1 className="font-diary italic text-[26px] leading-tight text-pen-900 mb-2">
              {draft.name}&rsquo;s Health Book is saved
            </h1>
            <p className="font-diary italic text-[14px] text-pen-400 mb-6">
              one tap left: we sent a link to <span className="not-italic font-semibold text-pen-900">{account.email}</span>.
              verify your email and {draft.name}&rsquo;s book unlocks.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 font-stamp text-[10.5px] uppercase tracking-[0.12em] text-stampred border-[1.5px] border-dashed border-stampred rounded-[4px] px-4 py-3 hover:bg-stampred hover:text-paper-50 hover:border-solid transition-colors"
            >
              I&rsquo;ve verified, sign in <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Sheet>
        </main>
      </PaperScaffold>
    );
  }

  const petName = draft.name.trim() || 'your pet';
  const lastStep = step === STEPS.length - 1;

  return (
    <PaperScaffold>
      <main className="px-4 py-10 md:py-14">
        <div className="max-w-lg mx-auto">
          <Sheet perforated>
            {/* progress: ink segments and a margin fraction */}
            <div className="flex items-center justify-between mb-2">
              <p className="font-stamp text-[9px] uppercase tracking-[0.18em] text-pen-400">
                {draft.name.trim() ? `${draft.name.trim()}'s Health Book` : 'A free Health Book'}
              </p>
              <p className="font-stamp text-[10px] tracking-[0.08em] text-pen-400">{step + 1} / {STEPS.length}</p>
            </div>
            <div className="flex gap-1.5 mb-7">
              {STEPS.map((s, i) => (
                <span key={s.key} className={cn('h-1 flex-1 rounded-[2px] transition-colors', i <= step ? 'bg-pen-900' : 'bg-paper-300')} />
              ))}
            </div>

            {resumed && step === 0 && (
              <p className="flex items-center gap-2 font-diary italic text-[13px] text-stampgreen border-l-[3px] border-stampgreen bg-stampgreen-wash/60 px-4 py-2.5 mb-5">
                <Sparkles className="w-4 h-4 shrink-0" /> picked up where you left off. nothing was lost.
              </p>
            )}

            {/* STEP: who — the pet, not the person */}
            {stepKey === 'who' && (
              <div>
                <h1 className="font-diary italic text-[24px] md:text-[28px] leading-tight text-pen-900 mb-1.5">
                  Who&rsquo;s this Health Book for?
                </h1>
                <p className="font-diary italic text-[14px] text-pen-400 mb-6">let&rsquo;s meet your pet.</p>
                <label className={labelClass} htmlFor="hb-name">Their name</label>
                <input
                  id="hb-name"
                  value={draft.name}
                  maxLength={NAME_MAX}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="Max"
                  autoFocus
                  className={cn(inputClass, 'mb-5')}
                />
                <p className={cn(labelClass, 'mb-2')}>They&rsquo;re a…</p>
                <div className="grid grid-cols-5 gap-2">
                  {SPECIES_OPTIONS.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set({ species: value })}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-[5px] border-[1.5px] px-2 py-3.5 transition-colors',
                        draft.species === value
                          ? 'border-stampred bg-stampred-wash text-pen-900'
                          : 'border-paper-400 text-pen-600 hover:border-pen-300'
                      )}
                    >
                      <Icon size={26} className={draft.species === value ? 'text-stampred' : undefined} />
                      <span className="font-stamp text-[9px] uppercase tracking-[0.08em]">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP: looks — structured swatches; doubles as the rescue profile */}
            {stepKey === 'looks' && (
              <div>
                <h1 className="font-diary italic text-[24px] md:text-[28px] leading-tight text-pen-900 mb-1.5">
                  What does {petName} look like?
                </h1>
                <p className="font-diary italic text-[14px] text-pen-400 mb-6">
                  tap the colors a stranger would name. these details double as
                  {' '}{petName}&rsquo;s rescue profile, ready long before you&rsquo;d ever need it.
                </p>

                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 mb-4">
                  {COAT_COLORS.map(({ value, css, border }) => {
                    const active = draft.coatColors.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleCoatColor(value)}
                        aria-pressed={active}
                        aria-label={value}
                        className="flex flex-col items-center gap-1.5 group"
                      >
                        <span
                          className={cn(
                            'w-11 h-11 rounded-full transition-all flex items-center justify-center',
                            border && 'border border-paper-400',
                            active ? 'ring-[3px] ring-offset-2 ring-offset-paper-50 ring-stampred scale-110' : 'group-hover:scale-105'
                          )}
                          style={{ background: css }}
                        >
                          {active && (
                            <span className="w-5 h-5 rounded-full bg-paper-50/95 text-pen-900 flex items-center justify-center shadow">
                              <Check size={13} strokeWidth={3.5} />
                            </span>
                          )}
                        </span>
                        <span className={cn('text-[11px] font-semibold', active ? 'text-pen-900' : 'text-pen-600')}>
                          {value}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {COAT_PATTERNS.map((p) => (
                    <Chip key={p} active={draft.coatPattern === p} onClick={() => set({ coatPattern: draft.coatPattern === p ? null : p })}>
                      {p}
                    </Chip>
                  ))}
                </div>

                {draft.coatColors.length > 0 && (
                  <p className="font-diary italic text-[13.5px] text-pen-600 bg-paper-200 border border-paper-400 rounded-[4px] px-4 py-2.5 mb-5">
                    on flyers: <strong className="not-italic text-pen-900">{composeColor(draft.coatColors, draft.coatPattern)}</strong>
                  </p>
                )}

                <p className={cn(labelClass, 'mb-2')}>Size</p>
                <div className="grid grid-cols-5 gap-2 mb-5">
                  {SIZE_OPTIONS.map(({ value, label, hint, paw }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set({ size: value })}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-[5px] border-[1.5px] px-1 py-3 transition-colors',
                        draft.size === value
                          ? 'border-stampred bg-stampred-wash text-pen-900'
                          : 'border-paper-400 text-pen-600 hover:border-pen-300'
                      )}
                    >
                      <PawIcon size={paw} className={draft.size === value ? 'text-stampred' : 'text-pen-300'} />
                      <span className="font-stamp text-[9px] uppercase tracking-[0.08em]">{label}</span>
                      <span className="text-[10px] text-pen-400">{hint}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <label className={labelClass} htmlFor="hb-breed">
                      Breed <span className="text-pen-300">(optional)</span>
                    </label>
                    <input
                      id="hb-breed"
                      value={draft.breed}
                      onChange={(e) => { set({ breed: e.target.value.slice(0, 60) }); setBreedQuery(e.target.value); }}
                      placeholder={draft.species === 'CAT' ? 'Siamese' : 'Golden Retriever'}
                      className={smallInputClass}
                    />
                    {breedSuggestions.length > 0 && (
                      <div className="absolute z-10 left-0 right-0 mt-1 bg-paper-50 border border-paper-400 rounded-[5px] shadow-lg overflow-hidden">
                        {breedSuggestions.map((b) => (
                          <button
                            key={b}
                            type="button"
                            onClick={() => { set({ breed: b }); setBreedQuery(''); }}
                            className="w-full text-left px-4 py-2 text-sm text-pen-600 hover:bg-paper-200 hover:text-pen-900 transition-colors"
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="hb-age">
                      Age <span className="text-pen-300">(optional)</span>
                    </label>
                    <input
                      id="hb-age"
                      type="number"
                      min="0"
                      max="40"
                      value={draft.age}
                      onChange={(e) => set({ age: e.target.value })}
                      placeholder="4"
                      className={smallInputClass}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP: meds & routines (fully skippable) */}
            {stepKey === 'meds' && (
              <div>
                <h1 className="font-diary italic text-[24px] md:text-[28px] leading-tight text-pen-900 mb-1.5">
                  Any meds or daily routines?
                </h1>
                <p className="font-diary italic text-[14px] text-pen-400 mb-6">
                  one-tap logging starts today. skip this if {petName} takes nothing.
                </p>

                {draft.meds.length > 0 && (
                  <div className="space-y-2 mb-5">
                    {draft.meds.map((m, i) => (
                      <div key={i} className="flex items-center gap-3 bg-paper-100 border border-paper-400 rounded-[4px] px-4 py-2.5">
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-bold text-pen-900 truncate">{m.name}</span>
                          <span className="block font-stamp text-[9.5px] tracking-[0.06em] text-pen-400">{m.times.map(timeLabel).join(' · ')}</span>
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${m.name}`}
                          onClick={() => set({ meds: draft.meds.filter((_, j) => j !== i) })}
                          className="text-pen-400 hover:text-stampred transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-[1.5px] border-dashed border-paper-400 rounded-[6px] p-4">
                  <input
                    value={medName}
                    onChange={(e) => setMedName(e.target.value.slice(0, 120))}
                    placeholder="Apoquel 16 mg"
                    aria-label="Medication name"
                    className={cn(smallInputClass, 'mb-3')}
                  />
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {TIME_PRESETS.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => toggleTime(value)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-[5px] border-[1.5px] px-3 py-2 font-stamp text-[10px] uppercase tracking-[0.1em] transition-colors',
                          medTimes.includes(value)
                            ? 'border-stampred bg-stampred-wash text-pen-900'
                            : 'border-paper-400 text-pen-600 hover:border-pen-300'
                        )}
                      >
                        <Icon className="w-4 h-4" /> {label}
                      </button>
                    ))}
                    {/* Custom times join the row as removable chips, 12-hour like
                        everything else. The chips ARE the state; no summary line. */}
                    {medTimes
                      .filter((t) => !TIME_PRESETS.some((p) => p.value === t))
                      .map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleTime(t)}
                          aria-label={`Remove ${timeLabel(t)}`}
                          className="inline-flex items-center gap-1.5 rounded-[5px] border-[1.5px] border-stampred bg-stampred-wash text-pen-900 px-3 py-2 font-stamp text-[10px] uppercase tracking-[0.1em] transition-colors"
                        >
                          <Clock className="w-4 h-4" /> {timeLabel(t)}
                          <X className="w-3.5 h-3.5 text-pen-400" />
                        </button>
                      ))}
                    <span className="inline-flex items-center gap-1">
                      <input
                        type="time"
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                        aria-label="Another time"
                        className="rounded-[5px] border border-pen-300 bg-paper-50 px-2.5 py-[7px] text-sm text-pen-600 focus:outline-none focus:border-stampred transition-colors"
                      />
                      <button
                        type="button"
                        onClick={addCustomTime}
                        aria-label="Add this time"
                        className="p-2 rounded-[4px] border-[1.5px] border-paper-400 text-pen-600 hover:border-pen-300 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addMed}
                    disabled={!medName.trim() || medTimes.length === 0}
                    className="inline-flex items-center gap-2 font-stamp text-[10px] uppercase tracking-[0.12em] border-[1.5px] border-pen-900 text-pen-900 rounded-[4px] px-3 py-2 hover:bg-pen-900 hover:text-paper-50 transition-colors disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" /> Add to the book
                  </button>
                </div>
              </div>
            )}

            {/* STEP: photo (members only — guests get invited after signup) */}
            {stepKey === 'photo' && (
              <div>
                <h1 className="font-diary italic text-[24px] md:text-[28px] leading-tight text-pen-900 mb-1.5">
                  Show {petName} off
                </h1>
                <p className="font-diary italic text-[14px] text-pen-400 mb-6">
                  the first photo becomes the cover of the book — and the face on
                  a flyer if the worst day ever came. skippable.
                </p>
                <ImageUpload
                  images={images}
                  onUpload={(newImages) => setImages((prev) => [...prev, ...newImages])}
                  onRemove={(index) => setImages((prev) => prev.filter((_, i) => i !== index))}
                  maxImages={5}
                  context="pet"
                  label="Pet Photos"
                  helpText="Drag photos here, or click to browse"
                />
              </div>
            )}

            {/* STEP: the reveal + save */}
            {stepKey === 'save' && (
              <div>
                <h1 className="font-diary italic text-[24px] md:text-[28px] leading-tight text-pen-900 mb-1.5">
                  Here&rsquo;s {petName}&rsquo;s Health Book
                </h1>
                <p className="font-diary italic text-[14px] text-pen-400 mb-5">
                  {isMember
                    ? 'save it to your account and start logging today.'
                    : 'save it so it’s never lost.'}
                </p>

                <div className="mb-6">
                  <TodayPreview draft={draft} />
                </div>

                {error && (
                  <p className="border-l-[3px] border-stampred bg-stampred-wash/60 text-stampred-dark px-4 py-3 text-sm mb-4" role="alert">
                    {error}
                  </p>
                )}

                {isMember ? (
                  <button
                    type="button"
                    onClick={saveAsMember}
                    disabled={saving}
                    className="w-full inline-flex items-center justify-center gap-2 bg-stampred hover:bg-stampred-dark disabled:opacity-60 text-paper-50 font-stamp text-[11px] uppercase tracking-[0.14em] px-6 py-3 rounded-[5px] transition-colors"
                  >
                    {saving ? 'Saving…' : `Save ${petName}'s Health Book`} <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <form onSubmit={saveAsGuest} className="space-y-3">
                    <p className="font-diary italic text-[14px] text-pen-600">
                      create a free account to keep {petName}&rsquo;s book safe:
                    </p>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-pen-400" />
                      <input
                        value={account.firstName}
                        onChange={(e) => setAccount((a) => ({ ...a, firstName: e.target.value.slice(0, 100) }))}
                        placeholder="Your first name"
                        required
                        aria-label="Your first name"
                        className={cn(smallInputClass, 'pl-11')}
                      />
                    </div>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-pen-400" />
                      <input
                        type="email"
                        value={account.email}
                        onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))}
                        placeholder="you@example.com"
                        required
                        aria-label="Email"
                        className={cn(smallInputClass, 'pl-11')}
                      />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-pen-400" />
                      <input
                        type="password"
                        value={account.password}
                        onChange={(e) => setAccount((a) => ({ ...a, password: e.target.value }))}
                        placeholder="Password (8+ characters)"
                        required
                        minLength={8}
                        aria-label="Password"
                        className={cn(smallInputClass, 'pl-11')}
                      />
                    </div>
                    <label className="flex items-start gap-2.5 text-[13px] text-pen-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={account.terms}
                        onChange={(e) => setAccount((a) => ({ ...a, terms: e.target.checked }))}
                        required
                        className="mt-0.5 w-4 h-4 rounded-[3px] accent-stampred"
                      />
                      <span>
                        I agree to the{' '}
                        <Link href="/legal/terms" target="_blank" className="font-semibold text-pen-900 underline">Terms</Link>
                        {' '}and{' '}
                        <Link href="/privacy" target="_blank" className="font-semibold text-pen-900 underline">Privacy Policy</Link>.
                      </span>
                    </label>
                    <button
                      type="submit"
                      disabled={saving || !account.terms}
                      className="w-full inline-flex items-center justify-center gap-2 bg-stampred hover:bg-stampred-dark disabled:opacity-60 text-paper-50 font-stamp text-[11px] uppercase tracking-[0.14em] px-6 py-3 rounded-[5px] transition-colors"
                    >
                      {saving ? 'Saving…' : `Save ${petName}'s Health Book`} <ArrowRight className="w-4 h-4" />
                    </button>
                    <p className="text-center font-diary italic text-[12.5px] text-pen-400">
                      already have an account?{' '}
                      <Link href={`/login?callbackUrl=${encodeURIComponent('/care/start')}`} className="not-italic font-semibold text-pen-900 underline">
                        Sign in
                      </Link>
                      . {petName}&rsquo;s draft will be waiting.
                    </p>
                  </form>
                )}
              </div>
            )}

            {error && stepKey !== 'save' && (
              <p className="border-l-[3px] border-stampred bg-stampred-wash/60 text-stampred-dark px-4 py-3 text-sm mt-4" role="alert">
                {error}
              </p>
            )}

            {/* nav row */}
            {!lastStep && (
              <div className="flex items-center justify-between mt-8">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => { setError(''); setStep((s) => s - 1); }}
                    className="inline-flex items-center gap-1.5 font-stamp text-[9.5px] uppercase tracking-[0.12em] text-pen-400 hover:text-pen-900 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                ) : <span />}
                <button
                  type="button"
                  onClick={() => canNext && setStep((s) => s + 1)}
                  disabled={!canNext}
                  className="inline-flex items-center gap-2 font-stamp text-[10px] uppercase tracking-[0.12em] border-[1.5px] border-pen-900 text-pen-900 rounded-[4px] px-4 py-2.5 hover:bg-pen-900 hover:text-paper-50 transition-colors disabled:opacity-40"
                >
                  {(stepKey === 'meds' && draft.meds.length === 0) || (stepKey === 'photo' && images.length === 0)
                    ? 'Skip for now'
                    : 'Continue'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
            {lastStep && (
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="inline-flex items-center gap-1.5 font-stamp text-[9.5px] uppercase tracking-[0.12em] text-pen-400 hover:text-pen-900 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              </div>
            )}
          </Sheet>

          <p className="flex items-center justify-center gap-1.5 font-diary italic text-[12px] text-pen-400 mt-5">
            <PawPrint className="w-3.5 h-3.5" /> free forever · takes about a minute · yours to delete anytime
          </p>
        </div>
      </main>
    </PaperScaffold>
  );
}
