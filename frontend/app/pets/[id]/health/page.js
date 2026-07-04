'use client';

/**
 * The Health Book - the RECORD room (docs/PRODUCT_IA_PLAN.md §3)
 *
 * Status before data: medical notes first (the ribbon), one verdict
 * sentence, then the vitals, the stamps, the medication record, the
 * weight story, the vet, and the unified history. Who the pet IS lives
 * in the shell's identity row — this room never repeats it. Doses are
 * tapped in Today; this room is what's TRUE about the pet.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import Link from 'next/link';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { Card, Button, ConfirmModal } from '@/components/ui';
import { MedCard } from '@/app/components/medications/MedCards';
import { usePet } from '@/app/components/care/PetProvider';
import {
  SectionHeader, AlertRibbon, HealthStatusBand, VitalsTrio,
  VaccinePassport, AddVaccineModal, WeightCard, VetCard, MonthHistory,
} from '@/app/components/care/HealthRecord';
import { healthBookStatus } from '@/lib/healthBook';

export default function HealthBookPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const petId = params.id;
  const { pet, access, setPet } = usePet();

  const [vaccinations, setVaccinations] = useState([]);
  const [weights, setWeights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [managing, setManaging] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [meds, setMeds] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busyMed, setBusyMed] = useState(null);
  const [vetDraft, setVetDraft] = useState(null); // null = closed
  const [savingVet, setSavingVet] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/pets/${petId}/health`);
    }
  }, [status, router, petId]);

  const load = useCallback(async () => {
    try {
      const [vaxRes, weightRes, medsRes] = await Promise.all([
        fetch(`/api/pets/${petId}/vaccinations`),
        fetch(`/api/pets/${petId}/weights`),
        fetch(`/api/pets/${petId}/medications`),
      ]);
      if (vaxRes.ok) setVaccinations((await vaxRes.json()).vaccinations || []);
      if (weightRes.ok) setWeights((await weightRes.json()).weights || []);
      if (medsRes.ok) setMeds(((await medsRes.json()).medications || []).filter((m) => m.kind !== 'CARE'));
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    if (status === 'authenticated' && petId) load();
  }, [status, petId, load]);

  const name = pet?.name || 'your pet';
  const bookStatus = useMemo(
    () => healthBookStatus(vaccinations, name),
    [vaccinations, name]
  );

  const logWeight = async () => {
    const v = parseFloat(weightInput);
    if (isNaN(v) || v <= 0 || savingWeight) return;
    setSavingWeight(true);
    setError(null);
    try {
      const res = await fetch(`/api/pets/${petId}/weights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weightLbs: v }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not log weight');
      setWeights((prev) => [...prev, data.entry]);
      // Pet.weight follows the newest entry server-side; mirror it locally
      // so every surface reading the scalar stays in step.
      setPet((prev) => (prev ? { ...prev, weight: v } : prev));
      setWeightInput('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingWeight(false);
    }
  };

  const removeVax = async (vax) => {
    try {
      const res = await fetch(`/api/pets/${petId}/vaccinations?vaccinationId=${vax.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove');
      setVaccinations((prev) => prev.filter((v) => v.id !== vax.id));
    } catch (err) {
      setError(err.message);
    }
  };

  const withMedBusy = async (med, fn) => {
    setBusyMed(med.id);
    try { await fn(); } catch (err) { setError(err.message); } finally { setBusyMed(null); }
  };

  const togglePause = (med) =>
    withMedBusy(med, async () => {
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
    withMedBusy(med, async () => {
      const res = await fetch(`/api/pets/${petId}/medications/${med.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setMeds((prev) => prev.filter((m) => m.id !== med.id));
      setConfirmDelete(null);
    });

  const saveVet = async () => {
    if (savingVet) return;
    setSavingVet(true);
    setError(null);
    try {
      const res = await fetch(`/api/pets/${petId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vetDraft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setPet((prev) => ({ ...prev, ...vetDraft }));
      setVetDraft(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingVet(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner text="Opening the book..." />
      </div>
    );
  }
  if (status === 'unauthenticated') return null;

  const canManage = access !== 'VIEWER';
  const isOwner = access === 'OWNER';

  const addVaccineButton = canManage && (
    <button
      onClick={() => setShowAdd(true)}
      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-flash-400 hover:bg-flash-500 text-midnight-900 text-sm font-bold transition-colors shrink-0"
    >
      <Plus size={15} /> Add vaccine
    </button>
  );

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="max-w-4xl mx-auto">
        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 rounded-xl mb-4 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss" className="text-red-400 hover:text-red-700"><X size={16} /></button>
          </div>
        )}

        {/* ===== Front of the book: what a vet must see first ===== */}
        <AlertRibbon text={pet?.medicalConditions} href={isOwner ? `/pets/${petId}/edit` : undefined} />

        {/* ===== The one-glance verdict (identity lives in the shell) ===== */}
        <HealthStatusBand name={name} status={bookStatus} action={addVaccineButton} />

        {/* ===== Vital signs, at a glance ===== */}
        <div className="mb-4">
          <VitalsTrio vaccinations={vaccinations} weights={weights} meds={meds} />
        </div>

        {/* ===== Immunization passport ===== */}
        <VaccinePassport
          vaccinations={vaccinations}
          canManage={canManage}
          managing={managing}
          onToggleManage={() => setManaging((v) => !v)}
          onAdd={() => setShowAdd(true)}
          onRemove={removeVax}
        />

        {/* Medications: the record and its management (logging lives in Today) */}
        <Card padding="lg" className="mb-4">
          <SectionHeader
            eyebrow="Prescriptions"
            title="Medications"
            action={(
              <div className="flex items-center gap-2">
                <a
                  href={`/api/pets/${petId}/medications/export`}
                  download
                  className="inline-flex items-center gap-1.5 px-3 py-2 border-2 border-midnight-200 text-midnight-500 rounded-xl text-sm font-bold hover:border-midnight-300 hover:text-midnight-800 transition-colors"
                  title="Download a full backup of all medication data"
                >
                  Backup
                </a>
                {canManage && (
                  <Button variant="primary" size="sm" href={`/pets/${petId}/medications/new`}>
                    Add medication
                  </Button>
                )}
              </div>
            )}
          />
          <p className="text-sm text-midnight-500 mt-1 mb-4">
            Schedules and supply. Daily check-offs live in <Link href={`/pets/${petId}/today`} className="font-bold text-midnight-700 hover:text-midnight-900 underline underline-offset-2">Today</Link>.
          </p>
          {meds.length === 0 ? (
            <p className="text-sm text-midnight-400">No medications on file.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {meds.filter((m) => m.isActive).map((med) => (
                  <MedCard key={med.id} med={med} petId={petId} busy={busyMed === med.id} canManage={canManage}
                    onTogglePause={togglePause} onDelete={setConfirmDelete} />
                ))}
              </div>
              {meds.some((m) => !m.isActive) && (
                <>
                  <h3 className="font-bold text-midnight-500 text-sm uppercase tracking-wide mt-5 mb-3">Paused</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {meds.filter((m) => !m.isActive).map((med) => (
                      <MedCard key={med.id} med={med} petId={petId} busy={busyMed === med.id} canManage={canManage}
                        onTogglePause={togglePause} onDelete={setConfirmDelete} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <WeightCard
            weights={weights}
            canManage={canManage}
            weightInput={weightInput}
            onWeightInput={setWeightInput}
            onLog={logWeight}
            saving={savingWeight}
          />
          <VetCard
            pet={pet}
            petName={name}
            isOwner={isOwner}
            vetDraft={vetDraft}
            onDraft={setVetDraft}
            onSave={saveVet}
            onCancel={() => setVetDraft(null)}
            saving={savingVet}
          />
        </div>

        {/* ===== The record: one unified history ===== */}
        {(vaccinations.length > 0 || weights.length > 0) && (
          <Card padding="lg" className="mb-4">
            <SectionHeader eyebrow="The record" title="History" />
            <div className="mt-4">
              <MonthHistory vaccinations={vaccinations} weights={weights} meds={meds} />
            </div>
          </Card>
        )}

        <p className="text-center text-xs text-midnight-400 pt-2 pb-6">
          A record you keep, not medical advice. Your vet&apos;s guidance comes first.
        </p>
      </div>

      {confirmDelete && (
        <ConfirmModal
          onClose={() => setConfirmDelete(null)}
          title={`Delete ${confirmDelete.name}?`}
          body="This removes the medication and its full dose history. This cannot be undone."
          busy={busyMed === confirmDelete.id}
          onConfirm={() => deleteMed(confirmDelete)}
        />
      )}

      {showAdd && (
        <AddVaccineModal
          petId={petId}
          species={pet?.species}
          onClose={() => setShowAdd(false)}
          onSaved={(vax) => setVaccinations((prev) => [vax, ...prev])}
        />
      )}
    </div>
  );
}
