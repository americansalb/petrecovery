'use client';

/**
 * The Health record components, shared between the logged-in Health tab
 * and the public sitter/vet view.
 *
 * Health answers one question: is everything OK, and what is on file?
 * So the verdict comes first as a single sentence colored by state,
 * then the facts as plain rows. Color means state, nothing else:
 * emerald is current, amber is due soon, red needs attention.
 */

import { useMemo, useState } from 'react';
import { Plus, Loader2, Phone } from 'lucide-react';
import { Modal, cn } from '@/components/ui';
import { vaccinationStatus, vaccinePresetsFor } from '@/lib/healthBook';
import { adherenceForDay, startOfDay } from '@/lib/medications';

const VAX_DOT = {
  PROTECTED: 'bg-emerald-500',
  DUE_SOON: 'bg-amber-500',
  EXPIRED: 'bg-red-500',
  ON_FILE: 'bg-neutral-300',
};
const VAX_LABEL = { PROTECTED: 'Protected', DUE_SOON: 'Due soon', EXPIRED: 'Expired', ON_FILE: 'On file' };
const VAX_TEXT = {
  PROTECTED: 'text-emerald-600',
  DUE_SOON: 'text-amber-600',
  EXPIRED: 'text-red-600',
  ON_FILE: 'text-neutral-400',
};

function shortDate(d) {
  return new Date(d).toLocaleDateString([], { month: 'short', year: 'numeric' });
}

/* ------------------------------ SectionHeader ------------------------------ */

/** A section label with an optional quiet action on the right. */
export function SectionHeader({ eyebrow, title, action }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-1">
      <h2 className="text-[13px] font-medium text-neutral-500">{title || eyebrow}</h2>
      {action}
    </div>
  );
}

/* ------------------------------- AlertRibbon ------------------------------- */

/** Medical conditions, stated plainly in red at the top of the record. */
export function AlertRibbon({ text, href }) {
  const value = text?.trim();
  if (!value) return null;
  const body = <span className="text-[15px] text-red-600">{value}</span>;
  return (
    <div className="mb-5">
      {href ? (
        <a href={href} className="hover:underline">{body}</a>
      ) : body}
    </div>
  );
}

/* ----------------------------- HealthStatusBand ---------------------------- */

const TONE_TEXT = {
  good: 'text-emerald-600',
  warn: 'text-amber-600',
  bad: 'text-red-600',
  empty: 'text-neutral-400',
};
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
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div className="min-w-0">
        <p className={cn('text-xl font-semibold tracking-tight', tone)}>{head}</p>
        {status.sentence && <p className="text-[15px] text-neutral-500 mt-0.5">{status.sentence}</p>}
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

/** Three plain figures: protection, weight, active meds. */
export function VitalsTrio({ vaccinations, weights, meds }) {
  const p = protectionSummary(vaccinations);
  const wt = weightTrend(weights);
  const activeMeds = (meds || []).filter((m) => m.isActive);

  const protSub = p.expired ? `${p.expired} expired` : p.dueSoon ? `${p.dueSoon} due soon` : p.withExpiry ? 'all current' : 'on file';
  const protTone = p.expired ? 'text-red-600' : p.dueSoon ? 'text-amber-600' : 'text-emerald-600';
  const trendSub = !wt ? 'no entries' : wt.dir === 'flat' ? 'steady' : `${wt.dir === 'up' ? '+' : ''}${wt.delta} lb overall`;

  const fig = 'flex-1 min-w-[100px]';
  const big = 'text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums';
  const cap = 'text-[13px] text-neutral-500 mt-0.5';
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3 mb-8">
      <div className={fig}>
        <p className={big}>{p.withExpiry ? `${p.protectedCount}/${p.withExpiry}` : (p.total || '0')}</p>
        <p className={cap}>Protected</p>
        <p className={cn('text-[13px]', protTone)}>{protSub}</p>
      </div>
      <div className={fig}>
        <p className={big}>{wt ? <>{wt.latest}<span className="text-base text-neutral-400"> lb</span></> : <span className="text-base text-neutral-300">none yet</span>}</p>
        <p className={cap}>Weight</p>
        <p className="text-[13px] text-neutral-500">{trendSub}</p>
      </div>
      <div className={fig}>
        <p className={big}>{activeMeds.length}</p>
        <p className={cap}>Medications</p>
        <p className="text-[13px] text-neutral-500">{activeMeds.length ? 'active' : 'none active'}</p>
      </div>
    </div>
  );
}

/* ---------------------------- Vaccine records ------------------------------ */

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
    'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
    active ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-300 text-neutral-700 hover:border-neutral-900'
  );
  const input = 'w-full mb-4 rounded-lg border border-neutral-300 px-3.5 py-2.5 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900';
  const label = 'text-[13px] font-medium text-neutral-700 mb-1.5';

  return (
    <Modal onClose={onClose} title="Add a vaccine">
      <div className="flex flex-wrap gap-2 mb-4">
        {presets.map((p) => (
          <button key={p.name} onClick={() => { setPicked(p); if (duration === null) setDuration(p.years); }} className={chip(picked?.name === p.name)}>
            {p.name}
          </button>
        ))}
        <button onClick={() => setPicked({ custom: true })} className={chip(picked?.custom)}>
          Other
        </button>
      </div>

      {picked?.custom && (
        <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Vaccine name" className={input} />
      )}

      {picked && (
        <>
          <p className={label}>Given on</p>
          <input
            type="date"
            value={givenOn}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setGivenOn(e.target.value)}
            className={input}
          />
          <p className={label}>Good for</p>
          <div className="flex gap-2 mb-4">
            {[{ l: '1 year', v: 1 }, { l: '3 years', v: 3 }, { l: 'No expiry', v: 0 }].map(({ l, v }) => (
              <button key={l} onClick={() => setDuration(v)} className={chip(duration === v)}>{l}</button>
            ))}
          </div>
          <input value={vetName} onChange={(e) => setVetName(e.target.value)} placeholder="Vet or clinic (optional)" className={input} />
        </>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      <button
        onClick={save}
        disabled={!ready || saving}
        className="w-full rounded-full bg-neutral-900 text-white text-sm font-medium py-2.5 hover:bg-neutral-700 transition-colors disabled:opacity-40"
      >
        {saving ? 'Saving...' : 'Add vaccine'}
      </button>
    </Modal>
  );
}

/** Vaccines as plain rows: a status dot, the name, when it lapses. */
export function VaccinePassport({ vaccinations, canManage, managing, onToggleManage, onAdd, onRemove }) {
  return (
    <section className="mb-8">
      <SectionHeader
        title="Vaccines"
        action={(
          <span className="flex items-center gap-4">
            {canManage && vaccinations.length > 0 && (
              <button
                onClick={onToggleManage}
                className="text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                {managing ? 'Done' : 'Manage'}
              </button>
            )}
            {canManage && (
              <button
                onClick={onAdd}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                <Plus size={13} /> Add
              </button>
            )}
          </span>
        )}
      />

      {vaccinations.length === 0 ? (
        <p className="text-[15px] text-neutral-500 py-3">No vaccines on file.</p>
      ) : (
        <div className="divide-y divide-neutral-100">
          {vaccinations.map((vax) => {
            const st = vaccinationStatus(vax);
            return (
              <div key={vax.id} className="flex items-center gap-3 py-3">
                <span className={cn('w-2 h-2 rounded-full shrink-0', VAX_DOT[st])} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-neutral-900 truncate">{vax.name}</p>
                  <p className="text-[13px] text-neutral-500">
                    {vax.expiresAt
                      ? (st === 'EXPIRED' ? `Expired ${shortDate(vax.expiresAt)}` : `Good until ${shortDate(vax.expiresAt)}`)
                      : `Recorded ${shortDate(vax.administeredAt)}`}
                  </p>
                </div>
                <span className={cn('text-[13px] shrink-0', VAX_TEXT[st])}>{VAX_LABEL[st]}</span>
                {managing && (
                  <button
                    onClick={() => onRemove(vax)}
                    className="text-[13px] font-medium text-red-600 hover:text-red-700 transition-colors shrink-0"
                    aria-label={`Remove ${vax.name}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* --------------------------------- Weight ---------------------------------- */

export function WeightChart({ weights }) {
  if (weights.length < 2) return null;
  const w = 600, h = 120, padX = 4, padTop = 12, padBot = 20;
  const vals = weights.map((e) => e.weightLbs);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const x = (i) => padX + (i / (weights.length - 1)) * (w - 2 * padX);
  const y = (v) => padTop + (1 - (v - min) / span) * (h - padTop - padBot);
  const pts = weights.map((e, i) => `${x(i).toFixed(1)},${y(e.weightLbs).toFixed(1)}`);
  const last = weights[weights.length - 1];
  const fmt = (d) => new Date(d).toLocaleDateString([], { month: 'short', year: '2-digit' });
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="mt-3" role="img" aria-label="Weight over time">
      <polyline points={pts.join(' ')} fill="none" stroke="#171717" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {weights.map((e, i) => <circle key={i} cx={x(i)} cy={y(e.weightLbs)} r="2" fill="#171717" />)}
      <circle cx={x(weights.length - 1)} cy={y(last.weightLbs)} r="4" fill="#171717" />
      <text x={padX} y={h - 4} fill="#a3a3a3" fontSize="11" fontFamily="ui-sans-serif, system-ui">{fmt(weights[0].recordedAt)}</text>
      <text x={w - padX} y={h - 4} textAnchor="end" fill="#a3a3a3" fontSize="11" fontFamily="ui-sans-serif, system-ui">{fmt(last.recordedAt)}</text>
    </svg>
  );
}

export function WeightCard({ weights, canManage, weightInput, onWeightInput, onLog, saving }) {
  const latestWeight = weights[weights.length - 1];
  return (
    <section className="mb-8">
      <SectionHeader
        title="Weight"
        action={latestWeight && (
          <span className="text-[13px] text-neutral-500">
            last {new Date(latestWeight.recordedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
        )}
      />
      {latestWeight ? (
        <p className="text-2xl font-semibold tracking-tight text-neutral-900 tabular-nums">
          {latestWeight.weightLbs}<span className="text-base text-neutral-400"> lb</span>
        </p>
      ) : (
        <p className="text-[15px] text-neutral-500">No weight logged yet.</p>
      )}
      {weights.length >= 2 && <WeightChart weights={weights} />}
      {canManage && (
        <div className="flex items-center gap-2 mt-4">
          <input
            value={weightInput}
            onChange={(e) => onWeightInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onLog()}
            placeholder="Today's weight (lb)"
            inputMode="decimal"
            aria-label="Today's weight in pounds"
            className="flex-1 rounded-lg border border-neutral-300 px-3.5 py-2.5 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900"
          />
          <button
            onClick={onLog}
            disabled={saving || !weightInput}
            className="rounded-full bg-neutral-900 text-white text-sm font-medium px-4 py-2.5 hover:bg-neutral-700 disabled:opacity-40 transition-colors"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : 'Log'}
          </button>
        </div>
      )}
    </section>
  );
}

/* -------------------------------- Vet card --------------------------------- */

export function VetCard({ pet, isOwner, vetDraft, onDraft, onSave, onCancel, saving, petName }) {
  const input = 'w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900';
  return (
    <section className="mb-8">
      <SectionHeader
        title="Vet"
        action={isOwner && vetDraft === null && (
          <button
            onClick={() => onDraft({ vetName: pet?.vetName || '', vetClinic: pet?.vetClinic || '', vetPhone: pet?.vetPhone || '' })}
            className="text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            {pet?.vetName || pet?.vetClinic ? 'Edit' : 'Add'}
          </button>
        )}
      />
      {vetDraft ? (
        <div className="space-y-2.5">
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
            <button onClick={onSave} disabled={saving} className="rounded-full bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-700 transition-colors disabled:opacity-40">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={onCancel} className="rounded-full border border-neutral-300 text-sm font-medium text-neutral-900 px-4 py-2 hover:border-neutral-900 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : pet?.vetName || pet?.vetClinic ? (
        <div>
          <p className="text-[15px] font-medium text-neutral-900">{[pet.vetName, pet.vetClinic].filter(Boolean).join(', ')}</p>
          {pet.vetPhone && (
            <a href={`tel:${pet.vetPhone}`} className="inline-flex items-center gap-1.5 mt-1 text-[15px] text-neutral-600 hover:text-neutral-900">
              <Phone size={14} /> {pet.vetPhone}
            </a>
          )}
        </div>
      ) : (
        <p className="text-[15px] text-neutral-500">No vet on file.</p>
      )}
    </section>
  );
}

/* ------------------------------- MonthHistory ------------------------------ */

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
    <div className="space-y-6">
      {groups.slice(0, 6).map((g) => {
        const adherence = meds ? monthAdherence(meds, g.at) : null;
        return (
          <div key={g.key}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <p className="text-[13px] font-medium text-neutral-500">{g.key}</p>
              {adherence && (
                <p className="text-[13px] text-neutral-500">
                  doses <span className={cn(
                    'tabular-nums',
                    adherence.pct >= 90 ? 'text-emerald-600' : adherence.pct >= 60 ? 'text-amber-600' : 'text-red-600'
                  )}>{adherence.pct}%</span> ({adherence.given}/{adherence.due})
                </p>
              )}
            </div>
            <div className="divide-y divide-neutral-100">
              {g.items.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 py-2.5">
                  <span className={cn('w-2 h-2 rounded-full shrink-0', ev.kind === 'vax' ? 'bg-emerald-500' : 'bg-neutral-300')} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-neutral-900 truncate">{ev.title}</p>
                    <p className="text-[13px] text-neutral-500 truncate">{ev.sub}</p>
                  </div>
                  <span className="text-[13px] text-neutral-500 shrink-0">{ev.at.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
