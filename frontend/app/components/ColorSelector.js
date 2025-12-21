'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';

// Pet colors - users select multiple
const COLORS = [
  { name: 'Black', color: '#1a1a1a' },
  { name: 'White', color: '#ffffff', border: true },
  { name: 'Brown', color: '#78350f' },
  { name: 'Tan', color: '#d4a574' },
  { name: 'Golden', color: '#ca8a04' },
  { name: 'Cream', color: '#fef3c7', border: true },
  { name: 'Gray', color: '#6b7280' },
  { name: 'Orange', color: '#ea580c' },
  { name: 'Chocolate', color: '#5c3317' },
  { name: 'Silver', color: '#c0c0c0', border: true },
];

export default function ColorSelector({ value, onChange }) {
  const [selectedColors, setSelectedColors] = useState([]);
  const [customColor, setCustomColor] = useState('');

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

      {/* Custom input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customColor}
          onChange={(e) => setCustomColor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCustomColor()}
          placeholder="Other (e.g. Spotted, Striped)"
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
  );
}
