'use client';

/**
 * Health record components (direction D), composed by the Health tab's
 * subtabs and reused read-only on the public view. Color means state only:
 * teal = current, amber = due soon, red = attention.
 */

import { useMemo, useState } from 'react';
import { Plus, Loader2, Phone, Check, AlertCircle, Heart, X } from 'lucide-react';
import { Modal, cn } from '@/components/ui';
import { Card, Overline } from '@/app/components/care/kit/Tile';
import {
  vaccinationStatus, vaccinePresetsFor, latestPerName, rankVaccinations, weightTrendSummary,
} from '@/lib/healthBook';
import { adherenceForDay, startOfDay } from '@/lib/medications';

const VAX_DOT = { PROTECTED: 'text-care-teal', DUE_SOON: 'text-care-amber', EXPIRED: 'text-red-600', ON_FILE: 'text-care-faint' };
const VAX_LABEL = { PROTECTED: 'Current', DUE_SOON: 'Due soon', EXPIRED: 'Expired', ON_FILE: 'On file' };
function shortDate(d) { return new Date(d).toLocaleDateString([], { month: 'short', year: 'numeric' }); }
function dayDate(d, now = new Date()) {
  const date = new Date(d);
  const opts = { month: 'short', day: 'numeric' };
  if (date.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return date.toLocaleDateString([], opts);
}

export function SectionHeader({ eyebrow, title, action }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <Overline>{title || eyebrow}</Overline>
      {action}
    </div>
  );
}

/**
 * Medical conditions. A labelled note, not a bare red paragraph: unlabelled
 * red text reads as an error string, and a long condition list must not
 * own the first screen - clamp to two lines with an expander.
 */
export function AlertRibbon({ text, href }) {
  const [expanded, setExpanded] = useState(false);
  const value = text?.trim();
  if (!value) return null;
  const long = value.length > 120;
  return (
    <div className="mb-4 flex items-start gap-2.5">
      <span className="mt-0.5 w-6 h-6 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
        <Heart size={13} />
      </span>
      <div className="min-w-0">
        <span className="flex items-center gap-2">
          <Overline>Medical note</Overline>
          {href && <a href={href} className="text-care-xs font-semibold text-care-teal hover:underline">Edit</a>}
        </span>
        <p className={cn('text-care-base font-medium text-red-600 mt-0.5', !expanded && 'line-clamp-2')}>{value}</p>
        {long && (
          <button onClick={() => setExpanded((v) => !v)} className="text-care-sm font-medium text-care-sub hover:text-care-ink mt-0.5">
            {expanded ? 'Less' : 'More'}
          </button>
        )}
      </div>
    </div>
  );
}

const TONE_TEXT = { good: 'text-care-teal', warn: 'text-care-amber', bad: 'text-red-600', onfile: 'text-care-ink', empty: 'text-care-faint' };
const TONE_HEAD = {
  good: (n) => `${n} is up to date.`,
  // "has one thing due" was hardcoded and undercounted a six-vaccine lapse.
  warn: (n, s) => (s?.dueCount > 1 ? `${n} has ${s.dueCount} things due.` : `${n} has one thing due.`),
  bad: (n) => `${n} needs attention.`,
  onfile: (n) => `${n}'s records are on file.`,
  empty: (n) => `${n}'s record is empty.`,
};

export function HealthStatusBand({ name, status, action }) {
  const tone = TONE_TEXT[status.tone] || TONE_TEXT.empty;
  const head = (TONE_HEAD[status.tone] || TONE_HEAD.empty)(name, status);
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <p className={cn('text-care-xl font-semibold tracking-tight', tone)}>{head}</p>
        {status.sentence && <p className="text-care-base text-care-sub mt-1">{status.sentence}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function protectionSummary(vaccinations) {
  const live = latestPerName(vaccinations);
  const withExpiry = live.filter((v) => v.expiresAt);
  return {
    total: live.length,
    withExpiry: withExpiry.length,
    protectedCount: withExpiry.filter((v) => vaccinationStatus(v) === 'PROTECTED').length,
    dueSoon: withExpiry.filter((v) => vaccinationStatus(v) === 'DUE_SOON').length,
    expired: withExpiry.filter((v) => vaccinationStatus(v) === 'EXPIRED').length,
  };
}

/**
 * The record in one line.
 *
 * This used to be three stat tiles. On a new animal they read "0 / none /
 * 0" - a wall of zeros telling you nothing - and on a full record they
 * simply repeated the three sections printed directly beneath them. A
 * summary that duplicates its own detail is decoration.
 *
 * Now it states what is true, in words, and says nothing at all when
 * there is nothing to say. The sections below carry the detail.
 */
export function VitalsTrio({ vaccinations, weights, meds, showVaccinations = true }) {
  const p = showVaccinations ? protectionSummary(vaccinations) : { total: 0 };
  const wt = weightTrendSummary(weights);
  const activeMeds = (meds || []).filter((m) => m.isActive);

  if (!p.total && !wt && !activeMeds.length) return null;

  const vaxTone = p.expired ? 'text-red-600' : p.dueSoon ? 'text-care-amber' : 'text-care-teal';
  const vaxText = !p.total
    ? null
    : p.expired
      ? `${p.expired} vaccination${p.expired === 1 ? '' : 's'} expired`
      : p.dueSoon
        ? `${p.dueSoon} vaccination${p.dueSoon === 1 ? '' : 's'} due soon`
        : p.withExpiry
          ? `vaccinations current${p.protectedCount !== p.withExpiry ? ` (${p.protectedCount}/${p.withExpiry})` : ''}`
          : `${p.total} vaccination${p.total === 1 ? '' : 's'} on file`;

  const parts = [];
  if (wt) {
    // A delta needs its window ("down 1.4 lb · 60 days"); a lone entry is
    // just a number, not a "steady" trend.
    if (wt.delta == null) parts.push(`${wt.latest.weightLbs} lb`);
    else if (wt.delta === 0) parts.push(`${wt.latest.weightLbs} lb, steady · ${wt.spanLabel}`);
    else parts.push(`${wt.latest.weightLbs} lb, ${wt.delta > 0 ? 'up' : 'down'} ${Math.abs(wt.delta)} lb · ${wt.spanLabel}`);
  }
  if (activeMeds.length) {
    parts.push(`${activeMeds.length} medication${activeMeds.length === 1 ? '' : 's'}`);
  }

  return (
    <p className="text-care-base text-care-sub">
      {vaxText && <span className={cn('font-medium', vaxTone)}>{vaxText}</span>}
      {vaxText && parts.length > 0 && ' · '}
      {parts.join(' · ')}
    </p>
  );
}

/* ------------------------------ Add vaccine ------------------------------ */
export function AddVaccineModal({ petId, species, presetName, onClose, onSaved }) {
  const presets = vaccinePresetsFor(species);
  const today = new Date().toISOString().slice(0, 10);
  // Arriving from a ghost stamp means the vaccine is already chosen; open
  // with it picked and its duration set so the modal is one tap from done.
  const preselected = presetName ? presets.find((p) => p.name === presetName) : null;
  const [picked, setPicked] = useState(preselected || null);
  const [customName, setCustomName] = useState('');
  const [givenOn, setGivenOn] = useState(today);
  const [duration, setDuration] = useState(preselected ? preselected.years : null); // 1 | 3 | 0 | 'custom'
  const [customExpiry, setCustomExpiry] = useState('');
  const [vetName, setVetName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const name = picked?.custom ? customName.trim().replace(/\s+/g, ' ') : picked?.name;
  const ready = !!name && !!givenOn && duration !== null && (duration !== 'custom' || !!customExpiry);

  const save = async () => {
    if (!ready || saving) return;
    // Validate here so obvious mistakes don't need a server round-trip.
    if (name.length < 2) { setError('Vaccine name needs at least 2 characters'); return; }
    if (givenOn > today) { setError("The given-on date can't be in the future"); return; }
    if (duration === 'custom' && customExpiry <= givenOn) { setError('Expiry must be after the given-on date'); return; }
    setSaving(true); setError(null);
    try {
      const administeredAt = new Date(givenOn + 'T12:00:00');
      const expiresAt = duration === 'custom'
        ? new Date(customExpiry + 'T12:00:00')
        : duration > 0
          ? new Date(new Date(administeredAt).setFullYear(administeredAt.getFullYear() + duration))
          : null;
      const res = await fetch(`/api/pets/${petId}/vaccinations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, administeredAt, expiresAt, vetName: vetName.trim() || undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      // `retired` = older same-name records the renewal replaced server-side
      onSaved(data.vaccination, data.retired || []); onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const chip = (on) => cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors', on ? 'bg-care-teal text-white border-care-teal' : 'border-care-line text-care-sub hover:border-care-ink');
  const input = 'w-full mb-4 rounded-xl border border-care-line px-3.5 py-2.5 text-care-base text-care-ink placeholder:text-care-faint focus:outline-none focus:border-care-teal';
  const label = 'text-care-sm font-medium text-care-ink mb-1.5';

  return (
    <Modal onClose={onClose} title="Add a vaccine" subtitle={picked ? undefined : 'Pick the vaccine to record'}>
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Duration follows the chosen vaccine. The old `duration === null`
            guard only set it on the FIRST pick, so switching Rabies (3 yr)
            to DHPP (1 yr) kept 3 years highlighted and silently recorded a
            two-year-too-long expiry. */}
        {presets.map((p) => <button key={p.name} onClick={() => { setPicked(p); setDuration(p.years); }} className={chip(picked?.name === p.name)}>{p.name}</button>)}
        <button onClick={() => setPicked({ custom: true })} className={chip(picked?.custom)}>Other</button>
      </div>
      {picked?.custom && <input value={customName} maxLength={40} onChange={(e) => setCustomName(e.target.value)} placeholder="Vaccine name" className={input} />}
      {picked && (
        <>
          <p className={label}>Given on</p>
          <input type="date" value={givenOn} max={today} onChange={(e) => setGivenOn(e.target.value)} className={input} />
          <p className={label}>Good for</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {[{ l: '1 year', v: 1 }, { l: '3 years', v: 3 }, { l: 'No expiry', v: 0 }, { l: 'Custom date', v: 'custom' }].map(({ l, v }) => (
              <button key={l} onClick={() => setDuration(v)} className={chip(duration === v)}>{l}</button>
            ))}
          </div>
          {duration === 'custom' && (
            <>
              <p className={label}>Expires on</p>
              <input type="date" value={customExpiry} min={givenOn} onChange={(e) => setCustomExpiry(e.target.value)} className={input} />
            </>
          )}
          <input value={vetName} onChange={(e) => setVetName(e.target.value)} placeholder="Vet or clinic (optional)" className={input} />
        </>
      )}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <button onClick={save} disabled={!ready || saving} className="w-full rounded-xl bg-care-teal text-white text-sm font-semibold py-2.5 hover:bg-care-tealDark transition-colors disabled:opacity-40">{saving ? 'Saving...' : 'Add vaccine'}</button>
    </Modal>
  );
}

/* --------------------------------- Stamps --------------------------------- */
/**
 * Vaccines as STAMPS, the metaphor the design doc specified and the app
 * never built (docs/HEALTH_BOOK_DESIGN.md §1): a rounded badge with a
 * vaccine mark, the name, the date in a stamped mono face, and a status
 * ring. Empty slots for the species' usual shots render as dashed ghost
 * stamps that fill themselves in on a tap, so a thin record shows what it
 * is missing instead of just being short.
 */
const STAMP_STYLE = {
  PROTECTED: { ring: 'ring-stampgreen/35', bg: 'bg-stampgreen-wash', ink: 'text-stampgreen', label: 'Current' },
  DUE_SOON:  { ring: 'ring-marker/45',     bg: 'bg-marker-wash',     ink: 'text-care-amber', label: 'Due soon' },
  EXPIRED:   { ring: 'ring-stampred/40',   bg: 'bg-stampred-wash',   ink: 'text-stampred',   label: 'Expired' },
  ON_FILE:   { ring: 'ring-care-line',     bg: 'bg-care-bg',         ink: 'text-care-sub',   label: 'On file' },
};

function Stamp({ vax, managing, onRemove }) {
  const st = vaccinationStatus(vax);
  const s = STAMP_STYLE[st] || STAMP_STYLE.ON_FILE;
  const dated = vax.expiresAt
    ? `${st === 'EXPIRED' ? 'expired' : 'thru'} ${shortDate(vax.expiresAt)}`
    : `given ${shortDate(vax.administeredAt)}`;
  return (
    <div className={cn('relative rounded-care-lg ring-1 p-4 flex flex-col items-center text-center transition-transform hover:-translate-y-[1px]', s.ring, s.bg)}>
      <span className={cn('w-10 h-10 rounded-full bg-care-surface ring-1 flex items-center justify-center mb-2.5', s.ring, s.ink)}>
        {st === 'EXPIRED' || st === 'DUE_SOON' ? <AlertCircle size={18} /> : <Check size={18} />}
      </span>
      <p className="text-care-sm font-semibold text-care-ink leading-tight line-clamp-2" title={vax.name}>{vax.name}</p>
      <p className={cn('font-stamp text-care-xs uppercase mt-1.5 tracking-wider', s.ink)}>{dated}</p>
      <span className={cn('text-care-xs font-semibold mt-2', s.ink)}>{s.label}</span>
      {managing && (
        <button
          onClick={() => onRemove(vax)}
          aria-label={`Remove ${vax.name}`}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-care-surface ring-1 ring-care-line text-care-sub hover:text-red-600 flex items-center justify-center"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

function GhostStamp({ name, onAdd }) {
  return (
    <button
      onClick={() => onAdd(name)}
      className="rounded-care-lg border border-dashed border-care-line p-4 flex flex-col items-center text-center hover:border-care-teal hover:bg-care-tealWash/40 transition-colors group"
    >
      <span className="w-10 h-10 rounded-full border border-dashed border-care-line group-hover:border-care-teal text-care-faint group-hover:text-care-teal flex items-center justify-center mb-2.5">
        <Plus size={17} />
      </span>
      <p className="text-care-sm font-semibold text-care-faint group-hover:text-care-ink leading-tight">{name}</p>
      <p className="font-stamp text-care-xs uppercase mt-1.5 tracking-wider text-care-faint">not on file</p>
    </button>
  );
}

export function VaccinePassport({ vaccinations, species, canManage, managing, onToggleManage, onAdd, onRemove }) {
  const rows = rankVaccinations(latestPerName(vaccinations));
  // Ghost slots: the usual shots for this species that have no stamp yet.
  const have = new Set(rows.map((v) => (v.name || '').trim().toLowerCase()));
  const ghosts = canManage && !managing
    ? vaccinePresetsFor(species).map((p) => p.name).filter((n) => !have.has(n.toLowerCase()))
    : [];

  return (
    <section>
      <SectionHeader
        title="Vaccines"
        action={(
          <span className="flex items-center gap-4">
            {canManage && rows.length > 0 && <button onClick={onToggleManage} className="text-care-sm font-medium text-care-sub hover:text-care-ink transition-colors">{managing ? 'Done' : 'Manage'}</button>}
            {canManage && <button onClick={() => onAdd()} className="inline-flex items-center gap-1 text-care-sm font-semibold text-care-teal">Add <Plus size={14} /></button>}
          </span>
        )}
      />
      {rows.length === 0 && !ghosts.length ? (
        <Card className="px-5 py-3.5">
          <p className="text-care-base text-care-sub">
            Nothing recorded yet.{' '}
            {canManage && (
              <button onClick={() => onAdd()} className="font-semibold text-care-teal hover:underline">
                Add the first vaccination
              </button>
            )}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {rows.map((vax) => <Stamp key={vax.id} vax={vax} managing={managing} onRemove={onRemove} />)}
          {ghosts.map((n) => <GhostStamp key={n} name={n} onAdd={onAdd} />)}
        </div>
      )}
      {ghosts.length > 0 && rows.length > 0 && (
        <p className="text-care-xs text-care-faint mt-3">Dashed slots are the usual shots for this species. Tap one to record it.</p>
      )}
    </section>
  );
}

/* --------------------------------- Weight --------------------------------- */
export function WeightChart({ weights }) {
  if (weights.length < 2) return null;
  const w = 600, h = 140, padX = 6, padTop = 16, padBot = 22;
  const vals = weights.map((e) => e.weightLbs);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const x = (i) => padX + (i / (weights.length - 1)) * (w - 2 * padX);
  const y = (v) => padTop + (1 - (v - min) / span) * (h - padTop - padBot);
  const pts = weights.map((e, i) => `${x(i).toFixed(1)},${y(e.weightLbs).toFixed(1)}`);
  const last = weights[weights.length - 1];
  // Full years: "Jul 23" for July 2023 reads as a day of this month.
  const fmt = (d) => new Date(d).toLocaleDateString([], { month: 'short', year: 'numeric' });
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="mt-3" role="img" aria-label="Weight over time">
      <polyline points={pts.join(' ')} fill="none" stroke="#0f5750" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {weights.map((e, i) => <circle key={i} cx={x(i)} cy={y(e.weightLbs)} r="2.4" fill="#0f5750" />)}
      <circle cx={x(weights.length - 1)} cy={y(last.weightLbs)} r="4.5" fill="#0f5750" />
      {/* The y-scale, stated: without min/max an outlier silently reshapes
          the whole curve and nobody can tell. */}
      {max !== min && <text x={padX} y="11" fill="#a0a5a9" fontSize="11">{max} lb</text>}
      <text x={padX} y={h - padBot + 4} fill="#a0a5a9" fontSize="11">{min !== max ? `${min} lb` : ''}</text>
      <text x={padX} y={h - 4} fill="#a0a5a9" fontSize="12">{fmt(weights[0].recordedAt)}</text>
      <text x={w - padX} y={h - 4} textAnchor="end" fill="#a0a5a9" fontSize="12">{fmt(last.recordedAt)}</text>
    </svg>
  );
}

export function WeightCard({
  weights, canManage, weightInput, onWeightInput, weightDate, onWeightDate, onLog, saving,
  managing, onToggleManage, onRemove,
}) {
  const latest = weights[weights.length - 1];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <section>
      <SectionHeader
        title="Weight"
        action={(
          <span className="flex items-center gap-4">
            {latest && <span className="text-care-sm text-care-sub">last {dayDate(latest.recordedAt)}</span>}
            {/* A fat-fingered entry (14.2 for 142) permanently bends the
                chart unless it can be removed right here. */}
            {canManage && weights.length > 0 && onToggleManage && (
              <button onClick={onToggleManage} className="text-care-sm font-medium text-care-sub hover:text-care-ink transition-colors">{managing ? 'Done' : 'Manage'}</button>
            )}
          </span>
        )}
      />
      {/* Tighter when empty: the log row IS the empty state, so a new
          record shows one place to type instead of a headline over a void. */}
      <Card className={latest ? 'p-5' : 'px-5 py-4'}>
        {latest && (
          <p className="text-care-2xl font-semibold tracking-tight text-care-ink tabular-nums">{latest.weightLbs}<span className="text-care-base text-care-sub ml-1">lb</span></p>
        )}
        {weights.length >= 2 && !managing && <WeightChart weights={weights} />}
        {managing ? (
          <div className="mt-3 -mx-5 max-h-80 overflow-y-auto">
            {[...weights].reverse().map((e, i) => (
              <div key={e.id} className={cn('flex items-center gap-3 px-5 py-2.5', i > 0 && 'border-t border-care-lineSoft')}>
                <div className="flex-1 min-w-0">
                  <p className="text-care-base font-semibold text-care-ink tabular-nums">{e.weightLbs} lb</p>
                  {e.note && <p className="text-care-xs text-care-sub truncate">{e.note}</p>}
                </div>
                <span className="text-care-sm text-care-sub shrink-0">{dayDate(e.recordedAt)}</span>
                <button onClick={() => onRemove(e)} className="text-care-sm font-medium text-red-600 hover:text-red-700 shrink-0">Remove</button>
              </div>
            ))}
          </div>
        ) : canManage && (
          <div className={latest ? 'mt-4' : ''}>
            {/* Date inputs carry a wide intrinsic minimum and globals.css
                forces typed inputs to width:100%, so without wrap + min-w-0
                the Log button is pushed off a narrow screen entirely. */}
            <div className="flex flex-wrap items-center gap-2">
              <input value={weightInput} onChange={(e) => onWeightInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onLog()} placeholder="Weight (lb)" inputMode="decimal" aria-label="Weight in pounds" className="min-w-0 flex-1 basis-32 rounded-xl border border-care-line px-3.5 py-2.5 text-care-base text-care-ink placeholder:text-care-faint focus:outline-none focus:border-care-teal" />
              {onWeightDate && (
                <input
                  type="date"
                  value={weightDate || ''}
                  max={today}
                  onChange={(e) => onWeightDate(e.target.value === today ? '' : e.target.value)}
                  aria-label="Date weighed (leave empty for today)"
                  title="Date weighed. Leave empty for today, e.g. to enter a vet-visit weigh-in."
                  className="min-w-0 shrink rounded-xl border border-care-line px-3 py-2.5 text-care-base text-care-sub focus:outline-none focus:border-care-teal"
                />
              )}
              <button onClick={onLog} disabled={saving || !weightInput} className="shrink-0 rounded-xl bg-care-teal text-white text-sm font-semibold px-4 py-2.5 hover:bg-care-tealDark disabled:opacity-40 transition-colors">{saving ? <Loader2 size={15} className="animate-spin" /> : 'Log'}</button>
            </div>
            <p className="text-care-xs text-care-faint mt-2">Pick a date to enter a past weigh-in, like a vet visit. Empty means today.</p>
          </div>
        )}
      </Card>
    </section>
  );
}

/* ----------------------------------- Vet ---------------------------------- */
export function VetCard({ pet, isOwner, vetDraft, onDraft, onSave, onCancel, saving }) {
  const input = 'w-full rounded-xl border border-care-line px-3.5 py-2.5 text-care-base text-care-ink placeholder:text-care-faint focus:outline-none focus:border-care-teal';
  // A phone number alone is still a vet on file - in an emergency it is
  // the single most valuable field, so it must never render as "none".
  const hasVet = pet?.vetName || pet?.vetClinic || pet?.vetPhone;
  const vetTitle = [pet?.vetName, pet?.vetClinic].filter(Boolean).join(', ') || pet?.vetPhone;
  return (
    <section>
      <SectionHeader title="Vet" action={isOwner && vetDraft === null && <button onClick={() => onDraft({ vetName: pet?.vetName || '', vetClinic: pet?.vetClinic || '', vetPhone: pet?.vetPhone || '' })} className="text-care-sm font-medium text-care-sub hover:text-care-ink transition-colors">{hasVet ? 'Edit' : 'Add'}</button>} />
      <Card className="p-5">
        {vetDraft ? (
          <div className="space-y-2.5">
            {[['vetName', 'Vet name'], ['vetClinic', 'Clinic'], ['vetPhone', 'Phone']].map(([k, ph]) => (
              <label key={k} className="block">
                <span className="block text-care-sm font-medium text-care-sub mb-1">{ph}</span>
                <input value={vetDraft[k]} onChange={(e) => onDraft({ ...vetDraft, [k]: e.target.value })} placeholder={ph} className={input} />
              </label>
            ))}
            <div className="flex gap-2 pt-1">
              <button onClick={onSave} disabled={saving} className="rounded-xl bg-care-teal text-white text-sm font-semibold px-4 py-2 hover:bg-care-tealDark transition-colors disabled:opacity-40">{saving ? 'Saving...' : 'Save'}</button>
              <button onClick={onCancel} className="rounded-xl border border-care-line text-sm font-medium text-care-ink px-4 py-2 hover:border-care-ink transition-colors">Cancel</button>
            </div>
          </div>
        ) : hasVet ? (
          <div className="flex items-center gap-3.5">
            <span className="w-11 h-11 rounded-[13px] bg-care-tealWash text-care-teal flex items-center justify-center shrink-0 font-serif text-care-lg font-semibold">
              {pet.vetName || pet.vetClinic
                ? (pet.vetName || pet.vetClinic).replace(/^Dr\.?\s*/i, '').charAt(0).toUpperCase()
                : <Phone size={17} />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-care-base font-semibold text-care-ink truncate">{vetTitle}</p>
              {pet.vetPhone && vetTitle !== pet.vetPhone && <a href={`tel:${pet.vetPhone}`} className="text-care-sm text-care-sub hover:text-care-ink">{pet.vetPhone}</a>}
            </div>
            {pet.vetPhone && <a href={`tel:${pet.vetPhone}`} aria-label="Call clinic" className="w-11 h-11 rounded-[13px] bg-care-teal text-white flex items-center justify-center shrink-0 hover:bg-care-tealDark transition-colors"><Phone size={18} /></a>}
          </div>
        ) : <p className="text-care-base text-care-sub">No vet on file.</p>}
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
              {adherence && (
                <p className="text-care-sm text-care-sub" title="Scheduled doses marked given this month (last 35 days)">
                  {adherence.given} of {adherence.due} doses given{' '}
                  <span className={cn('font-semibold tabular-nums', adherence.pct >= 90 ? 'text-care-teal' : adherence.pct >= 60 ? 'text-care-amber' : 'text-red-600')}>({adherence.pct}%)</span>
                  <span className="text-care-faint"> · last 35 days</span>
                </p>
              )}
            </div>
            <Card className="overflow-hidden">
              {g.items.map((ev, i) => (
                <div key={ev.id} className={cn('flex items-center gap-3 px-5 py-3', i > 0 && 'border-t border-care-lineSoft')}>
                  <span className={cn('w-2 h-2 rounded-full shrink-0', ev.kind === 'vax' ? 'bg-care-teal' : 'bg-care-faint')} aria-hidden="true" />
                  <div className="min-w-0 flex-1"><p className="text-care-base font-semibold text-care-ink truncate">{ev.title}</p><p className="text-care-sm text-care-sub truncate">{ev.sub}</p></div>
                  <span className="text-care-sm text-care-sub shrink-0">{ev.at.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                </div>
              ))}
            </Card>
          </div>
        );
      })}
    </div>
  );
}
