'use client';

/**
 * CitySearchInput - Unified city search component
 *
 * A reusable component for searching cities across 35+ supported countries.
 * Uses the unified /api/cities/suggest API with accent-insensitive search.
 *
 * Usage:
 * <CitySearchInput
 *   value={searchTerm}
 *   onChange={setSearchTerm}
 *   onSelect={(city) => console.log(city)}
 *   placeholder="Enter city name or postal code"
 * />
 *
 * The onSelect callback receives:
 * {
 *   city: "Los Angeles",
 *   state_id: "CA",
 *   state_name: "California",
 *   country: "US",
 *   lat: 34.0522,
 *   lng: -118.2437,
 *   zips: ["90001", "90002", ...]
 * }
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

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
  'VI': { flag: '🇻🇮', name: 'US Virgin Islands' },
  'PR': { flag: '🇵🇷', name: 'Puerto Rico' },
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

export const getCountryFlag = (countryCode) => {
  return countryData[countryCode]?.flag || '🌎';
};

export const getCountryName = (countryCode) => {
  return countryData[countryCode]?.name || countryCode;
};

// List of all supported countries for display
export const supportedCountries = [
  { flag: '🇺🇸', name: 'United States', code: 'US', cities: '~29,000' },
  { flag: '🇨🇦', name: 'Canada', code: 'CA', cities: '1,079' },
  { flag: '🇲🇽', name: 'Mexico', code: 'MX', cities: '9,321' },
  { flag: '🇨🇴', name: 'Colombia', code: 'CO', cities: '1,122' },
  { flag: '🇬🇹', name: 'Guatemala', code: 'GT', cities: '382' },
  { flag: '🇭🇳', name: 'Honduras', code: 'HN', cities: '545' },
  { flag: '🇸🇻', name: 'El Salvador', code: 'SV', cities: '100' },
  { flag: '🇳🇮', name: 'Nicaragua', code: 'NI', cities: '155' },
  { flag: '🇨🇷', name: 'Costa Rica', code: 'CR', cities: '159' },
  { flag: '🇵🇦', name: 'Panama', code: 'PA', cities: '551' },
  { flag: '🇧🇿', name: 'Belize', code: 'BZ', cities: '13' },
  { flag: '🇨🇺', name: 'Cuba', code: 'CU', cities: '187' },
  { flag: '🇯🇲', name: 'Jamaica', code: 'JM', cities: '837' },
  { flag: '🇭🇹', name: 'Haiti', code: 'HT', cities: '124' },
  { flag: '🇩🇴', name: 'Dominican Republic', code: 'DO', cities: '207' },
  { flag: '🇧🇸', name: 'Bahamas', code: 'BS', cities: '21' },
  { flag: '🇹🇹', name: 'Trinidad and Tobago', code: 'TT', cities: '25' },
  { flag: '🇧🇧', name: 'Barbados', code: 'BB', cities: '7' },
  { flag: '🇦🇬', name: 'Antigua and Barbuda', code: 'AG', cities: '9' },
  { flag: '🇩🇲', name: 'Dominica', code: 'DM', cities: '17' },
  { flag: '🇬🇩', name: 'Grenada', code: 'GD', cities: '7' },
  { flag: '🇰🇳', name: 'Saint Kitts and Nevis', code: 'KN', cities: '13' },
  { flag: '🇱🇨', name: 'Saint Lucia', code: 'LC', cities: '479' },
  { flag: '🇻🇨', name: 'Saint Vincent', code: 'VC', cities: '9' },
  { flag: '🇦🇮', name: 'Anguilla', code: 'AI', cities: '12' },
  { flag: '🇦🇼', name: 'Aruba', code: 'AW', cities: '12' },
  { flag: '🇧🇲', name: 'Bermuda', code: 'BM', cities: '9' },
  { flag: '🇰🇾', name: 'Cayman Islands', code: 'KY', cities: '7' },
  { flag: '🇹🇨', name: 'Turks and Caicos', code: 'TC', cities: '8' },
  { flag: '🇻🇬', name: 'British Virgin Islands', code: 'VG', cities: '5' },
  { flag: '🇻🇮', name: 'US Virgin Islands', code: 'VI', cities: '20' },
  { flag: '🇬🇵', name: 'Guadeloupe', code: 'GP', cities: '32' },
  { flag: '🇲🇶', name: 'Martinique', code: 'MQ', cities: '34' },
  { flag: '🇨🇼', name: 'Curaçao', code: 'CW', cities: '12' },
  { flag: '🇬🇱', name: 'Greenland', code: 'GL', cities: '18' },
];

export default function CitySearchInput({
  value = '',
  onChange,
  onSelect,
  selectedCity = null,
  placeholder = 'Enter city name or postal code',
  label = null,
  error = null,
  required = false,
  disabled = false,
  className = '',
  inputClassName = '',
  showIcon = true,
  autoFocus = false,
  minLength = 2,
  debounceMs = 150,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inputType, setInputType] = useState(null);
  const currentQueryRef = useRef('');
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Fetch suggestions from the unified API
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.trim().length < minLength) {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
      return;
    }

    const trimmedQuery = query.trim();
    currentQueryRef.current = trimmedQuery;
    setIsLoading(true);

    try {
      const res = await fetch(`/api/cities/suggest?q=${encodeURIComponent(trimmedQuery)}&limit=15`);
      const data = await res.json();

      // Only update if this is still the current query (prevents race conditions)
      if (currentQueryRef.current === trimmedQuery) {
        setSuggestions(data.suggestions || []);
        setShowSuggestions(true);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('[CitySearchInput] Failed to fetch suggestions:', error);
      if (currentQueryRef.current === trimmedQuery) {
        setSuggestions([]);
        setShowSuggestions(true);
        setIsLoading(false);
      }
    }
  }, [minLength]);

  // Handle input change with debouncing
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange?.(newValue);

    // Detect input type (postal code vs city name)
    const isZip = /^\d{0,5}$/.test(newValue);
    setInputType(isZip ? 'zip' : 'city');

    // Clear any existing debounce timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce the API call
    if (newValue.trim().length >= minLength) {
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(newValue);
      }, debounceMs);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Handle suggestion selection
  const handleSelect = (city) => {
    const flag = getCountryFlag(city.country);
    const displayValue = `${city.city}, ${city.state_name || city.state_id} ${flag}`;
    onChange?.(displayValue);
    onSelect?.(city);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block font-semibold mb-2 text-midnight-700 text-sm">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {showIcon && (
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-midnight-400 pointer-events-none" />
        )}

        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          required={required}
          className={`
            w-full px-4 py-3 border-2 rounded-xl
            focus:ring-2 focus:ring-flash-400 focus:border-flash-400
            outline-none transition
            ${showIcon ? 'pl-10' : ''}
            ${error ? 'border-red-500' : 'border-midnight-200'}
            ${disabled ? 'bg-midnight-50 cursor-not-allowed' : 'bg-white'}
            ${inputClassName}
          `}
        />

        {/* Input type indicator */}
        {inputType && value.trim() && !selectedCity && (
          <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold px-2 py-0.5 rounded ${
            inputType === 'zip' ? 'bg-midnight-100 text-midnight-600' : 'bg-green-100 text-green-600'
          }`}>
            {inputType === 'zip' ? 'Postal' : 'City'}
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-5 h-5 text-midnight-400 animate-spin" />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-2 text-sm text-red-600 font-medium">
          {error}
        </div>
      )}

      {/* Loading dropdown */}
      {isLoading && value.trim().length >= minLength && (
        <div className="absolute top-full left-0 right-0 bg-white border border-midnight-200 rounded-xl mt-2 p-4 z-50 shadow-lg text-center">
          <div className="text-midnight-500 text-sm">Searching...</div>
        </div>
      )}

      {/* No results message */}
      {showSuggestions && suggestions.length === 0 && !isLoading && value.trim().length >= minLength && (
        <div className="absolute top-full left-0 right-0 bg-white border border-midnight-200 rounded-xl mt-2 p-4 z-50 shadow-lg text-center">
          <div className="text-midnight-500 text-sm">No cities found matching "{value.trim()}"</div>
        </div>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && !isLoading && (
        <div className="absolute top-full left-0 right-0 bg-white border border-midnight-200 rounded-xl mt-2 max-h-64 overflow-y-auto z-50 shadow-lg">
          {suggestions.map((city, idx) => (
            <div
              key={`${city.city}-${city.state_id}-${city.country}-${idx}`}
              onMouseDown={() => handleSelect(city)}
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
  );
}
