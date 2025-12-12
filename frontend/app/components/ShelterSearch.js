'use client';

/**
 * Shelter Search Component
 *
 * Search and browse nearby animal shelters using Apple MapKit.
 * Helps lost pet owners find shelters to check for their pets.
 */

import { useState, useCallback } from 'react';
import { Search, MapPin, Phone, Globe, Building2, ExternalLink, Navigation, Clock, Mail } from 'lucide-react';

const DISTANCE_OPTIONS = [
  { value: 10, label: '10 miles' },
  { value: 25, label: '25 miles' },
  { value: 50, label: '50 miles' },
  { value: 100, label: '100 miles' },
];

export default function ShelterSearch({ defaultLocation = '', className = '' }) {
  const [shelters, setShelters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const [filters, setFilters] = useState({
    location: defaultLocation,
    distance: 50,
  });

  const searchShelters = useCallback(async () => {
    if (!filters.location) {
      setError('Please enter a location (city, state or zip code)');
      return;
    }

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const params = new URLSearchParams({
        location: filters.location,
        distance: filters.distance.toString(),
      });

      const response = await fetch(`/api/shelters/search?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setShelters(data.shelters || []);
    } catch (err) {
      setError(err.message);
      setShelters([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    searchShelters();
  };

  return (
    <div className={className}>
      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl shadow-md p-6 mb-6 border border-midnight-100">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {/* Location */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-midnight-700 mb-1">
              Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400" />
              <input
                type="text"
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                placeholder="Enter city, state or zip code"
                className="w-full pl-10 pr-4 py-3 border border-midnight-200 rounded-lg focus:ring-2 focus:ring-flash-400 focus:border-flash-400 text-midnight-900"
              />
            </div>
          </div>

          {/* Distance */}
          <div>
            <label className="block text-sm font-medium text-midnight-700 mb-1">
              Distance
            </label>
            <select
              value={filters.distance}
              onChange={(e) => handleFilterChange('distance', parseInt(e.target.value))}
              className="w-full px-4 py-3 border border-midnight-200 rounded-lg focus:ring-2 focus:ring-flash-400 focus:border-flash-400 text-midnight-900"
            >
              {DISTANCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full md:w-auto px-8 py-3 bg-flash-400 text-midnight-900 font-bold rounded-lg hover:bg-flash-300 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          <Search className="w-5 h-5" />
          {loading ? 'Searching...' : 'Find Shelters'}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Results */}
      {shelters.length > 0 && (
        <div>
          <p className="text-midnight-600 mb-4 font-medium">
            Found {shelters.length} shelter{shelters.length !== 1 ? 's' : ''} near {filters.location}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shelters.map((shelter) => (
              <ShelterCard key={shelter.id || shelter.externalId} shelter={shelter} />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && searched && shelters.length === 0 && !error && (
        <div className="text-center py-12 bg-white rounded-xl border border-midnight-100">
          <Building2 className="w-16 h-16 mx-auto text-midnight-300 mb-4" />
          <h3 className="text-lg font-semibold text-midnight-900 mb-2">
            No shelters found
          </h3>
          <p className="text-midnight-500 max-w-md mx-auto">
            We couldn't find any shelters in this area. Try expanding your search distance or searching a nearby city.
          </p>
        </div>
      )}

      {/* Initial State */}
      {!searched && !loading && (
        <div className="text-center py-12 bg-white rounded-xl border border-midnight-100">
          <Search className="w-16 h-16 mx-auto text-midnight-300 mb-4" />
          <h3 className="text-lg font-semibold text-midnight-900 mb-2">
            Search for nearby shelters
          </h3>
          <p className="text-midnight-500 max-w-md mx-auto">
            Enter your location to find animal shelters, humane societies, and rescue organizations in your area.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Shelter Card Component
 * Handles both local database format (flat) and PetFinder format (nested address)
 */
function ShelterCard({ shelter }) {
  const typeLabel = {
    SHELTER: 'Shelter',
    ANIMAL_CONTROL: 'Animal Control',
    RESCUE: 'Rescue',
    VET: 'Veterinary',
  };

  const typeColor = {
    SHELTER: 'bg-emerald-100 text-emerald-700',
    ANIMAL_CONTROL: 'bg-blue-100 text-blue-700',
    RESCUE: 'bg-purple-100 text-purple-700',
    VET: 'bg-amber-100 text-amber-700',
  };

  // Handle both flat (local DB) and nested (PetFinder) address formats
  const streetAddress = shelter.address?.address1 || shelter.address?.street || shelter.address;
  const city = shelter.address?.city || shelter.city;
  const state = shelter.address?.state || shelter.state;
  const zipCode = shelter.address?.postcode || shelter.zipCode;

  const fullAddress = [streetAddress, city, state, zipCode].filter(Boolean).join(', ');
  const mapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(fullAddress || shelter.name)}`;

  // Get contact info (handles both formats)
  const phone = shelter.phone;
  const email = shelter.email;
  const website = shelter.website || shelter.url;

  // Format hours if available
  const formatHours = (hours) => {
    if (!hours) return null;
    if (typeof hours === 'string') return hours;

    // PetFinder returns hours as object with days
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const today = days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];

    if (hours[today]) {
      return `Today: ${hours[today]}`;
    }

    // Return first available day's hours
    for (const day of days) {
      if (hours[day]) {
        return `${day.charAt(0).toUpperCase() + day.slice(1)}: ${hours[day]}`;
      }
    }
    return null;
  };

  const hoursDisplay = formatHours(shelter.hours);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-midnight-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-5">
        {/* Type Badge */}
        {shelter.type && (
          <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full mb-3 ${typeColor[shelter.type] || 'bg-gray-100 text-gray-700'}`}>
            {typeLabel[shelter.type] || shelter.type}
          </span>
        )}

        {/* Name */}
        <h3 className="font-bold text-lg text-midnight-900 mb-2 line-clamp-2">
          {shelter.name}
        </h3>

        {/* Address */}
        {fullAddress && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 text-sm text-midnight-600 hover:text-flash-600 mb-2 group"
          >
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="group-hover:underline">{fullAddress}</span>
          </a>
        )}

        {/* Distance */}
        {shelter.distance !== undefined && (
          <div className="flex items-center gap-2 text-sm text-midnight-500 mb-2">
            <Navigation className="w-4 h-4" />
            <span>{shelter.distance < 1 ? '< 1' : Math.round(shelter.distance)} miles away</span>
          </div>
        )}

        {/* Hours */}
        {hoursDisplay && (
          <div className="flex items-center gap-2 text-sm text-midnight-600 mb-2">
            <Clock className="w-4 h-4" />
            <span>{hoursDisplay}</span>
          </div>
        )}

        {/* Contact Info */}
        <div className="space-y-2 pt-3 border-t border-midnight-100">
          {phone && (
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-2 text-sm text-midnight-700 hover:text-flash-600"
            >
              <Phone className="w-4 h-4" />
              <span>{phone}</span>
            </a>
          )}

          {email && (
            <a
              href={`mailto:${email}`}
              className="flex items-center gap-2 text-sm text-midnight-700 hover:text-flash-600"
            >
              <Mail className="w-4 h-4" />
              <span className="truncate">{email}</span>
            </a>
          )}

          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-flash-600 hover:text-flash-700"
            >
              <Globe className="w-4 h-4" />
              <span className="truncate">Visit Website</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Source Badge */}
        <div className="mt-3 pt-3 border-t border-midnight-100">
          <span className="text-xs text-midnight-400">
            via Apple Maps
          </span>
        </div>
      </div>
    </div>
  );
}
