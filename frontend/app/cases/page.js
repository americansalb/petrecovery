'use client';

/**
 * Public Lost Pet Cases List Page - Updated with PetRecovery Design System
 * Uses: Midnight Blue + Flashlight Yellow color palette
 *
 * Route: /cases
 * Public-facing page for browsing lost pet cases
 * NO AUTHENTICATION REQUIRED
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, MapPin, Calendar, Filter, X, AlertTriangle, ChevronLeft, ChevronRight, Loader2, PawPrint } from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';

// Loading fallback for Suspense boundary
function CasesLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-midnight-100 to-midnight-200">
      <div className="container mx-auto px-4 max-w-6xl py-12">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-flash-400 animate-spin mx-auto" />
          <p className="mt-4 text-midnight-500 font-medium">Loading cases...</p>
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

  // Status badge variant
  const getStatusVariant = (status) => {
    switch (status) {
      case 'OPEN': return 'primary';
      case 'ACTIVE_SEARCH': return 'warning';
      case 'RESOLVED': return 'success';
      case 'CLOSED_OTHER': return 'default';
      default: return 'default';
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

  const getSpeciesEmoji = (species) => {
    switch (species) {
      case 'DOG': return '🐕';
      case 'CAT': return '🐈';
      case 'BIRD': return '🐦';
      default: return '🐾';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-midnight-100 to-midnight-200">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-midnight-900 to-midnight-800 text-white py-10">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">Lost Pet Cases</h1>
              <p className="text-midnight-300 mt-2">
                Browse cases and help reunite pets with their families
              </p>
            </div>
            <Link href="/report/new">
              <Button size="lg" className="shadow-lg shadow-flash-400/20">
                Report Lost Pet
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white shadow-sm border-b border-midnight-200">
        <div className="container mx-auto px-4 max-w-6xl py-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-midnight-500" />
            <span className="text-sm font-semibold text-midnight-700">Filter Cases</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="px-4 py-2.5 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400"
            />
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="State"
              className="px-4 py-2.5 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 placeholder-midnight-400"
            />
            <select
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              className="px-4 py-2.5 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 bg-white"
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
              className="px-4 py-2.5 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition text-midnight-900 bg-white"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="ACTIVE_SEARCH">Active Search</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED_OTHER">Closed</option>
            </select>
            <div className="flex gap-2">
              <Button onClick={applyFilters} leftIcon={Search} className="flex-1">
                Search
              </Button>
              <Button variant="secondary" onClick={clearFilters} leftIcon={X}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Cases List */}
      <div className="container mx-auto px-4 max-w-6xl py-8">
        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 text-flash-400 animate-spin mx-auto" />
            <p className="mt-4 text-midnight-500 font-medium">Loading cases...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <Card variant="danger" className="p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-800 font-semibold text-lg">Error loading cases</p>
            <p className="text-red-600 mt-2">{error}</p>
            <Button variant="danger" onClick={fetchCases} className="mt-6">
              Try Again
            </Button>
          </Card>
        )}

        {/* Empty State */}
        {!loading && !error && cases.length === 0 && (
          <Card className="p-12 text-center">
            <PawPrint className="w-16 h-16 text-midnight-300 mx-auto mb-4" />
            <p className="text-midnight-700 text-xl font-semibold mb-2">No cases found</p>
            <p className="text-midnight-500 mb-6">Try adjusting your search criteria or clearing filters.</p>
            <Button onClick={clearFilters}>
              Clear Filters
            </Button>
          </Card>
        )}

        {/* Cases Grid */}
        {!loading && !error && cases.length > 0 && (
          <>
            <div className="mb-4 text-midnight-500 text-sm font-medium">
              Showing {cases.length} of {pagination?.totalCount || 0} cases
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {cases.map((caseItem) => (
                <Link
                  key={caseItem.id}
                  href={`/cases/${caseItem.caseNumber}`}
                  className="block group"
                >
                  <Card className="overflow-hidden hover:shadow-card-hover transition-all duration-300 h-full">
                    {/* Pet Photo */}
                    {caseItem.petPhotoUrl ? (
                      <div className="h-44 bg-midnight-100 overflow-hidden">
                        <img
                          src={caseItem.petPhotoUrl}
                          alt={caseItem.petName || 'Pet photo'}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-midnight-100"><span class="text-6xl">🐾</span></div>';
                          }}
                        />
                      </div>
                    ) : (
                      <div className="h-44 bg-gradient-to-br from-midnight-100 to-midnight-200 flex items-center justify-center">
                        <span className="text-6xl">{getSpeciesEmoji(caseItem.petSpecies)}</span>
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-midnight-900 text-lg group-hover:text-flash-600 transition">
                            {caseItem.petName || 'Unknown Pet'}
                          </h3>
                          <p className="text-xs text-midnight-400 font-mono">{caseItem.caseNumber}</p>
                        </div>
                        <Badge variant={getStatusVariant(caseItem.status)} size="sm">
                          {getStatusLabel(caseItem.status)}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm text-midnight-600">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getSpeciesEmoji(caseItem.petSpecies)}</span>
                          <span className="font-medium">{caseItem.petSpecies}</span>
                          {caseItem.petBreed && <span className="text-midnight-400">• {caseItem.petBreed}</span>}
                        </div>
                        <div className="flex items-center gap-2 text-midnight-500">
                          <MapPin className="w-4 h-4" />
                          <span>{caseItem.city}, {caseItem.state}</span>
                        </div>
                        {caseItem.lastSeenAt && (
                          <div className="flex items-center gap-2 text-midnight-400 text-xs">
                            <Calendar className="w-3 h-3" />
                            <span>Missing since {new Date(caseItem.lastSeenAt).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      {caseItem.isUrgent && (
                        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <span className="text-xs text-red-700 font-bold">URGENT</span>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-midnight-100 flex items-center justify-between">
                        <span className="text-flash-600 text-sm font-semibold group-hover:text-flash-500 transition flex items-center gap-1">
                          View Details
                          <ChevronRight className="w-4 h-4" />
                        </span>
                        {(caseItem.status === 'ACTIVE' || caseItem.status === 'IN_PROGRESS' || caseItem.status === 'SIGHTING_REPORTED') && (
                          <Badge variant="success" size="sm">Active</Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-10 flex justify-center items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  leftIcon={ChevronLeft}
                >
                  Previous
                </Button>
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
                        className={`w-10 h-10 rounded-xl font-semibold transition ${
                          page === pageNum
                            ? 'bg-flash-400 text-midnight-900'
                            : 'bg-white border-2 border-midnight-200 text-midnight-700 hover:border-flash-400 hover:text-midnight-900'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === pagination.totalPages}
                  rightIcon={ChevronRight}
                >
                  Next
                </Button>
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
