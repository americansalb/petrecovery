'use client';

/**
 * ProbabilityZoneSlider - Collapsible control for adjusting search zone size
 *
 * Features:
 * - Collapsed: Small button showing current adjustment
 * - Expanded: Slider + info + reset
 */

import { useState, useRef, useEffect } from 'react';
import { Info, RotateCcw, X, ChevronDown, Sliders } from 'lucide-react';

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
  const [isExpanded, setIsExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [localMultiplier, setLocalMultiplier] = useState(currentMultiplier);

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

  // Collapsed state - just a small button
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg backdrop-blur-md border transition ${
          isModified
            ? 'bg-amber-500/90 border-amber-400/50 text-white'
            : 'bg-slate-900/80 border-white/10 text-slate-200 hover:bg-slate-800'
        }`}
      >
        <Sliders size={16} />
        <span className="text-sm font-medium">
          {isModified ? `Zone ${percentLabel}` : 'Adjust Zone'}
        </span>
      </button>
    );
  }

  // Expanded state - full slider
  return (
    <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl overflow-hidden w-72">
      {/* Header */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-white/5">
        <span className="text-xs font-medium text-white">Adjust Zone</span>
        <div className="flex items-center gap-1">
          {isModified && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-2 py-1 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded transition"
              title="Reset to original"
            >
              <RotateCcw size={10} />
              Reset
            </button>
          )}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`w-6 h-6 rounded flex items-center justify-center transition ${
              showInfo ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="What factors affect the zone?"
          >
            {showInfo ? <X size={12} /> : <Info size={12} />}
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="px-3 py-2 bg-blue-500/10 border-b border-blue-500/20">
          <p className="text-[10px] text-blue-300 font-medium mb-1">Based on:</p>
          <ul className="space-y-0.5">
            {getContributingFactors().map((factor, i) => (
              <li key={i} className="text-[10px] text-blue-200 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-blue-400" />
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Slider */}
      <div className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 w-10 text-right">Smaller</span>
          <div className="flex-1 relative">
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={localMultiplier}
              onChange={handleSliderChange}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-amber-500
                [&::-webkit-slider-thumb]:shadow-md
                [&::-webkit-slider-thumb]:cursor-grab
                [&::-webkit-slider-thumb]:active:cursor-grabbing
                [&::-moz-range-thumb]:w-4
                [&::-moz-range-thumb]:h-4
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-amber-500
                [&::-moz-range-thumb]:border-0
                [&::-moz-range-thumb]:cursor-grab"
            />
            {/* Center marker */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-2.5 bg-slate-500 pointer-events-none" />
          </div>
          <span className="text-[10px] text-slate-500 w-10">Larger</span>
        </div>

        {/* Current value */}
        <div className="mt-2 flex justify-center">
          {isModified ? (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              percentChange > 0 ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
            }`}>
              {percentLabel}
            </span>
          ) : (
            <span className="text-[10px] text-slate-500">Original size</span>
          )}
        </div>
      </div>
    </div>
  );
}
