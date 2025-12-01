'use client';

/**
 * Public Lost Pet Cases List Page
 * Phase 15-16: Public Lost Pet Case Portal MVP (TASK-P03)
 *
 * Route: /cases
 * Public-facing page for browsing lost pet cases
 * NO AUTHENTICATION REQUIRED
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import UnifiedNav from '@/app/components/UnifiedNav';

// Loading fallback for Suspense boundary
function CasesLoading() {
  return (
    <div className="min-h-screen bg-slate-950">
      <UnifiedNav />
      <div className="container mx-auto px-4 max-w-6xl py-12">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
          <p className="mt-4 text-slate-400">Loading cases...</p>
        </div>
      </div>
    </div>
  );
}

// Inner component that uses useSearchParams
function CasesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter state
  const [city, setCity] = useState(searchParams.get('city') || '');
  const [state, setState] = useState(searchParams.get('state') || '');
  const [species, setSpecies] = useState(searchParams.get('species') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));

  // Data state
  const [cases, setCases] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch cases
  useEffect(() => {
    fetchCases();
  }, [city, state, species, status, page]);

  const fetchCases = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (city) params.set('city', city);
      if (state) params.set('state', state);
      if (species) params.set('species', species);
      if (status) params.set('status', status);
      params.set('page', page.toString());
      params.set('limit', '20');

      const res = await fetch(`/api/public/cases?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to load cases');
      }

      setCases(data.cases || []);
      setPagination(data.pagination || null);
    } catch (err) {
      console.error('Error fetching cases:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Update URL when filters change
  const applyFilters = () => {
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (state) params.set('state', state);
    if (species) params.set('species', species);
    if (status) params.set('status', status);
    params.set('page', '1');

    router.push(`/cases?${params.toString()}`);
    setPage(1);
  };

  const clearFilters = () => {
    setCity('');
    setState('');
    setSpecies('');
    setStatus('');
    setPage(1);
    router.push('/cases');
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    if (state) params.set('state', state);
    if (species) params.set('species', species);
    if (status) params.set('status', status);
    params.set('page', newPage.toString());
    router.push(`/cases?${params.toString()}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'OPEN': return 'bg-blue-100 text-blue-800';
      case 'ACTIVE_SEARCH': return 'bg-yellow-100 text-yellow-800';
      case 'RESOLVED': return 'bg-green-100 text-green-800';
      case 'CLOSED_OTHER': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'OPEN': return 'Open';
      case 'ACTIVE_SEARCH': return 'Active Search';
      case 'RESOLVED': return 'Resolved';
      case 'CLOSED_OTHER': return 'Closed';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <UnifiedNav
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard', icon: '🏠' },
          { label: 'Browse Cases' }
        ]}
      />

      {/* Hero Section */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white py-8 border-b border-slate-700">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold">Lost Pet Cases</h1>
              <p className="text-slate-400 mt-1">
                Browse cases and help reunite pets with their families
              </p>
            </div>
            <a
              href="/report/new"
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition shadow-lg shadow-red-500/20"
            >
              Report Lost Pet
            </a>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-slate-900 border-b border-slate-800">
        <div className="container mx-auto px-4 max-w-6xl py-4">
          <h2 className="text-sm font-semibold mb-3 text-slate-400 uppercase tracking-wide">Filter Cases</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="State"
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
            <select
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            >
              <option value="">All Types</option>
              <option value="DOG">Dog</option>
              <option value="CAT">Cat</option>
              <option value="BIRD">Bird</option>
              <option value="OTHER">Other</option>
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="ACTIVE_SEARCH">Active Search</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED_OTHER">Closed</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={applyFilters}
                className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-400 transition font-medium"
              >
                Search
              </button>
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cases List */}
      <div className="container mx-auto px-4 max-w-6xl py-6">
        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
            <p className="mt-4 text-slate-400">Loading cases...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-6 text-center">
            <p className="text-red-300 font-semibold">Error loading cases</p>
            <p className="text-red-400 mt-2">{error}</p>
            <button
              onClick={fetchCases}
              className="mt-4 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && cases.length === 0 && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
            <p className="text-slate-300 text-lg mb-4">No cases found matching your filters.</p>
            <p className="text-slate-500 mb-6">Try adjusting your search criteria or clearing filters.</p>
            <button
              onClick={clearFilters}
              className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-400 transition"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Cases Grid */}
        {!loading && !error && cases.length > 0 && (
          <>
            <div className="mb-4 text-slate-400 text-sm">
              Showing {cases.length} of {pagination?.totalCount || 0} cases
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cases.map((caseItem) => (
                <a
                  key={caseItem.id}
                  href={`/cases/${caseItem.caseNumber}`}
                  className="bg-slate-800 rounded-xl hover:bg-slate-750 transition border border-slate-700 hover:border-slate-600 overflow-hidden group"
                >
                  {/* Pet Photo */}
                  {caseItem.petPhotoUrl ? (
                    <div className="h-40 bg-slate-700 overflow-hidden">
                      <img
                        src={caseItem.petPhotoUrl}
                        alt={caseItem.petName || 'Pet photo'}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center"><span class="text-5xl">🐾</span></div>';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="h-40 bg-slate-700 flex items-center justify-center">
                      <span className="text-5xl">{caseItem.petSpecies === 'DOG' ? '🐕' : caseItem.petSpecies === 'CAT' ? '🐈' : '🐾'}</span>
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-bold text-white">
                          {caseItem.petName || 'Unknown Pet'}
                        </h3>
                        <p className="text-xs text-slate-500">{caseItem.caseNumber}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(caseItem.status)}`}>
                        {getStatusLabel(caseItem.status)}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-slate-400">
                      <div className="flex items-center gap-2">
                        <span>{caseItem.petSpecies}</span>
                        {caseItem.petBreed && <span>• {caseItem.petBreed}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-lg">📍</span>
                        <span>{caseItem.city}, {caseItem.state}</span>
                      </div>
                      {caseItem.lastSeenAt && (
                        <div className="text-slate-500 text-xs">
                          Missing since {new Date(caseItem.lastSeenAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {caseItem.isUrgent && (
                      <div className="mt-3 bg-red-500/20 border border-red-500/30 rounded px-2 py-1">
                        <p className="text-xs text-red-400 font-semibold">URGENT</p>
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-slate-700 flex items-center justify-between">
                      <span className="text-cyan-400 text-sm font-medium group-hover:text-cyan-300 transition">
                        View Details
                      </span>
                      {(caseItem.status === 'ACTIVE' || caseItem.status === 'IN_PROGRESS' || caseItem.status === 'SIGHTING_REPORTED') && (
                        <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-medium">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                </a>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-8 flex justify-center items-center gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition"
                >
                  Previous
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                    let pageNum;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-4 py-2 rounded-lg transition ${
                          page === pageNum
                            ? 'bg-cyan-500 text-white'
                            : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === pagination.totalPages}
                  className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Default export wraps content in Suspense for useSearchParams
export default function PublicCasesPage() {
  return (
    <Suspense fallback={<CasesLoading />}>
      <CasesContent />
    </Suspense>
  );
}
