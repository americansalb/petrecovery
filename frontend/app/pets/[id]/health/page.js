'use client';

/**
 * The Health Book - the Health room (docs/HEALTH_BOOK_DESIGN.md)
 *
 * Status before data: one sentence up top, then the stamps, the
 * weight story, the timeline, and the vet card. Meds stays the daily
 * action surface; this room is what's TRUE about the pet. Reference,
 * not chores.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Plus, X, Check, Loader2, Trash2, Phone } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { Card, Badge, cn } from '@/components/ui';
import { ShieldIcon } from '@/app/components/icons/HealthIcons';
import { SyringeGlyph } from '@/app/components/icons/MedGlyphs';
import {
  vaccinationStatus, healthBookStatus, vaccinePresetsFor, DUE_SOON_DAYS,
} from '@/lib/healthBook';

const STATUS_STYLE = {
  PROTECTED: { label: 'Protected', chip: 'bg-emerald-100 text-emerald-700', ic: 'bg-emerald-100 text-emerald-700' },
  DUE_SOON: { label: 'Due soon', chip: 'bg-amber-100 text-amber-700', ic: 'bg-amber-100 text-amber-700' },
  EXPIRED: { label: 'Expired', chip: 'bg-red-100 text-red-700', ic: 'bg-red-100 text-red-600' },
  ON_FILE: { label: 'On file', chip: 'bg-slate-200 text-slate-700', ic: 'bg-slate-200 text-slate-600' },
};

const TONE_STYLE = {
  good: 'bg-emerald-100 text-emerald-700',
  warn: 'bg-amber-100 text-amber-700',
  bad: 'bg-red-100 text-red-600',
  empty: 'bg-midnight-100 text-midnight-400',
};

function shortDate(d) {
  return new Date(d).toLocaleDateString([], { month: 'short', year: 'numeric' });
}

/* ----------------------------- Add a stamp -------------------------------- */

function AddVaccineModal({ petId, species, onClose, onSaved }) {
  const presets = vaccinePresetsFor(species);
  const [picked, setPicked] = useState(null);
  const [customName, setCustomName] = useState('');
  const [givenOn, setGivenOn] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState(null); // years | 0 (no expiry)
  const [vetName, setVetName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const name = picked?.custom ? customName.trim() : picked?.name;
  const ready = !!name && !!givenOn && duration !== null;

  const save = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      const administeredAt = new Date(givenOn + 'T12:00:00');
      const expiresAt = duration > 0
        ? new Date(new Date(administeredAt).setFullYear(administeredAt.getFullYear() + duration))
        : null;
      const res = await fetch(`/api/pets/${petId}/vaccinations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, administeredAt, expiresAt, vetName: vetName.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      onSaved(data.vaccination);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative w-full max-w-md p-6 rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-midnight-400 hover:text-midnight-600">
          <X size={20} />
        </button>
        <h3 className="text-xl font-bold text-midnight-900 mb-1">Add a stamp</h3>
        <p className="text-sm text-midnight-500 mb-4">Straight off the certificate.</p>

        <div className="flex flex-wrap gap-2 mb-4">
          {presets.map((p) => (
            <button
              key={p.name}
              onClick={() => { setPicked(p); if (duration === null) setDuration(p.years); }}
              className={cn(
                'px-3.5 py-2 rounded-2xl border-2 text-sm font-bold transition-all',
                picked?.name === p.name ? 'border-flash-400 bg-flash-50 text-midnight-900' : 'border-midnight-200 text-midnight-500 hover:border-midnight-300'
              )}
            >
              {p.name}
            </button>
          ))}
          <button
            onClick={() => setPicked({ custom: true })}
            className={cn(
              'px-3.5 py-2 rounded-2xl border-2 border-dashed text-sm font-bold transition-all',
              picked?.custom ? 'border-flash-400 bg-flash-50 text-midnight-900' : 'border-midnight-300 text-midnight-400 hover:border-midnight-400'
            )}
          >
            Other
          </button>
        </div>

        {picked?.custom && (
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Vaccine name"
            className="w-full mb-4 rounded-xl border border-midnight-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-flash-400"
          />
        )}

        {picked && (
          <>
            <p className="text-xs font-bold uppercase tracking-wide text-midnight-400 mb-2">Given on</p>
            <input
              type="date"
              value={givenOn}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setGivenOn(e.target.value)}
              className="w-full mb-4 rounded-xl border border-midnight-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-flash-400"
            />
            <p className="text-xs font-bold uppercase tracking-wide text-midnight-400 mb-2">Good for</p>
            <div className="flex gap-2 mb-4">
              {[{ l: '1 year', v: 1 }, { l: '3 years', v: 3 }, { l: 'No expiry', v: 0 }].map(({ l, v }) => (
                <button
                  key={l}
                  onClick={() => setDuration(v)}
                  className={cn(
                    'px-3.5 py-2 rounded-2xl border-2 text-sm font-bold transition-all',
                    duration === v ? 'border-flash-400 bg-flash-50 text-midnight-900' : 'border-midnight-200 text-midnight-500 hover:border-midnight-300'
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            <input
              value={vetName}
              onChange={(e) => setVetName(e.target.value)}
              placeholder="Vet or clinic (optional)"
              className="w-full mb-4 rounded-xl border border-midnight-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-flash-400"
            />
          </>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{error}</p>}

        <button
          onClick={save}
          disabled={!ready || saving}
          className={cn(
            'w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-bold transition-colors',
            ready ? 'bg-flash-400 hover:bg-flash-300 text-midnight-900' : 'bg-midnight-100 text-midnight-400'
          )}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
          Stamp the book
        </button>
      </Card>
    </div>
  );
}

/* ------------------------------ Weight spark ------------------------------- */

function WeightSpark({ weights }) {
  if (weights.length < 2) return null;
  const w = 460; const h = 72; const pad = 6;
  const vals = weights.map((e) => e.weightLbs);
  const min = Math.min(...vals); const max = Math.max(...vals);
  const span = max - min || 1;
  const pts = weights.map((e, i) => {
    const x = pad + (i / (weights.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((e.weightLbs - min) / span) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = pts[pts.length - 1].split(',');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-3" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke="#facc15" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="4.5" fill="#0f172a" />
    </svg>
  );
}

/* --------------------------------- Page ----------------------------------- */

export default function HealthBookPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const petId = params.id;

  const [pet, setPet] = useState(null);
  const [vaccinations, setVaccinations] = useState([]);
  const [weights, setWeights] = useState([]);
  const [access, setAccess] = useState('VIEWER');
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [managing, setManaging] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [vetDraft, setVetDraft] = useState(null); // null = closed
  const [savingVet, setSavingVet] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/pets/${petId}/health`);
    }
  }, [status, router, petId]);

  const load = useCallback(async () => {
    try {
      const [vaxRes, weightRes, petRes] = await Promise.all([
        fetch(`/api/pets/${petId}/vaccinations`),
        fetch(`/api/pets/${petId}/weights`),
        fetch(`/api/pets/${petId}`),
      ]);
      if (vaxRes.ok) {
        const d = await vaxRes.json();
        setVaccinations(d.vaccinations || []);
        setAccess(d.access || 'VIEWER');
      }
      if (weightRes.ok) setWeights((await weightRes.json()).weights || []);
      if (petRes.ok) {
        const d = await petRes.json();
        setPet(d.pet || d);
      }
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    if (status === 'authenticated' && petId) load();
  }, [status, petId, load]);

  const bookStatus = useMemo(
    () => healthBookStatus(vaccinations, pet?.name || 'your pet'),
    [vaccinations, pet]
  );

  const story = useMemo(() => {
    const out = [];
    for (const v of vaccinations) {
      out.push({ at: new Date(v.administeredAt), node: `${v.name}${v.vetName ? ` · ${v.vetName}` : ''}`, kind: 'vax', id: `v-${v.id}` });
    }
    for (const e of weights) {
      out.push({ at: new Date(e.recordedAt), node: `${e.weightLbs} lbs${e.note ? ` · ${e.note}` : ''}`, kind: 'weight', id: `w-${e.id}` });
    }
    return out.sort((a, b) => b.at - a.at).slice(0, 12);
  }, [vaccinations, weights]);

  const logWeight = async () => {
    const v = parseFloat(weightInput);
    if (isNaN(v) || v <= 0 || savingWeight) return;
    setSavingWeight(true);
    setError(null);
    try {
      const res = await fetch(`/api/pets/${petId}/weights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weightLbs: v }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not log weight');
      setWeights((prev) => [...prev, data.entry]);
      setWeightInput('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingWeight(false);
    }
  };

  const removeVax = async (vax) => {
    try {
      const res = await fetch(`/api/pets/${petId}/vaccinations?vaccinationId=${vax.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove');
      setVaccinations((prev) => prev.filter((v) => v.id !== vax.id));
    } catch (err) {
      setError(err.message);
    }
  };

  const saveVet = async () => {
    if (savingVet) return;
    setSavingVet(true);
    setError(null);
    try {
      const res = await fetch(`/api/pets/${petId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vetDraft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setPet((prev) => ({ ...prev, ...vetDraft }));
      setVetDraft(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingVet(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner text="Opening the book..." />
      </div>
    );
  }
  if (status === 'unauthenticated') return null;

  const canManage = access !== 'VIEWER';
  const name = pet?.name || 'your pet';
  const isOwner = access === 'OWNER';
  const latestWeight = weights[weights.length - 1];

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="max-w-4xl mx-auto">
        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 rounded-xl mb-4 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss" className="text-red-400 hover:text-red-700"><X size={16} /></button>
          </div>
        )}

        {/* Status before data */}
        <Card padding="lg" className="mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <span className={cn('w-11 h-11 rounded-2xl flex items-center justify-center shrink-0', TONE_STYLE[bookStatus.tone])}>
              <ShieldIcon size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-midnight-900">{name}&apos;s Health Book</p>
              <p className="text-sm text-midnight-500">{bookStatus.sentence}</p>
            </div>
            {canManage && (
              <div className="flex items-center gap-1.5">
                {vaccinations.length > 0 && (
                  <button
                    onClick={() => setManaging((v) => !v)}
                    className={cn(
                      'px-3 py-2 rounded-xl text-sm font-bold transition-colors',
                      managing ? 'bg-midnight-900 text-white' : 'text-midnight-500 hover:bg-midnight-100'
                    )}
                  >
                    Manage
                  </button>
                )}
                <button
                  onClick={() => setShowAdd(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-flash-400 hover:bg-flash-300 text-midnight-900 text-sm font-bold transition-colors"
                >
                  <Plus size={15} /> Add vaccine
                </button>
              </div>
            )}
          </div>

          {/* The stamps */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {vaccinations.map((vax) => {
              const st = STATUS_STYLE[vaccinationStatus(vax)];
              return (
                <div key={vax.id} className="relative rounded-2xl border-2 border-midnight-100 px-3 py-4 flex flex-col items-center gap-2 text-center">
                  <span className={cn('absolute -top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide', st.chip)}>
                    {st.label}
                  </span>
                  <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center', st.ic)}>
                    <SyringeGlyph size={22} />
                  </span>
                  <span className="text-[13px] font-bold text-midnight-900 leading-tight">{vax.name}</span>
                  <span className="text-[11px] text-midnight-400 leading-tight">
                    {vax.expiresAt
                      ? (vaccinationStatus(vax) === 'EXPIRED' ? 'expired ' : 'until ') + shortDate(vax.expiresAt)
                      : shortDate(vax.administeredAt)}
                  </span>
                  {managing && (
                    <button
                      onClick={() => removeVax(vax)}
                      aria-label={`Remove ${vax.name}`}
                      className="absolute -top-2.5 left-2.5 w-6 h-6 rounded-full bg-white border border-midnight-200 text-midnight-400 hover:text-red-600 hover:border-red-300 flex items-center justify-center"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
            {canManage && (
              <button
                onClick={() => setShowAdd(true)}
                className="rounded-2xl border-2 border-dashed border-midnight-200 px-3 py-4 flex flex-col items-center justify-center gap-2 text-center text-midnight-400 hover:border-flash-400 hover:text-flash-500 transition-colors"
              >
                <span className="w-10 h-10 rounded-xl bg-midnight-50 flex items-center justify-center"><Plus size={18} /></span>
                <span className="text-[13px] font-bold">{vaccinations.length ? 'Another stamp' : 'First stamp'}</span>
              </button>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Weight */}
          <Card padding="lg">
            <h2 className="font-bold text-midnight-900">Weight</h2>
            <p className="text-sm text-midnight-500 mt-0.5">
              {latestWeight
                ? `${latestWeight.weightLbs} lbs · ${new Date(latestWeight.recordedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
                : 'No entries yet. One number, the chart draws itself.'}
            </p>
            <WeightSpark weights={weights} />
            {canManage && (
              <div className="flex items-center gap-2 mt-4">
                <div className="relative flex-1">
                  <input
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && logWeight()}
                    placeholder="Today's weight"
                    inputMode="decimal"
                    className="w-full rounded-xl border-2 border-midnight-200 px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:border-flash-400"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-midnight-400">lbs</span>
                </div>
                <button
                  onClick={logWeight}
                  disabled={savingWeight || !weightInput}
                  className="px-3.5 py-2.5 rounded-xl bg-midnight-900 text-white text-sm font-bold hover:bg-midnight-800 disabled:opacity-40 transition-colors"
                >
                  {savingWeight ? <Loader2 size={15} className="animate-spin" /> : 'Log'}
                </button>
              </div>
            )}
          </Card>

          {/* Vet card */}
          <Card padding="lg">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-midnight-900">The vet</h2>
              {isOwner && vetDraft === null && (
                <button
                  onClick={() => setVetDraft({ vetName: pet?.vetName || '', vetClinic: pet?.vetClinic || '', vetPhone: pet?.vetPhone || '' })}
                  className="text-sm font-bold text-midnight-400 hover:text-midnight-700"
                >
                  {pet?.vetName || pet?.vetClinic ? 'Edit' : 'Add'}
                </button>
              )}
            </div>
            {vetDraft ? (
              <div className="space-y-2.5 mt-3">
                {[['vetName', 'Vet name'], ['vetClinic', 'Clinic'], ['vetPhone', 'Phone']].map(([key, ph]) => (
                  <input
                    key={key}
                    value={vetDraft[key]}
                    onChange={(e) => setVetDraft((d) => ({ ...d, [key]: e.target.value }))}
                    placeholder={ph}
                    className="w-full rounded-xl border-2 border-midnight-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-flash-400"
                  />
                ))}
                <div className="flex gap-2 pt-1">
                  <button onClick={saveVet} disabled={savingVet} className="px-3.5 py-2 rounded-xl bg-flash-400 text-midnight-900 text-sm font-bold">
                    {savingVet ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setVetDraft(null)} className="px-3.5 py-2 rounded-xl text-sm font-bold text-midnight-400 hover:text-midnight-700">
                    Cancel
                  </button>
                </div>
              </div>
            ) : pet?.vetName || pet?.vetClinic ? (
              <div className="mt-3 text-sm">
                <p className="font-semibold text-midnight-900">{[pet.vetName, pet.vetClinic].filter(Boolean).join(' · ')}</p>
                {pet.vetPhone && (
                  <a href={`tel:${pet.vetPhone}`} className="inline-flex items-center gap-1.5 mt-1.5 text-midnight-500 hover:text-midnight-900 font-semibold">
                    <Phone size={13} /> {pet.vetPhone}
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-midnight-500 mt-3">
                {isOwner ? `Who takes care of ${name}? One tap from a sitter's phone in an emergency.` : 'No vet on file yet.'}
              </p>
            )}
          </Card>
        </div>

        {/* The story */}
        {story.length > 0 && (
          <Card padding="lg" className="mb-4">
            <h2 className="font-bold text-midnight-900 mb-2">The story</h2>
            <ul className="divide-y divide-midnight-100">
              {story.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="text-midnight-400 text-xs w-16 shrink-0">
                    {item.at.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                  <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                    item.kind === 'vax' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700')}>
                    {item.kind === 'vax' ? <SyringeGlyph size={15} /> : <span className="text-[10px] font-extrabold">lb</span>}
                  </span>
                  <span className="text-midnight-800 font-semibold truncate">{item.node}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <p className="text-center text-xs text-midnight-400 pt-2 pb-6">
          A record you keep, not medical advice. Your vet&apos;s guidance comes first.
        </p>
      </div>

      {showAdd && (
        <AddVaccineModal
          petId={petId}
          species={pet?.species}
          onClose={() => setShowAdd(false)}
          onSaved={(vax) => setVaccinations((prev) => [vax, ...prev])}
        />
      )}
    </div>
  );
}
