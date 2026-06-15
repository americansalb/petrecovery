'use client';

/**
 * Add Pet Wizard — one decision per screen, structured answers only.
 *
 * Route: /pets/new
 * Name → Species → Coat color (real swatches) → Size (tap cards) → Breed
 * (species-aware autocomplete) → About them → Markings & ID (validated
 * microchip) → Photos → Personality. Every identifying attribute is a
 * canonical, tappable choice so profiles carry accurate, matchable data —
 * this feeds flyers, lost/found matching, and finders, not just meds.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Check,
  Camera, Sparkles, Heart, Pill, X, PartyPopper, Palette, Ruler,
  Fingerprint, Smile,
} from 'lucide-react';
import { DogIcon, CatIcon, BirdIcon, RabbitIcon, PawIcon } from '@/app/components/icons/SpeciesIcons';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import ImageUpload from '@/app/components/ImageUpload';
import { Button, cn } from '@/components/ui';
import { getBreedsForSpecies } from '@/app/lib/breeds';
import {
  COAT_COLORS, COAT_PATTERNS, MAX_COAT_COLORS, composeColor, validateMicrochip,
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
  { value: 'SMALL', label: 'Small', hint: '10–25 lbs', paw: 18 },
  { value: 'MEDIUM', label: 'Medium', hint: '25–50 lbs', paw: 23 },
  { value: 'LARGE', label: 'Large', hint: '50–90 lbs', paw: 28 },
  { value: 'GIANT', label: 'Giant', hint: '90+ lbs', paw: 34 },
];

const SEX_OPTIONS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'UNKNOWN', label: 'Not sure' },
];

const PERSONALITY_TRAITS = [
  'Friendly', 'Shy', 'Energetic', 'Calm', 'Playful',
  'Anxious', 'Aggressive when scared', 'Good with kids',
  'Good with other pets', 'Comes when called',
];

const NAME_MAX = 40;

const inputClass =
  'w-full rounded-2xl border-2 border-midnight-200 bg-white px-4 py-3.5 text-lg text-midnight-900 ' +
  'placeholder:text-midnight-300 focus:outline-none focus:border-flash-400 focus:ring-4 focus:ring-flash-100 transition';

function StepShell({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="animate-slide-up">
      <div className="w-12 h-12 rounded-2xl bg-flash-100 text-flash-700 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-midnight-900 mb-1.5">{title}</h1>
      {subtitle && <p className="text-midnight-500 mb-6">{subtitle}</p>}
      {children}
    </div>
  );
}

function Chip({ active, onClick, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3.5 py-2 rounded-xl text-sm font-semibold border-2 transition-colors',
        active
          ? 'border-flash-400 bg-flash-50 text-midnight-900'
          : 'border-midnight-200 bg-white text-midnight-600 hover:border-midnight-300',
        className
      )}
    >
      {children}
    </button>
  );
}

export default function NewPetWizard() {
  const { status } = useSession();
  const router = useRouter();
  const inputRef = useRef(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [createdPet, setCreatedPet] = useState(null);
  const [form, setForm] = useState({
    name: '', species: null,
    coatColors: [], coatPattern: null,
    size: null,
    breed: '', age: '', sex: '', isNeutered: false, weight: '',
    distinctiveMarks: '', microchipId: '', collarInfo: '',
    personality: [], medicalConditions: '',
  });
  const [breedQuery, setBreedQuery] = useState('');
  const [images, setImages] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Breed step only makes sense when we have a breed list for the species.
  const STEPS = useMemo(() => {
    const base = ['name', 'species', 'colors', 'size'];
    if (form.species && form.species !== 'OTHER') base.push('breed');
    return [...base, 'about', 'identification', 'photos', 'personality'];
  }, [form.species]);

  const stepKey = STEPS[stepIndex];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/pets/new');
    }
  }, [status, router]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [stepIndex]);

  const set = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    if (error) setError(null);
  };

  const breedSuggestions = useMemo(() => {
    if (stepKey !== 'breed' || !form.species) return [];
    const all = getBreedsForSpecies(form.species) || [];
    const q = breedQuery.trim().toLowerCase();
    if (!q) return all.slice(0, 6);
    return all.filter((b) => b.toLowerCase().includes(q)).slice(0, 6);
  }, [stepKey, form.species, breedQuery]);

  const optionalStep = ['about', 'identification', 'photos', 'personality'].includes(stepKey);

  const stepReady = (() => {
    switch (stepKey) {
      case 'name': return form.name.trim().length > 0;
      case 'species': return Boolean(form.species);
      case 'colors': return form.coatColors.length > 0;
      case 'size': return Boolean(form.size);
      case 'breed': return true; // skippable via chip or Skip
      default: return true;
    }
  })();

  const validateStep = () => {
    switch (stepKey) {
      case 'name': {
        const name = form.name.trim();
        if (!name) return "What's their name?";
        if (name.length > NAME_MAX) return `Keep the name under ${NAME_MAX} characters`;
        if (!/[a-zA-Z]/.test(name)) return 'Names need at least one letter';
        return null;
      }
      case 'species':
        return form.species ? null : 'Pick the closest match';
      case 'colors':
        return form.coatColors.length ? null : 'Tap at least one coat color. Finders search by color first';
      case 'size':
        return form.size ? null : 'Pick the closest size';
      case 'about': {
        if (form.age !== '' && (!Number.isInteger(Number(form.age)) || form.age < 0 || form.age > 50)) {
          return 'Age should be a whole number between 0 and 50';
        }
        if (form.weight !== '' && (Number.isNaN(Number(form.weight)) || form.weight <= 0 || form.weight > 400)) {
          return 'Weight should be between 1 and 400 lbs';
        }
        return null;
      }
      case 'identification': {
        const chip = validateMicrochip(form.microchipId);
        if (!chip.ok) return chip.error;
        return null;
      }
      default:
        return null;
    }
  };

  const next = () => {
    const problem = validateStep();
    if (problem) { setError(problem); return; }
    setError(null);
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
    else save();
  };

  const back = () => { setError(null); if (stepIndex > 0) setStepIndex(stepIndex - 1); };
  const onEnter = (e) => { if (e.key === 'Enter') { e.preventDefault(); next(); } };

  // Pure-choice steps advance on tap — picking IS the decision.
  const pickAndAdvance = (patch) => {
    set(patch);
    setTimeout(() => setStepIndex((i) => i + 1), 250);
  };

  const toggleCoatColor = (value) => {
    const has = form.coatColors.includes(value);
    if (!has && form.coatColors.length >= MAX_COAT_COLORS) {
      setError(`Pick up to ${MAX_COAT_COLORS} main colors, the ones a stranger would name`);
      return;
    }
    set({ coatColors: has ? form.coatColors.filter((c) => c !== value) : [...form.coatColors, value] });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const photoUrls = images.map((img) => img.url);
      const chip = validateMicrochip(form.microchipId);
      const res = await fetch('/api/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          species: form.species,
          color: composeColor(form.coatColors, form.coatPattern),
          size: form.size,
          breed: form.breed.trim() || null,
          age: form.age !== '' ? parseInt(form.age, 10) : null,
          sex: form.sex || null,
          isNeutered: form.isNeutered,
          weight: form.weight !== '' ? parseFloat(form.weight) : null,
          distinctiveMarks: form.distinctiveMarks.trim() || null,
          microchipId: chip.value,
          collarInfo: form.collarInfo.trim() || null,
          personality: form.personality,
          medicalConditions: form.medicalConditions.trim() || null,
          photos: photoUrls,
          primaryPhotoUrl: photoUrls[0] || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create pet profile');
      setCreatedPet(data.pet);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center">
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }
  if (status === 'unauthenticated') return null;

  const petName = form.name.trim() || 'your pet';

  return (
    <div className="min-h-screen bg-midnight-50 px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-xl mx-auto">
        <Link href="/pets" className="inline-flex items-center gap-1.5 text-sm font-semibold text-midnight-500 hover:text-midnight-800 transition-colors mb-5">
          <ArrowLeft size={16} /> My Pets
        </Link>

        <div className="bg-white rounded-3xl shadow-card p-6 md:p-8 border border-midnight-100">
          {createdPet ? (
            <div className="text-center animate-slide-up py-4">
              <div className="w-16 h-16 rounded-full bg-flash-100 text-flash-600 flex items-center justify-center mx-auto mb-5">
                <PartyPopper className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-midnight-900 mb-2">{createdPet.name} is on file!</h1>
              <p className="text-midnight-500 mb-8">
                If they ever go missing, a report is one tap away with every detail already filled in.
              </p>
              <div className="space-y-3">
                <Button variant="primary" fullWidth size="lg" href={`/pets/${createdPet.id}/today`} leftIcon={Pill}>
                  Track {createdPet.name}&apos;s medications
                </Button>
                <Button variant="outline" fullWidth size="lg" href="/pets">
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Progress */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wide text-midnight-400">
                  Step {stepIndex + 1} of {STEPS.length}
                </span>
                {optionalStep && <span className="text-xs font-semibold text-midnight-400">Optional</span>}
              </div>
              <div className="h-1.5 bg-midnight-100 rounded-full mb-8 overflow-hidden" role="progressbar"
                aria-valuenow={stepIndex + 1} aria-valuemin={1} aria-valuemax={STEPS.length} aria-label="Add pet progress">
                <div className="h-full bg-flash-400 rounded-full transition-all duration-500" style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
              </div>

              {stepKey === 'name' && (
                <StepShell icon={Heart} title="Who are we adding?" subtitle="Their name, as shouted across the park.">
                  <input
                    ref={inputRef}
                    value={form.name}
                    maxLength={NAME_MAX}
                    onChange={(e) => set({ name: e.target.value })}
                    onKeyDown={onEnter}
                    placeholder="Biscuit"
                    aria-label="Pet name"
                    className={inputClass}
                  />
                </StepShell>
              )}

              {stepKey === 'species' && (
                <StepShell icon={PawIcon} title={`What is ${petName}?`} subtitle="Tap the closest match.">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {SPECIES_OPTIONS.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => pickAndAdvance({ species: value })}
                        className={cn(
                          'flex flex-col items-center gap-2 rounded-2xl border-2 p-5 transition-all',
                          form.species === value
                            ? 'border-flash-400 bg-flash-50 scale-[1.03]'
                            : 'border-midnight-200 bg-white hover:border-midnight-300 hover:-translate-y-0.5'
                        )}
                      >
                        <Icon className={cn('w-8 h-8', form.species === value ? 'text-flash-600' : 'text-midnight-400')} />
                        <span className="font-semibold text-midnight-900">{label}</span>
                      </button>
                    ))}
                  </div>
                </StepShell>
              )}

              {stepKey === 'colors' && (
                <StepShell icon={Palette} title={`What color is ${petName}'s coat?`} subtitle={`Tap up to ${MAX_COAT_COLORS}, the colors a stranger would name. This is how finders search.`}>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 mb-6">
                    {COAT_COLORS.map(({ value, css, border }) => {
                      const active = form.coatColors.includes(value);
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
                              'w-12 h-12 rounded-full transition-all flex items-center justify-center',
                              border && 'border border-midnight-200',
                              active ? 'ring-[3px] ring-offset-2 ring-flash-500 scale-110' : 'group-hover:scale-105'
                            )}
                            style={{ background: css }}
                          >
                            {active && (
                              <span className="w-5 h-5 rounded-full bg-white/95 text-midnight-900 flex items-center justify-center shadow">
                                <Check size={13} strokeWidth={3.5} />
                              </span>
                            )}
                          </span>
                          <span className={cn('text-[11px] font-semibold', active ? 'text-midnight-900' : 'text-midnight-500')}>
                            {value}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-sm font-semibold text-midnight-800 mb-2">Pattern <span className="font-normal text-midnight-400">(optional)</span></p>
                  <div className="flex flex-wrap gap-2 mb-5">
                    {COAT_PATTERNS.map((p) => (
                      <Chip key={p} active={form.coatPattern === p} onClick={() => set({ coatPattern: form.coatPattern === p ? null : p })}>
                        {p}
                      </Chip>
                    ))}
                  </div>

                  {form.coatColors.length > 0 && (
                    <p className="text-sm text-midnight-600 bg-midnight-50 border border-midnight-200 rounded-xl px-4 py-2.5">
                      On flyers: <strong className="text-midnight-900">{composeColor(form.coatColors, form.coatPattern)}</strong>
                    </p>
                  )}
                </StepShell>
              )}

              {stepKey === 'size' && (
                <StepShell icon={Ruler} title={`How big is ${petName}?`} subtitle="Tap the closest size.">
                  <div className="space-y-2.5">
                    {SIZE_OPTIONS.map(({ value, label, hint, paw }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => pickAndAdvance({ size: value })}
                        className={cn(
                          'w-full flex items-center gap-4 rounded-2xl border-2 px-4 py-3 transition-all text-left',
                          form.size === value
                            ? 'border-flash-400 bg-flash-50'
                            : 'border-midnight-200 bg-white hover:border-midnight-300'
                        )}
                      >
                        <span className="w-10 flex items-center justify-center">
                          <PawIcon size={paw} className={form.size === value ? 'text-flash-600' : 'text-midnight-400'} />
                        </span>
                        <span className="font-bold text-midnight-900">{label}</span>
                        <span className="text-sm text-midnight-500 ml-auto">{hint}</span>
                      </button>
                    ))}
                  </div>
                </StepShell>
              )}

              {stepKey === 'breed' && (
                <StepShell icon={Sparkles} title="Know the breed?" subtitle="Start typing and pick from the list so searches match exactly.">
                  <input
                    ref={inputRef}
                    value={breedQuery || form.breed}
                    onChange={(e) => { setBreedQuery(e.target.value); set({ breed: e.target.value }); }}
                    onKeyDown={onEnter}
                    placeholder={form.species === 'CAT' ? 'Siamese' : form.species === 'DOG' ? 'Golden Retriever' : 'Breed'}
                    aria-label="Breed"
                    className={inputClass}
                  />
                  <div className="mt-3 space-y-1.5">
                    {breedSuggestions.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => { set({ breed: b }); setBreedQuery(b); }}
                        className={cn(
                          'w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors',
                          form.breed === b
                            ? 'border-flash-400 bg-flash-50 text-midnight-900'
                            : 'border-midnight-150 border-midnight-200 text-midnight-600 hover:border-midnight-300 hover:bg-midnight-50'
                        )}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Chip
                      active={form.breed === 'Mixed breed'}
                      onClick={() => pickAndAdvance({ breed: 'Mixed breed' })}
                    >
                      Mixed / not sure
                    </Chip>
                  </div>
                </StepShell>
              )}

              {stepKey === 'about' && (
                <StepShell icon={Smile} title="A few details" subtitle="All optional. Skip anything you're not sure of.">
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 mb-1.5">Sex</label>
                      <div className="flex flex-wrap gap-2">
                        {SEX_OPTIONS.map((opt) => (
                          <Chip key={opt.value} active={form.sex === opt.value} onClick={() => set({ sex: form.sex === opt.value ? '' : opt.value })}>
                            {opt.label}
                          </Chip>
                        ))}
                        <Chip active={form.isNeutered} onClick={() => set({ isNeutered: !form.isNeutered })}>
                          Neutered / spayed
                        </Chip>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-midnight-800 mb-1.5">Age (years)</label>
                        <input ref={inputRef} type="number" min="0" max="50" step="1" value={form.age} onChange={(e) => set({ age: e.target.value })} onKeyDown={onEnter} placeholder="3" className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-midnight-800 mb-1.5">Weight (lbs)</label>
                        <input type="number" min="1" max="400" value={form.weight} onChange={(e) => set({ weight: e.target.value })} onKeyDown={onEnter} placeholder="25" className={inputClass} />
                      </div>
                    </div>
                  </div>
                </StepShell>
              )}

              {stepKey === 'identification' && (
                <StepShell icon={Fingerprint} title="Marks & ID" subtitle="The details that turn 'I think that's him' into 'that's definitely him.'">
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 mb-1.5">Distinctive marks</label>
                      <input
                        ref={inputRef}
                        value={form.distinctiveMarks}
                        onChange={(e) => set({ distinctiveMarks: e.target.value })}
                        onKeyDown={onEnter}
                        maxLength={300}
                        placeholder="White sock on left paw, notched ear, scar…"
                        className={inputClass}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-midnight-800 mb-1.5">Microchip ID</label>
                        <input
                          value={form.microchipId}
                          onChange={(e) => set({ microchipId: e.target.value })}
                          onKeyDown={onEnter}
                          placeholder="985112004567890"
                          className={cn(inputClass, form.microchipId && !validateMicrochip(form.microchipId).ok && 'border-red-300 bg-red-50/40')}
                        />
                        <p className="text-xs text-midnight-400 mt-1.5">9–15 digits, on the vet paperwork</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-midnight-800 mb-1.5">Collar</label>
                        <input value={form.collarInfo} onChange={(e) => set({ collarInfo: e.target.value })} onKeyDown={onEnter} maxLength={120} placeholder="Red collar, bone tag" className={inputClass} />
                      </div>
                    </div>
                  </div>
                </StepShell>
              )}

              {stepKey === 'photos' && (
                <StepShell icon={Camera} title={`Show ${petName} off`} subtitle="Clear photos make flyers and AI matching dramatically better. First photo becomes the cover.">
                  <ImageUpload
                    images={images}
                    onUpload={(newImages) => setImages((prev) => [...prev, ...newImages])}
                    onRemove={(index) => setImages((prev) => prev.filter((_, i) => i !== index))}
                    maxImages={5}
                    context="pet"
                    label="Pet Photos"
                    helpText="Drag photos here, or click to browse"
                  />
                </StepShell>
              )}

              {stepKey === 'personality' && (
                <StepShell icon={Smile} title={`What's ${petName} like?`} subtitle="Helps rescuers approach them the right way.">
                  <div className="space-y-5">
                    <div className="flex flex-wrap gap-2">
                      {PERSONALITY_TRAITS.map((trait) => (
                        <Chip
                          key={trait}
                          active={form.personality.includes(trait)}
                          onClick={() => set({
                            personality: form.personality.includes(trait)
                              ? form.personality.filter((t) => t !== trait)
                              : [...form.personality, trait],
                          })}
                        >
                          {trait}
                        </Chip>
                      ))}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 mb-1.5">Medical conditions</label>
                      <input value={form.medicalConditions} onChange={(e) => set({ medicalConditions: e.target.value })} onKeyDown={onEnter} maxLength={300} placeholder="Allergies, needs daily meds…" className={inputClass} />
                    </div>
                  </div>
                </StepShell>
              )}

              {error && (
                <div role="alert" className="mt-4 bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
                  <span>{error}</span>
                  <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700" aria-label="Dismiss error"><X size={16} /></button>
                </div>
              )}

              {/* Nav */}
              <div className="flex items-center justify-between gap-3 mt-8 pt-5 border-t border-midnight-100">
                {stepIndex > 0 ? (
                  <Button variant="ghost" onClick={back} leftIcon={ArrowLeft}>Back</Button>
                ) : <span />}
                <div className="flex items-center gap-2">
                  {(optionalStep || stepKey === 'breed') && stepIndex < STEPS.length - 1 && (
                    <Button variant="ghost" onClick={() => { setError(null); setStepIndex(stepIndex + 1); }}>Skip</Button>
                  )}
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={next}
                    disabled={!stepReady || saving}
                    loading={saving}
                    rightIcon={stepIndex < STEPS.length - 1 ? ArrowRight : undefined}
                    leftIcon={stepIndex === STEPS.length - 1 ? Check : undefined}
                  >
                    {stepIndex === STEPS.length - 1 ? `Add ${form.name.trim() || 'pet'}` : 'Continue'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
