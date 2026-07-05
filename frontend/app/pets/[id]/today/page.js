'use client';

/**
 * Today: the one screen where a caregiver acts.
 *
 * It answers a single question, what does this pet need now, and shows
 * the answer as a plain list: doses due, routines, as-needed, then what
 * is already done. Management and history live in Health; nothing here
 * is reference material. Past days can be caught up from a toggle at
 * the bottom.
 *
 * This page owns the write path, including the offline outbox, so a
 * check-off is never silently lost between the tap and the database.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { X } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
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
    return false;
  }
}

function enqueueDose(petId, entry) {
  const items = readOutbox(petId).filter(
    (i) => !(i.medId === entry.medId && i.scheduledFor === entry.scheduledFor)
  );
  items.push({ ...entry, queuedAt: new Date().toISOString() });
  const ok = writeOutbox(petId, items);
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
  const [showPast, setShowPast] = useState(false);
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
        const { ok, count } = enqueueDose(petId, { medId: med.id, scheduledFor: slot.scheduledFor.toISOString(), slotKey: slot.slotKey, status: statusValue });
        setOutboxCount(count);
        if (ok) {
          setNotice("You're offline. That dose is saved on this device and will sync automatically.");
        } else {
          setError("That tap was not saved. You're offline and this device's storage is full or blocked. Note the dose elsewhere and log it again once you're back online.");
        }
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log dose');
      if (data.alreadyLogged) {
        const at = data.dose.givenAt ? new Date(data.dose.givenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
        setNotice(`This dose was already logged${at ? ` at ${at}` : ''}, likely by another caregiver. Nothing was double counted.`);
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
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }
  if (status === 'unauthenticated') return null;

  const medItems = meds.filter((m) => m.kind !== 'CARE');
  const active = medItems.filter((m) => m.isActive);
  const lowCount = active.filter(isLowSupply).length;
  const canManage = access !== 'VIEWER';
  const viewingToday = sameDay(selectedDay, new Date());

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800" aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 text-amber-800 text-sm px-4 py-3 mb-4">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-amber-600 hover:text-amber-800" aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      {outboxCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-neutral-100 text-neutral-600 text-sm px-4 py-3 mb-4">
          <span>{outboxCount} dose log{outboxCount !== 1 ? 's' : ''} saved on this device, waiting to sync.</span>
          <button onClick={flushOutbox} className="font-medium text-neutral-900 hover:text-neutral-700">Sync now</button>
        </div>
      )}

      {lowCount > 0 && (
        <Link
          href={`/pets/${petId}/health`}
          className="block text-sm text-red-600 hover:text-red-700 mb-4"
        >
          {lowCount} medication{lowCount !== 1 ? 's' : ''} low on supply
        </Link>
      )}

      {medItems.length === 0 ? (
        <div className="py-4">
          <p className="text-[15px] text-neutral-500">No medications yet.</p>
          {canManage && (
            <Link
              href={`/pets/${petId}/medications/new`}
              className="inline-block mt-3 rounded-full bg-neutral-900 text-white text-sm font-medium px-4 py-2 hover:bg-neutral-700 transition-colors"
            >
              Add a medication
            </Link>
          )}
        </div>
      ) : (
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
          onBackToToday={() => { setSelectedDay(startOfDay(new Date())); setShowPast(false); }}
        />
      )}

      <GoodStuff petId={petId} meds={meds} setMeds={setMeds} canManage={canManage} />

      {medItems.length > 0 && (
        <div className="mt-8 pt-4 border-t border-neutral-100">
          {!showPast && viewingToday ? (
            <button
              onClick={() => setShowPast(true)}
              className="text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              Past days
            </button>
          ) : (
            <WeekStrip meds={medItems} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
          )}
        </div>
      )}
    </div>
  );
}
