'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

// Comprehensive pet colors - scroll to find exact match
const COLORS = [
  // Blacks
  { name: 'Black', color: '#0a0a0a' },
  { name: 'Jet Black', color: '#1a1a1a' },
  { name: 'Charcoal', color: '#36454f' },

  // Whites
  { name: 'White', color: '#ffffff', border: true },
  { name: 'Off-White', color: '#faf9f6', border: true },
  { name: 'Ivory', color: '#fffff0', border: true },

  // Grays
  { name: 'Light Gray', color: '#d3d3d3', border: true },
  { name: 'Gray', color: '#808080' },
  { name: 'Dark Gray', color: '#505050' },
  { name: 'Silver', color: '#c0c0c0', border: true },
  { name: 'Slate', color: '#708090' },
  { name: 'Blue Gray', color: '#6699cc' },

  // Browns
  { name: 'Light Brown', color: '#a67b5b' },
  { name: 'Brown', color: '#8b4513' },
  { name: 'Dark Brown', color: '#5c4033' },
  { name: 'Chocolate', color: '#3d2314' },
  { name: 'Chestnut', color: '#954535' },
  { name: 'Mahogany', color: '#4a0000' },
  { name: 'Liver', color: '#674c47' },
  { name: 'Seal', color: '#321414' },

  // Tans & Beiges
  { name: 'Tan', color: '#d2b48c' },
  { name: 'Light Tan', color: '#e6d5b8' },
  { name: 'Dark Tan', color: '#9a7b4f' },
  { name: 'Beige', color: '#f5f5dc', border: true },
  { name: 'Fawn', color: '#e5aa70' },
  { name: 'Sand', color: '#c2b280' },
  { name: 'Buff', color: '#f0dc82' },
  { name: 'Wheaten', color: '#f5deb3' },

  // Creams & Yellows
  { name: 'Cream', color: '#fffdd0', border: true },
  { name: 'Champagne', color: '#f7e7ce', border: true },
  { name: 'Apricot', color: '#fbceb1' },
  { name: 'Honey', color: '#eb9605' },
  { name: 'Yellow', color: '#ffd700' },
  { name: 'Lemon', color: '#fff44f' },

  // Golds
  { name: 'Golden', color: '#daa520' },
  { name: 'Light Golden', color: '#eee8aa' },
  { name: 'Dark Golden', color: '#b8860b' },
  { name: 'Copper', color: '#b87333' },
  { name: 'Bronze', color: '#cd7f32' },

  // Oranges & Reds
  { name: 'Orange', color: '#ff8c00' },
  { name: 'Light Orange', color: '#ffb347' },
  { name: 'Dark Orange', color: '#cc5500' },
  { name: 'Red', color: '#b22222' },
  { name: 'Rust', color: '#b7410e' },
  { name: 'Ginger', color: '#b06500' },
  { name: 'Auburn', color: '#a52a2a' },
  { name: 'Cinnamon', color: '#d2691e' },
  { name: 'Sorrel', color: '#c04000' },

  // Rare/Special
  { name: 'Lilac', color: '#c8a2c8' },
  { name: 'Blue', color: '#6a8faf' },
  { name: 'Lavender', color: '#b4a7d6' },
  { name: 'Pink', color: '#ffc0cb' },
];

// Common patterns for autocomplete
const PATTERNS = [
  'Spotted', 'Striped', 'Tabby', 'Calico', 'Brindle',
  'Merle', 'Tuxedo', 'Patches', 'Speckled', 'Marbled',
  'Ticked', 'Roan', 'Sable', 'Points', 'Mask'
];

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

      {/* Scrollable color grid */}
      <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-xl p-2 bg-white">
        <div className="grid grid-cols-2 gap-2">
          {COLORS.map(item => {
            const isSelected = selectedColors.includes(item.name);
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => toggleColor(item.name)}
                className={`flex items-center gap-2 p-2 rounded-lg transition-all w-full ${
                  isSelected
                    ? 'bg-green-50 ring-2 ring-green-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex-shrink-0 ${item.border ? 'ring-1 ring-gray-300' : ''}`}
                  style={{ backgroundColor: item.color }}
                />
                <span className={`text-xs font-medium ${isSelected ? 'text-green-700' : 'text-gray-700'}`}>
                  {item.name}
                </span>
                {isSelected && (
                  <Check size={14} className="text-green-600 ml-auto" strokeWidth={3} />
                )}
              </button>
            );
          })}
        </div>
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
