'use client';

/**
 * SearchPlannerPanel - Desktop Controls for Search Path Planning
 *
 * A panel for planning or recording search paths on desktop:
 * - Toggle edit mode to click on map and add points
 * - View and manage the current path
 * - Undo points, clear path, or save
 *
 * Two use cases:
 * 1. PLANNING: Mark out a route before going to search
 * 2. RETROSPECTIVE: Record where you already searched after the fact
 */

import { useState } from 'react';
import {
  MousePointer,
  MapPin,
  Play,
  Square,
  Undo2,
  Trash2,
  Save,
  Route,
  Award,
  Info,
  X,
  Edit3,
  Eye
} from 'lucide-react';

export default function SearchPlannerPanel({
  // From useSearchSession hook
  isActive,
  path,
  stats,
  error,
  canUndo,
  // Actions
  addPointAtLocation,
  endSession,
  undoLastPoint,
  clearPath,
  startSession,
  cancelSession,
  // Edit mode state (controlled by parent)
  isEditMode,
  onEditModeChange,
  // Optional
  onSessionEnd,
  className = '',
}) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('planning'); // 'planning' or 'retrospective'

  // Handle save
  const handleSave = async () => {
    setSaving(true);
    const result = await endSession();
    setSaving(false);
    setShowSaveConfirm(false);

    if (result.success && onSessionEnd) {
      onSessionEnd(result);
    }
  };

  // Handle clear
  const handleClear = () => {
    clearPath();
    setShowClearConfirm(false);
  };

  // Format distance
  const formatDistance = (miles) => {
    if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
    return `${miles.toFixed(2)} mi`;
  };

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Route size={20} className="text-purple-500" />
            <h3 className="font-semibold text-slate-800 dark:text-white">Search Planner</h3>
          </div>

          {/* Mode Toggle */}
          <div className="flex bg-slate-200 dark:bg-slate-600 rounded-lg p-0.5">
            <button
              onClick={() => setMode('planning')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                mode === 'planning'
                  ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Planning
            </button>
            <button
              onClick={() => setMode('retrospective')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                mode === 'retrospective'
                  ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Mark Searched
            </button>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/30 border-b border-purple-100 dark:border-purple-800">
        <div className="flex items-start gap-2">
          <Info size={16} className="text-purple-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-purple-700 dark:text-purple-300">
            {mode === 'planning'
              ? 'Click on the map to plan your search route. The path shows the approximate coverage area.'
              : 'Click on the map to mark areas you have already searched. This helps the team see coverage.'}
          </p>
        </div>
      </div>

      {/* Edit Mode Toggle */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-600">
        <button
          onClick={() => onEditModeChange(!isEditMode)}
          className={`
            w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2
            transition-all
            ${isEditMode
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
            }
          `}
        >
          {isEditMode ? (
            <>
              <Eye size={18} />
              Done Editing
            </>
          ) : (
            <>
              <Edit3 size={18} />
              Click Map to Add Points
            </>
          )}
        </button>
      </div>

      {/* Stats */}
      {path.length > 0 && (
        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <MapPin size={16} className="text-purple-500" />
                <span className="font-semibold text-slate-800 dark:text-white">{stats.pointsMarked}</span>
                <span className="text-slate-500 dark:text-slate-400 text-sm">points</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Route size={16} className="text-blue-500" />
                <span className="font-semibold text-slate-800 dark:text-white">{formatDistance(stats.distanceMiles)}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-amber-100 dark:bg-amber-900/30 px-3 py-1 rounded-full">
              <Award size={16} className="text-amber-600 dark:text-amber-400" />
              <span className="text-amber-700 dark:text-amber-400 font-semibold text-sm">+{stats.estimatedPoints} pts</span>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 px-3 py-2 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Path Points List */}
      {path.length > 0 && (
        <div className="p-4 max-h-48 overflow-y-auto">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Path Points
          </div>
          <div className="space-y-1">
            {path.map((point, index) => (
              <div
                key={point.id}
                className="flex items-center gap-2 px-2 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm"
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    index === 0 ? 'bg-green-500' :
                    index === path.length - 1 ? 'bg-blue-500' :
                    point.inZone === false ? 'bg-gray-400' : 'bg-purple-500'
                  }`}
                >
                  {index + 1}
                </div>
                <span className="text-slate-600 dark:text-slate-300 flex-1">
                  {index === 0 ? 'Start' : index === path.length - 1 ? 'Current' : `Point ${index + 1}`}
                </span>
                {point.timestamp && (
                  <span className="text-slate-400 dark:text-slate-500 text-xs">
                    {new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-200 dark:border-slate-600">
        <div className="flex gap-2">
          {/* Undo */}
          <button
            onClick={undoLastPoint}
            disabled={!canUndo}
            className={`
              flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-1.5 text-sm
              transition-colors
              ${canUndo
                ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }
            `}
          >
            <Undo2 size={16} />
            Undo
          </button>

          {/* Clear */}
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={path.length === 0}
            className={`
              flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-1.5 text-sm
              transition-colors
              ${path.length > 0
                ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-500'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }
            `}
          >
            <Trash2 size={16} />
            Clear
          </button>

          {/* Save */}
          <button
            onClick={() => setShowSaveConfirm(true)}
            disabled={path.length < 2}
            className={`
              flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-1.5 text-sm
              transition-colors
              ${path.length >= 2
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }
            `}
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </div>

      {/* Clear Confirmation */}
      {showClearConfirm && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">Clear Path?</h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">
              This will remove all {path.length} points from your current path. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-medium"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Confirmation */}
      {showSaveConfirm && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Save Search Path?
            </h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">
              {mode === 'planning'
                ? 'Your planned route will be saved and visible to the search team.'
                : 'This area will be marked as searched, helping the team track coverage.'}
            </p>

            <div className="bg-slate-100 dark:bg-slate-700 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">Points:</span>
                <span className="font-semibold text-slate-800 dark:text-white">{stats.pointsMarked}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-slate-600 dark:text-slate-300">Distance:</span>
                <span className="font-semibold text-slate-800 dark:text-white">{formatDistance(stats.distanceMiles)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-slate-600 dark:text-slate-300">Points earned:</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">+{stats.estimatedPoints}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveConfirm(false)}
                className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
              >
                {saving ? (
                  <span className="animate-pulse">Saving...</span>
                ) : (
                  <>
                    <Save size={16} />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
