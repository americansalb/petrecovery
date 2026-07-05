'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, AlertTriangle, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardFooter } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

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
      <div className="min-h-screen flex items-center justify-center bg-midnight-50">
        <div className="text-midnight-600">Loading alerts...</div>
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
      case 'FOUND': return 'text-green-600';
      case 'CLOSED': return 'text-midnight-500';
      default: return 'text-midnight-500';
    }
  };

  const getStatusBg = (status) => {
    switch (status) {
      case 'OPEN': return 'bg-red-100';
      case 'ACTIVE': return 'bg-red-100';
      case 'FOUND': return 'bg-green-100';
      case 'CLOSED': return 'bg-midnight-100';
      default: return 'bg-midnight-100';
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
    <div className="min-h-screen bg-midnight-50 font-sans">
      {/* In-flow page header — the universal navbar owns the top of the
          screen; this heading scrolls away with the page */}
      <div className="bg-white border-b border-midnight-100 p-4">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-midnight-500 hover:text-midnight-700 no-underline" aria-label="Back to dashboard">
              <ArrowLeft size={24} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-midnight-900">Community Alerts</h1>
              <p className="text-sm text-midnight-500">{alerts.length} active in your area</p>
            </div>
          </div>
          <Link href="/report/new">
            <Button variant="danger" size="sm" leftIcon={Plus} aria-label="Report a lost or found pet">
              Report
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4">
        {/* Error Message */}
        {error && (
          <Card variant="danger" padding="md" className="mb-4">
            <div className="flex justify-between items-center">
              <span className="text-red-800">{error}</span>
              <Button variant="danger" size="sm" onClick={fetchAlerts}>
                Retry
              </Button>
            </div>
          </Card>
        )}

        {/* Filters */}
        <Card padding="md" className="mb-4">
          <div className="mb-4">
            <label className="block text-sm font-semibold text-midnight-700 mb-2">
              Pet Type
            </label>
            <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter by pet type">
              {['all', 'dog', 'cat', 'bird', 'other'].map((type) => (
                <Button
                  key={type}
                  variant={filter === type ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(type)}
                  aria-label={`Filter by ${type === 'all' ? 'all pets' : type + 's'}`}
                  aria-pressed={filter === type}
                >
                  {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1) + 's'}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="search-radius" className="block text-sm font-semibold text-midnight-700 mb-2">
              Search Radius: {searchRadius} miles
            </label>
            <input
              id="search-radius"
              type="range"
              min="1"
              max="50"
              value={searchRadius}
              onChange={(e) => setSearchRadius(e.target.value)}
              className="w-full"
              aria-label={`Search radius: ${searchRadius} miles`}
            />
          </div>
        </Card>

        {/* Alerts List */}
        {alerts.length === 0 && !loading ? (
          <Card padding="none">
            <EmptyState
              icon={Search}
              iconColor="amber"
              title="No alerts found"
              description={filter !== 'all' ? 'Try selecting "All" to see more results' : 'No lost pets reported yet'}
              tip="Check back regularly — alerts update as new reports come in."
              action={{ label: 'Report a Pet', href: '/report/new', icon: Plus }}
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {alerts.map((alert) => (
              <Link
                key={alert.id}
                href={`/alerts/${alert.missionNumber || alert.id}`}
                className="no-underline text-inherit block"
              >
                <Card hover padding="md">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl" role="img" aria-label={alert.petSpecies || 'Pet'}>
                          {getSpeciesEmoji(alert.petSpecies)}
                        </span>
                        <h3 className="text-xl font-bold text-midnight-900">
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
                      <p className="text-sm text-midnight-500">
                        {alert.petBreed || alert.petSpecies} • {alert.petColor || 'Unknown color'}
                      </p>
                    </div>
                    <div className="text-right text-sm text-midnight-500">
                      <div>{getTimeAgo(alert.lastSeenAt || alert.createdAt)}</div>
                      <div className="font-semibold text-midnight-700">{alert.missionNumber}</div>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-start gap-2 mb-3 p-3 bg-midnight-50 rounded-lg">
                    <span className="text-base" role="img" aria-label="Location">📍</span>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-midnight-800 mb-1">Last Seen</div>
                      <div className="text-sm text-midnight-500">
                        {alert.lastSeenLandmark || `${alert.city}, ${alert.state}`}{alert.zipCode && ` (${alert.zipCode})`}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {alert.petDescription && (
                    <div className="text-sm text-midnight-500 mb-3">
                      <strong className="text-midnight-800">Description:</strong> {alert.petDescription.substring(0, 150)}{alert.petDescription.length > 150 ? '...' : ''}
                    </div>
                  )}

                  {/* Footer */}
                  <CardFooter>
                    <div className="text-sm text-midnight-500">Case #{alert.missionNumber}</div>
                    <div className="ml-auto">
                      <Button variant="secondary" size="sm">
                        View Details
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
