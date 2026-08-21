'use client';

/**
 * The one add-a-pet wizard (/care/start), guest-first, member-fast.
 *
 * A visitor describes their pet (who, looks, meds) and only meets a
 * signup form at the moment it exists to serve: saving. The draft lives
 * in localStorage so nothing is lost. Signed-in members skip the
 * account step, gain a photo step, and save straight to /api/pets.
 *
 * Looks are structured (coat swatches + pattern via lib/petAppearance)
 * so the color a guest taps here round-trips into the edit page's
 * swatch UI and reads correctly on flyers, the same canonical
 * vocabulary as everywhere else. Rarer details (sex, microchip, marks,
 * personality, vet) are invited later on the profile, never demanded
 * at the door.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { cn } from '@/components/ui';
import ImageUpload from '@/app/components/ImageUpload';
import LocationPicker from '@/app/components/report/LocationPicker';
import { getBreedsForSpecies } from '@/app/lib/breeds';
import { INTAKE_TYPES, INTAKE_TYPE_LABELS } from '@/app/lib/shelterStatuses';
import {
  COAT_COLORS, COAT_PATTERNS, MAX_COAT_COLORS, composeColor, parseColor,
} from '@/lib/petAppearance';
import { captchaHeaders } from '@/app/lib/captchaClient';

const DRAFT_KEY = 'rp_healthbook_draft';
const NAME_MAX = 40;

const SPECIES_OPTIONS = [
  { value: 'DOG', label: 'Dog' },
  { value: 'CAT', label: 'Cat' },
  { value: 'BIRD', label: 'Bird' },
  { value: 'RABBIT', label: 'Rabbit' },
  { value: 'OTHER', label: 'Other' },
];

const SIZE_OPTIONS = [
  { value: 'TINY', label: 'Tiny', hint: 'under 10 lb' },
  { value: 'SMALL', label: 'Small', hint: '10-25 lb' },
  { value: 'MEDIUM', label: 'Medium', hint: '25-60 lb' },
  { value: 'LARGE', label: 'Large', hint: '60-100 lb' },
  { value: 'GIANT', label: 'Giant', hint: '100+ lb' },
];

const TIME_PRESETS = [
  { value: '08:00', label: 'Morning' },
  { value: '12:00', label: 'Midday' },
  { value: '20:00', label: 'Evening' },
];

const EMPTY_DRAFT = {
  name: '', species: '',
  coatColors: [], coatPattern: null, size: '', breed: '', age: '',
  meds: [],
};

const inputClass =
  'w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-care-base text-neutral-900 ' +
  'placeholder:text-neutral-400 focus:outline-none focus:border-care-teal';

const labelClass = 'block text-care-sm font-medium text-neutral-700 mb-1.5';

const primaryBtn =
  'rounded-full bg-care-teal text-white text-sm font-medium px-4 py-2 hover:bg-care-tealDark ' +
  'disabled:opacity-40 transition-colors focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-neutral-900';

const secondaryBtn =
  'rounded-full border border-neutral-300 text-sm font-medium text-neutral-900 px-4 py-2 ' +
  'hover:border-care-teal disabled:opacity-40 transition-colors focus-visible:outline ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900';

const quietBtn =
  'text-care-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900';

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

function Chip({ active, onClick, children, className, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3.5 py-2 text-sm transition-colors focus-visible:outline',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900',
        active
          ? 'border-care-teal bg-care-teal text-white'
          : 'border-neutral-300 text-neutral-700 hover:border-care-teal',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

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
  // Shelter accounts arrive via /care/start?shelter=<id> from their
  // dashboard; the id rides along on save so the animal lands on the
  // shelter's roster. Read from window (not useSearchParams) to keep the
  // page out of a Suspense boundary. The API verifies the claim.
  const [shelterId, setShelterId] = useState(null);
  // Intake details (shelter adds only). Kept out of the localStorage
  // draft on purpose: personal drafts must never grow shelter fields.
  const [intake, setIntake] = useState({ date: '', type: '', location: null });
  const hydrated = useRef(false);

  const STEPS = useMemo(() => {
    const base = [
      { key: 'who', label: 'Your pet' },
      { key: 'looks', label: 'Looks' },
      { key: 'meds', label: 'Meds' },
    ];
    // Shelter adds record how the animal arrived, right after "who".
    if (shelterId) base.splice(1, 0, { key: 'intake', label: 'Intake' });
    if (isMember) base.push({ key: 'photo', label: 'Photo' });
    base.push({ key: 'save', label: 'Save' });
    return base;
  }, [isMember, shelterId]);
  const stepKey = STEPS[Math.min(step, STEPS.length - 1)].key;

  useEffect(() => {
    const existing = loadDraft();
    if (existing && existing.name) {
      setDraft(existing);
      setResumed(true);
    }
    try {
      const sid = new URLSearchParams(window.location.search).get('shelter');
      if (sid) {
        setShelterId(sid);
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        setIntake((i) => ({ ...i, date: today }));
      }
    } catch {}
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch {}
  }, [draft]);

  const set = (patch) => { setDraft((d) => ({ ...d, ...patch })); if (error) setError(''); };

  const canNext =
    stepKey === 'who' ? Boolean(draft.name.trim() && draft.species) :
    stepKey === 'intake' ? Boolean(intake.type) :
    stepKey === 'looks' ? Boolean(draft.coatColors.length && draft.size) :
    true;

  const toggleCoatColor = (value) => {
    const has = draft.coatColors.includes(value);
    if (!has && draft.coatColors.length >= MAX_COAT_COLORS) {
      setError(`Pick up to ${MAX_COAT_COLORS} main colors`);
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
        headers: { 'Content-Type': 'application/json', ...(await captchaHeaders('register')) },
        body: JSON.stringify({
          ...pet,
          photos: photoUrls,
          primaryPhotoUrl: photoUrls[0] || '',
          ...(shelterId ? {
            shelterId,
            intakeDate: intake.date || undefined,
            intakeType: intake.type || undefined,
            intakeFoundAddress: intake.location?.address || undefined,
            intakeFoundLatitude: intake.location?.lat,
            intakeFoundLongitude: intake.location?.lng,
          } : {}),
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
      // Shelter adds go back to the roster; personal adds go to the pet.
      router.push(shelterId ? `/my-shelter/animals/${petId}` : `/pets/${petId}/today`);
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

  const petName = draft.name.trim() || 'your pet';

  /* ------------------------------ Saved screen ----------------------------- */

  if (savedGuest) {
    return (
      <main className="min-h-screen bg-white">
        <div className="max-w-lg mx-auto px-4 sm:px-6 py-16">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-2">
            {draft.name} is saved
          </h1>
          <p className="text-sm text-neutral-500 mb-6">
            We sent a link to <span className="font-medium text-neutral-900">{account.email}</span>.
            Verify your email, then sign in.
          </p>
          <Link href="/login" className={cn(primaryBtn, 'inline-block')}>
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const lastStep = step === STEPS.length - 1;

  const TITLES = {
    who: 'Add your pet',
    intake: `How did ${petName} arrive?`,
    looks: `What does ${petName} look like?`,
    meds: 'Any medications?',
    photo: 'Add photos',
    save: `Save ${petName}`,
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8">
        <p className="text-care-sm text-neutral-500 mb-1">Step {step + 1} of {STEPS.length}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-6">{TITLES[stepKey]}</h1>

        {resumed && step === 0 && (
          <p className="text-care-sm text-neutral-500 mb-5">Resumed your saved draft.</p>
        )}

        {/* STEP: who */}
        {stepKey === 'who' && (
          <div>
            <label className={labelClass} htmlFor="hb-name">Name</label>
            <input
              id="hb-name"
              value={draft.name}
              maxLength={NAME_MAX}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Max"
              autoFocus
              className={cn(inputClass, 'mb-5')}
            />
            <p className={labelClass}>Species</p>
            <div className="flex flex-wrap gap-2">
              {SPECIES_OPTIONS.map(({ value, label }) => (
                <Chip key={value} active={draft.species === value} onClick={() => set({ species: value })}>
                  {label}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* STEP: intake (shelter adds only) */}
        {stepKey === 'intake' && (
          <div>
            <p className={labelClass}>Intake type</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {INTAKE_TYPES.map((t) => (
                <Chip key={t} active={intake.type === t} onClick={() => setIntake((i) => ({ ...i, type: t }))}>
                  {INTAKE_TYPE_LABELS[t]}
                </Chip>
              ))}
            </div>

            <label className={labelClass} htmlFor="hb-intake-date">Intake date</label>
            <input
              id="hb-intake-date"
              type="date"
              value={intake.date}
              onChange={(e) => setIntake((i) => ({ ...i, date: e.target.value }))}
              className={cn(inputClass, 'mb-5 w-48')}
            />

            {intake.type === 'STRAY' && (
              <div>
                <p className={labelClass}>Where was this animal found?</p>
                <p className="text-care-sm text-neutral-500 mb-3">
                  The found location lets us check nearby lost-pet reports for a worried owner.
                </p>
                <LocationPicker
                  value={intake.location}
                  onChange={(loc) => setIntake((i) => ({ ...i, location: loc }))}
                />
              </div>
            )}
          </div>
        )}

        {/* STEP: looks. Structured swatches double as the rescue profile. */}
        {stepKey === 'looks' && (
          <div>
            <p className={labelClass}>Colors (up to {MAX_COAT_COLORS})</p>
            <div className="flex flex-wrap gap-x-4 gap-y-3 mb-5">
              {COAT_COLORS.map(({ value, css, border }) => {
                const active = draft.coatColors.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleCoatColor(value)}
                    aria-pressed={active}
                    aria-label={value}
                    className="flex flex-col items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                  >
                    <span
                      className={cn(
                        'w-9 h-9 rounded-full',
                        border && 'border border-neutral-200',
                        active && 'ring-2 ring-offset-2 ring-neutral-900'
                      )}
                      style={{ background: css }}
                    />
                    <span className={cn('text-care-xs', active ? 'font-medium text-neutral-900' : 'text-neutral-500')}>
                      {value}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className={labelClass}>Pattern</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {COAT_PATTERNS.map((p) => (
                <Chip key={p} active={draft.coatPattern === p} onClick={() => set({ coatPattern: draft.coatPattern === p ? null : p })}>
                  {p}
                </Chip>
              ))}
            </div>

            {draft.coatColors.length > 0 && (
              <p className="text-care-sm text-neutral-500 mb-5">
                On flyers: <span className="font-medium text-neutral-900">{composeColor(draft.coatColors, draft.coatPattern)}</span>
              </p>
            )}

            <p className={labelClass}>Size</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {SIZE_OPTIONS.map(({ value, label, hint }) => (
                <Chip key={value} active={draft.size === value} onClick={() => set({ size: value })}>
                  {label}
                  <span className={cn('ml-1.5 text-xs', draft.size === value ? 'text-neutral-300' : 'text-neutral-400')}>
                    {hint}
                  </span>
                </Chip>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <label className={labelClass} htmlFor="hb-breed">
                  Breed <span className="font-normal text-neutral-400">(optional)</span>
                </label>
                <input
                  id="hb-breed"
                  value={draft.breed}
                  onChange={(e) => { set({ breed: e.target.value.slice(0, 60) }); setBreedQuery(e.target.value); }}
                  placeholder={draft.species === 'CAT' ? 'Siamese' : 'Golden Retriever'}
                  className={inputClass}
                />
                {breedSuggestions.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg overflow-hidden">
                    {breedSuggestions.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => { set({ breed: b }); setBreedQuery(''); }}
                        className="w-full text-left px-3.5 py-2 text-sm text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900 transition-colors"
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="hb-age">
                  Age <span className="font-normal text-neutral-400">(optional)</span>
                </label>
                <input
                  id="hb-age"
                  type="number"
                  min="0"
                  max="40"
                  value={draft.age}
                  onChange={(e) => set({ age: e.target.value })}
                  placeholder="4"
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP: meds (fully skippable) */}
        {stepKey === 'meds' && (
          <div>
            {draft.meds.length > 0 && (
              <div className="divide-y divide-neutral-100 mb-6">
                {draft.meds.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <span className="flex-1 min-w-0">
                      <span className="block text-care-base font-medium text-neutral-900 truncate">{m.name}</span>
                      <span className="block text-care-sm text-neutral-500">{m.times.map(timeLabel).join(' · ')}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${m.name}`}
                      onClick={() => set({ meds: draft.meds.filter((_, j) => j !== i) })}
                      className={quietBtn}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className={labelClass} htmlFor="hb-med-name">Medication name</label>
            <input
              id="hb-med-name"
              value={medName}
              onChange={(e) => setMedName(e.target.value.slice(0, 120))}
              placeholder="Apoquel 16 mg"
              className={cn(inputClass, 'mb-4')}
            />
            <p className={labelClass}>Times</p>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {TIME_PRESETS.map(({ value, label }) => (
                <Chip key={value} active={medTimes.includes(value)} onClick={() => toggleTime(value)}>
                  {label}
                </Chip>
              ))}
              {/* Custom times join the row as removable chips, 12-hour like
                  everything else. The chips ARE the state; no summary line. */}
              {medTimes
                .filter((t) => !TIME_PRESETS.some((p) => p.value === t))
                .map((t) => (
                  <Chip key={t} active onClick={() => toggleTime(t)} aria-label={`Remove ${timeLabel(t)}`}>
                    {timeLabel(t)}
                    <span aria-hidden="true" className="ml-1.5 text-neutral-300">&times;</span>
                  </Chip>
                ))}
            </div>
            <div className="flex items-center gap-2 mb-5">
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                aria-label="Another time"
                className={cn(inputClass, 'w-36')}
              />
              <button type="button" onClick={addCustomTime} className={secondaryBtn}>
                Add time
              </button>
            </div>
            <button
              type="button"
              onClick={addMed}
              disabled={!medName.trim() || medTimes.length === 0}
              className={secondaryBtn}
            >
              Add medication
            </button>
          </div>
        )}

        {/* STEP: photo (members only, guests get invited after signup) */}
        {stepKey === 'photo' && (
          <div>
            <ImageUpload
              images={images}
              onUpload={(newImages) => setImages((prev) => [...prev, ...newImages])}
              onRemove={(index) => setImages((prev) => prev.filter((_, i) => i !== index))}
              maxImages={5}
              context="pet"
              label="Pet photos"
              helpText="Drag photos here, or click to browse"
            />
          </div>
        )}

        {/* STEP: save */}
        {stepKey === 'save' && (
          <div>
            {error && (
              <p className="text-sm text-red-600 mb-4" role="alert">{error}</p>
            )}

            {!isMember && (
              <form method="post" onSubmit={saveAsGuest} className="space-y-4">
                <p className="text-care-sm text-neutral-500">Saving needs a free account.</p>
                <div>
                  <label className={labelClass} htmlFor="hb-first-name">First name</label>
                  <input
                    id="hb-first-name"
                    value={account.firstName}
                    onChange={(e) => setAccount((a) => ({ ...a, firstName: e.target.value.slice(0, 100) }))}
                    placeholder="Sam"
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="hb-email">Email</label>
                  <input
                    id="hb-email"
                    type="email"
                    value={account.email}
                    onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))}
                    placeholder="you@example.com"
                    required
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="hb-password">Password</label>
                  <input
                    id="hb-password"
                    type="password"
                    value={account.password}
                    onChange={(e) => setAccount((a) => ({ ...a, password: e.target.value }))}
                    placeholder="8+ characters"
                    required
                    minLength={8}
                    className={inputClass}
                  />
                </div>
                <label className="flex items-start gap-2.5 text-care-sm text-neutral-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={account.terms}
                    onChange={(e) => setAccount((a) => ({ ...a, terms: e.target.checked }))}
                    required
                    className="mt-0.5 w-4 h-4 rounded accent-neutral-900"
                  />
                  <span>
                    I agree to the{' '}
                    <Link href="/legal/terms" target="_blank" className="font-medium text-neutral-900 underline">Terms</Link>
                    {' '}and{' '}
                    <Link href="/privacy" target="_blank" className="font-medium text-neutral-900 underline">Privacy Policy</Link>.
                  </span>
                </label>
                <div className="flex justify-end">
                  <button type="submit" disabled={saving || !account.terms} className={primaryBtn}>
                    {saving ? 'Saving...' : 'Create account and save'}
                  </button>
                </div>
                <p className="text-care-sm text-neutral-500">
                  Already have an account?{' '}
                  <Link href={`/login?callbackUrl=${encodeURIComponent('/care/start')}`} className="font-medium text-neutral-900 underline">
                    Sign in
                  </Link>
                  . {petName}&rsquo;s draft will be waiting.
                </p>
              </form>
            )}
          </div>
        )}

        {error && stepKey !== 'save' && (
          <p className="text-sm text-red-600 mt-4" role="alert">{error}</p>
        )}

        {/* When Continue is disabled, say why instead of leaving a grey mystery */}
        {!lastStep && !canNext && (
          <p className="text-care-sm text-neutral-500 mt-4 text-right">
            {stepKey === 'who' && (!draft.name.trim() ? 'Enter a name to continue.' : 'Pick a species to continue.')}
            {stepKey === 'intake' && 'Pick an intake type to continue.'}
            {stepKey === 'looks' && (!draft.coatColors.length ? 'Pick at least one color to continue.' : 'Pick a size to continue.')}
          </p>
        )}

        {/* nav row */}
        <div className="flex items-center justify-between mt-8">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => { setError(''); setStep((s) => s - 1); }}
              className={quietBtn}
            >
              Back
            </button>
          ) : <span />}
          {!lastStep && (
            <button
              type="button"
              onClick={() => {
                if (!canNext) return;
                // A typed medication must never be silently lost: if the name
                // field still holds text when the user advances, commit it
                // exactly as the separate "Add medication" button would.
                if (stepKey === 'meds' && medName.trim() && medTimes.length > 0) addMed();
                setStep((s) => s + 1);
              }}
              disabled={!canNext}
              className={primaryBtn}
            >
              {(stepKey === 'meds' && draft.meds.length === 0 && !medName.trim()) || (stepKey === 'photo' && images.length === 0)
                ? 'Skip for now'
                : 'Continue'}
            </button>
          )}
          {lastStep && isMember && (
            <button
              type="button"
              onClick={saveAsMember}
              disabled={saving}
              className={primaryBtn}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
