'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { theme } from '../lib/theme';

export default function CitySelector({ value, onChange, state }) {
  const [inputValue, setInputValue] = useState(value || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredCities, setFilteredCities] = useState([]);
  const [isValid, setIsValid] = useState(true);
  const [requestStatus, setRequestStatus] = useState(null); // null, 'sending', 'sent', 'error'
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const handleRequestCity = async () => {
    if (!inputValue || inputValue.trim().length < 2) return;

    setRequestStatus('sending');
    try {
      const res = await fetch('/api/cities/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityName: inputValue.trim() }),
      });

      if (res.ok) {
        setRequestStatus('sent');
      } else {
        setRequestStatus('error');
      }
    } catch {
      setRequestStatus('error');
    }
  };

  // Initialize state from value
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Fetch suggestions from API with debounce
  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.trim().length < 3) {
      setFilteredCities([]);
      setIsValid(true);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({ q: query.trim(), limit: '20' });
      const res = await fetch(`/api/cities/suggest?${params}`);
      const data = await res.json();

      setFilteredCities(data.suggestions || []);
      setIsValid(data.isValid !== false);
    } catch (err) {
      console.error('City suggest error:', err);
      setFilteredCities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search on input change
  useEffect(() => {
    if (!inputValue || inputValue.trim().length < 3) {
      setFilteredCities([]);
      setIsValid(true);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(inputValue);
    }, 250);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [inputValue, fetchSuggestions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setShowDropdown(true);
    setRequestStatus(null);
  };

  const handleCitySelect = (city) => {
    const cityValue = `${city.city}`;
    setInputValue(cityValue);
    onChange(cityValue, city.state_id || city.state, city.zip || (city.zips && city.zips[0]));
    setShowDropdown(false);
    setIsValid(true);
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Input Field */}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          if (filteredCities.length > 0) {
            setShowDropdown(true);
          }
        }}
        placeholder="Start typing city name..."
        style={{
          width: '100%',
          padding: '0.75rem',
          border: `2px solid ${!isValid && inputValue ? '#ef4444' : '#e5e7eb'}`,
          borderRadius: theme.radius.md,
          fontSize: '1rem',
          backgroundColor: 'white',
        }}
      />

      {/* Validation message */}
      {!isValid && inputValue && (
        <p style={{
          fontSize: '0.85rem',
          color: '#ef4444',
          marginTop: '0.5rem',
        }}>
          City not found. Try &quot;St.&quot; as &quot;Saint&quot; or check spelling.
        </p>
      )}

      {/* Dropdown */}
      {showDropdown && filteredCities.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.25rem)',
            left: 0,
            right: 0,
            maxHeight: '300px',
            overflowY: 'auto',
            background: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: theme.radius.md,
            boxShadow: theme.shadows.lg,
            zIndex: 1000,
          }}
        >
          {/* Count header */}
          {inputValue && (
            <div style={{
              padding: '0.5rem 1rem',
              background: '#f8fafc',
              borderBottom: '1px solid #e5e7eb',
              fontSize: '0.85rem',
              fontWeight: '600',
              color: theme.colors.gray[600],
              position: 'sticky',
              top: 0,
            }}>
              {filteredCities.length} {filteredCities.length === 1 ? 'match' : 'matches'} found
            </div>
          )}
          {filteredCities.map((city, idx) => (
            <div
              key={`${city.city}-${city.state_id || city.state}-${idx}`}
              onClick={() => handleCitySelect(city)}
              style={{
                padding: '0.75rem 1rem',
                cursor: 'pointer',
                borderBottom: idx < filteredCities.length - 1 ? '1px solid #f3f4f6' : 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
              }}
            >
              <div style={{ fontWeight: '600', color: '#0f172a' }}>
                {city.city}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                {city.state_id || city.state} {city.country && city.country !== 'US' ? `• ${city.country}` : ''} {city.zip ? `• ZIP ${city.zip}` : city.zips && city.zips[0] ? `• ZIP ${city.zips[0]}` : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No matches message with request option */}
      {showDropdown && inputValue && inputValue.length >= 3 && filteredCities.length === 0 && !loading && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.25rem)',
            left: 0,
            right: 0,
            padding: '1rem',
            background: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: theme.radius.md,
            boxShadow: theme.shadows.lg,
            zIndex: 1000,
            textAlign: 'center',
          }}
        >
          <p style={{ color: theme.colors.gray[600], marginBottom: '0.75rem' }}>
            No matching cities found.
          </p>

          {requestStatus === 'sent' ? (
            <p style={{ color: '#10b981', fontSize: '0.9rem', fontWeight: '500' }}>
              ✓ Request submitted! We&apos;ll review it soon.
            </p>
          ) : requestStatus === 'error' ? (
            <p style={{ color: '#ef4444', fontSize: '0.9rem' }}>
              Failed to submit. Please try again.
            </p>
          ) : (
            <button
              onClick={handleRequestCity}
              disabled={requestStatus === 'sending'}
              style={{
                background: theme.colors.primary,
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: theme.radius.md,
                fontSize: '0.9rem',
                fontWeight: '500',
                cursor: requestStatus === 'sending' ? 'wait' : 'pointer',
                opacity: requestStatus === 'sending' ? 0.7 : 1,
              }}
            >
              {requestStatus === 'sending' ? 'Submitting...' : "Don't see your city? Request it!"}
            </button>
          )}
        </div>
      )}

      {/* Help Text */}
      <p style={{
        fontSize: '0.85rem',
        color: theme.colors.gray[500],
        marginTop: '0.5rem',
      }}>
        Type at least 3 characters (US, Mexico, Canada supported)
      </p>
    </div>
  );
}
