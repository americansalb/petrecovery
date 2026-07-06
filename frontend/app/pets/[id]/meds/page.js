'use client';

/**
 * Meds tab (direction D). Subtabs: Active (manage the medication list,
 * schedules, supply) and History (the full dose log). Doses are logged on
 * Today; this screen is management + record. Care routines are not
 * medications and live on Today.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, X } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { ConfirmModal } from '@/components/ui';
import { MedCard, ActivityFeed } from '@/app/components/medications/MedCards';
import { Card, Overline } from '@/app/components/care/kit/Tile';
import SubTabs from '@/app/components/care/kit/SubTabs';

function MedsInner() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const petId = params.id;

  const [tab, setTab] = useState(searchParams.get('tab') === 'history' ? 'history' : 'active');
  const [access, setAccess] = useState('OWNER');
  const [meds, setMeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyMed, setBusyMed] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { if (status === 'unauthenticated') router.push(`/login?callbackUrl=/pets/${petId}/meds`); }, [status, router, petId]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/pets/${petId}/medications`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setAccess(data.access || 'OWNER');
      setMeds((data.medications || []).filter((m) => m.kind !== 'CARE'));
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [petId]);

  useEffect(() => { if (status === 'authenticated' && petId) load(); }, [status, petId, load]);

  const withMedBusy = async (med, fn) => { setBusyMed(med.id); try { await fn(); } catch (e) { setError(e.message); } finally { setBusyMed(null); } };

  const togglePause = (med) => withMedBusy(med, async () => {
    const res = await fetch(`/api/pets/${petId}/medications/${med.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !med.isActive }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update');
    setMeds((prev) => prev.map((m) => (m.id === med.id ? data.medication : m)));
  });

  const deleteMed = (med) => withMedBusy(med, async () => {
    const res = await fetch(`/api/pets/${petId}/medications/${med.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete');
    setMeds((prev) => prev.filter((m) => m.id !== med.id));
    setConfirmDelete(null);
  });

  if (status === 'loading' || loading) return <div className="min-h-[50vh] flex items-center justify-center"><LoadingSpinner text="Loading..." /></div>;
  if (status === 'unauthenticated') return null;

  const canManage = access !== 'VIEWER';
  const active = meds.filter((m) => m.isActive);
  const paused = meds.filter((m) => !m.isActive);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl">
      <div className="flex items-end justify-between gap-3 mb-4">
        <h1 className="text-[24px] font-semibold tracking-tight text-care-ink">Medications</h1>
        {canManage && (
          <Link href={`/pets/${petId}/medications/new`} className="inline-flex items-center gap-1.5 rounded-xl bg-care-teal text-white text-[13.5px] font-semibold px-4 py-2 hover:bg-care-tealDark transition-colors">
            <Plus size={15} /> Add
          </Link>
        )}
      </div>

      <SubTabs
        tabs={[{ id: 'active', label: 'Active', badge: active.length }, { id: 'history', label: 'History' }]}
        active={tab}
        onChange={setTab}
        className="mb-5"
      />

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-red-50 text-red-700 text-sm px-4 py-3 mb-4">
          <span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss" className="text-red-600 hover:text-red-800"><X size={16} /></button>
        </div>
      )}

      {tab === 'active' ? (
        meds.length === 0 ? (
          <Card className="text-center py-12 px-6">
            <p className="text-[16px] font-semibold text-care-ink">No medications yet</p>
            <p className="text-[14px] text-care-sub mt-1 mb-5">Add one and log doses with a tap on Today.</p>
            {canManage && <Link href={`/pets/${petId}/medications/new`} className="inline-flex items-center gap-2 rounded-xl bg-care-teal text-white text-sm font-semibold px-5 py-2.5 hover:bg-care-tealDark transition-colors"><Plus size={16} /> Add a medication</Link>}
          </Card>
        ) : (
          <div className="flex flex-col gap-5">
            {active.length > 0 && (
              <Card className="overflow-hidden divide-y divide-care-lineSoft">
                {active.map((med) => <MedCard key={med.id} med={med} petId={petId} busy={busyMed === med.id} canManage={canManage} onTogglePause={togglePause} onDelete={setConfirmDelete} />)}
              </Card>
            )}
            {paused.length > 0 && (
              <div>
                <Overline className="mb-2.5">Paused</Overline>
                <Card className="overflow-hidden divide-y divide-care-lineSoft">
                  {paused.map((med) => <MedCard key={med.id} med={med} petId={petId} busy={busyMed === med.id} canManage={canManage} onTogglePause={togglePause} onDelete={setConfirmDelete} />)}
                </Card>
              </div>
            )}
            <div className="flex justify-end">
              <a href={`/api/pets/${petId}/medications/export`} download className="text-[13px] font-medium text-care-sub hover:text-care-ink transition-colors" title="Download a full backup of all medication data">Download backup</a>
            </div>
          </div>
        )
      ) : (
        <Card className="overflow-hidden">
          <div className="px-5 pt-4 pb-1"><Overline>Dose log</Overline></div>
          <ActivityFeed meds={meds} />
        </Card>
      )}

      {confirmDelete && (
        <ConfirmModal
          onClose={() => setConfirmDelete(null)}
          title={`Delete ${confirmDelete.name}?`}
          body="This removes the medication and its full dose history. This cannot be undone."
          confirmLabel="Delete"
          busy={busyMed === confirmDelete.id}
          onConfirm={() => deleteMed(confirmDelete)}
        />
      )}
    </div>
  );
}

export default function MedsPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center"><LoadingSpinner /></div>}>
      <MedsInner />
    </Suspense>
  );
}
