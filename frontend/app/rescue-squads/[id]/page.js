'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageLoading } from '@/components/LoadingSkeleton';
import { fetchWithRetry } from '@/app/lib/utils';

// Import V5 implementation
import SquadHubV5 from '@/components/squad/SquadHubV5';

export default function SquadHubPage({ params }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = params;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === 'loading') return;

    async function fetchData() {
      try {
        const res = await fetchWithRetry(`/api/rescue-squads/${id}/hub`);
        if (!res.ok) {
          if (res.status === 404) throw new Error('Squad not found');
          throw new Error('Failed to load squad data');
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Error loading squad hub:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id, status]);

  if (loading) return <PageLoading message="Loading Squad Hub..." />;

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Error</h1>
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/rescue-squads')}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700"
          >
            Back to Squads
          </button>
        </div>
      </div>
    );
  }

  return <SquadHubV5 initialData={data} squadId={id} />;
}
