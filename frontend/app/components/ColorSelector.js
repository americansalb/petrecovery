'use client';

import { useState, useEffect, useRef } from 'react';
import { PET_COLORS } from '../lib/colors';
import { theme } from '../lib/theme';

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
    <div style={{ position: 'relative' }}>
      {/* Selected Colors Display */}
      {selectedColors.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}>
          {selectedColors.map((color) => (
            <div
              key={color}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                background: '#f0fdf4',
                border: '2px solid #10b981',
                borderRadius: theme.radius.md,
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#065f46',
              }}
            >
              {color}
              <button
                type="button"
                onClick={() => handleRemoveColor(color)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  lineHeight: 1,
                  padding: 0,
                }}
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
        style={{
          width: '100%',
          padding: '0.75rem',
          border: '2px solid #e5e7eb',
          borderRadius: theme.radius.md,
          fontSize: '1rem',
        }}
      />

      {/* Dropdown */}
      {showDropdown && !isOther && filteredColors.length > 0 && (
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
          {filteredColors.map((color) => (
            <div
              key={color}
              onClick={() => handleColorClick(color)}
              style={{
                padding: '0.75rem 1rem',
                cursor: 'pointer',
                borderBottom: '1px solid #f3f4f6',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: selectedColors.includes(color) ? '#f0fdf4' : 'white',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!selectedColors.includes(color)) {
                  e.currentTarget.style.background = '#f8fafc';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = selectedColors.includes(color) ? '#f0fdf4' : 'white';
              }}
            >
              <input
                type="checkbox"
                checked={selectedColors.includes(color)}
                readOnly
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                }}
              />
              {color}
            </div>
          ))}
        </div>
      )}

      {/* Other Checkbox */}
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
          onChange={(e) => handleOtherToggle(e.target.checked)}
          style={{
            width: '18px',
            height: '18px',
            cursor: 'pointer',
          }}
        />
        <span style={{ fontWeight: '600', color: theme.colors.gray[700] }}>
          Other / Custom Color
        </span>
      </label>

      {/* Help Text */}
      <p style={{
        fontSize: '0.85rem',
        color: theme.colors.gray[500],
        marginTop: '0.5rem',
      }}>
        {isOther
          ? "Type a color and press Enter to add it"
          : `${selectedColors.length} color${selectedColors.length !== 1 ? 's' : ''} selected - click colors to add/remove`}
      </p>
    </div>
  );
}
