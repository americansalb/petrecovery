'use client';

import { useState, useEffect, useRef } from 'react';
import { getCitySuggestions, isValidCity } from '../lib/cities';
import { theme } from '../lib/theme';

export default function CitySelector({ value, onChange, state }) {
  const [inputValue, setInputValue] = useState(value || '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredCities, setFilteredCities] = useState([]);
  const [isValid, setIsValid] = useState(true);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize state from value
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Filter cities based on input
  useEffect(() => {
    if (!inputValue || inputValue.trim() === '') {
      setFilteredCities([]);
      setIsValid(true);
      return;
    }

    const suggestions = getCitySuggestions(inputValue, 20);
    setFilteredCities(suggestions);

    // Validate city name
    setIsValid(isValidCity(inputValue));
  }, [inputValue]);

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
  };

  const handleCitySelect = (city) => {
    const cityValue = `${city.city}`;
    setInputValue(cityValue);
    onChange(cityValue, city.state, city.zip);
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
              key={`${city.city}-${city.state}-${idx}`}
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
                {city.state} • ZIP {city.zip}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No matches message */}
      {showDropdown && inputValue && filteredCities.length === 0 && (
        <div
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
            color: theme.colors.gray[600],
          }}
        >
          No matching cities found. Please check spelling.
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
