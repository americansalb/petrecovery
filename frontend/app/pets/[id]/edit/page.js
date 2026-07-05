'use client';

/**
 * Edit pet
 *
 * A plain form on a white page. Same input vocabulary as the new-pet
 * wizard (species chips, coat swatches, size chips, trait chips).
 * All state, fetch calls, validation, save, and delete logic is
 * unchanged; only the rendering is minimal and information-first.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Check, Minus, Plus, Loader2, X } from 'lucide-react';
import { PawIcon } from '@/app/components/icons/SpeciesIcons';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import ImageUpload from '@/app/components/ImageUpload';
import { EmptyState, ConfirmModal, cn } from '@/components/ui';
import {
  COAT_COLORS, COAT_PATTERNS, MAX_COAT_COLORS,
  composeColor, parseColor, validateMicrochip, normalizeMicrochip,
  normalizeCoatLabel,
} from '@/lib/petAppearance';

const SPECIES_OPTIONS = [
  { value: 'DOG', label: 'Dog' },
  { value: 'CAT', label: 'Cat' },
  { value: 'BIRD', label: 'Bird' },
  { value: 'RABBIT', label: 'Rabbit' },
  { value: 'OTHER', label: 'Other' },
];

const SIZE_OPTIONS = [
  { value: 'TINY', label: 'Tiny', hint: 'under 10 lbs' },
  { value: 'SMALL', label: 'Small', hint: '10 to 25 lbs' },
  { value: 'MEDIUM', label: 'Medium', hint: '25 to 50 lbs' },
  { value: 'LARGE', label: 'Large', hint: '50 to 90 lbs' },
  { value: 'GIANT', label: 'Giant', hint: '90+ lbs' },
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
  'w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-[15px] text-neutral-900 ' +
  'placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900';

const labelClass = 'block text-[13px] font-medium text-neutral-700 mb-1.5';

const quietAction =
  'text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors';

/* Building blocks ----------------------------------------------------------- */

function ChoiceChip({ active, onClick, children, className, ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'px-3.5 py-2 rounded-full border text-sm font-medium transition-colors',
        active
          ? 'border-neutral-900 bg-neutral-900 text-white'
          : 'border-neutral-300 text-neutral-700 hover:border-neutral-900',
        className
      )}
      {...props}
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
        className="w-44 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900"
      />
      <button type="button" onClick={onAdd} aria-label="Add"
        className="w-9 h-9 rounded-full bg-neutral-900 hover:bg-neutral-700 text-white flex items-center justify-center transition-colors">
        <Check size={15} strokeWidth={3} />
      </button>
      <button type="button" onClick={onCancel} aria-label="Cancel"
        className="w-9 h-9 rounded-full text-neutral-500 hover:text-neutral-900 flex items-center justify-center transition-colors">
        <X size={15} />
      </button>
    </span>
  );
}

function Section({ label, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-[13px] font-medium text-neutral-500 mb-4">{label}</h2>
      {children}
    </section>
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
  // Weight is displayed here but logged on the Health tab, the one write path.
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

  // Team state feeds the same 7-point readiness the profile shows
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
    if (!form.name.trim()) next.name = 'Name is required';
    if (!colorValue.trim()) next.color = 'Pick at least one coat color';
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

  return (
    <div className="px-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="flex items-baseline justify-between gap-3 mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 truncate">
            Edit {pet.name}
          </h1>
          <p className="text-sm text-neutral-500 shrink-0 tabular-nums">
            {readiness.met} of {readiness.total} emergency fields
          </p>
        </div>

        {submitError && (
          <div role="alert" className="flex items-center justify-between gap-3 text-sm text-red-600 mb-6">
            <span>{submitError}</span>
            <button onClick={() => setSubmitError(null)} aria-label="Dismiss" className="hover:text-red-700 transition-colors">
              <X size={16} />
            </button>
          </div>
        )}

        <Section label="Photos">
          <ImageUpload
            images={images}
            onUpload={(newImages) => setImages((prev) => [...prev, ...newImages])}
            onRemove={(index) => setImages((prev) => prev.filter((_, i) => i !== index))}
            maxImages={5}
            context="pet"
            label=""
            helpText=""
          />
        </Section>

        <Section label="Basics">
          <div className="space-y-5">
            <div>
              <label htmlFor="pet-name" className={labelClass}>Name</label>
              <input
                id="pet-name"
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                aria-label="Pet name"
                maxLength={40}
                className={cn(inputClass, errors.name && 'border-red-600')}
              />
              {errors.name && <p className="text-[13px] text-red-600 mt-1.5">{errors.name}</p>}
            </div>

            <div>
              <p className={labelClass}>Species</p>
              <div className="flex flex-wrap gap-2">
                {SPECIES_OPTIONS.map(({ value, label }) => (
                  <ChoiceChip key={value} active={form.species === value} onClick={() => set({ species: value })}>
                    {label}
                  </ChoiceChip>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="pet-breed" className={labelClass}>Breed</label>
                <input
                  id="pet-breed"
                  value={form.breed}
                  onChange={(e) => set({ breed: e.target.value })}
                  placeholder="Best guess is fine"
                  aria-label="Breed"
                  className={inputClass}
                />
              </div>
              <div>
                <p className={labelClass}>Age</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Younger"
                    onClick={() => set({ age: String(Math.max(0, (parseInt(form.age, 10) || 0) - 1)) })}
                    className="w-9 h-9 rounded-full border border-neutral-300 text-neutral-700 hover:border-neutral-900 hover:text-neutral-900 flex items-center justify-center transition-colors"
                  >
                    <Minus size={15} />
                  </button>
                  <span className="w-16 text-center text-[15px] text-neutral-900 tabular-nums">
                    {form.age === '' ? 'Not set' : `${form.age} yr${form.age === '1' ? '' : 's'}`}
                  </span>
                  <button
                    type="button"
                    aria-label="Older"
                    onClick={() => set({ age: String(Math.min(50, (parseInt(form.age, 10) || 0) + 1)) })}
                    className="w-9 h-9 rounded-full border border-neutral-300 text-neutral-700 hover:border-neutral-900 hover:text-neutral-900 flex items-center justify-center transition-colors"
                  >
                    <Plus size={15} />
                  </button>
                  {errors.age && <p className="text-[13px] text-red-600">{errors.age}</p>}
                </div>
              </div>
            </div>

            <div>
              <p className={labelClass}>Sex</p>
              <div className="flex flex-wrap items-center gap-2">
                {SEX_OPTIONS.map(({ value, label }) => (
                  <ChoiceChip key={label} active={form.sex === value} onClick={() => set({ sex: value })}>
                    {label}
                  </ChoiceChip>
                ))}
                <ChoiceChip active={form.isNeutered} onClick={() => set({ isNeutered: !form.isNeutered })}>
                  <span className="inline-flex items-center gap-1.5">
                    {form.isNeutered && <Check size={14} strokeWidth={3} />}
                    Neutered / spayed
                  </span>
                </ChoiceChip>
              </div>
            </div>
          </div>
        </Section>

        <Section label="Appearance">
          <div className="space-y-5">
            <div>
              <p className={labelClass}>Coat, up to {MAX_COAT_COLORS} colors</p>
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
                      className="flex flex-col items-center gap-1"
                    >
                      <span
                        className={cn(
                          'w-9 h-9 rounded-full flex items-center justify-center transition-shadow',
                          border && 'border border-neutral-300',
                          active && 'ring-2 ring-neutral-900 ring-offset-2'
                        )}
                        style={{ background: css }}
                      >
                        {active && (
                          <span className="w-5 h-5 rounded-full bg-white/90 text-neutral-900 flex items-center justify-center">
                            <Check size={12} strokeWidth={3} />
                          </span>
                        )}
                      </span>
                      <span className={cn('text-[11px]', active ? 'text-neutral-900 font-medium' : 'text-neutral-500')}>
                        {value}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {form.coatColors
                  .filter((c) => !COAT_COLORS.some((k) => k.value === c))
                  .map((c) => (
                    <ChoiceChip
                      key={c}
                      active
                      onClick={() => set({ coatColors: form.coatColors.filter((x) => x !== c) })}
                      aria-label={`Remove ${c}`}
                    >
                      <span className="inline-flex items-center gap-1.5">{c} <X size={13} /></span>
                    </ChoiceChip>
                  ))}
                {customColorInput === null ? (
                  <button
                    type="button"
                    onClick={() => setCustomColorInput('')}
                    aria-label="Add another color"
                    className="px-3.5 py-2 rounded-full border border-dashed border-neutral-300 text-[13px] font-medium text-neutral-500 hover:border-neutral-900 hover:text-neutral-900 transition-colors"
                  >
                    Add color
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
              {errors.color && <p className="text-[13px] text-red-600 mt-2">{errors.color}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {COAT_PATTERNS.map((p) => (
                  <ChoiceChip
                    key={p}
                    active={(form.coatPattern || 'Solid') === p}
                    onClick={() => set({ coatPattern: p === 'Solid' ? null : p })}
                    className="px-3 py-1.5 text-[13px]"
                  >
                    {p}
                  </ChoiceChip>
                ))}
                {form.coatPattern && !COAT_PATTERNS.includes(form.coatPattern) && (
                  <ChoiceChip active onClick={() => set({ coatPattern: null })} className="px-3 py-1.5 text-[13px]">
                    <span className="inline-flex items-center gap-1">{form.coatPattern} <X size={12} /></span>
                  </ChoiceChip>
                )}
                {customPatternInput === null ? (
                  <button
                    type="button"
                    onClick={() => setCustomPatternInput('')}
                    className="px-3 py-1.5 rounded-full border border-dashed border-neutral-300 text-[13px] font-medium text-neutral-500 hover:border-neutral-900 hover:text-neutral-900 transition-colors"
                  >
                    Add pattern
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
              <p className={labelClass}>Size</p>
              <div className="flex flex-wrap gap-2">
                {SIZE_OPTIONS.map(({ value, label, hint }) => (
                  <ChoiceChip
                    key={value}
                    active={form.size === value}
                    onClick={() => set({ size: value })}
                    aria-label={`${label}, ${hint}`}
                    title={hint}
                  >
                    {label}
                  </ChoiceChip>
                ))}
              </div>
            </div>

            {/* Weight has one write path, the Health tab's weight log, so the
                trend chart and this number can never disagree. */}
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-neutral-500">
                Weight: {petWeight != null ? `${petWeight} lbs` : 'not logged yet'}
              </p>
              <Link href={`/pets/${petId}/health`} className={cn(quietAction, 'shrink-0')}>
                Log weight in Health
              </Link>
            </div>

            <div>
              <label htmlFor="pet-marks" className={labelClass}>Distinctive marks</label>
              <textarea
                id="pet-marks"
                value={form.distinctiveMarks}
                onChange={(e) => set({ distinctiveMarks: e.target.value })}
                placeholder="White chest patch, torn left ear, walks with a hop"
                aria-label="Distinctive marks"
                rows={2}
                className={inputClass}
              />
            </div>
          </div>
        </Section>

        <Section label="Identification">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pet-chip" className={labelClass}>Microchip number</label>
              <input
                id="pet-chip"
                value={form.microchipId}
                onChange={(e) => set({ microchipId: e.target.value })}
                aria-label="Microchip number"
                className={cn(inputClass, 'font-mono text-sm', errors.microchipId && 'border-red-600')}
              />
              {errors.microchipId && <p className="text-[13px] text-red-600 mt-1.5">{errors.microchipId}</p>}
            </div>
            <div>
              <label htmlFor="pet-collar" className={labelClass}>Collar and tag</label>
              <input
                id="pet-collar"
                value={form.collarInfo}
                onChange={(e) => set({ collarInfo: e.target.value })}
                placeholder="Blue collar, bone tag with phone number"
                aria-label="Collar and tag description"
                className={inputClass}
              />
            </div>
          </div>
        </Section>

        <Section label="Personality">
          <div className="flex flex-wrap items-center gap-2">
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
                className="px-3.5 py-2 rounded-full border border-dashed border-neutral-300 text-[13px] font-medium text-neutral-500 hover:border-neutral-900 hover:text-neutral-900 transition-colors"
              >
                Add trait
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
          {errors.personality && <p className="text-[13px] text-red-600 mt-2">{errors.personality}</p>}
        </Section>

        <Section label="Vet">
          <label htmlFor="pet-medical" className={labelClass}>Medical notes</label>
          <textarea
            id="pet-medical"
            value={form.medicalConditions}
            onChange={(e) => set({ medicalConditions: e.target.value })}
            placeholder="Allergies, conditions, daily medications"
            aria-label="Medical notes"
            rows={2}
            className={inputClass}
          />
        </Section>

        <p className="pt-2 pb-6">
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleting}
            className="text-[13px] font-medium text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
          >
            {deleting ? 'Removing...' : `Remove ${pet.name}`}
          </button>
        </p>

        {/* Save bar: only exists once something changed */}
        {dirty && (
          <div className="sticky bottom-0 bg-white border-t border-neutral-200 py-3">
            <div className="flex items-center justify-end gap-4">
              <button
                onClick={discard}
                disabled={submitting}
                className={cn(quietAction, 'disabled:opacity-50')}
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-700 disabled:opacity-40 transition-colors"
              >
                {submitting && <Loader2 size={15} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {deleteConfirmOpen && (
        <ConfirmModal
          onClose={() => setDeleteConfirmOpen(false)}
          title={`Remove ${pet.name}?`}
          body="This deletes their profile, care history, and medication log. It cannot be undone."
          confirmLabel="Remove"
          busy={deleting}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
