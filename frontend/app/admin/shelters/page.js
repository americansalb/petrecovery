'use client';

/**
 * Admin Shelters Page
 *
 * View and manage all shelters in the database.
 * Shelters are populated from Apple Maps searches.
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  MapPin,
  Phone,
  Globe,
  Clock,
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Trash2,
  ExternalLink,
  Database,
  Mail,
  CheckSquare,
  Square,
  AlertTriangle,
} from 'lucide-react';

const SHELTER_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'SHELTER', label: 'Shelter' },
  { value: 'ANIMAL_CONTROL', label: 'Animal Control' },
  { value: 'RESCUE', label: 'Rescue' },
  { value: 'VET', label: 'Veterinary' },
];

const STATES = [
  '', 'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

export default function AdminSheltersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [shelters, setShelters] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncLocation, setSyncLocation] = useState('');
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    state: '',
    city: '',
  });

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 25;

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/admin/shelters');
    } else if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session?.user?.role === 'ADMIN') {
      fetchShelters();
    }
  }, [session, page, filters]);

  const fetchShelters = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filters.search) params.set('search', filters.search);
      if (filters.type) params.set('type', filters.type);
      if (filters.state) params.set('state', filters.state);
      if (filters.city) params.set('city', filters.city);

      const response = await fetch(`/api/admin/shelters?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch shelters');
      }

      setShelters(data.shelters || []);
      setStats(data.stats || null);
      setTotalPages(Math.ceil((data.total || 0) / limit));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleDelete = async (shelterId) => {
    if (!confirm('Are you sure you want to delete this shelter?')) return;

    try {
      const response = await fetch(`/api/admin/shelters/${shelterId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete shelter');
      }

      fetchShelters();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === shelters.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(shelters.map(s => s.id)));
    }
  };

  const handleSelectOne = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected shelter(s)?`)) return;

    setBulkLoading(true);
    try {
      const response = await fetch('/api/admin/shelters', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete shelters');
      }

      alert(`Successfully deleted ${data.deletedCount} shelter(s)`);
      setSelectedIds(new Set());
      fetchShelters();
    } catch (err) {
      alert(err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('⚠️ WARNING: This will delete ALL shelters from the database. Are you sure?')) return;
    if (!confirm('This action cannot be undone easily. Type "DELETE ALL" in the next prompt to confirm.')) return;

    const confirmation = prompt('Type "DELETE ALL" to confirm:');
    if (confirmation !== 'DELETE ALL') {
      alert('Deletion cancelled.');
      return;
    }

    setBulkLoading(true);
    try {
      const response = await fetch('/api/admin/shelters', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete shelters');
      }

      alert(`Successfully deleted ${data.deletedCount} shelter(s)`);
      setSelectedIds(new Set());
      fetchShelters();
    } catch (err) {
      alert(err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSync = async () => {
    if (!syncLocation.trim()) {
      alert('Please enter a location (e.g., "Los Angeles, CA" or "90210")');
      return;
    }

    setSyncing(true);
    try {
      const response = await fetch('/api/admin/shelters/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: syncLocation.trim(),
          radius: 50,
          syncType: 'shelters',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sync failed');
      }

      alert(`Sync complete! Found ${data.results?.shelters?.count || 0} shelters near ${syncLocation}`);
      setShowSyncModal(false);
      setSyncLocation('');
      fetchShelters();
    } catch (err) {
      alert('Sync error: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  if (status === 'loading' || (session?.user?.role === 'ADMIN' && loading && !shelters.length)) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (session?.user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Link href="/admin" className="hover:text-blue-600">Admin</Link>
                <span>/</span>
                <span>Shelters</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Database className="w-7 h-7 text-blue-600" />
                Shelter Database
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected ({selectedIds.size})
                </button>
              )}
              <button
                onClick={handleDeleteAll}
                disabled={bulkLoading || loading}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50"
              >
                <AlertTriangle className="w-4 h-4" />
                Delete All
              </button>
              <button
                onClick={() => setShowSyncModal(true)}
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                <MapPin className="w-4 h-4" />
                Sync New Data
              </button>
              <button
                onClick={fetchShelters}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{stats.total?.toLocaleString() || 0}</p>
                  <p className="text-xs text-gray-500">Total</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{stats.cities || 0}</p>
                  <p className="text-xs text-gray-500">Cities</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Phone className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{stats.withPhone || 0}</p>
                  <p className="text-xs text-gray-500">W/ Phone</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                  <Mail className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{stats.withEmail || 0}</p>
                  <p className="text-xs text-gray-500">W/ Email</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                  <Globe className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{stats.withWebsite || 0}</p>
                  <p className="text-xs text-gray-500">W/ Website</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{stats.withHours || 0}</p>
                  <p className="text-xs text-gray-500">W/ Hours</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="font-medium text-gray-700">Filters</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search by name..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {SHELTER_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <select
              value={filters.state}
              onChange={(e) => handleFilterChange('state', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All States</option>
              {STATES.filter(s => s).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <input
              type="text"
              value={filters.city}
              onChange={(e) => handleFilterChange('city', e.target.value)}
              placeholder="City..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Shelters Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center gap-2 hover:text-gray-700"
                      disabled={shelters.length === 0}
                    >
                      {selectedIds.size === shelters.length && shelters.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shelter</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Website</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {shelters.map((shelter) => (
                  <tr key={shelter.id} className={`hover:bg-gray-50 ${selectedIds.has(shelter.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleSelectOne(shelter.id)}
                        className="flex items-center"
                      >
                        {selectedIds.has(shelter.id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">{shelter.name}</div>
                      {shelter.hours && (
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          Has hours
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">{shelter.city}, {shelter.state}</div>
                      <div className="text-xs text-gray-500">{shelter.address}</div>
                    </td>
                    <td className="px-4 py-4">
                      {shelter.phone ? (
                        <a
                          href={`tel:${shelter.phone}`}
                          className="text-sm text-gray-900 hover:text-blue-600 flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          {shelter.phone}
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {shelter.email ? (
                        <a
                          href={`mailto:${shelter.email}`}
                          className="text-sm text-gray-900 hover:text-blue-600 truncate max-w-[150px] block"
                        >
                          {shelter.email}
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {shelter.website ? (
                        <a
                          href={shelter.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <Globe className="w-3 h-3" />
                          Visit
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {shelter.hours ? (
                        <span className="text-xs text-gray-700" title={typeof shelter.hours === 'string' ? shelter.hours : JSON.stringify(shelter.hours)}>
                          <Clock className="w-3 h-3 inline mr-1" />
                          Available
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        shelter.type === 'SHELTER' ? 'bg-emerald-100 text-emerald-700' :
                        shelter.type === 'ANIMAL_CONTROL' ? 'bg-blue-100 text-blue-700' :
                        shelter.type === 'RESCUE' ? 'bg-purple-100 text-purple-700' :
                        shelter.type === 'VET' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {shelter.type}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-gray-500">
                        {shelter.source === 'APPLE_MAPKIT' ? 'Apple Maps' : shelter.source}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-xs text-gray-500">
                        {shelter.fetchedAt ? new Date(shelter.fetchedAt).toLocaleDateString() : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={() => handleDelete(shelter.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}

                {shelters.length === 0 && !loading && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-gray-500 whitespace-normal">
                      <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No shelters found</p>
                      <p className="text-sm mt-1">Shelters are added when users search on the Find Shelters page</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-600" />
              Sync Shelter Data
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter a location to fetch fresh shelter data from Apple Maps. This will add new shelters to your database.
            </p>
            <input
              type="text"
              value={syncLocation}
              onChange={(e) => setSyncLocation(e.target.value)}
              placeholder="e.g., Los Angeles, CA or 90210"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 mb-4"
              onKeyDown={(e) => e.key === 'Enter' && handleSync()}
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSyncModal(false);
                  setSyncLocation('');
                }}
                disabled={syncing}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSync}
                disabled={syncing || !syncLocation.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sync Data
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
