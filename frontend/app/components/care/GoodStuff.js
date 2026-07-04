'use client';

/**
 * The good stuff - daily care routines on the pet's profile
 *
 * Walks, brushing, treats, playtime. These are daily life, not
 * medicine, so they live on the pet's home page; the medication
 * tracker stays purely medical. Underneath they share the proven
 * dose engine (schedules, one-tap logs, history) as kind: 'CARE'
 * rows on PetMedication.
 */

import { useState } from 'react';
import {
  Plus, X, Check, Loader2, Pause, Play, Trash2, Settings2, Undo2,
} from 'lucide-react';
import { Card, Button, cn } from '@/components/ui';
import {
  slotsWithStatus, sameDay, formatTime, formatSchedule,
  CARE_ACTIVITIES,
} from '@/lib/medications';
import { CareIconChip, BallIcon } from '@/app/components/icons/CareIcons';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <Card className="relative w-full max-w-md p-6 rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-midnight-400 hover:text-midnight-600">
          <X size={20} />
        </button>
        <h3 className="text-xl font-bold text-midnight-900 mb-1">Add a care routine</h3>
        <p className="text-sm text-midnight-500 mb-4">The happy stuff. No prescriptions required.</p>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {CARE_ACTIVITIES.map((a) => (
            <button
              key={a.id}
              onClick={() => pick(a)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-2xl border-2 py-3 transition-all',
                picked?.id === a.id ? 'border-flash-400 bg-flash-50' : 'border-midnight-200 hover:border-midnight-300'
              )}
            >
              <CareIconChip name={a.label} color={a.color} size="sm" />
              <span className="text-[11px] font-semibold text-midnight-700">{a.label}</span>
            </button>
          ))}
          <button
            onClick={() => setPicked({ custom: true })}
            className={cn(
              'flex flex-col items-center gap-1 rounded-2xl border-2 py-3 transition-all',
              picked?.custom ? 'border-flash-400 bg-flash-50' : 'border-dashed border-midnight-300 hover:border-midnight-400'
            )}
          >
            <CareIconChip name="" color="slate" size="sm" />
            <span className="text-[11px] font-semibold text-midnight-700">Custom</span>
          </button>
        </div>

        {picked?.custom && (
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Name it (belly rubs, garden patrol...)"
            className="w-full mb-4 rounded-xl border border-midnight-300 px-3.5 py-2.5 text-sm text-midnight-900 placeholder:text-midnight-400 focus:outline-none focus:ring-2 focus:ring-flash-400"
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
                    'flex-1 py-2 rounded-xl border-2 text-xs font-bold transition',
                    freq === f.id ? 'border-flash-400 bg-flash-50 text-midnight-900' : 'border-midnight-200 text-midnight-500'
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
                      'w-9 h-9 rounded-full border-2 text-xs font-bold transition',
                      days.includes(i) ? 'border-flash-400 bg-flash-400 text-midnight-900' : 'border-midnight-200 text-midnight-400'
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-midnight-100 text-midnight-800 text-sm font-semibold hover:bg-red-50 hover:text-red-600 transition"
                  >
                    {formatTime(t)} <X size={12} />
                  </button>
                ))}
                <input
                  type="time"
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v) setTimes((prev) => [...new Set([...prev, v])].sort());
                  }}
                  aria-label="Add a time"
                  className="rounded-xl border border-midnight-300 px-2 py-1.5 text-sm text-midnight-700"
                />
              </div>
            )}

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            <Button variant="primary" fullWidth loading={saving} disabled={!ready} onClick={save}>
              Add {name || 'routine'}
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}

/**
 * The interactive section for the pet profile: today's chips, one tap
 * each, plus add and a small manage view (pause / delete).
 */
// `readOnly` renders the same chips as pure status (the public care
// view); no add/manage affordances, no tap-to-log hints.
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

  // Tapping a "whenever" chip logs another; an accidental tap has to be
  // reversible, so the corner undo removes the most recent of today's.
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

  // One tap on an empty room starts a routine with its sensible defaults;
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

  // Build today's chips
  const scheduled = [];
  for (const care of active.filter((c) => c.scheduleType !== 'AS_NEEDED')) {
    for (const slot of slotsWithStatus(care, care.doses, day)) {
      scheduled.push({ care, slot });
    }
  }
  scheduled.sort((a, b) => a.slot.time.localeCompare(b.slot.time));
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

      <Card padding="lg" className={cn('mb-6', active.length === 0 && 'border-dashed')}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="flex items-center gap-2 font-bold text-midnight-900">
            <BallIcon size={18} className="text-flash-500" /> The good stuff
          </h2>
          {interactive && (
            <div className="flex items-center gap-1">
              {careItems.length > 0 && (
                <button
                  onClick={() => setManaging(!managing)}
                  className={cn(
                    'inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors',
                    managing ? 'bg-midnight-900 text-white' : 'text-midnight-500 hover:text-midnight-900 hover:bg-midnight-100'
                  )}
                >
                  <Settings2 size={13} /> Manage
                </button>
              )}
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-midnight-500 hover:text-midnight-900 px-2.5 py-1.5 rounded-lg hover:bg-midnight-100 transition-colors"
              >
                <Plus size={14} /> Add
              </button>
            </div>
          )}
        </div>
        <p className="text-sm text-midnight-500 mb-4">
          {readOnly
            ? 'Walks, brushing, treats: daily life, not medicine.'
            : active.length === 0
              ? 'Walks, brushing, treats, playtime. One tap each, right here.'
              : 'Daily life, one tap each.'}
        </p>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-3">{error}</p>
        )}

        {managing ? (
          <ul className="space-y-2">
            {careItems.map((care) => (
              <li key={care.id} className={cn('flex items-center gap-3 rounded-2xl border-2 border-midnight-200 px-3.5 py-2.5', !care.isActive && 'opacity-60')}>
                <CareIconChip name={care.name} color={care.color} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-midnight-900 truncate">{care.name}</p>
                  <p className="text-[11px] text-midnight-500 truncate">{formatSchedule(care)}{!care.isActive && ' · paused'}</p>
                </div>
                <button
                  onClick={() => togglePause(care)}
                  disabled={busyKeys.has(`pause-${care.id}`)}
                  className="p-2 rounded-lg text-midnight-500 hover:text-midnight-900 hover:bg-midnight-100 transition-colors"
                  title={care.isActive ? 'Pause' : 'Resume'}
                >
                  {care.isActive ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <button
                  onClick={() => remove(care)}
                  disabled={busyKeys.has(`delete-${care.id}`)}
                  className="p-2 rounded-lg text-midnight-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Remove"
                >
                  {busyKeys.has(`delete-${care.id}`) ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </li>
            ))}
          </ul>
        ) : active.length === 0 ? (
          interactive && (
            <>
              <div className="flex flex-wrap gap-2.5">
                {CARE_ACTIVITIES.slice(0, 6).map((a) => {
                  const busy = busyKeys.has(`seed-${a.id}`);
                  return (
                    <button
                      key={a.id}
                      onClick={() => seedActivity(a)}
                      disabled={busy}
                      className="flex items-center gap-2.5 rounded-2xl border-2 border-dashed border-midnight-200 bg-white px-3.5 py-2.5 transition-all hover:border-flash-400 hover:bg-flash-50 active:scale-95"
                    >
                      <CareIconChip name={a.label} color={a.color} size="sm" />
                      <span className="text-left">
                        <span className="block text-sm font-bold text-midnight-900">{a.label}</span>
                        <span className="block text-[11px] text-midnight-500">
                          {busy ? 'Adding...' : a.defaultTimes?.length ? a.defaultTimes.map(formatTime).join(' & ') : 'whenever it happens'}
                        </span>
                      </span>
                      {busy ? <Loader2 size={15} className="animate-spin text-midnight-400" /> : <Plus size={15} className="text-midnight-300" />}
                    </button>
                  );
                })}
                <button
                  onClick={() => setShowAdd(true)}
                  className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-midnight-200 px-3.5 py-2.5 text-sm font-bold text-midnight-500 hover:border-midnight-300 hover:text-midnight-800 transition-all"
                >
                  More...
                </button>
              </div>
              <p className="text-[11px] text-midnight-400 mt-3">
                Tap one to start it with sensible times. Adjust anytime under Manage.
              </p>
            </>
          )
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {scheduled.map(({ care, slot }) => {
              const done = slot.status === 'GIVEN';
              const busy = busyKeys.has(`${care.id}-${slot.scheduledFor.getTime()}`);
              return (
                <button
                  key={`${care.id}-${slot.time}`}
                  onClick={() => {
                    if (!interactive || busy) return;
                    if (done) undo(care, slot);
                    else mark(care, slot);
                  }}
                  disabled={!interactive || busy}
                  title={!interactive ? undefined : done ? 'Tap to undo' : `Mark ${care.name} done`}
                  className={cn(
                    'flex items-center gap-2.5 rounded-2xl border-2 px-3.5 py-2.5 transition-all active:scale-95',
                    done ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-midnight-200 hover:border-flash-400'
                  )}
                >
                  <CareIconChip name={care.name} color={care.color} size="sm" />
                  <span className="text-left">
                    <span className={cn('block text-sm font-bold', done ? 'text-emerald-700' : 'text-midnight-900')}>
                      {care.name}
                    </span>
                    <span className={cn('block text-[11px]', done ? 'text-emerald-600' : 'text-midnight-500')}>
                      {busy ? '...' : done ? 'Done!' : formatTime(slot.time)}
                    </span>
                  </span>
                  {done && <Check size={16} strokeWidth={3} className="text-emerald-500" />}
                </button>
              );
            })}

            {whenever.map((care) => {
              const count = (care.doses || []).filter(
                (d) => !d.deletedAt && d.status === 'GIVEN' && sameDay(new Date(d.scheduledFor), day)
              ).length;
              const busy = busyKeys.has(`prn-${care.id}`);
              return (
                <div
                  key={care.id}
                  className={cn(
                    'flex items-stretch rounded-2xl border-2 overflow-hidden transition-colors',
                    count > 0 ? 'bg-flash-50 border-flash-300' : 'bg-white border-midnight-200 hover:border-flash-400'
                  )}
                >
                  <button
                    onClick={() => interactive && !busy && logPrn(care)}
                    disabled={!interactive || busy}
                    title={!interactive ? undefined : count > 0 ? `Log another ${care.name}` : `Log ${care.name}`}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 text-left active:scale-95 transition-transform"
                  >
                    <CareIconChip name={care.name} color={care.color} size="sm" />
                    <span>
                      <span className="block text-sm font-bold text-midnight-900">{care.name}</span>
                      <span className="block text-[11px] text-midnight-500">
                        {busy ? '...' : count > 0 ? `x${count} today` : readOnly ? 'Whenever' : 'Tap when it happens'}
                      </span>
                    </span>
                  </button>
                  {interactive && count > 0 && (
                    <button
                      onClick={() => !busy && undoPrn(care)}
                      disabled={busy}
                      aria-label={`Undo last ${care.name}`}
                      title="Undo last"
                      className="shrink-0 px-3 border-l border-flash-300/70 text-midnight-400 hover:text-midnight-900 hover:bg-flash-100/60 transition-colors flex items-center"
                    >
                      <Undo2 size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
