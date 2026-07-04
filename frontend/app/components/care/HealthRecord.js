'use client';

/**
 * The Health Book's record components, shared between the logged-in
 * Health tab and the public vet/sitter view. One visual language for
 * the record everywhere it appears:
 *
 * - SectionHeader     one quiet eyebrow style (color lives in icons, not text)
 * - AlertRibbon       medical notes, front of the book, thin, never a card
 * - HealthStatusBand  the one-sentence verdict (identity lives in the shell)
 * - VitalsTrio        protection / weight / meds at a glance
 * - VaccinePassport   stamp grid + ghost add (+ AddVaccineModal)
 * - WeightCard        latest + chart + log input
 * - VetCard           the vet's contact, readOnly for shared audiences
 * - MonthHistory      vaccines + weights + monthly dose adherence, one rail
 */

import { useMemo, useState } from 'react';
import {
  Plus, X, Check, Loader2, Trash2, Phone, ShieldCheck,
  AlertTriangle, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { Card, Modal, cn } from '@/components/ui';
import { ShieldIcon } from '@/app/components/icons/HealthIcons';
import { SyringeGlyph, PillGlyph } from '@/app/components/icons/MedGlyphs';
import { vaccinationStatus, vaccinePresetsFor } from '@/lib/healthBook';
import { adherenceForDay, startOfDay } from '@/lib/medications';

export const VAX_STATUS_STYLE = {
  PROTECTED: { label: 'Protected', chip: 'bg-emerald-100 text-emerald-700', ic: 'bg-emerald-100 text-emerald-700' },
  DUE_SOON: { label: 'Due soon', chip: 'bg-amber-100 text-amber-700', ic: 'bg-amber-100 text-amber-700' },
  EXPIRED: { label: 'Expired', chip: 'bg-red-100 text-red-700', ic: 'bg-red-100 text-red-600' },
  ON_FILE: { label: 'On file', chip: 'bg-slate-200 text-slate-700', ic: 'bg-slate-200 text-slate-600' },
};

function shortDate(d) {
  return new Date(d).toLocaleDateString([], { month: 'short', year: 'numeric' });
}

/* ------------------------------ SectionHeader ------------------------------ */

export function SectionHeader({ eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-midnight-400">{eyebrow}</p>}
        <h2 className="font-bold text-midnight-900">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ------------------------------- AlertRibbon ------------------------------- */

/**
 * Medical notes at the front of the book — allergies, conditions,
 * anything a vet or sitter must see first. Thin ribbon, not a card.
 */
export function AlertRibbon({ text, href }) {
  if (!text?.trim()) return null;
  const inner = (
    <span className="flex items-center gap-2.5 min-w-0">
      <AlertTriangle size={15} className="text-rose-600 shrink-0" />
      <span className="text-[13px] leading-snug text-rose-900 min-w-0">
        <span className="font-extrabold">Medical notes</span>
        <span className="mx-1.5 text-rose-300">·</span>
        {text.trim()}
      </span>
    </span>
  );
  const cls = 'flex items-center justify-between gap-3 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 mb-4';
  if (!href) return <div className={cls}>{inner}</div>;
  return (
    <a href={href} className={cn(cls, 'hover:border-rose-300 transition-colors')}>
      {inner}
      <span className="text-[11px] font-bold text-rose-400 shrink-0">Edit →</span>
    </a>
  );
}

/* ----------------------------- HealthStatusBand ---------------------------- */

// The verdict's register, keyed to healthBookStatus tone: a calm, warm
// daylight sentence, not a clinical banner. Identity is NOT repeated
// here — the shell's identity row already says who the pet is.
const TONE = {
  good:  { wash: 'from-emerald-100/80 via-white to-amber-50/50', ring: 'ring-emerald-100', glyph: 'bg-emerald-500', icon: ShieldCheck,   head: (n) => `${n} is doing great.` },
  warn:  { wash: 'from-amber-100/80 via-white to-amber-50/40',   ring: 'ring-amber-100',   glyph: 'bg-amber-500',   icon: AlertTriangle, head: (n) => `${n} has one thing due.` },
  bad:   { wash: 'from-rose-100/80 via-white to-amber-50/30',    ring: 'ring-rose-100',    glyph: 'bg-rose-500',    icon: AlertTriangle, head: (n) => `${n} needs attention.` },
  empty: { wash: 'from-flash-100/80 via-white to-white',         ring: 'ring-midnight-100',glyph: 'bg-midnight-400',icon: ShieldIcon,    head: (n) => `Let's start ${n}'s book.` },
};

export function HealthStatusBand({ name, status, action }) {
  const tone = TONE[status.tone] || TONE.empty;
  const VerdictIcon = tone.icon;
  return (
    <div className={cn('relative overflow-hidden rounded-3xl ring-1 bg-gradient-to-br p-4 md:p-5 mb-4', tone.wash, tone.ring)}>
      <div className="flex items-center gap-3">
        <span className={cn('w-11 h-11 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-sm', tone.glyph)}>
          <VerdictIcon size={23} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-midnight-900 leading-tight">{tone.head(name)}</p>
          <p className="text-sm text-midnight-600">{status.sentence}</p>
        </div>
        {action && <div className="hidden sm:block shrink-0">{action}</div>}
      </div>
      {action && <div className="sm:hidden mt-3">{action}</div>}
    </div>
  );
}

/* -------------------------------- VitalsTrio ------------------------------- */

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

export function VitalsTrio({ vaccinations, weights, meds }) {
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

/* ---------------------------- Vaccine passport ----------------------------- */

export function AddVaccineModal({ petId, species, onClose, onSaved }) {
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
    <Modal onClose={onClose} title="Add a stamp" subtitle="Straight off the certificate.">
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
    </Modal>
  );
}

/**
 * The stamp grid. `compact` renders smaller stamps without the manage
 * affordances (the public view's variant).
 */
export function VaccinePassport({ vaccinations, canManage, managing, onToggleManage, onAdd, onRemove }) {
  return (
    <Card padding="lg" className="mb-4">
      <SectionHeader
        eyebrow="Immunization passport"
        title="Vaccines & protection"
        action={canManage && vaccinations.length > 0 && (
          <button
            onClick={onToggleManage}
            className={cn('px-3 py-1.5 rounded-xl text-sm font-bold transition-colors shrink-0',
              managing ? 'bg-midnight-900 text-white' : 'text-midnight-500 hover:bg-midnight-100')}
          >
            {managing ? 'Done' : 'Manage'}
          </button>
        )}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {vaccinations.map((vax) => {
          const st = VAX_STATUS_STYLE[vaccinationStatus(vax)];
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
                  onClick={() => onRemove(vax)}
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
            onClick={onAdd}
            className="rounded-2xl border-2 border-dashed border-midnight-200 px-3 py-4 flex flex-col items-center justify-center gap-2 text-center text-midnight-400 hover:border-flash-400 hover:text-flash-500 transition-colors min-h-[116px]"
          >
            <span className="w-10 h-10 rounded-xl bg-midnight-50 flex items-center justify-center"><Plus size={18} /></span>
            <span className="text-[13px] font-bold">{vaccinations.length ? 'Another stamp' : 'First stamp'}</span>
          </button>
        )}
      </div>
    </Card>
  );
}

/* --------------------------------- Weight ---------------------------------- */

// Weight over time: soft area fill + line, every entry dotted, current
// point anchored, first/last dates on the axis.
export function WeightChart({ weights }) {
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

/**
 * The weight story: latest reading, the trend chart, and (for
 * caregivers) the one place a weight is logged.
 */
export function WeightCard({ weights, canManage, weightInput, onWeightInput, onLog, saving }) {
  const latestWeight = weights[weights.length - 1];
  return (
    <Card padding="lg">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-midnight-400">Weight</p>
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
              onChange={(e) => onWeightInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onLog()}
              placeholder="Today's weight"
              inputMode="decimal"
              className="w-full rounded-xl border-2 border-midnight-200 px-3.5 py-2.5 pr-11 text-sm focus:outline-none focus:border-flash-400"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-midnight-400">lbs</span>
          </div>
          <button
            onClick={onLog}
            disabled={saving || !weightInput}
            className="px-3.5 py-2.5 rounded-xl bg-flash-400 text-midnight-900 text-sm font-bold hover:bg-flash-500 disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : 'Log'}
          </button>
        </div>
      )}
    </Card>
  );
}

/* -------------------------------- Vet card --------------------------------- */

/**
 * The veterinarian's contact — the record's one home for it. ("Care
 * team" means the PEOPLE you share the book with; that noun lives on
 * the Care team tab, never here.)
 */
export function VetCard({ pet, isOwner, vetDraft, onDraft, onSave, onCancel, saving, petName }) {
  return (
    <Card padding="lg">
      <SectionHeader
        eyebrow="The record"
        title="The vet"
        action={isOwner && vetDraft === null && (
          <button
            onClick={() => onDraft({ vetName: pet?.vetName || '', vetClinic: pet?.vetClinic || '', vetPhone: pet?.vetPhone || '' })}
            className="text-sm font-bold text-midnight-400 hover:text-midnight-700"
          >
            {pet?.vetName || pet?.vetClinic ? 'Edit' : 'Add'}
          </button>
        )}
      />
      {vetDraft ? (
        <div className="space-y-2.5 mt-3">
          {[['vetName', 'Vet name'], ['vetClinic', 'Clinic'], ['vetPhone', 'Phone']].map(([key, ph]) => (
            <input
              key={key}
              value={vetDraft[key]}
              onChange={(e) => onDraft({ ...vetDraft, [key]: e.target.value })}
              placeholder={ph}
              className="w-full rounded-xl border-2 border-midnight-200 px-3.5 py-2.5 text-sm focus:outline-none focus:border-flash-400"
            />
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={onSave} disabled={saving} className="px-3.5 py-2 rounded-xl bg-flash-400 text-midnight-900 text-sm font-bold">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={onCancel} className="px-3.5 py-2 rounded-xl text-sm font-bold text-midnight-400 hover:text-midnight-700">
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
          {isOwner ? `Who takes care of ${petName}? One tap from a sitter's phone in an emergency.` : 'No vet on file yet.'}
        </p>
      )}
    </Card>
  );
}

/* ------------------------------- MonthHistory ------------------------------ */

// Dose adherence for the days of one month that fall inside the API's
// 35-day dose window (older months carry no dose data and show nothing).
function monthAdherence(meds, monthKeyDate) {
  const scheduled = (meds || []).filter((m) => m.kind !== 'CARE' && m.scheduleType !== 'AS_NEEDED');
  if (!scheduled.length) return null;
  const windowStart = startOfDay(new Date(Date.now() - 34 * 86400000));
  const today = startOfDay(new Date());
  const first = new Date(monthKeyDate.getFullYear(), monthKeyDate.getMonth(), 1);
  const nextMonth = new Date(monthKeyDate.getFullYear(), monthKeyDate.getMonth() + 1, 1);
  let due = 0; let given = 0;
  for (let d = new Date(Math.max(first, windowStart)); d < nextMonth && d <= today; d = new Date(d.getTime() + 86400000)) {
    for (const med of scheduled) {
      const a = adherenceForDay(med, med.doses, d);
      due += a.due; given += a.given;
    }
  }
  if (!due) return null;
  return { due, given, pct: Math.round((given / due) * 100) };
}

// One record, grouped by month: vaccines + weights + a quiet dose
// adherence line, newest first, on a rail.
export function MonthHistory({ vaccinations, weights, meds }) {
  const groups = useMemo(() => {
    const events = [];
    for (const v of (vaccinations || []).filter((v) => !v.deletedAt)) {
      events.push({ at: new Date(v.administeredAt), kind: 'vax', title: v.name, sub: v.vetName || 'Vaccine recorded', id: `v-${v.id}` });
    }
    for (const e of weights || []) {
      events.push({ at: new Date(e.recordedAt), kind: 'weight', title: `${e.weightLbs} lb`, sub: e.note || 'Weight logged', id: `w-${e.id}` });
    }
    events.sort((a, b) => b.at - a.at);
    const out = [];
    for (const ev of events) {
      const key = ev.at.toLocaleDateString([], { month: 'long', year: 'numeric' });
      let g = out.find((x) => x.key === key);
      if (!g) { g = { key, at: ev.at, items: [] }; out.push(g); }
      g.items.push(ev);
    }
    return out;
  }, [vaccinations, weights]);

  if (!groups.length) return null;

  return (
    <div className="space-y-5">
      {groups.slice(0, 6).map((g) => {
        const adherence = meds ? monthAdherence(meds, g.at) : null;
        return (
          <div key={g.key}>
            <div className="flex items-baseline justify-between gap-3 mb-2.5">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-midnight-400">{g.key}</p>
              {adherence && (
                <p className="text-[11px] font-semibold text-midnight-400">
                  Doses: <span className={cn('font-extrabold', adherence.pct >= 90 ? 'text-emerald-600' : adherence.pct >= 60 ? 'text-amber-600' : 'text-rose-600')}>{adherence.pct}%</span> given ({adherence.given}/{adherence.due})
                </p>
              )}
            </div>
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
        );
      })}
    </div>
  );
}
