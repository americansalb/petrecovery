'use client';

/**
 * Health record components (direction D), composed by the Health tab's
 * subtabs and reused read-only on the public view. Color means state only:
 * teal = current, amber = due soon, red = attention.
 */

import { useMemo, useState } from 'react';
import { Plus, Loader2, Phone, Check, AlertCircle } from 'lucide-react';
import { Modal, cn } from '@/components/ui';
import { Card, Overline } from '@/app/components/care/kit/Tile';
import { vaccinationStatus, vaccinePresetsFor } from '@/lib/healthBook';
import { adherenceForDay, startOfDay } from '@/lib/medications';

const VAX_DOT = { PROTECTED: 'text-care-teal', DUE_SOON: 'text-care-amber', EXPIRED: 'text-red-600', ON_FILE: 'text-care-faint' };
const VAX_LABEL = { PROTECTED: 'Current', DUE_SOON: 'Due soon', EXPIRED: 'Expired', ON_FILE: 'On file' };
function shortDate(d) { return new Date(d).toLocaleDateString([], { month: 'short', year: 'numeric' }); }

export function SectionHeader({ eyebrow, title, action }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <Overline>{title || eyebrow}</Overline>
      {action}
    </div>
  );
}

/* Medical conditions, stated plainly in red. */
export function AlertRibbon({ text, href }) {
  const value = text?.trim();
  if (!value) return null;
  const body = <span className="text-[14px] font-medium text-red-600">{value}</span>;
  return <div className="mb-4">{href ? <a href={href} className="hover:underline">{body}</a> : body}</div>;
}

const TONE_TEXT = { good: 'text-care-teal', warn: 'text-care-amber', bad: 'text-red-600', empty: 'text-care-faint' };
const TONE_HEAD = {
  good: (n) => `${n} is up to date.`,
  warn: (n) => `${n} has one thing due.`,
  bad: (n) => `${n} needs attention.`,
  empty: (n) => `${n}'s record is empty.`,
};

export function HealthStatusBand({ name, status, action }) {
  const tone = TONE_TEXT[status.tone] || TONE_TEXT.empty;
  const head = (TONE_HEAD[status.tone] || TONE_HEAD.empty)(name);
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <p className={cn('text-[22px] font-semibold tracking-tight', tone)}>{head}</p>
        {status.sentence && <p className="text-[14px] text-care-sub mt-1">{status.sentence}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

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
  return { latest: latest.weightLbs, delta };
}

/* Three figures as D stat tiles. */
export function VitalsTrio({ vaccinations, weights, meds }) {
  const p = protectionSummary(vaccinations);
  const wt = weightTrend(weights);
  const activeMeds = (meds || []).filter((m) => m.isActive);
  const protSub = p.expired ? `${p.expired} expired` : p.dueSoon ? `${p.dueSoon} due soon` : p.withExpiry ? 'all current' : 'on file';
  const protTone = p.expired ? 'text-red-600' : p.dueSoon ? 'text-care-amber' : 'text-care-teal';
  const cell = 'flex-1 min-w-[110px] bg-care-surface rounded-[18px] shadow-care p-4';
  const big = 'text-[27px] font-semibold tracking-tight text-care-ink tabular-nums leading-none mt-2.5';
  return (
    <div className="flex flex-wrap gap-4">
      <div className={cell}>
        <Overline>Protected</Overline>
        <p className={big}>{p.withExpiry ? `${p.protectedCount}/${p.withExpiry}` : (p.total || '0')}</p>
        <p className={cn('text-[12px] mt-2 font-medium', protTone)}>{protSub}</p>
      </div>
      <div className={cell}>
        <Overline>Weight</Overline>
        <p className={big}>{wt ? <>{wt.latest}<span className="text-[13px] text-care-sub font-medium ml-1">lb</span></> : <span className="text-[15px] text-care-faint">none</span>}</p>
        <p className="text-[12px] text-care-sub mt-2">{!wt ? 'no entries' : wt.delta === 0 ? 'steady' : `${wt.delta > 0 ? '+' : ''}${wt.delta} lb overall`}</p>
      </div>
      <div className={cell}>
        <Overline>Medications</Overline>
        <p className={big}>{activeMeds.length}</p>
        <p className="text-[12px] text-care-sub mt-2">{activeMeds.length ? 'active' : 'none active'}</p>
      </div>
    </div>
  );
}

/* ------------------------------ Add vaccine ------------------------------ */
export function AddVaccineModal({ petId, species, onClose, onSaved }) {
  const presets = vaccinePresetsFor(species);
  const [picked, setPicked] = useState(null);
  const [customName, setCustomName] = useState('');
  const [givenOn, setGivenOn] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState(null);
  const [vetName, setVetName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const name = picked?.custom ? customName.trim() : picked?.name;
  const ready = !!name && !!givenOn && duration !== null;

  const save = async () => {
    if (!ready || saving) return;
    setSaving(true); setError(null);
    try {
      const administeredAt = new Date(givenOn + 'T12:00:00');
      const expiresAt = duration > 0 ? new Date(new Date(administeredAt).setFullYear(administeredAt.getFullYear() + duration)) : null;
      const res = await fetch(`/api/pets/${petId}/vaccinations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, administeredAt, expiresAt, vetName: vetName.trim() || undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      onSaved(data.vaccination); onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const chip = (on) => cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors', on ? 'bg-care-teal text-white border-care-teal' : 'border-care-line text-care-sub hover:border-care-ink');
  const input = 'w-full mb-4 rounded-xl border border-care-line px-3.5 py-2.5 text-[15px] text-care-ink placeholder:text-care-faint focus:outline-none focus:border-care-teal';
  const label = 'text-[13px] font-medium text-care-ink mb-1.5';

  return (
    <Modal onClose={onClose} title="Add a vaccine">
      <div className="flex flex-wrap gap-2 mb-4">
        {presets.map((p) => <button key={p.name} onClick={() => { setPicked(p); if (duration === null) setDuration(p.years); }} className={chip(picked?.name === p.name)}>{p.name}</button>)}
        <button onClick={() => setPicked({ custom: true })} className={chip(picked?.custom)}>Other</button>
      </div>
      {picked?.custom && <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Vaccine name" className={input} />}
      {picked && (
        <>
          <p className={label}>Given on</p>
          <input type="date" value={givenOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setGivenOn(e.target.value)} className={input} />
          <p className={label}>Good for</p>
          <div className="flex gap-2 mb-4">{[{ l: '1 year', v: 1 }, { l: '3 years', v: 3 }, { l: 'No expiry', v: 0 }].map(({ l, v }) => <button key={l} onClick={() => setDuration(v)} className={chip(duration === v)}>{l}</button>)}</div>
          <input value={vetName} onChange={(e) => setVetName(e.target.value)} placeholder="Vet or clinic (optional)" className={input} />
        </>
      )}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <button onClick={save} disabled={!ready || saving} className="w-full rounded-xl bg-care-teal text-white text-sm font-semibold py-2.5 hover:bg-care-tealDark transition-colors disabled:opacity-40">{saving ? 'Saving...' : 'Add vaccine'}</button>
    </Modal>
  );
}

/* Vaccines as rows. */
export function VaccinePassport({ vaccinations, canManage, managing, onToggleManage, onAdd, onRemove }) {
  return (
    <section>
      <SectionHeader
        title="Vaccines"
        action={(
          <span className="flex items-center gap-4">
            {canManage && vaccinations.length > 0 && <button onClick={onToggleManage} className="text-[13px] font-medium text-care-sub hover:text-care-ink transition-colors">{managing ? 'Done' : 'Manage'}</button>}
            {canManage && <button onClick={onAdd} className="inline-flex items-center gap-1 text-[13px] font-semibold text-care-teal">Add <Plus size={14} /></button>}
          </span>
        )}
      />
      {vaccinations.length === 0 ? (
        <Card className="px-5 py-6 text-center"><p className="text-[14px] text-care-sub">No vaccines on file.</p></Card>
      ) : (
        <Card className="overflow-hidden">
          {vaccinations.map((vax, i) => {
            const st = vaccinationStatus(vax);
            const soon = st === 'DUE_SOON' || st === 'EXPIRED';
            return (
              <div key={vax.id} className={cn('flex items-center gap-3 px-5 py-3.5', i > 0 && 'border-t border-care-lineSoft')}>
                {soon ? <AlertCircle size={17} className={VAX_DOT[st]} /> : <Check size={17} className={VAX_DOT[st]} />}
                <div className="flex-1 min-w-0">
                  <p className="text-[14.5px] font-semibold text-care-ink truncate">{vax.name}</p>
                  <p className="text-[12.5px] text-care-sub">{vax.expiresAt ? (st === 'EXPIRED' ? `Expired ${shortDate(vax.expiresAt)}` : `Good until ${shortDate(vax.expiresAt)}`) : `Recorded ${shortDate(vax.administeredAt)}`}</p>
                </div>
                <span className={cn('text-[12.5px] font-medium shrink-0', VAX_DOT[st])}>{VAX_LABEL[st]}</span>
                {managing && <button onClick={() => onRemove(vax)} className="text-[12.5px] font-medium text-red-600 hover:text-red-700 shrink-0">Remove</button>}
              </div>
            );
          })}
        </Card>
      )}
    </section>
  );
}

/* --------------------------------- Weight --------------------------------- */
export function WeightChart({ weights }) {
  if (weights.length < 2) return null;
  const w = 600, h = 140, padX = 6, padTop = 14, padBot = 22;
  const vals = weights.map((e) => e.weightLbs);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const x = (i) => padX + (i / (weights.length - 1)) * (w - 2 * padX);
  const y = (v) => padTop + (1 - (v - min) / span) * (h - padTop - padBot);
  const pts = weights.map((e, i) => `${x(i).toFixed(1)},${y(e.weightLbs).toFixed(1)}`);
  const last = weights[weights.length - 1];
  const fmt = (d) => new Date(d).toLocaleDateString([], { month: 'short', year: '2-digit' });
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="mt-3" role="img" aria-label="Weight over time">
      <polyline points={pts.join(' ')} fill="none" stroke="#0f5750" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {weights.map((e, i) => <circle key={i} cx={x(i)} cy={y(e.weightLbs)} r="2.4" fill="#0f5750" />)}
      <circle cx={x(weights.length - 1)} cy={y(last.weightLbs)} r="4.5" fill="#0f5750" />
      <text x={padX} y={h - 4} fill="#a0a5a9" fontSize="12">{fmt(weights[0].recordedAt)}</text>
      <text x={w - padX} y={h - 4} textAnchor="end" fill="#a0a5a9" fontSize="12">{fmt(last.recordedAt)}</text>
    </svg>
  );
}

export function WeightCard({ weights, canManage, weightInput, onWeightInput, onLog, saving }) {
  const latest = weights[weights.length - 1];
  return (
    <section>
      <SectionHeader title="Weight" action={latest && <span className="text-[12.5px] text-care-sub">last {new Date(latest.recordedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>} />
      <Card className="p-5">
        {latest ? (
          <p className="text-[28px] font-semibold tracking-tight text-care-ink tabular-nums">{latest.weightLbs}<span className="text-[15px] text-care-sub ml-1">lb</span></p>
        ) : <p className="text-[14px] text-care-sub">No weight logged yet.</p>}
        {weights.length >= 2 && <WeightChart weights={weights} />}
        {canManage && (
          <div className="flex items-center gap-2 mt-4">
            <input value={weightInput} onChange={(e) => onWeightInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onLog()} placeholder="Today's weight (lb)" inputMode="decimal" aria-label="Today's weight in pounds" className="flex-1 rounded-xl border border-care-line px-3.5 py-2.5 text-[15px] text-care-ink placeholder:text-care-faint focus:outline-none focus:border-care-teal" />
            <button onClick={onLog} disabled={saving || !weightInput} className="rounded-xl bg-care-teal text-white text-sm font-semibold px-4 py-2.5 hover:bg-care-tealDark disabled:opacity-40 transition-colors">{saving ? <Loader2 size={15} className="animate-spin" /> : 'Log'}</button>
          </div>
        )}
      </Card>
    </section>
  );
}

/* ----------------------------------- Vet ---------------------------------- */
export function VetCard({ pet, isOwner, vetDraft, onDraft, onSave, onCancel, saving }) {
  const input = 'w-full rounded-xl border border-care-line px-3.5 py-2.5 text-[15px] text-care-ink placeholder:text-care-faint focus:outline-none focus:border-care-teal';
  return (
    <section>
      <SectionHeader title="Vet" action={isOwner && vetDraft === null && <button onClick={() => onDraft({ vetName: pet?.vetName || '', vetClinic: pet?.vetClinic || '', vetPhone: pet?.vetPhone || '' })} className="text-[13px] font-medium text-care-sub hover:text-care-ink transition-colors">{pet?.vetName || pet?.vetClinic ? 'Edit' : 'Add'}</button>} />
      <Card className="p-5">
        {vetDraft ? (
          <div className="space-y-2.5">
            {[['vetName', 'Vet name'], ['vetClinic', 'Clinic'], ['vetPhone', 'Phone']].map(([k, ph]) => <input key={k} value={vetDraft[k]} onChange={(e) => onDraft({ ...vetDraft, [k]: e.target.value })} placeholder={ph} className={input} />)}
            <div className="flex gap-2 pt-1">
              <button onClick={onSave} disabled={saving} className="rounded-xl bg-care-teal text-white text-sm font-semibold px-4 py-2 hover:bg-care-tealDark transition-colors disabled:opacity-40">{saving ? 'Saving...' : 'Save'}</button>
              <button onClick={onCancel} className="rounded-xl border border-care-line text-sm font-medium text-care-ink px-4 py-2 hover:border-care-ink transition-colors">Cancel</button>
            </div>
          </div>
        ) : pet?.vetName || pet?.vetClinic ? (
          <div className="flex items-center gap-3.5">
            <span className="w-11 h-11 rounded-[13px] bg-care-tealWash text-care-teal flex items-center justify-center shrink-0 font-serif text-[17px] font-semibold">{(pet.vetName || pet.vetClinic || 'V').replace(/^Dr\.?\s*/i, '').charAt(0).toUpperCase()}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-care-ink truncate">{[pet.vetName, pet.vetClinic].filter(Boolean).join(', ')}</p>
              {pet.vetPhone && <a href={`tel:${pet.vetPhone}`} className="text-[13px] text-care-sub hover:text-care-ink">{pet.vetPhone}</a>}
            </div>
            {pet.vetPhone && <a href={`tel:${pet.vetPhone}`} aria-label="Call clinic" className="w-11 h-11 rounded-[13px] bg-care-teal text-white flex items-center justify-center shrink-0 hover:bg-care-tealDark transition-colors"><Phone size={18} /></a>}
          </div>
        ) : <p className="text-[14px] text-care-sub">No vet on file.</p>}
      </Card>
    </section>
  );
}

/* ------------------------------- History ---------------------------------- */
function monthAdherence(meds, monthKeyDate) {
  const scheduled = (meds || []).filter((m) => m.kind !== 'CARE' && m.scheduleType !== 'AS_NEEDED');
  if (!scheduled.length) return null;
  const windowStart = startOfDay(new Date(Date.now() - 34 * 86400000));
  const today = startOfDay(new Date());
  const first = new Date(monthKeyDate.getFullYear(), monthKeyDate.getMonth(), 1);
  const nextMonth = new Date(monthKeyDate.getFullYear(), monthKeyDate.getMonth() + 1, 1);
  let due = 0; let given = 0;
  for (let d = new Date(Math.max(first, windowStart)); d < nextMonth && d <= today; d = new Date(d.getTime() + 86400000)) {
    for (const med of scheduled) { const a = adherenceForDay(med, med.doses, d); due += a.due; given += a.given; }
  }
  if (!due) return null;
  return { due, given, pct: Math.round((given / due) * 100) };
}

export function MonthHistory({ vaccinations, weights, meds }) {
  const groups = useMemo(() => {
    const events = [];
    for (const v of (vaccinations || []).filter((v) => !v.deletedAt)) events.push({ at: new Date(v.administeredAt), kind: 'vax', title: v.name, sub: v.vetName || 'Vaccine recorded', id: `v-${v.id}` });
    for (const e of weights || []) events.push({ at: new Date(e.recordedAt), kind: 'weight', title: `${e.weightLbs} lb`, sub: e.note || 'Weight logged', id: `w-${e.id}` });
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
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <Overline>{g.key}</Overline>
              {adherence && <p className="text-[12.5px] text-care-sub">doses <span className={cn('font-semibold tabular-nums', adherence.pct >= 90 ? 'text-care-teal' : adherence.pct >= 60 ? 'text-care-amber' : 'text-red-600')}>{adherence.pct}%</span></p>}
            </div>
            <Card className="overflow-hidden">
              {g.items.map((ev, i) => (
                <div key={ev.id} className={cn('flex items-center gap-3 px-5 py-3', i > 0 && 'border-t border-care-lineSoft')}>
                  <span className={cn('w-2 h-2 rounded-full shrink-0', ev.kind === 'vax' ? 'bg-care-teal' : 'bg-care-faint')} aria-hidden="true" />
                  <div className="min-w-0 flex-1"><p className="text-[14px] font-semibold text-care-ink truncate">{ev.title}</p><p className="text-[12.5px] text-care-sub truncate">{ev.sub}</p></div>
                  <span className="text-[12.5px] text-care-sub shrink-0">{ev.at.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                </div>
              ))}
            </Card>
          </div>
        );
      })}
    </div>
  );
}
