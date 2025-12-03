'use client';

/**
 * Division Page
 *
 * Individual division page - same structure as squad page but scoped to division
 * Route: /rescue-squads/[id]/divisions/[divisionId]
 *
 * Reuses SquadHubV2 component with isDivisionPage=true
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import SquadHubV2 from '@/components/squad/SquadHubV2';

export default function DivisionPage() {
  const params = useParams();
  const squadId = params.id;
  const divisionId = params.divisionId;

  const [squadData, setSquadData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch squad hub data (same API, but we'll filter on client side)
        const res = await fetch(`/api/rescue-squads/${squadId}/hub`);

        if (res.ok) {
          const data = await res.json();

          // Verify division exists in this squad
          const division = data.divisions?.find(d => d.id === divisionId);
          if (!division) {
            setError('Division not found');
            return;
          }

          setSquadData(data);
        } else if (res.status === 404) {
          setError('Squad not found');
        } else {
          const errorData = await res.json().catch(() => ({}));
          setError(`Failed to load division data: ${errorData.error || 'Server error'}`);
        }
      } catch (err) {
        console.error('Failed to fetch division data:', err);
        setError('Failed to connect to server. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    if (squadId && divisionId) {
      fetchData();
    }
  }, [squadId, divisionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-flash-400"></div>
          <p className="mt-4 text-gray-400">Loading division...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">🐾</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {error === 'Division not found' ? 'Division Not Found' : 'Error Loading Division'}
          </h1>
          <p className="text-gray-400 mb-6">
            {error}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
            >
              Try Again
            </button>
            <a
              href={`/rescue-squads/${squadId}`}
              className="px-6 py-3 bg-flash-500 text-midnight-900 font-semibold rounded-lg hover:bg-flash-600 transition"
            >
              View Full Squad
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!squadData) {
    return null;
  }

  return (
    <SquadHubV2
      initialData={squadData}
      squadId={squadId}
      isDivisionPage={true}
      currentDivisionId={divisionId}
    />
  );
}
