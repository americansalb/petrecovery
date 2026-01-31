'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AlertsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchRadius, setSearchRadius] = useState(25);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('status', 'OPEN');
      params.set('limit', '50');
      if (filter !== 'all') {
        params.set('species', filter.toUpperCase());
      }

      const res = await fetch(`/api/public/missions?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch alerts');
      }

      setAlerts(data.cases || []);
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError(err.message);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAlerts();
    }
  }, [status, fetchAlerts]);

  const getTimeAgo = (dateStr) => {
    if (!dateStr) return 'Recently';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div>Loading alerts...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'OPEN': return 'text-red-600';
      case 'ACTIVE': return 'text-red-600';
      case 'FOUND': return 'text-emerald-500';
      case 'CLOSED': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'OPEN': return 'bg-red-100';
      case 'ACTIVE': return 'bg-red-100';
      case 'FOUND': return 'bg-emerald-100';
      case 'CLOSED': return 'bg-gray-100';
      default: return 'bg-gray-100';
    }
  };

  const getSpeciesEmoji = (species) => {
    switch (species) {
      case 'DOG': return '🐕';
      case 'CAT': return '🐈';
      case 'BIRD': return '🦜';
      default: return '🐾';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {/* Header */}
      <div className="bg-blue-800 text-white p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-white no-underline text-2xl">
              ←
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Community Alerts</h1>
              <p className="text-sm opacity-90">{alerts.length} active in your area</p>
            </div>
          </div>
          <Link
            href="/report/new"
            className="px-4 py-2 bg-red-600 rounded-lg text-white no-underline text-sm font-semibold"
          >
            + Report
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4">
        {/* Error Message */}
        {error && (
          <div className="bg-red-100 border border-red-200 text-red-800 p-4 rounded-lg mb-4 flex justify-between items-center">
            <span>{error}</span>
            <button
              onClick={fetchAlerts}
              className="px-3 py-1 bg-red-800 text-white border-none rounded cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Pet Type
            </label>
            <div className="flex gap-2 flex-wrap">
              {['all', 'dog', 'cat', 'bird', 'other'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`px-4 py-2 border-none rounded-lg text-sm font-semibold cursor-pointer ${
                    filter === type
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Search Radius: {searchRadius} miles
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={searchRadius}
              onChange={(e) => setSearchRadius(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {/* Alerts List */}
        {alerts.length === 0 && !loading ? (
          <div className="bg-white rounded-xl py-12 px-4 text-center text-gray-500">
            <div className="text-5xl mb-2">🐾</div>
            <p className="font-semibold mb-2">No alerts found</p>
            <p className="text-sm">
              {filter !== 'all' ? 'Try selecting "All" to see more results' : 'No lost pets reported yet'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {alerts.map((alert) => (
              <Link
                key={alert.id}
                href={`/alerts/${alert.missionNumber || alert.id}`}
                className="bg-white rounded-xl p-5 shadow-md no-underline text-inherit block border-2 border-transparent hover:border-blue-200 transition-colors"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{getSpeciesEmoji(alert.petSpecies)}</span>
                      <h3 className="text-xl font-bold text-gray-800">
                        {alert.petName || 'Unknown Pet'}
                      </h3>
                      {alert.isUrgent && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold">
                          URGENT
                        </span>
                      )}
                      <span className={`px-2 py-1 ${getStatusBg(alert.status)} ${getStatusColor(alert.status)} rounded text-xs font-semibold`}>
                        {alert.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {alert.petBreed || alert.petSpecies} • {alert.petColor || 'Unknown color'}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div>{getTimeAgo(alert.lastSeenAt || alert.createdAt)}</div>
                    <div className="font-semibold text-blue-600">{alert.missionNumber}</div>
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-start gap-2 mb-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-base">📍</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-800 mb-1">Last Seen</div>
                    <div className="text-sm text-gray-500">
                      {alert.lastSeenLandmark || `${alert.city}, ${alert.state}`}{alert.zipCode && ` (${alert.zipCode})`}
                    </div>
                  </div>
                </div>

                {/* Description */}
                {alert.petDescription && (
                  <div className="text-sm text-gray-500 mb-3">
                    <strong className="text-gray-800">Description:</strong> {alert.petDescription.substring(0, 150)}{alert.petDescription.length > 150 ? '...' : ''}
                  </div>
                )}

                {/* Footer */}
                <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                  <div className="text-sm text-gray-500">Case #{alert.missionNumber}</div>
                  <span className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold">
                    View Details →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
