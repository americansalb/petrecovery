'use client';

/**
 * The good stuff - daily care routines on the pet's Today page.
 *
 * Walks, brushing, treats, playtime. These are daily life, not
 * medicine, so they get their own section of the diary page — one
 * ruled line per habit, its times as little ink pills that fill in
 * when done. Underneath they share the proven dose engine (schedules,
 * one-tap logs, history) as kind: 'CARE' rows on PetMedication.
 *
 * `readOnly` renders the same lines as pure status (the public care
 * view); no add/manage affordances, no tap-to-log hints.
 */

import { useState } from 'react';
import { Plus, X, Loader2, Pause, Play, Trash2, Undo2 } from 'lucide-react';
import { Modal, cn } from '@/components/ui';
import {
  slotsWithStatus, sameDay, formatTime, formatSchedule,
  CARE_ACTIVITIES,
} from '@/lib/medications';
import { CareIconChip } from '@/app/components/icons/CareIcons';
import {
  Sheet, SectionInk, RuledList, RuledRow, MonoChip, StampText,
} from '@/app/components/care/paper/Paper';

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

  return (
    <Modal variant="paper" onClose={onClose} title="Add to the good stuff" subtitle="The happy pages. No prescriptions required.">
      <div className="grid grid-cols-4 gap-2 mb-4">
        {CARE_ACTIVITIES.map((a) => (
          <button
            key={a.id}
            onClick={() => pick(a)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-[5px] border py-3 transition-all',
              picked?.id === a.id ? 'border-stampred bg-stampred-wash' : 'border-paper-400 hover:border-pen-300 bg-paper-50'
            )}
          >
            <CareIconChip name={a.label} color={a.color} size="sm" />
            <span className="text-[11px] font-semibold text-pen-600">{a.label}</span>
          </button>
        ))}
        <button
          onClick={() => setPicked({ custom: true })}
          className={cn(
            'flex flex-col items-center gap-1 rounded-[5px] border py-3 transition-all',
            picked?.custom ? 'border-stampred bg-stampred-wash' : 'border-dashed border-pen-300 hover:border-pen-400 bg-paper-50'
          )}
        >
          <CareIconChip name="" color="slate" size="sm" />
          <span className="text-[11px] font-semibold text-pen-600">Custom</span>
        </button>
      </div>

      {picked?.custom && (
        <input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Name it (belly rubs, garden patrol...)"
          className="w-full mb-4 rounded-[5px] border border-pen-300 bg-paper-50 px-3.5 py-2.5 text-sm text-pen-900 placeholder:text-pen-300 focus:outline-none focus:border-stampred"
        />
      )}

      {picked && (
        <>
          <div className="flex gap-1.5 mb-3">
            {[
              { id: 'DAILY', label: 'Every day' },
              { id: 'SPECIFIC_DAYS', label: 'Some days' },
              { id: 'AS_NEEDED', label: 'Whenever' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFreq(f.id)}
                className={cn(
                  'flex-1 py-2 rounded-[5px] border font-stamp text-[10px] uppercase tracking-[0.08em] transition',
                  freq === f.id ? 'border-stampred bg-stampred text-paper-50' : 'border-paper-400 text-pen-600 hover:border-pen-300'
                )}
              >
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
                    'w-9 h-9 rounded-full border-[1.5px] font-stamp text-[11px] transition',
                    days.includes(i) ? 'border-pen-900 bg-pen-900 text-paper-50' : 'border-paper-400 text-pen-400'
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
                  className="inline-flex items-center gap-1.5 font-stamp text-[10px] px-3 py-1.5 rounded-full border-[1.5px] border-pen-900 text-pen-900 hover:border-stampred hover:text-stampred transition"
                >
                  {formatTime(t)} <X size={11} />
                </button>
              ))}
              <input
                type="time"
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) setTimes((prev) => [...new Set([...prev, v])].sort());
                }}
                aria-label="Add a time"
                className="rounded-[5px] border border-pen-300 bg-paper-50 px-2 py-1.5 text-sm text-pen-600"
              />
            </div>
          )}

          {error && <p className="text-sm text-stampred mb-3">{error}</p>}

          <button
            onClick={save}
            disabled={!ready || saving}
            className="w-full font-stamp text-[11px] uppercase tracking-[0.14em] bg-pen-900 text-paper-50 rounded-[5px] py-3 hover:bg-pen-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Writing it in…' : `Add ${name || 'routine'}`}
          </button>
        </>
      )}
    </Modal>
  );
}

/**
 * The section for Today: one ruled line per routine, its times as ink
 * pills, plus add and a small manage view (pause / delete).
 */
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

  // Tapping a "whenever" pill logs another; an accidental tap has to be
  // reversible, so the undo removes the most recent of today's.
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

  // One tap on an empty section starts a routine with its sensible defaults;
  // the modal stays available under "More..." for custom setups.
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

  // Build today's lines: ONE line per routine, its times as pills.
  const scheduled = [];
  for (const care of active.filter((c) => c.scheduleType !== 'AS_NEEDED')) {
    const slots = slotsWithStatus(care, care.doses, day);
    if (slots.length) scheduled.push({ care, slots });
  }
  scheduled.sort((a, b) => a.slots[0].time.localeCompare(b.slots[0].time));
  const whenever = active.filter((c) => c.scheduleType === 'AS_NEEDED');

  if (active.length === 0 && !interactive) return null;

  return (
    <>
      {showAdd && (
        <AddCareModal
          petId={petId}
          onClose={() => setShowAdd(false)}
          onSaved={(med) => setMeds((prev) => [...prev, med])}
        />
      )}

      <Sheet className="mb-5">
        <SectionInk
          action={interactive && (
            <span className="flex items-center gap-3">
              {careItems.length > 0 && (
                <button
                  onClick={() => setManaging(!managing)}
                  className={cn(
                    'font-stamp text-[9.5px] uppercase tracking-[0.12em] transition-colors',
                    managing ? 'text-stampred' : 'text-pen-400 hover:text-pen-900'
                  )}
                >
                  {managing ? 'done' : 'manage'}
                </button>
              )}
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-1 font-stamp text-[9.5px] uppercase tracking-[0.12em] text-pen-400 hover:text-pen-900 transition-colors"
              >
                <Plus size={11} /> add
              </button>
            </span>
          )}
        >
          the good stuff
        </SectionInk>

        {error && (
          <p className="text-sm text-stampred border-l-[3px] border-stampred pl-3 py-1 mb-3">{error}</p>
        )}

        {managing ? (
          <RuledList>
            {careItems.map((care) => (
              <RuledRow key={care.id} faded={!care.isActive}>
                <CareIconChip name={care.name} color={care.color} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-pen-900 truncate">{care.name}</p>
                  <p className="font-diary italic text-[11.5px] text-pen-400 truncate">{formatSchedule(care)}{!care.isActive && ' · paused'}</p>
                </div>
                <button
                  onClick={() => togglePause(care)}
                  disabled={busyKeys.has(`pause-${care.id}`)}
                  className="p-2 text-pen-400 hover:text-pen-900 transition-colors"
                  title={care.isActive ? 'Pause' : 'Resume'}
                >
                  {care.isActive ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button
                  onClick={() => remove(care)}
                  disabled={busyKeys.has(`delete-${care.id}`)}
                  className="p-2 text-pen-400 hover:text-stampred transition-colors"
                  title="Remove"
                >
                  {busyKeys.has(`delete-${care.id}`) ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </RuledRow>
            ))}
          </RuledList>
        ) : active.length === 0 ? (
          interactive && (
            <>
              <div className="flex flex-wrap gap-2">
                {CARE_ACTIVITIES.slice(0, 6).map((a) => {
                  const busy = busyKeys.has(`seed-${a.id}`);
                  return (
                    <button
                      key={a.id}
                      onClick={() => seedActivity(a)}
                      disabled={busy}
                      className="flex items-center gap-2 rounded-[5px] border border-dashed border-pen-300 bg-paper-50 px-3 py-2 transition-all hover:border-stampred active:scale-95"
                    >
                      <CareIconChip name={a.label} color={a.color} size="sm" />
                      <span className="text-left">
                        <span className="block text-sm font-bold text-pen-900">{a.label}</span>
                        <span className="block font-diary italic text-[10.5px] text-pen-400">
                          {busy ? 'writing it in…' : a.defaultTimes?.length ? a.defaultTimes.map(formatTime).join(' & ') : 'whenever it happens'}
                        </span>
                      </span>
                      {busy ? <Loader2 size={13} className="animate-spin text-pen-400" /> : <Plus size={13} className="text-pen-300" />}
                    </button>
                  );
                })}
                <button
                  onClick={() => setShowAdd(true)}
                  className="flex items-center gap-2 rounded-[5px] border border-dashed border-pen-300 px-3 py-2 font-stamp text-[10px] uppercase tracking-[0.1em] text-pen-400 hover:border-pen-400 hover:text-pen-600 transition-all"
                >
                  more…
                </button>
              </div>
              <p className="font-diary italic text-[11.5px] text-pen-400 mt-3">
                tap one to start it with sensible times; adjust anytime under manage.
              </p>
            </>
          )
        ) : (
          <RuledList>
            {scheduled.map(({ care, slots }) => {
              const doneCount = slots.filter((s) => s.status === 'GIVEN').length;
              const allDone = doneCount === slots.length;
              return (
                <RuledRow key={care.id}>
                  <CareIconChip name={care.name} color={care.color} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-bold truncate', allDone ? 'text-stampgreen' : 'text-pen-900')}>{care.name}</p>
                    {slots.length > 1 && (
                      <p className="font-diary italic text-[11px] text-pen-400">{doneCount}/{slots.length} today</p>
                    )}
                  </div>
                  <span className="flex items-center gap-1.5 flex-wrap justify-end">
                    {slots.map((slot) => {
                      const done = slot.status === 'GIVEN';
                      const busy = busyKeys.has(`${care.id}-${slot.scheduledFor.getTime()}`);
                      return (
                        <MonoChip
                          key={slot.time}
                          tone="green"
                          filled={done}
                          disabled={!interactive || busy}
                          onClick={interactive ? () => (done ? undo(care, slot) : mark(care, slot)) : undefined}
                          title={!interactive ? undefined : done ? `Undo ${formatTime(slot.time)}` : `Mark ${formatTime(slot.time)} done`}
                          ariaLabel={`${care.name} ${formatTime(slot.time)}${done ? ', done, tap to undo' : ''}`}
                        >
                          {busy ? '…' : done ? `✓ ${formatTime(slot.time)}` : formatTime(slot.time)}
                        </MonoChip>
                      );
                    })}
                  </span>
                </RuledRow>
              );
            })}

            {whenever.map((care) => {
              const count = (care.doses || []).filter(
                (d) => !d.deletedAt && d.status === 'GIVEN' && sameDay(new Date(d.scheduledFor), day)
              ).length;
              const busy = busyKeys.has(`prn-${care.id}`);
              return (
                <RuledRow key={care.id}>
                  <CareIconChip name={care.name} color={care.color} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-pen-900 truncate">{care.name}</p>
                    <p className="font-diary italic text-[11px] text-pen-400">
                      {count > 0 ? `×${count} today` : readOnly ? 'whenever' : 'tap when it happens'}
                    </p>
                  </div>
                  {readOnly ? (
                    count > 0 && <StampText tone="green" rotate={-5}>×{count}</StampText>
                  ) : busy ? (
                    <Loader2 size={14} className="animate-spin text-pen-400" />
                  ) : (
                    <span className="flex items-center gap-2">
                      {interactive && count > 0 && (
                        <button
                          onClick={() => undoPrn(care)}
                          aria-label={`Undo last ${care.name}`}
                          title="Undo last"
                          className="inline-flex items-center gap-1 font-stamp text-[9px] uppercase tracking-[0.1em] text-pen-400 hover:text-pen-900 transition-colors"
                        >
                          <Undo2 size={12} /> undo
                        </button>
                      )}
                      {interactive && (
                        <MonoChip tone="green" onClick={() => logPrn(care)} ariaLabel={count > 0 ? `Log another ${care.name}` : `Log ${care.name}`}>
                          {count > 0 ? '+ again' : '+ done'}
                        </MonoChip>
                      )}
                    </span>
                  )}
                </RuledRow>
              );
            })}
          </RuledList>
        )}
      </Sheet>
    </>
  );
}
