'use client';

import { useState, useEffect, useRef } from 'react';
import { getBreedsForSpecies } from '../lib/breeds';

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

  // Initialize state from value (only on mount or when explicitly set)
  useEffect(() => {
    if (value === 'Unknown') {
      setIsUnknown(true);
      setIsOther(false);
      setInputValue('Unknown');
    } else {
      setInputValue(value || '');
      // Don't automatically set isOther - let user manually check it
    }
  }, [value]);

  // Filter breeds based on input
  useEffect(() => {
    if (!hasBreeds || isOther || isUnknown) {
      setFilteredBreeds([]);
      return;
    }

    if (!inputValue || inputValue.trim() === '') {
      setFilteredBreeds(breeds); // Show ALL breeds when empty, not just first 20
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
    <div className="breed-selector" style={{ position: 'relative' }}>
      {/* Unknown Checkbox */}
      <label className="breed-checkbox-label">
        <input
          type="checkbox"
          checked={isUnknown}
          onChange={(e) => handleUnknownChange(e.target.checked)}
          className="breed-checkbox"
        />
        <span className="breed-checkbox-text">Unknown Breed</span>
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
        className="breed-input"
      />

      {/* Dropdown */}
      {showDropdown && filteredBreeds.length > 0 && (
        <div ref={dropdownRef} className="breed-dropdown">
          {/* Count header */}
          {inputValue && (
            <div className="breed-dropdown-header">
              {filteredBreeds.length} {filteredBreeds.length === 1 ? 'match' : 'matches'} found
            </div>
          )}
          {filteredBreeds.map((breed) => (
            <div
              key={breed}
              onClick={() => handleBreedSelect(breed)}
              className="breed-dropdown-item"
            >
              {breed}
            </div>
          ))}
        </div>
      )}

      {/* No matches message */}
      {showDropdown && inputValue && filteredBreeds.length === 0 && hasBreeds && (
        <div className="breed-dropdown breed-no-matches">
          No matches found. Try "Other" to enter a custom breed.
        </div>
      )}

      {/* Other Checkbox */}
      {hasBreeds && (
        <label className="breed-checkbox-label breed-other-label">
          <input
            type="checkbox"
            checked={isOther}
            onChange={(e) => handleOtherChange(e.target.checked)}
            disabled={isUnknown}
            className="breed-checkbox"
            style={{ cursor: isUnknown ? 'not-allowed' : 'pointer' }}
          />
          <span className="breed-checkbox-text">Other / Not Listed</span>
        </label>
      )}

      {/* Help Text */}
      <p className="breed-help-text">
        {isUnknown ? "Breed marked as unknown" :
         isOther ? "Enter any breed name in the field above" :
         hasBreeds ? `${breeds.length} breeds available - click field to see list or start typing to search` :
         "Enter the breed name"}
      </p>

      <style jsx>{`
        .breed-selector {
          position: relative;
        }
        .breed-checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          cursor: pointer;
        }
        .breed-other-label {
          margin-top: 0.75rem;
          margin-bottom: 0;
        }
        .breed-checkbox {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: var(--hub-accent-primary, #22d3ee);
        }
        .breed-checkbox-text {
          font-weight: 600;
          color: var(--hub-text-secondary, #9ca3af);
        }
        .breed-input {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid var(--hub-border, #374151);
          border-radius: 0.5rem;
          font-size: 1rem;
          background: var(--hub-bg-card, #1f2937);
          color: var(--hub-text-primary, #f9fafb);
        }
        .breed-input:disabled {
          background: var(--hub-bg-elevated, #374151);
          cursor: not-allowed;
          opacity: 0.6;
        }
        .breed-input::placeholder {
          color: var(--hub-text-muted, #6b7280);
        }
        .breed-input:focus {
          outline: none;
          border-color: var(--hub-accent-primary, #22d3ee);
          box-shadow: 0 0 0 1px var(--hub-accent-primary, #22d3ee);
        }
        .breed-dropdown {
          position: absolute;
          top: calc(100% + 0.25rem);
          left: 0;
          right: 0;
          max-height: 300px;
          overflow-y: auto;
          background: var(--hub-bg-panel, #111827);
          border: 2px solid var(--hub-border, #374151);
          border-radius: 0.5rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
          z-index: 1000;
        }
        .breed-dropdown-header {
          padding: 0.5rem 1rem;
          background: var(--hub-bg-elevated, #374151);
          border-bottom: 1px solid var(--hub-border, #374151);
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--hub-text-muted, #6b7280);
          position: sticky;
          top: 0;
        }
        .breed-dropdown-item {
          padding: 0.75rem 1rem;
          cursor: pointer;
          border-bottom: 1px solid var(--hub-border, #374151);
          color: var(--hub-text-primary, #f9fafb);
          transition: background 0.15s;
        }
        .breed-dropdown-item:hover {
          background: var(--hub-bg-card, #1f2937);
        }
        .breed-no-matches {
          padding: 1rem;
          text-align: center;
          color: var(--hub-text-muted, #6b7280);
        }
        .breed-help-text {
          font-size: 0.85rem;
          color: var(--hub-text-muted, #6b7280);
          margin-top: 0.5rem;
          margin-bottom: 0;
        }
      `}</style>
    </div>
  );
}
