'use client';

import { useState, useEffect, useRef } from 'react';
import { PET_COLORS } from '../lib/colors';

export default function ColorSelector({ value, onChange }) {
  const [selectedColors, setSelectedColors] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(true); // Show dropdown by default
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
            ? "Type a custom color and press Enter..."
            : "Type to filter colors below..."
        }
        className="color-input"
      />

      {/* Color Options Grid - Always visible when not in "Other" mode */}
      {!isOther && (
        <div ref={dropdownRef} className="color-grid">
          {filteredColors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleColorClick(color)}
              className={`color-grid-item ${selectedColors.includes(color) ? 'selected' : ''}`}
            >
              {color}
              {selectedColors.includes(color) && <span className="color-check">✓</span>}
            </button>
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
          ? "Type a color name and press Enter to add it"
          : selectedColors.length > 0
            ? `${selectedColors.length} color${selectedColors.length !== 1 ? 's' : ''} selected — click again to remove`
            : "Click colors below to select (you can choose multiple)"}
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
          background: rgba(16, 185, 129, 0.15);
          border: 2px solid #10b981;
          border-radius: 0.5rem;
          font-size: 0.9rem;
          font-weight: 600;
          color: #059669;
        }
        .color-tag-remove {
          background: none;
          border: none;
          color: #ef4444;
          cursor: pointer;
          font-size: 1.1rem;
          line-height: 1;
          padding: 0;
        }
        .color-input {
          width: 100%;
          padding: 0.75rem;
          border: 2px solid #d1d5db;
          border-radius: 0.5rem;
          font-size: 1rem;
          background: white;
          color: #111827;
        }
        .color-input::placeholder {
          color: #9ca3af;
        }
        .color-input:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
        .color-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.75rem;
          padding: 0.75rem;
          background: #f9fafb;
          border: 2px solid #e5e7eb;
          border-radius: 0.5rem;
          max-height: 200px;
          overflow-y: auto;
        }
        .color-grid-item {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.5rem 0.75rem;
          border: 2px solid #d1d5db;
          border-radius: 0.5rem;
          background: white;
          color: #374151;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        .color-grid-item:hover {
          border-color: #6366f1;
          background: #f5f3ff;
        }
        .color-grid-item.selected {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.15);
          color: #059669;
          font-weight: 600;
        }
        .color-check {
          font-size: 0.75rem;
          font-weight: bold;
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
          min-width: 18px;
          min-height: 18px;
          cursor: pointer;
          accent-color: #6366f1;
        }
        .color-other-text {
          font-weight: 600;
          color: #374151;
        }
        .color-help-text {
          font-size: 0.85rem;
          color: #6b7280;
          margin-top: 0.5rem;
          margin-bottom: 0;
        }
      `}</style>
    </div>
  );
}
