'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

// Species-specific color palettes
const DOG_COLORS = [
  { name: 'Black', color: '#1a1a1a' },
  { name: 'White', color: '#ffffff', border: true },
  { name: 'Brown', color: '#78350f' },
  { name: 'Tan', color: '#d4a574' },
  { name: 'Golden', color: '#ca8a04' },
  { name: 'Cream', color: '#fef3c7', border: true },
  { name: 'Gray', color: '#6b7280' },
  { name: 'Red', color: '#b91c1c' },
  { name: 'Chocolate', color: '#5c3317' },
  { name: 'Fawn', color: '#d2b48c' },
  { name: 'Silver', color: '#c0c0c0', border: true },
  { name: 'Blue', color: '#64748b' },
];

const DOG_PATTERNS = [
  { name: 'Brindle', gradient: 'repeating-linear-gradient(45deg, #78350f, #78350f 3px, #1a1a1a 3px, #1a1a1a 6px)' },
  { name: 'Merle', gradient: 'radial-gradient(ellipse at 30% 30%, #6b7280 20%, transparent 20%), radial-gradient(ellipse at 70% 60%, #1a1a1a 15%, transparent 15%), #c0c0c0' },
  { name: 'Spotted', gradient: 'radial-gradient(circle at 25% 25%, #1a1a1a 12%, transparent 12%), radial-gradient(circle at 75% 75%, #1a1a1a 12%, transparent 12%), #ffffff', border: true },
  { name: 'Bi-Color', gradient: 'linear-gradient(to right, #1a1a1a 50%, #d4a574 50%)' },
  { name: 'Tri-Color', gradient: 'linear-gradient(to right, #1a1a1a 33%, #78350f 33% 66%, #ffffff 66%)', border: true },
  { name: 'Sable', gradient: 'linear-gradient(135deg, #d4a574 0%, #1a1a1a 100%)' },
];

const CAT_COLORS = [
  { name: 'Black', color: '#1a1a1a' },
  { name: 'White', color: '#ffffff', border: true },
  { name: 'Orange', color: '#ea580c' },
  { name: 'Gray', color: '#6b7280' },
  { name: 'Cream', color: '#fef3c7', border: true },
  { name: 'Brown', color: '#78350f' },
  { name: 'Blue', color: '#64748b' },
  { name: 'Silver', color: '#c0c0c0', border: true },
  { name: 'Chocolate', color: '#5c3317' },
  { name: 'Lilac', color: '#c4b7cb' },
  { name: 'Cinnamon', color: '#a0522d' },
  { name: 'Fawn', color: '#d2b48c' },
];

const CAT_PATTERNS = [
  { name: 'Tabby', gradient: 'repeating-linear-gradient(90deg, #d4a574, #d4a574 4px, #78350f 4px, #78350f 8px)' },
  { name: 'Calico', gradient: 'conic-gradient(from 0deg, #ea580c 0deg 120deg, #1a1a1a 120deg 240deg, #ffffff 240deg 360deg)' },
  { name: 'Tortoiseshell', gradient: 'radial-gradient(ellipse at 30% 70%, #ea580c 25%, transparent 25%), radial-gradient(ellipse at 70% 30%, #1a1a1a 35%, transparent 35%), #78350f' },
  { name: 'Tuxedo', gradient: 'linear-gradient(to bottom, #1a1a1a 60%, #ffffff 60%)', border: true },
  { name: 'Bi-Color', gradient: 'linear-gradient(to right, #1a1a1a 50%, #ffffff 50%)', border: true },
  { name: 'Pointed', gradient: 'radial-gradient(circle at center, #fef3c7 40%, #78350f 100%)' },
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
  { name: 'Multi-Color', gradient: 'linear-gradient(to right, #16a34a 25%, #eab308 25% 50%, #dc2626 50% 75%, #2563eb 75%)' },
  { name: 'Pied', gradient: 'radial-gradient(circle at 30% 30%, #ffffff 20%, transparent 20%), radial-gradient(circle at 70% 70%, #ffffff 20%, transparent 20%), #16a34a' },
  { name: 'Lutino', gradient: 'linear-gradient(135deg, #fef9c3 0%, #eab308 100%)' },
  { name: 'Pearl', gradient: 'radial-gradient(circle at 50% 50%, #e5e7eb 30%, #6b7280 100%)' },
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
  { name: 'Spotted', gradient: 'radial-gradient(circle at 25% 25%, #1a1a1a 15%, transparent 15%), radial-gradient(circle at 75% 75%, #1a1a1a 15%, transparent 15%), #ffffff', border: true },
  { name: 'Bi-Color', gradient: 'linear-gradient(to right, #78350f 50%, #ffffff 50%)', border: true },
  { name: 'Agouti', gradient: 'repeating-linear-gradient(45deg, #d4a574, #d4a574 2px, #78350f 2px, #78350f 4px)' },
];

export default function ColorSelector({ value, onChange, petType = 'dog' }) {
  const [selectedColors, setSelectedColors] = useState([]);

  // Get colors based on pet type
  const getColorsForPetType = () => {
    const type = petType?.toLowerCase() || 'dog';
    switch (type) {
      case 'cat':
        return { solids: CAT_COLORS, patterns: CAT_PATTERNS, label: 'Cat' };
      case 'bird':
        return { solids: BIRD_COLORS, patterns: BIRD_PATTERNS, label: 'Bird' };
      case 'other':
        return { solids: OTHER_COLORS, patterns: OTHER_PATTERNS, label: 'Pet' };
      default:
        return { solids: DOG_COLORS, patterns: DOG_PATTERNS, label: 'Dog' };
    }
  };

  const { solids, patterns, label } = getColorsForPetType();

  // Initialize from value
  useEffect(() => {
    if (value) {
      const colors = value.split(',').map(c => c.trim()).filter(c => c);
      setSelectedColors(colors);
    }
  }, []);

  // Update parent when selectedColors changes
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

  const ColorSwatch = ({ item }) => {
    const isSelected = selectedColors.includes(item.name);

    return (
      <button
        type="button"
        onClick={() => toggleColor(item.name)}
        className={`flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all ${
          isSelected
            ? 'bg-green-50 ring-2 ring-green-500 scale-105'
            : 'hover:bg-gray-50 hover:scale-105'
        }`}
      >
        <div
          className={`w-11 h-11 rounded-full relative flex items-center justify-center shadow-sm ${
            item.border ? 'ring-1 ring-gray-300' : ''
          }`}
          style={{
            background: item.gradient || item.color,
          }}
        >
          {isSelected && (
            <div className="absolute inset-0 rounded-full bg-green-500/40 flex items-center justify-center">
              <Check size={18} className="text-white drop-shadow-md" strokeWidth={3} />
            </div>
          )}
        </div>
        <span className={`text-[10px] font-medium leading-tight text-center ${isSelected ? 'text-green-700' : 'text-gray-600'}`}>
          {item.name}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Selected Colors Preview */}
      {selectedColors.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-green-50 rounded-xl">
          {selectedColors.map(color => (
            <span
              key={color}
              className="px-3 py-1 bg-white rounded-full text-sm font-medium text-green-700 border border-green-200 flex items-center gap-1.5"
            >
              {color}
              <button
                onClick={() => toggleColor(color)}
                className="text-green-400 hover:text-green-600 text-lg leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Solid Colors */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {label} Colors
        </p>
        <div className="grid grid-cols-6 gap-0.5">
          {solids.map(color => (
            <ColorSwatch key={color.name} item={color} />
          ))}
        </div>
      </div>

      {/* Patterns */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          {label} Patterns
        </p>
        <div className="grid grid-cols-4 gap-1">
          {patterns.map(pattern => (
            <ColorSwatch key={pattern.name} item={pattern} />
          ))}
        </div>
      </div>

      {/* Help text */}
      <p className="text-xs text-gray-400 text-center">
        Tap to select • Choose multiple if needed
      </p>
    </div>
  );
}
