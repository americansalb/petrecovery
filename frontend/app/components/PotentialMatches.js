'use client';

/**
 * Phase 9: Potential Matches Component
 *
 * Display potential matches from shelters for a lost pet case.
 */

import { useState, useEffect } from 'react';
import { useToast } from '@/app/components/ui/Toast';

const MATCH_STATUSES = {
  PENDING: { label: 'Not Reviewed', color: 'bg-gray-100 text-gray-700' },
  POSSIBLE: { label: 'Possible Match', color: 'bg-yellow-100 text-yellow-800' },
  LIKELY: { label: 'Likely Match', color: 'bg-green-100 text-green-800' },
  NOT_MATCH: { label: 'Not a Match', color: 'bg-red-100 text-red-800' },
  CONFIRMED: { label: 'Confirmed!', color: 'bg-blue-100 text-blue-800' },
};

export default function PotentialMatches({ missionId, className = '' }) {
  const toast = useToast();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [petName, setPetName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMatches();
  }, [missionId]);

  const fetchMatches = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/missions/${missionId}/matches`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch matches');
      }

      setMatches(data.matches || []);
      setPetName(data.petName);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const refreshMatches = async () => {
    setRefreshing(true);
    await fetchMatches();
    setRefreshing(false);
  };

  const updateMatchStatus = async (match, status) => {
    try {
      const response = await fetch(`/api/missions/${missionId}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: match.externalId,
          source: match.source,
          status,
          matchData: match,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // Update local state
      setMatches((prev) =>
        prev.map((m) =>
          m.externalId === match.externalId
            ? { ...m, savedStatus: status }
            : m
        )
      );
    } catch (err) {
      console.error('Update status error:', err);
      toast.error('Failed to update match status.');
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <p className="text-red-800">{error}</p>
        <button
          onClick={fetchMatches}
          className="mt-2 text-sm text-red-600 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Potential Shelter Matches
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Found {matches.length} potential matches for {petName}
            </p>
          </div>
          <button
            onClick={refreshMatches}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Matches */}
      {matches.length > 0 ? (
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                onStatusChange={(status) => updateMatchStatus(match, status)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="p-12 text-center">
          <svg
            className="w-16 h-16 mx-auto text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No matches found yet
          </h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            We're continuously searching shelter databases for potential matches.
            Check back later or try refreshing.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Individual Match Card
 */
function MatchCard({ match, onStatusChange }) {
  const [showDetails, setShowDetails] = useState(false);
  const primaryPhoto = match.photos?.[0]?.medium || match.photos?.[0]?.full;
  const status = MATCH_STATUSES[match.savedStatus] || MATCH_STATUSES.PENDING;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex">
        {/* Photo */}
        <div className="w-32 h-32 flex-shrink-0 bg-gray-100">
          {primaryPhoto ? (
            <img
              src={primaryPhoto}
              alt={match.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold text-gray-900">{match.name}</h3>
              <p className="text-sm text-gray-600">
                {match.breeds?.primary}
                {match.breeds?.mixed ? ' Mix' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-blue-600">
                {Math.round(match.matchScore * 100)}% match
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${status.color}`}>
            {status.label}
          </span>

          {/* Quick Info */}
          <div className="mt-2 flex flex-wrap gap-1 text-xs text-gray-500">
            {match.gender && <span>{match.gender}</span>}
            {match.age && <span>• {match.age}</span>}
            {match.size && <span>• {match.size}</span>}
            {match.distance !== undefined && (
              <span>• {Math.round(match.distance)} mi away</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => onStatusChange('NOT_MATCH')}
              className={`px-3 py-1 text-xs rounded ${
                match.savedStatus === 'NOT_MATCH'
                  ? 'bg-red-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Not a Match
            </button>
            <button
              onClick={() => onStatusChange('POSSIBLE')}
              className={`px-3 py-1 text-xs rounded ${
                match.savedStatus === 'POSSIBLE'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Possible
            </button>
            <button
              onClick={() => onStatusChange('LIKELY')}
              className={`px-3 py-1 text-xs rounded ${
                match.savedStatus === 'LIKELY'
                  ? 'bg-green-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              Likely!
            </button>
          </div>

          {match.url && (
            <a
              href={match.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              View Details →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
