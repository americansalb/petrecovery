'use client';

import { useState, useEffect } from 'react';
import { Check, Plus } from 'lucide-react';

// Simple, recognizable colors - no abstract names
const COLORS = [
  { name: 'Black', color: '#1a1a1a' },
  { name: 'Dark Gray', color: '#4a4a4a' },
  { name: 'Gray', color: '#808080' },
  { name: 'Light Gray', color: '#c0c0c0', border: true },
  { name: 'White', color: '#ffffff', border: true },
  { name: 'Dark Brown', color: '#3d2314' },
  { name: 'Brown', color: '#8b4513' },
  { name: 'Light Brown', color: '#a67b5b' },
  { name: 'Tan', color: '#d2b48c' },
  { name: 'Beige', color: '#e8dcc8', border: true },
  { name: 'Cream', color: '#fffdd0', border: true },
  { name: 'Golden', color: '#daa520' },
  { name: 'Orange', color: '#ff8c00' },
  { name: 'Red', color: '#b22222' },
  { name: 'Ginger', color: '#b06500' },
];

export default function ColorSelector({ value, onChange }) {
  const [selectedColors, setSelectedColors] = useState([]);
  const [showOther, setShowOther] = useState(false);
  const [customInput, setCustomInput] = useState('');

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
    const trimmed = customInput.trim();
    if (trimmed && !selectedColors.includes(trimmed)) {
      setSelectedColors(prev => [...prev, trimmed]);
    }
    setCustomInput('');
    setShowOther(false);
  };

  return (
    <div className="space-y-3">
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

      {/* Color grid - full size, no scroll */}
      <div className="grid grid-cols-2 gap-2">
        {COLORS.map(item => {
          const isSelected = selectedColors.includes(item.name);
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => toggleColor(item.name)}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                isSelected
                  ? 'bg-green-50 ring-2 ring-green-500'
                  : 'bg-white border border-gray-100 hover:bg-gray-50'
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

        {/* Other button */}
        <button
          type="button"
          onClick={() => setShowOther(true)}
          className="flex items-center gap-3 p-3 rounded-xl bg-white border border-dashed border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-all"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-300 via-purple-300 to-blue-300 flex items-center justify-center">
            <Plus size={16} className="text-white" />
          </div>
          <span className="text-sm font-medium text-gray-500">Other...</span>
        </button>
      </div>

      {/* Custom color input */}
      {showOther && (
        <div className="flex gap-2 p-3 bg-gray-50 rounded-xl">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customInput.trim()) {
                e.preventDefault();
                addCustomColor();
              }
            }}
            placeholder="Type a color..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none bg-white"
            autoFocus
          />
          <button
            type="button"
            onClick={addCustomColor}
            disabled={!customInput.trim()}
            className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setShowOther(false)}
            className="px-3 py-2 text-gray-500 text-sm hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
