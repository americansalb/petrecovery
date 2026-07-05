'use client';

/**
 * Today - the rhythm surface (docs/PRODUCT_IA_PLAN.md §3)
 *
 * Route: /pets/[id]/today
 * The ONE place anyone taps "done": scheduled doses, as-needed doses
 * (log-now, count, undo), past-day catch-up, and care routines — all of
 * it, nothing else. Management and history live in the Health Book;
 * nothing here is reference material.
 *
 * The checklist itself (DayChecklist/WeekStrip) is shared with the
 * public care view; this page owns the write path — including the
 * offline outbox, so a check-off can never be silently lost between
 * the tap and the database.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, X, Sparkles, CloudOff, Info } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { Sheet } from '@/app/components/care/paper/Paper';
import GoodStuff from '@/app/components/care/GoodStuff';
import { DayChecklist } from '@/app/components/care/DoseChecklist';
import WeekStrip from '@/app/components/care/WeekStrip';
import { isLowSupply, startOfDay, sameDay } from '@/lib/medications';

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
    return true;
  } catch {
    // Storage full/blocked/private-mode. The caller MUST surface this; we
    // never let a dose look saved when the device couldn't store it.
    return false;
  }
}

function enqueueDose(petId, entry) {
  const items = readOutbox(petId).filter(
    (i) => !(i.medId === entry.medId && i.scheduledFor === entry.scheduledFor)
  );
  items.push({ ...entry, queuedAt: new Date().toISOString() });
  const ok = writeOutbox(petId, items);
  // count reflects what is actually persisted: on a failed write, re-read the
  // unchanged store so we never report a dose as queued when it wasn't.
  return { ok, count: ok ? items.length : readOutbox(petId).length };
}

/* --------------------------------- Page ----------------------------------- */

export default function TodayPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const petId = params.id;

  const [access, setAccess] = useState('OWNER');
  const [meds, setMeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyKeys, setBusyKeys] = useState(new Set());
  const [notice, setNotice] = useState(null);
  const [outboxCount, setOutboxCount] = useState(0);
  // Which day the checklist shows. Today by default; tapping a day in the
  // week strip rewinds it so missed documentation can be caught up.
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/pets/${petId}/today`);
    }
  }, [status, router, petId]);

  const fetchMeds = useCallback(async () => {
    try {
      const res = await fetch(`/api/pets/${petId}/medications`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load medications');
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
          body: JSON.stringify({ scheduledFor: item.scheduledFor, slotKey: item.slotKey, status: item.status }),
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
      // Identify the slot's row by slotKey when both have one, else by instant,
      // so a cross-timezone update replaces the right local row, never doubles.
      const sameSlot = (d) =>
        (dose.slotKey && d.slotKey)
          ? d.slotKey === dose.slotKey
          : new Date(d.scheduledFor).getTime() === new Date(dose.scheduledFor).getTime();
      const doses = (m.doses || []).filter((d) => !sameSlot(d));
      if (!removed) doses.unshift(dose);
      return { ...m, doses, quantityRemaining: quantityRemaining !== undefined ? quantityRemaining : m.quantityRemaining };
    }));
  };

  const markDose = (med, slot, statusValue) =>
    withBusy(`${med.id}-${slot.scheduledFor.getTime()}`, async () => {
      // Backfilled doses record the slot's own time as givenAt, so the
      // history says when the dose actually happened, not when it was typed.
      const isBackfill = !sameDay(slot.scheduledFor, new Date()) && slot.scheduledFor < new Date();
      const payload = {
        scheduledFor: slot.scheduledFor.toISOString(),
        slotKey: slot.slotKey,
        status: statusValue,
        ...(statusValue === 'GIVEN' && isBackfill ? { givenAt: slot.scheduledFor.toISOString() } : {}),
      };
      let res;
      try {
        res = await fetch(`/api/pets/${petId}/medications/${med.id}/doses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        // Network failure: queue the tap on the device and retry on next load.
        // If the device itself can't store it, NEVER claim it was saved.
        const { ok, count } = enqueueDose(petId, { medId: med.id, scheduledFor: slot.scheduledFor.toISOString(), slotKey: slot.slotKey, status: statusValue });
        setOutboxCount(count);
        if (ok) {
          setNotice("You're offline. That dose is saved on this device and will sync automatically.");
        } else {
          setError("That tap was NOT saved: you're offline and this device's storage is full or blocked. Note the dose elsewhere and log it again once you're back online.");
        }
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
        `/api/pets/${petId}/medications/${med.id}/doses?scheduledFor=${encodeURIComponent(slot.scheduledFor.toISOString())}${slot.slotKey ? `&slotKey=${encodeURIComponent(slot.slotKey)}` : ''}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to undo');
      applyDose(med.id, { scheduledFor: slot.scheduledFor.toISOString(), slotKey: slot.slotKey }, data.quantityRemaining, true);
    });

  // As-needed, right now: each log is its own instant, never collapsed.
  const logPrnNow = (med) =>
    withBusy(`prn-${med.id}`, async () => {
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}/doses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: new Date().toISOString(), status: 'GIVEN' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log dose');
      applyDose(med.id, data.dose, data.quantityRemaining);
    });

  // Reverse an accidental "Log dose now": remove the most recent of today's.
  const undoPrnLast = (med) =>
    withBusy(`prn-${med.id}`, async () => {
      const last = (med.doses || [])
        .filter((d) => !d.deletedAt && d.status === 'GIVEN' && sameDay(new Date(d.scheduledFor), new Date()))
        .sort((a, b) => new Date(b.scheduledFor) - new Date(a.scheduledFor))[0];
      if (!last) return;
      const iso = new Date(last.scheduledFor).toISOString();
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}/doses?scheduledFor=${encodeURIComponent(iso)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to undo');
      applyDose(med.id, { scheduledFor: iso }, data.quantityRemaining, true);
    });

  // Historical as-needed dose: anchored to noon of the chosen day so the
  // record lands on the right date in every timezone view.
  const logPrnFor = (med, day) =>
    withBusy(`prn-${med.id}`, async () => {
      const when = new Date(day);
      when.setHours(12, 0, 0, 0);
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}/doses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: when.toISOString(), status: 'GIVEN', givenAt: when.toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log dose');
      applyDose(med.id, data.dose, data.quantityRemaining);
    });

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-midnight-50 flex items-center justify-center">
        <LoadingSpinner text="Loading medications..." />
      </div>
    );
  }
  if (status === 'unauthenticated') return null;

  // CARE-kind rows belong to the good-stuff section below;
  // the checklist is purely medical
  const medItems = meds.filter((m) => m.kind !== 'CARE');
  const active = medItems.filter((m) => m.isActive);
  const lowCount = active.filter(isLowSupply).length;
  const canManage = access !== 'VIEWER';

  return (
    <div className="px-4 py-5 md:px-8 md:py-6">
      <div className="max-w-4xl mx-auto">
        {/* One quiet mono line: today's scope, and where the record lives */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <p className="font-stamp text-[9.5px] uppercase tracking-[0.16em] text-pen-400">
            {active.length} active medication{active.length !== 1 && 's'}
            {lowCount > 0 && (
              <Link href={`/pets/${petId}/health`} className="text-stampred hover:underline"> · {lowCount} low on supply</Link>
            )}
          </p>
          <Link href={`/pets/${petId}/health`} className="font-stamp text-[9.5px] uppercase tracking-[0.16em] text-pen-400 hover:text-pen-900 transition-colors">
            manage in the Health Book →
          </Link>
        </div>

        {error && (
          <div className="border-l-[3px] border-stampred bg-stampred-wash/60 text-stampred-dark text-sm px-4 py-3 mb-5 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-stampred hover:text-stampred-dark" aria-label="Dismiss"><X size={16} /></button>
          </div>
        )}

        {notice && (
          <div className="border-l-[3px] border-marker bg-marker-wash/70 text-pen-600 text-sm px-4 py-3 mb-5 flex items-center justify-between gap-3">
            <span className="inline-flex items-start gap-2"><Info size={16} className="flex-shrink-0 mt-0.5 text-marker" /> {notice}</span>
            <button onClick={() => setNotice(null)} className="text-pen-400 hover:text-pen-900" aria-label="Dismiss"><X size={16} /></button>
          </div>
        )}

        {outboxCount > 0 && (
          <div className="border-l-[3px] border-pen-400 bg-paper-200/70 text-pen-600 text-sm px-4 py-3 mb-5 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2">
              <CloudOff size={15} />
              {outboxCount} dose log{outboxCount !== 1 ? 's' : ''} saved on this device, waiting to sync.
            </span>
            <button onClick={flushOutbox} className="font-stamp text-[10px] uppercase tracking-[0.12em] text-pen-900 hover:text-stampred">Sync now</button>
          </div>
        )}

        {/* Medications: the dose checklist, or a gentle nudge to add one.
            Routines (GoodStuff) render below regardless — a care-only pet
            must still see Today, which is why this no longer hides them. */}
        {medItems.length === 0 ? (
          <Sheet className="border-dashed mb-5">
            <div className="flex items-center gap-4">
              <span className="w-10 h-10 rounded-[5px] border-[1.5px] border-pen-300 text-pen-400 flex items-center justify-center shrink-0">
                <Sparkles size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-pen-900">No medications in the book yet</p>
                <p className="font-diary italic text-[13px] text-pen-400">add one and check off doses with a tap — the book watches the schedule and warns you before refills run out.</p>
              </div>
              {canManage && (
                <Link
                  href={`/pets/${petId}/medications/new`}
                  className="inline-flex items-center gap-1.5 font-stamp text-[10px] uppercase tracking-[0.12em] border-[1.5px] border-pen-900 text-pen-900 rounded-[4px] px-3 py-2 hover:bg-pen-900 hover:text-paper-50 transition-colors shrink-0"
                >
                  <Plus size={12} /> Add
                </Link>
              )}
            </div>
          </Sheet>
        ) : (
          <>
            <DayChecklist
              meds={medItems}
              day={selectedDay}
              busyKeys={busyKeys}
              readOnly={!canManage}
              onMark={markDose}
              onUndo={undoDose}
              onLogPrnNow={logPrnNow}
              onUndoPrnLast={undoPrnLast}
              onLogPrnFor={logPrnFor}
              onBackToToday={() => setSelectedDay(startOfDay(new Date()))}
            />
            <WeekStrip meds={medItems} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
          </>
        )}

        <GoodStuff petId={petId} meds={meds} setMeds={setMeds} canManage={canManage} />

        <p className="text-center font-diary italic text-[12px] text-pen-400 pt-2 pb-6">
          free forever · a helper for remembering · your vet&rsquo;s guidance always comes first
        </p>
      </div>
    </div>
  );
}
