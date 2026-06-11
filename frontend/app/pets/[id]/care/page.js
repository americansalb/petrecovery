'use client';

/**
 * The Care room - daily life, with space to grow
 *
 * Walks, brushing, treats, playtime: a peer of Medications, not a
 * footnote on the Overview. Today's chips up top, the routine history
 * beneath, and headroom for streaks and reminders later. Same proven
 * dose engine underneath (kind: CARE rows on PetMedication).
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { History, Eye } from 'lucide-react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import { Card, Badge } from '@/components/ui';
import GoodStuff from '@/app/components/care/GoodStuff';
import { sameDay, careEmoji } from '@/lib/medications';

function formatWhen(value) {
  const d = new Date(value);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay(d, new Date())) return `Today · ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
}

export default function PetCarePage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const petId = params.id;

  const [meds, setMeds] = useState([]);
  const [access, setAccess] = useState('OWNER');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=/pets/${petId}/care`);
    }
  }, [status, router, petId]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/pets/${petId}/medications`);
      if (res.ok) {
        const data = await res.json();
        setMeds(data.medications || []);
        setAccess(data.access || 'OWNER');
      }
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    if (status === 'authenticated' && petId) load();
  }, [status, petId, load]);

  const careHistory = useMemo(() => {
    const out = [];
    for (const med of meds.filter((m) => m.kind === 'CARE')) {
      for (const dose of med.doses || []) {
        if (dose.deletedAt || dose.status !== 'GIVEN') continue;
        out.push({ med, dose, at: new Date(dose.givenAt || dose.scheduledFor) });
      }
    }
    return out.sort((a, b) => b.at - a.at).slice(0, 14);
  }, [meds]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoadingSpinner text="Loading care..." />
      </div>
    );
  }
  if (status === 'unauthenticated') return null;

  const canManage = access !== 'VIEWER';

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="max-w-3xl mx-auto">
        {!canManage && (
          <div className="mb-4 flex justify-end">
            <Badge variant="default" icon={Eye}>View only</Badge>
          </div>
        )}

        <GoodStuff petId={petId} meds={meds} setMeds={setMeds} canManage={canManage} />

        {careHistory.length > 0 && (
          <Card padding="lg">
            <h2 className="flex items-center gap-2 font-bold text-midnight-900 mb-3">
              <History size={18} className="text-midnight-400" /> Recent joys
            </h2>
            <ul className="divide-y divide-midnight-100">
              {careHistory.map(({ med, dose, at }) => (
                <li key={dose.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  <span className="w-8 h-8 rounded-lg bg-midnight-50 border border-midnight-100 flex items-center justify-center text-lg shrink-0" aria-hidden="true">
                    {careEmoji(med.name)}
                  </span>
                  <span className="flex-1 min-w-0 text-sm font-semibold text-midnight-800 truncate">{med.name}</span>
                  <span className="text-xs text-midnight-500 whitespace-nowrap">{formatWhen(at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
