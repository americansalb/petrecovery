'use client';

/**
 * Edit pet - tapping, not typing
 *
 * The same input vocabulary as the new-pet wizard (species cards, coat
 * swatches, paw-scale sizes, trait chips), laid out as conversational
 * cards instead of a form. A live Rescue-ready ring ticks up as fields
 * fill — editing IS protection, and the page shows it. A save bar
 * appears only when something actually changed.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Check, Minus, Plus, Loader2, X, AlertTriangle } from 'lucide-react';
import { DogIcon, CatIcon, BirdIcon, RabbitIcon, PawIcon } from '@/app/components/icons/SpeciesIcons';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import ImageUpload from '@/app/components/ImageUpload';
import { Card, Button, EmptyState, cn } from '@/components/ui';
import {
  COAT_COLORS, COAT_PATTERNS, MAX_COAT_COLORS,
  composeColor, parseColor, validateMicrochip, normalizeMicrochip,
  normalizeCoatLabel,
} from '@/lib/petAppearance';

const SPECIES_OPTIONS = [
  { value: 'DOG', label: 'Dog', icon: DogIcon },
  { value: 'CAT', label: 'Cat', icon: CatIcon },
  { value: 'BIRD', label: 'Bird', icon: BirdIcon },
  { value: 'RABBIT', label: 'Rabbit', icon: RabbitIcon },
  { value: 'OTHER', label: 'Other', icon: PawIcon },
];

const SIZE_OPTIONS = [
  { value: 'TINY', label: 'Tiny', hint: 'under 10 lbs', paw: 14 },
  { value: 'SMALL', label: 'Small', hint: '10-25 lbs', paw: 18 },
  { value: 'MEDIUM', label: 'Medium', hint: '25-50 lbs', paw: 23 },
  { value: 'LARGE', label: 'Large', hint: '50-90 lbs', paw: 28 },
  { value: 'GIANT', label: 'Giant', hint: '90+ lbs', paw: 34 },
];

const SEX_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: '', label: 'Not sure' },
];

const PERSONALITY_TRAITS = [
  'Friendly', 'Shy', 'Energetic', 'Calm', 'Playful',
  'Anxious', 'Aggressive when scared', 'Good with kids',
  'Good with other pets', 'Comes when called',
];

const inputClass =
  'w-full rounded-2xl border-2 border-midnight-200 bg-white px-4 py-3 text-midnight-900 ' +
  'placeholder:text-midnight-300 focus:outline-none focus:border-flash-400 focus:ring-4 focus:ring-flash-100 transition';

/* Tap-first building blocks ------------------------------------------------ */

function ChoiceChip({ active, onClick, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'px-3.5 py-2 rounded-2xl border-2 text-sm font-bold transition-all active:scale-95',
        active
          ? 'border-flash-400 bg-flash-50 text-midnight-900'
          : 'border-midnight-200 bg-white text-midnight-500 hover:border-midnight-300 hover:text-midnight-800',
        className
      )}
    >
      {children}
    </button>
  );
}

function InlineAdd({ value, onChange, onAdd, onCancel, placeholder }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onAdd(); }
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={placeholder}
        className="rounded-2xl border-2 border-flash-400 bg-white px-3 py-2 text-sm font-semibold text-midnight-900 placeholder:text-midnight-300 focus:outline-none w-44"
      />
      <button type="button" onClick={onAdd} aria-label="Add"
        className="w-9 h-9 rounded-xl bg-flash-400 hover:bg-flash-300 text-midnight-900 flex items-center justify-center transition-colors">
        <Check size={15} strokeWidth={3} />
      </button>
      <button type="button" onClick={onCancel} aria-label="Cancel"
        className="w-9 h-9 rounded-xl text-midnight-400 hover:text-midnight-700 flex items-center justify-center">
        <X size={15} />
      </button>
    </span>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <Card padding="lg" className="mb-4">
      <h2 className="text-lg font-bold text-midnight-900">{title}</h2>
      {subtitle && <p className="text-sm text-midnight-500 mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </Card>
  );
}

function ReadyRing({ met, total }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = total ? met / total : 0;
  return (
    <div className="flex items-center gap-2.5" role="img" aria-label={`Rescue ready: ${met} of ${total}`}>
      <div className="relative w-11 h-11">
        <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-midnight-100" />
          <circle
            cx="32" cy="32" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
            className={cn('transition-all duration-500', pct >= 1 ? 'stroke-emerald-400' : 'stroke-flash-400')}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-midnight-900 tabular-nums">
          {met}/{total}
        </span>
      </div>
      <span className="text-xs font-bold text-midnight-500 hidden sm:block leading-tight">
        Rescue<br />ready
      </span>
    </div>
  );
}

/* --------------------------------- Page ----------------------------------- */

export default function EditPetPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const petId = params.id;

  const [pet, setPet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState(null);
  const [images, setImages] = useState([]);
  // Weight is displayed here but logged in the Health Book — the one write path.
  const [petWeight, setPetWeight] = useState(null);
  const [hasTeam, setHasTeam] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [customColorInput, setCustomColorInput] = useState(null); // null = closed, '' = open
  const [customPatternInput, setCustomPatternInput] = useState(null);
  const [customTraitInput, setCustomTraitInput] = useState(null);
  const originalRef = useRef(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/pets/${petId}/edit`);
    }
  }, [status, router, petId]);

  const fetchPet = useCallback(async () => {
    try {
      const res = await fetch(`/api/pets/${petId}`);
      if (!res.ok) throw new Error(res.status === 404 ? 'Pet not found' : 'Failed to fetch pet');
      const data = await res.json();
      const p = data.pet;
      setPet(p);

      const coat = parseColor(p.color || '');
      const nextForm = {
        name: p.name || '',
        species: p.species || 'DOG',
        breed: p.breed || '',
        age: p.age?.toString() || '',
        sex: p.sex || '',
        isNeutered: !!p.isNeutered,
        coatColors: coat.colors,
        coatPattern: coat.pattern,
        size: p.size || 'MEDIUM',
        distinctiveMarks: p.distinctiveMarks || '',
        microchipId: p.microchipId || '',
        collarInfo: p.collarInfo || '',
        personality: Array.isArray(p.personality) ? p.personality : [],
        medicalConditions: p.medicalConditions || '',
      };
      const nextImages = (p.photos?.length ? p.photos : []).map((url) => ({ url, uploaded: true }));
      setPetWeight(p.weight ?? null);
      setForm(nextForm);
      setImages(nextImages);
      originalRef.current = JSON.stringify({ form: nextForm, urls: nextImages.map((i) => i.url) });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    if (status === 'authenticated' && petId) fetchPet();
  }, [status, petId, fetchPet]);

  // Team state feeds the same 7-point readiness the Overview shows
  useEffect(() => {
    if (status !== 'authenticated' || !petId) return;
    fetch(`/api/pets/${petId}/shares`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.shares?.some((s) => s.status === 'ACTIVE')) setHasTeam(true); })
      .catch(() => {});
    fetch(`/api/pets/${petId}/share-link`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.url) setHasTeam(true); })
      .catch(() => {});
  }, [status, petId]);

  const set = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    const touched = Object.keys(patch);
    if (touched.some((k) => errors[k])) {
      setErrors((prev) => {
        const next = { ...prev };
        for (const k of touched) delete next[k];
        return next;
      });
    }
  };

  const colorValue = form ? composeColor(form.coatColors, form.coatPattern) : '';

  const dirty = useMemo(() => {
    if (!form || !originalRef.current) return false;
    return JSON.stringify({ form, urls: images.map((i) => i.url) }) !== originalRef.current;
  }, [form, images]);

  const readiness = useMemo(() => {
    if (!form) return { met: 0, total: 7 };
    const checks = [
      images.length >= 1,
      images.length >= 2,
      !!form.distinctiveMarks.trim(),
      !!form.microchipId.trim(),
      form.personality.length > 0,
      petWeight != null,
      hasTeam,
    ];
    return { met: checks.filter(Boolean).length, total: checks.length };
  }, [form, images, hasTeam, petWeight]);

  const toggleCoatColor = (value) => {
    const has = form.coatColors.includes(value);
    if (!has && form.coatColors.length >= MAX_COAT_COLORS) {
      setErrors((prev) => ({ ...prev, color: `Up to ${MAX_COAT_COLORS} colors. Tap one to swap it out.` }));
      return;
    }
    set({
      coatColors: has ? form.coatColors.filter((c) => c !== value) : [...form.coatColors, value],
    });
    setErrors((prev) => ({ ...prev, color: null }));
  };

  const addCustomColor = () => {
    const label = normalizeCoatLabel(customColorInput);
    if (!label) {
      setErrors((prev) => ({ ...prev, color: `Plain words only, 2 to ${16} letters` }));
      return;
    }
    if (form.coatColors.some((c) => c.toLowerCase() === label.toLowerCase())) {
      setCustomColorInput(null);
      return;
    }
    if (form.coatColors.length >= MAX_COAT_COLORS) {
      setErrors((prev) => ({ ...prev, color: `Up to ${MAX_COAT_COLORS} colors. Tap one to swap it out.` }));
      return;
    }
    set({ coatColors: [...form.coatColors, label] });
    setErrors((prev) => ({ ...prev, color: null }));
    setCustomColorInput(null);
  };

  const addCustomPattern = () => {
    const label = normalizeCoatLabel(customPatternInput);
    if (!label) {
      setErrors((prev) => ({ ...prev, color: 'Plain words only, 2 to 16 letters' }));
      return;
    }
    set({ coatPattern: label });
    setErrors((prev) => ({ ...prev, color: null }));
    setCustomPatternInput(null);
  };

  const addCustomTrait = () => {
    const trait = (customTraitInput || '').trim().replace(/\s+/g, ' ');
    if (trait.length < 2 || trait.length > 24 || !/^[a-zA-Z0-9][a-zA-Z0-9\s'!-]*$/.test(trait)) {
      setErrors((prev) => ({ ...prev, personality: 'Keep it short and plain, 2 to 24 characters' }));
      return;
    }
    if (form.personality.some((t) => t.toLowerCase() === trait.toLowerCase())) {
      setCustomTraitInput(null);
      return;
    }
    if (form.personality.length >= 10) {
      setErrors((prev) => ({ ...prev, personality: 'Ten traits is plenty. Remove one first.' }));
      return;
    }
    set({ personality: [...form.personality, trait] });
    setErrors((prev) => ({ ...prev, personality: null }));
    setCustomTraitInput(null);
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = `Every pet needs a name`;
    if (!colorValue.trim()) next.color = 'Tap the coat colors a stranger would name';
    if (form.age && (isNaN(form.age) || form.age < 0 || form.age > 50)) next.age = 'Age should be 0 to 50';
    if (form.microchipId && !validateMicrochip(form.microchipId)) next.microchipId = '9 to 15 letters and digits';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    setSubmitError(null);
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSubmitting(true);
    try {
      const photoUrls = images.map((img) => img.url);
      const res = await fetch(`/api/pets/${petId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          species: form.species,
          breed: form.breed,
          age: form.age ? parseInt(form.age, 10) : null,
          sex: form.sex || null,
          isNeutered: form.isNeutered,
          color: colorValue,
          size: form.size,
          distinctiveMarks: form.distinctiveMarks,
          microchipId: form.microchipId ? normalizeMicrochip(form.microchipId) : '',
          collarInfo: form.collarInfo,
          personality: form.personality,
          medicalConditions: form.medicalConditions,
          photos: photoUrls,
          primaryPhotoUrl: photoUrls[0] || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update pet profile');
      router.push(`/pets/${petId}`);
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  };

  const discard = () => {
    const original = JSON.parse(originalRef.current);
    setForm(original.form);
    setImages(original.urls.map((url) => ({ url, uploaded: true })));
    setErrors({});
    setSubmitError(null);
  };

  const confirmDelete = async () => {
    setDeleteConfirmOpen(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/pets/${petId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete pet');
      router.push('/pets');
    } catch (err) {
      setSubmitError(err.message);
      setDeleting(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }
  if (status === 'unauthenticated') return null;
  if (error || !form) {
    return (
      <div className="px-4 py-12">
        <div className="max-w-md mx-auto mt-8">
          <EmptyState icon={PawIcon} title="Pet not found" description={error} action={{ href: '/pets', label: 'Back to My Pets' }} />
        </div>
      </div>
    );
  }

  const name = form.name.trim() || 'your pet';

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 pb-32">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-midnight-900">Edit {pet.name}</h1>
            <p className="text-sm text-midnight-500">Every detail here is one a searcher or sitter could need.</p>
          </div>
          <ReadyRing met={readiness.met} total={readiness.total} />
        </div>

        {submitError && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 rounded-xl mb-4 flex items-center justify-between">
            <span>{submitError}</span>
            <button onClick={() => setSubmitError(null)} aria-label="Dismiss" className="text-red-400 hover:text-red-700"><X size={16} /></button>
          </div>
        )}

        {/* The face on the flyer */}
        <SectionCard
          title="The face on the flyer"
          subtitle={`Clear, recent photos. If ${name} ever went missing, the first one becomes the poster.`}
        >
          <ImageUpload
            images={images}
            onUpload={(newImages) => setImages((prev) => [...prev, ...newImages])}
            onRemove={(index) => setImages((prev) => prev.filter((_, i) => i !== index))}
            maxImages={5}
            context="pet"
            label=""
            helpText=""
          />
        </SectionCard>

        {/* Who is X? */}
        <SectionCard title={`Who is ${name}?`}>
          <div className="space-y-5">
            <div>
              <input
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Name"
                aria-label="Pet name"
                maxLength={40}
                className={cn(inputClass, 'text-lg font-bold', errors.name && 'border-red-300')}
              />
              {errors.name && <p className="text-xs text-red-600 mt-1.5">{errors.name}</p>}
            </div>

            <div className="flex flex-wrap gap-2">
              {SPECIES_OPTIONS.map(({ value, label, icon: Icon }) => (
                <ChoiceChip key={value} active={form.species === value} onClick={() => set({ species: value })}>
                  <span className="inline-flex items-center gap-1.5"><Icon size={15} /> {label}</span>
                </ChoiceChip>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                value={form.breed}
                onChange={(e) => set({ breed: e.target.value })}
                placeholder="Breed (best guess is fine)"
                aria-label="Breed"
                className={inputClass}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-midnight-500 shrink-0">Age</span>
                <button
                  type="button"
                  aria-label="Younger"
                  onClick={() => set({ age: String(Math.max(0, (parseInt(form.age, 10) || 0) - 1)) })}
                  className="w-10 h-10 rounded-xl border-2 border-midnight-200 text-midnight-500 hover:border-midnight-300 flex items-center justify-center transition-colors"
                >
                  <Minus size={15} />
                </button>
                <span className="w-16 text-center font-bold text-midnight-900 tabular-nums">
                  {form.age === '' ? 'Not set' : `${form.age} yr${form.age === '1' ? '' : 's'}`}
                </span>
                <button
                  type="button"
                  aria-label="Older"
                  onClick={() => set({ age: String(Math.min(50, (parseInt(form.age, 10) || 0) + 1)) })}
                  className="w-10 h-10 rounded-xl border-2 border-midnight-200 text-midnight-500 hover:border-midnight-300 flex items-center justify-center transition-colors"
                >
                  <Plus size={15} />
                </button>
                {errors.age && <p className="text-xs text-red-600">{errors.age}</p>}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {SEX_OPTIONS.map(({ value, label }) => (
                <ChoiceChip key={label} active={form.sex === value} onClick={() => set({ sex: value })}>
                  {label}
                </ChoiceChip>
              ))}
              <span className="w-px h-6 bg-midnight-100 mx-1" aria-hidden="true" />
              <ChoiceChip active={form.isNeutered} onClick={() => set({ isNeutered: !form.isNeutered })}>
                <span className="inline-flex items-center gap-1.5">
                  {form.isNeutered && <Check size={14} strokeWidth={3} />}
                  Neutered / spayed
                </span>
              </ChoiceChip>
            </div>
          </div>
        </SectionCard>

        {/* What does X look like? */}
        <SectionCard
          title={`What does ${name} look like?`}
          subtitle="This is how strangers search. Tap what they'd actually say."
        >
          <div className="space-y-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-midnight-400 mb-2.5">
                Coat (up to {MAX_COAT_COLORS} colors)
              </p>
              <div className="flex flex-wrap gap-3">
                {COAT_COLORS.map(({ value, css, border }) => {
                  const active = form.coatColors.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleCoatColor(value)}
                      aria-pressed={active}
                      aria-label={value}
                      title={value}
                      className="flex flex-col items-center gap-1 group"
                    >
                      <span
                        className={cn(
                          'w-10 h-10 rounded-full transition-all flex items-center justify-center',
                          border && 'border border-midnight-200',
                          active ? 'ring-[3px] ring-offset-2 ring-flash-500 scale-110' : 'group-hover:scale-105'
                        )}
                        style={{ background: css }}
                      >
                        {active && (
                          <span className="w-4.5 h-4.5 w-5 h-5 rounded-full bg-white/95 text-midnight-900 flex items-center justify-center shadow">
                            <Check size={12} strokeWidth={3.5} />
                          </span>
                        )}
                      </span>
                      <span className={cn('text-[10px] font-semibold', active ? 'text-midnight-900' : 'text-midnight-400')}>
                        {value}
                      </span>
                    </button>
                  );
                })}
                {form.coatColors
                  .filter((c) => !COAT_COLORS.some((k) => k.value === c))
                  .map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set({ coatColors: form.coatColors.filter((x) => x !== c) })}
                      aria-label={`Remove ${c}`}
                      title={`${c} (tap to remove)`}
                      className="flex flex-col items-center gap-1 group"
                    >
                      <span className="w-10 h-10 rounded-full bg-midnight-900 text-white ring-[3px] ring-offset-2 ring-flash-500 flex items-center justify-center text-xs font-bold">
                        {c.slice(0, 2)}
                      </span>
                      <span className="text-[10px] font-semibold text-midnight-900">{c}</span>
                    </button>
                  ))}
                {customColorInput === null ? (
                  <button
                    type="button"
                    onClick={() => setCustomColorInput('')}
                    className="flex flex-col items-center gap-1 group"
                    aria-label="Add another color"
                  >
                    <span className="w-10 h-10 rounded-full border-2 border-dashed border-midnight-300 text-midnight-400 group-hover:border-flash-400 group-hover:text-flash-500 flex items-center justify-center transition-colors">
                      <Plus size={15} />
                    </span>
                    <span className="text-[10px] font-semibold text-midnight-400">Other</span>
                  </button>
                ) : (
                  <InlineAdd
                    value={customColorInput}
                    onChange={setCustomColorInput}
                    onAdd={addCustomColor}
                    onCancel={() => setCustomColorInput(null)}
                    placeholder="e.g., Chocolate"
                  />
                )}
              </div>
              {errors.color && <p className="text-xs text-red-600 mt-2">{errors.color}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {COAT_PATTERNS.map((p) => (
                  <ChoiceChip
                    key={p}
                    active={(form.coatPattern || 'Solid') === p}
                    onClick={() => set({ coatPattern: p === 'Solid' ? null : p })}
                    className="px-3 py-1.5 text-xs"
                  >
                    {p}
                  </ChoiceChip>
                ))}
                {form.coatPattern && !COAT_PATTERNS.includes(form.coatPattern) && (
                  <ChoiceChip active onClick={() => set({ coatPattern: null })} className="px-3 py-1.5 text-xs">
                    <span className="inline-flex items-center gap-1">{form.coatPattern} <X size={12} /></span>
                  </ChoiceChip>
                )}
                {customPatternInput === null ? (
                  <button
                    type="button"
                    onClick={() => setCustomPatternInput('')}
                    className="px-3 py-1.5 rounded-2xl border-2 border-dashed border-midnight-300 text-xs font-bold text-midnight-400 hover:border-flash-400 hover:text-flash-500 transition-colors"
                  >
                    + Other
                  </button>
                ) : (
                  <InlineAdd
                    value={customPatternInput}
                    onChange={setCustomPatternInput}
                    onAdd={addCustomPattern}
                    onCancel={() => setCustomPatternInput(null)}
                    placeholder="e.g., Ticked"
                  />
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-midnight-400 mb-2.5">Size</p>
              <div className="grid grid-cols-5 gap-2">
                {SIZE_OPTIONS.map(({ value, label, hint, paw }) => {
                  const active = form.size === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set({ size: value })}
                      aria-pressed={active}
                      className={cn(
                        'flex flex-col items-center justify-end gap-1 rounded-2xl border-2 px-1 pt-3 pb-2 transition-all active:scale-95',
                        active ? 'border-flash-400 bg-flash-50' : 'border-midnight-200 hover:border-midnight-300'
                      )}
                    >
                      <PawIcon size={paw} className={active ? 'text-midnight-900' : 'text-midnight-300'} />
                      <span className={cn('text-xs font-bold', active ? 'text-midnight-900' : 'text-midnight-500')}>{label}</span>
                      <span className="text-[9px] text-midnight-400 leading-none hidden sm:block">{hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Weight has ONE write path — the Health Book's weight log —
                so the trend chart and this number can never disagree. */}
            <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-midnight-100 bg-midnight-50/50 px-4 py-3">
              <p className="text-sm text-midnight-600">
                <span className="font-bold text-midnight-900">Weight:</span>{' '}
                {petWeight != null ? `${petWeight} lbs` : 'not logged yet'}
              </p>
              <Link
                href={`/pets/${petId}/health`}
                className="text-xs font-bold text-flash-600 hover:text-flash-700 shrink-0"
              >
                Log changes in the Health Book →
              </Link>
            </div>

            <textarea
              value={form.distinctiveMarks}
              onChange={(e) => set({ distinctiveMarks: e.target.value })}
              placeholder={`What would a stranger notice first? White chest patch, torn left ear, walks with a hop...`}
              aria-label="Distinctive marks"
              rows={2}
              className={inputClass}
            />
          </div>
        </SectionCard>

        {/* The vibe */}
        <SectionCard
          title={`${name}'s vibe`}
          subtitle={`“Shy, do not chase” changes how a whole neighborhood searches.`}
        >
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {PERSONALITY_TRAITS.map((trait) => {
              const active = form.personality.some((t) => t.toLowerCase() === trait.toLowerCase());
              return (
                <ChoiceChip
                  key={trait}
                  active={active}
                  onClick={() =>
                    set({
                      personality: active
                        ? form.personality.filter((t) => t.toLowerCase() !== trait.toLowerCase())
                        : [...form.personality, trait],
                    })
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    {active && <Check size={14} strokeWidth={3} />}
                    {trait}
                  </span>
                </ChoiceChip>
              );
            })}
            {form.personality
              .filter((t) => !PERSONALITY_TRAITS.some((k) => k.toLowerCase() === t.toLowerCase()))
              .map((t) => (
                <ChoiceChip key={t} active onClick={() => set({ personality: form.personality.filter((x) => x !== t) })}>
                  <span className="inline-flex items-center gap-1.5">{t} <X size={13} /></span>
                </ChoiceChip>
              ))}
            {customTraitInput === null ? (
              <button
                type="button"
                onClick={() => setCustomTraitInput('')}
                className="px-3.5 py-2 rounded-2xl border-2 border-dashed border-midnight-300 text-sm font-bold text-midnight-400 hover:border-flash-400 hover:text-flash-500 transition-colors"
              >
                + Add your own
              </button>
            ) : (
              <InlineAdd
                value={customTraitInput}
                onChange={setCustomTraitInput}
                onAdd={addCustomTrait}
                onCancel={() => setCustomTraitInput(null)}
                placeholder="e.g., Scared of thunder"
              />
            )}
          </div>
          {errors.personality && <p className="text-xs text-red-600 mb-3">{errors.personality}</p>}
          <div className="mb-2.5" />
          <textarea
            value={form.medicalConditions}
            onChange={(e) => set({ medicalConditions: e.target.value })}
            placeholder="Anything a vet or sitter should know? Allergies, conditions, daily meds..."
            aria-label="Medical notes"
            rows={2}
            className={inputClass}
          />
        </SectionCard>

        {/* If found */}
        <SectionCard
          title={`If ${name} is ever found`}
          subtitle="The two things that prove who they are and bring them straight home."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <input
                value={form.microchipId}
                onChange={(e) => set({ microchipId: e.target.value })}
                placeholder="Microchip number"
                aria-label="Microchip number"
                className={cn(inputClass, 'font-mono text-sm', errors.microchipId && 'border-red-300')}
              />
              {errors.microchipId && <p className="text-xs text-red-600 mt-1.5">{errors.microchipId}</p>}
            </div>
            <input
              value={form.collarInfo}
              onChange={(e) => set({ collarInfo: e.target.value })}
              placeholder="Collar & tag (e.g., blue collar, bone tag with phone)"
              aria-label="Collar and tag description"
              className={inputClass}
            />
          </div>
        </SectionCard>

        <p className="text-center pt-2 pb-6">
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleting}
            className="text-xs text-midnight-400 hover:text-red-600 underline underline-offset-2 transition-colors"
          >
            {deleting ? 'Removing...' : `Remove ${pet.name} from ReunitePets`}
          </button>
        </p>
      </div>

      {/* Save bar: only exists once something changed */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-4 pointer-events-none">
          <div className="max-w-4xl mx-auto flex justify-center">
            <div className="pointer-events-auto flex items-center gap-3 bg-midnight-950 text-white rounded-2xl shadow-2xl pl-5 pr-2 py-2">
              <span className="text-sm font-semibold">Unsaved changes</span>
              <button
                onClick={discard}
                disabled={submitting}
                className="text-sm font-bold text-midnight-300 hover:text-white px-2 py-2 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={save}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-flash-400 hover:bg-flash-300 text-midnight-950 text-sm font-bold rounded-xl transition-colors"
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={3} />}
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirmOpen(false)} />
          <Card className="relative w-full max-w-sm p-6 text-center">
            <span className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={22} />
            </span>
            <h3 className="text-lg font-bold text-midnight-900 mb-1">Remove {pet.name}?</h3>
            <p className="text-sm text-midnight-500 mb-5">
              Their profile, care history, and medication log go with them. This can&apos;t be undone.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Keep {pet.name}</Button>
              <Button variant="danger" onClick={confirmDelete}>Remove</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
