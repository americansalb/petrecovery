'use client';

/**
 * Phase 9: Shelter Search Component
 *
 * Search and browse shelter animals from integrated APIs.
 */

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const PET_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'dog', label: 'Dogs' },
  { value: 'cat', label: 'Cats' },
  { value: 'bird', label: 'Birds' },
  { value: 'rabbit', label: 'Rabbits' },
  { value: 'small-furry', label: 'Small & Furry' },
  { value: 'scales-fins-other', label: 'Scales, Fins & Other' },
];

const SIZES = [
  { value: '', label: 'Any Size' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
  { value: 'xlarge', label: 'Extra Large' },
];

const AGES = [
  { value: '', label: 'Any Age' },
  { value: 'baby', label: 'Baby' },
  { value: 'young', label: 'Young' },
  { value: 'adult', label: 'Adult' },
  { value: 'senior', label: 'Senior' },
];

const GENDERS = [
  { value: '', label: 'Any Gender' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export default function ShelterSearch({ defaultLocation = '', className = '' }) {
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sources, setSources] = useState([]);

  const [filters, setFilters] = useState({
    location: defaultLocation,
    distance: 50,
    type: '',
    size: '',
    age: '',
    gender: '',
    breed: '',
    status: 'adoptable',
  });

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const searchAnimals = useCallback(async (resetPage = false) => {
    if (!filters.location) {
      setError('Please enter a location');
      return;
    }

    setLoading(true);
    setError('');

    if (resetPage) {
      setPage(1);
      setAnimals([]);
    }

    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      params.set('page', resetPage ? '1' : page.toString());
      params.set('limit', '20');

      const response = await fetch(`/api/shelters/animals?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      if (resetPage) {
        setAnimals(data.animals);
      } else {
        setAnimals((prev) => [...prev, ...data.animals]);
      }

      setSources(data.sources || []);
      setHasMore(data.animals.length === 20);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  // Initial search on mount if location provided
  useEffect(() => {
    if (defaultLocation) {
      searchAnimals(true);
    }
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    searchAnimals(true);
  };

  const loadMore = () => {
    setPage((p) => p + 1);
    searchAnimals(false);
  };

  return (
    <div className={className}>
      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location
            </label>
            <input
              type="text"
              value={filters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
              placeholder="City, State or Zip"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Distance */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Distance
            </label>
            <select
              value={filters.distance}
              onChange={(e) => handleFilterChange('distance', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="10">10 miles</option>
              <option value="25">25 miles</option>
              <option value="50">50 miles</option>
              <option value="100">100 miles</option>
            </select>
          </div>

          {/* Pet Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pet Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {PET_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Additional Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <select
            value={filters.size}
            onChange={(e) => handleFilterChange('size', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            {SIZES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select
            value={filters.age}
            onChange={(e) => handleFilterChange('age', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            {AGES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>

          <select
            value={filters.gender}
            onChange={(e) => handleFilterChange('gender', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            {GENDERS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>

          <input
            type="text"
            value={filters.breed}
            onChange={(e) => handleFilterChange('breed', e.target.value)}
            placeholder="Breed"
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>

        {/* Search Button */}
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Searching...' : 'Search Shelters'}
          </button>

          {sources.length > 0 && (
            <p className="text-sm text-gray-500">
              Searching: {sources.map((s) => s.name).join(', ')}
            </p>
          )}
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Results */}
      {animals.length > 0 && (
        <div>
          <p className="text-gray-600 mb-4">
            Found {animals.length} animals
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {animals.map((animal) => (
              <AnimalCard key={animal.id} animal={animal} />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="text-center mt-8">
              <button
                onClick={loadMore}
                disabled={loading}
                className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && animals.length === 0 && filters.location && (
        <div className="text-center py-12">
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
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No animals found
          </h3>
          <p className="text-gray-500">
            Try adjusting your filters or searching a different location
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Animal Card Component
 */
function AnimalCard({ animal }) {
  const primaryPhoto = animal.photos?.[0]?.medium || animal.photos?.[0]?.full;
  const breedText = animal.breeds?.mixed
    ? `${animal.breeds.primary} Mix`
    : animal.breeds?.primary || 'Unknown breed';

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {/* Photo */}
      <div className="aspect-square relative bg-gray-100">
        {primaryPhoto ? (
          <img
            src={primaryPhoto}
            alt={animal.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Source Badge */}
        <div className="absolute top-2 right-2">
          <span className="px-2 py-1 text-xs font-medium bg-white/90 text-gray-700 rounded-full">
            {animal.source === 'petfinder' ? 'PetFinder' : animal.source}
          </span>
        </div>

        {/* Distance Badge */}
        {animal.distance !== undefined && (
          <div className="absolute bottom-2 left-2">
            <span className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded-full">
              {animal.distance < 1 ? '< 1' : Math.round(animal.distance)} mi
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-lg text-gray-900">{animal.name}</h3>
        <p className="text-sm text-gray-600 mb-2">{breedText}</p>

        <div className="flex flex-wrap gap-2 mb-3">
          {animal.age && (
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
              {animal.age}
            </span>
          )}
          {animal.gender && (
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
              {animal.gender}
            </span>
          )}
          {animal.size && (
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
              {animal.size}
            </span>
          )}
        </div>

        {/* Contact/Link */}
        {animal.url && (
          <a
            href={animal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors"
          >
            View on {animal.source === 'petfinder' ? 'PetFinder' : animal.source}
          </a>
        )}
      </div>
    </div>
  );
}
