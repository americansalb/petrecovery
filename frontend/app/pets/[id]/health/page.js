'use client';

/**
 * Health tab (direction D). Subtabs: Overview (the verdict + vitals +
 * recent history), Vaccines, Weight, Vet. The record only; doses are
 * logged on Today and medications are managed on the Meds tab.
 */

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { ConfirmModal } from '@/components/ui';
import { usePet } from '@/app/components/care/PetProvider';
import SubTabs from '@/app/components/care/kit/SubTabs';
import { Overline } from '@/app/components/care/kit/Tile';
import {
  AlertRibbon, HealthStatusBand, VitalsTrio, VaccinePassport, AddVaccineModal,
  WeightCard, VetCard, MonthHistory, SectionHeader,
} from '@/app/components/care/HealthRecord';
import { healthBookStatus } from '@/lib/healthBook';

function HealthInner() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const petId = params.id;
  const { pet, access, setPet } = usePet();

  const initialTab = ['vaccines', 'weight', 'vet'].includes(searchParams.get('tab')) ? searchParams.get('tab') : 'overview';
  const [tab, setTab] = useState(initialTab);
  const [vaccinations, setVaccinations] = useState([]);
  const [weights, setWeights] = useState([]);
  const [meds, setMeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [managing, setManaging] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightDate, setWeightDate] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [vetDraft, setVetDraft] = useState(null);
  const [savingVet, setSavingVet] = useState(false);
  const [confirmVaxRemove, setConfirmVaxRemove] = useState(null);
  const [removingVax, setRemovingVax] = useState(false);

  useEffect(() => { if (status === 'unauthenticated') router.push(`/login?callbackUrl=/pets/${petId}/health`); }, [status, router, petId]);

  const load = useCallback(async () => {
    try {
      const [v, w, m] = await Promise.all([
        fetch(`/api/pets/${petId}/vaccinations`).then((r) => (r.ok ? r.json() : { vaccinations: [] })),
        fetch(`/api/pets/${petId}/weights`).then((r) => (r.ok ? r.json() : { weights: [] })),
        fetch(`/api/pets/${petId}/medications`).then((r) => (r.ok ? r.json() : { medications: [] })),
      ]);
      setVaccinations(v.vaccinations || []);
      setWeights(w.weights || []);
      setMeds((m.medications || []).filter((x) => x.kind !== 'CARE'));
    } finally { setLoading(false); }
  }, [petId]);

  useEffect(() => { if (status === 'authenticated' && petId) load(); }, [status, petId, load]);

  const name = pet?.name || 'your pet';
  const bookStatus = useMemo(() => healthBookStatus(vaccinations, name), [vaccinations, name]);

  const logWeight = async () => {
    const val = parseFloat(weightInput);
    if (isNaN(val) || val <= 0 || savingWeight) return;
    setSavingWeight(true); setError(null);
    try {
      // Backdating uses noon so the entry lands on the chosen calendar day
      // in every timezone; the API sorts and recomputes the pet's current
      // weight from the newest entry either way.
      const payload = { weightLbs: val };
      if (weightDate) payload.recordedAt = new Date(`${weightDate}T12:00:00`).toISOString();
      const res = await fetch(`/api/pets/${petId}/weights`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not log weight');
      setWeights((prev) => [...prev, data.entry].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt)));
      if (!weightDate) setPet((prev) => (prev ? { ...prev, weight: val } : prev));
      setWeightInput('');
      setWeightDate('');
    } catch (err) { setError(err.message); } finally { setSavingWeight(false); }
  };

  const removeVax = async (vax) => {
    setRemovingVax(true);
    try {
      const res = await fetch(`/api/pets/${petId}/vaccinations?vaccinationId=${vax.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove');
      setVaccinations((prev) => prev.filter((v) => v.id !== vax.id));
      setConfirmVaxRemove(null);
    } catch (err) { setError(err.message); } finally { setRemovingVax(false); }
  };

  const saveVet = async () => {
    if (savingVet) return;
    setSavingVet(true); setError(null);
    try {
      const res = await fetch(`/api/pets/${petId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(vetDraft) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save');
      setPet((prev) => ({ ...prev, ...vetDraft }));
      setVetDraft(null);
    } catch (err) { setError(err.message); } finally { setSavingVet(false); }
  };

  if (status === 'loading' || loading) return <div className="min-h-[50vh] flex items-center justify-center"><LoadingSpinner text="Loading..." /></div>;
  if (status === 'unauthenticated') return null;

  const canManage = access !== 'VIEWER';
  const isOwner = access === 'OWNER';

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl">
      <h1 className="text-[24px] font-semibold tracking-tight text-care-ink mb-4">Health</h1>
      <SubTabs
        tabs={[{ id: 'overview', label: 'Overview' }, { id: 'vaccines', label: 'Vaccines' }, { id: 'weight', label: 'Weight' }, { id: 'vet', label: 'Vet' }]}
        active={tab}
        onChange={setTab}
        className="mb-5"
      />

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">
          <span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss" className="text-red-600 hover:text-red-800"><X size={16} /></button>
        </div>
      )}

      {tab === 'overview' && (
        <div className="flex flex-col gap-6">
          <div>
            <AlertRibbon text={pet?.medicalConditions} href={isOwner ? `/pets/${petId}/profile?tab=id` : undefined} />
            {/* The empty and needs-attention states now carry the action the
                sentence promises ("first vaccine" / "one tap to update"),
                so the owner isn't left to discover the Vaccines tab. */}
            <HealthStatusBand
              name={name}
              status={bookStatus}
              action={canManage && (bookStatus.tone === 'empty' || bookStatus.tone === 'bad' || bookStatus.tone === 'warn') ? (
                <button
                  onClick={() => { setTab('vaccines'); if (bookStatus.tone === 'empty') setShowAdd(true); }}
                  className="rounded-xl bg-care-teal text-white text-[13px] font-semibold px-4 py-2 hover:bg-care-tealDark transition-colors"
                >
                  {bookStatus.tone === 'empty' ? 'Add first vaccine' : 'Update vaccines'}
                </button>
              ) : null}
            />
          </div>
          {/* The status band above already states the vaccination position
              by name and date, so the summary carries only what it does
              not: weight and medications. */}
          <VitalsTrio vaccinations={vaccinations} weights={weights} meds={meds} showVaccinations={false} />
          {(vaccinations.length > 0 || weights.length > 0) && (
            <div><SectionHeader title="Recent" /><MonthHistory vaccinations={vaccinations} weights={weights} meds={meds} /></div>
          )}
        </div>
      )}

      {tab === 'vaccines' && (
        <VaccinePassport
          vaccinations={vaccinations}
          canManage={canManage}
          managing={managing}
          onToggleManage={() => setManaging((v) => !v)}
          onAdd={() => setShowAdd(true)}
          onRemove={setConfirmVaxRemove}
        />
      )}

      {tab === 'weight' && (
        <WeightCard
          weights={weights}
          canManage={canManage}
          weightInput={weightInput}
          onWeightInput={setWeightInput}
          weightDate={weightDate}
          onWeightDate={setWeightDate}
          onLog={logWeight}
          saving={savingWeight}
        />
      )}

      {tab === 'vet' && (
        <VetCard pet={pet} isOwner={isOwner} vetDraft={vetDraft} onDraft={setVetDraft} onSave={saveVet} onCancel={() => setVetDraft(null)} saving={savingVet} />
      )}

      {showAdd && (
        <AddVaccineModal
          petId={petId}
          species={pet?.species}
          onClose={() => setShowAdd(false)}
          onSaved={(vax, retired = []) =>
            setVaccinations((prev) => [vax, ...prev.filter((v) => !retired.includes(v.id))])}
        />
      )}

      {confirmVaxRemove && (
        <ConfirmModal
          onClose={() => setConfirmVaxRemove(null)}
          title={`Remove ${confirmVaxRemove.name}?`}
          body="This removes the vaccination record from the book. It cannot be undone here."
          confirmLabel="Remove"
          busy={removingVax}
          onConfirm={() => removeVax(confirmVaxRemove)}
        />
      )}
    </div>
  );
}

export default function HealthPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center"><LoadingSpinner /></div>}>
      <HealthInner />
    </Suspense>
  );
}
