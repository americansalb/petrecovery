'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import UnifiedNav from '@/app/components/UnifiedNav';

export default function RescueSquadSearchPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState(''); // City name or ZIP code
  const [radius, setRadius] = useState(25);
  const [cities, setCities] = useState([]);
  const [searchLocation, setSearchLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedSquads, setExpandedSquads] = useState(new Set());
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputType, setInputType] = useState(null); // 'zip' or 'city'
  const [validationError, setValidationError] = useState('');
  const [isValidInput, setIsValidInput] = useState(false);

  // Debounced city suggestions via API
  const fetchSuggestions = useCallback(async (value) => {
    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const res = await fetch(`/api/cities/suggest?q=${encodeURIComponent(value.trim())}&limit=10`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setIsValidInput(data.isValid);
      setShowSuggestions(data.suggestions && data.suggestions.length > 0);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
    }
  }, []);

  const handleInputChange = (value) => {
    setSearchTerm(value);
    setValidationError('');

    // Detect input type
    const isZip = /^\d{0,5}$/.test(value);
    setInputType(isZip ? 'zip' : 'city');

    // If it's a city name (not numbers) and at least 2 characters, fetch suggestions
    if (!isZip && value.trim().length >= 2) {
      fetchSuggestions(value);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (city) => {
    setSearchTerm(`${city.city}, ${city.state_id}`);
    setShowSuggestions(false);
    setSuggestions([]);
    setIsValidInput(true);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    // Validate input
    const isZip = /^\d{5}$/.test(searchTerm.trim());
    if (!isZip) {
      // Validate city name via API
      try {
        const validateRes = await fetch(`/api/cities/suggest?q=${encodeURIComponent(searchTerm.trim())}`);
        const validateData = await validateRes.json();
        if (!validateData.isValid && (!validateData.suggestions || validateData.suggestions.length === 0)) {
          setValidationError('Please enter a valid US city name or 5-digit ZIP code');
          return;
        }
      } catch (error) {
        // If validation fails, try searching anyway
        console.error('Validation error:', error);
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/rescue-squads?search=${encodeURIComponent(searchTerm)}&radius=${radius}`);
      const data = await res.json();

      if (!res.ok) {
        setValidationError(data.error || 'Search failed');
        setCities([]);
        setSearched(true);
        return;
      }

      setCities(data.cities || []);
      setSearchLocation(data.searchLocation || null);
      setSearched(true);
      // Auto-expand squads with divisions
      const newExpanded = new Set();
      (data.cities || []).forEach((city, idx) => {
        if (city.divisions && city.divisions.length > 0) {
          newExpanded.add(idx);
        }
      });
      setExpandedSquads(newExpanded);
    } catch (error) {
      console.error('Error:', error);
      setCities([]);
      setValidationError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (idx) => {
    const newExpanded = new Set(expandedSquads);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedSquads(newExpanded);
  };

  const handleJoin = async (squadId) => {
    if (!session) {
      router.push('/login?callbackUrl=' + window.location.pathname);
      return;
    }
    try {
      const res = await fetch(`/api/rescue-squads/${squadId}/join`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        router.push(`/rescue-squads/${squadId}`);
      } else {
        // Handle waiver redirect
        if (data.code === 'WAIVER_NOT_ACCEPTED' && data.redirectTo) {
          router.push(data.redirectTo);
          return;
        }
        setValidationError(data.error || 'Failed to join squad');
      }
    } catch (error) {
      setValidationError('Error joining squad. Please try again.');
    }
  };

  const handleJoinDivision = async (squadId, divisionId) => {
    if (!session) {
      router.push('/login?callbackUrl=' + window.location.pathname);
      return;
    }
    try {
      // First join the squad if not already a member
      const squadRes = await fetch(`/api/rescue-squads/${squadId}/join`, { method: 'POST' });
      const squadData = await squadRes.json();

      // Check for waiver requirement
      if (squadData.code === 'WAIVER_NOT_ACCEPTED' && squadData.redirectTo) {
        router.push(squadData.redirectTo);
        return;
      }

      if (!squadRes.ok && squadRes.status !== 400) { // 400 might mean already a member
        setValidationError(squadData.error || 'Failed to join squad');
        return;
      }

      // Then join the division
      const divRes = await fetch(`/api/rescue-squads/${squadId}/divisions/${divisionId}/join`, { method: 'POST' });
      const divData = await divRes.json();
      if (divRes.ok) {
        router.push(`/rescue-squads/${squadId}/divisions/${divisionId}`);
      } else {
        setValidationError(divData.error || 'Failed to join division');
      }
    } catch (error) {
      setValidationError('Error joining division. Please try again.');
    }
  };

  const handleCreate = async (city, state, zipCode = null) => {
    if (!session) {
      router.push('/login?callbackUrl=' + window.location.pathname);
      return;
    }

    // If we don't have state (city name search with no existing squad), ask for ZIP
    if (!state) {
      setValidationError(`No squad found for "${city}". Please search by ZIP code to create a new squad for your area.`);
      return;
    }

    try {
      // Validate we have a valid ZIP code
      if (!zipCode || !/^\d{5}$/.test(zipCode)) {
        setValidationError('Unable to create squad: valid ZIP code required. Please search by ZIP code instead.');
        return;
      }

      const res = await fetch('/api/rescue-squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, state, zipCode }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/rescue-squads/${data.squad.id}`);
      } else {
        // Handle waiver redirect
        if (data.code === 'WAIVER_NOT_ACCEPTED' && data.redirectTo) {
          router.push(data.redirectTo);
          return;
        }
        setValidationError(data.error || 'Failed to create squad');
      }
    } catch (error) {
      setValidationError('Error creating squad. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <UnifiedNav
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard', icon: '🏠' },
          { label: 'Find Squads', icon: '👥' }
        ]}
      />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Find Rescue Squads</h1>
          <p className="text-slate-400">
            Enter a city name or ZIP code to find or create a rescue squad
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="bg-slate-800 rounded-xl p-6 border border-slate-700 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* City/ZIP Input */}
            <div className="relative md:col-span-2">
              <label className="block font-semibold mb-2 text-slate-300 text-sm">
                City Name or ZIP Code
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder="e.g., Lynwood or 60411"
                className={`w-full px-4 py-3 bg-slate-700 border rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 ${
                  validationError ? 'border-red-500' : inputType === 'zip' ? 'border-blue-500' : inputType === 'city' ? 'border-green-500' : 'border-slate-600'
                }`}
                required
              />

              {/* Input type indicator */}
              {inputType && searchTerm.trim() && (
                <div className={`absolute right-3 top-10 text-xs font-semibold px-2 py-0.5 rounded ${
                  inputType === 'zip' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                }`}>
                  {inputType === 'zip' ? 'ZIP' : 'City'}
                </div>
              )}

              {/* Validation error */}
              {validationError && (
                <div className="mt-2 text-sm text-red-400 font-semibold">
                  {validationError}
                </div>
              )}

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-slate-700 border border-slate-600 rounded-lg mt-2 max-h-48 overflow-y-auto z-50 shadow-xl">
                  {suggestions.map((city, idx) => (
                    <div
                      key={`${city.city}-${city.state_id}-${idx}`}
                      onMouseDown={() => selectSuggestion(city)}
                      className="px-4 py-3 cursor-pointer hover:bg-slate-600 border-b border-slate-600 last:border-b-0"
                    >
                      <div className="font-semibold text-white">
                        {city.city}, {city.state_id}
                      </div>
                      <div className="text-sm text-slate-400">
                        {city.state_name} • {city.zips.length > 0 ? `ZIP ${city.zips[0]}` : 'No ZIP'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Radius */}
            <div>
              <label className="block font-semibold mb-2 text-slate-300 text-sm">
                Radius
              </label>
              <select
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500"
              >
                <option value={10}>10 miles</option>
                <option value={25}>25 miles</option>
                <option value={50}>50 miles</option>
              </select>
            </div>

            {/* Search Button */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </form>

        {/* Results */}
        {searched && (
          <div>
            {searchLocation && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-1">
                  {searchLocation.cities && searchLocation.cities.length > 1
                    ? `Rescue Squads for ${searchLocation.cities.join(', ')}, ${searchLocation.state}`
                    : `Rescue Squads near ${searchLocation.cities?.[0] || searchLocation.city}, ${searchLocation.state}`
                  }
                </h2>
                <p className="text-sm text-slate-400">
                  Found {cities.filter(c => c.exists).length} rescue squad{cities.filter(c => c.exists).length !== 1 ? 's' : ''} within {radius} miles
                  {cities.filter(c => c.exists).length === 0 && ' - try increasing the search radius or create one for your area'}
                </p>
              </div>
            )}

            {cities.length === 0 ? (
              <p className="text-slate-400">No results found</p>
            ) : (
              <div className="flex flex-col gap-4">
                {cities.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-800 rounded-xl p-5 border border-slate-700"
                  >
                    {/* Squad Header */}
                    <div className="flex justify-between items-center flex-wrap gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-1">
                          {item.city} Rescue Squad
                        </h3>
                        <p className="text-slate-400 text-sm">
                          {item.city}, {item.state} - {item.distance.toFixed(1)} miles away
                        </p>
                        {item.exists && item.squad && (
                          <p className="text-slate-500 text-xs mt-1">
                            {item.squad.memberCount} member{item.squad.memberCount !== 1 ? 's' : ''} | {item.squad.totalCasesAccepted || 0} cases
                            {item.divisions && item.divisions.length > 0 && ` | ${item.divisions.length} divisions`}
                          </p>
                        )}
                      </div>

                      {/* Squad Action Button */}
                      {item.exists && item.squad ? (
                        item.squad.isMember ? (
                          <button
                            onClick={() => router.push(`/rescue-squads/${item.squad.id}`)}
                            className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold rounded-lg transition"
                          >
                            View Squad
                          </button>
                        ) : (
                          <button
                            onClick={() => handleJoin(item.squad.id)}
                            className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-lg transition"
                          >
                            Join Squad
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => handleCreate(item.city, item.state, searchLocation?.zipCode)}
                          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-white font-semibold rounded-lg transition"
                        >
                          Create Squad
                        </button>
                      )}
                    </div>

                    {/* Divisions List */}
                    {item.exists && item.divisions && item.divisions.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <button
                          onClick={() => toggleExpanded(idx)}
                          className="flex items-center gap-2 text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition"
                        >
                          <span>{expandedSquads.has(idx) ? '▼' : '▶'}</span>
                          {item.divisions.length} Neighborhood Division{item.divisions.length !== 1 ? 's' : ''}
                        </button>

                        {expandedSquads.has(idx) && (
                          <div className="flex flex-col gap-3 mt-3 ml-4">
                            {item.divisions.map(division => (
                              <div
                                key={division.id}
                                className="bg-slate-700/50 rounded-lg px-4 py-3 flex justify-between items-center flex-wrap gap-2"
                              >
                                <div className="flex-1">
                                  <div className="font-semibold text-white text-sm">
                                    {division.name}
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    {division.distance.toFixed(1)} mi • {division.totalMembers} members
                                  </div>
                                </div>

                                {/* Division Action Button */}
                                {division.isMember ? (
                                  <button
                                    onClick={() => router.push(`/rescue-squads/${item.squad.id}/divisions/${division.id}`)}
                                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-lg transition"
                                  >
                                    View Division
                                  </button>
                                ) : item.squad.isMember ? (
                                  <button
                                    onClick={() => handleJoinDivision(item.squad.id, division.id)}
                                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold rounded-lg transition"
                                  >
                                    Join Division
                                  </button>
                                ) : (
                                  <button
                                    disabled
                                    title="Join the rescue squad first"
                                    className="px-4 py-2 bg-slate-600 text-slate-400 text-sm font-semibold rounded-lg cursor-not-allowed"
                                  >
                                    Join Division
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
