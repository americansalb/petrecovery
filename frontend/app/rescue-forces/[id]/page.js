'use client';

/**
 * Squad Hub Page
 *
 * Main page for a city's rescue force.
 * Displays the Squad Hub with case queue, map, and activity panels.
 *
 * Route: /rescue-forces/[id]
 *
 * Fetches real data from /api/rescue-squads/[id]/hub
 * Falls back to mock data if the API fails (for development)
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import SquadHubV2 from '@/components/squad/SquadHubV2';
import { getMockSquadData } from '@/lib/mockSquadData';

export default function SquadPage() {
  const params = useParams();
  const squadId = params.id;

  const [squadData, setSquadData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);

  const fetchSquadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/hub`);

      if (res.ok) {
        const data = await res.json();
        setSquadData(data);
        setUsingMockData(false);
      } else if (res.status === 404) {
        const mockData = getMockSquadData(squadId);
        if (mockData && mockData.squad) {
          setSquadData(mockData);
          setUsingMockData(true);
        } else {
          setError('Rescue Force not found');
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Hub API error:', errorData);
        const mockData = getMockSquadData(squadId);
        if (mockData && mockData.squad) {
          setSquadData(mockData);
          setUsingMockData(true);
        } else {
          setError(`Failed to load rescue force data: ${errorData.error || 'Server error'}`);
        }
      }
    } catch (err) {
      console.error('Failed to fetch hub data:', err);
      const mockData = getMockSquadData(squadId);
      if (mockData && mockData.squad) {
        setSquadData(mockData);
        setUsingMockData(true);
      } else {
        setError('Failed to connect to server. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [squadId]);

  useEffect(() => {
    if (squadId) {
      fetchSquadData();
    }
  }, [squadId, fetchSquadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-midnight-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-flash-400"></div>
          <p className="mt-4 text-gray-400">Loading rescue force hub...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isNotFound = error === 'Rescue Force not found';
    return (
      <div className="min-h-screen bg-midnight-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">{isNotFound ? '🐾' : '⚠️'}</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {isNotFound ? 'Rescue Force Not Found' : 'Error Loading Rescue Force'}
          </h1>
          <p className="text-gray-400 mb-6">
            {isNotFound
              ? "We couldn't find a rescue force with that ID. It may not exist yet or the link may be incorrect."
              : error}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
            >
              Try Again
            </button>
            <a
              href="/rescue-forces/search"
              className="px-6 py-3 bg-flash-500 text-midnight-900 font-semibold rounded-lg hover:bg-flash-600 transition"
            >
              Find a Rescue Force Near You
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!squadData) {
    return null;
  }

  // Use the actual squad ID from the API response (not the URL slug)
  // This ensures action APIs work correctly with the real database ID
  const resolvedSquadId = squadData.squad?.id || squadId;

  return (
    <>
      {usingMockData && process.env.NODE_ENV === 'development' && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-center text-amber-300 text-sm">
          Using mock data (real squad not found in database)
        </div>
      )}
      <SquadHubV2 initialData={squadData} squadId={resolvedSquadId} onRefresh={fetchSquadData} />
    </>
  );
}
