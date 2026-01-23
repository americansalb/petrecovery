'use client';

/**
 * Force Hub Page
 *
 * Main page for a city's rescue force.
 * Displays the Force Hub with case queue, map, and activity panels.
 *
 * Route: /rescue-forces/[id]
 *
 * Fetches real data from /api/rescue-forces/[id]/hub
 * Falls back to mock data if the API fails (for development)
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import ForceHubV2 from '@/components/force/SquadHubV2';
// V3 attempt: import ForceHubV3 from '@/components/force/ForceHubV3';
import { getMockSquadData } from '@/lib/mockSquadData';

export default function ForcePage() {
  const params = useParams();
  const forceId = params.id;

  const [forceData, setSquadData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    async function fetchSquadData() {
      setLoading(true);
      setError(null);

      try {
        // Try to fetch real data from the hub API
        const res = await fetch(`/api/rescue-forces/${forceId}/hub`);

        if (res.ok) {
          const data = await res.json();
          console.log('[ForceHub Debug] API response:', {
            forceId: data.force?.id,
            forceName: data.force?.displayName,
            casesCount: data.cases?.length || 0,
            cases: data.cases,
          });
          setSquadData(data);
          setUsingMockData(false);
        } else if (res.status === 404) {
          // Force not found - try mock data for known city slugs
          const mockData = getMockSquadData(forceId);
          if (mockData && mockData.force) {
            setSquadData(mockData);
            setUsingMockData(true);
          } else {
            setError('Force not found');
          }
        } else {
          // Other error - fall back to mock data or show error
          const errorData = await res.json().catch(() => ({}));
          console.error('Hub API error:', errorData);
          const mockData = getMockSquadData(forceId);
          if (mockData && mockData.force) {
            setSquadData(mockData);
            setUsingMockData(true);
          } else {
            // No mock data available - show the actual error
            setError(`Failed to load force data: ${errorData.error || 'Server error'}`);
          }
        }
      } catch (err) {
        console.error('Failed to fetch hub data:', err);
        // Network error - fall back to mock data or show error
        const mockData = getMockSquadData(forceId);
        if (mockData && mockData.force) {
          setSquadData(mockData);
          setUsingMockData(true);
        } else {
          setError('Failed to connect to server. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    }

    if (forceId) {
      fetchSquadData();
    }
  }, [forceId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-midnight-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-flash-400"></div>
          <p className="mt-4 text-gray-400">Loading force hub...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isNotFound = error === 'Force not found';
    return (
      <div className="min-h-screen bg-midnight-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">{isNotFound ? '🐾' : '⚠️'}</div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {isNotFound ? 'Force Not Found' : 'Error Loading Force'}
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
              Find a Force Near You
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!forceData) {
    return null;
  }

  // Use the actual force ID from the API response (not the URL slug)
  // This ensures action APIs work correctly with the real database ID
  const resolvedForceId = forceData.force?.id || forceId;

  return (
    <>
      {usingMockData && process.env.NODE_ENV === 'development' && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-center text-amber-300 text-sm">
          Using mock data (real force not found in database)
        </div>
      )}
      <ForceHubV2 initialData={forceData} forceId={resolvedForceId} />
    </>
  );
}
