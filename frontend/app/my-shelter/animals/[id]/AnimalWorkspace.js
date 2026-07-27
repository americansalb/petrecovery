'use client';

/**
 * The working half of an animal's portal page: today's medications and
 * care, the health record (vaccination stamps and weight), and the
 * adoption handoff.
 *
 * The Health Book components are shared with the consumer pet pages, so a
 * record kept here is the same record that goes home with the adopter.
 * What differs is the framing: a shelter works a roster, so this page
 * opens on what has to happen today rather than on a single pet's story.
 *
 * Dose writes post straight through; the consumer page's offline outbox
 * is deliberately not duplicated here, since shelter staff work on site.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, X } from 'lucide-react';
import { DayChecklist } from '@/app/components/care/DoseChecklist';
import GoodStuff from '@/app/components/care/GoodStuff';
import {
  VaccinePassport, AddVaccineModal, WeightCard,
} from '@/app/components/care/HealthRecord';
import { StatusControl } from '@/app/shelter/AnimalControls';
import PetGlance from '@/app/components/care/PetGlance';
import { startOfDay, sameDay } from '@/lib/medications';

function Label({ children }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-midnight-500 mb-3">{children}</h2>
  );
}

export default function AnimalWorkspace({
  petId, petName, species, shelterStatus, pendingTransferEmail, holdActive, petRecord,
}) {
  const router = useRouter();
  const today = startOfDay(new Date());

  const [meds, setMeds] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [weights, setWeights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyKeys, setBusyKeys] = useState(new Set());

  const [showAddVax, setShowAddVax] = useState(false);
  const [managingVax, setManagingVax] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightDate, setWeightDate] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, v, w] = await Promise.all([
        fetch(`/api/pets/${petId}/medications`).then((r) => (r.ok ? r.json() : { medications: [] })),
        fetch(`/api/pets/${petId}/vaccinations`).then((r) => (r.ok ? r.json() : { vaccinations: [] })),
        fetch(`/api/pets/${petId}/weights`).then((r) => (r.ok ? r.json() : { weights: [] })),
      ]);
      setMeds(m.medications || []);
      setVaccinations(v.vaccinations || []);
      setWeights(w.weights || []);
    } catch {
      setError('Could not load this animal\'s records. Refresh to try again.');
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => { load(); }, [load]);

  const withBusy = async (key, fn) => {
    setBusyKeys((prev) => new Set(prev).add(key));
    try { await fn(); } catch (err) { setError(err.message); } finally {
      setBusyKeys((prev) => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  /* Mirrors the consumer page so a slot never doubles up */
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
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}/doses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledFor: slot.scheduledFor.toISOString(),
          slotKey: slot.slotKey,
          status: statusValue,
          ...(statusValue === 'GIVEN' && isBackfill ? { givenAt: slot.scheduledFor.toISOString() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not record that dose');
      applyDose(med.id, data.dose, data.quantityRemaining);
    });

  const undoDose = (med, slot) =>
    withBusy(`${med.id}-${slot.scheduledFor.getTime()}`, async () => {
      const iso = slot.scheduledFor.toISOString();
      const qs = `scheduledFor=${encodeURIComponent(iso)}${slot.slotKey ? `&slotKey=${encodeURIComponent(slot.slotKey)}` : ''}`;
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}/doses?${qs}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not undo that dose');
      applyDose(med.id, { scheduledFor: iso, slotKey: slot.slotKey }, data.quantityRemaining, true);
    });

  const logPrn = (med, when) =>
    withBusy(`prn-${med.id}`, async () => {
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}/doses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: when.toISOString(), status: 'GIVEN' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not log that dose');
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not undo that dose');
      applyDose(med.id, { scheduledFor: iso }, data.quantityRemaining, true);
    });

  const logWeight = async () => {
    const val = parseFloat(weightInput);
    if (Number.isNaN(val) || val <= 0 || savingWeight) return;
    setSavingWeight(true);
    setError('');
    try {
      const payload = { weightLbs: val };
      if (weightDate) payload.recordedAt = new Date(`${weightDate}T12:00:00`).toISOString();
      const res = await fetch(`/api/pets/${petId}/weights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not log weight');
      setWeights((prev) => [...prev, data.entry].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt)));
      setWeightInput('');
      setWeightDate('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingWeight(false);
    }
  };

  const removeVax = async (vax) => {
    try {
      const res = await fetch(`/api/pets/${petId}/vaccinations?vaccinationId=${vax.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not remove that record');
      setVaccinations((prev) => prev.filter((v) => v.id !== vax.id));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <p className="text-sm text-midnight-400 inline-flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading {petName}&rsquo;s records
      </p>
    );
  }

  return (
    /* Two columns, the shape the owner's Today page uses: what has to
       happen on the left, the calm "is this animal OK" glance on the
       right. Same instrument for whoever is doing the caring. */
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8 space-y-8 lg:space-y-0">
      <div className="space-y-8">
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <section>
        <Label>Status</Label>
        <div className="rounded-xl border border-midnight-100 bg-white p-4 flex items-center gap-4 flex-wrap">
          <StatusControl
            pet={{ id: petId, name: petName, shelterStatus }}
            onChanged={() => router.refresh()}
            size="page"
          />
          <p className="text-[13px] text-midnight-400">
            Available and adoption-pending animals show on your public page.
          </p>
        </div>
      </section>

      {/* Today appears only when there is something to do today. A heading
          over an apology is worse than no heading: the section below
          already invites the first routine. */}
      {meds.some((m) => m.isActive) && (
        <section>
          <Label>Today</Label>
          <DayChecklist
            meds={meds}
            day={today}
            busyKeys={busyKeys}
            readOnly={false}
            onMark={markDose}
            onUndo={undoDose}
            onLogPrnNow={(med) => logPrn(med, new Date())}
            onUndoPrnLast={undoPrnLast}
            onLogPrnFor={(med, day) => logPrn(med, day)}
          />
        </section>
      )}

      <section>
        <div className="space-y-4">
          <VaccinePassport
            vaccinations={vaccinations}
            canManage
            managing={managingVax}
            onToggleManage={() => setManagingVax((v) => !v)}
            onAdd={() => setShowAddVax(true)}
            onRemove={removeVax}
          />
          <WeightCard
            weights={weights}
            canManage
            weightInput={weightInput}
            onWeightInput={setWeightInput}
            weightDate={weightDate}
            onWeightDate={setWeightDate}
            onLog={logWeight}
            saving={savingWeight}
          />
        </div>
      </section>

      <section>
        <Label>Medications and care</Label>
        <GoodStuff petId={petId} meds={meds} setMeds={setMeds} canManage />
      </section>

      {showAddVax && (
        <AddVaccineModal
          petId={petId}
          species={species}
          onClose={() => setShowAddVax(false)}
          onSaved={(entry) => {
            setVaccinations((prev) => [...prev, entry]);
            setShowAddVax(false);
          }}
        />
      )}
      </div>

      <div className="space-y-8">
        {/* Only what the working column does not already show. Vaccines
            and weight are edited in view on the left, so summarising them
            here would just repeat them. */}
        <PetGlance
          pet={petRecord}
          name={petName}
          vaccinations={vaccinations}
          weights={weights}
          meds={meds}
          show={['note', 'vet']}
          heading="Care context"
        />

        <section>
          <Label>Adoption</Label>
          <AdoptionPanel
            petId={petId}
            petName={petName}
            pendingTransferEmail={pendingTransferEmail}
            holdActive={holdActive}
          />
        </section>
      </div>
    </div>
  );
}

function AdoptionPanel({ petId, petName, pendingTransferEmail, holdActive }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const invite = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/pets/${petId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not send that invite');
      setEmail('');
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await fetch(`/api/pets/${petId}/transfer`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (pendingTransferEmail) {
    return (
      <div className="rounded-xl border border-midnight-100 bg-white p-4">
        <p className="text-sm text-midnight-700">
          <span className="inline-flex items-center gap-1.5 font-bold text-midnight-900">
            <i className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Invite sent
          </span>{' '}
          to {pendingTransferEmail}. When they accept, {petName}&rsquo;s full health
          record moves to their account and leaves your roster.
        </p>
        <button
          onClick={cancel}
          disabled={busy}
          className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-midnight-500 hover:text-red-600 disabled:opacity-50 transition"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Cancel invite
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-midnight-100 bg-white p-4">
      <p className="text-sm text-midnight-600 mb-3">
        Send {petName} home with the adopter. They get the complete health record,
        medications and vaccination history included.
        {holdActive && ' The legal hold has not ended yet, so wait to complete the adoption.'}
      </p>
      {/* globals.css forces email inputs to width:100%; grid tracks shape the row */}
      <form onSubmit={invite} className="grid gap-2 sm:grid-cols-[minmax(0,18rem)_auto] sm:items-center">
        <input
          type="email"
          required
          aria-label={`Adopter email for ${petName}`}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="adopter@email.com"
          className="border border-midnight-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-flash-400"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 bg-midnight-900 hover:bg-midnight-800 text-white text-sm font-semibold rounded-lg px-3.5 py-2 disabled:opacity-50 transition"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send home
        </button>
        {error && <p role="alert" className="sm:col-span-2 text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
