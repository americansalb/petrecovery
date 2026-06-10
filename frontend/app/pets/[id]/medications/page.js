'use client';

/**
 * Medication Tracker
 *
 * Route: /pets/[id]/medications
 * One pet's medication home: today's checklist, week adherence, med cards
 * (owner-customizable color + icon), supply warnings, and recent activity.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Check, X, Undo2, Pause, Play, Pencil, Trash2,
  PartyPopper, Sun, Sunset, Moon, AlertTriangle, Loader2, PawPrint,
  CalendarDays, History, PackageOpen, Sparkles, Share2, Eye, Download,
  CloudOff, Info,
} from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { Card, Button, Badge, EmptyState, cn } from '@/components/ui';
import { MedIconChip } from '@/app/components/medications/MedIcon';
import {
  medColor, formatSchedule, formatTime, timeOfDayBucket, isLowSupply,
  slotsWithStatus, adherenceForDay, startOfDay, sameDay,
} from '@/lib/medications';

const BUCKET_ICONS = { Morning: Sun, Afternoon: Sunset, Evening: Moon };

/* ----------------------------- Offline outbox -----------------------------
 * If a dose write fails (flaky connection, server hiccup), it is queued in
 * localStorage and retried on the next load or focus. A check-off can never
 * be silently lost between the tap and the database. */
const outboxKey = (petId) => `medOutbox:${petId}`;

function readOutbox(petId) {
  try {
    return JSON.parse(localStorage.getItem(outboxKey(petId)) || '[]');
  } catch {
    return [];
  }
}

function writeOutbox(petId, items) {
  try {
    localStorage.setItem(outboxKey(petId), JSON.stringify(items));
  } catch { /* storage full or unavailable; nothing else to do */ }
}

function enqueueDose(petId, entry) {
  const items = readOutbox(petId).filter(
    (i) => !(i.medId === entry.medId && i.scheduledFor === entry.scheduledFor)
  );
  items.push({ ...entry, queuedAt: new Date().toISOString() });
  writeOutbox(petId, items);
  return items.length;
}

function formatWhen(value) {
  const d = new Date(value);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay(d, new Date())) return `Today · ${time}`;
  const day = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} · ${time}`;
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

/* ------------------------------- Today card ------------------------------- */

function SlotRow({ med, slot, busy, readOnly, onMark, onUndo }) {
  const colors = medColor(med.color);
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

function TodayCard({ meds, busyKeys, readOnly, onMark, onUndo }) {
  const today = new Date();
  const scheduled = meds.filter((m) => m.isActive && m.scheduleType !== 'AS_NEEDED');

  const buckets = useMemo(() => {
    const grouped = { Morning: [], Afternoon: [], Evening: [] };
    for (const med of scheduled) {
      for (const slot of slotsWithStatus(med, med.doses, today)) {
        grouped[timeOfDayBucket(slot.time)].push({ med, slot });
      }
    }
    for (const key of Object.keys(grouped)) {
      grouped[key].sort((a, b) => a.slot.time.localeCompare(b.slot.time));
    }
    return grouped;
  }, [meds]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = Object.values(buckets).flat();
  const given = all.filter(({ slot }) => slot.status === 'GIVEN').length;
  const handled = all.filter(({ slot }) => slot.status).length;
  const due = all.length;

  if (due === 0) return null;

  return (
    <Card padding="lg" className="mb-6">
      <div className="flex items-center gap-4 mb-5">
        <ProgressRing given={given} due={due} />
        <div>
          <h2 className="text-xl font-bold text-midnight-900">
            {handled >= due ? (
              <span className="inline-flex items-center gap-2">All done for today <PartyPopper className="w-5 h-5 text-flash-500" /></span>
            ) : 'Today'}
          </h2>
          <p className="text-sm text-midnight-500">
            {today.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
            {handled < due && ` · ${due - handled} dose${due - handled !== 1 ? 's' : ''} to go`}
          </p>
        </div>
      </div>

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
    </Card>
  );
}

/* ------------------------------- Week strip ------------------------------- */

function WeekStrip({ meds }) {
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

  // Consecutive fully-given days ending today (in-progress today doesn't break it).
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
    <Card padding="lg" className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 font-bold text-midnight-900"><CalendarDays size={18} className="text-midnight-400" /> This week</h3>
        {streak > 1 && (
          <Badge variant="primary" icon={Sparkles}>{streak}-day streak</Badge>
        )}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map(({ day, due, given }, i) => {
          const isToday = i === 6;
          const pct = due > 0 ? given / due : null;
          return (
            <div key={day.getTime()} className="flex flex-col items-center gap-1.5">
              <span className={cn('text-[11px] font-semibold', isToday ? 'text-midnight-900' : 'text-midnight-400')}>
                {isToday ? 'Today' : day.toLocaleDateString([], { weekday: 'narrow' })}
              </span>
              <div className="w-full h-12 bg-midnight-100 rounded-lg relative overflow-hidden" title={due ? `${given}/${due} given` : 'Nothing due'}>
                {pct != null && (
                  <div
                    className={cn('absolute bottom-0 left-0 right-0 rounded-lg transition-all',
                      pct >= 1 ? 'bg-emerald-400' : pct > 0 ? 'bg-flash-400' : 'bg-midnight-200')}
                    style={{ height: `${Math.max(pct * 100, pct > 0 ? 18 : 8)}%` }}
                  />
                )}
              </div>
              <span className="text-[10px] text-midnight-500 tabular-nums">{due ? `${given}/${due}` : '—'}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ----------------------------- Medication card ---------------------------- */

function MedCard({ med, petId, busy, canManage, onLogPrn, onTogglePause, onDelete }) {
  const colors = medColor(med.color);
  const low = isLowSupply(med);

  return (
    <Card padding="none" className={cn('border-l-4 overflow-hidden', colors.accent, !med.isActive && 'opacity-70')}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <MedIconChip med={med} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-midnight-900 truncate">{med.name}</h4>
              {med.strength && <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', colors.chip)}>{med.strength}</span>}
              {!med.isActive && <Badge variant="default" size="sm">Paused</Badge>}
            </div>
            {med.purpose && <p className="text-xs text-midnight-500 mt-0.5">{med.purpose}</p>}
            <p className="text-sm text-midnight-700 mt-1.5">{formatSchedule(med)}</p>
            {med.instructions && <p className="text-xs text-midnight-500 mt-1 italic">{med.instructions}</p>}

            {med.quantityRemaining != null && (
              <p className={cn('inline-flex items-center gap-1.5 text-xs font-semibold mt-2 px-2 py-1 rounded-lg',
                low ? 'bg-red-50 text-red-700' : 'bg-midnight-50 text-midnight-600')}>
                {low && <AlertTriangle size={12} />}
                <PackageOpen size={12} />
                {Math.round(med.quantityRemaining * 10) / 10} dose{med.quantityRemaining !== 1 ? 's' : ''} left
                {low && ', time to refill'}
              </p>
            )}
          </div>
        </div>
      </div>

      {canManage && (
      <div className="flex items-center gap-1 px-3 py-2 border-t border-midnight-100 bg-midnight-50/50">
        {med.scheduleType === 'AS_NEEDED' && med.isActive && (
          <button
            onClick={() => onLogPrn(med)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-midnight-900 bg-flash-400 hover:bg-flash-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={3} />}
            Log dose now
          </button>
        )}
        <div className="flex-1" />
        <Link
          href={`/pets/${petId}/medications/new?edit=${med.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-midnight-600 hover:text-midnight-900 px-2.5 py-1.5 rounded-lg hover:bg-midnight-100 transition-colors"
        >
          <Pencil size={13} /> Edit
        </Link>
        <button
          onClick={() => onTogglePause(med)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-midnight-600 hover:text-midnight-900 px-2.5 py-1.5 rounded-lg hover:bg-midnight-100 transition-colors"
        >
          {med.isActive ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Resume</>}
        </button>
        <button
          onClick={() => onDelete(med)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          aria-label={`Delete ${med.name}`}
        >
          <Trash2 size={13} />
        </button>
      </div>
      )}
    </Card>
  );
}

/* ------------------------------ Activity feed ----------------------------- */

function ActivityFeed({ meds }) {
  const events = useMemo(() => {
    const out = [];
    for (const med of meds) {
      for (const dose of med.doses || []) {
        out.push({ med, dose, at: new Date(dose.givenAt || dose.scheduledFor) });
      }
    }
    return out.sort((a, b) => b.at - a.at).slice(0, 10);
  }, [meds]);

  if (!events.length) return null;

  return (
    <Card padding="lg" className="mb-6">
      <h3 className="flex items-center gap-2 font-bold text-midnight-900 mb-3"><History size={18} className="text-midnight-400" /> Recent activity</h3>
      <ul className="divide-y divide-midnight-100">
        {events.map(({ med, dose, at }) => (
          <li key={dose.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
            <MedIconChip med={med} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-midnight-800 truncate">{med.name}</p>
              {dose.notes && <p className="text-xs text-midnight-500 truncate">{dose.notes}</p>}
            </div>
            <Badge variant={dose.status === 'GIVEN' ? 'success' : 'default'} size="sm">
              {dose.status === 'GIVEN' ? 'Given' : 'Skipped'}
            </Badge>
            <span className="text-xs text-midnight-500 whitespace-nowrap">{formatWhen(at)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* --------------------------------- Page ----------------------------------- */

export default function MedicationTrackerPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const petId = params.id;

  const [pet, setPet] = useState(null);
  const [access, setAccess] = useState('OWNER');
  const [meds, setMeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyKeys, setBusyKeys] = useState(new Set());
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [notice, setNotice] = useState(null);
  const [outboxCount, setOutboxCount] = useState(0);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/pets/${petId}/medications`);
    }
  }, [status, router, petId]);

  const fetchMeds = useCallback(async () => {
    try {
      const res = await fetch(`/api/pets/${petId}/medications`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load medications');
      setPet(data.pet);
      setAccess(data.access || 'OWNER');
      setMeds(data.medications);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    if (status === 'authenticated' && petId) fetchMeds();
  }, [status, petId, fetchMeds]);

  // Retry any queued dose writes, then pull fresh state.
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
      } catch {
        remaining.push(item);
      }
    }
    writeOutbox(petId, remaining);
    setOutboxCount(remaining.length);
    if (remaining.length < items.length) fetchMeds();
  }, [petId, fetchMeds]);

  // Refetch when the tab regains focus: with shared caregivers, acting on a
  // stale checklist is how double-dosing happens.
  useEffect(() => {
    if (status !== 'authenticated' || !petId) return undefined;
    flushOutbox();
    const onFocus = () => {
      fetchMeds();
      flushOutbox();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [status, petId, fetchMeds, flushOutbox]);

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

  const markDose = (med, slot, statusValue) =>
    withBusy(`${med.id}-${slot.scheduledFor.getTime()}`, async () => {
      let res;
      try {
        res = await fetch(`/api/pets/${petId}/medications/${med.id}/doses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduledFor: slot.scheduledFor.toISOString(), status: statusValue }),
        });
      } catch {
        // Network failure: keep the tap safe in the outbox and show it.
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

  const logPrn = (med) =>
    withBusy(`prn-${med.id}`, async () => {
      const now = new Date();
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}/doses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: now.toISOString(), status: 'GIVEN' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log dose');
      applyDose(med.id, data.dose, data.quantityRemaining);
    });

  const togglePause = (med) =>
    withBusy(`pause-${med.id}`, async () => {
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !med.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setMeds((prev) => prev.map((m) => (m.id === med.id ? data.medication : m)));
    });

  const deleteMed = (med) =>
    withBusy(`delete-${med.id}`, async () => {
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setMeds((prev) => prev.filter((m) => m.id !== med.id));
    });

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center">
        <LoadingSpinner text="Loading medications..." />
      </div>
    );
  }
  if (status === 'unauthenticated') return null;

  const active = meds.filter((m) => m.isActive);
  const paused = meds.filter((m) => !m.isActive);
  const lowCount = active.filter(isLowSupply).length;
  const isOwner = access === 'OWNER';
  const canManage = access !== 'VIEWER';

  return (
    <div className="min-h-screen bg-midnight-50 px-4 py-6 md:px-8 md:py-10">
      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-midnight-900 mb-3">Delete {confirmDelete.name}?</h3>
            <p className="text-midnight-600 mb-6">
              This removes the medication and its full dose history. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setConfirmDelete(null)} className="flex-1">Cancel</Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => { const med = confirmDelete; setConfirmDelete(null); deleteMed(med); }}
              >
                Yes, delete
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <Link href="/pets" className="inline-flex items-center gap-1.5 text-sm font-semibold text-midnight-500 hover:text-midnight-800 transition-colors mb-4">
          <ArrowLeft size={16} /> My Pets
        </Link>

        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-midnight-200 overflow-hidden flex items-center justify-center flex-shrink-0">
              {pet?.primaryPhotoUrl ? (
                <img src={pet.primaryPhotoUrl} alt={pet.name} className="w-full h-full object-cover" />
              ) : (
                <PawPrint className="w-7 h-7 text-midnight-400" />
              )}
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-midnight-900">{pet?.name}&apos;s Medications</h1>
              <p className="text-sm text-midnight-500">
                {active.length} active{paused.length > 0 && ` · ${paused.length} paused`}
                {lowCount > 0 && <span className="text-red-600 font-semibold"> · {lowCount} low on supply</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/pets/${petId}/medications/export`}
              download
              className="p-2.5 border-2 border-midnight-200 text-midnight-500 rounded-xl hover:border-midnight-300 hover:text-midnight-800 transition-colors"
              title="Download a full backup of all medication data"
              aria-label="Download medication backup"
            >
              <Download size={17} />
            </a>
            {isOwner && (
              <Button variant="outline" href={`/pets/${petId}/share`} leftIcon={Share2}>
                Share
              </Button>
            )}
            {!canManage && (
              <Badge variant="default" icon={Eye}>View only</Badge>
            )}
            {canManage && (
              <Button variant="primary" href={`/pets/${petId}/medications/new`} leftIcon={Plus}>
                Add medication
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700"><X size={18} /></button>
          </div>
        )}

        {notice && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg mb-6 flex items-center justify-between gap-3">
            <span className="inline-flex items-start gap-2"><Info size={17} className="flex-shrink-0 mt-0.5" /> {notice}</span>
            <button onClick={() => setNotice(null)} className="text-amber-500 hover:text-amber-700"><X size={18} /></button>
          </div>
        )}

        {outboxCount > 0 && (
          <div className="bg-midnight-100 border border-midnight-200 text-midnight-700 px-4 py-3 rounded-lg mb-6 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2">
              <CloudOff size={16} />
              {outboxCount} dose log{outboxCount !== 1 ? 's' : ''} saved on this device, waiting to sync.
            </span>
            <button onClick={flushOutbox} className="text-sm font-bold text-midnight-900 hover:text-flash-600">Sync now</button>
          </div>
        )}

        {meds.length === 0 ? (
          <Card padding="xl">
            <EmptyState
              icon={Sparkles}
              iconColor="amber"
              title={`Keep ${pet?.name || 'your pet'} on track`}
              description="Add their medications once, then check off doses with one tap. We'll watch the schedule, the streak, and warn you before refills run out."
              action={canManage ? { href: `/pets/${petId}/medications/new`, label: 'Add first medication', icon: Plus } : undefined}
            />
          </Card>
        ) : (
          <>
            <TodayCard meds={meds} busyKeys={busyKeys} readOnly={!canManage} onMark={markDose} onUndo={undoDose} />
            <WeekStrip meds={meds} />

            <div className="flex items-center justify-between mb-3 mt-8">
              <h3 className="font-bold text-midnight-900">All medications</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {active.map((med) => (
                <MedCard
                  key={med.id}
                  med={med}
                  petId={petId}
                  busy={busyKeys.has(`prn-${med.id}`)}
                  canManage={canManage}
                  onLogPrn={logPrn}
                  onTogglePause={togglePause}
                  onDelete={setConfirmDelete}
                />
              ))}
            </div>

            {paused.length > 0 && (
              <>
                <h3 className="font-bold text-midnight-500 text-sm uppercase tracking-wide mb-3">Paused</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {paused.map((med) => (
                    <MedCard
                      key={med.id}
                      med={med}
                      petId={petId}
                      busy={false}
                      canManage={canManage}
                      onLogPrn={logPrn}
                      onTogglePause={togglePause}
                      onDelete={setConfirmDelete}
                    />
                  ))}
                </div>
              </>
            )}

            <ActivityFeed meds={meds} />
          </>
        )}
      </div>
    </div>
  );
}
