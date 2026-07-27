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
import { Card } from '@/app/components/care/kit/Tile';
import { usePet } from '@/app/components/care/PetProvider';
import SubTabs from '@/app/components/care/kit/SubTabs';
import {
  AlertRibbon, HealthStatusBand, VitalsTrio, VaccinePassport, AddVaccineModal,
  WeightCard, VetCard, MonthHistory, SectionHeader,
} from '@/app/components/care/HealthRecord';
import HealthBookNotice from '@/app/components/care/HealthBookNotice';
import { healthBookStatus } from '@/lib/healthBook';

const TABS = ['overview', 'vaccines', 'weight', 'vet'];

function HealthInner() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const petId = params.id;
  const { pet, access, setPet } = usePet();

  const initialTab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'overview';
  const [tab, setTab] = useState(initialTab);
  const [vaccinations, setVaccinations] = useState([]);
  const [weights, setWeights] = useState([]);
  const [meds, setMeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [managing, setManaging] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [weightDate, setWeightDate] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [managingWeights, setManagingWeights] = useState(false);
  const [confirmWeightRemove, setConfirmWeightRemove] = useState(null);
  const [removingWeight, setRemovingWeight] = useState(false);
  const [vetDraft, setVetDraft] = useState(null);
  const [savingVet, setSavingVet] = useState(false);
  const [confirmVaxRemove, setConfirmVaxRemove] = useState(null);
  const [removingVax, setRemovingVax] = useState(false);

  useEffect(() => { if (status === 'unauthenticated') router.push(`/login?callbackUrl=/pets/${petId}/health`); }, [status, router, petId]);

  // Keep the URL honest: a copied link or a reload must land on the tab
  // that is actually on screen, not the one from a stale ?tab.
  const switchTab = useCallback((id) => {
    setTab(id);
    router.replace(`/pets/${petId}/health${id === 'overview' ? '' : `?tab=${id}`}`, { scroll: false });
  }, [router, petId]);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      // A failed fetch must never masquerade as an empty book: rendering
      // "record is empty" over a 500 invites re-entering records that
      // exist (and the renewal logic would then retire the hidden ones).
      const [v, w, m] = await Promise.all([
        fetch(`/api/pets/${petId}/vaccinations`).then((r) => { if (!r.ok) throw new Error('vaccinations'); return r.json(); }),
        fetch(`/api/pets/${petId}/weights`).then((r) => { if (!r.ok) throw new Error('weights'); return r.json(); }),
        fetch(`/api/pets/${petId}/medications`).then((r) => { if (!r.ok) throw new Error('medications'); return r.json(); }),
      ]);
      setVaccinations(v.vaccinations || []);
      setWeights(w.weights || []);
      setMeds((m.medications || []).filter((x) => x.kind !== 'CARE'));
    } catch {
      setLoadError(true);
    } finally { setLoading(false); }
  }, [petId]);

  useEffect(() => { if (status === 'authenticated' && petId) load(); }, [status, petId, load]);

  const name = pet?.name || 'your pet';
  const bookStatus = useMemo(() => healthBookStatus(vaccinations, name), [vaccinations, name]);

  const logWeight = async () => {
    if (savingWeight) return;
    // Validate the raw string: parseFloat("12abc") is 12, and a silently
    // mangled weight is worse than an error.
    const raw = weightInput.trim();
    if (!/^\d+(\.\d+)?$/.test(raw)) { setError('Enter the weight as a number, like 42.5'); return; }
    const val = parseFloat(raw);
    if (val <= 0 || val > 500) { setError('Weight must be between 0 and 500 pounds'); return; }
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

  const removeWeight = async (entry) => {
    setRemovingWeight(true);
    try {
      const res = await fetch(`/api/pets/${petId}/weights?entryId=${entry.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove');
      setWeights((prev) => prev.filter((w) => w.id !== entry.id));
      // The profile's headline weight follows the newest remaining entry.
      setPet((prev) => (prev ? { ...prev, weight: data.weight } : prev));
      setConfirmWeightRemove(null);
    } catch (err) { setError(err.message); } finally { setRemovingWeight(false); }
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

  if (loadError) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl">
        <h1 className="text-[24px] font-semibold tracking-tight text-care-ink mb-4">Health</h1>
        <Card className="px-5 py-8 text-center">
          <p className="text-[15px] font-semibold text-care-ink">Couldn&apos;t load {name}&apos;s Health Book</p>
          <p className="text-[13.5px] text-care-sub mt-1 mb-4">The record is safe - this page just couldn&apos;t reach it. Check your connection and try again.</p>
          <button
            onClick={() => { setLoading(true); load(); }}
            className="rounded-xl bg-care-teal text-white text-sm font-semibold px-5 py-2.5 hover:bg-care-tealDark transition-colors"
          >
            Try again
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl">
      <h1 className="text-[24px] font-semibold tracking-tight text-care-ink mb-4">Health</h1>
      <SubTabs
        tabs={[{ id: 'overview', label: 'Overview' }, { id: 'vaccines', label: 'Vaccines' }, { id: 'weight', label: 'Weight' }, { id: 'vet', label: 'Vet' }]}
        active={tab}
        onChange={switchTab}
        className="mb-5"
      />

      <HealthBookNotice petName={name} />

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
                  onClick={() => { switchTab('vaccines'); if (bookStatus.tone === 'empty') setShowAdd(true); }}
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
            <div><SectionHeader title="History" /><MonthHistory vaccinations={vaccinations} weights={weights} meds={meds} /></div>
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
          managing={managingWeights}
          onToggleManage={() => setManagingWeights((v) => !v)}
          onRemove={setConfirmWeightRemove}
        />
      )}

      {tab === 'vet' && (
        <VetCard pet={pet} isOwner={isOwner} vetDraft={vetDraft} onDraft={setVetDraft} onSave={saveVet} onCancel={() => setVetDraft(null)} saving={savingVet} />
      )}

      {/* The room's constant, soft disclaimer (docs/HEALTH_BOOK_DESIGN.md §7) */}
      <p className="mt-10 text-[12px] text-care-faint">
        A record you keep, not medical advice. Your vet&apos;s guidance comes first, and
        if {name} ever seems unwell, call your vet or an emergency clinic.
      </p>

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
          body="This removes the vaccination record from the book. It can't be undone."
          confirmLabel="Remove"
          busy={removingVax}
          onConfirm={() => removeVax(confirmVaxRemove)}
        />
      )}

      {confirmWeightRemove && (
        <ConfirmModal
          onClose={() => setConfirmWeightRemove(null)}
          title={`Remove the ${confirmWeightRemove.weightLbs} lb entry?`}
          body={`Logged ${new Date(confirmWeightRemove.recordedAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}. Removing it can't be undone.`}
          confirmLabel="Remove"
          busy={removingWeight}
          onConfirm={() => removeWeight(confirmWeightRemove)}
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
