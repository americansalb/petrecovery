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
  { name: 'Cream', color: '#fef3c7', border: true },
  { name: 'Gray', color: '#6b7280' },
  { name: 'Red', color: '#b91c1c' },
  { name: 'Fawn', color: '#d2b48c' },
  { name: 'Chocolate', color: '#5c3317' },
  { name: 'Liver', color: '#6b3e26' },
  { name: 'Blue', color: '#64748b' },
];

const DOG_PATTERNS = [
  { name: 'Brindle', colors: ['#78350f', '#1a1a1a'] },
  { name: 'Spotted', colors: ['#ffffff', '#1a1a1a'], border: true },
  { name: 'Merle', colors: ['#c0c0c0', '#1a1a1a'] },
  { name: 'Bi-color', colors: ['#1a1a1a', '#d4a574'] },
  { name: 'Tri-color', colors: ['#1a1a1a', '#78350f', '#ffffff'], border: true },
  { name: 'Sable', colors: ['#d4a574', '#1a1a1a'] },
  { name: 'Ticked', colors: ['#ffffff', '#78350f'], border: true },
  { name: 'Parti', colors: ['#ffffff', '#ca8a04'], border: true },
];

const CAT_COLORS = [
  { name: 'Black', color: '#1a1a1a' },
  { name: 'White', color: '#ffffff', border: true },
  { name: 'Orange', color: '#ea580c' },
  { name: 'Gray', color: '#6b7280' },
  { name: 'Blue', color: '#64748b' },
  { name: 'Cream', color: '#fef3c7', border: true },
  { name: 'Brown', color: '#78350f' },
  { name: 'Chocolate', color: '#5c3317' },
  { name: 'Cinnamon', color: '#a0522d' },
  { name: 'Fawn', color: '#d2b48c' },
  { name: 'Lilac', color: '#c4b7cb' },
  { name: 'Red', color: '#c2410c' },
];

const CAT_PATTERNS = [
  { name: 'Tabby', colors: ['#d4a574', '#78350f'] },
  { name: 'Calico', colors: ['#ea580c', '#1a1a1a', '#ffffff'], border: true },
  { name: 'Tortoiseshell', colors: ['#ea580c', '#1a1a1a'] },
  { name: 'Tuxedo', colors: ['#1a1a1a', '#ffffff'], border: true },
  { name: 'Bi-color', colors: ['#ffffff', '#6b7280'], border: true },
  { name: 'Pointed', colors: ['#fef3c7', '#5c3317'] },
  { name: 'Smoke', colors: ['#1a1a1a', '#c0c0c0'] },
  { name: 'Van', colors: ['#ffffff', '#ea580c'], border: true },
];

const BIRD_COLORS = [
  { name: 'Green', color: '#16a34a' },
  { name: 'Blue', color: '#2563eb' },
  { name: 'Yellow', color: '#eab308' },
  { name: 'Red', color: '#dc2626' },
  { name: 'Orange', color: '#ea580c' },
  { name: 'White', color: '#ffffff', border: true },
  { name: 'Gray', color: '#6b7280' },
  { name: 'Black', color: '#1a1a1a' },
  { name: 'Purple', color: '#7c3aed' },
  { name: 'Pink', color: '#ec4899' },
  { name: 'Turquoise', color: '#06b6d4' },
  { name: 'Brown', color: '#78350f' },
];

const BIRD_PATTERNS = [
  { name: 'Solid', colors: ['#16a34a'] },
  { name: 'Pied', colors: ['#16a34a', '#ffffff'], border: true },
  { name: 'Lutino', colors: ['#fef9c3', '#eab308'] },
  { name: 'Albino', colors: ['#ffffff'], border: true },
  { name: 'Pearl', colors: ['#e5e7eb', '#6b7280'] },
  { name: 'Cinnamon', colors: ['#d4a574', '#a0522d'] },
  { name: 'Opaline', colors: ['#2563eb', '#eab308'] },
  { name: 'Spangle', colors: ['#eab308', '#1a1a1a'] },
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
  { name: 'Red', color: '#b91c1c' },
  { name: 'Blue', color: '#2563eb' },
  { name: 'Green', color: '#16a34a' },
  { name: 'Yellow', color: '#eab308' },
];

const OTHER_PATTERNS = [
  { name: 'Solid', colors: ['#78350f'] },
  { name: 'Spotted', colors: ['#ffffff', '#1a1a1a'], border: true },
  { name: 'Striped', colors: ['#d4a574', '#78350f'] },
  { name: 'Bi-color', colors: ['#1a1a1a', '#ffffff'], border: true },
  { name: 'Agouti', colors: ['#d4a574', '#78350f', '#1a1a1a'] },
  { name: 'Marked', colors: ['#ffffff', '#1a1a1a', '#78350f'], border: true },
];

export default function ColorSelector({ value, onChange, petType = 'dog' }) {
  const [selectedColors, setSelectedColors] = useState([]);
  const [customColor, setCustomColor] = useState('');

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

  const addCustomColor = () => {
    const trimmed = customColor.trim();
    if (trimmed && !selectedColors.includes(trimmed)) {
      setSelectedColors(prev => [...prev, trimmed]);
      setCustomColor('');
    }
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

      {/* Custom color input */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Other</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomColor()}
            placeholder="Type a color (e.g. Light grey with spots)"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none"
          />
          <button
            type="button"
            onClick={addCustomColor}
            disabled={!customColor.trim()}
            className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-xl hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
