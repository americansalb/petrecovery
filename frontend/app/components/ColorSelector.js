'use client';

import { useState, useEffect, useRef } from 'react';
import { PET_COLORS } from '../lib/colors';

export default function ColorSelector({ value, onChange }) {
  const [selectedColors, setSelectedColors] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredColors, setFilteredColors] = useState(PET_COLORS);
  const [isOther, setIsOther] = useState(false);
  const dropdownRef = useRef(null);

  // Initialize from value
  useEffect(() => {
    if (value) {
      // Split by comma and trim
      const colors = value.split(',').map(c => c.trim()).filter(c => c);
      setSelectedColors(colors);

      // Check if any color is not in the predefined list
      const hasCustomColor = colors.some(c => !PET_COLORS.includes(c));
      if (hasCustomColor) {
        setIsOther(true);
      }
    }
  }, []);

  // Update parent when selectedColors changes
  useEffect(() => {
    onChange(selectedColors.join(', '));
  }, [selectedColors]);

  // Filter colors based on input
  useEffect(() => {
    if (!inputValue || inputValue.trim() === '') {
      setFilteredColors(PET_COLORS);
    } else {
      const filtered = PET_COLORS.filter(color =>
        color.toLowerCase().includes(inputValue.toLowerCase())
      );
      setFilteredColors(filtered);
    }
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

  const handleColorClick = (color) => {
    if (selectedColors.includes(color)) {
      // Remove color
      setSelectedColors(selectedColors.filter(c => c !== color));
    } else {
      // Add color
      setSelectedColors([...selectedColors, color]);
    }
  };

  const handleRemoveColor = (colorToRemove) => {
    setSelectedColors(selectedColors.filter(c => c !== colorToRemove));
  };

  const handleOtherToggle = (checked) => {
    setIsOther(checked);
    if (!checked) {
      // Remove any custom colors when unchecking "Other"
      const standardColors = selectedColors.filter(c => PET_COLORS.includes(c));
      setSelectedColors(standardColors);
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (!isOther) {
      setShowDropdown(true);
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' && isOther && inputValue.trim()) {
      e.preventDefault();
      // Add custom color
      if (!selectedColors.includes(inputValue.trim())) {
        setSelectedColors([...selectedColors, inputValue.trim()]);
      }
      setInputValue('');
    }
  };

  return (
    <div className="color-selector" style={{ position: 'relative' }}>
      {/* Selected Colors Display */}
      {selectedColors.length > 0 && (
        <div className="color-selected-list">
          {selectedColors.map((color) => (
            <div key={color} className="color-tag">
              {color}
              <button
                type="button"
                onClick={() => handleRemoveColor(color)}
                className="color-tag-remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Field */}
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleInputKeyDown}
        onFocus={() => {
          if (!isOther) {
            setShowDropdown(true);
          }
        }}
        placeholder={
          isOther
            ? "Type color and press Enter to add..."
            : "Click to select colors or start typing..."
        }
        className="color-input"
      />

      {/* Dropdown */}
      {showDropdown && !isOther && filteredColors.length > 0 && (
        <div ref={dropdownRef} className="color-dropdown">
          {filteredColors.map((color) => (
            <div
              key={color}
              onClick={() => handleColorClick(color)}
              className={`color-dropdown-item ${selectedColors.includes(color) ? 'selected' : ''}`}
            >
              <input
                type="checkbox"
                checked={selectedColors.includes(color)}
                readOnly
                className="color-checkbox"
              />
              {color}
            </div>
          ))}
        </div>
      )}

      {/* Other Checkbox */}
      <label className="color-other-label">
        <input
          type="checkbox"
          checked={isOther}
          onChange={(e) => handleOtherToggle(e.target.checked)}
          className="color-other-checkbox"
        />
        <span className="color-other-text">Other / Custom Color</span>
      </label>

      {/* Help Text */}
      <p className="color-help-text">
        {isOther
          ? "Type a color and press Enter to add it"
          : `${selectedColors.length} color${selectedColors.length !== 1 ? 's' : ''} selected - click colors to add/remove`}
      </p>

      <style jsx>{`
        .color-selector {
          position: relative;
        }
        .color-selected-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }
        .color-tag {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: var(--hub-status-success, #10b981) / 0.15;
          background: rgba(16, 185, 129, 0.15);
          border: 2px solid var(--hub-status-success, #10b981);
          border-radius: 0.5rem;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--hub-status-success, #10b981);
        }
        .color-tag-remove {
          background: none;
          border: none;
          color: var(--hub-status-high, #ef4444);
          cursor: pointer;
          font-size: 1.1rem;
          line-height: 1;
          padding: 0;
        }
        .color-input {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid var(--hub-border, #374151);
          border-radius: 0.5rem;
          font-size: 1rem;
          background: var(--hub-bg-card, #1f2937);
          color: var(--hub-text-primary, #f9fafb);
        }
        .color-input::placeholder {
          color: var(--hub-text-muted, #6b7280);
        }
        .color-input:focus {
          outline: none;
          border-color: var(--hub-accent-primary, #22d3ee);
          box-shadow: 0 0 0 1px var(--hub-accent-primary, #22d3ee);
        }
        .color-dropdown {
          position: absolute;
          top: calc(100% + 0.25rem);
          left: 0;
          right: 0;
          max-height: 250px;
          overflow-y: auto;
          background: var(--hub-bg-panel, #111827);
          border: 2px solid var(--hub-border, #374151);
          border-radius: 0.5rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
          z-index: 1000;
        }
        .color-dropdown-item {
          padding: 0.75rem 1rem;
          cursor: pointer;
          border-bottom: 1px solid var(--hub-border, #374151);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--hub-text-primary, #f9fafb);
          transition: background 0.15s;
        }
        .color-dropdown-item:hover {
          background: var(--hub-bg-card, #1f2937);
        }
        .color-dropdown-item.selected {
          background: rgba(16, 185, 129, 0.15);
        }
        .color-checkbox {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: var(--hub-accent-primary, #22d3ee);
        }
        .color-other-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.75rem;
          cursor: pointer;
        }
        .color-other-checkbox {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: var(--hub-accent-primary, #22d3ee);
        }
        .color-other-text {
          font-weight: 600;
          color: var(--hub-text-secondary, #9ca3af);
        }
        .color-help-text {
          font-size: 0.85rem;
          color: var(--hub-text-muted, #6b7280);
          margin-top: 0.5rem;
          margin-bottom: 0;
        }
      `}</style>
    </div>
  );
}
