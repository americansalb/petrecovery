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
import {
  Plus, X, Check, Loader2, Trash2, Phone, ArrowRight, ShieldCheck,
  AlertTriangle, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { Card, cn } from '@/components/ui';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { ShieldIcon } from '@/app/components/icons/HealthIcons';
import { SyringeGlyph, PillGlyph } from '@/app/components/icons/MedGlyphs';
import { SpeciesIcon } from '@/app/components/icons/SpeciesIcons';
import { MedCard } from '@/app/components/medications/MedCards';
import { sameDay } from '@/lib/medications';
import {
  vaccinationStatus, healthBookStatus, vaccinePresetsFor,
} from '@/lib/healthBook';

const STATUS_STYLE = {
  PROTECTED: { label: 'Protected', chip: 'bg-emerald-100 text-emerald-700', ic: 'bg-emerald-100 text-emerald-700' },
  DUE_SOON: { label: 'Due soon', chip: 'bg-amber-100 text-amber-700', ic: 'bg-amber-100 text-amber-700' },
  EXPIRED: { label: 'Expired', chip: 'bg-red-100 text-red-700', ic: 'bg-red-100 text-red-600' },
  ON_FILE: { label: 'On file', chip: 'bg-slate-200 text-slate-700', ic: 'bg-slate-200 text-slate-600' },
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

/* --------------------------- Presentation helpers -------------------------- */

// The hero's register, keyed to healthBookStatus tone: a calm, warm
// daylight verdict, not a clinical banner.
const HERO_TONE = {
  good:  { wash: 'from-emerald-100/80 via-white to-amber-50/50', ring: 'ring-emerald-100', glyph: 'bg-emerald-500', icon: ShieldCheck,   head: (n) => `${n} is doing great.` },
  warn:  { wash: 'from-amber-100/80 via-white to-amber-50/40',   ring: 'ring-amber-100',   glyph: 'bg-amber-500',   icon: AlertTriangle, head: (n) => `${n} has one thing due.` },
  bad:   { wash: 'from-rose-100/80 via-white to-amber-50/30',    ring: 'ring-rose-100',    glyph: 'bg-rose-500',    icon: AlertTriangle, head: (n) => `${n} needs attention.` },
  empty: { wash: 'from-flash-100/80 via-white to-white',         ring: 'ring-midnight-100',glyph: 'bg-midnight-400',icon: ShieldIcon,    head: (n) => `Let's start ${n}'s book.` },
};

function protectionSummary(vaccinations) {
  const live = (vaccinations || []).filter((v) => !v.deletedAt);
  const withExpiry = live.filter((v) => v.expiresAt);
  return {
    total: live.length,
    withExpiry: withExpiry.length,
    protectedCount: withExpiry.filter((v) => vaccinationStatus(v) === 'PROTECTED').length,
    dueSoon: withExpiry.filter((v) => vaccinationStatus(v) === 'DUE_SOON').length,
    expired: withExpiry.filter((v) => vaccinationStatus(v) === 'EXPIRED').length,
  };
}

function weightTrend(weights) {
  if (!weights.length) return null;
  const latest = weights[weights.length - 1];
  const delta = +(latest.weightLbs - weights[0].weightLbs).toFixed(1);
  return { latest: latest.weightLbs, delta, dir: delta > 0.05 ? 'up' : delta < -0.05 ? 'down' : 'flat' };
}

// Three vital-sign readouts above the fold: protection, weight, meds.
function VitalsTrio({ vaccinations, weights, meds }) {
  const p = protectionSummary(vaccinations);
  const wt = weightTrend(weights);
  const activeMeds = (meds || []).filter((m) => m.isActive);

  const protSub = p.expired ? `${p.expired} expired` : p.dueSoon ? `${p.dueSoon} due soon` : p.withExpiry ? 'all current' : 'on file';
  const protTone = p.expired ? 'text-rose-600' : p.dueSoon ? 'text-amber-600' : 'text-emerald-600';
  const TrendIcon = wt ? (wt.dir === 'up' ? TrendingUp : wt.dir === 'down' ? TrendingDown : Minus) : Minus;
  const trendSub = !wt ? 'no entries' : wt.dir === 'flat' ? 'holding steady' : `${wt.dir === 'up' ? '+' : ''}${wt.delta} lb overall`;

  const tile = 'rounded-2xl bg-white border border-midnight-100 p-4 flex flex-col gap-0.5';
  const cap = 'text-[11px] font-bold uppercase tracking-wide text-midnight-400';
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className={tile}>
        <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-1"><ShieldCheck size={17} /></span>
        <p className="text-2xl font-extrabold text-midnight-900 leading-none">{p.withExpiry ? `${p.protectedCount}/${p.withExpiry}` : (p.total || '0')}</p>
        <p className={cap}>Protected</p>
        <p className={cn('text-xs font-semibold', protTone)}>{protSub}</p>
      </div>
      <div className={tile}>
        <span className="w-8 h-8 rounded-xl bg-flash-100 text-flash-700 flex items-center justify-center mb-1"><TrendIcon size={17} /></span>
        <p className="text-2xl font-extrabold text-midnight-900 leading-none">{wt ? <>{wt.latest}<span className="text-sm font-bold text-midnight-400 ml-0.5">lb</span></> : <span className="text-base font-bold text-midnight-400">none yet</span>}</p>
        <p className={cap}>Weight</p>
        <p className="text-xs font-semibold text-midnight-500">{trendSub}</p>
      </div>
      <div className={tile}>
        <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-1"><PillGlyph size={16} /></span>
        <p className="text-2xl font-extrabold text-midnight-900 leading-none">{activeMeds.length}</p>
        <p className={cap}>Medications</p>
        <p className="text-xs font-semibold text-midnight-500">{activeMeds.length ? 'logged in Today' : 'none active'}</p>
      </div>
    </div>
  );
}

// Weight over time: soft area fill + line, every entry dotted, current
// point anchored, first/last dates on the axis.
function WeightChart({ weights }) {
  if (weights.length < 2) return null;
  const w = 600, h = 130, padX = 12, padTop = 16, padBot = 24;
  const vals = weights.map((e) => e.weightLbs);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const x = (i) => padX + (i / (weights.length - 1)) * (w - 2 * padX);
  const y = (v) => padTop + (1 - (v - min) / span) * (h - padTop - padBot);
  const pts = weights.map((e, i) => `${x(i).toFixed(1)},${y(e.weightLbs).toFixed(1)}`);
  const area = `M ${x(0).toFixed(1)},${(h - padBot).toFixed(1)} L ${pts.join(' L ')} L ${x(weights.length - 1).toFixed(1)},${(h - padBot).toFixed(1)} Z`;
  const last = weights[weights.length - 1];
  const fmt = (d) => new Date(d).toLocaleDateString([], { month: 'short', year: '2-digit' });
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="mt-3" role="img" aria-label="Weight over time">
      <defs>
        <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#wfill)" />
      <polyline points={pts.join(' ')} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {weights.map((e, i) => <circle key={i} cx={x(i)} cy={y(e.weightLbs)} r="2.4" fill="#f59e0b" />)}
      <circle cx={x(weights.length - 1)} cy={y(last.weightLbs)} r="5" fill="#0f172a" stroke="#fff" strokeWidth="2" />
      <text x={padX} y={h - 6} className="fill-midnight-400" fontSize="11" fontWeight="600">{fmt(weights[0].recordedAt)}</text>
      <text x={w - padX} y={h - 6} textAnchor="end" className="fill-midnight-400" fontSize="11" fontWeight="600">{fmt(last.recordedAt)}</text>
    </svg>
  );
}

// One record, grouped by month: vaccines + weights, newest first, on a rail.
function MonthHistory({ vaccinations, weights }) {
  const events = [];
  for (const v of (vaccinations || []).filter((v) => !v.deletedAt)) {
    events.push({ at: new Date(v.administeredAt), kind: 'vax', title: v.name, sub: v.vetName || 'Vaccine recorded', id: `v-${v.id}` });
  }
  for (const e of weights || []) {
    events.push({ at: new Date(e.recordedAt), kind: 'weight', title: `${e.weightLbs} lb`, sub: e.note || 'Weight logged', id: `w-${e.id}` });
  }
  events.sort((a, b) => b.at - a.at);
  if (!events.length) return null;
  const groups = [];
  for (const ev of events) {
    const key = ev.at.toLocaleDateString([], { month: 'long', year: 'numeric' });
    let g = groups.find((x) => x.key === key);
    if (!g) { g = { key, items: [] }; groups.push(g); }
    g.items.push(ev);
  }
  return (
    <div className="space-y-5">
      {groups.slice(0, 6).map((g) => (
        <div key={g.key}>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-midnight-400 mb-2.5">{g.key}</p>
          <div className="relative pl-6 space-y-3 before:absolute before:left-[9px] before:top-1 before:bottom-1 before:w-px before:bg-midnight-100">
            {g.items.map((ev) => (
              <div key={ev.id} className="relative flex items-center gap-3">
                <span className={cn('absolute -left-6 top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full ring-4 ring-white', ev.kind === 'vax' ? 'bg-emerald-500' : 'bg-flash-400')} />
                <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', ev.kind === 'vax' ? 'bg-emerald-100 text-emerald-700' : 'bg-flash-100 text-flash-700')}>
                  {ev.kind === 'vax' ? <SyringeGlyph size={17} /> : <span className="text-[10px] font-extrabold">lb</span>}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-midnight-900 leading-tight truncate">{ev.title}</p>
                  <p className="text-xs text-midnight-400 truncate">{ev.sub}</p>
                </div>
                <span className="text-xs text-midnight-400 shrink-0">{ev.at.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
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
  const [meds, setMeds] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busyMed, setBusyMed] = useState(null);
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
      const [vaxRes, weightRes, petRes, medsRes] = await Promise.all([
        fetch(`/api/pets/${petId}/vaccinations`),
        fetch(`/api/pets/${petId}/weights`),
        fetch(`/api/pets/${petId}`),
        fetch(`/api/pets/${petId}/medications`),
      ]);
      if (vaxRes.ok) {
        const d = await vaxRes.json();
        setVaccinations(d.vaccinations || []);
        setAccess(d.access || 'VIEWER');
      }
      if (weightRes.ok) setWeights((await weightRes.json()).weights || []);
      if (medsRes.ok) setMeds(((await medsRes.json()).medications || []).filter((m) => m.kind !== 'CARE'));
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

  const withMedBusy = async (med, fn) => {
    setBusyMed(med.id);
    try { await fn(); } catch (err) { setError(err.message); } finally { setBusyMed(null); }
  };

  const togglePause = (med) =>
    withMedBusy(med, async () => {
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !med.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setMeds((prev) => prev.map((m) => (m.id === med.id ? data.medication : m)));
    });

  const logPrn = (med) =>
    withMedBusy(med, async () => {
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}/doses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: new Date().toISOString(), status: 'GIVEN' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log dose');
      setMeds((prev) => prev.map((m) => (m.id === med.id ? { ...m, doses: [data.dose, ...(m.doses || [])], quantityRemaining: data.quantityRemaining ?? m.quantityRemaining } : m)));
    });

  // Reverse an accidental "Log dose now": remove the most recent of today's
  const undoPrn = (med) =>
    withMedBusy(med, async () => {
      const last = (med.doses || [])
        .filter((d) => !d.deletedAt && d.status === 'GIVEN' && sameDay(new Date(d.scheduledFor), new Date()))
        .sort((a, b) => new Date(b.scheduledFor) - new Date(a.scheduledFor))[0];
      if (!last) return;
      const iso = new Date(last.scheduledFor).toISOString();
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}/doses?scheduledFor=${encodeURIComponent(iso)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to undo');
      setMeds((prev) => prev.map((m) => (m.id === med.id
        ? { ...m, doses: (m.doses || []).filter((d) => new Date(d.scheduledFor).getTime() !== new Date(iso).getTime()), quantityRemaining: data.quantityRemaining ?? m.quantityRemaining }
        : m)));
    });

  const deleteMed = (med) =>
    withMedBusy(med, async () => {
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setMeds((prev) => prev.filter((m) => m.id !== med.id));
      setConfirmDelete(null);
    });

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
  const tone = HERO_TONE[bookStatus.tone] || HERO_TONE.empty;
  const VerdictIcon = tone.icon;
  const chipCls = 'inline-flex items-center px-2.5 py-1 rounded-lg bg-white/70 border border-midnight-100 text-xs font-bold text-midnight-600';

  return (
    <div className="px-4 py-6 md:px-8 md:py-8 bg-gradient-to-b from-amber-50/40 via-white to-white min-h-screen">
      <div className="max-w-4xl mx-auto">
        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 rounded-xl mb-4 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss" className="text-red-400 hover:text-red-700"><X size={16} /></button>
          </div>
        )}

        {/* ===== Hero: who this is, and the one-glance verdict ===== */}
        <div className={cn('relative overflow-hidden rounded-3xl ring-1 bg-gradient-to-br p-5 md:p-7 mb-4', tone.wash, tone.ring)}>
          <div className="flex items-start gap-4 md:gap-5">
            <div className="w-[72px] h-[72px] md:w-24 md:h-24 rounded-3xl overflow-hidden ring-4 ring-white shadow-md shrink-0 bg-white">
              {pet?.primaryPhotoUrl
                ? <img src={pet.primaryPhotoUrl} alt={name} className="w-full h-full object-cover" />
                : <span className="w-full h-full flex items-center justify-center bg-midnight-100 text-midnight-400"><SpeciesIcon species={pet?.species} size={40} /></span>}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl md:text-3xl font-extrabold text-midnight-900 tracking-tight leading-none">{name}</h1>
              <p className="mt-1.5 text-sm font-semibold text-midnight-500">
                {[pet?.breed, pet?.age != null ? `${pet.age} ${pet.age === 1 ? 'yr' : 'yrs'}` : null, pet?.sex ? pet.sex.toLowerCase() : null]
                  .filter(Boolean).join(' · ')}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {pet?.weight != null && <span className={chipCls}>{pet.weight} lb</span>}
                {pet?.color && <span className={cn(chipCls, 'capitalize')}>{pet.color}</span>}
                {pet?.microchipId && <span className={cn(chipCls, 'font-mono tracking-tight')}>chip ····{String(pet.microchipId).slice(-4)}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-5 md:mt-6">
            <span className={cn('w-11 h-11 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-sm', tone.glyph)}>
              <VerdictIcon size={23} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold text-midnight-900 leading-tight">{tone.head(name)}</p>
              <p className="text-sm text-midnight-600">{bookStatus.sentence}</p>
            </div>
            {canManage && (
              <button
                onClick={() => setShowAdd(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-midnight-900 hover:bg-midnight-800 text-white text-sm font-bold transition-colors shrink-0"
              >
                <Plus size={15} /> Add vaccine
              </button>
            )}
          </div>
        </div>

        {/* ===== Vital signs, at a glance ===== */}
        <div className="mb-4">
          <VitalsTrio vaccinations={vaccinations} weights={weights} meds={meds} />
        </div>

        {/* ===== Immunization passport ===== */}
        <Card padding="lg" className="mb-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-emerald-600">Immunization passport</p>
              <h2 className="font-bold text-midnight-900">Vaccines &amp; protection</h2>
            </div>
            {canManage && vaccinations.length > 0 && (
              <button
                onClick={() => setManaging((v) => !v)}
                className={cn('px-3 py-1.5 rounded-xl text-sm font-bold transition-colors shrink-0',
                  managing ? 'bg-midnight-900 text-white' : 'text-midnight-500 hover:bg-midnight-100')}
              >
                {managing ? 'Done' : 'Manage'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {vaccinations.map((vax) => {
              const st = STATUS_STYLE[vaccinationStatus(vax)];
              return (
                <div key={vax.id} className="relative rounded-2xl border-2 border-midnight-100 bg-white px-3 py-4 flex flex-col items-center gap-2 text-center">
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
                className="rounded-2xl border-2 border-dashed border-midnight-200 px-3 py-4 flex flex-col items-center justify-center gap-2 text-center text-midnight-400 hover:border-flash-400 hover:text-flash-500 transition-colors min-h-[116px]"
              >
                <span className="w-10 h-10 rounded-xl bg-midnight-50 flex items-center justify-center"><Plus size={18} /></span>
                <span className="text-[13px] font-bold">{vaccinations.length ? 'Another stamp' : 'First stamp'}</span>
              </button>
            )}
          </div>
        </Card>

        {/* Medications: the record and its management (logging lives in Today) */}
        <Card padding="lg" className="mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-amber-600">Prescriptions</p>
              <h2 className="font-bold text-midnight-900">Medications</h2>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/api/pets/${petId}/medications/export`}
                download
                className="inline-flex items-center gap-1.5 px-3 py-2 border-2 border-midnight-200 text-midnight-500 rounded-xl text-sm font-bold hover:border-midnight-300 hover:text-midnight-800 transition-colors"
                title="Download a full backup of all medication data"
              >
                Backup
              </a>
              {canManage && (
                <Button variant="primary" size="sm" href={`/pets/${petId}/medications/new`}>
                  Add medication
                </Button>
              )}
            </div>
          </div>
          <p className="text-sm text-midnight-500 mb-4">
            Schedules and supply. Daily check-offs live in <Link href={`/pets/${petId}/today`} className="font-bold text-midnight-700 hover:text-midnight-900 underline underline-offset-2">Today</Link>.
          </p>
          {meds.length === 0 ? (
            <p className="text-sm text-midnight-400">No medications on file.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {meds.filter((m) => m.isActive).map((med) => (
                  <MedCard key={med.id} med={med} petId={petId} busy={busyMed === med.id} canManage={canManage}
                    onLogPrn={logPrn} onUndoPrn={undoPrn} onTogglePause={togglePause} onDelete={setConfirmDelete} />
                ))}
              </div>
              {meds.some((m) => !m.isActive) && (
                <>
                  <h3 className="font-bold text-midnight-500 text-sm uppercase tracking-wide mt-5 mb-3">Paused</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {meds.filter((m) => !m.isActive).map((med) => (
                      <MedCard key={med.id} med={med} petId={petId} busy={busyMed === med.id} canManage={canManage}
                        onLogPrn={logPrn} onUndoPrn={undoPrn} onTogglePause={togglePause} onDelete={setConfirmDelete} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Weight */}
          <Card padding="lg">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-flash-600">Weight</p>
                {latestWeight ? (
                  <p className="text-2xl font-extrabold text-midnight-900 leading-tight">
                    {latestWeight.weightLbs}<span className="text-base font-bold text-midnight-400 ml-1">lb</span>
                  </p>
                ) : (
                  <p className="font-bold text-midnight-900">Track the trend</p>
                )}
              </div>
              {latestWeight && (
                <p className="text-xs font-semibold text-midnight-400">last {new Date(latestWeight.recordedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
              )}
            </div>
            {weights.length >= 2
              ? <WeightChart weights={weights} />
              : <p className="text-sm text-midnight-500 mt-2">{latestWeight ? 'One more entry and the trend line appears.' : 'Log a weight and the chart draws itself.'}</p>}
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
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-sky-600">Care team</p>
                <h2 className="font-bold text-midnight-900">The vet</h2>
              </div>
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

        {/* ===== The record: one unified history (doses live in Today) ===== */}
        {(vaccinations.length > 0 || weights.length > 0) && (
          <Card padding="lg" className="mb-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-midnight-400">The record</p>
            <h2 className="font-bold text-midnight-900 mb-4">History</h2>
            <MonthHistory vaccinations={vaccinations} weights={weights} />
          </Card>
        )}

        <p className="text-center text-xs text-midnight-400 pt-2 pb-6">
          A record you keep, not medical advice. Your vet&apos;s guidance comes first.
        </p>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-midnight-900 mb-3">Delete {confirmDelete.name}?</h3>
            <p className="text-midnight-600 mb-6">This removes the medication and its full dose history. This cannot be undone.</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setConfirmDelete(null)} className="flex-1">Cancel</Button>
              <Button variant="danger" onClick={() => deleteMed(confirmDelete)} className="flex-1" disabled={busyMed === confirmDelete.id}>
                {busyMed === confirmDelete.id ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </Card>
        </div>
      )}

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
