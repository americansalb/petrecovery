'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

// Species-specific color palettes - simplified and cleaner
const DOG_COLORS = [
  { name: 'Black', color: '#1a1a1a' },
  { name: 'White', color: '#ffffff', border: true },
  { name: 'Brown', color: '#78350f' },
  { name: 'Tan', color: '#d4a574' },
  { name: 'Golden', color: '#ca8a04' },
  { name: 'Gray', color: '#6b7280' },
  { name: 'Cream', color: '#fef3c7', border: true },
  { name: 'Red', color: '#b91c1c' },
];

const DOG_PATTERNS = [
  { name: 'Brindle', colors: ['#78350f', '#1a1a1a'] },
  { name: 'Spotted', colors: ['#ffffff', '#1a1a1a'], border: true },
  { name: 'Merle', colors: ['#c0c0c0', '#1a1a1a'] },
  { name: 'Mixed', colors: ['#78350f', '#d4a574', '#1a1a1a'] },
];

const CAT_COLORS = [
  { name: 'Black', color: '#1a1a1a' },
  { name: 'White', color: '#ffffff', border: true },
  { name: 'Orange', color: '#ea580c' },
  { name: 'Gray', color: '#6b7280' },
  { name: 'Brown', color: '#78350f' },
  { name: 'Cream', color: '#fef3c7', border: true },
  { name: 'Silver', color: '#c0c0c0', border: true },
  { name: 'Ginger', color: '#c2410c' },
];

const CAT_PATTERNS = [
  { name: 'Tabby', colors: ['#d4a574', '#78350f'] },
  { name: 'Calico', colors: ['#ea580c', '#1a1a1a', '#ffffff'], border: true },
  { name: 'Tortie', colors: ['#ea580c', '#1a1a1a', '#78350f'] },
  { name: 'Tuxedo', colors: ['#1a1a1a', '#ffffff'], border: true },
];

const BIRD_COLORS = [
  { name: 'Green', color: '#16a34a' },
  { name: 'Blue', color: '#2563eb' },
  { name: 'Yellow', color: '#eab308' },
  { name: 'Red', color: '#dc2626' },
  { name: 'White', color: '#ffffff', border: true },
  { name: 'Gray', color: '#6b7280' },
  { name: 'Orange', color: '#ea580c' },
  { name: 'Purple', color: '#7c3aed' },
];

const BIRD_PATTERNS = [
  { name: 'Multi-Color', colors: ['#16a34a', '#eab308', '#2563eb'] },
  { name: 'Pied', colors: ['#16a34a', '#ffffff'], border: true },
  { name: 'Lutino', colors: ['#fef9c3', '#eab308'] },
];

const OTHER_COLORS = [
  { name: 'White', color: '#ffffff', border: true },
  { name: 'Black', color: '#1a1a1a' },
  { name: 'Brown', color: '#78350f' },
  { name: 'Gray', color: '#6b7280' },
  { name: 'Tan', color: '#d4a574' },
  { name: 'Orange', color: '#ea580c' },
  { name: 'Cream', color: '#fef3c7', border: true },
  { name: 'Golden', color: '#ca8a04' },
];

const OTHER_PATTERNS = [
  { name: 'Spotted', colors: ['#ffffff', '#1a1a1a'], border: true },
  { name: 'Mixed', colors: ['#78350f', '#ffffff', '#1a1a1a'] },
];

export default function ColorSelector({ value, onChange, petType = 'dog' }) {
  const [selectedColors, setSelectedColors] = useState([]);

  const getColorsForPetType = () => {
    const type = petType?.toLowerCase() || 'dog';
    switch (type) {
      case 'cat':
        return { solids: CAT_COLORS, patterns: CAT_PATTERNS };
      case 'bird':
        return { solids: BIRD_COLORS, patterns: BIRD_PATTERNS };
      case 'other':
        return { solids: OTHER_COLORS, patterns: OTHER_PATTERNS };
      default:
        return { solids: DOG_COLORS, patterns: DOG_PATTERNS };
    }
  };

  const { solids, patterns } = getColorsForPetType();

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

  const SolidSwatch = ({ item }) => {
    const isSelected = selectedColors.includes(item.name);
    return (
      <button
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
  };

  const PatternSwatch = ({ item }) => {
    const isSelected = selectedColors.includes(item.name);
    return (
      <button
        type="button"
        onClick={() => toggleColor(item.name)}
        className={`flex items-center gap-3 p-2 rounded-xl transition-all w-full ${
          isSelected
            ? 'bg-green-50 ring-2 ring-green-500'
            : 'bg-white hover:bg-gray-50 border border-gray-100'
        }`}
      >
        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex overflow-hidden ${item.border ? 'ring-1 ring-gray-300' : ''}`}>
          {item.colors.map((c, i) => (
            <div
              key={i}
              style={{ backgroundColor: c, width: `${100 / item.colors.length}%` }}
              className="h-full"
            />
          ))}
        </div>
        <span className={`text-sm font-medium ${isSelected ? 'text-green-700' : 'text-gray-700'}`}>
          {item.name}
        </span>
        {isSelected && (
          <Check size={16} className="text-green-600 ml-auto" strokeWidth={3} />
        )}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Selected preview */}
      {selectedColors.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-green-50 rounded-xl border border-green-200">
          <span className="text-sm text-green-700 font-medium">Selected:</span>
          {selectedColors.map(color => (
            <span key={color} className="text-sm text-green-800">{color}</span>
          ))}
        </div>
      )}

      {/* Colors - 2 column grid */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Colors</p>
        <div className="grid grid-cols-2 gap-2">
          {solids.map(item => (
            <SolidSwatch key={item.name} item={item} />
          ))}
        </div>
      </div>

      {/* Patterns - 2 column grid */}
      {patterns.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Patterns</p>
          <div className="grid grid-cols-2 gap-2">
            {patterns.map(item => (
              <PatternSwatch key={item.name} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
