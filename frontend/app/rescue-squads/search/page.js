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
  const [showCountriesModal, setShowCountriesModal] = useState(false);
  const debounceRef = useRef(null);
  const currentQueryRef = useRef('');

  // Supported countries with flags
  const supportedCountries = [
    { flag: '🇺🇸', name: 'United States', cities: '~29,000' },
    { flag: '🇨🇦', name: 'Canada', cities: '1,079' },
    { flag: '🇲🇽', name: 'Mexico', cities: '9,321' },
    { flag: '🇨🇴', name: 'Colombia', cities: '1,122' },
    { flag: '🇬🇹', name: 'Guatemala', cities: '382' },
    { flag: '🇭🇳', name: 'Honduras', cities: '545' },
    { flag: '🇸🇻', name: 'El Salvador', cities: '100' },
    { flag: '🇳🇮', name: 'Nicaragua', cities: '155' },
    { flag: '🇨🇷', name: 'Costa Rica', cities: '159' },
    { flag: '🇵🇦', name: 'Panama', cities: '551' },
    { flag: '🇧🇿', name: 'Belize', cities: '13' },
    { flag: '🇨🇺', name: 'Cuba', cities: '187' },
    { flag: '🇯🇲', name: 'Jamaica', cities: '837' },
    { flag: '🇭🇹', name: 'Haiti', cities: '124' },
    { flag: '🇩🇴', name: 'Dominican Republic', cities: '207' },
    { flag: '🇧🇸', name: 'Bahamas', cities: '21' },
    { flag: '🇹🇹', name: 'Trinidad and Tobago', cities: '25' },
    { flag: '🇧🇧', name: 'Barbados', cities: '7' },
    { flag: '🇦🇬', name: 'Antigua and Barbuda', cities: '9' },
    { flag: '🇩🇲', name: 'Dominica', cities: '17' },
    { flag: '🇬🇩', name: 'Grenada', cities: '7' },
    { flag: '🇰🇳', name: 'Saint Kitts and Nevis', cities: '13' },
    { flag: '🇱🇨', name: 'Saint Lucia', cities: '479' },
    { flag: '🇻🇨', name: 'Saint Vincent', cities: '9' },
    { flag: '🇦🇮', name: 'Anguilla', cities: '12' },
    { flag: '🇦🇼', name: 'Aruba', cities: '12' },
    { flag: '🇧🇲', name: 'Bermuda', cities: '9' },
    { flag: '🇰🇾', name: 'Cayman Islands', cities: '7' },
    { flag: '🇹🇨', name: 'Turks and Caicos', cities: '8' },
    { flag: '🇻🇬', name: 'British Virgin Islands', cities: '5' },
    { flag: '🇻🇮', name: 'US Virgin Islands', cities: '20' },
    { flag: '🇬🇵', name: 'Guadeloupe', cities: '32' },
    { flag: '🇲🇶', name: 'Martinique', cities: '34' },
    { flag: '🇨🇼', name: 'Curaçao', cities: '12' },
    { flag: '🇬🇱', name: 'Greenland', cities: '18' },
  ];

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

  // Country code to flag and name mapping
  const countryData = {
    'US': { flag: '🇺🇸', name: 'United States' },
    'CA': { flag: '🇨🇦', name: 'Canada' },
    'MX': { flag: '🇲🇽', name: 'Mexico' },
    // Caribbean
    'BS': { flag: '🇧🇸', name: 'Bahamas' },
    'CU': { flag: '🇨🇺', name: 'Cuba' },
    'DO': { flag: '🇩🇴', name: 'Dominican Republic' },
    'HT': { flag: '🇭🇹', name: 'Haiti' },
    'JM': { flag: '🇯🇲', name: 'Jamaica' },
    'TT': { flag: '🇹🇹', name: 'Trinidad and Tobago' },
    'BB': { flag: '🇧🇧', name: 'Barbados' },
    'AG': { flag: '🇦🇬', name: 'Antigua and Barbuda' },
    'DM': { flag: '🇩🇲', name: 'Dominica' },
    'GD': { flag: '🇬🇩', name: 'Grenada' },
    'KN': { flag: '🇰🇳', name: 'Saint Kitts and Nevis' },
    'LC': { flag: '🇱🇨', name: 'Saint Lucia' },
    'VC': { flag: '🇻🇨', name: 'Saint Vincent' },
    'AI': { flag: '🇦🇮', name: 'Anguilla' },
    'AW': { flag: '🇦🇼', name: 'Aruba' },
    'BM': { flag: '🇧🇲', name: 'Bermuda' },
    'KY': { flag: '🇰🇾', name: 'Cayman Islands' },
    'TC': { flag: '🇹🇨', name: 'Turks and Caicos' },
    'VG': { flag: '🇻🇬', name: 'British Virgin Islands' },
    'CW': { flag: '🇨🇼', name: 'Curaçao' },
    'GP': { flag: '🇬🇵', name: 'Guadeloupe' },
    'MQ': { flag: '🇲🇶', name: 'Martinique' },
    'MS': { flag: '🇲🇸', name: 'Montserrat' },
    // Central America
    'BZ': { flag: '🇧🇿', name: 'Belize' },
    'CR': { flag: '🇨🇷', name: 'Costa Rica' },
    'GT': { flag: '🇬🇹', name: 'Guatemala' },
    'HN': { flag: '🇭🇳', name: 'Honduras' },
    'NI': { flag: '🇳🇮', name: 'Nicaragua' },
    'PA': { flag: '🇵🇦', name: 'Panama' },
    'SV': { flag: '🇸🇻', name: 'El Salvador' },
    // South America
    'CO': { flag: '🇨🇴', name: 'Colombia' },
    // Other
    'GL': { flag: '🇬🇱', name: 'Greenland' }
  };

  const getCountryFlag = (countryCode) => {
    return countryData[countryCode]?.flag || '🌎';
  };

  const getCountryName = (countryCode) => {
    return countryData[countryCode]?.name || countryCode;
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
    const lat = locationToSearch?.lat;
    const lng = locationToSearch?.lng;
    const state = locationToSearch?.state_id;

    setLoading(true);
    try {
      // Build URL with lat/lng for international cities
      let url = `/api/rescue-squads?search=${encodeURIComponent(locationToSearch?.city || searchTerm)}&radius=${radius}&country=${country}`;
      if (lat && lng) {
        url += `&lat=${lat}&lng=${lng}`;
      }
      if (state) {
        url += `&state=${encodeURIComponent(state)}`;
      }
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        setValidationError(data.error || 'Search failed');
        setCities([]);
        setSearched(true);
        return;
      }

      setCities(data.cities || []);
      setSearchLocation({ ...data.searchLocation, country, lat, lng });
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
        setValidationError(data.error || 'Failed to join rescue force');
      }
    } catch (error) {
      setValidationError('Error joining rescue force. Please try again.');
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
        setValidationError(squadData.error || 'Failed to join rescue force');
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

    // Get country and coordinates from selectedLocation or searchLocation
    const country = selectedLocation?.country || searchLocation?.country || 'US';
    const lat = selectedLocation?.lat || searchLocation?.lat;
    const lng = selectedLocation?.lng || searchLocation?.lng;
    const isInternational = country !== 'US' && country !== 'MX';

    if (!state) {
      setValidationError(`No rescue force found for "${city}". Please search by postal code to create a new rescue force for your area.`);
      return;
    }

    try {
      // For US cities, require zipCode; for international, require lat/lng
      if (!isInternational && (!zipCode || !/^\d{5}$/.test(zipCode))) {
        setValidationError('Unable to create rescue force: valid postal code required. Please search by postal code instead.');
        return;
      }
      if (isInternational && (!lat || !lng)) {
        setValidationError('Unable to create rescue force: location coordinates required. Please select a city from the dropdown.');
        return;
      }

      const res = await fetch('/api/rescue-squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, state, zipCode: zipCode || null, country, lat, lng }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/rescue-squads/${data.squad.id}`);
      } else {
        if (data.code === 'WAIVER_NOT_ACCEPTED' && data.redirectTo) {
          router.push(data.redirectTo);
          return;
        }
        setValidationError(data.error || 'Failed to create rescue force');
      }
    } catch (error) {
      setValidationError('Error creating rescue force. Please try again.');
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
          <h1 className="text-3xl font-bold text-midnight-900 mb-2">Find Rescue Forces</h1>
          <p className="text-midnight-500">
            Enter a city name or postal code to find or create a rescue force
          </p>
          <div className="mt-3 inline-flex items-center gap-2 text-sm text-midnight-500">
            <span className="text-lg">🌎</span>
            <span>35+ countries supported</span>
            <button
              type="button"
              onClick={() => setShowCountriesModal(true)}
              className="text-midnight-700 hover:text-flash-600 underline font-medium"
            >
              See list
            </button>
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
                          <span className="text-lg">{getCountryFlag(city.country)}</span>
                          {city.city}, {city.state_name || city.state_id}
                        </div>
                        <div className="text-sm text-midnight-500">
                          {getCountryName(city.country)} {city.zips?.length > 0 ? `• ${city.zips[0]}` : ''}
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
                  aria-label="Search radius"
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
                    ? `Rescue Forces for ${searchLocation.cities.join(', ')}, ${searchLocation.state}`
                    : `Rescue Forces near ${searchLocation.cities?.[0] || searchLocation.city}, ${searchLocation.state}`
                  }
                  {searchLocation.country === 'MX' ? ' 🇲🇽' : searchLocation.country === 'CA' ? ' 🇨🇦' : searchLocation.country === 'PR' ? ' 🇵🇷' : ''}
                </h2>
                <p className="text-sm text-midnight-500">
                  Found {cities.filter(c => c.exists).length} rescue force{cities.filter(c => c.exists).length !== 1 ? 's' : ''} within {radius} miles
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
                            {item.city} Rescue Force
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
                            View Rescue Force
                          </Button>
                        ) : (
                          <Button variant="success" onClick={() => handleJoin(item.squad.id)}>
                            Join Rescue Force
                          </Button>
                        )
                      ) : (
                        <Button onClick={() => handleCreate(item.city, item.state, searchLocation?.zipCode)}>
                          <Plus className="w-4 h-4 mr-1" />
                          Create Rescue Force
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
                                    title="Join the rescue force first"
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

      {/* Supported Countries Modal */}
      {showCountriesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-xl">
            <div className="p-6 border-b border-midnight-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-midnight-900">🌎 Supported Countries</h2>
              <button
                onClick={() => setShowCountriesModal(false)}
                className="text-midnight-400 hover:text-midnight-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <p className="text-midnight-500 mb-4">
                Search for rescue forces in any of these {supportedCountries.length} countries and territories:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {supportedCountries.map((country) => (
                  <div
                    key={country.name}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-midnight-50"
                  >
                    <span className="text-2xl">{country.flag}</span>
                    <div>
                      <div className="font-medium text-midnight-900">{country.name}</div>
                      <div className="text-xs text-midnight-400">{country.cities} cities</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-midnight-100 bg-midnight-50">
              <Button fullWidth onClick={() => setShowCountriesModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
