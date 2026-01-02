'use client';

/**
 * PlaybackControls - Animation controls for simulation playback
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, FastForward,
  RotateCcw, Target
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
    return { lat: before.lat, lng: before.lng, state: before.state };
  }

  // Linear interpolation
  const ratio = (minute - before.minute) / (after.minute - before.minute);
  return {
    lat: before.lat + (after.lat - before.lat) * ratio,
    lng: before.lng + (after.lng - before.lng) * ratio,
    state: after.state, // Use the next state
  };
}

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

      {/* Status Bar */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <div>
          State: <span className="font-medium text-gray-700">
            {playbackState.petPosition?.state || 'Unknown'}
          </span>
        </div>
        <div>
          Searchers: <span className="font-medium text-gray-700">
            {playbackState.searcherPositions?.length || 0}
          </span>
        </div>
        {simulation?.wasTransported && simulation?.transportedAtMinute && (
          <div className="text-orange-600">
            Picked up at {formatTime(simulation.transportedAtMinute)}
          </div>
        )}
        {simulation?.outcome && (
          <div className={
            simulation.outcome.startsWith('FOUND') || simulation.outcome === 'RETURNED_HOME'
              ? 'text-green-600'
              : 'text-orange-600'
          }>
            Outcome: {simulation.outcome.replace(/_/g, ' ')}
          </div>
        )}
      </div>
    </div>
  );
}
