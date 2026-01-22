'use client';

/**
 * BottomSheet - Mobile-friendly swipe-up panel for case switching
 *
 * Shows a drag handle at bottom of screen
 * Swipe up (or tap) to reveal case list
 * Swipe down (or tap backdrop) to close
 */

import { useState, useRef, useEffect } from 'react';
import { X, ChevronUp } from 'lucide-react';

export default function BottomSheet({
  isOpen,
  onClose,
  onOpen,
  title = 'Your Missions',
  peekContent,
  children,
  className = '',
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragY, setDragY] = useState(0);
  const sheetRef = useRef(null);
  const startYRef = useRef(0);

  // Handle touch start
  const handleTouchStart = (e) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  // Handle touch move
  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    // Only allow dragging down when open, up when closed
    if (isOpen && diff > 0) {
      setDragY(diff);
    } else if (!isOpen && diff < 0) {
      setDragY(diff);
    }
  };

  // Handle touch end
  const handleTouchEnd = () => {
    setIsDragging(false);

    // If dragged more than 50px, toggle state
    if (isOpen && dragY > 50) {
      onClose();
    } else if (!isOpen && dragY < -50) {
      onOpen();
    }

    setDragY(0);
  };

  // Close on escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fadeIn"
          onClick={onClose}
        />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={`
          fixed inset-x-0 bottom-0 z-50
          transition-transform duration-300 ease-out
          ${isDragging ? 'transition-none' : ''}
          ${className}
        `}
        style={{
          transform: isOpen
            ? `translateY(${Math.max(0, dragY)}px)`
            : `translateY(calc(100% - 60px + ${Math.min(0, dragY)}px))`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="bg-slate-900 border-t-2 border-flash-500/30 rounded-t-2xl shadow-2xl overflow-hidden">
          {/* Drag Handle */}
          <button
            onClick={isOpen ? onClose : onOpen}
            className="w-full py-3 flex flex-col items-center gap-2 hover:bg-slate-800/50 transition"
          >
            <div className="w-10 h-1 rounded-full bg-slate-600" />
            {!isOpen && peekContent && (
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <ChevronUp size={16} className="animate-bounce" />
                <span>{peekContent}</span>
              </div>
            )}
          </button>

          {/* Header (when open) */}
          {isOpen && (
            <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-700/50">
              <h3 className="font-bold text-white">{title}</h3>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Content */}
          <div
            className="overflow-y-auto"
            style={{ maxHeight: isOpen ? '60vh' : '0px' }}
          >
            <div className="p-4">
              {children}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * MissionBottomSheet - Pre-configured bottom sheet for mission switching
 */
export function MissionBottomSheet({
  missions = [],
  activeMissionId,
  onSelectMission,
  isOpen,
  onClose,
  onOpen,
}) {
  // Sort by urgency
  const sortedMissions = [...missions].sort((a, b) => {
    const aHours = a.hoursMissing || 999;
    const bHours = b.hoursMissing || 999;
    return aHours - bHours;
  });

  const getUrgencyDot = (mission) => {
    const hours = mission.hoursMissing || 0;
    if (hours < 4) return 'bg-red-500 animate-pulse';
    if (hours < 24) return 'bg-amber-500';
    return 'bg-green-500';
  };

  const getSpeciesEmoji = (species) => {
    return { DOG: '🐕', CAT: '🐈', BIRD: '🐦', RABBIT: '🐰' }[species] || '🐾';
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      onOpen={onOpen}
      title="Your Missions"
      peekContent={`${missions.length} mission${missions.length !== 1 ? 's' : ''} - swipe up`}
    >
      {missions.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-3">🐾</div>
          <p className="text-slate-400">No active missions</p>
          <p className="text-slate-500 text-sm mt-1">Join a rescue force to help!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedMissions.map((mission) => {
            const isActive = mission.id === activeMissionId;
            return (
              <button
                key={mission.id}
                onClick={() => {
                  onSelectMission(mission.id);
                  onClose();
                }}
                className={`
                  w-full text-left p-4 rounded-xl transition-all flex items-center gap-3
                  ${isActive
                    ? 'bg-flash-500/20 border-2 border-flash-500/50'
                    : 'bg-slate-800/50 border border-slate-700/30 hover:border-flash-500/30'
                  }
                `}
              >
                {/* Urgency dot */}
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getUrgencyDot(mission)}`} />

                {/* Pet photo or emoji */}
                {mission.photoUrl ? (
                  <img
                    src={mission.photoUrl}
                    alt={mission.petName}
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center text-2xl flex-shrink-0">
                    {getSpeciesEmoji(mission.petSpecies)}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${isActive ? 'text-flash-400' : 'text-white'}`}>
                      {mission.petName}
                    </span>
                    {isActive && (
                      <span className="text-xs text-flash-400">← viewing</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm">{mission.timeMissing || 'Unknown'}</p>
                  <p className="text-slate-500 text-xs truncate">{mission.lastSeenAddress}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}
