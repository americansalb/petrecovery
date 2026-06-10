'use client';

/**
 * Add Pet Wizard — one clean decision per screen.
 *
 * Route: /pets/new
 * Name → Species → Looks → Details (skippable) → Photos (skippable) →
 * Extras (skippable), then a finale that hands off to the medication tracker.
 * Submits the same payload to POST /api/pets as the old single-page form.
 */

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Check, Dog, Cat, Bird, Rabbit, PawPrint,
  Camera, Sparkles, Heart, Pill, X, PartyPopper,
} from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import ImageUpload from '@/app/components/ImageUpload';
import { Button, cn } from '@/components/ui';

const SPECIES_OPTIONS = [
  { value: 'DOG', label: 'Dog', icon: Dog },
  { value: 'CAT', label: 'Cat', icon: Cat },
  { value: 'BIRD', label: 'Bird', icon: Bird },
  { value: 'RABBIT', label: 'Rabbit', icon: Rabbit },
  { value: 'OTHER', label: 'Other', icon: PawPrint },
];

const SIZE_OPTIONS = [
  { value: 'TINY', label: 'Tiny', hint: 'under 10 lbs' },
  { value: 'SMALL', label: 'Small', hint: '10–25 lbs' },
  { value: 'MEDIUM', label: 'Medium', hint: '25–50 lbs' },
  { value: 'LARGE', label: 'Large', hint: '50–90 lbs' },
  { value: 'GIANT', label: 'Giant', hint: '90+ lbs' },
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

const STEPS = ['name', 'species', 'looks', 'details', 'photos', 'extras'];

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

  const [step, setStep] = useState(0);
  const [createdPet, setCreatedPet] = useState(null);
  const [form, setForm] = useState({
    name: '', species: null, breed: '', age: '', sex: '', isNeutered: false,
    color: '', size: 'MEDIUM', weight: '', distinctiveMarks: '',
    microchipId: '', collarInfo: '', personality: [], medicalConditions: '',
  });
  const [images, setImages] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/pets/new');
    }
  }, [status, router]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const set = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    if (error) setError(null);
  };

  const stepKey = STEPS[step];
  const optionalStep = ['details', 'photos', 'extras'].includes(stepKey);

  const stepReady = (() => {
    switch (stepKey) {
      case 'name': return form.name.trim().length > 0;
      case 'species': return Boolean(form.species);
      case 'looks': return form.color.trim().length > 0 && Boolean(form.size);
      default: return true;
    }
  })();

  const validateStep = () => {
    switch (stepKey) {
      case 'name':
        return form.name.trim() ? null : "What's their name?";
      case 'species':
        return form.species ? null : 'Pick the closest match';
      case 'looks':
        if (!form.color.trim()) return 'A color helps finders recognize them';
        return null;
      case 'details':
        if (form.age && (Number.isNaN(Number(form.age)) || form.age < 0 || form.age > 50)) return 'Age should be 0–50';
        if (form.weight && (Number.isNaN(Number(form.weight)) || form.weight < 0)) return 'Weight should be a number';
        return null;
      default:
        return null;
    }
  };

  const next = () => {
    const problem = validateStep();
    if (problem) { setError(problem); return; }
    setError(null);
    if (step < STEPS.length - 1) setStep(step + 1);
    else save();
  };

  const back = () => { setError(null); if (step > 0) setStep(step - 1); };
  const onEnter = (e) => { if (e.key === 'Enter') { e.preventDefault(); next(); } };

  const pickSpecies = (value) => {
    set({ species: value });
    // A pure-choice step: picking it IS the decision, so glide forward.
    setTimeout(() => { setStep((s) => (STEPS[s] === 'species' ? s + 1 : s)); }, 250);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const photoUrls = images.map((img) => img.url);
      const res = await fetch('/api/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          color: form.color.trim(),
          age: form.age ? parseInt(form.age, 10) : null,
          weight: form.weight ? parseFloat(form.weight) : null,
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

  return (
    <div className="min-h-screen bg-midnight-50 px-4 py-6 md:px-8 md:py-10">
      <div className="max-w-xl mx-auto">
        <Link href="/pets" className="inline-flex items-center gap-1.5 text-sm font-semibold text-midnight-500 hover:text-midnight-800 transition-colors mb-5">
          <ArrowLeft size={16} /> My Pets
        </Link>

        <div className="bg-white rounded-3xl shadow-card p-6 md:p-8 border border-midnight-100">
          {createdPet ? (
            /* ------------------------------ Finale ------------------------------ */
            <div className="text-center animate-slide-up py-4">
              <div className="w-16 h-16 rounded-full bg-flash-100 text-flash-600 flex items-center justify-center mx-auto mb-5">
                <PartyPopper className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-midnight-900 mb-2">{createdPet.name} is on file!</h1>
              <p className="text-midnight-500 mb-8">
                If they ever go missing, a report is one tap away — every detail is already filled in.
              </p>
              <div className="space-y-3">
                <Button variant="primary" fullWidth size="lg" href={`/pets/${createdPet.id}/medications`} leftIcon={Pill}>
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
                  Step {step + 1} of {STEPS.length}
                </span>
                {optionalStep && <span className="text-xs font-semibold text-midnight-400">Optional</span>}
              </div>
              <div className="h-1.5 bg-midnight-100 rounded-full mb-8 overflow-hidden" role="progressbar"
                aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length} aria-label="Add pet progress">
                <div className="h-full bg-flash-400 rounded-full transition-all duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
              </div>

              {stepKey === 'name' && (
                <StepShell icon={Heart} title="Who are we adding?" subtitle="Their name, as shouted across the park.">
                  <input
                    ref={inputRef}
                    value={form.name}
                    onChange={(e) => set({ name: e.target.value })}
                    onKeyDown={onEnter}
                    placeholder="Biscuit"
                    aria-label="Pet name"
                    className={inputClass}
                  />
                </StepShell>
              )}

              {stepKey === 'species' && (
                <StepShell icon={PawPrint} title={`What is ${form.name.trim() || 'your pet'}?`} subtitle="Tap the closest match.">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {SPECIES_OPTIONS.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => pickSpecies(value)}
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

              {stepKey === 'looks' && (
                <StepShell icon={Sparkles} title="What do they look like?" subtitle="The details a stranger would notice first.">
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 mb-1.5">Color / markings <span className="text-red-500">*</span></label>
                      <input
                        ref={inputRef}
                        value={form.color}
                        onChange={(e) => set({ color: e.target.value })}
                        onKeyDown={onEnter}
                        placeholder="Golden with a white chest"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 mb-1.5">Size</label>
                      <div className="flex flex-wrap gap-2">
                        {SIZE_OPTIONS.map((opt) => (
                          <Chip key={opt.value} active={form.size === opt.value} onClick={() => set({ size: opt.value })}>
                            {opt.label} <span className="font-normal opacity-60">· {opt.hint}</span>
                          </Chip>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 mb-1.5">
                        Distinctive marks <span className="font-normal text-midnight-400">(optional)</span>
                      </label>
                      <input
                        value={form.distinctiveMarks}
                        onChange={(e) => set({ distinctiveMarks: e.target.value })}
                        onKeyDown={onEnter}
                        placeholder="Scar on left ear, cropped tail…"
                        className={inputClass}
                      />
                    </div>
                  </div>
                </StepShell>
              )}

              {stepKey === 'details' && (
                <StepShell icon={Dog} title="A few details" subtitle="All optional — skip anything you're not sure of.">
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-midnight-800 mb-1.5">Breed</label>
                        <input ref={inputRef} value={form.breed} onChange={(e) => set({ breed: e.target.value })} onKeyDown={onEnter} placeholder="Golden Retriever" className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-midnight-800 mb-1.5">Age (years)</label>
                        <input type="number" min="0" max="50" value={form.age} onChange={(e) => set({ age: e.target.value })} onKeyDown={onEnter} placeholder="3" className={inputClass} />
                      </div>
                    </div>
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
                    <div className="w-1/2 pr-2">
                      <label className="block text-sm font-semibold text-midnight-800 mb-1.5">Weight (lbs)</label>
                      <input type="number" min="0" value={form.weight} onChange={(e) => set({ weight: e.target.value })} onKeyDown={onEnter} placeholder="25" className={inputClass} />
                    </div>
                  </div>
                </StepShell>
              )}

              {stepKey === 'photos' && (
                <StepShell icon={Camera} title="Show them off" subtitle="Clear photos make flyers and matches dramatically better. First photo becomes the cover.">
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

              {stepKey === 'extras' && (
                <StepShell icon={Check} title="Last bits" subtitle="Identification & personality — all optional, all useful in a search.">
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-midnight-800 mb-1.5">Microchip ID</label>
                        <input ref={inputRef} value={form.microchipId} onChange={(e) => set({ microchipId: e.target.value })} onKeyDown={onEnter} placeholder="985112…" className={inputClass} />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-midnight-800 mb-1.5">Collar</label>
                        <input value={form.collarInfo} onChange={(e) => set({ collarInfo: e.target.value })} onKeyDown={onEnter} placeholder="Red collar, bone tag" className={inputClass} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 mb-1.5">Personality</label>
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
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-midnight-800 mb-1.5">Medical conditions</label>
                      <input value={form.medicalConditions} onChange={(e) => set({ medicalConditions: e.target.value })} onKeyDown={onEnter} placeholder="Allergies, needs daily meds…" className={inputClass} />
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
                {step > 0 ? (
                  <Button variant="ghost" onClick={back} leftIcon={ArrowLeft}>Back</Button>
                ) : <span />}
                <div className="flex items-center gap-2">
                  {optionalStep && step < STEPS.length - 1 && (
                    <Button variant="ghost" onClick={() => { setError(null); setStep(step + 1); }}>Skip</Button>
                  )}
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={next}
                    disabled={!stepReady || saving}
                    loading={saving}
                    rightIcon={step < STEPS.length - 1 ? ArrowRight : undefined}
                    leftIcon={step === STEPS.length - 1 ? Check : undefined}
                  >
                    {step === STEPS.length - 1 ? `Add ${form.name.trim() || 'pet'}` : 'Continue'}
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
