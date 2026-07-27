'use client';

/**
 * Today (direction D): the one screen where a caregiver acts.
 *
 * A deep-teal hero carries the urgent thing (doses due now) with a single
 * "mark all given". Below it, today's medication progress and the care
 * routines. On the right, a calm "Is Max OK?" glance (vaccines, weight,
 * meds, note, vet) that links into the Health tab. Nothing is a wall of
 * sections; each block is one white card with air around it.
 *
 * This page owns the dose write path, including the offline outbox, so a
 * check-off is never silently lost between the tap and the database.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  X, Check, Clock, Pill, Droplet, ChevronRight, Phone, Plus, Loader2,
  TrendingDown, Heart, Syringe, AlertCircle, Pause, Play, Trash2, RotateCcw,
} from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { usePet } from '@/app/components/care/PetProvider';
import { AddCareModal } from '@/app/components/care/GoodStuff';
import { CareIconChip } from '@/app/components/icons/CareIcons';
import WeekStrip from '@/app/components/care/WeekStrip';
import PetGlance from '@/app/components/care/PetGlance';
import { Card, Overline } from '@/app/components/care/kit/Tile';
import { cn, ConfirmModal } from '@/components/ui';
import { vaccinationStatus } from '@/lib/healthBook';
import {
  isLowSupply, startOfDay, sameDay, slotsWithStatus, adherenceForDay, formatTime, formatSchedule,
} from '@/lib/medications';

/* ----------------------------- Offline outbox ----------------------------- */
const outboxKey = (petId) => `medOutbox:${petId}`;
function readOutbox(petId) { try { return JSON.parse(localStorage.getItem(outboxKey(petId)) || '[]'); } catch { return []; } }
function writeOutbox(petId, items) { try { localStorage.setItem(outboxKey(petId), JSON.stringify(items)); return true; } catch { return false; } }
function enqueueDose(petId, entry) {
  const items = readOutbox(petId).filter((i) => !(i.medId === entry.medId && i.scheduledFor === entry.scheduledFor));
  items.push({ ...entry, queuedAt: new Date().toISOString() });
  const ok = writeOutbox(petId, items);
  return { ok, count: ok ? items.length : readOutbox(petId).length };
}

const medGlyph = (m) => (['LIQUID', 'DROPS'].includes(m.form) ? Droplet : Pill);

export default function TodayPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const petId = params.id;
  const { pet } = usePet();

  const [access, setAccess] = useState('OWNER');
  const [meds, setMeds] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [weights, setWeights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyKeys, setBusyKeys] = useState(new Set());
  const [notice, setNotice] = useState(null);
  const [outboxCount, setOutboxCount] = useState(0);
  const [showAddRoutine, setShowAddRoutine] = useState(false);
  const [managingRoutines, setManagingRoutines] = useState(false);
  const [confirmCareDelete, setConfirmCareDelete] = useState(null);
  const [pastOpen, setPastOpen] = useState(false);
  const [pastDay, setPastDay] = useState(null); // a startOfDay Date, or null for today
  const today = startOfDay(new Date());

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
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [petId]);

  const fetchGlance = useCallback(async () => {
    try {
      const [v, w] = await Promise.all([
        fetch(`/api/pets/${petId}/vaccinations`).then((r) => (r.ok ? r.json() : { vaccinations: [] })),
        fetch(`/api/pets/${petId}/weights`).then((r) => (r.ok ? r.json() : { weights: [] })),
      ]);
      setVaccinations(v.vaccinations || []);
      setWeights(w.weights || []);
    } catch { /* glance is best-effort */ }
  }, [petId]);

  useEffect(() => { if (status === 'authenticated' && petId) { fetchMeds(); fetchGlance(); } }, [status, petId, fetchMeds, fetchGlance]);

  const flushOutbox = useCallback(async () => {
    const items = readOutbox(petId);
    setOutboxCount(items.length);
    if (!items.length) return;
    const remaining = [];
    for (const item of items) {
      try {
        const res = await fetch(`/api/pets/${petId}/medications/${item.medId}/doses`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    return () => { window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [status, petId, fetchMeds, flushOutbox]);

  const withBusy = async (key, fn) => {
    setBusyKeys((prev) => new Set(prev).add(key));
    try { await fn(); } catch (err) { setError(err.message); } finally {
      setBusyKeys((prev) => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  const applyDose = (medId, dose, quantityRemaining, removed = false) => {
    setMeds((prev) => prev.map((m) => {
      if (m.id !== medId) return m;
      const sameSlot = (d) => (dose.slotKey && d.slotKey) ? d.slotKey === dose.slotKey : new Date(d.scheduledFor).getTime() === new Date(dose.scheduledFor).getTime();
      const doses = (m.doses || []).filter((d) => !sameSlot(d));
      if (!removed) doses.unshift(dose);
      return { ...m, doses, quantityRemaining: quantityRemaining !== undefined ? quantityRemaining : m.quantityRemaining };
    }));
  };

  const markDose = (med, slot, statusValue) =>
    withBusy(`${med.id}-${slot.scheduledFor.getTime()}`, async () => {
      const isBackfill = !sameDay(slot.scheduledFor, new Date()) && slot.scheduledFor < new Date();
      const payload = { scheduledFor: slot.scheduledFor.toISOString(), slotKey: slot.slotKey, status: statusValue, ...(statusValue === 'GIVEN' && isBackfill ? { givenAt: slot.scheduledFor.toISOString() } : {}) };
      let res;
      try {
        res = await fetch(`/api/pets/${petId}/medications/${med.id}/doses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
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
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}/doses?scheduledFor=${encodeURIComponent(slot.scheduledFor.toISOString())}${slot.slotKey ? `&slotKey=${encodeURIComponent(slot.slotKey)}` : ''}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to undo');
      applyDose(med.id, { scheduledFor: slot.scheduledFor.toISOString(), slotKey: slot.slotKey }, data.quantityRemaining, true);
    });

  const logPrnNow = (med) =>
    withBusy(`prn-${med.id}`, async () => {
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}/doses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scheduledFor: new Date().toISOString(), status: 'GIVEN' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to log dose');
      applyDose(med.id, data.dose, data.quantityRemaining);
    });

  const undoPrnLast = (med) =>
    withBusy(`prn-${med.id}`, async () => {
      const last = (med.doses || []).filter((d) => !d.deletedAt && d.status === 'GIVEN' && sameDay(new Date(d.scheduledFor), new Date())).sort((a, b) => new Date(b.scheduledFor) - new Date(a.scheduledFor))[0];
      if (!last) return;
      const iso = new Date(last.scheduledFor).toISOString();
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}/doses?scheduledFor=${encodeURIComponent(iso)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to undo');
      applyDose(med.id, { scheduledFor: iso }, data.quantityRemaining, true);
    });

  // Routine management: pause/resume and delete (care items are medications
  // of kind CARE, so they use the same medication endpoints).
  const togglePauseCare = (care) =>
    withBusy(`care-${care.id}`, async () => {
      const res = await fetch(`/api/pets/${petId}/medications/${care.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !care.isActive }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');
      setMeds((prev) => prev.map((m) => (m.id === care.id ? data.medication : m)));
    });

  const deleteCare = (care) =>
    withBusy(`care-${care.id}`, async () => {
      const res = await fetch(`/api/pets/${petId}/medications/${care.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to remove');
      setMeds((prev) => prev.filter((m) => m.id !== care.id));
      setConfirmCareDelete(null);
    });

  if (status === 'loading' || loading) {
    return <div className="min-h-[50vh] flex items-center justify-center"><LoadingSpinner text="Loading..." /></div>;
  }
  if (status === 'unauthenticated') return null;

  const canManage = access !== 'VIEWER';
  const now = new Date();
  const medItems = meds.filter((m) => m.kind !== 'CARE');
  const activeMeds = medItems.filter((m) => m.isActive);
  const careItems = meds.filter((m) => m.kind === 'CARE' && m.isActive);
  const allCareItems = meds.filter((m) => m.kind === 'CARE');
  const lowCount = activeMeds.filter(isLowSupply).length;

  const scheduledMeds = activeMeds.filter((m) => m.scheduleType !== 'AS_NEEDED');
  const prnMeds = activeMeds.filter((m) => m.scheduleType === 'AS_NEEDED');

  let due = 0; let given = 0;
  for (const m of scheduledMeds) { const a = adherenceForDay(m, m.doses, today); due += a.due; given += a.given; }

  const slots = [];
  for (const m of scheduledMeds) for (const s of slotsWithStatus(m, m.doses, today)) slots.push({ med: m, slot: s });
  slots.sort((a, b) => a.slot.time.localeCompare(b.slot.time));
  const pending = slots.filter((x) => !x.slot.status);
  const doneSlots = slots.filter((x) => x.slot.status);

  // Past-day catch-up: the doses scheduled on the selected past day.
  const pastSlots = pastDay
    ? scheduledMeds.flatMap((m) => slotsWithStatus(m, m.doses, pastDay).map((s) => ({ med: m, slot: s }))).sort((a, b) => a.slot.time.localeCompare(b.slot.time))
    : [];

  // The hero features only the batch that needs attention now: any overdue
  // doses, or else just the next upcoming time slot. The rest of the day is
  // summarized in the card below, so the hero stays one calm focus.
  const overduePending = pending.filter((x) => x.slot.scheduledFor < now);
  const focus = overduePending.length
    ? overduePending
    : pending.length ? pending.filter((x) => x.slot.time === pending[0].slot.time) : [];
  const focusOverdue = overduePending.length > 0;
  const focusTime = focus.length ? focus[0].slot.time : null;
  const laterCount = pending.length - focus.length;

  const busy = (k) => busyKeys.has(k);
  const hasAnything = activeMeds.length > 0 || careItems.length > 0;

  // health glance
  const withExpiry = vaccinations.filter((v) => !v.deletedAt && v.expiresAt);
  const vaxCurrent = withExpiry.filter((v) => vaccinationStatus(v) === 'PROTECTED').length;
  const vaxDue = withExpiry.filter((v) => ['DUE_SOON', 'EXPIRED'].includes(vaccinationStatus(v)));
  const latestWeight = weights[weights.length - 1];
  const weightDelta = weights.length > 1 ? +(latestWeight.weightLbs - weights[0].weightLbs).toFixed(1) : null;

  const shortMonth = (d) => new Date(d).toLocaleDateString([], { month: 'short', year: 'numeric' });
  const greeting = (() => { const h = now.getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; })();

  const markAllDue = async () => {
    for (const { med, slot } of focus) {
      // sequential to keep supply counts consistent
      // eslint-disable-next-line no-await-in-loop
      await markDose(med, slot, 'GIVEN');
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {showAddRoutine && <AddCareModal petId={petId} onClose={() => setShowAddRoutine(false)} onSaved={(m) => setMeds((prev) => [...prev, m])} />}
      {confirmCareDelete && (
        <ConfirmModal
          onClose={() => setConfirmCareDelete(null)}
          title={`Remove ${confirmCareDelete.name}?`}
          body="This removes the routine and its history. It cannot be undone."
          confirmLabel="Remove"
          busy={busyKeys.has(`care-${confirmCareDelete.id}`)}
          onConfirm={() => deleteCare(confirmCareDelete)}
        />
      )}

      {/* notices */}
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">
          <span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss" className="text-red-600 hover:text-red-800"><X size={16} /></button>
        </div>
      )}
      {notice && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-care-tealWash text-care-teal text-sm px-4 py-3 mb-4">
          <span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Dismiss" className="text-care-teal hover:text-care-tealDark"><X size={16} /></button>
        </div>
      )}
      {outboxCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-care-surface shadow-care text-care-sub text-sm px-4 py-3 mb-4">
          <span>{outboxCount} dose log{outboxCount !== 1 ? 's' : ''} saved on this device, waiting to sync.</span>
          <button onClick={flushOutbox} className="font-semibold text-care-ink hover:text-care-teal">Sync now</button>
        </div>
      )}

      {!hasAnything && error ? (
        /* A load failure must not masquerade as "you have no medications":
           the error banner above is the whole story until a retry works. */
        null
      ) : !hasAnything ? (
        <Card className="text-center py-12 mt-2 px-6">
          <p className="text-[17px] font-semibold text-care-ink">Nothing to track yet</p>
          <p className="text-[14px] text-care-sub mt-1 mb-5">Add a medication and check off doses with a tap.</p>
          {canManage && <Link href={`/pets/${petId}/medications/new`} className="inline-flex items-center gap-2 rounded-xl bg-care-teal text-white text-sm font-semibold px-5 py-2.5 hover:bg-care-tealDark transition-colors"><Plus size={16} /> Add a medication</Link>}
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
          {/* CENTER */}
          <div className="min-w-0 flex flex-col gap-5">
            <div className="flex items-end justify-between">
              <div>
                <Overline>{greeting}{pet?.name ? '' : ''}</Overline>
                <h1 className="text-[24px] font-semibold tracking-tight text-care-ink leading-none mt-1.5">
                  Today <span className="text-care-faint font-medium">· {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                </h1>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-care-sub">
                <Clock size={16} /><b className="text-[13px] font-semibold text-care-ink">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</b>
              </div>
            </div>

            {/* HERO */}
            {pending.length > 0 ? (
              <section className="relative overflow-hidden rounded-[24px] text-white p-6 sm:p-7 shadow-care-hero"
                style={{ background: 'radial-gradient(120% 130% at 88% -10%, rgba(169,221,210,.18), transparent 52%), linear-gradient(158deg,#0f5750 0%,#0b433c 100%)' }}>
                <div className="flex items-center justify-between mb-5">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.13] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.13em]">
                    <span className="w-1.5 h-1.5 rounded-full bg-care-mint" /> {focusOverdue ? 'Overdue' : 'Up next'}
                  </span>
                  <div className="text-right">
                    <b className="block text-[14px] font-semibold">{focusOverdue ? `${focus.length} overdue` : `Next · ${formatTime(focusTime)}`}</b>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-6 sm:items-center">
                  <div className="sm:pr-7 sm:border-r sm:border-white/[0.14] shrink-0">
                    <div className="flex items-baseline gap-2.5">
                      <span className="text-[56px] font-semibold tracking-tight leading-[0.86]">{focus.length}</span>
                      <span className="text-[15px] text-white/80 font-medium max-w-[90px] leading-tight">{focus.length === 1 ? 'dose to give' : 'doses to give'}</span>
                    </div>
                    {canManage && (
                      <button onClick={markAllDue} className="h-12 px-5 rounded-2xl bg-white text-care-tealDark text-[14.5px] font-semibold inline-flex items-center gap-2 hover:bg-white/90 transition-colors shadow-lg mt-5">
                        <Check size={18} strokeWidth={2.4} /> {focus.length === 1 ? 'Mark given' : 'Mark all given'}
                      </button>
                    )}
                    {laterCount > 0 && <p className="mt-3 text-[12px] text-white/60">{laterCount} more later today</p>}
                  </div>
                  <div className="flex-1 min-w-0">
                    {focus.map(({ med, slot }) => {
                      const G = medGlyph(med);
                      const b = busy(`${med.id}-${slot.scheduledFor.getTime()}`);
                      return (
                        <div key={`${med.id}-${slot.time}`} className="flex items-center gap-3.5 py-3 border-b border-white/[0.13] last:border-0">
                          <span className="w-10 h-10 rounded-xl bg-white/[0.11] text-care-mint flex items-center justify-center shrink-0"><G size={20} /></span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2"><b className="text-[16px] font-semibold">{med.name}</b>{med.strength && <em className="text-[13px] not-italic text-white/70">{med.strength}</em>}</div>
                            {med.instructions && <div className="text-[12px] text-care-mint mt-0.5">{med.instructions}</div>}
                          </div>
                          {canManage && (
                            b ? <Loader2 size={18} className="animate-spin text-white/70" /> :
                            <button onClick={() => markDose(med, slot, 'GIVEN')} aria-label={`Give ${med.name}`} className="w-7 h-7 rounded-full shrink-0 ring-[1.5px] ring-white/40 hover:bg-white/20 transition-colors" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-[24px] text-white p-7 shadow-care-hero" style={{ background: 'linear-gradient(158deg,#0f5750 0%,#0b433c 100%)' }}>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.13] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.13em] mb-4"><Check size={13} strokeWidth={2.5} /> All done</span>
                <p className="text-[26px] font-semibold tracking-tight">Every dose given{pet?.name ? ` for ${pet.name}` : ''}.</p>
                <p className="text-white/75 text-[14px] mt-1.5">{given} of {due} today. Nice work keeping the schedule.</p>
              </section>
            )}

            {/* two-up: today's meds + routines */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Overline>Today</Overline>
                  <Link href={`/pets/${petId}/meds?tab=history`} className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-care-teal">History <ChevronRight size={13} /></Link>
                </div>
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-[10px] bg-care-tealWash text-care-teal flex items-center justify-center"><Pill size={17} /></span>
                      <b className="text-[15px] font-semibold text-care-ink">Medications</b>
                    </span>
                    <span className="text-[13px] text-care-sub"><b className="text-care-ink font-semibold">{given}</b> of {due} given</span>
                  </div>
                  <div className="flex gap-1.5 mb-4">
                    {slots.map(({ med, slot }, i) => (
                      <span key={i} className={cn('flex-1 h-[7px] rounded', slot.status === 'GIVEN' ? 'bg-care-teal' : slot.status === 'SKIPPED' ? 'bg-care-line' : 'bg-[repeating-linear-gradient(115deg,#d8e5e2,#d8e5e2_4px,#eaf1ef_4px,#eaf1ef_8px)]')} />
                    ))}
                    {slots.length === 0 && <span className="flex-1 h-[7px] rounded bg-care-line" />}
                  </div>
                  {doneSlots.length > 0 ? (
                    <div>
                      {doneSlots.slice(0, 3).map(({ med, slot }) => (
                        <div key={`${med.id}-${slot.time}`} className="flex items-center gap-2.5 py-2 text-[12.5px] border-b border-care-lineSoft last:border-0">
                          <Check size={15} className={slot.status === 'GIVEN' ? 'text-care-teal' : 'text-care-faint'} />
                          <span className="flex-1 min-w-0 truncate font-semibold text-care-ink">{med.name}<span className="font-normal text-care-faint ml-1.5">{med.strength}</span></span>
                          <span className="text-care-sub tabular-nums">{slot.status === 'SKIPPED' ? 'Skipped' : (slot.dose?.givenAt ? new Date(slot.dose.givenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Given')}</span>
                          {canManage && <button onClick={() => undoDose(med, slot)} className="text-[12px] font-medium text-care-faint hover:text-care-ink">Undo</button>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[13px] text-care-sub py-2">No doses logged yet today.</p>
                  )}
                  {pending.length > 0 && (
                    /* Overdue and upcoming are different facts: never print a
                       past slot time as if it were the next dose. */
                    <div className={cn('mt-3.5 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5', overduePending.length ? 'bg-care-amberWash ring-1 ring-care-amberLine' : 'bg-care-tealWash')}>
                      <Clock size={16} className={overduePending.length ? 'text-care-amber' : 'text-care-teal'} />
                      <b className={cn('text-[12.5px] font-semibold', overduePending.length ? 'text-care-amber' : 'text-care-tealDark')}>
                        {overduePending.length
                          ? `${overduePending.length} overdue`
                          : `${pending.length} dose${pending.length !== 1 ? 's' : ''} due`}
                      </b>
                      <span className={cn('ml-auto text-[12px] font-semibold', overduePending.length ? 'text-care-amber' : 'text-care-teal')}>
                        {overduePending.length
                          ? (pending.length > overduePending.length ? `next ${formatTime(pending.find((x) => x.slot.scheduledFor >= now)?.slot.time || pending[0].slot.time)}` : 'give now')
                          : formatTime(pending[0].slot.time)}
                      </span>
                    </div>
                  )}
                </Card>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Overline>Routines</Overline>
                  {canManage && (
                    <span className="flex items-center gap-3">
                      {allCareItems.length > 0 && <button onClick={() => setManagingRoutines((v) => !v)} className="text-[11.5px] font-semibold text-care-sub hover:text-care-ink">{managingRoutines ? 'Done' : 'Manage'}</button>}
                      <button onClick={() => setShowAddRoutine(true)} className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-care-teal">Add <Plus size={13} /></button>
                    </span>
                  )}
                </div>
                {managingRoutines ? (
                  <Card className="overflow-hidden divide-y divide-care-lineSoft">
                    {allCareItems.length === 0 ? (
                      <p className="text-[13px] text-care-sub px-5 py-4">No routines to manage.</p>
                    ) : allCareItems.map((care) => {
                      const b = busy(`care-${care.id}`);
                      return (
                        <div key={care.id} className={cn('flex items-center gap-3 px-5 py-3.5', !care.isActive && 'opacity-55')}>
                          <CareIconChip name={care.name} color={care.color} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-semibold text-care-ink truncate">{care.name}</p>
                            <p className="text-[12px] text-care-sub truncate">{formatSchedule(care)}{!care.isActive && ', paused'}</p>
                          </div>
                          {b ? <Loader2 size={16} className="animate-spin text-care-faint" /> : (
                            <>
                              <button onClick={() => togglePauseCare(care)} aria-label={care.isActive ? `Pause ${care.name}` : `Resume ${care.name}`} className="p-2 rounded-lg text-care-faint hover:text-care-ink hover:bg-care-bg transition-colors">{care.isActive ? <Pause size={16} /> : <Play size={16} />}</button>
                              <button onClick={() => setConfirmCareDelete(care)} aria-label={`Delete ${care.name}`} className="p-2 rounded-lg text-care-faint hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={16} /></button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </Card>
                ) : (
                <Card className="p-5">
                  {careItems.length === 0 ? (
                    <p className="text-[13px] text-care-sub py-2">No routines yet.{canManage && ' Add walks, treats, brushing.'}</p>
                  ) : (
                    <div className="flex">
                      {careItems.slice(0, 3).map((care, i) => {
                        const cs = slotsWithStatus(care, care.doses, today);
                        const isPrn = care.scheduleType === 'AS_NEEDED';
                        const doneCount = isPrn
                          ? (care.doses || []).filter((d) => !d.deletedAt && d.status === 'GIVEN' && sameDay(new Date(d.scheduledFor), today)).length
                          : cs.filter((s) => s.status === 'GIVEN').length;
                        const total = isPrn ? null : cs.length;
                        const allDone = !isPrn && total > 0 && doneCount >= total;
                        const b = busy(`prn-${care.id}`);
                        const firstPending = cs.find((s) => !s.status);
                        const act = () => {
                          if (isPrn) return logPrnNow(care);
                          if (firstPending) return markDose(care, firstPending, 'GIVEN');
                        };
                        return (
                          <button key={care.id} onClick={canManage ? act : undefined} disabled={!canManage || b}
                            className={cn('relative flex-1 flex flex-col items-center justify-center text-center px-2 py-1', i > 0 && 'border-l border-care-line')}>
                            {(allDone || (isPrn && doneCount > 0)) && <Check size={14} className="absolute top-1 right-2 text-care-teal" />}
                            <span className={cn('w-11 h-11 rounded-[13px] flex items-center justify-center mb-2.5', (allDone || doneCount > 0) ? 'bg-care-tealWash' : 'bg-[#f4f5f4]')}>
                              <CareIconChip name={care.name} color={care.color} size="sm" />
                            </span>
                            <span className="text-[13px] font-semibold text-care-ink">{care.name}</span>
                            <span className={cn('text-[11px] mt-1', doneCount > 0 && !isPrn ? 'text-care-teal font-semibold' : 'text-care-faint')}>
                              {isPrn ? (doneCount > 0 ? `Done · ${doneCount}×` : 'Anytime') : `${doneCount} of ${total}`}
                            </span>
                            {!isPrn && cs.length > 0 && (
                              <span className="flex gap-1 mt-2">
                                {cs.map((s) => <span key={s.time} className="text-[9.5px] font-semibold text-care-faint bg-[#f4f5f4] rounded-md px-1.5 py-0.5">{formatTime(s.time).replace(':00', '').replace(' ', '').toLowerCase()}</span>)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Card>
                )}
              </div>
            </div>

            {/* PRN meds, if any */}
            {prnMeds.length > 0 && (
              <div>
                <Overline className="mb-3">As needed</Overline>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {prnMeds.map((med) => {
                    const count = (med.doses || []).filter((d) => !d.deletedAt && d.status === 'GIVEN' && sameDay(new Date(d.scheduledFor), today)).length;
                    const b = busy(`prn-${med.id}`);
                    return (
                      <Card key={med.id} className="p-5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <b className="text-[15px] font-semibold text-care-ink block truncate">{med.name}</b>
                          <span className="text-[12.5px] text-care-sub">{count > 0 ? `${count} given today` : med.strength || 'As needed'}</span>
                        </div>
                        {canManage && (b ? <Loader2 size={16} className="animate-spin text-care-sub" /> : (
                          <span className="flex items-center gap-3 shrink-0">
                            {count > 0 && <button onClick={() => undoPrnLast(med)} className="text-[12.5px] font-medium text-care-faint hover:text-care-ink">Undo</button>}
                            <button onClick={() => logPrnNow(med)} className="rounded-xl bg-care-teal text-white text-[13px] font-semibold px-4 py-2 hover:bg-care-tealDark transition-colors">{count > 0 ? 'Again' : 'Give'}</button>
                          </span>
                        ))}
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Past days catch-up: log a dose you missed on a previous day */}
            {medItems.length > 0 && (
              <div className="mt-1">
                {!pastOpen ? (
                  <button onClick={() => setPastOpen(true)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-care-sub hover:text-care-ink transition-colors"><RotateCcw size={14} /> Catch up a missed day</button>
                ) : (
                  <Card className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <Overline>Past days</Overline>
                      <button onClick={() => { setPastOpen(false); setPastDay(null); }} className="text-[12.5px] font-medium text-care-sub hover:text-care-ink">Close</button>
                    </div>
                    <WeekStrip meds={medItems} selectedDay={pastDay || today} onSelectDay={(d) => setPastDay(sameDay(d, today) ? null : startOfDay(d))} />
                    {pastDay && (
                      <div className="mt-4 border-t border-care-lineSoft pt-3">
                        <p className="text-[13px] font-semibold text-care-ink mb-1.5">{pastDay.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                        {pastSlots.length === 0 ? (
                          <p className="text-[13px] text-care-sub py-2">Nothing was scheduled that day.</p>
                        ) : pastSlots.map(({ med, slot }) => {
                          const b = busy(`${med.id}-${slot.scheduledFor.getTime()}`);
                          const done = slot.status === 'GIVEN';
                          const skipped = slot.status === 'SKIPPED';
                          return (
                            <div key={`${med.id}-${slot.time}`} className="flex items-center gap-3 py-2.5 border-b border-care-lineSoft last:border-0">
                              <span className="w-12 shrink-0 text-[12.5px] text-care-sub tabular-nums">{formatTime(slot.time)}</span>
                              <span className="flex-1 min-w-0 text-[14px] font-semibold text-care-ink truncate">{med.name}<span className="font-normal text-care-faint ml-1.5">{med.strength}</span></span>
                              {b ? <Loader2 size={15} className="animate-spin text-care-faint" /> : (done || skipped) ? (
                                <span className="flex items-center gap-2.5 shrink-0 text-[12.5px]">
                                  <span className={done ? 'text-care-teal' : 'text-care-faint'}>{done ? 'Given' : 'Skipped'}</span>
                                  {canManage && <button onClick={() => undoDose(med, slot)} className="font-medium text-care-faint hover:text-care-ink">Undo</button>}
                                </span>
                              ) : canManage ? (
                                <span className="flex items-center gap-2.5 shrink-0">
                                  <button onClick={() => markDose(med, slot, 'SKIPPED')} className="text-[12.5px] font-medium text-care-faint hover:text-care-ink">Skip</button>
                                  <button onClick={() => markDose(med, slot, 'GIVEN')} className="rounded-full bg-care-teal text-white text-[12.5px] font-semibold px-3.5 py-1 hover:bg-care-tealDark transition-colors">Log</button>
                                </span>
                              ) : <span className="text-[12.5px] text-care-faint">Missed</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                )}
              </div>
            )}
          </div>

          {/* The glance is shared with the shelter's animal page */}
          <PetGlance
            pet={pet}
            vaccinations={vaccinations}
            weights={weights}
            meds={meds}
            healthHref={`/pets/${petId}/health`}
          />
        </div>
      )}
    </div>
  );
}

function initialsOf(name) {
  if (!name) return 'V';
  const parts = name.replace(/^Dr\.?\s*/i, '').trim().split(/\s+/);
  return (parts[0]?.[0] || 'V').toUpperCase();
}
