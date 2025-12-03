'use client';

/**
 * Mission Selector - Dropdown for switching between active missions
 *
 * Beautiful, smooth dropdown with:
 * - Urgency color coding
 * - Quick stats (time, helpers)
 * - Smooth animations
 * - Mobile responsive
 * - Keyboard navigation
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Clock, Users, MapPin, RefreshCw, Plus } from 'lucide-react';

export default function MissionSelector({ missions, activeMission, onSwitch, onRefresh }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const getUrgencyIndicator = (mission) => {
    const hours = mission.hoursMissing || 0;
    if (hours < 4) {
      return { emoji: '🔴', label: 'URGENT', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/50' };
    }
    if (hours < 24) {
      return { emoji: '🟡', label: 'ACTIVE', color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/50' };
    }
    return { emoji: '🟢', label: 'ONGOING', color: 'text-flash-400', bg: 'bg-flash-500/20', border: 'border-flash-500/50' };
  };

  const sortedMissions = [...(missions || [])].sort((a, b) => {
    // Sort by urgency (most urgent first)
    const aHours = a.hoursMissing || 999;
    const bHours = b.hoursMissing || 999;
    return aHours - bHours;
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-2 sm:py-3 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 border-2 border-flash-500/30 hover:border-flash-500/50 transition-all shadow-lg hover:shadow-flash-500/20 group"
      >
        {activeMission ? (
          <>
            {/* Pet Icon */}
            <div className="hidden sm:block text-2xl">
              {activeMission.petSpecies === 'DOG' ? '🐕' :
               activeMission.petSpecies === 'CAT' ? '🐈' :
               activeMission.petSpecies === 'BIRD' ? '🐦' :
               activeMission.petSpecies === 'RABBIT' ? '🐰' : '🐾'}
            </div>

            {/* Mission Info */}
            <div className="text-left">
              <div className="font-bold text-white text-sm sm:text-base group-hover:text-flash-400 transition">
                {activeMission.petName}
              </div>
              <div className="hidden sm:block text-xs text-slate-400">
                {activeMission.timeMissing || 'Unknown'} • {activeMission.helperCount || 0} helpers
              </div>
            </div>

            {/* Chevron */}
            <ChevronDown
              className={`text-flash-400 transition-transform ml-1 ${isOpen ? 'rotate-180' : ''}`}
              size={20}
            />
          </>
        ) : (
          <>
            <span className="text-white font-semibold text-sm sm:text-base">Select Mission</span>
            <ChevronDown
              className={`text-flash-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              size={20}
            />
          </>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-[calc(100vw-2rem)] sm:w-[28rem] bg-slate-800/95 backdrop-blur-xl border-2 border-flash-500/30 rounded-xl shadow-2xl shadow-flash-500/20 z-50 max-h-[70vh] overflow-hidden animate-slideDown">
          {/* Header */}
          <div className="sticky top-0 bg-slate-800/95 backdrop-blur-xl border-b border-slate-700/50 p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-flash-400 uppercase tracking-wide">
                Active Missions
              </div>
              <div className="text-sm text-slate-400 mt-0.5">
                {sortedMissions.length} mission{sortedMissions.length !== 1 ? 's' : ''} in progress
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Refresh missions"
            >
              <RefreshCw size={16} />
            </button>
          </div>

          {/* Missions List */}
          <div className="overflow-y-auto max-h-[calc(70vh-8rem)] p-3">
            {sortedMissions.length > 0 ? (
              <div className="space-y-2">
                {sortedMissions.map((mission) => {
                  const urgency = getUrgencyIndicator(mission);
                  const isActive = activeMission?.id === mission.id;

                  return (
                    <button
                      key={mission.id}
                      onClick={() => {
                        onSwitch(mission.id);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left p-4 rounded-xl transition-all group ${
                        isActive
                          ? 'bg-flash-500/20 border-2 border-flash-500/50 shadow-lg shadow-flash-500/10'
                          : 'bg-slate-700/30 border-2 border-slate-600/30 hover:border-flash-500/40 hover:bg-slate-700/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Pet Photo or Emoji */}
                        {mission.photoUrl ? (
                          <img
                            src={mission.photoUrl}
                            alt={mission.petName}
                            className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border-2 border-slate-600/50 group-hover:border-flash-500/30 transition"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-slate-600/50 flex items-center justify-center text-2xl flex-shrink-0 border-2 border-slate-600/50 group-hover:border-flash-500/30 transition">
                            {mission.petSpecies === 'DOG' ? '🐕' :
                             mission.petSpecies === 'CAT' ? '🐈' :
                             mission.petSpecies === 'BIRD' ? '🐦' :
                             mission.petSpecies === 'RABBIT' ? '🐰' : '🐾'}
                          </div>
                        )}

                        {/* Mission Info */}
                        <div className="flex-1 min-w-0">
                          {/* Name and urgency */}
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className={`font-bold truncate ${
                              isActive ? 'text-flash-400' : 'text-white group-hover:text-flash-400'
                            } transition`}>
                              {mission.petName}
                            </h4>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold flex-shrink-0 ${urgency.color} ${urgency.bg} border ${urgency.border}`}>
                              {urgency.emoji} {urgency.label}
                            </span>
                          </div>

                          {/* Stats */}
                          <div className="flex items-center gap-4 text-xs text-slate-400 mb-2">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {mission.timeMissing || 'Unknown'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users size={12} />
                              {mission.helperCount || 0} helpers
                            </span>
                          </div>

                          {/* Location */}
                          <div className="flex items-start gap-1 text-xs text-slate-500">
                            <MapPin size={12} className="flex-shrink-0 mt-0.5" />
                            <span className="truncate">{mission.lastSeenAddress || 'Location unknown'}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <p className="text-sm">No missions available</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-slate-800/95 backdrop-blur-xl border-t border-slate-700/50 p-3">
            <button
              onClick={() => {
                window.location.href = '/report/new';
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-flash-500 to-flash-400 text-midnight-900 font-bold hover:scale-105 transition-all shadow-lg shadow-flash-500/30 flex items-center justify-center gap-2"
            >
              <Plus size={20} />
              Launch New Mission
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
