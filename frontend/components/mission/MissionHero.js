'use client';

/**
 * Mission Hero - Always-visible key mission info
 *
 * Shows the most important information at a glance:
 * - Pet photo and name
 * - Time missing with urgency indicator
 * - Priority action callout
 * - Quick stats (sightings, helpers, reward)
 */

import { Clock, Users, Eye, Award, Heart, AlertCircle, MapPin } from 'lucide-react';
import { normalizePhotoUrl } from '@/app/lib/utils';

export default function MissionHero({ mission }) {
  if (!mission) return null;

  // Calculate time missing
  const getTimeMissing = () => {
    if (!mission.lastSeenAt) return null;
    const hours = Math.floor((Date.now() - new Date(mission.lastSeenAt).getTime()) / 3600000);
    if (hours < 1) return { text: 'Less than 1 hour', hours: 0 };
    if (hours < 24) return { text: `${hours} hour${hours !== 1 ? 's' : ''}`, hours };
    const days = Math.floor(hours / 24);
    return { text: `${days} day${days !== 1 ? 's' : ''} ${hours % 24}h`, hours };
  };

  const timeMissing = getTimeMissing();
  const isUrgent = timeMissing && timeMissing.hours < 24;
  const isReunited = mission.status === 'RESOLVED' || mission.resolution === 'REUNITED';

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border-b-2 border-slate-800/60 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Pet Info */}
          <div className="lg:col-span-2">
            <div className="flex items-start gap-6">
              {/* Pet Photo */}
              {mission.petPhotoUrl ? (
                <img
                  src={normalizePhotoUrl(mission.petPhotoUrl)}
                  alt={mission.petName}
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl object-cover border-4 border-flash-500/30 shadow-lg flex-shrink-0"
                />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-5xl sm:text-6xl border-4 border-slate-700 flex-shrink-0">
                  {mission.petSpecies === 'DOG' ? '🐕' :
                   mission.petSpecies === 'CAT' ? '🐈' :
                   mission.petSpecies === 'BIRD' ? '🐦' :
                   mission.petSpecies === 'RABBIT' ? '🐰' : '🐾'}
                </div>
              )}

              {/* Pet Details */}
              <div className="flex-1 min-w-0">
                {/* Name and Status */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white mb-1">{mission.petName}</h2>
                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="capitalize">{mission.petSpecies?.toLowerCase()}</span>
                      {mission.petBreed && (
                        <>
                          <span>•</span>
                          <span>{mission.petBreed}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Reunited Badge */}
                  {isReunited && (
                    <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold flex items-center gap-2 shadow-lg animate-pulse">
                      <Heart size={18} />
                      Reunited!
                    </div>
                  )}
                </div>

                {/* Time Missing - Prominent */}
                {timeMissing && !isReunited && (
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold mb-3 ${
                    isUrgent
                      ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50 animate-pulse'
                      : 'bg-amber-500/20 text-amber-400 border-2 border-amber-500/50'
                  }`}>
                    <Clock size={18} />
                    <span>{timeMissing.text} missing</span>
                    {isUrgent && <span className="text-xl">⚡</span>}
                  </div>
                )}

                {/* Last Seen Location */}
                {mission.lastSeenAddress && (
                  <div className="flex items-start gap-2 text-sm text-slate-400">
                    <MapPin size={16} className="flex-shrink-0 mt-0.5" />
                    <span>Last seen: {mission.lastSeenAddress}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Quick Stats & Actions */}
          <div className="space-y-4">
            {/* Urgency Alert */}
            {isUrgent && !isReunited && (
              <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border-2 border-red-500/50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle size={24} className="text-red-400 flex-shrink-0" />
                  <div>
                    <div className="font-bold text-red-400 text-sm">URGENT - Act Fast!</div>
                    <div className="text-red-200 text-xs mt-0.5">
                      Pets are most likely to be found in the first 24 hours
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Sightings */}
              <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-2 border-amber-500/50 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-amber-400 mb-1">
                  <Eye size={16} />
                  <span className="text-2xl font-bold">{mission.sightingsCount || 0}</span>
                </div>
                <div className="text-xs text-amber-200">Sightings</div>
              </div>

              {/* Helpers */}
              <div className="bg-gradient-to-br from-flash-500/20 to-flash-600/20 border-2 border-flash-500/50 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-flash-400 mb-1">
                  <Users size={16} />
                  <span className="text-2xl font-bold">{mission.helperCount || 0}</span>
                </div>
                <div className="text-xs text-flash-200">Helpers</div>
              </div>

              {/* Reward */}
              {mission.rewardAmount > 0 && (
                <div className="col-span-2 bg-gradient-to-br from-emerald-500/20 to-green-500/20 border-2 border-emerald-500/50 rounded-xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-emerald-400 mb-1">
                    <Award size={18} />
                    <span className="text-2xl font-bold">${mission.rewardAmount}</span>
                  </div>
                  <div className="text-xs text-emerald-200">Reward Offered</div>
                </div>
              )}
            </div>

            {/* Case Number */}
            <div className="text-center text-xs text-slate-500">
              Mission ID: #{mission.caseNumber || mission.id?.slice(0, 8).toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
