'use client';

import { useState, useEffect } from 'react';
import { Check, Pipette } from 'lucide-react';

// Pet colors with hex values for matching
const COLORS = [
  { name: 'Black', color: '#1a1a1a', rgb: [26, 26, 26] },
  { name: 'White', color: '#ffffff', border: true, rgb: [255, 255, 255] },
  { name: 'Brown', color: '#78350f', rgb: [120, 53, 15] },
  { name: 'Tan', color: '#d4a574', rgb: [212, 165, 116] },
  { name: 'Golden', color: '#ca8a04', rgb: [202, 138, 4] },
  { name: 'Cream', color: '#fef3c7', border: true, rgb: [254, 243, 199] },
  { name: 'Gray', color: '#6b7280', rgb: [107, 114, 128] },
  { name: 'Orange', color: '#ea580c', rgb: [234, 88, 12] },
  { name: 'Chocolate', color: '#5c3317', rgb: [92, 51, 23] },
  { name: 'Silver', color: '#c0c0c0', border: true, rgb: [192, 192, 192] },
];

// Common patterns for autocomplete
const PATTERNS = [
  'Spotted', 'Striped', 'Tabby', 'Calico', 'Brindle',
  'Merle', 'Tuxedo', 'Patches', 'Speckled', 'Marbled'
];

// Find closest color name from hex
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : null;
}

function colorDistance(rgb1, rgb2) {
  return Math.sqrt(
    Math.pow(rgb1[0] - rgb2[0], 2) +
    Math.pow(rgb1[1] - rgb2[1], 2) +
    Math.pow(rgb1[2] - rgb2[2], 2)
  );
}

function findClosestColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  let closest = COLORS[0];
  let minDistance = Infinity;

  for (const color of COLORS) {
    const dist = colorDistance(rgb, color.rgb);
    if (dist < minDistance) {
      minDistance = dist;
      closest = color;
    }
  }

  return closest.name;
}

export default function ColorSelector({ value, onChange }) {
  const [selectedColors, setSelectedColors] = useState([]);
  const [patternInput, setPatternInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (value) {
      const colors = value.split(',').map(c => c.trim()).filter(c => c);
      setSelectedColors(colors);
    }
  }, []);

  useEffect(() => {
    onChange(selectedColors.join(', '));
  }, [selectedColors, onChange]);

  const toggleColor = (colorName) => {
    setSelectedColors(prev => {
      if (prev.includes(colorName)) {
        return prev.filter(c => c !== colorName);
      } else {
        return [...prev, colorName];
      }
    });
  };

  const addPattern = (pattern) => {
    const trimmed = pattern.trim();
    if (trimmed && !selectedColors.includes(trimmed)) {
      setSelectedColors(prev => [...prev, trimmed]);
    }
    setPatternInput('');
    setShowSuggestions(false);
  };

  const handleColorPick = (e) => {
    const hex = e.target.value;
    const colorName = findClosestColor(hex);
    if (colorName && !selectedColors.includes(colorName)) {
      setSelectedColors(prev => [...prev, colorName]);
    }
  };

  const filteredPatterns = PATTERNS.filter(p =>
    p.toLowerCase().includes(patternInput.toLowerCase()) &&
    !selectedColors.includes(p)
  );

  return (
    <div className="space-y-4">
      {/* Selected preview */}
      {selectedColors.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-green-50 rounded-xl border border-green-200">
          {selectedColors.map(color => (
            <span
              key={color}
              className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-lg text-sm text-green-800 border border-green-200"
            >
              {color}
              <button
                type="button"
                onClick={() => toggleColor(color)}
                className="text-green-400 hover:text-red-500 font-bold"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Colors grid */}
      <div className="grid grid-cols-2 gap-2">
        {COLORS.map(item => {
          const isSelected = selectedColors.includes(item.name);
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => toggleColor(item.name)}
              className={`flex items-center gap-3 p-2 rounded-xl transition-all w-full ${
                isSelected
                  ? 'bg-green-50 ring-2 ring-green-500'
                  : 'bg-white hover:bg-gray-50 border border-gray-100'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex-shrink-0 ${item.border ? 'ring-1 ring-gray-300' : ''}`}
                style={{ backgroundColor: item.color }}
              />
              <span className={`text-sm font-medium ${isSelected ? 'text-green-700' : 'text-gray-700'}`}>
                {item.name}
              </span>
              {isSelected && (
                <Check size={16} className="text-green-600 ml-auto" strokeWidth={3} />
              )}
            </button>
          );
        })}
      </div>

      {/* Color picker */}
      <div className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl">
        <label className="flex items-center gap-2 cursor-pointer">
          <div className="relative">
            <input
              type="color"
              onChange={handleColorPick}
              className="w-10 h-10 rounded-full cursor-pointer border-0 p-0"
              style={{ WebkitAppearance: 'none' }}
            />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Pick from color wheel</p>
            <p className="text-xs text-gray-400">We'll match it to the closest color</p>
          </div>
        </label>
      </div>

      {/* Pattern input with autocomplete */}
      <div className="relative">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pattern (optional)</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={patternInput}
            onChange={(e) => {
              setPatternInput(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && patternInput.trim()) {
                e.preventDefault();
                addPattern(patternInput);
              }
            }}
            placeholder="e.g. Spotted, Striped, Tabby..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none"
          />
          <button
            type="button"
            onClick={() => addPattern(patternInput)}
            disabled={!patternInput.trim()}
            className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-xl hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
          >
            Add
          </button>
        </div>

        {/* Autocomplete suggestions */}
        {showSuggestions && filteredPatterns.length > 0 && patternInput && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
            {filteredPatterns.slice(0, 5).map(pattern => (
              <button
                key={pattern}
                type="button"
                onMouseDown={() => addPattern(pattern)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
              >
                {pattern}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
