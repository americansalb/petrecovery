'use client';

/**
 * ProbabilityZoneAdjuster - Modal for pet owners to adjust search probability zones
 *
 * Allows adjusting:
 * - Pet size (dogs): TINY, SMALL, MEDIUM, LARGE, GIANT
 * - Indoor/Outdoor status (cats)
 * - Time elapsed since missing
 * - Pet age
 */

import { useState, useEffect } from 'react';
import {
  X, Settings, Dog, Cat, Clock, Calendar,
  HelpCircle, ChevronDown, ChevronUp, Check
} from 'lucide-react';

// Size options for dogs
const DOG_SIZE_OPTIONS = [
  { value: 'TINY', label: 'Tiny', sublabel: 'Under 10 lbs', radius: '~500 ft' },
  { value: 'SMALL', label: 'Small', sublabel: '10-25 lbs', radius: '~0.5 mi' },
  { value: 'MEDIUM', label: 'Medium', sublabel: '25-60 lbs', radius: '~1 mi' },
  { value: 'LARGE', label: 'Large', sublabel: '60-90 lbs', radius: '~1.5 mi' },
  { value: 'GIANT', label: 'Giant', sublabel: 'Over 90 lbs', radius: '~2.5 mi' },
];

// Living options for cats
const CAT_LIVING_OPTIONS = [
  { value: true, label: 'Indoor Only', sublabel: 'Never goes outside', radius: '~250 ft' },
  { value: false, label: 'Goes Outside', sublabel: 'Has outdoor access', radius: '~0.4 mi' },
];

// Time elapsed options
const TIME_OPTIONS = [
  { value: 'less_than_hour', label: 'Less than 1 hour', multiplier: '1x' },
  { value: '1_to_6_hours', label: '1-6 hours', multiplier: '1.3x' },
  { value: '6_to_24_hours', label: '6-24 hours', multiplier: '1.8x' },
  { value: '1_to_3_days', label: '1-3 days', multiplier: '2.5x' },
  { value: '3_to_7_days', label: '3-7 days', multiplier: '3.5x' },
  { value: '1_to_2_weeks', label: '1-2 weeks', multiplier: '4.5x' },
  { value: 'more_than_2_weeks', label: 'Over 2 weeks', multiplier: '6x' },
];

// Age options
const AGE_OPTIONS = [
  { value: 'puppy', label: 'Puppy/Kitten', effect: '-40% range' },
  { value: 'young', label: 'Young', effect: '-10% range' },
  { value: 'adult', label: 'Adult', effect: 'Normal range' },
  { value: 'senior', label: 'Senior', effect: '-30% range' },
];

export default function ProbabilityZoneAdjuster({
  isOpen,
  onClose,
  petSpecies = 'DOG',
  currentSettings = {},
  onSettingsChange,
}) {
  const [size, setSize] = useState(currentSettings.size || 'MEDIUM');
  const [isIndoorCat, setIsIndoorCat] = useState(currentSettings.isIndoorCat ?? null);
  const [timeElapsed, setTimeElapsed] = useState(currentSettings.timeElapsed || '6_to_24_hours');
  const [age, setAge] = useState(currentSettings.age || 'adult');
  const [showHelp, setShowHelp] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const isDog = petSpecies?.toUpperCase() === 'DOG';
  const isCat = petSpecies?.toUpperCase() === 'CAT';

  // Track changes
  useEffect(() => {
    const changed =
      (isDog && size !== currentSettings.size) ||
      (isCat && isIndoorCat !== currentSettings.isIndoorCat) ||
      timeElapsed !== currentSettings.timeElapsed ||
      age !== currentSettings.age;
    setHasChanges(changed);
  }, [size, isIndoorCat, timeElapsed, age, currentSettings, isDog, isCat]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSize(currentSettings.size || 'MEDIUM');
      setIsIndoorCat(currentSettings.isIndoorCat ?? null);
      setTimeElapsed(currentSettings.timeElapsed || '6_to_24_hours');
      setAge(currentSettings.age || 'adult');
      setHasChanges(false);
    }
  }, [isOpen, currentSettings]);

  const handleApply = () => {
    onSettingsChange({
      size: isDog ? size : undefined,
      isIndoorCat: isCat ? isIndoorCat : undefined,
      timeElapsed,
      age,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-w-md mx-auto bg-slate-900 rounded-2xl shadow-2xl z-[1001] max-h-[85vh] flex flex-col overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <Settings size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Adjust Search Zones</h2>
              <p className="text-xs text-slate-400">Customize probability calculations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Help Toggle */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 rounded-xl text-sm text-slate-300 hover:bg-slate-800 transition"
          >
            <span className="flex items-center gap-2">
              <HelpCircle size={16} className="text-blue-400" />
              How does this work?
            </span>
            {showHelp ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showHelp && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-sm text-blue-100 space-y-2">
              <p><strong>Search zones</strong> are calculated based on research about how lost pets typically travel.</p>
              <p>The <span className="text-green-400">green zone</span> (HIGH) is where your pet is most likely to be found (~67.5% probability).</p>
              <p>Adjusting these settings helps create more accurate zones based on your pet's specific characteristics.</p>
            </div>
          )}

          {/* Dog Size Selector */}
          {isDog && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Dog size={16} className="text-amber-400" />
                Dog Size
              </label>
              <div className="grid grid-cols-1 gap-2">
                {DOG_SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSize(opt.value)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition ${
                      size === opt.value
                        ? 'border-amber-500 bg-amber-500/10 text-white'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {size === opt.value && (
                        <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                      <div className={size !== opt.value ? 'ml-8' : ''}>
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-xs text-slate-500 ml-2">{opt.sublabel}</span>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">{opt.radius}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cat Indoor/Outdoor Selector */}
          {isCat && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
                <Cat size={16} className="text-purple-400" />
                Cat Lifestyle
              </label>
              <div className="grid grid-cols-1 gap-2">
                {CAT_LIVING_OPTIONS.map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setIsIndoorCat(opt.value)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition ${
                      isIndoorCat === opt.value
                        ? 'border-purple-500 bg-purple-500/10 text-white'
                        : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isIndoorCat === opt.value && (
                        <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </div>
                      )}
                      <div className={isIndoorCat !== opt.value ? 'ml-8' : ''}>
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-xs text-slate-500 ml-2">{opt.sublabel}</span>
                      </div>
                    </div>
                    <span className="text-xs text-slate-500">{opt.radius}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Time Elapsed Selector */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Clock size={16} className="text-orange-400" />
              Time Since Missing
            </label>
            <div className="grid grid-cols-1 gap-2">
              {TIME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTimeElapsed(opt.value)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border transition ${
                    timeElapsed === opt.value
                      ? 'border-orange-500 bg-orange-500/10 text-white'
                      : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {timeElapsed === opt.value && (
                      <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                    <span className={`font-medium ${timeElapsed !== opt.value ? 'ml-8' : ''}`}>
                      {opt.label}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">radius {opt.multiplier}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Age Selector */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-300">
              <Calendar size={16} className="text-cyan-400" />
              Pet Age
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAge(opt.value)}
                  className={`flex flex-col items-center px-4 py-3 rounded-xl border transition ${
                    age === opt.value
                      ? 'border-cyan-500 bg-cyan-500/10 text-white'
                      : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span className="font-medium text-sm">{opt.label}</span>
                  <span className="text-xs text-slate-500 mt-0.5">{opt.effect}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700/50 bg-slate-800/30">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-600 text-slate-300 font-medium hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!hasChanges}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold transition ${
                hasChanges
                  ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-green-500/20 hover:shadow-xl'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
