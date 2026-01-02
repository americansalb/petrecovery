'use client';

/**
 * ProbabilityZoneSlider - Simple inline control for adjusting search zone size
 *
 * Features:
 * - Horizontal slider to expand/contract zones
 * - Info button showing factors that contributed to original calculation
 * - Reset button to return to original zones
 */

import { useState, useRef, useEffect } from 'react';
import { Info, RotateCcw, X } from 'lucide-react';

// Labels for the contributing factors
const SIZE_LABELS = {
  TINY: 'Tiny dog (under 10 lbs)',
  SMALL: 'Small dog (10-25 lbs)',
  MEDIUM: 'Medium dog (25-60 lbs)',
  LARGE: 'Large dog (60-90 lbs)',
  GIANT: 'Giant dog (over 90 lbs)',
};

const TIME_LABELS = {
  less_than_hour: 'Missing less than 1 hour',
  '1_to_6_hours': 'Missing 1-6 hours',
  '6_to_24_hours': 'Missing 6-24 hours',
  '1_to_3_days': 'Missing 1-3 days',
  '3_to_7_days': 'Missing 3-7 days',
  '1_to_2_weeks': 'Missing 1-2 weeks',
  more_than_2_weeks: 'Missing over 2 weeks',
};

const AGE_LABELS = {
  puppy: 'Puppy/Kitten',
  young: 'Young pet',
  adult: 'Adult pet',
  senior: 'Senior pet',
};

export default function ProbabilityZoneSlider({
  originalSettings = {},
  currentMultiplier = 1,
  onMultiplierChange,
  onReset,
  petSpecies = 'DOG',
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [localMultiplier, setLocalMultiplier] = useState(currentMultiplier);
  const sliderRef = useRef(null);

  const isDog = petSpecies?.toUpperCase() === 'DOG';
  const isCat = petSpecies?.toUpperCase() === 'CAT';

  // Sync local state with prop
  useEffect(() => {
    setLocalMultiplier(currentMultiplier);
  }, [currentMultiplier]);

  // Handle slider change
  const handleSliderChange = (e) => {
    const value = parseFloat(e.target.value);
    setLocalMultiplier(value);
    onMultiplierChange?.(value);
  };

  // Handle reset
  const handleReset = () => {
    setLocalMultiplier(1);
    onReset?.();
  };

  // Build contributing factors list
  const getContributingFactors = () => {
    const factors = [];

    if (isDog && originalSettings.size) {
      factors.push(SIZE_LABELS[originalSettings.size] || `Dog size: ${originalSettings.size}`);
    }

    if (isCat) {
      factors.push(originalSettings.isIndoorCat ? 'Indoor-only cat' : 'Outdoor-access cat');
    }

    if (originalSettings.timeElapsed) {
      factors.push(TIME_LABELS[originalSettings.timeElapsed] || originalSettings.timeElapsed);
    }

    if (originalSettings.age) {
      factors.push(AGE_LABELS[originalSettings.age] || originalSettings.age);
    }

    return factors.length > 0 ? factors : ['Default settings'];
  };

  const isModified = Math.abs(localMultiplier - 1) > 0.01;
  const percentChange = Math.round((localMultiplier - 1) * 100);
  const percentLabel = percentChange > 0 ? `+${percentChange}%` : `${percentChange}%`;

  return (
    <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
        <span className="text-sm font-medium text-white">Adjust Search Zone</span>
        <div className="flex items-center gap-2">
          {/* Reset button - only show when modified */}
          {isModified && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-2 py-1 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition"
              title="Reset to original"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
          {/* Info button */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
              showInfo
                ? 'bg-blue-500 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="What factors affect the zone?"
          >
            {showInfo ? <X size={14} /> : <Info size={14} />}
          </button>
        </div>
      </div>

      {/* Info Panel - Contributing Factors */}
      {showInfo && (
        <div className="px-4 py-3 bg-blue-500/10 border-b border-blue-500/20">
          <p className="text-xs text-blue-300 font-medium mb-2">Original zone based on:</p>
          <ul className="space-y-1">
            {getContributingFactors().map((factor, i) => (
              <li key={i} className="text-xs text-blue-200 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Slider */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          {/* Smaller label */}
          <span className="text-xs text-slate-500 w-12 text-right">Smaller</span>

          {/* Slider track */}
          <div className="flex-1 relative">
            <input
              ref={sliderRef}
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={localMultiplier}
              onChange={handleSliderChange}
              className="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-5
                [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-gradient-to-br
                [&::-webkit-slider-thumb]:from-amber-400
                [&::-webkit-slider-thumb]:to-amber-600
                [&::-webkit-slider-thumb]:shadow-lg
                [&::-webkit-slider-thumb]:shadow-amber-500/30
                [&::-webkit-slider-thumb]:cursor-grab
                [&::-webkit-slider-thumb]:active:cursor-grabbing
                [&::-webkit-slider-thumb]:border-2
                [&::-webkit-slider-thumb]:border-white/20
                [&::-moz-range-thumb]:w-5
                [&::-moz-range-thumb]:h-5
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-gradient-to-br
                [&::-moz-range-thumb]:from-amber-400
                [&::-moz-range-thumb]:to-amber-600
                [&::-moz-range-thumb]:shadow-lg
                [&::-moz-range-thumb]:cursor-grab
                [&::-moz-range-thumb]:border-2
                [&::-moz-range-thumb]:border-white/20"
            />

            {/* Center marker (original position) */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-4 bg-slate-500 pointer-events-none"
              title="Original zone size"
            />
          </div>

          {/* Larger label */}
          <span className="text-xs text-slate-500 w-12">Larger</span>
        </div>

        {/* Current value indicator */}
        <div className="mt-3 flex items-center justify-center">
          {isModified ? (
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${
              percentChange > 0
                ? 'bg-green-500/20 text-green-400'
                : 'bg-orange-500/20 text-orange-400'
            }`}>
              Zone {percentLabel}
            </span>
          ) : (
            <span className="text-xs text-slate-500">Original zone size</span>
          )}
        </div>
      </div>
    </div>
  );
}
