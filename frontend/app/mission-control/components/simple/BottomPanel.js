'use client';

/**
 * BottomPanel - Floating bottom panel with actions and primary CTA
 *
 * Features:
 * - QuickActions bar for common actions
 * - Primary CTA button (Start/End Search)
 * - Semi-transparent gradient background
 * - Safe area padding for mobile
 */

import QuickActions from './QuickActions';
import { Loader2, Navigation, Compass } from 'lucide-react';

export default function BottomPanel({
  // Search state
  isSearching = false,
  isStarting = false,
  isEnding = false,

  // Callbacks
  onStartSearch,
  onEndSearch,
  onAction,

  // Stats for display
  estimatedPoints = 0,

  // Disable during loading
  disabled = false,
}) {
  const isLoading = isStarting || isEnding;

  const handlePrimaryAction = () => {
    if (isSearching) {
      onEndSearch?.();
    } else {
      onStartSearch?.();
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10">
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent pointer-events-none" />

      {/* Content */}
      <div className="relative px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {/* Quick Actions (only when not searching) */}
        {!isSearching && (
          <div className="mb-3">
            <QuickActions
              onAction={onAction}
              disabled={disabled || isLoading}
            />
          </div>
        )}

        {/* Primary CTA Button */}
        <button
          onClick={handlePrimaryAction}
          disabled={disabled || isLoading}
          className={`
            w-full py-4 rounded-2xl font-bold text-lg
            flex items-center justify-center gap-3
            transition-all transform
            ${isLoading ? 'opacity-70 cursor-wait' : 'active:scale-[0.98]'}
            ${isSearching
              ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/30'
              : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30'
            }
          `}
        >
          {isLoading ? (
            <Loader2 size={24} className="animate-spin" />
          ) : isSearching ? (
            <>
              <Navigation size={22} />
              <span>END & EARN {estimatedPoints} PTS</span>
            </>
          ) : (
            <>
              <Compass size={22} />
              <span>START GPS SEARCH</span>
            </>
          )}
        </button>

        {/* Subtitle */}
        {!isSearching && !isLoading && (
          <p className="text-center text-xs text-slate-500 mt-2">
            GPS-tracked search • Earn 100 pts/mile
          </p>
        )}
      </div>
    </div>
  );
}
