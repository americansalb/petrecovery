'use client';

/**
 * CaseRail - Left sidebar for quick case switching in Mission Control
 *
 * Shows user's joined missions sorted by urgency
 * Highlights current case
 * Click to switch cases (no page reload)
 */

import { Clock, MapPin } from 'lucide-react';

export default function CaseRail({
  missions = [],
  activeMissionId,
  onSelectMission,
  className = '',
}) {
  // Sort by urgency (most urgent first)
  const sortedMissions = [...missions].sort((a, b) => {
    const aHours = a.hoursMissing || 999;
    const bHours = b.hoursMissing || 999;
    return aHours - bHours;
  });

  // Get urgency indicator
  const getUrgency = (mission) => {
    const hours = mission.hoursMissing || 0;
    if (hours < 4) return { color: 'red', dot: 'bg-red-500', label: 'URGENT' };
    if (hours < 24) return { color: 'amber', dot: 'bg-amber-500', label: 'ACTIVE' };
    return { color: 'green', dot: 'bg-green-500', label: 'ONGOING' };
  };

  // Get species emoji
  const getSpeciesEmoji = (species) => {
    const emojis = {
      DOG: '🐕',
      CAT: '🐈',
      BIRD: '🐦',
      RABBIT: '🐰',
    };
    return emojis[species] || '🐾';
  };

  if (missions.length === 0) {
    return (
      <div className={`w-56 flex-shrink-0 ${className}`}>
        <div className="p-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
            Your Missions
          </h2>
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🐾</div>
            <p className="text-slate-400 text-sm">No active missions</p>
            <p className="text-slate-500 text-xs mt-1">Join a rescue force to help</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-56 flex-shrink-0 bg-slate-900/50 border-r border-slate-700/50 ${className}`}>
      <div className="p-4">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
          Your Missions
        </h2>

        <div className="space-y-2">
          {sortedMissions.map((mission) => {
            const isActive = mission.id === activeMissionId;
            const urgency = getUrgency(mission);

            return (
              <button
                key={mission.id}
                onClick={() => onSelectMission(mission.id)}
                className={`
                  w-full text-left p-3 rounded-xl transition-all
                  ${isActive
                    ? 'bg-flash-500/20 border-2 border-flash-500/50 shadow-lg shadow-flash-500/10'
                    : 'bg-slate-800/30 border border-slate-700/30 hover:bg-slate-800/50 hover:border-flash-500/30'
                  }
                `}
              >
                {/* Pet name and urgency dot */}
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full ${urgency.dot} ${urgency.color === 'red' ? 'animate-pulse' : ''}`} />
                  <span className={`font-bold text-sm truncate ${isActive ? 'text-flash-400' : 'text-white'}`}>
                    {mission.petName}
                  </span>
                  <span className="text-lg flex-shrink-0">{getSpeciesEmoji(mission.petSpecies)}</span>
                </div>

                {/* Time missing */}
                <div className="flex items-center gap-1 text-xs text-slate-400 mb-1">
                  <Clock size={10} />
                  <span>{mission.timeMissing || 'Unknown'}</span>
                </div>

                {/* Location - truncated */}
                <div className="flex items-center gap-1 text-xs text-slate-500 truncate">
                  <MapPin size={10} className="flex-shrink-0" />
                  <span className="truncate">{mission.lastSeenAddress || 'Location unknown'}</span>
                </div>

                {/* Viewing indicator */}
                {isActive && (
                  <div className="mt-2 text-xs text-flash-400 font-semibold">
                    ← viewing
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * CaseRailMini - Compact version for mobile (just icons/names)
 */
export function CaseRailMini({ missions = [], activeMissionId, onSelectMission }) {
  const getUrgencyDot = (mission) => {
    const hours = mission.hoursMissing || 0;
    if (hours < 4) return 'bg-red-500 animate-pulse';
    if (hours < 24) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 px-4">
      {missions.map((mission) => {
        const isActive = mission.id === activeMissionId;
        return (
          <button
            key={mission.id}
            onClick={() => onSelectMission(mission.id)}
            className={`
              flex-shrink-0 px-3 py-2 rounded-lg flex items-center gap-2 transition-all
              ${isActive
                ? 'bg-flash-500/20 border border-flash-500/50'
                : 'bg-slate-800/50 border border-slate-700/30 hover:border-flash-500/30'
              }
            `}
          >
            <div className={`w-2 h-2 rounded-full ${getUrgencyDot(mission)}`} />
            <span className={`text-sm font-semibold ${isActive ? 'text-flash-400' : 'text-white'}`}>
              {mission.petName}
            </span>
          </button>
        );
      })}
    </div>
  );
}
