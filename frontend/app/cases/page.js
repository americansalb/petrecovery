'use client';

// /cases/page.js
// Public lost pet case listing page

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function PublicCasesPage() {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    species: '',
    status: 'ACTIVE',
  });

  useEffect(() => {
    fetchCases();
  }, [filters]);

  async function fetchCases() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.species) params.set('species', filters.species);
      if (filters.status) params.set('status', filters.status);
      params.set('limit', '24');

      const res = await fetch(`/api/public/cases?${params}`);
      const data = await res.json();
      setCases(data.cases || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to load cases:', error);
    }
    setLoading(false);
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <Link href="/" className="text-xl font-bold text-red-600">
                PetRecovery.org
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 mt-1">
                Lost Pets
              </h1>
            </div>
            <Link
              href="/cases/report"
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium"
            >
              Report Lost Pet
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4 items-center">
          <select
            value={filters.species}
            onChange={(e) => setFilters({ ...filters, species: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="">All Species</option>
            <option value="DOG">Dogs</option>
            <option value="CAT">Cats</option>
            <option value="BIRD">Birds</option>
            <option value="RABBIT">Rabbits</option>
            <option value="OTHER">Other</option>
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
          >
            <option value="ACTIVE">Active Cases</option>
            <option value="IN_PROGRESS">Search In Progress</option>
            <option value="SIGHTING_REPORTED">Sighting Reported</option>
            <option value="ALL">All Cases</option>
          </select>

          <span className="text-gray-600">
            {total} {total === 1 ? 'case' : 'cases'} found
          </span>
        </div>

        {/* Case Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-red-600"></div>
            <p className="mt-2 text-gray-600">Loading cases...</p>
          </div>
        ) : cases.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 text-lg">No lost pets found matching your filters.</p>
            <p className="text-gray-400 mt-2">Try adjusting the filters above.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cases.map((c) => (
              <Link
                key={c.caseNumber}
                href={`/cases/${c.caseNumber}`}
                className="bg-white rounded-lg shadow hover:shadow-lg transition overflow-hidden group"
              >
                <div className="aspect-square relative overflow-hidden bg-gray-100">
                  <img
                    src={c.petPhotoUrl}
                    alt={c.petName}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  {c.hasReward && (
                    <span className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded">
                      REWARD
                    </span>
                  )}
                  <span className={`absolute top-2 left-2 text-white text-xs font-bold px-2 py-1 rounded ${
                    c.status === 'ACTIVE' ? 'bg-red-500' :
                    c.status === 'IN_PROGRESS' ? 'bg-yellow-500' :
                    c.status === 'SIGHTING_REPORTED' ? 'bg-blue-500' :
                    c.status === 'REUNITED' ? 'bg-green-500' :
                    'bg-gray-500'
                  }`}>
                    {c.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="p-4">
                  <h2 className="font-bold text-lg text-gray-900 truncate">
                    {c.petName}
                  </h2>
                  <p className="text-gray-600 text-sm">
                    {c.petBreed || c.petSpecies} &bull; {c.petColor}
                  </p>
                  <p className="text-gray-500 text-sm mt-2 truncate">
                    {c.lastSeenAddress}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    Lost {formatDate(c.lastSeenAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>PetRecovery.org - Helping lost pets find their way home</p>
          <p className="mt-2">
            <Link href="/" className="text-red-600 hover:underline">Home</Link>
            {' | '}
            <Link href="/cases/report" className="text-red-600 hover:underline">Report Lost Pet</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
