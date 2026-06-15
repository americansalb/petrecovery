'use client';

/**
 * CareToday - the daily dose checklist, extracted so it can live inside
 * the one pet dashboard (and anywhere a "log today's meds" surface is
 * wanted). It owns dose mutations and the offline outbox, but NOT the
 * fetch: the dashboard loads medications once and passes meds + setMeds
 * down, so Today and the Health Book sections share one source of truth.
 *
 * Lifted from the former /pets/[id]/today page; behavior is unchanged
 * (mark / skip / undo, morning-afternoon-evening buckets, week strip,
 * streak, past-day backfill, offline queue).
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Check, X, Undo2, PartyPopper, Sun, Sunset, Moon, Loader2,
  CalendarDays, Sparkles, CloudOff, Info,
} from 'lucide-react';
import { Card, Button, Badge, cn } from '@/components/ui';
import { MedIconChip } from '@/app/components/medications/MedIcon';
import {
  medColor, formatTime, timeOfDayBucket, isLowSupply,
  slotsWithStatus, adherenceForDay, startOfDay, sameDay,
} from '@/lib/medications';

const BUCKET_ICONS = { Morning: Sun, Afternoon: Sunset, Evening: Moon };

/* ----------------------------- Offline outbox ----------------------------- */
const outboxKey = (petId) => `medOutbox:${petId}`;

function readOutbox(petId) {
  try { return JSON.parse(localStorage.getItem(outboxKey(petId)) || '[]'); }
  catch { return []; }
}
function writeOutbox(petId, items) {
  try { localStorage.setItem(outboxKey(petId), JSON.stringify(items)); }
  catch { /* storage full or unavailable */ }
}
function enqueueDose(petId, entry) {
  const items = readOutbox(petId).filter(
    (i) => !(i.medId === entry.medId && i.scheduledFor === entry.scheduledFor)
  );
  items.push({ ...entry, queuedAt: new Date().toISOString() });
  writeOutbox(petId, items);
  return items.length;
}

/* ------------------------------ Progress ring ----------------------------- */
function ProgressRing({ given, due }) {
  const pct = due > 0 ? given / due : 0;
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-20 h-20 flex-shrink-0" role="img" aria-label={`${given} of ${due} doses given today`}>
      <svg viewBox="0 0 72 72" className="w-20 h-20 -rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" className="stroke-midnight-100" />
        <circle
          cx="36" cy="36" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          className={cn('transition-all duration-500', pct >= 1 ? 'stroke-emerald-500' : 'stroke-flash-400')}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-midnight-900 leading-none">{given}<span className="text-midnight-400 text-sm">/{due}</span></span>
        <span className="text-[10px] text-midnight-500 mt-0.5">doses</span>
      </div>
    </div>
  );
}

function SlotRow({ med, slot, busy, readOnly, onMark, onUndo }) {
  const given = slot.status === 'GIVEN';
  const skipped = slot.status === 'SKIPPED';
  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
      given ? 'bg-emerald-50/70 border-emerald-200' : skipped ? 'bg-midnight-50 border-midnight-200' : 'bg-white border-midnight-200'
    )}>
      <MedIconChip med={med} size="sm" />
      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold text-sm text-midnight-900 truncate', skipped && 'line-through text-midnight-400')}>
          {med.name}
          {med.strength && <span className="font-normal text-midnight-500"> · {med.strength}</span>}
        </p>
        <p className="text-xs text-midnight-500">
          {given && slot.dose?.givenAt
            ? `Given at ${new Date(slot.dose.givenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
            : skipped ? 'Skipped' : `Due ${formatTime(slot.time)}`}
        </p>
      </div>
      {busy ? (
        <Loader2 className="w-5 h-5 animate-spin text-midnight-400 mr-1" />
      ) : readOnly ? (
        (given || skipped) && (
          <span className={cn('text-xs font-bold px-2 py-1 rounded-full', given ? 'bg-emerald-100 text-emerald-700' : 'bg-midnight-100 text-midnight-500')}>
            {given ? 'Given' : 'Skipped'}
          </span>
        )
      ) : given || skipped ? (
        <button
          onClick={() => onUndo(med, slot)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-midnight-500 hover:text-midnight-800 px-2 py-1.5 rounded-lg hover:bg-midnight-100 transition-colors"
          title="Undo"
        >
          <Undo2 size={14} /> Undo
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onMark(med, slot, 'SKIPPED')}
            className="p-2 rounded-full text-midnight-400 hover:text-midnight-700 hover:bg-midnight-100 transition-colors"
            title={`Skip ${med.name}`}
            aria-label={`Skip ${med.name} ${formatTime(slot.time)}`}
          >
            <X size={16} />
          </button>
          <button
            onClick={() => onMark(med, slot, 'GIVEN')}
            className={cn(
              'w-9 h-9 rounded-full border-2 border-midnight-300 text-transparent',
              'hover:border-emerald-500 hover:bg-emerald-500 hover:text-white',
              'flex items-center justify-center transition-all duration-150 active:scale-90'
            )}
            title={`Mark ${med.name} given`}
            aria-label={`Mark ${med.name} ${formatTime(slot.time)} as given`}
          >
            <Check size={18} strokeWidth={3} />
          </button>
        </div>
      )}
    </div>
  );
}

function DayCard({ meds, day, busyKeys, readOnly, onMark, onUndo, onLogPrnFor, onBackToToday }) {
  const isToday = sameDay(day, new Date());
  const scheduled = meds.filter((m) => m.isActive && m.scheduleType !== 'AS_NEEDED');
  const asNeeded = meds.filter((m) => m.isActive && m.scheduleType === 'AS_NEEDED');

  const buckets = useMemo(() => {
    const grouped = { Morning: [], Afternoon: [], Evening: [] };
    for (const med of scheduled) {
      for (const slot of slotsWithStatus(med, med.doses, day)) {
        grouped[timeOfDayBucket(slot.time)].push({ med, slot });
      }
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.slot.time.localeCompare(b.slot.time));
    }
    return grouped;
  }, [meds, day]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = Object.values(buckets).flat();
  const given = all.filter(({ slot }) => slot.status === 'GIVEN').length;
  const handled = all.filter(({ slot }) => slot.status).length;
  const due = all.length;

  if (due === 0 && isToday) return null;
  const dayLabel = day.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <Card padding="lg" className="mb-4">
      <div className="flex items-center gap-4 mb-5">
        <ProgressRing given={given} due={due} />
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-bold text-midnight-900">
            {isToday ? (
              handled >= due ? (
                <span className="inline-flex items-center gap-2">All done for today <PartyPopper className="w-5 h-5 text-flash-500" /></span>
              ) : 'Doses today'
            ) : dayLabel}
          </h3>
          <p className="text-sm text-midnight-500">
            {isToday
              ? `${dayLabel}${handled < due ? ` · ${due - handled} dose${due - handled !== 1 ? 's' : ''} to go` : ''}`
              : 'Catching up the record. Past doses go straight into the history.'}
          </p>
        </div>
        {!isToday && (
          <button
            onClick={onBackToToday}
            className="text-xs font-bold text-midnight-500 hover:text-midnight-900 px-3 py-1.5 rounded-lg border border-midnight-200 hover:border-midnight-400 transition-colors whitespace-nowrap"
          >
            Back to today
          </button>
        )}
      </div>

      {due === 0 ? (
        <p className="text-sm text-midnight-500 mb-1">Nothing was on the schedule this day.</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(buckets).map(([bucket, items]) => {
            if (!items.length) return null;
            const BucketIcon = BUCKET_ICONS[bucket];
            return (
              <div key={bucket}>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-midnight-400 mb-2">
                  <BucketIcon size={14} /> {bucket}
                </p>
                <div className="space-y-2">
                  {items.map(({ med, slot }) => (
                    <SlotRow
                      key={`${med.id}-${slot.time}`}
                      med={med}
                      slot={slot}
                      busy={busyKeys.has(`${med.id}-${slot.scheduledFor.getTime()}`)}
                      readOnly={readOnly}
                      onMark={onMark}
                      onUndo={onUndo}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isToday && !readOnly && asNeeded.length > 0 && (
        <div className="mt-5 pt-4 border-t border-midnight-100">
          <p className="text-xs font-bold uppercase tracking-wide text-midnight-400 mb-2">As needed</p>
          <div className="space-y-2">
            {asNeeded.map((med) => {
              const dayDose = (med.doses || []).find((d) => !d.deletedAt && sameDay(new Date(d.scheduledFor), day));
              return (
                <div key={med.id} className="flex items-center gap-3 rounded-xl border border-midnight-200 bg-white px-3 py-2.5">
                  <MedIconChip med={med} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-midnight-900 truncate">
                      {med.name}
                      {med.strength && <span className="font-normal text-midnight-500"> · {med.strength}</span>}
                    </p>
                    <p className="text-xs text-midnight-500">{dayDose ? 'Logged for this day' : 'Not logged this day'}</p>
                  </div>
                  {!dayDose && (
                    <button
                      onClick={() => onLogPrnFor(med, day)}
                      disabled={busyKeys.has(`prn-${med.id}`)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-midnight-900 bg-flash-400 hover:bg-flash-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Check size={13} strokeWidth={3} /> Log a dose this day
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

function WeekStrip({ meds, selectedDay, onSelectDay }) {
  const scheduled = meds.filter((m) => m.scheduleType !== 'AS_NEEDED');
  const days = useMemo(() => {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const day = startOfDay(new Date(Date.now() - i * 86400000));
      let due = 0; let given = 0;
      for (const med of scheduled) {
        const a = adherenceForDay(med, med.doses, day);
        due += a.due; given += a.given;
      }
      out.push({ day, due, given });
    }
    return out;
  }, [meds]); // eslint-disable-line react-hooks/exhaustive-deps

  const streak = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 35; i++) {
      const day = startOfDay(new Date(Date.now() - i * 86400000));
      let due = 0; let given = 0;
      for (const med of scheduled) {
        const a = adherenceForDay(med, med.doses, day);
        due += a.due; given += a.given;
      }
      if (due === 0) continue;
      if (given >= due) count++;
      else if (i === 0) continue;
      else break;
    }
    return count;
  }, [meds]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!days.some((d) => d.due > 0)) return null;

  return (
    <Card padding="lg" className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="flex items-center gap-2 font-bold text-midnight-900"><CalendarDays size={18} className="text-midnight-400" /> This week</h3>
        {streak > 1 && <Badge variant="primary" icon={Sparkles}>{streak}-day streak</Badge>}
      </div>
      <p className="text-xs text-midnight-400 mb-4">
        {days.slice(0, 6).every((d) => d.due === 0)
          ? 'History starts today. It fills in as you check off doses.'
          : 'Tap a day to review it or log doses you gave but did not record.'}
      </p>
      <div className="grid grid-cols-7 gap-2">
        {days.map(({ day, due, given }, i) => {
          const isToday = i === 6;
          const isSelected = selectedDay && sameDay(day, selectedDay);
          const pct = due > 0 ? given / due : null;
          return (
            <button
              key={day.getTime()}
              type="button"
              onClick={() => onSelectDay?.(day)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-xl p-1 -m-1 transition-all',
                isSelected ? 'ring-2 ring-flash-400 bg-flash-50' : 'hover:bg-midnight-50'
              )}
              aria-label={`${day.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}: ${due ? `${given} of ${due} given` : 'nothing due'}. Tap to review or log.`}
              aria-pressed={isSelected}
            >
              <span className="flex flex-col items-center leading-tight">
                <span className={cn('text-[11px] font-semibold', isToday || isSelected ? 'text-midnight-900' : 'text-midnight-400')}>
                  {isToday ? 'Today' : day.toLocaleDateString([], { weekday: 'short' }).slice(0, 2)}
                </span>
                <span className={cn('text-[10px] tabular-nums', isToday || isSelected ? 'text-midnight-500' : 'text-midnight-400')}>
                  {day.getDate()}
                </span>
              </span>
              <div
                className={cn('w-full h-12 rounded-lg relative overflow-hidden', due ? 'bg-midnight-100' : 'bg-transparent')}
                title={due ? `${given}/${due} given` : 'Nothing scheduled'}
              >
                {pct != null ? (
                  <div
                    className={cn('absolute bottom-0 left-0 right-0 rounded-lg transition-all',
                      pct >= 1 ? 'bg-emerald-400' : pct > 0 ? 'bg-flash-400' : 'bg-midnight-200')}
                    style={{ height: `${Math.max(pct * 100, pct > 0 ? 18 : 8)}%` }}
                  />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-midnight-200 text-lg leading-none">·</span>
                )}
              </div>
              <span className={cn('text-[10px] tabular-nums', due ? 'text-midnight-500' : 'text-transparent')}>{due ? `${given}/${due}` : '·'}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* --------------------------------- CareToday ------------------------------- */

export default function CareToday({ petId, meds, setMeds, canManage }) {
  const [busyKeys, setBusyKeys] = useState(new Set());
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [outboxCount, setOutboxCount] = useState(0);
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));

  const withBusy = async (key, fn) => {
    setBusyKeys((prev) => new Set(prev).add(key));
    try { await fn(); }
    catch (err) { setError(err.message); }
    finally {
      setBusyKeys((prev) => { const next = new Set(prev); next.delete(key); return next; });
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

  const flushOutbox = useCallback(async () => {
    const items = readOutbox(petId);
    setOutboxCount(items.length);
    if (!items.length) return;
    const remaining = [];
    for (const item of items) {
      try {
        const res = await fetch(`/api/pets/${petId}/medications/${item.medId}/doses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduledFor: item.scheduledFor, status: item.status }),
        });
        if (!res.ok && res.status !== 409) remaining.push(item);
      } catch { remaining.push(item); }
    }
    writeOutbox(petId, remaining);
    setOutboxCount(remaining.length);
  }, [petId]);

  useEffect(() => { flushOutbox(); }, [flushOutbox]);

  const markDose = (med, slot, statusValue) =>
    withBusy(`${med.id}-${slot.scheduledFor.getTime()}`, async () => {
      const isBackfill = !sameDay(slot.scheduledFor, new Date()) && slot.scheduledFor < new Date();
      const payload = {
        scheduledFor: slot.scheduledFor.toISOString(),
        status: statusValue,
        ...(statusValue === 'GIVEN' && isBackfill ? { givenAt: slot.scheduledFor.toISOString() } : {}),
      };
      let res;
      try {
        res = await fetch(`/api/pets/${petId}/medications/${med.id}/doses`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
      } catch {
        const count = enqueueDose(petId, { medId: med.id, scheduledFor: slot.scheduledFor.toISOString(), status: statusValue });
        setOutboxCount(count);
        setNotice("You're offline. That dose is saved on this device and will sync automatically.");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log dose');
      if (data.alreadyLogged) {
        const at = data.dose.givenAt ? new Date(data.dose.givenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
        setNotice(`Heads up: this dose was already logged${at ? ` at ${at}` : ''}, likely by another caregiver. Nothing was double-counted.`);
      }
      applyDose(med.id, data.dose, data.quantityRemaining);
    });

  const undoDose = (med, slot) =>
    withBusy(`${med.id}-${slot.scheduledFor.getTime()}`, async () => {
      const res = await fetch(
        `/api/pets/${petId}/medications/${med.id}/doses?scheduledFor=${encodeURIComponent(slot.scheduledFor.toISOString())}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to undo');
      applyDose(med.id, { scheduledFor: slot.scheduledFor.toISOString() }, data.quantityRemaining, true);
    });

  const logPrnFor = (med, day) =>
    withBusy(`prn-${med.id}`, async () => {
      const when = new Date(day);
      when.setHours(12, 0, 0, 0);
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}/doses`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: when.toISOString(), status: 'GIVEN', givenAt: when.toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log dose');
      applyDose(med.id, data.dose, data.quantityRemaining);
    });

  const medItems = meds.filter((m) => m.kind !== 'CARE');
  const active = medItems.filter((m) => m.isActive);
  const lowCount = active.filter(isLowSupply).length;

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700"><X size={18} /></button>
        </div>
      )}
      {notice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg mb-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-start gap-2"><Info size={17} className="flex-shrink-0 mt-0.5" /> {notice}</span>
          <button onClick={() => setNotice(null)} className="text-amber-500 hover:text-amber-700"><X size={18} /></button>
        </div>
      )}
      {outboxCount > 0 && (
        <div className="bg-midnight-100 border border-midnight-200 text-midnight-700 px-4 py-3 rounded-lg mb-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <CloudOff size={16} /> {outboxCount} dose log{outboxCount !== 1 ? 's' : ''} saved on this device, waiting to sync.
          </span>
          <button onClick={flushOutbox} className="text-sm font-bold text-midnight-900 hover:text-flash-600">Sync now</button>
        </div>
      )}

      {medItems.length === 0 ? (
        <Card padding="lg" className="border-dashed">
          <div className="flex items-center gap-4">
            <span className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><Sparkles size={22} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-midnight-900">No medications yet</p>
              <p className="text-sm text-midnight-500">Add one and check off doses with a tap. We&rsquo;ll watch the schedule and warn you before refills run out.</p>
            </div>
            {canManage && <Button variant="outline" size="sm" href={`/pets/${petId}/medications/new`} leftIcon={Plus}>Add</Button>}
          </div>
        </Card>
      ) : (
        <>
          {lowCount > 0 && (
            <p className="text-sm text-red-600 font-semibold mb-3">{lowCount} medication{lowCount !== 1 ? 's' : ''} low on supply, see the Health Book section below.</p>
          )}
          <DayCard
            meds={medItems}
            day={selectedDay}
            busyKeys={busyKeys}
            readOnly={!canManage}
            onMark={markDose}
            onUndo={undoDose}
            onLogPrnFor={logPrnFor}
            onBackToToday={() => setSelectedDay(startOfDay(new Date()))}
          />
          <WeekStrip meds={medItems} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
        </>
      )}
    </div>
  );
}
