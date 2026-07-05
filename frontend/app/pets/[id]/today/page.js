'use client';

/**
 * Today: the one screen where a caregiver acts.
 *
 * Apple-Health register: a hero ring (doses given / due today) is the
 * single primary visual, the soonest dose sits front-and-center as one
 * big tile, and the rest of the day is a grid of tiles, not a stacked
 * list of sections. What is already done demotes to a quiet tile; past
 * days hide behind a toggle.
 *
 * This page owns the write path, including the offline outbox, so a
 * check-off is never silently lost between the tap and the database.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { X, Check, Plus, Loader2, ChevronDown } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { usePet } from '@/app/components/care/PetProvider';
import { AddCareModal } from '@/app/components/care/GoodStuff';
import { CareIconChip } from '@/app/components/icons/CareIcons';
import WeekStrip from '@/app/components/care/WeekStrip';
import Ring from '@/app/components/care/kit/Ring';
import { Tile, TileGrid } from '@/app/components/care/kit/Tile';
import { cn } from '@/components/ui';
import {
  isLowSupply, startOfDay, sameDay, slotsWithStatus, adherenceForDay, formatTime,
} from '@/lib/medications';

/* ----------------------------- Offline outbox ----------------------------- */
const outboxKey = (petId) => `medOutbox:${petId}`;
function readOutbox(petId) {
  try { return JSON.parse(localStorage.getItem(outboxKey(petId)) || '[]'); } catch { return []; }
}
function writeOutbox(petId, items) {
  try { localStorage.setItem(outboxKey(petId), JSON.stringify(items)); return true; } catch { return false; }
}
function enqueueDose(petId, entry) {
  const items = readOutbox(petId).filter((i) => !(i.medId === entry.medId && i.scheduledFor === entry.scheduledFor));
  items.push({ ...entry, queuedAt: new Date().toISOString() });
  const ok = writeOutbox(petId, items);
  return { ok, count: ok ? items.length : readOutbox(petId).length };
}

/* -------------------------------- Buttons --------------------------------- */
const giveBtn = 'rounded-full bg-care-ink text-white text-sm font-semibold px-5 py-2 hover:opacity-90 transition-opacity disabled:opacity-40';
const giveBtnLg = 'rounded-full bg-care-ink text-white text-[15px] font-semibold px-6 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-40';
const quietBtn = 'text-[13px] font-medium text-care-sub hover:text-care-ink transition-colors';
const label = 'text-[12px] font-medium text-care-sub uppercase tracking-wide';

/* --------------------------------- Page ----------------------------------- */

export default function TodayPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const petId = params.id;
  const { pet } = usePet();

  const [access, setAccess] = useState('OWNER');
  const [meds, setMeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyKeys, setBusyKeys] = useState(new Set());
  const [notice, setNotice] = useState(null);
  const [outboxCount, setOutboxCount] = useState(0);
  const [showPast, setShowPast] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));

  useEffect(() => {
    if (status === 'unauthenticated') router.push(`/login?callbackUrl=/pets/${petId}/today`);
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

  useEffect(() => { if (status === 'authenticated' && petId) fetchMeds(); }, [status, petId, fetchMeds]);

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
      } catch { remaining.push(item); }
    }
    writeOutbox(petId, remaining);
    setOutboxCount(remaining.length);
    if (remaining.length < items.length) fetchMeds();
  }, [petId, fetchMeds]);

  useEffect(() => {
    if (status !== 'authenticated' || !petId) return undefined;
    flushOutbox();
    const onFocus = () => { fetchMeds(); flushOutbox(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [status, petId, fetchMeds, flushOutbox]);

  const withBusy = async (key, fn) => {
    setBusyKeys((prev) => new Set(prev).add(key));
    try { await fn(); } catch (err) { setError(err.message); } finally {
      setBusyKeys((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  };

  const applyDose = (medId, dose, quantityRemaining, removed = false) => {
    setMeds((prev) => prev.map((m) => {
      if (m.id !== medId) return m;
      const sameSlot = (d) => (dose.slotKey && d.slotKey)
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
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
      } catch {
        const { ok, count } = enqueueDose(petId, { medId: med.id, scheduledFor: slot.scheduledFor.toISOString(), slotKey: slot.slotKey, status: statusValue });
        setOutboxCount(count);
        if (ok) setNotice("You're offline. That dose is saved on this device and will sync automatically.");
        else setError("That tap was not saved. You're offline and this device's storage is full or blocked. Note the dose elsewhere and log it again once you're back online.");
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  if (status === 'loading' || loading) {
    return <div className="min-h-[50vh] flex items-center justify-center"><LoadingSpinner text="Loading..." /></div>;
  }
  if (status === 'unauthenticated') return null;

  const canManage = access !== 'VIEWER';
  const today = selectedDay;
  const viewingToday = sameDay(today, new Date());
  const now = new Date();

  const medItems = meds.filter((m) => m.kind !== 'CARE');
  const activeMeds = medItems.filter((m) => m.isActive);
  const careItems = meds.filter((m) => m.kind === 'CARE' && m.isActive);
  const lowCount = activeMeds.filter(isLowSupply).length;

  const scheduledMeds = activeMeds.filter((m) => m.scheduleType !== 'AS_NEEDED');
  const prnMeds = activeMeds.filter((m) => m.scheduleType === 'AS_NEEDED');

  // The ring: scheduled med doses given vs due for the day.
  let due = 0; let given = 0;
  for (const m of scheduledMeds) { const a = adherenceForDay(m, m.doses, today); due += a.due; given += a.given; }

  const medSlots = [];
  for (const m of scheduledMeds) for (const s of slotsWithStatus(m, m.doses, today)) medSlots.push({ med: m, slot: s });
  medSlots.sort((a, b) => a.slot.time.localeCompare(b.slot.time));
  const isOverdue = (slot) => viewingToday && !slot.status && slot.scheduledFor < now;
  const pending = medSlots.filter((x) => !x.slot.status);
  const doneSlots = medSlots.filter((x) => x.slot.status);
  const upNext = viewingToday ? pending[0] : null;
  const gridPending = viewingToday ? pending.slice(1) : pending;

  const scheduledCare = careItems.filter((c) => c.scheduleType !== 'AS_NEEDED');
  const wheneverCare = careItems.filter((c) => c.scheduleType === 'AS_NEEDED');

  const busy = (k) => busyKeys.has(k);
  const remaining = due - given;
  const ringTone = due === 0 ? 'empty' : given >= due ? 'done' : pending.some((p) => isOverdue(p.slot)) ? 'behind' : 'going';

  const headline = due === 0
    ? (careItems.length ? 'No doses today' : 'Nothing scheduled')
    : given >= due ? 'All done for today'
    : `${remaining} ${remaining === 1 ? 'dose' : 'doses'} left`;
  const subline = upNext
    ? `Next: ${upNext.med.name}${upNext.med.strength ? ` ${upNext.med.strength}` : ''} at ${formatTime(upNext.slot.time)}`
    : given >= due && due > 0 ? `Everything's given${pet?.name ? ` for ${pet.name}` : ''}.`
    : careItems.length ? 'Routines below.' : '';

  const hasAnything = activeMeds.length > 0 || careItems.length > 0;

  /* ------------------------------- Fragments ------------------------------- */

  const DoseTile = ({ med, slot }) => {
    const over = isOverdue(slot);
    const b = busy(`${med.id}-${slot.scheduledFor.getTime()}`);
    return (
      <Tile state={over ? 'due' : 'idle'} className="flex flex-col">
        <p className={cn(label, over && 'text-red-600')}>{formatTime(slot.time)}{over && ' · Overdue'}</p>
        <p className="text-[16px] font-semibold text-care-ink mt-1 truncate">{med.name}</p>
        <p className="text-[13px] text-care-sub truncate">{med.strength || med.instructions || ' '}</p>
        <div className="flex items-center gap-3 mt-3">
          {b ? <Loader2 size={16} className="animate-spin text-care-sub" /> : (
            <>
              <button onClick={() => markDose(med, slot, 'GIVEN')} className={giveBtn} aria-label={`Give ${med.name}`}>Give</button>
              <button onClick={() => markDose(med, slot, 'SKIPPED')} className={quietBtn}>Skip</button>
            </>
          )}
        </div>
      </Tile>
    );
  };

  const RoutineTile = ({ care }) => {
    const slots = slotsWithStatus(care, care.doses, today);
    const doneCount = slots.filter((s) => s.status === 'GIVEN').length;
    return (
      <Tile className="flex flex-col">
        <div className="flex items-center gap-2">
          <CareIconChip name={care.name} color={care.color} size="sm" />
          <p className="text-[16px] font-semibold text-care-ink truncate">{care.name}</p>
        </div>
        {slots.length > 1 && <p className="text-[13px] text-care-sub mt-1">{doneCount} of {slots.length} today</p>}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {slots.map((slot) => {
            const done = slot.status === 'GIVEN';
            const b = busy(`${care.id}-${slot.scheduledFor.getTime()}`);
            return (
              <button
                key={slot.time}
                onClick={canManage ? () => (done ? undoDose(care, slot) : markDose(care, slot, 'GIVEN')) : undefined}
                disabled={!canManage || b}
                aria-label={`${care.name} ${formatTime(slot.time)}${done ? ', done' : ''}`}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[13px] font-medium tabular-nums transition-colors',
                  done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-care-line text-care-ink hover:border-care-ink'
                )}
              >
                {b ? '…' : done ? <><Check size={12} /> {formatTime(slot.time)}</> : formatTime(slot.time)}
              </button>
            );
          })}
        </div>
      </Tile>
    );
  };

  const WheneverTile = ({ care }) => {
    const count = (care.doses || []).filter((d) => !d.deletedAt && d.status === 'GIVEN' && sameDay(new Date(d.scheduledFor), today)).length;
    const b = busy(`prn-${care.id}`);
    return (
      <Tile className="flex flex-col">
        <div className="flex items-center gap-2">
          <CareIconChip name={care.name} color={care.color} size="sm" />
          <p className="text-[16px] font-semibold text-care-ink truncate">{care.name}</p>
        </div>
        <p className="text-[13px] text-care-sub mt-1">{count > 0 ? `${count} today` : 'Whenever it happens'}</p>
        <div className="flex items-center gap-3 mt-3">
          {b ? <Loader2 size={16} className="animate-spin text-care-sub" /> : canManage && (
            <>
              <button onClick={() => logPrnNow(care)} className={giveBtn}>{count > 0 ? 'Again' : 'Done'}</button>
              {count > 0 && <button onClick={() => undoPrnLast(care)} className={quietBtn}>Undo</button>}
            </>
          )}
        </div>
      </Tile>
    );
  };

  const PrnTile = ({ med }) => {
    const count = (med.doses || []).filter((d) => !d.deletedAt && d.status === 'GIVEN' && sameDay(new Date(d.scheduledFor), today)).length;
    const b = busy(`prn-${med.id}`);
    return (
      <Tile className="flex flex-col">
        <p className={label}>As needed</p>
        <p className="text-[16px] font-semibold text-care-ink mt-1 truncate">{med.name}</p>
        <p className="text-[13px] text-care-sub truncate">{count > 0 ? `${count} given today` : (med.strength || ' ')}</p>
        <div className="flex items-center gap-3 mt-3">
          {b ? <Loader2 size={16} className="animate-spin text-care-sub" /> : canManage && (
            <>
              <button onClick={() => logPrnNow(med)} className={giveBtn}>{count > 0 ? 'Give again' : 'Give'}</button>
              {count > 0 && <button onClick={() => undoPrnLast(med)} className={quietBtn}>Undo</button>}
            </>
          )}
        </div>
      </Tile>
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5">
      {showAddRoutine && (
        <AddCareModal petId={petId} onClose={() => setShowAddRoutine(false)} onSaved={(m) => setMeds((prev) => [...prev, m])} />
      )}

      {/* Notices */}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-red-50 text-red-700 text-sm px-4 py-3 mb-3">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800" aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}
      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-50 text-amber-800 text-sm px-4 py-3 mb-3">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-amber-600 hover:text-amber-800" aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}
      {outboxCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-neutral-100 text-neutral-600 text-sm px-4 py-3 mb-3">
          <span>{outboxCount} dose log{outboxCount !== 1 ? 's' : ''} saved on this device, waiting to sync.</span>
          <button onClick={flushOutbox} className="font-medium text-neutral-900 hover:text-neutral-700">Sync now</button>
        </div>
      )}

      {!hasAnything ? (
        <Tile className="text-center py-10 mt-2">
          <p className="text-[17px] font-semibold text-care-ink">Nothing to track yet</p>
          <p className="text-[15px] text-care-sub mt-1 mb-5">Add a medication and check off doses with a tap.</p>
          {canManage && (
            <Link href={`/pets/${petId}/medications/new`} className={cn(giveBtnLg, 'inline-block')}>Add a medication</Link>
          )}
        </Tile>
      ) : (
        <>
          {/* Hero: the ring is the day's state at a glance */}
          <section className="flex items-center gap-5 py-3 mb-1">
            <Ring value={given} total={due} size={128} />
            <div className="min-w-0">
              <p className="text-[22px] font-semibold tracking-tight text-care-ink leading-tight">{headline}</p>
              {subline && <p className="text-[15px] text-care-sub mt-1">{subline}</p>}
              {lowCount > 0 && (
                <Link href={`/pets/${petId}/health`} className="inline-block text-[13px] text-red-600 hover:text-red-700 mt-2">
                  {lowCount} low on supply
                </Link>
              )}
            </div>
          </section>

          {/* Up next: the soonest dose, front and center */}
          {upNext && (
            <Tile state={isOverdue(upNext.slot) ? 'due' : 'idle'} className="mb-3">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className={cn(label, isOverdue(upNext.slot) && 'text-red-600')}>
                    {isOverdue(upNext.slot) ? 'Overdue' : 'Up next'} · {formatTime(upNext.slot.time)}
                  </p>
                  <p className="text-[22px] font-semibold text-care-ink mt-1 truncate">{upNext.med.name}</p>
                  <p className="text-[14px] text-care-sub truncate">
                    {[upNext.med.strength, upNext.med.instructions].filter(Boolean).join(' · ') || ' '}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {busy(`${upNext.med.id}-${upNext.slot.scheduledFor.getTime()}`) ? (
                    <Loader2 size={18} className="animate-spin text-care-sub" />
                  ) : (
                    <>
                      <button onClick={() => markDose(upNext.med, upNext.slot, 'SKIPPED')} className={quietBtn}>Skip</button>
                      <button onClick={() => markDose(upNext.med, upNext.slot, 'GIVEN')} className={giveBtnLg}>Give</button>
                    </>
                  )}
                </div>
              </div>
            </Tile>
          )}

          {/* The rest of the day, as tiles */}
          {(gridPending.length > 0 || prnMeds.length > 0 || careItems.length > 0) && (
            <TileGrid>
              {gridPending.map(({ med, slot }) => <DoseTile key={`${med.id}-${slot.time}`} med={med} slot={slot} />)}
              {prnMeds.map((med) => <PrnTile key={med.id} med={med} />)}
              {scheduledCare.map((care) => <RoutineTile key={care.id} care={care} />)}
              {wheneverCare.map((care) => <WheneverTile key={care.id} care={care} />)}
              {canManage && (
                <button
                  onClick={() => setShowAddRoutine(true)}
                  className="rounded-3xl border border-dashed border-care-line text-care-sub hover:text-care-ink hover:border-care-ink transition-colors p-5 flex items-center justify-center gap-2 text-sm font-medium min-h-[104px]"
                >
                  <Plus size={16} /> Add a routine
                </button>
              )}
            </TileGrid>
          )}

          {/* Given today: demoted */}
          {doneSlots.length > 0 && (
            <Tile className="mt-3">
              <button onClick={() => setShowDone((v) => !v)} className="w-full flex items-center justify-between" aria-expanded={showDone}>
                <span className={label}>Given today · {doneSlots.length}</span>
                <ChevronDown size={16} className={cn('text-care-sub transition-transform', showDone && 'rotate-180')} />
              </button>
              {showDone && (
                <div className="mt-3 space-y-2">
                  {doneSlots.map(({ med, slot }) => (
                    <div key={`${med.id}-${slot.time}`} className="flex items-center gap-3 text-[14px]">
                      <Check size={15} className={slot.status === 'GIVEN' ? 'text-emerald-500' : 'text-care-sub'} />
                      <span className="flex-1 min-w-0 truncate text-care-sub">{med.name}{med.strength ? ` ${med.strength}` : ''}</span>
                      <span className="text-care-sub tabular-nums">
                        {slot.status === 'SKIPPED' ? 'Skipped' : (slot.dose?.givenAt ? new Date(slot.dose.givenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Given')}
                      </span>
                      <button onClick={() => undoDose(med, slot)} className={quietBtn}>Undo</button>
                    </div>
                  ))}
                </div>
              )}
            </Tile>
          )}

          {/* Past days */}
          <div className="mt-3">
            {!showPast && viewingToday ? (
              <button onClick={() => setShowPast(true)} className={cn(quietBtn, 'px-1')}>Past days</button>
            ) : (
              <Tile>
                <WeekStrip meds={medItems} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
                {!viewingToday && (
                  <button
                    onClick={() => { setSelectedDay(startOfDay(new Date())); setShowPast(false); }}
                    className={cn(quietBtn, 'mt-3')}
                  >
                    Back to today
                  </button>
                )}
              </Tile>
            )}
          </div>
        </>
      )}
    </div>
  );
}
