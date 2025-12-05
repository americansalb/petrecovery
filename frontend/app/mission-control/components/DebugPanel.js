'use client';

/**
 * Debug Panel for Mission Control
 *
 * Allows admins to override algorithm variables and see priority breakdowns.
 * Only visible to admins when debug mode is enabled.
 */

import { useState } from 'react';
import {
  Bug,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  User,
  Dog,
  Cat,
  Zap,
  RotateCcw,
  Eye,
  EyeOff,
  Home,
  Trees,
  Heart,
  Crosshair,
  History,
  AlertTriangle,
} from 'lucide-react';
import { useDebug, DEBUG_PRESETS } from '@/app/lib/missionControl/debugContext';
import { ACTION_TYPES } from '@/app/lib/missionControl/taskPriority';

export default function DebugPanel({ selectedTask, scoreBreakdown }) {
  const {
    isAdmin,
    isEnabled,
    setIsEnabled,
    isPanelOpen,
    setIsPanelOpen,
    overrides,
    updateOverride,
    applyPreset,
    resetToReal,
  } = useDebug();

  const [activeSection, setActiveSection] = useState('presets');

  if (!isAdmin) return null;

  // Floating toggle button when panel is closed
  if (!isPanelOpen) {
    return (
      <button
        onClick={() => setIsPanelOpen(true)}
        className={`fixed bottom-4 right-4 z-50 p-3 rounded-full shadow-lg transition-colors ${
          isEnabled
            ? 'bg-yellow-500 text-black'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
        }`}
        title="Open Debug Panel"
      >
        <Bug size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 w-96 max-h-[80vh] bg-gray-900 border-l border-t border-gray-700 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Bug size={20} className={isEnabled ? 'text-yellow-500' : 'text-gray-400'} />
          <span className="font-semibold text-white">Debug Panel</span>
          {isEnabled && (
            <span className="px-2 py-0.5 text-xs bg-yellow-500 text-black rounded-full">
              ACTIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEnabled(!isEnabled)}
            className={`p-1.5 rounded transition-colors ${
              isEnabled
                ? 'bg-yellow-500 text-black'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={isEnabled ? 'Disable overrides' : 'Enable overrides'}
          >
            {isEnabled ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button
            onClick={() => setIsPanelOpen(false)}
            className="p-1.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Quick Presets */}
        <Section
          title="Quick Presets"
          icon={<Zap size={16} />}
          isOpen={activeSection === 'presets'}
          onToggle={() => setActiveSection(activeSection === 'presets' ? '' : 'presets')}
        >
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(DEBUG_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => {
                  applyPreset(key);
                  setIsEnabled(true);
                }}
                className="p-2 text-left bg-gray-800 rounded hover:bg-gray-700 transition-colors"
              >
                <div className="text-sm font-medium text-white">{preset.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{preset.description}</div>
              </button>
            ))}
          </div>
          <button
            onClick={resetToReal}
            className="w-full mt-2 p-2 flex items-center justify-center gap-2 bg-gray-800 rounded hover:bg-gray-700 text-gray-300"
          >
            <RotateCcw size={14} />
            Reset to Real Values
          </button>
        </Section>

        {/* Time Override */}
        <Section
          title="Time"
          icon={<Clock size={16} />}
          isOpen={activeSection === 'time'}
          onToggle={() => setActiveSection(activeSection === 'time' ? '' : 'time')}
        >
          <ToggleRow
            label="Use real time"
            checked={overrides.useRealTime}
            onChange={(v) => updateOverride('useRealTime', v)}
          />
          {!overrides.useRealTime && (
            <div className="mt-2">
              <label className="text-xs text-gray-400">Simulated Hour (0-23)</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="range"
                  min="0"
                  max="23"
                  value={overrides.simulatedHour}
                  onChange={(e) => updateOverride('simulatedHour', parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-white w-16 text-right">
                  {formatHour(overrides.simulatedHour)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Dawn 5-7</span>
                <span>Dusk 17-20</span>
                <span>Night 20-5</span>
              </div>
            </div>
          )}
        </Section>

        {/* Hours Missing Override */}
        <Section
          title="Hours Missing"
          icon={<Clock size={16} />}
          isOpen={activeSection === 'hours'}
          onToggle={() => setActiveSection(activeSection === 'hours' ? '' : 'hours')}
        >
          <ToggleRow
            label="Use real hours"
            checked={overrides.useRealHoursMissing}
            onChange={(v) => updateOverride('useRealHoursMissing', v)}
          />
          {!overrides.useRealHoursMissing && (
            <div className="mt-2">
              <label className="text-xs text-gray-400">Hours Missing</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="range"
                  min="0"
                  max="168"
                  value={overrides.hoursMissing}
                  onChange={(e) => updateOverride('hoursMissing', parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-white w-20 text-right">
                  {formatHoursMissing(overrides.hoursMissing)}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Phase: {getPhaseLabel(overrides.hoursMissing)}
              </div>
            </div>
          )}
        </Section>

        {/* Role Override */}
        <Section
          title="User Role"
          icon={<User size={16} />}
          isOpen={activeSection === 'role'}
          onToggle={() => setActiveSection(activeSection === 'role' ? '' : 'role')}
        >
          <ToggleRow
            label="Use real role"
            checked={overrides.useRealRole}
            onChange={(v) => updateOverride('useRealRole', v)}
          />
          {!overrides.useRealRole && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => updateOverride('role', 'OWNER')}
                className={`flex-1 p-2 rounded text-sm font-medium transition-colors ${
                  overrides.role === 'OWNER'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Owner
              </button>
              <button
                onClick={() => updateOverride('role', 'SQUAD')}
                className={`flex-1 p-2 rounded text-sm font-medium transition-colors ${
                  overrides.role === 'SQUAD'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Squad
              </button>
            </div>
          )}
        </Section>

        {/* Pet Type Override */}
        <Section
          title="Pet Type"
          icon={overrides.petType === 'CAT' ? <Cat size={16} /> : <Dog size={16} />}
          isOpen={activeSection === 'pet'}
          onToggle={() => setActiveSection(activeSection === 'pet' ? '' : 'pet')}
        >
          <ToggleRow
            label="Use real pet type"
            checked={overrides.useRealPetType}
            onChange={(v) => updateOverride('useRealPetType', v)}
          />
          {!overrides.useRealPetType && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => updateOverride('petType', 'CAT')}
                className={`flex-1 p-2 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  overrides.petType === 'CAT'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Cat size={16} /> Cat
              </button>
              <button
                onClick={() => updateOverride('petType', 'DOG')}
                className={`flex-1 p-2 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  overrides.petType === 'DOG'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Dog size={16} /> Dog
              </button>
            </div>
          )}
        </Section>

        {/* Proximity Override */}
        <Section
          title="User Proximity"
          icon={<MapPin size={16} />}
          isOpen={activeSection === 'proximity'}
          onToggle={() => setActiveSection(activeSection === 'proximity' ? '' : 'proximity')}
        >
          <ToggleRow
            label="Use real location"
            checked={overrides.useRealLocation}
            onChange={(v) => updateOverride('useRealLocation', v)}
          />
          {!overrides.useRealLocation && (
            <div className="mt-2">
              <label className="text-xs text-gray-400">Distance from tasks (miles)</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="0.5"
                  value={overrides.proximityMiles}
                  onChange={(e) => updateOverride('proximityMiles', parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-white w-16 text-right">
                  {overrides.proximityMiles} mi
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Bonus: {getProximityBonus(overrides.proximityMiles)}
              </div>
            </div>
          )}
        </Section>

        {/* Pet Profile Override (Indoor/Outdoor, Size) */}
        <Section
          title="Pet Profile"
          icon={overrides.isIndoor ? <Home size={16} /> : <Trees size={16} />}
          isOpen={activeSection === 'profile'}
          onToggle={() => setActiveSection(activeSection === 'profile' ? '' : 'profile')}
        >
          <ToggleRow
            label="Use real profile"
            checked={overrides.useRealPetProfile}
            onChange={(v) => updateOverride('useRealPetProfile', v)}
          />
          {!overrides.useRealPetProfile && (
            <div className="mt-2 space-y-3">
              {/* Cat: Indoor/Outdoor */}
              {overrides.petType === 'CAT' && (
                <div>
                  <label className="text-xs text-gray-400">Cat Environment</label>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => updateOverride('isIndoor', true)}
                      className={`flex-1 p-2 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                        overrides.isIndoor
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <Home size={14} /> Indoor
                    </button>
                    <button
                      onClick={() => updateOverride('isIndoor', false)}
                      className={`flex-1 p-2 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                        !overrides.isIndoor
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <Trees size={14} /> Outdoor
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {overrides.isIndoor
                      ? 'Indoor cats hide close (0.25mi range)'
                      : 'Outdoor cats roam (1mi range)'}
                  </div>
                </div>
              )}
              {/* Dog: Size */}
              {overrides.petType === 'DOG' && (
                <div>
                  <label className="text-xs text-gray-400">Dog Size</label>
                  <div className="flex gap-2 mt-1">
                    {['SMALL', 'MEDIUM', 'LARGE'].map((size) => (
                      <button
                        key={size}
                        onClick={() => updateOverride('petSize', size)}
                        className={`flex-1 p-2 rounded text-sm font-medium transition-colors ${
                          overrides.petSize === size
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}
                      >
                        {size.charAt(0) + size.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {getDogSizeDesc(overrides.petSize)}
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Health Urgency Override */}
        <Section
          title="Health Urgency"
          icon={<Heart size={16} />}
          isOpen={activeSection === 'health'}
          onToggle={() => setActiveSection(activeSection === 'health' ? '' : 'health')}
        >
          <ToggleRow
            label="Use real health"
            checked={overrides.useRealHealth}
            onChange={(v) => updateOverride('useRealHealth', v)}
          />
          {!overrides.useRealHealth && (
            <div className="mt-2">
              <label className="text-xs text-gray-400">Health Condition</label>
              <select
                value={overrides.healthCondition}
                onChange={(e) => updateOverride('healthCondition', e.target.value)}
                className="w-full mt-1 p-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              >
                <option value="NONE">None (1.0x)</option>
                <option value="SENIOR">Senior pet (1.3x)</option>
                <option value="PUPPY_KITTEN">Puppy/Kitten (1.4x)</option>
                <option value="MEDICATION_DAILY">Daily medication (1.5x)</option>
                <option value="MEDICAL_CONDITION">Medical condition (1.8x)</option>
                <option value="MEDICATION_CRITICAL">Critical meds - insulin, etc (2.5x)</option>
              </select>
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                {overrides.healthCondition !== 'NONE' && (
                  <>
                    <AlertTriangle size={12} className="text-yellow-500" />
                    Multiplies all positive scores
                  </>
                )}
              </div>
            </div>
          )}
        </Section>

        {/* Sighting Override */}
        <Section
          title="Sighting"
          icon={<Crosshair size={16} />}
          isOpen={activeSection === 'sighting'}
          onToggle={() => setActiveSection(activeSection === 'sighting' ? '' : 'sighting')}
        >
          <ToggleRow
            label="Use real sightings"
            checked={overrides.useRealSightings}
            onChange={(v) => updateOverride('useRealSightings', v)}
          />
          {!overrides.useRealSightings && (
            <div className="mt-2 space-y-3">
              <div>
                <label className="text-xs text-gray-400">Hours since sighting</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="range"
                    min="0"
                    max="72"
                    step="0.5"
                    value={overrides.sightingHoursAgo}
                    onChange={(e) => updateOverride('sightingHoursAgo', parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-white w-12 text-right">
                    {overrides.sightingHoursAgo < 1 ? `${Math.round(overrides.sightingHoursAgo * 60)}m` : `${overrides.sightingHoursAgo}h`}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Time boost: {getSightingTimeBoost(overrides.sightingHoursAgo)}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400">Distance to sighting (miles)</label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.1"
                    value={overrides.sightingMilesAway}
                    onChange={(e) => updateOverride('sightingMilesAway', parseFloat(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-white w-12 text-right">
                    {overrides.sightingMilesAway} mi
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Distance boost: {getSightingDistanceBoost(overrides.sightingMilesAway)}
                </div>
              </div>
              <div className="p-2 bg-gray-800 rounded text-xs">
                <span className="text-yellow-400 font-medium">Total sighting boost: </span>
                <span className="text-white">
                  +{parseInt(getSightingTimeBoost(overrides.sightingHoursAgo)) + parseInt(getSightingDistanceBoost(overrides.sightingMilesAway))}
                </span>
              </div>
            </div>
          )}
        </Section>

        {/* Task History / Diminishing Returns Override */}
        <Section
          title="Task History"
          icon={<History size={16} />}
          isOpen={activeSection === 'history'}
          onToggle={() => setActiveSection(activeSection === 'history' ? '' : 'history')}
        >
          <ToggleRow
            label="Use real history"
            checked={overrides.useRealHistory}
            onChange={(v) => updateOverride('useRealHistory', v)}
          />
          {!overrides.useRealHistory && (
            <div className="mt-2">
              <label className="text-xs text-gray-400">Times this task was completed (48h)</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="1"
                  value={overrides.repeatTaskCount}
                  onChange={(e) => updateOverride('repeatTaskCount', parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-white w-12 text-right">
                  {overrides.repeatTaskCount}x
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Penalty: {getRepeatPenalty(overrides.repeatTaskCount)}
              </div>
            </div>
          )}
        </Section>

        {/* Score Breakdown */}
        {selectedTask && scoreBreakdown && (
          <Section
            title="Score Breakdown"
            icon={<Bug size={16} />}
            isOpen={true}
            onToggle={() => {}}
            defaultOpen
          >
            <div className="bg-gray-800 rounded p-3">
              <div className="text-sm font-medium text-white mb-2">
                {selectedTask.title}
              </div>
              <div className="space-y-1 text-xs font-mono">
                {scoreBreakdown.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-gray-400">{item.label}</span>
                    <span className={item.value >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {item.value >= 0 ? '+' : ''}{item.value}
                    </span>
                  </div>
                ))}
                <div className="border-t border-gray-700 pt-1 mt-1 flex justify-between font-bold">
                  <span className="text-white">TOTAL</span>
                  <span className="text-yellow-400">
                    {scoreBreakdown.reduce((sum, item) => sum + item.value, 0)}
                  </span>
                </div>
              </div>
            </div>
          </Section>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-500 text-center">
        {isEnabled ? 'Overrides are ACTIVE' : 'Overrides disabled - showing real values'}
      </div>
    </div>
  );
}

// Helper Components

function Section({ title, icon, isOpen, onToggle, children, defaultOpen }) {
  return (
    <div className="border border-gray-700 rounded overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-2 flex items-center justify-between bg-gray-800 hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-2 text-gray-300">
          {icon}
          <span className="text-sm font-medium">{title}</span>
        </div>
        {!defaultOpen && (isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />)}
      </button>
      {isOpen && <div className="p-3 bg-gray-850">{children}</div>}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-gray-300">{label}</span>
      <div
        className={`w-10 h-5 rounded-full transition-colors relative ${
          checked ? 'bg-blue-600' : 'bg-gray-600'
        }`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </div>
    </label>
  );
}

// Helper Functions

function formatHour(hour) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:00 ${period}`;
}

function formatHoursMissing(hours) {
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function getPhaseLabel(hours) {
  if (hours <= 2) return 'Phase 1 (Immediate)';
  if (hours <= 24) return 'Phase 2 (First Day)';
  if (hours <= 72) return 'Phase 3 (Expansion)';
  if (hours <= 168) return 'Phase 4 (Persistence)';
  return 'Phase 5 (Long-term)';
}

function getProximityBonus(miles) {
  if (miles < 0.5) return '+30';
  if (miles < 2) return '+20';
  if (miles < 5) return '+10';
  return '+0';
}

function getDogSizeDesc(size) {
  switch (size) {
    case 'SMALL':
      return 'Small dogs stay close (1mi), vulnerable, high priority';
    case 'MEDIUM':
      return 'Medium dogs roam (3mi), moderate danger';
    case 'LARGE':
      return 'Large dogs run far (5mi), can handle themselves';
    default:
      return '';
  }
}

function getSightingTimeBoost(hoursAgo) {
  if (hoursAgo <= 1) return '+150';
  if (hoursAgo <= 6) return '+100';
  if (hoursAgo <= 24) return '+60';
  if (hoursAgo <= 72) return '+30';
  return '+10';
}

function getSightingDistanceBoost(miles) {
  if (miles <= 0.25) return '+50';
  if (miles <= 0.5) return '+30';
  if (miles <= 1) return '+15';
  if (miles <= 2) return '+5';
  return '+0';
}

function getRepeatPenalty(count) {
  if (count >= 3) return '-100';
  if (count === 2) return '-50';
  if (count === 1) return '-20';
  return '+0';
}
