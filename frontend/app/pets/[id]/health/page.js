'use client';

/**
 * Health: the record. One question, is everything OK and what is on
 * file, answered top to bottom: a verdict sentence, any medical
 * alerts, the vitals, then plain sections for medications, vaccines,
 * weight, the vet, history, and the pet's profile (which absorbed the
 * old Overview). Doses are logged on Today; this screen is what is
 * true about the pet, and where the record is managed.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { Plus, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { ConfirmModal } from '@/components/ui';
import { MedCard } from '@/app/components/medications/MedCards';
import RescueReadiness from '@/app/components/pets/RescueReadiness';
import { usePet } from '@/app/components/care/PetProvider';
import {
  SectionHeader, AlertRibbon, HealthStatusBand, VitalsTrio,
  VaccinePassport, AddVaccineModal, WeightCard, VetCard, MonthHistory,
} from '@/app/components/care/HealthRecord';
import { healthBookStatus } from '@/lib/healthBook';

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const arr = JSON.parse(value || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export default function HealthPage() {
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
  const [vetDraft, setVetDraft] = useState(null);
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
        <LoadingSpinner text="Loading..." />
      </div>
    );
  }
  if (status === 'unauthenticated') return null;

  const canManage = access !== 'VIEWER';
  const isOwner = access === 'OWNER';

  const photos = parseJsonArray(pet?.photos);
  const personality = parseJsonArray(pet?.personality);
  const uniquePhotos = [...new Set([pet?.primaryPhotoUrl, ...photos].filter(Boolean))];
  const traitLine = pet ? [
    pet.breed || pet.species,
    pet.age != null && `${pet.age} yr${pet.age !== 1 ? 's' : ''}`,
    pet.color,
    pet.size && pet.size.charAt(0) + pet.size.slice(1).toLowerCase(),
    pet.sex && pet.sex.charAt(0) + pet.sex.slice(1).toLowerCase(),
  ].filter(Boolean).join(', ') : '';

  const addVaccineButton = canManage && (
    <button
      onClick={() => setShowAdd(true)}
      className="rounded-full border border-neutral-300 text-sm font-medium text-neutral-900 px-4 py-1.5 hover:border-neutral-900 transition-colors"
    >
      Add vaccine
    </button>
  );

  const profileRow = (label, value) => (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-[13px] text-neutral-500 shrink-0">{label}</dt>
      <dd className="text-[15px] text-neutral-900 text-right min-w-0">{value}</dd>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss" className="text-red-600 hover:text-red-800"><X size={16} /></button>
        </div>
      )}

      <AlertRibbon text={pet?.medicalConditions} href={isOwner ? `/pets/${petId}/edit` : undefined} />
      <HealthStatusBand name={name} status={bookStatus} action={addVaccineButton} />
      <VitalsTrio vaccinations={vaccinations} weights={weights} meds={meds} />

      {/* Medications */}
      <section className="mb-8">
        <SectionHeader
          title="Medications"
          action={(
            <span className="flex items-center gap-4">
              <a
                href={`/api/pets/${petId}/medications/export`}
                download
                className="text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
                title="Download a full backup of all medication data"
              >
                Backup
              </a>
              {canManage && (
                <Link
                  href={`/pets/${petId}/medications/new`}
                  className="inline-flex items-center gap-1 text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  <Plus size={13} /> Add
                </Link>
              )}
            </span>
          )}
        />
        {meds.length === 0 ? (
          <p className="text-[15px] text-neutral-500 py-3">No medications on file. Doses are logged on <Link href={`/pets/${petId}/today`} className="text-neutral-900 underline underline-offset-2">Today</Link>.</p>
        ) : (
          <>
            <div className="divide-y divide-neutral-100">
              {meds.filter((m) => m.isActive).map((med) => (
                <MedCard key={med.id} med={med} petId={petId} busy={busyMed === med.id} canManage={canManage}
                  onTogglePause={togglePause} onDelete={setConfirmDelete} />
              ))}
            </div>
            {meds.some((m) => !m.isActive) && (
              <>
                <p className="text-[13px] font-medium text-neutral-500 mt-5 mb-1">Paused</p>
                <div className="divide-y divide-neutral-100">
                  {meds.filter((m) => !m.isActive).map((med) => (
                    <MedCard key={med.id} med={med} petId={petId} busy={busyMed === med.id} canManage={canManage}
                      onTogglePause={togglePause} onDelete={setConfirmDelete} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>

      <VaccinePassport
        vaccinations={vaccinations}
        canManage={canManage}
        managing={managing}
        onToggleManage={() => setManaging((v) => !v)}
        onAdd={() => setShowAdd(true)}
        onRemove={removeVax}
      />

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

      {(vaccinations.length > 0 || weights.length > 0) && (
        <section className="mb-8">
          <SectionHeader title="History" />
          <MonthHistory vaccinations={vaccinations} weights={weights} meds={meds} />
        </section>
      )}

      {/* Profile: the facts a finder or searcher would need (was Overview) */}
      {pet && (
        <section className="mb-4">
          <SectionHeader
            title="Profile"
            action={isOwner && (
              <Link
                href={`/pets/${petId}/edit`}
                className="text-[13px] font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                Edit
              </Link>
            )}
          />
          {isOwner && (
            <RescueReadiness pet={pet} photos={uniquePhotos} personality={personality} isOwner={isOwner} />
          )}
          <dl className="divide-y divide-neutral-100">
            {traitLine && profileRow('Looks', traitLine)}
            {profileRow('Microchip', pet.microchipId || (
              isOwner ? <Link href={`/pets/${petId}/edit`} className="inline-flex items-center gap-0.5 text-neutral-500 hover:text-neutral-900">Add <ChevronRight size={13} /></Link> : <span className="text-neutral-400">Not noted</span>
            ))}
            {profileRow('Collar', pet.collarInfo || (
              isOwner ? <Link href={`/pets/${petId}/edit`} className="inline-flex items-center gap-0.5 text-neutral-500 hover:text-neutral-900">Add <ChevronRight size={13} /></Link> : <span className="text-neutral-400">Not noted</span>
            ))}
            {pet.distinctiveMarks && profileRow('Marks', pet.distinctiveMarks)}
            {pet.medicalConditions && (
              <div className="flex items-start justify-between gap-4 py-2.5">
                <dt className="text-[13px] text-neutral-500 shrink-0">Medical</dt>
                <dd className="text-[15px] text-red-600 text-right min-w-0">{pet.medicalConditions}</dd>
              </div>
            )}
            {personality.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-3">
                {personality.slice(0, 8).map((trait) => (
                  <span key={trait} className="text-[13px] px-2.5 py-0.5 rounded-full border border-neutral-200 text-neutral-600">
                    {trait}
                  </span>
                ))}
              </div>
            )}
          </dl>

          {uniquePhotos.length >= 2 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {uniquePhotos.slice(0, 10).map((url) => (
                <img key={url} src={url} alt={pet.name} className="w-20 h-20 rounded-xl object-cover" />
              ))}
            </div>
          )}
        </section>
      )}

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
