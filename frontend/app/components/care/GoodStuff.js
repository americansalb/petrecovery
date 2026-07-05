'use client';

/**
 * Daily care routines on Today: walks, brushing, treats, playtime.
 *
 * One row per routine. Scheduled routines show their times as chips
 * that fill in when done; "whenever" routines show a count and a Done
 * button. These share the dose engine as kind:'CARE' rows, but they
 * are daily life, not medicine, so they sit in their own group.
 *
 * `readOnly` renders the rows as status only (the public care view).
 */

import { useState } from 'react';
import { Plus, X, Loader2, Pause, Play, Trash2, Check } from 'lucide-react';
import { Modal, cn } from '@/components/ui';
import {
  slotsWithStatus, sameDay, formatTime, formatSchedule,
  CARE_ACTIVITIES,
} from '@/lib/medications';
import { CareIconChip } from '@/app/components/icons/CareIcons';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function AddCareModal({ petId, onClose, onSaved }) {
  const [picked, setPicked] = useState(null);
  const [customName, setCustomName] = useState('');
  const [freq, setFreq] = useState('DAILY');
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const [times, setTimes] = useState(['08:00']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const pick = (activity) => {
    setPicked(activity);
    if (activity.defaultTimes?.length) {
      setTimes(activity.defaultTimes);
      setFreq('DAILY');
    } else if (activity.defaultTimes && activity.defaultTimes.length === 0) {
      setFreq('AS_NEEDED');
    }
  };

  const name = picked?.custom ? customName.trim() : picked?.label;
  const ready = !!name && (freq === 'AS_NEEDED' || times.length > 0) && (freq !== 'SPECIFIC_DAYS' || days.length > 0);

  const save = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/pets/${petId}/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'CARE',
          name,
          color: picked?.color || 'emerald',
          scheduleType: freq,
          timesOfDay: freq === 'AS_NEEDED' ? [] : times,
          daysOfWeek: freq === 'SPECIFIC_DAYS' ? days : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      onSaved(data.medication);
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

  return (
    <Modal onClose={onClose} title="Add a routine">
      <div className="grid grid-cols-4 gap-2 mb-4">
        {CARE_ACTIVITIES.map((a) => (
          <button
            key={a.id}
            onClick={() => pick(a)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-lg border py-3 transition-colors',
              picked?.id === a.id ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'
            )}
          >
            <CareIconChip name={a.label} color={a.color} size="sm" />
            <span className="text-[12px] font-medium text-neutral-700">{a.label}</span>
          </button>
        ))}
        <button
          onClick={() => setPicked({ custom: true })}
          className={cn(
            'flex flex-col items-center gap-1.5 rounded-lg border py-3 transition-colors',
            picked?.custom ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'
          )}
        >
          <CareIconChip name="" color="slate" size="sm" />
          <span className="text-[12px] font-medium text-neutral-700">Custom</span>
        </button>
      </div>

      {picked?.custom && (
        <input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Name it (belly rubs, garden patrol)"
          className="w-full mb-4 rounded-lg border border-neutral-300 px-3.5 py-2.5 text-[15px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900"
        />
      )}

      {picked && (
        <>
          <div className="flex gap-2 mb-3">
            {[
              { id: 'DAILY', label: 'Every day' },
              { id: 'SPECIFIC_DAYS', label: 'Some days' },
              { id: 'AS_NEEDED', label: 'Whenever' },
            ].map((f) => (
              <button key={f.id} onClick={() => setFreq(f.id)} className={cn('flex-1', chip(freq === f.id))}>
                {f.label}
              </button>
            ))}
          </div>

          {freq === 'SPECIFIC_DAYS' && (
            <div className="flex gap-1.5 mb-3 justify-center">
              {DAY_LETTERS.map((letter, i) => (
                <button
                  key={i}
                  onClick={() => setDays((prev) => (prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]))}
                  aria-label={`Toggle day ${i}`}
                  className={cn(
                    'w-9 h-9 rounded-full border text-sm font-medium transition-colors',
                    days.includes(i) ? 'bg-neutral-900 text-white border-neutral-900' : 'border-neutral-300 text-neutral-500 hover:border-neutral-900'
                  )}
                >
                  {letter}
                </button>
              ))}
            </div>
          )}

          {freq !== 'AS_NEEDED' && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {times.map((t) => (
                <button
                  key={t}
                  onClick={() => setTimes((prev) => prev.filter((x) => x !== t))}
                  title="Remove"
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-900 hover:border-neutral-900 transition-colors"
                >
                  {formatTime(t)} <X size={13} />
                </button>
              ))}
              <input
                type="time"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setTimes((prev) => [...new Set([...prev, v])].sort());
                }}
                aria-label="Add a time"
                className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm text-neutral-700 focus:outline-none focus:border-neutral-900"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <button
            onClick={save}
            disabled={!ready || saving}
            className="w-full rounded-full bg-neutral-900 text-white text-sm font-medium py-2.5 hover:bg-neutral-700 transition-colors disabled:opacity-40"
          >
            {saving ? 'Adding...' : `Add ${name || 'routine'}`}
          </button>
        </>
      )}
    </Modal>
  );
}

export default function GoodStuff({ petId, meds, setMeds, canManage, readOnly = false }) {
  const interactive = canManage && !readOnly;
  const [busyKeys, setBusyKeys] = useState(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [managing, setManaging] = useState(false);
  const [error, setError] = useState(null);

  const careItems = meds.filter((m) => m.kind === 'CARE');
  const active = careItems.filter((c) => c.isActive);
  const day = new Date();

  const withBusy = async (key, fn) => {
    setBusyKeys((prev) => new Set(prev).add(key));
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const applyDose = (medId, dose, quantityRemaining, removed = false) => {
    setMeds((prev) => prev.map((m) => {
      if (m.id !== medId) return m;
      const doses = (m.doses || []).filter((d) => new Date(d.scheduledFor).getTime() !== new Date(dose.scheduledFor).getTime());
      if (!removed) doses.unshift(dose);
      return { ...m, doses, quantityRemaining: quantityRemaining !== undefined ? quantityRemaining : m.quantityRemaining };
    }));
  };

  const mark = (care, slot) =>
    withBusy(`${care.id}-${slot.scheduledFor.getTime()}`, async () => {
      const res = await fetch(`/api/pets/${petId}/medications/${care.id}/doses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: slot.scheduledFor.toISOString(), status: 'GIVEN' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log');
      applyDose(care.id, data.dose, data.quantityRemaining);
    });

  const undo = (care, slot) =>
    withBusy(`${care.id}-${slot.scheduledFor.getTime()}`, async () => {
      const res = await fetch(
        `/api/pets/${petId}/medications/${care.id}/doses?scheduledFor=${encodeURIComponent(slot.scheduledFor.toISOString())}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to undo');
      applyDose(care.id, { scheduledFor: slot.scheduledFor.toISOString() }, data.quantityRemaining, true);
    });

  const logPrn = (care) =>
    withBusy(`prn-${care.id}`, async () => {
      const res = await fetch(`/api/pets/${petId}/medications/${care.id}/doses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: new Date().toISOString(), status: 'GIVEN' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log');
      applyDose(care.id, data.dose, data.quantityRemaining);
    });

  const undoPrn = (care) =>
    withBusy(`prn-${care.id}`, async () => {
      const last = (care.doses || [])
        .filter((d) => !d.deletedAt && d.status === 'GIVEN' && sameDay(new Date(d.scheduledFor), day))
        .sort((a, b) => new Date(b.scheduledFor) - new Date(a.scheduledFor))[0];
      if (!last) return;
      const iso = new Date(last.scheduledFor).toISOString();
      const res = await fetch(
        `/api/pets/${petId}/medications/${care.id}/doses?scheduledFor=${encodeURIComponent(iso)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to undo');
      applyDose(care.id, { scheduledFor: iso }, data.quantityRemaining, true);
    });

  const seedActivity = (a) =>
    withBusy(`seed-${a.id}`, async () => {
      const asNeeded = !a.defaultTimes || a.defaultTimes.length === 0;
      const res = await fetch(`/api/pets/${petId}/medications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'CARE',
          name: a.label,
          color: a.color || 'emerald',
          scheduleType: asNeeded ? 'AS_NEEDED' : 'DAILY',
          timesOfDay: asNeeded ? [] : a.defaultTimes,
          daysOfWeek: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add');
      setMeds((prev) => [...prev, data.medication]);
    });

  const togglePause = (care) =>
    withBusy(`pause-${care.id}`, async () => {
      const res = await fetch(`/api/pets/${petId}/medications/${care.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !care.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setMeds((prev) => prev.map((m) => (m.id === care.id ? data.medication : m)));
    });

  const remove = (care) =>
    withBusy(`delete-${care.id}`, async () => {
      const res = await fetch(`/api/pets/${petId}/medications/${care.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove');
      setMeds((prev) => prev.filter((m) => m.id !== care.id));
    });

  // Today's rows: one per routine, ordered by first time.
  const scheduled = [];
  for (const care of active.filter((c) => c.scheduleType !== 'AS_NEEDED')) {
    const slots = slotsWithStatus(care, care.doses, day);
    if (slots.length) scheduled.push({ care, slots });
  }
  scheduled.sort((a, b) => a.slots[0].time.localeCompare(b.slots[0].time));
  const whenever = active.filter((c) => c.scheduleType === 'AS_NEEDED');

  if (active.length === 0 && !interactive) return null;

  return (
    <section className="mt-8">
      {showAdd && (
        <AddCareModal
          petId={petId}
          onClose={() => setShowAdd(false)}
          onSaved={(med) => setMeds((prev) => [...prev, med])}
        />
      )}

      <div className="flex items-center justify-between gap-3 mb-1">
        <p className="text-[13px] font-medium text-neutral-500">Routines</p>
        {interactive && (
          <span className="flex items-center gap-4">
            {careItems.length > 0 && (
              <button
                onClick={() => setManaging(!managing)}
                className="text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                {managing ? 'Done' : 'Manage'}
              </button>
            )}
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1 text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              <Plus size={13} /> Add
            </button>
          </span>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {managing ? (
        <div className="divide-y divide-neutral-100">
          {careItems.map((care) => (
            <div key={care.id} className={cn('flex items-center gap-3 py-3', !care.isActive && 'opacity-50')}>
              <CareIconChip name={care.name} color={care.color} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-neutral-900 truncate">{care.name}</p>
                <p className="text-[13px] text-neutral-500 truncate">{formatSchedule(care)}{!care.isActive && ', paused'}</p>
              </div>
              <button
                onClick={() => togglePause(care)}
                disabled={busyKeys.has(`pause-${care.id}`)}
                className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors"
                title={care.isActive ? 'Pause' : 'Resume'}
              >
                {care.isActive ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button
                onClick={() => remove(care)}
                disabled={busyKeys.has(`delete-${care.id}`)}
                className="p-2 text-neutral-400 hover:text-red-600 transition-colors"
                title="Remove"
              >
                {busyKeys.has(`delete-${care.id}`) ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
            </div>
          ))}
        </div>
      ) : active.length === 0 ? (
        interactive && (
          <div className="flex flex-wrap gap-2 pt-1">
            {CARE_ACTIVITIES.slice(0, 6).map((a) => {
              const busy = busyKeys.has(`seed-${a.id}`);
              return (
                <button
                  key={a.id}
                  onClick={() => seedActivity(a)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-3.5 py-1.5 text-sm font-medium text-neutral-700 hover:border-neutral-900 transition-colors disabled:opacity-50"
                >
                  <CareIconChip name={a.label} color={a.color} size="sm" />
                  {a.label}
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} className="text-neutral-400" />}
                </button>
              );
            })}
            <button
              onClick={() => setShowAdd(true)}
              className="rounded-full border border-neutral-300 px-3.5 py-1.5 text-sm font-medium text-neutral-500 hover:border-neutral-900 hover:text-neutral-900 transition-colors"
            >
              More
            </button>
          </div>
        )
      ) : (
        <div className="divide-y divide-neutral-100">
          {scheduled.map(({ care, slots }) => {
            const doneCount = slots.filter((s) => s.status === 'GIVEN').length;
            return (
              <div key={care.id} className="flex items-center gap-3 py-3">
                <CareIconChip name={care.name} color={care.color} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-neutral-900 truncate">{care.name}</p>
                  {slots.length > 1 && (
                    <p className="text-[13px] text-neutral-500">{doneCount} of {slots.length} today</p>
                  )}
                </div>
                <span className="flex items-center gap-1.5 flex-wrap justify-end">
                  {slots.map((slot) => {
                    const done = slot.status === 'GIVEN';
                    const busy = busyKeys.has(`${care.id}-${slot.scheduledFor.getTime()}`);
                    return (
                      <button
                        key={slot.time}
                        onClick={interactive ? () => (done ? undo(care, slot) : mark(care, slot)) : undefined}
                        disabled={!interactive || busy}
                        title={!interactive ? undefined : done ? `Undo ${formatTime(slot.time)}` : `Mark ${formatTime(slot.time)} done`}
                        aria-label={`${care.name} ${formatTime(slot.time)}${done ? ', done, tap to undo' : ''}`}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[13px] font-medium tabular-nums transition-colors',
                          done
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'border-neutral-300 text-neutral-700',
                          interactive && !done && 'hover:border-neutral-900',
                          !interactive && 'cursor-default'
                        )}
                      >
                        {busy ? '...' : done ? <><Check size={12} /> {formatTime(slot.time)}</> : formatTime(slot.time)}
                      </button>
                    );
                  })}
                </span>
              </div>
            );
          })}

          {whenever.map((care) => {
            const count = (care.doses || []).filter(
              (d) => !d.deletedAt && d.status === 'GIVEN' && sameDay(new Date(d.scheduledFor), day)
            ).length;
            const busy = busyKeys.has(`prn-${care.id}`);
            return (
              <div key={care.id} className="flex items-center gap-3 py-3">
                <CareIconChip name={care.name} color={care.color} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-neutral-900 truncate">{care.name}</p>
                  {count > 0 && <p className="text-[13px] text-neutral-500">{count} today</p>}
                </div>
                {readOnly ? (
                  count > 0 && <span className="text-[13px] text-emerald-600">{count} today</span>
                ) : busy ? (
                  <Loader2 size={16} className="animate-spin text-neutral-400" />
                ) : (
                  <span className="flex items-center gap-3">
                    {interactive && count > 0 && (
                      <button
                        onClick={() => undoPrn(care)}
                        aria-label={`Undo last ${care.name}`}
                        className="text-[13px] font-medium text-neutral-400 hover:text-neutral-900 transition-colors"
                      >
                        Undo
                      </button>
                    )}
                    {interactive && (
                      <button
                        onClick={() => logPrn(care)}
                        aria-label={count > 0 ? `Log another ${care.name}` : `Log ${care.name}`}
                        className="rounded-full border border-neutral-300 text-sm font-medium text-neutral-900 px-4 py-1.5 hover:border-neutral-900 transition-colors"
                      >
                        Done
                      </button>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
