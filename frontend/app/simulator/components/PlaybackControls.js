'use client';

/**
 * PlaybackControls - Animation controls for simulation playback
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, FastForward,
  RotateCcw, Target, Sun, Moon, Sunrise, Battery,
  Drumstick, AlertCircle, Home, Eye
} from 'lucide-react';

const SPEED_OPTIONS = [
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 5, label: '5x' },
  { value: 10, label: '10x' },
  { value: 50, label: '50x' },
];

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (days > 0) {
    return `Day ${days + 1}, ${remainingHours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function interpolatePosition(path, minute) {
  if (!path || path.length === 0) return null;

  // Find the two points to interpolate between
  let before = path[0];
  let after = path[path.length - 1];

  for (let i = 0; i < path.length - 1; i++) {
    if (path[i].minute <= minute && path[i + 1].minute >= minute) {
      before = path[i];
      after = path[i + 1];
      break;
    }
    if (path[i].minute <= minute) {
      before = path[i];
    }
  }

  // If exact match or same point, return it
  if (before.minute === after.minute || before.minute >= minute) {
    return {
      lat: before.lat,
      lng: before.lng,
      state: before.state,
      energy: before.energy,
      hunger: before.hunger,
    };
  }

  // Linear interpolation
  const ratio = (minute - before.minute) / (after.minute - before.minute);
  return {
    lat: before.lat + (after.lat - before.lat) * ratio,
    lng: before.lng + (after.lng - before.lng) * ratio,
    state: after.state,
    energy: before.energy + (after.energy - before.energy) * ratio,
    hunger: before.hunger + (after.hunger - before.hunger) * ratio,
  };
}

// Get time of day info
function getTimeOfDay(minute, startHour) {
  const currentHour = (startHour + Math.floor(minute / 60)) % 24;

  if (currentHour >= 5 && currentHour < 7) {
    return { period: 'dawn', icon: Sunrise, label: 'Dawn', color: 'text-orange-500' };
  } else if (currentHour >= 7 && currentHour < 17) {
    return { period: 'day', icon: Sun, label: 'Day', color: 'text-yellow-500' };
  } else if (currentHour >= 17 && currentHour < 20) {
    return { period: 'dusk', icon: Sunrise, label: 'Dusk', color: 'text-orange-500' };
  } else {
    return { period: 'night', icon: Moon, label: 'Night', color: 'text-indigo-500' };
  }
}

// State labels for display
const STATE_LABELS = {
  FLEEING: { label: 'Panicked', color: 'text-red-600', bg: 'bg-red-100' },
  HIDING: { label: 'Hiding', color: 'text-purple-600', bg: 'bg-purple-100' },
  FORAGING: { label: 'Foraging', color: 'text-amber-600', bg: 'bg-amber-100' },
  WANDERING: { label: 'Wandering', color: 'text-green-600', bg: 'bg-green-100' },
  TERRITORIAL: { label: 'Territorial', color: 'text-blue-600', bg: 'bg-blue-100' },
  SHELTERED: { label: 'Sheltered', color: 'text-gray-600', bg: 'bg-gray-100' },
};

export default function PlaybackControls({
  simulation,
  playbackState,
  onPlaybackChange,
}) {
  const animationRef = useRef(null);
  const lastTimeRef = useRef(null);

  // Parse path data
  const petPath = simulation?.petPathJson ? JSON.parse(simulation.petPathJson) : [];
  const searcherPaths = simulation?.searcherPathsJson ? JSON.parse(simulation.searcherPathsJson) : [];
  const maxMinute = petPath.length > 0 ? petPath[petPath.length - 1].minute : 0;

  // Update positions based on current minute
  const updatePositions = useCallback((minute) => {
    const petPosition = interpolatePosition(petPath, minute);

    const searcherPositions = searcherPaths.map(searcher => {
      return interpolatePosition(searcher.path, minute) || { lat: 0, lng: 0 };
    });

    onPlaybackChange(prev => ({
      ...prev,
      currentMinute: minute,
      petPosition,
      searcherPositions,
    }));
  }, [petPath, searcherPaths, onPlaybackChange]);

  // Animation loop
  useEffect(() => {
    if (!playbackState.isPlaying) {
      lastTimeRef.current = null;
      return;
    }

    const animate = (timestamp) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }

      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // Calculate new minute (delta is in ms, convert to simulation minutes based on speed)
      const minutesDelta = (delta / 1000) * playbackState.speed;
      const newMinute = Math.min(playbackState.currentMinute + minutesDelta, maxMinute);

      updatePositions(newMinute);

      // Stop at end
      if (newMinute >= maxMinute) {
        onPlaybackChange(prev => ({ ...prev, isPlaying: false }));
        return;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [playbackState.isPlaying, playbackState.speed, playbackState.currentMinute, maxMinute, updatePositions, onPlaybackChange]);

  // Control handlers
  const togglePlay = () => {
    onPlaybackChange(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const setSpeed = (speed) => {
    onPlaybackChange(prev => ({ ...prev, speed }));
  };

  const seek = (minute) => {
    updatePositions(minute);
    onPlaybackChange(prev => ({ ...prev, isPlaying: false }));
  };

  const reset = () => {
    seek(0);
  };

  const jumpToEnd = () => {
    seek(maxMinute);
  };

  const jumpToFind = () => {
    if (simulation?.foundAtMinute) {
      seek(simulation.foundAtMinute);
    }
  };

  const stepForward = () => {
    const newMinute = Math.min(playbackState.currentMinute + 5, maxMinute);
    seek(newMinute);
  };

  const stepBackward = () => {
    const newMinute = Math.max(playbackState.currentMinute - 5, 0);
    seek(newMinute);
  };

  if (!simulation || petPath.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-4">
        {/* Main Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={reset}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={stepBackward}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Step back 5 min"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            title={playbackState.isPlaying ? 'Pause' : 'Play'}
          >
            {playbackState.isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>

          <button
            onClick={stepForward}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Step forward 5 min"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={jumpToEnd}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Jump to end"
          >
            <FastForward className="w-4 h-4" />
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 w-24">
              {formatTime(Math.floor(playbackState.currentMinute))}
            </span>
            <input
              type="range"
              min="0"
              max={maxMinute}
              step="1"
              value={playbackState.currentMinute}
              onChange={(e) => seek(parseFloat(e.target.value))}
              className="flex-1 accent-indigo-600"
            />
            <span className="text-xs text-gray-500 w-24 text-right">
              {formatTime(maxMinute)}
            </span>
          </div>
        </div>

        {/* Speed */}
        <div className="flex items-center gap-1 border-l border-gray-200 pl-4">
          {SPEED_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSpeed(value)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                playbackState.speed === value
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Jump to Find */}
        {simulation?.foundAtMinute && (
          <button
            onClick={jumpToFind}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
            title="Jump to find moment"
          >
            <Target className="w-3 h-3" />
            Found
          </button>
        )}
      </div>

      {/* Enhanced Status Bar */}
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {/* Time of Day */}
        {(() => {
          const timeInfo = getTimeOfDay(playbackState.currentMinute, 8);
          const TimeIcon = timeInfo.icon;
          return (
            <div className="flex items-center gap-2">
              <TimeIcon className={`w-4 h-4 ${timeInfo.color}`} />
              <span className="text-gray-600">{timeInfo.label}</span>
            </div>
          );
        })()}

        {/* Pet State */}
        {(() => {
          const stateInfo = STATE_LABELS[playbackState.petPosition?.state] || STATE_LABELS.WANDERING;
          return (
            <div className={`flex items-center gap-2 px-2 py-1 rounded ${stateInfo.bg}`}>
              <span className={`font-medium ${stateInfo.color}`}>{stateInfo.label}</span>
            </div>
          );
        })()}

        {/* Energy Bar */}
        <div className="flex items-center gap-2">
          <Battery className="w-4 h-4 text-green-500" />
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                (playbackState.petPosition?.energy || 0) > 0.5
                  ? 'bg-green-500'
                  : (playbackState.petPosition?.energy || 0) > 0.2
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${(playbackState.petPosition?.energy || 0) * 100}%` }}
            />
          </div>
          <span className="text-gray-500 w-8">{Math.round((playbackState.petPosition?.energy || 0) * 100)}%</span>
        </div>

        {/* Hunger Bar */}
        <div className="flex items-center gap-2">
          <Drumstick className="w-4 h-4 text-amber-500" />
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                (playbackState.petPosition?.hunger || 0) < 0.5
                  ? 'bg-green-500'
                  : (playbackState.petPosition?.hunger || 0) < 0.7
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${(playbackState.petPosition?.hunger || 0) * 100}%` }}
            />
          </div>
          <span className="text-gray-500 w-8">{Math.round((playbackState.petPosition?.hunger || 0) * 100)}%</span>
        </div>
      </div>

      {/* Event Alerts */}
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {simulation?.wasTransported && simulation?.transportedAtMinute && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded ${
            playbackState.currentMinute >= simulation.transportedAtMinute
              ? 'bg-orange-100 text-orange-700'
              : 'bg-gray-100 text-gray-400'
          }`}>
            <AlertCircle className="w-3 h-3" />
            {playbackState.currentMinute >= simulation.transportedAtMinute
              ? `Picked up at ${formatTime(simulation.transportedAtMinute)}`
              : `Will be picked up at ${formatTime(simulation.transportedAtMinute)}`
            }
          </div>
        )}

        {simulation?.outcome && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded ${
            playbackState.currentMinute >= (simulation.foundAtMinute || maxMinute)
              ? (simulation.outcome.startsWith('FOUND') || simulation.outcome === 'RETURNED_HOME'
                ? 'bg-green-100 text-green-700'
                : 'bg-orange-100 text-orange-700')
              : 'bg-gray-100 text-gray-400'
          }`}>
            {simulation.outcome === 'RETURNED_HOME' ? (
              <Home className="w-3 h-3" />
            ) : simulation.outcome.startsWith('FOUND') ? (
              <Eye className="w-3 h-3" />
            ) : (
              <AlertCircle className="w-3 h-3" />
            )}
            {simulation.outcome.replace(/_/g, ' ')}
            {simulation.foundAtMinute && ` at ${formatTime(simulation.foundAtMinute)}`}
          </div>
        )}

        <div className="flex items-center gap-1 px-2 py-1 rounded bg-blue-50 text-blue-700">
          <Target className="w-3 h-3" />
          {playbackState.searcherPositions?.length || 0} searchers active
        </div>
      </div>
    </div>
  );
}
