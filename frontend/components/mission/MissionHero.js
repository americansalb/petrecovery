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

import { useState } from 'react';
import { Clock, Users, Eye, Award, Heart, AlertCircle, MapPin, UserPlus, Shield, Radio } from 'lucide-react';
import { normalizePhotoUrl } from '@/app/lib/utils';

export default function MissionHero({ mission, session, onJoinMission }) {
  const [showJoinModal, setShowJoinModal] = useState(false);

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

  // Check if user is already deployed on this mission
  const isDeployed = session && mission.helpers?.some(h => h.userId === session.user.id);
  const isOwner = session && mission.ownerId === session.user.id;

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
            {/* Join Mission CTA - Military Style */}
            {!isReunited && !isOwner && (
              <div>
                {!isDeployed ? (
                  <button
                    onClick={() => setShowJoinModal(true)}
                    className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-flash-500 to-flash-400 text-midnight-900 font-black text-lg hover:scale-105 transition-all shadow-2xl shadow-flash-500/50 border-2 border-flash-300 group relative overflow-hidden"
                  >
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-flash-400 to-flash-300 opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="relative flex items-center justify-center gap-3">
                      <Radio size={24} className="animate-pulse" />
                      <span>JOIN RESCUE MISSION</span>
                      <Shield size={24} />
                    </div>

                    {/* Military stripes decoration */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-midnight-900/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-midnight-900/30 to-transparent" />
                  </button>
                ) : (
                  <div className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-2 border-emerald-500/50 text-center">
                    <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold mb-1">
                      <Shield size={20} className="animate-pulse" />
                      <span className="text-lg">DEPLOYED</span>
                      <Radio size={20} className="animate-pulse" />
                    </div>
                    <div className="text-xs text-emerald-200">
                      You're active on this rescue mission
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mission Commander Badge - for owners */}
            {isOwner && !isReunited && (
              <div className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-flash-500/20 to-amber-500/20 border-2 border-flash-500/50 text-center">
                <div className="flex items-center justify-center gap-2 text-flash-400 font-bold mb-1">
                  <Shield size={20} />
                  <span className="text-lg">MISSION COMMANDER</span>
                </div>
                <div className="text-xs text-flash-200">
                  You initiated this rescue operation
                </div>
              </div>
            )}

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

        {/* Deployed Team Members - Show who's active on this mission */}
        {mission.helpers && mission.helpers.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-flash-400 uppercase tracking-wide flex items-center gap-2">
                <Shield size={16} />
                Deployed Team ({mission.helpers.length})
              </h3>
              <span className="text-xs text-slate-500">Active helpers on this mission</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {mission.helpers.slice(0, 6).map((helper, idx) => (
                <div
                  key={helper.id || idx}
                  className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 group hover:border-flash-500/30 transition"
                >
                  {/* Avatar */}
                  {helper.avatar ? (
                    <img
                      src={helper.avatar}
                      alt={helper.name}
                      className="w-10 h-10 rounded-full border-2 border-flash-500/30"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-flash-500/20 to-flash-600/20 border-2 border-flash-500/30 flex items-center justify-center text-flash-400 font-bold">
                      {helper.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}

                  {/* Helper Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white text-sm truncate group-hover:text-flash-400 transition">
                      {helper.name || 'Anonymous Helper'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Active</span>
                    </div>
                  </div>

                  {/* Badge for current user */}
                  {session && helper.userId === session.user.id && (
                    <div className="px-2 py-0.5 rounded-md bg-flash-500/20 border border-flash-500/50 text-flash-400 text-xs font-bold">
                      YOU
                    </div>
                  )}
                </div>
              ))}

              {/* Show more indicator */}
              {mission.helpers.length > 6 && (
                <div className="flex items-center justify-center bg-slate-800/30 border border-slate-700/50 rounded-lg p-3 text-slate-400">
                  <span className="text-sm font-semibold">
                    +{mission.helpers.length - 6} more
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Join Mission Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-800 border-2 border-flash-500/50 rounded-2xl max-w-2xl w-full shadow-2xl shadow-flash-500/20 animate-slideUp">
            {/* Header - Military Style */}
            <div className="bg-gradient-to-r from-flash-500 to-flash-400 text-midnight-900 px-6 py-4 rounded-t-xl border-b-4 border-flash-300">
              <div className="flex items-center justify-center gap-3">
                <Radio size={28} className="animate-pulse" />
                <h2 className="text-2xl font-black">RESCUE MISSION DEPLOYMENT</h2>
                <Shield size={28} />
              </div>
              <div className="text-center text-sm font-bold mt-1 text-midnight-800">
                Mission: {mission.petName} Recovery Operation
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Mission Brief */}
              <div className="bg-slate-900/50 border-2 border-slate-700 rounded-xl p-4">
                <h3 className="text-flash-400 font-bold mb-3 flex items-center gap-2">
                  <AlertCircle size={18} />
                  MISSION BRIEF
                </h3>
                <div className="space-y-2 text-sm text-slate-300">
                  <p>
                    <strong className="text-white">Objective:</strong> Assist in locating and safely recovering {mission.petName},
                    a {mission.petSpecies?.toLowerCase()} last seen {mission.lastSeenAddress || 'in the area'}.
                  </p>
                  <p>
                    <strong className="text-white">Status:</strong> {timeMissing?.text || 'Unknown duration'} missing
                    {isUrgent && <span className="text-red-400 font-bold ml-2">⚡ URGENT - First 24 hours critical</span>}
                  </p>
                  <p>
                    <strong className="text-white">Current Deployment:</strong> {mission.helperCount || 0} helper{mission.helperCount !== 1 ? 's' : ''} active
                  </p>
                </div>
              </div>

              {/* Responsibilities */}
              <div className="bg-slate-900/50 border-2 border-slate-700 rounded-xl p-4">
                <h3 className="text-flash-400 font-bold mb-3 flex items-center gap-2">
                  <Shield size={18} />
                  YOUR MISSION RESPONSIBILITIES
                </h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="text-flash-400 font-bold">•</span>
                    <span>Report any sightings immediately through the mission tracking system</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-flash-400 font-bold">•</span>
                    <span>Coordinate with other helpers to avoid duplicate coverage</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-flash-400 font-bold">•</span>
                    <span>Follow safety protocols - do not approach if pet appears aggressive</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-flash-400 font-bold">•</span>
                    <span>Update your status and share progress in the mission feed</span>
                  </li>
                </ul>
              </div>

              {/* Waiver Notice */}
              <div className="bg-amber-500/10 border-2 border-amber-500/50 rounded-xl p-4">
                <p className="text-xs text-amber-200">
                  By joining this rescue mission, you acknowledge that you're volunteering at your own risk.
                  PetRecovery.org provides coordination tools but is not responsible for volunteer activities.
                  Always prioritize your safety and follow local laws and regulations.
                </p>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 pb-6 flex gap-4">
              <button
                onClick={() => setShowJoinModal(false)}
                className="flex-1 px-6 py-3 rounded-xl bg-slate-700 text-slate-300 font-bold hover:bg-slate-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onJoinMission?.(mission.id);
                  setShowJoinModal(false);
                }}
                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-flash-500 to-flash-400 text-midnight-900 font-black hover:scale-105 transition-all shadow-lg shadow-flash-500/30 flex items-center justify-center gap-2"
              >
                <Radio size={20} />
                <span>CONFIRM DEPLOYMENT</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
