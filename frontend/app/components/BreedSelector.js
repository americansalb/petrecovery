'use client';

import { useState, useEffect, useRef } from 'react';
import { getBreedsForSpecies } from '../lib/breeds';
import { theme } from '../lib/theme';

export default function BreedSelector({ species, value, onChange }) {
  const [inputValue, setInputValue] = useState(value || '');
  const [isOther, setIsOther] = useState(false);
  const [isUnknown, setIsUnknown] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredBreeds, setFilteredBreeds] = useState([]);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const breeds = getBreedsForSpecies(species);
  const hasBreeds = breeds.length > 0;

  // Initialize state from value
  useEffect(() => {
    if (value === 'Unknown') {
      setIsUnknown(true);
      setIsOther(false);
      setInputValue('Unknown');
    } else if (value && !breeds.includes(value)) {
      setIsOther(true);
      setIsUnknown(false);
      setInputValue(value);
    } else {
      setIsOther(false);
      setIsUnknown(false);
      setInputValue(value || '');
    }
  }, [value, breeds]);

  // Filter breeds based on input
  useEffect(() => {
    if (!hasBreeds || isOther || isUnknown) {
      setFilteredBreeds([]);
      return;
    }

    if (!inputValue) {
      setFilteredBreeds(breeds);
    } else {
      const filtered = breeds.filter(breed =>
        breed.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredBreeds(filtered);
    }
  }, [inputValue, breeds, hasBreeds, isOther, isUnknown]);

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
    if (hasBreeds && !isOther && !isUnknown) {
      setShowDropdown(true);
    }
  };

  const handleBreedSelect = (breed) => {
    setInputValue(breed);
    onChange(breed);
    setShowDropdown(false);
  };

  const handleUnknownChange = (checked) => {
    setIsUnknown(checked);
    if (checked) {
      setIsOther(false);
      setInputValue('Unknown');
      onChange('Unknown');
      setShowDropdown(false);
    } else {
      setInputValue('');
      onChange('');
    }
  };

  const handleOtherChange = (checked) => {
    setIsOther(checked);
    if (checked) {
      setIsUnknown(false);
      setInputValue('');
      onChange('');
      setShowDropdown(false);
      // Focus input after a brief delay
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setInputValue('');
      onChange('');
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Unknown Checkbox */}
      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.75rem',
        cursor: 'pointer',
      }}>
        <input
          type="checkbox"
          checked={isUnknown}
          onChange={(e) => handleUnknownChange(e.target.checked)}
          style={{
            width: '18px',
            height: '18px',
            cursor: 'pointer',
          }}
        />
        <span style={{ fontWeight: '600', color: theme.colors.gray[700] }}>
          Unknown Breed
        </span>
      </label>

      {/* Input Field */}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          if (hasBreeds && !isOther && !isUnknown) {
            setShowDropdown(true);
          }
        }}
        placeholder={
          isUnknown ? "Unknown" :
          isOther ? "Enter breed name..." :
          hasBreeds ? "Start typing to search breeds..." :
          "Enter breed name..."
        }
        disabled={isUnknown}
        style={{
          width: '100%',
          padding: '0.75rem',
          border: '2px solid #e5e7eb',
          borderRadius: theme.radius.md,
          fontSize: '1rem',
          backgroundColor: isUnknown ? '#f9fafb' : 'white',
          cursor: isUnknown ? 'not-allowed' : 'text',
        }}
      />

      {/* Dropdown */}
      {showDropdown && filteredBreeds.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 0.25rem)',
            left: 0,
            right: 0,
            maxHeight: '250px',
            overflowY: 'auto',
            background: 'white',
            border: '2px solid #e5e7eb',
            borderRadius: theme.radius.md,
            boxShadow: theme.shadows.lg,
            zIndex: 1000,
          }}
        >
          {filteredBreeds.map((breed) => (
            <div
              key={breed}
              onClick={() => handleBreedSelect(breed)}
              style={{
                padding: '0.75rem 1rem',
                cursor: 'pointer',
                borderBottom: '1px solid #f3f4f6',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
              }}
            >
              {breed}
            </div>
          ))}
        </div>
      )}

      {/* No matches message */}
      {showDropdown && inputValue && filteredBreeds.length === 0 && hasBreeds && (
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
          No matches found. Try "Other" to enter a custom breed.
        </div>
      )}

      {/* Other Checkbox */}
      {hasBreeds && (
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginTop: '0.75rem',
          cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={isOther}
            onChange={(e) => handleOtherChange(e.target.checked)}
            disabled={isUnknown}
            style={{
              width: '18px',
              height: '18px',
              cursor: isUnknown ? 'not-allowed' : 'pointer',
            }}
          />
          <span style={{ fontWeight: '600', color: theme.colors.gray[700] }}>
            Other / Not Listed
          </span>
        </label>
      )}

      {/* Help Text */}
      <p style={{
        fontSize: '0.85rem',
        color: theme.colors.gray[500],
        marginTop: '0.5rem',
      }}>
        {isUnknown ? "Breed marked as unknown" :
         isOther ? "Enter the breed name in the field above" :
         hasBreeds ? `Type to search ${filteredBreeds.length} breeds` :
         "Enter the breed name"}
      </p>
    </div>
  );
}
