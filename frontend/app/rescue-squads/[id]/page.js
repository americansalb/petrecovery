'use client';

/**
 * Squad Hub Page
 *
 * Main page for a city's rescue squad.
 * Displays the Squad Hub with case queue, map, and activity panels.
 *
 * Route: /rescue-squads/[id]
 *
 * Fetches real data from /api/rescue-squads/[id]/hub
 * Falls back to mock data if the API fails (for development)
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import SquadHub from '@/components/squad/SquadHub';
import { getMockSquadData } from '@/lib/mockSquadData';

export default function SquadPage() {
  const params = useParams();
  const squadId = params.id;

  const [squadData, setSquadData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    async function fetchSquadData() {
      setLoading(true);
      setError(null);

      try {
        // Try to fetch real data from the hub API
        const res = await fetch(`/api/rescue-squads/${squadId}/hub`);

        if (res.ok) {
          const data = await res.json();
          setSquadData(data);
          setUsingMockData(false);
        } else if (res.status === 404) {
          // Squad not found - try mock data for known city slugs
          const mockData = getMockSquadData(squadId);
          if (mockData && mockData.squad) {
            setSquadData(mockData);
            setUsingMockData(true);
          } else {
            setError('Squad not found');
          }
        } else {
          // Other error - fall back to mock data
          const errorData = await res.json().catch(() => ({}));
          console.warn('Hub API error, falling back to mock data:', errorData);
          const mockData = getMockSquadData(squadId);
          setSquadData(mockData);
          setUsingMockData(true);
        }
      } catch (err) {
        console.warn('Failed to fetch hub data, using mock data:', err);
        // Network error - fall back to mock data
        const mockData = getMockSquadData(squadId);
        setSquadData(mockData);
        setUsingMockData(true);
      } finally {
        setLoading(false);
      }
    }

    if (squadId) {
      fetchSquadData();
    }
  }, [squadId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
          <p className="mt-4 text-gray-400">Loading squad hub...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">🐾</div>
          <h1 className="text-2xl font-bold text-white mb-2">Squad Not Found</h1>
          <p className="text-gray-400 mb-6">
            We couldn't find a rescue squad with that ID. It may not exist yet or the link may be incorrect.
          </p>
          <a
            href="/rescue-squads/search"
            className="inline-block px-6 py-3 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition"
          >
            Find a Squad Near You
          </a>
        </div>
      </div>
    );
  }

  if (!squadData) {
    return null;
  }

  return (
    <>
      {usingMockData && process.env.NODE_ENV === 'development' && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-center text-amber-300 text-sm">
          ⚠️ Using mock data (real squad not found in database)
        </div>
      )}
      <SquadHub initialData={squadData} squadId={squadId} />
    </>
  );
}
