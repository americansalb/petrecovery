'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

// Color definitions with visual representation
const SOLID_COLORS = [
  { name: 'Black', color: '#1a1a1a' },
  { name: 'White', color: '#ffffff', border: true },
  { name: 'Gray', color: '#6b7280' },
  { name: 'Brown', color: '#78350f' },
  { name: 'Tan', color: '#d4a574' },
  { name: 'Cream', color: '#fef3c7', border: true },
  { name: 'Orange', color: '#ea580c' },
  { name: 'Gold', color: '#ca8a04' },
  { name: 'Red', color: '#b91c1c' },
  { name: 'Chocolate', color: '#5c3317' },
  { name: 'Silver', color: '#c0c0c0', border: true },
  { name: 'Blue', color: '#64748b' },
];

const PATTERN_COLORS = [
  { name: 'Brindle', gradient: 'repeating-linear-gradient(45deg, #78350f, #78350f 3px, #1a1a1a 3px, #1a1a1a 6px)' },
  { name: 'Spotted', gradient: 'radial-gradient(circle at 25% 25%, #1a1a1a 15%, transparent 15%), radial-gradient(circle at 75% 75%, #1a1a1a 15%, transparent 15%), #ffffff', border: true },
  { name: 'Tabby', gradient: 'repeating-linear-gradient(90deg, #d4a574, #d4a574 4px, #78350f 4px, #78350f 8px)' },
  { name: 'Calico', gradient: 'conic-gradient(from 0deg, #ea580c 0deg 120deg, #1a1a1a 120deg 240deg, #ffffff 240deg 360deg)' },
  { name: 'Tuxedo', gradient: 'linear-gradient(to bottom, #1a1a1a 60%, #ffffff 60%)' },
  { name: 'Bi-Color', gradient: 'linear-gradient(to right, #78350f 50%, #ffffff 50%)', border: true },
  { name: 'Tri-Color', gradient: 'linear-gradient(to right, #1a1a1a 33%, #78350f 33% 66%, #ffffff 66%)', border: true },
  { name: 'Merle', gradient: 'radial-gradient(ellipse at 30% 30%, #6b7280 20%, transparent 20%), radial-gradient(ellipse at 70% 60%, #1a1a1a 15%, transparent 15%), radial-gradient(ellipse at 50% 80%, #6b7280 10%, transparent 10%), #c0c0c0' },
];

export default function ColorSelector({ value, onChange }) {
  const [selectedColors, setSelectedColors] = useState([]);

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

  const ColorSwatch = ({ item, isPattern = false }) => {
    const isSelected = selectedColors.includes(item.name);

    return (
      <button
        type="button"
        onClick={() => toggleColor(item.name)}
        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${
          isSelected
            ? 'bg-green-50 ring-2 ring-green-500'
            : 'hover:bg-gray-50'
        }`}
      >
        <div
          className={`w-12 h-12 rounded-full relative flex items-center justify-center shadow-sm ${
            item.border ? 'ring-1 ring-gray-200' : ''
          }`}
          style={{
            background: item.gradient || item.color,
          }}
        >
          {isSelected && (
            <div className="absolute inset-0 rounded-full bg-green-500/30 flex items-center justify-center">
              <Check size={20} className="text-green-700" strokeWidth={3} />
            </div>
          )}
        </div>
        <span className={`text-xs font-medium ${isSelected ? 'text-green-700' : 'text-gray-600'}`}>
          {item.name}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Selected Colors Preview */}
      {selectedColors.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-green-50 rounded-xl">
          {selectedColors.map(color => (
            <span
              key={color}
              className="px-3 py-1.5 bg-white rounded-full text-sm font-medium text-green-700 border border-green-200 flex items-center gap-2"
            >
              {color}
              <button
                onClick={() => toggleColor(color)}
                className="text-green-500 hover:text-green-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Solid Colors */}
      <div>
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Solid Colors</p>
        <div className="grid grid-cols-6 gap-1">
          {SOLID_COLORS.map(color => (
            <ColorSwatch key={color.name} item={color} />
          ))}
        </div>
      </div>

      {/* Patterns */}
      <div>
        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Patterns</p>
        <div className="grid grid-cols-4 gap-1">
          {PATTERN_COLORS.map(pattern => (
            <ColorSwatch key={pattern.name} item={pattern} isPattern />
          ))}
        </div>
      </div>

      {/* Help text */}
      <p className="text-sm text-gray-500 text-center">
        Tap to select • You can choose multiple
      </p>
    </div>
  );
}
