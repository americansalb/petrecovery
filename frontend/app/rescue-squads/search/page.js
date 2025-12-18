'use client';

/**
 * Rescue Squad Search Page - Updated with PetRecovery Design System
 * Uses: Midnight Blue + Flashlight Yellow color palette
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Search, MapPin, Users, ChevronDown, ChevronRight, Plus, ArrowLeft, Shield } from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';

export default function RescueSquadSearchPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null); // Stores full location data including country
  const [radius, setRadius] = useState(25);
  const [cities, setCities] = useState([]);
  const [searchLocation, setSearchLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedSquads, setExpandedSquads] = useState(new Set());
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputType, setInputType] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const debounceRef = useRef(null);
  const currentQueryRef = useRef('');

  const fetchSuggestions = useCallback(async (value) => {
    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoadingSuggestions(false);
      return;
    }

    const query = value.trim();
    currentQueryRef.current = query;
    setIsLoadingSuggestions(true);

    try {
      const res = await fetch(`/api/cities/suggest?q=${encodeURIComponent(query)}&limit=15`);
      const data = await res.json();

      // Only update if this is still the current query (prevents race conditions)
      if (currentQueryRef.current === query) {
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true); // Always show dropdown after search completes
        setIsLoadingSuggestions(false);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      if (currentQueryRef.current === query) {
        setSuggestions([]);
        setShowSuggestions(true); // Show "no results" message
        setIsLoadingSuggestions(false);
      }
    }
  }, []);

  const handleInputChange = (value) => {
    setSearchTerm(value);
    setValidationError('');
    setSelectedLocation(null);
    const isZip = /^\d{0,5}$/.test(value);
    setInputType(isZip ? 'zip' : 'city');

    if (value.trim().length >= 2) {
      fetchSuggestions(value);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Country code to flag emoji mapping
  const getCountryFlag = (countryCode) => {
    const flags = {
      'US': '🇺🇸', 'CA': '🇨🇦', 'MX': '🇲🇽',
      // Caribbean
      'BS': '🇧🇸', 'CU': '🇨🇺', 'DO': '🇩🇴', 'HT': '🇭🇹', 'JM': '🇯🇲',
      'TT': '🇹🇹', 'BB': '🇧🇧', 'AG': '🇦🇬', 'DM': '🇩🇲', 'GD': '🇬🇩',
      'KN': '🇰🇳', 'LC': '🇱🇨', 'VC': '🇻🇨', 'AI': '🇦🇮', 'AW': '🇦🇼',
      'BM': '🇧🇲', 'KY': '🇰🇾', 'TC': '🇹🇨', 'VG': '🇻🇬', 'CW': '🇨🇼',
      'GP': '🇬🇵', 'MQ': '🇲🇶', 'MS': '🇲🇸',
      // Central America
      'BZ': '🇧🇿', 'CR': '🇨🇷', 'GT': '🇬🇹', 'HN': '🇭🇳',
      'NI': '🇳🇮', 'PA': '🇵🇦', 'SV': '🇸🇻',
      // South America
      'CO': '🇨🇴',
      // Other
      'GL': '🇬🇱'
    };
    return flags[countryCode] || '🌎';
  };

  const selectSuggestion = (city) => {
    const countryFlag = getCountryFlag(city.country);
    setSearchTerm(`${city.city}, ${city.state_id} ${countryFlag}`);
    setSelectedLocation(city); // Store full location data
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    // Validate we have a location selected or can find one
    let locationToSearch = selectedLocation;

    if (!locationToSearch) {
      // Try to validate the input
      try {
        const validateRes = await fetch(`/api/cities/suggest?q=${encodeURIComponent(searchTerm.trim())}`);
        const validateData = await validateRes.json();
        if (!validateData.suggestions || validateData.suggestions.length === 0) {
          setValidationError('Please enter a valid city name or postal code');
          return;
        }
        // Use first suggestion
        locationToSearch = validateData.suggestions[0];
      } catch (error) {
        console.error('Validation error:', error);
        setValidationError('Search failed. Please try again.');
        return;
      }
    }

    const country = locationToSearch?.country || 'US';

    setLoading(true);
    try {
      const res = await fetch(`/api/rescue-squads?search=${encodeURIComponent(searchTerm)}&radius=${radius}&country=${country}`);
      const data = await res.json();

      if (!res.ok) {
        setValidationError(data.error || 'Search failed');
        setCities([]);
        setSearched(true);
        return;
      }

      setCities(data.cities || []);
      setSearchLocation({ ...data.searchLocation, country });
      setSearched(true);
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
      if (res.ok || data.alreadyMember) {
        router.push(`/rescue-squads/${squadId}`);
      } else {
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
      const squadRes = await fetch(`/api/rescue-squads/${squadId}/join`, { method: 'POST' });
      const squadData = await squadRes.json();

      if (squadData.code === 'WAIVER_NOT_ACCEPTED' && squadData.redirectTo) {
        router.push(squadData.redirectTo);
        return;
      }

      if (!squadRes.ok && !squadData.alreadyMember) {
        setValidationError(squadData.error || 'Failed to join squad');
        return;
      }

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

    // Get country from selectedLocation or searchLocation
    const country = selectedLocation?.country || searchLocation?.country || 'US';

    if (!state) {
      setValidationError(`No squad found for "${city}". Please search by postal code to create a new squad for your area.`);
      return;
    }

    try {
      if (!zipCode || !/^\d{5}$/.test(zipCode)) {
        setValidationError('Unable to create squad: valid postal code required. Please search by postal code instead.');
        return;
      }

      const res = await fetch('/api/rescue-squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, state, zipCode, country }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/rescue-squads/${data.squad.id}`);
      } else {
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
    <div className="min-h-screen bg-midnight-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.push('/dashboard')}
          className="mb-6 flex items-center gap-2 text-midnight-600 hover:text-midnight-900 font-medium transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-midnight-900 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-flash-400" />
          </div>
          <h1 className="text-3xl font-bold text-midnight-900 mb-2">Find Rescue Squads</h1>
          <p className="text-midnight-500">
            Enter a city name or postal code to find or create a rescue squad
          </p>
          <div className="mt-3 inline-flex items-center gap-2 text-sm text-midnight-400">
            <span>🇺🇸</span>
            <span>🇲🇽</span>
            <span>🇨🇦</span>
            <span>🇵🇷</span>
            <span className="ml-1">US, México, Canada & Puerto Rico</span>
          </div>
        </div>

        {/* Search Form */}
        <Card className="mb-8">
          <form onSubmit={handleSearch}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* City/ZIP Input */}
              <div className="relative md:col-span-2">
                <label className="block font-semibold mb-2 text-midnight-700 text-sm">
                  City Name or Postal Code
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
                  placeholder="e.g., Los Angeles, Ciudad de México, 90210"
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none transition ${
                    validationError ? 'border-red-500' : inputType === 'zip' ? 'border-midnight-400' : inputType === 'city' ? 'border-green-500' : 'border-midnight-200'
                  }`}
                  required
                />

                {inputType && searchTerm.trim() && !selectedLocation && (
                  <div className={`absolute right-3 top-10 text-xs font-semibold px-2 py-0.5 rounded ${
                    inputType === 'zip' ? 'bg-midnight-100 text-midnight-600' : 'bg-green-100 text-green-600'
                  }`}>
                    {inputType === 'zip' ? 'Postal' : 'City'}
                  </div>
                )}

                {validationError && (
                  <div className="mt-2 text-sm text-red-600 font-medium">
                    {validationError}
                  </div>
                )}

                {/* Loading indicator */}
                {isLoadingSuggestions && searchTerm.trim().length >= 2 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-midnight-200 rounded-xl mt-2 p-4 z-50 shadow-lg text-center">
                    <div className="text-midnight-500 text-sm">Searching...</div>
                  </div>
                )}

                {/* No results message */}
                {showSuggestions && suggestions.length === 0 && !isLoadingSuggestions && searchTerm.trim().length >= 2 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-midnight-200 rounded-xl mt-2 p-4 z-50 shadow-lg text-center">
                    <div className="text-midnight-500 text-sm">No cities found matching "{searchTerm.trim()}"</div>
                  </div>
                )}

                {showSuggestions && suggestions.length > 0 && !isLoadingSuggestions && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-midnight-200 rounded-xl mt-2 max-h-64 overflow-y-auto z-50 shadow-lg">
                    {suggestions.map((city, idx) => (
                      <div
                        key={`${city.city}-${city.state_id}-${city.country}-${idx}`}
                        onMouseDown={() => selectSuggestion(city)}
                        className="px-4 py-3 cursor-pointer hover:bg-midnight-50 border-b border-midnight-100 last:border-b-0"
                      >
                        <div className="font-semibold text-midnight-900 flex items-center gap-2">
                          <span>{city.country === 'MX' ? '🇲🇽' : city.country === 'CA' ? '🇨🇦' : city.country === 'PR' ? '🇵🇷' : '🇺🇸'}</span>
                          {city.city}, {city.state_id}
                        </div>
                        <div className="text-sm text-midnight-500">
                          {city.state_name || city.state_id} {city.zips?.length > 0 ? `• ${city.zips[0]}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Radius */}
              <div>
                <label className="block font-semibold mb-2 text-midnight-700 text-sm">
                  Radius
                </label>
                <select
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full px-4 py-3 border-2 border-midnight-200 rounded-xl focus:ring-2 focus:ring-flash-400 focus:border-flash-400 outline-none"
                >
                  <option value={10}>10 miles</option>
                  <option value={25}>25 miles</option>
                  <option value={50}>50 miles</option>
                </select>
              </div>

              {/* Search Button */}
              <div className="flex items-end">
                <Button type="submit" fullWidth loading={loading} leftIcon={Search}>
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </div>
          </form>
        </Card>

        {/* Results */}
        {searched && (
          <div>
            {searchLocation && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-midnight-900 mb-1">
                  {searchLocation.cities && searchLocation.cities.length > 1
                    ? `Rescue Squads for ${searchLocation.cities.join(', ')}, ${searchLocation.state}`
                    : `Rescue Squads near ${searchLocation.cities?.[0] || searchLocation.city}, ${searchLocation.state}`
                  }
                  {searchLocation.country === 'MX' ? ' 🇲🇽' : searchLocation.country === 'CA' ? ' 🇨🇦' : searchLocation.country === 'PR' ? ' 🇵🇷' : ''}
                </h2>
                <p className="text-sm text-midnight-500">
                  Found {cities.filter(c => c.exists).length} rescue squad{cities.filter(c => c.exists).length !== 1 ? 's' : ''} within {radius} miles
                  {cities.filter(c => c.exists).length === 0 && ' - try increasing the search radius or create one for your area'}
                </p>
              </div>
            )}

            {cities.length === 0 ? (
              <Card className="text-center py-10">
                <Search className="w-12 h-12 text-midnight-300 mx-auto mb-4" />
                <p className="text-midnight-500">No results found</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-4">
                {cities.map((item, idx) => (
                  <Card key={idx} hover>
                    {/* Squad Header */}
                    <div className="flex justify-between items-center flex-wrap gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-midnight-900">
                            {item.city} Rescue Squad
                          </h3>
                          {item.exists && <Badge variant="success">Active</Badge>}
                        </div>
                        <p className="text-midnight-500 text-sm flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {item.city}, {item.state} - {item.distance.toFixed(1)} miles away
                        </p>
                        {item.exists && item.squad && (
                          <p className="text-midnight-400 text-xs mt-1 flex items-center gap-2">
                            <Users className="w-3 h-3" />
                            {item.squad.memberCount} member{item.squad.memberCount !== 1 ? 's' : ''} | {item.squad.totalMissionsAccepted || 0} cases
                            {item.divisions && item.divisions.length > 0 && ` | ${item.divisions.length} divisions`}
                          </p>
                        )}
                      </div>

                      {/* Squad Action Button */}
                      {item.exists && item.squad ? (
                        item.squad.isMember ? (
                          <Button onClick={() => router.push(`/rescue-squads/${item.squad.id}`)}>
                            View Squad
                          </Button>
                        ) : (
                          <Button variant="success" onClick={() => handleJoin(item.squad.id)}>
                            Join Squad
                          </Button>
                        )
                      ) : (
                        <Button onClick={() => handleCreate(item.city, item.state, searchLocation?.zipCode)}>
                          <Plus className="w-4 h-4 mr-1" />
                          Create Squad
                        </Button>
                      )}
                    </div>

                    {/* Divisions List */}
                    {item.exists && item.divisions && item.divisions.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-midnight-100">
                        <button
                          onClick={() => toggleExpanded(idx)}
                          className="flex items-center gap-2 text-sm font-semibold text-midnight-700 hover:text-midnight-900 transition"
                        >
                          {expandedSquads.has(idx) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          {item.divisions.length} Neighborhood Division{item.divisions.length !== 1 ? 's' : ''}
                        </button>

                        {expandedSquads.has(idx) && (
                          <div className="flex flex-col gap-3 mt-3 ml-6">
                            {item.divisions.map(division => (
                              <div
                                key={division.id}
                                className="bg-midnight-50 rounded-xl px-4 py-3 flex justify-between items-center flex-wrap gap-2"
                              >
                                <div className="flex-1">
                                  <div className="font-semibold text-midnight-900 text-sm">
                                    {division.name}
                                  </div>
                                  <div className="text-xs text-midnight-500">
                                    {division.distance.toFixed(1)} mi • {division.totalMembers} members
                                  </div>
                                </div>

                                {division.isMember ? (
                                  <Button
                                    size="sm"
                                    onClick={() => router.push(`/rescue-squads/${item.squad.id}/divisions/${division.id}`)}
                                  >
                                    View Division
                                  </Button>
                                ) : item.squad.isMember ? (
                                  <Button
                                    size="sm"
                                    variant="success"
                                    onClick={() => handleJoinDivision(item.squad.id, division.id)}
                                  >
                                    Join Division
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled
                                    title="Join the rescue squad first"
                                  >
                                    Join Division
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
