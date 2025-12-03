'use client';

/**
 * Mission Info Bar - Compact mission details
 * Mobile-first design - single row with essential info only
 */

import { useState } from 'react';
import { Clock, Users, Shield, Radio, Crown } from 'lucide-react';
import { normalizePhotoUrl } from '@/app/lib/utils';

export default function MissionHero({ mission, session, onJoinMission }) {
  const [isJoining, setIsJoining] = useState(false);

  if (!mission) return null;

  // Calculate time missing
  const getTimeMissing = () => {
    if (!mission.lastSeenAt) return null;
    const hours = Math.floor((Date.now() - new Date(mission.lastSeenAt).getTime()) / 3600000);
    if (hours < 1) return { text: '<1h', hours: 0 };
    if (hours < 24) return { text: `${hours}h`, hours };
    const days = Math.floor(hours / 24);
    return { text: `${days}d ${hours % 24}h`, hours };
  };

  const timeMissing = getTimeMissing();
  const isUrgent = timeMissing && timeMissing.hours < 24;
  const isReunited = mission.status === 'RESOLVED' || mission.resolution === 'REUNITED';

  // Get participants from assignments
  const participants = mission.assignments?.flatMap(a => a.participants || []) || [];
  const activeParticipants = participants.filter(p => p.isActive !== false);
  const helperCount = activeParticipants.length;

  // Check user status
  const isDeployed = session && activeParticipants.some(p => p.userId === session.user.id);
  const isOwner = session && mission.ownerId === session.user.id;

  const handleJoin = async () => {
    setIsJoining(true);
    try {
      await onJoinMission?.(mission.id);
    } finally {
      // Keep showing loading for a bit to let data refresh
      setTimeout(() => setIsJoining(false), 500);
    }
  };

  return (
    <div className="bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/60">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Pet Photo - Small */}
          {mission.petPhotoUrl ? (
            <img
              src={normalizePhotoUrl(mission.petPhotoUrl)}
              alt={mission.petName}
              className="w-12 h-12 rounded-lg object-cover border-2 border-flash-500/30 flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-2xl flex-shrink-0">
              {mission.petSpecies === 'DOG' ? '🐕' : mission.petSpecies === 'CAT' ? '🐈' : '🐾'}
            </div>
          )}

          {/* Pet Name & Status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg sm:text-xl font-bold text-white truncate">{mission.petName}</h2>

              {/* Time Missing Badge */}
              {timeMissing && !isReunited && (
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${
                  isUrgent ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  <Clock size={12} />
                  {timeMissing.text}
                </div>
              )}

              {isReunited && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold whitespace-nowrap">
                  ✓ Reunited
                </span>
              )}
            </div>

            {/* Quick Stats - Mobile horizontal scroll */}
            <div className="flex items-center gap-3 text-xs text-slate-400 overflow-x-auto">
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Users size={12} />
                {helperCount} {helperCount === 1 ? 'helper' : 'helpers'}
              </span>
              {mission.petBreed && (
                <span className="truncate">• {mission.petBreed}</span>
              )}
            </div>
          </div>

          {/* Join Button - Compact */}
          {!isReunited && session && (
            <div className="flex-shrink-0">
              {isOwner ? (
                <div className="px-3 py-1.5 rounded-lg bg-flash-500/10 border border-flash-500/30 flex items-center gap-1.5">
                  <Crown size={14} className="text-flash-400" />
                  <span className="text-xs font-bold text-flash-400 hidden sm:inline">Owner</span>
                </div>
              ) : isDeployed ? (
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-1.5">
                  <Shield size={14} className="text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400 hidden sm:inline">Deployed</span>
                </div>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={isJoining}
                  className="px-3 sm:px-4 py-1.5 rounded-lg bg-gradient-to-r from-flash-500 to-flash-400 text-midnight-900 text-xs sm:text-sm font-bold hover:scale-105 transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isJoining ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-midnight-900 border-t-transparent rounded-full animate-spin" />
                      <span className="hidden sm:inline">Joining...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <Radio size={14} />
                      <span className="hidden sm:inline">Join Mission</span>
                      <span className="sm:hidden">Join</span>
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
