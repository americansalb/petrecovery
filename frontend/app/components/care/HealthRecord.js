'use client';

/**
 * The Health Book's record components — the passport pages, shared
 * between the logged-in Health tab and the public vet/sitter view.
 *
 * Paper Passport vocabulary throughout (paper/Paper.js): the margin
 * note in red ink, a handwritten verdict line, vaccines as round
 * rubber stamps, weight as a pencil line, the history as a diary
 * timeline. One physical language for the record everywhere.
 */

import { useMemo, useState } from 'react';
import { Plus, Loader2, Phone } from 'lucide-react';
import { Modal, cn } from '@/components/ui';
import { vaccinationStatus, vaccinePresetsFor } from '@/lib/healthBook';
import { adherenceForDay, startOfDay } from '@/lib/medications';
import {
  Sheet, SectionInk, StampText, InkStampCircle, RuledList, RuledRow, MarginNote,
} from '@/app/components/care/paper/Paper';

const VAX_TONE = { PROTECTED: 'green', DUE_SOON: 'red', EXPIRED: 'red', ON_FILE: 'ink' };
const VAX_LABEL = { PROTECTED: 'Protected', DUE_SOON: 'Due soon', EXPIRED: 'Expired', ON_FILE: 'On file' };

function shortDate(d) {
  return new Date(d).toLocaleDateString([], { month: 'short', year: 'numeric' });
}

/* ------------------------------ SectionHeader ------------------------------ */

/** Paper section head: diary-hand title with a quiet action slot. */
export function SectionHeader({ eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="font-stamp text-[9px] uppercase tracking-[0.18em] text-pen-400">{eyebrow}</p>}
        <h2 className="font-diary italic text-[19px] text-pen-900 leading-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ------------------------------- AlertRibbon ------------------------------- */

/** Medical notes at the front of the book — a red-ink margin note. */
export function AlertRibbon({ text, href }) {
  return <MarginNote href={href}>{text?.trim() || null}</MarginNote>;
}

/* ----------------------------- HealthStatusBand ---------------------------- */

// The verdict, written by hand at the top of the page.
const TONE_INK = {
  good: 'text-stampgreen',
  warn: 'text-[#8f6a14]', // marker's ink-dark cousin: readable on paper
  bad: 'text-stampred',
  empty: 'text-pen-400',
};
const TONE_HEAD = {
  good: (n) => `${n} is doing great.`,
  warn: (n) => `${n} has one thing due.`,
  bad: (n) => `${n} needs attention.`,
  empty: (n) => `Let's start ${n}'s book.`,
};

export function HealthStatusBand({ name, status, action }) {
  const ink = TONE_INK[status.tone] || TONE_INK.empty;
  const head = (TONE_HEAD[status.tone] || TONE_HEAD.empty)(name);
  return (
    <div className="flex items-end justify-between gap-4 border-b-2 border-pen-900 pb-3 mb-5 flex-wrap">
      <div className="min-w-0">
        <p className={cn('font-diary italic text-[24px] leading-tight', ink)}>{head}</p>
        <p className="font-diary italic text-[13.5px] text-pen-400 mt-1">{status.sentence}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
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

/** Three figures written in the margin: protection, weight, meds. */
export function VitalsTrio({ vaccinations, weights, meds }) {
  const p = protectionSummary(vaccinations);
  const wt = weightTrend(weights);
  const activeMeds = (meds || []).filter((m) => m.isActive);

  const protSub = p.expired ? `${p.expired} expired` : p.dueSoon ? `${p.dueSoon} due soon` : p.withExpiry ? 'all current' : 'on file';
  const protInk = p.expired ? 'text-stampred' : p.dueSoon ? 'text-marker' : 'text-stampgreen';
  const trendSub = !wt ? 'no entries' : wt.dir === 'flat' ? 'holding steady' : `${wt.dir === 'up' ? '+' : ''}${wt.delta} lb overall`;

  const fig = 'flex-1 min-w-[110px] py-1';
  const big = 'font-diary italic text-[26px] leading-none text-pen-900 tabular-nums';
  const cap = 'font-stamp text-[8.5px] uppercase tracking-[0.16em] text-pen-400 mt-1.5';
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-pen-900/[0.16] pb-4 mb-5">
      <div className={fig}>
        <p className={big}>{p.withExpiry ? `${p.protectedCount}/${p.withExpiry}` : (p.total || '0')}</p>
        <p className={cap}>Protected</p>
        <p className={cn('font-diary italic text-[12px]', protInk)}>{protSub}</p>
      </div>
      <div className={fig}>
        <p className={big}>{wt ? <>{wt.latest}<span className="text-[15px] text-pen-400"> lb</span></> : <span className="text-[16px] text-pen-300">none yet</span>}</p>
        <p className={cap}>Weight</p>
        <p className="font-diary italic text-[12px] text-pen-400">{trendSub}</p>
      </div>
      <div className={fig}>
        <p className={big}>{activeMeds.length}</p>
        <p className={cap}>Medications</p>
        <p className="font-diary italic text-[12px] text-pen-400">{activeMeds.length ? 'written in Today' : 'none active'}</p>
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

  const chip = (active) => cn(
    'px-3.5 py-2 rounded-[5px] border font-stamp text-[10.5px] uppercase tracking-[0.08em] transition-all',
    active ? 'border-stampred bg-stampred text-paper-50' : 'border-paper-400 text-pen-600 hover:border-pen-300'
  );
  const input = 'w-full mb-4 rounded-[5px] border border-pen-300 bg-paper-50 px-3.5 py-2.5 text-sm text-pen-900 placeholder:text-pen-300 focus:outline-none focus:border-stampred';

  return (
    <Modal variant="paper" onClose={onClose} title="Stamp the book" subtitle="Straight off the certificate.">
      <div className="flex flex-wrap gap-2 mb-4">
        {presets.map((p) => (
          <button key={p.name} onClick={() => { setPicked(p); if (duration === null) setDuration(p.years); }} className={chip(picked?.name === p.name)}>
            {p.name}
          </button>
        ))}
        <button onClick={() => setPicked({ custom: true })} className={cn(chip(picked?.custom), !picked?.custom && 'border-dashed')}>
          Other
        </button>
      </div>

      {picked?.custom && (
        <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Vaccine name" className={input} />
      )}

      {picked && (
        <>
          <p className="font-stamp text-[9px] uppercase tracking-[0.16em] text-pen-400 mb-2">Given on</p>
          <input
            type="date"
            value={givenOn}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setGivenOn(e.target.value)}
            className={input}
          />
          <p className="font-stamp text-[9px] uppercase tracking-[0.16em] text-pen-400 mb-2">Good for</p>
          <div className="flex gap-2 mb-4">
            {[{ l: '1 year', v: 1 }, { l: '3 years', v: 3 }, { l: 'No expiry', v: 0 }].map(({ l, v }) => (
              <button key={l} onClick={() => setDuration(v)} className={chip(duration === v)}>{l}</button>
            ))}
          </div>
          <input value={vetName} onChange={(e) => setVetName(e.target.value)} placeholder="Vet or clinic (optional)" className={input} />
        </>
      )}

      {error && <p className="text-sm text-stampred mb-3">{error}</p>}

      <button
        onClick={save}
        disabled={!ready || saving}
        className="w-full font-stamp text-[11px] uppercase tracking-[0.14em] bg-stampred text-paper-50 rounded-[5px] py-3 hover:bg-stampred-dark transition-colors disabled:opacity-40"
      >
        {saving ? 'Stamping…' : 'Stamp the book'}
      </button>
    </Modal>
  );
}

/** The passport spread: round rubber stamps, one per vaccine. */
export function VaccinePassport({ vaccinations, canManage, managing, onToggleManage, onAdd, onRemove }) {
  return (
    <Sheet className="mb-5">
      <SectionHeader
        eyebrow="Immunization passport"
        title="vaccines & protection"
        action={canManage && vaccinations.length > 0 && (
          <button
            onClick={onToggleManage}
            className={cn('font-stamp text-[9.5px] uppercase tracking-[0.12em] transition-colors',
              managing ? 'text-stampred' : 'text-pen-400 hover:text-pen-900')}
          >
            {managing ? 'done' : 'manage'}
          </button>
        )}
      />

      <div className="flex flex-wrap items-start gap-x-5 gap-y-6 mt-6 pl-1">
        {vaccinations.map((vax, i) => {
          const st = vaccinationStatus(vax);
          return (
            <div key={vax.id} className="flex flex-col items-center gap-2">
              <InkStampCircle
                tone={VAX_TONE[st]}
                rotate={i % 2 ? 6 : -7}
                over={VAX_LABEL[st]}
                title={vax.name}
                under={vax.expiresAt
                  ? (st === 'EXPIRED' ? `exp ${shortDate(vax.expiresAt)}` : `to ${shortDate(vax.expiresAt)}`)
                  : shortDate(vax.administeredAt)}
                onRemove={managing ? () => onRemove(vax) : undefined}
                removeLabel={`Remove ${vax.name}`}
              />
            </div>
          );
        })}
        {canManage && (
          <button
            onClick={onAdd}
            className="w-[86px] h-[86px] border-[2px] border-dashed border-pen-300 rounded-full flex flex-col items-center justify-center gap-1 text-pen-400 hover:border-stampred hover:text-stampred transition-colors"
            style={{ transform: 'rotate(4deg)' }}
          >
            <Plus size={16} />
            <span className="font-stamp text-[7.5px] uppercase tracking-[0.1em]">{vaccinations.length ? 'another' : 'first stamp'}</span>
          </button>
        )}
      </div>
    </Sheet>
  );
}

/* --------------------------------- Weight ---------------------------------- */

// Weight over time as a pencil line: ink stroke, dashed baseline, the
// current point circled like a marked reading.
export function WeightChart({ weights }) {
  if (weights.length < 2) return null;
  const w = 600, h = 130, padX = 12, padTop = 16, padBot = 24;
  const vals = weights.map((e) => e.weightLbs);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const x = (i) => padX + (i / (weights.length - 1)) * (w - 2 * padX);
  const y = (v) => padTop + (1 - (v - min) / span) * (h - padTop - padBot);
  const pts = weights.map((e, i) => `${x(i).toFixed(1)},${y(e.weightLbs).toFixed(1)}`);
  const last = weights[weights.length - 1];
  const fmt = (d) => new Date(d).toLocaleDateString([], { month: 'short', year: '2-digit' });
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="mt-3" role="img" aria-label="Weight over time">
      <line x1={padX} y1={h - padBot} x2={w - padX} y2={h - padBot} stroke="#8a7f68" strokeWidth="1" strokeDasharray="3 5" />
      <polyline points={pts.join(' ')} fill="none" stroke="#232a3d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {weights.map((e, i) => <circle key={i} cx={x(i)} cy={y(e.weightLbs)} r="2.2" fill="#232a3d" />)}
      <circle cx={x(weights.length - 1)} cy={y(last.weightLbs)} r="6.5" fill="none" stroke="#b3392e" strokeWidth="2" />
      <text x={padX} y={h - 6} fill="#8a7f68" fontSize="11" fontStyle="italic" fontFamily="Georgia, serif">{fmt(weights[0].recordedAt)}</text>
      <text x={w - padX} y={h - 6} textAnchor="end" fill="#8a7f68" fontSize="11" fontStyle="italic" fontFamily="Georgia, serif">{fmt(last.recordedAt)}</text>
    </svg>
  );
}

/**
 * The weight story: latest reading, the pencil line, and (for
 * caregivers) the one place a weight is written in.
 */
export function WeightCard({ weights, canManage, weightInput, onWeightInput, onLog, saving }) {
  const latestWeight = weights[weights.length - 1];
  return (
    <Sheet>
      <SectionHeader
        eyebrow="Vitals"
        title="weight"
        action={latestWeight && (
          <span className="font-stamp text-[9px] uppercase tracking-[0.12em] text-pen-400">
            last {new Date(latestWeight.recordedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
        )}
      />
      {latestWeight ? (
        <p className="font-diary italic text-[30px] leading-none text-pen-900 mt-2 tabular-nums">
          {latestWeight.weightLbs}<span className="text-[16px] text-pen-400"> lb</span>
        </p>
      ) : (
        <p className="font-diary italic text-[13.5px] text-pen-400 mt-2">log a weight and the pencil line draws itself.</p>
      )}
      {weights.length >= 2
        ? <WeightChart weights={weights} />
        : latestWeight && <p className="font-diary italic text-[12px] text-pen-400 mt-2">one more entry and the trend appears.</p>}
      {canManage && (
        <div className="flex items-center gap-2 mt-4">
          <div className="relative flex-1">
            <input
              value={weightInput}
              onChange={(e) => onWeightInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onLog()}
              placeholder="Today's weight"
              inputMode="decimal"
              className="w-full rounded-[5px] border border-pen-300 bg-paper-50 px-3.5 py-2.5 pr-11 text-sm text-pen-900 placeholder:text-pen-300 focus:outline-none focus:border-stampred"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-stamp text-[9px] uppercase text-pen-400">lbs</span>
          </div>
          <button
            onClick={onLog}
            disabled={saving || !weightInput}
            className="font-stamp text-[10px] uppercase tracking-[0.12em] border-[1.5px] border-pen-900 text-pen-900 rounded-[4px] px-3.5 py-2.5 hover:bg-pen-900 hover:text-paper-50 disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : 'Write it in'}
          </button>
        </div>
      )}
    </Sheet>
  );
}

/* -------------------------------- Vet card --------------------------------- */

/**
 * The veterinarian's contact — an address-book entry in the record.
 * ("Care team" means the PEOPLE you share the book with; that noun
 * lives on the Care team tab, never here.)
 */
export function VetCard({ pet, isOwner, vetDraft, onDraft, onSave, onCancel, saving, petName }) {
  const input = 'w-full rounded-[5px] border border-pen-300 bg-paper-50 px-3.5 py-2.5 text-sm text-pen-900 placeholder:text-pen-300 focus:outline-none focus:border-stampred';
  return (
    <Sheet>
      <SectionHeader
        eyebrow="The record"
        title="the vet"
        action={isOwner && vetDraft === null && (
          <button
            onClick={() => onDraft({ vetName: pet?.vetName || '', vetClinic: pet?.vetClinic || '', vetPhone: pet?.vetPhone || '' })}
            className="font-stamp text-[9.5px] uppercase tracking-[0.12em] text-pen-400 hover:text-pen-900"
          >
            {pet?.vetName || pet?.vetClinic ? 'edit' : 'add'}
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
              className={input}
            />
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={onSave} disabled={saving} className="font-stamp text-[10px] uppercase tracking-[0.12em] bg-pen-900 text-paper-50 rounded-[4px] px-3.5 py-2 hover:bg-pen-600 transition-colors">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={onCancel} className="font-stamp text-[10px] uppercase tracking-[0.12em] text-pen-400 hover:text-pen-900 px-2 py-2">
              Cancel
            </button>
          </div>
        </div>
      ) : pet?.vetName || pet?.vetClinic ? (
        <div className="mt-3">
          <p className="font-diary italic text-[17px] text-pen-900">{[pet.vetName, pet.vetClinic].filter(Boolean).join(' · ')}</p>
          {pet.vetPhone && (
            <a href={`tel:${pet.vetPhone}`} className="inline-flex items-center gap-1.5 mt-1.5 font-stamp text-[11px] tracking-[0.06em] text-pen-600 hover:text-pen-900">
              <Phone size={12} /> {pet.vetPhone}
            </a>
          )}
        </div>
      ) : (
        <p className="font-diary italic text-[13px] text-pen-400 mt-3">
          {isOwner ? `who takes care of ${petName}? one tap from a sitter's phone in an emergency.` : 'no vet on file yet.'}
        </p>
      )}
    </Sheet>
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
// adherence line, newest first — the diary read backwards.
export function MonthHistory({ vaccinations, weights, meds }) {
  const groups = useMemo(() => {
    const events = [];
    for (const v of (vaccinations || []).filter((v) => !v.deletedAt)) {
      events.push({ at: new Date(v.administeredAt), kind: 'vax', title: v.name, sub: v.vetName || 'vaccine recorded', id: `v-${v.id}` });
    }
    for (const e of weights || []) {
      events.push({ at: new Date(e.recordedAt), kind: 'weight', title: `${e.weightLbs} lb`, sub: e.note || 'weight written in', id: `w-${e.id}` });
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
    <div className="space-y-6">
      {groups.slice(0, 6).map((g) => {
        const adherence = meds ? monthAdherence(meds, g.at) : null;
        return (
          <div key={g.key}>
            <div className="flex items-baseline justify-between gap-3 mb-1 border-b border-pen-900/[0.16] pb-1">
              <p className="font-stamp text-[9.5px] uppercase tracking-[0.18em] text-pen-400">{g.key}</p>
              {adherence && (
                <p className="font-diary italic text-[11.5px] text-pen-400">
                  doses: <span className={cn('not-italic font-stamp text-[10px]', adherence.pct >= 90 ? 'text-stampgreen' : adherence.pct >= 60 ? 'text-marker' : 'text-stampred')}>{adherence.pct}%</span> given ({adherence.given}/{adherence.due})
                </p>
              )}
            </div>
            <RuledList>
              {g.items.map((ev) => (
                <RuledRow key={ev.id} className="py-2.5">
                  <span className={cn(
                    'font-stamp text-[8px] uppercase tracking-[0.06em] w-9 shrink-0 text-center border rounded-[3px] py-1',
                    ev.kind === 'vax' ? 'text-stampgreen border-stampgreen' : 'text-pen-400 border-pen-300'
                  )} style={{ transform: 'rotate(-3deg)' }}>
                    {ev.kind === 'vax' ? 'VAX' : 'LB'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-pen-900 leading-tight truncate">{ev.title}</p>
                    <p className="font-diary italic text-[11.5px] text-pen-400 truncate">{ev.sub}</p>
                  </div>
                  <span className="font-stamp text-[9.5px] text-pen-400 shrink-0">{ev.at.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                </RuledRow>
              ))}
            </RuledList>
          </div>
        );
      })}
    </div>
  );
}
